# 495 — Fechas de cierre en hora de Costa Rica · requirements

> Ficha 495 (`feature_list.json`). Zona `frontend`, complejidad `small`, sin dependencias.
> Origen: bloque 1 de H5 de `progress/prompt-hotfix-portable.md` y el inventario
> `progress/inventario_hotfix_H2_H3_H5.md` §3. Decisiones del humano (2026-11-02): rama desde `dev`,
> gate `./init.sh --rapido`, sale con la próxima release. **Arreglo mínimo de lo evidenciado, sin
> rediseño**: ni DTO, ni base, ni formato nuevos.
> Spec escrito el 2026-11-02. Sitios localizados con el MCP `codebase-memory`
> (`R-job-singularis-projects-ordenex`: `search_code`, `query_graph`, `get_file_outline`) y
> confirmados uno a uno en el archivo real con `grep`/lectura.

## Contexto medido (2026-11-02, rama `dev`)

**Síntoma.** Pasadas las 18:00 de Costa Rica (00:00 UTC), las tarjetas, los comprobantes y las
descargas de cierres muestran el día SIGUIENTE.

**Causa.** El día se obtiene recortando el ISO en UTC: `iso.slice(0, 10)` en pantalla y
`fechaDiaISO(iso)` (el mismo recorte, por expresión regular) en las descargas. Las tres columnas
afectadas son `timestamp` (`db/schema.prisma:1440,1442` en `CierreDia`; `:1495,1497,1503` en
`CierreBodega`), nunca `@db.Date`.

Sitios con el defecto (todos confirmados en el archivo):

| # | Archivo:línea | Qué pinta | Superficie |
|---|---|---|---|
| S1 | `app/(app)/cierres-admin/_components/cierre-factura.tsx:306-308` (`fecha(iso)`) | Lo usan `:653` (conciliado el), `:741` (tarjeta del cierre del mensajero), `:1072`/`:1078` (solicitado/resuelto de la hoja de resumen), `:1138` (tarjeta del cierre de bodega), `:1182` (tarjeta del cierre propio del mensajero), `:2542`/`:2544` (comprobante en papel: «Solicitado … · Resuelto …») | tarjetas y comprobantes de los tres tipos de cierre |
| S2 | `app/(app)/cierre-dia/_components/CierreDiaModule.tsx:935` | nombre accesible «Ver detalle del cierre del …» | cierres propios del mensajero |
| S3 | `app/(app)/cierre-dia/_components/CierreDiaModule.tsx:1026` | cabecera del detalle «estado · fecha · destino» | cierres propios del mensajero |
| S4 | `app/(app)/cierres-admin/_components/cierres-admin-descarga-columnas.ts:71,104` | columnas «Fecha» y «Fecha resuelta» | descarga de cierres del mensajero |
| S5 | `app/(app)/cierres-admin/_components/cierres-bodega-descarga-columnas.ts:144,177,239` | «Fecha», «Fecha resuelta», «Fecha solicitud» | descargas de cierres de bodega |
| S6 | `app/(app)/cierre-dia/_components/cierre-dia-descarga-columnas.ts:256` | «Fecha» | descarga de los cierres propios del mensajero |
| S7 | `app/(app)/cierres-admin/_components/cierres-gestiones-fundida-descarga-columnas.ts:422` | columna `fechaCierre` (encabezado `FECHA_CIERRE_COL`, valor `cierreSolicitadoAt`) | descarga detallada de gestiones del cierre |

Ya correctos (no se tocan): `CierresBodegaAdminModule.tsx:881` y `cierre-factura.tsx:2233` (pasan
por `fechaCalendarioCR`); `/wallet/satelites` (`diaCR` con `timeZone: America/Costa_Rica`, y su
descarga con `fechaDiaMovimientoCR`), `/wallet` y `/mi-wallet` (ficha 459, con su guardia
`wallet-fecha-cr-459.guardia.test.ts`).

Glosario:

- **Fecha de un cierre**: la de solicitud (`solicitadoAt`), la de resolución (`resueltoAt`) y la de
  conciliación (`conciliadoAt`) de un cierre del mensajero, de un cierre de bodega o de un cierre
  propio del mensajero.
- **Día de Costa Rica de un instante**: la fecha `YYYY-MM-DD` del calendario de Costa Rica (UTC−6
  fijo, sin horario de verano) en la que cae ese instante.
- **Pantallas de cierres**: el código de `app/(app)/cierres-admin/**` y `app/(app)/cierre-dia/**`.

## Requisitos

### Pantallas

- **R1** (ubicuo) — El sistema DEBE mostrar cada fecha de un cierre del mensajero (solicitado y
  resuelto) en su tarjeta, en su hoja de resumen y en su comprobante como el día de Costa Rica de
  ese instante, en formato `YYYY-MM-DD`.
- **R2** (ubicuo) — El sistema DEBE mostrar cada fecha de un cierre de bodega (solicitado, resuelto
  y «conciliado el») en su tarjeta, en su hoja de resumen y en su comprobante como el día de Costa
  Rica de ese instante, en formato `YYYY-MM-DD`.
- **R3** (ubicuo) — El sistema DEBE mostrar la fecha de un cierre propio del mensajero en su
  tarjeta, en el nombre accesible de su botón «Ver detalle», en la cabecera de su detalle y en su
  comprobante como el día de Costa Rica de ese instante, en formato `YYYY-MM-DD`.

### Descargas

- **R4** (por evento) — CUANDO una persona descarga cierres del mensajero, cierres de bodega
  (cualquiera de sus tres variantes), cierres propios del mensajero o el detalle de gestiones de un
  cierre, el sistema DEBE escribir en cada columna de fecha de un cierre (claves `fecha`,
  `fechaResuelta`, `fechaSolicitud` y `fechaCierre`) el día de Costa Rica de ese instante, en formato
  `YYYY-MM-DD`, sin cambiar la clave, el encabezado ni el orden de la columna.
- **R5** (ubicuo) — Para un mismo cierre, el día que el sistema escribe en la descarga DEBE ser
  idéntico al que muestra en pantalla.

### Casos límite

- **R6** (por evento) — CUANDO el instante de una fecha de cierre cae entre las 00:00 y las 05:59
  UTC, el sistema DEBE mostrarlo y descargarlo con el día ANTERIOR del calendario UTC
  (`2026-11-01T05:03:00Z` → `2026-10-31`; `2026-11-01T00:00:00.000Z` → `2026-10-31`), y CUANDO cae
  a partir de las 06:00 UTC, con el mismo día UTC (`2026-11-01T06:00:00Z` → `2026-11-01`).
- **R7** (condicional) — SI una fecha de cierre está ausente, ENTONCES el sistema DEBE mostrar lo
  mismo que hoy: «—» donde hoy se pinta «—», la pieza omitida donde hoy se omite (p. ej. «Resuelto»
  de un cierre sin resolver), y celda vacía en la descarga; nunca `NaN` ni `Invalid Date`.
- **R8** (condicional) — SI el valor que recibe una columna de fecha de una descarga de cierres no
  es un instante legible, ENTONCES el sistema DEBE emitirlo tal cual, sin recortarlo ni
  transformarlo (el comportamiento de hoy para ese caso).

### Guardia

- **R9** (condicional) — SI un archivo `.ts`/`.tsx` de las pantallas de cierres contiene, fuera de
  comentarios, un recorte de diez caracteres (`slice`, `substring` o `substr` con `(0, 10)`), un
  corte por la «T» del ISO (`split("T")`) o una llamada a `fechaDiaISO`, ENTONCES la suite DEBE
  fallar nombrando archivo y línea. La guardia NO admite lista de excepciones.

### Incidentes (ampliación del 2026-11-02)

> Ampliación decidida por el humano el 2026-11-02 (cierra P1): `/incidentes` entra en esta ficha.
> `OrdenIncidente.createdAt` y `resueltoAt` son `timestamp` (`db/schema.prisma:1361,1363`) y viajan
> como ISO en UTC (`IncidenteAdminRepository.ts:166,168`). Sitios re-medidos el 2026-11-02 en el
> archivo real:

| # | Archivo:línea | Qué pinta |
|---|---|---|
| I1 | `app/(app)/incidentes/_components/IncidentesAdminModule.tsx:485` | «Reportado el» del detalle |
| I2 | `IncidentesAdminModule.tsx:501` | «Resuelto por … · fecha» del detalle |
| I3 | `IncidentesAdminModule.tsx:771` | columna «Fecha» de la cola de pendientes |
| I4 | `app/(app)/incidentes/_components/IncidentesHistoricoTabla.tsx:193` | columna «Fecha resuelta» del histórico |
| I5 | `app/(app)/incidentes/_components/incidentes-descarga-columnas.ts:51,85` | columnas `fecha` y `fechaResuelta` de las dos descargas |

I5 no estaba en el encargo (que citaba cuatro sitios) pero tiene el mismo recorte (`fechaDiaISO`) y
es la descarga de las mismas tablas: sin él, pantalla y descarga divergirían (R11) y la guardia de
R13 no podría quedar verde sin excepciones.

- **R10** (ubicuo) — El sistema DEBE mostrar la fecha de reporte (`createdAt`) y la de resolución
  (`resueltoAt`) de un incidente —en la columna «Fecha» de la cola de pendientes, en la columna
  «Fecha resuelta» del histórico y en «Reportado el» / «Resuelto por … · fecha» del detalle— como
  el día de Costa Rica de ese instante, en formato `YYYY-MM-DD`, con los mismos límites que R6.
- **R11** (por evento) — CUANDO una persona descarga la cola de pendientes o el histórico de
  incidentes, el sistema DEBE escribir en las columnas `fecha` y `fechaResuelta` el día de Costa
  Rica de ese instante, idéntico al que muestra la pantalla, sin cambiar clave, encabezado ni orden.
- **R12** (condicional) — SI la fecha de resolución de un incidente está ausente, ENTONCES el
  sistema DEBE mostrar lo mismo que hoy: «—» en el histórico, el detalle sin la pieza «· fecha», y
  celda vacía en la descarga; nunca `NaN` ni `Invalid Date`.
- **R13** (condicional) — SI un archivo `.ts`/`.tsx` de `app/(app)/incidentes/**` contiene, fuera de
  comentarios, alguna de las formas prohibidas de R9, ENTONCES la suite DEBE fallar nombrando
  archivo y línea, sin lista de excepciones (la misma guardia de R9, ampliada a esta carpeta).

## Trazabilidad prevista (R → test)

| R | Test |
| --- | --- |
| R1 | `tests/components/cierres-fechas-cr-495.test.tsx` — bloque «R1»: `CierreFacturaResumen` (tarjeta + hoja de resumen) y `CierreFacturaDetalle` (comprobante en papel) con `solicitadoAt`/`resueltoAt` = `2026-11-01T05:03:00Z` pintan `2026-10-31` y NO `2026-11-01` |
| R2 | mismo archivo, bloque «R2»: `CierreBodegaFacturaResumen` con `solicitadoAt`, `resueltoAt` y `conciliadoAt` = `2026-11-01T05:03:00Z` pinta `2026-10-31` en «Solicitado», «Resuelto» y «Conciliado el» |
| R3 | mismo archivo, bloque «R3»: `CierreFacturaResumenPropio` pinta `2026-10-31`; y `tests/components/CierreDiaModule.test.tsx`, bloque nuevo «495»: el botón tiene nombre accesible «Ver detalle del cierre del 2026-10-31» y la cabecera del detalle contiene `2026-10-31` |
| R4 | `tests/unit/descarga/cierres-fechas-cr-495.test.ts` — `filaDescargaCierrePendiente`, `filaDescargaCierreHistorico` (S4), `filaDescargaBodegaPendiente`, `filaDescargaBodegaResuelto`, `filaDescargaBodegaSolicitado` (S5), `filaDescargaDiaCierrePasado` (S6) y `filaDescargaGestionFundida` (S7) emiten `2026-10-31` para `2026-11-01T05:03:00Z`; más una aserción de que clave/encabezado/orden de cada columna siguen iguales (los tests existentes `cierres-*-descarga-columnas.test.ts` siguen verdes sin tocarlos) |
| R5 | `tests/unit/descarga/cierres-fechas-cr-495.test.ts`, bloque «R5»: para el mismo fixture, la celda de la descarga es igual al texto de fecha que pinta la pantalla (ambos con el literal `2026-10-31`, no uno contra otro) |
| R6 | `tests/unit/utils/fecha-dia-iso.test.ts` (nuevo) — la utilidad de §3 del design con los tres instantes literales de R6 (`05:03Z` → `2026-10-31`, `00:00:00.000Z` → `2026-10-31`, `06:00Z` → `2026-11-01`) |
| R7 | `tests/components/cierres-fechas-cr-495.test.tsx`, bloque «R7»: cierre con `resueltoAt: null` y `conciliadoAt: null` no pinta `NaN`, `Invalid Date` ni la pieza «Resuelto»; `tests/unit/descarga/cierres-fechas-cr-495.test.ts`: `fechaResuelta` con `resueltoAt: null` es `null` (celda vacía). Los tests existentes de `CierreFacturaPapel.test.tsx` (`:772-840`) siguen verdes sin tocarlos |
| R8 | `tests/unit/utils/fecha-dia-iso.test.ts`: texto vacío y un texto que no es fecha se devuelven tal cual; y `tests/unit/descarga/columnas-sensibles.guardia.test.ts` sigue verde sin tocarlo (su sonda conserva el rastro del campo) |
| R9 | `tests/unit/guards/cierres-fecha-cr-495.guardia.test.ts` (nuevo), con contraprueba: el detector salta con las formas de antes (`iso.slice(0, 10)`, `c.solicitadoAt.slice(0, 10)`, `fechaDiaISO(cierre.solicitadoAt)`, `x.substring(0, 10)`, `iso.split("T")[0]`), no salta con la forma nueva ni dentro de un comentario, y revisa más de 30 archivos |
| R10 | `tests/components/incidentes-fechas-cr-495.test.tsx` (nuevo): `IncidentesAdminModule` con `createdAt`/`resueltoAt` = `2026-11-01T05:03:00Z` pinta `2026-10-31` (y no `2026-11-01`) en la columna «Fecha» de la cola, en «Fecha resuelta» del histórico y en «Reportado el» / «Resuelto por» del detalle |
| R11 | `tests/unit/descarga/cierres-fechas-cr-495.test.ts`, bloque «R11»: `filaDescargaIncidentePendiente.fecha` y `filaDescargaIncidenteHistorico.fechaResuelta` = `2026-10-31` (literal, el mismo que el test de pantalla); `incidentes-descarga-columnas.test.ts` sigue verde sin tocarlo |
| R12 | `tests/components/incidentes-fechas-cr-495.test.tsx`, bloque «R12»: histórico con `resueltoAt: null` pinta «—» y no `NaN`/`Invalid Date`; `tests/unit/descarga/cierres-fechas-cr-495.test.ts`: `fechaResuelta` con `resueltoAt: null` es `null` |
| R13 | `tests/unit/guards/cierres-fecha-cr-495.guardia.test.ts`: la lista de carpetas incluye `app/(app)/incidentes` y un caso afirma que se revisan archivos de esa carpeta |

## Fuera de alcance (no son requisitos de esta ficha)

- `/wallet/satelites`, `/wallet` y `/mi-wallet`: ya pintan el día de Costa Rica (fichas 431 y 459) y los vigila `wallet-fecha-cr-459.guardia.test.ts`. No se tocan, aunque su utilidad (`fechaDiaMovimientoCR`) trate distinto la medianoche UTC exacta (ver `design.md §5`).
- Fechas que ya llegan del servidor como día calendario (`fechaGestion`, `diaReparto`, `fechaCreacionOrden` de la hoja fundida; `fechaReprogramacion`): no son instantes y no se tocan.
- Servidor y base: ningún DTO, repositorio, migración ni formato cambia. `lib/utils/jornada-cierre.ts:113,123,134` corta un `Date` de medianoche UTC (día calendario), no una fecha de pantalla.
- Bloques 2 a 9 de H5 (dependen de H3/H4 o no aplican, inventario §3).

## Preguntas abiertas

- **P1 — Incidentes.** CERRADA el 2026-11-02: el humano decide incluir `/incidentes` en esta ficha
  (R10–R13).
