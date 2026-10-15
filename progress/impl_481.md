# impl 481 — fulfillment solo para la central (parte servidor)

Ampliacion aprobada por el humano el 2026-10-15 («solo lo debe ver la central»).

## Archivos
- `lib/services/CierresAdminService.ts` — helper `ocultarFulfillmentSiNoCentral` (falla cerrado:
  todo actor sin `esAccesoTotal` recibe `ingresoOrdenex.tarifa.fulfillment = null`), aplicado en:
  - `verCierreDetalle`: cada fila de `grupos` (`toDetalleDTO(...)` envuelto).
  - `listarGestionesCierresAdminCompleto`: cada item del conjunto (hoja «Detalle» del Excel).
- `tests/unit/services/cierres-admin-fulfillment-solo-central.test.ts` (nuevo, 6 casos).

## Forma del dato para la satelite
`ingresoOrdenex.tarifa.fulfillment: null` (el tipo `string | null` no admite omitirlo); el resto
de la tarifa y del ingreso, identico. Maestro/admin: sin cambios ("1500.00" en el test).

## Totales
Ninguno incluye fulfillment: no entra en `derivarIngresoOrden` (`lib/utils/ingreso-ordenex.ts`),
ni en `ingresoOrdenex.total`, ni en «Total Ordenex», ni en `totalesIngreso`/`partesPorTienda`.
Nada recalculado.

## Mapa requisito -> test
- satelite sin fulfillment (detalle y Excel) -> casos `adminSatelite: ...` de ambos describe.
- maestro/admin con fulfillment (detalle y Excel) -> casos `maestro`/`admin` de ambos describe.

## Mutaciones (revertidas)
1. Invertir el `if (esAccesoTotal)` -> 6/6 rojos.
2. Quitar el helper en `verCierreDetalle` -> 1 rojo (satelite, detalle).
3. Quitar el helper en `listarGestionesCierresAdminCompleto` -> 1 rojo (satelite, Excel).

## Gate
`./init.sh --rapido` (ampliado con integration/db) -> `progress/gate_481_b.log`, INIT_EXIT=0.
typecheck y lint pasan; 1 intermitente ajeno (`WalletLibroCaja458E.test.tsx`, verde aislado).

Veredicto: el fulfillment de la fila ya no sale del servidor hacia la adminSatelite.
