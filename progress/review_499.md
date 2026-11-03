# Revisión — ficha 499 «Un distrito en una sola zona» (hotfix H4 portado)

- **Rama:** `fix/499-distrito-una-sola-zona`, worktree `wt-499`, HEAD revisado `46c79fbc` (merge de
  `origin/dev` sobre `b535a6aa`). `origin/dev` va 1 commit por delante (`ee225392`, solo
  `feature_list.json`); el merge es limpio (`git merge-tree`).
- **Material:** `specs/499-distrito-una-sola-zona/{requirements,design,tasks}.md`,
  `progress/impl_499_backend.md`, `progress/impl_499_frontend.md`, `progress/gate_499_2.log`,
  `CHECKPOINTS.md`, `docs/release.md` §E.
- **Búsqueda de código:** MCP `codebase-memory` (`R-job-singularis-projects-ordenex`); `trace_path`
  no resolvió `ZonaRepository.create`, así que los llamadores y los escritores de `zona_distrito`
  se buscaron con `grep` en `lib/`, `app/` y `scripts/`, confirmados en el archivo real.

## Veredicto: **APROBADO** (sin bloqueantes; 6 menores)

## Verificación ejecutada por el reviewer

- Gate del leader sobre este HEAD: `progress/gate_499_2.log` (22:19, posterior al commit de 22:02)
  → **`INIT_EXIT=0`**, modo rápido AMPLIADO. Relacionados 701 archivos / 9054 verdes / 26 skipped
  (los mismos 26 que anotan las dos bitácoras); guardias 280 / 3859 / 0 skipped;
  `tests/integration/db` 458+2 archivos, los 2 rojos (`gestiones-detalle-api-405`,
  `orden-nota-migration`) verdes aislados → intermitentes, ninguno de esta ficha.
- Corrido por mí, aislado (sin `./init.sh`): `GeografiaSelectorZonaUnica`, `ZonasTarifasDistritoUnico`,
  `geo-repository-arbol-499`, `prisma-unique-distrito`, `zona-service-499`, `zona-repository`,
  `cobertura-distrito`, `zona-distrito-unico-499`, `zona-distrito-499-migration`,
  `zona-reconciliacion-ordenes`, `ZonaCentralConfirmacion`, `ZonaNombreNoImprimible`:
  **12 archivos, 166 tests verdes, 0 skipped, EXIT=0** (la integración corrió contra Postgres).
- `git diff origin/dev...HEAD` de `tests/unit/utils/cobertura-distrito.test.ts`,
  `cobertura-vs-resolve-geo.test.ts` y `lib/utils/cobertura-distrito.ts`: vacío (R25). Ningún archivo
  borrado. `db/migrations`: solo las dos carpetas nuevas.

## Checklist

### Especificación
- [x] `requirements.md` con R1–R25 en EARS.
- [x] `design.md` con alternativas descartadas (§10).
- [ ] `tasks.md` todo `[x]`: **faltan B.10 y F.5** (el gate existe y está verde, ver m1), y R.1/R.2,
  que son del reviewer (esta revisión cierra R.1) y del leader (nota de release).

### Trazabilidad (R → test con aserción real)
| Req | Test | Valoración |
|---|---|---|
| R1 | `zona-distrito-499-migration` «R1…» | insert a pelo con el índice → error con el nombre, 1 fila. OK |
| R2, R3, R4 | idem «R2/R3/R4…» | (a), (b1), (b2) y control; borradas == respaldo columna a columna; 6 exactas. OK |
| R5 | idem «R5…» | antes == después, respaldo `[]`. OK |
| R6 | idem «R6…» | huella md5 de 5 tablas + anti-vacuidad (6 borradas). OK |
| R7 | idem «R7…» | `UP_2` sobre duplicado falla, índice ausente. OK |
| R8 | idem, dos casos «R8…» | up/down/up idéntico; el down no devuelve filas de zona borrada; un esquema con otra tabla no se borra. OK |
| R9 | `zona-distrito-unico-499` «R9…» + B.0 (i) | la central previa conserva la marca; Δ zona/N:M/tarifas/historial = 0. OK |
| R10 | idem «R10…» + B.0 (ii) | foto de Y igual, `orden.zona_id` intacta, historial 0, con un control que SÍ reconcilia. OK (ver m3) |
| R11 | idem «R11…» (service real, crear y actualizar) + `zona-service-499` | literales esperados, «Ábaco» antes que «Zeta». OK |
| R12 | idem «R12…» | iguales / menos / + libre → `ok`×3 y N:M final exacta. OK |
| R13 | idem «R13…» (carrera real, dos conexiones, espera por `pg_stat_activity`) + `zona-service-499` + `prisma-unique-distrito` | `conflictos: null`, foto igual, historial 0. OK para `update` (ver m2 para `create`) |
| R14 | idem «R14…» | `not_found`. OK |
| R15, R16 | `geo-repository-arbol-499` (dobles: 2+ zonas ordenadas y colapso a null) + «R15/R16: listArbol real» | OK |
| R17–R20 | `GeografiaSelectorZonaUnica` (8) | disabled, etiqueta, cascada solo de seleccionables, estado de grupo, grupo vacío deshabilitado. Rojo antes: 7/8. OK |
| R21–R24 | `ZonasTarifasDistritoUnico` (9) | lectura fallida no abre + toast; preselección por `d.zonas` tras guardar sin recargar; 3 mensajes + «(y 2 más).»; `conflict` sin «distrito». Rojo antes: 9/9. OK |
| R25 | `cobertura-distrito.test.ts` / `cobertura-vs-resolve-geo.test.ts` sin cambios | OK |

- [x] Cada R1–R25 mapea a un test con aserción concreta; ninguno vacío. Los textos de UI se comparan
  contra literales, no contra la función que los genera.
- [x] Regresión roja antes del arreglo: B.0 2/2 rojos en `dev` (backend); 7/8 y 9/9 (frontend).
- [x] Mutaciones M1–M8 creíbles: cada una nombra el test y el mecanismo que la mata, y casan con lo
  que leo en los tests (M3: el callback devuelve sin lanzar → la marca se pierde y `centralSigue`
  sale `false`; M2: los propios dan conflicto en R12; M7 solo la mata el caso de dos zonas, y la
  bitácora lo explica). Extras útiles (DELETE por `distrito_id`, down sin `EXISTS`, sort por código).
- [~] El mapa R → test está, pero repartido en `impl_499_backend.md` + `impl_499_frontend.md`
  (el spec y CHECKPOINTS citan `impl_499.md`): menor m6.

### Repositorio (punto 2 del encargo)
- [x] `create`: `leerConflictos` es la primera sentencia del callback, antes de leer y apagar la
  central previa. Con conflicto devuelve sin escribir.
- [x] `update`: tras `findUnique` (not_found) y el corte `sin_zona_central`, que no escriben; antes de
  `updateMany`, `zona.update`, N:M, tarifas, reconciliación e historial.
- [x] El filtro `NOT zonaId` va en el `WHERE` (Prisma), probado contra Postgres (R12).
- [x] Red final: `esViolacionDistritoUnico` por **nombre** del índice, en P2002 (forma medida en B.2)
  y en la forma del driver (`code`/`originalCode` 23505); el índice del par no da falso positivo
  (unitario). En los dos `catch`, antes de `translateEsCentralConflict`; devuelve
  `conflictos: null`, nunca relanza. Probado contra Postgres en `update`.
- [x] Único llamador de `create`/`update` del repo: `ZonaService` (vía `lib/actions/zonas.ts`); `tsc` verde.

### Migraciones (punto 3)
- [x] `20261102130000_*`: esquema + tabla `respaldo.zona_distrito_499` (TEXT, PK id, `respaldado_at`),
  RLS activada sin políticas, REVOKE a PUBLIC y a `anon`/`authenticated` solo si existen;
  ventana (a)/(b) idéntica al design; `INSERT … ON CONFLICT DO NOTHING`; `DELETE … USING respaldo`
  por ids. No toca órdenes ni otras tablas (R6 medido).
- [x] `20261102130100_*`: solo el `CREATE UNIQUE INDEX "zona_distrito_distrito_id_key"`; aborta si
  quedan duplicados (R7).
- [x] `down.sql`: 130100 `DROP INDEX IF EXISTS`; 130000 restaura solo lo que tenga zona y distrito
  vivos, `DROP TABLE` solo de su tabla, `DROP SCHEMA` solo si queda vacío. Cabecera con el orden.
- [x] `schema.prisma`: `@@unique([distritoId])` añadido; el par y el `@@index` se quedan (design §2.1).
- [~] `db:rollback` (CHECKPOINTS «el script funciona»): ver m4. **No afecta a nada más que a la
  operativa de reversión**: el script solo revierte el último directorio, y eso ya está documentado
  como limitación general en `docs/release.md` §E.2–E.3, que prescribe revertir cadenas a mano. Si
  alguien lo corre una vez, quita solo el índice; el código sigue funcionando (la lectura de
  conflictos sigue en pie) y la limpieza queda aplicada, que es un estado seguro.

### Tests reescritos (punto 4)
- [x] `cobertura-repository`, `geografia-catalogo-activo`, `corregir-datos-cliente.repo`: quitan solo el
  caso de dos zonas, con comentario 499 y la referencia al unitario que lo cubre; el resto de
  aserciones intacto.
- [x] `zona-reconciliacion-ordenes`: R3 ambiguo quitado; los tres casos de la 377 (`R2/R6`, `R3`,
  `R1`) reescritos para que el guardado de B sea el que reconcilia: mismo corte medido, mismas
  aserciones.
- [x] **R5 (unión) y R11 (lote compartido por dos zonas) solo con dobles: aceptable, no es un hueco
  real.** Con el índice, un único guardado ya no puede producir dos zonas resueltas: los distritos
  quitados de la zona quedan sin zona y resuelven `null`, que no mueve nada. La unión y el lote de
  dos grupos son ramas que la base ya no puede ejercer; las siguen fijando
  `zona-repository.test.ts` «R5: la segunda lectura de la N:M cubre la UNION» (aserción sobre el
  `where.distritoId.in`) y «R10/R11: … el MISMO `lote_id` aunque haya 2 grupos». El caso de
  integración renombrado («el quitado queda sin zona y no mueve nada») ya no distingue la unión de
  «solo los finales»: es esperable y queda dicho en su comentario.

### UI (punto 5)
- [x] Selector: `disabled` en la casilla del distrito con zona ajena; etiqueta desde `d.zonas` (solo
  las ajenas); `provDistIds`/`cantDistIds` solo seleccionables; casilla de grupo `disabled` si queda
  vacía.
- [x] Crear/Editar leen el árbol al abrir (`leerArbol`), toast y no abren si falla; la preselección
  usa `d.zonas.some` sobre el árbol recién leído, no el estado.
- [x] **Desvío del design §6.2** (`zonaPropiaId` derivado en `CrearZonaForm` de `initial?.zonaId`
  en vez de pasarlo el módulo): **equivalente**. El design fija el mismo valor
  (`initial?.zonaId ?? null`); el módulo pone `zonaId: full.id` en `formInitial` al editar y
  `undefined` al crear; `CrearZonaForm` es el único que monta `GeografiaSelector` y solo lo monta
  `ZonasTarifasModule`. El prop es obligatorio en el selector: un llamador nuevo no puede olvidarlo
  sin que `tsc` lo pare.
- [x] F.4 «ver la app» con Playwright y base local: cuatro comprobaciones con texto leído; base
  devuelta a sus conteos.

### Tests ajenos modificados (punto 6)
- [x] `ZonaCentralConfirmacion` y `ZonaNombreNoImprimible`: el «otro campo» pasa de `distritoIds` a
  `tarifas`; lo que miden (el genérico no desaparece para un campo no reenviado) no cambia.
- [x] `ZonaDistritoEspecial`, `CrearZonaFormReconciliacion` y las fixtures de 11 tests: solo ganan
  `zonas` coherente con su `zonaId`.
- [x] `zonas-action`, `zona-service`, `nombres-que-imprime-la-etiqueta`: el doble de `create`
  envuelto en `{estado:"ok"}`. Los 4 de `integration/db` usan `zonaCreada()`, que falla ruidoso si
  no es `ok`.
- [x] `zona-repository.test.ts`: dobles con la lectura nueva; «366/T4 create no reconcilia» pasa de
  `not.toHaveBeenCalled` a «exactamente 1 llamada y es la de conflictos»: sigue matando una lectura
  de reconciliación en `create`.
- [x] `orden-traspaso-migration`: censo de la 427 con las dos migraciones (arreglo del rojo del gate 1).
- [x] Nada borrado ni debilitado; sin aserciones contra su propia fuente.

### Calidad, datos y seguridad
- [x] Tabla nueva `respaldo.zona_distrito_499` con RLS activada. Limitación aceptada por el humano:
  no es inaccesible para el rol de la app (design §2.4), sin test por decisión.
- [x] Sin secretos, sin hardcode de país/moneda/cuenta; sin webhooks.
- [x] Capas: el repositorio solo consulta y escribe; el service traduce y ordena los mensajes; la UI
  no importa la constante de servidor.
- [x] typecheck y lint verdes (gate).
- [n/a] E2E: no hay arnés (memoria «Nada de E2E»); el riesgo lo cubren la integración contra
  Postgres, los componentes y la verificación F.4 en navegador.
- [ ] `progress/history.md`: lo añade el leader al cerrar.

## Hallazgos

Ninguno **BLOQUEANTE**.

- **m1 (menor): `tasks.md` con B.10 y F.5 sin `[x]`.** El gate sobre el HEAD revisado existe y está
  verde (`gate_499_2.log`, `INIT_EXIT=0`). Falta solo marcarlas (lo puede hacer el leader al
  cerrar). R.2 (pasos de design §8 en la nota de la release, con la medición (a)/(b) **antes** del
  despliegue) sigue pendiente y es del leader.
- **m2 (menor): la red final de `create` no tiene test.** La carrera real de R13 ejercita solo el
  `catch` de `update`; `zona-service-499` usa un doble del repositorio y `prisma-unique-distrito`
  prueba solo el detector. Quitar `esViolacionDistritoUnico` **solo** del `catch` de `create`
  sobrevive a la suite. El código es simétrico y el detector está probado, así que el riesgo es
  bajo; se arregla con un unitario de `zona-repository.test.ts` donde `createMany` rechace con la
  forma medida en B.2 y `create` devuelva `{ estado: "distrito_en_otra_zona", conflictos: null }`.
- **m3 (menor): R10 «ni la marca» no prueba la central AJENA en `update`.** El caso arranca con
  `sinCentrales`, así que mover `leerConflictos` detrás del `updateMany` de la central dentro de
  `update` (el M3 de `update`) no pondría nada rojo. Hoy el orden es correcto (verificado en el
  código); falta solo la red. Basta con sembrar una central previa en el caso R10 y afirmar que la
  conserva.
- **m4 (menor): `pnpm run db:rollback` no revierte la ficha entera.** Limitación general del script
  (solo el último directorio), ya documentada en `docs/release.md` §E.2–E.3 con el procedimiento
  manual. No afecta al funcionamiento de la app ni a las migraciones; solo a la operativa de
  reversión.
- **m5 (menor, fuera de alcance): `scripts/seed-zonas.ts:522` hace `upsert` por el PAR
  `(zonaId, distritoId)`.** Con el índice nuevo, si la planilla asigna un distrito a dos zonas o la
  base ya lo tiene en otra, el seed local aborta con P2002 en vez de duplicar en silencio. No lo
  medí contra los xlsx de `public/`; los 3 duplicados que la base local tenía antes de migrar
  pueden venir de ahí. Solo afecta al sembrado local; conviene una ficha o una nota en la memoria
  «Sembrar zonas en local».
- **m6 (menor): documentación.** (a) El mapa R → test está repartido en dos bitácoras, y el spec y
  CHECKPOINTS citan `progress/impl_499.md`. (b) Desde R23, el texto técnico de `prepararDatos`
  «uno o mas distritoIds no existen» llega también al toast (antes solo bajo el selector); solo pasa
  si un distrito se borra con el formulario abierto. Ya anotado por el frontend como abierto:
  candidato a una ficha de textos.

## Para cerrar (leader)
1. Marcar B.10/F.5 en `tasks.md`; copiar design §8 (con la medición previa (a)/(b)) a la nota de la
   próxima release a `prod` (R.2).
2. m2 y m3 son redes baratas: pueden ir en esta rama antes del merge o en una ficha de seguimiento,
   sin bloquear.
3. Entrada en `progress/history.md`.
