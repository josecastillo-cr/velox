import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { WALLET_MOVIMIENTO_CATEGORIA_SEED } from "@/lib/types/wallet";

import {
  HAY_BASE_DE_DATOS,
  crearPrismaDeTest,
  enTransaccionRevertida,
  etiquetasDeEnum,
  serializarEscriturasReales,
  type TxDeTest,
} from "./_postgres-real";
import { soloEjecutable } from "./_fixtures/sql-ejecutable";
import { intentarSql as intentar } from "./_fixtures/sqlstate-461";

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⭑ FICHA 488 / T B.2 — LAS DOS MIGRACIONES DEL IVA POR PAGAR, contra Postgres (R35, R36).
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
//  (a) el catalogo de la caja es EXACTAMENTE el seed, con los dos valores de la 488 AL FINAL; el `up` de
//      la 1 son DOS `ADD VALUE IF NOT EXISTS` y nada mas; ninguna de las dos toca filas;
//  (b) R35: el CHECK admite el pago SOLO como salida y su anulacion SOLO como entrada (23514 al reves);
//  (c) reaplicar los dos `up` no falla (IF NOT EXISTS; el CHECK se suelta y se recrea);
//  (d) R36: con UNA fila que usa un valor, el `down` de la 2 y la funcion del `down` de la 1 ABORTAN sin
//      borrar nada;
//  (e) R36: sin filas, `down 2` → `down 1` EJECUTADOS DE VERDAD quitan los dos valores y CONSERVAN todos
//      los demas, en su orden; el CHECK vuelve a la lista de la 458-B. La mutacion «down con lista fija»
//      (recrear el tipo con una lista escrita) borraria cualquier valor posterior y pone este caso rojo;
//  (f) la funcion del `down` de la 1 es la de la 458-B byte a byte salvo el sufijo.
//
// Todo en transacciones que SIEMPRE se revierten, con el lock de aviso de las escrituras reales: el
// `down` real toma un candado exclusivo sobre `wallet_movimiento` solo mientras dura su transaccion.

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

const MIGRACIONES = path.join(process.cwd(), "db", "migrations");
const leer = (dir: string, archivo: string) =>
  fs.readFileSync(path.join(MIGRACIONES, dir, archivo), "utf8").replace(/\r\n/g, "\n");
const DIR_1 = "20261023120000_iva_por_pagar_488_enums";
const DIR_2 = "20261023120100_iva_por_pagar_488_checks";
const UP_1 = leer(DIR_1, "migration.sql");
const DOWN_1 = leer(DIR_1, "down.sql");
const UP_2 = leer(DIR_2, "migration.sql");
const DOWN_2 = leer(DIR_2, "down.sql");
const DOWN_458 = leer("20260928120000_wallet_458_enums", "down.sql");
const UP_458_2 = leer("20260928120100_wallet_458_tablas", "migration.sql");

const VALORES_488 = ["egreso_pago_iva", "ingreso_reverso_pago_iva"] as const;
const NOMBRE_CHECK = "wallet_movimiento_tipo_categoria_check";

/** El texto ejecutable de un `down.sql` SIN su BEGIN/COMMIT: se corre dentro de la transaccion del test. */
function sinTransaccion(sql: string): string {
  return soloEjecutable(sql)
    .replace(/^\s*BEGIN;\s*$/m, "")
    .replace(/^\s*COMMIT;\s*$/m, "");
}

function funcionDe(down: string, sufijo: "458" | "488"): string {
  const re = new RegExp(`CREATE OR REPLACE FUNCTION pg_temp\\.quitar_valores_de_enum_${sufijo}[\\s\\S]*?\\$fn\\$;`);
  const m = re.exec(down);
  if (m === null) throw new Error(`el down.sql no trae la funcion _${sufijo}`);
  return m[0];
}

/** El cuerpo del CHECK tal como lo ESCRIBE un `.sql`, con los blancos normalizados. */
function checkEscrito(sql: string): string {
  const re = new RegExp(`ADD CONSTRAINT "${NOMBRE_CHECK}"\\s*CHECK \\(([\\s\\S]*?)\\);`);
  const m = re.exec(sql);
  if (m === null) throw new Error(`el sql no recrea ${NOMBRE_CHECK}`);
  return m[1].replace(/\s+/g, " ").trim();
}

async function definicionDelCheck(tx: TxDeTest): Promise<string> {
  const filas = await tx.$queryRawUnsafe<{ def: string }[]>(
    `SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND t.relname = 'wallet_movimiento' AND c.conname = $1`,
    NOMBRE_CHECK,
  );
  return filas[0]?.def ?? "";
}

/** Inserta una fila de caja con (tipo, categoria) y devuelve su id. */
async function insertarCaja(tx: TxDeTest, tipo: string, categoria: string): Promise<string> {
  const id = randomUUID();
  await tx.$executeRawUnsafe(
    `INSERT INTO "wallet_movimiento" ("id","tipo","categoria","monto","origen_tipo","origen_id")
     VALUES ($1, $2::"wallet_movimiento_tipo", $3::"wallet_movimiento_categoria", 1, 'gasto', NULL)`,
    id,
    tipo,
    categoria,
  );
  return id;
}

/** Ejecuta `sql` en un SAVEPOINT; devuelve el mensaje del error si fallo, o `null` si paso. */
async function intentarConMensaje(tx: TxDeTest, sql: string): Promise<string | null> {
  const punto = `sp_${randomUUID().replace(/-/g, "")}`;
  await tx.$executeRawUnsafe(`SAVEPOINT ${punto}`);
  try {
    await tx.$executeRawUnsafe(sql);
    await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${punto}`);
    return null;
  } catch (e) {
    await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${punto}`);
    return String((e as Error)?.message ?? e);
  }
}

describeSiHayBase("488/T B.2 — las migraciones del IVA por pagar contra Postgres", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = crearPrismaDeTest();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("(a) el catalogo es EXACTAMENTE el seed, con los dos valores de la 488 AL FINAL; el up 1 son dos ADD VALUE", async () => {
    const caja = await etiquetasDeEnum(prisma, "wallet_movimiento_categoria");
    expect([...caja].sort()).toEqual([...WALLET_MOVIMIENTO_CATEGORIA_SEED].sort());
    expect(caja.slice(-2)).toEqual([...VALORES_488]);
    expect(caja).toHaveLength(29); // 458-B: 27 ; 488: + 2
    const up1 = soloEjecutable(UP_1);
    expect(up1.match(/ADD VALUE IF NOT EXISTS/g)).toHaveLength(2);
    for (const v of VALORES_488) {
      expect(up1).toContain(`ALTER TYPE "wallet_movimiento_categoria" ADD VALUE IF NOT EXISTS '${v}';`);
    }
    // Ninguna de las dos toca filas, ni crea tablas: sin datos y sin backfill (design §3).
    for (const sql of [up1, soloEjecutable(UP_2)]) {
      expect(sql).not.toMatch(/\bUPDATE\b|\bDELETE\b|\bINSERT\b|CREATE TABLE/);
    }
    expect(up1).not.toMatch(/CHECK/);
  });

  it("(b) R35: el CHECK admite el pago SOLO como salida y su anulacion SOLO como entrada (23514 al reves)", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      const caja = (tipo: string, cat: string) =>
        intentar(
          tx,
          `INSERT INTO "wallet_movimiento" ("id","tipo","categoria","monto","origen_tipo","origen_id")
           VALUES ($1, $2::"wallet_movimiento_tipo", $3::"wallet_movimiento_categoria", 1, 'gasto', NULL)`,
          randomUUID(),
          tipo,
          cat,
        );
      return {
        pagoComoSalida: await caja("egreso", "egreso_pago_iva"),
        anulacionComoEntrada: await caja("ingreso", "ingreso_reverso_pago_iva"),
        pagoComoEntrada: await caja("ingreso", "egreso_pago_iva"),
        anulacionComoSalida: await caja("egreso", "ingreso_reverso_pago_iva"),
      };
    });
    expect(r).toEqual({
      pagoComoSalida: null,
      anulacionComoEntrada: null,
      pagoComoEntrada: "23514",
      anulacionComoSalida: "23514",
    });
  });

  it("(b') el CHECK escrito es el de la 458-B con UN valor mas al final de cada rama, y nada mas", () => {
    const de458 = checkEscrito(UP_458_2);
    const de488 = checkEscrito(UP_2);
    expect(de488).toBe(
      de458
        .replace("'ingreso_abono_tienda'))", "'ingreso_abono_tienda', 'ingreso_reverso_pago_iva'))")
        .replace(
          "'egreso_reverso_iva_flete_devolucion'))",
          "'egreso_reverso_iva_flete_devolucion', 'egreso_pago_iva'))",
        ),
    );
    // Control de no-vacuidad: los dos reemplazos de arriba SI cambiaron algo.
    expect(de488).not.toBe(de458);
    // Y el `down` de la 2 lo devuelve EXACTAMENTE a la lista de la 458-B.
    expect(checkEscrito(DOWN_2)).toBe(de458);
  });

  it("(c) reaplicar los dos up no falla (IF NOT EXISTS y CHECK recreado) y no cambia el catalogo", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      const antes = await etiquetasDeEnum(tx, "wallet_movimiento_categoria");
      const up1 = await intentarConMensaje(tx, soloEjecutable(UP_1));
      const up2 = await intentarConMensaje(tx, soloEjecutable(UP_2));
      const despues = await etiquetasDeEnum(tx, "wallet_movimiento_categoria");
      return { up1, up2, igual: JSON.stringify(antes) === JSON.stringify(despues) };
    });
    expect(r).toEqual({ up1: null, up2: null, igual: true });
  });

  it("(d) R36: con UNA fila que usa un valor, el down de la 2 y la funcion de la 1 ABORTAN sin borrar nada", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      const pago = await insertarCaja(tx, "egreso", "egreso_pago_iva");
      const anulacion = await insertarCaja(tx, "ingreso", "ingreso_reverso_pago_iva");
      const down2 = await intentarConMensaje(tx, sinTransaccion(DOWN_2));
      // La funcion del down de la 1, ejecutada sobre el tipo con las filas dentro.
      const funcion = funcionDe(DOWN_1, "488");
      const llamada = `${funcion}\nSELECT pg_temp.quitar_valores_de_enum_488('public', 'wallet_movimiento_categoria', ARRAY['egreso_pago_iva', 'ingreso_reverso_pago_iva']);`;
      const down1 = await intentarConMensaje(tx, llamada);
      const quedan = await tx.walletMovimiento.count({ where: { id: { in: [pago, anulacion] } } });
      const enum488 = (await etiquetasDeEnum(tx, "wallet_movimiento_categoria")).slice(-2);
      return { down2, down1, quedan, enum488 };
    });
    expect(r.down2).toMatch(/rollback 488: 1 movimientos de la caja usan egreso_pago_iva; se aborta sin borrar nada/);
    expect(r.down1).toMatch(/rollback 488: 2 filas de wallet_movimiento\.categoria usan \{egreso_pago_iva,ingreso_reverso_pago_iva\}; se aborta sin borrar nada/);
    expect(r.quedan).toBe(2);
    expect(r.enum488).toEqual([...VALORES_488]);
  });

  it("(d') R36: con SOLO la anulacion de un pago, el down de la 2 tambien aborta y dice cual", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      await insertarCaja(tx, "ingreso", "ingreso_reverso_pago_iva");
      return intentarConMensaje(tx, sinTransaccion(DOWN_2));
    });
    expect(r).toMatch(/usan ingreso_reverso_pago_iva; se aborta sin borrar nada/);
  });

  it("(e) R36: sin filas, down 2 → down 1 EJECUTADOS quitan los dos valores, CONSERVAN los demas en su orden y el CHECK vuelve a la 458-B", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      const antes = await etiquetasDeEnum(tx, "wallet_movimiento_categoria");
      const filasAntes = await tx.walletMovimiento.count();
      const down2 = await intentarConMensaje(tx, sinTransaccion(DOWN_2));
      const down1 = await intentarConMensaje(tx, sinTransaccion(DOWN_1));
      const despues = await etiquetasDeEnum(tx, "wallet_movimiento_categoria");
      const check = await definicionDelCheck(tx);
      const filasDespues = await tx.walletMovimiento.count();
      return { antes, despues, down2, down1, check, filasAntes, filasDespues };
    });
    expect(r.down2).toBeNull();
    expect(r.down1).toBeNull();
    // Anti-vacuidad: habia algo que quitar.
    expect(r.antes.slice(-2)).toEqual([...VALORES_488]);
    // Los demas valores, TODOS y en su orden (la lista vigente menos los dos; nunca una lista fija).
    expect(r.despues).toEqual(r.antes.filter((v) => !(VALORES_488 as readonly string[]).includes(v)));
    expect(r.despues).toHaveLength(r.antes.length - 2);
    // El CHECK restaurado: sin los dos valores, con los de la 458-B.
    expect(r.check).not.toContain("egreso_pago_iva");
    expect(r.check).not.toContain("ingreso_reverso_pago_iva");
    expect(r.check).toContain("egreso_reverso_iva_flete_devolucion");
    expect(r.check).toContain("ingreso_abono_tienda");
    // Y no se borro ni una fila.
    expect(r.filasDespues).toBe(r.filasAntes);
  });

  it("(f) la funcion del down de la 1 es la de la 458-B byte a byte salvo el sufijo; nunca recrea con una lista fija", () => {
    const de458 = funcionDe(DOWN_458, "458").replace(/458/g, "XXX");
    const de488 = funcionDe(DOWN_1, "488").replace(/488/g, "XXX");
    expect(de488).toBe(de458);
    expect(DOWN_1).not.toMatch(/CREATE TYPE "[a-z_]+" AS ENUM \(\s*'/);
    expect(DOWN_1.match(/SELECT pg_temp\.quitar_valores_de_enum_488\(/g)).toHaveLength(1);
    expect(DOWN_1).toContain("ARRAY[\n  'egreso_pago_iva', 'ingreso_reverso_pago_iva'\n]");
    // Orden: el down de la 2 va ANTES (su CHECK nombra los valores): lo dice el down de la 1.
    expect(DOWN_1).toMatch(/se revierte ANTES/);
  });
});
