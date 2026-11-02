/**
 * Feature 492 — UNICA fuente de la identidad de marca (R1).
 *
 * Todo archivo TypeScript que pinte la marca (logo, `<head>`, informes PDF, correo, API docs) lee
 * de aqui. Los archivos que no pueden importar codigo (`public/manifest.json`,
 * `public/offline.html`, `public/sw.js`) repiten estos valores a mano y la guardia
 * `tests/unit/guards/marca-velox-identidad.guardia.test.ts` vigila que no diverjan (R2).
 *
 * Sin dependencias: se importa igual desde servidor y cliente. La ficha 493 la reutiliza y amplia;
 * no crea otra.
 *
 * `DATOS_LEGALES.marca` (feature 490) es un dato legal aparte; un test exige que valga lo mismo.
 */
export const MARCA = {
  nombre: "Velox Courier",
  /** `short_name` del manifiesto y `apple-mobile-web-app-title` (P1, 2026-10-31). */
  nombreCorto: "Velox",
  /** Descripcion de la aplicacion (P4, 2026-10-31). */
  descripcion: "Plataforma de logística y entregas Velox Courier",
  /** `theme_color` / `background_color` y `<meta name="theme-color">`. */
  colorTema: "#011027",
} as const;

/** Rutas publicas de las variantes del logo (copias de `docs/marca/velox/svg/`). */
export const LOGO = {
  /** Logotipo original: VELOX blanco. Sobre fondo oscuro. */
  sobreOscuro: "/marca/logo-horizontal.svg",
  /** Adaptacion con VELOX en azul marino. Sobre fondo claro. */
  sobreClaro: "/marca/logo-horizontal-fondo-claro.svg",
  /** Simbolo solo (barra lateral colapsada). */
  simbolo: "/marca/logo-simbolo.svg",
} as const;
