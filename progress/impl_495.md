# 495 — Fechas de cierre en hora de Costa Rica · informe de implementación

> Rama `fix/495-fechas-cierre-hora-cr` (worktree `wt-495`), nacida de `f0833d64`. Zona frontend.
> Spec aprobado el 2026-11-02 y ampliado a `/incidentes` (R10–R13) por decisión del humano.
> Búsqueda: MCP `codebase-memory` (`search_code` sobre `incidentes`) y confirmación en archivo con
> `grep`/lectura.

## Lo hecho por task

| Task | Commit | Qué |
|---|---|---|
| T0 | `74e916ad` | Rama y HEAD confirmados (`f0833d64`). Re-medición: S1–S7 coinciden con `requirements.md`. Spec ampliado con R10–R13 (incidentes), §3.3 bis y guardia ampliada en `design.md`, T4b en `tasks.md`. **Hallazgo:** además de los 4 sitios del encargo, `incidentes-descarga-columnas.ts:51,85` (I5) tiene el mismo recorte (`fechaDiaISO`); se incluyó para que pantalla y descarga no diverjan (R11) y la guardia quede sin excepciones. |
| T1 | `9ea37ab0` | `fechaDiaInstanteCR` en `lib/utils/fecha-dia-iso.ts` (delega en `fechaCalendarioCR`, sin rama de medianoche; lo no legible cae a `fechaDiaISO`). Test `tests/unit/utils/fecha-dia-iso.test.ts` (nació rojo: la función no existía). |
| T4 | `1c559178` | Guardia `tests/unit/guards/cierres-fecha-cr-495.guardia.test.ts` sobre `cierres-admin`, `cierre-dia` e `incidentes`. Nació roja listando exactamente los 16 sitios (ver abajo). |
| T2 | `1ef934f1` | `cierre-factura.tsx` `fecha()` → `fechaDiaInstanteCR`; `CierreDiaModule.tsx:937,1028`. Tests `tests/components/cierres-fechas-cr-495.test.tsx` (6 casos, rojos antes del arreglo) y bloque «Ficha 495» en `tests/components/CierreDiaModule.test.tsx`. |
| T3 | `9510e202` | Siete columnas de descarga de cierres → `fechaDiaInstanteCR`; comentario de `cierres-gestiones-fundida-descarga-columnas.ts` reescrito. Test `tests/unit/descarga/cierres-fechas-cr-495.test.ts` (rojo antes). |
| T4b | `640c6485` | `IncidentesAdminModule.tsx:488,504,774`, `IncidentesHistoricoTabla.tsx:196`, `incidentes-descarga-columnas.ts:51,85`. Test `tests/components/incidentes-fechas-cr-495.test.tsx` (rojo antes) + bloque R11/R12 de la descarga. La guardia queda verde. |
| T5 | — | Suites con fixtures 00:00–05:59 UTC verdes sin tocarlas: 5 `tests/unit/actions/*descarga-action.test.ts`, `CierresAdminModule`, `CierreFacturaPapel`, `CierreBodegaMarcaConciliacion`, `CierreDiaModule`, `wallet-fecha-cr-459.guardia` (12 archivos, 210 tests). Ningún esperado tuvo que cambiar. |
| T6 | — | Sin comentarios que recomienden `slice`/`fechaDiaISO` para fechas de cierre; queda `cierre-factura.tsx:48`, que EXPLICA por qué no se recorta. |
| T7 | (este commit) | Ver «Gate». |
| T8 | (este commit) | Ver la app: **inaplicable** — no hay dev server de este worktree y el encargo prohíbe interferir con otros (memoria «dos dev servers se pisan»; hay otras fichas en paralelo). El riesgo lo cubren los tests de componente que renderizan las tarjetas, el comprobante, el detalle y las tablas reales con un instante de las 23:03 CR. |

Salida de la guardia ANTES de los arreglos (T4):

```
cierres-admin/_components/cierre-factura.tsx:307
cierres-admin/_components/cierres-admin-descarga-columnas.ts:71, :104
cierres-admin/_components/cierres-bodega-descarga-columnas.ts:144, :177, :239
cierres-admin/_components/cierres-gestiones-fundida-descarga-columnas.ts:422
cierre-dia/_components/cierre-dia-descarga-columnas.ts:256
cierre-dia/_components/CierreDiaModule.tsx:935, :1026
incidentes/_components/incidentes-descarga-columnas.ts:51, :85
incidentes/_components/IncidentesAdminModule.tsx:485, :501, :771
incidentes/_components/IncidentesHistoricoTabla.tsx:193
```

Archivos revisados por la guardia: 41 (34 + 3 + 4).

## Mapa R → test

| R | Test |
|---|---|
| R1 | `tests/components/cierres-fechas-cr-495.test.tsx` — «R1» (tarjeta + hoja de resumen de `CierreFacturaResumen`; comprobante en papel de `CierreFacturaDetalle`) |
| R2 | mismo archivo — «R2» (`CierreBodegaFacturaResumen`: Solicitado, Resuelto, Conciliado el) |
| R3 | mismo archivo — «R3» (`CierreFacturaResumenPropio`, nombre accesible y hoja); `tests/components/CierreDiaModule.test.tsx` — «Ficha 495» (botón «Ver del cierre del 2026-10-31» y descripción del diálogo) |
| R4 | `tests/unit/descarga/cierres-fechas-cr-495.test.ts` — «R4/R5» (las siete proyecciones); clave/encabezado/orden: `cierres-*-descarga-columnas.test.ts`, `cierre-dia-descarga-columnas.test.ts`, `cierres-gestiones-fundida-descarga-columnas.test.ts` verdes sin tocar |
| R5 | mismo literal `2026-10-31` en el test de descarga y en los de pantalla (no uno contra otro) |
| R6 | `tests/unit/utils/fecha-dia-iso.test.ts` — tres instantes literales (+ 05:59:59.999Z y 23:59Z) |
| R7 | `tests/components/cierres-fechas-cr-495.test.tsx` — «R7» (2 casos); `tests/unit/descarga/cierres-fechas-cr-495.test.ts` — «R7» |
| R8 | `tests/unit/utils/fecha-dia-iso.test.ts` — «R8»; `tests/unit/descarga/columnas-sensibles.guardia.test.ts` verde sin tocar |
| R9 | `tests/unit/guards/cierres-fecha-cr-495.guardia.test.ts` — contraprueba + barrido |
| R10 | `tests/components/incidentes-fechas-cr-495.test.tsx` — «R10» (columna Fecha de la cola, Fecha resuelta del histórico, Reportado el / Resuelto por del detalle) |
| R11 | `tests/unit/descarga/cierres-fechas-cr-495.test.ts` — «R11/R12»; `incidentes-descarga-columnas.test.ts` verde sin tocar |
| R12 | `tests/components/incidentes-fechas-cr-495.test.tsx` — «R12» (celda «Fecha resuelta» = «—» localizada por su encabezado; detalle sin «· fecha»); descarga `fechaResuelta` = `null` |
| R13 | `tests/unit/guards/cierres-fecha-cr-495.guardia.test.ts` — «revisa archivos de las tres carpetas» (lista literal + >0 archivos por carpeta) |

## Contrapruebas por mutación (muta → rojo → restaura → `cmp` idéntico)

Todas restauradas con `cmp` = idéntico; `git status` limpio tras cada una.

| Mutación | Resultado |
|---|---|
| T1: cuerpo → `fechaDiaISO(texto)` | rojo: R6 05:03Z y R6 00:00:00.000Z |
| T1: añadir la rama de medianoche de `fechaDiaMovimientoCR` | rojo: R6 00:00:00.000Z |
| T1: quitar la guarda de «no legible» | rojo: R8 |
| T2: `fecha()` → `iso.slice(0, 10)` | rojo: los 6 casos de `cierres-fechas-cr-495.test.tsx` |
| T2: solo «Conciliado el» → `marca.conciliadoAt.slice(0, 10)` | rojo: R2 |
| T2: `CierreDiaModule` `:937` y `:1028` revertidas | rojo: los 2 casos «Ficha 495» |
| T2: solo `:1028` revertida | rojo: el de la cabecera |
| T3: cada una de las 7 líneas, por separado, vuelta a `fechaDiaISO` | rojo: su caso en cada una (7/7) |
| T4b: `IncidentesAdminModule` `:488`, `:504`, `:774` por separado → `slice(0, 10)` | rojo: su caso (3/3) |
| T4b: `IncidentesHistoricoTabla:196` → `slice(0, 10)` | rojo: «Fecha resuelta» del histórico |
| T4b: `IncidentesHistoricoTabla:196` «—» → «-» | **sobrevivió** a la primera versión del test (buscaba «—» en toda la fila; el motivo nulo también pinta «—»). Test reforzado para localizar la celda por su encabezado; ahora rojo |
| T4b: detalle sin resolución pinta « · —» | rojo: R12 detalle |
| T4b: `incidentes-descarga-columnas` `:51` y `:85` por separado → `slice(0, 10)` | rojo: R11 (2/2) |
| Guardia: quitar cada una de las 3 formas prohibidas | rojo: contraprueba (3/3) |
| Guardia: quitar `incidentes` de `CARPETAS` | rojo: R13 |
| Guardia: quitar la normalización `\r\n` | **sobrevive — mutación equivalente**: un `\r` final no cambia qué regex casa ni la numeración (se parte por `\n`). Se deja por la recomendación del design, sin efecto observable hoy |

## Gate

`./init.sh --rapido` → `progress/gate_495_1.log` (sin commitear: `progress/*.log` del gate). **INIT_EXIT=1.**

- Modo AMPLIADO (relacionados + guardias + toda `tests/integration/db`).
- Relacionados (`--changed origin/dev`): 3396/3397; el rojo es `integration/db/ajuste-caja-anulacion-461`,
  que el propio gate marcó intermitente (verde aislado). Guardias: 3862/3862.
- Integración: 42 rojos / 4218 verdes / **9 skipped** (no el patrón de «sin `.env`»). Tras el reintento
  aislado del gate quedan 4 archivos ROJOS NUEVOS, rojos también aislados (repetido a mano con dos
  de ellos: 22 rojos):
  `cobertura-repository`, `corregir-datos-cliente.repo`, `geografia-catalogo-activo`,
  `zona-reconciliacion-ordenes` — todos con `Unique constraint failed` en
  `tx.zonaDistrito.create/createMany` al sembrar sus fixtures.
- **Ajenos a esta ficha (razonado, no medido contra `dev` limpio):** el diff fuera de `app/`,
  `tests/` y `specs/` es solo `lib/utils/fecha-dia-iso.ts` (una función NUEVA, sin tocar las dos
  existentes); ninguno de esos cuatro tests importa nada que esta rama cambie, y el fallo es de
  datos (`zona_distrito` único) en la base local compartida. `prisma migrate status`: 233
  migraciones, «up to date» (no hay migración ajena aplicada). Lo más probable: filas residuales en
  `zona_distrito` de otro gate/seed en paralelo (wt-496/wt-499). No se añadió nada a
  `tests/baseline-rojos.json`: es decisión del leader.

Guardias a mano (leen con `fs`, el grafo no las relaciona): `cierres-fecha-cr-495.guardia.test.ts`
y `wallet-fecha-cr-459.guardia.test.ts` verdes (dentro de T5).

`pnpm exec tsc --noEmit`: exit 0.

Intermitente anotado: en una corrida conjunta de 35 archivos de descargas,
`tests/unit/descarga/columnas-sensibles.guardia.test.ts` («cubre TODAS las declaraciones del
árbol») cayó a los 25 s por timeout bajo carga; aislado pasó 5/5.

## Abiertos

- Desvío menor de texto en el spec: R3 y su trazabilidad dicen «Ver detalle del cierre del …»,
  pero el nombre accesible real es «Ver del cierre del …» (`VER_DETALLE_LABEL = "Ver"`). El test
  afirma el texto real; no se cambió ningún texto de UI.
- I5 (descarga de incidentes) se añadió al alcance sin estar en el encargo (motivo arriba).
- T8 (ver la app) inaplicable en esta sesión; queda para quien levante el dev server.
- **Gate en rojo por 4 archivos de `integration/db` de geografía/zonas** (arriba). Para cerrarlo:
  medirlos contra `dev` limpio o tras limpiar `zona_distrito` de la base local, y repetir el
  `--rapido`. T7 queda sin marcar por eso.
