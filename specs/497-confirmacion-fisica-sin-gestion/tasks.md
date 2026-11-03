# Ficha 497 — Tareas

Zona `fullstack`. Se secuencia **backend → frontend** (backend_dev primero, frontend_dev después).
Rama `fix/497-confirmacion-fisica-sin-gestion` desde `dev`. Sale con la próxima release.
`[P]` = paralelizable con las tareas del mismo bloque que **no tocan los mismos archivos**.

> **Gate:** `./init.sh --rapido`. Se amplía solo con `tests/integration/db` porque el diff toca
> `db/schema.prisma`, una migración y `lib/types/`. **No se corre el completo.** Además se corren a
> mano las guardias de design §8, que el grafo no relaciona con el diff. Hay que mirar los
> `skipped` de `integration/db`: sin base se saltan y el gate sale verde igual.
>
> **Registro:** todo lo medido (rojos, verdes, mutaciones, salidas del gate) va a
> `progress/impl_497.md`, con el mapa `R<n> → test`. Cada agente **commitea** lo suyo.

---

## T0 · Arranque

- [ ] **T0.1 — Base de la rama.** Crear la rama desde `origin/dev` y anotar el SHA en
      `progress/impl_497.md`. Comprobar la última migración de `origin/dev`: si ya hay una con fecha
      ≥ `20261102120000`, elegir una fecha posterior para la de T2.1.
      **Hecho:** SHA y nombre de la migración elegida escritos.
      *Depende de: nada.*

- [ ] **T0.2 — Confirmar que Q1 y Q2 de `requirements.md` están respondidas.** Q2 decide si se puede
      editar (solo de forma aditiva) `aprobacion-escrituras-cubiertas.guardia.test.ts`.
      **Hecho:** respuesta del humano citada en `progress/impl_497.md`. Si Q2 es «no», **parar** antes
      de T3.3.
      *Depende de: nada.*

---

## T1 · Demostrar el bug: tests en rojo contra el código de hoy

- [ ] **T1.1 [P] — Rojo de servicio.** En `tests/unit/services/cierres-admin-confirmacion-fisica.test.ts`,
      un caso: cierre con una barrida y sin gestiones que vuelvan, aprobado con `confirmacionFisica: []`
      → se espera `validation_error` con la clave `ordenId` de la barrida y `repo.resolverCierre` no
      llamado. El doble del repo expone `findBarridasDelCierre`.
      **Hecho:** el caso se ve **rojo** contra el código actual (hoy devuelve `null` y aprueba). Salida
      anotada.
      *Depende de: T0.1.*

- [ ] **T1.2 [P] — Rojo de integración.** Crear
      `tests/integration/db/497-confirmacion-barridas-sql-real.test.ts` con el primer caso: cierre
      creado por la ruta del corte (o con filas insertadas en `cierre_sin_gestion`), pasado a
      `solicitado`, aprobado por el servicio real sin confirmar la barrida → se espera que el cierre
      siga en `solicitado` y la orden siga en `novedad_interna`.
      **Hecho:** **rojo** contra el código actual (hoy aprueba y libera), y el test **no** está
      `skipped`. Salida anotada.
      *Depende de: T0.1.*

---

## T2 · Datos

- [ ] **T2.1 — Migración y esquema.** Añadir `confirmadaFisicaAt DateTime? @map("confirmada_fisica_at")`
      a `CierreSinGestion` con su comentario (design §4). Crear
      `db/migrations/<fecha>_cierre_sin_gestion_confirmacion_fisica/migration.sql` y `down.sql`.
      Aplicar en local y `prisma generate`.
      **Hecho:** `prisma migrate status` sin pendientes en local; typecheck verde.
      *Depende de: T0.1.*

- [ ] **T2.2 — Test de la migración.** Crear
      `tests/integration/db/497-cierre-sin-gestion-confirmacion-migration.test.ts` (molde
      `confirmacion-fisica-migration.test.ts`): columna `timestamp(3)`, nullable, sin default, filas
      existentes en `NULL`; `down.sql` existe, suelta la columna y es idempotente.
      **Hecho:** verde, no `skipped`. Cubre R25 y R41.
      *Depende de: T2.1.*

---

## T3 · Backend

- [ ] **T3.1 [P] — Punto único.** Añadir a `lib/types/gestion-retorno.ts` `OrigenDelPaquete`,
      `RETORNO_POR_ORIGEN`, `PaqueteDelCierre` y `vuelveABodegaElPaquete` (design §3). Extender
      `tests/unit/types/gestion-retorno.test.ts` (incluido el `@ts-expect-error` del tercer origen) y
      añadir los dos casos con autocomprobación a `confirmacion-incidentes-excluidos.guardia.test.ts`.
      **Hecho:** tests verdes; `git diff` sobre las líneas 33-61 del módulo, vacío. Cubre R1-R4.
      *Depende de: T0.1.*

- [ ] **T3.2 — Lectura de barridas.** `BarridaDelCierre` y `findBarridasDelCierre` en
      `ICierresAdminRepository` y `CierresAdminRepository` (design §5.3). Extender
      `tests/unit/repositories/cierres-admin-confirmacion-fisica.test.ts` (forma del `WHERE` y del
      `select`). Añadir a la suite de integración de T1.2 los casos de R5-R9 (otro cierre, fuera de
      alcance, guía congelada distinta de la viva, cierre sin filas).
      **Hecho:** verdes. Cubre R5-R9.
      *Depende de: T2.1.*

- [ ] **T3.3 — Contrato y escritura en la transacción.** En `ICierresAdminRepository`: `ordenId?: never`
      en `ConfirmacionFisicaGestion`, nuevo `ConfirmacionFisicaBarrida`, `confirmacionFisica` como
      unión (design §5.4). En `resolverCierre`, dentro del bloque de la 238: separar `gestionIds` de
      `ordenIds`, mantener el `updateMany` de gestiones solo con `gestionIds`, y añadir el
      `tx.cierreSinGestion.updateMany` guardado por `cierreId` con fallo cerrado. Sin tocar los feeds de
      dinero ni la liberación (design §7). Extender la suite unitaria del repo (casos de R22-R24, R27 y
      R28, incluido «TESTIGO del `cierreId` de la barrida»). Añadir la entrada aditiva a
      `aprobacion-escrituras-cubiertas.guardia.test.ts` según la respuesta a Q2.
      **Hecho:** suites verdes; `git diff -- tests/unit/repositories/cierres-admin-caja-cod.test.ts`
      **vacío** y la suite verde (R40); `git diff` sin cambios en las líneas de los cinco escritores de
      dinero.
      *Depende de: T0.2, T3.2.*

- [ ] **T3.4 — Borde.** `confirmacionFisicaSchema` como unión de dos objetos `.strict()` (design §5.1).
      Antes, comprobar que ningún llamador envía claves extra. Extender
      `tests/unit/types/cierres-admin-confirmacion-schema.test.ts`.
      **Hecho:** verde; los casos de forma de hoy siguen verdes sin cambiar sus entradas.
      *Depende de: T0.1.*

- [ ] **T3.5 — Servicio.** `ConfirmacionFisicaInput` como unión; `validarConfirmacionFisica` con los dos
      mapas, el atajo de R19 ampliado y el paso de entradas al repo (design §5.2). Extender
      `tests/unit/services/cierres-admin-confirmacion-fisica.test.ts` con todos los casos de R10-R21
      (design §11) y `cierres-admin-service.aprobar.sin-gestion.test.ts` para R29.
      **Hecho:** el rojo de T1.1 pasa a verde y el resto de casos está verde.
      *Depende de: T3.1, T3.2, T3.3, T3.4.*

- [ ] **T3.6 — Integración completa.** Completar
      `tests/integration/db/497-confirmacion-barridas-sql-real.test.ts`: aprobar completo marca todas
      las barridas liberadas en la misma tx (R22, R29); `count` corto revierte todo (R23); datos
      congelados intactos (R24); conteos de las tres tablas de dinero y montos del cierre iguales con y
      sin barridas (R39); rechazo y reapertura sin marcas (R28).
      **Hecho:** el rojo de T1.2 pasa a verde, todo verde y no `skipped`.
      *Depende de: T3.5, T2.1.*

- [ ] **T3.7 — Gate backend.** `./init.sh --rapido` (ampliado con `integration/db`) y, a mano, las cinco
      guardias de design §8. Commit.
      **Hecho:** salida con `INIT_EXIT` escrito dentro del log, en `progress/`; `skipped` revisados;
      guardias verdes. Si sale un rojo ajeno, se repite **aislado** y se anota como intermitente si pasa.
      *Depende de: T2.2, T3.1-T3.6.*

---

## T4 · Frontend

- [ ] **T4.1 — Vista unificada.** En `cierre-confirmacion-fisica.tsx`: `FilaAConfirmar` y
      `filasAConfirmar`; `interpretarLectura`, `clavePaquete`, `agruparPorPaquete` y
      `progresoDePaquetes` sobre la vista unificada (design §6.2). Las funciones que queden sin uso se
      borran **con sus tests sustituidos**.
      **Hecho:** typecheck verde; los tests de la 238 sobre gestiones siguen verdes (adaptados al tipo,
      con la misma aserción).
      *Depende de: T3.7.*

- [ ] **T4.2 — Sección «Novedad interna» y aviso de filas sin guía.** Última sección de la misma lista
      con el rótulo vigente y su badge; aviso encima de la lista con cuántas filas no tienen guía
      (design §6.1, R35).
      **Hecho:** casos de R30, R31 y R35 en `tests/components/CierresAdminConfirmacionFisica.test.tsx`
      verdes; `nombres-estado-retirados.guardia.test.ts` verde.
      *Depende de: T4.1.*

- [ ] **T4.3 — Módulo.** En `CierresAdminModule.tsx`: `pedirAprobacion` con `filasAConfirmar`, envío de
      entradas `{ ordenId, numGuia }`, `repartirErroresDelServidor` con `gestionIds ∪ ordenIds`
      (design §6.2).
      **Hecho:** casos de R19 (payload idéntico sin barridas), R20, R32-R34 y R36-R38 verdes.
      *Depende de: T4.1.*

- [ ] **T4.4 — Ver la pantalla.** Con el dev server del propio agente (sin levantar un segundo):
      abrir un cierre `solicitado` con barridas, ver la sección «Novedad interna», escanear o teclear
      una guía de barrida, ver el contador moverse y el botón bloqueado hasta completar. Limpiar los
      datos creados en la base local.
      **Hecho:** capturas o descripción con números (filas, contador) en `progress/impl_497.md`; base
      local limpia.
      *Depende de: T4.2, T4.3.*

---

## T5 · Cierre de la ficha

- [ ] **T5.1 — Contraprueba por mutación.** Aplicar **una a una** las ocho mutaciones de design §11.
      Para cada una: ver al menos un test nombrado en **rojo**, restaurar y comprobar que el diff de la
      mutación queda vacío. No se corren en paralelo con el gate.
      **Hecho:** tabla mutación → test rojo → diff vacío en `progress/impl_497.md`. Si una mutación
      sobrevive, se refuerza el test y se repite.
      *Depende de: T4.3.*

- [ ] **T5.2 — Gate final.** `./init.sh --rapido` y las guardias de design §8 a mano. Commit y PR contra
      `dev`. Antes de mergear, revisar el build de Vercel del PR (`gh pr checks`).
      **Hecho:** gate verde con `skipped` revisados, mapa `R1-R41 → test` completo en
      `progress/impl_497.md`, PR abierto con el build en verde.
      *Depende de: T4.4, T5.1.*
