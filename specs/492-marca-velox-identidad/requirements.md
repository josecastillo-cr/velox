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
> Términos: **nombre de marca** = «Velox Courier». **Nombre corto** = el valor que decida el humano
> (pregunta abierta P1). **Color de tema** = `#011027`. **Marca anterior** = cualquier archivo o
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
  `short_name` igual al nombre corto (como máximo 12 caracteres), `description` igual a la
  descripción de la fuente única, y `theme_color` y `background_color` iguales a `#011027`.
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

- **R16** — La cabecera de la etiqueta PDF DEBE mostrar como rótulo de marca el texto que fije el
  humano (pregunta abierta P2), en negro y con la tipografía estándar en negrita, y NO DEBE dibujar
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

## Capturas del diálogo de instalación

- **R22** — Ninguna captura declarada en el manifiesto DEBE coincidir byte a byte con una captura de
  la marca anterior.

## Fuera de alcance (no son requisitos de esta ficha)

- Tokens de color y tipografía de la interfaz (`app/globals.css`, Poppins): otra ficha vía `/design`.
- Prosa con «Ordenex» dentro de la app (`AvisoVersionNueva`, `PushOptIn`, asistente, wallet, cierres,
  textos de la landing como «Sumate a Ordenex»): ficha 493.
- Identificadores de código y claves de almacenamiento (`ordenex:relevo-ahora`, etiquetas `ordenex:*`
  de las notificaciones, `ordenex:sinpe-revision-aplazada:*`): no se ven y renombrarlos rompe
  estado guardado.
- Dominios y direcciones de correo (`ordenex.co`, `soporte@ordenex.co`, `no-reply@…`): ver P5 y P6.
- `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx`: verificado, no pintan marca.

## Preguntas abiertas

- **P1 — Nombre corto (`short_name` y `apple-mobile-web-app-title`).** ¿«Velox» o «Velox Courier»?
  «Velox Courier» tiene 13 caracteres, uno más del tope de 12 que Android muestra sin cortar bajo el
  icono. Recomendación técnica: «Velox». R4 y R6 quedan con el valor que se decida.
- **P2 — Rótulo de la etiqueta.** ¿«VELOX · GUÍA» o «VELOX COURIER · GUÍA»? El primero es más
  estrecho que el actual «ORDENEX · GUÍA», así que cabe en todas las hojas sin tocar el tamaño de
  los rótulos. El segundo es más ancho: en las hojas pequeñas puede encoger el cuerpo de TODOS los
  rótulos diminutos (PARA, CONTENIDO, TIENDA comparten tamaño con este) o no caber en la de
  100×100; R17 lo detectaría y habría que volver al spec.
- **P3 — Capturas del manifiesto** (`public/screenshots/*.png`, muestran la marca vieja). ¿Se
  rehacen (recomendado: mismas tres, mismo tamaño, con Playwright contra el servidor local como en
  la ficha 164; son pantallas públicas, no hace falta sesión) o se quitan? Quitarlas obliga a
  cambiar las dos guardias que hoy exigen tres capturas y al menos una `narrow` y una `wide`, y
  Android degrada el diálogo de instalación al aviso pequeño.
- **P4 — Descripción de la aplicación** (manifiesto y `<meta name="description">`). Propuesta mínima:
  «Plataforma de logística y entregas Velox Courier». ¿Vale, u otro texto?
- **P5 — Correo y contacto.** El contacto VAPID por defecto es `mailto:soporte@ordenex.co`
  (`lib/config/push.ts`) y el remitente de los correos sale de `SMTP_FROM`. ¿Cuál es el correo de
  soporte de Velox Courier y el remitente nuevo? Dependen del traspaso del SMTP; hasta tenerlos esta
  ficha no los cambia.
- **P6 — Dominio en la documentación para integradores.** La guía de integración dice «Base URL de
  producción: https://ordenex.co» y los ejemplos del OpenAPI, de la variable de plantilla
  `url_guia` y del aviso interno usan `ordenex.co`. Cambiarlo es un cambio de contrato para
  integradores, no de identidad visual: ¿sigue `ordenex.co` sirviendo la API tras el traspaso, y se
  hace en una ficha aparte? Esta ficha no los toca.
- **P7 — Prosa de la guía de integración.** Además de la portada, el cuerpo de la guía nombra a
  «Ordenex» unas 40 veces («la emite Ordenex», «pida a Ordenex»…). ¿Va a la 493 junto con los textos
  de la app (propuesta) o a una ficha propia de documentación?
- **P8 — Fotos de la landing** (`public/landing/*.jpg`). Este spec no ha verificado si alguna muestra
  la marca vieja (rótulos, uniformes, vehículos). La tarea T12 las revisa y, si alguna la muestra,
  lo reporta: sustituir una foto es decisión del humano, no de esta ficha.
