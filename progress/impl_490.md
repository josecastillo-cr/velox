# 490 — Páginas legales · implementación (frontend_dev, 2026-10-30)

Rama `feat/490-paginas-legales`. Hechas T1-T8 y T9.1/T9.3. Texto legal BÁSICO (abierto 4) y sin
`/design` (abierto 12), por decisión del humano del 2026-10-30.

**T8 (corrección del leader a mitad de tarea, decisiones del humano del 2026-10-30).** Fuente:
certificación de personería jurídica del Registro Nacional, RNPDIGITAL-1541420-2026. En
`app/_legal/datos-legales.ts`: marca «Velox Courier», razón social «3-102-965944 SOCIEDAD DE
RESPONSABILIDAD LIMITADA», cédula jurídica 3-102-965944, domicilio publicado (San José, Aserrí…),
correo battos.sa@gmail.com, actualización «30 de octubre de 2026», plazo «30 días naturales».
NO se publica al gerente ni su cédula. Con eso:
- `DatosLegales` gana dos campos que el design §5 no tenía: `domicilio` y `plazoRespuesta`.
- Privacidad añade «Servicios de terceros» (Meta/WhatsApp, Google Maps, Brevo, Vercel, Supabase,
  cada uno con su función), «Marco legal» (Ley 8968) y el plazo en «Eliminación de tus datos»
  (con el correo como `mailto:`). Eliminación añade el plazo.
- El pie de la landing lee marca y razón social de la fuente única (sustituye «Ordenex S.A.» fijo,
  abierto 11 cerrado). El wordmark `Logo` «Ordenex» del pie y de la barra NO se tocó.
- Abierto 8 (qué se conserva tras una solicitud): el spec NO dejó texto redactado (solo la nota del
  esquema con FK `RESTRICT` y la pregunta). No se afirma nada; sigue abierto.
- El spec (`requirements.md` abiertos 1-3, 5-7, 9-11; design §3 «Lo que la página NO afirma», §5)
  quedó por detrás del código: no lo edité (no es mi capa); lo debe actualizar el spec_author.

Herramienta de búsqueda: el MCP `codebase-memory` no conectó (timeout); se leyeron los archivos
con grep/Read.

## Archivos

- `middleware.ts` — `/privacidad` y `/eliminacion-datos` en `PUBLIC_ROUTES` (comentario 490).
- `app/_legal/datos-legales.ts` — fuente única (`DatosLegales`, `DATOS_LEGALES` con los datos de T8,
  `MARCADOR_PENDIENTE`).
- `app/_legal/DatoLegal.tsx` — `DatoLegal` (valor o `<span data-pendiente>`) y `CorreoLegal`
  (`mailto:` o marcador sin enlace, R21).
- `app/_legal/PaginaLegal.tsx` — armazón (cabecera `bg-navy-deep` con marca como texto +
  `VolverAlInicioLink`, `<main>` con un `<h1>`, `LandingFooter`) y piezas del cuerpo
  (`SeccionLegal`, `ListaLegal`, `SubtituloLegal`, `EnlaceLegal`, `FichaResponsable`).
- `app/_legal/metadata-legal.ts` — `metadataLegal(datos, pagina)` (R7). Archivo no listado en el
  design §2: separa el armado de `metadata` para que las dos `page.tsx` no lo dupliquen.
- `app/_legal/PoliticaPrivacidad.tsx`, `app/_legal/InstruccionesEliminacion.tsx` — cuerpos, datos
  por prop.
- `app/privacidad/page.tsx`, `app/eliminacion-datos/page.tsx` — `dynamic = "force-static"`,
  `metadata`, unen config + cuerpo.
- `app/_landing/LandingFooter.tsx` — columna «Legal»: `Política de Privacidad` → `/privacidad`,
  nuevo «Eliminación de datos» → `/eliminacion-datos`; docstring actualizado. Nada más del pie.

Decisión de estilo: enlaces y marcador usan `text-primary-strong` (token de enlace AA de la ficha
458), no `brand-dark` (3.93, no llega a 4.5).

## Mapa R → test

| Requisito | Test |
|---|---|
| R1, R2, R3, R4 | `tests/unit/auth/middleware-paginas-legales.test.ts` |
| R5 | `tests/components/paginas-legales.test.tsx` (cuerpos y `page.tsx` reales por `renderToStaticMarkup`, sin `<script`) + guardia (sin `"use client"`) |
| R6 | `tests/unit/guards/paginas-legales-estaticas.guardia.test.ts` |
| R7 | `paginas-legales.test.tsx` › «page.tsx — metadata…» (`vi.doMock` del módulo con marca ficticia y con `null`) |
| R8 | `paginas-legales.test.tsx` › «R8» (privacidad y eliminación) |
| R9, R10, R11 | `paginas-legales.test.tsx` › «categorias de datos» (literales del spec) |
| R12 | `paginas-legales.test.tsx` › «finalidades» (por sección, literales) |
| R13 | `paginas-legales.test.tsx` › «R13 + R20», «R13: rotula» |
| R14 | `paginas-legales.test.tsx` › «R14» |
| R15, R16, R21 | `paginas-legales.test.tsx` › «solicitud por correo» |
| R17 | `paginas-legales.test.tsx` › «InstruccionesEliminacion — datos legales y enlace» |
| R18 | guardia (literales `Ordenex`/`Velox`/correo fuera de `datos-legales.ts`; cuerpos sin `DATOS_LEGALES`) |
| R19, R20 | `paginas-legales.test.tsx` (datos `null` → marcadores; datos ficticios `*-PRUEBA` → valores, cero marcadores; también la cabecera) |
| R22 | `tests/components/LandingFooter.test.tsx` |
| T8 | `paginas-legales.test.tsx` › «T8» (terceros, Ley 8968, plazo; page.tsx reales sin marcador ni `data-pendiente`, ni «gerente») + `LandingFooter.test.tsx` › copyright con literal del contrato |

Los 22 requisitos tienen test nombrado. Dos tests negativos fijan que el texto no afirma qué se
conserva tras una solicitud (abierto 8).

## Mutaciones (T1.1 y T6.1)

- Quitar las dos rutas de `PUBLIC_ROUTES` → `middleware-paginas-legales`: **6 rojos** (R1-R3),
  3 verdes (R4, esperado). Restaurado.
- Plantar `app/_legal/zz-mutacion.ts` con `"use client"` y `"Velox Courier"` → guardia: **2 rojos**
  (R5/R6 y R18). Borrado.
- Durante la implementación la guardia cazó de verdad la palabra `searchParams` en un comentario
  de las dos `page.tsx`; se reescribió el comentario.

## Verificación

- Gate `./init.sh --rapido` → `progress/gate_490.log`: **`INIT_EXIT=1`**, y no por un rojo: el
  clasificador exige el gate COMPLETO porque el diff toca `middleware.ts` (está en
  `RUTAS_GLOBALES`). El completo NO se corrió (orden del leader y regla 5); se corrieron a mano los
  pasos del `--rapido` en el mismo log: typecheck 0, lint 0 (sin avisos en archivos de la 490),
  `test:cambiados` 11 archivos / 141 tests verdes, `test:guardias` 274 / 3.769 verdes, **0
  skipped**. Decisión del leader: si corre el completo o lo deja para la release.
- `tests/unit/guards/rastreo-sin-ruta-nueva.guardia.test.ts` (feature 229) fija `PUBLIC_ROUTES` como
  lista firmada y se puso roja con las dos rutas nuevas, como debe: se añadieron a la lista firmada
  con su motivo. Es la única edición fuera del alcance listado en el design.
- La guardia lee con `fs`: corrida a mano por nombre, `pnpm exec vitest run paginas-legales`
  → 3 archivos, 45 tests verdes. También verdes `middleware.test.ts` y `LandingPage.test.tsx`.
- **T9.2 NO hecha**: el leader indicó no levantar dev server. El `curl` sin cookie y con
  `-A "facebookexternalhit/1.1"` y la captura del navegador quedan pendientes (el HTML de servidor
  sí se prueba por `renderToStaticMarkup` de las `page.tsx` reales). T9.4 (preview) es tras merge.

## Abiertos

- Abierto 8 (qué se conserva pese a una solicitud de borrado): sin texto en el spec, no se afirma.
- El wordmark `Logo` «Ordenex» sigue en la barra y el pie de la landing y en el pie de las páginas
  legales (lo pinta `LandingFooter`); también el texto «Transportadora costarricense…». Fuera del
  encargo.
- Brevo se nombra como tercero, pero la 489 se desplegó APAGADA (encendido pendiente).
- Spec desactualizado respecto a T8 (ver arriba).
- T9.2 (curl + captura con dev server) y T9.4 (curl contra preview).
