# 482 — Retirar `DetalleSecciones` sin uso · implementación

> Rama `chore/482-retirar-detalle-secciones`, desde `origin/dev` @ `3a8a4211`. Frontend puro, sin
> backend ni migración, sin cambio visible. Contexto: 478 (PR #858) sustituyó las tablas del detalle
> de bodega por la lista en pestañas `GestionesPorResultado` (`cierre-factura.tsx`) y dejó P4 = «no
> se borra aquí, ficha aparte».
> Búsqueda: MCP `codebase-memory` (`R-job-singularis-projects-ordenex`) para localizar
> `DetalleSecciones` (1 símbolo, en `cierre-detalle-shared.tsx`; el índice no lista importadores de
> `app/`) y confirmación con `git grep` en el árbol real para cada símbolo.

## 1. Prueba de que no tiene uso en producción

`git grep -w DetalleSecciones -- app lib components` en `3a8a4211`: solo su declaración y un
comentario en `cierre-gestiones-descarga-columnas.ts`. Ningún `import` en `app/`, `lib/` ni
`components/`. Su único montaje (`CierresBodegaAdminModule.tsx:824`) lo retiró la 478 (T3). Los demás
importadores eran tests (7 archivos, ver §3).

## 2. Inventario borrado, y por qué cada cosa queda sin uso

### `app/(app)/cierres-admin/_components/cierre-detalle-shared.tsx` (+9 −539)

| Símbolo | Único consumidor en `app/` antes | Por qué queda sin uso |
| --- | --- | --- |
| `DetalleSecciones` | ninguno (478/T3 lo desmontó) | — |
| `DESCARGA_POR_RESULTADO` (mapa resultado → columnas/fila/ámbito de descarga) | `DetalleSecciones` | se va con él (`CierreDiaModule` tiene su mapa homónimo PROPIO) |
| `columnasPara` (export) | `DetalleSecciones` | `CierreDiaModule` declara su propio `columnasPara` local |
| `COLUMNAS_COMUNES` (export) | `columnasPara` | `CierreDiaModule` y `cierre-factura` solo lo nombran en comentarios |
| `COLUMNAS_MEDIO_PAGO`, `COLUMNA_MONTO_COBRAR`, `COLUMNA_FULFILLMENT`, `COLUMNA_EVIDENCIA`, `COLUMNA_INGRESO_TOTAL`, `columnaFlete`, `columnaConcepto` (privados) | `columnasPara` | — |
| `COLUMNA_PAGO_MENSAJERO`, `COLUMNA_INGRESO_BODEGA_RECHAZOS`, `COLUMNA_RECHAZO_ORIGEN`, `COLUMNA_INDEMNIZACION` (exports) | `columnasPara` | fuera de este archivo solo aparecen en comentarios |
| `renderRechazoOrigen` (export) | `COLUMNA_RECHAZO_ORIGEN` | `CierreDiaModule` solo lo cita en un comentario; `cierre-factura` pinta su propio badge |
| imports `DataTable`, `DataTableDescarga`, `filasLocales`, `InfoEstado`, `Button`, `DescargaFila`, `CierreGrupos`, `IngresoOrdenexDTO`, `METODO_LABEL`, `FULFILLMENT_COL`, `desglose-pago`, `cierre-gestiones-descarga-columnas` | lo de arriba | — |

**Se queda** (lo leen pantallas vivas): `COLUMNA_CAUSA_INCIDENTE` (`CierreDiaModule`),
`DesgloseIngresoOrdenex`, `desgloseAriaLabel`, `renderPagoMensajero`, `renderFleteOrigen`,
`ORDEN_RESULTADOS`, `ubicacion`, `VisorEvidencia`, `TotalesIngresoPanel`, paneles y etiquetas.

### `app/(app)/cierres-admin/_components/cierre-gestiones-descarga-columnas.ts` (archivo, −323)

Las cinco descargas POR SECCIÓN del detalle de un cierre (feature 170 T E.5): cinco catálogos, sus
cinco proyecciones y sus cinco ámbitos `cierre-gestiones-*`. Su único importador era
`DESCARGA_POR_RESULTADO`. La descarga GLOBAL (hoja fundida, `cierres-gestiones-fundida-descarga-columnas.ts`)
**no** importa de aquí: declara sus columnas y su proyección propias. La 478 (P3, aprobada) ya había
retirado esas descargas de la pantalla. → se borra (la regla del leader: no se borran si las usa la
descarga global; no las usa).

### `app/(app)/cierres-admin/_components/medios-pago-descarga-columnas.ts` (archivo, −52)

Dos exports: `celdasMediosPago` (solo lo llamaba el módulo anterior → muerto) y `COLUMNAS_MEDIOS_PAGO`
(lo usaban el módulo anterior Y la fundida). Al quitar `celdasMediosPago`, el módulo quedaba con
columnas y sin proyección y `columnas-sensibles.guardia` lo rechaza («sin proyección»). No se afloja la
guardia ni se resucita código muerto: la declaración se **muda tal cual** a la fundida (su único
consumidor, mismo `MEDIOS_PAGO.map` → mismas claves, encabezados y orden) y el archivo se borra.

### Cambio en un archivo vivo, sin efecto

`cierres-gestiones-fundida-descarga-columnas.ts`: gana la declaración `COLUMNAS_MEDIOS_PAGO` (privada)
y el import de `METODO_LABEL`/`MEDIOS_PAGO`. Su suite (`cierres-gestiones-fundida-descarga-columnas.test.ts`,
cabecera literal de 29 columnas) pasa sin tocar un esperado.

## 3. Tests: borrados vs reapuntados, y qué vigilaba cada uno

**Borrados: 2 archivos completos** (su objeto era SOLO lo borrado):

| Test | Qué vigilaba | Por qué no hay a dónde reapuntarlo |
| --- | --- | --- |
| `tests/unit/descarga/cierre-gestiones-descarga-columnas.test.ts` | orden/columnas de las cinco descargas por sección del admin, medios por columna, motivo legible en esas hojas | el módulo ya no existe; lo equivalente vivo ya tiene su test: hoja fundida (`cierres-gestiones-fundida-descarga-columnas.test.ts`: orden, medios mixtos, motivo 408 R6, `origenRechazo`, indemnización) y cierre del día (`cierre-dia-descarga-columnas.test.ts`) |
| `tests/unit/descarga/cierre-gestiones-cabecera.guardia.test.ts` | la PROSA de la cabecera de ese módulo (234/R52) | el archivo cuya cabecera vigilaba ya no existe |

**Casos borrados dentro de archivos que siguen** (vigilaban comportamiento de la superficie retirada):

| Archivo | Caso | Qué vigilaba / por qué se va |
| --- | --- | --- |
| `CierreDetallePagos.test.tsx` | describe «una columna por medio de pago (cierre-detalle-shared)», 5 casos | R23/R24/R25 de la 213 sobre la tabla vieja. Las MISMAS R siguen en el describe del comprobante del mismo archivo, que es la superficie que la sustituyó |
| `CierreDetalleIncidente.test.tsx` | «las columnas del incidente son un conjunto EXPLÍCITO», «la columna del monto NO aparece en los otros cuatro» (por ids de `columnasPara`) | el concepto «columna» no existe en la lista; la propiedad (causa/indemnización solo en incidente) se reapuntó a la fila (abajo) y además la cubre `CierreFacturaFilaIncidente.test.tsx` (478/R19) |
| `CierreDetalleIncidente.test.tsx` | «el grupo vacío NO se pinta» | comportamiento retirado por diseño: las pestañas enseñan las cinco siempre (478/R1) con su vacío (478/R3). Sustituido por «el grupo vacío conserva su pestaña en cero y dice que no hay gestiones» |
| `CierresDescargaColumnas.test.tsx` | 5 superficies del detalle del admin (17 → 12), «el ámbito NO depende del mensajero del título», «dentro del modal del detalle el selector abre…» | ninguna superficie viva repite secciones por mensajero ni monta un selector de columnas dentro de un modal; las 12 restantes conservan los 6 casos del registro |
| `CierresDescarga.test.tsx` | en el caso R8, `indemnizacion` y `origenRechazo` del detalle | esas columnas solo existían en las descargas borradas; hoy las afirma la fundida (líneas 459/475/507 de su test) |
| `cierres-gestiones-fundida-descarga-columnas.test.ts` | — (ninguno borrado) | ver reapuntados |

**Reapuntados a la superficie viva:**

| Archivo | De → a | Qué sigue vigilando |
| --- | --- | --- |
| `tests/components/CierreDetalleIncidente.test.tsx` | `DetalleSecciones`/`columnasPara` → `GestionesPorResultado` (fila desplegada) | 158/R18 (pestaña propia con conteo, motivo, evidencia firmada), R17 (un incidente no pinta ingreso de bodega ni marca de origen aunque el DTO los traiga; contraprueba con un rechazo), T2.3 (causa e indemnización SÍ se pintan), R34/R9 (causa traducida, nunca el slug), R19/R22 (once dígitos exactos, «—» con nota), causa/monto fuera de incidente no se pintan |
| `tests/components/CierreMotivoRechazoAutomatico.test.tsx` | `DetalleSecciones` → `GestionesPorResultado` (admin) | 408/R9 (motivo «Dirección errada» sin repetir el marcador ni la jerga), R8 (badge «Automático» con nota completa / «Manual»), R2 (motivo libre intacto). El motivo ausente cambia de forma: ya no «—», sino renglón no pintado (dicho en el test) |
| `tests/components/CierreTarifaEspecial.test.tsx` | `columnasPara(...).render` → renglón «Flete + IVA» de la fila desplegada | marca de origen del flete (normal sin marca / especial / especial sin pacto), acotada al renglón porque el desglose repite la marca |
| `tests/components/descarga/CierresDescarga.test.tsx` | `renderDetalle` → `renderCierreDia` (R1/R11 en `TABLAS`, R22, R8-causa); R37 → primitiva `DataTable` con fila desplegable + descarga | R22 (ninguna URL firmada al archivo, «Tiene evidencia: Sí»), R8 (causa legible), R37 (descargar no pliega la fila: combinación viva en `ProductosTabla`/`WalletLedger`) |
| `tests/components/paginacion/paginacion-transversal.test.tsx` | Anexo IV «Gestiones de un cierre por resultado (detalle del admin)»: ruta `cierre-detalle-shared.tsx` → `cierre-factura.tsx`; render `DetalleSecciones` → `GestionesPorResultado` | R53: el grupo se entrega entero (30 filas), la pestaña cuenta el grupo, sin paginación, el vacío cuenta 0. El censo gana `sinDescarga` (478/P3) y en ese caso exige lo CONTRARIO: que el archivo no monte descarga |
| `tests/unit/descarga/cierres-gestiones-fundida-descarga-columnas.test.ts` | R3 «la marca de evidencia sigue viva»: de `cierre-gestiones-descarga-columnas` → `cierre-dia-descarga-columnas` | `TIENE_EVIDENCIA_*` siguen exportadas y en uso en las descargas por sección que quedan |
| `tests/unit/guards/incidente-exhaustividad.test.ts` | el «detalle del admin» `cierre-detalle-shared.tsx` → `cierre-factura.tsx` | los detalles leen `RESULTADO_LABEL`/`RESULTADO_VACIO` de `cierre-labels` (sobre el shared habría quedado VERDE VACÍO por el re-export) |

**Censos y guardias ajustados** (bajan porque el código desapareció, no por aflojar):

| Archivo | Cambio | Comprobación |
| --- | --- | --- |
| `tests/unit/descarga/censo-tablas.ts` | sale la entrada de `cierre-detalle-shared.tsx` | `cobertura-tablas.guardia` falló PRIMERO («expected 35 to be 36», «36 to be 37», «length 23 got 22») |
| `tests/unit/descarga/cobertura-tablas.guardia.test.ts` | 36→35 archivos/instancias, 37→36 censo, 23→22 con descarga; exclusiones 14 intactas | ídem |
| `tests/unit/descarga/contadores-cabecera.guardia.test.ts` | sale `cierre-detalle-shared.tsx :: ({filas.length})`; 2→1 en el árbol | falló PRIMERO («ya no esta en el codigo»); mutación M5 |
| `tests/unit/guards/pagos-captura.guardia.test.ts` | R23: sale el shared (ya no pinta pagos), quedan 2 sitios (con `toHaveLength(2)` nuevo); R31: salen los dos módulos borrados | mutación M8 |
| `tests/unit/guards/estado-con-info.guardia.test.ts` | solo el `motivo` de la entrada del shared (hoy re-exporta `RESULTADO_LABEL`) | la guardia sigue exigiendo la entrada |
| `tests/unit/descarga/cierre-dia-descarga-columnas.test.ts` | solo comentario (la «gemela» del admin ya no existe) | — |

## 4. Mutaciones (todas ROJAS, todas revertidas; `git status` limpio de app tras cada una)

| # | Mutación | Test que se puso rojo |
| --- | --- | --- |
| M1 | `cierre-factura.tsx`: la causa sin `g.resultado === "incidente" &&` | `CierreDetalleIncidente` (1 rojo) |
| M2 | `cierre-factura.tsx`: `motivoGestionLegible(g.motivo, false)` en el admin | `CierreMotivoRechazoAutomatico` (3 rojos) |
| M3 | `cierre-factura.tsx`: «Flete + IVA» sin `conMarcaDeOrigen` | `CierreTarifaEspecial` (2 rojos) |
| M4 | `cierre-factura.tsx`: añade un `filasLocales(` | `paginacion-transversal` (1 rojo, rama `sinDescarga`) |
| M5 | `cierre-detalle-shared.tsx`: añade un `({filas.length})` | `contadores-cabecera.guardia` (1 rojo, «sin registrar») |
| M7 | `cierre-factura.tsx`: sin `RESULTADO_VACIO` | `incidente-exhaustividad` (1 rojo) |
| M8 | `cierre-factura.tsx`: lee `g.metodoPago` | `pagos-captura.guardia` (2 rojos) |
| M9 | `cierre-dia-descarga-columnas.ts`: `tieneEvidencia: gestion.evidenciaUrl` | `CierresDescarga` R22 (1 rojo) |
| M10 | `cierre-dia-descarga-columnas.ts`: `TIENE_EVIDENCIA_COL = "Evidencia"` | fundida R3 (1 rojo) |

## 5. Gate

`./init.sh --rapido` → `progress/gate_482.log` (resultado en la última línea, `INIT_EXIT=`).

## 6. Observaciones (fuera de alcance, no tocadas)

- `MontoDerivadoCard` e `IngresoBodegaRechazosDesglose` (en el shared) no tienen consumidor en `app/`
  ni ANTES de esta ficha: no servían a `DetalleSecciones`, así que no entran aquí.
- `factura-contraste.guardia.test.ts` (P20) dice en prosa que `DesgloseIngresoOrdenex` es «compartido
  con las tablas del detalle»; hoy solo lo monta `cierre-factura`. Prosa, no aserción.
