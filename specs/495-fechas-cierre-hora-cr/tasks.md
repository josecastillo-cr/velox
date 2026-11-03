# 495 — Fechas de cierre en hora de Costa Rica · tasks

> Rama `fix/495-fechas-cierre-hora-cr` desde `dev`. Zona `frontend`; una sola pasada (no hay parte
> backend). Gate: `./init.sh --rapido`. Informe en `progress/impl_495.md` con el mapa R → test.
> No se toca `tests/fixtures/sin-comentarios.ts`, ni el gate, ni la config de build/tests.

## Orden y dependencias

```
T1 ─┬─> T2 ─┐
    ├─> T3 ─┼─> T5 ─> T6 ─> T7 ─> T8
    └─> T4 ─┘
```

T2, T3 y T4 son paralelizables entre sí `[P]` (archivos disjuntos) una vez hecho T1.

## Checklist

- [ ] **T0 — Arranque.** `git checkout -b fix/495-fechas-cierre-hora-cr origin/dev`; confirmar
  `git merge-base HEAD origin/dev` == SHA de `origin/dev`. Re-medir los sitios S1–S7 de
  `requirements.md` (`grep -nE "slice\(\s*0\s*,\s*10\s*\)|fechaDiaISO\(" app/(app)/cierres-admin app/(app)/cierre-dia`).
  **Hecho:** rama creada; la lista medida coincide con S1–S7 (si difiere, anotarlo en
  `progress/impl_495.md` antes de seguir).

- [ ] **T1 — Utilidad `fechaDiaInstanteCR` + su test (R6, R8).** En `lib/utils/fecha-dia-iso.ts`,
  la función de `design.md §3.1`, delegando en `fechaCalendarioCR` y con JSDoc que distinga las tres
  funciones del módulo. Test nuevo `tests/unit/utils/fecha-dia-iso.test.ts` con literales:
  `2026-11-01T05:03:00Z` → `2026-10-31`; `2026-11-01T00:00:00.000Z` → `2026-10-31`;
  `2026-11-01T06:00:00Z` → `2026-11-01`; `""` → `""`; `"pendiente"` → `"pendiente"`.
  **Hecho:** test verde; contraprueba anotada en el informe: con el cuerpo cambiado a
  `fechaDiaISO(valor)` el test de `05:03Z` y el de `00:00:00.000Z` fallan, y con la rama de
  medianoche de `fechaDiaMovimientoCR` falla el de `00:00:00.000Z`.

- [ ] **T2 [P] — Pantallas (R1, R2, R3, R7).** Depende de T1.
  - `cierre-factura.tsx:306-308`: `fecha(iso)` → `iso ? fechaDiaInstanteCR(iso) : "—"`; actualizar
    comentarios `:47-49` y `:305`.
  - `CierreDiaModule.tsx:935,1026`: `.slice(0, 10)` → `fechaDiaInstanteCR(...)`.
  - Test nuevo `tests/components/cierres-fechas-cr-495.test.tsx` con bloques R1 (`CierreFacturaResumen`
    + `CierreFacturaDetalle`), R2 (`CierreBodegaFacturaResumen` con `conciliadoAt`), R3
    (`CierreFacturaResumenPropio`) y R7 (`resueltoAt`/`conciliadoAt` `null`: sin `NaN`, sin
    `Invalid Date`, sin pieza «Resuelto»). Fixtures `2026-11-01T05:03:00Z`; esperado literal
    `2026-10-31` y aserción negativa de `2026-11-01`. Reusar los fixtures de
    `tests/components/CierreFacturaPapel.test.tsx` como plantilla.
  - Bloque nuevo «495» en `tests/components/CierreDiaModule.test.tsx`: nombre accesible
    «Ver detalle del cierre del 2026-10-31» y cabecera del detalle con `2026-10-31`.
  **Hecho:** tests verdes; contraprueba anotada: revirtiendo `fecha()` a `iso.slice(0, 10)` fallan
  R1/R2/R3 del archivo nuevo, y revirtiendo `:935` falla el bloque de `CierreDiaModule`.

- [ ] **T3 [P] — Descargas (R4, R5, R7).** Depende de T1.
  - `fechaDiaISO(…At)` → `fechaDiaInstanteCR(…At)` en `cierres-admin-descarga-columnas.ts:71,104`,
    `cierres-bodega-descarga-columnas.ts:144,177,239`, `cierre-dia-descarga-columnas.ts:256` y
    `cierres-gestiones-fundida-descarga-columnas.ts:422`; quitar el import de `fechaDiaISO` donde
    quede sin uso y reescribir el comentario de `cierres-gestiones-fundida-descarga-columnas.ts:423-427`.
  - Test nuevo `tests/unit/descarga/cierres-fechas-cr-495.test.ts`: las siete proyecciones
    (`filaDescargaCierrePendiente`, `filaDescargaCierreHistorico`, `filaDescargaBodegaPendiente`,
    `filaDescargaBodegaResuelto`, `filaDescargaBodegaSolicitado`, `filaDescargaDiaCierrePasado`,
    `filaDescargaGestionFundida`) emiten `2026-10-31` para `2026-11-01T05:03:00Z`; `fechaResuelta`
    con `resueltoAt: null` es `null`; bloque R5 con el mismo literal que el test de pantalla.
  **Hecho:** test nuevo verde; los `tests/unit/descarga/cierres-*-descarga-columnas.test.ts`,
  `cierre-dia-descarga-columnas.test.ts`, `cierres-gestiones-fundida-descarga-columnas.test.ts`,
  `tests/components/descarga/Cierres*.test.tsx` y `tests/unit/descarga/columnas-sensibles.guardia.test.ts`
  siguen verdes SIN tocarlos; contraprueba anotada (volver una línea a `fechaDiaISO` hace fallar su caso).

- [ ] **T4 [P] — Guardia (R9).** Independiente de T2/T3 en archivos, pero solo puede quedar verde
  después de ellos. `tests/unit/guards/cierres-fecha-cr-495.guardia.test.ts` según
  `design.md §3.4`: carpetas `app/(app)/cierres-admin` y `app/(app)/cierre-dia`, tres formas
  prohibidas, sin excepciones, `revisados > 30`, normalización de `\r\n`, y contraprueba sintética
  (`iso.slice(0, 10)`, `c.solicitadoAt.slice(0, 10)`, `x.substring(0, 10)`, `iso.split("T")[0]`,
  `fechaDiaISO(cierre.solicitadoAt)` saltan; `fechaDiaInstanteCR(c.solicitadoAt)` y un comentario no).
  **Hecho:** antes de T2/T3 la guardia FALLA listando exactamente S1–S7 (pegar la salida en el
  informe); después, verde con la lista vacía.

- [ ] **T5 — Fixtures existentes con instantes 00:00–05:59 UTC.** Depende de T2 y T3. Ejecutar
  aislados `tests/unit/actions/cierres-admin-descarga-action.test.ts`,
  `cierre-dia-descarga-action.test.ts`, `cierre-bodega-descarga-action.test.ts`,
  `cierre-bodega-admin-descarga-action.test.ts`, `tests/components/CierresAdminModule.test.tsx`,
  `CierreFacturaPapel.test.tsx`, `CierreBodegaMarcaConciliacion.test.tsx`, `CierreDiaModule.test.tsx`.
  **Hecho:** todos verdes; si alguno afirmaba el día UTC, se corrigió el ESPERADO al día de Costa
  Rica (nunca el fixture) y se anota en el informe con el motivo.

- [ ] **T6 — Comentarios y documentación local.** Revisar que ningún comentario de los archivos
  tocados siga recomendando `slice`/`fechaDiaISO` para fechas de cierre. **Hecho:** grep limpio en
  los siete archivos (los comentarios que EXPLICAN por qué no se recorta pueden quedarse).

- [ ] **T7 — Gate.** `./init.sh --rapido` con `INIT_EXIT=$?` escrito dentro del log, y además a mano
  `tests/unit/guards/cierres-fecha-cr-495.guardia.test.ts` y
  `tests/unit/guards/wallet-fecha-cr-459.guardia.test.ts` (guardias que leen con `fs`; el grafo no las
  relaciona). **Hecho:** `INIT_EXIT=0`, sin `skipped` inesperados, y las dos guardias verdes.

- [ ] **T8 — Ver la app e informe.** Si hay dev server disponible (no levantar un segundo), abrir un
  cierre local con `solicitadoAt` posterior a las 18:00 CR en `/cierres-admin` y en `/cierre-dia`
  y comprobar la fecha de la tarjeta y del comprobante; si no, declararlo inaplicable con el motivo.
  Escribir `progress/impl_495.md` con el mapa R1–R9 → test de `requirements.md` y las contrapruebas
  de T1–T4. **COMMITEAR** el informe y el código en la rama.
  **Hecho:** informe commiteado; `git status -sb` limpio en la rama.
