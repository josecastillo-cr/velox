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
