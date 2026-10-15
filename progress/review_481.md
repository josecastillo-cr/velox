# Review 481 — fulfillment solo para la central (sdd:false)

Rama `fix/481-fulfillment-solo-central`, PR #859, HEAD revisado 060eac96 (con origin/dev mergeado).
Revisado en el worktree `wt-481`. Busqueda: grafo no usado; `grep` sobre el arbol real (los
hallazgos se confirmaron leyendo los archivos).

## Checklist

- [x] **Trazabilidad (sin spec: sdd:false).** Los pedidos del humano mapean a tests que muerden:
  - Pantalla (comprobante, audiencia `satelite`) -> `tests/components/CierreFacturaFilaIncidente.test.tsx` describe «481».
  - Servidor (`verCierreDetalle`, `listarGestionesCierresAdminCompleto`) -> `tests/unit/services/cierres-admin-fulfillment-solo-central.test.ts` (6 casos: maestro/admin/satelite x 2).
  - Excel «Detalle» -> `tests/components/descarga/CierresDescargaNiveles.test.tsx` describe «ficha 481» (satelite sin columna; central con ella tras «A cobrar»).
  - Central sin cambios en bodega (478) -> `tests/components/CierreBodegaDetalleGestiones.test.tsx` R6/R9.
- [x] **Tasks:** no aplica (sin `tasks.md`; ficha sdd:false). Bitacora `progress/impl_481.md` completa.
- [x] **Checkpoints:** typecheck/lint/tests verdes; sin tablas, migraciones, webhooks ni secretos nuevos;
  capas respetadas (recorte en el Service, decision de audiencia en el Server Component con
  `esAccesoTotal`, componentes por props); sin hardcode de contexto. E2E: inaplicable (no hay harness).
  `progress/history.md`: lo cierra el leader.
- [x] **Gate con base:** `./init.sh --rapido` con `DATABASE_URL` -> `progress/gate_review_481.log`,
  **INIT_EXIT=0**, modo AMPLIADO (358 archivos contra Postgres SI ejecutados). Dos intermitentes
  ajenos, verdes aislados: `tests/integration/db/454/retiro-estados-migration.test.ts`,
  `tests/integration/db/cobro-tienda-461.test.ts`.
- [x] **`gh pr checks 859`:** Vercel pass, Vercel Preview Comments pass.

## Verificacion por punto

1. **adminSatelite / mensajero sin fulfillment.**
   - Comprobante: `CierreFacturaDetalle` pasa `verFulfillment={audiencia === "admin"}`; `satelite` y `mensajero` lo callan.
   - Servidor: `ocultarFulfillmentSiNoCentral` (falla cerrado: «no es acceso total») en `verCierreDetalle` y `listarGestionesCierresAdminCompleto`.
   - Excel: `columnasDescargaGestionesFundidaPara("satelite")` retira la columna; el boton resuelve todo lo que no es `admin` a `satelite`.
   - Otras vias revisadas, sin fuga: los productores de `ingresoOrdenex` son `toPendienteRowDesdeSnapshot` (solo via `findCierreByIdEnAlcance` -> `verCierreDetalle` y el aviso interno de rechazo) y `toGestionDescargaDTO` (solo `findGestionesPorAlcanceCompleto` y el repo de bodega). Todo `CierresBodegaAdminService` exige `esAccesoTotal` (forbidden a la satelite). Mensajero: `CierreDiaRepository` no proyecta `ingresoOrdenex` (solo congela `tarifaFulfillment` al escribir). `/ordenes` hace `notFound` a la satelite y el recorte de zona (`lib/types/recorte-alcance-orden.ts`) ya quita fulfillment en monitoreo/recepcion; analitica: `ALCANCE_PRODUCTOS_DINERO.adminSatelite = "prohibido"`. Las descargas de Resumen de cierres no llevan fulfillment.
2. **Central sin cambios.** `COLUMNAS_DESCARGA_GESTIONES_FUNDIDA` intacta; los tests de la central solo anaden `audiencia="admin"`, esperados literales sin tocar; detalle de bodega conserva `verFulfillment = !esMensajero` (verde, y la mutacion M3 lo pone rojo).
3. **Totales.** El helper solo anula `tarifa.fulfillment`; `totalesIngresoOrdenex(found.gestiones)` se calcula sobre las filas crudas y el fulfillment no entra en `derivarIngresoOrden`. Nada cambia.
4. **Default seguro.** `CierresBodegaAdminModule` default `satelite`; su unico montaje real (`page.tsx`) pasa `esAccesoTotal ? "admin" : "satelite"` y solo se monta para acceso total -> la central conserva la columna. `CierresAdminModule` igual (default `satelite`, unico montaje con el mismo ternario). `DescargarCierresButton.audiencia` es obligatoria.

## Mutaciones del reviewer (todas revertidas con `git checkout --`, `git status` limpio)

| # | Mutacion | Resultado |
|---|---|---|
| M1 | `CierresAdminModule` pasa `audiencia="admin"` al `CierreFacturaDetalle` | **sobrevive** (17 archivos que montan el modulo, 329 tests verdes) |
| M2 | `verFulfillment={audiencia !== "mensajero"}` | 1 rojo |
| M3 | default `verFulfillment = false` en `GestionesPorResultado` | 2 rojos (478 bodega) |
| M4 | helper del servicio no-op | 2 rojos |
| M5 | boton siempre columnas `admin` | 1 rojo |
| M6 | la central recibe tambien la lista filtrada | 9 rojos |
| M7 | `CierresAdminModule` pasa `audiencia="admin"` al boton | 1 rojo |
| M8 | `CierresBodegaAdminModule` pasa `audiencia="satelite"` al boton | 5 rojos |

## Hallazgos

- **menor** — M1 sobrevive: ningun test monta `CierresAdminModule` con audiencia `satelite` y despliega una fila; el cableado modulo->comprobante no esta cubierto. Riesgo bajo porque el servidor ya manda `fulfillment: null` (cubierto por M4), pero la capa de pantalla se sostiene solo por lectura.
- **menor** — el ternario de `page.tsx` (Server Component) no tiene test; declarado en la bitacora.
- **menor** — los montajes de test de `CierresAdminModule` que no pasan `audiencia` (p. ej. `CierresDescarga*.test.tsx`, `CierresAdminModule.test.tsx`) prueban ahora la variante `satelite` por el default; hoy no afirman fulfillment, pero quien los lea como «la central» se equivoca.
- **menor** — el `--rapido` imprime «! no hay .env» aunque `DATABASE_URL` este exportada; inocuo (la integracion SI corrio).

## Veredicto

**OK** — 0 bloqueantes, 4 menores. INIT_EXIT=0 con base.
