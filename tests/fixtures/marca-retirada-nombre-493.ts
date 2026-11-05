// FEATURE 493 (T13, design §5 L3) — LA MARCA RETIRADA, PARA LAS NEGATIVAS.
//
// Unico sitio de los tests donde la marca retirada vive como literal (junto con el detector de la
// guardia, que la importa de aqui). Un test que afirma «este texto ya NO dice la marca de antes»
// la escribe desde aqui: si la negativa se migrara a la marca vigente se invertiria, y si se
// quedara con el literal la guardia R16 la pondria roja. Esta en `PROPIOS` de
// `tests/fixtures/marca-retirada-493.ts`.

/** Marcas que ya no pueden aparecer en un texto. Un cambio futuro de marca añade aqui la vigente. */
export const MARCAS_RETIRADAS = ["Ordenex"] as const;

/** La marca inmediatamente anterior (para `not.toContain(MARCA_RETIRADA)`). */
export const MARCA_RETIRADA = MARCAS_RETIRADAS[0];

/** La misma, en cualquier caja (para `not.toMatch(MARCA_RETIRADA_RE)`). Sin `g`: `.test` no guarda estado. */
export const MARCA_RETIRADA_RE = new RegExp(MARCA_RETIRADA, "i");

/**
 * FEATURE 494 (design §3.5) — dominio y cabeceras anteriores, para las negativas de contrato. También para
 * lo que se afirma de una entrada histórica de `docs/api/CHANGELOG.md`, que no se reescribe (E2).
 */
export const DOMINIO_RETIRADO = "ordenex.co";
export const ORIGEN_WEBHOOK_RETIRADO = `https://app.${DOMINIO_RETIRADO}`;
export const PREFIJO_CABECERA_RETIRADA = `X-${MARCA_RETIRADA}-`;
export const CABECERA_FIRMA_RETIRADA = `${PREFIJO_CABECERA_RETIRADA}Signature`;
export const CABECERA_TIMESTAMP_RETIRADA = `${PREFIJO_CABECERA_RETIRADA}Timestamp`;

/**
 * FEATURE 494 (R7, design §3.5) — los conceptos de «Así queda» con el nombre anterior. Una pestaña abierta
 * durante el despliegue los sigue enviando: el servidor tiene que rechazarlos, sin alias (design §3.2).
 */
export const CONCEPTOS_RETIRADOS_494 = ["gasto_ordenex", "tienda_paga_a_ordenex"] as const;

/** FEATURE 494 (R5, design §3.2) — el id anterior de la métrica de ganancia. El catálogo no puede servirlo. */
export const METRICA_RETIRADA_494 = "ganancia_ordenex";

/**
 * FEATURE 494 (R16, design §5.3) — la columna de dinero con su nombre anterior, y la clave vieja de su
 * ámbito. Están en el navegador de quien la ocultó.
 */
export const COLUMNA_DINERO_RETIRADA_494 = "ordenex";
export const CLAVE_DESCARGA_DINERO_RETIRADA_494 = "ordenex:descarga-columnas:analitica-productos-dinero";
