# 486 — Evidencias con varias fotos en los cierres · revisión

Revisor: reviewer (2026-10-21). Worktree `.claude/worktrees/f486`, rama
`feature/486-evidencias-varias-fotos-cierres`, HEAD revisado `3ae4445c`, diff contra dev `f34f0f6d`.
Búsqueda de código: MCP `codebase-memory` (`R-job-singularis-projects-ordenex`) + confirmación en el
archivo real.

## Veredicto: **OK** (sin bloqueantes; T10 pendiente, no bloqueante del código)

## Checklist

### Especificación
- [x] `requirements.md` con R1..R18 en EARS.
- [x] `design.md` con 5 alternativas descartadas y su porqué.
- [ ] `tasks.md` con todas las tasks `[x]` — **ninguna está marcada** (ver hallazgo m1). T0-T9 están
  hechas según bitácora y verificación propia; T10 no.

### Trazabilidad (R → test, verificado leyendo el test, no solo el mapa)
- [x] R1 integración `486-evidencias-cierres-sql-real` «R1/R4/R5/R6 … (admin)» (`findCierreByIdEnAlcance` real) + `cierres-admin-service` «486 · R1/R4».
- [x] R2 integración «R2/R4/R5/R6 … bodega» (`findCierreBodegaConDetalle` real) + `cierres-bodega-admin-service` «486 · R2/R4».
- [x] R3 integración (cierre pasado/477 y en vivo) + `cierre-dia-service` «R3/R4/R8 listarCierreDia», «R3/R9 verCierrePasado» + `cierre-dia-477-resolicitud` «486 · R3/R8».
- [x] R4 integración (hijas insertadas 2,0,1) + `evidencias-gestion.test.ts`.
- [x] R5 integración (gestión B: portada sin hijas) + util + repos.
- [x] R6 util «sin hijas ni portada → []» + integración (gestión C).
- [x] R7 «el DTO no contiene ninguna ruta cruda» (JSON.stringify) en admin, bodega y mensajero.
- [x] R8 `toHaveBeenCalledTimes(1)` en los tres servicios + integración «3 vs 6 gestiones»: 1 consulta a `gestion_orden_evidencia` y mismo total (espía de Prisma).
- [x] R9 «si el firmador omite la foto 2…» en admin, bodega y `verCierrePasado` + util.
- [x] R10 «firmador que lanza → ok con listas vacías» (admin, `verCierrePasado`, 477).
- [x] R11 «no firma nada» con `createSignedUrls` `not.toHaveBeenCalled()` en los tres servicios.
- [x] R12-R15 `CierreEvidenciasVarias486.test.tsx` (bloque `BotonesEvidencia`, literales).
- [x] R16 idem, un bloque por superficie: S1 admin, S2 bodega, S3 mensajero (pasado + tablas en vivo).
- [x] R17 `cierres-admin-gestiones-where` (literal ampliado a `["evidenciaStoragePath","evidencias"]`, con motivo) + «NO lee evidencia» intacto + `cierres-bodega-gestiones-where` intacto + `CierresDescarga` «FICHA 486 (R17)».
- [x] R18 `cierre-dia-descarga-columnas` «FICHA 486 (R18)»: Sí con 3, Sí con 1, No con 0, sin URL.
- [x] `progress/impl_486.md` contiene el mapa R → test (backend + frontend).

### Verificación ejecutable (corrida por el revisor)
- [x] 12 archivos de la ficha a mano: 405/405 verdes; integración nueva 6/6 ejecutada (no saltada).
- [x] `./init.sh --rapido` (modo AMPLIADO con `integration/db`), log `progress/gate_486_review.log`:
  **INIT_EXIT=0, «init OK»**. typecheck y lint verdes (solo warnings preexistentes). Relacionados
  4865/4865, guardias 3755/3755, integración 4218/4219 con 1 rojo ajeno
  (`traspaso-mensajero.int.test.ts`, ficha 427) que el gate repitió aislado → 24/24: intermitente.
  **0 `skipped`** en el log; `486-evidencias-cierres-sql-real` corrió (6 tests).

### Mutaciones del revisor (todas restauradas; `git status` limpio tras cada una)
- **MR1** quitar `orderBy: { indice: "asc" }` de `WITH_DETALLE` (distinta de las M1/M2 del implementer)
  → integración ROJA: 2 failed (cierre pasado/477 y en vivo). El test ve el select real.
- **MR2** `rutasAFirmar` firma solo `.slice(0, 1)` de cada gestión → 10 rojos en util + los cuatro
  archivos de servicio (R1-R4, R8, R9 de admin, bodega, mensajero y 477).
- **MR3** añadir `evidencias` a `GESTION_DESCARGA_SELECT` → 3 rojos en las dos guardias
  `*-gestiones-where` (R22/R41 de la 230 y R17 de esta).

### Calidad y seguridad
- [x] R22/R41 intactos: `GESTION_DESCARGA_SELECT` sin cambios; las dos descargas de admin
  (`findGestionesPorAlcanceCompleto`, `findGestionesDeCierresBodegaCompleto`) siguen sobre ella;
  MR3 prueba que la guardia sigue viva.
- [x] Fallback a la columna vieja: `rutasEvidenciaGestion` (hijas mandan; sin hijas, portada; nada,
  `[]`), probado contra Postgres (gestión B) y en unitario; `evidenciaStoragePath` se conserva en
  las dos proyecciones.
- [x] Sin N+1 en lectura (relación anidada: una consulta por nivel, medida) ni en firma (UNA
  `createSignedUrls` por detalle; en bodega, aplanado de todos los `cierres_dia`). En la corrección
  477 sigue siendo una firma por cierre rechazado, como antes (fuera de alcance, lo dice el design).
- [x] R7: el DTO solo lleva URLs firmadas; `evidenciaStoragePaths` no cruza al cliente.
- [x] Capas: util puro en `lib/utils/`, tipos en `lib/interfaces/`, repos solo Prisma, servicios sin
  HTTP. Sin tabla nueva, sin migración, sin RLS que añadir, sin webhooks, sin secretos, sin
  hardcode de país/moneda.
- [x] `evidenciaUrls` OBLIGATORIO en fila y DTO: un productor que lo olvide no compila.
- [n/a] E2E: no hay harness (los specs existentes dicen NOT EXECUTED); la ficha no cambia dinero ni
  auth. El riesgo se cubre con la integración contra Postgres y los tests de componente.

### Verificación final
- [ ] `./init.sh` completo: no aplica (regla 5: solo antes de una release a `prod`).
- [x] `progress/review_486.md` existe con veredicto OK.
- [ ] Entrada en `progress/history.md`: no existe aún (m2).

## Hallazgos

- **m1 · menor** — `tasks.md`: ninguna task marcada `[x]` (CHECKPOINTS lo pide). T0-T9 están hechas
  y verificadas; el implementer debe marcarlas y dejar T10 abierta con su motivo.
- **m2 · menor** — falta la entrada de la 486 en `progress/history.md` (paso de cierre del leader).
- **m3 · menor (pendiente, no bloqueante del código)** — **T10 sin hacer**: no se vio la app. La
  credencial QA local falla; la bitácora deja la receta (`/cierres-admin?cierre=70ebf5e2-…`, pestaña
  Incidente, 2 hijas) y avisa de que si las rutas `qa-seed/` no existen en el bucket del `.env`
  local, R9 las omite y no saldría ningún botón (dato, no código). Cerrar con credencial válida
  antes de dar la ficha por `done` en el sentido de «lo que ve el usuario».
- **m4 · menor (spec)** — R16 nombra «la columna Evidencia … de su corrección (S3)», pero el panel de
  corrección 477 (`PanelCorreccion`, `CierreDiaModule.tsx:1384`) lista las gestiones SIN columna de
  evidencia; confirmado en el archivo. Como R16 dice «donde hoy se ofrece», no hay incumplimiento;
  el DTO de corrección ya trae `evidenciaUrls` sin consumidor (firma que nadie pinta, preexistente).
  Si se quiere mostrar, ficha aparte.
- **m5 · menor** — el caso «FICHA 486 (R17)» de `CierresDescarga.test.tsx` ejercita la descarga del
  MENSAJERO (territorio de R18), no las de admin; la parte de admin de R17 la cubren las guardias de
  proyección (y MR3 las mata). Cobertura suficiente, pero el rótulo del test apunta a otro requisito.

## Bloqueantes

Ninguno.
