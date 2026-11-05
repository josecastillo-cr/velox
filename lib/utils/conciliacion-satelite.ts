import { Prisma } from "@prisma/client";

import { paraLaCentral } from "@/lib/utils/ingreso-empresa";

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⭑ FICHA 431 → FICHA 498 — LA DEUDA DE UNA SATELITE, ESCRITA UNA SOLA VEZ (en TypeScript).
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// MODULO PURO (sin React, sin repositorio, sin servicio). Lo leen:
//   1. `SaldosSatelitesRepository` — la deuda de una bodega y el `faltaPorRecibir` de cada
//      consolidacion en `/wallet/satelites`;
//   2. `CierreBodegaRepository.toBodegaResumenRow` — el `faltaPorRecibir` de la MISMA
//      consolidacion en `/cierres-admin` (R27 sale por construccion);
//   3. `CierresBodegaAdminRepository` — el ESPERADO de la marca y de la correccion (R9/R17);
//   4. `EstadoCuentaService` — el pendiente de la bodega.
//
// ⚠️ FICHA 498 (decision del humano del 2026-11-02): se REVOCA la decision Q2 del 2026-09-16 (deuda
// solo sobre el efectivo). El aporte de una consolidacion es «Para la central» (`paraLaCentral`):
// TODOS los metodos de pago menos lo que pertenece a la satelite (el pago a sus mensajeros y su
// ganancia por rechazos), con signo. La formula de antes (efectivo − recibido) se retira.
//
// Su gemela en SQL vive en `lib/repositories/deuda-satelite-sql.ts` y se mide contra esta en
// `498-deuda-satelite-sql-real.test.ts` (R28). La guardia `aporte-satelite-fuente-unica-498` prohibe
// una tercera copia de la resta.

/** Lo que una consolidacion trae para calcular su aporte reconocido. */
export interface AporteDeConsolidacionInput {
  totalGeneral: Prisma.Decimal;
  totalPagoMensajero: Prisma.Decimal;
  totalIngresoBodegaRechazos: Prisma.Decimal;
  /** FICHA 498 (Q4, design §3.5): NO NULL = saldada con la regla anterior. */
  esperadoReglaAnterior: Prisma.Decimal | null;
}

/**
 * El APORTE RECONOCIDO de una consolidacion (R26/R28): si esta saldada con la regla anterior, el
 * valor que fijo la regularizacion (M4, su `monto_recibido` de entonces); si no, su aporte
 * («Para la central»), con signo.
 *
 * Es la UNICA funcion de TypeScript que lee `esperadoReglaAnterior`. Delega la resta en
 * `paraLaCentral`: no la copia.
 */
export function aporteDeConsolidacion(row: AporteDeConsolidacionInput): Prisma.Decimal {
  if (row.esperadoReglaAnterior !== null) return row.esperadoReglaAnterior;
  return new Prisma.Decimal(
    paraLaCentral(
      row.totalGeneral.toFixed(2),
      row.totalPagoMensajero.toFixed(2),
      row.totalIngresoBodegaRechazos.toFixed(2),
    ),
  );
}

/** ¿La consolidacion esta saldada con la regla anterior? (R41a) */
export function esSaldadaReglaAnterior(
  row: Pick<AporteDeConsolidacionInput, "esperadoReglaAnterior">,
): boolean {
  return row.esperadoReglaAnterior !== null;
}

/**
 * «Falta por recibir» de una consolidacion (R26): `aporte reconocido − (recibido ?? 0)`.
 *
 *  · `recibido === null` (sin marcar) -> el aporte integro;
 *  · recibido IGUAL                   -> `0.00`;
 *  · recibido MENOR                   -> la diferencia;
 *  · recibido MAYOR                   -> un NEGATIVO, sin recortar a cero (llego de mas).
 *
 * Money-safe: `Prisma.Decimal` de punta a punta. Quien lo emite hace el `.toFixed(2)`.
 */
export function faltaPorRecibir(
  aporte: Prisma.Decimal,
  recibido: Prisma.Decimal | null,
): Prisma.Decimal {
  return aporte.minus(recibido ?? new Prisma.Decimal(0));
}

/**
 * La deuda de una zona satelite (R23): Σ aportes que cuentan − Σ recibido. Los dos sumandos llegan
 * ya agregados (de Saldos o del estado de cuenta); la resta vive aqui y solo aqui.
 */
export function deudaDeZona(aportes: Prisma.Decimal, recibido: Prisma.Decimal): Prisma.Decimal {
  return aportes.minus(recibido);
}

/**
 * ⭑ FICHA 500 (R3/R4) — ¿se ofrece «Desmarcar»? Los MISMOS dos cortes que
 * `CierresBodegaAdminRepository.revertirConciliacion`: con dinero (`con_asientos`) y saldada con la
 * regla anterior (`saldada_regla_anterior`). Ofrecer un boton que el servidor siempre rechaza
 * contradice «solo cuando se puede» (decision tecnica anotada en el design de la 500, §2.2).
 *
 * `conDinero` sale de `consolidacionesConDinero` (el criterio unico del servidor); esta funcion no
 * lo recalcula.
 */
export function puedeDesmarcarse(c: {
  conciliado: boolean;
  conDinero: boolean;
  saldadaReglaAnterior: boolean;
}): boolean {
  return c.conciliado && !c.conDinero && !c.saldadaReglaAnterior;
}
