# Revisión 493 — Marca Velox Courier: textos de la app

> reviewer, 2026-11-02. Worktree `R:\job\singularis\projects\wt-493`, rama `feat/493-marca-velox-textos`,
> HEAD revisado `efa3916c` (18 commits sobre `origin/dev` `bad98c17`, 224 archivos).
> Búsqueda: búsqueda de texto y lectura directa (la revisión es de texto y de tests, no de llamadas;
> el MCP `codebase-memory` no se usó). NO se corrió el gate en ninguna forma (instrucción del
> leader); se usó el gate que el leader ya corrió (`progress/gate_493_2.log`) y se repitieron
> aislados los archivos clave.

## Veredicto: CAMBIOS REQUERIDOS

Un bloqueante, procedimental pero real: `tasks.md` tiene las 17 tasks sin marcar y T14 tiene una parte
sin hacer (ver la app). El código, los tests y el contrato están bien: ningún hallazgo de fondo.

## Checklist

### Especificación (CHECKPOINTS)
- [x] `requirements.md` con R1–R20 en EARS.
- [x] `design.md` con 8 alternativas descartadas y su porqué.
- [ ] **`tasks.md` con todas las tasks `[x]`: NO.** Las 17 (T0–T15, T11b) siguen `[ ]`; `specs/` no
      aparece en el diff. Ver B1.

### Trazabilidad
- [x] Cada R1–R20 mapea a un test concreto con aserción real (tabla abajo).
- [~] El mapa R→test existe, pero partido en `progress/impl_493_backend.md` y
      `progress/impl_493_frontend.md`; no hay `progress/impl_493.md` como pide T14. Entre los dos están
      los 20. Menor (m4).

### Calidad de código
- [x] Gate `progress/gate_493_2.log` sobre `efa3916c`: `INIT_EXIT=0`, modo `--rapido` AMPLIADO.
      Relacionados 781 archivos / 10.549 verdes / 26 skipped (los `it.skip` de siempre de
      `AnaliticaPage`/`AnaliticaShell`); guardias 280/280 (3.859 tests); `integration/db` 458/458
      (4.269 tests), **0 saltados**, `.env` presente. typecheck y lint verdes.
- [x] Repetido aislado por el reviewer: 17 archivos clave (guardia 493, ancla, `identidad`, las tres
      guardias de la 492, `wallet-etiqueta-cuenta`, changelog R19, configuración, PWA/landing, OpenAPI
      x2, `webhook-firma`, `webhook-estado-service`, descarga de productos, `push-config`,
      `plantilla-datos`): **17/17 archivos, 306/306 tests verdes**.
- [x] E2E: el cambio de cabeceras toca webhooks, pero el repo no tiene harness E2E (los specs dicen
      «NOT EXECUTED»); el riesgo lo cubren `webhook-firma.test.ts` y `webhook-estado-service.test.ts`
      con los nombres literales y la negativa. Checkpoint declarado inaplicable.

### Datos y seguridad
- [x] Sin tablas ni migraciones nuevas (diff vacío en `db/`, `prisma/`, `supabase/`): RLS y `down.sql` no aplican.
- [x] Sin secretos. El correo VAPID por defecto `mailto:battos.sa@gmail.com` es dato de contacto (R20).
- [x] Webhook: misma firma (`sha256=<hex>` sobre `${timestamp}.${cuerpo}`), solo cambia el nombre de las
      cabeceras; idempotencia sin tocar.

### Capas / permisos / multi-país
- [x] Solo cambian literales de texto por interpolación de `MARCA`; ninguna capa cambia de forma, ni
      permisos, ni hay país/moneda/cuenta hardcodeada.

### Verificación final
- [ ] `progress/history.md`: pendiente del leader al cerrar (no es del reviewer).

## Trazabilidad R → test (verificada en el archivo)

| R | Test | Comprobado |
| --- | --- | --- |
| R1 | guardia `marca-fuente-unica-493` «R1: la marca vigente solo vive en su modulo» + no-vacuidad + contraprueba «Total Velox Courier» | sí |
| R2 | `tests/unit/marca/textos-ancla-493.test.ts` (`MARCA.nombre === "Velox Courier"` literal; fixture == `MARCA`) | sí |
| R3 | `wallet-labels.test.ts`, `wallet-registrar-movimiento-dialog`, `CajaResumenCard*`, `ComposicionGananciaCard`, `DetalleMovimientoPanel`… | sí (L6 del implementer + R15) |
| R4 | `mi-wallet-labels`, `desglose-tienda-*`, `integration/mi-wallet-page`, `EstadoCuenta*` | sí |
| R5 | `CierresAdminModule`, `CierreMensajero/BodegaDetalleCascadas`, `cierres-gestiones-fundida-descarga-columnas` («Total Velox») | sí |
| R6 | `ProductosTablaDinero`, `DineroIdentidadesEnPantalla`, `kpis-financieros`, `etiquetas-visibles.guardia` | sí |
| R7 | `configuracion-marca-493.test.tsx` (nuevo) + `plantilla-datos.test.ts` | sí |
| R8 | `wallet-origen-legible`, `catalogo-y-choke-point`, `aviso-ubicacion-denegada`, `instrucciones`, `PushOptIn`, `MarcaPwaLanding493` (nuevo) | sí |
| R9 | `openapi-marca-493.test.ts` (nuevo, TS y `.yaml`) + guardia bloque R9 | sí |
| R10 | guardia bloque `docs/ayuda` + `ayuda-wallet-caja-488`, `contexto-457/458/460/461` | sí (mutación del reviewer) |
| R11 | guardia: contrapruebas «sano» (`ordenex:*`, `solo_ordenex`, `ganancia_ordenex`, `ordenex_tema`) + `tema-encendido`, `useTonoAlIncrementar` sin cambios | sí |
| R12 | `CierresDescargaColumnas`, `OrdenesDescargaColumnas`, `ProductosDescargaColumnas`, `useTonoAlIncrementar`, `tema-encendido`: **diff vacío** en los cinco y verdes en el gate | sí |
| R13 | `analitica-productos-descarga-columnas` («Cobró Velox (no sumar…)» + clave `"ordenex"` en su orden), `cierres-gestiones-fundida-descarga-columnas` («Total Velox», clave `ingresoTotal`) | sí |
| R14 | guardia «TITULO_RESERVA es MARCA.nombre» y «aviso de ubicación … short_name del manifiesto» | sí |
| R15 | guardia bloques R15 código / `public/` / R10 / R9 como `it` llanos + contraprueba de 3 hallazgos | sí (mutaciones del reviewer) |
| R16 | guardia «solo la lista cerrada importa lib/marca/identidad» + «ningun test dice la marca retirada» + contrapruebas | sí |
| R17 | `webhook-firma.test.ts` (literales + negativas), `webhook-estado-service.test.ts` (`Object.keys(headers)` exactamente las dos nuevas), `openapi-webhook-estado-actualizado.test.ts` (TS y YAML), guardia bloque contrato | sí (mutación del reviewer) |
| R18 | `plantilla-datos.test.ts`, `informe-aviso-interno.test.ts`, `openapi-406-evidencias-url.test.ts` (literal `https://velox-courier.company` + negativa `ordenex.co`) + guardia contrato | sí |
| R19 | `tests/unit/docs/changelog-api-493.test.ts` (nuevo): primera entrada, nov-2026, RUPTURA, cabeceras, dominio, encabezados con su antes, correo; la guía refleja lo mismo | sí |
| R20 | `push-config.test.ts` (`"mailto:battos.sa@gmail.com"` literal x3) + guardia contrato (`soporte@ordenex.co`) | sí |

## Puntos pedidos por el leader

1. **Trazabilidad:** completa (tabla de arriba). Ningún test vacío ni verde-sin-datos entre los revisados.
2. **Desvíos declarados:**
   - **(a) Trinquete de T2, borrado en T13.** Confirmado: `tests/fixtures/marca-pendientes-493.ts` no
     existe y los bloques del árbol son `it(... toEqual([]))` llanos. **Mutaciones aisladas del
     reviewer** (todas restauradas; árbol sin cambios rastreados después):
     - `wallet-labels.ts` `ganancia` → «Ganancia de Ordenex» y un `"Cobró Ordenex."` en
       `lib/utils/aviso-ubicacion-denegada.ts` → rojo, lista `archivo:línea — fragmento` de los dos.
     - JSX en `components/private/BodegaLiberadasHoy.tsx`: `aria-label="Logo Ordenex"`, texto
       «Hola Ordenex», `title="ORDENEX"` → los tres rojos.
     - Una línea «Pregunta a ordenex por soporte.» en `docs/ayuda/tienda/mi-wallet.md` → rojo (R10).
     - `WEBHOOK_SIGNATURE_HEADER = "X-Ordenex-Signature"` → 11 tests rojos en 4 archivos (firma,
       servicio, OpenAPI TS/YAML, guardia R15 + contrato).
   - **(b) Excepción de R11 ampliada a token.** Medida con un sondeo sobre el detector real: en código de
     producción admite solo un token `\w+` más largo que la palabra; «Panel Ordenex», «Ordenex.»,
     «ordenex» suelta, «ordenex-courier», `ordenex.app` siguen siendo hallazgo. **Deja pasar**
     «Bienvenido a OrdenexApp», «Equipo_Ordenex», «Ordenex2026», «Soporte ORDENEX_PRO»: compuestos que
     serían texto visible con la marca pegada. Hoy no hay ninguno (R15 por AST da 0) y no es la forma
     natural de reintroducir la marca. Menor (m1). La holgura extra de tests (`enTest`: minúsculas
     compuestas y dominios de dato) no puede tapar una regresión de producción: esa la vigila R15 sobre
     el código, no R16.
   - **(c) `tests/fixtures/marca-retirada-nombre-493.ts` en `PROPIOS`.** Correcto y estrecho: solo
     contiene `MARCAS_RETIRADAS = ["Ordenex"]` y `MARCA_RETIRADA`; `PROPIOS` solo lo saca del barrido R16
     de tests. Los usos positivos de `MARCA_RETIRADA` son los «antes» del CHANGELOG (R19 DEBE decirlos) y
     una contraprueba de `paginas-legales-estaticas`; el resto son negativas. OK.
   - **(d) Cabeceras redeclaradas en el schema del webhook.** Coherentes: `lib/api/openapi-spec.ts:965`
     interpola `WEBHOOK_TIMESTAMP_HEADER`/`WEBHOOK_SIGNATURE_HEADER`, `api-key-openapi.yaml:749` dice el
     literal `X-Velox-*`, la paridad TS↔YAML exacta los ata y `openapi-webhook-estado-actualizado.test.ts`
     afirma el nombre `X-Velox-Signature` literal (no la constante): la mutación lo puso rojo. Es un
     añadido documentado en el CHANGELOG. OK.
   - **(e) `wallet-etiqueta-cuenta.guardia` (458-A R33).** El patrón pasa a
     `\$\{(?!MARCA\.)[^}]*\.nombre\}\s+\$\{`: solo exime la interpolación que EMPIEZA por `MARCA.`.
     `${tienda.nombre} ${…}`, `${fila.tienda.nombre} ${…}` y `${x.nombre} ${…}` siguen cazados; hay
     contraprueba nueva en ambos sentidos y los demás patrones no se tocaron. Sigue protegiendo lo que
     protegía. OK.
3. **Aserciones contra su propia fuente:** ninguna nueva. Solo 5 archivos de tests importan
   `@/lib/marca/identidad` y son la lista cerrada (ancla, guardia 493, `identidad.test`, dos guardias de
   la 492); R16 lo hace cumplir. Los tests de texto usan `NOMBRE_ESPERADO`/`NOMBRE_CORTO_ESPERADO`
   (literales, atados a `MARCA` solo por el ancla, design §5 L1/L2). Contrato siempre literal (L5b). Los
   imports de producción nuevos en tests (`PAGO_ZONA_TEXTO`, `SINPE_CAMPO_NOMBRE`, componentes) se usan
   para renderizar y se comparan contra literal + fixture.
4. **Identificadores intactos:** en `app/ components/ hooks/ lib/ public/`, cada identificador con
   «ordenex» que el diff quita vuelve en la misma cantidad (`ordenex:` x4, `ordenex_debe` x2,
   `ordenexPaga`, `ordenexCobra`, `gastoDeOrdenex`, `esOrdenex`, `ganancia_ordenex`, `"ordenex"`,
   `NETO_ORDENEX_LABEL`, `FACTURADO_ORDENEX_LABEL`, `CASCADA_NETO_ORDENEX_TITULO`): solo se reformatea la
   línea. Desaparecen únicamente «Ordenex» de texto, `ordenex.co`/`app.ordenex.co` y `X-Ordenex-*`
   (R17/R18). Sin cambios en `db/`, migraciones ni enums; las plantillas de Meta no están en el código.
5. **Contrato API:** emisor (`lib/crypto/webhook-firma.ts:15,17`), servicio, OpenAPI TS/YAML y guía
   (`guia-integracion.html` §6 y D.1) dicen `X-Velox-Signature`/`X-Velox-Timestamp`; ninguna
   `X-Ordenex-` fuera de `CHANGELOG.md` y de las negativas listadas. Dominio
   `https://velox-courier.company` en OpenAPI, `.yaml`, guía, `manual-metricas-por-mensajero.md`,
   `plantilla-datos.ts` y `aviso-interno.ts`; `ordenex.co` solo queda en dos COMENTARIOS de
   `lib/utils/linkificar.ts` (fuera de alcance, abierto declarado). CHANGELOG: entrada 2026-11-02
   «RUPTURA» arriba, con los cuatro cambios y su antes/después.
6. **Tests borrados o debilitados:** ningún archivo borrado en el diff; ningún archivo de test con más
   de 3 líneas netas quitadas; ningún `.skip`/`.todo`/`it.fails`/`xit` añadido; líneas con `expect(`
   -235 / +351. Las negativas «Ordenex» (L3) se migraron a la marca vigente o a `MARCA_RETIRADA` según
   corresponde.

## Hallazgos

### BLOQUEANTE

- **B1 — `tasks.md` sin marcar y T14 incompleta.** `specs/493-marca-velox-textos/tasks.md`: las 17
  tasks están `[ ]` (CHECKPOINTS: «todas las tasks marcadas `[x]`»; la 492 sí las marcó). Además el
  «Hecho» de T14 pide «capturas o notas de lo visto en la app» (caja, Mi wallet, un cierre, analítica y
  una descarga) y `impl_493_frontend.md` («Abiertos 1») declara que no se hizo. Es el riesgo que el
  propio design §7/§9 dice que el typecheck no ve (frases largas con «Velox Courier» en columnas
  estrechas, «Courier Courier»). **Para cerrarlo:** (1) hacer la pasada visual de T14 (Playwright o a
  mano; limpiar lo que ensucie la base local) y anotar lo visto, o que el humano la dispense por
  escrito; (2) marcar `[x]` T0–T15 en `tasks.md`.

### menor

- **m1 — Excepción de R11 en producción admite la marca pegada a un identificador.** «OrdenexApp»,
  «Equipo_Ordenex», «Ordenex2026», «ORDENEX_PRO» dentro de un texto visible no son hallazgo
  (`quitarIdentificadores`, regla `/^\w+$/ && largo`). Hoy 0 casos. Si se quiere cerrar: en código de
  producción admitir el token solo si es camelCase/snake_case que no empiece por la palabra con caja de
  marca, con contraprueba.
- **m2 — Fecha de despliegue «PENDIENTE» en la entrada del CHANGELOG.** Intencional (nota operativa de
  T15); escribirla antes de mandar el aviso, junto con pausar integradores y cambiar
  `NEXT_PUBLIC_APP_URL`/`NEXT_PUBLIC_SITE_URL` en Vercel cuando `velox-courier.company` sirva la app.
- **m3 — `webhook-sender.test.ts`** comprueba que el cliente reenvía las cabeceras que se le pasan; no
  prueba quién las genera. Sin efecto: el emisor real lo fijan `webhook-firma.test.ts` y
  `webhook-estado-service.test.ts` (rojos en la mutación).
- **m4 — Bitácora partida.** T14 pide `progress/impl_493.md` con la tabla R1–R20; está repartida entre
  `impl_493_backend.md` e `impl_493_frontend.md`. Basta un índice al cerrar B1.
- **m5 — `tests/integration/wallet-page.test.tsx`** salió rojo por timeout bajo carga en `gate_493_1`
  (verde aislado, 13/13); en `gate_493_2` no apareció. Intermitente conocido, no de esta ficha.

## Evidencia del reviewer

- Mutaciones del punto 2(a), todas restauradas.
- Sondeo del detector (punto 2b) con un test temporal en `tests/tmp493/`, borrado después.
- Corrida aislada: 17 archivos, 306 tests verdes (`pnpm exec vitest run …`).
