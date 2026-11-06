# 494 — Marca Velox Courier: identificadores internos · requirements

> Ficha 494 (`feature_list.json`). Depende de la **493** (textos, `specs/493-marca-velox-textos/`) y de la
> **492** (identidad, `specs/492-marca-velox-identidad/`), las dos ya en `prod`.
> Spec escrito el 2026-11-04 sobre `dev` en `519740e5`. Medición con `Grep`/`Read`: el MCP
> `codebase-memory` no conectó en esta sesión (*connection timed out*).

## Contexto medido (2026-11-04)

Re-medido en el árbol actual; la ficha decía 554 archivos (324 de test) el 2026-11-02.

| Superficie | Archivos con «ordenex» (cualquier caja) | Apariciones |
| --- | --- | --- |
| `app/` | 58 | 346 |
| `lib/` | 146 | 480 |
| `components/` | 11 | 20 |
| `hooks/` | 2 | 3 |
| `public/` | 1 (`sw.js`) | 5 |
| `scripts/` | 7 | 22 |
| `e2e/` | 3 | 5 |
| `db/schema.prisma` | 1 | 46 (todas en comentarios: confirmado leyéndolas) |
| **Subtotal de código** | **229** | **927** |
| `tests/` | 329 | 1.350 |
| **Total** | **558** | **2.277** |

El censo clasificado por tipo está en `design.md §2`. Fuera de esa tabla y de la ficha: `db/migrations`
(25 archivos, 36 apariciones), `specs/`, `progress/`, `feature_list.json`, registros históricos de `docs/`.

**Tres hechos medidos que corrigen a la ficha:**

1. `ganancia_ordenex` **no** está en la API de métricas pública: no figura en `METRICAS_API_KEY`
   (`lib/analytics/publicacion-api-key.ts:56`), que excluye por contrato el dominio financiero, y `docs/api/**`
   no la nombra ni una vez. Renombrarla no rompe ningún contrato externo (`design.md §3.2`).
2. En `next.config.*`, `vercel.json`, `proxy.ts`, `middleware.ts` hay **cero** apariciones de `ordenex`: en el
   repo no hay ningún dominio `ordenex.*` que sea configuración viva (`design.md §6`).
3. Los seis valores de la ficha (`ganancia_ordenex`, `solo_ordenex`, `concepto_ordenex`, `gasto_ordenex`,
   `tienda_paga_a_ordenex`, `ordenex_debe`) no son enum de Postgres ni columna de ninguna tabla. Por el
   código solo podrían estar en filas dentro de JSONB o texto libre; lo decide la medición del leader
   (`design.md §4`, «a medir por el leader»), no este spec.

Glosario:

- **Marca retirada**: la cadena `ordenex`, sin distinguir mayúsculas.
- **Árbol vigilado**: `app/`, `components/`, `hooks/`, `lib/`, `public/`, `scripts/`, `tests/`, `e2e/`,
  `db/schema.prisma`, `docs/ayuda/`, `docs/api/` salvo `CHANGELOG.md`, `package.json`, `.env.example`,
  `DESIGN.md` y `.claude/commands/`.
- **Lista de excepciones**: la lista cerrada de `design.md §7`, cada entrada con su motivo.
- **Clave vieja / clave nueva**: el nombre con y sin marca retirada de un dato guardado en el navegador
  (`design.md §5`).
- **Plantilla con la marca**: fila de `plantilla_mensaje` cuyo `nombre` contiene la marca retirada.

## Requisitos

### Sin marca retirada en el árbol

- **R1** (ubicuo) — Ningún archivo del árbol vigilado DEBE contener la marca retirada, ni en código, ni en cadenas, ni en comentarios, ni en el nombre del archivo o de su carpeta, fuera de la lista de excepciones.
- **R2** (condicional) — SI aparece la marca retirada en el árbol vigilado fuera de la lista de excepciones, ENTONCES la suite DEBE fallar nombrando archivo, línea y fragmento.
- **R3** (condicional) — SI una entrada de la lista de excepciones ya no coincide con ninguna aparición real, o no declara motivo, ENTONCES la suite DEBE fallar nombrando esa entrada.
- **R4** (ubicuo) — El renombrado NO DEBE cambiar ningún importe, conteo, orden de columnas ni texto visible de cierres, caja, estados de cuenta, mi wallet o analítica.

### Valores de dominio y métricas

- **R5** (por evento) — CUANDO se pide la métrica financiera de la ganancia, el sistema DEBE servirla con el id sin marca retirada y con el mismo valor que antes del cambio, y el catálogo NO DEBE contener el id viejo.
- **R6** (ubicuo) — La API pública (canal de API key, webhooks y OpenAPI) DEBE conservar sin cambios sus rutas, sus campos y su lista de métricas publicadas.
- **R7** (condicional) — SI la previsualización de un movimiento recibe un concepto con la marca retirada (`gasto_ordenex`, `tienda_paga_a_ordenex`), ENTONCES el sistema DEBE responder error de validación, sin lanzar y sin escribir nada.
- **R8** (por evento) — CUANDO una persona abre la caja o un estado de cuenta cuyo modo de composición o sentido de saldo cambió de nombre (`solo_ordenex`, `ordenex_debe`), el sistema DEBE pintar la misma etiqueta y el mismo tono que antes del cambio.
- **R9** (por evento) — CUANDO se despliega el cambio, el sistema NO DEBE leer de la caché de analítica de productos una entrada escrita con la forma anterior del DTO.

### Datos guardados en filas

- **R10** (condicional) — SI la medición de `design.md §4` da filas con un valor renombrado en una columna que el código lee para decidir (`vista_filtro.filtro`, `whatsapp_envio.parametros`, `jobs.payload` de un job no terminado), ENTONCES una migración DEBE reescribir esas filas, guardando antes su respaldo, y dejarlas legibles por el código nuevo.
- **R11** (ubicuo) — Ninguna migración de esta ficha DEBE reescribir columnas de evidencia congelada: `historial_accion`, `whatsapp_envio_ejecucion`, `chat_mensaje` ni los libros de dinero.
- **R12** (condicional) — SI esta ficha añade una migración, ENTONCES DEBE quedar declarada en `posteriores` de `tests/integration/db/orden-traspaso-migration.test.ts`.
- **R13** (ubicuo) — `db/schema.prisma` DEBE seguir describiendo el mismo esquema: esta ficha solo cambia sus comentarios y no produce migración de esquema.

### Claves del navegador

- **R14** (condicional) — SI una persona tiene guardada una preferencia bajo una clave vieja de `localStorage` (sonido, app de navegación, columnas de manifiesto, columnas de descarga) y ninguna bajo la clave nueva, ENTONCES el sistema DEBE aplicar ese valor, guardarlo bajo la clave nueva y borrar la vieja.
- **R15** (condicional) — SI existen a la vez la clave vieja y la nueva, ENTONCES el sistema DEBE aplicar el valor de la nueva y borrar la vieja.
- **R16** (condicional) — SI la preferencia de columnas de descarga guardada nombra la columna con su clave vieja, ENTONCES el sistema DEBE traducirla a la clave nueva, de modo que una columna oculta siga oculta y el orden elegido se conserve.
- **R17** (condicional) — SI una persona tiene la cookie de tema vieja y no la nueva, ENTONCES el sistema DEBE pintar el tema de la cookie vieja desde el primer render de servidor y, al montar en el cliente, DEBE escribir la cookie nueva y caducar la vieja.
- **R18** (condicional) — SI la marca de «revisión aplazada» de SINPE está en `sessionStorage` bajo la clave vieja, ENTONCES el sistema NO DEBE volver a mostrar el aviso en esa sesión.
- **R19** (condicional) — SI el almacenamiento del navegador no está disponible o lanza durante la migración de una clave, ENTONCES el sistema NO DEBE lanzar y DEBE comportarse como sin preferencia guardada.
- **R20** (ubicuo) — El sistema NO DEBE escribir datos nuevos bajo una clave vieja.

### Service worker y notificaciones

- **R21** (por evento) — CUANDO el service worker recibe el mensaje de relevo o de página lista, con el nombre nuevo o con el viejo, DEBE ejecutar la misma acción, para que una página de la versión anterior pueda activar un service worker nuevo en espera.
- **R22** (por evento) — CUANDO una página recibe el aviso de push del service worker, con el nombre nuevo o con el viejo, DEBE revalidar la campana igual.
- **R23** (por evento) — CUANDO el service worker muestra una notificación, DEBE etiquetarla sin la marca retirada, y DEBE seguir sustituyendo notificaciones del mismo evento.

### Plantillas de WhatsApp

- **R24** (ubicuo) — El código NO DEBE contener el nombre de ninguna plantilla de Meta como literal: el nombre enviado a Meta DEBE salir de `plantilla_mensaje.nombre`.
- **R25** (por evento) — CUANDO cambia `plantilla_mensaje.nombre` de una plantilla enlazada a un envío, el sistema DEBE enviar con el nombre nuevo sin tocar la configuración del envío, y las ejecuciones anteriores DEBEN conservar el nombre con el que se fijaron.
- **R26** (mientras) — MIENTRAS una plantilla con la marca siga en `plantilla_mensaje` porque Meta no ha aprobado su sustituta, el sistema DEBE seguir enviando con ella, y ningún test ni guardia DEBE depender de ese cambio.
- **R27** (condicional) — SI la sincronización con Meta lee un template sin plantilla local de ese nombre, ENTONCES el sistema DEBE ignorarlo, sin crear ni modificar filas.

### Dominios y cuentas

- **R28** (ubicuo) — Esta ficha NO DEBE añadir, quitar ni cambiar redirecciones, hosts canónicos ni configuración de dominio en `next.config.*`, `vercel.json`, `proxy.ts` o `middleware.ts`.
- **R29** (por evento) — CUANDO se ejecuta la siembra de usuarios QA y existe la cuenta con el correo viejo, el sistema DEBE pasar esa cuenta al correo nuevo conservando su `id` y sus relaciones, sin crear otra.
- **R30** (ubicuo) — Ninguna migración ni script de esta ficha DEBE modificar `usuario.email` de una cuenta que no sea de las sembradas por QA.

### Configuración del proyecto

- **R31** (ubicuo) — `package.json` DEBE declarar el nombre `velox`, y la colección Postman publicada en `docs/api/` DEBE llamarse y titularse sin la marca retirada.
- **R32** (ubicuo) — La lista de comprobación de despliegue de `docs/release.md` (apartado de verificaciones B2 y B4) DEBE nombrar el proyecto de Vercel y el dominio vigentes.

## Trazabilidad prevista (R → test)

| R | Test o guardia |
| --- | --- |
| R1 | `tests/unit/guards/marca-sin-ordenex-494.guardia.test.ts` — bloque «árbol» (sin trinquete al cerrar la tanda 7) |
| R2 | misma guardia — bloque «detector», contraprueba sintética en código, cadena, comentario y nombre de archivo |
| R3 | misma guardia — bloque «excepciones»: cada entrada tiene motivo y al menos una coincidencia; contraprueba con una entrada muerta |
| R4 | tests de dinero migrados con importes literales sin cambio: `tests/unit/utils/ingreso-empresa.test.ts` (hoy `ingreso-ordenex.test.ts`), `tests/unit/utils/aporte-por-orden.test.ts`, `tests/integration/db/cierre-desglose-por-tienda-sql-real.test.ts`, `tests/integration/db/caja-iva-488.test.ts`; `tests/unit/descarga/analitica-productos-descarga-columnas.test.ts` (orden y encabezados literales); `tests/unit/guards/marca-fuente-unica-493.guardia.test.ts` sigue verde |
| R5 | `tests/unit/services/analitica-financiera-service.test.ts`, `tests/unit/analytics/metrics.test.ts` (id nuevo literal y ausencia del viejo), `tests/components/TableroFinanciero.test.tsx` |
| R6 | test nuevo `tests/unit/api/contrato-sin-cambios-494.test.ts` (lista literal de `METRICAS_API_KEY`, sin dominio financiero; rutas y nombres de campo de la OpenAPI contra una lista literal tomada en T0) + `tests/unit/analytics/publicacion-api-key.test.ts`. Esos miran la declaración; la salida real la ven `tests/integration/db/455/caracterizacion/webhook-estado.test.ts` y `tests/integration/api/ordenes-api-key-listado.route.test.ts` |
| R7 | test nuevo `tests/unit/types/efecto-movimiento-494.test.ts` (ningún test importa hoy `previsualizarMovimientoSchema`): el concepto viejo, literal, no pasa el esquema y la action responde error de validación |
| R8 | `tests/components/CajaResumenCard.test.tsx`, `tests/components/CajaComposicionBarra.test.tsx`, `tests/components/EstadoCuenta.test.tsx`: etiqueta literal igual que antes |
| R9 | test nuevo `tests/unit/analytics/cache-clave-conteo-productos-494.test.ts`: la clave nueva difiere de la vieja para la misma consulta (literal de la vieja escrito en el test) |
| R10 | test nuevo y **condicional a la medición** `tests/integration/db/marca-494-backfill.test.ts`, contra Postgres. Con medición 0 no se crea y se anota en `progress/impl_494.md` |
| R11 | `marca-sin-ordenex-494.guardia.test.ts` — bloque «migraciones»: una migración `*_494*` que haga `UPDATE`/`DELETE` sobre esas tablas pone rojo; contraprueba sintética |
| R12 | `tests/integration/db/orden-traspaso-migration.test.ts` (el propio `posteriores`) |
| R13 | `tests/integration/db/schema-drift-saneamiento.test.ts` + T7.5 (`prisma migrate diff` sin diferencias, anotado) |
| R14 | test nuevo `tests/unit/navegador/migrar-clave-494.test.ts` + `tests/unit/hooks/useTonoAlIncrementar.test.tsx`, `tests/components/OrdenesDescargaColumnas.test.tsx` |
| R15 | `tests/unit/navegador/migrar-clave-494.test.ts` |
| R16 | `tests/components/descarga/ProductosDescargaColumnas.test.tsx`: preferencia sembrada con la clave vieja, literal; la columna sale oculta |
| R17 | `tests/unit/guards/tema-encendido.guardia.test.ts` + test nuevo `tests/unit/tema/cookie-legada-494.test.ts`, y test del layout que cubra `app/(app)/layout.tsx` |
| R18 | `tests/components/RevisionSinpeBodega.test.tsx`, ampliado con la marca sembrada bajo la clave vieja |
| R19 | `tests/unit/navegador/migrar-clave-494.test.ts` (almacenamiento que lanza) |
| R20 | `marca-sin-ordenex-494.guardia.test.ts` — bloque «legado»: las claves viejas solo viven en `lib/navegador/claves-legadas.ts` y no se pasan a `setItem` ni a `document.cookie`; contraprueba |
| R21 | `tests/unit/guards/pwa-relevo-y-purga.guardia.test.ts` (ampliado: mensaje viejo y nuevo disparan `skipWaiting` y la purga; un tercero no) |
| R22 | `tests/unit/guards/pwa-push.guardia.test.ts` + `tests/unit/hooks/usePushEnVentana.test.tsx` (mensaje viejo y nuevo) |
| R23 | `tests/unit/guards/pwa-push.guardia.test.ts` (tag literal nuevo; dos notificaciones del mismo evento comparten tag) |
| R24 | `marca-sin-ordenex-494.guardia.test.ts` (bloque árbol, ya prohíbe `*_ordenex`) + bloque «plantillas»: `alerta_transito` y `picking_bodega` no aparecen como literal en `lib/` |
| R25 | test nuevo `tests/integration/db/plantilla-renombrada-envio-494.test.ts`, contra Postgres |
| R26 | misma guardia, bloque «plantillas»: ningún test del árbol nombra una plantilla con la marca; R25 demuestra que el código funciona con cualquier nombre |
| R27 | `tests/unit/plantillas/plantilla-sync-solo-estados.test.ts`, con el caso «template sin fila local» (T0.3 confirma que ya lo cubre o lo añade) |
| R28 | `marca-sin-ordenex-494.guardia.test.ts` — bloque «hosts»: esos archivos no tienen `ordenex`, y el diff de la ficha no los toca (comprobado en T8.2 contra `origin/dev`) |
| R29 | test nuevo `tests/integration/db/seed-usuarios-qa-494.test.ts`, contra Postgres: dos corridas, misma `id`, cero cuentas con el correo viejo |
| R30 | `marca-sin-ordenex-494.guardia.test.ts` — bloque «migraciones» (sin `usuario.email` en migraciones `*_494*`); el seed se comprueba en R29 |
| R31 | `marca-sin-ordenex-494.guardia.test.ts` — bloque «proyecto» (`name === "velox"` literal; existe la colección nueva y no la vieja) + `tests/unit/api/openapi-320-eliminar.test.ts` y `openapi-266-habilitar.test.ts` con la ruta nueva |
| R32 | misma guardia — bloque «proyecto»: las filas B2 y B4 de `docs/release.md` contienen `velox` y `velox-courier.company` y no `ordenex` |

## Fuera de alcance

- `db/migrations/**`: son fotos históricas; editarlas produce drift (ver `design.md §7`, E1).
- `specs/`, `progress/`, `feature_list.json`, `docs/api/CHANGELOG.md` antiguo, las entradas fechadas de
  `docs/release.md`, `docs/marca/velox/README.md`.
- La carpeta local del repo, el nombre del proyecto en el MCP (`R-job-singularis-projects-ordenex`) y la base
  local `ordenex` con sus clones `ordenex_<sufijo>`.
- Reescribir datos históricos: «Maestro Ordenex» y demás filas de personas (P5 de la 493), `chat_mensaje`,
  `historial_accion`, snapshots de ejecuciones.
- Dominios y alias fuera del repo (Vercel, DNS, Meta): la ficha no los toca (`design.md §6`).
- El marcado del `.design-work/` y las carpetas sin versionar `design-*/`.

## Preguntas abiertas

**Aprobado por el humano el 2026-11-04 con todos los valores por defecto (P1-P5).** `design.md` y `tasks.md` ya están escritos con ellos.

- **P1 — ¿Con qué palabra se sustituye «ordenex» en identificadores?** Por defecto, **neutral**: `empresa` y prefijo
  `app:` (`ingresoEmpresa`, `ganancia_empresa`, `app:sonido-notificaciones`, cookie `app_tema`). Motivo: un cambio de
  marca costó 558 archivos y `velox` dejaría el siguiente igual; el código ya dice «la plata de la empresa» en
  comentarios, y la guardia de la 492 prohíbe `/velox/i` en la OpenAPI. La alternativa es `velox` (`ingresoVelox`), que es
  lo que se lee más literal en la ficha. Decisión de nombres: `design.md §3.1`.
- **P2 — ¿Cómo se llaman las plantillas nuevas en Meta?** Por defecto, **sin marca**: `alerta_transito` y
  `picking_bodega`, como ya es `listo_para_entrega_mensajero`; así un cambio de marca no vuelve a pedir aprobación por el
  nombre. La alternativa es `alerta_transito_velox` y `picking_bodega_velox`.
- **P3 — Cuentas QA `@ordenex.test`: ¿se renombran?** Por defecto, **sí**, a `@empresa.test`, con una siembra que pasa la
  cuenta existente al correo nuevo (R29). Hay que correr esa siembra en local y en preview, y actualizar la receta de
  acceso de la memoria. La alternativa es dejarlas como excepción: `.test` no es un dominio que exista ni lo ve nadie.
- **P4 — ¿Entran los comentarios?** La ficha dice «identificadores» y la 493 los dejó fuera. Por defecto, **entran**: la
  guardia queda como un `grep` sin matices (R1), y parte de ellos nombran `lib/utils/ingreso-ordenex.ts`, que deja de
  existir. Son 464 apariciones de la palabra suelta en `lib/` y `app/`, y 374 en `tests/`: es la tanda 7 entera. Si la
  respuesta es no, la tanda 7 se reduce a las rutas y la guardia vuelve al AST de la 493.
- **P5 — Alias `ordenex.vercel.app` (307 a `velox-courier.vercel.app`, según memoria del 2026-10-30) y app vieja
  `ordenex-app`: ¿se retiran?** Están fuera del repo y su estado de hoy no está medido. Esta ficha no los toca (R28). Si se
  quiere retirarlos es otra ficha, y antes hay que comprobar con `curl -sI` qué URL deja cada uno.
