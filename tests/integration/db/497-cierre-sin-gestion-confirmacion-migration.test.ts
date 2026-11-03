import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";
import type { PrismaClient } from "@prisma/client";

import {
  HAY_BASE_DE_DATOS,
  crearPrismaDeTest,
  enTransaccionRevertida,
  serializarEscriturasReales,
} from "./_postgres-real";

// Ficha 497 (T2.2, R25/R41) — la migracion `*_cierre_sin_gestion_confirmacion_fisica`.
// Molde: `confirmacion-fisica-migration.test.ts` (238), la hermana sobre `gestion_orden`.
//
//  1. FORMA ESTATICA de `migration.sql` / `down.sql` (regex sobre sentencias, sin comentarios).
//  2. FORMA REAL en Postgres: columna `timestamp(3)`, nullable, sin default, sin indice; ninguna
//     marca fuera de un cierre aprobado ni anterior a la migracion (sin backfill, R25); y el DOWN
//     ejecutado de verdad —dos veces, idempotente— dentro de una transaccion que se revierte.

const MIGRATIONS_DIR = path.join(__dirname, "..", "..", "..", "db", "migrations");
const MIGRACION = "20261102170000_cierre_sin_gestion_confirmacion_fisica";
const migrationDir = path.join(MIGRATIONS_DIR, MIGRACION);

function soloSentencias(sql: string): string {
  return sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
}

const downSqlCrudo = fs.readFileSync(path.join(migrationDir, "down.sql"), "utf8");
const upSql = soloSentencias(fs.readFileSync(path.join(migrationDir, "migration.sql"), "utf8"));
const downSql = soloSentencias(downSqlCrudo);
const schemaPrisma = fs.readFileSync(
  path.join(__dirname, "..", "..", "..", "db", "schema.prisma"),
  "utf8",
);

describe("497 · UP — una columna nullable y nada mas (R22/R25)", () => {
  it("anade `confirmada_fisica_at` a cierre_sin_gestion como TIMESTAMP(3)", () => {
    expect(upSql).toMatch(
      /ALTER TABLE "cierre_sin_gestion" ADD COLUMN "confirmada_fisica_at" TIMESTAMP\(3\);/,
    );
  });

  it("R25: NULLABLE, sin DEFAULT y sin backfill", () => {
    expect(upSql).not.toMatch(/NOT NULL/i);
    expect(upSql).not.toMatch(/DEFAULT/i);
    expect(upSql).not.toMatch(/UPDATE /i);
    expect(upSql).not.toMatch(/INSERT INTO/i);
  });

  it("aditiva: sin CHECK, sin indice, sin RLS, sin enums, una sola sentencia", () => {
    for (const prohibido of [/CHECK/i, /CONSTRAINT/i, /INDEX/i, /POLICY/i, /ROW LEVEL/i, /TYPE/i, /DROP/i, /DELETE/i]) {
      expect(upSql).not.toMatch(prohibido);
    }
    expect(upSql.split("\n").filter((l) => l.trim() !== "")).toHaveLength(1);
  });

  it("R24/R39: no toca ninguna tabla de dinero", () => {
    for (const tabla of ["wallet_movimiento", "wallet_tienda_movimiento", "pago_mensajero_movimiento", "cierre_dia"]) {
      expect(upSql).not.toContain(tabla);
    }
  });
});

describe("497 · DOWN — reversible (R41)", () => {
  it("suelta la columna con `IF EXISTS` y revierte EXACTAMENTE la sentencia del UP", () => {
    expect(downSql).toMatch(
      /ALTER TABLE "cierre_sin_gestion" DROP COLUMN IF EXISTS "confirmada_fisica_at";/,
    );
    expect(downSql.split("\n").filter((l) => l.trim() !== "")).toHaveLength(1);
  });

  it("la carpeta tiene migration.sql y down.sql, posterior a toda migracion de dev al nacer la ficha", () => {
    expect(fs.existsSync(path.join(migrationDir, "migration.sql"))).toBe(true);
    expect(fs.existsSync(path.join(migrationDir, "down.sql"))).toBe(true);
    // Posterior a la 499 (ya en dev) y a la 496 (en paralelo).
    expect(MIGRACION > "20261102150000_recoleccion_central_libera_496").toBe(true);
  });
});

describe("497 · schema.prisma refleja la migracion (sin drift)", () => {
  it("CierreSinGestion declara `confirmadaFisicaAt` OPCIONAL, mapeada, sin default ni indice", () => {
    const modelo = schemaPrisma.match(/model CierreSinGestion \{([\s\S]*?)\n\}/);
    expect(modelo).not.toBeNull();
    const cuerpo = (modelo as RegExpMatchArray)[1];
    expect(cuerpo).toMatch(/confirmadaFisicaAt\s+DateTime\?\s+@map\("confirmada_fisica_at"\)/);
    expect(cuerpo).not.toMatch(/confirmadaFisicaAt[^\n]*@default/);
    expect(cuerpo).not.toMatch(/@@index\(\[confirmadaFisicaAt\]\)/);
  });
});

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

type ClienteSql = {
  $queryRawUnsafe: (sql: string, ...args: unknown[]) => Promise<unknown>;
};

/**
 * Las dos invariantes de «sin backfill» (R25) y «solo la aprobacion escribe» (R22), en una funcion
 * para que el caso real y la autocomprobacion midan lo mismo. `AT TIME ZONE 'UTC'`: la columna es
 * `timestamp` sin zona y `finished_at` es `timestamptz` (mismo cuidado que la 238).
 */
async function auditarMarcas(cliente: ClienteSql) {
  const anteriores = (await cliente.$queryRawUnsafe(
    `SELECT count(*) AS n
       FROM "cierre_sin_gestion" s
       JOIN "_prisma_migrations" m ON m."migration_name" = $1
      WHERE s."confirmada_fisica_at" IS NOT NULL
        AND s."confirmada_fisica_at" < (m."finished_at" AT TIME ZONE 'UTC')`,
    MIGRACION,
  )) as Array<{ n: bigint }>;
  const fuera = (await cliente.$queryRawUnsafe(
    `SELECT count(*) AS n
       FROM "cierre_sin_gestion" s
       JOIN "cierre_dia" c ON c."id" = s."cierre_id"
      WHERE s."confirmada_fisica_at" IS NOT NULL AND c."estado" <> 'aprobado'`,
  )) as Array<{ n: bigint }>;
  return {
    anterioresALaMigracion: Number(anteriores[0].n),
    fueraDeUnCierreAprobado: Number(fuera[0].n),
  };
}

async function columna(cliente: ClienteSql) {
  return (await cliente.$queryRawUnsafe(
    `SELECT data_type, datetime_precision, is_nullable, column_default
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'cierre_sin_gestion' AND column_name = 'confirmada_fisica_at'`,
  )) as Array<{
    data_type: string;
    datetime_precision: number;
    is_nullable: string;
    column_default: string | null;
  }>;
}

describeSiHayBase("497 · la columna, tal como quedo en Postgres (R25/R41)", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = crearPrismaDeTest();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("existe, es `timestamp(3)` sin zona, NULLABLE y sin DEFAULT", async () => {
    const filas = await columna(prisma);
    expect(filas, "la migracion no esta aplicada en esta base").toHaveLength(1);
    expect(filas[0].data_type).toBe("timestamp without time zone");
    expect(Number(filas[0].datetime_precision)).toBe(3);
    expect(filas[0].is_nullable).toBe("YES");
    expect(filas[0].column_default).toBeNull();
  });

  it("no se creo ningun indice sobre la columna", async () => {
    const filas = (await prisma.$queryRawUnsafe(
      `SELECT indexdef FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'cierre_sin_gestion'
          AND indexdef LIKE '%confirmada_fisica_at%'`,
    )) as unknown[];
    expect(filas).toEqual([]);
  });

  it("R25: ninguna marca es anterior a la migracion ni vive fuera de un cierre aprobado", async () => {
    const migracion = (await prisma.$queryRawUnsafe(
      `SELECT "finished_at" FROM "_prisma_migrations" WHERE "migration_name" = $1`,
      MIGRACION,
    )) as Array<{ finished_at: Date | null }>;
    // Anti-vacuidad: sin la fila de la migracion el JOIN daria cero sin comparar nada.
    expect(migracion, `la migracion ${MIGRACION} no figura aplicada`).toHaveLength(1);
    expect(migracion[0].finished_at).not.toBeNull();

    const auditoria = await auditarMarcas(prisma);
    expect(auditoria.anterioresALaMigracion).toBe(0);
    expect(auditoria.fueraDeUnCierreAprobado).toBe(0);
  });

  it("AUTOCOMPROBACION: la auditoria caza un backfill plantado (y se revierte)", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      // Hace falta al menos una fila para plantar; si la base no tiene barridas, se crea una
      // sobre un cierre `solicitado` y una orden cualquiera, dentro de esta misma tx revertida.
      let filas = (await tx.$queryRawUnsafe(
        `SELECT s."id" FROM "cierre_sin_gestion" s LIMIT 1`,
      )) as Array<{ id: string }>;
      if (filas.length === 0) {
        const orden = await tx.orden.findFirstOrThrow({ select: { id: true } });
        const mensajero = await tx.usuario.findFirstOrThrow({ select: { id: true } });
        const central = await tx.zona.findFirstOrThrow({ where: { esCentral: true }, select: { id: true } });
        const cierre = await tx.cierreDia.create({
          data: {
            mensajeroId: mensajero.id,
            estado: "rechazado",
            destinoTipo: "bodega_central",
            destinoZonaId: central.id,
          },
          select: { id: true },
        });
        const s = await tx.cierreSinGestion.create({
          data: {
            cierreId: cierre.id,
            ordenId: orden.id,
            numRemision: "R-497",
            destinatario: "D",
            producto: "P",
            tiendaNombre: "T",
            zonaNombre: "Z",
          },
          select: { id: true },
        });
        filas = [s];
      }
      // Una marca con fecha ANTERIOR a la migracion sobre una barrida de un cierre NO aprobado:
      // dispara los dos contadores a la vez (o al menos el primero, si el cierre fuera aprobado).
      await tx.$executeRawUnsafe(
        `UPDATE "cierre_sin_gestion" SET "confirmada_fisica_at" = TIMESTAMP '2026-01-01 00:00:00'
          WHERE "id" = $1`,
        filas[0].id,
      );
      await tx.$executeRawUnsafe(
        `UPDATE "cierre_dia" SET "estado" = 'solicitado'
          WHERE "id" = (SELECT "cierre_id" FROM "cierre_sin_gestion" WHERE "id" = $1)`,
        filas[0].id,
      );
      return auditarMarcas(tx);
    });
    expect(r.anterioresALaMigracion).toBeGreaterThan(0);
    expect(r.fueraDeUnCierreAprobado).toBeGreaterThan(0);

    const despues = await auditarMarcas(prisma);
    expect(despues.anterioresALaMigracion).toBe(0);
    expect(despues.fueraDeUnCierreAprobado).toBe(0);
  });

  it("R41: el DOWN real suelta la columna, es idempotente y deja la tabla leible (revertido)", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      await serializarEscriturasReales(tx);
      await tx.$executeRawUnsafe(downSql.trim());
      const trasUno = await columna(tx);
      // Idempotente: una segunda pasada no falla.
      await tx.$executeRawUnsafe(downSql.trim());
      const trasDos = await columna(tx);
      // La tabla revertida se lee con las columnas que el codigo anterior proyecta.
      await tx.$queryRawUnsafe(
        `SELECT "orden_id", "num_guia" FROM "cierre_sin_gestion" LIMIT 1`,
      );
      return { trasUno: trasUno.length, trasDos: trasDos.length };
    });
    expect(r).toEqual({ trasUno: 0, trasDos: 0 });
    // La transaccion revirtio el DDL: la columna sigue en la base.
    expect(await columna(prisma)).toHaveLength(1);
  });
});
