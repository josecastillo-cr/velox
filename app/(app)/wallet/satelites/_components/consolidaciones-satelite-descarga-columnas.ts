import type { DescargaColumna, DescargaFila } from "@/lib/types/descarga";
import type { ConsolidacionSateliteDTO } from "@/lib/types/conciliacion-satelites";

import { ESTADO_CONCILIACION_LABEL, estadoConciliacionDe } from "./satelites-labels";
import { fechaDiaMovimientoCR } from "@/lib/utils/fecha-dia-iso";

/**
 * ⭑ FICHA 431 (T23, R29) — columnas de EXPORT del desglose de consolidaciones de UNA bodega.
 *
 * Módulo PURO: sin React ni DOM.
 *
 * MONEY-SAFE: los cinco importes salen como el STRING del servidor, TAL CUAL, sin símbolo. Y
 * `faltaPorRecibir` **no se recalcula aquí**: viene derivado del servidor igual que a la pantalla,
 * así que el archivo y la tabla no pueden decir cosas distintas sobre la misma fila.
 *
 * ── DOS AUSENCIAS DELIBERADAS
 *
 *  1. **La NOTA no baja al archivo.** Es texto libre tecleado por una persona (R5 de la ficha 362,
 *     el mismo criterio con el que no entra en el registro de acciones), y el censo de columnas
 *     sensibles de este repo no lo admite en una descarga. En pantalla SÍ se ve: es lo que
 *     distingue una conciliación real de la retroactiva del backfill.
 *  2. **El `cierreBodegaId` tampoco**: uuid interno. La fila se identifica por su FECHA de
 *     consolidación, que es como la nombra quien la busca.
 *
 * El ESTADO sale como su ETIQUETA LEGIBLE —la misma del badge, derivada con la MISMA función— y
 * nunca como el valor del enum: quien abra el archivo lee «Recibido incompleto», no `aprobado`.
 */
export const COLUMNAS_DESCARGA_CONSOLIDACIONES_SATELITE: DescargaColumna[] = [
  { clave: "consolidada", encabezado: "Consolidada" },
  // FICHA 498 (R41): «Debe» (el aporte reconocido) sustituye a «Declarado» (el efectivo).
  { clave: "debe", encabezado: "Debe" },
  { clave: "recibido", encabezado: "Recibido" },
  { clave: "faltaPorRecibir", encabezado: "Falta por recibir" },
  { clave: "estado", encabezado: "Estado" },
  { clave: "conciliadoPor", encabezado: "Conciliado por" },
  { clave: "conciliadoEl", encabezado: "Conciliado el" },
  { clave: "totalGeneral", encabezado: "Total consolidado" },
  { clave: "efectivo", encabezado: "Efectivo" },
  { clave: "simpe", encabezado: "SINPE" },
  { clave: "transferencia", encabezado: "Transferencia" },
  { clave: "pagoMensajeros", encabezado: "Pago a sus mensajeros" },
  { clave: "rechazos", encabezado: "Su ganancia por rechazos" },
  { clave: "saldadaReglaAnterior", encabezado: "Saldada con la regla anterior" },
  { clave: "cierres", encabezado: "Cierres del día consolidados" },
];

export function filaDescargaConsolidacionSatelite(c: ConsolidacionSateliteDTO): DescargaFila {
  return {
    consolidada: fechaDiaMovimientoCR(c.solicitadoAt),
    // FICHA 498 (R41): lo que DEBE, el aporte reconocido del servidor. Ya no es el efectivo
    // (la decisión Q2 de la 431 la revocó el humano el 2026-11-02).
    debe: c.debe,
    // Sin marcar la celda va VACÍA, no en cero: «nadie lo ha mirado» no es «llegaron ₡0».
    recibido: c.montoRecibido ?? "",
    faltaPorRecibir: c.faltaPorRecibir,
    estado: ESTADO_CONCILIACION_LABEL[estadoConciliacionDe(c)],
    conciliadoPor: c.conciliadoPorNombre ?? "",
    conciliadoEl: c.conciliadoAt === null ? "" : fechaDiaMovimientoCR(c.conciliadoAt),
    totalGeneral: c.totales.general,
    efectivo: c.totales.efectivo,
    simpe: c.totales.simpe,
    transferencia: c.totales.transferencia,
    pagoMensajeros: c.totalPagoMensajero,
    rechazos: c.totalIngresoBodegaRechazos,
    saldadaReglaAnterior: c.saldadaReglaAnterior ? "Sí" : "",
    cierres: c.cantidadCierres,
  };
}
