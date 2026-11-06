import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import type { TxDeTest } from "../_postgres-real";
import { soloEjecutable } from "../_fixtures/sql-ejecutable";

/**
 * FICHA 498 — piezas de los tests de las cuatro migraciones (M1-M4). Los `.sql` se leen del disco y
 * se ejecutan DENTRO de la transaccion del test, que SIEMPRE se revierte. Los `down.sql` llevan
 * BEGIN/COMMIT (para correrlos a mano): aqui se quitan, o el COMMIT cerraria la transaccion del test.
 */

const MIGRACIONES = path.join(process.cwd(), "db", "migrations");
export const DIR_M1 = "20261103120000_satelite_498_enums";
export const DIR_M2 = "20261103120100_satelite_498_ajuste";
export const DIR_M3 = "20261103120200_satelite_498_retirar_asientos";
export const DIR_M4 = "20261103120300_satelite_498_regularizar";

export function leer(dir: string, archivo: "migration.sql" | "down.sql"): string {
  return fs.readFileSync(path.join(MIGRACIONES, dir, archivo), "utf8").replace(/\r\n/g, "\n");
}

/** El texto ejecutable de un `.sql` SIN su BEGIN/COMMIT. */
export function sinTransaccion(sql: string): string {
  return soloEjecutable(sql)
    .replace(/^\s*BEGIN;\s*$/m, "")
    .replace(/^\s*COMMIT;\s*$/m, "");
}

export const UP = (dir: string) => sinTransaccion(leer(dir, "migration.sql"));
export const DOWN = (dir: string) => sinTransaccion(leer(dir, "down.sql"));

/** Ejecuta `sql` en un SAVEPOINT; devuelve el mensaje del error si fallo, o `null` si paso. */
export async function intentarConMensaje(tx: TxDeTest, sql: string): Promise<string | null> {
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

export async function correr(tx: TxDeTest, sql: string): Promise<void> {
  const error = await intentarConMensaje(tx, sql);
  if (error !== null) throw new Error(`el sql fallo: ${error}`);
}

const SUFIJO = `498m${Date.now().toString(36)}${randomUUID().slice(0, 6)}`;
let n = 0;
export function unico(): string {
  n += 1;
  return `${SUFIJO}-${n}`;
}

/** Un usuario cualquiera de la base (FK de `solicitado_por`, `conciliado_por`, `creado_por`). */
export async function algunUsuarioId(tx: TxDeTest): Promise<string> {
  const u = await tx.usuario.findFirst({ select: { id: true } });
  if (u === null) throw new Error("la tabla `usuario` esta vacia: corre `pnpm run db:seed`.");
  return u.id;
}

export async function sembrarZona(tx: TxDeTest): Promise<string> {
  const z = await tx.zona.create({
    data: { nombre: `Zona ${unico()}`, sinpeNumero: "80000000", sinpeNombre: "Titular", esCentral: false },
    select: { id: true },
  });
  return z.id;
}

export interface Consolidacion {
  zonaId: string;
  usuarioId: string;
  estado?: "solicitado" | "aprobado" | "rechazado";
  general: string;
  pago?: string;
  rechazos?: string;
  efectivo?: string;
  /** Si viene, la consolidacion queda CONCILIADA con este recibido. */
  recibido?: string;
}

/** Una consolidacion sembrada directamente (sin cierres), coherente con el CHECK de la 431. */
export async function sembrarConsolidacion(tx: TxDeTest, c: Consolidacion): Promise<string> {
  const conciliada = c.recibido !== undefined;
  const fila = await tx.cierreBodega.create({
    data: {
      zonaId: c.zonaId,
      solicitadoPor: c.usuarioId,
      estado: c.estado ?? (conciliada ? "aprobado" : "solicitado"),
      totalGeneral: new Prisma.Decimal(c.general),
      totalEfectivo: new Prisma.Decimal(c.efectivo ?? c.general),
      totalPagoMensajero: new Prisma.Decimal(c.pago ?? "0"),
      totalIngresoBodegaRechazos: new Prisma.Decimal(c.rechazos ?? "0"),
      ...(conciliada
        ? {
            conciliadoAt: new Date(),
            conciliadoPor: c.usuarioId,
            montoRecibido: new Prisma.Decimal(c.recibido as string),
            resueltoAt: new Date(),
            resueltoPor: c.usuarioId,
          }
        : {}),
    },
    select: { id: true },
  });
  return fila.id;
}

/** Inserta una fila de ajuste por SQL (la tabla es append-only: el repositorio no se usa aqui). */
export async function sembrarAjuste(
  tx: TxDeTest,
  a: { cierreBodegaId: string; usuarioId: string; evento?: string; diferencia?: string },
): Promise<string> {
  const id = randomUUID();
  await tx.$executeRawUnsafe(
    `INSERT INTO conciliacion_bodega_ajuste (id, cierre_bodega_id, evento, monto_esperado, monto_recibido, diferencia, creado_por)
     VALUES ($1, $2, $3, 100, 90, $4::numeric, $5)`,
    id,
    a.cierreBodegaId,
    a.evento ?? "marca",
    a.diferencia ?? "10",
    a.usuarioId,
  );
  return id;
}

/** Huella (conteo + md5) de una tabla entera: si cambia una sola fila, cambia la huella. */
export async function huella(tx: TxDeTest, tabla: string, columnas = "t::text"): Promise<string> {
  const filas = await tx.$queryRawUnsafe<{ h: string | null; n: bigint }[]>(
    `SELECT md5(string_agg(${columnas}, '|' ORDER BY t.id)) AS h, count(*) AS n FROM "${tabla}" t`,
  );
  return `${Number(filas[0].n)}:${filas[0].h ?? "vacia"}`;
}

export async function existeTabla(tx: TxDeTest, nombre: string): Promise<boolean> {
  const [{ existe }] = await tx.$queryRawUnsafe<{ existe: boolean }[]>(
    `SELECT to_regclass($1) IS NOT NULL AS existe`,
    nombre,
  );
  return existe;
}

export async function existeColumna(tx: TxDeTest, tabla: string, columna: string): Promise<boolean> {
  const filas = await tx.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*) AS n FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    tabla,
    columna,
  );
  return Number(filas[0].n) === 1;
}
