# 494 — Marca Velox Courier: identificadores internos · tasks

> Lee `requirements.md` y `design.md`. Cada **tanda** es un PR contra `dev` (`design.md §10`).
> `[P]` = paralelizable con las otras `[P]` del mismo bloque. Las tandas son secuenciales: se abre cada una desde el `dev`
> recién mergeado.
>
> **Toda tanda se cierra con:**
> 1. `./init.sh --rapido` verde con `INIT_EXIT=$?` escrito dentro del log, sin `tail` en segundo plano y mirando los `skipped`.
>    Nunca el completo: un rojo se repite aislado y, si pasa, se anota como intermitente.
> 2. A mano: `marca-sin-ordenex-494.guardia.test.ts` y `marca-fuente-unica-493.guardia.test.ts` (leen con `fs`; `--rapido` puede no correrlas).
> 3. El trinquete baja y no sube.
> 4. `progress/impl_494.md`: comandos, salidas y mapa `R<n>` → test.
> 5. PR, `gh pr checks` con el build de Vercel verde, y confirmar que el SHA está en `origin/dev` tras el merge.
>
> **Implementa:** `backend_dev` lo de `lib/`, `scripts/` y `db/`; `frontend_dev` lo de `app/`, `components/`, `hooks/` y `public/`, en
> worktree aislado. El script lo cruza todo: lo ejecuta quien lleve la tanda, sin dividirla.

## Bloque 0 — Puerta

- [x] **T0.1 — Respuestas.** P1–P4 respondidas o aceptado su valor por defecto. Si P1, P2 o P3 cambian, se ajusta la tabla de `design.md §3.1`
  antes de seguir. **Hecho:** anotado en `progress/impl_494.md`.
- [x] **T0.2 — Medición de prod (leader).** Correr Q1–Q5 de `design.md §4` con el MCP `supabase`, tras confirmar con `get_project_url`. **Hecho:** resultados
  en `progress/impl_494.md`, y la decisión de la tabla «Qué se hace según el número». Q1 ≠ 0: se para y se vuelve al spec. T0.2 no bloquea las tandas 0–4, pero **sí la 5**.
- [x] **T0.3 — Línea de base.** SHA de `origin/dev`, comprobar que 501 y 502 están mergeadas o decidido lo contrario, listando los archivos que toquen (`design.md §10`), y confirmar si `plantilla-sync-solo-estados.test.ts` ya cubre R27.
  Lista literal de rutas y campos de la OpenAPI para R6. **Hecho:** anotado.

## Tanda 0 — Red (sin renombrar nada)

- [x] **T1.1 — Detector y guardia.** Depende de T0.3. `tests/fixtures/marca-sin-ordenex-494.ts` y `tests/unit/guards/marca-sin-ordenex-494.guardia.test.ts`, con los bloques de `design.md §7` y sus contrapruebas: código, cadena, comentario y nombre de archivo salen con hallazgo; una excepción muerta sale roja. **Hecho:** contrapruebas verdes; quitar `/i` del detector pone rojo (anotado y restaurado).
- [x] **T1.2 — Trinquete.** `tests/fixtures/marca-pendientes-494.ts`, generado por el detector con el recuento por archivo. **Hecho:** guardia verde; añadir «ordenex» a un archivo limpio y una aparición a uno pendiente la pone roja (anotado y restaurado).
- [x] **T1.3 — Censo.** `progress/censo_marca_494.md` emitido por el detector, y clasificados los `empresa` ya existentes (`design.md §3.1`: 9 en `cierre-factura.tsx`). **Hecho:** sin colisión con la tabla, o se vuelve al spec.
- [x] **T1.4 — Script.** `scripts/marca-494-renombrar.mjs`: tabla por familias, palabra completa, sensible a mayúsculas, listas de rutas, aborta si el destino existe, `--familia`, `--comprobar` sin escribir. **Hecho:** ejecutarlo dos veces no produce diff en la segunda; no toca `db/migrations`, `specs`, `progress`. Se corre en un worktree de prueba y se descarta.

## Tanda 1 — Navegador y service worker

- [x] **T2.1 — Módulo.** Depende de T1.1. `lib/navegador/claves-legadas.ts` con `leerConMigracion` (`design.md §5.2`). **Hecho:** R14, R15, R19 verdes en `tests/unit/navegador/migrar-clave-494.test.ts`; la clave vieja, literal en el test.
- [x] **T2.2 — Preferencias.** Depende de T2.1. Sonido, navegación, columnas de manifiesto y de descarga, y `sessionStorage` de SINPE pasan por el módulo. Eventos de ventana renombrados. Reescribir los comentarios de `lib/manifiesto/preferencia-columnas.ts:9-12` y `lib/columnas/preferencia-columnas.ts:66-68`. **Hecho:** R14, R18 verdes; `tests/unit/hooks/useTonoAlIncrementar.test.tsx` y `tests/components/OrdenesDescargaColumnas.test.tsx` migrados; con preferencia vieja sembrada, se aplica.
- [x] **T2.3 — Cookie de tema.** Depende de T2.1. Servidor lee nueva o vieja; al montar en el cliente, migra. **Hecho:** R17 verde; `tema-encendido.guardia` migrada; confirmado en el archivo el punto de montaje.
- [x] **T2.4 — Service worker.** `public/sw.js` y `lib/pwa/actualizacion.ts`: nombres nuevos y alias de lectura; `hooks/usePushEnVentana.ts` acepta los dos; tag nuevo. **Hecho:** R21, R22, R23 verdes; enviar al SW el mensaje viejo dispara `skipWaiting`, y `ordenex:cualquier-otra-cosa` sigue sin hacer nada. **Mutación:** quitar el alias de relevo pone rojo `pwa-relevo-y-purga.guardia` (anotado y restaurado).
- [x] **T2.5 — Legado.** Bloque R20 activo y E5 con sus rutas reales. **Hecho:** un `setItem` sintético con clave vieja sale rojo.

## Tanda 2 — Familia cierres

- [x] **T3.1 — Script.** Depende de tanda 1 mergeada. `--familia cierres` + `git mv` de `lib/utils/ingreso-ordenex.ts` y su test. **Hecho:** `tsc` limpio. Sin ediciones a mano salvo las listadas en `progress/impl_494.md`.
- [x] **T3.2 — Sin polizones.** Lo que `tsc` no vea: `vi.mock("…ingreso-ordenex")`, cadenas de guardias que leen rutas, fuentes que un test parsea. **Hecho:** cero rutas viejas (`grep ingreso-ordenex` vacío fuera de lo pendiente en comentarios).
- [x] **T3.3 — Guardias estructurales de cierres.** Correr a mano las que lean `lib/` con `fs` y citen estos nombres. **Hecho:** verdes y anotadas.
- [x] **T3.4 — Importes intactos.** `git diff origin/dev...HEAD -U0` filtrado por líneas con un número: ninguna cambia de valor. **Hecho:** comprobación anotada; R4 verde con `ingreso-empresa.test.ts` y `aporte-por-orden.test.ts`.

## Tanda 3 — Familia caja

- [x] **T4.1 — Script.** Depende de tanda 2 mergeada. `--familia caja`. **Hecho:** `tsc` limpio.
- [x] **T4.2 — Valores.** `solo_empresa`, `empresa_debe`, `gasto_empresa`, `tienda_paga_a_empresa`, `concepto_empresa`, `"empresa"` de `A_QUIEN_POR_ORIGEN`. **Hecho:** R7 y R8 verdes; etiquetas literales iguales a las de antes; `tests/fixtures/estado-cuenta.ts` migrado.
- [x] **T4.3 — Ver la app.** Caja, estado de cuenta de tienda y mi wallet con Playwright, y un movimiento en el registro (`gasto`, `tienda paga`). **Hecho:** mismas frases y cifras; capturas referidas en `impl_494.md`; base local limpia al terminar (memoria «Ver la app ensucia la base local»).

## Tanda 4 — Familia analítica

- [x] **T5.1 — Script.** Depende de tanda 3 mergeada y de T2.1. `--familia analitica`. **Hecho:** `tsc` limpio; R5 verde con el id literal.
- [x] **T5.2 — Caché.** Prefijo nuevo en `claveDeConteoProductos`; revisar los otros 11 usos de `envolver`. **Hecho:** R9 verde, y la revisión anotada.
- [x] **T5.3 — Columna guardada.** `traducir` del ámbito `analitica-productos-dinero` (`design.md §5.3`), al leer la clave vieja **y también sobre lo ya guardado bajo `app:`, sin condición**. **Por qué sin condición:** la tanda 1 deja el valor bajo `app:` con el nombre viejo de la columna dentro; una release antes de esta tarea lo lleva a los navegadores, y sin esa traducción la columna oculta reaparece. **Hecho:** R16 verde con los dos casos, clave vieja y clave `app:`. `tests/unit/navegador/preferencias-494.test.tsx` sale rojo a propósito al renombrar la columna, hasta sustituirlo por R16. **Mutación:** sin `traducir` en cualquiera de los dos caminos, la columna oculta reaparece y el test sale rojo (anotado y restaurado).
- [x] **T5.4 — Contrato.** `tests/unit/api/contrato-sin-cambios-494.test.ts`. **Hecho:** R6 verde; `docs/api/**` sin cambio de campos.
- [x] **T5.5 — Ver la app.** Tablero financiero y productos con dinero, y descarga de CSV. **Hecho:** encabezado «Cobró Velox …», misma posición de columna, cifra de ganancia igual.

## Tanda 5 — Filas (condicional)

- [x] **T6.0 — Decisión.** Medido en T0.2: `filas_con_valor` = 0. Sin migración; R10 no aplica. Depende de T0.2. Con `filas_con_valor` = 0 en columnas leídas, se anota «sin migración» y se saltan T6.1–T6.3. **Hecho:** anotado; R10 no aplica.
- [x] **T6.1 — Migración.** No aplica (T6.0). Solo si T6.0 la pide. `migration.sql` + `down.sql`, con respaldo, y timestamp posterior al último de `dev`. **Hecho:** aplicada y revertida en un clon.
- [x] **T6.2 — Declarada.** No aplica (T6.0). Solo si T6.1. Entrada en `posteriores` de `tests/integration/db/orden-traspaso-migration.test.ts`. **Hecho:** R12 verde.
- [x] **T6.3 — Prueba.** No aplica (T6.0). Solo si T6.1. `tests/integration/db/marca-494-backfill.test.ts` contra Postgres, con su mutación; volver a medir el `SELECT` en prod antes de desplegar. **Hecho:** R10 verde; número anotado.

## Tanda 6 — Configuración, scripts, docs, esquema

- [x] **T7.1 — Scripts.** [P] Tratar `scripts/`: E4 se queda (lista exacta de archivos, también sus tests); `seed-maestro.ts` con ejemplo y nombre por defecto nuevos; `generate-pwa-icons.mjs`, `backfill-analitica.ts` limpios. **Hecho:** E4 con rutas reales, y bloque de excepciones verde.
- [x] **T7.2 — Siembra QA.** [P] `scripts/seed-usuarios-qa.ts` pasa la cuenta al correo nuevo (P3). **Hecho:** R29 verde con dos corridas; ejecutada en local; preview, anotado para el leader. Prod: no.
- [x] **T7.3 — Postman.** [P] Renombrar colección y `name`; `openapi-320` y `openapi-266`; línea en `CHANGELOG.md`, sin ruptura. **Hecho:** R31 verde.
- [x] **T7.4 — Docs y entorno.** [P] `.env.example`, `DESIGN.md`, `.claude/commands/test_jobs.md`, y las filas B2 y B4 de `docs/release.md`. Además, en `docs/release.md`, el paso de `design.md §3.2` para esta release: medir Skew Protection y si `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` está fijada en producción (comparar ids entre previews no predice la release: la sal caduca a los 14 días y va ligada a la caché de build); si no hay ninguna de las dos, desplegar fuera de la operación y avisar de que recarguen. **Hecho:** R32 verde y ese paso escrito. El título de `CLAUDE.md`, lo aplica el leader.
- [x] **T7.5 — Comentarios del esquema.** [P] `db/schema.prisma`, solo comentarios. **Hecho:** `prisma migrate diff` sin diferencias, salida anotada; `prisma generate` sin cambio de tipos; R13 verde.
- [x] **T7.6 — Paquete.** `package.json`, commit propio y al final de la tanda. **Hecho:** R31 verde. Si `--rapido` pide el completo, parar: lo decide el leader, ningún subagente lo corre.

## Tanda 7 — Comentarios, datos de prueba y cierre de guardia

Va la última y se abre con todo lo anterior mergeado. Conflicto: descartar y regenerar.

- [x] **T8.1 — Pasada.** Depende de tandas 1–6 mergeadas. Script `--familia comentarios` y datos de prueba (`design.md §3.4`, `§3.5`). **Hecho:** `tsc` y lint limpios, y `git diff` sin cambio de código fuera de comentarios y datos de prueba, comprobado quitando comentarios de ambos lados con el quitador existente.
- [x] **T8.2 — Cierre.** Depende de T8.1. Borrar `tests/fixtures/marca-pendientes-494.ts` y `scripts/marca-494-renombrar.mjs`, y quitar el trinquete de `WHITELIST_FILES` de la guardia de la feature 28 (el value retirado por el rename a `fulfillment`; no se escribe aquí su nombre porque esa guardia también lee `specs/`, y nadie avisa si la entrada se queda: esa lista no detecta entradas muertas), de `PROPIOS` en `tests/fixtures/marca-retirada-493.ts` y la entrada E9 de la guardia; dejar el bloque «árbol» como `it` llano; retirar `EXCEPCIONES_R11`, `quitarIdentificadores` y `POSTMAN` de la guardia de la 493 y actualizar sus contrapruebas; ajustar `CLAUDE.md` si P1 cambió algo. Comprobar contra `origin/dev` que la ficha no tocó `next.config.*`, `vercel.json`, `proxy.ts` ni `middleware.ts`. **Hecho:** R1, R2, R3, R28 verdes; censo final en `progress/censo_marca_494.md` con solo E1–E8.
- [x] **T8.3 — Comprobación de lo que no ve la suite.** Depende de T8.2. En preview o en local: con cookie y claves viejas sembradas a mano, se conservan tema, sonido y columnas tras cargar; con PWA de la versión anterior, «actualizar» releva. **Hecho:** anotado con capturas; lo no medible en local queda escrito como pendiente del despliegue.
- [x] **T8.4 — Mutaciones.** Una por tanda: revertir un identificador, una clave y un valor a la versión vieja, y comprobar que la guardia sale roja. **Hecho:** anotadas, restauradas y con autocomprobación (memoria «Arnés de mutaciones que miente»).
- [x] **T8.5 — Revisión.** `reviewer`, con el informe commiteado. **Hecho:** todos los `R<n>` con test, y R10, R25, R29 explícitos.

## Tanda 8 — Plantillas en Meta (no bloquea el merge)

> **NO SE HACE (decisión del humano, 2026-11-05).** Las plantillas conservan su nombre: quien recibe el mensaje no lo ve, el cuerpo no lleva la marca y los dos informes se entregan a diario. Se retoma solo si el humano lo pide.

- [ ] **T9.1 — Crear (humano).** Tras la release. Pasos 1–2 de `design.md §8`, con el token de la cuenta de José. **Hecho:** ids anotados; templates en `PENDING`.
- [ ] **T9.2 — Esperar `APPROVED`.** Plazo de Meta, desconocido. **Hecho:** `GET` con `APPROVED` anotado. Mientras, nada cambia en la app (R26).
- [ ] **T9.3 — Cambiar el nombre en prod (autorización del humano).** Paso 4. **Hecho:** Q3 sin filas con la marca en `nombre`; hora anotada, y un informe de cada tipo entregado (paso 5).
- [ ] **T9.4 — Borrar las viejas.** Paso 6, cuando Q4 no tenga ejecuciones en curso. **Hecho:** anotado. La ficha se puede cerrar con T9 pendiente, dejándolo en `status_note` y en `progress/current.md`.

## Al cerrar

- [ ] **T10.1 — Ficha de retirada.** El leader registra la de `design.md §5.6` (mínimo 90 días en prod), previo borrador al humano.
- [ ] **T10.2 — Índice y memoria.** Reindexar `R-job-singularis-projects-ordenex` y actualizar la receta de acceso QA y la memoria de cuentas.
- [x] **T10.3 — Portar.** No se porta: `servi_logistic` trabaja aparte (humano, 2026-11-05).

## Dependencias

```
T0.* → Tanda 0 → Tanda 1 → Tanda 2 → Tanda 3 → Tanda 4 → Tanda 5 (T0.2) → Tanda 6 → Tanda 7 → release → Tanda 8
```
