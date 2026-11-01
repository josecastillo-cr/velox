# 492 — Marca Velox Courier: identidad visual · design

> Búsqueda de código: el MCP `codebase-memory` no conectó en esta sesión (timeout). El inventario
> de abajo se hizo con `grep`/`glob` sobre el árbol de `dev` del 2026-11-01 y cada punto se confirmó
> leyendo el archivo real.

## 0. Resumen

Sin base de datos, sin migraciones, sin rutas nuevas. La ficha es: un módulo con la fuente única de
la marca, copiar unos archivos de `docs/marca/velox/` a sitios servidos, regenerar los PNG de la PWA
con el script que ya existe, cambiar el componente `Logo` de texto a imagen y repasar los literales
de identidad (manifiesto, `<head>`, `offline.html`, `sw.js`, etiqueta, informes, correo, API docs,
guía). Los nombres de archivo públicos de los iconos **no cambian**: la app instalada se actualiza en
vez de duplicarse, y las guardias de la PWA (284, 410, 164) siguen valiendo.

## 1. Inventario verificado

| Superficie | Archivo | Hoy | Cambio |
|---|---|---|---|
| Favicon | `app/icon.png` | monograma «ex» | se borra; entran `app/favicon.ico` y `app/icon.svg` (§3.2) |
| Iconos PWA | `public/icons/icon-{192,512}.png`, `icon-{192,512}-maskable.png`, `icon-180.png` | generados desde `public/icons/fuente/icon-{any,maskable}.svg` por `scripts/generate-pwa-icons.mjs` | fuentes nuevas, mismo script, mismos nombres (§3.3) |
| Badge push | `public/icons/badge-72.png` | glifo blanco viejo | silueta blanca del símbolo (§3.3) |
| Iconos KPI | `public/icons/icono_*.png` | iconos de función, no de marca | **no se tocan** |
| Manifiesto | `public/manifest.json` | `Ordenex`, `#0d2444` / `#f7f8fc` | §3.4 |
| `<head>` | `app/layout.tsx` | `title`/`description` Ordenex, `theme-color` `#0d2444`, `apple-mobile-web-app-title` Ordenex | §3.4 |
| Offline | `public/offline.html` | `<title>Ordenex — Sin conexión</title>`, `theme-color` `#0d2444` | §3.4; sin logo (§5) |
| Service worker | `public/sw.js` | `TITULO_RESERVA = "Ordenex"`; `ICONO`/`BADGE` por ruta; precache `/` y `/offline.html` | solo `TITULO_RESERVA` (§3.5) |
| Wordmark | `components/shared/Logo.tsx` | texto «Orden» + «ex» naranja | imagen con variantes (§3.6) |
| Consumidores de `Logo` | `Sidebar.tsx`, `LandingNav.tsx`, `LandingFooter.tsx`, `login/page.tsx`, `recuperar-contrasena/page.tsx`, `postulacion/page.tsx`, `paquete/[numGuia]/page.tsx` | `<Logo className=…>` | prop `fondo` (§3.6) |
| Icono de la barra colapsada | `Sidebar.tsx:308` | `<img src="/icons/icon-192.png" alt="Ordenex">` | símbolo (§3.6) |
| Etiqueta | `lib/pdf/etiquetas-dibujo.ts:86` `ROTULO_GUIA = "ORDENEX · GUÍA"` (+ comentarios en `:369` y `etiquetas-maqueta.ts:117`) | texto | §3.7 |
| Informe de tránsito | `lib/whatsapp-envios/informes/transito/pdf.ts:204` y `:368` | `"Ordenex"` y sello `Ordenex · Informe de tránsito · …` | §3.8 |
| Picking | `lib/whatsapp-envios/informes/picking/pdf.ts:114` y `:522` | `marca: "Ordenex · Picking"` y sello | §3.8 |
| Correo | `lib/config/email.ts:23` `DEFAULT_FROM_NAME = "Ordenex"`; `plantillas/base-codigo.ts` usa la marca resuelta | §3.9 |
| API docs | `app/api-docs/route.ts:12`, `lib/api/openapi-spec.ts:117`, `docs/api/api-key-openapi.yaml:6` | `Ordenex — API de integración por API key` | §3.10 |
| Guía integración | `docs/api/guia-integracion/guia-integracion.html` (`:5`, `:6`, `:41`, `:175`, `:219`) | título, autor, pie, portada | §3.11 |
| Capturas | `public/screenshots/{inicio,ingreso}-narrow.png`, `inicio-wide.png` | marca vieja | §3.12, depende de P3 |
| Errores | `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx` | **sin marca** (verificado) | ninguno |

Lo que **no** es de esta ficha y se ha visto en el inventario: prosa «Ordenex» de la UI (493),
`ordenex:*` como identificadores (se quedan), `ordenex.co` y `soporte@ordenex.co` (P5/P6). No hay ni
un enlace clicable a `ordenex.co` en `app/`, `components/` ni `public/`: solo aparece en
comentarios, en ejemplos de documentación y como `DEFAULT_SUBJECT` de VAPID, que no se ve.

## 2. Modelo de datos

Ninguno. Sin tablas, sin RLS, sin migraciones. El gate es `./init.sh --rapido` sin la ampliación de
`tests/integration/db` (no toca dinero ni datos).

## 3. Decisiones

### 3.1 Fuente única: `lib/marca/identidad.ts` (R1)

```ts
export const MARCA = {
  nombre: "Velox Courier",
  nombreCorto: "<P1>",                       // ≤ 12 caracteres
  descripcion: "<P4>",                       // propuesta: "Plataforma de logística y entregas Velox Courier"
  colorTema: "#011027",
} as const;

export const LOGO = {
  sobreOscuro: "/marca/logo-horizontal.svg",
  sobreClaro: "/marca/logo-horizontal-fondo-claro.svg",
  simbolo: "/marca/logo-simbolo.svg",
} as const;
```

Sin dependencias, importable desde servidor y cliente. **Relación con la 493:** su descripción dice
«centralizar el nombre de marca en una constante». Esta ficha crea esa constante porque la necesita
para sus propios consumidores; la 493 la reutiliza y la amplía, no crea otra. Queda anotado para el
spec de la 493.

`app/_legal/datos-legales.ts` (`DATOS_LEGALES.marca = "Velox Courier"`, feature 490) **no** se toca:
es un dato legal que puede valer `null` y tiene su propia guardia. Un test afirma que
`MARCA.nombre === DATOS_LEGALES.marca` para que no diverjan sin que nadie lo vea.

### 3.2 Archivos que se copian (R3, R8)

`docs/marca/velox/` no se sirve. Se copian, **sin renombrar el archivo** cuando el destino es
`public/marca/`, para que el README («si llega el archivo del diseñador se reemplazan con los mismos
nombres») siga siendo cierto:

| Origen (`docs/marca/velox/`) | Destino | Uso |
|---|---|---|
| `svg/logo-horizontal.svg` | `public/marca/logo-horizontal.svg` | logo sobre fondo oscuro |
| `svg/logo-horizontal-fondo-claro.svg` | `public/marca/logo-horizontal-fondo-claro.svg` | logo sobre fondo claro |
| `svg/logo-simbolo.svg` | `public/marca/logo-simbolo.svg` | barra colapsada |
| `svg/icono-maskable.svg` | `public/icons/fuente/icon-maskable.svg` | fuente de los PNG maskable y 180 |
| `favicon.ico` | `app/favicon.ico` | Next lo sirve en `/favicon.ico` |
| `svg/favicon.svg` | `app/icon.svg` | Next declara `<link rel="icon" type="image/svg+xml">` |

`app/icon.png` se **borra** (si convive con `icon.svg`, Next declara los dos y el navegador puede
quedarse con el viejo). `logo-negro.svg`, `logo-horizontal-blanco.svg` y los PNG de `docs/` no se
copian: nadie los usa en esta ficha.

El `middleware.ts` (matcher de la línea 150) ya deja pasar sin sesión `favicon.ico` y cualquier
`.svg`/`.png`, así que `/marca/*.svg` y `/favicon.ico` se sirven en páginas públicas sin tocarlo.

Una guardia (`tests/unit/guards/marca-velox-archivos.guardia.test.ts`) compara byte a byte cada
destino con su origen: si mañana llega el archivo del diseñador y alguien reemplaza `docs/` sin
volver a copiar, se pone rojo.

### 3.3 PNG de la PWA y badge: el script existente (R7, R9)

`scripts/generate-pwa-icons.mjs` ya rasteriza con `sharp` desde dos vectores y rechaza un vector con
`<text>` (los de `docs/marca/velox/svg/` son todo trazados, comprobado). Se reutiliza:

- `public/icons/fuente/icon-maskable.svg` ← copia de `icono-maskable.svg` (512, fondo `#011027` a
  sangre, símbolo al 66 %). Salen `icon-192-maskable.png`, `icon-512-maskable.png` e `icon-180.png`
  (iOS, a sangre), como hoy.
- `public/icons/fuente/icon-any.svg` ← **vector nuevo**, mismo contenido que `icono-maskable.svg`
  pero con el `<rect>` de fondo con `rx="108"` (el radio que ya usaba el `any` de la 284). Salen
  `icon-192.png` e `icon-512.png` con la esquina transparente, que es lo que exige la guardia de la
  284. Se descarta usar los `logo-simbolo-*.png` transparentes de `docs/` como `any`: el README avisa
  de que el símbolo «es débil sobre blanco», y el diálogo de instalación de Chrome pinta el `any`
  sobre blanco.
- `badge-72.png`: salida nueva del script desde `logo-simbolo.svg` → silueta: se toma el canal alfa
  del render y se compone sobre blanco puro (RGBA, tipo de color 6). Android solo usa el alfa.

Los nombres y tamaños no cambian, así que `manifest.json`, `sw.js` (`ICONO`, `BADGE`) y
`app/layout.tsx` (`apple-touch-icon`) siguen apuntando a lo mismo.

Los comentarios del script que hablan del monograma «ex» se actualizan; el historial de la 284 que
explica por qué hay dos vectores se conserva.

### 3.4 Manifiesto, `<head>` y `offline.html` (R2, R4, R5, R6, R11)

- `public/manifest.json`: `name`, `short_name`, `description`, `theme_color`, `background_color`.
  Nada más. `id: "/"` es lo que hace que la app ya instalada se actualice en vez de aparecer dos
  veces (guardia de la 284).
- `app/layout.tsx`: `metadata.title = MARCA.nombre`, `metadata.description = MARCA.descripcion`,
  `<meta name="theme-color" content={MARCA.colorTema} />`,
  `<meta name="apple-mobile-web-app-title" content={MARCA.nombreCorto} />`. Las metas de capacidad y
  el `apple-touch-icon` no se tocan (la guardia de la 284 las lee como texto literal).
- `public/offline.html`: `<title>` y `theme-color`. Sus colores propios (botón naranja `#f26419`,
  fondo `#f7f8fc`) son de la UI y se quedan.

Como estos tres no pueden importar `MARCA`, la guardia `marca-velox-identidad.guardia.test.ts`
importa `MARCA` y compara con lo escrito en cada archivo (R2).

Limitación conocida, no requisito: iOS no refresca el icono de una PWA ya añadida a la pantalla de
inicio; hay que quitarla y volver a añadirla. Android (WebAPK) sí la actualiza al detectar el
manifiesto nuevo, y puede pedir confirmación al usuario por cambiar nombre e icono.

### 3.5 `sw.js` (R10, R11)

Solo cambia `TITULO_RESERVA` → el nombre de marca. Efecto buscado además: `offline.html` se
precachea **en el `install`** (`cache.addAll(PRECACHE_URLS)`, línea 234) en `pages-cache-v2`. Si
`sw.js` no cambiara ni un byte no habría `install` y los teléfonos seguirían sirviendo el
`offline.html` viejo para siempre. Con `TITULO_RESERVA` cambiado hay SW nuevo, que vuelve a precachear
y sobrescribe la entrada. **No** se suben los nombres de caché (`-v2` → `-v3`): no hace falta purgar
nada y subirlos tira la caché de estáticos de todo el mundo.

Ni `ICONO` ni `BADGE` cambian de ruta. El SW no cachea `/icons/` (solo `/_next/static/` y las
navegaciones), así que los PNG nuevos llegan sin más.

### 3.6 `Logo` y sus consumidores (R12–R15)

```tsx
type FondoLogo = "oscuro" | "claro" | "tema";
interface LogoProps { fondo?: FondoLogo; className?: string }   // por defecto "oscuro"
```

- Raíz: `<span role="img" aria-label={MARCA.nombre} className={cn("inline-flex", className)}>`.
  Dentro, una o dos `<img alt="" aria-hidden>` con `h-[1.25em] w-auto`: el alto sigue al
  `font-size` que ya pasa cada consumidor (`text-xl`, `text-lg`, `text-base`, el `text-2xl` por
  defecto), así que los tamaños relativos entre pantallas se conservan sin tocar sus clases.
- Un solo nombre accesible venga una o dos imágenes: en la variante `tema` las dos están en el DOM y
  un lector no debe oír la marca dos veces.
- `oscuro` → `LOGO.sobreOscuro`. `claro` → `LOGO.sobreClaro`. `tema` → `LOGO.sobreClaro` con
  `dark:hidden` + `LOGO.sobreOscuro` con `hidden dark:inline-block` (el variant `dark` de
  `globals.css` mira a un ancestro `.dark`/`.tema-sistema`, el mismo que hace girar `bg-background`).
- `<img>` y no `next/image`: los SVG exigen `dangerouslyAllowSVG` en `next/image` y el repo ya sirve
  así los PNG de `KpisMensajero` (con su `eslint-disable-next-line @next/next/no-img-element`, que se
  copia).
- El logo es un SVG con relación ~4,4:1 (viewBox 572 × 129,75) y fondo transparente.

| Consumidor | Fondo real | Variante |
|---|---|---|
| `Sidebar.tsx` (expandida) | `--sidebar` `#0d2444` / oscuro `#071627` | `oscuro` |
| `LandingNav.tsx`, `LandingFooter.tsx` | `bg-navy-deep` | `oscuro` |
| `login`, `recuperar-contrasena`, `postulacion` — panel de escritorio | `bg-navy` fijo | `oscuro` |
| `login`, `recuperar-contrasena`, `postulacion` — cabecera móvil | `bg-background`, gira con el tema | `tema` |
| `paquete/[numGuia]` | tokens de tema | `tema` |

Los `className` de color (`text-white`, `text-foreground`, `text-sidebar-foreground`) dejan de
tener efecto sobre el logo; se quitan donde solo servían para eso y se conservan los de tamaño y
posición (en `Sidebar.tsx`, el `absolute left-3 …` y la transición de opacidad del colapso).

`Sidebar.tsx`, icono colapsado: `src={LOGO.simbolo}`, `alt={MARCA.nombre}`, sin `rounded-md` (el
símbolo es transparente; el redondeo era del PNG con fondo).

`LandingNav.tsx`: `aria-label={`${MARCA.nombre} — inicio`}`.

`LandingFooter.tsx`: `<Logo fondo="oscuro" />`; la rama `marca` (páginas legales, feature 490) no se
toca.

**Tests que se actualizan, no se borran** (memoria «el test que vive dentro de lo que borras»):
`tests/components/LandingPage.test.tsx` (R2 de la 86 buscaba el `span.font-heading` «Ordenex»; pasa
a buscar `getAllByRole("img", { name: "Velox Courier" })`; el resto del caso —«Ingresar», las
cuatro anclas— se queda igual) y `tests/components/LandingFooter.test.tsx` (el caso «sin `marca`
pinta el wordmark» pasa a afirmar el logo por rol y nombre; el caso «con `marca`» no cambia).

### 3.7 Etiqueta (R16, R17)

`ROTULO_GUIA` cambia de texto (P2) y **no** se deriva de `MARCA`: es un literal en mayúsculas con
forma propia y un test lo fija como contrato literal (no contra su fuente). Sigue siendo Helvetica
negrita (todo Latin-1, `exigirRotuloEscribible` lo comprueba) y negro: la térmica imprime negro puro.

El rótulo de marca **también fija el cuerpo de todos los rótulos diminutos** (`cuerpoRotulo`,
`etiquetas-dibujo.ts:408`, compartido con PARA/CONTENIDO/TIENDA). Por eso R17 se comprueba con las
pruebas que ya existen y **no se editan**: `tests/unit/pdf/etiquetas-capacidad.test.ts` (capacidad
declarada por hoja), `tests/unit/pdf/etiquetas-diseno-353.test.ts` (posición del rótulo, `8.82`) y
`tests/unit/components/etiquetas-pdf.test.ts`. Si con el texto elegido alguna se pone roja, no se
«ajusta el número»: se vuelve al spec.

### 3.8 Informes PDF (R18)

Texto, no imagen: `transito/pdf.ts` → `l.texto(MARCA.nombre, …)` y sello
`${MARCA.nombre} · Informe de tránsito · …`; `picking/pdf.ts` →
`ROTULOS_HELVETICA.marca = `${MARCA.nombre} · Picking``, y el sello igual. «Velox Courier» es
Latin-1, así que pasa la prueba que recorre `ROTULOS_HELVETICA`. Se actualizan los literales de
`tests/unit/pdf/informe-transito-pdf.test.ts:193` y `tests/unit/whatsapp-envios/picking-pdf.test.ts`
(`:152`, `:194`, `:206`), que siguen siendo literales (son el contrato), no `MARCA.nombre`.

### 3.9 Correo (R19)

`DEFAULT_FROM_NAME = MARCA.nombre` en `lib/config/email.ts` y los comentarios «o "Ordenex"». La
plantilla (`base-codigo.ts`) ya usa la marca resuelta: no cambia ni su HTML ni sus colores. Tests:
`tests/unit/config/email-marca.test.ts` y `tests/unit/config/email-config.test.ts:102` pasan a
«Velox Courier» literal.

### 3.10 API docs (R20)

`app/api-docs/route.ts` `<title>` y `lib/api/openapi-spec.ts` `info.title` desde `MARCA.nombre`; el
espejo `docs/api/api-key-openapi.yaml:6` a mano. No se añade `<link rel="icon">`: el navegador pide
`/favicon.ico` solo y ahora lo sirve `app/favicon.ico`. Los ejemplos con `ordenex.co` no se tocan
(P6).

### 3.11 Guía de integración (R21)

`<title>`, `<meta name="author">`, `@bottom-left` del `@page`, el `.cover .title` y el `<h1>` con
«Velox Courier». Logo en la portada: `<img src="../../marca/velox/svg/logo-horizontal-fondo-claro.svg">`
encima del bloque del título (el PDF se imprime con Chrome headless desde el archivo, así que la ruta
relativa resuelve). La prosa del cuerpo y la «Base URL» se quedan (P6, P7). El README de la carpeta
cambia el nombre de ejemplo del PDF.

### 3.12 Capturas (R22)

Según P3. Recomendado: rehacer las tres con Playwright contra el servidor local, mismos nombres y
tamaños (540×1170 ×2, 1280×720), ocultando `nextjs-portal` como hizo la 164. Si se quitan, además
cambian `tests/unit/pwa/manifest.test.ts` y el caso «diez claves» de la guardia de la 284.

### 3.13 Cómo se prueba «ya no es la marca anterior»

Para R7, R8, R9 y R22 la guardia `marca-velox-sin-anterior.guardia.test.ts` lleva el SHA-256 de
cada archivo de la marca anterior (iconos, badge, `app/icon.png`, capturas), calculado desde
`origin/dev` **antes** de reemplazarlos (T0), y exige que ningún archivo servido coincida. Se completa
con el color del píxel de fondo (`#011027`) en los iconos: un hash distinto solo dice «otro archivo»,
el color dice «el de Velox».

## 4. Acciones de configuración del humano (no las hace el código)

Valores que este spec no puede leer (el `.env` y las variables de Vercel están fuera de su alcance).
Verificar en Vercel, **por entorno** (Production y Preview separados):

| Variable | Qué mirar |
|---|---|
| `SMTP_FROM_NAME` | Si existe y vale «Ordenex», cambiarla a «Velox Courier» o borrarla (el valor por defecto pasa a serlo). Si no se cambia, R19 no se ve en ese entorno. |
| `SMTP_FROM` | Dirección del remitente; P5. |
| `VAPID_SUBJECT` | Contacto `mailto:` de las notificaciones push; P5. No se ve. |
| `NEXT_PUBLIC_SITE_URL` | Base de `metadataBase` y de los enlaces `url_guia` que van a clientes: debe ser el dominio de producción vigente (`https://velox-courier.company` según el traspaso). Es del traspaso, no de esta ficha; se anota porque afecta a lo que ve el cliente. |

## 5. Alternativas descartadas

1. **Logo gráfico en la etiqueta** (`logo-negro.svg` en la cabecera). Descartado: jsPDF no dibuja
   SVG (habría que rasterizar e incrustar un PNG en cada etiqueta, con su peso en lotes grandes), la
   cabecera ya la gobiernan el QR y la guía, y cualquier alto añadido cambia la capacidad declarada
   de las hojas, que es exactamente lo que R17 prohíbe. El rótulo de texto identifica la marca a
   coste cero.
2. **`next/image` para el logo.** Descartado: los SVG requieren `dangerouslyAllowSVG` en
   `next.config` (abre la puerta a SVG remotos con script) y el `KpisMensajero` ya documenta que
   `next/image` falla en este proyecto con recursos de `public/`.
3. **Logo SVG en línea (JSX) en vez de archivo.** Descartado: el SVG vectorizado se reemplazará si
   llega el archivo del diseñador; con archivo es copiar y la guardia de §3.2 avisa, con JSX es
   reescribir un componente.
4. **Renombrar los iconos** (`/icons/velox-192.png`…). Descartado: obliga a tocar `sw.js`, tres
   guardias y el `<head>`, y no aporta nada; el `id` del manifiesto ya asegura la identidad.
5. **Usar los PNG ya rasterizados de `docs/marca/velox/png/`** en vez de regenerar con el script.
   Descartado para los `any`: son transparentes y el símbolo se pierde sobre blanco. Regenerar con el
   script deja un único camino reproducible (la lección de la 284: un PNG que nadie sabe rehacer).
6. **Logo en `offline.html`.** Descartado: esa página se sirve sin red y solo tiene garantizado lo
   que lleva dentro; un `<img>` a `/marca/…` no estaría en caché. Incrustar el SVG cuesta su peso
   entero en cada precache para una pantalla de cortesía.
7. **Logo en la cabecera del correo.** Descartado: necesita URL absoluta pública, Gmail no pinta
   SVG y la mayoría de clientes bloquea imágenes por defecto. La cabecera con el nombre en texto se
   lee siempre.
8. **Cambiar los colores de la UI al azul `#011027` y el naranja `#EF6C1F`.** Fuera por decisión
   del humano: otra ficha vía `/design`.

## 6. Riesgos

- **Guardias que el `--rapido` no selecciona.** Los cambios en `public/**` y `docs/**` no los
  relaciona el grafo de imports; las guardias de la PWA y las de esta ficha se corren a mano (lista en
  T13).
- **Visual no cubierto por la suite.** Que el logo no choque con el botón de colapso de la barra, que
  se lea en tema claro y oscuro y que la etiqueta de 100×100 siga bien solo se ve mirando. T13 lo
  pide con Playwright y medición, no a ojo.
- **Base local.** Ver la app ensucia la base local (memoria del proyecto): el agente que verifique
  limpia lo que cree.
