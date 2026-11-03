# 493 — Marca Velox Courier: textos de la app · bitácora de la FASE FRONTEND

> frontend_dev, 2026-11-02. Worktree `R:\job\singularis\projects\wt-493`, rama
> `feat/493-marca-velox-textos`, sobre `daba26b1` (cierre de la fase backend). Alcance: T5–T15.
> Búsqueda: el MCP `codebase-memory` no se usó en esta fase; todo el trabajo fue sobre nodos de texto
> y se midió con el MISMO detector de la guardia (`tests/fixtures/marca-retirada-493.ts`), más
> `grep` para docs y regex literales de tests (que el detector no ve por diseño).

## Commits

| SHA | Task | Qué |
| --- | --- | --- |
| `390663ac` | T5/T6 | caja principal (`app/(app)/wallet/_components/**`, `wallet/page.tsx`) y wallet compartido (`components/shared/wallet/**`); fixture nuevo `tests/fixtures/marca-retirada-nombre-493.ts` |
| `ca834221` | T7 | estados de cuenta (tiendas, mensajeros, satélites, `components/shared/estado-cuenta/**`) y Mi wallet |
| `e17dd421` | T8 | cierres (incl. membrete de `cierre-factura.tsx` → `MARCA.nombre`) |
| `cfa05d7d` | T9 | analítica («Cobró Velox» en tabla, detalle, tooltip y encabezado de descarga; clave `"ordenex"` intacta) |
| `4505d23f` | T10 | configuración (API keys, envíos WhatsApp, tarifas, placeholders «Ej: Velox Courier S.A.») + test nuevo |
| `30938d58` | T11 | `AvisoVersionNueva`, `PushOptIn`, `AsistentePanel`, `LandingPostular`, prosa de `openapi-spec.ts` y `.yaml` + tests nuevos |
| `d5ae14e4` | T12 | `docs/ayuda/**` (176 líneas) y tests del asistente/ayuda |
| `7c74700c` | T13 | restos (tests de la 492 y datos de prueba), guardia sin trinquete |
| `178ddcf7` | T15 | `docs/api/CHANGELOG.md`, guía de integración (noviembre 2026), test R19 |
| `27123ca3` | gate | guardia 458-A R33: excluye `MARCA.` del patrón de composición de nombres |
| (este) | T14 | informe |

## Cómo se hizo (reproducible)

- **Código (T5–T11):** un codemod por AST (`typescript`) recorrió los mismos nodos que la guardia y
  convirtió cada literal con «Ordenex» en plantilla con `${MARCA.nombre}` / `${MARCA.nombreCorto}`
  (`{MARCA.x}` en JSX; atributo JSX → `{`…`}`), añadiendo el import. Regla P1 (decisión 1 del
  backend): nombreCorto si el texto ENTERO es una etiqueta corta (`… de <marca>` con ≤2 palabras
  delante, `<marca>`, `<marca> (capital)`, `Cobró/Total/Neto de/Ingreso de <marca>…`); el resto,
  nombre. Revisado a mano antes de aplicar; ajustes manuales: «Sale dinero de …» → `nombre` (frase de
  4 palabras), «De …» → `nombreCorto`, el «Cobró …» citado en la pista de `ProductosTabla` →
  `nombreCorto`, placeholders P2 literales, membrete de la factura → `MARCA.nombre`.
- **Tests (L1/L3):** el mismo recorrido en tests sustituyó «Ordenex» por `${NOMBRE_ESPERADO}` /
  `${NOMBRE_CORTO_ESPERADO}` decidiendo POR APARICIÓN (prefijo de etiqueta corta delante → corto),
  con el import del fixture. Las negativas de «la marca de antes» (tests de la 492: logo, login,
  footer, correo, PDFs, manifiesto, guía) NO se migran a la marca vigente (se invertirían): usan
  `MARCA_RETIRADA` del fixture nuevo `tests/fixtures/marca-retirada-nombre-493.ts` (en `PROPIOS` del
  detector, que ahora toma `MARCAS_RETIRADAS` de ahí). Los regex literales con la marca (18, en 11
  archivos; el detector no los ve) pasaron a `new RegExp(\`…${NOMBRE_ESPERADO}…\`)`.
- **Ningún literal de contrato se cambió por su fuente:** los tests siguen afirmando texto; la marca
  sale del fixture literal, nunca de `MARCA` (R16 sigue en 0 imports fuera de la lista cerrada).
- **Docs (T12, R9 prosa):** sustitución literal «Velox Courier» (y «Velox» tras prefijo de etiqueta
  corta: «**Gasto de Velox**», «**De Velox**», dueño «**Velox**»), para que la ayuda cite las
  etiquetas exactamente como la pantalla.

## Lo hecho por task

- **T5/T6.** 50 + 20 textos de código. Tests migrados (los 45 rojos que dejó el backend quedan
  verdes). `nombres-wallet-461.guardia.test.ts`: lista de nombres retirados/reservados y sus fuentes
  de antes migradas JUNTAS (L3). `caja-173-alcance`: la negativa «Ganancia de …» vigila ahora la
  forma escrita (fixture) y la forma interpolada (`"Ganancia de ${MARCA.nombreCorto}"`), para no
  quedarse verde en vacío.
- **T7.** 47 textos. `mi-wallet-335`, `desglose-tienda-*`, `EstadoCuenta*`, `mi-wallet-page`…
- **T8.** 15 textos; «Total Velox» (`INGRESO_TOTAL_COL`, encabezado de la descarga fundida de
  cierres, clave `ingresoTotal` intacta) e «Ingreso de Velox», «Neto de Velox».
- **T9.** 6 textos; encabezado de descarga `Cobró Velox (no sumar: …)` con `clave: "ordenex"`.
- **T10.** 5 textos. Test nuevo `tests/unit/components/configuracion-marca-493.test.tsx` (L1:
  renderiza el vacío de API keys, la página de Envíos automáticos y la explicación de «Pagos por
  zona»; afirma frase entera literal + negativa con `MARCA_RETIRADA`; P2 del placeholder SINPE).
- **T11.** 9 textos de código + 4 líneas del `.yaml` (incluidos los dos comentarios: la cabecera y
  la nota de webhooks) + 29 de la guía. Tests nuevos: `tests/components/MarcaPwaLanding493.test.tsx`
  (aviso de versión nueva y sección de postulación) y `tests/unit/api/openapi-marca-493.test.ts`
  (descripciones con la marca en TS y `.yaml`, sin la retirada en ninguno).
- **T12.** 176 líneas en 12 `.md`; tests `contexto-45{7,8}`, `contexto-46{0,1}`,
  `ayuda-wallet-caja-488` migrados.
- **T13.** Restos: tests de la 492 con negativas de marca, datos de prueba con la marca («Maestra
  …», `fromName`, proveedor de correo), títulos con la palabra como nombre de campo (`ordenex` entre
  backticks, `solo_ordenex`), un alias SQL de un test de integración (`AS ordenex` → `AS
  cobro_ordenex`, mapeado al mismo campo). `e2e/`: solo comentarios en inglés, sin literales de
  texto (censo R16 sobre `e2e/` = 0). **Guardia:** se quitó el trinquete (función, su contraprueba
  sintética y `tests/fixtures/marca-pendientes-493.ts`): los bloques R15 código, R10, R9 y R16 textos
  son `it` llanos con `toEqual([])`. **Pendientes del trinquete: 0** (el archivo ya no existe).
  `grep -rni ordenex app components hooks lib` (`.ts/.tsx`): 838 líneas, todas comentarios,
  identificadores o excepciones de R11 (el bloque R15 por AST da 0).
- **T15.** `docs/api/CHANGELOG.md`: entrada NUEVA arriba, «2026-11-02 — ⚠️ RUPTURA», con los cuatro
  cambios y su antes/después: (1) `X-Ordenex-Signature`/`-Timestamp` → `X-Velox-Signature`/`-Timestamp`,
  mismo algoritmo, sin doble cabecera, y que la OpenAPI vuelve a declararlas en la descripción del
  schema `WebhookOrdenEstadoActualizado`; (2) `https://ordenex.co` / `https://app.ordenex.co/…` →
  `https://velox-courier.company` (Base URL y origen de `evidenciasUrl`); (3) encabezados «Cobró
  Ordenex (no sumar: …)» → «Cobró Velox (no sumar: …)» y «Total Ordenex» → «Total Velox», y los
  valores (conceptos, dueño); (4) nombre y correo `battos.sa@gmail.com`. Guía: versión «noviembre
  2026» (portada y meta description), índice, y sección «Cambios respecto de la versión de
  septiembre 2026» (D.1–D.4) SIN escribir la marca retirada (la guía está bajo R9 y el bloque de
  contrato: los nombres viejos exactos solo viven en el CHANGELOG, al que la guía remite). PDF
  regenerado con `generar-pdf.py` (17 bloques JSON válidos, 29 páginas; fuera del repo, no se
  commitea). `manual-metricas-por-mensajero.md` revisado: solo el `evidenciasUrl` (ya en el dominio
  nuevo, T11b). Test nuevo `tests/unit/docs/changelog-api-493.test.ts` (R19).

## Mutaciones L6 (aplicadas juntas, una por superficie, y restauradas con `git checkout`)

| Mutación (a «Ordenex» a mano) | Rojo |
| --- | --- |
| T5 `wallet-labels.ts`: `CAJA_RESUMEN_LABEL.ganancia` | `wallet-labels.test.ts` + guardia R15 |
| T6 `registrar-movimiento-labels.ts`: pista del pago a tienda | `wallet-registrar-movimiento-dialog.test.tsx` + guardia R15 |
| T7 `mi-wallet-labels.ts`: `cobro_manual` | `mi-wallet-labels.test.ts` (4) + guardia R15 |
| T8 `cierre-labels.ts`: `INGRESO_TOTAL_COL` | `cierres-gestiones-fundida-descarga-columnas.test.ts` + guardia R15 |
| T9 encabezado de la descarga de productos | `analitica-productos-descarga-columnas.test.ts` + guardia R15 |
| T10 `ApiKeysModule.tsx`: descripción del vacío | `configuracion-marca-493.test.tsx` + guardia R15 |
| T11 `AvisoVersionNueva.tsx`: título | `MarcaPwaLanding493.test.tsx` + guardia R15 |
| T12 `docs/ayuda/tienda/mi-wallet.md`: una línea | guardia R10 |
| T15 CHANGELOG sin `X-Velox-Signature` | `changelog-api-493.test.ts` |

Resultado medido: 9/9 archivos rojos, 13 tests (log en el scratchpad de la sesión). Restaurado:
`git status` limpio después.

## Mapa R → test (lo de esta fase; R1/R2/R11/R14/R16–R18/R20 están en `impl_493_backend.md`)

| R | Test |
| --- | --- |
| R1 | guardia `marca-fuente-unica-493` («R1: la marca vigente solo vive en su modulo»): 0 hallazgos con los placeholders P2 dentro de la excepción cerrada |
| R3 | `tests/unit/components/wallet-labels.test.ts`, `wallet-conceptos-manuales.test.ts`, `wallet-registrar-movimiento-dialog.test.tsx`, `tests/components/CajaResumenCard.test.tsx`, `CajaResumenCard488.test.tsx`, `ComposicionGananciaCard.test.tsx`, `DetalleFilaComposicion.test.tsx`, `DetalleMovimientoPanel.test.tsx`, `WalletLibroCaja458E.test.tsx`, `tests/integration/wallet-page.test.tsx` |
| R4 | `tests/unit/components/mi-wallet-labels.test.ts`, `desglose-tienda-labels.test.ts`, `desglose-tienda-ledger.test.tsx`, `tests/integration/mi-wallet-page.test.tsx`, `tests/integration/wallet-satelites.test.tsx`, `tests/components/EstadoCuenta.test.tsx`, `EstadoCuentaAcciones.test.tsx`, `MiWalletComprobante458.test.tsx` |
| R5 | `tests/components/CierresAdminModule.test.tsx`, `CierreMensajeroDetalleCascadas.test.tsx`, `CierreBodegaDetalleCascadas.test.tsx`, `tests/unit/guards/cierre-bodega-vocabulario.guardia.test.ts` |
| R6 | `tests/components/ProductosTablaDinero.test.tsx`, `DineroIdentidadesEnPantalla.test.tsx`, `tests/unit/analytics/kpis-financieros.test.ts` |
| R7 | `tests/unit/components/configuracion-marca-493.test.tsx` (nuevo) |
| R8 (cliente) | `tests/components/MarcaPwaLanding493.test.tsx` (nuevo), `tests/components/PushOptIn.test.tsx` |
| R9 | `tests/unit/api/openapi-marca-493.test.ts` (nuevo) + guardia (bloque R9, `it` llano) |
| R10 | guardia (bloque `docs/ayuda`, `it` llano) + `tests/unit/docs/ayuda-wallet-caja-488.test.ts`, `tests/unit/asistente/contexto-457/458/460/461.test.ts` |
| R12 | sin cambios y verdes: `CierresDescargaColumnas`, `OrdenesDescargaColumnas`, `ProductosDescargaColumnas`, `useTonoAlIncrementar`, `tema-encendido` (corrieron en el gate) |
| R13 | `tests/unit/descarga/analitica-productos-descarga-columnas.test.ts` («Cobró Velox …» literal + clave `"ordenex"`), `cierres-gestiones-fundida-descarga-columnas.test.ts` («Total Velox»), `libro-kardex-468.test.ts`, `wallet-caja-descarga-columnas.test.ts` |
| R15 | guardia: bloques R15 código / R10 / R9 como `it` llanos + contrapruebas sintéticas |
| R16 | guardia: «ningun test dice la marca retirada en un texto» (`it` llano) + «solo la lista cerrada importa lib/marca/identidad» |
| R19 | `tests/unit/docs/changelog-api-493.test.ts` (nuevo) |

## Verificación

- `pnpm exec tsc --noEmit` → 0.
- `pnpm exec eslint` sobre los 157 `.ts/.tsx` tocados → 0 errores (2 warnings preexistentes en
  líneas no tocadas).
- `vitest related` de los 34 archivos de código: 308 archivos, 4.365 tests; los rojos eran regex
  literales con la marca (arreglados) y `tests/integration/wallet-page.test.tsx` (ver abajo).
- Los 124 archivos de test tocados, juntos: 2.330 tests, `integration/db` incluida y SIN saltados
  (había `.env`); 2 rojos, ambos en `wallet-page.test.tsx` (timeout de 20 s bajo carga y el `vi.fn`
  contado dos veces que arrastra ese timeout). Aislado, junto con los otros 29 archivos repetidos:
  30/30 archivos, 461 tests verdes. **Intermitente por carga.**
- Guardias de marca a mano (493 y las tres de la 492: `marca-velox-identidad`,
  `marca-velox-sin-anterior`, `marca-velox-sin-literal`) + `caja-*`, `mi-wallet-335`,
  `nombres-wallet-461`, `pwa-push`, `paginas-legales-estaticas`: verdes.
- **Gate `./init.sh --rapido`** UNA vez, sobre `178ddcf7` (log `progress/gate_493_1.log`):
  **`INIT_EXIT=1`**. Modo AMPLIADO (relacionados + guardias + toda `tests/integration/db`).
  typecheck y lint verdes; `DATABASE_URL` resuelta («los 370 archivos de tests contra Postgres SÍ se
  ejecutan»). Relacionados: 780 archivos, 10.570 tests, 2 rojos + 26 skipped (los `it.skip` de
  siempre); `integration/db`: 458 archivos, 4.269 tests, 0 rojos, **0 saltados**. Dos rojos:
  1. `tests/integration/wallet-page.test.tsx` (2 tests, timeout de 20 s bajo carga): el propio gate
     lo repitió AISLADO → 13/13 verde. **Intermitente** (mismo comportamiento que en mis corridas
     previas: rojo bajo carga, verde aislado).
  2. `tests/unit/guards/wallet-etiqueta-cuenta.guardia.test.ts` (guardia 458-A R33), rojo también
     aislado → **real**: su patrón `\$\{[^}]*\.nombre\}\s+\$\{` («el cliente compone un nombre de
     cuenta») casaba con `` `Las tiendas le deben a ${MARCA.nombre} ${monto}.` `` de `wallet-labels.ts`.
     Arreglo en `27123ca3`: el patrón excluye solo `MARCA.` (`(?!MARCA\.)`), con contraprueba nueva
     (la marca + importe no es hallazgo; `${fila.tienda.nombre} ${monto}` sigue siéndolo). Repetida
     AISLADA tras el arreglo: 5/5 verde; `tsc` 0; eslint limpio. No se volvió a correr el gate
     (regla: una vez; el rojo se repite aislado).
  Lección para otras guardias: cualquier heurística de texto sobre `${x.nombre}` puede ver la marca;
  el gate corrió las 280 guardias y solo esta lo hizo.

## T14 — pasada visual (cierra B1 de `review_493.md`)

> 2026-11-02, sobre `a69ee0ff`. Dev server del worktree en `:3493` con `next dev --webpack`
> (Turbopack rechaza el junction de `node_modules`: «Symlink … points out of the filesystem root»).
> Playwright headless, base LOCAL (`localhost:5432`, medido con `prisma migrate status`). Cuentas
> `admin.qa@ordenex.test` (admin) y `tienda.qa@ordenex.test` (adminTienda, OTP leído del log del dev
> server); su clave se ROTÓ con `scripts/seed-usuarios-qa.ts` (rota las cuatro cuentas QA).
> Dos anchos: 1440 px y 390 px. En cada pantalla: `innerText` buscando `/ordenex/i`,
> «Courier Courier»/«Velox Velox», elementos con «Velox» con `scrollWidth > clientWidth`
> (cortados) y desborde horizontal de la página. Capturas en
> `C:\Users\ArqDev\AppData\Local\Temp\claude\R--job-singularis-projects-ordenex\cad10efb-563f-42a2-b6cd-d333f35d10a8\scratchpad\493-visual\`
> (fuera del repo).

| Pantalla | Resultado | Capturas |
| --- | --- | --- |
| `/wallet` (caja principal) | 0 «Ordenex»; 21 líneas con la marca («Caja principal de Velox Courier…», «Ganancia de Velox», «Gastos fijos de Velox»…). 1440: nada cortado. 390: 2 rótulos de la composición truncados con «…» («Velox Courier le cobra a una tie…», «Pagos de Velox Courier a…»): es el `truncate` de diseño de esa lista, que a 390 ya corta otros rótulos sin marca («Flete por devolución a orig…», «Comisión de contra-entre…»); la fila se abre y su `aria-label` dice el rótulo entero. No es defecto de la 493 | `admin_wallet-1440.png`, `admin_wallet-390.png`, `zoom-390-0.png`, `zoom-390-1.png` |
| Registrar movimiento (diálogo, sin enviar) | «Sale dinero de Velox Courier», «Velox Courier le paga a un mensajero», «Una tienda le paga a Velox Courier»: envuelven a dos líneas a 390, nada cortado | `wallet-registrar-390.png`, `wallet-registrar-1440.png` |
| `/wallet/tiendas`, `/wallet/mensajeros`, `/configuracion` | 0 «Ordenex», sin desborde | `admin_wallet_tiendas-*.png`, `admin_wallet_mensajeros-*.png`, `admin_configuracion-*.png` |
| `/mi-wallet` (tienda) | 0 «Ordenex»; «Velox Courier te debe ₡147.670,10», «Cargos de Velox», «Velox Courier te cobró el flete»…; nada cortado ni a 390 (la tabla desplaza en su contenedor, la página no desborda) | `tienda_mi-wallet-1440.png`, `tienda_mi-wallet-390.png` |
| `/cierres-admin` (mensajero): tarjeta, «Ver detalles» y «Ver / decidir» | 0 «Ordenex»; «VELOX COURIER», «Total Velox», «Neto de Velox», «Lo que le queda a Velox Courier», «Todo lo que facturó Velox Courier en el cierre…». 1440 limpio | `cierre-detalles-1440.png`, `cierre-decidir-dialog-1440.png`, `cierre-decidir-dialog-390.png` |
| `/cierres-admin` (bodega, resueltos) y `/cierre-dia` | 0 «Ordenex», sin desborde | `cierre-bodega-1440.png`, `admin_cierre-dia-*.png` |
| `/analitica`, fila de producto abierta (2 filas con dinero) | 0 «Ordenex»; «Cobró Velox» como rótulo del detalle y como columna de la subtabla; sin cortes a 1440; a 390 la subtabla desplaza en horizontal (como el resto) | `analitica-productos-detalle-1440.png`, `analitica-productos-detalle-390.png` |
| Descargas | Cierres «Resumen» (`.xlsx`): encabezados sin marca, 0 «Ordenex». Cierres «Detalle» (gestiones, 52 filas): columna «Total Velox». Analítica «Descargar Productos»: «Cobró Velox (no sumar: importe de la orden…)». 0 «Ordenex» en los tres | `resumen-cierres-del-dia-resueltos-2026-11-02.xlsx`, `detalle-gestiones-de-cierres-2026-11-02.xlsx`, `analitica-1440-productos-2026-11-02.xlsx`, `descarga-columnas-detalle-1440.png` |
| Ayuda: `/ayuda` y 9 documentos (`tienda/mi-wallet`, `oficina/cierres`, `oficina/wallet-caja`, `wallet-tiendas`, `wallet-mensajeros`, `wallet-satelites`, `configuracion-plantillas`, `configuracion-tarifas`, `compartido/analitica`) | 0 «Ordenex», 0 «Courier Courier», sin desborde a 1440 ni a 390 | `ayuda_ayuda_*.png` |

- **«Courier Courier» / «Velox Velox»: 0** en todas las pantallas.
- **Defectos de la 493: ninguno.** No se tocó código.
- **Visto de paso, NO de la 493 (anterior, fuera de alcance):** a 390 px, la subtabla de gestiones
  del diálogo «Detalle del cierre» (`/cierres-admin` → «Ver / decidir») solapa las columnas
  «Cobrado» y «Total Velox» (cabecera y cifras se pisan: «₡6.5₡2.517,08»). Las cifras se pisan solas,
  sin la marca; y la 493 ACORTÓ ese encabezado («Total Ordenex» → «Total Velox»), así que venía de
  antes. Captura `cierre-decidir-dialog-390.png`. Candidato a ficha aparte.
- **Limpieza de la base local:** no se envió ningún formulario ni acción (el modal «Confirmá el SINPE
  de GAM» que aparece al admin se cerró con «Ahora no»). Lo que dejaron los logins se borró: 23 filas
  de `login_attempt` y 23 de `Session` de las dos cuentas QA en la ventana de la pasada. Las 4 filas
  recientes de `historial_accion` son de suites de tests de otra corrida (actores `maestro 454…`,
  `QA Maestro 362`), no de esta pasada.
- Al terminar: dev server parado, `.next` del worktree borrado, `pnpm exec tsc --noEmit` → 0.

## Abiertos

1. ~~Ver la app (T14) no se hizo~~ → hecha, ver «T14 — pasada visual». Queda anotado el solape
   previo del diálogo de cierre a 390 px (no de esta ficha).
2. **Nota operativa (T15, la hace el humano, no el subagente):** (a) pausar a los integradores antes
   de desplegar a `prod` (las cabeceras `X-Ordenex-*` dejan de salir sin periodo de doble cabecera);
   (b) cambiar `NEXT_PUBLIC_APP_URL` y `NEXT_PUBLIC_SITE_URL` en Vercel a
   `https://velox-courier.company` cuando ese dominio sirva la app; (c) escribir la fecha de
   despliegue en la entrada del CHANGELOG (hoy «PENDIENTE»). El aviso para enviar ES la entrada
   `2026-11-02` de `docs/api/CHANGELOG.md`; el PDF de la guía se regenera con
   `python docs/api/guia-integracion/generar-pdf.py "<ruta>.pdf"` (no se commitea).
3. **Comentarios con `ordenex.co`** (abierto 1 del backend) siguen igual: fuera de alcance.
4. `docs/api/ordenex-api-key.postman_collection.json`: nombre de archivo sin renombrar (fuera de
   alcance por requirements); su contenido no tiene contrato viejo (el bloque de contrato lo barre).
5. La entrada del CHANGELOG dice «2026-11-02» como fecha del aviso; si se publica otro día, ajustar
   el encabezado (el test R19 admite cualquier día de noviembre 2026).
