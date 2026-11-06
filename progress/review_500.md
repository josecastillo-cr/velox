# Revisión — Ficha 500 «La deuda de H3 y H4: satélites al conciliar y distritos de zonas»

> Reviewer, 2026-11-03. Worktree `R:/w500`, rama `fix/500-deuda-satelites-zonas`, HEAD revisado
> `ccf92468`. Diff: `git diff origin/dev...HEAD` (merge-base `d4e8d52b`). Alcance: R1–R23. El bloque 8
> (R24–R30, T9) está bloqueado por la puerta P8 a propósito y no cuenta como falta.
> Búsqueda: archivos leídos directamente con Read/Grep, porque el spec y la bitácora ya citan archivo:línea
> (el hook de `codebase-memory` dio contexto del grafo en cada Grep). Cada símbolo se confirmó en el archivo real.

## Veredicto: **RECHAZADO** (1 bloqueante, con un arreglo pequeño y solo en un test)

El código está bien. Lo que falla es un test nuevo de esta ficha: es inestable por cómo está escrito,
y el spec (§Fuera de alcance, bloque 9) dice que eso «se arregla en el propio test». Con B1 resuelto,
el veredicto pasaría a OK sin más cambios.

---

## Checklist

| # | Punto | Estado |
| --- | --- | --- |
| 1 | requirements / design (con §9 «Alternativas descartadas») / tasks existen | OK |
| 2 | Tasks T0–T8 marcadas `[x]`; T9 sin marcar (bloqueada por P8, como se esperaba) | OK |
| 3 | Mapa R→test en `impl_500.md` (T8.2), R1–R23 | OK: cada R tiene al menos un test con asserts reales (ver tabla) |
| 4 | `./init.sh --rapido` corrido por el reviewer | **INIT_EXIT=0**, `init OK`. Relacionados 537 archivos · 6490 passed / 26 skipped (los `it.skip` de Analítica); guardias 283 · 3894/3894; `integration/db` ampliado 475 archivos · 4411 passed / **2 rojos** que pasaron al repetirlos aislados (21/21) → intermitentes. **Uno de ellos es de esta ficha (B1).** El otro es `462/notificacion-evento-reprogramadas-migration` (XX000 «could not open relation with OID»: DDL concurrente sobre la base compartida). No tiene que ver con la 500 |
| 5 | Tests de la ficha corridos aislados | integración (6 archivos, incluidos 498-conciliar y orden-traspaso): 64/64; unit/componente/guardias (13 archivos): 357/357 |
| 6 | Typecheck y lint | verdes (dentro del gate) |
| 7 | Migración nueva con `down.sql`, versionada, sin tocar los `down.sql` ya aplicados | OK (punto 2) |
| 8 | RLS en tablas nuevas | N/A: no hay tablas nuevas (solo un valor de enum) |
| 9 | Webhooks / secretos / contexto hardcodeado | N/A / ninguno |
| 10 | Capas | OK: `consolidacionesConDinero` en `lib/repositories/` (solo consultas Prisma), `puedeDesmarcarse` es una utilidad pura, el servicio propaga el valor tal cual, la acción no cambia y el componente solo lee una prop |
| 11 | E2E | No aplica: no hay harness (memoria «Nada de E2E»). Para cubrir el riesgo se recorrió la app con Playwright en T7.6 |
| 12 | Textos en español claro, sin «SLA» | OK: 0 apariciones de «SLA» en lo añadido a `app/ components/ lib/ docs/`. Matiz en m3 |
| 13 | `progress/history.md` | Pendiente: es del cierre del leader, no de esta rama |
| 14 | Sin `feature_list.json` en el diff | OK |

## Trazabilidad R1–R23

| R | Test (verificado leyendo el test y corriéndolo) |
| --- | --- |
| R1 | `tests/integration/db/500-con-dinero-sql-real.test.ts:209` (de {A..E} tienen dinero exactamente {A,B}, con anti-vacuidad en :190) y :213 (ids vacíos sin consultar, con un Proxy que revienta si se toca) |
| R2 | ídem :217 |
| R3 | ídem :227 (página y descarga completa) y :233 (detalle `/cierres-admin`); `tests/components/ConciliacionAcciones500.test.tsx:65-83`; `Conciliacion498.test.tsx` «500/R3»; `CierresBodegaAdminDebe498.test.tsx` «500 (R3)» |
| R4 | `500-con-dinero-sql-real.test.ts:243`: ofrecer ⇔ `updated` en un SAVEPOINT, con los cuatro desenlaces literales |
| R5 | `ConciliacionAcciones500.test.tsx:97-109` |
| R6 | ídem :85-95 (mutación del default a `true` → rojo, según la bitácora T7.5) |
| R7 | ídem :111-134 (`it.each` de `con_asientos` / `saldada_regla_anterior`, aviso literal y diálogo abierto) |
| R8 | `tests/unit/docs/ayuda-wallet-satelites-498.test.ts` punto «500/R8» |
| R9 | `500-con-dinero-sql-real.test.ts:222`. **Ver B1** |
| R10, R11 | `tests/integration/db/500-esperado-una-formula-sql-real.test.ts` (literales 7000.00 / 6900.00 / 100.00 escritos a mano) |
| R12, R13, R14, R16 | `tests/integration/db/zona-distrito-rastro-500.test.ts:160` + unitario `tests/unit/repositories/zona-distritos-rastro-500.test.ts` |
| R15 | `zona-distrito-rastro-500.test.ts:217` (80 → 60) + unitario |
| R17 | ídem :234 (otro orden, contra Postgres); los repetidos, en el unitario (justificado: `ZonaService` deduplica antes de llegar al repositorio) |
| R18 | ídem :246 (los tres rechazos, con la N:M igual) y :287 (error forzado, con premisa `RegistroCaido`). Ver m1 sobre T6.10 |
| R19 | ídem :306 |
| R20 | `tests/unit/historial-accion/catalogo-y-choke-point.test.ts` «FICHA 500 (R20)», con categoría y etiqueta literales |
| R21 | `zona-distrito-rastro-500.test.ts:335` (repositorio: categoría, acción, `listAll`) + `tests/components/HistorialAccionesZonaDistrito500.test.tsx` |
| R22 | `tests/integration/db/historial-accion-zona-distrito-500-migration.test.ts:59` (conserva un valor sembrado después) y :78 (aborta con una fila viva) |
| R23 | `tests/unit/guards/textos-satelite-definitivos-500.guardia.test.ts` (con autocomprobación) |

**Mutación T6.10 superviviente (R18), mi juicio.** El código está bien: el bloque nuevo usa
`appendAccion(tx, …)` dentro del `$transaction` (`lib/repositories/ZonaRepository.ts:760-785`), y es lo
último antes del `return`. Los dos casos de R18 que pide el spec (rechazo y fallo al registrar) están
medidos contra Postgres. La mutación `this.prisma` solo se notaría si fallara el COMMIT después de
escribir el rastro. Esa misma limitación del arnés ya está documentada en el repo
(`corregir-conciliacion.int.test.ts:28`, `historial-accion-escrituras-cubiertas.guardia.test.ts:120`).
**No es bloqueante.** Aun así se podría cazar barato: ver m1.

---

## Hallazgos

### BLOQUEANTE

**B1 — El test de R9 (y el de R2, que es igual) es inestable con la base compartida.**
`tests/integration/db/500-con-dinero-sql-real.test.ts:38-50` (`fotoDeTodo`) compara una huella de las
seis tablas ENTERAS (`huella` de `498/_migraciones.ts:135`: `count(*)` + md5 de todas las filas). La
transacción del test es READ COMMITTED, así que cualquier fila que otro archivo commitee en paralelo
cambia la huella entre el «antes» y el «después». En mi gate pasó exactamente eso: :224 salió rojo con
`wallet_movimiento=42 → 43` y `wallet_tienda_movimiento=31 → 32`, y verde aislado. No lo provocó el
revertir: lo commiteó otra transacción. El spec dice, en §Fuera de alcance y sobre el bloque 9: «Si un
test de esta ficha cae en uno de esos modos, se arregla en el propio test». Cada gate futuro que amplíe
`integration/db` puede volver a ponerlo rojo.
**Qué falta:** acotar la foto a lo que pertenece a la consolidación: la fila `cierre_bodega` de A/B,
sus `conciliacion_bodega_ajuste`, los movimientos de los tres libros cuyo origen sea uno de sus
cierres o su ajuste (para B: el `egreso_diferencia_satelite` enlazado a su ajuste) y las filas de
`historial_accion` con `entidad_id` = A/B. Después, repetir la mutación T6.1 o una equivalente (p. ej.,
que el revertir escriba el historial antes del corte) para comprobar que la foto acotada sigue
mordiendo. Es un cambio solo de test. No hay que tocar el código.

### menor

**m1 — T6.10 se puede cazar con un unitario.** En `tests/unit/repositories/zona-repository.test.ts`,
un caso donde el doble de `$transaction` entregue un `tx` DISTINTO del cliente raíz y se afirme que
`historialAccion.createMany` del rastro de distritos se llama sobre `tx` y nunca sobre la raíz. Así la
mutación `appendAccion(this.prisma, …)` saldría roja. Recomendado, no obligatorio.

**m2 — El nombre de un test promete más de lo que hace.**
`historial-accion-zona-distrito-500-migration.test.ts:59` dice «…up otra vez lo devuelve», pero el
cuerpo hace up → down y no vuelve a aplicar el up. La bitácora (T3) también habla de «up → down → up».
Hay que añadir el segundo `correr(tx, UP(DIR))` con su `toContain(VALOR)` o corregir el nombre.

**m3 — La frase de la ayuda no describe bien el caso de datos viejos.**
`docs/ayuda/oficina/wallet-satelites.md` (texto añadido): «…es porque la pantalla se cargó antes de que
alguien la marcara». Si la pantalla se cargó antes de la marca, la consolidación salía pendiente y lo
que se ofrecía era «Marcar recibido», no «Desmarcar». El caso real es una conciliada sin dinero a la que
otra persona le corrigió el monto (o la desmarcó y la volvió a marcar con diferencia) después de cargar
la pantalla. Una redacción posible: «…antes de que alguien corrigiera el monto». El test de R8 solo
fija la primera frase, así que se puede cambiar sin tocarlo.

**m4 — La nota de la 498 contradice el botón (hallazgo 1 de T7.6; viene de antes).**
`NOTA_CONCILIACION_ASIENTA` («Después no se puede desmarcar…») sale dentro del diálogo de «Desmarcar»,
que ahora solo se ofrece cuando SÍ se puede desmarcar. R23 declaró ese texto definitivo, así que la 500
hizo bien en no tocarlo. Queda para una ficha de textos.

**m5 — Una consolidación recibida de más y con dinero se queda sin ninguna acción.** Ver la respuesta
al punto 4. No es regresión, pero conviene que el humano lo sepa.

---

## Respuesta al punto 4: «con dinero (debe ₡0, marcada con ₡90) sin Desmarcar NI Corregir»

**No es una regresión de la 500.** «Corregir» tampoco salía en `origin/dev` para esa consolidación:

- «Corregir» depende solo de `estado === "incompleto"` (`components/shared/conciliacion/ConciliacionAcciones.tsx:218`).
  Esa línea es idéntica en `origin/dev` y la 500 no la toca.
- `estadoConciliacionDe` (`app/(app)/cierres-admin/_components/cierre-labels.ts:664-670`) da «incompleto»
  solo si `hayFaltantePorRecibir(faltaPorRecibir)`. Con debe 0 y recibido 90, `faltaPorRecibir` = «-90.00»,
  y `NADA_FALTA` (`:650`) trata el negativo como «no falta nada». El estado es **«recibido»**.
- En `origin/dev`, una «recibido» mostraba **solo «Desmarcar»** (`estado !== "pendiente"`), y el servidor
  lo rechazaba con `con_asientos`. Con la 500, ese botón condenado desaparece porque `puedeDesmarcar` es
  `false`, así que la fila se queda sin botones.
- Así lo quiere el spec: R5 limita «Corregir» a la marca incompleta, §Fuera de alcance dice «Ofrecer
  «Corregir» sobre una consolidación recibida completa: hoy no se ofrece (ficha 473) y H5 no lo pide», y
  `ConciliacionAcciones500.test.tsx:71-76` lo fija (recibida sin poder desmarcar → 0 botones).

Consecuencia de producto (m5): una consolidación recibida DE MÁS y con dinero no tiene forma de
corregirse desde la pantalla. Con la 498 tampoco la tenía de verdad, porque «Desmarcar» siempre fallaba.
Si el humano quiere permitir corregir un sobrante, es una ficha nueva.

## Puntos 2, 3 y 5

- **Migración** `db/migrations/20261104120000_historial_accion_zona_distrito_500/`:
  - el up es una sola sentencia (`ADD VALUE IF NOT EXISTS`);
  - el down es dinámico, con la función de la 498 byte a byte salvo el sufijo (lo afirma el test), una precondición ruidosa y nada de recrear con lista fija;
  - es la última por prefijo;
  - está declarada en `posteriores` (`tests/integration/db/orden-traspaso-migration.test.ts:219`);
  - `git diff --name-status` sobre `db/migrations` solo muestra los dos archivos nuevos (A): ningún `down.sql` ya aplicado se tocó.
- **Fuente única:**
  - `consolidacionesConDinero` (`lib/repositories/consolidaciones-con-dinero.ts`) la usan `revertirConciliacion` (dentro del `tx`, `CierresBodegaAdminRepository.ts:664`), `findCierreBodegaConDetalle` (:419-427) y las dos lecturas de `SaldosSatelitesRepository` (una llamada por página, sin N+1);
  - el corte de «saldada» de la pantalla y el del servidor salen de la misma `esSaldadaReglaAnterior`;
  - `tieneAsientos` está borrado;
  - R4 lo demuestra contra Postgres.
- **Rastro de distritos:**
  - va en `ZonaRepository.update` dentro del `$transaction`, con `tx` y `randomUUID()` propio;
  - los previos se leen antes del reemplazo de la N:M (:529) y el nombre es el de después del guardado;
  - R13 está medido contra el lote de `zona_pago_mensajero_cambiado`.
- **Tests existentes tocados:**
  - las fixtures ganan `puedeDesmarcar`, sin cambiar asserts;
  - los conteos 65→66 y 43→44 van con su comentario;
  - en las ventanas de enum, la de `caja-459` corre los índices y AÑADE un literal para el valor nuevo;
  - `zona-repository.test.ts` siembra `d1` previo para que los casos «no se registró nada» sigan midiendo lo mismo;
  - `498-conciliar-asienta` solo mueve `consolidacionConDosCierres` a `498/_satelite.ts` sin cambiar el cuerpo.
  - Ningún assert se debilitó.

---

## Segunda vuelta (2026-11-03) — `55fdee73..7f864b21`

Solo se revisó el diff de la revisión 1: `500-con-dinero-sql-real.test.ts`, el test de migración de la
500, la ayuda y la bitácora. Lo aprobado en la primera vuelta no se volvió a revisar.

| Hallazgo | Comprobación | Estado |
| --- | --- | --- |
| **B1** | `fotoDeTodo(e, ids)` ya no mira tablas enteras, solo lo que es de A/B: su fila de `cierre_bodega`, sus ajustes, los movimientos de los tres libros con origen en sus cierres o en sus ajustes, y el historial con `entidad_id` A/B. Un caso nuevo de anti-vacuidad prueba que la foto no está vacía (A: caja e historial; B: 1 ajuste, 1 egreso e historial). Corrido aislado dos veces: 9/9 y 9/9. **Mutación repetida por mí:** quitar la línea del corte `con_asientos` de `revertirConciliacion` pone 3 rojos: R2 y R9 **por la foto** (`expected 'cierre_bodega=1:bc12…' to be 'cierre_bodega=1:cf0c…'`; la foto se afirma antes que el desenlace) y R4. Revertida con `git checkout`; `git status` limpio | **Resuelto** |
| **m2** | El test reaplica el up dentro de la misma transacción revertida y afirma `errorReUp` nulo y `trasReUp == [...trasDown, VALOR]` | Resuelto |
| **m3** | La ayuda ahora dice «…antes de que alguien corrigiera el monto»; el test de R8 sigue verde | Resuelto |
| m1, m4, m5 | Sin cambios: son recomendaciones o quedan fuera del alcance | Abiertos (menores) |

Tests corridos: `500-con-dinero-sql-real` aislado ×2 (9/9); `historial-accion-zona-distrito-500-migration`
+ `ayuda-wallet-satelites-498` (21/21). El gate `--rapido` no se repitió: el diff solo toca tests y docs,
y estos son los tres archivos afectados.

### Veredicto de la segunda vuelta: **OK**

No queda ningún bloqueante. Quedan abiertos los menores m1, m4 y m5, que no impiden el cierre.
