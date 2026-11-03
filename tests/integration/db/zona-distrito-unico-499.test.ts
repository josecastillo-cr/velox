import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { ZonaRepository } from "@/lib/repositories/ZonaRepository";
import { ZonaService } from "@/lib/services/ZonaService";
import type { Actor } from "@/lib/interfaces/services/IZonaService";

import {
  HAY_BASE_DE_DATOS,
  clienteConSavepoint,
  crearPrismaDeTest,
  enTransaccionRevertida,
  fksDeOrden,
  serializarEscriturasReales,
  type TxDeTest,
} from "./_postgres-real";

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⭑ FICHA 499 — UN DISTRITO EN UNA SOLA ZONA, CONTRA POSTGRES REAL.
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// La regla vive en tres sitios que un doble de Prisma NO ve: el `WHERE` de la lectura de
// conflictos (con su `NOT zonaId`), el orden de esa lectura frente a la primera escritura de la
// transaccion, y el indice unico `zona_distrito_distrito_id_key`. Por eso se mide aqui, con filas.
//
// ⚠️ Todo lo sembrado vive en una transaccion que SIEMPRE se revierte, salvo la carrera de R13,
// que necesita una segunda conexion y por tanto datos CONFIRMADOS: esa siembra se borra en un
// `finally`. Nada de `if (!fks) return;`: sin catalogo, el `beforeAll` revienta con un mensaje.

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

const SUFIJO = `499-${Date.now().toString(36)}`;
let contador = 0;
function unico(): string {
  contador += 1;
  return `${SUFIJO}-${contador.toString(36)}-${randomUUID().slice(0, 6)}`;
}

describeSiHayBase("⭑ 499 — un distrito en una sola zona (Postgres real)", () => {
  let prisma: PrismaClient;
  let CANTON: string;
  let ACTOR: Actor;

  beforeAll(async () => {
    prisma = crearPrismaDeTest();
    const fks = await fksDeOrden(prisma);
    if (fks === null) {
      throw new Error(
        "hay DATABASE_URL pero la tabla `orden` esta vacia: sin un canton no se pueden sembrar " +
          "distritos. Corre `pnpm run db:seed` antes de esta suite.",
      );
    }
    CANTON = fks.cantonId;
    const usuario = await prisma.usuario.findFirst({ select: { id: true } });
    if (usuario === null) {
      throw new Error("hacen falta usuarios en la base. Corre `pnpm run db:seed:maestro`.");
    }
    ACTOR = { usuarioId: usuario.id, rol: "maestro" };
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  async function sembrarZona(tx: TxDeTest, prefijo: string): Promise<{ id: string; nombre: string }> {
    const nombre = `499 ${prefijo} ${unico()}`;
    const z = await tx.zona.create({
      data: { nombre, sinpeNumero: "80000000", sinpeNombre: "Titular de Prueba" },
      select: { id: true },
    });
    return { id: z.id, nombre };
  }

  async function sembrarDistrito(tx: TxDeTest, zonaIds: string[], nombre?: string): Promise<string> {
    const d = await tx.distrito.create({
      data: { nombre: nombre ?? `499 D ${unico()}`, cantonId: CANTON },
      select: { id: true },
    });
    for (const zonaId of zonaIds) {
      await tx.zonaDistrito.create({ data: { zonaId, distritoId: d.id } });
    }
    return d.id;
  }

  function servicio(tx: TxDeTest): ZonaService {
    return new ZonaService(new ZonaRepository(clienteConSavepoint(tx)));
  }

  // ═══════════════════════════════════════════════════════════════════════════════════════════
  // B.0 — el defecto, medido antes de arreglarlo
  // ═══════════════════════════════════════════════════════════════════════════════════════════

  it("B.0 (i): crear una zona con un distrito que ya esta en otra responde validation_error", async () => {
    const medido = await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      const x = await sembrarZona(tx, "X");
      const d = await sembrarDistrito(tx, [x.id]);
      const res = await servicio(tx).crear(
        {
          nombre: `499 Nueva ${unico()}`,
          cobroVehiculo: false,
          esCentral: false,
          distritoIds: [d],
          tarifas: [],
          sinpeNumero: "80000000",
          sinpeNombre: "Titular de Prueba",
        },
        ACTOR,
      );
      const asignaciones = await tx.zonaDistrito.count({ where: { distritoId: d } });
      return { status: res.status, asignaciones };
    });
    expect(medido.status).toBe("validation_error");
    expect(medido.asignaciones).toBe(1);
  });

  it("B.0 (ii): actualizar Y con un distrito de X responde validation_error y Y no cambia", async () => {
    const medido = await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      const x = await sembrarZona(tx, "X");
      const y = await sembrarZona(tx, "Y");
      const dx = await sembrarDistrito(tx, [x.id]);
      const dy = await sembrarDistrito(tx, [y.id]);
      const res = await servicio(tx).actualizar(
        y.id,
        { nombre: `${y.nombre} renombrada`, cobroVehiculo: false, distritoIds: [dy, dx], tarifas: [] },
        ACTOR,
      );
      const zonaY = await tx.zona.findUniqueOrThrow({ where: { id: y.id }, select: { nombre: true } });
      const distritosY = (
        await tx.zonaDistrito.findMany({ where: { zonaId: y.id }, select: { distritoId: true } })
      ).map((f) => f.distritoId);
      return { status: res.status, nombreY: zonaY.nombre, distritosY, nombreOriginal: y.nombre, dy };
    });
    expect(medido.status).toBe("validation_error");
    expect(medido.nombreY).toBe(medido.nombreOriginal);
    expect(medido.distritosY).toEqual([medido.dy]);
  });
});
