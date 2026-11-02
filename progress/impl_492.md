# 492 — Marca Velox Courier: identidad visual · informe de implementación

- Rama `feat/492-marca-velox-identidad`, worktree `R:\job\singularis\projects\wt-492`, nacida de
  `origin/dev` en `8e150533`. Implementa `frontend_dev`, 2026-11-02.
- Búsqueda de código: el MCP `codebase-memory` no estaba entre mis herramientas en esta sesión;
  todo se localizó con `grep`/lectura del archivo real.
- Un commit por tarea (T1–T11, T16, T13a) + este informe.

## T0 — Huella de la marca anterior (SHA-256, `origin/dev` 8e150533)

| Archivo | SHA-256 |
|---|---|
| `app/icon.png` | `c9ab1514c72abe83e64f5064b230cc981c441be508ba18da8f07fff582673fbd` |
| `public/icons/icon-192.png` | `41f5858ea654a5408da290a6fa9a33639244e38261d9b72b2cb59ded70e75ab3` |
| `public/icons/icon-512.png` | `7ca122b7ccc1440658fc2a853fec620cc3f932e5ea4743041bd4d7b53b1d6c31` |
| `public/icons/icon-192-maskable.png` | `f267f046952144fe66308602b35b126cb8b4ecd8c6dd8781ff4a7612f1969790` |
| `public/icons/icon-512-maskable.png` | `71c5f1cefe6a7adae1ac8a26243c2aca40fcce3780857eafb04a111e300c552b` |
| `public/icons/icon-180.png` | `d0bba6acc991691c914f7f7c8444cd3dbaa733566a7a72b0ae35ebb08153d52c` |
| `public/icons/badge-72.png` | `02196430dbbbb160a48e4de57782811fdf95486a0de1ea491c364e2ed85ec5c3` |
| `public/screenshots/ingreso-narrow.png` | `79cba346f3ac7fd8f93846af85d5460c76e66957f3910e4e8bc6719419d0a0e9` |
| `public/screenshots/inicio-narrow.png` | `aa0f6826301706c9059611da3f80358ee0d100f7c858a5b4994a20c40c81f2bb` |
| `public/screenshots/inicio-wide.png` | `4ca3d4adfd3ac62d51b76a79a6ea7dd6b1ca2cb6a89be7e74acbfd7c3b7cfc0a` |

Los diez están en `tests/unit/guards/marca-velox-sin-anterior.guardia.test.ts`.

## Tareas

| Tarea | Hecho | Commit |
|---|---|---|
| T1 fuente única `lib/marca/identidad.ts` | `MARCA` + `LOGO`; test con literales de contrato y `MARCA.nombre === DATOS_LEGALES.marca`. Mutar `colorTema` → rojo (medido). | `c6351e47` |
| T2 copiar archivos | 3 SVG a `public/marca/`, `icon-maskable.svg`, `app/favicon.ico`, `app/icon.svg`; `app/icon.png` borrado. Guardia byte a byte; un byte de más en una copia → rojo (medido). | `f193ee8b` |
| T3 PNG PWA + badge | `icon-any.svg` = `icono-maskable.svg` con `rx="108"`; script ampliado con `badge-72.png` (alfa del símbolo sobre blanco, RGBA). Guardia nueva; restaurar el `icon-192.png` viejo → rojo (medido). | `662f97b8` |
| T4 manifiesto, `<head>`, `offline.html`, `sw.js` | Los 5 campos del manifiesto; layout desde `MARCA`; `offline.html` título + theme-color; `sw.js` una línea (`TITULO_RESERVA`). Guardia nueva (incluye render real del layout); `short_name` mutado → rojo (medido). | `555782d1` |
| T5 `Logo` | Prop `fondo` (`oscuro`/`claro`/`tema`), raíz `role="img"` con un solo nombre, `<img alt="" aria-hidden>`. `src` de `claro` mutado → rojo (medido). | `340fc63d` |
| T6 consumidores | Sidebar (oscuro + símbolo colapsado), login/recuperar/postulación (panel oscuro, móvil tema), paquete (tema), LandingNav (`aria-label` «Velox Courier — inicio»), LandingFooter (oscuro, rama `marca` intacta). Guardia de variante por fondo; `paquete` a `oscuro` → rojo (medido). | `4ff8bc9c` |
| T7 etiqueta | `ROTULO_GUIA = "VELOX · GUÍA"` + comentarios. Test propio (no se editó ningún test de R17). | `c875e134` |
| T8 informes PDF | Tránsito y picking desde `MARCA.nombre`; sello del picking reutiliza `ROTULOS_HELVETICA.marca`. | `358ab439` |
| T9 correo | `DEFAULT_FROM_NAME = MARCA.nombre`; comentarios. | `8779b73e` |
| T16 soporte | `DEFAULT_SUBJECT = "mailto:battos.sa@gmail.com"`. `pwa-push.guardia` no afirmaba el defecto (sus `ordenex.co` son hostnames de prueba): sin tocar en esa parte. | `a4561024` |
| T10 API docs | `/api-docs` `<title>` y `info.title` desde `MARCA.nombre`; YAML a mano. | `e585210d` |
| T11 guía | `<title>`, autor, `@bottom-left`, portada, `<h1>`, logo de portada; README. PDF generado (ver abajo). | `ea60a2d8` |
| T12 fotos landing | Solo lectura (abajo). | — |
| T13a capturas | Rehechas con Playwright (abajo); hashes viejos añadidos a la guardia de T3. | `16c7c881` |
| T13 gate + guardias | Abajo. | — |
| T14 ver la app | Abajo. | — |

## Mapa R → test

| R | Test(s) que lo ponen rojo |
|---|---|
| R1 | `tests/unit/marca/identidad.test.ts`; `marca-velox-identidad.guardia` («el layout lee las metas de la fuente única») |
| R2 | `tests/unit/guards/marca-velox-identidad.guardia.test.ts` (manifiesto, `offline.html`, `sw.js` contra `MARCA`) |
| R3 | `tests/unit/guards/marca-velox-archivos.guardia.test.ts` (6 copias byte a byte) |
| R4 | `marca-velox-identidad.guardia` (literales) + `pwa-manifiesto-atajos.guardia` «conserva sus diez claves» (actualizado) |
| R5 | `marca-velox-identidad.guardia` (id, start_url, scope, display, orientation, categories, sin shortcuts, iconos literales) + `pwa-manifiesto-atajos.guardia` + `tests/unit/pwa/manifest.test.ts` |
| R6 | `marca-velox-identidad.guardia` «metadata y el `<head>` pintado…» (importa y renderiza `app/layout.tsx`) |
| R7 | `tests/unit/guards/marca-velox-sin-anterior.guardia.test.ts` (hash + píxel `(⌊w/2⌋, ⌊w/64⌋)` = `#011027` opaco en los 5 iconos) |
| R8 | `marca-velox-archivos.guardia` (`app/icon.png` no existe; únicos iconos de pestaña `favicon.ico` + `icon.svg`) + `marca-velox-sin-anterior.guardia` |
| R9 | `marca-velox-sin-anterior.guardia` (RGBA tipo 6, todo visible blanco, ≥ 5 % visible, hash distinto) + `pwa-push.guardia` 410/D8 |
| R10 | `tests/unit/guards/pwa-push.guardia.test.ts` (3 casos de reserva, ahora «Velox Courier»); `marca-velox-identidad.guardia` (sw.js) |
| R11 | `marca-velox-identidad.guardia` (offline.html) |
| R12 | `tests/components/Logo.test.tsx` (10 casos) |
| R13 | `tests/components/Sidebar.test.tsx` «Sidebar marca (feature 492, R13)» + `marca-velox-logo-por-fondo.guardia` |
| R14 | `tests/components/LoginPage.test.tsx` «logo de Velox Courier por fondo» + `tests/unit/guards/marca-velox-logo-por-fondo.guardia.test.ts` (login, recuperar, postulación, paquete) |
| R15 | `tests/components/LandingPage.test.tsx` R2 (logo por rol + enlace «Velox Courier — inicio»), `tests/components/LandingFooter.test.tsx` (sin `marca` → logo; con `marca` intacto), `marca-velox-logo-por-fondo.guardia` |
| R16 | `tests/unit/pdf/etiquetas-rotulo-marca-492.test.ts` (literal, en todas las hojas, Helvetica-Bold, sin `setTextColor`) |
| R17 | SIN editar y en verde: `tests/unit/pdf/etiquetas-capacidad.test.ts`, `etiquetas-diseno-353.test.ts`, `etiquetas-caracter-no-cubierto.test.ts`, `tests/unit/components/etiquetas-pdf.test.ts`, `tests/unit/guards/etiquetas-maqueta-unica.guardia.test.ts` |
| R18 | `tests/unit/pdf/informe-transito-pdf.test.ts` (pie actualizado + caso nuevo «sin Ordenex»), `tests/unit/whatsapp-envios/picking-pdf.test.ts` (3 literales actualizados + describe nuevo) |
| R19 | `tests/unit/config/email-marca.test.ts` (literales + describe nuevo: cabecera y pie del correo compuesto), `tests/unit/config/email-config.test.ts:102` |
| R20 | `tests/unit/api/openapi-titulo-marca.test.ts` |
| R21 | `tests/unit/docs/guia-integracion-marca.test.ts` |
| R22 | `marca-velox-sin-anterior.guardia` (hashes de las capturas) + `tests/unit/pwa/manifest.test.ts` (nombres, tamaños, form_factor) + `pwa-manifiesto-atajos.guardia` (3 capturas) |
| R23 | `tests/unit/config/push-config.test.ts` (defecto y caso nuevo sin/blanco); grep de `soporte@ordenex.co` sobre los 63 archivos de la rama: vacío |

## Tests actualizados (ninguno borrado)

- `tests/components/Logo.test.tsx`: los 4 casos del wordmark de texto (feature 86) transformados al logo-imagen; 4 → 10 casos.
- `tests/components/LandingPage.test.tsx` R2: busca el logo por rol y nombre y el enlace «Velox Courier — inicio»; resto igual (13 casos).
- `tests/components/LandingFooter.test.tsx`: caso «sin `marca`» al logo; caso «con `marca`» sin tocar (6 casos).
- `tests/components/Sidebar.test.tsx` (+1), `tests/components/LoginPage.test.tsx` (+1): casos nuevos, existentes intactos.
- `tests/unit/guards/pwa-manifiesto-atajos.guardia.test.ts`: los 5 valores de R4 en «diez claves».
- `tests/unit/guards/pwa-push.guardia.test.ts`: 3 literales del título de reserva.
- `tests/unit/pdf/informe-transito-pdf.test.ts` (+1), `tests/unit/whatsapp-envios/picking-pdf.test.ts` (+2).
- `tests/unit/config/email-marca.test.ts` (+2), `tests/unit/config/email-config.test.ts` (1 literal).
- `tests/unit/config/push-config.test.ts` (1 literal, +1).

## T13 — Verificación

- **Gate `./init.sh --rapido`: VERDE.** Log `progress/gate_492_1.log` (en el worktree, sin commitear
  como el resto de logs del repo), `INIT_EXIT=0` escrito dentro. typecheck ✓, lint ✓ (solo
  warnings previos), relacionados 556 archivos / 6995 tests (26 skipped: 17 en
  `AnaliticaPage.test.tsx` y 9 en `AnaliticaShell.test.tsx`, preexistentes, los mismos que en
  `tests/components` antes del cambio), guardias 278 / 3813. «Sin rojos nuevos (0 de 820)». La
  integración `tests/integration/db` corrió (no saltada).
- **Guardias a mano** (T13): `pwa-*`, `marca-velox-*`, `tests/unit/pwa/manifest.test.ts`, `html-lang`,
  `etiquetas-maqueta-unica`, `guia-integracion-marca`, `marca/`, las 4 de R17 y
  `paginas-legales-estaticas`: 20 archivos / 317 tests verdes. Log `progress/guardias_492.log`.
- `git diff --stat origin/dev -- app/globals.css`: vacío.
- **Build: NO VERIFICABLE en este worktree.** `pnpm exec next build` (Turbopack) aborta con
  `Symlink [project]/node_modules is invalid, it points out of the filesystem root`: Turbopack no
  acepta el junction de `node_modules` hacia el checkout principal (log `progress/build_492.log`).
  Con `next build --webpack` compila («Compiled successfully in 74s») y cae en el type check de
  `.next/types/app/(app)/historico/acciones/page.ts` (`PageProps`), archivo que esta rama no toca
  (log `progress/build_492_webpack.log`): es del modo webpack, no de la ficha. **Abierto para el
  leader:** mirar el build de Vercel del PR (`gh pr checks`) antes de mergear.
- Lo mismo obligó a levantar el dev server con `next dev --webpack -p 3492` (Turbopack cae igual).

## T11 — PDF de la guía

`python docs/api/guia-integracion/generar-pdf.py <scratchpad>/guia-492.pdf`: «JSON: 17 bloques
válidos», 28 páginas, sin error. Portada renderizada: logotipo Velox (VELOX azul marino, COURIER
naranja) arriba a la izquierda, debajo «DOCUMENTACIÓN TÉCNICA» y «Guía de integración / API de
Velox Courier». Pie de las páginas interiores: «Guía de integración — API de Velox Courier». El PDF
no se commitea.

## T3 — Revisión visual de los PNG

Hoja de contacto de los 5 iconos + badge: los `any` (192, 512) con esquina redondeada y fondo
`#011027`; los maskable y el 180 a sangre; símbolo (ala plateada + check naranja) centrado. El badge
sobre gris: silueta blanca del ala y el check, legible.

## T12 — Fotos de la landing (solo lectura, P8)

`public/landing/{hero-bodega,logistica,mensajera,paquetes}.jpg`: bodegas con estanterías, un
pasillo de almacén y una vista aérea de un centro logístico. Ninguna muestra «Ordenex» ni otra
marca legible. No se sustituye nada.

## T13a — Capturas (R22)

Playwright contra `next dev --webpack -p 3492`, `nextjs-portal` oculto, tema claro, DPR 1:
`inicio-narrow.png` 540×1170 (`/`), `ingreso-narrow.png` 540×1170 (`/login`), `inicio-wide.png`
1280×720 (`/`). Revisadas a ojo: logo Velox en la barra de la landing y en la cabecera móvil del
login, sin indicador de Next. El manifiesto no cambió.

## T14 — Ver la app (Playwright, mediciones)

- `/login` escritorio (1280): panel navy con el logo oscuro 132×30 cargado; la cabecera móvil
  (variante tema) oculta. Móvil (390): logo 110×25, en claro `logo-horizontal-fondo-claro.svg`
  visible y el oscuro `display:none`; en `.dark` al revés.
- `/` escritorio y móvil, claro y oscuro: dos logos (barra y pie) con el logotipo original,
  cargados, nombre accesible «Velox Courier».
- `/paquete/485323030` (con sesión admin, escritorio y móvil): variante tema 99×23, conmuta con
  `.dark`.
- Barra lateral expandida (claro y oscuro): logo 88×20 en (12,18); botón de colapso 28×28 en
  (241,42): **sin solape**. Colapsada: símbolo 32×32 en (7.5,12), `alt="Velox Courier"`, opacidad 1,
  cargado; botón «Expandir menú» 28×28 en (33,42): las cajas se tocan 6.5×2 px en la esquina
  inferior derecha del símbolo, que es transparente ahí. Es la misma geometría (`size-8`
  centrado) que tenía el icono anterior; no se cambió.
- `<head>`: `theme-color #011027`, `apple-mobile-web-app-title Velox`, descripción de `MARCA`,
  `<link rel="icon" href="/favicon.ico?…" type="image/x-icon">` y `<link rel="icon" href="/icon.svg?…"
  type="image/svg+xml">`; ningún `icon.png`. `/favicon.ico` 200 `image/x-icon` 13 942 B;
  `/icon.svg`, `/marca/*.svg`, `/icons/*.png` 200.
- `/api-docs`: título «Velox Courier — API de integración por API key».
- `/manifest.json`: `Velox Courier` / `Velox` / descripción / `#011027` ×2.
- Etiqueta: `buildEtiquetasLotePdf` (el generador del lote) en 100×100 —la hoja más pequeña del
  catálogo— con el caso de evidencia y con el lote de 8 casos del corpus 282: «VELOX · GUÍA»
  arriba a la izquierda en negrita negra, número de guía debajo, QR a la derecha, nada recortado;
  8 páginas, 8 «VELOX», 0 «ORDENEX».
- Capturas en el scratchpad de la sesión (`…/scratchpad/t14/`), no se commitean.
- **Base local:** los 3 inicios de sesión de `admin.qa@ordenex.test` dejaron 3 filas en
  `login_attempt` y 3 en `"Session"`; borradas (recuento posterior 0). El aviso SINPE se cerró con
  «Ahora no», que solo escribe en `localStorage`. No se creó nada más.

## Abierto / acciones del humano

1. **Build de Vercel** (arriba): verificarlo en el PR; aquí no se puede correr Turbopack.
2. **Variables de Vercel por entorno** (design §4), fuera del código:
   - `SMTP_FROM_NAME`: si vale «Ordenex», cambiar a «Velox Courier» o borrar (R19 no se ve si no).
   - `SMTP_FROM`: comprobar Preview (Production ya es `no-reply@velox-courier.company` según P5).
   - `VAPID_SUBJECT`: si vale `soporte@ordenex.co`, cambiar a `mailto:battos.sa@gmail.com` o borrar.
   - `NEXT_PUBLIC_SITE_URL`: dominio de producción vigente (`https://velox-courier.company`); es del traspaso.
3. **Para la 493 (prosa, fuera de esta ficha):** las `label` de las capturas del manifiesto
   («Pantalla de inicio de Ordenex», «Inicio de sesión en Ordenex», «Ordenex en escritorio») se ven
   en el diálogo de instalación; el `<meta name="description">` de la guía de integración («…canal
   por API key de Ordenex…»); el comentario de cabecera del YAML («(Ordenex)»). Ninguno está en
   R1–R23, así que no se tocaron.
4. iOS no refresca el icono de una PWA ya añadida (design §3.4, limitación conocida).

## Ronda 2 — correcciones de la revisión (`progress/review_492.md`, RECHAZADA)

Partida: HEAD `4990cde6` (merge de `origin/dev` `0ddaa782` + informe del reviewer), confirmado con `git log --oneline -3`.

| Hallazgo | Arreglo | Commit |
|---|---|---|
| M1 | `EtiquetaGuia.tsx`: la vista previa del modal pinta `{ROTULO_GUIA}` importado de `lib/pdf/etiquetas-dibujo` (antes «Ordenex · Guía» copiado a mano). Caso nuevo en `tests/components/EtiquetaGuia.test.tsx`: literal «VELOX · GUÍA» + igual a `ROTULO_GUIA` + sin «Ordenex». | `a17bf74a` |
| m1 | `public/manifest.json`: las 3 `label` de las capturas con «Velox Courier». Caso nuevo en `tests/unit/pwa/manifest.test.ts` con `toEqual` literal de `[src, label]`. | `fddbff5c` |
| B2 | Guardia nueva `tests/unit/guards/marca-velox-sin-literal.guardia.test.ts`. Recorre una lista cerrada de 15 archivos: los 9 que leen `MARCA`/`LOGO` tienen que importar de `@/lib/marca/identidad`, y los 6 que pintan la marca vía `<Logo>`/`ROTULO_GUIA` no la escriben. Sin comentarios (`quitarComentarios`) y con CRLF normalizado, prohíbe `velox` (cualquier caja, lo que incluye nombre, nombre corto y rótulo), `#011027`, `/marca/logo-` y el arranque de la descripción. También exige que la vista previa tome `{ROTULO_GUIA}`. Lleva autocomprobación: el literal en código da hallazgo, el mismo texto en un comentario (también `{/* */}` y CRLF) no. | `6327d5fa` |
| B1 | `specs/492-marca-velox-identidad/tasks.md`: las 18 tareas `[x]`, con nota de una línea en T14 (dev server `--webpack`, etiqueta generada con `buildEtiquetasLotePdf`). | `6dddfc8a` |

m2 y m3 (meta description de la guía, comentario del YAML) quedan para la 493, por decisión del leader.

### Mutaciones medidas (aplicar → `git diff --numstat` = 1/1 → correr → `git checkout --` → árbol limpio)

| # | Mutación | Test | Resultado |
|---|---|---|---|
| X7 | `transito/pdf.ts` `l.texto("Velox Courier", …)` en vez de `MARCA.nombre` | `marca-velox-sin-literal.guardia` | ROJO (1 de 26) |
| X8 | `api-docs/route.ts` `<title>Velox Courier — API…` en vez de `${MARCA.nombre}` | `marca-velox-sin-literal.guardia` | ROJO (1 de 26) |
| X7 + CRLF | X7 con el archivo entero en CRLF | `marca-velox-sin-literal.guardia` | ROJO (1 de 26) |
| X17 | `EtiquetaGuia.tsx` `VELOX · GUÍA` escrito a mano en vez de `{ROTULO_GUIA}` | guardia + `EtiquetaGuia.test.tsx` | ROJO (2 de 35, los dos de la guardia) |
| X18 | `EtiquetaGuia.tsx` vuelto a «Ordenex · Guía» | `EtiquetaGuia.test.tsx` | ROJO (1 de 9) |
| X19 | `manifest.json` con las `label` viejas (stash) | `tests/unit/pwa/manifest.test.ts` | ROJO (1 de 22) |

### Gate

`./init.sh --rapido` **VERDE**. Log `progress/gate_492_2.log`, con `INIT_EXIT=0` dentro. `.env` copiado del checkout principal y borrado al acabar.
- typecheck ✓.
- Relacionados: 558 archivos, 7044 tests. Los 26 skipped son los de siempre: 17 en `AnaliticaPage` y 9 en `AnaliticaShell`.
- Guardias: 279 archivos, 3839 tests; la guardia nueva va incluida.
- 0 rojos nuevos sobre 822 archivos.

A mano: `pwa-*`, `marca-velox-*`, `manifest`, `html-lang`, `etiquetas-maqueta-unica`, `guia-integracion-marca` y `EtiquetaGuia`. Son 15 archivos y 209 tests, todos en verde. Build: el de Vercel del PR #876 salió verde según el leader, así que no lo repetí.
