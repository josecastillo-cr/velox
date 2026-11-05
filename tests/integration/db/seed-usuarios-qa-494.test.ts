import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { seedUsuariosQa } from "@/scripts/seed-usuarios-qa";
import {
  HAY_BASE_DE_DATOS,
  crearPrismaDeTest,
  enTransaccionRevertida,
  serializarEscriturasReales,
  type TxDeTest,
} from "./_postgres-real";

// FEATURE 494 (R29, R30, design §6) — LA SIEMBRA QA PASA LA CUENTA AL CORREO NUEVO, CONTRA POSTGRES.
//
// Lo que hay que demostrar lo decide la base: `email` y `cedula` son `@unique`, y una siembra que
// solo cambiara el literal reventaria en la segunda corrida por la cedula. Un doble diria que si.
//
// Todo va dentro de una transaccion revertida: la base local la comparten otras sesiones, y estas
// cuentas son con las que entran. Sin revertir, este test les cambiaria la contrasena.

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

// Literales: el correo viejo no sale del script, para que el test no se compare con su propia fuente.
const CORREOS = [
  { viejo: "admin.qa@ordenex.test", nuevo: "admin.qa@empresa.test", cedula: "9000000002", rol: "admin" },
  { viejo: "mensajero.qa@ordenex.test", nuevo: "mensajero.qa@empresa.test", cedula: "9000000003", rol: "mensajero" },
  { viejo: "tienda.qa@ordenex.test", nuevo: "tienda.qa@empresa.test", cedula: "9000000004", rol: "adminTienda" },
  { viejo: "satelite.qa@ordenex.test", nuevo: "satelite.qa@empresa.test", cedula: "9000000005", rol: "adminSatelite" },
] as const;

const HASH_A = "hash-de-prueba-a";
const HASH_B = "hash-de-prueba-b";

/** Deja la base como la dejo la siembra anterior: las cuatro cuentas, con el correo viejo. */
async function sembradaConElCorreoViejo(tx: TxDeTest): Promise<Map<string, string>> {
  await seedUsuariosQa(tx, HASH_A);
  const ids = new Map<string, string>();
  for (const c of CORREOS) {
    const fila = await tx.usuario.update({ where: { email: c.nuevo }, data: { email: c.viejo }, select: { id: true } });
    ids.set(c.viejo, fila.id);
  }
  return ids;
}

const correosDe = (tx: TxDeTest, lista: readonly string[]) =>
  tx.usuario.findMany({ where: { email: { in: [...lista] } }, select: { id: true, email: true } });

describeSiHayBase("494 — siembra QA con el correo nuevo (Postgres real)", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = crearPrismaDeTest();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("R29 — dos corridas: misma id, misma cedula, ninguna con el correo viejo y ninguna cuenta de mas", async () => {
    await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      const ids = await sembradaConElCorreoViejo(tx);
      expect(ids.size).toBe(4);
      const totalAntes = await tx.usuario.count();

      for (const hash of [HASH_A, HASH_B]) {
        await seedUsuariosQa(tx, hash);

        expect(await correosDe(tx, CORREOS.map((c) => c.viejo))).toEqual([]);
        expect(await tx.usuario.count()).toBe(totalAntes);
        for (const c of CORREOS) {
          const fila = await tx.usuario.findUnique({
            where: { email: c.nuevo },
            select: { id: true, cedula: true, passwordHash: true, estado: true, rol: { select: { value: true } } },
          });
          expect(fila?.id, c.nuevo).toBe(ids.get(c.viejo));
          expect(fila?.cedula, c.nuevo).toBe(c.cedula);
          expect(fila?.rol.value, c.nuevo).toBe(c.rol);
          expect(fila?.passwordHash, c.nuevo).toBe(hash);
          expect(fila?.estado, c.nuevo).toBe("activo");
        }
      }
    });
  });

  it("R29 — lo que cuelga de la cuenta sigue colgando de ella", async () => {
    await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      const ids = await sembradaConElCorreoViejo(tx);
      const usuarioId = ids.get("admin.qa@ordenex.test") as string;
      const vista = await tx.vistaFiltro.create({
        data: { usuarioId, superficie: "ordenes", nombre: "vista-494", filtro: {} },
        select: { id: true },
      });

      await seedUsuariosQa(tx, HASH_B);

      const fila = await tx.vistaFiltro.findUniqueOrThrow({
        where: { id: vista.id },
        select: { usuario: { select: { email: true } } },
      });
      expect(fila.usuario.email).toBe("admin.qa@empresa.test");
    });
  });

  it("R29 — sobre una base sin ninguna de las dos, las crea", async () => {
    await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      await seedUsuariosQa(tx, HASH_A);
      // Quitadas de en medio sin borrarlas: pueden tener filas que cuelguen de ellas.
      for (const [i, c] of CORREOS.entries()) {
        await tx.usuario.update({
          where: { email: c.nuevo },
          data: { email: `apartada-${i}@ejemplo.test`, cedula: `800000000${i}` },
        });
      }
      const totalAntes = await tx.usuario.count();

      await seedUsuariosQa(tx, HASH_B);

      expect(await tx.usuario.count()).toBe(totalAntes + 4);
      expect(await correosDe(tx, CORREOS.map((c) => c.nuevo))).toHaveLength(4);
    });
  });

  it("R29 — si existen las dos, la vieja se queda como esta y no se crea otra", async () => {
    await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      await seedUsuariosQa(tx, HASH_A);
      const [c] = CORREOS;
      const nueva = await tx.usuario.findUniqueOrThrow({ where: { email: c.nuevo }, select: { id: true, tipoIdentificacionId: true, rolId: true } });
      const vieja = await tx.usuario.create({
        data: {
          nombre: "Doble",
          email: c.viejo,
          telefono: "88880099",
          passwordHash: HASH_A,
          estado: "activo",
          cedula: "8000000099",
          tipoIdentificacionId: nueva.tipoIdentificacionId,
          rolId: nueva.rolId,
        },
        select: { id: true },
      });
      const totalAntes = await tx.usuario.count();

      await seedUsuariosQa(tx, HASH_B);

      expect(await tx.usuario.count()).toBe(totalAntes);
      const filas = await correosDe(tx, [c.viejo, c.nuevo]);
      expect(filas.find((f) => f.email === c.viejo)?.id).toBe(vieja.id);
      expect(filas.find((f) => f.email === c.nuevo)?.id).toBe(nueva.id);
    });
  });

  it("R30 — ninguna otra cuenta cambia de correo", async () => {
    await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      await sembradaConElCorreoViejo(tx);
      // Cuenta ajena con el mismo dominio viejo: el pase va por correo exacto, no por dominio.
      const plantilla = await tx.usuario.findUniqueOrThrow({
        where: { email: "admin.qa@ordenex.test" },
        select: { tipoIdentificacionId: true, rolId: true },
      });
      await tx.usuario.create({
        data: {
          nombre: "Ajena",
          email: "otra.persona@ordenex.test",
          telefono: "88880098",
          passwordHash: HASH_A,
          estado: "activo",
          cedula: "8000000098",
          tipoIdentificacionId: plantilla.tipoIdentificacionId,
          rolId: plantilla.rolId,
        },
      });
      const propios = new Set<string>(CORREOS.flatMap((c) => [c.viejo, c.nuevo]));
      const ajenas = async () =>
        (await tx.usuario.findMany({ select: { id: true, email: true }, orderBy: { id: "asc" } })).filter((u) => !propios.has(u.email));
      const antes = await ajenas();
      expect(antes.some((u) => u.email === "otra.persona@ordenex.test")).toBe(true);

      await seedUsuariosQa(tx, HASH_B);

      expect(await ajenas()).toEqual(antes);
    });
  });
});
