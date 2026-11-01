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
- **Forma corta de la marca**: `MARCA.nombreCorto` (valor que decide la P1 de la 492; recomendado «Velox»). Si se usa o no en etiquetas de una o dos palabras («Cobró …», «Total …») es la P1 de esta ficha.
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

- **R11** (condicional) — SI un texto contiene un identificador que contiene «ordenex» (clave de almacenamiento local `ordenex:*`, tipo de mensaje `ordenex:*` entre la página y el service worker, etiqueta de notificación `ordenex:*`, cookie `ordenex_tema`, cabeceras `X-Ordenex-Signature`/`X-Ordenex-Timestamp`, id de métrica, valor de enum o clave de concepto/columna), ENTONCES el sistema DEBE conservar ese identificador sin cambios.
- **R12** (condicional) — SI una persona tenía guardada una preferencia (columnas de descarga, columnas del manifiesto, sonido, navegación, tema) antes del cambio, ENTONCES el sistema DEBE seguir aplicándola después del cambio.

### Archivos descargables

- **R13** (por evento) — CUANDO una persona descarga un CSV/Excel cuyo encabezado nombra a la empresa, el sistema DEBE escribir ese encabezado con la marca (o su forma corta) y DEBE conservar sin cambios la clave interna y el orden de la columna.

### Coherencia con lo que no puede importar la constante

- **R14** (ubicuo) — El título de reserva de las notificaciones del service worker (`public/sw.js`, que no puede importar `MARCA`) DEBE coincidir con `MARCA.nombre`; y el nombre de la app que el aviso de ubicación denegada manda a buscar en «Aplicaciones» DEBE coincidir con el `short_name` del manifiesto. (La paridad de `manifest.json`, `offline.html` y `app/layout.tsx` con `MARCA` es de la 492.)

### Guardias

- **R15** (condicional) — SI aparece «Ordenex» (sin distinguir mayúsculas) en un literal de cadena o texto JSX de `app/`, `components/`, `hooks/` o `lib/`, en un archivo de `public/`, en `docs/ayuda/**` o en la documentación para integradores de R9, fuera de la lista explícita de excepciones de R11 y de los dominios/correos de P6, ENTONCES la suite DEBE fallar nombrando archivo, línea y fragmento.
- **R16** (condicional) — SI un test que no está en la lista cerrada de permitidos (el test ancla de la 493, la guardia de la 493 y las guardias/tests de paridad de la 492) importa `lib/marca/identidad.ts`, o un test contiene «Ordenex» en un literal de cadena fuera de la lista de excepciones de R11, ENTONCES la suite DEBE fallar nombrando el archivo.

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
| R11 | `marca-fuente-unica-493.guardia.test.ts` (bloque «excepciones», con contraprueba) + `tests/unit/clients/webhook-sender.test.ts`, `tests/unit/services/webhook-estado-service.test.ts`, `tests/unit/api/openapi-webhook-estado-actualizado.test.ts`, que siguen afirmando `X-Ordenex-Signature` literal |
| R12 | tests existentes que afirman la clave literal, sin cambios y verdes: `tests/components/descarga/CierresDescargaColumnas.test.tsx`, `tests/components/OrdenesDescargaColumnas.test.tsx`, `tests/components/descarga/ProductosDescargaColumnas.test.tsx`, `tests/unit/hooks/useTonoAlIncrementar.test.tsx`, `tests/unit/guards/tema-encendido.guardia.test.ts` |
| R13 | `tests/unit/descarga/analitica-productos-descarga-columnas.test.ts`, `cierres-gestiones-fundida-descarga-columnas.test.ts`, `cierre-dia-descarga-columnas.test.ts`, `wallet-caja-descarga-columnas.test.ts` (encabezado nuevo literal + clave intacta) |
| R14 | `marca-fuente-unica-493.guardia.test.ts` (bloque «paridad con archivos estáticos») |
| R15 | `marca-fuente-unica-493.guardia.test.ts` (bloque «R15», con contraprueba sobre fuente sintética) |
| R16 | `marca-fuente-unica-493.guardia.test.ts` (bloque «R16: los tests no se anclan a su fuente», con contraprueba) |

## Fuera de alcance (no son requisitos de esta ficha)

- Comentarios de código y documentación técnica (`docs/` salvo `docs/ayuda/`, `specs/`, `progress/`, `CLAUDE.md`).
- Renombrar identificadores (`ingresoOrdenex`, `lib/utils/ingreso-ordenex.ts`, `netoOrdenex`…).
- Nombres de plantillas de Meta (`alerta_transito_ordenex`, `picking_bodega_ordenex`): no aparecen en el código (medido: 0 coincidencias en `lib/`); viven en Meta/la base.
- Lo que cubre la 492 (su design §1 y §3): la constante `MARCA`, metadatos y títulos de la app, manifiesto, `offline.html`, logo y su `alt`/`aria-label` (también en la landing), rótulo de la etiqueta (`EtiquetaGuia`, `ROTULO_GUIA`), PDFs de informes de tránsito/picking, remitente del correo (`DEFAULT_FROM_NAME = MARCA.nombre`), títulos de `/api-docs` y de la OpenAPI, y portada/título/autor/pie de la guía de integración. La **prosa** de la landing y del cuerpo de la guía sí es de esta ficha (R8, R9). Si al implementar la 493 queda algo de la 492 con «Ordenex», la guardia de R15 lo detecta y se recoge aquí (ver `design.md §2 g`).
- `docs/api/CHANGELOG.md` (historial de versiones: es un registro, no se reescribe) y el nombre de archivo de la colección Postman.
- Datos ya guardados en la base (p. ej. el usuario sembrado «Maestro Ordenex»): ver P5.
- `scripts/` y `e2e/` (no se ejecutan en el gate; `e2e/` se actualiza por coherencia en T13, sin requisito).

## Preguntas abiertas

- **P1 — Forma corta en etiquetas.** ¿Las etiquetas cortas usan `MARCA.nombreCorto` («Cobró Velox», «Total Velox», si la P1 de la 492 fija «Velox») o `MARCA.nombre` completo («Cobró Velox Courier», «Total Velox Courier»)? Afecta a columnas estrechas de tablas y descargas. Si el humano quiere en etiquetas una forma distinta del `short_name` de la app, hace falta un campo nuevo en `MARCA`: sería una **dependencia de la 492** (la 493 no lo añade).
- **P2 — Razón social en ejemplos.** Los placeholders «Ej: Ordenex CR S.A.» (`components/shared/sinpe-textos.ts`, `CrearZonaForm.tsx`) y los ejemplos «Ordenex S.A.» de `lib/types/plantilla-datos.ts` (`ejemplo`, `sinpeNombre`): ¿cuál es la razón social de Velox Courier, o se usa un ejemplo genérico («Ej: Mi Empresa S.A.»)?
- **P3 — Nombre de la app instalada: depende de la 492.** El aviso de ubicación denegada («Aplicaciones → … → Permisos») usa `MARCA.nombreCorto`, que es el `short_name` del manifiesto; su valor lo resuelve la P1 de la 492 (recomendado «Velox»). Esta ficha no decide nada aquí.
- **P4 — Cabeceras de webhook.** `X-Ordenex-Signature` y `X-Ordenex-Timestamp` son contrato con integradores y se conservan (R11). ¿Se quiere una ficha aparte para renombrarlas con periodo de doble cabecera, o quedan así indefinidamente?
- **P5 — Datos persistidos.** ¿Se renombran en otra ficha los textos ya guardados en la base (usuario «Maestro Ordenex» de la migración `20260709120000_seed_maestro_user`, y cualquier descripción o nota guardada que diga «Ordenex»)? Antes habría que medir con un `SELECT … ILIKE '%ordenex%'` de solo lectura.
- **P6 — Dominio y correos.** `ordenex.co` aparece en ejemplos de variables de plantilla (`urlBase`, `ejemplo`), en el ejemplo de la OpenAPI (`app.ordenex.co`), en el ejemplo de aviso interno y en `mailto:soporte@ordenex.co` (asunto VAPID de push). Se dejan fuera hasta que exista el dominio de Velox (el traspaso del dominio está pendiente). ¿Confirmado?
- **P7 — Remitente del correo: depende de la 492.** Su design (§3.9) fija `DEFAULT_FROM_NAME = MARCA.nombre` en `lib/config/email.ts`. La 493 no lo toca; su guardia solo comprobará que ya no dice «Ordenex».
- **P8 — Aviso a tiendas por los encabezados.** Cambiar «Cobró Ordenex»/«Total Ordenex» en las descargas puede romper a quien procese esos archivos por nombre de columna. No hay audiencia medida (la integración por máquina es la API, no las descargas). ¿Se avisa a las tiendas o basta con la nota de la release?
