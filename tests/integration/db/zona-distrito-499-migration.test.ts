import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PrismaClient } from "@prisma/client";

import {
  HAY_BASE_DE_DATOS,
  crearPrismaDeTest,
  enTransaccionRevertida,
  fksDeOrden,
  serializarEscriturasReales,
  type FksDeOrden,
  type TxDeTest,
} from "./_postgres-real";
import { soloEjecutable } from "./_fixtures/sql-ejecutable";

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⭑ FICHA 499 / B.3 — LAS DOS MIGRACIONES DE «UN DISTRITO EN UNA SOLA ZONA», contra Postgres.
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// Se leen los `.sql` del disco y se ejecutan DENTRO de la transaccion del test, que SIEMPRE se
// revierte. Para poder sembrar duplicados, el mundo se prepara asi (`prepararMundo`), todo dentro
// de esa transaccion:
//   1. se quita el indice unico de la 499, si esta;
//   2. se corre el `up` de la limpieza una vez, para que la base de partida no tenga duplicados
//      AJENOS al escenario (la base local es compartida y puede no estar migrada);
//   3. se vacia el respaldo.
// Desde ahi, lo unico duplicado es lo que siembra cada caso.

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

const MIGRACIONES = path.join(process.cwd(), "db", "migrations");
const leer = (dir: string, archivo: string) =>
  fs.readFileSync(path.join(MIGRACIONES, dir, archivo), "utf8").replace(/\r\n/g, "\n");
const DIR_1 = "20261102130000_zona_distrito_limpieza_499";
const DIR_2 = "20261102130100_zona_distrito_unico_499";
const UP_1 = soloEjecutable(leer(DIR_1, "migration.sql"));
const DOWN_1 = soloEjecutable(leer(DIR_1, "down.sql"));
const UP_2 = soloEjecutable(leer(DIR_2, "migration.sql"));
const DOWN_2 = soloEjecutable(leer(DIR_2, "down.sql"));

const INDICE = "zona_distrito_distrito_id_key";

let contador = 0;
const SUFIJO = `499m-${Date.now().toString(36)}`;
function unico(): string {
  contador += 1;
  return `${SUFIJO}-${contador.toString(36)}-${randomUUID().slice(0, 6)}`;
}

interface Asignacion {
  id: string;
  zona_id: string;
  distrito_id: string;
}

/** Ejecuta `sql` en un SAVEPOINT; devuelve el mensaje del error si fallo, o `null` si paso. */
async function intentar(tx: TxDeTest, sql: string): Promise<string | null> {
  const punto = `sp_${randomUUID().replace(/-/g, "")}`;
  await tx.$executeRawUnsafe(`SAVEPOINT ${punto}`);
  try {
    await tx.$executeRawUnsafe(sql);
    await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${punto}`);
    return null;
  } catch (e) {
    await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${punto}`);
    const err = e as { message?: string; meta?: unknown };
    return `${String(err?.message ?? e)} ${JSON.stringify(err?.meta ?? null)}`;
  }
}

async function correr(tx: TxDeTest, sql: string): Promise<void> {
  const error = await intentar(tx, sql);
  if (error !== null) throw new Error(`el sql fallo: ${error}`);
}

async function hayIndice(tx: TxDeTest): Promise<boolean> {
  const filas = await tx.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*) AS n FROM pg_indexes WHERE schemaname = 'public' AND indexname = $1`,
    INDICE,
  );
  return Number(filas[0].n) === 1;
}

async function hayEsquemaRespaldo(tx: TxDeTest): Promise<boolean> {
  const filas = await tx.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*) AS n FROM pg_namespace WHERE nspname = 'respaldo'`,
  );
  return Number(filas[0].n) === 1;
}

async function asignacionesDe(tx: TxDeTest, distritoIds: string[]): Promise<Asignacion[]> {
  return tx.$queryRawUnsafe<Asignacion[]>(
    `SELECT id, zona_id, distrito_id FROM zona_distrito WHERE distrito_id = ANY($1::text[]) ORDER BY id`,
    distritoIds,
  );
}

async function todasLasAsignaciones(tx: TxDeTest): Promise<Asignacion[]> {
  return tx.$queryRawUnsafe<Asignacion[]>(
    `SELECT id, zona_id, distrito_id FROM zona_distrito ORDER BY id`,
  );
}

async function respaldo(tx: TxDeTest): Promise<(Asignacion & { respaldado_at: Date })[]> {
  return tx.$queryRawUnsafe(
    `SELECT id, zona_id, distrito_id, respaldado_at FROM respaldo.zona_distrito_499 ORDER BY id`,
  );
}

/** Una huella por tabla: si cambia una sola fila de cualquiera de las cinco, cambia la huella. */
async function huellaDeTablasAjenas(tx: TxDeTest): Promise<Record<string, string>> {
  const salida: Record<string, string> = {};
  for (const tabla of ["orden", "zona", "distrito", "tarifa_zona_mensajero", "historial_accion"]) {
    const filas = await tx.$queryRawUnsafe<{ h: string | null; n: bigint }[]>(
      `SELECT md5(string_agg(t::text, '|' ORDER BY t.id)) AS h, count(*) AS n FROM "${tabla}" t`,
    );
    salida[tabla] = `${Number(filas[0].n)}:${filas[0].h ?? "vacia"}`;
  }
  return salida;
}

describeSiHayBase("499/B.3 — las migraciones de un distrito en una sola zona (Postgres real)", () => {
  let prisma: PrismaClient;
  let FKS: FksDeOrden;

  beforeAll(async () => {
    prisma = crearPrismaDeTest();
    const fks = await fksDeOrden(prisma);
    if (fks === null) {
      throw new Error(
        "hay DATABASE_URL pero la tabla `orden` esta vacia: sin un canton no se pueden sembrar " +
          "distritos. Corre `pnpm run db:seed` antes de esta suite.",
      );
    }
    FKS = fks;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  /** Ver la cabecera: sin indice, sin duplicados ajenos, respaldo vacio y ninguna central. */
  async function prepararMundo(tx: TxDeTest): Promise<void> {
    await serializarEscriturasReales(tx);
    await correr(tx, `DROP INDEX IF EXISTS "${INDICE}"`);
    await correr(tx, UP_1);
    await correr(tx, `TRUNCATE respaldo.zona_distrito_499`);
    await tx.zona.updateMany({ where: { esCentral: true }, data: { esCentral: false } });
    if (await hayIndice(tx)) throw new Error("premisa rota: el indice sigue puesto");
  }

  async function zona(tx: TxDeTest, central = false): Promise<string> {
    const z = await tx.zona.create({
      data: {
        nombre: `499m Z ${unico()}`,
        esCentral: central,
        sinpeNumero: "80000000",
        sinpeNombre: "Titular de Prueba",
      },
      select: { id: true },
    });
    return z.id;
  }

  async function distrito(tx: TxDeTest, zonaIds: string[]): Promise<string> {
    const d = await tx.distrito.create({
      data: { nombre: `499m D ${unico()}`, cantonId: FKS.cantonId },
      select: { id: true },
    });
    for (const zonaId of zonaIds) {
      await tx.zonaDistrito.create({ data: { zonaId, distritoId: d.id } });
    }
    return d.id;
  }

  /** Siembra los casos (a), (b1), (b2) y un control sin duplicado. */
  async function sembrarCasos(tx: TxDeTest) {
    const central = await zona(tx, true);
    const n1 = await zona(tx);
    const n2 = await zona(tx);
    const n3 = await zona(tx);
    const a = await distrito(tx, [central, n1]);
    const b1 = await distrito(tx, [n1, n2]);
    const b2 = await distrito(tx, [central, n2, n3]);
    const control = await distrito(tx, [n3]);
    // Una tarifa y una orden en un distrito que se limpia: R6 tiene algo que comparar.
    await tx.tarifaZonaMensajero.create({
      data: { zonaId: central, cobroEntregado: "1000.00", cobroRechazado: "500.00" },
      select: { id: true },
    });
    await tx.orden.create({
      data: {
        numRemision: `R-${unico()}`,
        destinatario: "Destinataria 499",
        telefonoDest: "8888-0000",
        producto: "caja de zapatos",
        estatusId: FKS.estatusId,
        tiendaId: FKS.tiendaId,
        zonaId: central,
        provinciaId: FKS.provinciaId,
        cantonId: FKS.cantonId,
        distritoId: a,
        direccion: "avenida siempre viva 742",
        montoCobrar: 12_000,
      },
      select: { id: true },
    });
    return { central, n1, n2, n3, a, b1, b2, control, distritos: [a, b1, b2, control] };
  }

  it("R2/R3/R4: (a) queda la no central; (b1) y (b2) quedan sin zona; lo borrado es exactamente el respaldo", async () => {
    const m = await enTransaccionRevertida(prisma, async (tx) => {
      await prepararMundo(tx);
      const c = await sembrarCasos(tx);
      const antes = await asignacionesDe(tx, c.distritos);
      const todasAntes = await todasLasAsignaciones(tx);
      await correr(tx, UP_1);
      const despues = await asignacionesDe(tx, c.distritos);
      const todasDespues = await todasLasAsignaciones(tx);
      return { c, antes, despues, todasAntes, todasDespues, respaldo: await respaldo(tx) };
    });
    const { c } = m;
    const zonasDe = (d: string) => m.despues.filter((f) => f.distrito_id === d).map((f) => f.zona_id);

    // R2 (regla a): se queda la NO central. M5 (conservar la central) pone esto rojo.
    expect(zonasDe(c.a)).toEqual([c.n1]);
    // R3 (regla b): dos no centrales, y tres zonas: sin ninguna asignacion.
    expect(zonasDe(c.b1)).toEqual([]);
    expect(zonasDe(c.b2)).toEqual([]);
    // El distrito sin duplicado no se toca.
    expect(zonasDe(c.control)).toEqual([c.n3]);

    // R4: las filas que desaparecieron son EXACTAMENTE las del respaldo, columna a columna.
    const idsDespues = new Set(m.todasDespues.map((f) => f.id));
    const borradas = m.todasAntes.filter((f) => !idsDespues.has(f.id));
    expect(borradas).toHaveLength(6); // (a) 1 + (b1) 2 + (b2) 3
    expect(m.respaldo.map(({ id, zona_id, distrito_id }) => ({ id, zona_id, distrito_id }))).toEqual(
      borradas,
    );
    for (const fila of m.respaldo) expect(fila.respaldado_at).toBeInstanceOf(Date);
    // Y ninguna fila nueva aparecio.
    const idsAntes = new Set(m.todasAntes.map((f) => f.id));
    expect(m.todasDespues.every((f) => idsAntes.has(f.id))).toBe(true);
    expect(m.antes).toHaveLength(8); // (a) 2 + (b1) 2 + (b2) 3 + control 1
  });

  it("R5: sin duplicados no se borra nada y el respaldo queda vacio", async () => {
    const m = await enTransaccionRevertida(prisma, async (tx) => {
      await prepararMundo(tx);
      const z1 = await zona(tx);
      const z2 = await zona(tx);
      await distrito(tx, [z1]);
      await distrito(tx, [z2]);
      const antes = await todasLasAsignaciones(tx);
      await correr(tx, UP_1);
      return { antes, despues: await todasLasAsignaciones(tx), respaldo: await respaldo(tx) };
    });
    expect(m.despues).toEqual(m.antes);
    expect(m.respaldo).toEqual([]);
  });

  it("R6: orden, zona, distrito, tarifa_zona_mensajero e historial_accion no cambian", async () => {
    const m = await enTransaccionRevertida(prisma, async (tx) => {
      await prepararMundo(tx);
      await sembrarCasos(tx);
      const antes = await huellaDeTablasAjenas(tx);
      await correr(tx, UP_1);
      const despues = await huellaDeTablasAjenas(tx);
      return { antes, despues, borradas: (await respaldo(tx)).length };
    });
    expect(m.borradas).toBe(6); // anti-vacuidad: la limpieza SI hizo algo
    expect(m.despues).toEqual(m.antes);
  });

  it("R7: la migracion del indice sobre un duplicado restante falla y no crea el indice", async () => {
    const m = await enTransaccionRevertida(prisma, async (tx) => {
      await prepararMundo(tx);
      const z1 = await zona(tx);
      const z2 = await zona(tx);
      await distrito(tx, [z1, z2]);
      const error = await intentar(tx, UP_2);
      return { error, indice: await hayIndice(tx) };
    });
    expect(m.error).not.toBeNull();
    expect(m.error).toMatch(/zona_distrito_distrito_id_key|23505|duplicad|duplicate/i);
    expect(m.indice).toBe(false);
  });

  it("R1: con el indice puesto, una segunda asignacion insertada a pelo se rechaza", async () => {
    const m = await enTransaccionRevertida(prisma, async (tx) => {
      await prepararMundo(tx);
      await correr(tx, UP_2);
      const z1 = await zona(tx);
      const z2 = await zona(tx);
      const d = await distrito(tx, [z1]);
      const error = await intentar(
        tx,
        `INSERT INTO zona_distrito (id, zona_id, distrito_id) VALUES ('${randomUUID()}', '${z2}', '${d}')`,
      );
      return { error, filas: (await asignacionesDe(tx, [d])).length, indice: await hayIndice(tx) };
    });
    expect(m.indice).toBe(true);
    expect(m.error).toMatch(/zona_distrito_distrito_id_key/);
    expect(m.filas).toBe(1);
  });

  it("R8: up, down, up — el down devuelve lo respaldado y el segundo up da el mismo estado", async () => {
    const m = await enTransaccionRevertida(prisma, async (tx) => {
      await prepararMundo(tx);
      // El mundo de partida SIN el esquema de respaldo, como en una base nunca migrada. Ficha 498: su
      // respaldo (`asientos_satelite_498`, posterior) tambien vive aqui; se quita dentro de la tx.
      await correr(tx, `DROP TABLE IF EXISTS respaldo.asientos_satelite_498`);
      await correr(tx, `DROP TABLE respaldo.zona_distrito_499`);
      await correr(tx, `DROP SCHEMA IF EXISTS respaldo`);
      const c = await sembrarCasos(tx);
      const inicial = await asignacionesDe(tx, c.distritos);

      await correr(tx, UP_1);
      await correr(tx, UP_2);
      const tras1 = {
        asignaciones: await asignacionesDe(tx, c.distritos),
        respaldo: (await respaldo(tx)).map(({ id, zona_id, distrito_id }) => ({ id, zona_id, distrito_id })),
        indice: await hayIndice(tx),
      };

      await correr(tx, DOWN_2);
      await correr(tx, DOWN_1);
      const trasDown = {
        asignaciones: await asignacionesDe(tx, c.distritos),
        indice: await hayIndice(tx),
        esquema: await hayEsquemaRespaldo(tx),
      };

      await correr(tx, UP_1);
      await correr(tx, UP_2);
      const tras2 = {
        asignaciones: await asignacionesDe(tx, c.distritos),
        respaldo: (await respaldo(tx)).map(({ id, zona_id, distrito_id }) => ({ id, zona_id, distrito_id })),
        indice: await hayIndice(tx),
      };
      return { inicial, tras1, trasDown, tras2 };
    });

    expect(m.tras1.indice).toBe(true);
    expect(m.tras1.respaldo).toHaveLength(6);
    // down: vuelve TODO lo respaldado, sin indice y sin esquema (quedo vacio).
    expect(m.trasDown.asignaciones).toEqual(m.inicial);
    expect(m.trasDown.indice).toBe(false);
    expect(m.trasDown.esquema).toBe(false);
    // up otra vez: el mismo estado que la primera aplicacion.
    expect(m.tras2).toEqual(m.tras1);
  });

  it("R8: el down no devuelve filas cuya zona ya no existe y no borra un esquema con otras tablas", async () => {
    const m = await enTransaccionRevertida(prisma, async (tx) => {
      await prepararMundo(tx);
      const c = await sembrarCasos(tx);
      await correr(tx, UP_1);
      await correr(tx, UP_2);
      // La zona n2 desaparece despues de migrar: sus filas respaldadas ya no tienen a donde volver.
      await tx.zonaDistrito.deleteMany({ where: { zonaId: c.n2 } });
      await tx.zona.delete({ where: { id: c.n2 } });
      // Otra tabla en el esquema `respaldo`, ajena a esta ficha. Ficha 498: la suya (posterior) se
      // quita dentro de la tx para que «la otra» sea una sola y la comparacion siga siendo exacta.
      await correr(tx, `DROP TABLE IF EXISTS respaldo.asientos_satelite_498`);
      const otra = `otra_${unico().replace(/[^a-z0-9]/gi, "_")}`;
      await correr(tx, `CREATE TABLE respaldo.${otra} (id int)`);

      await correr(tx, DOWN_2);
      const errorDown1 = await intentar(tx, DOWN_1);
      const tablas = await tx.$queryRawUnsafe<{ relname: string }[]>(
        `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'respaldo' AND c.relkind = 'r' ORDER BY c.relname`,
      );
      return {
        errorDown1,
        asignaciones: await asignacionesDe(tx, c.distritos),
        tablas: tablas.map((t) => t.relname),
        esquema: await hayEsquemaRespaldo(tx),
        c,
        otra,
      };
    });
    expect(m.errorDown1).toBeNull();
    expect(m.asignaciones.some((f) => f.zona_id === m.c.n2)).toBe(false);
    // Lo que si tenia a donde volver, volvio: (a) recupera la central, (b2) la central y n3.
    const zonasDe = (d: string) => m.asignaciones.filter((f) => f.distrito_id === d).map((f) => f.zona_id).sort();
    expect(zonasDe(m.c.a)).toEqual([m.c.central, m.c.n1].sort());
    expect(zonasDe(m.c.b2)).toEqual([m.c.central, m.c.n3].sort());
    expect(zonasDe(m.c.b1)).toEqual([m.c.n1]);
    expect(m.esquema).toBe(true);
    expect(m.tablas).toEqual([m.otra]);
  });
});
