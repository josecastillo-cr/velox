# Revisión 494, tanda 3 (familia caja)

Rama `feat/494-t3-caja`, HEAD revisado `e0f055fdb`, base `cb023c5a`. Revisado el 2026-11-04.

El MCP `codebase-memory` no conectó en esta sesión (connection timed out): todo se midió con `git grep` y leyendo archivos.

**Veredicto: OK con menores.** Sin bloqueantes para mergear a `dev`. El cruce de versiones (m1) hay que decidirlo y anotarlo antes de la release a `prod`. No frena este PR, porque esta tanda no llega a `prod` hasta terminar la tanda 7.

## Checklist

| Punto | Resultado | Cómo se comprobó |
| --- | --- | --- |
| Tareas T4.1 a T4.3 marcadas | Pasa | `tasks.md:51-53` |
| Script idempotente | Pasa | `--familia caja --comprobar`: 0 a mover, 0 a reescribir |
| Diff de producción solo renombra | Pasa | 24 archivos, 81 líneas por 81, leído entero |
| Valores viejos fuera de su sitio | Pasa | `git grep`: solo en el script, E7 y las contrapruebas |
| Sin persistencia, API, caché ni URL | Pasa | Ver «Valores» |
| Ramas de dinero | Pasa | Ver «Dinero» |
| Trazabilidad R4, R7, R8 | Pasa, con m3 | Ver «Tests» y «Trazabilidad» |
| Guardias de marca, R7, guardias de caja y R36, aislados | Pasa | 6 archivos: 117 verdes, 3 `todo`, 0 rojos |
| Fin de línea | Pasa | 77 archivos `i/lf w/lf`; `git diff --check` sin salida |
| Tabla nueva, migración, webhook, secreto | No aplica | El diff no toca `db/` ni `app/api` |
| Repo público | Pasa, con m5 | Ver «Repo público» |
| `./init.sh --rapido` | No repetido, por orden del leader | Él informa `INIT_EXIT=0` |
| E2E de `CHECKPOINTS.md` | No aplica | Sin harness (decisión del humano); T4.3 cubre esta parte |

Los checkpoints de cierre de ficha (`progress/history.md`, todas las tareas, `./init.sh` completo) son de la T8.5, no de esta tanda.

## Valores

Coincide con `impl_494.md`: ninguno se persiste ni sale por contrato. Sin aparición en `db/`, `docs/`, `scripts/` (salvo el script de renombrado), `public/`, `e2e/`, `app/api` ni `lib/api`.

- **Caché:** ni `lib/cache`, ni `lib/jobs`, ni `lib/analytics` nombran `modoComposicion`, `deEmpresa` o `sentidoDe`. Las dos apariciones en `lib/repositories` son comentarios que citan `derivarCaja`.
- **Navegador:** sin `localStorage`, `sessionStorage`, parámetros de URL ni `router.push` en `WalletModule`, `CajaResumenCard`, `EstadoCuenta`, `TarjetasEstadoCuenta` y `AsiQueda`. El único `JSON.stringify` compara `aQuien` de los filtros, que no lleva valores renombrados.
- **Escritura:** `EstadoCuentaService` y `LibroCajaAutoriaService` no escriben historial. `lib/actions/efecto-movimiento.ts` no revalida ni escribe.
- **Prod:** T0.2 dio 0 filas en los seis valores de la ficha. `deEmpresa` y `esEmpresa` no entraron en esa medición, pero por código no tienen camino de escritura.

## Dinero

Ningún literal quedó con el valor viejo, ni hay comparación entre un valor renombrado y otro sin renombrar.

- **`A_QUIEN_POR_ORIGEN`** (`lib/repositories/libro-caja-a-quien-sql.ts:114`): `Record` total. `"empresa"` solo pasa por `typeof ramas === "string"` (línea 144), y `ORIGENES_CON_ANOTACION` compara con `"anotacion"`. Ningún código compara con `"empresa"`.
- **`CajaResumenCard` y barra:** los cinco `Record<ModoComposicionCaja, X>` (cuatro de segmentos, uno de superficie) y `CAJA_COMPOSICION_MENSAJE` tienen los cuatro modos. Son totales, así que los protege `tsc`.
- **Estado de cuenta:** `sentido` solo lo leen las dos frases. `sentidoDe` (`EstadoCuentaService.ts:653-654`) y `fraseDelSaldo` coinciden. La rama de bodega no compara `empresa_debe`: pinta «entregó de más» por descarte.
- **Tope del abono** (`lib/utils/efecto-movimiento.ts:108`): renombrado, y su mutación cae.
- **`concepto_empresa`:** las lecturas (`DetalleEnLoteService.ts:290`, `aporte-por-orden.ts:390`) y las dos tablas de fuentes coinciden.

## Tests

`efecto-movimiento-494.test.ts` no compara contra su propia fuente: el catálogo y `CONCEPTO_REGISTRO_DE` van literales, y el concepto viejo sale de un fixture literal. Los importes de R8 también son literales. `NOMBRE_ESPERADO` es el literal `"Velox Courier"`, en un fixture aparte de `MARCA`. Algunos `toBe(CAJA_COMPOSICION_MENSAJE.x)` sí miran su fuente, pero `CajaComposicionBarra.test.tsx:435` fija esos mismos textos con un `toEqual` literal.

Mutaciones propias, distintas de las del implementador en lo posible. El arnés aborta si el archivo no cambia o si corren 0 tests, y compara el SHA al restaurar. Base restaurada: 122 tests, 0 rojos. Árbol limpio al terminar.

| Mutación | Tests | Rojos | Resultado |
| --- | --- | --- | --- |
| R7: el catálogo vuelve a `gasto_ordenex` | 9 | 4 | Cazada |
| El tope del abono compara con el valor viejo | 15 | 1 | Cazada |
| El servicio de autoría devuelve la clave vieja, contra Postgres | 7 | 1 | Cazada |
| `libro-caja-labels` lee la clave vieja | 37 | 1 | Cazada |
| `claveDeFuente` compara con el valor viejo | 29 | 2 | Cazada |
| `criterioDeFuente` compara con el valor viejo, con tests de servicio | 44 | 13 | Cazada |
| Una fila de `FUENTE_CAJA` con el valor viejo (`ingreso_comision_cod`) | 39 | 2 | Cazada |
| La frase de admin compara con el valor viejo | 20 | 2 | Cazada |
| `data-bolsillo` con el valor viejo | 49 | 8 | Cazada |
| El nombre accesible cruza el importe de un bolsillo | 49 | 2 | Cazada |
| El DTO devuelve la clave vieja | 84 | 6 | Cazada |
| **`DetalleMovimientoPanel` lee la clave vieja** | 49 + 125 | 0 | **Sobrevive (m3)** |
| `sentidoDe` de bodega con el valor viejo | 33 | 0 | Sobrevive; sin efecto, esa rama no lo compara |
| `aporte_capital` con el valor viejo | 7 | 0 | Sobrevive; sin efecto, solo importa que sea cadena, y lo cubre el tipo |

`criterioDeFuente` sobrevivió con solo `aporte-por-orden.test.ts` y cae con los tests de servicio. Las tablas de mutaciones de `impl_494.md` no se repitieron enteras: se repitieron dos (R7 y el tope) con el mismo resultado de cazada.

## Cruce de versiones

### Leído en `node_modules/next` 16.2.10

**Navegación RSC: la respuesta nueva no llega a la pestaña vieja.**

- `router-reducer/fetch-server-response.js:127`: si el id de build no coincide, hace `doMpaNavigation`, una carga completa.
- `segment-cache/cache.js` hace la misma comprobación en los prefetch (líneas 994, 1034, 1136, 1206 y 1456).
- El id de build es aleatorio por build: `next.config.ts` no define `generateBuildId`, y `build/index.js:389` usa `nanoid` como respaldo.
- Por eso, cualquier navegación desde el menú cura la pestaña.

**Respuesta de Server Action: sí llega.**

- `router-reducer/reducers/server-action-reducer.js:132` toma `actionResult = response.a` antes de mirar el build.
- La línea 143 detecta el id distinto y solo descarta los datos de la ruta (`f`).
- La línea 232 hace `resolve(actionResult)` igualmente.
- `action-handler.js` no lee `x-deployment-id`: su único filtro es que el id de la action exista. Si no existe, responde 404 con cabecera, y el cliente lanza `UnrecognizedActionError`.
- Una action que revalida acaba navegando (`navigate`), y esa navegación recarga la página por la comprobación de arriba. Una lectura no revalida, así que la pestaña sigue vieja.

**Cuándo sigue valiendo el id de action.** La sal es la clave (`build/index.js:560`, `webpack-config.js:417`, `swc/options.js:168`; con Turbopack, `turbopack-build/impl.js:109` pasa `encryptionKey`). La clave sale, en este orden (`encryption-utils-server.js`):

1. `.next/cache/.rscinfo`, si no ha caducado y no choca con la variable de entorno.
2. `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`.
3. Una nueva al azar.

El detalle que no estaba en `impl_494.md`: **`.rscinfo` caduca a los 14 días de generarse** (`EXPIRATION`, líneas 13 y 26), y reutilizarlo no renueva ese plazo. Si `is-docker` da verdadero, tampoco hay almacenamiento y la clave es nueva en cada build.

**Lo que dispara la lectura en una pestaña vieja:** solo una acción de la persona. `recargarTodo` (`WalletModule.tsx:468`) al filtrar o paginar, y `leer` y `refrescarCuenta` en `EstadoCuenta.tsx` y `MiEstadoCuenta.tsx`. Sin `setInterval` ni `visibilitychange` en `WalletModule.tsx` ni en `EstadoCuenta.tsx`.

**Daño si llega:**

- La frase falsa sale debajo de la cifra correcta (`TarjetasEstadoCuenta.tsx:63-64`).
- Los botones de cobrar y pagar dependen de `signo`, no de `sentido` (`EstadoCuentaAcciones.tsx:31-32`), así que no cambian.
- No escribe nada.
- Un caso que `impl_494.md` no lista: con `esEmpresa`, el `textoAQuien` viejo pinta una raya en lugar de «Velox» en un aporte. Leído, no ejecutado.

### Supuesto, sin leer ni medir

- Que el id sea un hash de sal, archivo y export: está en el binario nativo. Lo leído solo muestra que la sal entra. La sonda del implementador es indicio, no prueba.
- Que Vercel restaure `.next/cache`, y con él `.rscinfo`, en el build de producción.
- Que `is-docker` dé falso en el build de Vercel.
- Que Skew Protection fije `NEXT_DEPLOYMENT_ID` y enrute por `x-deployment-id` a la versión vieja. Si está activo, la pestaña vieja seguiría hablando con el servidor viejo. Solo aplica a clientes compilados con ese id.
- Que la excepción acabe en `app/(app)/error.tsx`. El archivo existe y `app/(app)/wallet/` no tiene uno propio, pero no se vio la pantalla.
- Que el navegador solo revise `sw.js` en una carga completa o en eventos del service worker (afecta a m4).

Conclusión: la ruta es real solo si el id sobrevive al build, y eso depende de cuántos días tenga la clave el día de la release. No se puede descartar sin medir.

### Tanda 2: mismo problema, leído y sin ejecutar

`verCierreDetalle` (`lib/actions/cierres-admin.ts:327`) ya devuelve `netoEmpresa`.

- En el cliente viejo, `result.netoOrdenex` queda `undefined`, y `esMontoNegativo(undefined)` lanza en la cascada del cierre (`CascadasCierreMensajero.tsx:304`, código de antes del renombrado).
- La cascada de bodega pasa ese `undefined` a `money()`, que también lanza.
- `ingresoOrdenex` ausente hace `if (!ing) return null` (`cierre-detalle-shared.tsx:905`): el desglose desaparece sin aviso.

El peor caso es un panel que no abre, sin cifra falsa medida. La tanda 2 no está en `origin/prod` (comprobado con `merge-base`), así que todas las tandas salen en una sola release y la ventana es una sola. La tanda 4 añadirá lo suyo a esa misma ventana.

### Qué hacer, con el menor coste

1. **Sin código y sin alias.** El alias aquí es peor que el del caso que rechazó §11.8: `sentido` es un único valor y no admite dos nombres, y `deOrdenex` devuelve la marca al árbol con una excepción nueva. El cliente viejo solo vive durante la ventana.
2. **Medir antes de la release.** Mirar si Skew Protection está activo y comparar los ids de action entre dos despliegues de preview seguidos. Es una lectura de chunks estáticos. Lo hace el leader: esta revisión no ha tocado prod ni preview.
3. **Si los ids sobreviven:** desplegar fuera de la operación y avisar a quien tenga la app abierta de que recargue, o entre desde el menú.
4. **Anotar la decisión en `design.md §3.2`**, que hoy solo trata la dirección de la página al servidor.

**Lo que no recomiendo por defecto:** forzar una clave nueva en esa release, sea con la variable de entorno o con un build sin caché. Quita la frase falsa, pero también convierte en 404 las escrituras de las pestañas viejas, y entre ellas estaría el panel del mensajero en la calle. Según el código, ese 404 ya ocurre siempre que la clave caduca. Es una opción válida si el humano prefiere fallo ruidoso a frase falsa.

**Para más adelante, en ficha aparte:** Skew Protection es el arreglo de toda la familia. Requiere activarlo y desplegar una vez antes de la release con cambios: el cliente que ya está en prod no lleva el id. También conviene que `fraseDelSaldo` no afirme «no se deben nada» por descarte (m6).

## Trazabilidad

| R | Test | Lo que aporta |
| --- | --- | --- |
| R4 | `aporte-por-orden.test.ts`, `caja-iva-488.test.ts`, comprobación de diff en `impl_494.md` | El nombre accesible con importe cruzado y la clave vieja del DTO caen |
| R7 | `tests/unit/types/efecto-movimiento-494.test.ts` | Esquema, action sin llegar al servicio, catálogo y diálogo, con literales |
| R8 | `CajaResumenCard.test.tsx`, `CajaComposicionBarra.test.tsx`, `EstadoCuenta.test.tsx`, `saldo-tienda-card.negativo.test.tsx` | Etiquetas literales; la frase de admin cae con la mutación |

**Huecos de T4.3:**

- **Registro real de `tienda paga`: sin riesgo por este renombrado.** `tienda_paga_a_empresa` solo vive en `CONCEPTO_REGISTRO_DE`, `CONCEPTO_REGISTRO_SEED` y `EFECTO_POR_TIPO`. Es entrada de la previsualización; el registro usa `ConceptoManualId`, que no cambia. El tope tiene test que muere.
- **Mensajeros en pantalla: riesgo bajo.** Comparten rama con la tienda y `EstadoCuenta.test.tsx:82-89` fija su frase con literal, y esa mutación cae.
- **Satélites en pantalla: riesgo nulo por este renombrado.** Su rama de `fraseDelSaldo` no compara ningún valor renombrado.

## Intermitente: `498-conciliar-asienta-sql-real`, R36

No parece tener que ver. El test solo lee `deTerceros`, que no cambia de nombre; lo relaciona el `import` de `derivarCaja`. Pasó aislado en esta revisión.

Hipótesis por lectura, sin reproducir: `cajaYTienda` llama a `agregarPorCategoriaYTipo({})` sin filtro, sobre la caja entera. Si otro archivo confirma filas en `wallet_movimiento` entre la lectura de antes y la de después, el delta se contamina. Encaja con la ampliación de `--rapido` a toda `tests/integration/db` y con los flakes conocidos de la base compartida.

## Repo público

En las líneas añadidas no hay credenciales, cadenas de conexión ni tokens. El único UUID es falso (termina en `0000a1`, de un test). `admin.qa`, `tienda.qa`, «Tania Tienda» y las cifras de `impl_494.md` son de la base local de QA. Queda m5.

## Hallazgos

Ningún `BLOQUEANTE`.

- **m1, `menor`, a decidir antes de la release:** `specs/494-marca-identificadores-internos/design.md:88-90` no contempla servidor nuevo con página vieja. La ruta existe por Server Action, no por RSC. Afecta también a las tandas 2 y 4. Falta anotar la decisión.
- **m2, `menor`:** `progress/impl_494.md:576-583` no lista el caso de `esEmpresa` (una raya en «A quién» de un aporte), `impl_494.md:589` no dice que `.rscinfo` caduca a los 14 días, y `impl_494.md:591` deja la tanda 2 sin medir. Esta revisión la cubre por lectura.
- **m3, `menor`:** `components/shared/wallet/DetalleMovimientoPanel.tsx:103`. Ningún test de los 174 corridos cae si el panel lee la clave vieja. Hoy lo protegen `tsc` y lo visto en T4.3, no un test. Falta una aserción literal de «A quién» de un aporte en `DetalleMovimientoPanel.test.tsx`.
- **m4, `menor`:** `design.md:89` da a `AvisoVersionNueva` como mitigación, pero `hooks/useActualizacionPwa.ts` nunca llama a `reg.update()` y `sw.js` solo se registra en `load` (`app/layout.tsx:77`). Una pestaña que no recarga puede no ver el aviso, salvo que otra pestaña dispare la actualización.
- **m5, `menor`:** `progress/impl_494.md:624` publica una ruta local con el usuario de Windows, y las capturas de T4.3 solo viven en el scratchpad. No es dato de prod, pero la evidencia caduca con él.
- **m6, `menor`, fuera de esta ficha:** `components/shared/estado-cuenta/estado-cuenta-labels.ts:77` y `:87`. Afirmar «no se deben nada» por descarte es lo que convierte un valor desconocido en una frase falsa. Es anterior a esta tanda y arreglarlo no ayuda en esta release, porque el cliente viejo ya está desplegado.
