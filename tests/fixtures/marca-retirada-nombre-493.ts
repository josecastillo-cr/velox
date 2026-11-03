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
