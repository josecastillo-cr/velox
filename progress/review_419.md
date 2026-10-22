# Revisión 419: la bodega central cierra la devolución con comprobante

Rama `feature/419-central-cierra-devolucion-comprobante`, HEAD 0bc3af8e. Diff contra `dev` f34f0f6d:
34 archivos. Worktree `.claude/worktrees/f419`. Revisor: reviewer (2026-10-21).
Búsqueda de código: leí directamente los archivos del diff (`git diff`, `grep`) y no hizo falta el
grafo, porque el diff ya acota cada símbolo. Todo está confirmado en el archivo real.

## Veredicto: OK (0 bloqueantes, 5 menores)

El código cumple R1–R24 y las decisiones del humano. Queda proceso: marcar `tasks.md` y hacer F4
(verificación visual). Eso condiciona el `done`, no el merge.

## Checklist

| Punto | Resultado |
|---|---|
| requirements.md con R1..R24 en EARS | OK |
| design.md con alternativas descartadas | OK (A1–A4, §2) |
| tasks.md todas `[x]` | **FALLA**: 0 de 16 marcadas (m1); F4 sin hacer (m2) |
| Mapa R -> test en `progress/impl_419.md` | OK (backend + bloque F) |
| Cada R con un test real | OK (ver la tabla) |
| typecheck / lint | OK (dentro del gate) |
| Tests | OK: los 14 archivos de la 419 + los tocados, 297/297; R16 (4 archivos) 42/42 |
| E2E en flujo crítico | No aplica: no hay harness E2E y la 419 no toca auth, pagos ni ingesta |
| RLS en tablas nuevas | OK, MEDIDO en la base local: `relrowsecurity=true` en las 3 tablas, 0 policies |
| Migración reversible | OK, MEDIDO: el `down.sql`, ejecutado dentro de una transacción revertida, deja 0 tablas `devolucion_tienda_%` y `pg_enum` sin cambios (360 -> 360); al revertir siguen las 3 tablas |
| No toca enums | OK: ni el up ni el down; sin `ALTER TYPE` |
| Sin secretos ni contexto hardcodeado | OK: el bucket y los límites salen de `gestionConfig`; sin país ni moneda |
| Webhooks | No hay endpoint nuevo. El outbox `webhook_estado` va por `appendCambioEstado` en la misma tx (R14, con test contra Postgres) |
| Capas | OK: action = borde (zod, sesión, composition root); el servicio no conoce HTTP ni Prisma; el repo solo hace queries; interfaces en `lib/interfaces/{repositories,services}` |
| Permisos en el servidor | OK: `esAccesoTotal` en el servicio, al confirmar y al ver; la página solo decide qué se ofrece |
| Mutación interna por Server Action | OK |
| Gate `./init.sh --rapido` | **INIT_EXIT=0** (`progress/gate_419_review.log`, sin commitear). Relacionados: 887 archivos, 11527 passed / 26 skipped. Guardias: 273 archivos / 3757 passed. `tests/integration/db`: 454/454 archivos, 4229 passed, **0 skipped**. «Sin rojos nuevos» |
| Entrada en `progress/history.md` | Pendiente; la hace el leader al cerrar |

## Decisiones del humano: comprobadas

- **Solo maestro/admin.** `esAccesoTotal` (= `[maestro, admin]`) es la primera línea de
  `confirmarEntrega` y de `verComprobante`. Con adminSatelite, adminTienda, mensajero y apiKey el test
  da `forbidden` y 0 llamadas a repo y storage. En la UI, `accionesLote` y
  `puedeVerComprobanteEntrega` son `esAccesoTotal`, y `/ordenes` hace `notFound` a mensajero y
  adminSatelite.
- **Comprobante obligatorio: JPEG/PNG/WebP, 5 MB, máximo 3.** El borde usa `evidenciasSchema` (el de
  la 119); el servicio revalida con `gestionConfig`, y la tabla tiene un CHECK de `content_type`.
- **Un lote, una tienda.** El WHERE filtra por `tienda_id`, y el modal bloquea nombrando las tiendas
  (R18).
- **Tope de 300.** `TOPE_ORDENES_POR_LOTE`, aplicado en zod, en el servicio y en el modal.
- **Comprobante visible solo a maestro/admin.** Un rol ajeno recibe `no_encontrado`, igual que si la
  orden no tuviera comprobante.
- **El escáner sigue intacto.** El `git diff` no toca `RecepcionOrigenService.ts`,
  `recepcion-origen.ts`, `OrdenRepository.ts` ni el escáner, y sus 4 archivos de test pasan sin
  cambios.
- **No mueve dinero.** Un test con `pg_stat_xact_user_tables` mide delta 0 en 6 tablas. Siembra dinero
  propio, así que el verde no puede venir de una tabla vacía.

## Mapa R -> test (comprobado leyendo cada test)

| R | Test |
|---|---|
| R1, R2 | `tests/unit/services/devolucion-tienda-service.test.ts` «R1/R2» |
| R3, R4, R5 | `tests/unit/types/devolucion-tienda-schema.test.ts`, `tests/unit/actions/devolucion-tienda-action.test.ts`, service «R3/R4/R5» |
| R6, R7, R9, R10 | `tests/integration/db/419/confirmar-entrega-lote-sql-real.test.ts` «lote mixto» |
| R8 | mismo archivo, «R8 — concurrencia real»: lote contra lote, y lote contra `recibirEnOrigen` |
| R11 | mismo archivo, «R11», + service |
| R12 | service «R12»: si falla la 2a subida se retira la 1a; si falla la 1a no se llama a `remove` |
| R13 | integración «R13» + service |
| R14 | `tests/integration/db/419/confirmar-entrega-webhook-sql-real.test.ts` |
| R15 | `tests/integration/db/419/confirmar-entrega-sin-dinero-sql-real.test.ts` |
| R16 | `recepcion-origen-service.test.ts`, `recepcion-origen-action.test.ts`, `components/EscanerRecepcionOrigen.test.tsx`, `tests/integration/db/devolucion-rechazadas-flow.test.ts`, todos sin modificar |
| R17, R21 | `tests/components/OrdenesListado.confirmar-entrega-419.test.tsx` |
| R18, R19, R20 | `tests/components/ConfirmarEntregaTiendaModal.test.tsx` (textos literales) |
| R22 | `tests/unit/actions/ver-comprobante-devolucion-tienda.test.ts`, service «R22», `tests/components/ComprobanteEntregaTienda.test.tsx` |
| R23 | service «R23» (regex de la ruta; la ruta no aparece en el resultado serializado) + integración «R23» |
| R24 | `tests/unit/domain/order-status-transiciones.guardia.test.ts` «419/R24», + el inventario de la 140 con las mismas cifras |

## Mutaciones del revisor

Cada una se restauró con `git checkout` y el árbol quedó limpio.

| Mutación en `DevolucionTiendaRepository.confirmarEntregaLote` | Resultado en `confirmar-entrega-lote-sql-real` |
|---|---|
| quitar la línea `AND "tienda_id" = (tiendaId)` del UPDATE | **6 failed** (R6, R7, R9, R10, R11 ×2) |
| quitar la línea `AND "estatus_id" = (origenEstatusId)` del UPDATE | **6 failed**, 3 passed, 2 skipped |

El WHERE es la defensa, y su test corre contra Postgres, donde vive.

## Tests existentes modificados: es contrato legítimo, no se aflojaron

- **`tests/components/TraspasarMensajeroListado.test.tsx` (427/R34).** Se retira la afirmación de
  que la fila `devolviendo_a_tienda` no tenía casilla. Era un efecto colateral: ese estado no tenía
  acción por lote, y R17 se la da a propósito. Lo que protege la 427 (en `devolviendo_a_tienda` NO se
  ofrece el traspaso) se sigue afirmando con esa fila sola marcada, y ahora es más estricto: se
  afirma que aparece «Confirmar entrega a la tienda» y que no aparece el traspaso.
- **`tests/unit/guards/estado-con-info.guardia.test.ts`.** Añade UNA entrada de clase frase a
  `USOS_PERMITIDOS`, para el motivo «su estado actual es «X»» del resumen. Es el uso que la guardia
  contempla (el estado dentro de una frase, como en `RecuperarABodegaModal`), y la guardia no cambia
  para el resto del árbol.
- **Altas de inventario, sin aflojar ninguna aserción:**
  - `inventario-transiciones-140.ts`: solo cambia el `callSite` de #28; las cifras son las mismas.
  - `api-key-dependencias-usuario.ts`: clasifica las 2 FK nuevas a `usuario`, con su motivo.
  - `orden-traspaso-migration.test.ts`: suma la migración de la 419 a su lista exacta de migraciones
    posteriores.

## Transición #28

`TRANSICIONES.devolviendo_a_tienda` sigue con UNA sola salida: `devuelta_a_tienda`, por
`ajuste_estado`. Solo cambia el metadato `rol`, que ahora nombra `adminTienda (escaner)` y
`maestro/admin (central)`. No hay arista ni valor de enum nuevos. El test de R24 lo fija, y
`devuelta_a_tienda` sigue siendo terminal.

## Errores en el modal

- `ok` y `ninguna_devuelta`: muestran el resumen.
- `comprobante_no_guardado`, `forbidden` y `unauthenticated`: muestran un texto dentro del diálogo
  (`role=alert`).
- Promesa rechazada (`Modal.onError`): error genérico en el diálogo y en un toast.

Todos estos casos tienen test. Queda un hueco estrecho, que es el m3.

## Hallazgos

- **m1 · menor.** En `tasks.md`, B1–B11 y F1–F5 siguen `[ ]`, y CHECKPOINTS pide `[x]`. Todo salvo
  F4 está hecho y verificado; solo falta marcarlas (precedente: review_484, m1).
- **m2 · menor (condiciona el `done`, no el merge).** F4, la verificación en la app, está sin hacer;
  la bitácora la deja al leader. Es el único punto que mira la pantalla real:
  - login admin: lote mixto, resumen, historial y comprobante;
  - login adminSatelite: la acción no aparece.

  Hay que hacerla y anotarla antes de cerrar la ficha.
- **m3 · menor.** En el modal, el caso `validation_error` puede quedar mudo:
  - si el servidor devuelve `fieldErrors` vacío, o solo con claves que no se pintan, no se muestra
    nada (`otros.length === 0` y no hay error en la foto);
  - un `safeParse` local que falle solo en `tiendaId`/`ordenIds` se guarda en `fieldErrors` y
    tampoco se pinta.

  Con datos reales es casi imposible, porque los ids vienen del DTO, pero contradice «errores nunca
  mudos». Arreglo: un texto genérico de respaldo cuando no hay nada que pintar.
- **m4 · menor.** Falta `*-migration.test.ts` para `20261021120000_devolucion_tienda_comprobante_419`,
  que es el molde del repo para fijar RLS, CHECK y el down. El revisor midió RLS y reversibilidad en
  la base local (ver la checklist), pero ningún test las protege de una edición futura.
- **m5 · menor.** En la bitácora, B11 y F4 pedían `progress/impl_419_backend.md` e
  `impl_419_frontend.md`, y se usó un único `progress/impl_419.md`, sin impacto. Su gate backend
  tuvo 9 `skipped` en `integration/db`, cuando B11 pide «skipped = 0»; el gate del revisor da 0
  skipped (454/454 archivos), así que queda cubierto.

Observación, no hallazgo: en la action, un rol ajeno que envía un payload inválido recibe
`validation_error` antes que `forbidden`, porque zod corre en el borde. No se lee ni se escribe nada,
así que R2 se cumple.

## Para cerrar la ficha

Marcar `tasks.md` (m1), hacer y anotar F4 (m2) y añadir la entrada a `progress/history.md`. m3 y m4
pueden arreglarse aquí o en una ficha de seguimiento; ninguno bloquea el merge.
