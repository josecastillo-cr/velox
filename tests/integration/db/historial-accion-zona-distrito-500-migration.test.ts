import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PrismaClient } from "@prisma/client";

import {
  HAY_BASE_DE_DATOS,
  crearPrismaDeTest,
  enTransaccionRevertida,
  etiquetasDeEnum,
  serializarEscriturasReales,
} from "./_postgres-real";
import { DOWN, UP, correr, intentarConMensaje, leer } from "./498/_migraciones";
import { soloEjecutable } from "./_fixtures/sql-ejecutable";

/**
 * FICHA 500 (T3.3; R22) — la migracion que añade `zona_distrito_cambiado` a `historial_accion_tipo`,
 * contra Postgres real. El `down` es DINAMICO: quita SOLO ese valor, conserva cualquier otro (tambien
 * uno añadido despues) y, con una fila que lo use, aborta sin borrar nada.
 *
 * Todo dentro de una transaccion que SIEMPRE se revierte. Sin base, la suite se SALTA (visible).
 */

const DIR = "20261104120000_historial_accion_zona_distrito_500";
const VALOR = "zona_distrito_cambiado";
const TIPO = "historial_accion_tipo";

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

describe("500/T3.3 — la forma de la migracion (sin base)", () => {
  it("el up es UNA sola sentencia: el ADD VALUE IF NOT EXISTS del valor", () => {
    const ejecutable = soloEjecutable(leer(DIR, "migration.sql")).trim();
    expect(ejecutable).toBe(`ALTER TYPE "${TIPO}" ADD VALUE IF NOT EXISTS '${VALOR}';`);
  });

  it("el down es dinamico (la funcion de la 498 salvo el sufijo) y nunca recrea con lista fija", () => {
    const funcionDe = (down: string, sufijo: string) => {
      const m = new RegExp(`CREATE OR REPLACE FUNCTION pg_temp\\.quitar_valores_de_enum_${sufijo}[\\s\\S]*?\\$fn\\$;`).exec(down);
      if (m === null) throw new Error(`sin funcion _${sufijo}`);
      return m[0];
    };
    const de498 = funcionDe(leer("20261103120000_satelite_498_enums", "down.sql"), "498").replace(/498/g, "XXX");
    const de500 = funcionDe(leer(DIR, "down.sql"), "500").replace(/500/g, "XXX");
    expect(de500).toBe(de498);
    expect(leer(DIR, "down.sql")).not.toMatch(/CREATE TYPE "[a-z_]+" AS ENUM \(\s*'/);
  });
});

describeSiHayBase("500/T3.3 — R22 contra Postgres", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = crearPrismaDeTest();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("R22: up añade el valor; down lo quita y CONSERVA el resto, tambien un valor sembrado despues; up otra vez lo devuelve", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      await correr(tx, UP(DIR)); // idempotente: la base local ya la tiene aplicada
      const trasUp = await etiquetasDeEnum(tx, TIPO);
      const posterior = `posterior_${randomUUID().replace(/-/g, "").slice(0, 8)}`;
      await correr(tx, `ALTER TYPE "${TIPO}" ADD VALUE '${posterior}'`);
      const antesDelDown = await etiquetasDeEnum(tx, TIPO);
      const errorDown = await intentarConMensaje(tx, DOWN(DIR));
      const trasDown = await etiquetasDeEnum(tx, TIPO);
      // Revision m2: el up OTRA VEZ, dentro de la misma transaccion revertida.
      const errorReUp = await intentarConMensaje(tx, UP(DIR));
      const trasReUp = await etiquetasDeEnum(tx, TIPO);
      return { trasUp, posterior, antesDelDown, errorDown, trasDown, errorReUp, trasReUp };
    });
    expect(r.trasUp).toContain(VALOR);
    expect(r.errorDown).toBeNull();
    expect(r.trasDown).not.toContain(VALOR);
    expect(r.trasDown).toContain(r.posterior);
    expect(r.trasDown).toEqual(r.antesDelDown.filter((v) => v !== VALOR));
    expect(r.errorReUp).toBeNull();
    expect(r.trasReUp).toEqual([...r.trasDown, VALOR]);
  });

  it("R22: con una fila del historial que usa el valor, el down ABORTA y no borra nada", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      const id = randomUUID();
      await tx.$executeRawUnsafe(
        `INSERT INTO historial_accion (id, accion, entidad_tipo, entidad_id, entidad_etiqueta, lote_id)
         VALUES ($1, '${VALOR}', 'zona', $2, 'Zona de prueba 500', $3)`,
        id,
        randomUUID(),
        randomUUID(),
      );
      const antes = await etiquetasDeEnum(tx, TIPO);
      const error = await intentarConMensaje(tx, DOWN(DIR));
      return {
        error,
        queda: await tx.historialAccion.count({ where: { id } }),
        antes,
        despues: await etiquetasDeEnum(tx, TIPO),
      };
    });
    expect(r.error).toMatch(/rollback 500: 1 filas de historial_accion\.accion usan/);
    expect(r.queda).toBe(1);
    expect(r.despues).toEqual(r.antes);
    expect(r.despues).toContain(VALOR);
  });
});
