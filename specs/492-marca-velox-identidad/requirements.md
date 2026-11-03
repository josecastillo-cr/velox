# 492 — Marca Velox Courier: identidad visual · requirements

> Ficha: `feature_list.json` id 492 (zona `frontend`, `sdd: true`). La ficha 493 («textos de la
> app») depende de esta y se queda con todo «Ordenex» que sea **prosa** de la interfaz (etiquetas de
> dinero, wallet, cierres, asistente, avisos de versión e instalación…). Esta ficha cubre lo que
> **identifica** a la app: logo, iconos, favicon, manifiesto, título del documento, color de tema,
> rótulo de marca de la etiqueta y de los PDF, nombre por defecto del correo y portada de la
> documentación para integradores.
>
> Fuente de la marca: `docs/marca/velox/` (README: fidelidad, paleta, qué variante va sobre qué
> fondo). Decisión del humano: los únicos colores que cambian son `theme_color`/`background_color`
> (`#011027`) y los propios del logo. Los tokens de la UI (`app/globals.css`) **no** se tocan; eso es
> otra ficha y pasa por `/design`.
>
> Términos: **nombre de marca** = «Velox Courier». **Nombre corto** = «Velox» (P1, resuelta el
> 2026-10-31). **Descripción** = «Plataforma de logística y entregas Velox Courier» (P4). **Color de
> tema** = `#011027`. **Marca anterior** = cualquier archivo o
> texto de identidad de Ordenex tal como está en `origin/dev` al empezar la ficha.

## Fuente única

- **R1** — El sistema DEBE declarar en un único módulo de código el nombre de marca («Velox
  Courier»), el nombre corto, la descripción de la aplicación, el color de tema (`#011027`) y las
  rutas públicas de las variantes del logo, y todo archivo TypeScript tocado por esta ficha DEBE
  leer esos valores de ese módulo en vez de escribirlos como literal.
- **R2** — El sistema DEBE mantener idénticos a los de la fuente única el nombre, el nombre corto, la
  descripción y el color de tema que aparecen en los archivos que no pueden importar código
  (`public/manifest.json`, `public/offline.html`, `public/sw.js`).
- **R3** — El sistema DEBE servir cada archivo de marca copiado desde `docs/marca/velox/` byte a byte
  idéntico a su original.

## Navegador y aplicación instalada (PWA)

- **R4** — El manifiesto de la aplicación DEBE declarar `name` igual al nombre de marca,
  `short_name` igual al nombre corto («Velox»), `description` igual a la descripción
  («Plataforma de logística y entregas Velox Courier»), y `theme_color` y `background_color` iguales a `#011027`.
- **R5** — El manifiesto DEBE conservar sin cambios `id` (`/`), `start_url`, `scope`, `display`,
  `orientation`, `categories`, la ausencia de `shortcuts`, y la ruta, el tamaño y el `purpose` de
  cada icono declarado.
- **R6** — CUANDO el navegador carga cualquier página de la aplicación, el documento DEBE declarar
  como título el nombre de marca, como descripción la de la fuente única, `theme-color` igual a
  `#011027` y `apple-mobile-web-app-title` igual al nombre corto.
- **R7** — Ningún icono declarado por el manifiesto ni el `apple-touch-icon` DEBE coincidir byte a
  byte con su versión de la marca anterior, y el píxel de fondo de cada uno (muestreado en el
  borde, fuera del símbolo y dentro de la forma) DEBE ser `#011027`.
- **R8** — CUANDO el navegador pide el favicon de la aplicación, el sistema DEBE servir el favicon de
  Velox Courier, y la aplicación NO DEBE declarar ningún otro icono de pestaña de la marca anterior.
- **R9** — El icono pequeño de las notificaciones push (`badge`) DEBE ser la silueta del símbolo de
  Velox Courier: PNG con canal alfa, sin ningún píxel visible que no sea blanco, y distinto byte a
  byte del de la marca anterior.
- **R10** — SI el contenido de una notificación push no se puede interpretar, ENTONCES el service
  worker DEBE mostrarla con el nombre de marca como título.
- **R11** — MIENTRAS el dispositivo está sin conexión, la pantalla de cortesía (`offline.html`) DEBE
  declarar como título «<nombre de marca> — Sin conexión» y `theme-color` igual a `#011027`.

## Logo en pantalla

- **R12** — El logo compartido DEBE pintarse como imagen del logotipo de Velox Courier con un único
  nombre accesible igual al nombre de marca, y DEBE ofrecer tres variantes: sobre fondo oscuro
  (logotipo original), sobre fondo claro (adaptación con «VELOX» en azul marino) y según el tema
  (la de fondo claro en tema claro y la de fondo oscuro en tema oscuro).
- **R13** — MIENTRAS la barra lateral está expandida, DEBE mostrar el logo en su variante sobre fondo
  oscuro; MIENTRAS está colapsada, DEBE mostrar el símbolo de Velox Courier con el nombre de marca
  como texto alternativo.
- **R14** — Las pantallas de ingreso, recuperación de contraseña y postulación DEBEN mostrar el logo
  en su variante sobre fondo oscuro en el panel de marca de escritorio y en su variante según el
  tema en la cabecera de móvil; la página pública de seguimiento de un paquete DEBE mostrarlo en su
  variante según el tema.
- **R15** — La barra superior y el pie de la landing DEBEN mostrar el logo en su variante sobre
  fondo oscuro, y el enlace del logo a la portada DEBE tener como nombre accesible «<nombre de
  marca> — inicio». DONDE el pie recibe una marca de texto (páginas legales), DEBE seguir pintando
  ese texto en lugar del logo.

## Etiqueta de envío

- **R16** — La cabecera de la etiqueta PDF DEBE mostrar como rótulo de marca «VELOX · GUÍA» (P2),
  en negro y con la tipografía estándar en negrita, y NO DEBE dibujar
  un logo gráfico.
- **R17** — CUANDO se genera la etiqueta en cualquier hoja del catálogo, el rótulo de marca DEBE caber
  en la cabecera, y la capacidad de caracteres declarada de cada hoja DEBE seguir siendo la misma
  que con el rótulo de la marca anterior.

## Informes, correo y documentación

- **R18** — Los PDF de los informes de WhatsApp («Informe de tránsito» y «Picking») DEBEN llevar el
  nombre de marca en su encabezado o rótulo de marca y en su sello de pie, y NO DEBEN contener
  «Ordenex».
- **R19** — SI la variable `SMTP_FROM_NAME` no existe o está en blanco, ENTONCES el nombre del
  remitente y la marca de la cabecera y el pie de los correos DEBEN ser el nombre de marca.
- **R20** — La página pública `/api-docs` y la especificación OpenAPI que sirve (y su espejo
  `docs/api/api-key-openapi.yaml`) DEBEN titularse «<nombre de marca> — API de integración por API
  key».
- **R21** — La fuente de la guía de integración (`docs/api/guia-integracion/guia-integracion.html`)
  DEBE llevar el nombre de marca en su `<title>`, en su autor, en el título de la portada y en el pie
  de página, y DEBE mostrar en la portada el logotipo de Velox Courier en su variante sobre fondo
  claro.

## Contacto de soporte

- **R23** — SI la variable `VAPID_SUBJECT` no existe o está en blanco, ENTONCES el contacto de las
  notificaciones push DEBE ser `mailto:battos.sa@gmail.com` (en minúsculas), y ningún archivo
  tocado por esta ficha DEBE citar `soporte@ordenex.co`.

## Capturas del diálogo de instalación

- **R22** — El manifiesto DEBE declarar las mismas tres capturas (mismos nombres, tamaños y
  `form_factor`), y ninguna DEBE coincidir byte a byte con su versión de la marca anterior (P3:
  se rehacen).

## Fuera de alcance (no son requisitos de esta ficha)

- Tokens de color y tipografía de la interfaz (`app/globals.css`, Poppins): otra ficha vía `/design`.
- Prosa con «Ordenex» dentro de la app (`AvisoVersionNueva`, `PushOptIn`, asistente, wallet, cierres,
  textos de la landing como «Sumate a Ordenex»): ficha 493.
- Identificadores de código y claves de almacenamiento (`ordenex:relevo-ahora`, etiquetas `ordenex:*`
  de las notificaciones, `ordenex:sinpe-revision-aplazada:*`): no se ven y renombrarlos rompe
  estado guardado.
- El dominio `ordenex.co` en la documentación para integradores (Base URL de la guía, ejemplos del
  OpenAPI, de `url_guia` y del aviso interno) y la prosa «Ordenex» del cuerpo de la guía: ficha 493
  (P6/P7). El dominio nuevo es `https://velox-courier.company`.
- `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx`: verificado, no pintan marca.

## Preguntas abiertas

Respuestas del humano del 2026-10-31. No queda ninguna abierta.

- **P1 — RESUELTA (2026-10-31).** El nombre corto (`short_name` y `apple-mobile-web-app-title`) es
  **«Velox»** (5 caracteres; «Velox Courier» tenía 13 y Android lo habría cortado).
- **P2 — RESUELTA (2026-10-31).** El rótulo de la etiqueta es **«VELOX · GUÍA»**. Es más estrecho que
  «ORDENEX · GUÍA», así que R17 debería cumplirse sin tocar el tamaño de los rótulos.
- **P3 — RESUELTA (2026-10-31).** Las capturas **se rehacen** con Playwright: las mismas tres, con el
  mismo tamaño, contra el servidor local y como en la ficha 164.
- **P4 — RESUELTA (2026-10-31).** La descripción es **«Plataforma de logística y entregas Velox
  Courier»**.
- **P5 — RESUELTA (2026-10-31).** El remitente es «Velox Courier»
  `<no-reply@velox-courier.company>`. `SMTP_FROM` ya vale eso en Production (SMTP en Brevo), así que
  no hace falta código. El **correo de soporte** es `battos.sa@gmail.com`, escrito en minúsculas (el
  humano lo escribió «Battos.sa@gmail.com»; en Gmail es el mismo buzón). Sustituye a
  `soporte@ordenex.co` como contacto por defecto de las notificaciones push
  (`mailto:battos.sa@gmail.com`) y en los textos de esta ficha (R23, tarea T16).
- **P6 — RESUELTA (2026-10-31).** El dominio `ordenex.co` de la documentación para integradores se
  cambia en la **493**, no aquí. El humano pausa a los integradores y los pone al día con el manual
  nuevo; `ordenex.co` se libera y el dominio pasa a ser `https://velox-courier.company`.
- **P7 — RESUELTA (2026-10-31).** La prosa «Ordenex» del cuerpo de la guía de integración se cambia
  en la **493**. La 492 solo toca la portada, el título, el autor y el pie (R21).
- **P8 — RESUELTA (2026-10-31).** Las fotos de la landing se quedan como están; T12 solo las revisa
  y anota lo que vea.
