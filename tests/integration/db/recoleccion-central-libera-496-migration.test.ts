import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { OrdenHistorialOrigenTipo, PrismaClient } from "@prisma/client";

import {
  instanteCR,
  diaReparto,
  estatusId,
  sembrarBase,
  type BaseSembrada,
} from "../_semilla-tablero-dia";
import { HAY_BASE_DE_DATOS, crearPrismaDeTest, enTransaccionRevertida, type TxDeTest } from "./_postgres-real";
import { soloEjecutable } from "./_fixtures/sql-ejecutable";

// ═════════════════════════════════════════════════════════════════════════════════════════════
// FICHA 496 / T6 — la migración de datos que libera las recolecciones YA recibidas (R14–R17).
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// Lee `migration.sql` y `down.sql` del disco (CRLF normalizado, patrón `iva-488-migration.test.ts`)
// y los EJECUTA contra Postgres dentro de una transacción que siempre se revierte.
//
// Aislamiento frente a la base compartida: antes de sembrar se corre el `up` una vez, que deja la
// base (dentro de la tx) sin órdenes objetivo; desde ahí el número de filas que devuelve cada
// aplicación es exactamente lo sembrado. Las aserciones por columna miran solo filas sembradas.
//
// Correr: `pnpm exec vitest run tests/integration/db/recoleccion-central-libera-496-migration.test.ts`.

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

const DIR = path.join(process.cwd(), "db", "migrations", "20261102150000_recoleccion_central_libera_496");
const leer = (archivo: string) => soloEjecutable(fs.readFileSync(path.join(DIR, archivo), "utf8"));

const DIA = "2001-06-15";
const ASIGNADO_AT = instanteCR(DIA, "07:30");
const FECHA_REPARTO = diaReparto(DIA);

async function crearOrden(
  tx: TxDeTest,
  base: BaseSembrada,
  s: { clave: string; estatus: string; mensajeroId: string | null; deletedAt?: Date },
): Promise<string> {
  const conTrio = s.mensajeroId !== null;
  const o = await tx.orden.create({
    data: {
      numRemision: `${base.sufijo}-${s.clave}`,
      destinatario: `Cliente ${s.clave}`,
      telefonoDest: "80000000",
      direccion: `Direccion ${s.clave}`,
      producto: "caja",
      estatusId: estatusId(base, s.estatus),
      tiendaId: base.tienda,
      zonaId: base.zonaA,
      provinciaId: base.provinciaId,
      cantonId: base.cantonId,
      mensajeroAsignadoId: s.mensajeroId,
      asignadoAt: conTrio ? ASIGNADO_AT : null,
      fechaReparto: conTrio ? FECHA_REPARTO : null,
      createdAt: instanteCR(DIA, "07:00"),
      deletedAt: s.deletedAt ?? null,
    },
    select: { id: true },
  });
  return o.id;
}

async function fila(
  tx: TxDeTest,
  base: BaseSembrada,
  ordenId: string,
  origen: string,
  destino: string,
  origenTipo: OrdenHistorialOrigenTipo,
  actor: string,
  hora: string,
): Promise<void> {
  await tx.ordenHistorialEstado.create({
    data: {
      ordenId,
      estatusOrigenId: estatusId(base, origen),
      estatusDestinoId: estatusId(base, destino),
      actorUsuarioId: actor,
      origenTipo,
      createdAt: instanteCR(DIA, hora),
    },
  });
}

/** asignacion_recoleccion (maestro) -> recoleccion_tienda (`mensajero`) -> recepcion desde en_ruta_bodega_central. */
async function recorridoCompleto(tx: TxDeTest, base: BaseSembrada, ordenId: string, mensajero: string): Promise<void> {
  await fila(tx, base, ordenId, "por_recolectar_en_tienda", "recolectando", "asignacion_recoleccion", base.maestro, "08:00");
  await fila(tx, base, ordenId, "recolectando", "en_ruta_bodega_central", "recoleccion_tienda", mensajero, "09:00");
  await fila(tx, base, ordenId, "en_ruta_bodega_central", "en_bodega_central", "recepcion_bodega_central", base.maestro, "10:00");
}

interface Sembrado {
  base: BaseSembrada;
  objetivo: string;
  hermanas: Record<string, string>;
}

/** La orden objetivo y SEIS hermanas que la migración no debe tocar (R15) o reponer (R16). */
async function sembrar(tx: TxDeTest, conObjetivo = true): Promise<Sembrado> {
  const base = await sembrarBase(tx);
  const m1 = base.mensajero1;
  const hermanas: Record<string, string> = {};

  // (a) Recepción desde en_ruta_bodega_central como PRIMERA fila, y una fila POSTERIOR de otro tipo: la última no es
  //     la recepción. (Recepción primero a propósito: un `DISTINCT ON … ASC` la tomaría por objetivo.)
  hermanas.a = await crearOrden(tx, base, { clave: "a-posterior", estatus: "en_bodega_central", mensajeroId: m1 });
  await fila(tx, base, hermanas.a, "en_ruta_bodega_central", "en_bodega_central", "recepcion_bodega_central", base.maestro, "10:00");
  await fila(tx, base, hermanas.a, "en_bodega_central", "en_bodega_central", "ajuste_estado", base.maestro, "11:00");

  // (b) La última fila es una recepción central, pero de una DEVOLUCIÓN.
  hermanas.b = await crearOrden(tx, base, { clave: "b-devolucion", estatus: "en_bodega_central", mensajeroId: m1 });
  await fila(tx, base, hermanas.b, "devolviendo_a_bodega_central", "en_bodega_central", "recepcion_bodega_central", base.maestro, "10:00");

  // (c) Borrada, con el recorrido completo.
  hermanas.c = await crearOrden(tx, base, {
    clave: "c-borrada",
    estatus: "en_bodega_central",
    mensajeroId: m1,
    deletedAt: instanteCR(DIA, "12:00"),
  });
  await recorridoCompleto(tx, base, hermanas.c, m1);

  // (d) Sin mensajero y sin `recoleccion_tienda`: la última fila es la recepción desde en_ruta_bodega_central
  //     (llegó por otra vía, p. ej. reversión de incidente). El down no tiene a quién reponer.
  hermanas.d = await crearOrden(tx, base, { clave: "d-sin-recoleccion", estatus: "en_bodega_central", mensajeroId: null });
  await fila(tx, base, hermanas.d, "en_ruta_bodega_central", "en_bodega_central", "recepcion_bodega_central", base.maestro, "10:00");

  // (e) En central con mensajero, pero la última fila es de otro tipo.
  hermanas.e = await crearOrden(tx, base, { clave: "e-otro-tipo", estatus: "en_bodega_central", mensajeroId: m1 });
  await fila(tx, base, hermanas.e, "en_preparacion", "en_bodega_central", "generacion_guia", base.maestro, "10:00");

  // (f) Recorrido completo pero ya NO está en en_bodega_central.
  hermanas.f = await crearOrden(tx, base, { clave: "f-otro-estado", estatus: "en_reparto", mensajeroId: m1 });
  await recorridoCompleto(tx, base, hermanas.f, m1);

  let objetivo = "";
  if (conObjetivo) {
    objetivo = await crearOrden(tx, base, { clave: "objetivo", estatus: "en_bodega_central", mensajeroId: m1 });
    await recorridoCompleto(tx, base, objetivo, m1);
  }
  return { base, objetivo, hermanas };
}

/** Cada fila de `orden`, columna a columna, como JSON. */
async function fotos(tx: TxDeTest, ids: string[]): Promise<Record<string, unknown>> {
  const filas = await tx.$queryRawUnsafe<{ id: string; j: unknown }[]>(
    `SELECT o.id, to_jsonb(o) AS j FROM orden o WHERE o.id = ANY($1::text[])`,
    ids,
  );
  return Object.fromEntries(filas.map((f) => [f.id, f.j]));
}

async function trio(tx: TxDeTest, id: string) {
  const o = await tx.orden.findUniqueOrThrow({
    where: { id },
    select: { mensajeroAsignadoId: true, asignadoAt: true, fechaReparto: true },
  });
  return [o.mensajeroAsignadoId, o.asignadoAt?.toISOString() ?? null, o.fechaReparto?.toISOString() ?? null];
}

async function filasDeHistorial(tx: TxDeTest, ids: string[]): Promise<number> {
  return tx.ordenHistorialEstado.count({ where: { ordenId: { in: ids } } });
}

describeSiHayBase("496 — migración de datos: liberar recolecciones ya recibidas (Postgres real)", () => {
  let prisma: PrismaClient;
  beforeAll(() => {
    prisma = crearPrismaDeTest();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("⭑ R14: libera la orden objetivo, sin historial", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      const UP = leer("migration.sql");
      await tx.$executeRawUnsafe(UP); // la base (en la tx) queda sin objetivo previo
      const s = await sembrar(tx);
      const todas = [s.objetivo, ...Object.values(s.hermanas)];
      const antes = { trio: await trio(tx, s.objetivo), historial: await filasDeHistorial(tx, todas) };
      const n = await tx.$executeRawUnsafe(UP);
      return {
        n,
        antes,
        despues: { trio: await trio(tx, s.objetivo), historial: await filasDeHistorial(tx, todas) },
        m1: s.base.mensajero1,
      };
    });
    expect(r.antes.trio).toEqual([r.m1, "2001-06-15T13:30:00.000Z", "2001-06-15T00:00:00.000Z"]);
    expect(r.n).toBe(1);
    expect(r.despues.trio).toEqual([null, null, null]);
    expect(r.despues.historial).toBe(r.antes.historial);
    // Siembra comprobada: a 2 + b 1 + c 3 + d 1 + e 1 + f 3 + objetivo 3.
    expect(r.antes.historial).toBe(14);
  });

  it("⭑ R15: no toca a las hermanas (columna a columna)", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      const UP = leer("migration.sql");
      await tx.$executeRawUnsafe(UP);
      const s = await sembrar(tx);
      const ids = Object.values(s.hermanas);
      const antes = await fotos(tx, ids);
      await tx.$executeRawUnsafe(UP);
      return { antes, despues: await fotos(tx, ids), n: ids.length };
    });
    expect(Object.keys(r.antes)).toHaveLength(6);
    expect(r.despues).toEqual(r.antes);
  });

  it("⭑ R16: down repone al mensajero y nada más", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      const UP = leer("migration.sql");
      const DOWN = leer("down.sql");
      await tx.$executeRawUnsafe(UP);
      const s = await sembrar(tx);
      await tx.$executeRawUnsafe(UP);
      const liberada = await trio(tx, s.objetivo);
      const hermanasAntes = await fotos(tx, Object.values(s.hermanas));
      await tx.$executeRawUnsafe(DOWN);
      return {
        liberada,
        repuesta: await trio(tx, s.objetivo),
        d: await trio(tx, s.hermanas.d),
        hermanasAntes,
        hermanasDespues: await fotos(tx, Object.values(s.hermanas)),
        m1: s.base.mensajero1,
      };
    });
    expect(r.liberada).toEqual([null, null, null]);
    // Solo el mensajero: `asignado_at`/`fecha_reparto` no se reponen (la recolección no los estampa).
    expect(r.repuesta).toEqual([r.m1, null, null]);
    // (d) no tiene `recoleccion_tienda`: sigue sin mensajero.
    expect(r.d).toEqual([null, null, null]);
    expect(r.hermanasDespues).toEqual(r.hermanasAntes);
  });

  it("⭑ R17: base sin objetivo y segunda aplicación: 0 filas", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      const UP = leer("migration.sql");
      await tx.$executeRawUnsafe(UP);
      // Base sin objetivo: solo hermanas.
      const sinObjetivo = await sembrar(tx, false);
      const nSinObjetivo = await tx.$executeRawUnsafe(UP);
      const hermanas = await fotos(tx, Object.values(sinObjetivo.hermanas));
      // Con objetivo: la primera aplicación libera 1; la segunda, 0.
      await sembrar(tx);
      const primera = await tx.$executeRawUnsafe(UP);
      const segunda = await tx.$executeRawUnsafe(UP);
      return { nSinObjetivo, primera, segunda, hermanas: Object.keys(hermanas).length };
    });
    expect(r.hermanas).toBe(6);
    expect(r.nSinObjetivo).toBe(0);
    expect(r.primera).toBe(1);
    expect(r.segunda).toBe(0);
  });
});
