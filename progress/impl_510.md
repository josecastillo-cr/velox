# Ficha 510 — Implementación

Rama `fix/510-filtros-cierres-bodega`, worktree `R:/job/singularis/projects/ordenex-wt-510`. Solo frontend; sin migración ni cambio de servidor.
Búsqueda con Grep/Read (las rutas venían dadas en la ficha; no hizo falta el grafo).

## Arreglo

- `CierresBodegaResueltosLista.tsx` y `CierresBodegaSolicitadosLista.tsx`: prop `filtros: FiltrosCierresBodega` **obligatoria** (olvidarla fue el bug; ahora la detecta el typecheck). `filtros` entra en la clave SWR y en la llamada a la action; `fallbackData` solo si `sinFiltrosBodega(filtros)` (mismo patrón que Pendientes/«A consolidar»). Al cambiar `filtros` la lista vuelve a página 1 (ajuste en el render, no en un efecto).
- `CierresBodegaAdminModule.tsx:672` y `ConsolidacionBodegaModule.tsx:442/450`: pasan su estado `filtros`. En el caso sin zona (`:450`) no hay barra y `filtros` es `{}`.

## Backend (verificado, sin tocar)

Los filtros SÍ se propagan en las dos rutas:
- Resueltos: `lib/actions/cierre-bodega.ts:195` (`listarCierresBodegaPaginadoSchema`) → `CierresBodegaAdminService.ts:100-103` → `CierresBodegaAdminRepository.findHistoricoPaginado` `:321` → `historicoBodegaWhere(filtros)` `:194`.
- Solicitados: `lib/actions/cierre-bodega.ts:177` → `CierreBodegaService.ts:258-262` → `CierreBodegaRepository.findCierresBodegaByZonaPaginado` `:472` → `cierresBodegaDeZonaWhere(zonaId, filtros)` `:244` (zona del actor + recorte con AND).

## Revalidación

`refrescarListas` (`CierresBodegaAdminModule.tsx:509`) filtra por `clave[0]`; añadir `filtros` al final de la clave no lo cambia, así que la cola sigue cubierta.

Ampliación aprobada por el humano: ese `mutate` nunca cubrió `cierres-bodega:resueltos`. Las dos pestañas siguen montadas (`PanelConmutado` solo pone `hidden`), así que cambiar de pestaña no revalidaba y la fila que salía de la cola no aparecía en Resueltos hasta recuperar el foco. Ahora el filtro acepta `cierres-bodega:pendientes` o `cierres-bodega:resueltos` (cualquier página/filtro).
- Test: `tests/components/cierres-bodega-revalidar-resueltos-510.test.tsx` — dispara `refrescarListas` por el camino `no_encontrada` de abrir el detalle; Resueltos vuelve a pedir su página y pinta la fila resuelta. Espera a que termine la revalidación de montaje antes de cambiar el doble (si no, pasaría sin el arreglo).
- Mutación: quitar `|| clave[0] === "cierres-bodega:resueltos"` → rojo. Restaurado; verde 3 veces seguidas junto a `CierresBodegaAdminDebe498.test.tsx`.

## Tests

- Nuevo `tests/components/cierres-bodega-listas-filtros.test.tsx` (3): por lista, con filtro de bodega la action recibe `filtros`, la precarga sin filtrar no se pinta y solo sale lo devuelto; en Resueltos, cambiar de filtro vuelve a página 1.
- Mutaciones: revertir el arreglo en las dos listas → 3/3 rojos. Solo quitar el reset de página → cae el de página 1. Solo quitar `sinFiltrosBodega` del fallback en Solicitados → cae el suyo. Restaurado y comprobado con `cmp`.
- Ajustados (solo `filtros={{}}`): `CierreBodegaTarjetaCascada.test.tsx`, `CierreBodegaMarcaConciliacion.test.tsx`.

## Gate

`./init.sh --rapido` (ampliado solo con `tests/integration/db`): `INIT_EXIT=0`, `init OK`, 0 skipped. Relacionados 284/284 archivos y 3947 tests. Integración: 2 rojos en paralelo, verdes aislados → intermitentes: `ajuste-caja-anulacion-461.test.ts`, `busqueda-comportamiento.test.ts`.

Gate tras la ampliación de `refrescarListas`: `INIT_EXIT=0`, `init OK`. Relacionados 284/284 archivos (3947 tests); componentes relacionados 16/16. Integración: 3 rojos en paralelo, verdes aislados (33 tests) → intermitentes: `liquidacion-reparto-migration.test.ts` (sus 9 skipped son de esa corrida en rojo), `push-destinatarios-equivalencia.test.ts`, `seed-usuarios-qa-494.test.ts`.
