# 493 — Marca Velox Courier: textos de la app · tasks

> Lee `requirements.md` y `design.md`. Reglas de tests L1–L6 en `design.md §5`: se aplican en TODAS
> las tasks de superficie. `[P]` = paralelizable con las otras `[P]` del mismo bloque, siempre que no
> compartan archivo (cada archivo de test pertenece a la task de la superficie que prueba; si uno
> cruza dos superficies, lo migra la primera que lo toque y la otra lo deja).
>
> Cada task de superficie se cierra con: (1) su censo en la guardia a 0 para sus archivos, (2) sus
> tests migrados y verdes, (3) la mutación de L6 anotada en `progress/impl_493.md`, (4) un commit
> `feat(493): <superficie>`.

## Bloque 0 — arranque

- [ ] **T0 — Pre-condiciones.**
  - La 492 está mergeada en `dev` (dependencia de la ficha). Anotar el SHA medido.
  - Confirmar en el archivo real que existe `lib/marca/identidad.ts` con `MARCA.nombre` y
    `MARCA.nombreCorto`, y anotar sus valores. **No se crea otra constante.** Si falta un campo que la
    493 necesita (solo puede pasar según la P1 de esta ficha, `design.md §3`), se para y se pide a la
    492; no se añade aquí.
  - Anotar qué tests de la 492 importan `MARCA` (lista cerrada del bloque R16 de la guardia).
  - P1 (forma corta en etiquetas) y P2 (razón social de ejemplo) respondidas por el humano; P3 y P7
    vienen resueltas por la 492. Sin P1 no se puede cerrar T1; sin P2 queda bloqueada T10.
  - **Hecho:** valores de `MARCA`, lista de tests de la 492, respuestas y SHA en `progress/impl_493.md`.

## Bloque 1 — base (secuencial)

- [ ] **T1 — Fixture y ancla (sin constante nueva).** Depende de T0.
  - `tests/fixtures/marca-esperada.ts` con `NOMBRE_ESPERADO` y `NOMBRE_CORTO_ESPERADO` como literales.
  - `tests/unit/marca/textos-ancla-493.test.ts` (ancla, L2) contra `MARCA` de `lib/marca/identidad.ts`.
  - **Hecho:** el ancla pasa; cambiar a mano `MARCA.nombre` a otro valor la pone roja (anotado y
    restaurado).
  - Traza: R2.

- [ ] **T2 — Guardia en rojo y censo.** Depende de T1.
  - `tests/unit/guards/marca-fuente-unica-493.guardia.test.ts` con los 4 bloques de `design.md §6` y
    sus contrapruebas sintéticas.
  - Correrla aislada y volcar la lista de hallazgos a `progress/censo_marca_493.md`, agrupada por las
    superficies de las tasks T3–T12 (archivo, línea, fragmento). Es el inventario exacto que sustituye
    a la estimación del spec.
  - **Hecho:** las contrapruebas pasan (el detector ve los casos sintéticos y respeta las
    excepciones); los bloques reales están rojos y el censo está escrito. Se commitea con los bloques
    reales marcados `it.fails` o equivalente documentado, para no dejar `dev` rojo; T13 los vuelve
    `it` normales.
  - Traza: R1, R14, R15, R16.

## Bloque 2 — servidor (`lib/`) — primero, porque las pantallas lo consumen

- [ ] **T3 [P] — Rótulos del libro de caja.** Depende de T2.
  - `lib/constants/wallet-rotulos.ts`, `lib/constants/origen-legible-rotulos.ts`,
    `lib/utils/egreso-anulable.ts`.
  - Tests: `tests/unit/services/wallet-origen-legible.test.ts`, `tests/unit/guards/nombres-wallet-461.guardia.test.ts`
    y los que el censo de tests (bloque R16) asigne a estos archivos.
  - **Hecho:** cierre estándar del bloque.
  - Traza: R8.

- [ ] **T4 [P] — Otros textos de servidor.** Depende de T2.
  - `lib/types/historial-accion.ts` (etiquetas), `lib/types/plantilla-datos.ts` (descripciones; los
    ejemplos de razón social esperan P2 y los dominios quedan, P6), `lib/asistente/instrucciones.ts`,
    `lib/utils/aviso-ubicacion-denegada.ts` (con `MARCA.nombreCorto`, que es el `short_name` de la 492), `lib/services/AbonoTiendaService.ts`
    (mensajes de error), `lib/analytics/metrics.ts` (`etiqueta` y `descripcion`; el `id`
    `ganancia_ordenex` no cambia).
  - Tests: `tests/unit/historial-accion/catalogo-y-choke-point.test.ts`, `tests/components/HistorialAccionesAbonoTienda457.test.tsx`,
    `tests/unit/asistente/instrucciones.test.ts`, `tests/unit/utils/aviso-ubicacion-denegada.test.ts`,
    `tests/components/GestionarOrdenUbicacionContexto.test.tsx`, `tests/unit/analytics/metrics-caja-naturaleza.guardia.test.ts`.
  - Toca `lib/types/` → el gate de esta task se amplía con `tests/integration/db`.
  - **Hecho:** cierre estándar del bloque.
  - Traza: R6 (etiqueta de métrica), R7 (variables de plantilla), R8.

## Bloque 3 — pantallas (todas `[P]` entre sí; dependen de T2 y, para los rótulos que importan, de T3)

- [ ] **T5 [P] — Caja principal.** `app/(app)/wallet/_components/**`, `app/(app)/wallet/page.tsx`.
  - Tests: `tests/unit/components/wallet-labels.test.ts`, `wallet-conceptos-manuales.test.ts`,
    `wallet-indemnizacion-libro.test.tsx`, `tests/components/CajaResumenCard*.test.tsx`,
    `CajaComposicionBarra.test.tsx`, `BarraComposicionCaja488.test.tsx`, `ComposicionGananciaCard.test.tsx`,
    `DetalleFilaComposicion.test.tsx`, `WalletLibroCaja458E.test.tsx`, `WalletLedger*.test.tsx`,
    `tests/integration/wallet-page.test.tsx`, y las guardias `caja-textos-459`, `caja-clasificacion-459`,
    `caja-composicion-exhaustiva` (L3: fragmentos retirados + su fuente de antes, juntos).
  - **Hecho:** cierre estándar del bloque.
  - Traza: R3.

- [ ] **T6 [P] — Wallet compartido.** `components/shared/wallet/**`.
  - Tests: `tests/unit/components/wallet-registrar-movimiento-dialog.test.tsx` (90 apariciones),
    `tests/components/DetalleMovimientoPanel.test.tsx`, `DetalleMovimientoCierre.test.tsx`,
    `WalletFiltroAQuien458E.test.tsx`.
  - **Hecho:** cierre estándar del bloque.
  - Traza: R3.

- [ ] **T7 [P] — Estados de cuenta y Mi wallet.** `components/shared/estado-cuenta/**`,
  `app/(app)/wallet/tiendas/**`, `app/(app)/wallet/mensajeros/**`, `app/(app)/wallet/satelites/**`,
  `app/(app)/mi-wallet/**`.
  - Tests: `tests/unit/components/mi-wallet-labels.test.ts`, `desglose-tienda-labels.test.ts`,
    `desglose-tienda-ledger.test.tsx`, `tests/integration/mi-wallet-page.test.tsx`,
    `tests/integration/wallet-tiendas-page.test.tsx`, `tests/integration/wallet-satelites.test.tsx`,
    `tests/components/EstadoCuenta*.test.tsx`, `DesgloseTiendaAbono457.test.tsx`, `MiWalletComprobante458.test.tsx`,
    `ResumenMiWallet.test.tsx`, `PagosTiendaEstadoCuenta.test.tsx`, `PagoMensajeroAcciones.test.tsx`,
    `tests/unit/guards/mi-wallet-335.guardia.test.ts`.
  - **Hecho:** cierre estándar del bloque.
  - Traza: R4.

- [ ] **T8 [P] — Cierres.** `app/(app)/cierres-admin/**` (incluido el membrete de texto de
  `cierre-factura.tsx`), `app/(app)/cierre-dia/**`.
  - Tests: `tests/components/CierresAdminModule.test.tsx`, `CierreMensajeroDetalleCascadas.test.tsx`,
    `CierreBodegaDetalleCascadas.test.tsx`, `CierreCobrosDeLaGestion.test.tsx`, `CierreTarifa*.test.tsx`,
    `CierreBodegaDesglosePorTienda.test.tsx`, `CierreMensajeroDesglosePorTienda.test.tsx`,
    `tests/unit/utils/cascadas-cierre-bodega.test.ts`, `tests/unit/services/cierres-admin-service.test.ts`
    y `cierres-bodega-admin-service.test.ts` (solo si afirman texto; sus «Ordenex» pueden ser
    identificadores), `tests/unit/descarga/cierres-gestiones-*.test.ts`, `cierre-dia-descarga-columnas.test.ts`,
    `tests/components/descarga/Cierres*.test.tsx`.
  - Encabezados de descarga con la marca nueva y la clave intacta (R13).
  - **Hecho:** cierre estándar del bloque.
  - Traza: R5, R13.

- [ ] **T9 [P] — Analítica.** `app/(app)/analitica/_components/**`.
  - Tests: `tests/components/ProductosTablaDinero.test.tsx`, `DineroIdentidadesEnPantalla.test.tsx`,
    `TableroFinanciero.test.tsx`, `tests/unit/analytics/etiquetas-visibles.guardia.test.ts`,
    `kpis-financieros.test.ts`, `dinero-producto-no-sumable.guardia.test.ts`,
    `tests/unit/descarga/analitica-productos-descarga-columnas.test.ts`.
  - **Hecho:** cierre estándar del bloque; el encabezado «Cobró …» del archivo usa `MARCA.nombreCorto` (o `MARCA.nombre`, según P1) y la
    clave sigue siendo `"ordenex"`.
  - Traza: R6, R13.

- [ ] **T10 [P] — Configuración.** `app/(app)/configuracion/**`, `components/shared/sinpe-textos.ts`.
  Depende de P2 para los placeholders de razón social.
  - Test nuevo `tests/unit/components/configuracion-marca-493.test.tsx`: renderiza la descripción de
    API keys, la de envíos de WhatsApp y el texto de tarifas por zona, y afirma la frase literal (L1).
  - **Hecho:** cierre estándar del bloque.
  - Traza: R7.

- [ ] **T11 [P] — PWA, asistente, landing y documentación para integradores.**
  `components/shared/AvisoVersionNueva.tsx`, `PushOptIn.tsx`, `AsistentePanel.tsx`,
  `app/_landing/LandingPostular.tsx` (y prosa restante de `app/_landing/**`), `public/sw.js`
  (`TITULO_RESERVA`), `lib/api/openapi-spec.ts` (solo descripciones: `info.title` es de la 492; las
  cabeceras `X-Ordenex-*` y el ejemplo de dominio NO), `docs/api/api-key-openapi.yaml` (las mismas
  descripciones, a mano), `docs/api/guia-integracion/guia-integracion.html` (cuerpo, ~38 apariciones;
  portada/título/autor/pie son de la 492; «Base URL» y cabeceras se quedan) y su `README.md`;
  regenerar el PDF de la guía según su `README.md`.
  - Tests: `tests/components/PushOptIn.test.tsx`, test de `AvisoVersionNueva` (crear si no existe),
    test de la landing de postulación, `tests/unit/api/openapi-*.test.ts` (bloque nuevo:
    descripciones con la marca; las cabeceras siguen literales, L5), `tests/unit/guards/pwa-push.guardia.test.ts`.
  - **Hecho:** cierre estándar del bloque; bloques de paridad (R14) y de documentación para
    integradores (R9) de la guardia verdes.
  - Traza: R8, R9, R14.

- [ ] **T12 [P] — Ayuda.** `docs/ayuda/**/*.md` (prosa literal «Velox Courier», `design.md §8.4`).
  - Tests: `tests/unit/docs/ayuda-wallet-caja-488.test.ts`, `tests/components/AyudaDocumentoPage.test.tsx`,
    `tests/unit/asistente/contexto-457.test.ts`, `contexto-458.test.ts`, `contexto-460.test.ts`,
    `contexto-461.test.ts`, `tests/integration/asistente-route.test.ts`.
  - **Hecho:** cierre estándar del bloque; bloque `docs/ayuda` de la guardia verde.
  - Traza: R10.

## Bloque 4 — cierre (secuencial)

- [ ] **T13 — Restos y guardia en verde.** Depende de T3–T12.
  - Recoger lo que el censo aún liste fuera de las superficies anteriores, incluido lo que la 492 haya
    dejado con «Ordenex» o con la marca escrita a mano (`design.md §2 g`).
  - Tests restantes que el bloque R16 siga listando (incluidas negativas, L3).
  - `e2e/*.spec.ts`: actualizar los literales por coherencia (no se ejecutan).
  - Quitar el `it.fails` de T2.
  - **Hecho:** la guardia entera pasa sin `it.fails`; `grep -ri ordenex` sobre `app/ components/ hooks/ lib/`
    devuelve solo comentarios, identificadores y excepciones (anotado con el recuento).
  - Traza: R1, R11, R12, R15, R16.

- [ ] **T14 — Verificación y trazabilidad.** Depende de T13.
  - `./init.sh --rapido` (se amplía solo con `tests/integration/db` por `lib/types/`); mirar los
    `skipped`, no solo el código de salida. Correr a mano la guardia de la 493 y las guardias
    estructurales tocadas en T5/T7 (`caja-*`, `mi-wallet-335`, `nombres-wallet-461`).
  - Ver la app con datos locales: caja principal, Mi wallet de una tienda, un cierre de mensajero, la
    tabla de productos de analítica y una descarga. Comprobar frases completas (sin «Courier Courier»
    ni etiquetas partidas). Limpiar lo que se haya creado en la base local.
  - `progress/impl_493.md`: tabla R1–R16 → test concreto (la de `requirements.md`, ajustada a lo
    real) y las mutaciones de L6 de cada task.
  - **Hecho:** gate verde, mapa R→test completo, capturas o notas de lo visto en la app.
  - Traza: todas.
