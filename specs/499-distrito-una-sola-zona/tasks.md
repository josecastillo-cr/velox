# Ficha 499: tareas

**Orden:** backend_dev (bloque B) y después frontend_dev (bloque F). F empieza cuando B está en la rama
`fix/499-distrito-una-sola-zona`: el `DistritoArbolDTO.zonas` y los mensajes del service son su contrato.

- La rama sale de `dev`. Lo primero es `git checkout --detach <SHA de origin/dev>` y comprobar el merge-base
  (memoria «El worktree de agente nace de dev»).
- `[P]` = se puede hacer en paralelo con la tarea anterior del mismo bloque.
- **Gate de cada bloque:** `./init.sh --rapido`. Hay migración y `db/schema.prisma`, así que se amplía solo
  con `tests/integration/db`. **Nadie corre el completo.** Un rojo se repite aislado.
- Tras crear las migraciones, `prisma migrate deploy` en la base local. Avisar al leader: la base local es
  compartida (memoria «Base local compartida rompe gates ajenos»), y el índice pone rojos los 4 tests de §7
  de design en cualquier otra rama hasta que esto se mergee.

## B: backend_dev

- [x] **B.0 Test rojo (antes de tocar nada).** Crear `tests/integration/db/zona-distrito-unico-499.test.ts`
  con dos casos, contra Postgres:
  - (i) crear una zona con un distrito que ya está en otra espera `validation_error`;
  - (ii) actualizar la zona Y con un distrito de la zona X espera `validation_error`, y que Y conserve su
    nombre y sus distritos.

  *Hecho:* los dos en **rojo** en `dev` sin cambios (hoy responden `ok`). El rojo se anota en
  `progress/impl_499.md`.
- [x] **B.1 Migraciones y esquema** (design §2).
  - Mirar `origin/dev` y fijar los timestamps (otras fichas del lote van en paralelo).
  - `…_zona_distrito_limpieza_499/{migration.sql,down.sql}` y `…_zona_distrito_unico_499/{migration.sql,down.sql}`.
  - `@@unique([distritoId])` en `ZonaDistrito` y `prisma generate`.

  *Hecho:* `prisma migrate status` limpio en la base local, y `git diff --stat db/migrations` solo muestra las
  dos carpetas nuevas (ningún `down.sql` previo tocado). Depende de B.0.
- [x] **B.2 Medir la forma del error del índice.** Script de un solo uso o test provisional: una inserción
  duplicada **dentro de un `$transaction` interactivo** con el cliente real (con adapter). Anotar en
  `progress/impl_499.md` el constructor, `code`, `meta` y `cause.code`, con el mismo formato que
  `ZonaRepository.ts:702-707`. Borrar el script.

  *Hecho:* la forma queda anotada. Depende de B.1.
- [x] **B.3 Test de migración** `tests/integration/db/zona-distrito-499-migration.test.ts`. Sigue el patrón
  de `iva-488-migration.test.ts`: lee los `.sql` del disco y los corre dentro de la transacción del test con
  `SAVEPOINT`, y se quita el índice dentro de la transacción para poder sembrar duplicados. Casos:
  - (a) dos zonas, una central: queda la no central (R2);
  - (b1) dos no centrales y (b2) tres zonas: el distrito sin zona (R3);
  - las filas borradas son exactamente las del respaldo, con sus columnas (R4);
  - sin duplicados no se borra nada y el respaldo queda vacío (R5);
  - `orden`, `zona`, `distrito`, `tarifa_zona_mensajero` e `historial_accion` iguales, comparando una foto
    antes y después (R6);
  - la migración del índice sobre un duplicado restante falla (R7);
  - el insert directo duplicado, rechazado (R1);
  - up, down y up: mismo estado, y el esquema `respaldo` se borra solo si queda vacío (R8).

  *Hecho:* verde. M5 de design §9 lo pone rojo. Depende de B.1.
- [x] **B.4 Contratos** (design §3). Añadir a `IZonaRepository` `ConflictoDistritoZona`,
  `DistritoEnOtraZona` y `CreateZonaResult`, y la nueva rama de `UpdateZonaResult`. Ajustar las 7 llamadas a
  `create` de los 4 tests de `tests/integration/db` citados en design §3.1, sin cambiar sus aserciones.

  *Hecho:* `tsc` verde. Depende de B.1.
- [x] **B.5 Repositorio** (design §4).
  - `leerConflictos` con el filtro en el `WHERE`.
  - En `create`, como primera sentencia del callback. En `update`, tras `not_found` y `sin_zona_central`.
  - `esViolacionDistritoUnico` en `_shared/prisma-unique.ts`, con las dos formas de B.2, en los dos `catch`
    antes de `translateEsCentralConflict`.
  - Unitario del detector en `tests/unit/repositories/prisma-unique-distrito.test.ts`: P2002 con el nombre,
    error del driver sin `code` con `cause.code` 23505 y el nombre, y el índice del par
    (`zona_distrito_zona_id_distrito_id_key`) que **no** se detecta.
  - Los dobles de `tests/unit/repositories/zona-repository.test.ts` responden a la nueva `findMany` con una
    lista vacía.

  *Hecho:* B.0 (i) y (ii) en **verde**. M1, M2 y M3 en rojo. Depende de B.4.
- [x] **B.6 Service** (design §3.2). Mapear `distrito_en_otra_zona` en `crear` y `actualizar`. Ordenar con el
  comparador español. Constante del mensaje de recarga. Unitario `tests/unit/services/zona-service-499.test.ts`:
  - tres conflictos desordenados salen ordenados, con tildes y mayúsculas mezcladas (R11);
  - `conflictos: null` da solo el mensaje de recarga (R13);
  - `not_found` y `sin_zona_central` siguen igual.

  *Hecho:* verde. `[P]` con B.5 una vez hecho B.4.
- [x] **B.7 Integración completa** en `zona-distrito-unico-499.test.ts`:
  - crear con conflicto y una central previa: la central previa conserva la marca, no hay zona nueva ni N:M
    ni tarifas, y `historial_accion` no cambia (R9);
  - actualizar con conflicto teniendo órdenes que se reconciliarían: ni nombre, ni N:M, ni tarifas, ni
    `orden.zona_id`, ni historial cambian (R10);
  - el mensaje nombrado, por el service real (R11);
  - los propios distritos sin cambios, menos de los suyos, y añadiendo uno libre: `ok` (R12);
  - la carrera determinista de design §4.3 (R13);
  - zona inexistente con conflicto da `not_found` (R14);
  - `sin_zona_central` gana a conflicto (design §4.2);
  - `listArbol` real: `zonas` con su única zona y `[]` sin zona, y `zonaId`/`zonaNombre` como siempre
    (R15, R16).

  *Hecho:* verde. M4 en rojo. Depende de B.5 y B.6.
- [x] **B.8 Árbol** (design §5). `zonas` en `DistritoArbolDTO` y en `listArbol`. Unitario con dobles
  `tests/unit/repositories/geo-repository-arbol-499.test.ts`: con dos zonas desordenadas salen ordenadas por
  nombre y `zonaId` es `null` (R15, R16).

  *Hecho:* verde. `[P]` con B.5.
- [x] **B.9 Reescribir los 4 tests** de design §7, con un comentario que cite la 499 en cada caso quitado.
  Confirmar que `tests/unit/utils/cobertura-distrito.test.ts` y `cobertura-vs-resolve-geo.test.ts` siguen
  verdes **sin cambios** en sus casos `varias_zonas` (R25).

  *Hecho:* los 4 archivos verdes aislados. `git diff` de los dos unitarios de cobertura vacío. Depende de
  B.1.
- [ ] **B.10 Gate.** `./init.sh --rapido` (se amplía con `tests/integration/db`). `INIT_EXIT=$?` dentro del
  log. Revisar el número de `skipped` (memoria «Gate sin `.env`»).

  *Hecho:* verde, con `skipped` igual que en `dev`. Commit y push. Depende de B.2-B.9.

## F: frontend_dev (después de B)

- [x] **F.1 Selector** (design §6.1). Prop `zonaPropiaId`; `bloqueado`; `disabled` en la casilla del
  distrito; `(zona: …)` sale de `d.zonas`; `provDistIds`/`cantDistIds` solo con seleccionables; la casilla
  del grupo deshabilitada si no tiene ninguno. Test `tests/components/GeografiaSelectorZonaUnica.test.tsx`:
  - al crear, el distrito con zona sale deshabilitado y con la etiqueta (R17);
  - al editar Z, los de Z se pueden marcar y desmarcar, y el de otra zona no (R17, R18);
  - el clic en un cantón mixto marca solo los seleccionables y no reporta el bloqueado en
    `onSelectedChange` (R19);
  - el estado del grupo con todos los seleccionables marcados es «marcado» aunque haya uno bloqueado, y un
    cantón todo bloqueado tiene la casilla deshabilitada (R20).

  *Hecho:* verde. M6 y M8 en rojo.
- [x] **F.2 Módulo** (design §6.2).
  - `abrirCrear` y `abrirEditar` leen el árbol. Si falla, toast y no abren.
  - La preselección sale de `d.zonas` sobre el árbol recién leído.
  - `zonaPropiaId` llega hasta el selector.

  Test `tests/components/ZonasTarifasDistritoUnico.test.tsx`, con las actions mockeadas:
  - fallo de `listarArbolGeografico` al crear y al editar: no se abre el formulario y sale el toast (R21);
  - guardar la zona A con el distrito d. El segundo `listarArbolGeografico` devuelve d en B. Abrir «Editar»
    de B **sin recargar** debe mostrar d marcado (R22).

  *Hecho:* verde. M7 en rojo. `[P]` con F.1.
- [x] **F.3 Mensajes** (design §6.4). La rama `distritoIds` en `mensajeDeError`, y el texto de `conflict` sin
  distritos. En `ZonasTarifasDistritoUnico.test.tsx`:
  - un `validation_error` con 3 mensajes pinta los 3 bajo el selector, y el toast lleva el primero con
    «(y 2 más).»;
  - con 1 mensaje, el toast es el mensaje tal cual (R23);
  - `conflict` da un toast sin la palabra «distrito» (R24).

  *Hecho:* verde. Depende de F.1 y F.2.
- [x] **F.4 Ver la app** (memoria «Ver la app encuentra lo que la suite no»). Con el dev server propio (sin
  levantar un segundo, memoria «Dos dev servers se pisan»):
  - crear la zona A con un distrito;
  - abrir «Crear» y ver ese distrito deshabilitado con «(zona: A)»;
  - editar A y ver el distrito marcado y editable;
  - forzar un conflicto (dos pestañas) y ver el aviso bajo el selector y el toast.

  Capturas en `progress/impl_499.md`. Dejar la base local como estaba (borrar las zonas de prueba).

  *Hecho:* las cuatro comprobaciones anotadas. Depende de F.3.
- [ ] **F.5 Gate.** `./init.sh --rapido`. *Hecho:* verde. Commit y push. Depende de F.1-F.4.

## R: revisión y salida

- [ ] **R.1 Trazabilidad.** `progress/impl_499.md` con la tabla R1-R25 → test concreto, las mutaciones
  M1-M8 → el test que las mata, y la forma medida en B.2. *Hecho:* el reviewer la valida sin huecos.
- [ ] **R.2 Pasos posteriores al despliegue** (design §8). No los corre esta ficha: se copian al checklist de
  la próxima release a `prod`, con la medición previa (conteos (a)/(b)) **antes** del despliegue y los
  puntos 1-5 **después**. *Hecho:* están en la nota de la release que prepare el leader.
