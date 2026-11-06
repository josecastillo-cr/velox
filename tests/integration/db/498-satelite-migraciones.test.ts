import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PrismaClient } from "@prisma/client";

import { WALLET_MOVIMIENTO_CATEGORIA_SEED, WALLET_ORIGEN_TIPO_SEED } from "@/lib/types/wallet";
import {
  HAY_BASE_DE_DATOS,
  crearPrismaDeTest,
  enTransaccionRevertida,
  etiquetasDeEnum,
  serializarEscriturasReales,
  type TxDeTest,
} from "./_postgres-real";
import { intentarSql } from "./_fixtures/sqlstate-461";
import {
  DIR_M1,
  DIR_M2,
  DIR_M3,
  DIR_M4,
  DOWN,
  algunUsuarioId,
  correr,
  existeColumna,
  existeTabla,
  intentarConMensaje,
  leer,
  sembrarAjuste,
  sembrarConsolidacion,
  sembrarZona,
} from "./498/_migraciones";

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⭑ FICHA 498 / T2.4 — M1 (enums) y M2 (tabla de ajustes + CHECK de la caja), contra Postgres.
// R46, R47, R53. Todo en transacciones que SIEMPRE se revierten. Sin base, se SALTA (visible).
// ═════════════════════════════════════════════════════════════════════════════════════════════

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

const CATEGORIAS_498 = ["egreso_diferencia_satelite", "ingreso_diferencia_satelite"] as const;
const ORIGEN_498 = "conciliacion_bodega_ajuste";

async function insertarCaja(tx: TxDeTest, tipo: string, categoria: string, origen = "gasto"): Promise<string | null> {
  return intentarSql(
    tx,
    `INSERT INTO "wallet_movimiento" ("id","tipo","categoria","monto","origen_tipo","origen_id")
     VALUES ($1, $2::"wallet_movimiento_tipo", $3::"wallet_movimiento_categoria", 1, $4::"wallet_origen_tipo", NULL)`,
    randomUUID(),
    tipo,
    categoria,
    origen,
  );
}

describeSiHayBase("498/T2.4 — M1 y M2 contra Postgres (R46, R47, R53)", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = crearPrismaDeTest();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("R46: los tres valores existen, al final, y el catalogo es EXACTAMENTE el seed", async () => {
    const caja = await etiquetasDeEnum(prisma, "wallet_movimiento_categoria");
    const origen = await etiquetasDeEnum(prisma, "wallet_origen_tipo");
    expect([...caja].sort()).toEqual([...WALLET_MOVIMIENTO_CATEGORIA_SEED].sort());
    expect([...origen].sort()).toEqual([...WALLET_ORIGEN_TIPO_SEED].sort());
    expect(caja.slice(-2)).toEqual([...CATEGORIAS_498]);
    expect(origen.slice(-1)).toEqual([ORIGEN_498]);
    // El up de M1 son tres ADD VALUE y nada mas.
    const up1 = leer(DIR_M1, "migration.sql");
    expect(up1.match(/ADD VALUE IF NOT EXISTS/g)).toHaveLength(3);
  });

  it("R46: el CHECK admite el egreso SOLO como egreso y el ingreso SOLO como ingreso (23514 cruzado)", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      return {
        egresoComoEgreso: await insertarCaja(tx, "egreso", "egreso_diferencia_satelite", ORIGEN_498),
        ingresoComoIngreso: await insertarCaja(tx, "ingreso", "ingreso_diferencia_satelite", ORIGEN_498),
        egresoComoIngreso: await insertarCaja(tx, "ingreso", "egreso_diferencia_satelite", ORIGEN_498),
        ingresoComoEgreso: await insertarCaja(tx, "egreso", "ingreso_diferencia_satelite", ORIGEN_498),
      };
    });
    expect(r).toEqual({
      egresoComoEgreso: null,
      ingresoComoIngreso: null,
      egresoComoIngreso: "23514",
      ingresoComoEgreso: "23514",
    });
  });

  it("R46: el CHECK de M2 es el de la 488 con UN valor mas al final de cada rama; su down vuelve a la 488", () => {
    const check = (sql: string) => {
      const m = /ADD CONSTRAINT "wallet_movimiento_tipo_categoria_check"\s*CHECK \(([\s\S]*?)\);/.exec(sql);
      if (m === null) throw new Error("sin CHECK");
      return m[1].replace(/\s+/g, " ").trim();
    };
    const de488 = check(leer("20261023120100_iva_por_pagar_488_checks", "migration.sql"));
    const de498 = check(leer(DIR_M2, "migration.sql"));
    expect(de498).toBe(
      de488
        .replace("'ingreso_reverso_pago_iva'))", "'ingreso_reverso_pago_iva', 'ingreso_diferencia_satelite'))")
        .replace("'egreso_pago_iva'))", "'egreso_pago_iva', 'egreso_diferencia_satelite'))"),
    );
    expect(de498).not.toBe(de488);
    expect(check(leer(DIR_M2, "down.sql"))).toBe(de488);
  });

  it("R47: la tabla — CHECK de evento y de diferencia, FK RESTRICT, unico parcial de `marca` y RLS", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      const usuarioId = await algunUsuarioId(tx);
      const zonaId = await sembrarZona(tx);
      const cb = await sembrarConsolidacion(tx, { zonaId, usuarioId, general: "100", recibido: "90" });
      const insertar = (evento: string, diferencia: string) =>
        intentarSql(
          tx,
          `INSERT INTO conciliacion_bodega_ajuste (id, cierre_bodega_id, evento, monto_esperado, monto_recibido, diferencia, creado_por)
           VALUES ($1, $2, $3, 100, 90, $4::numeric, $5)`,
          randomUUID(),
          cb,
          evento,
          diferencia,
          usuarioId,
        );
      const eventoMalo = await insertar("otro", "10");
      const diferenciaCero = await insertar("marca", "0");
      const primeraMarca = await insertar("marca", "10");
      const segundaMarca = await insertar("marca", "5");
      const correccion1 = await insertar("correccion", "-3");
      const correccion2 = await insertar("correccion", "2");
      const borrarConsolidacion = await intentarSql(tx, `DELETE FROM cierre_bodega WHERE id = $1`, cb);
      const [{ rls }] = await tx.$queryRawUnsafe<{ rls: boolean }[]>(
        `SELECT relrowsecurity AS rls FROM pg_class WHERE oid = 'public.conciliacion_bodega_ajuste'::regclass`,
      );
      const decimales = await intentarSql(
        tx,
        `INSERT INTO conciliacion_bodega_ajuste (id, cierre_bodega_id, evento, monto_esperado, monto_recibido, diferencia, creado_por)
         VALUES ($1, $2, 'correccion', 100, 90, 0.001, $3)`,
        randomUUID(),
        cb,
        usuarioId,
      );
      return { eventoMalo, diferenciaCero, primeraMarca, segundaMarca, correccion1, correccion2, borrarConsolidacion, rls, decimales };
    });
    expect(r).toEqual({
      eventoMalo: "23514",
      diferenciaCero: "23514",
      primeraMarca: null,
      segundaMarca: "23505",
      correccion1: null,
      correccion2: null,
      borrarConsolidacion: "23001", // restrict_violation: ON DELETE RESTRICT
      rls: true,
      // DECIMAL(12,2) redondea 0.001 a 0.00 → choca con `diferencia <> 0`.
      decimales: "23514",
    });
  });

  it("R53: M4 → M3 → M2 → M1 deja la base sin tabla, sin columna, sin los valores y CONSERVA un valor posterior", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      const usuarioId = await algunUsuarioId(tx);
      const zonaId = await sembrarZona(tx);
      // Una diferencia viva: el down de M2 la BORRA (perdida declarada) antes de que M1 la vea.
      const cb = await sembrarConsolidacion(tx, { zonaId, usuarioId, general: "100", recibido: "90" });
      const ajusteId = await sembrarAjuste(tx, { cierreBodegaId: cb, usuarioId });
      await tx.$executeRawUnsafe(
        `INSERT INTO wallet_movimiento (id, tipo, categoria, monto, origen_tipo, origen_id)
         VALUES ($1, 'egreso', 'egreso_diferencia_satelite', 10, 'conciliacion_bodega_ajuste', $2)`,
        randomUUID(),
        ajusteId,
      );
      // Un valor POSTERIOR a esta ficha, sembrado a proposito: el down de M1 no lo puede perder.
      const posterior = `posterior_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
      await correr(tx, `ALTER TYPE "wallet_movimiento_categoria" ADD VALUE '${posterior}'`);
      await correr(tx, `ALTER TYPE "wallet_origen_tipo" ADD VALUE '${posterior}'`);
      const cajaAntes = await etiquetasDeEnum(tx, "wallet_movimiento_categoria");
      const origenAntes = await etiquetasDeEnum(tx, "wallet_origen_tipo");

      const errores = {
        m4: await intentarConMensaje(tx, DOWN(DIR_M4)),
        m3: await intentarConMensaje(tx, DOWN(DIR_M3)),
        m2: await intentarConMensaje(tx, DOWN(DIR_M2)),
        m1: await intentarConMensaje(tx, DOWN(DIR_M1)),
      };
      return {
        errores,
        posterior,
        cajaAntes,
        origenAntes,
        caja: await etiquetasDeEnum(tx, "wallet_movimiento_categoria"),
        origen: await etiquetasDeEnum(tx, "wallet_origen_tipo"),
        tabla: await existeTabla(tx, "public.conciliacion_bodega_ajuste"),
        columna: await existeColumna(tx, "cierre_bodega", "esperado_regla_anterior"),
        respaldo: await existeTabla(tx, "respaldo.asientos_satelite_498"),
      };
    });
    expect(r.errores).toEqual({ m4: null, m3: null, m2: null, m1: null });
    expect(r.tabla).toBe(false);
    expect(r.columna).toBe(false);
    expect(r.respaldo).toBe(false);
    for (const v of CATEGORIAS_498) expect(r.caja).not.toContain(v);
    expect(r.origen).not.toContain(ORIGEN_498);
    // Lo demas, TODO y en su orden; el valor posterior sobrevive.
    expect(r.caja).toEqual(r.cajaAntes.filter((v) => !(CATEGORIAS_498 as readonly string[]).includes(v)));
    expect(r.origen).toEqual(r.origenAntes.filter((v) => v !== ORIGEN_498));
    expect(r.caja).toContain(r.posterior);
    expect(r.origen).toContain(r.posterior);
  });

  it("R53: el down de M1 con una fila viva que usa un valor ABORTA sin borrar nada", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      const id = randomUUID();
      await tx.$executeRawUnsafe(
        `INSERT INTO wallet_movimiento (id, tipo, categoria, monto, origen_tipo, origen_id)
         VALUES ($1, 'ingreso', 'ingreso_diferencia_satelite', 10, 'conciliacion_bodega_ajuste', NULL)`,
        id,
      );
      const error = await intentarConMensaje(tx, DOWN(DIR_M1));
      const queda = await tx.walletMovimiento.count({ where: { id } });
      return { error, queda, caja: await etiquetasDeEnum(tx, "wallet_movimiento_categoria") };
    });
    expect(r.error).toMatch(/rollback 498: 1 filas de wallet_movimiento\.categoria usan/);
    expect(r.queda).toBe(1);
    expect(r.caja.slice(-2)).toEqual([...CATEGORIAS_498]);
  });

  it("M1: la funcion del down es la de la 488 byte a byte salvo el sufijo; nunca recrea con lista fija", () => {
    const funcionDe = (down: string, sufijo: string) => {
      const m = new RegExp(`CREATE OR REPLACE FUNCTION pg_temp\\.quitar_valores_de_enum_${sufijo}[\\s\\S]*?\\$fn\\$;`).exec(down);
      if (m === null) throw new Error(`sin funcion _${sufijo}`);
      return m[0];
    };
    const de488 = funcionDe(leer("20261023120000_iva_por_pagar_488_enums", "down.sql"), "488").replace(/488/g, "XXX");
    const de498 = funcionDe(leer(DIR_M1, "down.sql"), "498").replace(/498/g, "XXX");
    expect(de498).toBe(de488);
    expect(leer(DIR_M1, "down.sql")).not.toMatch(/CREATE TYPE "[a-z_]+" AS ENUM \(\s*'/);
  });
});
