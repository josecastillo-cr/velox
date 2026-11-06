// FEATURE 493 (T1, design §5 L1) — LA MARCA QUE ESPERAN LOS TESTS DE TEXTO.
//
// Literales a proposito: un test de texto escribe la marca desde AQUI, nunca desde
// `@/lib/marca/identidad` (R16). Asi, si un label se escribe a mano mal («Cobro Velox»,
// «Velox Corier»), su test lo compara con este literal y sale rojo.
//
// El unico sitio donde este fixture y la constante de produccion se encuentran es el ancla
// `tests/unit/marca/textos-ancla-493.test.ts` (L2). Un cambio futuro de marca son dos lineas:
// `MARCA` y este archivo.

/** Frases, pistas, avisos, ayuda y documentacion (`MARCA.nombre`, P1). */
export const NOMBRE_ESPERADO = "Velox Courier";

/** Etiquetas de una o dos palabras y encabezados de descarga (`MARCA.nombreCorto`, P1). */
export const NOMBRE_CORTO_ESPERADO = "Velox";
