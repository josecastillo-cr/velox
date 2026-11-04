# 494 — Censo de la marca retirada

> Emitido por `tests/fixtures/marca-sin-ordenex-494.ts` (`pnpm exec tsx … censo`) sobre `981473d7`. El trinquete, por archivo, está en `tests/fixtures/marca-pendientes-494.ts`.
> El repo es público: dominios, URLs y correos solo se cuentan, sin escribir su valor. El clasificador de tipos es por línea y aproximado; el total no.

**Total: 2365 apariciones en 556 archivos**, fuera de excepciones activas.

## Por superficie

| Superficie | Archivos | Apariciones |
| --- | --- | --- |
| tests | 323 | 1370 |
| lib | 146 | 512 |
| app | 57 | 372 |
| db | 1 | 47 |
| scripts | 7 | 24 |
| components | 11 | 21 |
| e2e | 3 | 5 |
| public | 1 | 5 |
| hooks | 2 | 3 |
| raiz | 3 | 3 |
| docs | 1 | 2 |
| .claude | 1 | 1 |

## Por tipo

| Tipo | Archivos | Apariciones | Dónde se resuelve |
| --- | --- | --- | --- |
| Palabra suelta en mayuscula (`Ordenex`, `ORDENEX`: comentario o dato de prueba) | 336 | 904 | Tanda 7 (§3.4) |
| Identificador compuesto (`netoOrdenex`, `NETO_ORDENEX_LABEL`, `solo_ordenex`) | 169 | 868 | Tandas 2-4 (§3.1), y lo que no tape la tabla: abajo |
| Palabra minuscula (clave, valor o variable: `.ordenex`, `"ordenex"`) | 39 | 243 | Tandas 3-4 por lista de rutas (§3.1) |
| Dominio, URL o correo (valor no se versiona: repo publico) | 51 | 138 | Tanda 6 y 7 (§6, §3.5) |
| Ruta de modulo o de archivo | 65 | 81 | Tanda 2 y T7.3 (§3.1, §9) |
| Clave de navegador y protocolo del service worker | 32 | 65 | Tanda 1 (§5) |
| Nombre de la base local | 26 | 47 | E4, T7.1 |
| Cabecera de firma vieja (negativa de contrato) | 5 | 15 | Tanda 7 (§3.5, fixture de ids retirados) |
| Nombre de archivo o carpeta | 3 | 3 | Tanda 2 y T7.3 |
| Negativa con expresion regular o lista de marca | 1 | 1 | Tanda 7 (§3.5) |

## Lo que ya existe con el nombre de destino (T1.3, design §3.1)

- Identificadores de destino de la tabla (`netoEmpresa`, `solo_empresa`, …): **0**.
- `empresa` con forma de código (`.empresa`, `empresa:`, `"empresa"`): **0**.
- Destino de navegador (`app:…`, `app_tema`): **0**.
- `empresa`/`EMPRESA` en prosa (comentario, texto visible o nombre de un test), sin colisión: **69 líneas en 41 archivos**:

| Archivo | Líneas |
| --- | --- |
| `app/(app)/cierres-admin/_components/cierre-factura.tsx` | 9 |
| `docs/api/guia-integracion/guia-integracion.html` | 6 |
| `lib/asistente/instrucciones.ts` | 3 |
| `tests/components/AyudaDocumentoPage.test.tsx` | 3 |
| `tests/components/AyudaLayout.test.tsx` | 3 |
| `tests/components/CierreDiaModule.test.tsx` | 3 |
| `app/(app)/cierre-dia/_components/cierre-dia-descarga-columnas.ts` | 2 |
| `components/shared/AsistentePanel.tsx` | 2 |
| `lib/interfaces/services/ICierreDiaService.ts` | 2 |
| `tests/unit/api/openapi-marca-493.test.ts` | 2 |
| `tests/unit/ayuda/acotamiento-por-rol.test.ts` | 2 |
| `tests/unit/descarga/cierre-dia-descarga-columnas.test.ts` | 2 |
| `tests/unit/utils/caja-tesoreria.test.ts` | 2 |
| `app/_landing/LandingServicios.tsx` | 1 |
| `app/(app)/ayuda/[...slug]/page.tsx` | 1 |
| `app/(app)/cierre-dia/_components/CierreDiaModule.tsx` | 1 |
| `app/(app)/cierres-admin/_components/cierre-detalle-shared.tsx` | 1 |
| `app/(app)/wallet/_components/BarraComposicionCaja.tsx` | 1 |
| `docs/ayuda/oficina/configuracion-sinpe.md` | 1 |
| `docs/ayuda/oficina/wallet-caja.md` | 1 |
| `docs/ayuda/satelite/mi-bodega.md` | 1 |
| `lib/ayuda/documento.ts` | 1 |
| `lib/repositories/CierreDiaRepository.ts` | 1 |
| `lib/utils/cifra-aproximada.ts` | 1 |
| `tests/components/AppLayout.test.tsx` | 1 |
| `tests/components/AsistentePanel.test.tsx` | 1 |
| `tests/components/BarraComposicionCaja498.test.tsx` | 1 |
| `tests/components/CierreFacturaFilaIncidente.test.tsx` | 1 |
| `tests/components/CierreFacturaSinGestionar.test.tsx` | 1 |
| `tests/components/CierreMensajeroDesglosePorTienda.test.tsx` | 1 |
| `tests/components/MarcaPwaLanding493.test.tsx` | 1 |
| `tests/unit/components/configuracion-marca-493.test.tsx` | 1 |
| `tests/unit/components/wallet-conceptos-manuales.test.ts` | 1 |
| `tests/unit/docs/changelog-api-493.test.ts` | 1 |
| `tests/unit/guards/asistente-sin-datos.guardia.test.ts` | 1 |
| `tests/unit/guards/ayuda-pantalla-ruta-existe.guardia.test.ts` | 1 |
| `tests/unit/guards/ayuda-render-sin-filtracion.guardia.test.ts` | 1 |
| `tests/unit/guards/wallet-etiqueta-cuenta.guardia.test.ts` | 1 |
| `tests/unit/services/cierre-dia-service.test.ts` | 1 |
| `tests/unit/types/plantilla-datos.test.ts` | 1 |
| `tests/unit/utils/incidente-no-mueve-dinero.test.ts` | 1 |

## Identificadores que la tabla no tapa

Ni en §3.1 ni en las filas añadidas al script. No son colisión: los resuelve la tarea que toque (T7.1 para los nombres de la base local, T8.1 para datos de prueba), o `tsc` y la guardia los señalan.

| Identificador | Archivos | Apariciones |
| --- | --- | --- |
| `esDestinoLocalOrdenex` | 3 | 10 |
| `ordenex_prod` | 4 | 7 |
| `ordenex_tema` | 3 | 3 |
| `ordenex_` | 1 | 2 |
| `ordenex_455` | 1 | 1 |
| `ordenex_459` | 1 | 1 |
