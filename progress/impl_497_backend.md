# Ficha 497 — bitácora del BACKEND

> Rama `fix/497-confirmacion-fisica-sin-gestion`, worktree `wt-497`, nacida de `c6442be8` (dev con
> la 499). Spec aprobado por el humano el 2026-11-02. Tras el backend entra el frontend_dev en el
> mismo worktree. Búsqueda de código: MCP `codebase-memory` disponible. Las rutas exactas salieron
> del design (citadas con línea) y se confirmaron leyendo cada archivo.

## Decisiones recibidas

- **Q1:** la 451 está cancelada y esta ficha la sustituye.
- **Q2 (leader):** la guardia `aprobacion-escrituras-cubiertas` recibe **una entrada y un caso
  nuevos** para `tx.cierreSinGestion.updateMany`. No cambia ninguna aserción existente: su diff solo
  añade líneas, 27 en total. Nada de SQL crudo.
- **Puerta de despliegue:** resuelta, bodega está avisada.
- **Migración:** `20261102170000_cierre_sin_gestion_confirmacion_fisica`. Va después de la 499
  (`20261102130000/130100`, ya en dev) y de la 496 (`20261102150000`, en paralelo).

## Commits por task

| Task | Commit | Qué |
| --- | --- | --- |
| T1 | `ea0eca43` | Tests en ROJO. T1.1 (servicio): `esperaba validation_error y llego ok`. T1.2 (Postgres): `expected 'ok' to be 'validation_error'` y `expected [] to deeply equal [Array(1)]`. 2 de 2 en rojo, ninguno saltado. |
| T2 | `98b74278` | Columna en `schema.prisma`, migración + `down.sql`, test de la migración (12 casos verdes), alta en el censo `posteriores` de `orden-traspaso-migration.test.ts`. |
| T3.1 | `5bf38cf1` | `OrigenDelPaquete`, `RETORNO_POR_ORIGEN`, `PaqueteDelCierre` y `vuelveABodegaElPaquete`, añadidos debajo de la línea 61 sin tocar las 33-61. Tests del eje (incluido el `@ts-expect-error`) y dos casos con autocomprobación en `confirmacion-incidentes-excluidos`. Rojo previo: 6 de 25. |
| T3.2 + T3.3 | `9df971ff` | `findBarridasDelCierre`, el contrato en unión y la escritura `tx.cierreSinGestion.updateMany` en el bloque de la 238. Entrada y caso en la guardia. Rojo previo: 7 de 25 en la suite del repo y la guardia en rojo por la escritura sin declarar. |
| T3.4 | `dd4f5545` | Unión `.strict()` en el borde. Rojo previo: 3 de 18. |
| T3.5 | `cbb14898` | Servicio. `findBarridasDelCierre` vacío en los fakeRepo; `cierreSinGestion.findMany` vacío en los dos dobles de Prisma de `cierres-admin-service.test.ts`; caso R29/R39 en `cierres-admin-service.aprobar.sin-gestion.test.ts`. |
| T3.6 | `5ba72cd5` | Integración completa (15 casos verdes, ninguno saltado). `confirmacionDe` del escenario 454 incluye las barridas. El doble de `devolucion-rechazadas-flow` gana `cierreSinGestion` vacío. |

**Una decisión que va más allá del design (R16):** una barrida sin guía congelada y **sin** entrada
devuelve `MSG_CONFIRMACION_SIN_GUIA`, no `FALTANTE`. La pantalla no puede mandar una entrada sin
guía, porque el borde exige un entero positivo. Si el mensaje dijera «falta confirmar», bodega
buscaría un paquete escaneable que no existe. Las gestiones conservan el comportamiento de la 238.

**Mensaje AJENA en una barrida:** se reutiliza tal cual, «Esta gestión no pertenece…», porque el
design §5.2 dice «no hay mensaje nuevo». Si el frontend o el humano quieren otro texto para las
barridas, es un cambio de una línea.

## Migración: up / down / up (base local compartida, `localhost:5432`)

1. **UP:** `prisma migrate deploy` → `Applying migration 20261102170000_…` → «All migrations have been
   successfully applied».
2. **DOWN:** `prisma db execute --file …/down.sql` → «Script executed successfully». Después se borró
   su fila de `_prisma_migrations` con `db execute`. `migrate status` → «have not yet been applied:
   20261102170000_cierre_sin_gestion_confirmacion_fisica».
3. **DOWN otra vez** (idempotencia) → «Script executed successfully».
4. **UP:** `migrate deploy` → aplicada. `migrate status` → «Database schema is up to date!».

Sin `migrate reset` y sin `db:rollback`. El test de la migración ejecuta además el down real dos
veces dentro de una transacción que se revierte.

`prisma generate` escribe en el `node_modules` compartido (junction al checkout principal), y la
columna existe ahora en la base compartida. Ni wt-495 ni wt-496 tocan `schema.prisma`, así que el
cliente no les quita nada. Durante el down/up hubo unos segundos sin la columna.

## Mapa R → test (backend)

| R | Test |
| --- | --- |
| R1, R2, R3 | `tests/unit/types/gestion-retorno.test.ts` (bloque «RETORNO_POR_ORIGEN», incluido el `@ts-expect-error`) |
| R4 | `tests/unit/guards/confirmacion-incidentes-excluidos.guardia.test.ts` (bloque «Ficha 497», con autocomprobación) |
| R5-R9 | `tests/unit/repositories/cierres-admin-confirmacion-fisica.test.ts` («497/R5-R9») + `tests/integration/db/497-confirmacion-barridas-sql-real.test.ts` («A · la lectura del repositorio», «R9/R19») |
| R10-R18, R20, R21 | `tests/unit/services/cierres-admin-confirmacion-fisica.test.ts` (bloques «497/…») + integración «B · el bloqueo» |
| R13, R18 (forma), R19 (payload) | `tests/unit/types/cierres-admin-confirmacion-schema.test.ts` (bloque «497») |
| R19 | servicio «R9/R19» + integración «R9/R19» (UI: frontend) |
| R22, R23, R24, R27, R28 | repo unit «497/R22-R24» y «497/R27/R28» (incluido «TESTIGO del `cierreId` de la barrida») + integración «C · lo que se persiste» |
| R24 (datos congelados), R29, R39 | integración (congelados antes = después; huella de dinero y totales iguales con y sin barridas) + `cierres-admin-service.aprobar.sin-gestion.test.ts` («497/R29/R39») + `[=]` `cierre-sin-gestion-sin-dinero.guardia.test.ts` |
| R25, R41 | `tests/integration/db/497-cierre-sin-gestion-confirmacion-migration.test.ts` |
| R26 | `[=]` `confirmacion-sin-lectores.guardia.test.ts` (verde) |
| R40 | `[=]` `tests/unit/repositories/cierres-admin-caja-cod.test.ts`: `git diff c6442be8..HEAD` sobre el archivo, **vacío**; suite verde |
| R30-R38 | **frontend** (pendiente) |

## Contraprueba por mutación (una a una; restaurado con `git checkout`, diff tras restaurar = 0 en todas)

| # | Mutación | Rojo |
| --- | --- | --- |
| 1 | servicio: barridas fuera del conjunto esperado | 13 rojos, entre ellos T1.1 |
| 2 | servicio: no comparar contra la guía congelada | R15 |
| 3 | repo: quitar `cierreId` del WHERE de la marca | R22 y TESTIGO del `cierreId` de la barrida |
| 4 | repo: `data` con otra clave | R22, R24 y «mezcla» |
| 5 | repo: quitar `count !== ordenIds.length` | TESTIGO y R23 (unit); R23 (integración, savepoint real) |
| 6 | repo: quitar el alcance de `findBarridasDelCierre` | R6/R7 y R7 |
| 7 | punto único: `barrida: "nunca"` | 15 rojos (eje de origen + servicio, T1.1 incluido) |
| 8 | `down.sql` suelta otra columna | forma estática + down real (R41) |

Las mutaciones 7 y 8 del design (UI) son del frontend.

## Verificación (salida real)

- `pnpm exec tsc --noEmit` → exit 0.
- `pnpm exec eslint` sobre los archivos tocados → exit 0.
- `pnpm exec vitest related --run` sobre los 6 archivos de `lib/` tocados → **372 archivos, 4380 tests en
  verde**, exit 0.
- Unit de services, repositories de cierres-admin, types y guardias de confirmación: 403 archivos.
  Tras arreglar los dobles, verde.
- `integration/db` de cierres/aprobación (filtros 454/, 455/, cierre*, liberacion*, confirmacion*,
  484-*, 497*, devolucion-rechazadas*, correccion*, corte* y actions/cierres-admin): 116 archivos,
  797 tests. Hubo dos rojos y se corrieron aislados:
  - `devolucion-rechazadas-flow.test.ts`: le faltaba `cierreSinGestion` a su doble de Prisma.
    Corregido; 9 de 9 en verde.
  - `cierre-bloqueo-nv-sql-real.test.ts`: 2 rojos en la corrida conjunta, **verde aislado** (18 de 18).
    Queda anotado como **intermitente**; probablemente la base compartida con los gates de
    wt-495/496.
- Las cinco guardias de design §8, a mano: 5 archivos, 46 tests en verde.
- Integración 497: 15 de 15; migración 497: 12 de 12. Ninguno saltado.
- `./init.sh` **no** se corrió: lo corre el frontend al final (orden del leader).

## Para el FRONTEND: lo que falta y el contrato

**Tareas:** T4.1, T4.2, T4.3, T4.4, T5.1 (mutaciones 7 y 8 de la UI) y T5.2 (`./init.sh --rapido`,
las guardias a mano y el PR). T3.7 queda a medias a propósito: el gate lo corre el frontend.

**El contrato que se deja:**

- Server Action `aprobarCierre({ cierreId, indemnizaciones?, confirmacionFisica? })`.
  `confirmacionFisica` es un array de entradas de dos formas:
  - `{ gestionId: uuid, numGuia: int > 0 }` para una gestión, la forma de siempre;
  - `{ ordenId: uuid, numGuia: int > 0 }` para una barrida (`ordenId` de `detalle.ordenesSinGestion`).
    `numGuia` es la guía **congelada** de la barrida (`CierreOrdenSinGestion.numGuia`).

  Las dos ramas son `.strict()`: una clave extra, o las dos claves a la vez, dan `VALIDATION_ERROR`.
  Sin barridas, el payload es idéntico al de hoy (R19).
- El servidor exige cobertura exacta de gestiones que vuelven ∪ **todas** las barridas del cierre.
  Los errores llegan en `fieldErrors` indexados por `gestionId` o por `ordenId`, con los mensajes de
  la 238:
  - faltante;
  - ajena: el texto dice «gestión» también para las barridas;
  - duplicada;
  - guía distinta;
  - sin guía: una barrida sin guía congelada lo recibe **aunque no se envíe**.
- `pedirAprobacion` tiene que abrir la ventana si hay barridas aunque no haya gestiones que vuelvan
  (R38). Si no lo hace, el servidor rechaza el aprobado de un clic.
- `repartirErroresDelServidor`: las claves de confirmación pasan a ser `gestionIds ∪ ordenIds` (R36).
- Rótulo «Novedad interna» (la guardia `nombres-estado-retirados` prohíbe «sin gestionar»).
- `vuelveABodegaElPaquete({ origen: "barrida" })` de `lib/types/gestion-retorno.ts` es el punto único.
  La guardia `confirmacion-incidentes-excluidos` pone en rojo cualquier `barrida: true` o
  `vuelve… = x.origen === "barrida"` en `app/`. Un `if (fila.origen === "barrida")` para pintar sí
  está permitido.

## Abiertos / riesgos

- **Conflicto de merge seguro con la 496** en la lista `posteriores` de
  `orden-traspaso-migration.test.ts`: las dos añaden su línea al final. Hay que resolverlo
  conservando ambas, en orden de prefijo.
- `cierre-bloqueo-nv-sql-real.test.ts` es intermitente en la corrida conjunta (ver arriba).
- Se tocaron dobles de tests ajenos, siempre con altas neutras (`findBarridasDelCierre` →
  `[]`, `cierreSinGestion.findMany` → `[]`), en 12 archivos de `tests/unit/services` y en
  `devolucion-rechazadas-flow`. También cambió el escenario compartido de la 454
  (`confirmacionDe`). Ninguna aserción existente cambió.

**Veredicto:** el backend de la 497 está completo y verificado (tsc, related, integración de
cierres, guardias y 9 de 9 mutaciones muertas); queda la UI y el gate final del frontend.
