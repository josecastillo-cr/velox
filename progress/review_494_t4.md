# Revisión 494, tanda 4 (familia analítica)

Rama `feat/494-t4-analitica`, HEAD `c01fdd2f5`, base `d216c45b`. Revisado el 2026-11-04.
MCP `codebase-memory` sin conexión (*connection timed out*): medido con `git grep` y leyendo los archivos.
No se corrió el gate completo ni el rápido (indicación del leader). Nada contra prod ni preview.

**Veredicto: OK con menores.** Ningún bloqueante. El hallazgo M1 no frena el merge a `dev`, pero sí tiene que estar decidido antes de la release.

## Checklist

| Punto | Resultado | Cómo se comprobó |
| --- | --- | --- |
| Trazabilidad R5, R6, R9, R16 | OK | Tests leídos y mutados. R6 con matiz (M3) |
| Tasks T5.1 a T5.5 | OK | Las 5 con `[x]` |
| `tsc` | OK | `TSC_EXIT=0`, 0 errores |
| Tests tocados de la tanda | OK | 256 de 256 antes y después de mutar, 0 saltados |
| Guardias 494 y 493, `publicacion-api-key`, `dinero-productos.int`, `caja-iva-488`, `ProductosTablaDinero` | OK | 160 pasan, 3 `todo`, contra Postgres |
| 415 y `orden-nota`, aislados | OK | 11 de 11 y 16 de 16 |
| Tabla de renombrado | OK | 51 archivos: 39 idénticos a aplicar la tabla, y los otros 12 son los escritos a mano más el trinquete. Ninguna cifra movida |
| RLS, webhooks nuevos, migraciones | No aplica | El diff no trae tablas, webhooks ni migraciones |
| Secretos e identificables | OK | Sin rutas `C:/Users`, URLs de base, JWT, tokens, correos ni nombres de clientes en las líneas añadidas. Las cifras de `impl_494.md` son de la base local |
| Gate, `progress/history.md`, E2E | Fuera de esta revisión | Son del leader y del cierre de la ficha; E2E inaplicable por decisión del humano |

## 1. Dinero en analítica: sin lectura muda

- **Alias:** `git grep -i` de `AS` con `empresa` u `ordenex` en `lib` y `app` da 0. Confirmado lo del implementador. `cobro_ordenex` solo sobrevive en la tabla del script, `scripts/marca-494-renombrar.mjs:140`. `cobro_empresa` solo es alias en un test.
- **`$queryRaw` de dinero:** `DineroProductosRepository.ts:222` tiene `FilaCruda` tipada y su `SELECT` no lleva ninguna columna de la marca. `empresa` se calcula en `lib/utils/dinero-por-producto.ts:265`, no sale de SQL.
- **Lecturas con el nombre viejo:** `.ordenex`, `ordenex:`, `["ordenex"]` y `ordenexPista` dan 0 en `lib`, `app`, `components` y `hooks`, salvo las claves legadas y un comentario. Sin `as any` ni `as unknown` en los seis archivos de dinero.
- **Accesos dinámicos:** `liquidado[`, `reparto[` y `totales[` solo dan `PanelConciliacion.tsx:119` y el rollup, que no llevan campos renombrados. `MIN_DINERO` es un `Record` de `IdDinero`, con clave cerrada.
- **Archivo:** mutar la clave de la fila a `ordenex`, la celda vacía muda, deja 5 rojos, entre ellos R68. Mutar a `?? "0.00"` deja 2 (R70). Leer la cifra de la tienda deja 2.
- **`ganancia_empresa`:** ningún literal en `app`. El tablero recorre el catálogo. Mutar `r.ganancia` a `r.enCaja` deja 4 rojos solo con los unitarios, con literales.

## 2. Contrato público: sin cambios, y el test tiene un hueco real (M3)

`git diff d216c45b...HEAD -- docs app/api lib/api lib/types/api-* public` sale vacío. `package.json` no tiene `prom-client`, Prometheus ni OpenTelemetry: no hay métricas de ese tipo.

`contrato-sin-cambios-494.test.ts` sí mira algo real: rutas, 36 esquemas y métricas son literales, comparados contra el objeto y contra el `.yaml`, sin aserción contra su propia fuente. Pero es la declaración.

| Mutación | Contrato 494 | Red ya existente |
| --- | --- | --- |
| `WebhookEstadoService` renombra `numRemision` en el `data` | **0 de 9 rojos** | 1 de 5 en `integration/db/455/caracterizacion/webhook-estado.test.ts` |
| `ApiOrdenLecturaService` renombra `numRemision` | **0 de 9 rojos** | 2 de 23 en `ordenes-api-key-listado.route.test.ts` |

**Es un hueco del test, no del sistema.** R6 está atado por tests que su mapa no nombra. `WebhookEventoOrdenService` no se mutó. En esta tanda no hay riesgo: el diff no toca serializadores y el script no puede renombrar un campo que no contiene la marca.

## 3. Caché: correcto

- **Entrada vieja:** `claveDeConteoProductos` compone con `conteo-productos:v2` (`productos-consulta.ts:279,302`) y `unstable_cache` recibe esa clave (`next-analitica-cache.ts:67`). El código nuevo no puede leer la clave vieja. Con una vuelta atrás el código viejo lee su clave con su forma. Mutar el prefijo deja 3 de 3 rojos en R9.
- **Otros usos de `envolver`:** son 12 en total, 11 aparte de productos. Coincide con la tabla del implementador.
- **Los que devuelven dinero:** además de productos, ninguno. `tablero-dia.ts` no tiene monto, importe, recaudo, ganancia ni cobro. Los demás son conteos.
- **Tipos transitivos:** `tablero-dia`, `cohorte-carga` y `conteo-entregas` alcanzan `lib/types/orden.ts` y `tarifa.ts`, que sí cambiaron desde `519740e5`. Leído el diff: solo dos comentarios.
- **Otras cachés:** `unstable_cache` solo vive en los tres adaptadores; sin `"use cache"`. SWR vive en memoria: sin `provider`, sin IndexedDB, sin `SWRConfig` que persista. El service worker no guarda las respuestas de las actions.
- **Data Cache de Vercel:** sin medir, y no hace falta: el prefijo cubre los dos casos.

## 4. `traducir` y R16: correcto

**Idempotente: sí.** Sin `ordenex` en las listas devuelve el mismo string. Tras traducir no queda nada que cambiar. Si conviven `ordenex` y `empresa` sale `["empresa","empresa"]`, y `clavesUtiles` deduplica con `Set` (`preferencia-columnas.ts:121`). La mutación que deja la vieja y añade la nueva da 7 rojos.

**La afirmación del implementador es correcta.** Sin `traducir` en el camino de la vieja, la primera lectura deja el valor sin traducir bajo `app:` y la siguiente lo traduce por el otro camino. Solo un test de una sola lectura lo ve: la mutación deja 2 rojos, `la primera lectura ya sale traducida` y uno de `migrar-clave`.

| Caso | Qué pasa | Pérdida |
| --- | --- | --- |
| Dos pestañas nuevas | La segunda lee lo traducido. No hay escritura en bucle: solo se escribe si cambió | Ninguna |
| Pestaña de `origin/prod` y pestaña nueva | La vieja lee `ordenex:` (`origin/prod:lib/columnas/preferencia-columnas.ts:70`), que la nueva ya borró, y enseña la columna. Si toca el selector escribe `ordenex:`; la nueva lee las dos, gana `app:` y borra la vieja (R15) | Solo lo tocado en la pestaña vieja. `app:` queda intacta |
| Vuelta atrás a `origin/prod` | Lee `ordenex:`, borrada: sin preferencia mientras dure. Al volver a desplegar, `app:` sigue ahí | No permanente. Afecta a las 5 familias, viene de la tanda 1 |
| Vuelta atrás a una versión de `dev` con `app:` y catálogo viejo | `empresa` no está publicada y la columna sale. Si toca el selector, reescribe sin la oculta | La oculta, solo si toca el selector |

El último es el único caso que pierde la preferencia, y no se da en la release a `prod` (M5).

## 5. Cruce de versiones

**Leído**, en `origin/prod` (`b8a9cf432`) y en el código de Next 16.2.10, la misma versión en las dos ramas:

1. `ProductosTabla.tsx:1057-1063`: las filas salen de `useSWR`, por `consultarConteoProductosSwr`, de la Server Action `consultarConteoProductos`. No salen del RSC.
2. `analitica-productos-descarga-columnas.ts:304`: `ordenex: dinero?.liquidado.ordenex ?? null`. Con la respuesta nueva da `null`.
3. `ProductosTabla.tsx:1131`: el archivo sale de `filasLocales(filas, ...)`, sin consulta propia. `null` es celda vacía (R70).
4. `server-action-reducer.js:140`: `actionResult = response.a`, siempre. Las líneas 150-156 solo descartan el `flightData` si el build difiere: **el resultado de la action llega a la pestaña vieja**.
5. `server-action-reducer.js:76-78`: si el id no existe en el servidor, lanza `UnrecognizedActionError`. Fallo visible.
6. `encryption-utils-server.js:28` y `webpack-config.js:417,443`: la sal del id es la clave de cifrado, guardada en `.rscinfo` dentro de la caché de build, con 14 días de vida, salvo que `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` la fije.

**Por tanto es correcto, con una condición que el informe del implementador no decía:** solo las filas pedidas **después** del despliegue llegan con la forma nueva. Lo ya cargado sigue en memoria con `ordenex`, y su archivo sale bien. `revalidateOnFocus: false` (línea 1063): volver a la pestaña no basta. Hace falta cambiar el filtro o pulsar actualizar. Además solo les pasa a los roles con dinero concedido.

**Supuesto, sin medir:**

- Que Vercel restaure `.next/cache` entre builds, y con ello que los ids sobrevivan.
- Que el id dependa del archivo y del nombre exportado. Viene del transform de SWC, en Rust, y no se puede leer en `node_modules`.
- Que SWR conserve `data` tras un error, y que revalide al reconectar.
- Skew Protection del proyecto: no hay configuración en el repo.

**Cambia lo de §3.2?** No su base: sin alias, y medir. Sí dos cosas:

- La línea `design.md:98` dice que el daño dura «hasta recargar», y el archivo guardado no. Desplegar fuera de la operación reduce la probabilidad, pero avisar no arregla un archivo ya bajado. Habría que decir a quien descargó en esa ventana que lo baje otra vez.
- La medición propuesta (`design.md:100`, comparar ids entre dos previews) no predice la release: la sal caduca a los 14 días y depende de la caché de build. Dos previews iguales hoy no garantizan nada del despliegue a `prod`. Solo Skew Protection activa da una respuesta firme.

**Salida barata:** renombrar las dos actions que devuelven el DTO, `consultarConteoProductos` (`lib/actions/conteo-productos.ts:80`) y `consultarDetalleDineroProducto` (`lib/actions/detalle-dinero-producto.ts:66`), con un sufijo sin marca.

- El id viejo deja de existir y la pestaña vieja recibe el error de la línea 76-78: la tabla dice que no pudo cargar, y lo ya cargado se queda con `ordenex`, con su archivo correcto.
- Sin alias, sin excepción de la guardia y sin depender de la medición.
- También quita el «abrir fila lanza» y cubre la vuelta atrás al revés: pestaña nueva y servidor viejo daría el mismo archivo vacío con `liquidado.empresa`, leído por simetría.
- Coste: 2 exports, 2 imports y los mocks de 14 archivos de test como máximo (8 y 6 por grep, sin deduplicar).
- Hay que comprobar el cambio de id en un build, porque esa parte es supuesto.

Se recomienda esta salida, pero **lo decide el humano**, como ya dice §3.2.

## 6. Tests

Arnés propio: patrón una sola vez, archivo cambiado, más de 0 tests y bytes restaurados por hash. Árbol limpio al terminar. Base 256 de 256 antes y después.

| Mutación | Tests | Rojos |
| --- | --- | --- |
| R16 sin `traducir` en la vieja | 50 | 2 |
| R16 sin `traducir` en `app:` | 50 | 11 |
| R16 no idempotente | 50 | 7 |
| R16 ámbito equivocado en la tabla | 50 | 13 |
| R15 no borra la vieja | 50 | 3 |
| R9 prefijo viejo | 3 | 3 |
| R5 la ganancia lee la caja | 167 | 4 |
| Archivo lee la tienda | 36 | 2 |
| Archivo con `0.00` | 36 | 2 |
| Archivo con clave vieja | 36 | 5 |
| R6 webhook, en el contrato | 9 | **0, sobrevive** |
| R6 lectura API, en el contrato | 9 | **0, sobrevive** |
| Etiqueta «Cobró» del panel cambia | 131 | **0, sobrevive** |
| Etiqueta «Cobró» de los totales cambia | 131 | **0, sobrevive** |

R5, R9 y R16 detectan el fallo y sus literales no salen del código. Las dos últimas filas son **aserciones contra su propia fuente** (M4): corrieron `ProductosTablaDinero`, `DineroIdentidadesEnPantalla`, `etiquetas-visibles`, `marca-fuente-unica-493` y `detalle-dinero-producto`. No se corrió toda la suite, así que otro archivo podría cazarlas; una búsqueda de texto no encuentra ningún otro literal de esa etiqueta en pantalla.

## 7. Intermitentes del gate

Sin relación con esta tanda. `costo-y-zona-api-415`: 11 de 11. `orden-nota-migration`: 16 de 16. Una corrida aislada de cada uno.

Cierre de imports de la 415: 101 módulos alcanzados y **0 de los 13** archivos de producción del diff. El test usa `ApiOrdenLecturaService`, `OrdenRepository` y `TarifaVigenteRepository`, y ninguno cambia.

No tuve el log del gate, así que la causa del rojo no está vista. Que caigan los 11 a la vez apunta al arranque o a la base compartida, pero es suposición.

## Hallazgos

| Id | Gravedad | Dónde | Qué |
| --- | --- | --- | --- |
| M1 | menor, **a decidir antes de la release** | `design.md:98-101` | El archivo vacío está bien descrito, pero «hasta recargar» no lo cubre y avisar no lo arregla. Hay salida barata (punto 5) |
| M2 | menor | `design.md:100` | Comparar ids entre dos previews no predice la release: sal con caducidad de 14 días y ligada a la caché de build. Medir Skew Protection, o fijar la clave, o renombrar |
| M3 | menor | `tests/unit/api/contrato-sin-cambios-494.test.ts:187-188`, `progress/impl_494.md:953` | «El código que arma lo público» no incluye `lib/services/Webhook*`, `lib/services/ApiOrden*` ni los lectores. Añadirlos al barrido y citar los dos tests que sí ven la salida en el mapa de R6 |
| M4 | menor | `tests/components/ProductosTablaDinero.test.tsx:232,344`, `ProductosTabla.tsx:250`, `DineroProductoDetalle.tsx:85` | La etiqueta en pantalla se busca con su constante: cambiarla deja todo verde. Es lo que R4 protege. Hay literal en el archivo y T5.5 la vio igual, pero en pantalla no queda nada que la ate. Anterior a la tanda |
| M5 | menor | `progress/impl_494.md:786,916` | Analiza una pestaña vieja que lee `app:`, y eso es `dev`. La de la release es `origin/prod`, que lee `ordenex:` y nunca pisa `app:`. La conclusión es peor de lo real para `prod`. La rama de la vuelta atrás, igual. Corregir el texto |
| M6 | menor | `scripts/marca-494-renombrar.mjs:239-241`, `progress/impl_494.md:740` | El modo de comprobar de la familia analítica sale hoy con **exit 1** y aborta sin escribir, porque `contrato-sin-cambios-494.test.ts` lleva `ganancia_ordenex`. El `COMPROBAR_EXIT=0` anotado es anterior a ese test. No hay daño: aborta, y al regenerar tras un rebase ese archivo no está. Anotarlo |

## Lo que no se comprobó

- T5.5 no se repitió en navegador. Se da por buena su tabla, con los controles que describe.
- La pestaña vieja no se ejecutó: leída en `origin/prod`. El implementador la midió con `origin/dev`, y las líneas son las mismas.
- `tests/integration/db` entera y `vitest related`: son del gate del leader.
- `WebhookEventoOrdenService` no se mutó.
