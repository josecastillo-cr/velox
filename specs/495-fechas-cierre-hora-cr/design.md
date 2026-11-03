# 495 — Fechas de cierre en hora de Costa Rica · design

> Lee antes `requirements.md` (tabla S1–S7 de sitios medidos). Arreglo mínimo: solo cambia CÓMO se
> obtiene el día de un instante en las pantallas de cierres y en sus descargas. Ningún DTO,
> repositorio, servicio, ruta, migración, texto ni formato cambia.

## 1. Modelo de datos

Sin cambios. Las tres columnas son `timestamp` (`CierreDia.solicitadoAt/resueltoAt`,
`db/schema.prisma:1440,1442`; `CierreBodega.solicitadoAt/resueltoAt/conciliadoAt`, `:1495,1497,1503`)
y viajan al cliente como ISO completo en UTC (p. ej. `CierresAdminRepository.ts:804`,
`cierreSolicitadoAt: g.cierre.solicitadoAt.toISOString()`). Sin migración, sin RLS nueva.

## 2. La utilidad única: cuál existe y qué falta

Confirmado en `lib/utils/fecha-cr.ts:47-53`: **`fechaCalendarioCR(now: Date): string`** es el único
cálculo del día de Costa Rica del repo (UTC−6 fijo, `YYYY-MM-DD`). Ya la usan para fechas de
cierre `CierresBodegaAdminModule.tsx:881` y `cierre-factura.tsx:2233`. **No se reescribe ni se
duplica el desfase.**

Lo que NO existe es una entrada para un instante que llega como **texto** y que sea segura en una
descarga:

- `fechaDiaISO` (`lib/utils/fecha-dia-iso.ts:25`) recorta el texto: es el defecto.
- `fechaDiaMovimientoCR` (`:48`) delega en `fechaCalendarioCR`, pero trata la medianoche UTC exacta
  (`T00:00:00.000Z`) como una fecha `@db.Date` y devuelve su día SIN desfase. Eso es correcto para
  los ledgers de la wallet (mezclan las dos convenciones, ficha 172/459) e **incorrecto para un
  `timestamp`**: un cierre solicitado a las 18:00:00.000 de CR saldría con el día siguiente (R6).
- Las descargas no pueden llamar a `fechaCalendarioCR(new Date(x))` a pelo sin perder el rastro de la
  sonda de `tests/unit/descarga/columnas-sensibles.guardia.test.ts` (su proxy responde a cualquier
  lectura; el comentario de `fecha-dia-iso.ts:12-17` explica por qué la proyección debe emitir el
  marcador TAL CUAL).

## 3. Decisión

### 3.1 Una función nueva, delgada, en el mismo módulo

En `lib/utils/fecha-dia-iso.ts`, junto a sus dos hermanas:

```ts
/** Ficha 495 — día de Costa Rica de un INSTANTE (`timestamp`) que llega como texto ISO. */
export function fechaDiaInstanteCR(valor: string): string
```

Contrato:

| Entrada | Salida |
|---|---|
| ISO que empieza por `YYYY-MM-DD` y es un instante válido | `fechaCalendarioCR(new Date(texto))` — sin excepción de medianoche |
| cualquier otra cosa (texto vacío, no-fecha, la sonda) | `fechaDiaISO(String(valor))`, es decir, el valor TAL CUAL (R8) |

Es la misma forma que `fechaDiaMovimientoCR` sin la rama de medianoche: `String(valor)` primero,
`DIA_ISO.test` + `Number.isNaN` después. El cálculo sigue siendo `fechaCalendarioCR`; esta función
solo decide qué darle. Va con un JSDoc que diga cuándo usar cada una de las tres
(`fechaDiaISO`: ya es un día; `fechaDiaMovimientoCR`: ledgers de la wallet con fechas `@db.Date`
mezcladas; `fechaDiaInstanteCR`: un `timestamp` puro).

### 3.2 Pantallas (S1–S3)

- **S1** `cierre-factura.tsx:306-308`: el helper local `fecha(iso)` pasa a
  `iso ? fechaDiaInstanteCR(iso) : "—"`. Firma y «—» intactos (R7); sus ocho llamadores
  (`:653,741,1072,1078,1138,1182,2542,2544`) no se tocan. Se actualiza el comentario de `:305`
  y el de `:47-49` (ya no hay `slice` que explicar en el archivo, salvo dentro del comentario).
- **S2/S3** `CierreDiaModule.tsx:935,1026`: `c.solicitadoAt.slice(0, 10)` →
  `fechaDiaInstanteCR(c.solicitadoAt)` (y lo mismo con `cierreAbierto.solicitadoAt`).

Se usa la misma función en pantalla y en descarga para que R5 se cumpla por construcción.

### 3.3 Descargas (S4–S7)

`fechaDiaISO(cierre.<x>At)` → `fechaDiaInstanteCR(cierre.<x>At)` en:

- `cierres-admin-descarga-columnas.ts:71,104`
- `cierres-bodega-descarga-columnas.ts:144,177,239`
- `cierre-dia-descarga-columnas.ts:256`
- `cierres-gestiones-fundida-descarga-columnas.ts:422` (y se reescribe el comentario de `:423-427`,
  que hoy justifica `fechaDiaISO` para `fechaCierre`).

Las ramas `=== null ? null : …` se conservan (celda vacía, R7). Claves, encabezados y orden de
columnas no cambian (R4). Tras el cambio, ninguno de los cuatro archivos importa `fechaDiaISO`.

### 3.4 Guardia (R9)

`tests/unit/guards/cierres-fecha-cr-495.guardia.test.ts`, calcada de
`wallet-fecha-cr-459.guardia.test.ts` (mismo `quitarComentarios` de
`tests/fixtures/sin-comentarios.ts`, que NO se modifica):

- Carpetas: `app/(app)/cierres-admin` y `app/(app)/cierre-dia`, recursivo, `.ts`/`.tsx`.
- Formas prohibidas, sin lista de excepciones:
  - `/\.(?:slice|substring|substr)\(\s*0\s*,\s*10\s*\)/`
  - `/\.split\(\s*["'`]T["'`]\s*\)/`
  - `/\bfechaDiaISO\s*\(/` — cualquier llamada: en estas carpetas toda fecha que llega como ISO es
    un instante, y las que ya son día (`fechaGestion`, `diaReparto`, `fechaCreacionOrden`) se copian
    sin pasar por ninguna función (`cierres-gestiones-fundida-descarga-columnas.ts:428-434`).
- Medido el 2026-11-02: fuera de comentarios, esas formas solo aparecen en S1–S7 (en las dos
  carpetas no hay otro `slice(0, 10)`, ni `split("T")`; el `cierreId.slice(-8)` de `folio` no
  coincide). Tras el arreglo la lista de hallazgos queda vacía sin excepciones.
- Suelo anti-vacío: `revisados > 30` (hoy son ~39 entre las dos carpetas según `query_graph`;
  el implementer anota el número real que cuente la guardia).
- Contraprueba sobre texto sintético: las formas de antes saltan; `fechaDiaInstanteCR(c.solicitadoAt)`
  y un comentario `// antes: iso.slice(0, 10)` no.
- La guardia lee archivos con `fs`: normaliza `\r\n` antes de partir por líneas (CRLF invisible) y,
  como el grafo no la relaciona con el diff, se corre a mano además del `--rapido` (T7).

## 4. Contratos I/O

Sin endpoints ni server actions nuevos. Único contrato nuevo: `fechaDiaInstanteCR(valor: string):
string` (§3.1). Las filas de descarga mantienen su tipo `DescargaFila` y sus claves.

## 5. Alternativas descartadas

- **A1 — Reusar `fechaDiaMovimientoCR`** (lo que hacen `/wallet/satelites` y `RepartoPrevisualizacion`
  para `solicitadoAt`). Descartada: su rama de medianoche UTC exacta devuelve el día SIN desfase,
  que para un `timestamp` es justo el defecto que esta ficha corrige, en el instante
  `T00:00:00.000Z` (R6 lo fija con un test). Se deja tal cual en la wallet: allí la rama es necesaria
  y tocarla es otro alcance.
- **A2 — `fechaCalendarioCR(new Date(iso))` en línea en cada sitio** (como `CierresBodegaAdminModule:881`).
  Descartada para las descargas: con la sonda de `columnas-sensibles.guardia` emite `NaN-NaN-NaN` y
  pierde el rastro del campo; y repetirlo en los 10 sitios (S1–S7) son 10 sitios donde pantalla y descarga
  pueden divergir (R5). En pantalla funcionaría, pero usar la misma función que la descarga es lo
  que hace R5 cierto por construcción.
- **A3 — Formatear con `Intl.DateTimeFormat(…, { timeZone: "America/Costa_Rica" })`** como `diaCR`
  de satélites. Descartada: cambia el formato (`16 sep` frente a `YYYY-MM-DD`) que anclan los tests
  de comprobante y de descarga; es rediseño, no arreglo.
- **A4 — Que el servidor mande ya el día (`solicitadoDia`, …) en los DTO.** Descartada: toca
  repositorios, interfaces y tipos de tres módulos para un defecto de presentación; fuera del
  «arreglo mínimo» pedido.
- **A5 — Guardia con lista de excepciones** (dejar pasar `slice(0, 10)` sobre textos que ya son día).
  Descartada por mandato del origen («sin excepciones») y porque en estas carpetas no hay ningún
  caso que la necesite (medido, §3.4).

## 6. Riesgos y verificación

- **Fixtures existentes con instantes 00:00–05:59 UTC.** Medido: `tests/unit/actions/cierre*-descarga-action.test.ts`
  (fixtures `T00:00:00.000Z`) y `tests/components/CierresAdminModule.test.tsx:1187,1200`
  (`resueltoAt: "2026-07-12T00:00:00.000Z"`). Ninguno afirma hoy ese día literal (grep de
  `2026-0[2-4]-0[5-6]"` y `2026-07-1[12]"` sin coincidencias), pero T5 lo confirma ejecutándolos. Si
  alguno afirmara el día UTC, se corrige el **esperado** al día de Costa Rica (es el comportamiento
  nuevo), nunca el fixture para esquivarlo.
- **Gate.** `./init.sh --rapido`. El diff no toca dinero ni datos (`lib/utils/` no amplía a
  `integration/db`), ni el propio gate, ni `tests/fixtures/sin-comentarios.ts`.
- **Ver la app** (memoria «verificar lo que el usuario ve»): no hay E2E; T8 pide una comprobación
  visual de una tarjeta y un comprobante con un cierre local de después de las 18:00 CR, si hay
  dev server disponible; si no, se declara inaplicable en `progress/impl_495.md`.
