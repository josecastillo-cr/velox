# Revisión ficha 501 — Fechas de Pagos registrados en hora de Costa Rica

Rama `fix/501-pagos-registrados-fecha-cr`, HEAD revisado `3291f771`. Diff medido con
`git diff origin/dev...HEAD`; `origin/dev` es `c565b38e` y es la base de fusión (la rama no va atrás).
El MCP `codebase-memory` no conectó (timeout): la búsqueda se hizo con `git grep` y lectura de archivos.

## Veredicto: RECHAZADO

**Solo por un bloqueante de proceso: T6 sigue abierta.** El código y los tests no tienen bloqueantes, y
el arreglo no necesita ningún cambio de código. Con cerrar B1 la ficha queda lista, sin repetir la
revisión del código.

## Hallazgos

### BLOQUEANTE

**B1. T6 sin marcar, y el resultado del gate no consta en el disco de la ficha.**
`specs/501-fechas-pagos-registrados-cr/tasks.md:49` sigue `[ ]`, y su criterio de hecho (`:55`) pide
`INIT_EXIT=0`. El gate medido dio `INIT_EXIT=1` (`progress/gate_501.log:3903`, archivo ignorado por git).
`progress/impl_501.md:108` aún dice «Pendiente». Falla el punto 2 de la revisión y el primer bloque de
`CHECKPOINTS.md`. T7 está marcada aunque depende de T6.

Qué falta, sin tocar código y sin repetir el gate (regla 5 de `CLAUDE.md`):

1. Anotar en `progress/impl_501.md` el resultado: los cuatro rojos, su causa y la repetición aislada.
2. Corregir el criterio de T6 para que recoja el resultado real y marcarla `[x]`. Sin esa corrección, la
   marca afirmaría un `INIT_EXIT=0` que nunca se midió.

Por el log, los rojos no apuntan a esta ficha, que no toca base de datos ni migraciones:

| Test | Causa en el log |
|---|---|
| `marca-fuente-unica-493` | timeout de 20 s en un censo de archivos |
| `ranking-snapshot-migration` | deadlock `40P01` |
| `498-satelite-migraciones` | filas ajenas en `wallet_movimiento`: 3 con categorías de satélite donde el test espera 1 |
| `iva-488-migration` | el `check` de `wallet_movimiento` lo viola alguna fila ya existente |

Los dos últimos también cayeron en la repetición dentro del gate. Pasaron tras limpiar los datos, según el
leader. No repetí estos cuatro: son ajenos a la ficha y el encargo limita las corridas.

### Menores

**m1. La guardia no ve el alias por referencia ni dos formas de recorte (R10).**
`tests/unit/guards/cierres-fecha-cr-495.guardia.test.ts:116-118`. Medido con mutaciones:

| Forma | Guardia | Pruebas de comportamiento |
|---|---|---|
| `const dia = fechaDiaISO;` y `dia(...)`, en cada uno de los 4 sitios de instante | 0 rojos | 6 rojos |
| `p.registradoAt.split("T", 1)[0]` | 0 rojos | 6 rojos |
| `p.registradoAt.slice(0, "YYYY-MM-DD".length)` | 0 rojos | 6 rojos |

La regresión no pasa: la suite cae igual. Lo que no se cumple es la letra de R10, «nombrando el archivo y la
línea», porque el rojo nombra el test y no el sitio. Hoy ningún archivo usa estas formas (ver «Caminos que
quedan»). Arreglo opcional: prohibir también `fechaDiaISO` sin paréntesis fuera del `import` y aceptar más
argumentos en el `split`. El alias solo sobre `fechaPago` sobrevive a todo, y es inocuo.

**m2. R9 no se cumple con un texto que empieza por una fecha (`lib/utils/fecha-dia-iso.ts:80`).**
Sonda directa sobre `fechaDiaInstanteCR`:

| Entrada | Salida | R9 pide |
|---|---|---|
| `2026-13-99T00:00:00.000Z` | `2026-13-99` | tal cual |
| `2026-08-03 basura` | `2026-08-03` | tal cual |
| `2026-08-03T25:00:00Z` | `2026-08-03` | tal cual |
| `2026-02-30T00:00:00.000Z` | `2026-03-01` | tal cual; aquí inventa una fecha |

Los tests de R9 solo usan `pendiente`, que sí sale intacto, igual que el texto vacío y textos largos.
Hoy es inalcanzable: los tres orígenes son `createdAt.toISOString()`
(`lib/repositories/LiquidacionPagoRepository.ts:94,104,447`). Por eso es menor. La función es de la 495 y
D1 la deja sin tocar; si se quiere la letra exacta, es una ficha aparte.

**m3. `/wallet/tiendas` no tiene test permanente en la frontera.**
`tests/components/PagosTiendaEstadoCuenta.test.tsx` solo usa `2026-09-20T16:00:00.000Z`. Ver «Límite de la
verificación en la app»: no bloquea. Un caso de frontera ahí fijaría la observación que hoy solo hice con una
sonda temporal.

## Comprobaciones

### Trazabilidad: cada requisito contra una mutación propia

Arnés propio, en un worktree desechable y ya desregistrado; `w501` no se mutó. Comprobó su base (70 tests, 0
rojos) antes de empezar, ejecutó 70 tests en cada una de las 25 mutaciones y terminó igual, con el árbol limpio.
Los esperados son literales: ningún test nuevo compara contra `fechaCalendarioCR` ni contra la función que prueba.

`T` = `tests/components/PagosRegistradosTabla.test.tsx`;
`D` = `tests/unit/descarga/pagos-registrados-descarga-columnas.test.ts`;
`G` = `tests/unit/guards/cierres-fecha-cr-495.guardia.test.ts`.

| Req | Test | Mutación que lo mata (rojos) |
|---|---|---|
| R1 | `T:524` | tabla `registradoAt` a `fechaDiaISO` (7) |
| R2 | `T:529` | tabla `anuladoAt` a `fechaDiaISO` (7) |
| R3 | `D:227` | descarga `registradoEl` a `fechaDiaISO` (7) |
| R4 | `D:232` | descarga `anuladoEl` a `fechaDiaISO` (7) |
| R5 | `T:542`, `D:243` | cada uno de los 4 sitios a `fechaDiaMovimientoCR` (3 cada uno); desfase de 5 h (4) y de 7 h (2) |
| R6 | `T:550`, `D:250` | `fechaPago` a `fechaDiaInstanteCR`: tabla (24), descarga (3) |
| R7 | `T:557` | cae con las mutaciones de la descarga, a `fechaDiaISO` y a `fechaDiaMovimientoCR` |
| R8 | `D:119`, `T:202`, `T:574` | vigente con texto en tabla (3); `anuladoEl` con la fecha de registro (1) o con texto vacío (1) |
| R9 | `T:579`, `D:258` | `fechaCalendarioCR(new Date(...))` directo: `registradoAt` en tabla (1), `anuladoEl` en descarga (1) |
| R10 | `G:123` en adelante | cada reversión a `fechaDiaISO` (1 en la guardia, entre los 7 de arriba) |

Volver tabla y descarga a su versión de `origin/dev`, con los tests nuevos: **14 rojos**, 13 de comportamiento
y la guardia. Coincide con T1 y T2.

Con `fechaPago` mutada en la tabla caen 24 tests porque `filaDe` localiza la fila por ese texto. Aparte de ese
efecto, las aserciones de `T:550` y `D:250` son literales y son las que fijan el requisito.

### Frontera y `fechaPago`

- **`T00:00:00.000Z`, en tabla y descarga, para registro y anulación:** da el día anterior. Lo prueban `T:542` y
  `D:243`, junto con `T05:59:59.999Z` (día anterior), `T06:00:00.000Z` (mismo día), cambio de mes y de año.
- **`fechaPago` no se mueve:** sigue en `fechaDiaISO` en `PagosRegistradosTabla.tsx:98` y
  `pagos-registrados-descarga-columnas.ts:69`. El repositorio ya la entrega como `YYYY-MM-DD` (`:92`).
- **Independencia de la zona del equipo:** los 3 archivos dan 70 de 70 con `TZ` en `UTC`,
  `America/Costa_Rica`, `Asia/Tokyo` y `Pacific/Kiritimati`.

### Caminos que quedan

Buscado en `app/`, `components/` y `lib/`:

- **`registradoAt`/`anuladoAt` en `app/` y `components/`:** solo en `PagosRegistradosTabla.tsx:80,129` y
  `pagos-registrados-descarga-columnas.ts:75,78`, los cuatro con `fechaDiaInstanteCR`. El resto son comentarios.
- **`fechaDiaISO` en `components/shared/liquidacion`:** los dos `import` y las dos llamadas sobre `fechaPago`.
- **Alias por referencia:** ninguno en `app/`, `components/` ni `lib/` (`= fechaDiaISO`, `(fechaDiaISO)`,
  `as`, `fechaDiaISO` pasado como argumento).
- **Texto de anulación:** `liquidacion-labels.ts:86` solo interpola, sin recortar.
- **Descarga:** solo sale por `filasLocales(pagos, filaDescargaPagoRegistrado)` (`PagosRegistradosTabla.tsx:237`).
  No hay ruta de servidor para esta descarga.

**No queda ningún camino vivo que pinte estos instantes por `fechaDiaISO`.**

### Límite de la verificación en la app: basta, no es bloqueante

- **`/wallet/tiendas`:** usa la misma tabla (`PagosTiendaEstadoCuenta.tsx:73`) y el mismo mapeo de datos
  (`LiquidacionService.ts:985,995` y `toDTO` en `LiquidacionPagoRepository.ts:516,543`). Además monté
  `PagosTiendaEstadoCuenta` en una sonda temporal, con registro en `T00:00:00.000Z` y anulación en
  `T05:59:59.999Z`: dio `2026-08-02` y `Anulado por Ana el 2026-08-03`, con `fechaPago` intacta. No es ver la
  pantalla, pero no queda ninguna diferencia de código entre las dos que pueda cambiar el día.
- **R8 en frontera:** el comportamiento no depende de la hora, y sus tests mueren con las mutaciones.
- **R9:** inalcanzable con los datos actuales (m2), así que no hay nada que ver en pantalla.

Conviene mirar `/wallet/tiendas` cuando haya un pago de tienda real, sin que eso retenga la ficha.

### Tasks y CHECKPOINTS

| Punto | Estado |
|---|---|
| Spec con EARS, alternativas descartadas y tasks | OK |
| Todas las tasks `[x]` | **NO**: T6 (B1) |
| Mapa de requisitos a tests en `progress/impl_501.md` | OK, los nombres existen |
| `typecheck` y `lint` | OK en el log del gate (`gate_501.log:14` y `:465`) |
| Tests de la ficha y guardias de T6 | OK, corridos por mí: 70 de la ficha; 24 entre las otras guardias de T6 y el montaje de tienda |
| Gate `--rapido` | `INIT_EXIT=1`; ver B1 |
| E2E en flujo crítico | No aplica: no hay harness E2E, el cambio es solo de lectura y T7 lo vio con el navegador |
| RLS, migraciones, webhooks | No aplica: el diff no toca base de datos ni rutas |
| Secretos | OK: ni en el diff ni en este informe |
| Capas y permisos | OK: solo cambian dos archivos de presentación |
| Sin hardcode de contexto | OK: el desfase vive en `lib/utils/fecha-cr.ts`, reutilizado |
| `./init.sh` completo | No se exige aquí: solo antes de una release a `prod` (regla 5) |
| `progress/history.md` | Pendiente por diseño: es posterior al merge (`AGENTS.md`, F2.6) |

### Lo que no verifiqué

- **La evidencia de T7:** no volví a abrir la app ni el xlsx. Doy por buena la tabla de `impl_501.md` porque
  coincide con los tests.
- **La restauración de los `created_at` en la base local:** no consulté la base, por el otro gate en curso.
- **La repetición aislada de los cuatro rojos:** es dato del leader; del log solo leí la primera medición y su
  repetición interna.

**Repo público:** `progress/impl_501.md` no lleva credenciales. Sí lleva ids y textos de filas de la base local
y un correo de prueba `.test` que ya aparece en otros informes del repo. Lo anoto para que quede a la vista; no
es un hallazgo.
