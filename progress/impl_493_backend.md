# 493 — Marca Velox Courier: textos de la app · bitácora de la FASE BACKEND

> backend_dev, 2026-11-02. Worktree `R:\job\singularis\projects\wt-493`, rama
> `feat/493-marca-velox-textos`, nacida de `origin/dev` `bad98c17`. Alcance: T0, T1, T2, T3, T4 y
> T11b. Lo que sigue (T5–T13, T14, T15) es del frontend_dev en este mismo worktree.
> Búsqueda de código: MCP `codebase-memory` (proyecto `R-job-singularis-projects-ordenex`) para
> símbolos y llamadores (`search_graph`, `trace_path`), confirmado siempre en el archivo real; `grep`
> para texto plano, docs y tests.

## Commits

| SHA | Task | Qué |
| --- | --- | --- |
| `c60d8267` | T1 | fixture `tests/fixtures/marca-esperada.ts` + ancla `tests/unit/marca/textos-ancla-493.test.ts` (R2) |
| `57dd3360` | T2 | guardia `marca-fuente-unica-493` + detector `tests/fixtures/marca-retirada-493.ts` + censo de base |
| `2dae8f97` | T3 | rótulos del libro de caja con `MARCA`; tests migrados; trinquete en la guardia |
| `726f04f4` | T4 | historial, asistente, errores de abono, métricas, aviso de ubicación, plantillas, aviso interno |
| `353e9da7` | T11b | cabeceras `X-Velox-*`, dominio `https://velox-courier.company`, excepción cerrada en la guardia 492 |
| `9e8ed8a0` | cierre | títulos de tests, negativas L5b, test R7, trinquete y censo finales |
| (este) | informe | `progress/impl_493_backend.md` |

## T0 — precondiciones (medidas)

- La 492 está en `dev`: merge `5e78133f` (PR #876); la rama nace de `origin/dev` `bad98c17`.
- `lib/marca/identidad.ts` existe: `MARCA.nombre = "Velox Courier"`, `MARCA.nombreCorto = "Velox"`.
  No se creó ninguna constante.
- Tests que importan `lib/marca/identidad` (medido por AST, no por texto): `tests/unit/marca/identidad.test.ts`,
  `tests/unit/guards/marca-velox-identidad.guardia.test.ts`, `tests/unit/guards/marca-velox-sin-anterior.guardia.test.ts`.
  (`marca-velox-sin-literal.guardia.test.ts` solo lo nombra dentro de una regex: no lo importa.) Con el
  ancla y la guardia de la 493, son la lista cerrada `PUEDEN_IMPORTAR_LA_MARCA`.
- `lib/config/push.ts`: la 492 ya dejó `DEFAULT_SUBJECT = "mailto:battos.sa@gmail.com"` y
  `tests/unit/config/push-config.test.ts` lo afirma literal. R20 en T11b = solo verificar.

## Lo hecho por task

- **T1.** Fixture con `NOMBRE_ESPERADO = "Velox Courier"` y `NOMBRE_CORTO_ESPERADO = "Velox"`
  (literales); ancla que afirma `MARCA.nombre === "Velox Courier"` literal y la igualdad con el fixture.
- **T2.** Guardia por AST de `typescript` con los 5 bloques de `design.md §6` y contrapruebas
  sintéticas. El detector, las listas cerradas y los recorridos viven en
  `tests/fixtures/marca-retirada-493.ts`; el censo (`progress/censo_marca_493.md`) se emite con ese
  mismo código.
- **T3.** `lib/constants/wallet-rotulos.ts`, `lib/constants/origen-legible-rotulos.ts`,
  `lib/utils/egreso-anulable.ts`.
- **T4.** `lib/types/historial-accion.ts`, `lib/types/plantilla-datos.ts`,
  `lib/whatsapp-envios/informes/aviso-interno.ts`, `lib/asistente/instrucciones.ts`,
  `lib/utils/aviso-ubicacion-denegada.ts`, `lib/services/AbonoTiendaService.ts`, `lib/analytics/metrics.ts`.
- **T11b.** `lib/crypto/webhook-firma.ts` (`X-Velox-Signature`/`X-Velox-Timestamp`, literales),
  comentario de `lib/services/WebhookEstadoService.ts`, `lib/api/openapi-spec.ts` y
  `docs/api/api-key-openapi.yaml` (ejemplo de `evidenciasUrl` y descripción del schema del webhook
  con las cabeceras), `docs/api/guia-integracion/guia-integracion.html` (Base URL, tabla, seis
  `curl`, ejemplo de `evidenciasUrl`, tabla de cabeceras y pasos 4–5), `docs/api/manual-metricas-por-mensajero.md`.
  Guardia 492 `marca-velox-sin-literal`: excepción CERRADA para `https://velox-courier.company` solo
  en `lib/api/openapi-spec.ts`, con autocomprobación (en ese archivo el dominio se admite y un
  «Velox Courier» a mano sigue siendo hallazgo; en otro archivo de la lista el dominio sí es
  hallazgo; `app.velox-courier.company` no entra).

## Decisiones técnicas (para que el frontend las siga igual)

1. **Forma de la marca (P1).** Etiquetas «X de <marca>» de una o dos palabras usan
   `MARCA.nombreCorto`: «Gasto de Velox», «Gasto fijo de Velox», «Otro gasto de Velox»,
   «Ganancia de Velox» (etiqueta de la métrica). Frases usan `MARCA.nombre`: «Velox Courier le
   cobra a una tienda», «Pago de Velox Courier a una tienda», «Una tienda le paga a Velox Courier»,
   «Indemnización que Velox Courier paga por un incidente», descripciones de métricas y de variables.
   **Los labels de pantalla que hoy repiten esos textos (`wallet-conceptos-manuales.ts`,
   `wallet-labels.ts`, `registrar-movimiento-labels.ts`) tienen que quedar IGUALES** a los de
   `CATEGORIA_LABEL`/`ORIGEN_LABEL`: hay tests de paridad entre ambos.
2. **Aviso de ubicación denegada:** las cinco menciones usan `MARCA.nombreCorto` (es el nombre de
   la app instalada, el `short_name`; P3 y R14).
3. **`it.fails` → trinquete** (el «equivalente documentado» que permite T2). Con `it.fails` un
   «Ordenex» reintroducido en algo ya cerrado no ponía nada en rojo (L6 no se podía medir). Ahora
   los bloques con pendiente (R15 código, R10 ayuda, R9 integradores, R16 tests) comparan contra
   `tests/fixtures/marca-pendientes-493.ts`, con número EXACTO por archivo: nada fuera de la lista
   ni por encima de su número, y cada pendiente con su número exacto. **Al cerrar una superficie
   hay que bajar o borrar su entrada** (la guardia lo pide con «actualiza tests/fixtures/marca-pendientes-493.ts»).
   T13 deja los cuatro mapas vacíos (y puede volver los bloques a `expect(...).toEqual([])` llano).
   Bloques que ya son `it` sin pendiente: R15 `public/`, R1, R14 (los dos), R16 imports, contrato y
   cabeceras de `webhook-firma.ts`.
4. **Excepción de R11 a nivel de token** (amplía `design.md §6.1`, que solo admitía cadenas
   enteras). R11 dice «SI un texto CONTIENE un identificador…»: la descripción de
   `dinero_en_caja` dice «(eso es ganancia_ordenex)». En código se admite la marca dentro de un
   identificador `\w+` más largo que la palabra (`ganancia_ordenex`, `deOrdenex`). En tests,
   además, tokens en minúscula más largos (`liquidado.ordenex`, rutas `ingreso-ordenex.ts`,
   dominios de dato de prueba `no-reply@ordenex.co`, `ordenex.app`, `ordenex.test`) y la palabra en
   minúscula de un selector (`='ordenex'`) o entre backticks. Nunca `X-Ordenex-*` (salvo en la lista
   cerrada `NEGATIVAS_DE_CONTRATO`), nunca «Ordenex»/«ORDENEX» como palabra, nunca la minúscula
   suelta en prosa. Todo con contraprueba en la guardia.
5. **R17 en la OpenAPI.** Las cabeceras de firma NO estaban declaradas en la OpenAPI desde el
   2026-09-01 (lo dice `tests/unit/api/openapi-webhook-estado-actualizado.test.ts`). R17 exige que
   la OpenAPI declare los nombres nuevos: se añadió `description` al schema
   `WebhookOrdenEstadoActualizado` (TS: interpola `WEBHOOK_*_HEADER` de `webhook-firma.ts`; YAML:
   literal, espejo exacto). Por eso `openapi-spec.ts` importa de `lib/crypto/webhook-firma.ts`
   (`node:crypto`); medido: su único importador es `app/api/docs/openapi/route.ts` (servidor).
6. **Comentarios con `ordenex.co`** que quedan (fuera de alcance, `design.md §2 e`):
   `lib/utils/linkificar.ts` (ejemplos de dominio), `app/globals.css`, `app/page.tsx`,
   `app/_landing/LandingNav.tsx`, `app/_landing/primitivas.tsx`. El bloque de contrato (AST, sin
   comentarios) da 0. El «grep devuelve 0» literal de T11b NO se cumple por esos comentarios:
   ver Abiertos.

## Mapa R → test (lo de esta fase)

| R | Test |
| --- | --- |
| R1 | `tests/unit/guards/marca-fuente-unica-493.guardia.test.ts` («R1: la marca vigente solo vive en su módulo» + contraprueba y no-vacuidad) |
| R2 | `tests/unit/marca/textos-ancla-493.test.ts` |
| R6 (etiqueta de la métrica) | `tests/unit/analytics/etiquetas-visibles.guardia.test.ts` (migrado) |
| R7 (variables de plantilla) | `tests/unit/types/plantilla-datos.test.ts` («R7: las descripciones de las variables…») |
| R8 (servidor) | `tests/unit/services/wallet-origen-legible.test.ts`, `tests/unit/services/wallet-egreso-reverso-legible.test.ts`, `tests/unit/services/wallet-anulacion-service.test.ts`, `tests/unit/historial-accion/catalogo-y-choke-point.test.ts`, `tests/components/HistorialAccionesAbonoTienda457.test.tsx`, `tests/unit/utils/aviso-ubicacion-denegada.test.ts`, `tests/components/GestionarOrdenUbicacionContexto.test.tsx`, `tests/unit/asistente/instrucciones.test.ts`, `tests/integration/asistente-route.test.ts`; errores de `AbonoTiendaService` solo por la guardia (R15, trinquete a 0) |
| R11 | guardia: contrapruebas «sano» de R15/R16 (claves `ordenex:*`, identificadores) |
| R14 | guardia: «public/sw.js: TITULO_RESERVA es MARCA.nombre» y «aviso de ubicación denegada: manda a buscar el short_name del manifiesto» |
| R15 | guardia: bloques R15/R10/R9 (trinquete) + contrapruebas |
| R16 | guardia: «solo la lista cerrada importa lib/marca/identidad», «la lista cerrada existe», trinquete de textos + contrapruebas |
| R17 | `tests/unit/crypto/webhook-firma.test.ts` («493/R17»), `tests/unit/services/webhook-estado-service.test.ts`, `tests/unit/services/WebhookEventoOrdenService.test.ts`, `tests/unit/clients/webhook-sender.test.ts` (literal nuevo + negativa), `tests/unit/api/openapi-webhook-estado-actualizado.test.ts` («493/R17», TS y YAML), guardia (contrato y `webhook-firma.ts`) |
| R18 | `tests/unit/types/plantilla-datos.test.ts` («493/R18»), `tests/unit/whatsapp-envios/informe-aviso-interno.test.ts` («493/R18»), `tests/unit/api/openapi-406-evidencias-url.test.ts` (TS y YAML), guardia (contrato) |
| R20 | `tests/unit/config/push-config.test.ts` (de la 492) + guardia (contrato: `soporte@ordenex.co` ausente) |

R3–R5, R9 (prosa), R10, R12, R13 y R19 son de T5–T15.

## Mutaciones medidas (L6) — todas restauradas y verificadas con `git diff`

| Mutación | Rojo |
| --- | --- |
| `MARCA.nombre` → «Velox Corier» | ancla (2 tests) |
| `egreso-anulable`: `egreso_gasto_fijo` → «Gasto fijo de Ordenex» | `wallet-anulacion-service.test.ts` + guardia (trinquete R15) |
| `historial-accion`: `abono_tienda` → «Pago de una tienda a Ordenex» | `catalogo-y-choke-point`, `HistorialAccionesAbonoTienda457` (2) + guardia |
| `aviso-ubicacion`: «buscá Velox Courier.» a mano | `aviso-ubicacion-denegada.test.ts` (3) + guardia R1 + guardia R14 |
| `plantilla-datos`: ejemplo de `url_guia` → `https://ordenex.co/…` | `plantilla-datos.test.ts` (3) |
| `plantilla-datos`: descripción de `zona` → «…de Ordenex…» | `plantilla-datos.test.ts` (R7) |
| `webhook-firma`: `WEBHOOK_SIGNATURE_HEADER` → `X-Ordenex-Signature` | 12 tests: `webhook-firma` (2), `webhook-estado-service` (3), `WebhookEventoOrdenService`, `openapi-webhook-estado-actualizado` (3), guardia (3) |
| «Velox Courier» a mano en `openapi-spec.ts` | guardia 492 `marca-velox-sin-literal` + guardia 493 R1 |
| `.yaml`: `evidenciasUrl` → `https://app.ordenex.co/…` | guardia (contrato + trinquete R9) y, tras reforzarlo, `openapi-406-evidencias-url.test.ts` (antes NO lo veía: solo miraba segmento y uuid) |

## Verificación (salida real)

- `pnpm exec tsc --noEmit` → `TSC_EXIT=0` (log `progress/tsc_493_back.log`), repetido sobre `9e8ed8a0` al cerrar la fase.
- `pnpm exec eslint` sobre los archivos tocados → sin errores (14 warnings `no-unused-vars`
  preexistentes en `WebhookEventoOrdenService.test.ts` y `webhook-estado-service.test.ts`, líneas no tocadas).
- `vitest related` de T3 (`progress/related_493_t3_a.log`, antes de migrar: 22 archivos/58 tests
  rojos, todos por el texto), de T4 (`progress/related_493_t4_a.log`) y de T11b
  (`progress/related_493_t11b.log`: 39 archivos, 473 tests, verde).
- `tests/integration/db` que importan los módulos tocados de `lib/types/` y `lib/constants/`: 19
  archivos, 213 tests, verde, 0 saltados (`progress/db_493_t34.log`).
- Guardia 493 + guardias 492 + push + webhook + OpenAPI: verdes al cierre.
- **No se corrió `./init.sh`** (ni completo ni `--rapido`): lo corre el frontend al final.

## Tests ROJOS que deja esta fase, a propósito (45 tests en 4 archivos)

Son tests de paridad entre los rótulos de `lib/` (ya con `MARCA`) y labels de pantalla que repiten
el mismo texto y todavía dicen «Ordenex». Ya están migrados al fixture: se ponen verdes solos cuando
el frontend pase esos labels a `MARCA` con la forma del punto 1 de Decisiones. Log:
`progress/rojos_493_para_frontend.log`.

| Archivo de test | Rojos | Lo cierra | Label de pantalla que falta |
| --- | --- | --- | --- |
| `tests/unit/components/wallet-registrar-movimiento-dialog.test.tsx` | 34 | T5/T6 | `app/(app)/wallet/_components/wallet-conceptos-manuales.ts`, `components/shared/wallet/registrar-movimiento-labels.ts` |
| `tests/unit/components/wallet-conceptos-manuales.test.ts` | 8 | T5 | `wallet-conceptos-manuales.ts` |
| `tests/unit/components/wallet-labels.test.ts` | 1 | T5 | `app/(app)/wallet/_components/wallet-labels.ts` («Gasto de Velox») |
| `tests/unit/guards/nombres-wallet-461.guardia.test.ts` | 2 | T5/T7 | `CONCEPTOS_MANUALES.label.abono_tienda`; y su lista de nombres retirados/reservados y sus «fuentes de antes» (L3) siguen con «Ordenex»: migrarlas JUNTAS |

## Censo de lo que queda para el frontend (guardia en trinquete)

Detalle por archivo, línea y fragmento en `progress/censo_marca_493.md`; números exactos en
`tests/fixtures/marca-pendientes-493.ts`. Base de T2 → cierre de esta fase:

| Bloque | Base T2 | Ahora |
| --- | --- | --- |
| R15 código (`app/ components/ hooks/ lib/`) | 219 en 45 | 152 en 34 |
| R10 `docs/ayuda/**` | 176 en 12 | 176 en 12 |
| R9 guía, README y `.yaml` | 47 en 2 | 33 en 2 |
| R16 textos de tests/e2e | 764 en 137 | 568 en 121 |
| Contrato R17/R18/R20 | 21 en 7 | 0 |
| R1, R15 `public/`, R16 imports | 0 | 0 |

Por task:

| Task | R15 código | R10 | R9 | R16 tests |
| --- | --- | --- | --- | --- |
| T3 (resto) | 0 | 0 | 0 | 17 (`nombres-wallet-461.guardia.test.ts`, ver arriba) |
| T5 caja | 50 | 0 | 0 | 101 |
| T6 wallet compartido | 20 | 0 | 0 | 35 |
| T7 estados de cuenta / Mi wallet | 47 | 0 | 0 | 118 |
| T8 cierres | 15 | 0 | 0 | 21 |
| T9 analítica | 6 | 0 | 0 | 10 |
| T10 configuración | 5 | 0 | 0 | 0 |
| T11 PWA, asistente, landing, prosa OpenAPI y guía | 9 | 0 | 33 | 3 |
| T12 ayuda | 0 | 176 | 0 | 72 |
| T13 restos | 0 | 0 | 0 | 191 |

R15 código por archivo (pendiente exacto): `analitica/.../DineroProductoDetalle.tsx` 2,
`ProductosTabla.tsx` 2, `analitica-productos-descarga-columnas.ts` 1, `finanzas/cargar-kpis.ts` 1;
`cierres-admin/.../CierresBodegaAdminModule.tsx` 2, `cierre-detalle-shared.tsx` 3,
`cierre-factura.tsx` 1, `cierre-labels.ts` 9; `configuracion/api/.../ApiKeysModule.tsx` 1,
`configuracion/envios-whatsapp/page.tsx` 1, `tarifas/.../CrearZonaForm.tsx` 1, `tarifas-labels.ts` 1;
`mi-wallet/.../mi-estado-cuenta-labels.ts` 2, `mi-wallet-labels.ts` 19;
`wallet/_components/ComposicionGananciaCard.tsx` 3, `DesgloseEgresosLista.tsx` 3,
`composicion-detalle-labels.ts` 1, `wallet-conceptos-manuales.ts` 20, `wallet-labels.ts` 22;
`wallet/mensajeros/.../estado-cuenta-mensajero-labels.ts` 1, `wallet-mensajeros-labels.ts` 1;
`wallet/page.tsx` 1; `wallet/satelites/.../satelites-labels.ts` 1;
`wallet/tiendas/.../desglose-tienda-labels.ts` 10, `estado-cuenta-tienda-labels.ts` 7;
`app/_landing/LandingPostular.tsx` 3; `components/shared/AsistentePanel.tsx` 2,
`AvisoVersionNueva.tsx` 1, `PushOptIn.tsx` 1, `estado-cuenta/estado-cuenta-labels.ts` 6,
`sinpe-textos.ts` 1, `wallet/detalle-movimiento-panel-labels.ts` 4,
`wallet/registrar-movimiento-labels.ts` 16; `lib/api/openapi-spec.ts` 2 (prosa de T11: interpolar
`MARCA.nombre`, que la guardia 492 admite; un literal «Velox» la pone roja).
R9: `docs/api/api-key-openapi.yaml` 4 (dos son comentarios YAML, l. 1 y l. 719; el barrido de
texto plano los cuenta) y `guia-integracion.html` 29.

Notas para el frontend:
- Razón social de ejemplo (P2): «Velox Courier S.A.» literal en `sinpe-textos.ts` y
  `CrearZonaForm.tsx`; la guardia R1 ya la admite SOLO en esos archivos y en `plantilla-datos.ts`.
- Encabezados de descarga (R13): `MARCA.nombreCorto` y la `clave` intacta.
- Al migrar tests con «Ordenex» use `tests/fixtures/marca-esperada.ts`; no importe `MARCA` (R16).
  Un script que hace la conversión literal→template con el fixture está en el scratchpad de esta
  sesión (no versionado); el patrón es el de los commits `2dae8f97`/`726f04f4`.

## Abiertos (no inventados: decide el leader/humano)

1. **T11b «grep devuelve 0».** Quedan `ordenex.co` en COMENTARIOS de `lib/utils/linkificar.ts`,
   `app/globals.css`, `app/page.tsx`, `app/_landing/LandingNav.tsx`, `app/_landing/primitivas.tsx`
   (describen el sitio viejo o ponen un ejemplo de dominio). Los comentarios están fuera de alcance
   (`design.md §2 e`) y el bloque de contrato de la guardia, que no mira comentarios, da 0. Si se
   quiere el grep literal a 0, es una edición de comentarios en archivos de frontend.
2. **R17 en la OpenAPI** se cumplió re-publicando las cabeceras en la descripción del schema (ver
   Decisiones 5). Es contenido nuevo del contrato que no estaba desde el 2026-09-01; el texto exacto
   puede revisarse en T15 junto con la entrada del `CHANGELOG.md`.
3. **`nombres-wallet-461.guardia.test.ts`**: `tasks.md` lo asigna a T3, pero su contenido (nombres
   retirados y reservados de las pantallas de tienda/Mi wallet y sus fuentes de antes) depende de
   labels de pantalla; se deja para T5/T7/T13 con la regla L3 (migrar juntas lista y contraprueba).
4. La guardia 493 tarda ~20 s (recorre todo `tests/`). Si molesta en el gate, se puede cachear el
   censo por bloque; no se tocó.
