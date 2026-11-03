import type { GestionResultado } from "@prisma/client";

// Feature 238 (design §2, R1/R3/R5) — EL PUNTO UNICO de «que paquete vuelve fisicamente a
// bodega». Lo leen los tres consumidores sin copia: el REPOSITORIO (el WHERE de la lectura del
// conjunto esperado y el de la escritura de la marca), el SERVICIO (la cobertura exacta) y la
// PANTALLA (que filas pinta la ventana de confirmacion).
//
// MODULO PURO: sin Prisma en runtime (solo el `type` del enum, que se borra en compilacion), sin
// servicios, sin `@/lib/db`, sin `next/*`. Se puede importar desde un Client Component sin
// arrastrar servidor. Mismo molde que `lib/types/gestion-destino.ts` (239).

/**
 * R1/R3/R5 — que resultado de gestion devuelve el PAQUETE a bodega. **Punto unico de la regla.**
 *
 * `Record<GestionResultado, boolean>` es exhaustivo A PROPOSITO: si el enum gana un sexto
 * resultado, esto NO COMPILA hasta que alguien decida si su paquete vuelve. Sin esa red, un
 * resultado nuevo caeria en `undefined` -> falsy -> se excluiria del bloqueo EN SILENCIO, que es
 * justo la forma que tiene este fallo de aparecer: nadie ve el hueco, se ve un cierre que se
 * aprueba sin escanear.
 *
 * `incidente: false` esta DECLARADO CON SU RAZON, no omitido: el paquete perdido, robado o
 * danado NO vuelve — se indemniza (feature 158). Es la decision humana firmada del 2026-08-19
 * (`progress/design_pila_ayuda_tienda.md`, decision 3, y `requirements.md` §PUERTA HUMANA). NO
 * «arreglar» poniendolo a `true`: eso bloquearia el cierre exigiendo escanear un paquete que no
 * existe, y dejaria cierres imposibles de aprobar.
 *
 * POR QUE UN `Record` TOTAL Y NO UNA LISTA. Una lista (`["novedad","devolucion_a_origen_por_rechazo","reprogramado"]`)
 * expresa lo que entra y CALLA lo que queda fuera; ese silencio es exactamente lo que hace que la
 * exclusion de los incidentes «parezca un olvido» (R34) y lo que deja pasar un resultado nuevo.
 * El `Record` obliga a nombrar los cinco y a poner el `false` con su comentario; la lista se
 * DERIVA de el.
 */
export const RETORNA_A_BODEGA = {
  entregado: false, // se quedo con el cliente
  reprogramado: true, // vuelve a bodega y espera su fecha (liberacion_reprogramada, 46)
  novedad: true,
  devolucion_a_origen_por_rechazo: true,
  incidente: false, // perdido / robado / danado: no vuelve, se indemniza (158)
} as const satisfies Record<GestionResultado, boolean>;

/**
 * R2 — los resultados cuyo paquete vuelve, DERIVADOS del `Record` de arriba.
 *
 * Se deriva y no se escribe: un segundo literal seria una segunda verdad que puede divergir del
 * `Record` sin que nada lo diga, y la guardia `confirmacion-incidentes-excluidos` existe
 * precisamente para que no aparezca ninguna copia suelta en el arbol.
 */
export const RESULTADOS_QUE_VUELVEN: readonly GestionResultado[] = (
  Object.keys(RETORNA_A_BODEGA) as GestionResultado[]
).filter((r) => RETORNA_A_BODEGA[r]);

/**
 * R1 — ¿el paquete de esta gestion vuelve a bodega?
 *
 * Funcion y no acceso directo al objeto para que el call-site lea como una decision («¿este
 * paquete vuelve?») y no como una consulta a un mapa. Mismo criterio que
 * `estatusDestinoDeResultado` (239).
 */
export function vuelveABodega(resultado: GestionResultado): boolean {
  return RETORNA_A_BODEGA[resultado];
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// FICHA 497 (design §3, R1-R4) — EL SEGUNDO EJE: DE DONDE SALE EL PAQUETE.
//
// El cierre pone delante de bodega paquetes de DOS origenes: las GESTIONES del cierre (lo de arriba)
// y las BARRIDAS —ordenes que el corte diario paso a `novedad_interna` al crear el cierre y que
// quedaron en `cierre_sin_gestion` con su guia congelada (264)—. Una barrida NO es un
// `GestionResultado`: meterla en `RETORNA_A_BODEGA` obligaria a relajar su `satisfies` (y un
// resultado nuevo caeria en `undefined` en silencio). Por eso es un eje APARTE, igual de exhaustivo,
// que DELEGA en el primero en vez de copiarlo. Nada de lo de arriba cambia.
// ════════════════════════════════════════════════════════════════════════════════════════════════

/** Ficha 497 — de donde sale una fila que el cierre pone delante de bodega. */
export type OrigenDelPaquete = "gestion" | "barrida";

/**
 * Ficha 497 (R1/R3) — QUE VUELVE, POR ORIGEN. Exhaustivo a proposito: un tercer origen no compila
 * hasta que alguien decida si su paquete vuelve. `gestion` DELEGA en `RETORNA_A_BODEGA` (no copia
 * sus valores); `barrida` vuelve SIEMPRE (decision H2 adoptada por el humano el 2026-11-02: se
 * escanean igual que reprogramadas, devoluciones y rechazos).
 */
export const RETORNO_POR_ORIGEN = {
  gestion: "segun_resultado",
  barrida: "siempre",
} as const satisfies Record<OrigenDelPaquete, "siempre" | "nunca" | "segun_resultado">;

export type PaqueteDelCierre =
  | { readonly origen: "gestion"; readonly resultado: GestionResultado }
  | { readonly origen: "barrida" };

/**
 * Ficha 497 (R1) — ¿el paquete de esta fila vuelve a bodega? La consultan el servicio (cobertura
 * exacta) y la ventana de confirmacion: ninguno decide por su cuenta (R4). El `switch` va SIN
 * `default`: con el tipo de retorno `boolean`, un origen nuevo deja un camino sin `return` y el
 * typecheck se pone rojo (R3).
 */
export function vuelveABodegaElPaquete(p: PaqueteDelCierre): boolean {
  switch (p.origen) {
    case "gestion":
      return vuelveABodega(p.resultado);
    case "barrida":
      return RETORNO_POR_ORIGEN.barrida === "siempre";
  }
}
