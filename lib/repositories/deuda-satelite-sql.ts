import { Prisma } from "@prisma/client";

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⭑ FICHA 498 (design §5.2, R23/R24/R28/R32) — LA DEUDA DE UNA SATELITE, EN SQL. Las cuatro piezas,
// declaradas UNA vez y compuestas por Saldos (`SaldosSatelitesRepository`) y por el estado de cuenta
// de la bodega (`EstadoCuentaRepository`).
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// `aporteCierreSql` es la GEMELA declarada de `paraLaCentral` (`lib/utils/ingreso-empresa.ts`):
// `498-deuda-satelite-sql-real.test.ts` compara las dos contra Postgres con signo positivo, cero y
// negativo. La guardia `aporte-satelite-fuente-unica-498` prohibe una tercera copia de la resta en
// `lib/`.
//
// El aporte RECONOCIDO en SQL no es una quinta pieza: es `cb.esperado_regla_anterior` para las
// saldadas con la regla anterior y Σ `aporteCierreSql` de sus cierres para las demas.
//
// Los alias son constantes del propio codigo, nunca entrada de usuario: por eso `Prisma.raw`.

/** El aporte de un cierre del dia. Equivale a `paraLaCentral` (R28). */
export const aporteCierreSql = (c: string): Prisma.Sql =>
  Prisma.raw(`(${c}.total_general - ${c}.total_pago_mensajero - ${c}.total_ingreso_bodega_rechazos)`);

/** «Cuenta en la deuda» (R23): cierre satelite aprobado, consolidado o no. */
export const cuentaEnLaDeudaSql = (c: string): Prisma.Sql =>
  Prisma.raw(`(${c}.estado::text = 'aprobado' AND ${c}.destino_tipo::text = 'bodega_satelite')`);

/**
 * «Sin consolidar» (R24/R30): sin consolidacion, o con la consolidacion rechazada (Q3). Requiere
 * `LEFT JOIN cierre_bodega <cb> ON <cb>.id = <c>.cierre_bodega_id`.
 */
export const sinConsolidarSql = (c: string, cb: string): Prisma.Sql =>
  Prisma.raw(`(${c}.cierre_bodega_id IS NULL OR ${cb}.estado::text = 'rechazado')`);

/** «Saldada con la regla anterior» (Q4, design §3.5). */
export const saldadaReglaAnteriorSql = (cb: string): Prisma.Sql =>
  Prisma.raw(`(${cb}.esperado_regla_anterior IS NOT NULL)`);
