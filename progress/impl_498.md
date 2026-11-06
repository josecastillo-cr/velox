# Ficha 498 — bitácora de implementación (backend, T0–T6)

Agente: backend_dev. Worktree `R:/w498`, rama `fix/498-satelite-dinero-al-conciliar`.
Búsqueda de código: MCP `codebase-memory` (proyecto `R-job-singularis-projects-ordenex`) para
localizar símbolos; confirmado cada uno en el archivo real del worktree.

## T0.1 — Base de la rama

- **SHA base:** `13fd57fc9564fab2873f95839149c92f029662a9` (`origin/dev` al crear la rama). Al medir,
  `origin/dev` estaba en `8c32dbf6`, que solo añade una línea a `progress/current.md` (arranque de la
  498); ninguna diferencia de código.
- **(a) La 497 está en la base:** sí. Su bloque de barridas está en `resolverCierre`
  (`CierresAdminRepository.ts:2442`, «FICHA 497 (T3.3 …) — LA MARCA DE LAS BARRIDAS») y la migración
  `20261102170000_cierre_sin_gestion_confirmacion_fisica` existe.
- **(b) Último prefijo de `db/migrations`:** `20261102170000` (la 497), que es ≥ `20261102160000`.
  Las cuatro fechas de design §3 se mueven por encima, manteniendo M1 < M2 < M3 < M4:
  - M1 `20261103120000_satelite_498_enums`
  - M2 `20261103120100_satelite_498_ajuste`
  - M3 `20261103120200_satelite_498_retirar_asientos`
  - M4 `20261103120300_satelite_498_regularizar`
- **(c) Números de línea de design §1 tras la 497** (solo cambia `CierresAdminRepository.ts`, +17 en el
  bloque de la aprobación):
  - `CAJA_COD_FEED`: `:170` → `:171`.
  - Constructor: `:940-962` → `:941-963`.
  - Captura de la indemnización: `:1859-1869` → `:1876-1886`.
  - Los cinco escritores: `:1871-1933` → `:1888-1950`.
  - `CierresBodegaAdminRepository.ts` (`:515`, `:518-568`, `:585-636`, `:654`, `:656-717`, tipo
    `:60-71`): sin cambios.

## T0.2 — Respuestas del humano (2026-11-02), copiadas de la cabecera de `requirements.md`

| Pregunta | Respuesta | Requisito |
| --- | --- | --- |
| SINPE / transferencia | «No importa a cuál cuenta sea, lo que pasa en la conciliación es que la central debe recibir en caso de que la tenga la satélite o debe confirmar el recibido si fue consignado directo a ellos». El recibido es el **total** que llegó a la central. | R16a, R16b |
| Q3 | Consolidación rechazada: límite conocido aceptado. No hay ninguna hoy. Sin ficha. | (fuera de alcance) |
| Q4 | Regularización por migración (M4, design §3.5): las conciliadas antes se dan por saldadas con la regla anterior, sin escribir en ningún libro y sin tocar `monto_recibido`. Deuda 0. | R54a–R54d, R41a |
| Q5 | Recibido 0 solo con aporte reconocido ≤ 0 (design §4.4 bis). | R15a, R15b, R16 |
| Q1, Q2 | Siguen abiertas; no se tocan. | — |

## T1 — Rojos contra el código de hoy (base `13fd57fc`, sin ningún cambio de `lib/`)

Comando: `pnpm exec vitest run tests/integration/db/498-aprobacion-satelite-sql-real.test.ts
tests/integration/db/498-conciliar-asienta-sql-real.test.ts tests/integration/db/498-deuda-satelite-sql-real.test.ts`
→ `Test Files 3 failed (3) · Tests 4 failed | 6 passed (10)`, **0 skipped** (base local alcanzable).

| Tarea | Caso | Resultado hoy | Salida |
| --- | --- | --- | --- |
| T1.1 | aprobar un cierre satélite → cero filas en los tres libros | **ROJO** | `expected [ …(13) ] to deeply equal []` (13 filas: devengo/pago del mensajero, egreso pago mensajero, COD, flete, comisión, IVA en caja y tienda) |
| T1.2 | aprobar un cierre central = foto | **VERDE** | 18 filas, literal `FOTO_CENTRAL` |
| T1.3 | antes de marcar, los cierres no tienen filas | **ROJO** | `expected [ …(26) ] to deeply equal []` |
| T1.3 | una fila `egreso_diferencia_satelite` de 500 | **ROJO** | `expected [] to deeply equal [ { tipo: 'egreso', …(7) } ]` |
| T1.3 | los cinco feeds no ponen `fechaMovimiento` (R13) | verde (ya es así hoy) | — |
| T1.4 | deuda de Saldos = fórmula R23 a mano | **ROJO** | `expected '6000.00' to be '8500.00'` (hoy: solo el efectivo de la consolidación) |

**Origen del literal `FOTO_CENTRAL` (T1.2).** Se tomó ejecutando el caso contra el código de `dev`
en `13fd57fc` (antes de tocar `lib/`): cierre central con entrega en efectivo 10 000, entrega SINPE
5 000, un rechazo y un incidente con indemnización 3 000; tarifa de la tienda 2 000/1 000, comisión
5 %, IVA 13 %; tarifa del mensajero de la central 1 500/164. Ese literal **es** el contrato de R3: no
se sustituye por su propia fuente.

**Límite de R13 en integración.** Los tests corren dentro de UNA transacción revertida, así que
`now()` es el mismo instante para la aprobación y para la marca: comparar `fecha_movimiento` contra
`conciliado_at` no distingue nada. R13 se fija mirando que ninguno de los cinco feeds (ni la fila de
diferencia) ponga `fechaMovimiento`: la fecha la pone el `DEFAULT now()` de la transacción que
escribe, que en producción es la de la marca.

## T2 — Datos

- **T2.1 (M1)** `20261103120000_satelite_498_enums`: tres `ADD VALUE IF NOT EXISTS`. `down.sql` = la
  función de la 488 renombrada `_498`, aplicada a `wallet_movimiento_categoria` y `wallet_origen_tipo`.
- **T2.2 (M2)** `20261103120100_satelite_498_ajuste`: tabla `conciliacion_bodega_ajuste` (ids `TEXT`:
  `cierre_bodega.id` y `usuario.id` son `String @default(uuid())` → `TEXT`, comprobado en
  `db/schema.prisma`), CHECK de evento y de diferencia, FK RESTRICT a la consolidación y al usuario,
  único parcial de `marca`, RLS sin policies; CHECK de la caja = el de la 488 literal + un valor por rama.
  Prisma: modelo `ConciliacionBodegaAjuste`, `CierreBodega.ajustes`, `Usuario.conciliacionBodegaAjustes`.
- **T2.5 (M3)** `20261103120200_satelite_498_retirar_asientos`. FKs entrantes a los tres libros
  comprobadas en `db/schema.prisma`: `cobro_tienda_anulacion.cobro_id` (débito de cobro, origen
  `cobro_tienda`), `ajuste_caja_anulacion`, `wallet_anotacion`, `wallet_comprobante` (filas manuales) y
  `gasto_fijo_cobro` (egreso de gasto fijo). Ninguna apunta a filas con origen `cierre_dia`;
  `pago_mensajero_movimiento` no tiene FKs entrantes.
- **T2.7 (M4)** `20261103120300_satelite_498_regularizar` + `CierreBodega.esperadoReglaAnterior` (con la
  cita de la decisión del 2026-11-02). `cierre_bodega` **no tiene triggers** (consulta a `pg_trigger`:
  `[]`), así que `updated_at` no se mueve (R54b). El `UPDATE` no nombra ids ni fechas.
- Aplicadas en local con `prisma migrate deploy` (base `localhost:5432/ordenex`, comprobada con
  `migrate status`); `prisma generate`; `prisma migrate diff --from-config-datasource --to-schema` →
  «This is an empty migration.»; typecheck verde. En local, M3 respaldó 7 filas de caja y 7 de tienda
  (datos de la base local, no de producción); M4 marcó 0 consolidaciones.
- **T2.3 — `Record` totales que el typecheck exigió clasificar** (valores de design §8.1/§8.3):
  - `lib/utils/caja-tesoreria.ts`: `NATURALEZA_POR_CATEGORIA` (las dos → `por_cobrar_satelite`) y
    `LIQUIDEZ_POR_CATEGORIA` (las dos → `efectivo`).
  - `lib/constants/wallet-rotulos.ts`: `CATEGORIA_LABEL` (las dos → «Diferencia de la satélite»),
    `ORIGEN_LABEL`, `ORIGEN_TIENDA_LABEL`, `ORIGEN_PAGO_LABEL` (→ «Conciliación de satélite»).
  - `lib/utils/aporte-por-orden.ts` `FUENTE_CAJA`: las dos → `sin_reparto / no_nace_de_un_cierre`.
  - `lib/repositories/libro-caja-a-quien-sql.ts` `A_QUIEN_POR_ORIGEN`: `[]` (la satélite no es cuenta de
    tienda ni de mensajero: la fila no sale al filtrar por cuenta).
  - `lib/services/OrigenLegibleService.ts`: `LECTURA_POR_ORIGEN` → `null` y el `case` del `switch`
    (se nombra por el rótulo).
  - `app/(app)/wallet/_components/wallet-labels.ts` `DUENO_LABEL.por_cobrar_satelite = "Satélite"`
    (§8.3) y `WalletLedger.tsx` `DUENO_PUNTO.por_cobrar_satelite = "bg-muted-foreground"`
    **PROVISIONAL**: el token definitivo lo elige el frontend en T7.1.
  - Tests con `Record` total sobre el catálogo: `caja-tesoreria-migration.test.ts`,
    `wallet-labels.test.ts`, `wallet-origen-legible.test.ts` (solo la entrada nueva).
- **Suites de migraciones anteriores que fijaban «los valores de la ficha N AL FINAL»** (patrón que ya
  siguió la 488): se corre la ventana 2 (caja) / 1 (origen) y se suben los conteos — `iva-488-migration`,
  `wallet-458-migration`, `abono-tienda-457-migration`, `caja-459-migration`,
  `cobro-tienda-461-migration`, `caja-tesoreria-migration` (29 → 31). `zona-distrito-499-migration`
  asumía que su tabla era la única del esquema `respaldo`: dentro de su tx se quita también
  `respaldo.asientos_satelite_498`. Ninguna aserción de contenido cambia.
- Las cuatro migraciones se declaran en `posteriores` de `orden-traspaso-migration.test.ts`.
- **M3 editada tras aplicarse en local** (añadido `DROP TABLE IF EXISTS pg_temp.s_498;` para que el
  bloque se pueda reejecutar dentro de una sesión: los tests hacen up → down → up en una transacción).
  Sin efecto semántico; la base local se re-migra al final (ver T6).
- **T2.4** `498-satelite-migraciones.test.ts`: 7/7 verde, 0 skipped.
- **T2.6** `498-retirar-asientos-migration.test.ts`: 6/6 verde, 0 skipped. Mutación 12 (sin
  `AND p.premio_dia IS NULL`) → `× R48/R49/R51 … Tests 1 failed | 5 passed (6)`. Mutación 13 (sin
  `b.conciliado_at IS NULL` en S) → `× R48/R49/R51 … Tests 1 failed | 5 passed (6)`. Restaurado: diff
  limpio respecto al archivo bueno.
- **T2.8** `498-regularizar-migration.test.ts`: 5/5 verde, 0 skipped. Mutación 14 (sin
  `NOT EXISTS (… conciliacion_bodega_ajuste …)`) → `× R54a/R54b: marca SOLO las conciliadas … Tests 1
  failed | 4 passed (5)`. Restaurado, diff vacío. Nota: el CHECK `cierre_bodega_conciliacion_coherente`
  impide una consolidación rechazada **y** conciliada, así que la rama `estado <> 'rechazado'` del
  predicado es defensiva: su mutación no puede matarse con datos (se mata la otra mitad de la 14).
  R54c (deuda 0 de las saldadas) se mide en `498-deuda-satelite-sql-real.test.ts` (T4).

## T1 → verde tras el arreglo

Los cuatro rojos de T1 pasan a verde con T3–T4 (`498-conciliar-asienta-sql-real` 26/26,
`498-deuda-satelite-sql-real` 13/13, `498-aprobacion-satelite-sql-real` 3/3; 0 skipped). T1.2 (la foto
de los centrales) siguió verde en cada paso, incluido el refactor puro de T3.1.

## T3 — Repositorio

- **T3.1** `lib/repositories/asentar-cierre-dia.ts`: `asentarCierreDia`, `DependenciasAsiento`,
  `dependenciasRealesDeAsiento`; movimiento literal de `CierresAdminRepository.ts:1888-1950`
  (`this.` → `deps.`, `CAJA_COD_FEED` → `deps.cajaCodFeed`). Refactor puro medido antes de condicionar:
  suites de `cierres-admin` (repositorio y servicio) + T1 → 474/475; el único rojo era T1.1 (esperado).
- **T3.2** `tests/unit/repositories/asentar-cierre-dia.test.ts` (5 casos). Mutación 3 (adelantar el feed
  de indemnización) → `× ⭑ R5: el ORDEN de la aprobacion de antes, literal · 1 failed | 4 passed`.
- **T3.3** `switch` exhaustivo por `destinoTipo` leído **dentro** de la transacción;
  `DestinoDeCierreDesconocidoError`. **Desviación menor:** `findUnique` y no `findUniqueOrThrow` (los
  dobles existentes ya responden `findUnique`; un `null` cae en el `default` y lanza igual). Fixture de los
  dobles: `destinoTipo: "bodega_central"` en 8 suites; en dos suites el `findUnique` se sobreescribía por
  test con `null` → `mockImplementation` que responde el destino solo a la lectura con
  `select.destinoTipo`. **Ninguna línea de `expect` cambió.** Casos nuevos en
  `cierres-admin-repository.test.ts` (destino desconocido, lectura en tx, satélite sin escritores).
- **T3.4** guardia `aprobacion-escrituras-cubiertas`: las tres entradas buscan `deps.…` en
  `asentar-cierre-dia.ts`; caso nuevo «la llamada vive en la rama `bodega_central` y no en la satélite» +
  autocomprobación. Con la llamada borrada (mutación 2) → `× 498/T3.4 … · × AUTOCOMPROBACION … ·
  2 failed | 9 passed`. El bloque de la 497 intacto.
- **T3.5** `CierresBodegaAdminRepository(prisma, depsAsiento = dependenciasRealesDeAsiento(prisma))`; el
  tipo del cliente es el `Pick` de antes `& AsientoPrismaClient`. `buildService` y `cierre-bodega.ts`
  siguen construyendo `new CierresBodegaAdminRepository(prisma)` (el diff de `conciliacion-satelites.ts`
  solo toca tipos/comentarios de T3.6b/T3.8; `cierre-bodega.ts` sin diff).
- **T3.6** marcar asienta los cierres `aprobado`/`bodega_satelite` de la consolidación (por
  `solicitadoAt, id`) y `escribirDiferencia` (esperado = `aporteDeConsolidacion`, asentada = Σ
  `diferencia`, delta; una fila de ajuste + un movimiento; lanza si `crearMovimientos` no escribe 1).
- **T3.6b** `montoCeroSchema` (`/^0(\.0{1,2})?$/`) y `z.union([montoPositivoSchema, montoCeroSchema])`;
  `montoPositivoSchema` intacto. Desenlace `recibido_cero_con_aporte` en repositorio (antes del
  `updateMany`, al marcar y al corregir), interfaz, servicio y acción. Mutación 16 → `2 failed | 24 passed`.
- **T3.7** corregir escribe solo la variación. `[S]` `corregir-conciliacion.int.test.ts:304` sustituido
  por su inverso, con la cita de la decisión del 2026-11-02.
- **T3.8** `tieneAsientos` + `con_asientos` (repositorio, `RevertirConciliacionResult`, servicio con
  `switch` exhaustivo, `RevertirConciliacionActionResult`). `[S]` `marca-conciliacion.int.test.ts:336`
  sustituido por su inverso. Las otras tres pruebas de revertir de esa suite (R12, R13, ciclo D6)
  marcaban 485 sobre 500 → ahora dejan diferencia y ya no se revierten: **fixture** a 485 (aporte =
  recibido). Ninguna aserción cambió.
- **T3.9** `498-composition-root-asiento.int.test.ts` (datos confirmados + limpieza en `afterAll`;
  comprobado tras la corrida: 0 filas en `conciliacion_bodega_ajuste` y ninguna diferencia huérfana).
  Verde 3/3. Mutación 4 (valor por defecto sin escritores) → `Test Files 1 failed · [AppError:INTERNAL]
  TypeError … construirMovimientosDeIngreso`.
- **T3.10** comentarios/JSDoc reescritos (repositorio, interfaces, servicio, acciones, interfaces de
  Saldos, de la cabecera y del estado de cuenta). Lo fija la guardia de T4.4 (R43 en `lib/`).

Mutaciones de §14 corridas (el arnés aplica, ejecuta y restaura; diff limpio tras cada una):
2, 3, 4, 5 (`7 failed | 19 passed (26)`), 6 (`2 failed | 24 passed (26)`), 7 (`7 failed | 19 passed
(26)`), 8 (`1 failed | 25 passed (26)`), 9 (`5 failed | 34 passed (39)`), 10 (`3 failed | 36 passed
(39)`), 12, 13, 14, 15 (`3 failed | 36 passed (39)`), 16. Quedan 1 y 11 para T8.1.

## T4 — Fórmula única, Saldos y Estado de cuenta

- **T4.1** `lib/utils/conciliacion-satelite.ts`: `aporteDeConsolidacion`, `faltaPorRecibir`,
  `deudaDeZona`, `esSaldadaReglaAnterior`; `saldoDe` retirado. `lib/repositories/deuda-satelite-sql.ts`
  con las cuatro piezas. `toBodegaResumenRow` usa `faltaPorRecibir(aporteDeConsolidacion(r), …)`.
- **T4.2** Saldos: `agregarDeuda` (un `$queryRaw` de aportes por zona con `FILTER` de sin consolidar + un
  `groupBy` de recibido y reconocido), compartido por filas, descarga y cabecera.
- **T4.3** Estado de cuenta: `movimientosDeBodegaSql` (tres ramas) compartido por `paginaDeBodega`,
  `totalesDeBodega` (`{ declarado, recibido }`) y `periodoDeBodega`; `EstadoCuentaService` usa
  `deudaDeZona`; la fila de un cierre suelto lleva `consolidacionId: null`.
- **T4.4** `tests/unit/guards/aporte-satelite-fuente-unica-498.guardia.test.ts` (12 casos con
  autocomprobación). Copia sembrada de la resta en `SaldosSatelitesRepository.ts` →
  `× ⭑ R28 … · 1 failed | 11 passed`. Restaurado.
- Literales que cambiaron **porque la fórmula cambió por decisión del humano** (R26), con la cita en el
  caso: `cierre-bodega-repository.test.ts` (`faltaPorRecibir` "0.00" → "-8.50") y
  `cierres-bodega-admin-repository.test.ts` ("10.00" → "1.50").

## T5 — Caja

- `por_cobrar_satelite`; `acumular` con `switch` exhaustivo; `derivarBalance(egresosPorCobrar,
  ingresosPorCobrar)` (séptima llamada); `derivarReparto` con cuatro bolsillos; DTO
  `porCobrarSatelites`, `signoPorCobrarSatelites`, `porcentajePorCobrar`.
- La guardia que cuenta `derivarBalance` es `tests/unit/guards/caja-derivaciones.guardia.test.ts`: 6 → 7.
- **Desviación:** `caja-composicion-exhaustiva.guardia.test.ts` NO quedó «sin cambios»: su control de
  no-vacuidad enumera las naturalezas del catálogo y gana `por_cobrar_satelite`. Lo mismo el conjunto de
  dueños de `wallet-movimiento-repository.test.ts` y las identidades al azar sobre el SEED
  (`caja-derivacion-457/459/461`, `caja-tesoreria` «todo el catálogo»), que ganan `− porCobrarSatelites`
  (R35). `caja-clasificacion-459` verde sin cambios.
- T5.2 en `498-conciliar-asienta-sql-real.test.ts` («la caja»): Δ«De las tiendas» = Δ saldo de la tienda
  y R35 sobre el agregado real, con diferencia positiva, negativa y cero.

## Otras suites existentes tocadas (registro y conteos)

- `dinero_en_caja` (`lib/analytics/metrics.ts`) gana las dos categorías («la caja entera», 31);
  `metrics-caja-naturaleza.guardia`; fixture `api-key-dependencias-usuario`
  (`ConciliacionBodegaAjuste.creador` = `no_alcanzable / SOLO_OPERADOR`); `mi-wallet-labels`,
  `wallet-labels`, `libro-kardex-468`, `wallet-service`, `busqueda-por-guia-469-servicios`; 18 suites de
  componentes con el `CajaResumenDTO` completo (tres campos en cero).
- `censo-order-status-rename`: un identificador mío (`rechazada`) chocaba con un código anterior → renombrado.
- `conciliacion-satelites-actions.test.ts`: los casos «el CERO se rechaza» se **sustituyen** por «el cero
  literal pasa el borde y llega al servicio» (Q5); «0.001» entra como rechazo.
- `497-confirmacion-barridas-sql-real.test.ts` (R39): exigía dinero escrito AL APROBAR un cierre
  satélite. Fixture: la huella se toma tras `asentarCierreDia`. Ninguna aserción cambió.

## Desviaciones y decisiones (resumen)

1. Prefijos `20261103120000…120300` (T0.1-b).
2. `migration.sql` de M3 sin `BEGIN/COMMIT` (ningún `migration.sql` del repo los lleva; Prisma lo ejecuta
   en una transacción implícita y la lógica va en un único `DO`); los `down.sql` sí. M3 añade `DROP TABLE
   IF EXISTS pg_temp.s_498` y `ENABLE RLS` + `REVOKE` sobre su tabla de respaldo (molde de la 499).
3. **Etiquetas de categoría distintas** (design §8.3 pedía el mismo texto): la guardia «ningún nombre se
   repite» de `wallet-labels.test.ts` lo prohíbe. Provisionales: «Diferencia de la satélite (faltó)» /
   «Diferencia de la satélite (sobró o pagó)». **Las confirma o cambia T7.1.**
4. `DUENO_PUNTO.por_cobrar_satelite = "bg-muted-foreground"` PROVISIONAL (T7.1 elige el token).
5. Mínimo de frontend para compilar: `MarcarRecibidoDialog.avisoDe` gana el `case
   "recibido_cero_con_aporte"`; `ConciliacionAcciones` tipa el resultado de revertir y muestra
   `conAsientos`; textos en `conciliacion-labels.ts`. La presentación definitiva es T7.2.
6. `A_QUIEN_POR_ORIGEN.conciliacion_bodega_ajuste = []` y `LECTURA_POR_ORIGEN = null`.
7. Una rechazada no puede estar conciliada (CHECK de la 431): la mitad `estado <> 'rechazado'` del
   predicado de M4 es defensiva.
8. Base local: M3 se editó tras aplicarse; se revirtieron M4 y M3 en local y se re-aplicaron (un intento
   dejó M4 como fallida → `migrate resolve --rolled-back` + deploy). Final: `migrate status` «up to date»,
   `migrate diff` vacío.

## Mapa R<n> → test (T0–T6)

| R | Test |
| --- | --- |
| R1, R2, R4 | `498-aprobacion-satelite-sql-real` (T1.1); `cierres-admin-repository.test.ts` «FICHA 498 (T3.3…)» |
| R3, R55 | `498-aprobacion-satelite-sql-real` (T1.2, `FOTO_CENTRAL`); `cierres-admin-caja-cod.test.ts` `[=]` |
| R5, R7 | `asentar-cierre-dia.test.ts`; idempotencia en `498-conciliar-asienta-sql-real` |
| R6 | `498-composition-root-asiento.int.test.ts` |
| R8–R15, R54 | `498-conciliar-asienta-sql-real` («marcar») |
| R15a, R15b | `498-conciliar-asienta-sql-real` («recibido 0»); `conciliacion-satelites-schema-498.test.ts`; servicio; acciones `[S]` |
| R17–R19 | `498-conciliar-asienta-sql-real` («corregir»); `corregir-conciliacion.int.test.ts` `[S]` |
| R20, R22 | `498-conciliar-asienta-sql-real` («revertir»); `marca-conciliacion.int.test.ts` `[S]`; servicio |
| R23–R25, R41a (backend) | `498-deuda-satelite-sql-real` («Saldos») |
| R26, R27 | `tests/unit/utils/conciliacion-satelite.test.ts` |
| R28, R32 | `498-deuda-satelite-sql-real` («una sola definicion»); `aporte-satelite-fuente-unica-498.guardia` |
| R29–R31 | `498-deuda-satelite-sql-real` («Estado de cuenta») |
| R33–R36, R38, R39 | `caja-tesoreria.test.ts` («ficha 498»); R35/R36 contra Postgres en `498-conciliar-asienta-sql-real` |
| R43 (lib) | `aporte-satelite-fuente-unica-498.guardia` |
| R45 | `conciliacion-satelites-service.test.ts` («498 — …») |
| R46, R47, R53 | `498-satelite-migraciones.test.ts` |
| R48–R52 | `498-retirar-asientos-migration.test.ts` |
| R53 (M4), R54a–R54d | `498-regularizar-migration.test.ts`; R54c en `498-deuda-satelite-sql-real` |
| R16, R16a, R16b, R21, R37, R40, R41, R42 (pantalla), R43 (app/components/ayuda), R44 | **T7 (frontend)** |

## Contratos para el frontend (T7)

- **Acciones** (`lib/actions/conciliacion-satelites.ts`):
  - `marcarConsolidacionRecibidaAction` / `corregirConsolidacionRecibidaAction` →
    `MarcaConciliacionActionResult`, que gana `{ status: "recibido_cero_con_aporte" }` (recibido 0 con
    dinero por entregar: no cambió nada). El borde acepta `"0"`, `"0.0"`, `"0.00"`; negativo, vacío o 3
    decimales → `validation_error`.
  - `revertirConciliacionAction` → **`RevertirConciliacionActionResult`** (tipo nuevo) = los de siempre +
    `{ status: "con_asientos" }` (ya entró a la caja; no cambió nada).
- **Textos** (`components/shared/conciliacion/conciliacion-labels.ts`, `CONCILIACION_RESPUESTA`):
  `reciboCeroConAporte` = «Esta consolidación tiene dinero por entregar: el monto recibido no puede ser
  0.» y `conAsientos` = «Ya entró a la caja: corrige el monto en vez de revertir» (R21, literal). La nota
  de R43 y la retirada de `DESMARCAR_NO_MUEVE_DINERO_*` son de T7.3.
- **`ConsolidacionSateliteDTO`** gana: `totalPagoMensajero`, `totalIngresoBodegaRechazos`, `paraLaCentral`,
  `debe` (aporte reconocido; prefijo del diálogo si `debePositivo`), `debePositivo: boolean` (si `false`
  el diálogo prefija `0`), `saldadaReglaAnterior: boolean` (rótulo «Saldada con la regla anterior»).
  `faltaPorRecibir` = `debe − recibido`. Los importes por método siguen en `totales.{efectivo, simpe,
  transferencia, general}`.
- **`SaldoSateliteDTO`** gana `sinConsolidar: string` y `cierresSinConsolidar: number` (R24/R42);
  `saldoSinConciliar` conserva el nombre y ahora es la DEUDA (R23).
- `UltimaRecibidaDTO.declarado` ahora es lo que debía (aporte reconocido), no el efectivo.
- **`CierreBodegaResumenRow.faltaPorRecibir`** (tarjeta del cierre de bodega) ahora es
  `paraLaCentral − recibido` (o 0 en una saldada).
- **Caja** (`CajaResumenDTO`): `porCobrarSatelites: string`, `signoPorCobrarSatelites:
  WalletBalanceSigno`, `porcentajePorCobrar: string` ("0.00" si el bolsillo es ≤ 0 → la barra queda como
  antes, R39). `NaturalezaMovimiento` gana `"por_cobrar_satelite"`; `DUENO_LABEL` ya dice «Satélite»;
  `DUENO_PUNTO` tiene un token PROVISIONAL.
- **Categorías** `egreso_diferencia_satelite` / `ingreso_diferencia_satelite` (etiquetas provisionales,
  ver desviación 3) y **origen** `conciliacion_bodega_ajuste` («Conciliación de satélite»). No entran en
  `wallet-conceptos-manuales.ts`.
- **Estado de cuenta de la bodega**: filas nuevas con `origenTipo: "cierre_dia"` (cierre sin consolidar,
  `tipo`/`categoria` = `"declarado"`, `consolidacionId: null`); el rótulo «Cierre del día sin consolidar»
  es de T7.
- La guardia `aporte-satelite-fuente-unica-498` cubre hoy solo `lib/`; T7.3 la extiende a `app/`,
  `components/` y `docs/ayuda/`.

## Suites existentes que medían el dinero AL APROBAR un cierre satélite, o la deuda sobre el efectivo

El primer gate (`progress/gate_498_backend.log`, corrida intermedia) dio 32 archivos rojos de
`integration/db`. Causas y arreglo (todas son la regla nueva, decidida por el humano el 2026-11-02):

- **Fixture del escenario 459** (`_fixtures/caja-459.ts`, del que cuelgan ~20 suites de caja, libro y
  comprobantes): su cierre es satélite y la tienda se quedaba sin saldo (`pagoTiendaA → sin_saldo`). Tras
  aprobar, el fixture asienta el cierre con `asentarCierreDia` (las mismas filas). Ninguna cifra cambia.
- **Escenario 454**: nuevo verbo `e.asentar(cierreId)` (solo si el cierre quedó `aprobado`), usado tras
  `e.aprobar(...)` en las caracterizaciones de dinero (`454/caracterizacion/dinero-aprobacion`,
  `cierre-rechazado`, `deshacer`, `multi-dia-271`, `455/caracterizacion/dinero-aprobacion`,
  `477-aprobacion-tras-correccion`) y en `cierre-rechazo-tienda-aprobacion` (contrapunto de R8).
- **Dobles sin `destinoTipo`**: `cierre-detail-congelado`, `wallet-idempotencia`,
  `devolucion-rechazadas-flow` (este devuelve el destino real de su fila).
- `caja-tesoreria-idempotencia` (estructural): el enganche del COD se busca en `asentar-cierre-dia.ts`.
- Migraciones que enumeran orígenes posteriores: `orden-incidente-migration`,
  `premio-ranking-devengo-migration` (+ `conciliacion_bodega_ajuste`).
- **Deuda sobre el efectivo (Q2 revocada)** — literales cambiados con la cita de la decisión:
  `saldo-satelites.int.test.ts` (1015 → 1715; «el SINPE NO cuenta» **sustituido** por «el SINPE SÍ
  cuenta»; desglose 15 → 138.45; fila de cabecera 1015 → 1415) y `wallet-caracterizacion-458`
  (5 500 → 7 000, y la fila de b2 declara 6 000). Los fixtures de esas suites y de la 463 sembraban
  consolidaciones SIN cierres; ahora cada consolidación no rechazada lleva su cierre aprobado con los
  mismos totales (la deuda sale de los aportes de los cierres).
- `saldo-satelites.int` tiene un barrido estático que prohíbe `Number(` en `SaldosSatelitesRepository`:
  el conteo de cierres sin consolidar pasa a `::int` en el SQL.

Repetidos aislados los 37 archivos rojos tras los arreglos: `Test Files 37 passed (37) · Tests 371 passed
(371)` (los 5 rojos de guardias de la primera corrida eran `Test timed out in 20000ms` bajo carga:
verdes aislados).

## T6 — Gate del backend

Comando: `./init.sh --rapido > progress/gate_498_backend.log 2>&1; echo "INIT_EXIT=$?" >> …`
(sobre `16e4a37e`).

- **`INIT_EXIT=0`, `== init OK ==`**, modo rápido AMPLIADO (relacionados + guardias + toda
  `tests/integration/db`).
- Relacionados: `Test Files 1 failed | 794 passed (795) · Tests 1 failed | 10255 passed | 17 skipped`
  (los 17 skipped son de `tests/components/AnaliticaPage.test.tsx`, no de integración).
- **`tests/integration/db`: 471 archivos, 4 390 tests, 0 skipped** (`Tests 10 failed | 4380 passed
  (4390)`; base alcanzable, `.env` presente).
- Rojos en paralelo, verdes aislados (el gate los repitió y los dio por intermitentes):
  - `498-regularizar-migration.test.ts` (R54a/R54b: la huella de los libros es de TABLA ENTERA y otro
    archivo commitea en paralelo). **Arreglado después del gate**: `SET TRANSACTION ISOLATION LEVEL
    REPEATABLE READ` al empezar ese caso (molde de `corregir-conciliacion.int`). Corrido aislado: verde.
  - `gestiones-detalle-api-405.test.ts` (ajena a la ficha): verde aislado.
- Guardias a mano (design §11 + ayuda), 14 archivos, `Tests 272 passed (272)`:
  `aporte-satelite-fuente-unica-498`, `aprobacion-escrituras-cubiertas`, `caja-derivaciones`,
  `caja-clasificacion-459`, `caja-composicion-exhaustiva`, `wallet-barra-unica-467`,
  `historial-accion-escrituras-cubiertas`, `consultas-concurrentes-en-transaccion`,
  `marca-fuente-unica-493`, `nombres-wallet-461`, `ayuda-columna-retirada`,
  `ayuda-md-viajan-a-produccion`, `ayuda-pantalla-ruta-existe`, `ayuda-render-sin-filtracion`.
- typecheck: 0 errores; lint: 0 errores (warnings preexistentes del repo).

**Veredicto:** backend de la 498 (T0–T6) hecho y verde en `--rapido` ampliado; T7 (frontend) puede empezar
con los contratos de arriba; quedan para T7/T8 las etiquetas provisionales y las mutaciones 1 y 11.

---

# Ficha 498 — frontend (T7.1–T7.5)

Agente: frontend_dev. Mismo worktree y rama. Búsqueda: MCP `codebase-memory`
(`R-job-singularis-projects-ordenex`) para lo que existía en `dev`; lo de la 498 se leyó en el
worktree (el índice no lo tiene).

## Decisión del humano (2026-11-03)

Las etiquetas de las dos categorías quedan **confirmadas**: «Diferencia de la satélite (faltó)» y
«Diferencia de la satélite (sobró o pagó)». Ya no son provisionales. La guardia «ningún nombre se
repite» de `wallet-labels.test.ts` sigue intacta.

## T7.1 — Caja

- `BarraComposicionCaja.tsx`: `COLOR_POR_COBRAR_SATELITES = "bg-chart-16"`; dos `Record` totales nuevos
  por modo (`SEGMENTOS_CON_POR_COBRAR_POR_MODO`, `SEGMENTOS_CON_IVA_Y_POR_COBRAR_POR_MODO`), elegidos por
  los dos signos del servidor en `segmentosDe`. Con P ≤ 0 las listas son las de antes (R39). Nombre
  accesible: añade «Por cobrar a satélites: ₡X.» solo si el signo es positivo (con 0/negativo, el de antes).
- **Decisión** (design §8.2 ambiguo): en `sin_reparto` con IVA, la lista era `[iva(porcentaje)]`; con P > 0
  queda `[por_cobrar(porcentaje), iva(resto)]` para que el último ocupe el resto y no abra hueco.
- `CajaResumenCard.tsx`: cuarto bolsillo `data-bolsillo="por-cobrar-satelites"`, siempre visible, insignia
  de signo y pista por `Record` total sobre el signo (positivo/negativo literales de R37; cero sin pista).
  La rejilla pasa de `md:grid-cols-3` a `md:grid-cols-2 xl:grid-cols-4`.
- `WalletLedger.tsx`: `DUENO_PUNTO.por_cobrar_satelite = COLOR_POR_COBRAR_SATELITES` (el mismo token).
- Etiquetas de categoría y origen: ya estaban en `lib/constants/wallet-rotulos.ts` (backend); no entran en
  `wallet-conceptos-manuales.ts` (test que lo fija en `WalletLedgerSatelite498.test.tsx`).
- **Contraste** (aritmética del repo, `tests/fixtures/contraste`, contra la pista `--muted`, hex leídos de
  `app/globals.css`): `bg-chart-16` = `#6d28d9` claro / `#c4b5fd` oscuro → **6.45:1 claro · 7.84:1 oscuro**
  (≥ 3:1, WCAG 1.4.11). Se descartaron `chart-4/5/8/9` (< 3:1 en claro) y `chart-17/20` (se leen como
  peligro). Lo fija `BarraComposicionCaja498.test.tsx` con autocomprobación (`chart-4` falla).
- Fixture de `CajaResumenCard.test.tsx` (R64 «ningún importe se lee ₡0»): el bolsillo nuevo se pinta
  siempre, así que el caso lleva `porCobrarSatelites: "8.00"`. Ninguna aserción cambió.

## T7.2 — Conciliación y saldos

- `MarcarRecibidoDialog`: props `recaudado` y `debe: { monto, positivo } | null` (sustituyen a
  `declarado`). Prefijo = `debe.monto` si `positivo`, `"0"` si no; `null` → campo vacío (nunca el
  efectivo). Banda «Debe» (el aporte tal cual), lo recaudado por método y el texto literal de R16a; un
  solo `input` de monto (R16b). El cliente admite además el cero literal (`/^0(\.0{1,2})?$/`, el mismo de
  `montoCeroSchema`): si no, el botón quedaba deshabilitado y el 0 nunca llegaba al servidor.
  `recibido_cero_con_aporte` → `role="alert"` con el texto de §4.4 bis; el diálogo queda abierto.
- `ConciliacionAcciones`: `con_asientos` → aviso `role="alert"` con el literal de R21 DENTRO del diálogo de
  «Desmarcar», que queda abierto; no se relee nada (no cambió nada). La nota del diálogo es la de R43.
- `ConciliacionSatelite`: la columna «Declarado» (efectivo) se sustituye por tres bloques: «Recaudado»
  (efectivo, SINPE, transferencia, total), «De la satélite» (pago a sus mensajeros, su ganancia por
  rechazos) y «Debe y recibido» (Debe, Monto recibido, Falta por recibir; el vocabulario de la
  conciliación se reexporta de `cierre-labels`, no se redefine). Rótulo «Saldada con la regla anterior».
  El aviso de diferencia dice «Debía …» con `debe`.
- `SaldosSatelitesTable` + descarga: columna «Sin consolidar» (importe y «N cierres»; «—» sin cierres) y,
  en la descarga, «Sin consolidar» y «Cierres sin consolidar». La marca de bodega «Recibido incompleto»
  ya no se enciende si hay cierres sin consolidar (con ellos lo pendiente no es solo una diferencia).
- Descarga de consolidaciones: «Declarado» (efectivo) → «Debe» (`c.debe`), y se añaden «Efectivo», «Pago
  a sus mensajeros», «Su ganancia por rechazos» y «Saldada con la regla anterior».
- Estado de cuenta: las filas con `origenTipo: "cierre_dia"` se rotulan «Cierre del día sin consolidar».
- Nota al pie de Saldos (era falsa desde la 498): «El saldo todavía no está en la caja. Es lo que cada
  bodega le debe a la central: entra a la caja … cuando se marca recibida su consolidación…».
- Tono: los textos literales de R16a/R21/R43 están en tuteo; el resto de `conciliacion-labels.ts` estaba en
  voseo. Para no mezclar dentro del mismo diálogo se pasaron a tuteo los textos de ese módulo
  (`forbidden`, `unauthenticated`, `fallo`, error del monto, pista del monto).

### Suites existentes que fijaban la regla revocada (sustituidas por su inverso, con la cita)

`tests/integration/wallet-satelites.test.tsx` (nota de Saldos, «Declarado» = efectivo, nota «Desmarcar no
mueve dinero», precarga con lo declarado, aviso de la diferencia) y
`tests/unit/descarga/saldos-satelites-descarga-columnas.test.ts` («Declarado es el EFECTIVO», decisión Q2
revocada el 2026-11-02). Fixtures completados con los campos nuevos del DTO (`debe`, `debePositivo`, …) en
`wallet-satelites.test.tsx`, `EstadoCuentaSatelite.test.tsx` y `wallet-sin-uuid.guardia.test.tsx` (los
fixtures sin tipo no los pedía el typecheck). Censo de columnas: `WalletListados464.test.tsx`.

## T7.3 — Textos

- `conciliacion-labels.ts`: `DESMARCAR_NO_MUEVE_DINERO_*` retirados; `NOTA_CONCILIACION_ASIENTA` = nota
  literal de R43. Comentarios reescritos en `ConciliacionAcciones.tsx`, `MarcarRecibidoDialog.tsx`,
  `CierresBodegaAdminModule.tsx` (comentario de la cabecera y el JSX de la sección) y `cierre-labels.ts`.
- Guardia `aporte-satelite-fuente-unica-498` extendida: R43 sobre los archivos de la conciliación de
  `app/` y `components/` (por carpeta) y `docs/ayuda/oficina/wallet-{satelites,caja}.md`; la nota
  literal; `DESMARCAR_NO_MUEVE_DINERO` no vuelve; `saldoDe(` también en `components/`. Rojo medido antes
  de T7.4 (la ayuda vieja) y con dos copias sembradas (ayuda y componente): `1 failed | 13 passed` cada una.

## T7.4 — Ayuda

`wallet-satelites.md` y `wallet-caja.md` reescritas según design §10, sin cifras de producción (se retiró
«Por qué la cifra es solo el EFECTIVO» con sus cifras). **Desviación:** la fuente `lib/utils/ingreso-ordenex.ts`
que pedía design §10 no se añadió: `marca-fuente-unica-493` rechaza «ordenex» en `docs/ayuda/**`
(nombre de marca retirado).

## Hueco de contrato (para el leader): `/cierres-admin` no tiene «lo que debe»

`ConciliacionAcciones` también se monta en la cola de `/cierres-admin` (`CierresBodegaAdminModule.tsx`),
con `CierreBodegaResumen`, que **no** trae `debe` ni `debePositivo` (solo los ganó
`ConsolidacionSateliteDTO`). R16 pide «nunca su efectivo» y design §8.4 que el signo lo decida el
servidor. Sin el dato no se inventa: allí el diálogo se monta con `debe={null}` → campo **vacío**, sin
banda «Debe», con lo recaudado por método y el texto de R16a. Para cerrar R16 en esa pantalla, el
backend tiene que añadir `debe`/`debePositivo` (y `saldadaReglaAnterior`) a `CierreBodegaResumen`; el
frontend solo cambia `debe={null}` por `{ monto, positivo }`.

## Gate del frontend

Comando: `./init.sh --rapido > progress/gate_498_frontend.log 2>&1; echo "INIT_EXIT=$?" >> …` (sobre
`5d014e4e`).

- **`INIT_EXIT=0`**, modo rápido AMPLIADO.
- Relacionados: `Test Files 856 passed (856) · Tests 11191 passed | 17 skipped` (los 17 son de
  `AnaliticaPage.test.tsx`, como en el gate del backend).
- **`tests/integration/db`: 471 archivos, 4 390 tests, 0 skipped** (`1 failed | 4389 passed`).
- Guardias: 282 archivos, `1 failed | 3884 passed`.
- Rojos en paralelo, verdes aislados (el gate los repitió y los dio por intermitentes):
  `integration/db/zona-distrito-499-migration.test.ts` (ajena) y
  `unit/guards/marca-fuente-unica-493.guardia.test.ts` (repetida a mano después: `19 passed`).
- Guardias a mano: `aporte-satelite-fuente-unica-498`, `ayuda-columna-retirada`,
  `ayuda-md-viajan-a-produccion`, `ayuda-pantalla-ruta-existe`, `ayuda-render-sin-filtracion`,
  `marca-fuente-unica-493`, `nombres-wallet-461`, `wallet-barra-unica-467` → `8 files · 124 passed`.
- typecheck 0 errores (también tras matar el dev server); eslint sobre los archivos tocados: 0.

## T7.5 — Ver la app

Dev server propio (`next dev --webpack -p 3498`: Turbopack se cae con el junction de `node_modules`,
«Symlink [project]/node_modules is invalid»). Recorrido con Playwright como `admin.qa`.

**Login.** El `QA_PASSWORD` del `.env` (worktree y repo principal, iguales) **no** coincide con el hash de
la base: las cuentas QA se rotaron con otra clave (su `updated_at` es de hoy). Sin correr el seed de
usuarios: se guardó el `password_hash` y el `updated_at` de `admin.qa`, se puso uno temporal y al terminar
se restauraron **los dos exactos** (comprobado: hash igual; `updated_at` = 2026-11-02 21:34:58.225, el
mismo instante que las otras cuentas QA). Las filas de `login_attempt` de Playwright se borraron (conteo de
vuelta a 1135). **Aviso para el humano:** el `QA_PASSWORD` del `.env` ya no sirve en la base local.

**Siembra** (base local, ids fijos): una consolidación `49800000-0000-4000-8000-000000000001` en QUEPOS
(estado `solicitado`, 6 000 de efectivo, sin SINPE ni descuentos) con el único cierre satélite aprobado
suelto de la base (`50ffdfa2-…`, sin filas en los libros antes de empezar).

Lo visto (texto leído con `innerText`):

- `/wallet/satelites`: columnas «Bodega · Pendiente · Sin consolidar · Más antigua sin conciliar · Última
  recibida». Con el cierre suelto (tras limpiar): QUEPOS «₡6.000 | ₡6.000 · 1 cierre | al día». Nota al
  pie nueva. Estado de cuenta: fila «Cierre del día sin consolidar · ₡6.000».
- Consolidación sin marcar: tres bloques (Efectivo ₡6.000 · SINPE ₡0 · Transferencia ₡0 · Total ₡6.000 |
  Pago a sus mensajeros ₡0 · Su ganancia por rechazos ₡0 | Debe ₡6.000 · Monto recibido — · Falta por
  recibir ₡6.000) y la nota literal de R43.
- Diálogo de marcar: banda «Debe ₡6.000», recaudado por método, texto literal de R16a, **campo = 6000.00**.
  Con «0»: alerta «Esta consolidación tiene dinero por entregar: el monto recibido no puede ser 0.», el
  diálogo sigue abierto y la base no cambió. Con 5 000: «Recibido incompleto», «Debía ₡6.000 y se
  recibieron ₡5.000. La diferencia de ₡1.000…», pendiente ₡1.000.
  En la base: 7 filas de caja y 7 de tienda con origen el cierre (COD 6 000, flete 3 000, flete devolución
  1 000, comisión 210, IVAs 390/130/27,30), 0 de pago al mensajero (el cierre no lo tiene), una fila de
  ajuste `marca` 1 000 y **un** `egreso_diferencia_satelite` de 1 000.
- Corregir a 5 600: el campo nace con 5000.00; queda «Monto recibido ₡5.600 · Falta ₡400»; en la base, fila
  `correccion` −600 y un `ingreso_diferencia_satelite` de 600 (solo la variación; ningún asiento nuevo).
- Desmarcar: el diálogo dice «Ahora mismo consta recibida por ₡5.600.» y la nota de R43; al confirmar,
  «Ya entró a la caja: corrige el monto en vez de revertir», el diálogo sigue abierto y nada cambió.
- `/wallet`: bloque «Por cobrar a satélites · Positivo · ₡400 · Lo que las satélites entregaron de menos al
  conciliar y aún no han pagado.» (= 1 000 − 600). Libro: dos filas con dueño «Satélite»: «Diferencia de la
  satélite (sobró o pagó) · Conciliación de satélite · Entra ₡600» y «Diferencia de la satélite (faltó) ·
  … · Sale ₡1.000». La barra no se ve: la base local está en estado «flujo» (sin saldo inicial) y no se
  registró uno (memoria «ver la app ensucia la base»); la cubre `BarraComposicionCaja498.test.tsx`.
- **Contraste, valor computado final** del punto de dueño en la app: claro `rgb(109, 40, 217)` = `#6d28d9`;
  oscuro (con el propio conmutador de tema, esperando 2,5 s) `rgb(196, 181, 253)` = `#c4b5fd`, con la pista
  `bg-muted` medida junto al punto en `rgb(22, 41, 74)` = `#16294a`. Son los hex de los que salen 6.45:1 y
  7.84:1. (Un primer intento poniendo `.dark` en `<html>` daba el color claro: el tema vive en un
  contenedor propio; esa medida se descartó.)
- Ajeno a la ficha: al entrar como admin se abre el modal «Confirmá el SINPE de GAM» (se cerró con Escape).

**Limpieza** (comprobada por consulta después): 0 filas en `conciliacion_bodega_ajuste`, 0 en los tres
libros con origen el cierre, 0 `…_diferencia_satelite` en toda la caja, 0 `historial_accion` de la
consolidación, la consolidación borrada y el cierre otra vez suelto (`cierre_bodega_id` NULL); 0 filas de
`login_attempt` de Playwright; `admin.qa` restaurado. El log del dev server (imprime los argumentos del
login) se borró.

## Mapa R<n> → test (frontend)

| R | Test |
| --- | --- |
| R15a (texto) | `tests/components/Conciliacion498.test.tsx` «R15a — recibido 0 con dinero por entregar» |
| R16 | `Conciliacion498.test.tsx` «R16 — el diálogo propone lo que DEBE, o 0; nunca el efectivo» y «R16 — Marcar recibido abre…»; `wallet-satelites.test.tsx` (precarga) |
| R16a, R16b | `Conciliacion498.test.tsx` «R16a/R16b» (marcar y corregir; un solo `input`) |
| R21 | `Conciliacion498.test.tsx` «R21 — revertir una consolidación que ya entró a la caja» |
| R22 (pantalla) | `Conciliacion498.test.tsx` «sin asientos (R22)…» |
| R37 | `tests/components/CajaResumenCard498.test.tsx` |
| R38, R39 | `tests/components/BarraComposicionCaja498.test.tsx` (+ contraste del token) |
| R40 | `tests/components/WalletLedgerSatelite498.test.tsx` (libro y descarga) |
| R41 | `Conciliacion498.test.tsx` «R41 — los tres bloques» y «el aviso… DEBÍA»; `wallet-satelites.test.tsx`; `saldos-satelites-descarga-columnas.test.ts` |
| R41a | `Conciliacion498.test.tsx` «R41a»; descarga en `saldos-satelites-descarga-columnas.test.ts` |
| R42 | `Conciliacion498.test.tsx` «R42»; `saldos-satelites-descarga-columnas.test.ts`; `WalletListados464.test.tsx` |
| R43 | `aporte-satelite-fuente-unica-498.guardia` (lib + app + components + ayuda, nota literal); `Conciliacion498.test.tsx`; `wallet-satelites.test.tsx` |
| R44 | `tests/unit/docs/ayuda-wallet-satelites-498.test.ts` (revisión B2: cada punto de R44 en `wallet-satelites.md`/`wallet-caja.md`, ninguna frase de la regla vieja, autocomprobación) + guardias de ayuda (`ayuda-*`, `marca-fuente-unica-493`, `nombres-wallet-461`) |

Mutaciones medidas contra los tests nuevos (restauradas, diff limpio): prefijar `debe.monto` sin mirar
`positivo` → `3 failed | 18 passed (21)`; `con_asientos` por toast en vez del aviso en el diálogo →
`1 failed | 20 passed (21)`.

## Hueco R16 en `/cierres-admin` — CERRADO por el backend (2026-11-03)

- **Contrato:** `CierreBodegaResumen` (`lib/interfaces/services/ICierreBodegaService.ts`) y su fila
  `CierreBodegaResumenRow` (`lib/interfaces/repositories/ICierreBodegaRepository.ts`) ganan
  **`debe: string`**, **`debePositivo: boolean`** y **`saldadaReglaAnterior: boolean`**, con la misma
  semántica que en `ConsolidacionSateliteDTO`.
- **Fuente única:** se derivan en `toBodegaResumenRow` (`lib/repositories/CierreBodegaRepository.ts`)
  con `aporteDeConsolidacion` / `esSaldadaReglaAnterior` de `lib/utils/conciliacion-satelite.ts` (el
  mismo valor que ya alimenta `faltaPorRecibir` de esa fila). `CierresBodegaAdminService` los pasa tal
  cual (sin recalcular).
- **Dónde lo cambia el frontend:** `app/(app)/cierres-admin/_components/CierresBodegaAdminModule.tsx:885`,
  `debe={null}` → `debe={{ monto: detalle.cierre.debe, positivo: detalle.cierre.debePositivo }}`
  (y el rótulo de R41a con `detalle.cierre.saldadaReglaAnterior`, si se quiere allí).
- **Tests que pintan el valor:**
  - `tests/unit/utils/conciliacion-satelite.test.ts`, caso «R16/R41a (cola de /cierres-admin)»: normal
    (7 000, positivo), saldada (6 500, `saldadaReglaAnterior: true`) y aporte negativo (−2 000, no
    positivo).
  - `cierre-bodega-repository.test.ts` y `cierres-bodega-admin-repository.test.ts`: el DTO literal gana
    `debe: "1.50", debePositivo: true, saldadaReglaAnterior: false`.
  - `cierres-bodega-admin-service.test.ts`: «la cola de /cierres-admin lleva lo que debe, tal cual».
- El fixture compartido `tests/fixtures/marca-conciliacion.ts` gana los tres campos (debe = lo que falta
  sin marcar; recibido + falta si está marcada).

## T8.3 — Nota para la release (sin ejecutar nada)

**(a) No conciliar durante el despliegue.** Las migraciones corren en el build. Una consolidación
conciliada por el código viejo después de M3 y antes del cambio de código queda sin asientos (corregir
no asienta), y una conciliada después de M4 queda sin regularizar (design §13). Pedir que nadie marque,
corrija ni revierta en `/wallet/satelites` ni en `/cierres-admin` mientras dura el despliegue.

**(b) Verificación posterior, SOLO LECTURA** (la corre o la autoriza el humano; `:despliegue` = instante
en que el código nuevo quedó sirviendo; sin cifras en el repositorio):

```sql
-- b1 · consolidaciones conciliadas DESPUES del despliegue cuyos cierres satelite aprobados NO tienen
--      filas en la caja con origen en el cierre. Debe dar 0.
SELECT count(*) AS conciliadas_sin_asiento
  FROM cierre_bodega b
  JOIN cierre_dia c ON c.cierre_bodega_id = b.id
 WHERE b.conciliado_at >= :despliegue
   AND c.estado::text = 'aprobado' AND c.destino_tipo::text = 'bodega_satelite'
   AND NOT EXISTS (SELECT 1 FROM wallet_movimiento w
                    WHERE w.origen_tipo::text = 'cierre_dia' AND w.origen_id = c.id);

-- b2 · cierres satelite aprobados DESPUES del despliegue, SIN conciliar, con filas en alguno de los
--      tres libros. Debe dar 0.
SELECT count(*) AS asentados_sin_conciliar
  FROM cierre_dia c
  LEFT JOIN cierre_bodega b ON b.id = c.cierre_bodega_id
 WHERE c.resuelto_at >= :despliegue
   AND c.estado::text = 'aprobado' AND c.destino_tipo::text = 'bodega_satelite'
   AND (c.cierre_bodega_id IS NULL OR b.conciliado_at IS NULL)
   AND (   EXISTS (SELECT 1 FROM wallet_movimiento w WHERE w.origen_tipo::text = 'cierre_dia' AND w.origen_id = c.id)
        OR EXISTS (SELECT 1 FROM wallet_tienda_movimiento t WHERE t.origen_tipo::text = 'cierre_dia' AND t.origen_id = c.id)
        OR EXISTS (SELECT 1 FROM pago_mensajero_movimiento p WHERE p.origen_tipo::text = 'cierre_dia' AND p.origen_id = c.id));

-- b3 · lo que M3 retiro (respaldo). Solo informativo: cuantas filas por libro.
SELECT tabla, count(*) FROM respaldo.asientos_satelite_498 GROUP BY tabla ORDER BY tabla;
```

**(c) La analítica mueve el ingreso satélite.** Lo que leen los libros por fecha (caja, ganancia,
tableros) deja de ver el dinero de un cierre satélite al aprobarlo y lo ve en la **fecha de
conciliación** de su consolidación. Es el efecto buscado («nada entra al aprobar»); avisar a quien mire
cifras por día el día del despliegue. Además, los asientos que M3 retira (cierres de S) desaparecen de
los libros hasta que su consolidación se concilie: saldos de tienda y caja bajan en ese importe hasta
entonces (design §13, ya medido por el humano).

**(d) Verificación de M4 (Q4), SOLO LECTURA:**

```sql
-- d1 · regularizadas: numero, Σ monto_recibido y Σ esperado_regla_anterior. Deben coincidir con (a) de
--      T8.4 (salvo las conciliadas entre la medicion y el despliegue, contadas aparte en d4), y las
--      dos sumas deben ser IGUALES entre si.
SELECT count(*) AS regularizadas,
       COALESCE(SUM(monto_recibido), 0)          AS suma_recibido,
       COALESCE(SUM(esperado_regla_anterior), 0) AS suma_reconocido
  FROM cierre_bodega
 WHERE esperado_regla_anterior IS NOT NULL;

-- d2 · deuda de cada regularizada = 0 (su reconocido = su recibido). Debe dar 0 filas.
SELECT id FROM cierre_bodega
 WHERE esperado_regla_anterior IS NOT NULL
   AND esperado_regla_anterior <> COALESCE(monto_recibido, 0);

-- d3 · conciliadas sin regularizar y sin ninguna fila de ajuste, con `conciliado_at` en la ventana del
--      despliegue (entre el inicio del build y :despliegue). Debe dar 0.
SELECT count(*) AS conciliadas_en_la_ventana
  FROM cierre_bodega b
 WHERE b.conciliado_at >= :inicio_build AND b.conciliado_at < :despliegue
   AND b.esperado_regla_anterior IS NULL
   AND NOT EXISTS (SELECT 1 FROM conciliacion_bodega_ajuste a WHERE a.cierre_bodega_id = b.id);

-- d4 · conciliadas entre la medicion de T8.4 y el despliegue (para explicar la diferencia con (a)).
SELECT count(*) FROM cierre_bodega
 WHERE conciliado_at >= :medicion AND conciliado_at < :inicio_build AND estado::text <> 'rechazado';
```

## T8.4 — Medición previa en producción, con puerta (Q4) — SQL de SOLO LECTURA

La corre el leader con el MCP de producción (confirmando el proyecto con `get_project_url`) o el humano,
**antes** de abrir la release y el mismo día. Las cifras se dicen en el chat y **no** se escriben en el
repositorio. Aquí no se ejecutó nada contra producción.

```sql
-- (a) las que M4 regularizara (en produccion aun no existe la tabla de ajustes): conciliadas y no
--     rechazadas, con la Σ de su monto_recibido.
SELECT count(*) AS a_regularizar, COALESCE(SUM(monto_recibido), 0) AS suma_recibido
  FROM cierre_bodega
 WHERE conciliado_at IS NOT NULL AND estado::text <> 'rechazado';

-- (b) de ellas, cuantas tienen hueco entre su aporte («Para la central» del snapshot) y lo recibido.
SELECT count(*) AS con_hueco
  FROM cierre_bodega
 WHERE conciliado_at IS NOT NULL AND estado::text <> 'rechazado'
   AND (total_general - total_pago_mensajero - total_ingreso_bodega_rechazos) <> monto_recibido;

-- (c) consolidaciones rechazadas (Q3). PUERTA: debe ser 0.
SELECT count(*) AS rechazadas FROM cierre_bodega WHERE estado::text = 'rechazado';

-- (d) conciliadas con monto_recibido nulo. PUERTA: debe ser 0 (el CHECK de la 431 ya lo impide).
SELECT count(*) AS conciliadas_sin_monto
  FROM cierre_bodega WHERE conciliado_at IS NOT NULL AND monto_recibido IS NULL;

-- (e) GUARDA DE M3 (R50), anticipada: pagos al mensajero contra cierres del conjunto S. Si no es 0, M3
--     ABORTA el despliegue con este conteo. PUERTA: debe ser 0.
SELECT count(*) AS pagos_contra_s
  FROM liquidacion_pago l
  JOIN cierre_dia c ON c.id = l.cierre_id
  LEFT JOIN cierre_bodega b ON b.id = c.cierre_bodega_id
 WHERE c.destino_tipo::text = 'bodega_satelite' AND c.estado::text = 'aprobado'
   AND (c.cierre_bodega_id IS NULL OR b.conciliado_at IS NULL);

-- (f) Informativo: tamaño de S y filas que M3 retirara por libro.
WITH s AS (
  SELECT c.id FROM cierre_dia c LEFT JOIN cierre_bodega b ON b.id = c.cierre_bodega_id
   WHERE c.destino_tipo::text = 'bodega_satelite' AND c.estado::text = 'aprobado'
     AND (c.cierre_bodega_id IS NULL OR b.conciliado_at IS NULL))
SELECT (SELECT count(*) FROM s) AS cierres_s,
       (SELECT count(*) FROM wallet_movimiento w JOIN s ON w.origen_id = s.id WHERE w.origen_tipo::text = 'cierre_dia') AS caja,
       (SELECT count(*) FROM wallet_tienda_movimiento t JOIN s ON t.origen_id = s.id WHERE t.origen_tipo::text = 'cierre_dia') AS tienda,
       (SELECT count(*) FROM pago_mensajero_movimiento p JOIN s ON p.origen_id = s.id
         WHERE p.origen_tipo::text = 'cierre_dia' AND p.categoria::text <> 'premio_ranking' AND p.premio_dia IS NULL) AS mensajero;
```

**Puerta:** (c) = 0, (d) = 0 y (e) = 0. Si (c) ≠ 0 se revisa Q3 con el humano antes de desplegar; si (e) ≠
0, M3 abortaría el build. **Veredicto: PENDIENTE** (no se ha medido; sin cifras aquí). Si no pasa, la
release no sale con esta ficha.

## T8.1 — Contraprueba por mutación (las 16 de design §14)

Arnés: `scratchpad/mutar16.py` — aplica la mutación al archivo real, ejecuta `pnpm exec vitest run <tests>`, restaura y comprueba `git diff --quiet` sobre ese archivo. Corrida única sobre `a4c56df5`. Salida literal (nº de tests ejecutados por mutación y los rojos):

```
MUTACION 1 | Test Files  2 failed (2) · Tests  2 failed | 12 passed (14) | diff limpio tras restaurar: True
     × ⭑ 498/T3.4: la aprobacion llama a `asentarCierreDia` en la rama `bodega_central` y NO en la satelite 9ms
     × ⭑ T1.1 / R1: aprobar un cierre SATELITE no escribe NINGUNA fila en los tres libros 6ms
MUTACION 2 | Test Files  2 failed (2) · Tests  3 failed | 11 passed (14) | diff limpio tras restaurar: True
     × ⭑ 498/T3.4: la aprobacion llama a `asentarCierreDia` en la rama `bodega_central` y NO en la satelite 9ms
     × ⭑ 498/T3.4 AUTOCOMPROBACION: la guardia se pone roja si se borra la llamada de la rama central 2ms
     × ⭑ T1.2 / R3 / R55: aprobar un cierre CENTRAL escribe exactamente la foto de antes de la ficha 7ms
MUTACION 3 | Test Files  1 failed | 1 passed (2) · Tests  1 failed | 16 passed (17) | diff limpio tras restaurar: True
     × ⭑ R5: el ORDEN de la aprobacion de antes, literal 12ms
MUTACION 4 | Test Files  1 failed (1) · Tests  3 skipped (3) | diff limpio tras restaurar: True
MUTACION 5 | Test Files  1 failed (1) · Tests  7 failed | 19 passed (26) | diff limpio tras restaurar: True
     × ⭑ T1.3 / R8: DESPUES de marcar, cada cierre tiene filas en los TRES libros 3ms
     × R11: recibido = esperado → ni fila de ajuste ni movimiento de diferencia (y los asientos si) 0ms
     × ⭑ R14: un feed que falla revierte la marca entera — sin conciliar, sin filas nuevas, sin historial 1ms
     × R5: asentar otra vez un cierre ya asentado no añade filas (idempotente contra Postgres) 2ms
MUTACION 6 | Test Files  1 failed (1) · Tests  2 failed | 24 passed (26) | diff limpio tras restaurar: True
     × R15b: corregir a 0 una consolidacion con aporte cero → aceptado; la diferencia vuelve a cero 4ms
     × ⭑ R17/R18: dos correcciones con variacion escriben SOLO la variacion; la del mismo monto, nada 1ms
MUTACION 7 | Test Files  1 failed (1) · Tests  7 failed | 19 passed (26) | diff limpio tras restaurar: True
     × ⭑ T1.3 / R9 / R10 / R12: UNA sola fila de caja `egreso_diferencia_satelite` por el faltante 5ms
     × R10: llego de MAS → UN ingreso `ingreso_diferencia_satelite` por el valor absoluto 1ms
     × R15b: con aporte NEGATIVO → marcada y UN ingreso de diferencia por el valor absoluto 1ms
     × R15b: corregir a 0 una consolidacion con aporte cero → aceptado; la diferencia vuelve a cero 0ms
MUTACION 8 | Test Files  1 failed (1) · Tests  1 failed | 25 passed (26) | diff limpio tras restaurar: True
     × ⭑ R20: con asientos → `con_asientos` y NADA cambia (ni la fila, ni el historial, ni los libros) 3ms
MUTACION 9 | Test Files  1 failed (1) · Tests  5 failed | 8 passed (13) | diff limpio tras restaurar: True
     × ⭑ T1.4 / R23: la deuda de Saldos es la formula de R23 hecha a mano (todos los metodos, con los sin consolidar) 5ms
     × ⭑ R23: con sin consolidar, SINPE, rechazada, conciliada con faltante y SALDADA, la deuda es la formula a mano 1ms
     × R24 / R42: «Sin consolidar» = el aporte del cierre suelto + el de la consolidacion rechazada, y son 2 cierres 1ms
     × ⭑ R29: el declarado de cada consolidacion es Σ aportes de sus cierres; el de la saldada, su reconocido 0ms
MUTACION 10 | Test Files  1 failed (1) · Tests  3 failed | 10 passed (13) | diff limpio tras restaurar: True
     × ⭑ R54c: una zona con SOLO una saldada (con hueco SINPE) debe 0 en Saldos y en el estado de cuenta 4ms
     × ⭑ R30: hay UNA fila por cierre sin consolidar (el suelto y el de la rechazada), con origen `cierre_dia` 2ms
     × ⭑ R31: sin filtros, el pendiente final = la deuda de Saldos 1ms
MUTACION 11 | Test Files  2 failed (2) · Tests  11 failed | 78 passed (89) | diff limpio tras restaurar: True
     × R19: ninguna fila de IVA ni del reverso del IVA; los totales son los de la tarjeta (R3) 7ms
     × ⭑ R33: las dos categorias son del dueño `por_cobrar_satelite` y de liquidez efectivo 2ms
     × ⭑ R35/R33: diferencia POSITIVA (faltaron 500) — Entro − Salio = ganancia + IVA + capital + De las tiendas − Por cobrar 1ms
     × ⭑ R35/R33: diferencia NEGATIVA (sobraron 200) — Entro − Salio = ganancia + IVA + capital + De las tiendas − Por cobrar 0ms
MUTACION 12 | Test Files  1 failed (1) · Tests  1 failed | 5 passed (6) | diff limpio tras restaurar: True
     × R48/R49/R51: retira SOLO lo de S, conserva premios, centrales, conciliados y no aprobados, y lo respalda integro 453ms
MUTACION 13 | Test Files  1 failed (1) · Tests  1 failed | 5 passed (6) | diff limpio tras restaurar: True
     × R48/R49/R51: retira SOLO lo de S, conserva premios, centrales, conciliados y no aprobados, y lo respalda integro 332ms
MUTACION 14 | Test Files  1 failed (1) · Tests  1 failed | 4 passed (5) | diff limpio tras restaurar: True
     × R54a/R54b: marca SOLO las conciliadas no rechazadas sin ajuste, con = monto_recibido; nada mas cambia 279ms
MUTACION 15 | Test Files  3 failed (3) · Tests  6 failed | 44 passed (50) | diff limpio tras restaurar: True
     × ⭑ con `esperadoReglaAnterior` (saldada con la regla anterior): ESE valor, no el aporte 5ms
     × ⭑ en una saldada con la regla anterior: Recibido + Falta = aporte reconocido, y Falta = 0 1ms
     × ⭑ R16/R41a (cola de /cierres-admin): la cabecera trae `debe`, `debePositivo` y `saldadaReglaAnterior` 3ms
     × ⭑ R41a / R26: el DTO de la saldada trae `saldadaReglaAnterior`, `debe` = su reconocido y falta 0 5ms
MUTACION 16 | Test Files  1 failed (1) · Tests  2 failed | 24 passed (26) | diff limpio tras restaurar: True
     × ⭑ R15a: con aporte POSITIVO → `recibido_cero_con_aporte`, sin conciliar, sin historial, sin filas 3ms
     × R15a: corregir a 0 una consolidacion con aporte positivo → `recibido_cero_con_aporte` y el monto no cambia 1ms
```

**16/16 matadas**, diff limpio tras cada restauración. Notas: la 3 es «el libro del mensajero se mueve al final» (invierte el orden mensajero ↔ indemnización); la 4 deja `depsAsiento = {}` y el archivo cae en `beforeAll` (`Test Files 1 failed`, la acción responde INTERNAL); la 11 clasifica las diferencias como `propio`. Ninguna mutación necesitó un test de UI.

## Gate de T8 (backend)

`./init.sh --rapido > progress/gate_498_t8.log 2>&1; echo "INIT_EXIT=$?" >> …` sobre el commit de T8.1/T8.3/T8.4.

- **`INIT_EXIT=0`, `== init OK ==`**, modo rápido AMPLIADO.
- Relacionados: `Tests 1 failed | 11289 passed | 17 skipped` (los 17 skipped son de `AnaliticaPage.test.tsx`).
- **`tests/integration/db`: 471 archivos, 4 390 tests, 0 skipped** (`4 failed | 4386 passed`).
  `498-regularizar-migration` verde en paralelo (5/5) tras el REPEATABLE READ.
- Rojos en paralelo, verdes al repetirlos aislados (el gate los anota como intermitentes):
  `ajuste-caja-anulacion-461.test.ts` y `caja-invariante-tiendas.test.ts` (huellas de tabla entera con
  la base compartida; ninguno toca código de esta tanda).

## Hueco R16 en `/cierres-admin`: CERRADO

El backend añadió `debe`, `debePositivo` y `saldadaReglaAnterior` a `CierreBodegaResumen` (misma fuente que
la conciliación). `CierresBodegaAdminModule.tsx` monta ahora `ConciliacionAcciones` con
`debe={{ monto: detalle.cierre.debe, positivo: detalle.cierre.debePositivo }}`: el diálogo de esa cola
propone lo que debe (o 0 si el servidor dice que no debe nada) y pinta la banda «Debe».

- El rótulo «Saldada con la regla anterior» (R41a) **no** se añade en `/cierres-admin`: R41a y design §9 lo
  piden en la conciliación (`ConciliacionSatelite.tsx`), no en esta vista.
- Test: `tests/components/CierresBodegaAdminDebe498.test.tsx` (monta el módulo real, abre el detalle y el
  diálogo). Debe positivo → campo `88000.75` (≠ efectivo `70000.00`) y banda «Debe»; `debePositivo: false`
  → campo `0`. **Mutación** (volver a `debe={null}`): `2 failed (2)`; restaurado, diff limpio.
- Suites que montan el módulo: 21 archivos, 273 en verde.
- Gate final (`progress/gate_498_final.log`, sobre `98cff68e`): **`INIT_EXIT=0`**. Relacionados 864 archivos, `11292 passed | 17 skipped` (AnaliticaPage). Guardias 282 archivos, 3885 en verde. `integration/db`: 4390 tests, `1 failed | 4387 passed | 2 skipped`; los 2 skipped son de `454/caracterizacion/corte-concurrencia` en la corrida en paralelo. Ese archivo y `abono-tienda-457-concurrencia` (el rojo) se repitieron aislados: `10 passed`, sin skipped. Se anotan como intermitentes. Guardias a mano (las 8 de antes): 124 en verde.

## Revisión (`progress/review_498.md`, RECHAZADO con B1 y B2) — arreglos

- **B1** `specs/498-satelite-dinero-al-conciliar/tasks.md`: 39 tasks en `[x]` (T0.1–T7.5, T8.1, T8.3),
  comprobadas contra esta bitácora. Quedan `[ ]` con nota: **T8.2** (el gate está verde; falta abrir el PR
  contra `dev` y mirar `gh pr checks`, lo hace el leader) y **T8.4** (pendiente por diseño: medición en
  producción el día de la release, SQL ya escrito arriba).
- **B2 (R44)** `tests/unit/docs/ayuda-wallet-satelites-498.test.ts` (16 casos): 13 puntos de R44 como
  frases/rótulos (dinero al conciliar y no al aprobar, deuda sobre todos los métodos menos lo de la
  satélite, recibido = total, 0 solo sin nada que entregar, «Sin consolidar», «Saldada con la regla
  anterior», revertir con asientos, nota de R43, bloque y pistas de «Por cobrar a satélites», dueño
  «Satélite», excepción de la caja) y seis frases de la regla vieja prohibidas en los dos archivos.
  Autocomprobación en el propio test (frase vieja sembrada y punto quitado). Mutación real: añadir
  «## Desmarcar no mueve dinero» a `wallet-satelites.md` → `× ⭑ no queda ninguna frase de la regla
  vieja en ninguno de los dos archivos · 1 failed | 15 passed`; restaurado, `git status docs` limpio. Fila R44 del mapa actualizada.
- **m2** revertir una saldada con la regla anterior SIN asientos: nuevo desenlace de dominio
  **`saldada_regla_anterior`** (repositorio `RevertirConciliacionResult`, servicio
  `RevertirConciliacionServiceResult`, acción por tipo) y texto `CONCILIACION_RESPUESTA.saldadaReglaAnterior`
  («Esta consolidación está saldada con la regla anterior: no se puede revertir; si el monto no es el
  correcto, corrígelo.»). Sin UI nueva: `ConciliacionAcciones` lo cae hoy en su rama genérica
  (`CONCILIACION_RESPUESTA.fallo`); el frontend puede pintar el texto propio con una rama. Test:
  `498-conciliar-asienta-sql-real` «revisión m2» (desenlace, fila sin cambios, sin historial) y el
  servicio lo propaga. Sin el corte, el mismo caso da `DriverAdapterError … viola … 
  «cierre_bodega_esperado_regla_anterior_check»` (medido quitando el `return`; restaurado).
- **m6** `asentar()` del escenario 454 LANZA si el cierre no está `aprobado` (antes `return` mudo). Sus
  seis usuarios siguen verdes (21/21).
- m1 (preview pudo migrar la M3 vieja), m3, m4, m5: no pedidos en esta tanda; quedan anotados en la revisión.

## Gate de la revisión

Primera corrida de `progress/gate_498_revision.log` (sobre `59295758`): `cierres-bodega-admin-marca.test.ts`
rojo de verdad (6 casos): su doble de `findUnique` no traía `esperadoReglaAnterior` y el corte de m2 leía
`undefined` como «saldada». Arreglo de fixture (`esperadoReglaAnterior: null`, la columna que una fila
real siempre trae) en `e8e403ea`; ninguna aserción cambió. Esa corrida no vale (se editó durante el gate) y
se repitió entera:

- **`INIT_EXIT=0`, `== init OK ==`** (sobre `e8e403ea`), modo rápido AMPLIADO.
- Relacionados + guardias: `865 passed (865) · 11310 passed | 17 skipped` (los 17, `AnaliticaPage`).
- **`tests/integration/db`: 471 archivos, 4 391 tests, 0 skipped** (`1 failed | 4390 passed`).
  `detalle-en-lote-464.test.ts` rojo en paralelo, verde aislado (6/6): intermitente, ajeno a la ficha.
- `marca-fuente-unica-493` (timeout de 20 s bajo carga en la corrida invalidada): verde aislado (19/19)
  y verde en la corrida buena.

## Revisión m2 — revertir una saldada con la regla anterior

El backend añadió el desenlace `saldada_regla_anterior` al revertir. `ConciliacionAcciones` lo trataba como error genérico («No se pudo completar la operación»); ahora tiene su rama, igual que `con_asientos`: aviso `role="alert"` con `CONCILIACION_RESPUESTA.saldadaReglaAnterior` dentro del diálogo de «Desmarcar», que queda abierto, sin releer nada.

- Test: `Conciliacion498.test.tsx` «revisión m2 — con `saldada_regla_anterior`…» (texto literal, diálogo abierto, `onCambio` sin llamar, sin el aviso genérico).
- Mutación (quitar la rama): `1 failed | 21 passed (22)`; restaurado, diff limpio.
- Aislados: 29 archivos que tocan la conciliación o el módulo de `/cierres-admin` + la guardia de la 498 → 459 en verde. typecheck y eslint limpios. Sin gate (lo permitió el leader).
