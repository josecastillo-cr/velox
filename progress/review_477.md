# 477 — Corregir las gestiones de un cierre rechazado — revisión

> reviewer, 2026-10-15. Worktree `agent-a17b3cf804581f0b2`, rama
> `feature/477-corregir-gestiones-cierre-rechazado`, HEAD revisado `3788c017`, diff `4d2248c5..3788c017`
> (merge-base con `origin/dev` = `4d2248c5`: la rama está al día).
> Búsqueda: MCP `codebase-memory` disponible; la revisión leyó el diff y los archivos reales
> (todo lo citado está confirmado en el árbol, no en el índice).

## Veredicto: RECHAZADO (solo por proceso; el código no tiene bloqueantes)

Dos bloqueantes de proceso, los dos baratos de cerrar. En lo técnico (dinero, WHERE, exención del
bloqueo, tests) no encontré nada bloqueante: el gate rápido ampliado está verde y 5/5 mutaciones mías
mueren.

## Checklist

| Punto | Estado |
|---|---|
| requirements.md EARS R1-R28 | OK |
| design.md con alternativas descartadas (A1-A6) | OK |
| tasks.md todas `[x]` | **FALLA**: 0 de 29 marcadas (incluidas las ya hechas) |
| Mapa R -> test en `progress/impl_477.md` | OK (R1-R28, backend + pantalla) |
| Cada R con test que muerde | OK (ver tabla y mutaciones) |
| typecheck / lint / tests (`./init.sh --rapido`, corrido por mí) | OK: `INIT_EXIT=0`, `== init OK ==` |
| integration/db (ampliado, dinero) | OK: 444/446 en paralelo, 2 rojos verdes AISLADOS (intermitentes), **0 skipped** |
| E2E en flujo crítico | No aplica: no hay harness E2E (decisión del humano); riesgo cubierto con Postgres real (T4.6 de extremo a extremo por servicios reales) |
| RLS / migraciones / down.sql | No aplica: sin esquema ni migración |
| Webhooks | Sin webhook nuevo; `gestion_anulada` reusa `encolarWebhookEvento` (helper compartido `registrarGestionAnulada`) |
| Secretos / hardcode de país-moneda | OK |
| Capas | OK: SQL en `lib/repositories/correccion-cierre.ts`, servicios sin Prisma, interfaces en `lib/interfaces/` |
| Composition root | OK: `lib/actions/cierre-dia.ts` y `lib/actions/mis-asignaciones.ts` inyectan `OrdenRepository` real (el typecheck lo exige por el `Pick`) |
| T5.5 «verlo en la app» | **FALLA**: no hecho (`progress/impl_477.md:216`) |
| `progress/history.md` | Pendiente del cierre de la ficha (leader) |

## Gate (`./init.sh --rapido`, ampliado, corrido por el reviewer)

- Relacionados (`--changed`): `660 passed (660)` archivos, `8608 passed | 26 skipped (8634)`.
- Guardias: `274 passed (274)`, `3764 passed`.
- `tests/integration/db` entera: `2 failed | 444 passed (446)`, 0 skipped. Rojos:
  `abono-tienda-457.test.ts` y `454/caracterizacion/corte-concurrencia.test.ts` (precondición «el corte
  QUEDÓ ESPERANDO el candado»); el gate los repitió AISLADOS: `2 passed (2)`, `14 passed` ->
  intermitentes. Ninguno toca código de la 477 (`crearCierre` y el corte no están en el diff).
- `INIT_EXIT=0`. Log en el scratchpad del reviewer (`gate_review_477.log`, fuera del repo).

### Los dos timeouts que dejó el frontend

`tests/integration/wallet-page.test.tsx` y `tests/unit/app/tarifas/TarifasPage.cobertura.test.tsx`:
**VERDES** en mi gate con el timeout por defecto (20 s): 13 tests en 14,1 s y 3 tests en 13,6 s.
Son carga de la máquina, no rojo: como no están rojos en la rama, no hizo falta compararlos contra
`dev` limpio. Ninguno importa nada del diff.

## Trazabilidad R -> test (verificada leyendo cada test)

| R | Test | Muerde |
|---|---|---|
| R1, R2, R3 | `tests/integration/db/477-deshacer-cierre-rechazado-sql-real.test.ts` (R1/R2/R3) | sí: anulada + desvinculada + snapshots NULL, evento + job, seis totales al céntimo con la tarifa cambiada a 9999 |
| R4 | `tests/unit/services/cierre-dia-477-deshacer.test.ts` (R4) | sí |
| R5 | ídem, 5 casos con `toEqual(referencia)` | sí (igualdad de respuesta, 0 escrituras) |
| R6 | unit + integración (servicio y escritura directa) | sí |
| R7, R8, R10 | unit | sí |
| R9 | unit + integración | sí |
| R11 | integración (repo: re-solicitado y ajeno) + unit (servicio) | sí (simulado, ver m4) |
| R12, R13, R14 | `477-regestionar-sin-cierre-sql-real.test.ts` + unit | sí (mutación C) |
| D2 | `477-ordenes-en-correccion-sql-real.test.ts` | sí (mutación D) |
| R15-R19 | `477-resolicitud-rechazado-sql-real.test.ts` caso 1 | sí (mutaciones B, E) |
| R20 | ídem R20 (foto completa antes/después con tarifa cambiada) | sí |
| R21 | `cierre-dia-477-resolicitud.test.ts` | sí |
| R22 | integración + unit | sí |
| R23, R24 | `477-aprobacion-tras-correccion-sql-real.test.ts` (servicios reales hasta aprobar) | sí (mutación A) |
| R25, R26, R28 | `tests/components/CierreDiaModule477Correccion.test.tsx` (+ datos en unit T4.7) | sí |
| R27 | `tests/components/RepartoModule477Correccion.test.tsx` + listado contra Postgres | sí |

## Mutaciones del reviewer (arnés propio, con control)

Control sin mutar: los 5 grupos verdes y ejecutados (no skipped); cada mutación con `count == 1` y
restauración byte a byte comprobada; árbol limpio al terminar.

| Mutación | Resultado |
|---|---|
| A — el deshacer conserva `cierre_id` (alternativa A1) | MUERE (deshacer + aprobación: 2 failed) |
| B — la re-solicitud no poda `cierre_detail` | MUERE |
| C — la exención del bloqueo vale para CUALQUIER orden | MUERE (3 failed, integración y unit) |
| D — predicado D2 sin `g.anulada_at IS NULL` | MUERE |
| E — la re-solicitud vincula sin estrechar por órdenes en corrección | MUERE |

## Foco pedido

1. **Dinero de la re-solicitud.** Correcto: candado `FOR UPDATE` de `cierre_dia` en las dos
   transacciones (deshacer y re-solicitud) con re-lectura del estado; vinculación por
   `gestionesDelCierreWhere` estrechado (el predicado de siempre, sin tocar) y re-lectura de lo que
   quedó con `cierre_id = X` antes de congelar; poda «en corrección menos rehechas»; seis totales por
   suma de snapshots. El deshacer desvincula (D1), así que los tres feeds que leen `cierre_id` sin
   filtrar anuladas no pueden cobrar la anulada (la mutación A lo demuestra). P6
   (`forzarSolicitudVencido`): el dinero cuadra porque el recálculo ocurre ya al deshacer. P1: ver m1.
2. **Excepción N/V.** Se limita al objeto: `motivoBloqueoParaOrden` solo en `escogerParaGestion` y
   `gestionar` (`lib/services/MisAsignacionesService.ts:548, 594`); `recoger` (`:466`) y
   `RecoleccionTiendaService.recolectarEnTienda` (`:109-111`) siguen con el bloqueo entero. En el
   deshacer, la gestión se lee y solo pasa si es corregible (a) o (b); el resto recibe el mismo
   `conflict`. El predicado exige `rechazado` + `mensajero_id` del actor + sin gestión vigente en ese
   cierre, y antes de la 477 el conjunto es vacío.
3. **WHERE con Postgres real:** sí, todos los de dinero y pertenencia; ver m2 para la excepción.
4. **Tests existentes cambiados:** legítimos. Los seis contratos cambian porque el `rechazado` ya no va
   por `transicionarASolicitado` y porque el deshacer bloqueado ahora LEE (D4); el «no lee» se sustituye
   por «mismo motivo + ninguna escritura», que es lo que importa. Ver m3 para el `toMatchObject`.
5. **Frontend:** textos en español claro, sin «SLA»; R28 quita «No se recalculan los montos» y cuenta
   las órdenes que saldrán (singular/plural, solo del cierre que se reenvía). R27: `bloqueadaPara`
   sustituye a `bloqueado` en tarjeta, botón, `seleccionar`, guarda de `gestionarPedido`, panel y modo
   foco; el enlace `/mis-asignaciones/reparto` existe.

## Hallazgos

- **BLOQUEANTE b1 — `specs/477-corregir-gestiones-cierre-rechazado/tasks.md`: 0 de 29 tasks marcadas
  `[x]`.** CHECKPOINTS exige todas. Hay que marcar las hechas (T0.1, T0.2 —medida en
  `impl_477.md:181`—, T1-T4, T5.1-T5.4 y T5.6 con este gate).
- **BLOQUEANTE b2 — T5.5 «verlo en la app» no hecho** (`progress/impl_477.md:216-217`). Es una task del
  spec, y la memoria «verificar lo que el usuario ve» lo exige para pantallas cambiadas. Lo puede
  hacer el leader: sembrar un rechazado local, recorrer rechazo -> deshacer -> Entregas -> gestionar ->
  re-enviar y anotar los totales antes y después.
- menor m1 — **carrera corte nocturno vs re-solicitud (de la misma clase que la preexistente corte vs
  solicitar).** `lib/services/CorteDiarioService.ts:189-209` calcula totales y pagos FUERA de la tx de
  `crearCierre`. Si `resolicitarCierreRechazado` vincula una gestión rehecha entre esa lectura y el
  `updateMany` del corte (`lib/repositories/CierreDiaRepository.ts:1162-1169`), el `vencido` nace con
  esa gestión en sus totales snapshot sin tenerla vinculada, y `WalletMensajeroFeedService` pagaría su
  `pago_mensajero` dos veces. La ventana es de milisegundos a la hora del corte y el patrón ya existía
  entre dos `crearCierre`; la 477 no lo introduce, pero añade un tercer vinculador. Recomendado: ficha
  aparte (recalcular en `crearCierre` sobre lo realmente vinculado, como `recalcularTotalesDelCierre`).
- menor m2 — `findCorreccionesPendientes` (`lib/repositories/CierreDiaRepository.ts:1763-1813`): el
  `regestionada` y el cruce por cierre solo se prueban con dobles (T4.7). Es solo pantalla, sin dinero.
- menor m3 — `tests/integration/db/cierre-bloqueo-nv-sql-real.test.ts:313`: el paso de `toEqual` a
  `toMatchObject` hace que la aserción ya no falle si la fila gana campos; un `toEqual` con
  `destinoZonaId` = la zona sembrada conservaría el contrato.
- menor m4 — R11/R22 se prueban simulando la carrera (estado cambiado en la misma tx), no con dos
  conexiones; el orden de candados de design §4 no tiene un test concurrente real (patrón C02 de la 454).
- menor m5 — R20 depende de que toda gestión vinculada tenga snapshot: `sumarSnapshotsCongelados`
  salta los `NULL` (`lib/utils/cierre-totales.ts:76`), así que un rechazado antiguo sin snapshots
  perdería `total_pago_mensajero` al re-solicitar. Hoy no está expuesto (T0.2: 0 rechazados en producción).
- menor m6 — el frontend no usó el MCP `codebase-memory` (regla 7); está declarado en `impl_477.md:188`.

## Para pasar a OK

Marcar `tasks.md` (b1) y hacer y anotar T5.5 (b2). Si no se toca código, no hace falta volver a
correr el gate.
