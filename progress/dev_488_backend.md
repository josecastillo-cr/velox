# Ficha 488 — backend (backend_dev) — bitácora

Rama `feat/488-ganancia-caja-sin-iva` (worktree `.claude/worktrees/f488`, nace de `4f87ca86`).
Búsqueda: MCP `codebase-memory` disponible pero no hizo falta más allá de lo que el design ya trazaba
(cada símbolo se leyó en el archivo real); `grep` para tests, migraciones y specs.

## Tareas hechas (B.0–B.11)

| Tarea | Estado |
| --- | --- |
| B.0 caracterización previa | `tests/integration/db/caja-iva-488.test.ts` (bloque B.0), verde sobre `dev` sin tocar código; commit `510b4155`. Sus literales no se tocaron después. |
| B.1 migraciones | `db/migrations/20261023120000_iva_por_pagar_488_enums` (+`down.sql` con `quitar_valores_de_enum_488`, copia de la 458-B) y `20261023120100_iva_por_pagar_488_checks` (+`down.sql` con RAISE y lista de la 458-B). `schema.prisma` con los dos valores. `origin/dev` miraba hasta `20261021120000`. `prisma migrate status` → `localhost:5432`; `migrate deploy` aplicado en la base LOCAL. Ningún `down.sql` previo tocado. |
| B.2 test de migración | `tests/integration/db/iva-488-migration.test.ts` (8 casos): CHECK acepta/rechaza (23514), reaplicar up, down con filas aborta sin borrar, down 2→1 EJECUTADO sin filas conserva el resto del enum en orden, función idéntica a la 458-B. |
| B.3 tipos y clasificación | `NaturalezaMovimiento` + `iva`; seeds; `NATURALEZA`/`LIQUIDEZ`; `WALLET_INGRESO_PROPIO_SEED` con sus 5 valores; `WALLET_EGRESO_NOMBRADO_SEED` sin el reverso del IVA; `TIPO_EGRESO_MANUAL_SEED` + `pago_iva`; `FUENTE_CAJA`; `CATEGORIA_LABEL` («Pago de IVA» / «Pago de IVA anulado»); `nombreDelEgresoAnulable`. |
| B.4 derivación | `caja-tesoreria.ts`: cubetas IVA, SEIS `derivarBalance`, `CajaResumenDTO` + `ivaCobrado`, `ivaPorPagar`, `signoIvaPorPagar`, `porcentajeIva` (STRING); `derivarReparto` sobre los bolsillos positivos. |
| B.5 composición | sin claves IVA por los seeds; R20 en `wallet-actions.test.ts`. |
| B.6 anulación | `categoriaDelContraAsiento` + `CATEGORIAS_DE_CONTRA_ASIENTO_DE_EGRESO` (`lib/utils/egreso-anulable.ts`), usadas en `EgresoCajaAnulacionService.anular`, `WalletEgresoService.reversarEgreso` y el WHERE de `EgresoCajaDocumentosRepository`. |
| B.7 «Así queda» / «Cómo quedó» | `CONCEPTO_REGISTRO_SEED` + `pago_iva`, `EFECTO_POR_TIPO.pago_iva`, `lineas.ivaPorPagar`, `ComoQuedoDTO.caja.ivaPorPagar`. |
| B.8 analítica | `ganancia_ordenex` 14 + descripción 488; `dinero_en_caja` 29; `egresos` 12 + descripción; `ingreso_iva` sin cambio. |
| B.9 guardias | `caja-derivaciones` (4→6), `caja-clasificacion-459` («propio o iva», con contraprueba terceros/capital en rojo), `caja-composicion-exhaustiva`, `metrics-caja-naturaleza` (con predicado autocomprobado de la descripción). `caja-173-alcance` verde sin cambios. |
| B.10 integración | `caja-iva-488.test.ts` §1–§8, todo por las Server Actions reales cableadas sobre la tx. |
| B.11 cierre | gate (abajo), esta bitácora, commit. |

## Desviación mínima del design (anotada, no rediseño)

design §2.2 decía `ivaCobrado = derivarBalance(ingresosIva, reversosIvaCobrado)`. `ingresosIva` incluye la
**anulación de un Pago de IVA** (`ingreso_reverso_pago_iva`, dueño `iva`), así que anular un pago subía el
«IVA cobrado», contra R5 («los Pagos de IVA y sus anulaciones NO DEBEN cambiar el IVA cobrado»). Lo cazó el
test unitario R4/R5 (176,50 en vez de 136,50). Arreglo: una cubeta más, `cargosIva` (ingresos `iva` con
liquidez «cargo» = los tres IVA cobrados), e `ivaCobrado = derivarBalance(cargosIva, reversosIvaCobrado)`.
Siguen siendo seis `derivarBalance` y ninguna resta propia.

## Literales de fichas previas reescritos (con su valor de antes en comentario)

El IVA sale de la ganancia, así que las fotografías de la 459/461/457/458-B que fijaban ganancia, ingresos
propios, «De Ordenex», composición o R7 de tres bolsillos se reescribieron (cada uno con «ficha 488» y el
valor anterior): `caja-derivacion-457/459/461`, `caja-caracterizacion-459`, `wallet-anulacion-458`,
`analitica-anulacion-rechazo-458`, `caja-invariante-tiendas`, `ajuste-caja-anulacion-461`,
`caja-cadena-pago-anulacion`, `analitica-financiera-service/serie`, `finanzas-diario`, `wallet-service`,
`efecto-movimiento`, `como-quedo`. Los tests de migración previos (`caja-tesoreria`, `caja-459`,
`cobro-tienda-461`, `abono-tienda-457`, `wallet-458`) corren su ventana de posiciones del enum 2 valores
(mismo criterio que usaron la 457/458-B). Nada se relajó: R7 gana el cuarto bolsillo.

## Mapa R → test (backend)

| R | Test |
| --- | --- |
| R1 | `caja-tesoreria.test.ts` («R1: los SEIS movimientos de IVA…», «R1/R22 … EFECTIVO») + `metrics-caja-naturaleza.guardia` |
| R2, R3, R6 | `caja-tesoreria.test.ts` («R2/R3/R6…») + `caja-iva-488.test.ts` §1 |
| R4, R5 | `caja-tesoreria.test.ts` («R4/R5…», «R4 (P3)…») + `caja-iva-488.test.ts` §1 |
| R7 | `caja-tesoreria.test.ts` («R7 … TODO el catalogo») + `caja-derivacion-457/459/461` (500 conjuntos) + `caja-iva-488.test.ts` §1 |
| R8 | `caja-iva-488.test.ts` B.0 (literales de antes) |
| R9 | `caja-iva-488.test.ts` §2 (periodo, concepto, «A quién») |
| R10 | `caja-tesoreria.test.ts` («R10…») + `caja-iva-488.test.ts` §3 + `caja-caracterizacion-459` (bloque 488) |
| R14, R16 | `caja-tesoreria.test.ts` (tabla de la barra: 4 modos × I>0/I=0/I<0, y R16) |
| R19 | `caja-tesoreria.test.ts` («T B.5 … R19») + `caja-iva-488.test.ts` §1 R19 |
| R20 | `tests/unit/actions/wallet-actions.test.ts` («ficha 488 / R20») |
| R22 | `caja-tesoreria.test.ts` («R22…») + `caja-iva-488.test.ts` §4 |
| R23, R27, R28 | `caja-iva-488.test.ts` §4 (y R27 de la anulación en §5) + `wallet-anulacion-service.test.ts` («488/R27») |
| R24 | `efecto-movimiento.test.ts` («488/R24») + `caja-iva-488.test.ts` §6 |
| R25, R26 | `caja-iva-488.test.ts` §5 + `wallet-anulacion-service.test.ts` («488/R25», «488/R26», por concepto) |
| R30 | `tests/integration/db/como-quedo.test.ts` (prefijo derivado aparte con `ivaPorPagar`, «488/R30») |
| R31, R32 | `metrics-caja-naturaleza.guardia` (listas + descripciones) + `caja-iva-488.test.ts` §7 |
| R33 | `finanzas-diario.test.ts` («488/R33») + `caja-iva-488.test.ts` §8 |
| R34 | `caja-tesoreria.test.ts` («R34…») + `caja-iva-488.test.ts` §1 R34 (el barrido de `wallet-page.test.tsx` es del frontend: ver abajo) |
| R35, R36 | `iva-488-migration.test.ts` |
| R11–R13, R15, R17, R18, R21, R29, R37, R38 | frontend (F.1–F.7) |

## Mutaciones (aplicadas a mano con `scratchpad/mutar.py`: aplica, corre, revierte y comprueba sha256 igual)

| Mutación | Rojos |
| --- | --- |
| m1 `ingreso_iva_flete: "propio"` | 11 (5 en `caja-iva-488` contra Postgres: §1, §2 periodo, §2 concepto, §7 R31, §8 R33; 6 unitarios) |
| m2 contra-asiento del Pago de IVA como `ingreso_ajuste` | 3 (`caja-iva-488` §5 R25 contra Postgres + 2 unitarios del servicio) |
| m3 quitar `ingreso_reverso_pago_iva` del `in` de `EgresoCajaDocumentosRepository` | 1 (`caja-iva-488` §5 «el libro lo marca anulado», el WHERE contra Postgres) |
| m4 `egreso_pago_iva: "cargo_a_tienda"` | 11 (6 unitarios + 5 contra Postgres) |
| m5 `porcentajeIva` sobre la cifra principal en vez de S | 5 |
| B.8: `ingreso_iva_flete` de vuelta en `ganancia_ordenex` | 2 (`metrics-caja-naturaleza.guardia`) |
| B.2: `down` con lista fija (26 valores) | 2 (`iva-488-migration` (e) ejecutado y (f) estático) |

Todas revertidas; el archivo vuelve byte a byte (sha256) y `git status` limpio tras cada una.

## Verificación (salida real en `progress/gate_488_backend.log`, sin commitear)

`./init.sh --rapido` → **`INIT_EXIT=1`**: clasifica el cambio como dinero/datos (modo AMPLIADO) y corta en
`pnpm run typecheck` con **30 errores, TODOS de UI o de tests de UI** (el contrato nuevo; los cierra
frontend_dev). Para no entregar sin medir, los pasos que el gate corre DESPUÉS de typecheck se corrieron a
mano con los mismos comandos (script en el log, «continuación manual»):

| Paso | Resultado |
| --- | --- |
| `pnpm run lint` | 0 errores (235 warnings preexistentes) |
| `test:cambiados` (`--changed origin/dev`) | 9369 tests · 9344 passed · 8 failed · **17 skipped** (los 17 son `.skip` deliberados de `AnaliticaPage.test.tsx`, con su motivo en el archivo) |
| `test:guardias` | 3760 · 3760 passed · 0 failed · 0 skipped |
| `vitest run tests/integration/db` | 4267 · 4249 passed · 4 failed · 14 skipped (los 14 = `ranking-snapshot-migration` con su `beforeAll` caído en paralelo; **aislado: 49 passed, 0 skipped**) |
| Rojos repetidos aislados | `cobro-tienda-461-completar-migration`, `notificacion-evento-bloqueo-cierre-migration`, `ranking-snapshot-migration`: **intermitentes** (verdes aislados). `orden-traspaso-migration`: rojo aislado y **mío** (censo de migraciones posteriores) → arreglado, aislado 15/15 verde (nota al final del log). |
| Baseline | rojos nuevos = los 4 archivos de UI de abajo (+ `orden-traspaso`, ya arreglado) |

Typecheck de lo que es backend (`lib/`, `db`, `tests/unit` y `tests/integration/db` de backend): limpio.

## Lo que le queda al frontend (contrato nuevo → no compila / rojo)

**Typecheck (30 errores)**:
- `app/(app)/wallet/_components/wallet-labels.ts:267` (`DUENO_LABEL` sin `iva`), `:386`, `:399`, `:404` (`TIPO_EGRESO_MANUAL_LABEL`, `DESCRIPCION_EGRESO_LABEL`, `DESCRIPCION_EGRESO_PLACEHOLDER` sin `pago_iva`).
- `app/(app)/wallet/_components/WalletLedger.tsx:118` (`DUENO_PUNTO` sin `iva`).
- `app/(app)/wallet/_components/ComposicionGananciaCard.tsx:102` (`INGRESO_ICONO` con los tres IVA), `DesgloseEgresosLista.tsx:142` (`NOMBRADO_ICONO` con el reverso del IVA), `composicion-detalle-labels.ts:79` (el reverso del IVA ya no es fila).
- Fixtures de `CajaResumenDTO` sin los 4 campos nuevos (`ivaCobrado`, `ivaPorPagar`, `signoIvaPorPagar`, `porcentajeIva`): `tests/components/{BusquedaPorGuia469,CajaComposicionBarra,CajaResumenCard,ComposicionGananciaCard,descarga/WalletDescarga,DetalleFilaComposicion,DineroIdentidadesEnPantalla,WalletCaja463,WalletCaja468,WalletCajaBarra467,WalletFiltroAQuien458E,WalletLibroCaja458E}.test.tsx`, `tests/integration/wallet-page.test.tsx:300`, `tests/unit/components/wallet-page-cobros-pendientes.test.tsx:216`, `tests/unit/guards/caja-textos-459.guardia.test.ts:121`.
- Claves IVA en fixtures de composición: `tests/components/ComposicionGananciaCard.test.tsx:74/96/161`, `DetalleFilaComposicion.test.tsx:56/68`, `tests/unit/components/rechazo-nombre-466-app.test.ts:63`; `tests/unit/components/wallet-labels.test.ts:36` (el `CATEGORIA_LABEL` ya trae «Pago de IVA» y «Pago de IVA anulado»: 27 → 29).

**Tests rojos en ejecución** (4 archivos): `ComposicionGananciaCard.test.tsx` (4: las filas IVA salen), `DetalleFilaComposicion.test.tsx` (1), `wallet-conceptos-manuales.test.ts` (R44: «las diez» → once con `pago_iva`), `wallet-labels.test.ts` (2: 27 → 29 textos).

**Pantalla (F.1–F.9)**: tarjeta (`ivaCobrado` bajo la ganancia, tercer bolsillo con `ivaPorPagar`/`signoIvaPorPagar`), barra con `porcentajeIva` (los segmentos de design §2.3), concepto «Pago de IVA» en el diálogo (`tipoEgreso: "pago_iva"`, `CONCEPTO_REGISTRO_DE.pago_iva = "pago_iva"`; el borde ya exige «A quién»), línea «IVA por pagar» en `AsiQueda` (`lineas.ivaPorPagar`) y en `DetalleMovimientoPanel` (`caja.ivaPorPagar`), `DUENO_LABEL/DUENO_PUNTO.iva` en libro y descarga, textos y ayuda (R37). El barrido «todo STRING» de `wallet-page.test.tsx` (R34) vuelve a compilar al completar su fixture.

## Veredicto

Backend de la 488 hecho y medido contra Postgres (R1–R10, R14, R16, R19, R20, R22–R28, R30–R36 con test y 7 mutaciones rojas); el gate queda en rojo SOLO por la UI que el contrato nuevo deja sin compilar, que es del frontend_dev.
