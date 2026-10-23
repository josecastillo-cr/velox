import type { WalletMovimientoCategoria } from "@/lib/types/wallet";

/**
 * FICHA 458-B (R4) — el nombre legible de un egreso de caja cuando su `descripcion` falta.
 *
 * `WalletEgresoService.reversarEgreso` escribia `Reverso de: ${descripcion ?? id}`: si la fila no
 * traia descripcion, el libro pintaba un uuid (C4.2 del inventario). Aqui la caida es un NOMBRE, y
 * nunca un identificador. Los textos son los del libro de la caja (`CATEGORIA_LABEL`, 461 §7.2)
 * escritos otra vez a proposito: `lib/` no importa de `app/`. Cualquier otra categoria (no deberia
 * llegar: solo se reversan egresos) cae en «un movimiento de la caja».
 */
const NOMBRE_EGRESO: Partial<Record<WalletMovimientoCategoria, string>> = {
  egreso_sueldo: "Sueldo",
  egreso_gasto_variable: "Gasto de Ordenex",
  egreso_gasto_fijo: "Gasto fijo de Ordenex",
  egreso_gasto: "Otro gasto de Ordenex",
  egreso_indemnizacion: "Indemnización que Ordenex paga por un incidente",
  egreso_pago_iva: "Pago de IVA", // ficha 488
};

export function nombreDelEgresoAnulable(categoria: WalletMovimientoCategoria): string {
  return NOMBRE_EGRESO[categoria] ?? "un movimiento de la caja";
}

/**
 * FICHA 488 (design §3.3/§4.2, R25) — las categorias con las que se escribe el CONTRA-ASIENTO de un
 * egreso anulable de la caja. Es LA lista: la usan quien escribe la anulacion
 * (`EgresoCajaAnulacionService.anular`, `WalletEgresoService.reversarEgreso`) y quien la busca para
 * decir «anulado» en el libro (`EgresoCajaDocumentosRepository.estadoDeDocumentos`). Si quien busca
 * tuviera una lista propia, el Pago de IVA anulado se leeria «vigente» sin que nada fallara.
 */
export const CATEGORIAS_DE_CONTRA_ASIENTO_DE_EGRESO = ["ingreso_ajuste", "ingreso_reverso_pago_iva"] as const satisfies readonly WalletMovimientoCategoria[];

export type CategoriaDeContraAsientoDeEgreso = (typeof CATEGORIAS_DE_CONTRA_ASIENTO_DE_EGRESO)[number];

/**
 * FICHA 488 (design §3.3, R25) — la categoria del contra-asiento de un egreso anulable: el del Pago de
 * IVA vuelve al IVA por pagar (`ingreso_reverso_pago_iva`, dueño `iva`); cualquier otro, el
 * `ingreso_ajuste` de siempre. La naturaleza es de la CATEGORIA, no de la fila: con `ingreso_ajuste`
 * (propio), anular un Pago de IVA SUBIRIA la ganancia en vez de devolver el IVA por pagar.
 */
export function categoriaDelContraAsiento(categoria: WalletMovimientoCategoria): CategoriaDeContraAsientoDeEgreso {
  return categoria === "egreso_pago_iva" ? "ingreso_reverso_pago_iva" : "ingreso_ajuste";
}
