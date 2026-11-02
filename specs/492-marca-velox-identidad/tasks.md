# 492 — Marca Velox Courier: identidad visual · tasks

> Zona `frontend`; implementa `frontend_dev`. P1–P8 resueltas por el humano el 2026-10-31 (ver
> `requirements.md`); no queda ninguna tarea bloqueada. Gate: `./init.sh --rapido` + las guardias de T13 a mano (no las selecciona el grafo).
> Nunca el completo. `[P]` = paralelizable con las demás `[P]` de su fase una vez cumplidas sus
> dependencias. Un commit por task: `feat(492): …` / `test(492): …`.

## Fase 0 — Antes de tocar nada

- [x] **T0 — Huella de la marca anterior.** En el worktree (nacido de `dev`, SHA dado por el leader,
  `checkout --detach` + merge-base como primer paso), calcular el SHA-256 de:
  `app/icon.png`, `public/icons/icon-{192,512}.png`, `public/icons/icon-{192,512}-maskable.png`,
  `public/icons/icon-180.png`, `public/icons/badge-72.png`, `public/screenshots/*.png`.
  **Hecho:** los 10 hashes anotados en `progress/impl_492.md` con el SHA de `dev` del que salen.

## Fase 1 — Fuente única y archivos

- [x] **T1 — `lib/marca/identidad.ts`** (`MARCA`, `LOGO`, design §3.1) con `nombreCorto: "Velox"` (P1) y
  `descripcion: "Plataforma de logística y entregas Velox Courier"` (P4). Test
  `tests/unit/marca/identidad.test.ts`: valores como **literales de contrato** (`"Velox Courier"`,
  `"Velox"`, la descripción, `"#011027"`, rutas de `LOGO`) y
  `MARCA.nombre === DATOS_LEGALES.marca`. → R1.
  **Hecho:** test verde; mutar `colorTema` lo pone rojo.
- [x] **T2 [P] — Copiar archivos** (design §3.2): `public/marca/{logo-horizontal,logo-horizontal-fondo-claro,logo-simbolo}.svg`,
  `public/icons/fuente/icon-maskable.svg`, `app/favicon.ico`, `app/icon.svg`; borrar `app/icon.png`.
  Guardia `tests/unit/guards/marca-velox-archivos.guardia.test.ts`: cada destino byte-idéntico a su
  origen en `docs/marca/velox/`, y `app/icon.png` no existe. → R3, R8.
  **Hecho:** guardia verde; cambiar un byte de una copia la pone roja.
- [x] **T3 — PNG de la PWA y badge** (depende de T2; design §3.3). Escribir
  `public/icons/fuente/icon-any.svg` (fondo `#011027` con `rx="108"` + símbolo, solo trazados).
  Ampliar `scripts/generate-pwa-icons.mjs` con la salida `badge-72.png` (silueta blanca desde
  `docs/marca/velox/svg/logo-simbolo.svg` o su copia en `public/marca/`) y actualizar sus
  comentarios del monograma. Ejecutar `node scripts/generate-pwa-icons.mjs`.
  Guardia `tests/unit/guards/marca-velox-sin-anterior.guardia.test.ts` (hashes de T0) con:
  ningún icono/badge/favicon coincide con la marca anterior; píxel de fondo `#011027` en los cinco
  iconos (borde superior centrado, `(⌊w/2⌋, ⌊w/64⌋)`); badge RGBA, todo píxel con alfa > 0 es blanco
  y al menos un 5 % de píxeles visibles. → R7, R8, R9.
  **Hecho:** la guardia nueva y `pwa-manifiesto-atajos` (§3, esquinas `any`/`maskable`),
  `pwa-push` (badge RGBA) y `tests/unit/pwa/manifest.test.ts` en verde; revisión visual de los cinco
  PNG y el badge (abrirlos) anotada en `progress/impl_492.md`.

## Fase 2 — Identidad del documento y de la PWA

- [x] **T4 — Manifiesto, `<head>`, `offline.html`, `sw.js`** (depende de T1; design §3.4–3.5).
  - `public/manifest.json`: `name`, `short_name`, `description`, `theme_color`, `background_color`.
  - `app/layout.tsx`: `metadata.title/description`, `theme-color`, `apple-mobile-web-app-title`
    desde `MARCA`.
  - `public/offline.html`: `<title>` y `theme-color`.
  - `public/sw.js`: `TITULO_RESERVA`.
  - Guardia `tests/unit/guards/marca-velox-identidad.guardia.test.ts`: importa `MARCA` y compara con
    manifiesto, `offline.html` y `sw.js` (R2); afirma que `app/layout.tsx` usa `MARCA.colorTema` y
    `MARCA.nombreCorto` en esas metas y que `metadata` (importado) da `title`/`description` de
    `MARCA` (R6); `offline.html` lleva `<title>Velox Courier — Sin conexión</title>` (R11).
  - **Actualizar sin borrar**: `pwa-manifiesto-atajos.guardia.test.ts` caso «conserva sus diez
    claves» (solo `name`, `short_name`, `description`, `theme_color`, `background_color`; el resto
    igual → R4, R5); `pwa-push.guardia.test.ts:228/237/243` título de reserva «Velox Courier» (R10).
  **Hecho:** las cuatro guardias PWA (`pwa-manifiesto-atajos`, `pwa-push`, `pwa-relevo-y-purga`,
  `pwa-servida-sin-sesion`), `tests/unit/pwa/manifest.test.ts`, `html-lang` y la guardia nueva en
  verde; `git diff` de `sw.js` = una línea.

## Fase 3 — Logo en pantalla

- [x] **T5 — Componente `Logo`** (depende de T1, T2; design §3.6). Prop `fondo`, raíz
  `role="img"` con `aria-label`, imágenes `alt=""`. Test `tests/components/Logo.test.tsx`: un único
  `img` accesible llamado «Velox Courier» en las tres variantes; `oscuro` → `src` de
  `LOGO.sobreOscuro`; `claro` → `LOGO.sobreClaro`; `tema` → las dos, la clara con `dark:hidden` y
  la oscura con `hidden dark:inline-block`; ningún texto «Ordenex». → R12.
  **Hecho:** test verde; cambiar el `src` de una variante lo pone rojo.
- [x] **T6 — Consumidores de `Logo`** (depende de T5).
  - `Sidebar.tsx`: `fondo="oscuro"`; icono colapsado `LOGO.simbolo` con `alt={MARCA.nombre}`. Caso
    nuevo en `tests/components/Sidebar.test.tsx` (sin tocar los existentes). → R13.
  - `login/page.tsx`, `recuperar-contrasena/page.tsx`, `postulacion/page.tsx`: panel `oscuro`,
    móvil `tema`; `paquete/[numGuia]/page.tsx`: `tema`. Caso nuevo en
    `tests/components/LoginPage.test.tsx` (render real con su arnés) y guardia estática
    `tests/unit/guards/marca-velox-logo-por-fondo.guardia.test.ts` que lee las cuatro páginas y la
    barra y exige la variante de la tabla de design §3.6 en cada `<Logo>`. → R14.
  - `LandingNav.tsx` (`fondo="oscuro"`, `aria-label` «Velox Courier — inicio») y
    `LandingFooter.tsx` (`fondo="oscuro"`, rama `marca` intacta). **Actualizar sin borrar**
    `tests/components/LandingPage.test.tsx` (R2 de la 86: el logo por rol y nombre; enlace del logo
    con nombre «Velox Courier — inicio») y `tests/components/LandingFooter.test.tsx` (caso «sin
    `marca`»). → R15.
  **Hecho:** los tests citados verdes y los casos previos de esos archivos intactos (mismo número de
  `it` o más).

## Fase 4 — PDF, correo y documentación (todas `[P]` entre sí; dependen de T1)

- [x] **T7 [P] — Etiqueta** (design §3.7; P2). `ROTULO_GUIA = "VELOX · GUÍA"`; comentarios de
  `etiquetas-dibujo.ts:369` y `etiquetas-maqueta.ts:117`. Test de contrato literal nuevo en
  `tests/unit/pdf/etiquetas-diseno-353.test.ts` (o archivo propio): `ROTULO_GUIA` vale
  `"VELOX · GUÍA"` y la etiqueta generada lo contiene y no contiene «ORDENEX». → R16.
  **Hecho:** además, SIN editar, en verde: `tests/unit/pdf/etiquetas-capacidad.test.ts`,
  `etiquetas-diseno-353.test.ts`, `etiquetas-caracter-no-cubierto.test.ts`,
  `tests/unit/components/etiquetas-pdf.test.ts` y `tests/unit/guards/etiquetas-maqueta-unica.guardia.test.ts`
  → R17. Si alguno se pone rojo: parar y volver al spec, no tocar números.
- [x] **T8 [P] — Informes PDF** (design §3.8). `transito/pdf.ts` y `picking/pdf.ts` desde
  `MARCA.nombre`. Actualizar los literales de `tests/unit/pdf/informe-transito-pdf.test.ts:193` y
  `tests/unit/whatsapp-envios/picking-pdf.test.ts:152/194/206`, y añadir en cada uno un caso «el PDF
  no contiene "Ordenex"». → R18.
  **Hecho:** ambos archivos verdes.
- [x] **T9 [P] — Correo** (design §3.9). `DEFAULT_FROM_NAME = MARCA.nombre`. Actualizar
  `tests/unit/config/email-marca.test.ts` y `email-config.test.ts:102` a «Velox Courier» literal;
  caso nuevo: sin `SMTP_FROM_NAME`, el correo compuesto lleva «Velox Courier» en cabecera y pie. → R19.
  **Hecho:** `tests/unit/config/` y `tests/unit/services/email-*` verdes.
- [x] **T16 [P] — Contacto de soporte** (design §3.13; P5). `DEFAULT_SUBJECT =
  "mailto:battos.sa@gmail.com"` en `lib/config/push.ts`, en minúsculas. Caso en
  `tests/unit/config/push-config.test.ts`: sin `VAPID_SUBJECT` (o en blanco), `loadPushConfig().subject`
  vale ese literal exacto; y `grep` de `soporte@ordenex.co` sobre los archivos de esta ficha vacío.
  Ajustar `pwa-push.guardia` solo si afirma el valor por defecto. → R23.
  **Hecho:** `tests/unit/config/push-config.test.ts`, `tests/unit/push/` y `pwa-push.guardia` verdes.
- [x] **T10 [P] — API docs** (design §3.10). `app/api-docs/route.ts`, `lib/api/openapi-spec.ts`,
  `docs/api/api-key-openapi.yaml`. Test nuevo `tests/unit/api/openapi-titulo-marca.test.ts`: el
  HTML de `GET()` y `info.title` del spec y del YAML valen «Velox Courier — API de integración por
  API key». → R20.
  **Hecho:** test nuevo y `tests/unit/api/openapi-*` verdes.
- [x] **T11 [P] — Guía de integración** (design §3.11). Portada, `<title>`, autor, pie `@page`,
  `<h1>`, logo de portada; README de la carpeta. Test `tests/unit/docs/guia-integracion-marca.test.ts`:
  las cinco piezas llevan «Velox Courier» y el `src` del logo resuelve a
  `docs/marca/velox/svg/logo-horizontal-fondo-claro.svg` existente. → R21.
  **Hecho:** test verde; `python docs/api/guia-integracion/generar-pdf.py <ruta temporal>` genera el
  PDF sin error y la portada muestra el logo (captura o descripción en `progress/impl_492.md`; el PDF
  no se commitea).

## Fase 5 — Capturas y fotos

- [x] **T12 [P] — Fotos de la landing** (P8, solo lectura; el humano decidió que se quedan como
  están). Mirar `public/landing/*.jpg` y anotar en `progress/impl_492.md` si alguna muestra
  «Ordenex». **Hecho:** nota escrita; no se sustituye nada.
- [x] **T13a — Rehacer las capturas** (depende de T4, T5, T6; P3). Las tres con Playwright contra el
  servidor local, con los mismos nombres y tamaños y con `nextjs-portal` oculto, revisadas a ojo. El
  manifiesto no cambia. La guardia de T3 suma las capturas a la lista de hashes prohibidos. → R22.
  **Hecho:** `manifest.test.ts`, `pwa-manifiesto-atajos` y `marca-velox-sin-anterior` verdes.

## Fase 6 — Verificación y cierre

- [x] **T13 — Gate y guardias a mano.** `./init.sh --rapido` (con `INIT_EXIT=$?` escrito dentro del
  log, sin `tail`) y, aparte, porque el grafo no las relaciona con `public/**` ni `docs/**`:
  `tests/unit/guards/pwa-*.guardia.test.ts`, `tests/unit/guards/marca-velox-*.guardia.test.ts`,
  `tests/unit/pwa/manifest.test.ts`, `tests/unit/guards/html-lang.guardia.test.ts`,
  `tests/unit/guards/etiquetas-maqueta-unica.guardia.test.ts`, `tests/unit/docs/guia-integracion-marca.test.ts`.
  Comprobar que `git diff --stat origin/dev -- app/globals.css` está vacío.
  **Hecho:** todo verde, `skipped` revisados, logs en `progress/`.
- [x] **T14 — Ver la app** (depende de T13; un solo dev server). Con Playwright, en claro y oscuro:
  barra expandida y colapsada (medir que la caja del logo no se solapa con el botón de colapso),
  `/login` escritorio y móvil, `/`, `/paquete/<guía>`, `/api-docs` (pestaña con favicon nuevo),
  `/manifest.json`. Generar una etiqueta 100×100 y un lote en la hoja más pequeña del catálogo y
  mirarlas. Limpiar lo que se haya creado en la base local.
  **Hecho:** capturas o mediciones en `progress/impl_492.md`.
  _Nota (2026-11-02): dev server con `next dev --webpack` (Turbopack rechaza el junction de `node_modules` del worktree); la etiqueta y el lote se generaron con `buildEtiquetasLotePdf`, el generador real, sin pasar por la UI._
- [x] **T15 — Trazabilidad y entrega.** `progress/impl_492.md` con el mapa R1–R23 → test, la lista de
  tests actualizados (no borrados) y la tabla de acciones de configuración del humano (design §4).
  **Hecho:** cada R con al menos un test que lo pone rojo al mutarse; commit hecho y verificado en la
  rama (`git log` del blob), no solo en disco.

## Dependencias

```
T0 ─┬─ T1 ─┬─ T4 ─────────────┐
    │      ├─ T5 ─ T6 ────────┼─ T13a ─ T13 ─ T14 ─ T15
    │      └─ T7 T8 T9 T10 T11 T16 [P]
    └─ T2 ─ T3 ────────────────┘
T12 [P] en cualquier momento
```
