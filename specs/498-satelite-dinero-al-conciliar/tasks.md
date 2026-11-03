# Ficha 498 — Tareas

Zona `fullstack`. Se secuencia **backend → frontend**: primero backend_dev (T0–T6, T8.1–T8.2) y después
frontend_dev (T7). Rama `fix/498-satelite-dinero-al-conciliar` desde `dev`. **Depende de la 497**: va
después de que esté mergeada. Sale con la próxima release.
`[P]` = paralelizable con las tareas del mismo bloque que **no tocan los mismos archivos**.

> **Gate:** `./init.sh --rapido`. El diff toca dinero, migraciones, `db/schema.prisma` y `lib/types/`,
> así que se amplía solo con `tests/integration/db`. **No se corre el completo.** Además se corren a
> mano las guardias de design §11 y las de ayuda: el grafo no las relaciona con el diff. Hay que mirar
> los `skipped` de `integration/db`: sin base se saltan y el gate sale verde igual.
>
> **Registro:** todo lo medido (rojos, verdes, mutaciones y salidas del gate) va a
> `progress/impl_498.md`, con el mapa `R<n> → test` de design §14. Cada agente **commitea** lo suyo y
> comprueba la rama con `git status -sb` antes de commitear.
>
> **Producción:** ninguna tarea escribe en producción ni copia cifras de producción al repositorio.

---

## T0 · Arranque

- [x] **T0.1 — Base de la rama.** Crear la rama desde `origin/dev` y anotar el SHA en
      `progress/impl_498.md`. Hay tres cosas que comprobar:
      (a) la 497 está mergeada en `origin/dev`: su bloque de barridas está en `resolverCierre` y la
      migración `…_cierre_sin_gestion_confirmacion_fisica` existe;
      (b) el último prefijo de `db/migrations` en `origin/dev`: si alguno es ≥ `20261102160000`, mover
      las cuatro fechas de design §3 por encima, manteniendo su orden M1 < M2 < M3 < M4;
      (c) los números de línea de design §1 siguen valiendo después de la 497.
      **Hecho:** SHA, prefijos elegidos y diferencias de línea escritos. Si (a) falla, **parar**.
      *Depende de: nada.*

- [x] **T0.2 — Respuestas del humano.** Copiar a `progress/impl_498.md` las respuestas del 2026-11-02
      (cabecera de `requirements.md`): SINPE/transferencia (recibido = total, R16a/R16b), Q3 límite
      aceptado, Q4 regularización por migración (M4, design §3.5), Q5 recibido 0 solo con aporte ≤ 0
      (design §4.4 bis). Q1 y Q2 siguen abiertas y no se tocan.
      **Hecho:** las cinco anotadas con su requisito.
      *Depende de: nada.*

---

## T1 · Demostrar el bug: tests en rojo contra el código de hoy

- [x] **T1.1 [P] — Rojo de la aprobación.** Crear `tests/integration/db/498-aprobacion-satelite-sql-real.test.ts`
      con el caso: aprobar por el repositorio real un cierre satélite con COD, SINPE y pago al mensajero
      → cero filas nuevas en `wallet_movimiento`, `wallet_tienda_movimiento` y
      `pago_mensajero_movimiento` con `origen_id` = el cierre.
      **Hecho:** **rojo** contra el código actual (hoy escribe) y **no** `skipped`. Salida anotada.
      *Depende de: T0.1.*

- [x] **T1.2 [P] — Foto de los cierres centrales (red de R3).** En el mismo archivo, un caso que
      aprueba un cierre central con todos los conceptos (COD, flete, comisión, IVA, pago al mensajero,
      indemnización) y compara el multiconjunto `(tabla, tipo, categoria, monto, origen_tipo,
      origen_id)` con un literal sacado del código de hoy.
      **Hecho:** **verde** contra el código actual. El literal está escrito en el test y su origen
      anotado (memoria «literal: contrato o polizón»: este literal **es** el contrato).
      *Depende de: T0.1.*

- [x] **T1.3 [P] — Rojo de la conciliación.** Crear `tests/integration/db/498-conciliar-asienta-sql-real.test.ts`
      con el caso: consolidación con dos cierres satélite aprobados; marcar recibida por menos del
      aporte → filas en los tres libros con origen en esos cierres y **una** fila de caja
      `egreso_diferencia_satelite`. Comprobar también que los cinco feeds no ponen
      `fechaMovimiento` (design §1, R13).
      **Hecho:** **rojo** contra el código actual (hoy marcar no escribe). Salida anotada.
      *Depende de: T0.1.*

- [x] **T1.4 [P] — Rojo de la deuda.** Crear `tests/integration/db/498-deuda-satelite-sql-real.test.ts`
      con el caso: zona con un cierre aprobado sin consolidar y una consolidación con SINPE → la deuda
      de Saldos es igual a la fórmula de R23 hecha a mano.
      **Hecho:** **rojo** contra el código actual (hoy solo efectivo de consolidaciones).
      *Depende de: T0.1.*

---

## T2 · Datos

- [x] **T2.1 — M1, los enums.** `db/migrations/<fecha>_satelite_498_enums/migration.sql` y `down.sql`
      (design §3.1; la función de la 488 renombrada `_498`). Añadir los tres valores a `db/schema.prisma`.
      **Hecho:** aplicada en local; `prisma generate`; typecheck verde.
      *Depende de: T0.1.*

- [x] **T2.2 — M2, la tabla de ajustes y el CHECK.** Migración de design §3.2, modelo Prisma
      `ConciliacionBodegaAjuste` y relación inversa en `CierreBodega`. El CHECK parte **literalmente**
      de `20261023120100_iva_por_pagar_488_checks`. `down.sql` en el orden de §3.2. Comprobar antes
      los tipos de `cierre_bodega.id` y `usuario.id`.
      **Hecho:** `prisma migrate status` sin pendientes en local; `migrate diff` contra el esquema sale
      vacío.
      *Depende de: T2.1.*

- [x] **T2.3 — Seeds y tipos.** Añadir los tres valores a `WALLET_MOVIMIENTO_CATEGORIA_SEED` y
      `WALLET_ORIGEN_TIPO_SEED` (`lib/types/wallet.ts`), y añadir el dueño `por_cobrar_satelite` a
      `NaturalezaMovimiento`. Arreglar **solo** lo que el typecheck exija clasificar (los `Record`
      totales), con los valores de design §8.1 y §8.3.
      **Hecho:** typecheck verde. Cada `Record` tocado está anotado en `progress/impl_498.md`.
      *Depende de: T2.2.*

- [x] **T2.4 — Test de M1/M2.** Crear `tests/integration/db/498-satelite-migraciones.test.ts` con los
      casos de R46, R47 y R53 de design §14. El caso del valor posterior siembra a propósito un valor de
      enum extra y comprueba que sobrevive al `down`.
      **Hecho:** verde y no `skipped`.
      *Depende de: T2.2.*

- [x] **T2.5 — M3, retirar los asientos de S.** `…_satelite_498_retirar_asientos/migration.sql` y
      `down.sql` (design §3.3). Antes de escribirla, confirmar en `db/schema.prisma` que ninguna FK
      entrante a los tres libros apunta a filas con origen `cierre_dia`, y anotarlo.
      **Hecho:** aplicada en local sin error; el respaldo existe en `respaldo`; `migrate diff` sigue
      vacío (Prisma no ve `respaldo`).
      *Depende de: T2.2.*

- [x] **T2.6 — Test de M3.** Crear `tests/integration/db/498-retirar-asientos-migration.test.ts` con
      los casos de R48–R52 (design §14). La guarda de `liquidacion_pago` se prueba sembrando el pago y
      comprobando el `RAISE`, el conteo en el mensaje y cero cambios.
      **Hecho:** verde y no `skipped`. Matar el test con la mutación 12 o 13 de design §14 antes de
      creerlo (memoria «test de integración verde sin datos»).
      *Depende de: T2.5.*

- [x] **T2.7 — M4, regularizar lo conciliado antes (Q4).** `…_satelite_498_regularizar/migration.sql`
      y `down.sql` (design §3.5), con prefijo posterior a M3. Campo `esperadoReglaAnterior` en
      `CierreBodega` de `db/schema.prisma`, con comentario que cite la decisión del humano del
      2026-11-02. Antes de escribirla, confirmar que `cierre_bodega` no tiene un trigger que mueva
      `updated_at` (si lo tiene, anotarlo y decidir con el leader cómo cumplir R54b).
      **Hecho:** aplicada en local después de M2/M3; `prisma generate`; `migrate diff` vacío; typecheck
      verde. El `UPDATE` no nombra ningún id ni ninguna fecha.
      *Depende de: T2.5.*

- [x] **T2.8 — Test de M4.** Crear `tests/integration/db/498-regularizar-migration.test.ts` con los
      casos de R53 (M4) y R54a–R54d (design §14): solo marca conciliadas no rechazadas sin fila de
      ajuste; libros, tabla de ajustes y columnas existentes de `cierre_bodega` idénticos antes y
      después; deuda 0 de las saldadas; up → down → up determinista; CHECK.
      **Hecho:** verde y no `skipped`; con la mutación 14 se pone rojo (salida anotada).
      *Depende de: T2.7.*

---

## T3 · Repositorio

- [x] **T3.1 — Extraer `asentarCierreDia`.** Crear `lib/repositories/asentar-cierre-dia.ts`
      (design §4.1) moviendo **literalmente** `CierresAdminRepository.ts:~1871-1933`. Exportar
      `dependenciasRealesDeAsiento`. `resolverCierre` llama a la función con `this.depsAsiento` y,
      **todavía sin condicionar por destino**, deja el comportamiento idéntico.
      **Hecho:** T1.2 verde; T1.1 sigue rojo; `cierres-admin-caja-cod.test.ts` y las demás suites de
      `resolverCierre` verdes **sin tocar nada**. Es un refactor puro.
      *Depende de: T1.1, T1.2.*

- [x] **T3.2 — Test unitario del asiento.** Crear `tests/unit/repositories/asentar-cierre-dia.test.ts`
      (R5, R7): orden de llamadas, la condición `acreditoCod` y que nunca escribe premios.
      **Hecho:** verde. La mutación 3 (invertir dos escritores) lo pone rojo.
      *Depende de: T3.1.*

- [x] **T3.3 — La aprobación mira el destino.** El `switch` exhaustivo de design §4.2 y
      `DestinoDeCierreDesconocidoError`. Ajustar **solo el fixture** de las suites con dobles para que
      devuelvan `destinoTipo: "bodega_central"`. Añadir el caso del destino desconocido a
      `cierres-admin-repository.test.ts`.
      **Hecho:** T1.1 **verde**; T1.2 verde; `git diff` de las suites con dobles limitado al fixture
      (ninguna línea de `expect` cambia). Completar los casos de R2 en
      `498-aprobacion-satelite-sql-real.test.ts`.
      *Depende de: T3.1.*

- [x] **T3.4 — Guardia de escrituras de la aprobación.** Editar
      `aprobacion-escrituras-cubiertas.guardia.test.ts` como dice design §11: las tres entradas
      inyectadas se buscan en `asentar-cierre-dia.ts`, y hay un caso nuevo que exige la llamada a
      `asentarCierreDia` en la rama central. Lleva autocomprobación.
      **Hecho:** guardia verde; con la llamada borrada, se pone roja (salida anotada); el bloque de la
      497 está intacto.
      *Depende de: T3.3.*

- [x] **T3.5 — Dependencias por defecto en `CierresBodegaAdminRepository`.** Constructor de design §4.3
      y ampliar el tipo del cliente. Los dos composition roots no cambian.
      **Hecho:** typecheck verde; `git diff` vacío sobre `lib/actions/conciliacion-satelites.ts` y
      `lib/actions/cierre-bodega.ts`.
      *Depende de: T3.1, T2.3.*

- [x] **T3.6 — Marcar asienta y escribe la diferencia.** Implementar `escribirDiferencia` y el bloque
      de design §4.4 en `marcarConciliado`.
      **Hecho:** T1.3 **verde**; completados en `498-conciliar-asienta-sql-real.test.ts` los casos de
      R8–R15 y R54 (signo, cero, una sola fila, fecha, fallo inyectado que revierte, `conflict` sin
      filas, cierre retirado que se vuelve a asentar, idempotencia del asiento y CHECK de
      `resolverCierreBodega`). El esperado sale de `aporteDeConsolidacion` (T4.1), no de una copia.
      *Depende de: T3.5, T2.5, T4.1.*

- [x] **T3.6b — Recibido 0 (Q5).** Design §4.4 bis: `montoCeroSchema` y la unión en
      `marcarConsolidacionRecibidaSchema` (sin tocar `montoPositivoSchema`), reescribir el comentario
      de `lib/types/conciliacion-satelites.ts:246-250`, el desenlace `recibido_cero_con_aporte` en
      repositorio, interfaz, servicio y acciones, y su texto en `conciliacion-labels.ts`.
      **Hecho:** casos de R15a/R15b verdes en `498-conciliar-asienta-sql-real.test.ts` y en la suite
      del schema (incluido que `montoPositivoSchema` sigue rechazando `"0"`); la mutación 16 los pone
      rojos.
      *Depende de: T3.6, T4.1.*

- [x] **T3.7 — Corregir escribe solo la variación.** Design §4.5.
      **Hecho:** casos de R17–R19 verdes, incluido el de la saldada con la regla anterior (esperado =
      aporte reconocido; necesita T2.7). Sustituido `corregir-conciliacion.int.test.ts:304` por su
      inverso (design §11), con la cita de la decisión del 2026-11-02 en el comentario del caso.
      *Depende de: T3.6, T2.7, T4.1.*

- [x] **T3.8 — Revertir con asientos.** `tieneAsientos`, el desenlace `con_asientos` en el repositorio,
      su interfaz, el servicio y la acción (design §4.6).
      **Hecho:** casos de R20 y R22 verdes. Sustituido `marca-conciliacion.int.test.ts:336` por su
      inverso. Extendido `conciliacion-satelites-service.test.ts` con `con_asientos` y con R45: para
      `adminSatelite`, `forbidden` sin llamar al repositorio en las tres escrituras.
      *Depende de: T3.6.*

- [x] **T3.9 — El composition root mira filas.** Crear
      `tests/integration/db/498-composition-root-asiento.int.test.ts` (R6, design §14). Llama a la
      acción real inyectando **solo** `getActor`.
      **Hecho:** verde y no `skipped`. Con la mutación 4 (sin valor por defecto) se pone rojo. Ambas
      salidas anotadas.
      *Depende de: T3.6.*

- [x] **T3.10 — Contratos y comentarios.** Reescribir los comentarios y JSDoc de design §4.7.
      **Hecho:** `grep` de «NINGUN LIBRO DE DINERO» en `lib/` sin resultados en los archivos de la
      conciliación.
      *Depende de: T3.8.*

---

## T4 · Fórmula única, Saldos y Estado de cuenta

- [x] **T4.1 — Fórmula TS y SQL.** En `lib/utils/conciliacion-satelite.ts`: `faltaPorRecibir`,
      `aporteDeConsolidacion` (aporte reconocido: `esperadoReglaAnterior ?? paraLaCentral`) y
      `deudaDeZona`, y retirar `saldoDe`. Crear `lib/repositories/deuda-satelite-sql.ts` con las cuatro
      piezas (design §5.2, incluida `saldadaReglaAnteriorSql`). Migrar `CierreBodegaRepository.ts:136`.
      Añadir a `498-deuda-satelite-sql-real.test.ts` la equivalencia SQL ↔ `paraLaCentral` (R28) y a
      `conciliacion-satelite.test.ts` los casos de `faltaPorRecibir` y de `aporteDeConsolidacion` con y
      sin `esperadoReglaAnterior`.
      **Hecho:** typecheck verde; tests de R26 a R28 verdes, incluida la tarjeta de una saldada.
      *Depende de: T2.3, T2.7.*

- [x] **T4.2 [P] — Saldos.** `SaldosSatelitesRepository` (design §6) y DTO (incluidos `debe`,
      `debePositivo` y `saldadaReglaAnterior`).
      **Hecho:** T1.4 **verde**; casos de R23–R25 verdes (Σ filas = cabecera; descarga = página; la
      saldada suma 0) y el caso backend de R41a.
      *Depende de: T4.1.*

- [x] **T4.3 [P] — Estado de cuenta.** `paginaDeBodega`, `totalesDeBodega`, `periodoDeBodega` y
      `EstadoCuentaService` (design §7).
      **Hecho:** casos de R29–R31 verdes (declarado de la saldada = su `esperado_regla_anterior`); las
      suites existentes del estado de cuenta de la bodega
      están verdes o se actualizaron solo donde afirmaban el efectivo, con el motivo anotado.
      *Depende de: T4.1.*

- [x] **T4.4 — Guardia de fuente única.** Crear `tests/unit/guards/aporte-satelite-fuente-unica-498.guardia.test.ts`
      (design §11, más el censo de textos de R43 en `lib/`). Lleva autocomprobación.
      **Hecho:** verde, y rojo ante una copia sembrada de la resta (salida anotada).
      *Depende de: T4.2, T4.3, T3.10.*

---

## T5 · La caja

- [x] **T5.1 — Clasificación y derivación.** `caja-tesoreria.ts`: el `switch` exhaustivo, el bolsillo
      «Por cobrar», `derivarReparto` con cuatro bolsillos y los campos del DTO (design §8.1–§8.2).
      Localizar la guardia que cuenta las llamadas a `derivarBalance` y pasarla a siete, con el motivo.
      **Hecho:** casos de R33–R36, R38 y R39 verdes en `caja-tesoreria.test.ts`, entre ellos el literal
      de «P ≤ 0 → porciones de hoy»; `caja-clasificacion-459` y `caja-composicion-exhaustiva` verdes
      sin cambios.
      *Depende de: T2.3.*

- [x] **T5.2 — Invariante «De las tiendas» contra Postgres.** En `498-conciliar-asienta-sql-real.test.ts`,
      después de marcar con diferencia positiva, negativa y cero: «De las tiendas» de la caja =
      Σ saldos de las tiendas, y se cumple la identidad R35 sobre el agregado real de la caja.
      **Hecho:** verde.
      *Depende de: T5.1, T3.6.*

---

## T6 · Cierre del backend

- [x] **T6.1 — Gate del backend.** `./init.sh --rapido` con `INIT_EXIT=$?` dentro del log, más las
      guardias a mano de design §11.
      **Hecho:** verde; `skipped` de `integration/db` revisados y anotados. Commit del backend.
      *Depende de: T2–T5.*

---

## T7 · Frontend (frontend_dev, después de T6)

- [x] **T7.1 [P] — Caja.** `CajaResumenCard.tsx` (bloque siempre visible y las pistas literales),
      `BarraComposicionCaja.tsx` (tramo propio y `Record` total), `DUENO_LABEL` / `DUENO_PUNTO`, las
      etiquetas de las dos categorías y del origen. Las categorías no entran en
      `wallet-conceptos-manuales.ts`.
      **Hecho:** suites de R37–R40 verdes; contraste del token medido en los dos temas;
      `wallet-barra-unica-467` verde.
      *Depende de: T6.1.*

- [x] **T7.2 [P] — Conciliación y saldos.** `ConciliacionSatelite.tsx` (los tres bloques, R41, y el
      rótulo «Saldada con la regla anterior», R41a), `SaldosSatelitesTable.tsx` y su descarga (columna
      «Sin consolidar», R42), `MarcarRecibidoDialog` y el diálogo de corregir (prefijo = debe o 0, R16;
      recaudado por método, texto literal y un solo campo, R16a/R16b; mensaje de
      `recibido_cero_con_aporte`, R15a) y `ConciliacionAcciones.tsx` (aviso `con_asientos`, R21).
      **Hecho:** suites de R15a (texto), R16, R16a, R16b, R21, R41, R41a y R42 verdes.
      *Depende de: T6.1.*

- [x] **T7.3 — Textos.** `conciliacion-labels.ts` (nota literal de R43), `ConciliacionAcciones.tsx`,
      `CierresBodegaAdminModule.tsx:520, 851-856` y `ConciliacionSatelite.tsx:356`.
      **Hecho:** la guardia de T4.4 sigue verde y ya cubre `app/` y `components/`.
      *Depende de: T7.2.*

- [x] **T7.4 — Ayuda de usuario.** `docs/ayuda/oficina/wallet-satelites.md` y `wallet-caja.md`
      (design §10). Sin cifras de producción.
      **Hecho:** la guardia de T4.4 cubre `docs/ayuda/` y está verde; las guardias `ayuda-*`,
      `marca-fuente-unica-493` y `nombres-wallet-461` están verdes.
      *Depende de: T7.3.*

- [x] **T7.5 — Ver la app.** Con el dev server del agente (uno solo), recorrer `/wallet/satelites`,
      una consolidación (marcar con faltante, corregir, intentar desmarcar) y `/wallet`. Comprobar los
      importes de pantalla contra los de los tests y limpiar después lo sembrado (memoria «ver la app
      ensucia la base local»).
      **Hecho:** capturas o notas en `progress/impl_498.md`; base local limpia.
      *Depende de: T7.1–T7.4.*

---

## T8 · Gate final y despliegue

- [x] **T8.1 — Contraprueba por mutación.** Las 16 mutaciones de design §14, una a una. Por cada una:
      qué test se puso rojo, y que el diff queda vacío al restaurar. El arnés debe ejecutar de verdad
      (memoria «arnés de mutaciones que miente»): anotar el número de tests corridos por mutación.
      **Hecho:** 16/16 matadas y anotadas. Si alguna sobrevive, se añade un test y se repite.
      *Depende de: T6.1, T7.5.*

- [ ] **T8.2 — Gate final.** _(Estado 2026-11-03: el gate `--rapido` ampliado está verde — `progress/gate_498_t8.log` y `progress/gate_498_revision.log`, `INIT_EXIT=0`, 0 skipped en `integration/db`—. **Falta** abrir el PR contra `dev` y mirar `gh pr checks` (build de Vercel): lo hace el leader.)_ `./init.sh --rapido` (se amplía con `integration/db`) y las guardias a
      mano. Antes de mergear, `gh pr checks`: el build de Vercel en verde.
      **Hecho:** verde, `skipped` revisados, commit y PR abierto contra `dev`.
      *Depende de: T8.1.*

- [x] **T8.3 — Nota para la release (sin ejecutar nada).** Escribir en `progress/impl_498.md`:
      (a) «no conciliar durante el despliegue» (design §13);
      (b) la consulta de verificación posterior, **solo lectura**: consolidaciones conciliadas después
      del despliegue cuyos cierres satélite no tienen filas en `wallet_movimiento` con origen
      `cierre_dia` → debe dar 0; cierres satélite aprobados después del despliegue y sin conciliar con
      filas en los tres libros → debe dar 0;
      (c) que la analítica mueve el ingreso satélite a la fecha de conciliación;
      (d) la verificación de M4 (design §3.5), **solo lectura**: número de consolidaciones con
      `esperado_regla_anterior` no nulo, Σ de su `monto_recibido` y de su `esperado_regla_anterior`
      (deben coincidir con la medición de T8.4, salvo las conciliadas entre medición y despliegue,
      contadas aparte); deuda de cada regularizada = 0; conciliadas sin `esperado_regla_anterior` y
      sin fila de ajuste con `conciliado_at` en la ventana del despliegue → debe dar 0.
      La consulta la corre o la autoriza el humano. Sin cifras de producción en el repositorio.
      **Hecho:** nota escrita con el SQL listo para copiar.
      *Depende de: T8.2.*

- [ ] **T8.4 — Medición previa en producción, con puerta (Q4).** _(Pendiente POR DISEÑO: el SQL de solo lectura y la puerta están escritos en `progress/impl_498.md`; la medición en producción la corre el leader (MCP de producción, confirmando con `get_project_url`) o el humano el día de la release, y su veredicto se dice en el chat, sin cifras en el repositorio.)_ Escribir en `progress/impl_498.md`
      el SQL de **solo lectura** de design §3.5 (conteos (a)–(d)) y la puerta: (c) rechazadas = 0 y
      (d) conciliadas con `monto_recibido` nulo = 0; si (c) ≠ 0, se revisa Q3 con el humano antes de
      desplegar. La corre el leader con el MCP de producción (confirmando el proyecto con
      `get_project_url`) o el humano, **antes** de abrir la release, en el mismo día del despliegue.
      Las cifras se dicen en el chat y **no** se escriben en el repositorio.
      **Hecho:** SQL escrito; la puerta tiene veredicto (pasa / no pasa) anotado sin cifras; si no
      pasa, la release no sale con esta ficha.
      *Depende de: T8.2. Bloquea: el despliegue de M1–M4.*
