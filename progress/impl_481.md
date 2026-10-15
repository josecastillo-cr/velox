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

---

# impl 481 — parte frontend (Excel «Detalle» sin «Fulfillment» para la satelite)

Merge de `origin/dev` (trae la 482, PR #860) sin conflictos.

## Archivos
- `app/(app)/cierres-admin/_components/cierres-gestiones-fundida-descarga-columnas.ts` —
  `AudienciaDescargaGestionesFundida` (`admin` | `satelite`) y
  `columnasDescargaGestionesFundidaPara(audiencia)`: `admin` devuelve la declaracion entera (mismo
  array, mismo orden); cualquier otra, la misma sin `fulfillment` (falla cerrado).
  `COLUMNAS_DESCARGA_GESTIONES_FUNDIDA` intacta.
- `DescargarCierresButton.tsx` — prop OBLIGATORIA `audiencia`; columnas del «Detalle» resueltas a
  nivel de modulo por audiencia (identidad estable para el hook de preferencia). Ambito sin cambios.
- `CierresAdminModule.tsx` — pasa su `audiencia` (ya existente, default `satelite`) al boton.
- `CierresBodegaAdminModule.tsx` — prop `audiencia` nueva, default `satelite` (falla cerrado).
- `page.tsx` — `audiencia={esAccesoTotal(actor.rol) ? "admin" : "satelite"}` tambien a bodega.
- Tests: `CierresAdminDescargaDetallada`, `CierresBodegaDescargaDetallada`, `CierresDescargaNiveles`
  montan con `audiencia="admin"` (son de la central); esperados literales SIN tocar.
  Nuevo describe en `CierresDescargaNiveles.test.tsx`: satelite sin «Fulfillment» (selector y
  cabecera del archivo = central menos esa columna); central con ella, tras «A cobrar».

## Otras superficies revisadas
Ninguna otra columna/celda de fulfillment en la pantalla de cierres: los resumenes de cola e
historico no la llevan; el comprobante ya lo calla con `verFulfillment` (audiencia `satelite`).

## Mutaciones (revertidas)
1. `columnasDescargaGestionesFundidaPara` devuelve siempre la entera -> 1 rojo (satelite).
2. `CierresAdminModule` pasa `audiencia="admin"` literal -> 1 rojo (satelite).
No cubierto por test: el ternario de `page.tsx` (Server Component), mismo patron que la parte servidor.

## Gate
`./init.sh --rapido` -> `progress/gate_481_c.log`, INIT_EXIT=0 (typecheck, lint y relacionados verdes; sin rojos).

Veredicto: la adminSatelite descarga el «Detalle» sin «Fulfillment»; la central, igual que antes.
