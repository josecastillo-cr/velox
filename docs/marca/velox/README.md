# Marca Velox Courier

Archivos fuente del cambio de marca Ordenex → Velox Courier (fichas 492 y 493). Esta carpeta
NO se sirve: la feature copia a `public/` y `app/` solo lo que use.

## Origen y fidelidad

- Vectorizado por IA (Claude, 2026-10-31) a partir de `logo-original-captura.jpeg`, una captura de
  ~575 px de ancho. No es el archivo del diseñador.
- Revisado contra el original el 2026-10-31 (`hoja-de-contacto.png`): las 8 piezas son fieles.
  Limitaciones conocidas: «COURIER» queda con esquinas blandas a gran tamaño; el ala usa un
  degradado plateado aproximado (`#F4F5F7` → `#A2A5AA`), no el metálico original.
- `logo-horizontal-fondo-claro.svg` es una ADAPTACIÓN (VELOX en azul marino): no existe en el
  original, donde VELOX es blanco.
- Si llega el archivo fuente del cliente (AI/PDF/SVG), se reemplazan estos archivos con los
  mismos nombres y no hace falta tocar código.

## Paleta

| Rol | HEX | oklch | Nota |
|---|---|---|---|
| primario (fondo del logo) | `#011027` | `oklch(17.5% 0.053 255.1)` | casi negro |
| primario-oscuro | `#000A1A` | `oklch(14.3% 0.041 250.7)` | apenas distinguible; para hover mejor aclarar a `#0B2147` |
| acento (naranja del check) | `#EF6C1F` | `oklch(68.1% 0.181 45.6)` | degradado del check `#FC8216` → `#E43A0E` |
| fondo claro | `#F5F7FA` | `oklch(97.5% 0.005 258.3)` | |
| texto sobre primario | `#FFFFFF` | | contraste 19.01:1 |

- Texto blanco sobre el naranja: 3.07:1, NO cumple AA en texto normal. Sobre naranja, texto `#011027` (6.19:1).
- `theme_color` y `background_color` del manifest: `#011027`.

## Tipografía

No identificada con certeza: sans pesada, itálica y extendida. Lo más parecido en Google Fonts:
Saira (ancho 125, peso 800–900, itálica) o Exo 2 Black Italic. Para la interfaz no se cambia la
fuente actual salvo decisión de diseño (`/design`).

## Archivos

| Archivo | Uso |
|---|---|
| `svg/logo-horizontal.svg` | logo completo, colores originales, sobre fondo oscuro |
| `svg/logo-horizontal-fondo-claro.svg` | logo sobre fondo claro (adaptación) |
| `svg/logo-horizontal-blanco.svg` | todo blanco, sobre fotos o color |
| `svg/logo-negro.svg` | `#000000` sólido: etiqueta térmica y PDFs en B/N |
| `svg/logo-simbolo.svg` | símbolo solo, viewBox cuadrado; débil sobre blanco (el plateado se pierde) |
| `svg/icono-maskable.svg` | 512×512, fondo `#011027`, símbolo al 66 % |
| `svg/apple-touch-icon.svg`, `svg/favicon.svg` | con fondo `#011027` |
| `png/logo-simbolo-{1024,512,192,180}.png` | transparentes |
| `png/icono-maskable-{512,192}.png` | PWA `purpose: maskable` |
| `png/apple-touch-icon-180.png` | iOS (con fondo; iOS rellena lo transparente con negro) |
| `png/favicon-{32,48}.png`, `favicon.ico` | favicon |
