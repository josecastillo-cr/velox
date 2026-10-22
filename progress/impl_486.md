# 486 — Evidencias con varias fotos en los cierres · bitácora de implementación (BACKEND)

Rama `feature/486-evidencias-varias-fotos-cierres` (nace de dev `f34f0f6d`), worktree
`.claude/worktrees/f486`. Alcance de esta tanda: T0-T5 del `tasks.md` (backend, DTO y tipos). La UI
(T6-T8: `BotonesEvidencia`, montaje en `FilaGestion`/`columnaEvidencia`, tests de componente y de
descargas R12-R18) queda para el frontend.

Búsqueda de código: MCP `codebase-memory` (proyecto `R-job-singularis-projects-ordenex`) para
localizar símbolos; confirmado en el archivo real antes de editar.

## T0 — pre-vuelo

- `GESTION_ADMIN_SELECT` (`CierresAdminRepository.ts:275`), `WITH_DETALLE` (`CierreDiaRepository.ts:434`),
  `toDetalleDTO` (`CierreDiaService.ts:1016`) y los cinco puntos de firma estaban como dice `design.md §1`.
- Migración `20260723130000_gestion_orden_evidencia` aplicada en la base local: lo prueba el test de
  integración nuevo, que siembra y lee `gestion_orden_evidencia` (no se saltó: 6 passed).

## Archivos

Producción:
- `lib/utils/evidencias-gestion.ts` (nuevo): `rutasEvidenciaGestion` (hijas mandan; sin hijas la
  portada; nada → `[]`), `urlsEvidenciaFirmadas` (orden de rutas, omite lo no firmado),
  `rutasAFirmar` (aplana para UNA firma).
- `lib/interfaces/repositories/ICierreDiaRepository.ts`: `CierreGestionPendienteRow.evidenciaStoragePaths: string[]` (obligatorio).
- `lib/interfaces/services/ICierreDiaService.ts`: `CierreDetalleGestion.evidenciaUrls: string[]` (contrato al cliente).
- `lib/repositories/CierresAdminRepository.ts`: `GESTION_ADMIN_SELECT` gana
  `evidencias: { select: { storagePath: true }, orderBy: { indice: "asc" } }`; el mapper rellena
  `evidenciaStoragePaths`. `GESTION_DESCARGA_SELECT` SIN cambios (R17).
- `lib/repositories/CierreDiaRepository.ts`: lo mismo en `WITH_DETALLE` y `toPendienteRow`.
- `lib/services/CierreDiaService.ts`: `toDetalleDTO` calcula `evidenciaUrls` y deriva
  `evidenciaUrl = evidenciaUrls[0] ?? null`; `listarCierreDia`, `correccionesDe`, `verCierrePasado`
  firman `rutasAFirmar(...)`. Los `try/catch` (y su ausencia) intactos.
- `lib/services/CierresAdminService.ts` (`verCierreDetalle`) y `lib/services/CierresBodegaAdminService.ts`
  (`verCierreBodegaDetalle`): recogida con `rutasAFirmar`.

Tests nuevos:
- `tests/unit/utils/evidencias-gestion.test.ts`
- `tests/integration/db/486-evidencias-cierres-sql-real.test.ts`
- bloques «486 · …» añadidos al final de `tests/unit/services/cierres-admin-service.test.ts`,
  `cierres-bodega-admin-service.test.ts`, `cierre-dia-service.test.ts` y `cierre-dia-477-resolicitud.test.ts`.

Tests modificados:
- `tests/unit/repositories/cierres-admin-gestiones-where.test.ts`: el literal de diferencia de claves
  pasa a `["evidenciaStoragePath", "evidencias"]` con comentario (contrato, ficha 486). El caso «la
  proyección NO lee evidencia» y `cierres-bodega-gestiones-where.test.ts` NO se tocaron y siguen verdes.
- Fixtures (mecánico, ~55 archivos): cada `evidenciaStoragePath: X` de una fila de dominio gana
  `evidenciaStoragePaths: [X]`/`[]`; cada `evidenciaUrl: X` de un DTO gana `evidenciaUrls: [X]`/`[]`
  (incluidas las ~28 fixtures de componente y `tests/fixtures/gestion-detalle-478.ts`, para que el
  typecheck quede verde ya; el frontend no tiene que tocarlas). Los dobles de FILA DE BASE de los
  tests de repositorio ganan `evidencias: []` (sin hijas → la portada por fallback), y tres
  aserciones de repositorio afirman ahora `evidenciaStoragePaths: [portada]` (R5).

## Mapa R → test (backend)

| R | Test |
| --- | --- |
| R1 | integración «el detalle de cierre de mensajero (admin) trae las 3 rutas…» (`findCierreByIdEnAlcance` real) + `cierres-admin-service.test.ts` «486 · R1/R4: entrega las 3 URLs firmadas…» |
| R2 | integración «el detalle de cierre de bodega trae las 3 rutas…» (`findCierreBodegaConDetalle` real) + `cierres-bodega-admin-service.test.ts` «486 · R2/R4…» |
| R3 | integración «el cierre pasado del mensajero (y la corrección 477)…» (`findCierrePropioConGestiones`) y «la vista en vivo…» (`findGestionesPendientes`) + `cierre-dia-service.test.ts` «486 · R3/R4/R8: listarCierreDia…», «R3/R9: verCierrePasado…» + `cierre-dia-477-resolicitud.test.ts` «486 · R3/R8: …correccion» |
| R4 | integración (hijas insertadas 2,0,1 → salen 0,1,2 en las cuatro lecturas) + `evidencias-gestion.test.ts` «R4: …» |
| R5 | integración (gestión B: portada sin hijas → `[portada]`) + `evidencias-gestion.test.ts` «R5: …» + aserciones `evidenciaStoragePaths: [portada]` en `cierres-admin-repository`, `cierres-bodega-admin-repository`, `cierre-dia-repository` |
| R6 | `evidencias-gestion.test.ts` «R6: sin hijas ni portada → []» + integración (gestión C) + servicios (gestión sin fotos → `[]`) |
| R7 | los tres tests de servicio + 477: «R7: el DTO no contiene ninguna ruta cruda» (JSON sin los paths) |
| R8 | los tres tests de servicio + 477: «UNA sola llamada a createSignedUrls con todas las rutas»; integración «R8: … (3 vs 6 gestiones)»: 1 consulta a `gestion_orden_evidencia` en ambos y el mismo total de consultas (log de Prisma) |
| R9 | `cierres-admin-service.test.ts` y `cierres-bodega-admin-service.test.ts` «R9: si el firmador omite la foto 2…», `cierre-dia-service.test.ts` «R3/R9: verCierrePasado…», `evidencias-gestion.test.ts` «R9» |
| R10 | `cierres-admin-service.test.ts` «486 · R10: firmador que lanza → ok con listas vacías»; `cierre-dia-service.test.ts` «486 · R10: verCierrePasado…»; `cierre-dia-477-resolicitud.test.ts` (best-effort existente extendido a `evidenciaUrls: []`) |
| R11 | `cierres-admin-service.test.ts` «486 · R11» (no_encontrada / forbidden / satélite sin zona → firmador no llamado); `cierres-bodega-admin-service.test.ts` «486 · R11»; `cierre-dia-service.test.ts` «486 · R11» |
| R17 | `cierres-admin-gestiones-where.test.ts` (literal actualizado + «NO lee evidencia» intacto) y `cierres-bodega-gestiones-where.test.ts` (intacto, verde). La parte de componente (`CierresDescarga.test.tsx`) es del frontend. |
| R12-R16, R18 | FRONTEND (T6-T8): `BotonesEvidencia`, `CierreEvidenciasVarias486.test.tsx`, `cierre-dia-descarga-columnas.test.ts` (vive en `app/(app)/cierre-dia/_components/`). |

## Mutaciones (T1/T3)

- M1 quitar `orderBy: { indice: "asc" }` de `GESTION_ADMIN_SELECT` → integración ROJA (R1 y R2: 2 failed).
- M2 quitar `evidencias` de `WITH_DETALLE` (mapper con `[]`) → integración ROJA (R3 pasado y en vivo: 2 failed).
- M3 `rutasEvidenciaGestion` devuelve siempre `[portada]` → unit ROJO (2) + integración ROJA (5).
- Las tres restauradas y verificadas (los `orderBy` y la rama de hijas están en el archivo).

## Verificación

Gate `./init.sh --rapido` (modo AMPLIADO: el diff toca repositorios/servicios de cierre, que la
lista trata como dinero/datos), log en `progress/gate_486_backend.log` (no commiteado):

- Pasada 1: INIT_EXIT=1. Rojo PROPIO: `tests/unit/services/gestion-desde-ayuda-rotulo-cierre.test.ts`
  — el script de fixtures había puesto `evidenciaStoragePaths` en una fila de BASE (`as unknown`) del
  mapper de admin; corregido a `evidencias: []`, 11/11 verde aislado. Rojo ajeno:
  `tests/components/EstadoCuenta463.test.tsx` (timeout de 20 s bajo carga) → 26/26 verde aislado:
  **intermitente**.
- Pasada 2 (con el arreglo): **INIT_EXIT=0, «init OK»**. typecheck y lint verdes (lint: solo
  warnings preexistentes). Relacionados: 4790 passed, 2 rojos en `tests/integration/wallet-page.test.tsx`
  (timeouts 21 s/9,5 s) que el gate repitió aislados → 13/13 verde: **intermitente**. Guardias:
  3755/3755. Integración contra Postgres: 4217 passed, 2 rojos
  (`notificacion-evento-geocodificacion-caida-migration.test.ts`, `usuarios-filtro-busqueda.test.ts`)
  repetidos aislados por el gate → 38/38 verde: **intermitentes** (base local compartida). **0
  `skipped`** en el log; el test nuevo `486-evidencias-cierres-sql-real` corrió (6 tests) en las dos pasadas.
- Ninguno de los rojos ajenos toca tablas de la 419.

A mano (antes del gate): `cierres-admin-gestiones-where`, `cierres-bodega-gestiones-where`,
`cierre-detalle-superficies.guardia` y los tests de repositorio/servicio de cierres: 16 archivos,
557 tests verdes; servicios + util: 309 verdes; integración nueva: 6/6.

## Veredicto

Backend de la 486 hecho (R1-R11 y la parte de repositorio de R17 cubiertas y probadas contra
Postgres); el DTO ya entrega `evidenciaUrls`. Falta el frontend (R12-R16, R18 y la parte de componente de R17).

---

# FRONTEND (T6-T8, T10)

Búsqueda: grafo `codebase-memory` + confirmación en el archivo real (lectura entera antes de editar).

## Archivos

- `app/(app)/cierres-admin/_components/botones-evidencia.tsx` (nuevo): `BotonesEvidencia({ urls, onVer, etiqueta?, ariaSufijo? })`.
  0 → nada; 1 → «Ver evidencia» con el `aria-label` de siempre; N → «Ver evidencia 1..N», `aria-label`
  «Ver evidencia k de N <sufijo>», en un `role="group"`. Usa el `Button` de shadcn; el visor no cambia.
- `cierre-factura.tsx` `FilaGestion`: monta `BotonesEvidencia` con `g.evidenciaUrls` (S1, S2 y cierre pasado de S3).
- `CierreDiaModule.tsx` `columnaEvidencia`: `BotonesEvidencia`; sin fotos, «—» (tablas de rechazo e incidente en vivo).
- `cierre-dia-descarga-columnas.ts` `tieneEvidencia`: «Sí» si `evidenciaUrls.length > 0` (R18; equivalente a
  `evidenciaUrl` por contrato, pero dice lo que exige el requisito).
- Tests: `tests/components/CierreEvidenciasVarias486.test.tsx` (nuevo, 10), bloque «FICHA 486 (R17)» en
  `tests/components/descarga/CierresDescarga.test.tsx`, bloque «FICHA 486 (R18)» en
  `tests/unit/descarga/cierre-dia-descarga-columnas.test.ts`. Ninguna aserción existente de «Ver evidencia»
  con una foto se tocó (los 10 archivos de componente/guardia que la mencionan: 265/265 verdes).

**Hallazgo (R16):** el panel de corrección del cierre rechazado (477) NO ofrece «Ver evidencia» hoy (lista sin
columna de evidencia). R16 dice «donde hoy se ofrece», así que ahí no se añadió nada; si se quiere, es ficha aparte.

## Mapa R → test (frontend)

| R | Test |
| --- | --- |
| R12 | `CierreEvidenciasVarias486.test.tsx` «R12: una evidencia → un único botón…» + S1 «1 foto → Ver evidencia» + S3 en vivo (`REM-UNA`) |
| R13 | idem «R13: tres evidencias → Ver evidencia 1, 2 y 3…» (texto y `aria-label` literales) |
| R14 | idem «R14: pulsar Ver evidencia 2 entrega la URL 2»; S1/S2 (callback con URL 2/3); S3 pasado y en vivo (src del visor real = URL 2/3) |
| R15 | idem «R15: sin evidencias no pinta ningún botón» + S1 `REM-NADA` + S3 en vivo celda «—» |
| R16 | idem: S1 `CierreFacturaDetalle` admin; S2 `GestionesPorResultado` con `contexto` (lo que monta `CierresBodegaAdminModule`); S3 cierre pasado (flujo real de `CierreDiaModule` + visor) y tablas de rechazo e incidente en vivo |
| R17 (componente) | `CierresDescarga.test.tsx` «FICHA 486 (R17): con 3 fotos firmadas por gestión, ninguna de las 3 URLs llega al archivo» (anti-vacuidad: la pantalla pinta «Ver evidencia 3») |
| R18 | `cierre-dia-descarga-columnas.test.ts` «FICHA 486 (R18)»: rechazo e incidente, «Sí» con 3, «Sí» con 1, «No» con 0, ninguna URL en celdas |

## Mutaciones

- M4 `BotonesEvidencia` con `urls.length >= 1` (solo la primera) → 9 rojos en `CierreEvidenciasVarias486` + `CierresDescarga`. Restaurada.
- M5 `tieneEvidencia` con `length > 1` → sobrevivía a la primera versión del test (3 y 0); se añadió el caso «una sola → Sí»
  y pasa a 2 rojos. Restaurada.

## T10 — ver la app: BLOQUEADO (no hecho)

- Dato local encontrado: cierre `70ebf5e2-…` (aprobado, central) con la gestión `05d95559-…` (incidente) con 2 hijas
  (`qa-seed/entregada-…-0.jpg`, `-1.jpg`). No hizo falta sembrar.
- Dev server levantado (puerto 3486), compiló y sirvió `/login`. **El login de `admin.qa@ordenex.test` con el
  `QA_PASSWORD` del `.env` falla** («Correo o contraseña inválidos»): la clave local fue rotada por otra sesión.
  Correr el seed de QA estaba vetado; crear una cuenta admin local propia lo denegó el clasificador de permisos
  (la fila que llegó a insertarse se BORRÓ en el acto: `DELETE 1`). Sin credencial no hay capturas.
- Dev server parado; `.next/dev` borrado. `progress/486_t10/` no se creó.
- Para cerrarlo: una credencial de admin local válida (o permiso para rotar QA), y repetir: `/cierres-admin?cierre=70ebf5e2-8f69-4bb5-9367-814f73545e29`, pestaña Incidente, desplegar la fila, esperar «Ver evidencia 1/2» y dos `src` distintos en el visor.
  Ojo: la firma va contra el Supabase del `.env` local; si esas rutas `qa-seed/` no existen en ese bucket, R9 las omite y no saldría ningún botón (sería dato, no código).

## Gate

`./init.sh --rapido` (ampliado con `integration/db`), log `progress/gate_486_frontend.log` (no commiteado):
- Pasada 1: INIT_EXIT=1. Rojo PROPIO: `censo-order-status-rename` cazó el literal `"rechazada"` (código retirado
  por la 455) como nombre de caso en el test de R18; renombrado a «devolución por rechazo». Rojo ajeno:
  `pago-por-cuenta-tienda.test.ts` (deadlock) verde aislado → intermitente.
- Pasada 2: **INIT_EXIT=0, «init OK»**. Relacionados 4865/4865, guardias 3755/3755, integración 4219/4219 (+49 al
  repetir); `ranking-snapshot-migration.test.ts` rojo en paralelo y verde aislado → intermitente. 0 `skipped`.

## Veredicto frontend

R12-R18 cubiertas y verdes; T10 pendiente por credencial de admin local.
