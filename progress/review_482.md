# 482 — Retirar `DetalleSecciones` sin uso · review

> Reviewer, 2026-10-15. Rama `chore/482-retirar-detalle-secciones` (PR #860), worktree `wt-482`,
> HEAD revisado `ea5aff74`. Base `origin/dev` @ `3a8a4211`. Ficha `sdd: false` (chore, zona
> frontend): no hay requirements/design/tasks propios; se revisa contra la ficha, `impl_482.md` y
> la red de las features que nombran lo borrado.
> Búsqueda: `git grep` sobre el árbol real del worktree para cada símbolo borrado (lo pidió el
> leader expresamente); el grafo no se usó porque la pregunta era «¿existe todavía en el árbol?»,
> que es justo donde el índice miente por exceso.

## Veredicto: **OK**

Sin bloqueantes. Cinco menores, ninguno impide el merge.

## Checklist

### 1. Nada borrado tiene consumidor vivo; nada visible cambia
- [x] `git grep -w` en `app/ lib/ components/ scripts/` de cada símbolo borrado:
  `DetalleSecciones`, `columnasPara` (del shared), `COLUMNAS_COMUNES` (del shared),
  `COLUMNA_PAGO_MENSAJERO`, `COLUMNA_INGRESO_BODEGA_RECHAZOS`, `COLUMNA_RECHAZO_ORIGEN`,
  `COLUMNA_INDEMNIZACION`, `renderRechazoOrigen`, `celdasMediosPago`, `AMBITO_DESCARGA_GESTIONES_*`,
  `COLUMNAS_DESCARGA_GESTIONES_{ENTREGADAS..INCIDENTES}`, `filaDescargaGestion*` (los cinco) y los
  literales de ámbito `cierre-gestiones-{entregadas..incidentes}`. Solo quedan comentarios u
  homónimos LOCALES de `CierreDiaModule.tsx` (`DESCARGA_POR_RESULTADO`, `columnasPara`,
  `COLUMNAS_COMUNES`), que son declaraciones propias, no importaciones.
- [x] `TIENE_EVIDENCIA_*` y `FECHA_GESTION_COL` siguen exportados en
  `cierre-dia-descarga-columnas.ts` (y `FECHA_GESTION_COL` en la fundida); no dependían del módulo
  borrado.
- [x] Lo que se queda en `cierre-detalle-shared.tsx` tiene consumidor: `COLUMNA_CAUSA_INCIDENTE`
  lo importa `CierreDiaModule.tsx:48`.
- [x] Sin cambio visible: `DetalleSecciones` no tenía montaje en `origin/dev` (la 478/T3 lo
  desmontó). El único archivo vivo tocado con efecto es la fundida, y su salida no cambia (§4).

### 2. Ningún test retirado deja algo vivo sin red
- [x] `CierreDetallePagos.test.tsx`: el bloque retirado tenía **6** casos (no 5) sobre la tabla
  borrada. R20/R21/R22-R23 (contraprueba del escalar)/R24 (orden del DTO)/R25 (`METODO_LABEL`,
  con mutación del mapa en caliente) siguen afirmados sobre el comprobante (`cierre-factura`), que
  es la superficie que la sustituyó.
- [x] `CierresDescargaColumnas.test.tsx` 17 -> 12: los dos casos retirados (ámbito independiente del
  mensajero; selector dentro de un `Modal`) no tienen superficie viva. Comprobado: el único sitio
  con `DescargarDatasetButton` dentro de un `Modal` es `DescargarGestionesDialog.tsx:475`, que va
  SIN `ambitoColumnas` (sin selector); en `CierreDiaModule` y `ConsolidacionBodegaModule` la
  descarga está fuera de los modales; `DetalleMovimientoCierre` va en fila desplegada de
  `WalletLedger`, no en modal.
- [x] `cierre-gestiones-descarga-columnas.test.ts` (borrado): el orden de las cinco hojas por
  sección tenía por objeto el módulo borrado. Medios por columna, money-safe y nulos quedan en la
  fundida (`cierres-gestiones-fundida-descarga-columnas.test.ts`: cabecera literal de 31 con
  Efectivo/SINPE/Transferencia; «los montos salen como el string del snapshot» con mixto y
  `pago_transferencia` null; reprogramada con medios null). Motivo 408 R2/R3/R4/R6 queda en la
  fundida (describe «FICHA 408 — el motivo del cron en la hoja fundida» y «un dato nulo deja la
  celda vacía» con `motivo: null`). Ver m2 para dos matices sin caso propio.
- [x] `cierre-gestiones-cabecera.guardia.test.ts` (borrado): vigilaba prosa del archivo borrado.
- [x] Censos con números cambiados (`censo-tablas.ts`; `cobertura-tablas` 36->35, 37->36, 23->22;
  `contadores-cabecera` 2->1; `pagos-captura` R23 3->2 con `toHaveLength(2)` nuevo y R31 sin los
  dos módulos borrados): cada baja corresponde a una entrada cuyo archivo o código desapareció. La
  fundida SIGUE en R31 con ancla `montoPorMetodo(`. Exclusiones intactas.
- [x] `@test-desaparecido` en `specs/234-.../tasks.md` (R3, R52): R3 de la 234 («conservar las
  CINCO descargas por sección del detalle») queda **superada por decisión** (478/P3, aprobada por
  el humano), no sin red por olvido; su otra mitad (constantes de la marca de evidencia) sigue en
  la fundida › «las constantes de la marca de evidencia siguen exportadas y sin cambios (R3)»,
  reapuntada a `COLUMNAS_DESCARGA_DIA_RECHAZADAS`. R52 se queda sin objeto (vigilaba la cabecera de
  un archivo que ya no existe). Aceptable; ver m3.

### 3. Mutaciones propias (todas revertidas con `git checkout -- <archivo>`; `git status` limpio)
Autocomprobación: `git diff --stat` no vacío tras cada mutación y línea `Tests` del run.

| # | Mutación | Test que la caza | Resultado |
| --- | --- | --- | --- |
| Ma | fundida: `COLUMNAS_MEDIOS_PAGO` con `[...MEDIOS_PAGO].reverse()` | fundida (31 columnas, R9, R10, 385) | ROJO 4 |
| Mb | fundida: `encabezado: metodo` (value del enum) | fundida (31 columnas, R45) | ROJO 2 |
| Mc | fundida: `parseFloat(` inyectado | `pagos-captura.guardia` R31 sobre la fundida | ROJO 2 |
| Md | `cierre-factura`: `indemnizacionDeFila` sin el corte por resultado distinto de incidente | `CierreDetalleIncidente` «ni el monto ni la causa aparecen en los otros cuatro» | ROJO 1 |
| Me | `cierre-factura`: `count` con fallback 1 en vez de 0 | — | VERDE: mutante equivalente (los grupos vacíos llegan como `[]`, no `undefined`) |
| Me2 | `cierre-factura`: `count` acotado a 25 con `Math.min` | `paginacion-transversal` R53 (grupo de 30) | ROJO 1 |
| Me3 | `cierre-factura`: `count` = longitud, o 1 si es cero (OR lógico) | `CierreDetalleIncidente` «vacío en cero» + `paginacion-transversal` R53 | ROJO 2 |

Más las 9 del implementador (M1-M5, M7-M10), que no repetí.

### 4. Mudanza de `COLUMNAS_MEDIOS_PAGO` a la fundida
- [x] Declaración idéntica (`MEDIOS_PAGO.map` → `clave: CLAVE_MEDIO_PAGO[metodo]`,
  `encabezado: METODO_LABEL[metodo]`), ahora privada. Sigue en un `*-descarga-columnas.ts`, así que
  `columnas-sensibles.guardia` la sigue descubriendo. La suite de la fundida (cabecera LITERAL)
  pasa sin tocar un esperado, y Ma/Mb prueban que esa cabecera literal muerde orden y encabezado.
  Sin cambio de salida del Excel.

### 5. CI y gate
- [x] `gh pr checks 860`: Vercel `pass` (deployment completed), Vercel Preview Comments `pass`.
  PR `OPEN`, `MERGEABLE`, head `ea5aff74`.
- [x] Tests afectados por separado: 56 archivos / 584 tests verdes antes de mutar.
- [x] `./init.sh --rapido` en el worktree, con `DATABASE_URL` exportada desde el `.env` raíz (host
  `localhost`). La 1.ª corrida, sin ella, falló por diseño («el modo ampliado … no hay
  DATABASE_URL»). La 2.ª: **`INIT_EXIT=0`**. Typecheck y lint OK (0 errores). Relacionados 63/63
  archivos (1024 tests), guardias 273/273 (3755), `integration/db` 444/446 con dos rojos de carga
  (`ajuste-caja-anulacion-461`, `estado-cuenta-concurrencia-458`) que el propio gate repitió
  aislados y pasaron (2/2, 6 tests) → intermitentes, ajenos al diff (frontend puro). Log en el
  scratchpad del reviewer, no commiteado.

### CHECKPOINTS.md
- [n/a] Especificación (requirements/design/tasks): ficha `sdd: false`.
- [x] Trazabilidad: no hay R propias; las R ajenas que nombraban lo borrado están reapuntadas o
  anotadas `@test-desaparecido` (guardia `test-citado-desaparecido` verde).
- [x] typecheck, lint, tests: verdes en el gate.
- [n/a] Datos y seguridad: sin tablas, migraciones, webhooks ni secretos.
- [x] Capas: solo presentación en `app/` y tests; nada de repositorio ni servicio tocado.
- [n/a] Permisos: sin páginas ni acciones nuevas.
- [x] Multi-país: el encabezado del medio sigue saliendo de `METODO_LABEL`; sin moneda incrustada
  (Mc lo confirma por la guardia).
- [ ] `progress/history.md`: sin entrada aún (la pone el cierre de la ficha, no la rama).

## Hallazgos

- **m1 (menor) — comentarios rancios en archivos vivos que citan el módulo borrado como si
  existiera.** El más engañoso: `lib/interfaces/services/ICierresAdminService.ts:196-198` dice que
  `TIENE_EVIDENCIA_*` y el helper `tieneEvidencia` de `cierre-gestiones-descarga-columnas.ts`
  «siguen sirviendo a las CINCO descargas por sección del detalle de un cierre»: hoy es falso.
  También `cierres-gestiones-fundida-descarga-columnas.ts:18-19` («ver la cabecera de
  `cierre-gestiones-descarga-columnas.ts`, que sigue explicando…»), `cierre-labels.ts:542-545`
  (el censo de «DIECIOCHO puntos de llamada» de `motivoGestionLegible` cuenta 4 en el shared y 4 en
  el módulo borrado; quedan 10) y `cierre-dia-descarga-columnas.ts:6,48` (comparan con las
  declaraciones `cierre-gestiones-…` del detalle del admin). Prosa, no aserción; ningún test los lee.
- **m2 (menor) — dos matices de la descarga por medio de pago se quedaron sin caso propio.** El
  test borrado afirmaba sobre `celdasMediosPago` (a) que el ORDEN del DTO no cambia la columna en
  que cae cada monto y (b) que una ENTREGADA sin líneas de pago deja las tres columnas `null`. La
  fundida usa el mismo `montoPorMetodo` y su test cubre mixto, null por medio sin pago y null en
  reprogramada, pero no esos dos casos exactos, y `montoPorMetodo` no tiene test unitario directo.
  Riesgo bajo (la función indexa por método, no por posición); un caso corto en la fundida lo
  cerraría.
- **m3 (menor) — `specs/234-.../requirements.md` R3 sigue diciendo «DEBE conservar las CINCO
  descargas por sección».** La anotación `@test-desaparecido` en `tasks.md` explica la supersesión
  por la 478/P3, pero el requisito en sí no lleva marca de superado; quien lea solo requirements
  creerá que se incumple.
- **m4 (menor) — `impl_482.md` dice «5 casos» en `CierreDetallePagos`; eran 6** (incluía «ya no
  existe la columna «Método»»). Sin efecto: todos eran sobre la tabla borrada.
- **m5 (menor) — la rama commitea ~6.000 líneas de logs (`progress/gate_482.log`,
  `progress/gate_482_a.log`).** Es práctica de otras fichas, pero infla el diff de un borrado (el
  `+6658` de la estadística es casi todo log).

Observaciones del implementador que confirmo y que quedan fuera de alcance: `MontoDerivadoCard` e
`IngresoBodegaRechazosDesglose` no tienen consumidor en `app/` (ya antes de esta ficha);
`factura-contraste.guardia.test.ts` conserva prosa que llama «compartido con las tablas del
detalle» a `DesgloseIngresoOrdenex`.
