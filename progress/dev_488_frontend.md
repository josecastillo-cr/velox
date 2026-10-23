# Ficha 488 — frontend (frontend_dev) — bitácora

Rama `feat/488-ganancia-caja-sin-iva` (worktree `.claude/worktrees/f488`), sobre `19e984a1` (backend).
Búsqueda: el MCP `codebase-memory` no estaba en mi conjunto de herramientas; se usó `grep` y lectura
directa de cada archivo. Ni backend, ni schema, ni migraciones tocados: el contrato del backend bastó.

## Tareas (F.1–F.9)

| Tarea | Hecho |
| --- | --- |
| F.1 Textos | `wallet-labels.ts`: `gananciaPista` («…, sin el IVA»), `ivaCobrado`, `ivaPorPagar`, `ivaPorPagarPista`, `CAJA_COMPOSICION_LABEL.iva`, nombre accesible con « IVA por pagar: ₡X.», `solo_ordenex` (R17), nota de la diferencia con «el IVA» (R18), `DUENO_LABEL.iva`, `TIPO_EGRESO_MANUAL_LABEL`/`DESCRIPCION_EGRESO_*` con `pago_iva`. Textos literales de design §6. |
| F.2 Tarjeta | `CajaResumenCard.tsx`: línea `data-dato="iva-cobrado"` `text-xs` dentro de la región de la ganancia; tercer bolsillo `section[aria-label="IVA por pagar"][data-bolsillo="iva"]` (superficie neutra, insignia de `signoIvaPorPagar`, pista), rejilla `md:grid-cols-3`. Cero controles nuevos. |
| F.3 Barra | `BarraComposicionCaja.tsx`: segmento `iva`; `campo` por segmento (`porcentajeTiendas`/`porcentajeIva`); con `signoIvaPorPagar === "positivo"` los segmentos de design §2.3, si no los de antes (R16, árbol idéntico). Color `bg-chart-13` (no `bg-info`: 2,34:1 contra la pista en oscuro, medido en `TableroDiaComposicion.test.tsx`), exportado como `COLOR_IVA_POR_PAGAR` y reutilizado por el punto del libro. |
| F.4 Composición | Fuera los tres IVA de `INGRESO_ICONO`, el reverso de `NOMBRADO_ICONO` y de `EGRESO_NOMBRADO_LABEL`. |
| F.5 Diálogo | `wallet-conceptos-manuales.ts`: `pago_iva` tras `sueldo` (grupo «sale», destino egreso administrativo, «A quién» obligatorio por la clase), `FRASE_DEL_EFECTO.pago_iva`, `CONCEPTO_REGISTRO_DE.pago_iva`. `AsiQueda.tsx`: línea «IVA por pagar». |
| F.6 Libro/descarga/detalle | `WalletLedger.tsx` `DUENO_PUNTO.iva`; la descarga toma `DUENO_LABEL` (sin cambio de código); `DetalleMovimientoPanel.tsx`: fila «IVA por pagar» en «Cómo quedó». |
| F.7 Ayuda | `docs/ayuda/oficina/wallet-caja.md`: sección «El IVA por pagar», barra con tres bolsillos, once conceptos, Pago de IVA y su anulación, dueño «IVA por pagar», «Así queda»/«Cómo quedó»; el párrafo de la anulación del cobro por devolución ya no dice que la ganancia baja en el IVA. |
| F.8 Ver la app | Abajo. |
| F.9 Cierre | Gate abajo; commit. |

Typecheck: los 30 errores que dejó el backend, cerrados (fixtures de `CajaResumenDTO` con los cuatro
campos en cero = tarjeta y barra de antes; claves IVA fuera de los fixtures de composición).

## Literales de otras fichas reescritos (cada uno con «ficha 488» y su valor anterior en comentario)

`ComposicionGananciaCard.test.tsx` (sin los tres IVA: total de ingresos 5.709,75 → 5.140; ganancia
3.519 → 2.949,25; seed 8 → 5; filas IVA fuera), `DetalleFilaComposicion.test.tsx` (18 → 14 controles),
`CajaComposicionBarra.test.tsx` (nombre accesible, `solo_ordenex`), `CajaResumenCard.test.tsx` (nota R18,
«sin siglas salvo IVA», `₡0` del R64), `wallet-labels.test.ts` (27 → 29 conceptos, tipos de egreso,
filas nombradas), `wallet-conceptos-manuales.test.ts` (10 → 11; la lista de categorías administrativas
gana `egreso_pago_iva`), `wallet-registrar-movimiento-dialog.test.tsx` (10 → 11 radios, grupo «sale»),
`rechazo-nombre-466-app.test.ts`, `libro-kardex-468.test.ts` (`DUENO_LABEL` + `iva`),
`contexto-457/458/461.test.ts` (ayuda: once conceptos y la lista de «sale»).

## Mapa R → test (frontend)

| R | Test |
| --- | --- |
| R11, R12, R13 | `tests/components/CajaResumenCard488.test.tsx` |
| R14, R15, R16 | `tests/components/BarraComposicionCaja488.test.tsx` (4 modos con IVA, 4 × {cero, negativo} = árbol de antes, color, signo manda) |
| R17, R18, R38 | `tests/unit/components/wallet-labels.test.ts` (bloque «488», con detector de siglas autocomprobado) |
| R19 | `tests/components/ComposicionGananciaCard.test.tsx` (bloque «Ficha 488») |
| R21 | `wallet-conceptos-manuales.test.ts` («FICHA 488») + `wallet-registrar-movimiento-dialog.test.tsx` («488 — el Pago de IVA»: grupo, «A quién» obligatorio, `tipoEgreso: "pago_iva"`, frase y libro) |
| R24 | `wallet-registrar-movimiento-dialog.test.tsx` (R24: pide `pago_iva`, pinta «IVA por pagar» antes/después) |
| R29 | `tests/components/WalletLedgerIva488.test.tsx` (celda de dueño, conceptos, `filaBaseCaja` de la descarga) + `libro-kardex-468.test.ts` |
| R30 | `tests/components/DetalleMovimientoPanel.test.tsx` («Cómo quedó» con «IVA por pagar») |
| R34 | `tests/integration/wallet-page.test.tsx` (el barrido «todo STRING» vuelve a compilar con los campos nuevos) |
| R37 | `tests/unit/docs/ayuda-wallet-caja-488.test.ts` |

## F.8 — la pantalla

Dev server propio en `:3488` (no había otro), apagado al terminar. Para entrar roté las contraseñas de
las CUATRO cuentas QA de la base LOCAL (`seed-usuarios-qa.ts`, `localhost:5432` confirmado): si otra
sesión las usaba, su login dejó de valer. `/wallet` como `admin.qa`, estado «flujo», sin filtros:

- Cifra principal ₡13.483.932,72 = De Ordenex (ganancia ₡13.331.231,72 + capital ₡0) + De las tiendas
  ₡147.670,10 + IVA por pagar ₡5.030,90 (R7 a ojo, al céntimo).
- Bloque de la ganancia: «Lo que Ordenex gana menos lo que gasta, sin el IVA» y debajo, más pequeño,
  «IVA cobrado a las tiendas: ₡5.030,90».
- Tercer bolsillo «IVA por pagar · Positivo · ₡5.030,90» con su pista; nota de la diferencia con «el IVA».
- Sin barra (no hay saldo inicial en local). No registré ni anulé un Pago de IVA en la app (eso queda
  cubierto por `caja-iva-488.test.ts` §4–§6 del backend contra Postgres).

## Verificación — `./init.sh --rapido` (salida en `progress/gate_488_frontend.log`, sin commitear)

Primera vuelta: `INIT_EXIT=1` por un rojo NUEVO y mío (`libro-kardex-468.test.ts`, el `DUENO_LABEL` sin
`iva`) → arreglado y aislado 36/36 verde. Segunda vuelta (la del log):

| Bloque | Resultado |
| --- | --- |
| typecheck / lint | pasa / pasa |
| relacionados (`--changed origin/dev`) | 729 archivos · 9498 passed · 0 failed · 17 skipped (los `.skip` deliberados de `AnaliticaPage.test.tsx`) |
| guardias | 273 archivos · 3760 passed · 0 skipped |
| `tests/integration/db` (ampliado) | 4262 passed · 5 failed · 0 skipped; los 4 archivos rojos, repetidos AISLADOS: 58/58 verdes → intermitentes |
| **INIT_EXIT** | **0** |

Intermitentes (rojo en paralelo, verde aislado; ninguno toca la caja): `cierre-sin-gestion-tope-sql-real`,
`correccion-dia-reparto.int`, `notificacion-evento-geocodificacion-caida-migration`,
`push-destinatarios-equivalencia`. Los tres que vio el backend no cayeron esta vez (en la primera vuelta,
integración 4267/4267).

## Veredicto

Frontend de la 488 hecho (F.1–F.9), con los 30 errores de typecheck y los rojos de UI cerrados, la
pantalla vista con números que cuadran y `./init.sh --rapido` en verde (`INIT_EXIT=0`).
