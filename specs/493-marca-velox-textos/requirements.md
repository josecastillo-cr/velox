# 493 — Marca Velox Courier: textos de la app · requirements

> Ficha 493 (`feature_list.json`). Depende de la **492** (identidad visual, `specs/492-marca-velox-identidad/`).
> Spec escrito el 2026-11-01. Medición de base hecha con `grep` sobre el árbol de `dev` (el MCP
> `codebase-memory` no conectó en esta sesión: *connection timed out*).
> **Fuente de la marca:** esta ficha NO crea constante propia. Reutiliza `MARCA` de
> `lib/marca/identidad.ts`, que crea la 492 (`specs/492-marca-velox-identidad/design.md §3.1`):
> `MARCA.nombre` y `MARCA.nombreCorto`. Si la 493 llegara a necesitar un campo que la 492 no define,
> se declara como dependencia de la 492, no se añade aquí.

## Contexto medido (2026-11-01)

| Superficie | Archivos con «Ordenex» (cualquier caja) | Apariciones |
| --- | --- | --- |
| `app/`, `components/`, `hooks/`, `lib/`, `public/` | 239 | 1.017 |
| `tests/` | 246 | 1.474 |
| `docs/ayuda/**` (se pinta en el módulo Ayuda y alimenta al asistente) | 12 | 176 |

De las 1.017 de código, la mayoría son **comentarios** e **identificadores** (`ingresoOrdenex`,
`netoOrdenex`, `TotalesIngresoOrdenex`, `deOrdenex`, `esOrdenex`…). Las que son **texto en una cadena o
en JSX** son del orden de 230 líneas (medición aproximada por `grep`; el censo exacto lo produce la
guardia de R14, ver `tasks.md` T2). El inventario clasificado está en `design.md §2`.

Glosario de este spec:

- **Marca**: el nombre de la empresa tal como se le muestra a una persona. Hoy «Ordenex»; pasa a «Velox Courier».
- **Marca** en código: `MARCA.nombre` («Velox Courier», 492).
- **Forma corta de la marca**: `MARCA.nombreCorto` = «Velox». Se usa en etiquetas de una o dos palabras («Cobró Velox», «Total Velox»); las frases usan `MARCA.nombre` (P1, resuelta).
- **Texto visible**: todo literal de cadena o texto JSX que el sistema puede mostrar a una persona, incluido lo que se genera en servidor (rótulos del libro de caja, historial, avisos, mensajes de error, documentación de la API, instrucciones del asistente) y los encabezados de los archivos descargables.
- **Identificador**: nombre de variable, tipo, función, archivo, clave de objeto, valor de enum, clave de almacenamiento local, tipo de mensaje entre pestañas/service worker, nombre de cookie, nombre de cabecera HTTP o id de métrica.

## Requisitos

### Fuente única de la marca

- **R1** (ubicuo) — Todo texto de esta ficha que nombre a la empresa DEBE tomar la marca de `MARCA.nombre` o `MARCA.nombreCorto` (`lib/marca/identidad.ts`, 492), y ningún literal de cadena ni texto JSX de `app/`, `components/`, `hooks/` o `lib/` fuera de ese módulo y de la lista cerrada de excepciones (`design.md §6`) DEBE contener el nombre de la marca escrito a mano.
- **R2** (ubicuo) — Los valores de marca que esperan los tests de texto DEBEN coincidir con `MARCA.nombre` y `MARCA.nombreCorto`, y `MARCA.nombre` DEBE ser exactamente «Velox Courier».

### Texto visible, por superficie

- **R3** (ubicuo) — El sistema DEBE nombrar a la empresa con la marca (o su forma corta) y nunca como «Ordenex» en los textos de la caja principal: tarjetas de resumen, composición de la caja y de la ganancia, desglose de gastos, libro de movimientos, diálogo de registrar movimiento, panel de detalle de un movimiento y conceptos manuales.
- **R4** (ubicuo) — El sistema DEBE nombrar a la empresa con la marca (o su forma corta) y nunca como «Ordenex» en los estados de cuenta de tiendas, mensajeros y satélites, en «Mi wallet» de la tienda y en las frases de saldo («… le debe … a …», «… no se deben nada»).
- **R5** (ubicuo) — El sistema DEBE nombrar a la empresa con la marca (o su forma corta) y nunca como «Ordenex» en los cierres (admin, bodega, cierre del día y su hoja/factura): «Total …», «Ingreso de …», «Neto de …», «Lo que … facturó», «Lo que le queda a …», «Lo que … le factura a la tienda» y sus pistas y nombres accesibles.
- **R6** (ubicuo) — El sistema DEBE nombrar a la empresa con la marca (o su forma corta) y nunca como «Ordenex» en la analítica: la columna y el detalle «Cobró …» de productos, sus pistas, los KPI financieros y la etiqueta de la métrica de ganancia.
- **R7** (ubicuo) — El sistema DEBE nombrar a la empresa con la marca y nunca como «Ordenex» en las pantallas de configuración (tarifas y zonas, API keys, envíos de WhatsApp) y en las descripciones de las variables de plantilla.
- **R8** (ubicuo) — El sistema DEBE nombrar a la empresa con la marca y nunca como «Ordenex» en los textos generados en servidor que llegan a una persona: rótulos de origen y de categoría del libro de caja, etiquetas del historial de acciones, aviso de ubicación denegada, avisos de versión nueva y de instalación, panel e instrucciones del asistente, mensajes de error de los servicios de dinero, y la prosa de la landing pública (p. ej. «Sumate a Ordenex» en la sección de postulación).
- **R9** (ubicuo) — La documentación para integradores DEBE nombrar a la empresa con la marca y nunca como «Ordenex» en su prosa: las descripciones de la especificación OpenAPI (`lib/api/openapi-spec.ts` y su espejo `docs/api/api-key-openapi.yaml`) y el cuerpo de la guía de integración (`docs/api/guia-integracion/guia-integracion.html`, ~38 apariciones, y su `README.md`). Los títulos, la portada, el autor y el pie de esa documentación son de la 492 (sus §3.10 y §3.11).
- **R10** (ubicuo) — Los documentos de ayuda (`docs/ayuda/**`) DEBEN nombrar a la empresa con la marca y no DEBEN contener «Ordenex».

### Lo que NO cambia

- **R11** (condicional) — SI un texto contiene un identificador interno que contiene «ordenex» (clave de almacenamiento local `ordenex:*`, tipo de mensaje `ordenex:*` entre la página y el service worker, etiqueta de notificación `ordenex:*`, cookie `ordenex_tema`, id de métrica, valor de enum o clave de concepto/columna), ENTONCES el sistema DEBE conservar ese identificador sin cambios. (Las cabeceras de webhook NO son de esta lista desde la respuesta a P4: ver R17.)
- **R12** (condicional) — SI una persona tenía guardada una preferencia (columnas de descarga, columnas del manifiesto, sonido, navegación, tema) antes del cambio, ENTONCES el sistema DEBE seguir aplicándola después del cambio.

### Archivos descargables

- **R13** (por evento) — CUANDO una persona descarga un CSV/Excel cuyo encabezado nombra a la empresa, el sistema DEBE escribir ese encabezado con la marca (o su forma corta) y DEBE conservar sin cambios la clave interna y el orden de la columna.

### Coherencia con lo que no puede importar la constante

- **R14** (ubicuo) — El título de reserva de las notificaciones del service worker (`public/sw.js`, que no puede importar `MARCA`) DEBE coincidir con `MARCA.nombre`; y el nombre de la app que el aviso de ubicación denegada manda a buscar en «Aplicaciones» DEBE coincidir con el `short_name` del manifiesto. (La paridad de `manifest.json`, `offline.html` y `app/layout.tsx` con `MARCA` es de la 492.)

### Guardias

- **R15** (condicional) — SI aparece «Ordenex» (sin distinguir mayúsculas) en un literal de cadena o texto JSX de `app/`, `components/`, `hooks/` o `lib/`, en un archivo de `public/`, en `docs/ayuda/**` o en la documentación para integradores de R9, fuera de la lista explícita de excepciones de R11, ENTONCES la suite DEBE fallar nombrando archivo, línea y fragmento.
- **R16** (condicional) — SI un test que no está en la lista cerrada de permitidos (el test ancla de la 493, la guardia de la 493 y las guardias/tests de paridad de la 492) importa `lib/marca/identidad.ts`, o un test contiene «Ordenex» en un literal de cadena fuera de la lista de excepciones de R11, de las aserciones negativas de R17/R18 (que la cabecera o el dominio viejos ya no salen) y de los dominios `ordenex.co` usados como dato de prueba (no como contrato), ENTONCES la suite DEBE fallar nombrando el archivo.

### Cambios de contrato con integradores (respuestas P4 y P6, 2026-10-31)

- **R17** (por evento) — CUANDO el sistema entrega un webhook firmado, DEBE enviar la firma en la cabecera `X-Velox-Signature` y el instante en `X-Velox-Timestamp`, con el mismo algoritmo y formato de valor que hoy (`sha256=<hex>` sobre `${timestamp}.${cuerpo}`; segundos unix), y NO DEBE enviar `X-Ordenex-Signature` ni `X-Ordenex-Timestamp`. La OpenAPI, su espejo `.yaml` y la guía de integración DEBEN declarar los nombres nuevos y no los viejos.
- **R18** (ubicuo) — La documentación para integradores (OpenAPI, `.yaml`, guía de integración, `docs/api/manual-metricas-por-mensajero.md`), los ejemplos de variables de plantilla y del aviso interno, y los valores de ejemplo de `lib/types/plantilla-datos.ts` DEBEN usar `https://velox-courier.company` como origen y NO DEBEN contener `ordenex.co` ni `app.ordenex.co`.
- **R20** (ubicuo) — Toda dirección de contacto de soporte que el sistema o su documentación muestren o envíen DEBE ser `battos.sa@gmail.com` (en minúsculas), y ningún archivo de `app/`, `components/`, `hooks/`, `lib/`, `public/`, `docs/ayuda/**` ni `docs/api/**` (salvo `CHANGELOG.md` histórico) DEBE contener `soporte@ordenex.co`. Medido el 2026-11-01: hoy solo aparece en `lib/config/push.ts` (`DEFAULT_SUBJECT = "mailto:soporte@ordenex.co"`, contacto VAPID por defecto); `docs/ayuda/**` y `docs/api/**` no tienen correo de soporte.
- **R19** (por evento) — CUANDO se prepara la release de esta ficha, `docs/api/CHANGELOG.md` DEBE tener una entrada nueva fechada, marcada como ruptura, que enumere los tres cambios de contrato (cabeceras de R17, dominio de R18 y encabezados de descarga de R13) con el antes y el después de cada uno; y la guía de integración DEBE reflejar los mismos cambios.

## Trazabilidad prevista (R → test)

| R | Test |
| --- | --- |
| R1 | `tests/unit/guards/marca-fuente-unica-493.guardia.test.ts` (bloque «R1: la marca solo vive en su módulo», con contraprueba) |
| R2 | `tests/unit/marca/textos-ancla-493.test.ts` (test ancla: fixture literal == `MARCA.nombre`/`MARCA.nombreCorto`, y `MARCA.nombre === "Velox Courier"` literal) |
| R3 | `tests/unit/components/wallet-labels.test.ts`, `tests/unit/components/wallet-conceptos-manuales.test.ts`, `tests/components/CajaResumenCard.test.tsx`, `tests/components/ComposicionGananciaCard.test.tsx`, `tests/unit/components/wallet-registrar-movimiento-dialog.test.tsx`, `tests/components/DetalleMovimientoPanel.test.tsx` (migrados con la regla de `design.md §5`) |
| R4 | `tests/unit/components/mi-wallet-labels.test.ts`, `tests/integration/mi-wallet-page.test.tsx`, `tests/unit/components/desglose-tienda-labels.test.ts`, `tests/components/EstadoCuenta.test.tsx`, `tests/components/EstadoCuentaAcciones.test.tsx` |
| R5 | `tests/components/CierresAdminModule.test.tsx`, `tests/components/CierreMensajeroDetalleCascadas.test.tsx`, `tests/components/CierreBodegaDetalleCascadas.test.tsx`, `tests/unit/utils/cascadas-cierre-bodega.test.ts` |
| R6 | `tests/components/ProductosTablaDinero.test.tsx`, `tests/components/DineroIdentidadesEnPantalla.test.tsx`, `tests/unit/analytics/etiquetas-visibles.guardia.test.ts`, `tests/unit/analytics/kpis-financieros.test.ts` |
| R7 | test nuevo `tests/unit/components/configuracion-marca-493.test.tsx` (tarifas, API keys, envíos WhatsApp) + `tests/unit/actions/plantillas-composition-root-474.test.ts` o el test que ya cubra `plantilla-datos` |
| R8 | `tests/unit/services/wallet-origen-legible.test.ts`, `tests/unit/historial-accion/catalogo-y-choke-point.test.ts`, `tests/unit/utils/aviso-ubicacion-denegada.test.ts`, `tests/unit/asistente/instrucciones.test.ts`, `tests/components/PushOptIn.test.tsx`, test nuevo de `AvisoVersionNueva` si no existe, test de la landing de postulación (`tests/components/LandingPage.test.tsx` o uno nuevo `LandingPostular`) |
| R9 | `tests/unit/api/openapi-webhook-estado-actualizado.test.ts` + bloque nuevo «descripciones con la marca» en un test de `openapi-spec`; `marca-fuente-unica-493.guardia.test.ts` (bloque «documentación para integradores»: `guia-integracion.html`, su `README.md` y `api-key-openapi.yaml` sin «Ordenex» fuera de excepciones) |
| R10 | `marca-fuente-unica-493.guardia.test.ts` (bloque `docs/ayuda`) + `tests/unit/docs/ayuda-wallet-caja-488.test.ts`, `tests/unit/asistente/contexto-45{7,8}.test.ts`, `contexto-46{0,1}.test.ts` migrados |
| R11 | `marca-fuente-unica-493.guardia.test.ts` (bloque «excepciones», con contraprueba) + `tests/unit/guards/tema-encendido.guardia.test.ts` y `tests/unit/hooks/useTonoAlIncrementar.test.tsx`, que siguen afirmando las claves `ordenex_tema`/`ordenex:*` literales |
| R12 | tests existentes que afirman la clave literal, sin cambios y verdes: `tests/components/descarga/CierresDescargaColumnas.test.tsx`, `tests/components/OrdenesDescargaColumnas.test.tsx`, `tests/components/descarga/ProductosDescargaColumnas.test.tsx`, `tests/unit/hooks/useTonoAlIncrementar.test.tsx`, `tests/unit/guards/tema-encendido.guardia.test.ts` |
| R13 | `tests/unit/descarga/analitica-productos-descarga-columnas.test.ts`, `cierres-gestiones-fundida-descarga-columnas.test.ts`, `cierre-dia-descarga-columnas.test.ts`, `wallet-caja-descarga-columnas.test.ts` (encabezado nuevo literal + clave intacta) |
| R14 | `marca-fuente-unica-493.guardia.test.ts` (bloque «paridad con archivos estáticos») |
| R15 | `marca-fuente-unica-493.guardia.test.ts` (bloque «R15», con contraprueba sobre fuente sintética) |
| R16 | `marca-fuente-unica-493.guardia.test.ts` (bloque «R16: los tests no se anclan a su fuente», con contraprueba) |
| R17 | `tests/unit/clients/webhook-sender.test.ts`, `tests/unit/services/webhook-estado-service.test.ts`, `tests/unit/services/WebhookEventoOrdenService.test.ts` (afirman `X-Velox-Signature`/`X-Velox-Timestamp` literales y que `X-Ordenex-*` NO va en la petición) + `tests/unit/api/openapi-webhook-estado-actualizado.test.ts` (la OpenAPI declara los nombres nuevos) + bloque «contrato» de la guardia (`.yaml` y guía sin `X-Ordenex-`) |
| R18 | `tests/unit/api/openapi-406-evidencias-url.test.ts`, `tests/unit/types/plantilla-datos.test.ts`, `tests/unit/whatsapp-envios/informe-aviso-interno.test.ts` (ejemplos con `https://velox-courier.company` literal) + bloque «contrato» de la guardia (`ordenex.co` ausente de código y de `docs/api/**` salvo `CHANGELOG.md`) |
| R19 | test nuevo `tests/unit/docs/changelog-api-493.test.ts`: existe una entrada de `CHANGELOG.md` con fecha y «ruptura» que contiene `X-Velox-Signature`, `X-Velox-Timestamp`, `velox-courier.company` y el encabezado nuevo «Cobró Velox»; la guía de integración contiene los mismos tres |
| R20 | `tests/unit/config/push-config.test.ts` (asunto VAPID por defecto `mailto:battos.sa@gmail.com` literal) + bloque «contrato» de la guardia (`soporte@ordenex.co` ausente) |

## Fuera de alcance (no son requisitos de esta ficha)

- Comentarios de código y documentación técnica (`docs/` salvo `docs/ayuda/`, `specs/`, `progress/`, `CLAUDE.md`).
- Renombrar identificadores (`ingresoOrdenex`, `lib/utils/ingreso-ordenex.ts`, `netoOrdenex`…).
- Nombres de plantillas de Meta (`alerta_transito_ordenex`, `picking_bodega_ordenex`): no aparecen en el código (medido: 0 coincidencias en `lib/`); viven en Meta/la base.
- Lo que cubre la 492 (su design §1 y §3): la constante `MARCA`, metadatos y títulos de la app, manifiesto, `offline.html`, logo y su `alt`/`aria-label` (también en la landing), rótulo de la etiqueta (`EtiquetaGuia`, `ROTULO_GUIA`), PDFs de informes de tránsito/picking, remitente del correo (`DEFAULT_FROM_NAME = MARCA.nombre`), títulos de `/api-docs` y de la OpenAPI, y portada/título/autor/pie de la guía de integración. La **prosa** de la landing y del cuerpo de la guía sí es de esta ficha (R8, R9). Si al implementar la 493 queda algo de la 492 con «Ordenex», la guardia de R15 lo detecta y se recoge aquí (ver `design.md §2 g`).
- Reescribir las entradas viejas de `docs/api/CHANGELOG.md` (es un registro; solo se AÑADE la entrada de R19) y el nombre de archivo de la colección Postman.
- Datos ya guardados en la base (p. ej. el usuario sembrado «Maestro Ordenex»): se dejan como están (P5, resuelta).
- El origen real de los enlaces que la app genera en producción no sale del código sino de las variables de entorno `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` (Vercel). Cambiarlas a `https://velox-courier.company` es un paso de configuración de la release (T15), no un requisito de código.
- `scripts/` y `e2e/` (no se ejecutan en el gate; `e2e/` se actualiza por coherencia en T13, sin requisito).

## Preguntas abiertas

Todas resueltas. Ninguna queda abierta.

- **P1 — Forma corta en etiquetas. RESUELTA (2026-10-31, humano).** Las etiquetas cortas usan `MARCA.nombreCorto` = «Velox» («Cobró Velox», «Total Velox», «Cargos de Velox»…); los textos largos (frases, pistas, avisos) usan `MARCA.nombre` = «Velox Courier». No hace falta ningún campo nuevo en `MARCA`.
- **P2 — Razón social en ejemplos. RESUELTA (2026-10-31, humano).** «Velox Courier S.A.»: placeholders «Ej: Velox Courier S.A.» (`components/shared/sinpe-textos.ts`, `CrearZonaForm.tsx`) y `ejemplo`/`sinpeNombre` de `lib/types/plantilla-datos.ts`. Es un ejemplo de razón social, no la marca: va literal y la guardia de R1 lo admite como excepción nombrada.
- **P3 — Nombre de la app instalada. RESUELTA por la 492 (P1 de la 492: «Velox»).** El aviso de ubicación denegada usa `MARCA.nombreCorto`, que es el `short_name`.
- **P4 — Cabeceras de webhook. RESUELTA (2026-10-31, humano) — CAMBIO DE ALCANCE.** Se renombran a `X-Velox-Signature` y `X-Velox-Timestamp`, sin periodo de doble cabecera; el humano pausa a los integradores y los actualiza con el manual nuevo. Requisito R17; aviso en R19.
- **P5 — Datos persistidos. RESUELTA (2026-10-31, humano).** Se dejan como están; fuera de alcance.
- **P6 — Dominio y correos. RESUELTA (2026-10-31, humano) — CAMBIO DE ALCANCE.** `ordenex.co` y `app.ordenex.co` pasan a `https://velox-courier.company` en la documentación para integradores, la OpenAPI, los ejemplos y las plantillas (R18); `ordenex.co` se libera. El correo de soporte `soporte@ordenex.co` pasa a `battos.sa@gmail.com` (fijado por el humano el 2026-10-31, escrito en minúsculas; R20). Sin bloqueos pendientes.
- **P7 — Remitente del correo. RESUELTA por la 492** (su §3.9: `DEFAULT_FROM_NAME = MARCA.nombre`).
- **P8 — Aviso por los encabezados. RESUELTA (2026-10-31, humano).** No se avisa a las tiendas aparte; el cambio de encabezados de las descargas y todo lo de integradores se comunica con la actualización del manual de la API (R19, T15).
