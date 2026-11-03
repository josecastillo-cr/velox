import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PrismaClient } from "@prisma/client";

import {
  HAY_BASE_DE_DATOS,
  crearPrismaDeTest,
  enTransaccionRevertida,
  serializarEscriturasReales,
  type TxDeTest,
} from "./_postgres-real";
import { intentarSql } from "./_fixtures/sqlstate-461";
import {
  DIR_M4,
  DOWN,
  UP,
  algunUsuarioId,
  correr,
  existeColumna,
  huella,
  leer,
  sembrarAjuste,
  sembrarConsolidacion,
  sembrarZona,
} from "./498/_migraciones";

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⭑ FICHA 498 / T2.8 — M4, la regularizacion de lo conciliado antes (Q4), contra Postgres.
// R53 (M4), R54a, R54b, R54d. (R54c, la deuda 0, vive en `498-deuda-satelite-sql-real.test.ts`,
// que mide la deuda de Saldos y del estado de cuenta con la columna puesta.)
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// Mundo: se siembran los casos y despues se corre el `down` real de M4 dentro de la tx (la base
// local ya la tiene aplicada), asi la base queda como antes de M4. Luego, el `up`.

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

async function sembrarCasos(tx: TxDeTest) {
  const usuarioId = await algunUsuarioId(tx);
  const zonaId = await sembrarZona(tx);
  const b = { zonaId, usuarioId };
  // Conciliada con HUECO SINPE: general 10 000, efectivo 6 000, recibido 6 000 (marcada contra el efectivo).
  const huecoSinpe = await sembrarConsolidacion(tx, { ...b, general: "10000", efectivo: "6000", pago: "1500", recibido: "6000" });
  // Conciliada con aporte <= 0: general 100, pago 200, recibido 0.
  const aporteNegativo = await sembrarConsolidacion(tx, { ...b, general: "100", pago: "200", recibido: "0" });
  // Conciliada CON fila de ajuste: ya es de la regla nueva.
  const conAjuste = await sembrarConsolidacion(tx, { ...b, general: "500", recibido: "490" });
  await sembrarAjuste(tx, { cierreBodegaId: conAjuste, usuarioId, evento: "marca", diferencia: "10" });
  // Sin conciliar y con estado `rechazado`.
  const sinConciliar = await sembrarConsolidacion(tx, { ...b, general: "700" });
  const conRechazo = await sembrarConsolidacion(tx, { ...b, general: "800", estado: "rechazado" });
  return { usuarioId, zonaId, huecoSinpe, aporteNegativo, conAjuste, sinConciliar, conRechazo };
}

type Casos = Awaited<ReturnType<typeof sembrarCasos>>;
const ids = (c: Casos) => [c.huecoSinpe, c.aporteNegativo, c.conAjuste, c.sinConciliar, c.conRechazo];

async function marcas(tx: TxDeTest, c: Casos): Promise<Record<string, string | null>> {
  const filas = await tx.$queryRawUnsafe<{ id: string; v: string | null }[]>(
    `SELECT id, esperado_regla_anterior::text AS v FROM cierre_bodega WHERE id = ANY($1::text[])`,
    ids(c),
  );
  return Object.fromEntries(filas.map((f) => [f.id, f.v]));
}

/** Todas las columnas EXISTENTES de las consolidaciones sembradas (sin la columna nueva). */
async function columnasExistentes(tx: TxDeTest, c: Casos): Promise<string> {
  const filas = await tx.$queryRawUnsafe<{ f: string }[]>(
    `SELECT (to_jsonb(b) - 'esperado_regla_anterior')::text AS f FROM cierre_bodega b
      WHERE id = ANY($1::text[]) ORDER BY id`,
    ids(c),
  );
  return filas.map((f) => f.f).join("\n");
}

async function huellaDeLibros(tx: TxDeTest): Promise<Record<string, string>> {
  return {
    caja: await huella(tx, "wallet_movimiento"),
    tienda: await huella(tx, "wallet_tienda_movimiento"),
    mensajero: await huella(tx, "pago_mensajero_movimiento"),
    ajustes: await huella(tx, "conciliacion_bodega_ajuste"),
  };
}

describeSiHayBase("498/T2.8 — M4 regulariza lo conciliado antes (Postgres real)", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = crearPrismaDeTest();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("R54a/R54b: marca SOLO las conciliadas no rechazadas sin ajuste, con = monto_recibido; nada mas cambia", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      // REPEATABLE READ (antes de cualquier otra sentencia): la huella de los libros es de TABLA ENTERA
      // y otro archivo puede commitear un movimiento en paralelo (medido en el gate de la 498: rojo en
      // paralelo, verde aislado). Con una foto fija solo cuenta lo que escribe ESTA transaccion.
      await tx.$executeRawUnsafe("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      await serializarEscriturasReales(tx);
      const c = await sembrarCasos(tx);
      await correr(tx, DOWN(DIR_M4));
      const columnaTrasDown = await existeColumna(tx, "cierre_bodega", "esperado_regla_anterior");
      const librosAntes = await huellaDeLibros(tx);
      const columnasAntes = await columnasExistentes(tx, c);
      await correr(tx, UP(DIR_M4));
      return {
        c,
        columnaTrasDown,
        marcas: await marcas(tx, c),
        librosIguales: JSON.stringify(await huellaDeLibros(tx)) === JSON.stringify(librosAntes),
        columnasIguales: (await columnasExistentes(tx, c)) === columnasAntes,
        columnasAntes,
      };
    });
    expect(r.columnaTrasDown).toBe(false);
    expect(r.marcas).toEqual({
      [r.c.huecoSinpe]: "6000.00",
      [r.c.aporteNegativo]: "0.00",
      [r.c.conAjuste]: null,
      [r.c.sinConciliar]: null,
      [r.c.conRechazo]: null,
    });
    // R54b: ni libros, ni ajustes, ni ninguna columna existente (monto_recibido, estado, conciliado_*,
    // updated_at incluidos) de las consolidaciones.
    expect(r.librosIguales).toBe(true);
    expect(r.columnasIguales).toBe(true);
    expect(r.columnasAntes).toContain("updated_at");
  });

  it("R54d: down quita solo la marca; up → down → up deja las mismas marcadas con los mismos valores", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      const c = await sembrarCasos(tx);
      await correr(tx, DOWN(DIR_M4));
      await correr(tx, UP(DIR_M4));
      const tras1 = await marcas(tx, c);
      const columnas1 = await columnasExistentes(tx, c);
      await correr(tx, DOWN(DIR_M4));
      const trasDown = {
        columna: await existeColumna(tx, "cierre_bodega", "esperado_regla_anterior"),
        columnas: await columnasExistentes(tx, c),
      };
      await correr(tx, UP(DIR_M4));
      return { tras1, columnas1, trasDown, tras2: await marcas(tx, c) };
    });
    expect(r.trasDown.columna).toBe(false);
    expect(r.trasDown.columnas).toBe(r.columnas1);
    expect(r.tras2).toEqual(r.tras1);
  });

  it("R54a: reaplicar con una conciliacion nueva de delta 0 la marca con su recibido (= su aporte)", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      const usuarioId = await algunUsuarioId(tx);
      const zonaId = await sembrarZona(tx);
      // Conciliada con el codigo nuevo y delta 0: recibido = aporte = 1000 − 300 = 700, sin fila de ajuste.
      const id = await sembrarConsolidacion(tx, { zonaId, usuarioId, general: "1000", pago: "300", recibido: "700" });
      // Reaplicar = down + up (el up añade la columna).
      await correr(tx, DOWN(DIR_M4));
      await correr(tx, UP(DIR_M4));
      const [f] = await tx.$queryRawUnsafe<{ v: string | null }[]>(
        `SELECT esperado_regla_anterior::text AS v FROM cierre_bodega WHERE id = $1`,
        id,
      );
      return f.v;
    });
    expect(r).toBe("700.00");
  });

  it("CHECK: `esperado_regla_anterior` en una consolidacion sin conciliar se rechaza", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      const usuarioId = await algunUsuarioId(tx);
      const zonaId = await sembrarZona(tx);
      const id = await sembrarConsolidacion(tx, { zonaId, usuarioId, general: "100" });
      return intentarSql(tx, `UPDATE cierre_bodega SET esperado_regla_anterior = 1 WHERE id = $1`, id);
    });
    expect(r).toBe("23514");
  });

  it("R54a: el UPDATE no nombra ids ni fechas", () => {
    const up = UP(DIR_M4);
    expect(up).not.toMatch(/'[0-9a-f]{8}-[0-9a-f]{4}-/i);
    expect(up).not.toMatch(/'20\d\d-\d\d-\d\d/);
    expect(leer(DIR_M4, "migration.sql").match(/\bUPDATE\b/g)).toHaveLength(1);
  });
});
