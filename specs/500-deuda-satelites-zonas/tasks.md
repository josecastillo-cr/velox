# Ficha 500 — Tareas

> Secuencia: **backend_dev** (T0-T6) → **frontend_dev** (T7) → cierre (T8). El bloque 8 (T9) va en otra
> rama y otro PR, y está **BLOQUEADO** hasta la puerta P8 de `requirements.md`.
> Gate: `./init.sh --rapido` y nada más (la migración y `db/schema.prisma` lo amplían solo con
> `tests/integration/db`). Nunca el completo. Un rojo se repite aislado; si pasa aislado, se anota como
> intermitente.
> Cada task deja su evidencia en `progress/impl_500.md` (comando, salida resumida y archivo:línea).
> `[P]` = puede ir en paralelo con la anterior del mismo agente.

---

## T0 · Arranque (backend_dev)

- [x] **T0.1** Worktree desde `dev`: `git checkout --detach <SHA de origin/dev que da el leader>`,
  comprobar `git merge-base --is-ancestor 0c18a7aa HEAD` (la 498 dentro) y que existen
  `db/migrations/20261102130100_zona_distrito_unico_499` y `20261103120300_satelite_498_regularizar`.
  Rama `fix/500-deuda-satelites-zonas`.
  **Hecho:** las dos comprobaciones en `impl_500.md`.
- [x] **T0.2** `prisma migrate deploy` en local y `./init.sh --rapido` de arranque en verde, con
  `INIT_EXIT=$?` dentro de `progress/gate_500_arranque.log` y los `skipped` mirados.
  **Hecho:** log verde y sin integración saltada por falta de `.env`.
  **Nota:** el log de arranque NO vale (se editó el árbol con el gate en marcha); el gate de cierre es
  `progress/gate_500.log` (ver `impl_500.md` T0).

## T1 · Bloque 2 — backend (R1-R4)

- [x] **T1.1** Leer en `db/schema.prisma` los índices/únicos de `wallet_movimiento`,
  `wallet_tienda_movimiento` y `pago_mensajero_movimiento` que empiezan por `(origen_tipo, origen_id)`.
  **Hecho:** los tres citados con línea, o la ausencia anotada y avisada al leader (design §2.6).
- [x] **T1.2** Escribir `tests/integration/db/500-con-dinero-sql-real.test.ts` (R1-R4, R9; design §8) con
  las consolidaciones A-E. Mover `consolidacionConDosCierres` a `tests/integration/db/498/_satelite.ts`
  si es local, sin cambiar su cuerpo.
  **Hecho:** corre y queda ROJO por la ausencia de `consolidacionesConDinero` y de `puedeDesmarcar`
  (salida en `impl_500.md`); el caso R9 ya está VERDE (el código de la 498 lo cumple) y se anota así.
- [x] **T1.3** `lib/repositories/consolidaciones-con-dinero.ts` (design §2.1). `revertirConciliacion`
  lo usa; se borra `tieneAsientos`.
  **Hecho:** R1, R2 y R9 en verde; `marca-conciliacion.int.test.ts` y
  `498-conciliar-asienta-sql-real.test.ts` siguen verdes.
- [x] **T1.4** [P] `puedeDesmarcarse` en `lib/utils/conciliacion-satelite.ts` y su tabla de verdad en
  `tests/unit/utils/conciliacion-satelite.test.ts`.
  **Hecho:** test verde; la guardia `aporte-satelite-fuente-unica-498` sigue verde.
- [x] **T1.5** `puedeDesmarcar` en `ConsolidacionSateliteDTO` y en el detalle de
  `findCierreBodegaConDetalle`, con su paso por interfaz, servicio y acción (design §2.3).
  **Hecho:** R3 y R4 en verde contra Postgres; typecheck verde.

## T2 · Bloques 3 y 4 — tests (R9-R11) [P con T1.3]

- [x] **T2.1** `tests/integration/db/500-esperado-una-formula-sql-real.test.ts` (R10, R11; design §3).
  **Hecho:** verde, con los literales `7000.00`, `6900.00` y `100.00` escritos a mano (no derivados de
  `paraLaCentral`: memoria «Aserción contra su propia fuente»).

## T3 · Bloque 6 — migración (R22) [P con T1]

- [x] **T3.1** `db/migrations/<prefijo>_historial_accion_zona_distrito_500/` con `migration.sql` (una
  sentencia) y `down.sql` dinámico (design §4.1). Prefijo: el primero libre posterior al último de `dev`.
  **Hecho:** up → down → up en local sin error; `prisma migrate status` limpio.
- [x] **T3.2** Declararla en `posteriores` de `tests/integration/db/orden-traspaso-migration.test.ts`.
  **Hecho:** ese test verde.
- [x] **T3.3** `tests/integration/db/historial-accion-zona-distrito-500-migration.test.ts` (R22).
  **Hecho:** verde; las demás `historial-accion-*-migration.test.ts` siguen verdes (si alguna fija un
  conteo que cambia, se ajusta con una línea que cite la 500).

## T4 · Bloque 6 — catálogos y escritura (R12-R21)

- [x] **T4.1** Enum en `db/schema.prisma` con su `///`, `prisma generate`, y las tres entradas de
  `lib/types/historial-accion.ts` (design §4.2).
  **Hecho:** typecheck verde; `catalogo-y-choke-point.test.ts` con categoría y etiqueta literales (R20).
- [x] **T4.2** Escribir `tests/integration/db/zona-distrito-rastro-500.test.ts` (R12-R19 y la parte de
  R21 del repositorio del historial; design §8).
  **Hecho:** ROJO por falta de filas (salida en `impl_500.md`).
- [x] **T4.3** `diferenciaDeDistritos` y `filasDeCambioDeDistritos` con sus unitarios, y el bloque en
  `ZonaRepository.update` (design §4.3).
  **Hecho:** T4.2 y los unitarios en verde; `zona-pago-mensajero-rastro.test.ts`,
  `zona-distrito-unico-499.test.ts` y los tests de `ZonaRepository` siguen verdes.
- [x] **T4.4** Guardias del historial (design §4.5): conteo 66, productor, y la de datos de cliente si
  lo pide. Correrlas a mano.
  **Hecho:** las tres guardias verdes, con salida en `impl_500.md`.

## T5 · Bloque 7 — textos (R23) [P con T4]

- [x] **T5.1** Completar la lista cerrada de archivos de design §5 leyendo el código (dónde viven la nota,
  las pistas de «Por cobrar a satélites», el dueño «Satélite» y las dos etiquetas).
  **Hecho:** lista en `impl_500.md`, cada archivo con la línea del texto.
- [x] **T5.2** Guardia `tests/unit/guards/textos-satelite-definitivos-500.guardia.test.ts` con
  autocomprobación. **Hecho:** ROJA contra `lib/constants/wallet-rotulos.ts:69-72`.
- [x] **T5.3** Reescribir ese comentario. **Hecho:** la guardia verde.

## T6 · Mutaciones del backend

Cada una: verde → aplicar → **el test nombrado en rojo, con su salida real pegada** → revertir → verde,
y `git diff` vacío al terminar. Si el arnés no muestra que ejecutó el test, no cuenta (memoria «Arnés de
mutaciones que miente»).

- [x] **T6.1** `consolidacionesConDinero` sin la consulta de ajustes → R1/R9 rojos.
- [x] **T6.2** `puedeDesmarcarse` sin `!saldadaReglaAnterior` → R4 rojo.
- [x] **T6.3** `escribirDiferencia` con el esperado `general − pago` (sin rechazos) → R10 rojo.
- [x] **T6.4** `toConsolidacionDTO` con `faltaPorRecibir` sobre el efectivo → R11 rojo.
- [x] **T6.5** `diferenciaDeDistritos` por posición y no por conjunto → R17 rojo.
- [x] **T6.6** Quitar solo el bloque nuevo de `ZonaRepository.update` → R12 rojo. Anotar que la guardia
  del censo sigue verde con esta mutación (memoria «La guardia mide por método»).
- [x] **T6.7** Usar el `loteId` de la reconciliación de la 366 → R13 rojo.
- [x] **T6.8** Intercambiar `valorAnterior` y `valorNuevo` → R14 rojo.
- [x] **T6.9** Quitar `valorDeCatalogo` → R15 rojo (22001 de Postgres).
- [x] **T6.10** `appendAccion(this.prisma, …)` en el bloque nuevo → R18 rojo (el error forzado deja filas). — **SOBREVIVE** (limitación del arnés: `this.prisma` y `tx` son el mismo proxy en el test; ver `impl_500.md` T6).

**Hecho (T6):** las diez con su salida en `impl_500.md`.

## T7 · Frontend (frontend_dev; empieza con T1.5 y T4.1 en la rama)

- [x] **T7.1** `tests/components/ConciliacionAcciones500.test.tsx` (R3, R5, R6, R7). **Hecho:** ROJO.
- [x] **T7.2** Prop `puedeDesmarcar` (por defecto `false`) en `ConciliacionAcciones`, cabecera reescrita,
  y los dos montajes (`ConciliacionSatelite.tsx:334`, `CierresBodegaAdminModule.tsx:877`) con su
  comentario (design §2.4). **Hecho:** T7.1 verde; las suites de `Conciliacion498` y de
  `CierresBodegaAdminModule` verdes con un caso que pasa el valor del DTO.
- [x] **T7.3** [P] Ayuda de Wallet · Satélites (design §2.5) y el punto nuevo en
  `ayuda-wallet-satelites-498.test.ts` (R8). **Hecho:** test verde y su autocomprobación roja al quitar
  la frase.
- [x] **T7.4** [P] Tests de columnas de pantalla y descarga del historial para `zona_distrito_cambiado`
  (R21). **Hecho:** verdes.
- [x] **T7.5** Mutación: `puedeDesmarcar = true` por defecto → R6 rojo, con salida; revertir; diff vacío.
- [x] **T7.6** Verlo en el navegador (memoria «Verificar lo que el usuario ve»): una consolidación
  conciliada con dinero en `/wallet/satelites` y en `/cierres-admin` sin «Desmarcar», otra sin dinero con
  él; y en `/historico/acciones` las filas de un guardado de zona que añade y quita un distrito. Limpiar
  lo que se cree en la base local. **Hecho:** capturas o descripción con rutas en `impl_500.md`.

## T8 · Cierre (backend_dev o leader)

- [x] **T8.1** `./init.sh --rapido` en verde con `INIT_EXIT=$?` en `progress/gate_500.log` y sin
  integración saltada. **Hecho:** log.
- [x] **T8.2** Mapa R → test completo en `impl_500.md` para R1-R23 (R24-R30 van en T9; R29-R30 solo si
  Q1 = A).
  **Hecho:** ningún R sin test.
- [x] **T8.3** Commits por task lógica, `git status -sb` limpio y blob verificado en la rama. Sin
  `feature_list.json`. **Hecho:** `git log --oneline` en `impl_500.md`.

---

## T9 · Bloque 8 — Retirar los respaldos — **BLOQUEADO hasta P8**

> Otro agente, otra rama (`fix/500-retirar-respaldos`) y otro PR. No se empieza sin que el leader pegue
> en el prompt la autorización escrita del humano y la respuesta a Q1.

- [ ] **T9.0** Puerta: la 498 está en producción con su T8.3 hecho; el leader corrió design §6.1
  (B8-1 a B8-4) con el MCP de producción confirmado por `get_project_url`; B8-3 = (0, 0, 0), B8-4 = 0 con
  el índice presente; y el humano autorizó por escrito. **Hecho:** la fecha de la autorización (sin
  cifras de producción) en `impl_500.md`.
- [ ] **T9.1** Rama desde `origin/dev` actual; migración `<prefijo>_retirar_respaldos_500` y su `down.sql`
  (design §6.2), declarada en `posteriores`. **Hecho:** up → down → up en local sin error.
- [ ] **T9.2** Según Q1: opción B → cabecera y `down.sql` con el aviso de §6.3; opción A → los dos
  `down.sql` editados como en §6.3.
- [ ] **T9.3** `tests/integration/db/500-retirar-respaldos-migration.test.ts` (R24-R28, y R29-R30 si
  Q1 = A). **Hecho:** verde; mutaciones: `CASCADE` en el `DROP SCHEMA` → R25 rojo; quitar el
  `EXCEPTION` → R25 rojo; quitar un `IF EXISTS` → R27 rojo.
- [ ] **T9.4** Con la migración aplicada en local, correr `tests/integration/db/498-*` y
  `tests/integration/db/zona-distrito-*`. **Hecho:** verdes, o los que ejecutan un `down` sin su `up`
  arreglados en el propio test (design §6.4), nunca en la migración.
- [ ] **T9.5** `./init.sh --rapido` verde (`progress/gate_500_b8.log`) y PR propio. Tras el despliegue,
  el leader comprueba en producción, en solo lectura, que B8-2 ya no lista las dos tablas.
