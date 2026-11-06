# 494 — Revisión final de la feature (T8.5)

> Rama `feat/494-t7-cierre`, HEAD `f573d62b8`, base de la feature `981473d7` (`32dae01e^1`).
> MCP `codebase-memory`: no conectó (*connection timed out*). Medido con `git`, leyendo archivos y con scripts sobre `typescript`.
> El gate no se corrió, por orden: se toma el completo del leader sobre este HEAD (35.155 verdes, 26 skipped, 0 rojos, `INIT_EXIT=0`). Nada se ejecutó contra prod ni preview.

## Veredicto: RECHAZADO

Dos bloqueantes. El código renombrado está bien: no se encontró ningún importe, texto visible ni contrato cambiado. Lo que falla es la trazabilidad de un requisito y un dato falso en lo que el humano va a leer para decidir la release.

- **B1:** R25 no tiene test.
- **B2:** el peor caso «archivo guardado sin cifras» sigue vivo en la descarga detallada de cierres, y `design.md` y `docs/release.md` dicen que solo existía en productos.

## Checklist

| Punto | Estado | Evidencia |
| --- | --- | --- |
| Todos los `R<n>` con test | **NO** | R25 sin test (B1). Los otros existen; R10 y R12 no aplican |
| R10 | OK | `tasks.md:65` y `impl_494.md:1016`: `filas_con_valor` = 0, sin migración; `marca-494-backfill` no existe, como prevé la tabla |
| R29 | OK | `tests/integration/db/seed-usuarios-qa-494.test.ts`, 5 tests, corridos y sin skipped |
| Tasks | OK salvo lo previsto | T8.5 es esta revisión; T9 y T10 van tras la release. **Ninguna task pedía el test de R25** |
| Tanda 7 sin cambio de código | OK | Dos métodos, 0 líneas (abajo) |
| Guardias sin trinquete | OK con menores | Aparición nueva y excepción muerta salen rojas; la lista común no la vigila nadie (m3) |
| Esquema (R13) | OK | `prisma migrate diff` de `a6a54c4c` contra el actual: `-- This is an empty migration.`, exit 0. Sin `//`, 0 líneas de `diff` |
| Variables de entorno | OK | `.env.example`: solo un comentario, ningún nombre. Todos sus nombres tienen lector. `DEFAULT_SUBJECT` existe |
| `package.json` | OK | Solo `name`. Nada lo lee; `pnpm-lock.yaml` con 0 líneas de diff |
| Postman | OK | Sin referencias colgando: 2 tests, 2 comentarios, el fixture y el `CHANGELOG` |
| `changelog-api-493` | OK | Legítimo: cualquier entrada posterior rompía «la primera». `entrada()` localiza la suya por encabezado, y el orden descendente queda afirmado |
| R28 | OK | Diff de la ficha en `next.config.ts`, `vercel.json`, `middleware.ts` y `proxy.ts`: 0 líneas |
| Lo visible | OK | Nodos de texto, abajo. `app/api` contra `origin/prod`: 0 líneas |
| RLS, migraciones, `down.sql` | No aplica | La ficha no añade tablas ni migraciones |
| Repo público | OK | Abajo |
| `progress/history.md` | Lo hace el leader al cerrar | |
| E2E | Inaplicable | No hay harness; los 3 `e2e/*.spec.ts` solo cambian en comentarios |

## Hallazgos

### B1, `BLOQUEANTE`: R25 no tiene test

`requirements.md:138` manda crear `tests/integration/db/plantilla-renombrada-envio-494.test.ts`. El archivo no existe ni ha existido en la historia de ninguna rama. Ningún test de esta ficha cita R25, ninguno renombra una plantilla enlazada a un envío, y `impl_494.md` no lo menciona: sus mapas no lo incluyen ni dicen por qué. R26 se apoya en él (`requirements.md:139`, «R25 demuestra que el código funciona con cualquier nombre»).

Leído en el código, la conducta parece correcta: `EjecucionEnvioService.ts:218` fija `plantilla.nombre` en la ejecución, `:394` envía con `c.plantilla.nombre`, y `whatsapp_envio` enlaza por FK. No está medido, y es justo lo que T9.3 va a hacer en prod con plantillas en uso diario.

**Para cerrarlo:** crear ese test contra Postgres, con la plantilla enlazada a un envío, una ejecución anterior ya fijada y un enviador doble. Debe afirmar tres cosas: el enviador recibe el nombre nuevo, la fila de `whatsapp_envio` no cambia, y la ejecución anterior conserva su `plantilla_nombre`. Con mutación (fijar el nombre en el envío, o reescribir la foto), y añadido al mapa.

### B2, `BLOQUEANTE`: la descarga detallada de cierres tiene el peor caso que V2 cortó en productos

`app/(app)/cierres-admin/_components/cierres-gestiones-fundida-descarga-columnas.ts:471`. `filaDescargaGestionFundida` corre en el navegador, sobre lo que devuelve `prepararDescargaAction("listarGestionesCierresAdminCompleto" | "listarGestionesCierresBodegaCompleto")`, una action que no cambió de nombre. El DTO ya trae `ingresoEmpresa` (`CierresAdminRepository.ts:875`).

En una pestaña de `origin/prod`, esa línea lee `gestion.ingresoOrdenex`, que queda `undefined`, y `ingreso ? … : null` deja **vacías, sin error,** seis columnas de dinero: monto a cobrar, fulfillment, flete con IVA, comisión con IVA, flete de devolución e ingreso total. Se lee como «sin tarifa», igual que un dato real (R46). Un archivo ya bajado no se corrige recargando: es el mismo argumento con el que `design.md:99` justificó V2.

**Medido:** simulando la lectura vieja en `cierres-gestiones-fundida-descarga-columnas.test.ts`, 5 rojos por `toEqual`, sin que nada lance. **No medido:** el bundle viejo real contra un servidor nuevo. Depende, como productos, de que el id de la action sobreviva al despliegue.

Mismo camino, menos grave: `libro-caja-labels.ts:70`, vía `wallet-ledger-descarga-columnas.ts:73` y `libroCajaKardex`. El libro bajado pone «—» en «A quién» de un aporte en vez del nombre de la empresa. Leído, sin medir.

`design.md:98` y `docs/release.md` («En cierres y caja, una frase de saldo falsa… o un panel que no abre, hasta recargar; no se escribe nada») son falsos para este caso, y es lo que el humano leerá para confirmar «sin alias».

**Para cerrarlo, como mínimo:** corregir esos dos textos. **Arreglo recomendado, del mismo coste que V2:** cambiar el nombre de las dos claves del registro de descargas (y de `libroCajaKardex*` si se quiere cubrir el «—»). La pestaña vieja recibe `validation_error` (`lib/actions/descargas.ts:58-62`), `descargarDatos` lanza y el botón avisa sin producir archivo. Leído, sin ejecutar. Lo decide el humano; lo que no puede es decidirlo con ese dato mal.

### Menores

| Id | Dónde | Qué |
| --- | --- | --- |
| m1 | `tests/components/CajaResumenCard.test.tsx:325` (no `:324`) | **Negativa muerta, medido.** Forzando la frase también en positivo (`CajaResumenCard.tsx:299`), ese `it` sigue verde; cae otro test del archivo, por accidente. Arreglo de una línea: `NOMBRE_ESPERADO` en vez de `MARCA_RETIRADA`. Es anterior a la ficha |
| m2 | `tests/unit/components/wallet-labels.test.ts:287` | La misma clase, leído: la frase ya lleva la marca vigente. Sin pérdida: `:283` fija el texto entero con `toBe`. Se puede borrar |
| m3 | `tests/fixtures/marca-sin-ordenex-494.ts:126-185`, `guardia.test.ts:110-112` | **La lista común no la vigila nadie, medido.** La 493 ahora depende de `EXCEPCIONES`, y la 494 solo fija los ids. Añadir `lib/utils/` a E5 con un texto «Cobró (marca)» allí: **60 tests, 0 rojos, en las dos guardias.** Arreglo: fijar en el test, en literal, las rutas y patrones de cada excepción |
| m4 | `marca-sin-ordenex-494.ts:152`, E5 por archivo | **La 493 perdió algo, medido.** Un texto visible con la marca en `lib/navegador/claves-legadas.ts` deja las dos verdes; la 493 de antes lo habría visto. Riesgo bajo: es un archivo. Arreglo: E5 por línea en ese módulo |
| m5 | `marca-sin-ordenex-494.ts:68-81` | **`providers/` queda fuera del árbol, medido:** comentario y texto con la marca en `providers/TemaProvider.tsx`, 0 rojos. El hueco viene del glosario. También `instrumentation.ts`, `AGENTS.md` y `README.md`. Hoy, 0 apariciones en todos |
| m6 | Unos 20 comentarios | Citan rótulos que no existen: «Total la empresa» (`cierre-labels.ts:168,283`), «Cobró la empresa» (`ProductosTabla.tsx:771,891`), o afirman algo falso: `EmailProvider.ts:17` da «la empresa» como valor por defecto, `etiquetas-visibles.guardia.test.ts:76` dice «es la marca: no lleva tilde», `factura-contraste.guardia.test.ts:111` dice «el wordmark». §3.4 lo aceptó de antemano, y no afecta a nada que se ejecute. Los que despisten a quien busque un rótulo conviene reescribirlos |
| m7 | `scripts/seed-usuarios-qa.ts` | **Sin guard de entorno, ni antes ni ahora: no es regresión.** Corrido en prod por error, no toca cuentas reales (correo exacto; Q5 no tiene `@ordenex.test`, así que el pase no se activa), pero crea 4 cuentas activas, una `admin`, como antes. Vale otra ficha |
| m8 | `docs/release.md:568-575` | El paso de §3.2 es ejecutable y deja claro qué hacer en cada salida, pero no está en la tabla A y no da comando. Quien siga A1…A7 se lo salta. Conviene una fila con su verificación: `vercel env ls production`, y dónde se lee Skew Protection |
| m9 | `components/shared/AvisoVersionNueva.tsx:62` | **Fuera de esta ficha** (abajo) |

## Tanda 7, «sin cambio de código»

| Método | Archivos | Líneas de código distintas |
| --- | --- | --- |
| `quitarComentarios` / `quitarComentariosCss`, los dos lados, `app lib components hooks public scripts` | 180 | **0** (y `scripts/marca-494-renombrar.mjs` borrado, como pide T8.2) |
| Independiente: AST de `typescript`, reimpreso con `removeComments`, más `e2e` | 181 | **0** |

**Frases rotas:** expresión sobre las 1.128 líneas añadidas, y 36 comentarios leídos con muestra aleatoria. Sin «una la empresa» ni dobles artículos. Lo que queda es m6. Los «sitio anterior» leídos se entienden bien (`globals.css`, `page.tsx`). Nada de esto tocó una cadena de UI: ninguna cadena de código de producto cambió en la tanda.

## Toda la feature: lo que no es renombrado mecánico

Normalizando el lado viejo con el renombrado y comparando sin comentarios en `app lib components hooks public`, solo quedan **112 líneas** (contando las de antes y las de después), todas esperadas: migración de claves, alias del SW, cookie de tema, prefijo de caché `:v2`, las dos actions V2 y restos del propio normalizador. **Ningún importe ni texto cambia.** Esto cubre también la tanda 2, que no tiene informe de revisión propio, y sostiene R4.

**Lo visible, por nodos de texto** entre la base y HEAD (55 archivos): solo claves, ids, rutas de módulo y la cadena `descripcion` de `dinero_en_caja` (`lib/analytics/metrics.ts:695`), que nombra el id. Esa cadena no la lee ninguna pantalla de las buscadas, y la métrica no está en `METRICAS_API_KEY`. `app/api` contra `origin/prod`: 0 líneas. `docs/api`: la entrada del `CHANGELOG` y el `info.name` de la colección, declarados.

## Tests de la tanda 7: la clase de las 17

Revisadas las negativas retiradas con la marca, y las negativas de HEAD con un valor renombrado. **Muertas: 2** (m1 y m2).

Sospechosas que sí pueden fallar, porque el dato de entrada lleva ese mismo valor: `email-config.test.ts:77`, `quitador-comentarios.guardia.test.ts:223`, `webhook-orden-reader.test.ts:522` (entrada en `:467`), `paquete-url.test.ts:36-41` (`extractNumGuiaFromScan` no mira el host), `tema-encendido.guardia.test.ts:452`, `preferencias-494.test.tsx:142,205`. Las de marca (`LandingFooter.test.tsx:45`, `Sidebar.test.tsx:601`…) afirman justo eso, y valen. Búsqueda por expresión sobre líneas sueltas: una negativa con el valor en otra línea, o en una lista recorrida, solo se revisó donde el literal retirado aparecía suelto.

## Guardias: mutaciones propias

Arnés con autocomprobación: el archivo cambia, `numTotalTests` > 0, y los bytes se restauran y se comparan. La primera corrida no ejecutó ningún test; se detectó por `total: undefined` y se corrigió antes de creer nada.

| Mutación | Tests | Rojos | Resultado |
| --- | --- | --- | --- |
| Base | 60 | 0 | |
| Comentario nuevo en `lib/` | 60 | 1 | Muerta: `ningun archivo del arbol…` |
| Texto con la marca en `lib/` | 60 | 2 | Muerta, en las dos guardias |
| Comentario en `db/schema.prisma` | 40 | 1 | Muerta |
| E8 con una ruta sin la marca | 40 | 1 | Muerta: `todas declaran motivo…` |
| E5.1 con patrón ancho | 60 | 2 | Muerta |
| Quitar el módulo de E5 | 60 | 4 | Muerta, en las dos: dependen de verdad de la lista |
| **E5 ensanchada a `lib/utils/` con texto allí** | 60 | **0** | **Superviviente:** m3 |
| **Texto visible en `claves-legadas.ts`** | 60 | **0** | **Superviviente:** m4 |
| **La marca en `providers/`** | 60 | **0** | **Superviviente:** m5 |
| Frase en positivo (`CajaResumenCard`) | 33 | 1 | Ese `it` sigue verde: m1 |
| Pestaña vieja en la descarga fundida | 36 | 5 | Sin lanzar: B2 |
| Base restaurada | 60 | 0 | |

La mutación «E6 con línea ancha» no se aplicó, porque el patrón no casó y el arnés lo dijo (`cambio: false`): no cuenta. Es la misma clase que m3.

**¿E2 es demasiado ancha?** No por lo que importa: E1, E2 y E3 caen fuera de `archivosDelArbol`, así que no abren nada en R1, solo alimentan el censo y la comprobación de muertas. `docs/release.md` entero queda sin vigilar salvo B2 y B4: tiene 23 líneas con la marca, y las dos de la zona vigente (`:635`, `:742`, fila C15) describen un texto de la app, sin mandar a un sitio equivocado.

**¿La 493 sigue vigilando lo que vigilaba?** Vigila más: sin `quitarIdentificadores`, cualquier nodo de texto cuenta. `censoContrato` no usa la lista común, así que la cabecera y el dominio viejos no se abren con ella. Pierde solo lo de m4. El riesgo de dos guardias con una sola lista es m3.

**Corridos por mí, con base real, sin skipped:** las dos guardias y los tests de R3, R6, R7, R9, R12-R23 (salvo `useTonoAlIncrementar` y `OrdenesDescargaColumnas`), R27, R29 y R31, más `changelog-api-493`, `CajaResumenCard` y `wallet-labels`: **350 tests, 0 rojos**. Árbol limpio al terminar.

## Tandas 5 y 6

- **`seed-usuarios-qa.ts`:** R29 correcto, con pase por correo exacto (R30) y sin decidir si existen las dos. `isEntrypoint` funciona: con `QA_PASSWORD` corta llega al error de longitud, sin tocar la base. Guard de entorno: m7.
- **`seed-maestro.ts`:** nada que afecte a prod. El correo llega siempre por entorno, y `update` no escribe `nombre`.
- **`rollup-analitica-manual.ts`:** solo cambia el nombre de la función; la comprobación es la misma.
- **Fila A5 y título de `CLAUDE.md` (del leader):** correctos. B2 y B4 también.

## Hallazgos anteriores

| Informe | Estado |
| --- | --- |
| T1 | M1 cerrado (`SIMBOLO_VIEJO`, con contrapruebas). M2 cerrado (R16 con los dos casos, `ProductosDescargaColumnas.test.tsx:336-337`). M3 cerrado (`design.md:347`). M4 se dejó a propósito: **la vuelta atrás de `prod` es de la lista de abajo** |
| T3 | m1 cerrado en `design.md §3.2`, aunque con B2. m2 anotado. m3 cerrado (`DetalleMovimientoPanel.test.tsx`). m4 cerrado (`design.md:89`). m5: fuera del árbol, en la historia aceptada por el leader. m6: es la ficha 504 |
| T4 | M1 cerrado para productos, y B2 es lo que quedó fuera. M2 cerrado. M3 resuelto corrigiendo el mapa, sin test nuevo. M4 cerrado. M5 cerrado. M6 sin objeto: script borrado |

## Repo público

Diff de la feature, líneas añadidas: 0 rutas de usuario (la única coincidencia es una frase de `review_494_t3.md` que dice que no las hay); 0 JWT, tokens de Meta ni claves; URLs de base solo inventadas (`db.ejemplo.interno`); correos solo de prueba. Las cifras de Q2 a Q5 en `impl_494.md` son agregadas. La ruta local de `e0f055fd`, por decisión del leader, no se reabre.

## Hallazgo abierto: la tarjeta del aviso de versión

**No es de esta ficha.** `AvisoVersionNueva.tsx` y `components/ui/alert.tsx` sin diff contra `origin/prod`. La estructura viene de la 284; la 493 solo tocó textos.

Causa, leída y no medida en navegador: `Alert` usa `has-[>svg]:grid-cols-[auto_1fr]` (`alert.tsx:7`). El título y la descripción llevan `col-start-2`, pero el contenedor de los botones (`AvisoVersionNueva.tsx:62`, clase `mt-2 flex justify-end gap-2`) no lleva columna, y cae en la primera, la `auto`, que crece hasta el ancho de los dos botones. De ahí el icono en una columna ancha y el texto apretado. **Nada de esto depende de `next dev`, así que debería verse igual en producción.** Arreglo de una clase: `col-span-2`. Merece ficha propia, y antes de esta release si se quiere: este aviso es lo que la gente verá al desplegar.

## Lo que el humano debe decidir antes de `prod`

1. **Medir `design.md §3.2`:** Skew Protection y `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` en producción. Sin ninguna, se despliega fuera de la operación y se avisa de que recarguen.
2. **Confirmar «sin alias»**, que sigue `PENDIENTE` en `design.md:93`, ya con B2 corregido.
3. **Descarga de cierres (B2):** otro nombre en el registro, o aceptar la ventana sabiendo que un archivo puede salir sin esas seis columnas.
4. **V2 con Turbopack:** producción construye con Turbopack y la medición es con webpack. Medir en un checkout sin junction antes de confiar en el corte.
5. **Las dos actions V2:** bien justificadas. Sin alias ni excepción, medidas (332 de 334 ids intactos, con webpack, según la bitácora), y su fallo es un error visible que se arregla recargando. No las pedía el spec, pero `design.md §3.2` las explica y salen de M1 de la T4.
6. **Vuelta atrás de `prod`** (M4 de la T1): «actualizar» no hace nada hasta cerrar pestañas, y el código anterior no lee `app:`. Saber que es así antes de usarla.
7. **Siembra QA en preview** (leader): usar el `QA_PASSWORD` con el que ya se entra, porque rota la contraseña. Actualizar la receta de acceso de la memoria (T10.2). En prod no se corre.
8. **Tras desplegar:** PWA instalada sobre HTTPS y R22 en un dispositivo real (T8.3 lo deja pendiente). Tanda 8 de Meta (T9), con plantillas en uso diario y sin ventana sin plantilla aprobada. Ficha de retirada del legado, mínimo 90 días (T10.1).
9. **Merge:** #891, #892 y esta rama van apilados. Confirmar que los SHA llegan a `origin/dev` y `gh pr checks` con Vercel `pass`: el gate no corre `next build`.

## Lo que no se pudo comprobar

- La conducta de R25: solo leída.
- B2 con el bundle viejo real, y si el id de la action sobrevive con Turbopack.
- La configuración de Vercel, Skew Protection incluida: nada contra prod ni preview.
- `next build`: no se corrió. Lo que dice que no depende del nombre es que nada lee `name` y el lockfile no cambia.
- La tarjeta del aviso en un navegador.
- Tanda 7 en navegador (T8.3): tomada de la bitácora, sin repetirla.

---

# Segunda vuelta (HEAD `63d420448`, contra `5d9d9e7e8`)

> MCP `codebase-memory`: no conectó en esta sesión; medido con `git`, `typescript` y mutaciones. El gate no se corrió, por orden.

## Veredicto: OK con menores

B1 y B2 están cerrados. Quedan dos menores nuevos, ninguno frena el merge, y lo que debe decidir el humano está abajo. Este veredicto sustituye al RECHAZADO de arriba.

## B1: cerrado

`tests/integration/db/plantilla-renombrada-envio-494.test.ts` afirma lo que manda `requirements.md:138`:

- El enviador recibe `[viejo, nuevo]`, exactamente uno de cada.
- La fila de `whatsapp_envio` y sus destinatarios no cambian, comparados por `to_jsonb` desde antes de la primera ejecución.
- La ejecución anterior conserva `plantilla_nombre` y `plantilla_id`, y la siguiente toma el nombre nuevo.

Corre contra Postgres con los repositorios reales, en transacción revertida. Sin caminos verdes de salida: las aserciones van sobre lo que devuelve la transacción, `tocadas` exige 1 fila y las fotos exigen su fila. El único salto es `describe.skip` sin base, como en el resto de `integration/db`. Corrido por mí: 2 tests, 0 saltados.

**R26:** cubierto. El primer envío sale con el nombre vigente, sea cual sea, y el bloque «plantillas» de la guardia sigue vigilando que ningún test nombre una plantilla con la marca.

## B2: cerrado

- **Referencias a las claves viejas:** solo quedan como literales de `ClaveDescargaRetirada494.test.tsx:39-42` y como cadenas de prueba de `descargas-por-registro.guardia.test.ts:96,111-112`. La búsqueda de esas cadenas en `app`, `components`, `lib`, `hooks`, `tests`, `e2e` y `docs` no da ningún cliente, mapa ni permiso por rol.
- **Las 33 del registro:** 33 entradas y 33 `descargarDatos("…")` distintos, sin llamadas con clave dinámica.
- **Campos renombrados, comprobado por mi cuenta.** Saqué de la base todos los identificadores con la marca en código, sin comentarios, y crucé cuáles lee el cliente:
  - En archivo: `gestion.ingresoOrdenex` y `a.esOrdenex`, las cuatro claves V2; `.liquidado.ordenex` y `o.ordenex`, las actions V2 de productos.
  - Solo en pantalla: `g.ingresoOrdenex`, `netoOrdenex`, `resumen.deOrdenex`, `solo_ordenex`, `ordenex_debe`.
  - Solo en servidor: `gananciaOrdenex`, `pagoTiendaOrdenex`, `gastoDeOrdenex`, `netoOrdenexAgregado`, `concepto_ordenex`.
- **Fuera del registro, sin más casos:**
  - La exportación del tablero financiero pide una métrica cada vez, y un `validation_error` no genera archivo (`ExportarVistaFinanciera.tsx:158`). La pestaña vieja que pida el id retirado recibe eso. Leído.
  - Etiquetas, manifiesto, carga masiva y chat generan archivo en el navegador, pero ninguno está entre los lectores de un identificador renombrado.
  - `cierre-factura.tsx` lee `g.ingresoEmpresa`, solo en pantalla: no está entre los generadores de archivo.
- **`ClaveDescargaRetirada494.test.tsx`:** usa la action, el registro y `descargarDatos` reales. Su botón es el de `DataTable`, no el de cierres: los botones reales los midió el implementador en navegador, con el POST reescrito, y no lo repetí.

## Textos

- **`design.md` §3.2 y `docs/release.md`:** ahora dicen la verdad. El peor caso pasa de archivo sin cifras a no hay archivo, y es cierto, por lectura del código, que este corte no depende del id de la action ni de Turbopack: la clave se comprueba en el servidor. También declaran que el aviso dice «vuelve a intentarlo» y reintentar falla igual hasta recargar.
- **Fila A12:** ejecutable, con dónde se mira cada cosa y qué hacer sin ninguna de las dos. Ver n1.

## Solo cambian comentarios y las cuatro claves

Quitador en los dos lados, en `app lib components hooks public scripts`: 9 archivos y **8 líneas de código cambiadas**: las 4 claves del registro y sus 4 llamadas en `CierresAdminModule`, `CierresBodegaAdminModule` y `WalletModule`. Los comentarios de m6, en esos directorios y en `CierreFactura*`, `CierreMensajeroDetalleCascadas`, `ProductosTablaDinero`, `etiquetas-visibles` y `factura-contraste`: 0 líneas de código.

## Mutaciones repetidas

Arnés con autocomprobación, bytes restaurados y comparados, árbol limpio al terminar.

| Mutación | Tests | Saltados | Rojos | Resultado |
| --- | --- | --- | --- | --- |
| Base | 77 | 0 | 0 | |
| R25: se envía con un nombre fijo | 2 | 0 | 2 | Muerta |
| R25: la foto no guarda el nombre vigente | 2 | 0 | 2 | Muerta |
| R25: el `UPDATE` del test no toca filas | 2 | 0 | 2 | Muerta |
| B2: alias de `libroCajaKardex` | 13 | 0 | 2 | Muerta |
| B2: alias de gestiones de bodega | 13 | 0 | 2 | Muerta |
| m3: E5 a `lib/utils/` con texto | 62 | 0 | 1 | Muerta, antes sobrevivía. La caza solo la lista en literal |
| m3: E5.2 con patrón ancho y texto | 62 | 0 | 3 | Muerta |
| m4: texto visible en `claves-legadas.ts` | 62 | 0 | 2 | Muerta, antes sobrevivía; las dos guardias |
| m5: la marca en `providers/` | 42 | 0 | 1 | Muerta, antes sobrevivía |
| m1: la frase en positivo | 33 | 0 | 2 | Muerta, ahora también ese `it` |
| Base restaurada | 77 | 0 | 0 | |

«E6 con patrón ancho» no se aplicó otra vez: mi patrón no casó y el arnés lo dijo. No cuenta como mía. La misma aserción literal fija E6, leído, y la bitácora la anota muerta. m2 tampoco se mutó: leída la línea, y `toBe` en `:283` sigue fijando el texto.

## Menores

| Id | Dónde | Estado |
| --- | --- | --- |
| m1 a m5, m8 | | Cerrados como dice `impl_494.md`, salvo n1 |
| m6 | | Cerrado, salvo n2 |
| m7 y la tarjeta del aviso | `scripts/seed-usuarios-qa.ts`, `AvisoVersionNueva.tsx:62` | Abiertos, fuera de esta corrección por orden |

**Nuevos:**

- **n1, menor:** `docs/release.md:664`. A12 tiene 4 columnas y la tabla 5: falta «Detiene». Quien la siga no sabe si frena la release.
- **n2, menor:** quedan 3 comentarios con el rótulo sin tilde que la corrección no vio: `app/(app)/analitica/_components/entregas/ProductosTabla.tsx:19`, `tests/fixtures/marca-esperada.ts:4` y `tests/unit/analytics/conteo-productos-dinero.test.ts:452` («Cobro la empresa»). Nada que se ejecute.

## Gate

`INIT_EXIT=1` no se toma como verde. El archivo `liquidacion-reparto-migration` no tiene diff en toda la feature (comprobado) y su deadlock es el riesgo R5 de `docs/release.md:812`. Los 35 skipped en vez de 26 coinciden con lo que `docs/release.md:658` describe para ese mismo flake; no leí el log, así que no confirmé que esos 9 sean de ese archivo. Vale para esta revisión por la regla 5 de `CLAUDE.md`. **No vale como pre-vuelo:** A6 exige `INIT_EXIT=0` y 26 skipped sobre el SHA que se despliega.

## Lo que debe decidir el humano antes de `prod` (actualizado)

1. **Medir A12:** Skew Protection y `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`. Sin ninguna, desplegar fuera de la operación y avisar de que recarguen. Decidir si A12 detiene (n1).
2. **Confirmar «sin alias»** (`design.md:93`), ya con los textos correctos. Lo que acepta: en pantalla, frase de saldo falsa, panel que no abre o «—» en «A quién», hasta recargar; en descargas de cierres y libro, aviso sin archivo, que dice «vuelve a intentarlo» aunque hay que recargar.
3. **V2 de productos con Turbopack:** sigue medido solo con webpack. Medir en un checkout sin junction, o aceptarlo. El corte de las cuatro claves no depende de esto.
4. **Vuelta atrás de `prod`:** «actualizar» no hace nada hasta cerrar pestañas y el código anterior no lee `app:`. Además, razonado sin medir: una pestaña abierta en la versión nueva pediría claves V2 que el servidor anterior no conoce, y no descargaría hasta recargar.
5. **Gate de release:** repetir el completo sobre el SHA final hasta `INIT_EXIT=0` y 26 skipped.
6. **Siembra QA en preview:** con el `QA_PASSWORD` vigente, y actualizar la receta de acceso de la memoria.
7. **Tarjeta del aviso de versión:** arreglarla antes o después de esta release. Es lo que la gente verá al desplegar.
8. **Tras desplegar:** PWA instalada y R22 en un dispositivo real, T9 de Meta y ficha de retirada del legado.
9. **Merge:** #891, #892 y esta rama van apilados: confirmar los SHA en `origin/dev` y `gh pr checks` con Vercel `pass`.

## Lo que no se pudo comprobar

- El bundle viejo real contra un servidor nuevo: la bitácora lo simula reescribiendo el POST, y no lo repetí.
- Turbopack, y la configuración de Vercel: nada contra prod ni preview.
- La exportación financiera en una pestaña vieja: leída, sin ejecutar.
