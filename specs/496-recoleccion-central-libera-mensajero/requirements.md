# 496 — Recolección recibida en central libera al mensajero · requirements

> Ficha: `feature_list.json` id 496 (zona `backend`, `sdd: true`, rama
> `fix/496-recoleccion-central-libera-mensajero` desde `dev`). Fuente: H1 de
> `progress/prompt-hotfix-portable.md` (reglas de negocio decididas en el repo de origen, no se
> reabren) e inventario `progress/inventario_hotfix_H1_H4.md` (rutas reales de este repo).
>
> **El defecto (confirmado en el código el 2026-11-02).** La recolección deja al recolector como
> `mensajero_asignado_id` y lleva la orden de `recolectando` a `en_ruta_bodega_central`. La
> recepción central (`en_ruta_bodega_central → en_bodega_central`) solo cambia el estado
> (`lib/repositories/OrdenRepository.ts`, `recibirEnBodegaCentral`, `data: { estatusId }`). La orden
> queda en la central **todavía a nombre del mensajero**, y por eso:
> - «Reasignables» (`en_bodega_central` **y** sin mensajero) no la muestra;
> - el conteo de Monitoreo por mensajero la sigue contando en su tarjeta (cubo «otros») el día de la
>   `asignacion_recoleccion`.
>
> **Decisión del humano (2026-11-02): se REVOCA la R18 de `specs/138-recepcion-bodega-central/
> requirements.md` para la rama `en_ruta_bodega_central → en_bodega_central`.** Esa R18 exigía
> conservar `mensajero_asignado_id` en toda recepción central. Desde esta ficha:
> - la recepción **desde `en_ruta_bodega_central`** libera la asignación (R1);
> - la recepción de **devoluciones** (`devolviendo_a_bodega_central → por_devolver_a_tienda`)
>   **sigue conservándola** (R2);
> - la parte de la R18 sobre `num_guia` sigue vigente en las dos ramas (R4).
>
> El test que hoy fija la R18 en la rama revocada
> (`tests/unit/repositories/orden-repository.recepcion-bodega-central.test.ts`, aserciones
> `data` = `{ estatusId }` y `not.toHaveProperty("mensajeroAsignadoId")`) se reescribe en esta ficha.
>
> **Alcance cerrado:** Reasignables, Monitoreo y «Recolectadas hoy», más la migración de datos de
> las órdenes que ya están así. No se crean ni modifican gestiones, pagos, movimientos de wallet ni
> cierres. Sin multiempresa en este repo (no existe `organizacion_id`): ninguna lectura nueva lleva
> filtro por empresa.
>
> Términos:
> - **Trío de asignación**: `mensajero_asignado_id`, `asignado_at` y `fecha_reparto` de la orden.
> - **Recepción de recolección**: recepción central de una orden en `en_ruta_bodega_central`, que
>   la lleva a `en_bodega_central`.
> - **Recepción de devolución**: recepción central de una orden en `devolviendo_a_bodega_central`,
>   que la lleva a `por_devolver_a_tienda`.
> - **Última fila de historial**: la fila de `orden_historial_estado` de la orden con mayor
>   `created_at`; a igualdad, la de mayor `id`.
> - **Orden objetivo de la migración**: orden no borrada, en `en_bodega_central`, con
>   `mensajero_asignado_id` no nulo, cuya última fila de historial tiene `origen_tipo =
>   recepcion_bodega_central` y estado de origen `en_ruta_bodega_central`.
> - **Ventana del día**: la ventana CR que ya usa «Recolectadas hoy» (`[inicio del día CR, inicio
>   del día siguiente CR)`).

## Recepción en la bodega central

- **R1** — CUANDO la bodega central recibe una orden en `en_ruta_bodega_central` y la transiciona a
  `en_bodega_central`, el sistema DEBE dejar el trío de asignación en NULL en la misma operación
  atómica que cambia el estado.
- **R2** — CUANDO la bodega central recibe una orden en `devolviendo_a_bodega_central` y la
  transiciona a `por_devolver_a_tienda`, el sistema DEBE conservar sin cambios el trío de
  asignación.
- **R3** — SI una recepción central no transiciona la orden (ya estaba recibida, su estado no es
  un origen de la recepción central, está borrada o perdió la carrera contra otra recepción),
  ENTONCES el sistema NO DEBE modificar el trío de asignación ni escribir filas de historial.
- **R4** — CUANDO una recepción central transiciona la orden, el sistema DEBE escribir exactamente
  una fila de historial con `origen_tipo = recepcion_bodega_central` y DEBE conservar sin cambios
  `num_guia`.
- **R5** — CUANDO una recepción central transiciona la orden, el sistema NO DEBE crear, modificar
  ni borrar filas de `gestion_orden`, `wallet_movimiento`, `wallet_tienda_movimiento`,
  `pago_mensajero_movimiento` ni `cierre_dia`.

## Reasignables

- **R6** — CUANDO un usuario pide el listado de órdenes con el filtro «Reasignables» después de una
  recepción de recolección, el sistema DEBE incluir esa orden en el resultado.
- **R7** — SI una orden en `en_bodega_central` tiene `mensajero_asignado_id` no nulo, ENTONCES el
  sistema NO DEBE incluirla en el listado con el filtro «Reasignables».

## Monitoreo (conteo del tablero por mensajero)

- **R8** — CUANDO una orden con `asignacion_recoleccion` en la ventana del día ha tenido una
  recepción de recolección, el sistema NO DEBE contarla en la fila de ningún mensajero del conteo
  por mensajero de ese día.
- **R9** — MIENTRAS una orden con `asignacion_recoleccion` en la ventana del día siga en
  `en_ruta_bodega_central` asignada a su mensajero, el sistema DEBE contarla en la fila de ese
  mensajero del conteo por mensajero de ese día.

## «Recolectadas hoy» del mensajero

- **R10** — CUANDO un mensajero pide «Recolectadas hoy», el sistema DEBE incluir cada orden no
  borrada con una `recoleccion_tienda` suya en la ventana del día que esté asignada a él o que no
  tenga mensajero asignado.
- **R11** — SI una orden que el mensajero recolectó en la ventana del día está asignada a otro
  mensajero, ENTONCES el sistema NO DEBE incluirla en su «Recolectadas hoy».
- **R12** — SI se pide la lectura de datos de «Recolectadas hoy» de un mensajero para una orden sin
  mensajero asignado que no tiene en su historial ninguna `recoleccion_tienda` con ese mensajero
  como actor, ENTONCES el sistema NO DEBE devolver esa orden.
- **R13** — SI una orden que el mensajero recolectó está borrada, ENTONCES el sistema NO DEBE
  incluirla en su «Recolectadas hoy».

## Migración de datos

- **R14** — CUANDO se aplica la migración de esta ficha, el sistema DEBE dejar en NULL el trío de
  asignación de cada orden objetivo y NO DEBE escribir filas de historial.
- **R15** — SI una orden no es orden objetivo (su última fila de historial es posterior a la
  recepción o es de otro tipo, la recepción fue de una devolución, está borrada, no está en
  `en_bodega_central` o no tiene mensajero), ENTONCES la migración NO DEBE modificar ninguna de sus
  columnas.
- **R16** — CUANDO se aplica el `down.sql` de la migración, el sistema DEBE reponer
  `mensajero_asignado_id` con el actor de la última `recoleccion_tienda` de cada orden no borrada en
  `en_bodega_central`, sin mensajero, cuya última fila de historial sea una recepción central desde
  `en_ruta_bodega_central`; NO DEBE reponer `asignado_at` ni `fecha_reparto`; y SI esa orden no
  tiene ninguna `recoleccion_tienda`, ENTONCES DEBE dejarla sin mensajero.
- **R17** — CUANDO la migración se aplica sobre una base sin órdenes objetivo, o por segunda vez
  tras una primera aplicación, el sistema NO DEBE modificar ninguna fila de `orden`.

## Trazabilidad (mapa requisito → test; lo confirma el implementer en `progress/impl_496.md`)

| R | Test | Tipo |
|---|---|---|
| R1 | `tests/integration/db/recepcion-central-libera-496.test.ts` «recepción de recolección deja el trío en NULL»; forma del `data` en `tests/unit/repositories/orden-repository.recepcion-bodega-central.test.ts`; flag por transición en `tests/unit/services/recepcion-bodega-central-service.test.ts` | Postgres + unit |
| R2 | `recepcion-central-libera-496.test.ts` «recepción de devolución conserva el trío»; unit del repo (rama `liberaAsignacion: false`) | Postgres + unit |
| R3 | `recepcion-central-libera-496.test.ts` «recepción que no transiciona no toca la asignación» (ya recibida, borrada, estado no origen) | Postgres |
| R4 | `recepcion-central-libera-496.test.ts` «una sola fila de recepción y num_guia intacto» | Postgres |
| R5 | `recepcion-central-libera-496.test.ts` «conteos de gestión, wallet, pagos y cierres sin cambio» | Postgres |
| R6 | `recepcion-central-libera-496.test.ts` «Reasignables trae la recolección recibida» | Postgres |
| R7 | `recepcion-central-libera-496.test.ts` «Reasignables no trae una orden en central con mensajero» | Postgres |
| R8 | `tests/integration/tablero-dia-recoleccion-496.test.ts` «recibida en central no cuenta» | Postgres |
| R9 | `tablero-dia-recoleccion-496.test.ts` «aún en ruta a la central sigue contando» | Postgres |
| R10 | `recepcion-central-libera-496.test.ts` «Recolectadas hoy trae la recibida (sin mensajero) y la asignada a mí» | Postgres |
| R11 | `recepcion-central-libera-496.test.ts` «Recolectadas hoy no trae la mía asignada a otro» | Postgres |
| R12 | `recepcion-central-libera-496.test.ts` «no trae la sin mensajero recolectada por otro» | Postgres |
| R13 | `recepcion-central-libera-496.test.ts` «no trae la recolectada borrada» | Postgres |
| R14 | `tests/integration/db/recoleccion-central-libera-496-migration.test.ts` «libera la orden objetivo, sin historial» | Postgres |
| R15 | `recoleccion-central-libera-496-migration.test.ts` «no toca a las hermanas» (5 hermanas) | Postgres |
| R16 | `recoleccion-central-libera-496-migration.test.ts` «down repone al mensajero y nada más» | Postgres |
| R17 | `recoleccion-central-libera-496-migration.test.ts` «base sin objetivo y segunda aplicación: 0 filas» | Postgres |

## Preguntas abiertas

Ninguna bloqueante. Una consecuencia de la regla decidida, para que el humano la vea antes de
aprobar (el spec la asume tal cual, sin reabrir la regla):

- **P1 (informativa).** La liberación va por la **arista** `en_ruta_bodega_central →
  en_bodega_central`, no por cómo llegó la orden a `en_ruta_bodega_central`. Además de la
  recolección (#43), a ese estado también se llega por la reversión de un incidente (#56,
  `lib/types/order-status-transiciones.ts`, maestro/admin). Esa orden también saldrá de la
  recepción sin mensajero y aparecerá en «Reasignables». Es lo que dice la tabla de transiciones
  decidida (`en_ruta_bodega_central` → `liberaAsignacion: true`); si el humano quisiera excluir ese
  caso, cambian R1, R14 y el design §2.
