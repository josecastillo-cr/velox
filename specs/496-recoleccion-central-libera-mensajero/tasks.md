# 496 — Recolección recibida en central libera al mensajero · tasks

> Zona `backend`; implementa `backend_dev`. Rama `fix/496-recoleccion-central-libera-mensajero`
> desde `dev` (SHA que dé el leader; `checkout --detach` + merge-base como primer paso). Gate:
> `./init.sh --rapido`, que se amplía solo con `tests/integration/db` por llevar migración. **Nunca el
> completo.** Sin E2E. `[P]` = paralelizable con las demás `[P]` de su fase una vez cumplidas sus
> dependencias. Un commit por task: `test(496): …` / `fix(496): …` / `docs(496): …`. Sale con la
> próxima release. Las mutaciones (design §7.1) nunca corren a la vez que el gate.
>
> **Orden obligatorio: el test de regresión se ve ROJO contra el código actual antes de tocar
> `lib/`.** Si algún rojo esperado sale verde, PARA y lo informas con la evidencia: el bug no sería
> el descrito.

## Fase 0 — Arranque

- [x] **T0 — Worktree y línea base.** Confirmar en el archivo real las rutas del design §0 (si
  `dev` se movió, anotar las nuevas líneas). Comprobar `prisma migrate status` contra la base local
  (solo el host, sin credencial) y que no hay triggers sobre `orden` que reaccionen al cambio de
  `mensajero_asignado_id` (`SELECT tgname FROM pg_trigger WHERE tgrelid = 'orden'::regclass AND NOT
  tgisinternal`). Correr aislados `tests/unit/repositories/orden-repository.recepcion-bodega-central.test.ts`,
  `tests/unit/services/recepcion-bodega-central-service.test.ts`,
  `tests/unit/services/recoleccion-tienda-service.test.ts`,
  `tests/integration/tablero-dia-recoleccion.test.ts` y
  `tests/integration/db/devolucion-rechazadas-flow.test.ts`.
  **Hecho:** los cinco verdes con `skipped = 0` en los de Postgres (si saltan, no hay base: parar),
  anotado con el SHA en `progress/impl_496.md`.

## Fase 1 — Tests de regresión en rojo (antes del arreglo)

- [x] **T1 [P] — Integración de la recepción** (depende de T0). Crear
  `tests/integration/db/recepcion-central-libera-496.test.ts` (design §7) con
  `describeSiHayBase` + `enTransaccionRevertida`. Siembra por caso: mensajero M1 y M2, tienda,
  orden recorrida `asignacion_recoleccion` (M1) → `recoleccion_tienda` (actor M1) →
  `en_ruta_bodega_central` con `mensajero_asignado_id = M1`; recepción por el service real.
  Casos: R1 (trío NULL), R2 (devolución con mensajero: trío intacto), R3 (ya recibida / borrada /
  estado `en_bodega_satelite`: trío intacto y 0 filas de historial nuevas), R4 (exactamente 1 fila
  `recepcion_bodega_central`, `num_guia` igual), R5 (cinco conteos iguales), R6, R7, R10, R11, R12,
  R13. Valores esperados como literales, no derivados de la función bajo prueba. Siembra que no
  encuentra FKs → `expect` falla, nunca `return`.
  **Hecho:** commiteado como `test(496)`; corrido aislado contra el código actual: **rojos** R1, R6
  y R10 (rama sin mensajero); verdes R2, R3, R4, R5, R7, R11, R12, R13. Salida anotada en
  `progress/impl_496.md`.
- [x] **T2 [P] — Integración de Monitoreo** (depende de T0). Crear
  `tests/integration/tablero-dia-recoleccion-496.test.ts` con `_semilla-tablero-dia`: orden con
  `asignacion_recoleccion` hoy a M1, recolectada y recibida en central por el repo real → M1 no la
  cuenta (R8); hermana aún en `en_ruta_bodega_central` con M1 → M1 la cuenta en «otros» (R9). Identidad
  de ocho sumandos en cada caso.
  **Hecho:** commiteado; corrido aislado contra el código actual: **rojo** R8, verde R9.

## Fase 2 — Arreglo

- [x] **T3 — Repositorio + interfaz** (depende de T1, T2; design §2). `IOrdenRepository` y
  `OrdenRepository.recibirEnBodegaCentral` con `liberaAsignacion: boolean` obligatorio en cuarta
  posición; `data` con el trío a NULL cuando es `true`. JSDoc de los dos sin la mención a R18 en la
  rama revocada, citando la 496. Reescribir
  `tests/unit/repositories/orden-repository.recepcion-bodega-central.test.ts`: la aserción R18 de la
  rama 138 pasa al `data` literal con el trío a NULL; la 139 queda `{ estatusId }`; todos los casos
  pasan el nuevo argumento.
  **Hecho:** unit verde; typecheck falla solo en `RecepcionBodegaCentralService.ts` (el único
  llamador) hasta T4.
- [x] **T4 — Service** (depende de T3; design §3). `TRANSICIONES` con `liberaAsignacion` (true /
  false) y paso al repo. Actualizar los dos `toHaveBeenCalledWith` de
  `tests/unit/services/recepcion-bodega-central-service.test.ts`.
  **Hecho:** typecheck verde; unit del service verde; T1 R1/R6 y T2 R8 pasan a **verde**; R2/R3/R4/R5/R7
  siguen verdes; `devolucion-rechazadas-flow.test.ts` sigue verde sin tocarlo.
- [x] **T5 [P] — «Recolectadas hoy»** (depende de T1; design §4). `WHERE` con OR en
  `GestionOrdenRepository.findMisAsignacionesByIds`; JSDoc actualizado (y el de
  `IGestionOrdenRepository` si cita la guardia).
  **Hecho:** T1 R10 en verde; R11, R12, R13 siguen verdes; `tests/unit/services/recoleccion-tienda-service.test.ts`
  verde sin tocarlo.

## Fase 3 — Migración

- [x] **T6 — Test de la migración en rojo** (depende de T0). Crear
  `tests/integration/db/recoleccion-central-libera-496-migration.test.ts` (patrón
  `iva-488-migration.test.ts`: lee el SQL del disco normalizando CRLF). Siembra en una transacción
  revertida: objetivo (recepción desde `en_ruta_bodega_central` como última fila, con M1) y cinco
  hermanas: (a) fila de historial posterior a la recepción, (b) recepción de devolución, (c)
  borrada, (d) sin `recoleccion_tienda` y sin mensajero, (e) en `en_bodega_central` con mensajero
  pero última fila de otro tipo. Casos R14 (objetivo con trío NULL y 0 filas de historial nuevas),
  R15 (hermanas idénticas columna a columna antes/después), R16 (down repone M1 en la objetivo,
  `asignado_at`/`fecha_reparto` siguen NULL; una sin `recoleccion_tienda` sigue sin mensajero), R17
  (base sin objetivo → 0 filas; segunda aplicación → 0 filas, contadas con `RETURNING` o con
  `$executeRawUnsafe` que devuelve el número).
  **Hecho:** commiteado; rojo porque la carpeta de la migración no existe todavía.
- [x] **T7 — Migración** (depende de T6; design §6). Crear
  `db/migrations/20261102150000_recoleccion_central_libera_496/{migration.sql,down.sql}`. Antes de
  commitear: `git fetch` y comprobar que el prefijo no choca con ninguna migración de `origin/dev`
  (otras fichas del 2026-11-02) y que es posterior a la última; si choca, cambiar la hora. LF, no
  CRLF. `prisma migrate deploy` → aplicar `down.sql` → `migrate deploy` contra la base local, sin
  errores.
  **Hecho:** T6 verde; up/down/up anotado en `progress/impl_496.md`; `prisma migrate status` limpio.

## Fase 4 — Contraprueba, documentación y gate

- [x] **T8 — Mutaciones** (depende de T4, T5, T7). Aplicar una a una las mutaciones de design
  §7.1, en secuencia (nunca con el gate corriendo). Cada una: verde → mutar → rojo (nombre del test)
  → restaurar → `git diff` de la mutación vacío.
  **Hecho:** tabla mutación → test rojo en `progress/impl_496.md`, con todas las filas del §7.1; si
  alguna no pone nada en rojo, se añade el test que falta y se repite.
- [x] **T9 [P] — Nota en la spec 138** (depende de T4). Bajo la R18 de
  `specs/138-recepcion-bodega-central/requirements.md`, una línea: «Revocada para
  `en_ruta_bodega_central → en_bodega_central` en lo referido a `mensajero_asignado_id` por la 496
  (decisión del humano, 2026-11-02); vigente para la devolución y para `num_guia`.» No se cambia
  ningún otro texto de la 138.
  **Hecho:** commit `docs(496)`.
- [x] **T10 — Gate y trazabilidad** (depende de T8, T9). `./init.sh --rapido` con `INIT_EXIT=$?`
  escrito dentro del log en `progress/gate_496.log` (sin `tail` en tubería). Comprobar que
  `tests/integration/db` corrió (se amplía por la migración) con `skipped = 0`, y correr a mano
  `tests/integration/tablero-dia-recoleccion-496.test.ts` y
  `tests/integration/tablero-dia-recoleccion.test.ts` si el gate no los relacionó. Un rojo ajeno se
  repite aislado; si pasa, se anota como intermitente.
  **Hecho:** gate verde; mapa R1–R17 → test (archivo y nombre del `it`) en `progress/impl_496.md`,
  sin ningún R sin test; todo commiteado en la rama (verificar con `git status -sb` y `git log`).

## Después del deploy a prod (lo hace el leader con el humano, no el implementer)

- [ ] **T11 — Verificación en producción** (depende de la release). La consulta global H1 de
  `progress/prompt-hotfix-portable.md` en solo lectura, corrida o autorizada por el humano. Debe dar
  0. En el repo solo se anota «verificado, 0, fecha»; ningún dato de producción.
