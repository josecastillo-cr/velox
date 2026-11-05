# 494 — Marca en identificadores internos: implementación

## T0.1 — Respuestas

P1-P5: valores por defecto, aceptados por el humano el 2026-11-04.

## T0.2 / T6.0 — Medición en producción (design §4), 2026-11-04

Corrida por el leader con el MCP `supabase`, confirmado con `get_project_url` que no es preview. Solo lectura. El detalle identificable no se versiona: el repo es público.

- **Q1 (catálogo):** 0 filas. Se sostiene la premisa de R13.
- **Q2 (filas):** `filas_con_valor` = 0 en todas las columnas. **Sin migración; R10 no aplica.**
  `filas_con_marca` > 0, todo dato que no se toca:

  | Tabla.columna | Filas con la marca |
  | --- | --- |
  | `chat_mensaje.cuerpo` | 12.943 |
  | `chat_mensaje.contactos_json` | 3 |
  | `login_attempt.email_usado` | 491 |
  | `historial_accion.actor_nombre` | 220 |
  | `whatsapp_envio_ejecucion.plantilla_nombre` | 89 |
  | `wallet_movimiento.descripcion` | 13 |
  | `wallet_anotacion.contraparte_nombre` | 9 |
  | `whatsapp_envio_entrega.destinatario_nombre` | 9 |
  | `liquidacion_pago.nota` | 3 |
  | `plantilla_mensaje.nombre` | 3 |
  | `usuario.email` | 3 |
  | `cobro_tienda_anulacion.motivo` | 2 |
  | `plantilla_mensaje.cuerpo` | 2 |
  | `webhook_suscripcion.url` | 1 |

  La URL del webhook apunta a un host de terceros: es de quien la registró, no se toca.
- **Q3 (plantillas):**
  - Activas: `alerta_transito_ordenex` (informe `transito`) y `picking_bodega_ordenex` (informe `picking`), ambas con documento y sin la marca en el cuerpo.
  - Borradas: `ordenex_en_camino` (2026-08-28) y «Plantilla APP vieja» (2026-09-01), con la marca en el cuerpo.
  - `prueba_envios_ordenex` no aparece.
- **Q4 (dependencias):**
  - 5 envíos encendidos: 1 de tránsito y 4 de picking, uno por tienda.
  - Ejecuciones, todas `completada`: 24 de tránsito (última 2026-11-04 11:00) y 65 de picking (última 2026-11-04 12:01).
  - **Las plantillas están en uso diario:** el cambio de `plantilla_mensaje.nombre` no puede dejar una ventana sin plantilla aprobada.
- **Q5 (cuentas):** 3 activas, 1 `@ordenex.co` (cuenta de pruebas de mensajero) y 2 de Gmail con «ordenex» en la dirección. Son credenciales de acceso: no se tocan (R30). Ninguna `@ordenex.test`.

## T0.3 — Línea de base, 2026-11-04

MCP `codebase-memory` sin conexión (*connection timed out*): medido con `grep` y con un script sobre `git ls-files`.

- **SHA:** `origin/dev` = `981473d7a6dca2d21330b4da110dd0f1aee8400b`. Rama `feat/494-t0-red` en el worktree `R:/w494`.
- **501 mergeada** (`8aec2119`, #885), ancestro de `origin/dev`. Archivos sin contar specs ni progress:
  `components/shared/liquidacion/PagosRegistradosTabla.tsx`, `components/shared/liquidacion/pagos-registrados-descarga-columnas.ts`,
  `tests/components/PagosRegistradosTabla.test.tsx`, `tests/unit/descarga/pagos-registrados-descarga-columnas.test.ts`,
  `tests/unit/guards/cierres-fecha-cr-495.guardia.test.ts`.
- **502 mergeada** (`5ea9eb71`, #886), ancestro de `origin/dev`. Archivos sin contar specs ni progress:
  `app/(app)/cierres-admin/_components/cierre-labels.ts`, `components/shared/conciliacion/ConciliacionAcciones.tsx`,
  `components/shared/conciliacion/conciliacion-labels.ts`, `docs/ayuda/oficina/wallet-satelites.md`,
  `tests/components/CierresBodegaAdminDebe498.test.tsx`, `tests/components/Conciliacion498.test.tsx`,
  `tests/components/ConciliacionAcciones502.test.tsx`, `tests/integration/db/502-corregir-de-mas-sql-real.test.ts`,
  `tests/integration/db/zona-distrito-rastro-500.test.ts`, `tests/integration/wallet-satelites.test.tsx`,
  `tests/unit/docs/ayuda-wallet-satelites-498.test.ts`.

  Las dos ya están en la base de la ficha, así que el censo y el trinquete las incluyen.
- **R27 ya cubierto, no hay que añadir nada:** `tests/unit/plantillas/plantilla-sync-solo-estados.test.ts:62` («un template que no existe aqui NO se crea: se ignora y ya», servicio) y `:189` («sin fila local -> `inexistente`, sin escribir nada», repositorio).
- **Lista literal para R6** (T5.4), tomada de `docs/api/api-key-openapi.yaml`, abajo en «Contrato para R6».

## Tanda 0 (T1.1–T1.4), 2026-11-04

### Archivos

Creados:

- `tests/fixtures/marca-sin-ordenex-494.ts`: detector, recorrido, excepciones, trinquete, emisión de censo y trinquete.
- `tests/fixtures/marca-pendientes-494.ts`: trinquete generado.
- `tests/unit/guards/marca-sin-ordenex-494.guardia.test.ts`: los ocho bloques de design §7.
- `progress/censo_marca_494.md`: censo generado.
- `scripts/marca-494-renombrar.mjs`: script por familias.

Modificado: `tests/fixtures/marca-retirada-493.ts` (3 archivos más en `PROPIOS`, porque el bloque R16 de la 493 los lee y contienen la marca a propósito).

### Decisiones técnicas que el spec no fijaba

1. **`OrdenExistente`, `ordenExigido`, `ordenExacta` no son la marca.** `/ordenex/i` los ve (18 apariciones). El detector descarta `[Oo]rdenEx[a-z]`, con contraprueba. Se aparta de la letra del glosario («la cadena, sin distinguir mayúsculas»); renombrarlos sería tocar código ajeno y ninguno aparece en la tabla.
2. **E9, entrada nueva en la lista cerrada.** El trinquete lista rutas con la marca y el script lleva la tabla: no pueden contarse a sí mismos, y §7 no los tenía previstos. T8.2 los borra junto con la entrada.
3. **E4, E5, E6 y E8 están declaradas y no activas** (`activaEn`: T7.1, T2.5, T7.2, T5.4). Sus archivos aún no existen o no tienen la forma final; hasta entonces no exceptúan nada, y lo suyo cuenta en el trinquete. Un `it.todo` obliga a T8.2 a comprobar que no queda ninguna sin activar.
4. **Bloques con árbol diferido a su tarea:** R20 (T2.5) y R31/R32 (T7.3, T7.4, T7.6). Hoy serían rojos por definición. Detector y contraprueba ya están activos; lo del árbol va en `it.todo`. R11, R24, R26, R28 y R30 ya miran el árbol.
5. **El trinquete es exacto en las dos direcciones**, como el de la 493: subir pone rojo, y bajar sin regenerar también (si no, quedaría hueco para volver a subir). Regenerar: `pnpm exec tsx tests/fixtures/marca-sin-ordenex-494.ts pendientes`.
6. **Filas añadidas a la tabla del script, que §3.1 no tenía:** `TARIFA_ORDENEX` (cierres); `SOLO_ORDENEX`, `ORDENEX_PAGA`, `DESDE_ORDENEX`, `OTROS_EGRESOS_DE_ORDENEX` (caja); `cobro_ordenex` (analítica); `bienvenida_ordenex` (comentarios). Todas son locales de tests o datos de prueba: ninguna cambia el contrato de la tabla. Además, en caja, `ordenex:resto` y `ordenex:todo` (aserciones de la barra).
7. **«Aborta si el destino existe» solo mientras quede el nombre viejo.** Si no, la segunda pasada abortaría y el script no se podría repetir. Con `--parcial` (rama ajena que mergeó `dev`, §10.5) la colisión se busca solo dentro de cada archivo. Para el `empresa` suelto solo cuenta la forma de código: `empresa` en prosa no choca con nada, y hay 69 líneas.
8. **`bienvenida_ordenex`** es una plantilla inventada de `tests/integration/api/procesar-jobs-whatsapp-bienvenida.test.ts`, no de Meta. El bloque R26 mira los nombres de §8 y Q3, no ese; lo limpia T8.1.

### T1.3 — Censo y colisión

**Sin colisión con la tabla de `design.md §3.1`.** Destino de identificadores: 0. `empresa` con forma de código: 0. Destino de navegador (`app:…`, `app_tema`): 0. `empresa`/`EMPRESA` en prosa: 69 líneas en 41 archivos, entre ellas las 9 de `cierre-factura.tsx` que §3.1 mandaba clasificar, y son comentarios. Detalle en `progress/censo_marca_494.md`.

**Trinquete: 2.365 apariciones en 556 archivos.** El spec medía 2.277 en 558 sobre `519740e5`. Las diferencias conocidas: otra base, y aquí cuentan `docs/`, `.claude/commands/` y la raíz, sin E7 ni falsos positivos. No se cuadró el detalle: la cifra que vale es la del trinquete.

Identificadores que ni la tabla ni el script tapan, todos con su tarea: `esDestinoLocalOrdenex` (10, T7.1), `ordenex_prod` (7, T7.1), `ordenex_tema` (3, tanda 1), `ordenex_`, `ordenex_455` y `ordenex_459` (T7.1 y T8.1).

**Para T8.1:** el script no resuelve las negativas `/ordenex/i` ni las cabeceras `X-Ordenex-*`: van a mano, contra el fixture de §3.5.

### Contrapruebas, ejecutadas de verdad y restauradas

Script en el scratchpad; salida en `progress/494_contrapruebas.log` (ignorado por git).

| Mutación | Tarea | Resultado |
| --- | --- | --- |
| Base sin mutar | | `exit=0`, 29 passed, 4 todo |
| Quitar `/i` del detector | T1.1 | **`exit=1`, 6 failed**: 4 del detector, excepciones y trinquete (`DESIGN.md: 0 (anotado 1)`) |
| E7 apunta a un archivo que no existe | T1.1 | **`exit=1`, 2 failed**: `E7: tests/fixtures/no-existe-494.ts ya no coincide con ninguna aparicion` |
| `// ordenex` en un archivo limpio, `lib/marca/identidad.ts` | T1.2 | **`exit=1`, 1 failed**: `lib/marca/identidad.ts: 1 (no esta en lo pendiente)` |
| Una aparición más en uno pendiente, `lib/utils/ingreso-ordenex.ts` | T1.2 | **`exit=1`, 1 failed**: `lib/utils/ingreso-ordenex.ts: 40 (su tope es 39)` |
| Una aparición menos sin regenerar, `lib/types/cotizacion.ts` | T1.2 | **`exit=1`, 1 failed**: `lib/types/cotizacion.ts: 0 (anotado 1)` |
| Base restaurada | | `exit=0`, 29 passed, 4 todo; `git status` solo con los archivos de la tanda |

### T1.4 — Script, en un worktree de prueba ya descartado

Worktree `R:/w494-prueba` en detached sobre `79b449cf`. Salida en `progress/494_t14_script.log` (ignorado por git).

| Comprobación | Resultado |
| --- | --- |
| Destino de identificador ocupado (`netoEmpresa`) | `ABORTA`, exit 1, 0 archivos modificados |
| Archivo de destino ocupado (`lib/utils/ingreso-empresa.ts`) | `ABORTA`, exit 1 |
| `empresa: 1` en un archivo de la lista | `ABORTA`, exit 1. Con `// la plata de la empresa`, no aborta |
| `--comprobar` con trabajo pendiente | exit 2, 0 archivos modificados |

| Familia | Primera pasada | Segunda pasada | `--comprobar` después |
| --- | --- | --- | --- |
| `cierres` | 2 movidos, 110 reescritos | 0 y 0, diff de 0 archivos | exit 0 |
| `caja` | 74 reescritos | 0, diff de 0 archivos | exit 0 |
| `analitica` | 42 reescritos | 0, diff de 0 archivos | exit 0 |
| `comentarios` | 382 reescritos | 0, diff de 0 archivos | exit 0 |

- **Fuera de alcance:** `db/migrations`, `specs`, `progress`, `docs`, `db/schema.prisma`, `public`, `.claude`, `CLAUDE.md` y `feature_list.json`, con 0 archivos cada uno.
- **`tsc`:** `TSC_EXIT=0` y 0 errores tras las tres familias de identificadores, y otra vez tras `comentarios`. Es señal, no el cierre de T3.1, T4.1 ni T5.1: `tsc` no ve aserciones, y no se corrieron tests en ese worktree.
- **Total:** 495 archivos, 2.030 inserciones y 2.030 borrados. `git mv` registró `R095` y `R098`.
- **Quedan 190 apariciones en 74 archivos** tras las cuatro familias, sin desglosar. Se esperan el esquema, las claves de navegador, la base local y lo que va a mano en las tandas 1, 6 y 7, pero el worktree ya no existe y eso no se comprobó.

Retirada: `cmd //c "rmdir R:\w494-prueba\node_modules"`, `R:/job/singularis/projects/ordenex/node_modules` con 48 entradas tras el `rmdir` y otra vez tras el `remove`, y `git worktree remove --force` con `RM_EXIT=0`.

### Verificación en `R:/w494`

```
$ pnpm typecheck                                    TSC_EXIT=0, 0 errores
$ pnpm lint                                         LINT_EXIT=0, 235 problems (0 errors, 235 warnings); ninguno en archivos de la tanda
$ pnpm exec eslint <los 5 archivos de código>       ESLINT_EXIT=0, sin salida
$ pnpm exec vitest run tests/unit/guards/marca-sin-ordenex-494.guardia.test.ts tests/unit/guards/marca-fuente-unica-493.guardia.test.ts
   Test Files  2 passed (2)
        Tests  48 passed | 4 todo (52)
$ pnpm exec vitest run <guardias que leen scripts/ o tests/>: marca-velox-sin-anterior, ayuda-columna-retirada, censo-order-status-rename, censo-catalogo-estados-v2, busqueda-texto-solo-lectura, clave-remision-solo-lectura, caja-173-alcance
   Test Files  7 passed (7)
        Tests  113 passed (113)
```

`./init.sh --rapido`: no corrido aquí, lo corre el leader.

### Mapa `R<n>` → test, tanda 0

Todos en `tests/unit/guards/marca-sin-ordenex-494.guardia.test.ts`.

| R | Bloque | Estado |
| --- | --- | --- |
| R1 | «arbol con trinquete» | Activo con trinquete; `it` llano en T8.2 |
| R2 | «el detector no esta roto» | Activo |
| R3 | «excepciones» | Activo; contraprueba sintética y real |
| R11, R30 | «migraciones» | Activo; hoy sin migraciones `*_494*` |
| R20 | «legado» | Detector activo; árbol, `it.todo` hasta T2.5 |
| R24, R26 | «plantillas» | Activo |
| R27 | `tests/unit/plantillas/plantilla-sync-solo-estados.test.ts:62,189` | Ya existía |
| R28 | «hosts» | Activo; el diff contra `origin/dev`, en T8.2 |
| R31, R32 | «proyecto» | Detector activo; árbol, `it.todo` hasta T7.3, T7.4 y T7.6 |

El resto de los `R<n>` se cubren en sus tandas.

**Veredicto:** Tanda 0 lista, sin colisión con la tabla y con el trinquete en 2.365; nada renombrado.

### Contrato para R6

Fuente: `docs/api/api-key-openapi.yaml` sobre `981473d7`, generado desde `lib/api/openapi-spec.ts`.

### Rutas (9)

- `GET /api/ordenes/api-key`
- `GET /api/ordenes/api-key/analitica`
- `POST /api/ordenes/api-key/carga`
- `POST /api/ordenes/api-key/carga/{cargaId}/generate`
- `POST /api/ordenes/api-key/cotizacion`
- `POST /api/ordenes/api-key/habilitar`
- `DELETE,GET /api/ordenes/api-key/orden/{id}`
- `POST /api/ordenes/api-key/orden/{id}/generate`
- `PUT /api/ordenes/api-key/{numGuia}/cancelar`

### Campos por esquema (36 esquemas, sin descender por `$ref`)

- `AnaliticaRespuesta`: desde, hasta, metricas, rango
- `AnaliticaSerie`: cobertura, corteAt, data, fecha, fechasNoComparables, metrica, parcial, penumbra, unidad, valor
- `CancelacionResponse`: estado, estadoAnterior, estadoAnteriorNombre, estadoNombre, numGuia
- `CargaFilaError`: errores, fila, numRemision, resultado
- `CargaOrden`: costoEnvio, estado, estadoNombre, fulfillment, id, numGuia, numRemision
- `CargaRequest`: ordenes
- `CargaResponse`: cargaId, conError, creadas, duplicadas, errores, filas, ordenes, total
- `CargaRow`: canton, destinatario, direccion, distrito, monto_cobrar, notas, num_remision, peso, producto, provincia, telefono
- `CargaRowResult`: estado, estadoNombre, fila, numGuia, numRemision, resultado
- `CotizacionCostos`: devuelto, entregado
- `CotizacionEscenarioDevuelto`: comision, flete, fulfillment, iva, total
- `CotizacionEscenarioEntregado`: comision, flete, fulfillment, iva, ivaComision, total
- `CotizacionFilaError`: errores, fila, numRemision, resultado
- `CotizacionRequest`: ordenes
- `CotizacionResponse`: conError, cotizadas, errores, filas, total
- `CotizacionRow`: canton, direccion, distrito, monto_cobrar, num_remision, provincia
- `CotizacionRowResult`: costos, fila, montoCobrar, numRemision, resultado
- `EliminacionResponse`: estado, estadoNombre, numGuia, numRemision
- `Error`: code, details, message, status
- `Evidencia`: contentType, expiraEnSegundos, resultado, resultadoNombre, url
- `HabilitacionRequest`: ordenes
- `HabilitacionResponse`: resultados, resumen
- `HabilitacionResumen`: conError, habilitadas, habilitadasSinCambioDeEstado, total
- `HabilitacionRow`: nota, num_guia
- `HabilitacionRowResult`: ayudaCerrada, codigo, error, estado, estadoNombre, mensaje, numGuia, resultado
- `Listado`: items, pagination
- `Mensajero`: id, nombre
- `OrdenCosto`: comision, flete, fulfillment, iva, ivaComision
- `OrdenDetalle`: evidencias, gestiones
- `OrdenGestion`: createdAt, estadoResultante, estadoResultanteNombre, mensajero, motivo, pendienteConfirmacion, resultado, resultadoNombre
- `OrdenListItem`: costoEstimado, costoReal, createdAt, destinatario, direccion, estado, estadoNombre, id, mensajero, montoCobrar, nombre, numGuia, numRemision, producto, telefonoDest, zona
- `Pagination`: limit, offset, total
- `PdfGenerateResponse`: expiraEnSegundos, url
- `WebhookOrdenEstadoActualizado`: data, estado, estadoNombre, evento, eventoId, evidenciasUrl, id, mensajero, motivo, nombre, numGuia, numRemision, ocurridoAt
- `WebhookOrdenEvento`: data, evento, eventoId, gestionId, id, mensajero, motivo, nombre, numGuia, numRemision, ocurridoAt, pendienteConfirmacion, resultado, resultadoAnterior, resultadoAnteriorNombre, resultadoNombre, via
- `Zona`: id, nombre

Total: 96 nombres de campo distintos. Con la marca retirada: 0.

### Rojo del gate de la tanda 0: `no-embalaje`

El gate del leader (`progress/gate_494_t0.log`) cayó en `tests/unit/guards/no-embalaje.test.ts`: el trinquete cita la ruta de esa guardia y el nombre del archivo cuenta como referencia. No lo vi antes porque corrí las guardias vecinas por lista, no `vitest run guard`, y esta no estaba en la lista. Arreglo: alta por archivo en su `WHITELIST_FILES`; T8.2 la retira.

Al anotarlo en T8.2 con el nombre de la guardia, el propio `tasks.md` volvió a ponerla roja, porque también lee `specs/`. T8.2 la describe sin nombrarla. El trinquete se regeneró sin cambios: 2.365 en 556.

```
$ pnpm exec vitest run guard
   Test Files  284 passed (284)
        Tests  3926 passed | 4 todo (3930)
```

## Tanda 1 (T2.1–T2.5), 2026-11-04

MCP `codebase-memory` sin conexión (*connection timed out*): medido con `grep` y leyendo los archivos.

### Punto de montaje del tema (T2.3), confirmado en el archivo

`TemaProvider` se monta en un solo sitio, `app/(app)/layout.tsx`, y envuelve todo el portal. Es `"use client"`. La migración va en un `useEffect` suyo, sin tocar el estado: el tema ya llegó bien del servidor. El layout raíz no lee la cookie (lo exige `tema-encendido.guardia`). `/login` y la landing no lo montan: la cookie vieja se queda hasta que la persona entra al portal, sin efecto, porque esas pantallas no leen el tema.

### Decisiones y desvíos

1. **§5.3, `traducir` NO se conecta en esta tanda.** El catálogo aún publica la columna con el nombre viejo (T5.1). Traducirla ya haría que `clavesUtiles` la descartara y la oculta reapareciera. El valor se copia tal cual; hay mutación que lo prueba. T5.3 conecta `traducir`.
   **Consecuencia para T5.3, anotada en `tasks.md`:** el valor ya vive bajo `app:` con el nombre viejo dentro, y `traducir` solo corre al leer la clave vieja. Con release entre la tanda 1 y la 4 (§10 prevé una sola, tras la 7) habría que traducir también lo guardado bajo `app:`. `preferencias-494.test.tsx` sale rojo al renombrar la columna: es el aviso.
2. **E5 se parte en E5 y E5.1.** El fixture tenía `public/sw.js` entero exceptuado, y §7 dice «los alias». E5.1 es por línea (`"ordenex:<nombre de alias>"`) y cubre `public/sw.js`, `pwa-relevo-y-purga.guardia` y `usePushEnVentana.test`: cualquier otra aparición en esos archivos sigue contando. Con contraprueba.
3. **`claveViejaDe` y `leerConLegado`, además de la firma de §5.2.** `leerCrudo` solo recibe la clave nueva, sin saber de qué familia es.
4. **R20 también mira `providers/`**, que no está en el árbol del glosario pero corre en el navegador y monta la migración de la cookie.
5. **El detector de R20 no ve una constante importada.** `hallazgosLegado` busca constantes del mismo archivo, así que no detectaría una escritura a `document.cookie` con `COOKIE_TEMA_VIEJA` fuera del módulo; es lo que permite a `preferencia-tema.ts` caducarla. Dentro del módulo sí sale rojo (mutación abajo). Lo cubre `cookie-legada-494.test.ts`: lo único que se escribe a la vieja es su caducidad.
6. **Nueva con basura y vieja válida: gana la vieja**, en servidor y cliente. §5.4 dice «nueva, si no vieja, ya normalizada».
7. **Comentarios con la clave vieja reescritos aquí** (`cierres-bodega-descarga-columnas.ts`, `ordenes-descarga-columnas.ts`, `usePreferenciaColumnas.ts`): el script de la tanda 7 deja fuera el prefijo a propósito.

### Una combinación que §5.5 no lista

**SW nuevo → página vieja (push).** Tras el relevo, otra pestaña aún vieja queda controlada por el SW nuevo y recibe `app:push-recibido`, que no entiende: no revalida al instante (el sondeo de 60 s la alcanza) y puede sonar dos veces. El SW no manda los dos nombres, porque la página nueva revalidaría dos veces (`pwa-push.guardia` lo fija). Dura hasta que esa pestaña recargue, y `AvisoVersionNueva` ya lo pide. Se acepta, como las otras filas de esa tabla.

### Trinquete

```
$ pnpm exec tsx tests/fixtures/marca-sin-ordenex-494.ts pendientes
antes  2.365 en 556 archivos (origin/dev 32dae01e)
ahora  2.311 en 531 archivos
comparado por archivo: 0 nuevos, 0 suben, 30 bajan
```

### Mutaciones, ejecutadas de verdad y restauradas

Script en el scratchpad; salida en `progress/494_t1_mutaciones.log` (ignorado por git). Cada una comprueba que el archivo cambió, lee `numTotalTests` del JSON de vitest y aborta si es 0. Se restaura con `git checkout` sobre un árbol commiteado.

| Mutación | Tests ejecutados | Rojos | Rojo que importa |
| --- | --- | --- | --- |
| Base sin mutar | 182 | 0 | exit=0 (3 todo) |
| **T2.4** Quitar el alias de relevo de `sw.js` | 31 | 1 | `el mensaje de relevo VIEJO dispara skipWaiting` |
| Alias convertido en prefijo | 31 | 4 | `solo el mensaje del usuario pide el relevo`, `el alias es ese mensaje y no un prefijo` |
| Quitar el alias de página lista | 31 | 1 | `ordenex:pagina-lista reintenta la purga` |
| Tag vuelve al nombre viejo | 21 | 1 | `R41: la etiqueta se deriva del evento` |
| La página deja de aceptar el push viejo | 14 | 1 | `R22: el mensaje del service worker de la versión anterior` |
| **T2.5** `setItem` sintético con clave vieja en `preferencia-sonido.ts` | 35 | 2 | `T2.5: ningun archivo … tiene hallazgos de legado` y el trinquete |
| `document.cookie` con la vieja, en el módulo | 35 | 1 | `T2.5: ningun archivo …` |
| Falla la escritura y aun así se borra la vieja | 19 | 1 | `solo falla la escritura` |
| `leerCrudo` vuelve a `getItem` directo | 11 | 5 | los de columnas |
| SINPE vuelve a `getItem` directo | 11 | 1 | `R18: con la marca vieja no vuelve a salir` |
| §5.3: traducir la columna ya, con el catálogo de hoy | 11 | 1 | `la columna oculta sigue oculta tras migrar` |
| El servidor deja de leer la cookie vieja | 39 | 2 | `R17: quien solo tiene la cookie con el nombre anterior` |
| `TemaProvider` deja de migrar | 12 | 1 | `montarlo traslada la cookie` |
| Base restaurada | 182 | 0 | exit=0; `git status` limpio |

Supervivientes: 0 de 13.

### Service worker en un navegador de verdad

En `localhost` el SW se autodestruye, pero `*.localhost` es contexto seguro y no cuenta como tal. Sonda en el scratchpad: el `sw.js` de `origin/dev` y el de la rama servidos en `http://velox.localhost:3495` a Chromium real, con páginas mínimas. Mide el protocolo, no la app. Salida en `progress/494_t1_sw_real.log` (ignorado).

| Montaje | Mensaje a `reg.waiting` | Resultado |
| --- | --- | --- |
| SW viejo activo, SW nuevo en espera | `ordenex:cualquier-otra-cosa` | Sigue en espera, 0 relevos |
| Igual | `ordenex:pagina-lista` | Sigue en espera, 0 relevos |
| Igual | `ordenex:relevo-ahora` | **Releva**, 1 `controllerchange` |
| Igual | `app:relevo-ahora` | **Releva**, 1 `controllerchange` |
| **Control:** SW sin el alias en espera | `ordenex:relevo-ahora` | **Se queda en espera**, 0 relevos: la trampa de §5.5 existe |
| SW nuevo activo, push real por CDP | — | Notificación con tag `app:cierre_dia_vencido`; la ventana visible recibe `{tipo: "app:push-recibido"}` |

### La app, con las claves viejas sembradas

`next dev --webpack -p 3494`, Chromium con `colorScheme: light` (si sale oscuro, no viene del sistema), cuenta `admin.qa` con el `QA_PASSWORD` del `.env`. Sin seeds ni rotación. Tras el login se borró lo nuevo y se sembró solo lo viejo.

| Qué | Sembrado | Visto |
| --- | --- | --- |
| Primer HTML del servidor | `ordenex_tema=oscuro` | `data-tema="oscuro"`, `class="contents dark"`, y la cookie sigue sin migrar |
| Tras cargar `/ordenes` | | Fondo `rgb(10, 21, 36)`; `app_tema=oscuro`, y `ordenex_tema` desaparece. Interruptor: «Tema: Oscuro. Cambiar a Claro.» |
| Cambiar el tema | | Solo `app_tema=claro` |
| Sonido | `ordenex:sonido-notificaciones=off` | `app:…=off`, vieja borrada; la campana ofrece «Activar el sonido de las notificaciones» |
| Columnas de `/ordenes` | `ocultas: [telefonoDest]`, `orden: [estatus, numGuia]` | «Teléfono del destinatario» desmarcada; «Estado» encabeza la lista; clave movida |
| **§5.3**, columnas de `/analitica` | `analitica-productos-dinero`, `ocultas: [ordenex]` | «Cobró Velox (no sumar…)» **desmarcada, y es la única**, de 21; clave movida, valor intacto |
| **R18**, aviso de SINPE | Marca aplazada dejada solo con el nombre viejo | Tras recargar el aviso no sale, y la marca pasa a `app:` |
| Consola (primera sonda, `/ordenes`, recarga y `/analitica`) | | 0 errores de hidratación ni de bucle de render |

**No se vio:**

- La app de navegación en pantalla (`ordenex:app-navegacion`): solo la lee el modal de `/mis-asignaciones`, del mensajero. La clave se queda sin migrar hasta entonces, como está previsto. Cubierta con `preferencias-494.test.tsx`.
- Columnas de manifiesto en pantalla: mismo `leerCrudo` que las de descarga, y cubiertas con el hook real.
- **PWA instalada real** con la app servida en producción: la sonda mide el `sw.js` real con páginas mínimas, no la app desplegada ni `useActualizacionPwa` pulsando el botón. Queda para T8.3 en preview.
- SW viejo real → página nueva (R22) en navegador: solo en `usePushEnVentana.test.tsx`.

**Limpieza.** Los 6 logins de las sondas dejaron 6 filas en `login_attempt` y 6 en `Session`, y 0 en `historial_accion`. Borradas por id y recontadas: 0. Servidor matado, log borrado (estaba fuera del repo), `.next/dev` borrado.

### Verificación

```
$ pnpm typecheck                                 TSC_EXIT=0, 0 errores
$ pnpm lint                                      LINT_EXIT=0, 235 problems (0 errors, 235 warnings), el mismo número que en la tanda 0
$ pnpm exec vitest related --run <17 archivos>   RELATED_EXIT=0
   Test Files  340 passed (340)
        Tests  4786 passed | 26 skipped (4812)
$ pnpm exec vitest run guard                     GUARD_EXIT=0
   Test Files  284 passed (284)
        Tests  3936 passed | 3 todo (3939)
```

Las dos guardias a mano van dentro de `run guard`, y también se corrieron solas durante la tanda. Los 26 `skipped` son casos sueltos, ningún archivo entero; no se desglosaron. `./init.sh --rapido`: no corrido aquí, lo corre el leader.

### Mapa `R<n>` → test, tanda 1

| R | Test |
| --- | --- |
| R14 | `tests/unit/navegador/migrar-clave-494.test.ts` (módulo) y `tests/unit/navegador/preferencias-494.test.tsx` (lectores reales) |
| R15 | `migrar-clave-494.test.ts`; cookie, en `tests/unit/tema/cookie-legada-494.test.ts` y `tests/components/AppLayout.test.tsx` |
| R16 | **T5.3.** Hoy `preferencias-494.test.tsx` fija lo contrario a propósito: con el catálogo actual, no se traduce |
| R17 | `AppLayout.test.tsx` (primer render de servidor), `cookie-legada-494.test.ts` (montaje), `tests/unit/guards/tema-encendido.guardia.test.ts` |
| R18 | `preferencias-494.test.tsx` |
| R19 | `migrar-clave-494.test.ts`; cookie, en `cookie-legada-494.test.ts` |
| R20 | `tests/unit/guards/marca-sin-ordenex-494.guardia.test.ts`, bloque «legado», ya con el árbol; `cookie-legada-494.test.ts` |
| R21 | `tests/unit/guards/pwa-relevo-y-purga.guardia.test.ts` |
| R22 | `tests/unit/hooks/usePushEnVentana.test.tsx`, `tests/unit/guards/pwa-push.guardia.test.ts` |
| R23 | `pwa-push.guardia.test.ts` (R41 de la 410, con los nombres nuevos a mano) |

**Veredicto:** Tanda 1 lista; las preferencias se leen con la clave vieja y migran, y el relevo con SW viejo y página vieja funciona en Chromium real.

### Hallazgos de `progress/review_494_t1.md`, cerrados antes del PR

**M1 (R20), guardia.** Corrige el punto 5 de «Decisiones y desvíos»: el hueco era más ancho de lo declarado y `cookie-legada-494.test.ts` no lo cubría. `hallazgosLegado` ahora:

- Trata como clave vieja `COOKIE_TEMA_VIEJA`, `claveViejaDe` y `MENSAJE_*_LEGADO` en cualquier escritura, también dentro del módulo y de `public/sw.js`. Leerlos sigue permitido.
- Cuenta como escritura `setItem`, `document.cookie`, `.set(` (cookies de `next/headers`) y `postMessage`, estas dos últimas añadidas por mí.
- Sigue a las constantes del mismo archivo derivadas de esos símbolos, lee la llamada aunque ocupe varias líneas y ve el prefijo concatenado (`"ordenex:" + k`).
- Admite una sola escritura: `ESCRITURA_LEGADO_ADMITIDA`, la línea exacta de caducidad de `lib/tema/preferencia-tema.ts`. Si esa línea cambia, la guardia sale roja.

Ningún uso legítimo se quedó fuera de la guardia. Además, `preferencias-494.test.tsx` afirma que aplazar el aviso de SINPE escribe solo la clave nueva, como proponía el informe. `claveViejaDe` sigue exportada: la guardia ya la cubre y el test de familias la usa.

Mutaciones de verdad, restauradas con el contenido exacto. Salida en `progress/494_t1_m1_mutaciones.log` (ignorado por git).

| Mutación | Tests ejecutados | Rojos | Rojo |
| --- | --- | --- | --- |
| Base sin mutar | 51 | 0 | exit=0 |
| **m26 del reviewer:** `RevisionSinpeBodega.tsx` escribe con `claveViejaDe`, contra la guardia | 39 | 1 | `T2.5: ningun archivo … tiene hallazgos de legado` |
| m26, contra el test de conducta | 12 | 1 | `R20: aplazar el aviso escribe solo la clave nueva` |
| `preferencia-tema.ts` escribe un valor en la cookie vieja | 39 | 1 | `T2.5: ningun archivo …` |
| La línea admitida cambia | 39 | 2 | `la caducidad de la cookie se admite por linea exacta` y `T2.5` |
| `useActualizacionPwa.ts` manda el mensaje viejo con el símbolo importado | 39 | 1 | `T2.5: ningun archivo …` |
| `setItem` a la vieja dentro del módulo | 39 | 1 | `T2.5: ningun archivo …` |
| Base restaurada | 51 | 0 | exit=0 |

Supervivientes: 0 de 6.

**M2, spec.** T5.3 pide `traducir` también sobre lo guardado bajo `app:`, sin condición, y R16 con los dos casos; `design.md §5.3` lo dice. `traducir` sigue sin conectar.

**M3, spec.** Fila «SW nuevo → pestaña vieja» añadida a la tabla de `design.md §5.5`.

**M4:** no se toca, queda en el informe.

Trinquete regenerado sin cambios: 2.311 en 531.

```
$ pnpm exec vitest run guard                     GUARD_EXIT=0
   Test Files  284 passed (284)
        Tests  3940 passed | 3 todo (3943)
```

## Tanda 2 (T3.1–T3.4), familia cierres, 2026-11-04

MCP `codebase-memory` sin conexión (*connection timed out*): medido con `git grep` y leyendo los archivos.

### T3.1 — Script

```
$ node scripts/marca-494-renombrar.mjs --familia cierres   cierres: 2 archivos movidos, 110 reescritos. SCRIPT_EXIT=0
$ pnpm exec tsc --noEmit --incremental false               TSC_EXIT=0, 0 errores
$ pnpm lint                                                LINT_EXIT=0, 235 problems (0 errors, 235 warnings), el mismo número
$ <segunda pasada, y --comprobar>                          0 movidos, 0 reescritos; COMPROBAR_EXIT=0
```

`git mv` registró `R097` (`lib/utils/ingreso-empresa.ts`) y `R099` (su test). 577 líneas cambiadas en 110 archivos, más el trinquete.

**Ediciones a mano: ninguna.** Es la primera vez que el script ve tests (la T1.4 solo pasó `tsc`) y no hizo falta tocar ninguno.

### T3.2 — Sin polizones

Nada que arreglar. `vi.mock`, `importOriginal<typeof import(…)>` y las rutas que citan las guardias las cambió el script. `ingreso-ordenex` solo queda en:

| Dónde | Por qué se queda | Quién lo quita |
| --- | --- | --- |
| `db/migrations/20260831120000_…`, `20260907130000_…` (comentarios) | E1, fotos históricas | Nadie |
| `db/schema.prisma:2595` (comentario) | El script no toca el esquema | T7.5 |
| `scripts/marca-494-renombrar.mjs` | La tabla, E9 | T8.2 |
| `tests/fixtures/marca-retirada-493.ts`, `tests/unit/guards/marca-fuente-unica-493.guardia.test.ts`, `tests/unit/guards/marca-sin-ordenex-494.guardia.test.ts` | E7, contrapruebas | T8.2 |

Los nombres completos de la familia (`netoOrdenex`, `NETO_ORDENEX_LABEL`…) quedan solo en esos mismos archivos de E7/E9 y en `tests/fixtures/marca-sin-ordenex-494.ts`.

**No se renombró ningún valor guardado ni contrato:**

- `db/schema.prisma` no tiene campos con estos nombres.
- `docs/api/**`, `app/api/**`, `lib/api/**` y `lib/types/api-*` no los citan.
- En código de producción no aparecen como literal de cadena, ni en SQL (`AS "…"`), ni como clave de columna. La única cadena que los cita está dentro de un comentario.
- `ingresoEmpresa` se deriva al leer (`toIngresoEmpresa(g, d)` en `CierresAdminRepository`), no sale de una columna JSON.
- Ningún archivo con estos nombres en código usa `envolver`, `unstable_cache`, `localStorage` ni `JSON.stringify`. `ConteoProductosDTO` (§3.3) solo los cita en comentarios.
- Ningún archivo tocado ordena claves con `Object.keys(…).sort()`: el orden de columnas no depende de estos nombres. No hay `.snap`.

### T3.3 — Guardias estructurales

Las que leen fuentes con `fs` y citan estos nombres, corridas dentro de `vitest run guard`:

| Guardia | Pasan |
| --- | --- |
| `caja-173-alcance` | 37 |
| `cierre-bodega-vocabulario` | 33 |
| `factura-contraste` | 50 |
| `flete-por-rechazo-censo` | 4 |
| `marca-fuente-unica-493` | 19 |
| `marca-sin-ordenex-494` | 36, y 3 todo |

```
$ pnpm exec vitest run guard     GUARD_EXIT=0
   Test Files  284 passed (284)
        Tests  3940 passed | 3 todo (3943)
```

También leen fuentes con `fs`, y van en el bloque de tests tocados de abajo: `CierreBodegaDesglosePorTienda`, `CierreMensajeroDesglosePorTienda`, `CierreMensajeroDetalleCascadas`, `CierresAdminConfirmacionFisica`, `DineroIdentidadesEnPantalla`, `cierres-gestiones-fundida-descarga-columnas`, `cierres-gestiones-paridad`, `cierres-bodega-admin-service`, `tarifa-especial-por-distrito`.

### T3.4 — Importes intactos

Comprobación en el scratchpad, sobre `git diff <merge-base>...HEAD -U0 -M`, sin `specs/`, `progress/` ni el trinquete. Por cada par (quitada, puesta) mira dos cosas: **A**, los números son los mismos y en el mismo orden, sin depender de la tabla; **B**, la línea vieja más la tabla da exactamente la nueva. La B es más fuerte que lo que pide la tarea, porque el filtro por número no ve un `.minus` cambiado por `.plus`.

```
archivos 110 | pares 577 | con numero 106 | de dinero 48
A numero cambiado: 0 | B no es la tabla: 0 | hunks desiguales: 0
```

En código de producción, ninguna línea renombrada fuera de comentarios lleva un dígito: los 106 pares con número son comentarios o tests.

R4, con los tests de dinero que nombra el spec:

| Test | Pasan |
| --- | --- |
| `tests/unit/utils/ingreso-empresa.test.ts` | 61 |
| `tests/unit/utils/aporte-por-orden.test.ts` | 17 |
| `tests/integration/db/cierre-desglose-por-tienda-sql-real.test.ts` | 4 |
| `tests/integration/db/caja-iva-488.test.ts` | 21 |
| `tests/unit/descarga/analitica-productos-descarga-columnas.test.ts` | 27 |
| `tests/unit/guards/marca-fuente-unica-493.guardia.test.ts` | 19 |

```
$ pnpm exec vitest run <tests tocados, los R4 y LandingPage, sin repetir: 66 archivos>     VITEST_EXIT=0
   Test Files  66 passed (66)
        Tests  1497 passed (1497), 0 skipped
```

Incluye 6 de integración: `dinero-productos.int` 22, `498-deuda-satelite-sql-real` 13, `caja-iva-488` 21, `cierre-bodega-desglose-por-tienda-sql-real` 4, `cierre-desglose-por-tienda-sql-real` 4, `resolver-novedad-reprograma-dinero` 8. No corrí `vitest related` ni toda `integration/db`: eso es del `--rapido` del leader, que aquí se amplía solo.

### Mutaciones, ejecutadas de verdad y restauradas

Script en el scratchpad; salida en `progress/494_t2_mutaciones.log` (ignorado por git). Comprueba que el archivo cambió, aborta si `numTotalTests` es 0 y restaura los bytes exactos, comparándolos. Los tests son `ingreso-empresa`, `aporte-por-orden` y `CierreBodegaDesglosePorTienda`.

| Mutación | T3.4 | Tests | Rojos | Rojo que importa |
| --- | --- | --- | --- | --- |
| Base sin mutar | exit=0 | 111 | 0 | exit=0 |
| `lib/utils/ingreso-empresa.ts`: `.div(100)` → `.div(101)` en el porcentaje | **exit=1**, A y B | 111 | 32 | `flete = valorFlete + IVA flete (13% del flete)` |
| `pagoTiendaEmpresa` suma la comisión, sin tocar ningún número | **exit=1**, solo B | 111 | 3 | `resta al total general el flete + IVA y la comision + IVA` |
| Importe de un test en una línea renombrada: `₡8.750,55` → `₡8.750,56` | **exit=1**, A y B | 111 | 1 | `ni un importe ya visible cambia de valor` |
| Base restaurada | exit=0 | 111 | 0 | exit=0; `git status` limpio |

Supervivientes: 0 de 3. La segunda confirma que el filtro por número de la tarea no bastaba por sí solo: A no la ve, y la caza B.

### Trinquete

```
$ pnpm exec tsx tests/fixtures/marca-sin-ordenex-494.ts pendientes
antes  2.311 en 531 archivos
ahora  1.682 en 468 archivos
```

### Mapa `R<n>` → test, tanda 2

| R | Test |
| --- | --- |
| R4 | Los de la tabla de T3.4, y la comprobación del diff |

**Otras notas.** `origin/dev` avanzó durante la tanda con `c76c76489` (solo `feature_list.json` y `progress/current.md`, de la 503). No se mergeó: no comparte archivos con esta rama. `./init.sh --rapido`: no corrido aquí, lo corre el leader.

**Veredicto:** Tanda 2 lista; 110 archivos renombrados por script, sin ediciones a mano, y ninguna línea cambia de valor.

## Tanda 3 (T4.1–T4.3), familia caja, 2026-11-04

MCP `codebase-memory` sin conexión (*connection timed out*): medido con `git grep` y leyendo los archivos.

### T4.1 — Script

```
$ node scripts/marca-494-renombrar.mjs --familia caja      caja: 0 archivos movidos, 74 reescritos. SCRIPT_EXIT=0
$ node scripts/marca-494-renombrar.mjs --familia caja --comprobar    0 a mover, 0 a reescribir. COMPROBAR_EXIT=0
$ pnpm exec tsc --noEmit --incremental false               TSC_EXIT=0, 0 errores
```

267 líneas cambiadas en 74 archivos, 50 de ellos de test, `tests/fixtures/estado-cuenta.ts` incluido.

**Ediciones a mano en lo que toca el script: ninguna.** A mano solo va lo de R7: `tests/unit/types/efecto-movimiento-494.test.ts` (nuevo) y `CONCEPTOS_RETIRADOS_494` en `tests/fixtures/marca-retirada-nombre-493.ts`. El test pide el concepto viejo a ese fixture (E7): con el literal en un archivo nuevo, el trinquete subiría.

### T4.2 — Cada valor: si viaja o se persiste

Ninguno aparece en `db/schema.prisma`, `docs/api/**`, `app/api/**`, `lib/api/**`, `lib/types/api-*`, `e2e/` ni `docs/ayuda/`. Prod: 0 filas (T0.2). `ConceptoRegistro` solo lo consumen `AsiQueda` y la previsualización: `CONCEPTO_REGISTRO_DE` lo traduce desde `ConceptoManualId`, que no cambia, y el registro real no lo recibe.

En los 24 archivos de producción tocados, ninguno usa `envolver`, `unstable_cache`, `localStorage`, `sessionStorage`, `searchParams`, `router.push`, `$queryRaw` ni escribe en historial. El único `JSON.stringify` es `destinoComprobante` de `DetalleMovimientoPanel.tsx:242`, que lleva `libro` y `movimientoId`, ninguno renombrado.

| Valor | Viaja | Se persiste | Caché o URL |
| --- | --- | --- | --- |
| `gasto_empresa`, `tienda_paga_a_empresa` | Página → servidor: entrada de `previsualizarMovimientoAction` | No | No |
| `solo_empresa` | Servidor → página: `modoComposicion`, en el RSC y en `verResumenCajaAction` | No | No |
| `empresa_debe` | Servidor → página: `sentido`, en el RSC y en `verEstadoCuentaAction` | No | No |
| `deEmpresa`, `esEmpresa` (campos de DTO) | Servidor → página, por RSC y actions (`verResumenCajaAction`, `autoriaDelLibroCajaAction`) | No | No |
| `concepto_empresa` | No: discriminante interno de `aporte-por-orden`; `claveDeFuente` devuelve `fuente.concepto` | No | No |
| `"empresa"` de `A_QUIEN_POR_ORIGEN` | No: tabla de código. No llega al SQL, `typeof ramas === "string"` la salta. En ejecución no se compara con nada; la protege el tipo | No | No |
| `clave: "empresa"`, `data-bolsillo`, `data-segmento`, `data-modo` | Solo DOM; ningún lector fuera de los tests | No | No |

Nada se persiste ni sale por un contrato de API, así que no hubo que parar por eso. El orden de `Object.keys(A_QUIEN_POR_ORIGEN)` no cambia: no se reordenó ninguna fila.

### Cruce entre versiones: **hay una dirección que el spec no decide**

Sonda: cliente de `origin/dev` y servidor de la rama sobre la misma base, con las actions reenviadas por Playwright. El id de una action sale de su ruta y de la clave de cifrado: con la misma clave por entorno y el id traducido por `server-reference-manifest.json`, las llamadas llegan con 200.

**Página vieja → servidor nuevo (`design.md §11.8`): se cumple.**

```
POST {"concepto":"gasto_ordenex","monto":"1234.50"} → 200, validation_error
```

Lo que pinta `AsiQueda` ante un estado que no es `ok`: «No se pudo calcular cómo queda. Podés registrar igual: el servidor revisa el movimiento antes de guardarlo.» Esa frase se vio con la action en 404; con `validation_error` el código recorre la misma rama (`throw new Error(res.status)`), pero la pestaña de la sonda se quedó en «Calculando» (abajo). Un gasto real enviado desde el cliente viejo también llegó y se escribió: el registro no lleva estos valores.

**Servidor nuevo → página vieja: no está en §3.2, y es peor que un «Así queda» que no carga.** Es la respuesta de `verResumenCajaAction` y `verEstadoCuentaAction`. Medido renderizando el cliente de `origin/dev` con la respuesta nueva:

| Componente viejo | Respuesta nueva | Resultado |
| --- | --- | --- |
| `fraseDelSaldo` | `sentido: "empresa_debe"` | **«Velox Courier y Tania no se deben nada»**, con saldo a favor de la tienda. Frase falsa y sin error |
| `fraseDelSaldoParaLaTienda` | igual | **«Velox Courier y vos no se deben nada»** |
| `CajaResumenCard`, estado `saldo`, `dos_bolsillos` | `deEmpresa` en vez de `deOrdenex` | **Lanza** (`reading 'trim'`: `money(undefined)` en el nombre accesible de la barra) |
| `CajaResumenCard`, estado `saldo`, `solo_empresa` | `modoComposicion` desconocido | **Lanza** (`reading 'superficie'`) |

Es lectura, no escribe nada, y dura hasta recargar. Se da si la pestaña vieja relee después del despliegue y su id de action sigue valiendo en el servidor nuevo.

**Sin medir, y es lo que decide si pasa de verdad:**

- Si la clave de actions se conserva entre builds de Vercel (`.next/cache/.rscinfo`, que caduca a los 14 días de generarse, o `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, que el repo no fija), y si el proyecto tiene Skew Protection (`next.config.ts` y `vercel.json` no dicen nada). Si la clave cambia, la pestaña vieja recibe 404 en todas las actions, por esta o por cualquier otra release. Eso sí se midió: «No se pudo calcular» y «No se pudo confirmar si el movimiento quedó registrado».
- Que la excepción acabe en `app/(app)/error.tsx`: se vio el `throw` en el render, no la pantalla.
- Con `esEmpresa`, el `textoAQuien` viejo pinta una raya en «A quién» de un aporte, en vez de «Velox». Leído, no ejecutado.
- La tanda 2 tiene el mismo problema: `verCierreDetalle` devuelve `netoEmpresa`, que el cliente viejo no conoce. Leído, sin ejecutar.

No lo he cambiado: §11.8 rechaza los alias en el servidor y este caso es de la misma familia, aunque con otro peor caso. **Lo decide el leader antes de la release.**

Límite de la sonda: con la respuesta 200 reenviada, el cliente viejo no terminó de procesarla (se quedó en «Calculando» y la tarjeta no cambió, también sin las cabeceras de compresión). Es del montaje, y no se aisló la causa. Por eso la tabla sale de renderizar el componente, no del navegador.

### T4.3 — Ver la app

Dos servidores a la vez con `next dev --webpack`: `origin/dev` (`cb023c5a`, worktree temporal) y la rama, sobre la misma base. La misma pantalla en los dos; se compara texto visible línea a línea, atributos de dinero y todas las cifras `₡`. Solo se normaliza lo que la ficha cambia: `solo_ordenex` y `ordenex` en atributos.

| Pantalla | Cuenta | Líneas | Cifras | Texto distinto | Atributos distintos |
| --- | --- | --- | --- | --- | --- |
| Caja, estado flujo | `admin.qa` | 356 | 47 | 0 | 0 |
| **Caja con `solo_empresa`** (filas temporales) | `admin.qa` | 357 | 48 | 0 | 0 |
| Caja con un gasto recién registrado | `admin.qa` | 355 | 48 | 0 | 0 |
| Estado de cuenta de la tienda | `admin.qa` | 185 | 47 | 0 | 0 |
| Mi wallet | `tienda.qa` | 150 | 51 | 0 | 0 |
| Registro, «Así queda» de `gasto` | `admin.qa` | 69 | 7 | 0 | 0 |
| Registro, «Así queda» de `tienda paga` | `admin.qa` | 76 | 9 | 0 | 0 |
| Panel «Ver» de un gasto | `admin.qa` | 32 | 6 | 0 | 0 |
| Panel «Ver» de un aporte (`esEmpresa`) | `admin.qa` | 31 | 6 | 0 | 0 |

La primera pasada de la caja dio 40 líneas distintas, todas «Cargando…» de la autoría: la sonda miraba antes de tiempo. Ahora espera a que se vaya.

Lo que se ve:

- **`data-modo`:** `solo_ordenex` en `origin/dev`, `solo_empresa` en la rama. Segmentos `iva, ordenex` e `iva, empresa`. Mismo tono y mismo nombre accesible: «De las tiendas: -₡253.572,60. De Velox: ₡13.827.021,72 (ganancia y aportes). IVA por pagar: ₡4.483,60.»
- **Mensaje del modo:** «Las tiendas le deben a Velox Courier, así que en la caja no hay dinero de las tiendas y además hay dinero por cobrarles.»
- **`empresa_debe`:** «Velox Courier le debe ₡146.427,40 a Tania Tienda» y «Velox Courier te debe ₡146.427,40».
- **Así queda, gasto de ₡1.234,50:** caja ₡13.477.932,72 → ₡13.476.698,22; ganancia ₡13.327.021,72 → ₡13.325.787,22.
- **Así queda, tienda paga:** saldo ₡146.427,40 → ₡147.661,90; caja ₡13.477.932,72 → ₡13.479.167,22; ganancia sin cambio.
- **Gasto real de ₡1.111,11**, registrado en la rama: el libro de las dos versiones dice «Gasto de Velox · …». En el panel del aporte, «A quién» dice «Velox».

Las capturas no se versionan.

**No se vio:**

- **Registro real de `tienda paga`.** La tienda QA tiene saldo a favor y el concepto solo se admite con saldo en contra. Se vio su «Así queda», que es donde viaja el valor. El tope lo cubre `tests/unit/utils/efecto-movimiento.test.ts`.
- Una tienda con saldo en contra: `cuenta_debe` no cambia de nombre.
- Mensajeros y satélites en pantalla: la frase de mensajero está en `EstadoCuenta.test.tsx` y comparte rama con la de tienda.
- La pantalla de error del cruce (arriba).

**Limpieza de la base local.** Conteo por tabla antes y después: `sin diferencias`. Borrado, por id:

| Tabla | Filas | De dónde |
| --- | --- | --- |
| `login_attempt` | 18 | Logins de las sondas |
| `Session` | 18 | Logins de las sondas |
| `wallet_movimiento` | 3 | Gastos registrados |
| `wallet_anotacion` | 3 | Sus anotaciones |
| `historial_accion` | 3 | Sus entradas |

Además, en cada corrida de `solo_empresa`: 1 `aporte_capital` (saldo inicial) y 2 `wallet_movimiento`, insertados por SQL y borrados en el `finally`. Recontados: 0. Servidores matados, sus logs borrados (estaban fuera del repo), `.next/dev` borrado y worktree temporal retirado, con el `node_modules` del checkout principal intacto (48 entradas).

### Importes intactos (la comprobación de T3.4)

Script en el scratchpad, sobre `git diff cb023c5a -U0 -M`, sin `specs/`, `progress/`, el trinquete ni los archivos a mano. **A:** mismos números y en el mismo orden. **B:** la línea vieja más la tabla da exactamente la nueva. Aborta si no ve pares.

```
archivos 74 | pares 267 | con numero 80 | de dinero 12
A numero cambiado: 0 | B no es la tabla: 0 | hunks desiguales: 0
```

En producción, fuera de comentarios, 5 líneas renombradas llevan un dígito y ninguno es un importe: `s.gt(0)` (2), `"solo_empresa", // R17`, `deTerceros.lt(0)` y `montoEscala2`. B también garantiza que ninguna etiqueta visible cambió: cambian las claves de esos objetos, y sus literales solo podrían cambiar por un nombre de la tabla, que no contienen.

### Mutaciones, ejecutadas de verdad y restauradas

Script en el scratchpad; salida en `t3_mutaciones.log`, fuera del repo. Comprueba que el patrón aparece una vez y que el archivo cambió, aborta si `numTotalTests` es 0, y restaura los bytes exactos comparándolos. `t3.4` es el código de salida de la comprobación de arriba con la mutación puesta: volver a un nombre viejo no sale en el diff y da 0, y esas las cazan los tests.

| Mutación | Tests | Rojos | t3.4 | Rojo que importa |
| --- | --- | --- | --- | --- |
| Base sin mutar | 257 | 0 | 0 | exit=0 |
| **R7** El esquema acepta otra vez `gasto_ordenex` | 9 | 3 | 1 | `gasto_ordenex: el esquema lo rechaza por el campo concepto` |
| **R7** `gasto_empresa` mal escrito en el catálogo | 9 | 2 | 1 | `gasto_empresa: el nombre nuevo sí llega al servicio` |
| **R7** `tienda_paga_a_empresa` se queda con el viejo | 9 | 4 | 0 | `tienda_paga_a_ordenex: el esquema lo rechaza` |
| **R7** El diálogo pide `gasto_ordenex` | 9 | 1 | 0 | `el diálogo pide el «Así queda» … con el nombre nuevo` |
| **R7** La tabla de efectos conserva la fila vieja | 9 | 1 | 0 | `la tabla de efectos tiene una fila por concepto` |
| Tope del abono compara con el nombre viejo | 49 | 1 | 0 | `458-B/TB.12 — avisos (R47, tope del servidor)` |
| **R8** El servidor deriva `solo_ordenex` | 119 | 3 | 0 | `R17: deTerceros negativo → solo_empresa` |
| **R8** La barra con la clave de modo vieja | 119 | 3 | 1 | `R17 (D4): solo_empresa pinta la barra entera` |
| **R8** El mensaje con la clave de modo vieja | 119 | 3 | 0 | `R17 (D4)` |
| **R8** La tarjeta con la clave de tono vieja | 119 | 2 | 1 | `R17 (D4)` |
| **R8** Tono: el modo pasa a peligro | 119 | 1 | 1 | `R17 (D4)` |
| **R8** La frase de la tienda con el sentido viejo | 119 | 2 | 0 | `/mi-wallet — los TRES signos se distinguen con palabras` |
| **R8** La frase de admin con el sentido viejo | 119 | 2 | 0 | `R18 — las tarjetas dicen quién le debe a quién` |
| **R8** Etiqueta: «te debe» → «te adeuda» | 119 | 1 | 1 | `/mi-wallet — signo positivo` |
| **R8** Etiqueta: «le debe» → «adeuda» | 119 | 2 | 1 | `R18` |
| **R8** Etiqueta: «De Velox» → «Del negocio» | 119 | 2 | 1 | `la barra reparte «De las tiendas» y «De Velox»` |
| **R8** Etiqueta: el mensaje de `solo_empresa` | 119 | 2 | 1 | `R26: los tres mensajes con el significado` |
| Importe: `deEmpresa` deja fuera el capital | 101 | 1 | 1 | `R7: cifra principal = «De Velox» + «De las tiendas» + IVA` |
| **R8** El servicio deriva `ordenex_debe`, contra Postgres | 13 | 2 | | `TB.6 R20–R23: la tienda C entera, fila a fila` |
| Base restaurada | 257 | 0 | 0 | exit=0 |

Supervivientes: 0 de 19. `"empresa"` de `A_QUIEN_POR_ORIGEN` no se muta: en ejecución no se compara con nada, y la cubre el tipo.

**m3 de la revisión.** La mutación `textoAQuien` lee la clave vieja sobrevivía: ningún test la cubría. Ahora la caza un test nuevo en `tests/components/DetalleMovimientoPanel.test.tsx`, con el nombre corto literal del fixture:

| Mutación | Tests | Rojos | Rojo que importa |
| --- | --- | --- | --- |
| Base sin mutar | 18 | 0 | exit=0 |
| `DetalleMovimientoPanel.tsx`, `textoAQuien` lee `a.esOrdenex` | 18 | 1 | `494 (R4): un aporte dice a quién con el nombre corto de la marca` |
| Base restaurada, bytes iguales | 18 | 0 | exit=0 |

### Trinquete

```
$ pnpm exec tsx tests/fixtures/marca-sin-ordenex-494.ts pendientes
antes  1.682 en 468 archivos
ahora  1.389 en 442 archivos
comparado por archivo: 0 nuevos, 0 suben, 74 bajan
```

### Verificación

```
$ pnpm exec tsc --noEmit --incremental false       TSC_EXIT=0, 0 errores
$ pnpm lint                                        LINT_EXIT=0, 235 problems (0 errors, 235 warnings), el mismo número que en la tanda 2
$ pnpm exec eslint <test nuevo y fixture>          ESLINT_EXIT=0, sin salida
$ pnpm exec vitest run <tests tocados, R7, las dos guardias de marca, previsualizar-movimiento-action: 53 archivos>     VITEST_EXIT=0
   Test Files  53 passed (53)
        Tests  1002 passed | 3 todo (1005), 0 skipped
$ pnpm exec vitest run guard, después del commit   GUARD_EXIT=0
   Test Files  284 passed (284)
        Tests  3940 passed | 3 todo (3943)
```

Incluye 8 de integración: `mi-wallet-page` 39, `wallet-page` 13, `caja-caracterizacion-459` 25, `caja-invariante-tiendas` 9, `caja-iva-488` 21, `efecto-movimiento-predice` 5, `libro-caja-a-quien` 7, `wallet-caracterizacion-458` 13. No corrí `vitest related` ni toda `integration/db`: eso es del `--rapido` del leader, que aquí se amplía solo.

**`test-citado-desaparecido`:** esta tanda no renombra ni borra ningún archivo de test, así que no hace falta anotación. Verde después del commit, dentro de `run guard`.

### Mapa `R<n>` → test, tanda 3

| R | Test |
| --- | --- |
| R4 | `tests/unit/utils/aporte-por-orden.test.ts`, `tests/integration/db/caja-iva-488.test.ts`, y la comprobación del diff |
| R7 | `tests/unit/types/efecto-movimiento-494.test.ts` |
| R8 | `tests/components/CajaResumenCard.test.tsx`, `tests/components/CajaComposicionBarra.test.tsx`, `tests/components/EstadoCuenta.test.tsx`; además, los que cazaron mutaciones: `tests/unit/components/saldo-tienda-card.negativo.test.tsx`, `tests/unit/utils/caja-composicion.test.ts`, `tests/integration/db/wallet-caracterizacion-458.test.ts` |

**Veredicto:** Tanda 3 lista, ninguna frase ni cifra cambia y nada se persiste, con un cruce de versiones sin decidir: servidor nuevo y pestaña vieja dan una frase falsa de saldo o una caja que lanza.

## Tanda 4 (T5.1–T5.5), familia analítica, 2026-11-04

MCP `codebase-memory` sin conexión (*connection timed out*): medido con `git grep` y leyendo los archivos.

### T5.1 — Script

```
$ node scripts/marca-494-renombrar.mjs --familia analitica             analitica: 0 archivos movidos, 42 reescritos. SCRIPT_EXIT=0
$ node scripts/marca-494-renombrar.mjs --familia analitica --comprobar 0 a mover, 0 a reescribir. COMPROBAR_EXIT=0   (corregido en M6, abajo: con el test de contrato ya en el árbol salía 1 hasta que el script lo excluyó)
$ pnpm exec tsc --noEmit --incremental false                           TSC_EXIT=0, 0 errores
```

238 líneas cambiadas en 42 archivos. Ninguna está en `app/api`, `docs/api`, `lib/api` ni `lib/types/api-*`: no hubo que parar por eso.

**Ediciones a mano en lo que toca el script:** solo añaden líneas, ninguna cambia lo que el script dejó (comprobado abajo).

- `tests/components/descarga/ProductosDescargaColumnas.test.tsx`: R16 hasta el archivo.
- `tests/components/ProductosTablaDinero.test.tsx`: el total de la cabecera, por una mutación viva.
- `tests/unit/analytics/metrics.test.ts`: R5.

**A mano, enteros:** `lib/navegador/claves-legadas.ts`, `lib/analytics/productos-consulta.ts`, `tests/fixtures/marca-retirada-nombre-493.ts`, `tests/fixtures/marca-sin-ordenex-494.ts` (E8 encendida), `tests/unit/navegador/migrar-clave-494.test.ts`, `tests/unit/navegador/preferencias-494.test.tsx` y los dos tests nuevos.

### T5.2 — Caché

`claveDeConteoProductos` empieza ahora por `conteo-productos:v2`. El tag sigue siendo `conteo-productos`.

**Qué pasa con la entrada vieja.** Queda huérfana y no se lee: caduca por su TTL de 15 minutos, y «refrescar» la alcanza porque conserva el tag. `R9` siembra una entrada con `liquidado.ordenex` bajo la clave vieja literal y comprueba que el servicio recalcula y devuelve `liquidado.empresa: "3955.00"`. El literal de la clave vieja se comprobó contra el código de `origin/dev`. Con una vuelta atrás tampoco se cruzan: el código anterior lee su clave, con su forma. Sin medir: la Data Cache de Vercel; `design.md §3.3` ya dice que el prefijo hace innecesario medirla.

**Los otros 11 usos de `envolver`.** Ninguna clave lleva la marca. Ningún DTO lleva un campo renombrado de ninguna familia: los tipos de abajo no contienen `ordenex` ni `empresa`, y `git diff 519740e5 HEAD` sobre ellos sale vacío.

| # | Dónde | Primera pieza de la clave | Marca en la clave | Campo renombrado |
| --- | --- | --- | --- | --- |
| 1 | `CicloVidaService` | `ciclo-vida` | No | No |
| 2 | `CohorteCargaService` | `cohorte-carga` | No | No |
| 3 | `ConteoCargadasPorDiaService` | `conteo-cargadas-por-dia` | No | No |
| 4 | `ConteoDevolucionesService` | `conteo-devoluciones` | No | No |
| 5 | `ConteoEntregasService` | `conteo-entregas` | No | No |
| 6 | `ConteoHoyGestionService` | `conteo-hoy-gestion` | No | No |
| 7 | `ConteoPorStatusService` | `conteo-por-status` | No | No |
| 8 | `TableroDiaService` | `tablero-dia`, versión `v1` | No | No |
| 9 | `CachedAnaliticaOperativaRollupRepository` | `m=<id de métrica>`, solo operativas: `AnaliticaFinancieraService` no usa `envolver`, y `ganancia_empresa` no pasa por aquí | No | No |
| 10 | `lib/actions/conteos-publicos.ts` | `conteos-publicos:v1` | No | No |
| 11 | `lib/cache/registro-invalidacion.ts` | Decorador: reenvía la clave que recibe, no pone ninguna | No | No aplica |

Además hay adaptadores que implementan el puerto y no eligen clave (`next-analitica-cache`, `next-tablero-dia-cache`, `next-conteos-publicos-cache`, `cache-nula` y compañía).

### T5.3 — Columna guardada

`traducir` del ámbito `analitica-productos-dinero` conectado en `leerConLegado`. `leerConMigracion` lo aplica en sus dos caminos, y sobre `app:` solo escribe si cambió. Sustituye en `ocultas` y en `orden`, y deja el resto del objeto. JSON inválido: tal cual.

`tests/unit/navegador/preferencias-494.test.tsx` salió rojo como estaba previsto y su bloque se sustituyó por R16. El caso «no pasa `traducir` sobre la nueva» de `migrar-clave-494.test.ts` afirmaba justo lo contrario de §5.3, y se sustituyó. Ningún archivo de test se renombra ni se borra, así que no hace falta `@test-desaparecido`.

**Lo que la mutación enseñó, y corrige la premisa de T5.3.** Quitar `traducir` **solo del camino de la clave vieja** no hace reaparecer la columna: la primera lectura deja el valor bajo `app:` y la siguiente lo traduce por el otro camino; `useSyncExternalStore` lee varias veces por render. En la primera batería esa mutación sobrevivió. Ahora la caza un test de una sola lectura, que es lo único que puede verla. Quitar el camino `app:`, o los dos, sí la hace reaparecer. Se dejan los dos, como pide el spec.

**Rastro que queda:** corregido en M5, abajo. Una vuelta atrás a `origin/prod` lee `ordenex:`, ya borrada, y enseña la columna mientras dure; `app:` sigue ahí y al volver a desplegar se recupera. Solo una versión de `dev` con `app:` y el catálogo viejo lee `empresa` sin publicarla, y esa no se despliega en esta release.

### T5.4 — Contrato

`tests/unit/api/contrato-sin-cambios-494.test.ts`: 9 rutas con sus métodos, 36 esquemas con sus campos y las 10 métricas publicadas, todo literal y tomado de «Contrato para R6», contra el objeto de `lib/api/openapi-spec.ts` **y** contra el `.yaml`. Además, ninguna línea de código de `app/api/ordenes/api-key`, `lib/api` y los tipos públicos declara un campo con `empresa` u `ordenex`.

```
$ git diff --stat d216c45bf HEAD -- docs/ app/api lib/api 'lib/types/api-*'     (vacío)
```

### Alias de SQL

```
$ git grep -i -E '\bas +"?[a-z_]*(empresa|ordenex)[a-z_]*"?' -- lib app tests scripts e2e
```

**Un solo alias en todo el árbol, y está en un test:** `AS cobro_empresa` (antes `cobro_ordenex`), en `tests/integration/repositories/dinero-productos.int.test.ts:354`. En `lib/` y `app/` no hay ninguno, ni los había en `519740e5`. Tampoco hay `jsonb_build_object` ni literales de SQL con esas palabras. Mutado contra Postgres por los dos lados, cae (tabla de abajo). `liquidado.empresa` no sale de un alias: lo calcula `dinero-por-producto.ts`, y mutar esa cifra también cae contra Postgres.

### Importes intactos (la comprobación de T3.4)

Script en el scratchpad, sobre `git diff d216c45bf...HEAD -U0 -M`, sin los archivos a mano. **A:** mismos números y en el mismo orden. **B:** la línea vieja más la tabla da exactamente la nueva.

```
archivos 42 | pares 238 | con numero 102 | de dinero 23
A numero cambiado: 0 | B no es la tabla: 0 | hunks desiguales: 0
```

### Mutaciones, ejecutadas de verdad y restauradas

Script en el scratchpad; salida fuera del repo. Comprueba que el patrón aparece una vez y que el archivo cambió, aborta con 0 tests, y restaura los bytes exactos comparándolos.

| Mutación | Tests | Rojos | Rojo que importa |
| --- | --- | --- | --- |
| Base sin mutar | 463 | 0 | |
| **R16** Sin `traducir` al leer la clave vieja | 29 | 1 | `la clave vieja: la primera lectura ya sale traducida` (primera batería: sobrevivió) |
| **R16** Sin `traducir` sobre lo guardado bajo `app:` | 29 | 10 | `R16 · con lo ya guardado bajo app:, la columna oculta no vuelve al archivo` |
| **R16** Los dos caminos a la vez | 9 | 2 | `R16 · con la clave vieja, la columna oculta no vuelve al archivo` |
| **R16** La tabla no conecta el ámbito | 27 | 11 | `R16 · con la clave vieja` |
| **R16** Traduce `ocultas` y no `orden` | 27 | 2 | `la columna oculta sigue oculta y el orden elegido se conserva` |
| **R16** Traduce `orden` y no `ocultas` | 27 | 11 | `R16 · con la clave vieja` |
| **R16** Reescribe aunque no cambie | 20 | 1 | `volver a leer no escribe` (primera batería: sobrevivió) |
| **R9** La clave vuelve al prefijo viejo | 3 | 3 | `con una entrada vieja viva, se recalcula` |
| **R5** Catálogo con el id viejo | 167 | 14 | `el catálogo la sirve con el id nuevo` |
| **R5** Ids servidos con el id viejo | 74 | 4 | `el servicio la despacha con el id nuevo` |
| **R5** El servicio despacha con el id viejo | 167 | 13 | `no queda ninguna financiera del catalogo sin despachar` |
| **Cifra** La ganancia lee la caja, contra Postgres | 51 | 5 | `§7 R31: ganancia_empresa del tablero = la ganancia de la tarjeta` |
| **Alias** El `SELECT` renombra y el lector no, contra Postgres | 22 | 1 | `(v4) EL CUADRE CONTRA LA BASE` |
| **Alias** El lector se queda con el nombre viejo, contra Postgres | 22 | 1 | `(v4) EL CUADRE CONTRA LA BASE` |
| **Cifra** `empresa` sin la comisión, contra Postgres | 22 | 5 | `(g) R12 · el importe COMPLETO` |
| **Campo** La fundición lee otra cifra | 166 | 8 | `una entrega liquidada da recaudado, empresa y tienda` |
| **Campo** El detalle lee otra cifra | 166 | 2 | `una fila por ORDEN` |
| **Campo** La tabla lee el nombre viejo, con cast | 166 | 19 | `las dos cifras del reparto YA NO son columna` |
| **Campo** El panel lee el nombre viejo, con cast | 166 | 7 | `R34 — dos filas abiertas` |
| **Campo** El total del panel lee el nombre viejo, con cast | 48 | 1 | `494/R4 — «Cobró» de la cabecera sale de los totales` (primera batería: sobrevivió) |
| **Archivo** La fila lee el nombre viejo, con cast | 27 | 2 | `escribe las DIEZ celdas de dinero` |
| **Archivo** Cambia el encabezado | 27 | 1 | `los VEINTIUN encabezados salen en este orden` |
| **Archivo** Se permuta con su vecina | 27 | 4 | `las VEINTIUNA claves salen en este orden` |
| **R6** Campo público cambia en el objeto | 9 | 2 | `el objeto declara exactamente estos esquemas y campos` |
| **R6** Campo público cambia en el `.yaml` | 9 | 1 | `el .yaml declara exactamente los mismos` |
| **R6** Ruta cambia en el objeto | 9 | 1 | `el objeto declara exactamente estas rutas` |
| **R6** Ruta cambia en el `.yaml` | 9 | 1 | `el .yaml declara exactamente las mismas` |
| **R6** Se publica la ganancia | 9 | 3 | `la lista es esta, y en este orden` |
| **R6** Un tipo público gana `netoEmpresa` | 9 | 1 | `el código que arma lo público` |
| **R6** El serializador real renombra `numRemision` | 30 | 1 | `404/R1+R6`, de otro test: el contrato nuevo mira la declaración, no la salida del serializador |
| Base restaurada | 463 | 0 | |

Primera batería: 3 de 29 sobrevivieron. Los tres ya tienen test y caen. Supervivientes: 0 de 30.

### T5.5 — Ver la app

Dos servidores a la vez con `next dev --webpack`: `origin/dev` (`d216c45b`, worktree temporal) y la rama, sobre la misma base. Se compara texto visible línea a línea, cifras `₡` y archivos descargados celda a celda.

**Dos cosas de la tarea que no son como las dice:**

- **El tablero financiero no se ve hoy.** Su región está comentada en `AnaliticaShell` y la página solo pinta `destacado`. Para verlo se encendió en local, en los dos servidores, con un cambio sin commitear ya revertido. Con el rango por defecto (`mes`) la ganancia local es ₡0, y una comparación de ceros no prueba nada, así que también se amplió en local el rango a `2026-07-01`–`2026-11-04`.
- **La descarga de productos es `.xlsx`, no CSV.** El CSV está en la exportación de cada panel del tablero. Se comprobaron los dos.

| Pantalla o archivo | Líneas | Cifras | Distintas |
| --- | --- | --- | --- |
| `/analitica` entera, con tablero | 666 / 666 | 289 / 289 | 0 |
| Detalle «Audifonos bluetooth» | 678 / 678 | 289 / 289 | 0 |
| Detalle «Bolso de mano» | 679 / 679 | 289 / 289 | 0 |
| Detalle «Cafetera» | 678 / 678 | 289 / 289 | 0 |
| Detalle «Producto prueba 454 #1» | 709 / 709 | 306 / 306 | 0 |
| Tablero financiero | 380 / 380 | 287 / 287 | 0 |
| `/wallet`, líneas de caja y ganancia | 40 / 40 | 29 / 29 | 0 |
| CSV de «Ganancia de Velox» | 20 / 20 | 3 filas con importe | 0 |

- **Ganancia, en las dos:** neto ₡13.327.022, bruto ₡13.408.622,72. En `/wallet`, ₡13.327.021,72.
- **CSV:** `ganancia-de-velox-FECHA.csv`, con la cabecera `Periodo,Grano,Metrica,Bruto,Neto,Moneda,Tipo de cifra,Limitacion conocida`. Primera fila con importe: `2026-08-10,semana,Ganancia de Velox,13373485.22,13339884.22`.
- **Archivo de productos, sin preferencia:** 21 columnas, 125 filas, encabezado y filas idénticos. `Cobró Velox (no sumar: importe de la orden completa)` en la posición 15 de las dos. 5 celdas con valor, que suman 16.212,69 en las dos: la columna no estaba vacía.
- Ningún error de página en las dos versiones.

**Columna oculta, con el valor viejo sembrado en `localStorage`:** `{"ocultas":["ordenex"],"orden":["recaudado","ordenex","producto"]}`.

| Sembrado en | Versión | Columnas | «Cobró Velox» | Lo que queda guardado bajo `app:` |
| --- | --- | --- | --- | --- |
| Clave vieja | `origin/dev` | 20 | No sale | `ocultas: ["ordenex"]` |
| Clave vieja | Rama | 20 | No sale | `ocultas: ["empresa"]`, y la vieja borrada |
| `app:` | `origin/dev` | 20 | No sale | `ocultas: ["ordenex"]` |
| `app:` | Rama | 20 | No sale | `ocultas: ["empresa"]` |
| Clave vieja | **Control: rama sin `traducir`** | **21** | **Sale, en la posición 5** | `ocultas: ["ordenex"]` |
| `app:` | **Control: rama sin `traducir`** | **21** | **Sale, en la posición 5** | `ocultas: ["ordenex"]` |

En las cuatro primeras filas, el archivo de `origin/dev` y el de la rama son idénticos celda a celda. El control prueba que la sonda ve la diferencia. En la captura del selector de la rama, «Cobró Velox» sale desmarcada. Las capturas no se versionan.

**No se vio:**

- El tablero financiero en producción, porque hoy no se pinta.
- La pila del móvil de la tabla, y los roles `adminTienda`, `adminSatelite` y `mensajero`. Todo con `admin.qa`.
- El cruce de versiones en un navegador (abajo).
- El comportamiento real de la Data Cache de Vercel.

**Limpieza de la base local.** Conteo por tabla antes y después: `sin diferencias`. Borrado, solo de la cuenta `admin.qa` y desde la foto inicial: `Session` 11 y `login_attempt` 11, los logins de las sondas. El aviso de SINPE se cerró con Escape, que no escribe en la base. Servidores matados, sus logs borrados (estaban fuera del repo), `.next/dev` borrado, los dos cambios locales revertidos, y worktree temporal retirado con el `node_modules` del checkout principal intacto (48 entradas).

### Cruce entre versiones: **otro peor caso, y este sobrevive a recargar**

Sin cambiar la decisión de `design.md §3.2`. Medido renderizando el cliente de `origin/dev` con la respuesta nueva (`liquidado.empresa`), como en la tanda 3:

| Componente viejo | Respuesta nueva | Resultado |
| --- | --- | --- |
| Tabla de productos, sin abrir fila | `dinero.liquidado.empresa` | Se pinta bien: `Cobró` no es columna de la tabla |
| Abrir **cualquier** fila | igual | **Lanza** (`reading 'trim'`: `money(undefined)`). 19 de 47 tests de ese archivo caen por eso |
| **Descargar el archivo** | igual | **La columna «Cobró Velox» sale vacía en todas las filas, sin error, y el resto con cifras.** Una celda vacía significa en este archivo «nada liquidado» (R51 de la 345) |
| Identidades de pantalla | igual | 34 de 34 verdes |

**Por qué lo aparto.** Las tandas 2 y 3 dan una frase falsa o una pantalla que lanza, y se arreglan recargando. Aquí queda **un archivo guardado** que afirma que no se cobró nada, y recargar no lo corrige. Se da en las mismas condiciones: pestaña vieja, y su id de action sigue valiendo en el servidor nuevo. No es una cifra inventada: es una columna vacía. Lo que decide si pasa sigue sin medir, y es la medición de T7.4.

La métrica no tiene este problema: `ganancia_empresa` se pide en el servidor (`cargarTableroFinanciero`), en un render que no llega a la pestaña vieja, y el botón que la pide desde el cliente está en la región comentada. Si se encendiera, `consultarMetricaFinanciera("ganancia_ordenex")` respondería `forbidden` con motivo `metrica_desconocida` (`lib/analytics/consulta.ts:131`), sin ceros. Leído, no ejecutado.

**Pestaña vieja y preferencia traducida (corregido en M5).** La pestaña de la release es `origin/prod`, que lee `ordenex:` y nunca pisa `app:`. Si la nueva ya borró `ordenex:`, la vieja enseña la columna hasta recargar. Si toca el selector escribe `ordenex:`, y la nueva lee las dos, gana `app:` y borra la vieja (R15). Solo se pierde lo tocado en esa pestaña vieja. Leído en `origin/prod`, no ejecutado.

Anotado en `design.md §3.2`. **Lo decide el leader antes de la release.**

### Trinquete

```
$ pnpm exec tsx tests/fixtures/marca-sin-ordenex-494.ts pendientes
antes  1.389 en 442 archivos
ahora  1.133 en 418 archivos
comparado por archivo: 0 nuevos, 0 suben, 42 bajan
```

### Verificación

```
$ pnpm exec tsc --noEmit --incremental false       TSC_EXIT=0, 0 errores
$ pnpm lint                                        LINT_EXIT=0, 235 problems (0 errors, 235 warnings), el mismo número que en la tanda 3
$ pnpm exec eslint <6 archivos a mano y nuevos>    ESLINT_EXIT=0, sin salida
$ pnpm exec vitest run <33 tests tocados, guardia 494, publicacion-api-key, descarga: 35 archivos>     VITEST_EXIT=0
   Test Files  35 passed (35)
        Tests  777 passed | 3 todo (780), 0 skipped
$ pnpm exec vitest run guard, con el código ya commiteado y otra vez tras el commit final   GUARD_EXIT=0
   Test Files  284 passed (284)
        Tests  3940 passed | 3 todo (3943)
```

Incluye 4 de integración contra Postgres: `analitica-financiera-action` 15, `dinero-productos.int` 22, `analitica-anulacion-rechazo-458` 4, `caja-iva-488` 21. No corrí `vitest related` ni toda `integration/db`: eso es del `--rapido` del leader, que aquí se amplía solo. `marca-fuente-unica-493` y `marca-sin-ordenex-494` van dentro de `run guard`.

**`test-citado-desaparecido`:** esta tanda no renombra ni borra ningún archivo de test, así que no hace falta anotación.

### Mapa `R<n>` → test, tanda 4

| R | Test |
| --- | --- |
| R4 | `tests/unit/descarga/analitica-productos-descarga-columnas.test.ts`, `tests/components/ProductosTablaDinero.test.tsx`, `tests/integration/repositories/dinero-productos.int.test.ts`, y la comprobación del diff |
| R5 | `tests/unit/analytics/metrics.test.ts`, `tests/unit/services/analitica-financiera-service.test.ts`, `tests/components/TableroFinanciero.test.tsx`; el valor, contra Postgres, en `tests/integration/db/caja-iva-488.test.ts` |
| R6 | `tests/unit/api/contrato-sin-cambios-494.test.ts`, `tests/unit/analytics/publicacion-api-key.test.ts` (la declaración); `tests/integration/db/455/caracterizacion/webhook-estado.test.ts`, `tests/integration/api/ordenes-api-key-listado.route.test.ts` (la salida del serializador, M3) |
| R9 | `tests/unit/analytics/cache-clave-conteo-productos-494.test.ts` |
| R16 | `tests/components/descarga/ProductosDescargaColumnas.test.tsx` (hasta el archivo; los literales viejos vienen del fixture E7, como en R7), `tests/unit/navegador/preferencias-494.test.tsx` (por el hook y en una sola lectura, literales), `tests/unit/navegador/migrar-clave-494.test.ts` |

**Veredicto:** Tanda 4 lista, ningún encabezado, posición ni cifra cambia y la columna oculta sigue oculta, con un peor caso nuevo en el cruce de versiones: un archivo descargado con «Cobró Velox» vacía.

### Menores de `progress/review_494_t4.md`, cerrados

**M1, salida barata del cruce.** `consultarConteoProductos` y `consultarDetalleDineroProducto` pasan a `...V2`: renombradas en 14 archivos, sin alias ni excepción. Test con los nombres literales: `tests/unit/analytics/acciones-productos-nombre-494.test.ts`.

Build real, dos veces en este worktree, reutilizando `.next/cache`:

```
$ pnpm exec next build --webpack      antes y después: Compiled successfully, y luego para en el type check
$ comparar .next/server/server-reference-manifest.json
misma clave de cifrado: true | ids 334 / 334 | iguales 332
conteo:   60 9a4d98f6... ya no existe -> consultarConteoProductosV2         60 e7ba5a1f...
detalle:  60 b9f741c9... ya no existe -> consultarDetalleDineroProductoV2   60 84b306a2...
```

- **Límite del build:** en los dos pasos para con un error de tipos en `.next/types/app/(app)/historico/acciones/page.ts`, que esta tanda no toca. El manifiesto ya está escrito en la fase de compilación, que es lo que se compara. El build de Vercel de #890 sobre la base sale verde: no se investigó más, es de este worktree. El build completo lo dice el check del PR.
- **Medido con webpack, y producción construye con Turbopack: `package.json` corre `next build`, sin `--webpack`. Se intentó una vez aquí y cae: `Symlink [project]/node_modules is invalid, it points out of the filesystem root`. **Con Turbopack, sin medir:** que el id dependa del nombre es supuesto, comprobable en un checkout sin junction.**
- **Sin medir:** que la pestaña vieja reciba `UnrecognizedActionError` (leído en `server-action-reducer.js`). Que la tabla pinte el error está en `ProductosTabla.test.tsx`, con la action que rechaza.

**M2.** `design.md §3.2` y T7.4 corregidos. Sigue pendiente de confirmar por el humano. Las actions de cierres y caja no se tocan: su daño es hasta recargar.

**M3.** Mapa de R6 corregido aquí y en `requirements.md`. Sin test nuevo. `WebhookEventoOrdenService` sigue sin mutar.

**M4.** `ProductosTablaDinero.test.tsx` compara con `Cobró ${NOMBRE_CORTO_ESPERADO}`, del fixture y no de la pantalla. Además de las líneas citadas, también las otras 8 de ese archivo que usaban la constante, y el panel afirma sus dos rótulos.

**M5.** Corregidos los dos párrafos de arriba: la pestaña de la release es `origin/prod`.

**M6.** `scripts/marca-494-renombrar.mjs` excluye el test de contrato en todas las familias (E8). Pasa de `NUNCA_EN_COMENTARIOS` a `NUNCA`.

```
$ node scripts/marca-494-renombrar.mjs --familia analitica --comprobar   COMPROBAR_EXIT=0
$ ... --familia cierres --comprobar                                      0
$ ... --familia caja --comprobar                                         0
```

**Mutaciones**, con archivo cambiado, tests > 0 y bytes restaurados:

| Mutación | Tests | Rojos | Rojo que importa |
| --- | --- | --- | --- |
| Base sin mutar | 50 | 0 | |
| La action de conteo vuelve al nombre viejo | 2 | 1 | `el conteo se exporta con este nombre` |
| La action de detalle vuelve al nombre viejo | 2 | 1 | `el detalle se exporta con este nombre` |
| Se añade un alias con el nombre viejo | 2 | 1 | `el conteo se exporta con este nombre` |
| Cambia la etiqueta de la fila (antes sobrevivía) | 48 | 7 | `las dos cifras del reparto YA NO son columna` |
| Cambia la etiqueta de la cabecera del panel (antes sobrevivía) | 48 | 1 | `R38/R36/R37` |
| Cambia la etiqueta de la columna del panel (antes sobrevivía) | 48 | 1 | `R38/R36/R37` |
| Base restaurada | 50 | 0 | |

Supervivientes: 0 de 6.

**Trinquete:** sin cambios, 1.133 en 418.
