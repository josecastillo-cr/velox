# Revisión — Ficha 498 «Dinero de satélite entra a la caja al conciliar»

- Revisor: reviewer (subagente). Fecha: 2026-11-03.
- Worktree `R:/w498`, rama `fix/498-satelite-dinero-al-conciliar`, HEAD revisado `322ea2ae` (base `origin/dev`).
- Búsqueda de código: MCP `codebase-memory` (`R-job-singularis-projects-ordenex`) para lo que ya existía en
  `dev`. Lo nuevo de la 498 se leyó directamente en el worktree, porque el índice no lo tiene.
- Leído: `specs/498-…/{requirements,design,tasks}.md`, `progress/impl_498.md`, `CHECKPOINTS.md`, el diff
  completo de `lib/`, `db/migrations/20261103120*` y las suites existentes que cambiaron.

## Veredicto final (segunda vuelta, `6bbb0930`): **OK**

Primera vuelta (`322ea2ae`, informe `0e0c393b`): RECHAZADO por B1 y B2. Los dos están cerrados (ver la
sección «Segunda vuelta» al final).

## Veredicto de la primera vuelta: **RECHAZADO**

Hay **2 bloqueantes**, los dos de proceso o trazabilidad y baratos de cerrar. En el código no encontré nada
que bloquee: dinero, migraciones y transacciones están bien, el gate `--rapido` queda en verde y los tests
propios corren en verde con 0 skipped. Cuando el implementer cierre B1 y B2, la ficha se puede dar por OK
sin otra revisión de código: basta comprobar esas dos cosas.

---

## Checklist

### Especificación
- [x] `requirements.md` con requisitos EARS numerados (R1–R55, más 15a/15b/16a/16b/41a/54a–54d).
- [x] `design.md` con alternativas descartadas.
- [ ] **`tasks.md`: todas las tasks en `[x]`. FALLA: las 41 siguen en `[ ]` y ninguna está en `[x]`** (B1).

### Trazabilidad
- [x] `progress/impl_498.md` tiene el mapa R→test (backend y frontend).
- [ ] **Cada R mapea a un test que lo verifica. FALLA en R44** (B2). El resto queda cubierto; ver la tabla de abajo.

### Calidad de código
- [x] Typecheck: verde. Lint: 0 errores (los warnings ya existían en el repo). Los dos los corre el gate.
- [x] Tests: corrí yo los 20 archivos propios de la 498 más las guardias tocadas. Resultado:
  `Test Files 20 passed (20) · Tests 300 passed (300)`, **0 skipped**.
- [x] E2E: no aplica. No hay harness de E2E (memoria «nada de E2E»). El riesgo se cubre con integración
  contra Postgres y con el recorrido Playwright manual de T7.5 descrito en la bitácora.

### Datos y seguridad
- [x] Tabla nueva `conciliacion_bodega_ajuste`: RLS activada sin policies, el patrón del repo. Sin
  multiempresa, por decisión del humano.
- [x] `respaldo.asientos_satelite_498`: RLS activada y `REVOKE ALL FROM PUBLIC` (molde de la 499). Que la
  app la pueda leer es una limitación aceptada.
- [x] Las cuatro migraciones tienen `down.sql`. El orden de reversión está declarado (M4→M3→M2→M1) y probado.
- [x] Sin secretos. El SQL dinámico (`Prisma.raw` en `deuda-satelite-sql.ts`) solo recibe alias que son
  constantes del código.
- [x] Webhooks: no aplica.

### Capas
- [x] Las acciones validan con zod y el servicio controla el rol antes de tocar el repositorio (R45, con test).
- [~] El cálculo del delta (`escribirDiferencia`) vive en el repositorio. Es la desviación que justifica
  design §4.4 (tiene que ir en la misma tx que la marca) y sigue el patrón de `CierresAdminRepository`.
  Se acepta.
- [x] Las interfaces están en `lib/interfaces/`.

### Permisos / configuración
- [x] Mutaciones por Server Actions. Sin hardcode de país, moneda ni cuenta: la marca sale de `MARCA.nombre`.

### Verificación final
- [x] `./init.sh --rapido`: verde (ver la sección siguiente).
- [ ] `progress/history.md`: sin entrada. La escribe el leader al cerrar, así que no lo cuento como bloqueante.

---

## Verificación ejecutable (corrida por el revisor)

`./init.sh --rapido` sobre `322ea2ae` termina en **`INIT_EXIT=0`, `== init OK ==`**, en modo AMPLIADO:

- Relacionados: `Test Files 864 passed (864) · Tests 11292 passed | 17 skipped`. Los 17 son de
  `AnaliticaPage.test.tsx`, igual que en las corridas del implementer.
- Guardias: `282 passed · 3885 passed`.
- `tests/integration/db`: 471 archivos, `4390` tests, `2 failed | 4388 passed`, **0 skipped**.
- Los dos rojos salieron en la corrida en paralelo y el gate los repitió aislados: `2 passed (26 tests)`.
  Son ajenos a la ficha:
  - `corte-diario-segundo-cierre-sql-real.test.ts`, de la 271;
  - `notificacion-evento-webhook-suscripcion-migration.test.ts`, de la 403.

  El gate los anota como intermitentes.

---

## Trazabilidad R → test (comprobada en el archivo, no solo en la bitácora)

| R | Test concreto | ¿Lo prueba? |
| --- | --- | --- |
| R1 | `498-aprobacion-satelite-sql-real` «T1.1 / R1» (cero filas, con anti-vacuidad de que hay dinero) + `cierres-admin-repository.test.ts` «R1» | Sí |
| R2 | Indirecto: las caracterizaciones 454/455/477, con cierres satélite, siguen verificando historial, liberación y devoluciones tras aprobar. Ningún test de la 498 lo dice explícitamente | Sí, débil (m3) |
| R3, R55 | `498-aprobacion-satelite-sql-real` «T1.2» contra el literal `FOTO_CENTRAL`, tomado del código de `dev` | Sí (contrato literal) |
| R4 | `cierres-admin-repository.test.ts` «R4» (destino desconocido lanza; la lectura va en la tx) | Sí |
| R5, R7 | `asentar-cierre-dia.test.ts` (orden literal, premios) + idempotencia en `498-conciliar-asienta` | Sí |
| R6 | `498-composition-root-asiento.int.test.ts` (cuenta filas) | Sí |
| R8–R15, R54 | `498-conciliar-asienta-sql-real` «marcar» | Sí |
| R15a, R15b | `498-conciliar-asienta` «recibido 0» + `conciliacion-satelites-schema-498` + servicio + acciones + `Conciliacion498` | Sí |
| R16, R16a, R16b | `Conciliacion498.test.tsx` + `CierresBodegaAdminDebe498.test.tsx` + `conciliacion-satelite.test.ts` | Sí |
| R17–R19 | `498-conciliar-asienta` «corregir» (incluye la saldada) + `corregir-conciliacion.int` [S] | Sí |
| R20, R22 | `498-conciliar-asienta` «revertir» + `marca-conciliacion.int` [S] + servicio | Sí |
| R21 | `Conciliacion498` «R21» | Sí |
| R23–R25, R41a | `498-deuda-satelite-sql-real` «Saldos» | Sí |
| R26, R27 | `conciliacion-satelite.test.ts` | Sí |
| R28, R32 | `498-deuda-satelite` «una sola definición» + guardia `aporte-satelite-fuente-unica-498` (con autocomprobación) | Sí |
| R29–R31 | `498-deuda-satelite` «Estado de cuenta» | Sí |
| R33, R35, R36 | `caja-tesoreria.test.ts` «ficha 498» + contra Postgres en `498-conciliar-asienta` «la caja» | Sí |
| R34 | `const _n: never` en las dos `switch` de `caja-tesoreria.ts` (typecheck) + `caja-composicion-exhaustiva.guardia`. El test llamado «R34» solo prueba que el tipo está cerrado | Sí, por el typecheck (m4) |
| R37 | `CajaResumenCard498.test.tsx` | Sí |
| R38, R39 | `BarraComposicionCaja498.test.tsx` + `caja-tesoreria.test.ts` | Sí |
| R40 | `WalletLedgerSatelite498.test.tsx` (libro y descarga) | Sí |
| R41, R42 | `Conciliacion498`, `wallet-satelites.test.tsx`, `saldos-satelites-descarga-columnas`, `WalletListados464` | Sí |
| R43 | guardia `aporte-satelite-fuente-unica-498` (lib, app, components y ayuda, nota literal) | Sí |
| **R44** | **Ninguno.** El mapa cita «guardias de ayuda + revisión contra design §10». Esas guardias son genéricas (frontmatter, rutas, marca) y no comprueban que la ayuda describa nada de lo que pide R44. La única aserción positiva sobre la ayuda es que contiene la nota de R43 | **No (B2)** |
| R45 | `conciliacion-satelites-service.test.ts` «498 — … el rol primero» | Sí |
| R46, R47, R53 | `498-satelite-migraciones.test.ts` | Sí |
| R48–R52 | `498-retirar-asientos-migration.test.ts` | Sí |
| R54a–R54d | `498-regularizar-migration.test.ts`; R54c en `498-deuda-satelite` | Sí |

Mutaciones: la bitácora da 16/16 matadas con autocomprobación de diff limpio. La 4 muere en `beforeAll`
(`Test Files 1 failed`, 3 skipped): cuenta como matada, aunque la señal es menos nítida.

---

## Dinero: migraciones y transacciones

- **M1** (enums): tres `ADD VALUE IF NOT EXISTS`, sola en su archivo. Su `down` es la función de la 488
  renombrada: lee la lista vigente, aborta si alguna fila usa el valor y nunca recrea el tipo con una lista
  fija. Bien.
- **M2** (ajustes): FK RESTRICT, CHECK `diferencia <> 0`, CHECK de evento, único parcial de `marca` y RLS.
  El CHECK tipo↔categoría es el de la 488 literal con un valor más al final de cada rama. El `down` borra
  primero las filas de diferencia (la pérdida declarada) y vuelve a la lista de la 488. Bien.
- **M3** (retirar asientos de S): S se elige por predicado. La guarda R50 aborta con el conteo. El respaldo
  es íntegro (`to_jsonb`, clave `(tabla,id)`) y se borra solo lo respaldado, todo en un único `DO` dentro
  de la tx implícita de Prisma. Excluye `premio_ranking` y `premio_dia`. Se puede reejecutar (`IF NOT
  EXISTS`, `ON CONFLICT DO NOTHING`, `DROP TABLE IF EXISTS pg_temp.s_498`). El `down` reinserta sin duplicar
  y solo borra el esquema si queda vacío. Bien.
- **M4** (regularizar): un `UPDATE` por predicado (conciliada, no rechazada, sin ajuste, aún sin marcar),
  más un CHECK que exige `conciliado_at`. No toca libros ni `monto_recibido`. El `down` quita solo la
  columna. Bien.
- Las cuatro están en `posteriores` de `orden-traspaso-migration.test.ts`. Comprobado.
- **Aprobar**: el `switch` sobre `destinoTipo` se lee dentro de la tx y después de la transición. La rama
  central llama a `asentarCierreDia`, que es un movimiento literal de los cinco escritores en el mismo orden
  (diff revisado línea a línea). La satélite no escribe. Un destino desconocido lanza. La captura de la
  indemnización sigue antes, en la aprobación. **R3 queda intacto**: lo fijan `FOTO_CENTRAL` y la guardia
  `aprobacion-escrituras-cubiertas`, que ahora exige la llamada en la rama central y no en la satélite.
  Los feeds leen del snapshot `cierre_detail`, no datos vivos, así que asentar al conciliar da las mismas
  cifras que habría dado al aprobar.
- **Marcar**, en una sola tx: R15a sin escribir nada; luego `updateMany` con guarda (CAS); luego el asiento
  de los cierres `aprobado`/satélite en orden determinista; luego la diferencia; luego el historial. Un
  fallo revierte todo (R14, probado).
- **Corregir**: R15a; luego el CAS sobre el monto previo; luego solo la variación (esperado − recibido − Σ
  ajustes); luego el historial. No vuelve a asentar.
- **Revertir**: `tieneAsientos` responde `con_asientos` antes de tocar nada.

## Suites existentes cambiadas (unas 40)

Revisé el diff de todas. Cada cambio se explica por la decisión del 2026-11-02 o es un ajuste mecánico. No
encontré ningún debilitamiento ajeno:

- Ventanas de enums corridas y conteos 29→31 / 14→15 (`caja-459-migration`, `iva-488`, `wallet-458`,
  `abono-tienda-457`, `cobro-tienda-461`, `caja-tesoreria-migration`, `wallet-labels`, `metrics-caja`).
  Además, cada ventana gana una aserción nueva para los valores de la 498: la cobertura sube.
- Sustituciones [S] con la cita de la decisión y una aserción inversa concreta, no vacía:
  `marca-conciliacion.int.test.ts:340` (caja +1 al marcar, nada al revertir),
  `corregir-conciliacion.int.test.ts:304` (caja +1, sin tienda ni mensajero), `saldo-satelites.int` (1715,
  SINPE sí cuenta, 138.45, 1415, con la aritmética comentada y comprobada contra los fixtures),
  `saldos-satelites-descarga-columnas` (`debe ≠ efectivo`, canario mantenido),
  `conciliacion-satelites-actions` (el 0 llega al servicio; 0.001 sigue rechazado), `wallet-satelites.test.tsx`.
- Literales recalculados a mano, no tomados de su propia fuente: `cierre-bodega-repository.test.ts`
  (−8.50), `cierres-bodega-admin-repository.test.ts` (1.50), `wallet-caracterizacion-458` (7 000 / 11 000).
- Fixtures que asientan tras aprobar con `asentarCierreDia` (`caja-459`, `454/_escenario` → `e.asentar`,
  `497-confirmacion-barridas`, `cierre-rechazo-tienda-aprobacion`): ninguna aserción cambia.
- Dobles que ganan `destinoTipo: "bodega_central"`, más el `mockImplementation` que responde el destino solo
  a esa lectura: sin cambios en los `expect`.
- `marca-conciliacion` R12/R13/D6: el fixture pasa de 500 a 485 para que no haya diferencia y siga siendo
  reversible. Es legítimo: el caso mide el ciclo reversible de R22, que sigue existiendo.
- Ningún test nuevo usa `if (!x) return;`. Los de integración usan `describe.skip` visible, y las dos
  corridas dieron 0 skipped.

## Desviaciones declaradas: juicio

1. Prefijos `20261103120000…120300`: correctos, por encima de la 497.
2. M3 sin `BEGIN/COMMIT`, con un único `DO`: es la convención del repo. Bien.
3. Etiquetas «(faltó)» / «(sobró o pagó)»: las decidió el humano y no se reabren.
4. Token `bg-chart-16`: contraste medido (6.45:1 y 7.84:1) y fijado con autocomprobación. Bien.
5. Mínimo de frontend en T3 y presentación en T7: bien.
6. `A_QUIEN_POR_ORIGEN = []` y `LECTURA_POR_ORIGEN = null` para el origen nuevo: razonable.
7. La mitad «no rechazada» del predicado de M4 es defensiva (el CHECK de la 431): bien declarado.
8. M3 se editó tras aplicarla en local (`DROP TABLE IF EXISTS pg_temp.s_498`) y la base local se re-migró.
   Sin efecto semántico. Ver m1 sobre preview.
- La ayuda no añade la fuente `ingreso-ordenex.ts` porque lo prohíbe la guardia de marca. Correcto.
- «Recibido incompleto» deja de encenderse si hay cierres sin consolidar: es un cambio de UI que el spec no
  pide, pero está razonado y tiene test (`Conciliacion498` «R42»). Se acepta.
- `/cierres-admin` sin el rótulo de R41a: R41a lo pide en la conciliación. Correcto.
- Las decisiones ya cerradas por el humano (etiquetas, deuda sobre todos los métodos, una conciliación con
  dinero no se revierte) no se reabren.

## Textos

- No hay «SLA» ni «acuerdo a nivel de servicio» en lo añadido.
- Los literales de R16a, R21, R37 y R43 coinciden con el requisito y tienen test.
- La ayuda ya no da cifras de producción: se retiró la sección «Por qué la cifra es solo el EFECTIVO», con
  sus ₡4.196.897 / ₡1.105.790. El ejemplo «₡115.000» ya estaba antes y es ilustrativo.

---

## Hallazgos

### BLOQUEANTES

- **B1 — `tasks.md` sin marcar.** `specs/498-satelite-dinero-al-conciliar/tasks.md` tiene 41 `[ ]` y 0
  `[x]` (p. ej. `:23` T0.1 … `:203` T3.9), aunque la bitácora da por hechas T0–T8. Lo exige CHECKPOINTS
  («todas las tasks marcadas `[x]`»). **Qué falta:** marcar `[x]` las hechas. Si alguna no lo está (T8.4,
  la medición en producción, está PENDIENTE por diseño), dejarla `[ ]` con una nota que diga por qué y
  quién la cierra (molde de `review_497` m1).
- **B2 — R44 sin test.** Ningún test comprueba que `docs/ayuda/oficina/wallet-satelites.md` y
  `wallet-caja.md` describan lo que R44 enumera: dinero al conciliar, deuda sobre todos los métodos menos lo
  de la satélite, recibido = total (SINPE o transferencia directos), recibido 0 solo sin nada que entregar,
  «Sin consolidar», «Saldada con la regla anterior», el desenlace de revertir con asientos y «Por cobrar a
  satélites». El contenido de hoy sí lo describe (lo leí), pero nada impide que se pierda. **Qué falta:**
  un test de documentación con el molde de `tests/unit/docs/ayuda-wallet-caja-488.test.ts`, que lea los
  dos `.md` y afirme cada punto de R44 (frases o rótulos clave), con una autocomprobación (quitar un punto
  lo pone rojo). Luego actualizar la fila R44 del mapa en `impl_498.md`.

### Menores

- **m1 — Preview pudo migrar la M3 vieja.** `63c227c5` (M1–M4, con la M3 SIN el `DROP TABLE IF EXISTS
  pg_temp.s_498`) se pusheó sola a las 09:45:35. Se editó en `8018d97e`, pusheado a las 09:49:21. Si Vercel
  construyó un preview de esa rama con `MIGRATE_ON_PREVIEW=true` (memoria «Preview SÍ migra»), la base de
  preview tiene la M3 con otro checksum, y además tiene aplicado el retiro de asientos de S. **Antes de la
  release:** mirar `_prisma_migrations` en preview (MCP `supabase-preview`) para las cuatro 498. No lo pude
  comprobar: no tengo ese MCP.
- **m2 — Revertir una saldada sin asientos da error 500.** El CHECK
  `cierre_bodega_esperado_regla_anterior_check` (M4) exige `conciliado_at` si hay `esperado_regla_anterior`.
  `revertirConciliacion` (`lib/repositories/CierresBodegaAdminRepository.ts:662-673`) pone
  `conciliado_at = NULL` sin limpiar esa columna. Una saldada cuya consolidación no tenga ni una fila en los
  libros (cierres sin dinero) pasaría `tieneAsientos = false` y el `updateMany` fallaría con 23514, que
  sale como error interno en vez de `con_asientos` o `conflict`. Es raro y falla seguro (no corrompe
  datos), pero contradice R22 en ese borde.
- **m3 — R2 sin test explícito de la 498.** Que aprobar un cierre satélite siga haciendo todo lo que no es
  dinero solo lo cubren las caracterizaciones 454/455 de forma indirecta. El código no cambió fuera del
  bloque de dinero, así que el riesgo es bajo. Un caso con la transición, el historial y la liberación de
  órdenes en `498-aprobacion-satelite-sql-real` lo haría explícito.
- **m4 — El test «R34» no prueba R34.** `tests/unit/utils/caja-tesoreria.test.ts:743` comprueba que
  `NaturalezaMovimiento` está cerrado, no que una `switch` sin la rama nueva deje de compilar. La garantía
  real son los `const _n: never` de `lib/utils/caja-tesoreria.ts:277,305` más el typecheck del gate. Basta
  renombrar el caso o añadir un `@ts-expect-error` sobre un `Record` incompleto.
- **m5 — Tono mezclado.** `conciliacion-labels.ts` pasó a tuteo («Escribe», «corrige», «usa»), con los
  literales del requisito. La ayuda `wallet-satelites.md` sigue en voseo («marcás», «podés», «te quedás») y
  cita esos literales en tuteo. Es coherente con el requisito, pero se lee mezclado. Conviene unificar en
  una ficha de textos.
- **m6 — `tests/integration/db/454/_escenario.ts` `asentar()` hace `return` en silencio** si el cierre no
  está `aprobado`. Hoy cada uso va después de una aprobación cuyo estado se afirma aparte, así que no oculta
  nada. Aun así, un `throw` sería más honesto con la memoria «test verde sin datos».

---

## Segunda vuelta — diff `0e0c393b..6bbb0930`

Worktree avanzado por fast-forward a `6bbb0930`. Revisé solo los arreglos; lo ya aprobado no se vuelve a
revisar.

| Hallazgo | Arreglo | Comprobado |
| --- | --- | --- |
| **B1** | `tasks.md` con 39 `[x]` y 2 `[ ]`. Quedan abiertas T8.2 (falta abrir el PR y mirar `gh pr checks`; lo hace el leader) y T8.4 (medición en producción, PENDIENTE por diseño). Las dos llevan una nota que dice qué falta y quién lo hace | **Cerrado** |
| **B2** | `tests/unit/docs/ayuda-wallet-satelites-498.test.ts`: 13 puntos de R44 escritos a mano sobre los dos `.md`, prohibición de frases de la regla vieja y autocomprobación (quitar un punto o sembrar una frase vieja lo pone rojo) | **Cerrado** |
| m1 | El leader lo comprobó en preview: está aplicada la M3 de `63c227c5`, que solo difiere en el `DROP TABLE IF EXISTS pg_temp.s_498`. Es inocuo | Cerrado (medido por el leader) |
| m2 | Desenlace de dominio `saldada_regla_anterior`. Va en el repositorio, después de `tieneAsientos` y antes del `updateMany`, y llega al servicio (`switch` exhaustivo), a la acción y a `ConciliacionAcciones`, que muestra un aviso y deja el diálogo abierto. Tiene tests contra Postgres (sin cambios y sin historial), del servicio y del componente | Cerrado |
| m6 | `asentar()` lanza si el cierre no está `aprobado`. Las caracterizaciones 454, 455 y 477 siguen en verde | Cerrado |
| m3, m4, m5 | Sin cambios. Siguen siendo menores y no bloquean. m5 (tono): el test nuevo de R44 fija el voseo de la ayuda, así que el que la unifique tendrá que actualizar sus patrones | Abiertos (menores) |

**Verificación propia:**

- 11 rutas de test tocadas o relacionadas, corridas aisladas: el arreglo m2, el test de R44, el componente, el
  servicio, las acciones, la guardia `aporte-satelite-fuente-unica-498`, la carpeta 454/caracterizacion,
  455, 477 y `marca-conciliacion.int`. Resultado: `Test Files 38 passed (38) · Tests 267 passed (267)`.
- `pnpm run typecheck`: verde.
- eslint sobre los archivos tocados: sin incidencias.
- El gate del implementer, `progress/gate_498_revision.log`, termina en `INIT_EXIT=0`. En `integration/db`
  da 1 rojo en paralelo que salió verde al repetirlo aislado.

**Veredicto de la segunda vuelta: OK.** No quedan bloqueantes. Antes de cerrar la ficha:

- el leader abre el PR y mira `gh pr checks` (T8.2);
- el leader corre la medición de producción con puerta (T8.4) antes de la release;
- se añade la entrada de `progress/history.md` al cerrar.
