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
