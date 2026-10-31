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
- T9.2: ver la sección «Revisión 490 — correcciones» (hecha el 2026-10-30).

## Revisión 490 — correcciones (2026-10-30, tras `progress/review_490.md`)

El MCP `codebase-memory` no conectó (CONNECT_TIMEOUT): todo se buscó con grep y leyendo archivos.

### B1 — tasks y T9.2
- `tasks.md`: `[x]` en T1-T8, T9.1, T9.2, T9.3. T9.4 diferida por escrito a después del merge.
- **T9.2 hecha.** Antes de arrancar se comprobó que no había otro `next dev` (solo dos `node` del
  plugin context-mode). Un dev server en `:3490`, `curl` SIN cookie y con
  `-A "facebookexternalhit/1.1"`, servidor apagado después y `rm -rf .next/dev` (el typecheck salió
  con 4 errores, todos en `.next/dev/types` truncados; tras borrar, 0). Salida en
  `progress/t92_490_curl.txt`:
  - `/privacidad` → `HTTP/1.1 200 OK`, `text/html`, sin `location` ni `set-cookie`, 60.580 bytes,
    `<title>Política de privacidad · Velox Courier</title>`. En el HTML crudo: «Velox Courier»,
    `3-102-965944`, `battos.sa@gmail.com`, «Destinatarios de los envíos», «Anthropic», «huella
    cifrada», «Movimientos de dinero de mensajeros y tiendas» y «La base de datos no permite borrar a
    un usuario».
  - `/eliminacion-datos` → `HTTP/1.1 200 OK`, sin `location` ni `set-cookie`, 46.030 bytes,
    `<title>Eliminación de datos · Velox Courier</title>`; «Qué incluir en la solicitud», «Qué se
    conserva», el correo y la razón social.
  - «Ordenex» sale 2 veces en el HTML de cada página, y NO es texto visible: es
    `<meta name="apple-mobile-web-app-title" content="Ordenex">`, escrito a mano en el `<head>` del
    layout raíz (`app/layout.tsx:51`), más su copia en el payload RSC. Una página no puede
    sobrescribirlo sin tocar el layout raíz: va con el cambio de marca posterior.
  - Captura del navegador no hecha; la evidencia es el HTML crudo, que es lo que lee el rastreador.

### Texto legal (cada afirmación contrastada con `db/schema.prisma` y el código)
- **m2 / a — Anthropic** añadido a «Servicios de terceros»: `lib/clients/anthropic-asistente.ts`
  manda a `api.anthropic.com/v1/messages` las preguntas del asistente. Brevo se mantiene (el leader
  confirma que es el SMTP de producción).
- **m1 / b — dispositivos de confianza**: ahora «dirección IP y una huella cifrada (no el dato en
  claro)». `TrustedDevice` guarda `ipAddress` y `deviceHash`, no el navegador. Los intentos de
  ingreso sí guardan IP y navegador (`LoginAttempt.ipAddress/userAgent`).
- **m3 / c — categorías añadidas** a «Usuarios de la aplicación»: IP de la verificación por código al
  correo (`EmailOtpChallenge.ipAddress`), movimientos de dinero de mensajeros y tiendas con sus
  comprobantes (`PagoMensajeroMovimiento`, `WalletTiendaMovimiento`, `WalletComprobante`) e
  historial de acciones con nombre y rol (`HistorialAccion.actorNombre/actorRol`). Dos finalidades
  nuevas: llevar las cuentas con mensajeros y tiendas, y dejar constancia de quién hizo cada acción.
- **d — qué se conserva** (`app/_legal/ConservacionLegal.tsx`, en las dos páginas): (1) movimientos
  de dinero y comprobantes: los libros no tienen `updated_at`/`deleted_at` («fila INMUTABLE») y no
  hay ningún `update`/`delete` sobre ellos en `lib/` ni en `app/` (grep); los comprobantes cuelgan
  con FK `Restrict`; (2) historial de acciones: fila inmutable, FK `Restrict` al actor (la base no
  deja borrar a un usuario con acciones registradas). No promete plazos ni cómo se borra el resto.
  Sustituye a los tests «no afirma que se conserva», que ya no eran el contrato.
- **e / m7 — una sola marca**: `LandingFooter` acepta un `marca?` opcional que sustituye al `Logo`;
  `PaginaLegal` le pasa la marca de `datos-legales.ts`. La landing (sin prop) no cambia.

### Tests
- `tests/components/paginas-legales.test.tsx`: literales nuevos en R10 y R12; m1 (sin
  «navegador… dispositivos de confianza»); Anthropic en la lista y con su literal; lista
  `CONSERVADO` exacta en las dos páginas; sin plazos de conservación; R16 acotado a su sección (la
  lista de conservación añade `<li>`); pie con la marca de los datos (ficticia) y sin «ordenex»;
  `page.tsx` reales: el pie dice «Velox Courier» y el `body` no contiene «ordenex».
- `tests/components/LandingFooter.test.tsx`: sin `marca` pinta el wordmark; con `marca`, ese texto.
- Mutación: devolver `PaginaLegal` a `<LandingFooter />` pone 4 rojos (los cuatro tests de e).
  Restaurado.

### Gate (`progress/gate_490_b.log`)
`--rapido` se niega (middleware.ts en `RUTAS_GLOBALES`); completo NO corrido (regla 5). Pasos a
mano: typecheck 0 (tras `rm -rf .next/dev`), lint 0 errores, `test:cambiados` 11 archivos / 151
tests verdes, explícitos de la revisión 5 / 78 verdes, `test:guardias` 274 / 3.769 verdes, 0 skipped.

## Abiertos

- Abierto 8: cerrado en lo básico (ver «qué se conserva»); el spec no lo refleja aún (m4).
- El wordmark «Ordenex» sigue en la barra y el pie de la landing general (fuera del encargo: cambio
  de marca posterior) y en el `<meta name="apple-mobile-web-app-title">` del layout raíz.
- Brevo se nombra como tercero, pero la 489 se desplegó APAGADA (encendido pendiente).
- Spec desactualizado respecto a T8 (ver arriba).
- T9.4 (curl contra preview), tras merge.
