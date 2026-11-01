# 493 — Marca Velox Courier: textos de la app · design

> Lee primero `requirements.md`. Medición con `grep` (el MCP `codebase-memory` no conectó en esta
> sesión). Todo lo citado se confirmó en el archivo real el 2026-11-01.

## 1. Resumen de la decisión

1. **No se crea constante propia.** La marca sale de `MARCA` en `lib/marca/identidad.ts`, que crea la
   492 (`specs/492-marca-velox-identidad/design.md §3.1`): `MARCA.nombre` («Velox Courier») y
   `MARCA.nombreCorto` (valor de la P1 de la 492; recomendado «Velox»). La 493 depende de la 492 y se
   implementa después. Si la 493 necesitara un campo que `MARCA` no tiene, es una dependencia
   explícita de la 492 (hoy solo la condiciona la P1 de esta ficha, ver §3), no un campo que se añade aquí.
2. Todo literal de texto que hoy dice «Ordenex» pasa a interpolar `MARCA.nombre` o
   `MARCA.nombreCorto`. Los identificadores no se tocan (R11).
3. Los tests siguen afirmando texto **literal**; la parte de la marca la escriben desde un fixture de
   test, también literal, nunca desde la constante de producción (§5).
4. Una guardia por AST (`typescript`) impide que vuelva «Ordenex» a un texto y que el nombre nuevo se
   escriba a mano fuera de su módulo (R1, R14–R16).
5. Sin base de datos: no hay tablas, RLS ni migraciones. No hay rutas nuevas.

## 2. Inventario clasificado

Medido el 2026-11-01. Las cifras de «líneas de texto» son por `grep` y aproximadas; el censo exacto
lo emite la guardia en T2 (`progress/censo_marca_493.md`).

### (a) Texto visible → SE CAMBIA (a `MARCA.nombre` / `MARCA.nombreCorto`)

| Superficie | Archivos principales | Ejemplos |
| --- | --- | --- |
| Caja principal (wallet) | `app/(app)/wallet/_components/wallet-labels.ts` (39), `wallet-conceptos-manuales.ts` (47), `CajaResumenCard.tsx`, `BarraComposicionCaja.tsx`, `ComposicionGananciaCard.tsx`, `DesgloseEgresosLista.tsx`, `composicion-detalle-labels.ts`, `libro-caja-labels.ts`, `WalletLedger.tsx`, `wallet/page.tsx` | «Ganancia de Ordenex», «Ingresos de Ordenex», «De Ordenex», «Ordenex (capital)», «Otros gastos de Ordenex» |
| Wallet compartido | `components/shared/wallet/registrar-movimiento-labels.ts` (18), `detalle-movimiento-panel-labels.ts` (incluye `esOrdenex: "Ordenex"`, el rótulo de «a quién» cuando es la empresa), `conceptos-filtro.ts`, `RegistrarMovimientoDialog.tsx`, `DetalleMovimientoPanel.tsx` | «Lo que Ordenex le debe a …», «Aporte de capital — dinero de Ordenex…» |
| Estados de cuenta | `components/shared/estado-cuenta/estado-cuenta-labels.ts`, `estado-cuenta-lineas.ts`, `EstadoCuenta.tsx`, `TarjetasEstadoCuenta.tsx`; `app/(app)/wallet/tiendas/_components/*labels*` (25), `EstadoCuentaAcciones.tsx`; `wallet/mensajeros/_components/*labels*`; `wallet/satelites/**` | «Ordenex le debe … a …», «Cargos de Ordenex», «Pagos de Ordenex a la tienda» |
| Mi wallet (tienda) | `app/(app)/mi-wallet/_components/mi-wallet-labels.ts` (29), `mi-estado-cuenta-labels.ts`, `MiEstadoCuenta.tsx`, `ResumenMiWallet.tsx`, `VerComprobanteMiMovimiento.tsx`, `mi-wallet/page.tsx` | «Ordenex te cobró el flete», «Anulado por Ordenex» |
| Cierres | `app/(app)/cierres-admin/_components/cierre-labels.ts` (16), `cierre-detalle-shared.tsx`, `CascadasCierreMensajero.tsx`, `CierresAdminModule.tsx`, `CierresBodegaAdminModule.tsx`, `DesglosePorTienda.tsx`, `cierre-factura.tsx` (membrete de texto «Ordenex», l. ~900); `app/(app)/cierre-dia/**` | «Total Ordenex», «Neto de Ordenex», «Lo que le queda a Ordenex», `ariaLabel` «Ingreso de Ordenex …» |
| Analítica | `app/(app)/analitica/_components/entregas/ProductosTabla.tsx`, `DineroProductoDetalle.tsx`, `analitica-productos-descarga-columnas.ts`, `finanzas/cargar-kpis.ts`; `lib/analytics/metrics.ts` (`etiqueta: "Ganancia de Ordenex"` y las `descripcion`) | «Cobró Ordenex» |
| Configuración | `configuracion/tarifas/_components/tarifas-labels.ts` (l. 90), `CrearZonaForm.tsx` (placeholder, P2), `configuracion/api/_components/ApiKeysModule.tsx`, `configuracion/envios-whatsapp/page.tsx`, `components/shared/sinpe-textos.ts` (placeholder, P2), `lib/types/plantilla-datos.ts` (descripciones de variables) | «Genera una API key para conectar sistemas externos con Ordenex.» |
| Generado en servidor (`lib/`) | `lib/constants/wallet-rotulos.ts` (≈25 rótulos), `lib/constants/origen-legible-rotulos.ts`, `lib/utils/egreso-anulable.ts`, `lib/types/historial-accion.ts`, `lib/utils/aviso-ubicacion-denegada.ts`, `lib/asistente/instrucciones.ts`, `lib/services/AbonoTiendaService.ts` (mensajes de error) | «Pago de Ordenex a una tienda», «Registró un pago de una tienda a Ordenex», «Sos el asistente de ayuda de Ordenex…» |
| PWA y asistente (cliente) | `components/shared/AvisoVersionNueva.tsx`, `PushOptIn.tsx`, `AsistentePanel.tsx` (texto JSX multilínea) | «Hay una versión nueva de Ordenex» |
| Landing (prosa) | `app/_landing/LandingPostular.tsx` (3: «Sumate a Ordenex», dos `copy`) y la prosa que quede en `app/_landing/**` tras la 492 | «Ponelo a trabajar con Ordenex» |
| Documentación para integradores (prosa) | `lib/api/openapi-spec.ts` (descripciones; `info.title` es de la 492), su espejo `docs/api/api-key-openapi.yaml` (descripciones), `docs/api/guia-integracion/guia-integracion.html` (38 apariciones; el cuerpo es de la 493, portada/título/autor/pie de la 492, su §3.11 y su P7) y `docs/api/guia-integracion/README.md` (3) | «la emite Ordenex», «pida a Ordenex», «Ordenex puede retirar una provincia…» |
| Ayuda | `docs/ayuda/**` (176 apariciones en 12 `.md`; 105 en `oficina/wallet-caja.md`) | prosa |

Observación: `lib/analytics/metrics.ts` → las `descripcion` no se leen desde `lib/analytics/**`
(medido: 0 lecturas de `.descripcion`); se cambian igual, porque son texto y la guardia no
distingue «visible hoy» de «visible mañana». Ídem los mensajes de error de `AbonoTiendaService`
(hoy se mapean por tipo, no por `.message`).

Fuera también de la documentación: `docs/api/CHANGELOG.md` (registro histórico, no se reescribe) y el
nombre de la colección Postman (`ordenex-api-key.postman_collection.json`, nombre de archivo).

### (b) Identificadores → NO se renombran

`ingresoOrdenex`, `netoOrdenex`, `TotalesIngresoOrdenex`, `IngresoOrdenexDTO`, `DesgloseIngresoOrdenex`,
`deOrdenex`, `esOrdenex`, `gastoDeOrdenex`, `NETO_ORDENEX_LABEL`, `CASCADA_NETO_ORDENEX_TITULO`,
`lib/utils/ingreso-ordenex.ts`, `toIngresoOrdenex`… Y los que son identificador **dentro de una
cadena**:

| Identificador | Dónde | Por qué no cambia |
| --- | --- | --- |
| `ordenex:descarga-columnas:*`, `ordenex:manifiesto-columnas:*` | `lib/columnas/preferencia-columnas.ts`, `lib/manifiesto/preferencia-columnas.ts` | localStorage: renombrar borra la preferencia guardada de cada persona (R12) |
| `ordenex:sonido-notificaciones`, `ordenex:app-navegacion`, `ordenex:sinpe-revision-aplazada:*` | `lib/audio/preferencia-sonido.ts`, `lib/utils/preferencia-navegacion.ts`, `hooks/*`, revisión SINPE | ídem |
| `ordenex_tema` | `lib/tema/tema.ts` (cookie) | ídem |
| `ordenex:relevo-ahora`, `ordenex:pagina-lista`, `ordenex:push-recibido`, tag `ordenex:<evento>` | `lib/pwa/actualizacion.ts`, `public/sw.js` | protocolo página ↔ service worker; un SW viejo en caché y una página nueva dejarían de entenderse |
| `X-Ordenex-Signature`, `X-Ordenex-Timestamp` | `lib/crypto/webhook-firma.ts`, `lib/api/openapi-spec.ts`, guía de integración | contrato con integradores (P4) |
| `"ordenex"` (clave de columna/segmento), `solo_ordenex`, `ordenex_debe`, `gasto_ordenex`, `tienda_paga_a_ordenex`, `concepto_ordenex`, `ganancia_ordenex` | `BarraComposicionCaja.tsx`, `analitica-productos-descarga-columnas.ts`, `wallet-labels.ts`, `estado-cuenta-labels.ts`, `wallet-conceptos-manuales.ts`, `lib/utils/efecto-movimiento.ts`, `lib/analytics/metrics.ts` | valores de enum/claves; algunos viajan en URL, en la caché de analítica o en preferencias |

Justificación de no renombrar: no lo ve nadie, renombrar cientos de símbolos de dinero amplía el
diff a `lib/types/` y repositorios sin ningún beneficio para la persona, y varios son contrato
persistido. Si algún día se quiere, es otra ficha.

### (c) Plantillas de Meta → NO se tocan

`alerta_transito_ordenex`, `picking_bodega_ordenex`: 0 coincidencias en `lib/` (medido). Viven en
Meta y en la configuración de envíos; renombrarlas exige re-aprobación en Meta.

### (d) Dominios y correos → FUERA (P6)

`https://ordenex.co` (`lib/types/plantilla-datos.ts` `urlBase`/`ejemplo`,
`lib/whatsapp-envios/informes/aviso-interno.ts`, «Base URL» de la guía de integración),
`https://app.ordenex.co/...` (ejemplo de la OpenAPI), `mailto:soporte@ordenex.co` (`lib/config/push.ts`).
Son excepciones explícitas de la guardia.

### (e) Comentarios → NO se tocan

La guardia trabaja sobre el AST, así que los comentarios no cuentan nunca.

### (f) Encabezados de CSV/Excel → SE CAMBIAN (R13)

Decisión: el encabezado (`encabezado`) pasa a la marca; la `clave` y el orden de la columna no
cambian. Ejemplo: `{ clave: "ordenex", encabezado: \`Cobró ${MARCA.nombreCorto} ${MARCA_NO_SUMABLE_ARCHIVO}\` }`
(o `MARCA.nombre`, según P1).

Por qué: el encabezado es texto para una persona que abre el archivo en una hoja de cálculo; dejar
«Cobró Ordenex» en el archivo mientras la pantalla dice otra cosa es la incoherencia que la ficha
viene a quitar. La integración por máquina es la API, no las descargas, y no hay ningún consumidor
automático medido. Quien procese el archivo por nombre de columna se rompe: se acepta y se pregunta si
hay que avisar (P8). Las cabeceras que salen de constantes compartidas (`INGRESO_TOTAL_COL`,
`INGRESO_TOTAL_LABEL`) cambian solas al cambiar la constante.

### (g) Frontera con la 492

De la 492 (su design §1 y §3): `lib/marca/identidad.ts` (`MARCA`, `LOGO`); `app/layout.tsx`
(título, descripción, `theme-color`, `apple-mobile-web-app-title`); `public/manifest.json`;
`public/offline.html`; `components/shared/Logo.tsx`, el `alt` del logo en `Sidebar.tsx` y el
`aria-label` de `LandingNav.tsx`; `EtiquetaGuia.tsx` y `ROTULO_GUIA` (literal en mayúsculas, no derivado
de `MARCA`, por decisión de la 492); `lib/whatsapp-envios/informes/*/pdf.ts`; `DEFAULT_FROM_NAME = MARCA.nombre`
en `lib/config/email.ts`; `<title>` de `/api-docs`, `info.title` de la OpenAPI y la línea del título del
`.yaml`; portada, `<title>`, autor y pie de la guía de integración.

De la 493: toda la **prosa** (landing incluida, cuerpo de la guía incluido) de §2 (a).

Regla: la 493 **no** rehace nada de lo de la 492, pero su guardia corre sobre todo el árbol. Lo que la
492 haya dejado con «Ordenex», o con la marca escrita a mano fuera de las excepciones de §6, sale rojo
en la guardia y se recoge en T13 apuntándolo a `MARCA`.

## 3. La constante de marca (de la 492)

`lib/marca/identidad.ts`, según `specs/492-marca-velox-identidad/design.md §3.1`:

```ts
export const MARCA = {
  nombre: "Velox Courier",
  nombreCorto: "<P1 de la 492>",   // ≤ 12 caracteres; recomendado «Velox»
  descripcion: "<P4 de la 492>",
  colorTema: "#011027",
} as const;
```

La 493 usa solo `MARCA.nombre` y `MARCA.nombreCorto`. Uso: interpolación en el sitio
(`` `Ganancia de ${MARCA.nombre}` ``). No se crean funciones de frase ni plantillas con huecos: el
texto completo sigue leyéndose en su archivo de labels.

**Dependencia explícita con la 492 (no se resuelve aquí):** si la respuesta a la P1 de esta ficha es
que las etiquetas cortas lleven una forma distinta de `MARCA.nombreCorto` (el `short_name` de la app),
hace falta un campo nuevo en `MARCA` (p. ej. para etiquetas). Lo añade la 492 o una enmienda suya; la
493 no lo crea. Si la P1 se responde «`nombreCorto`» o «`nombre`», no hace falta ningún campo.

Los textos que hoy son un `as const` literal y pasan a interpolar dejan de ser tipo literal; si algún
tipo dependía del literal exacto (p. ej. `typeof X.y`), el typecheck lo dirá y se resuelve con
`satisfies Record<…, string>` en ese archivo, sin cambiar el contrato.

## 4. Archivos que no pueden importar la constante

| Archivo | Valor | Cómo se mantiene en sincronía |
| --- | --- | --- |
| `public/manifest.json`, `public/offline.html`, `app/layout.tsx` | de la 492 | guardia de la 492 (`marca-velox-identidad.guardia.test.ts`); la 493 no la duplica |
| `public/sw.js` (`TITULO_RESERVA`) | `MARCA.nombre` | bloque de paridad de la guardia de la 493 (R14); la 492 no lo cubre |
| `lib/utils/aviso-ubicacion-denegada.ts` («Aplicaciones → … → Permisos») | importa `MARCA.nombreCorto`; la guardia comprueba que es el `short_name` del manifiesto | ídem |
| `docs/ayuda/**`, `docs/api/guia-integracion/*`, `docs/api/api-key-openapi.yaml` | literal «Velox Courier» en la prosa | la guardia prohíbe «Ordenex» (y en un futuro cambio, la marca retirada se añade a `MARCAS_RETIRADAS` y la guardia lista cada línea) |

La paridad compara dos fuentes independientes (archivo estático contra constante), no una cifra
contra su propia fuente.

## 5. Tests que afirman el literal: la regla

Hay 246 archivos de test con «Ordenex» (1.474 apariciones), una parte en comentarios e identificadores.
La regla para migrarlos:

- **L1 — el contrato sigue literal.** Un test que afirma un texto visible lo afirma con un literal
  escrito en el test. La parte de la marca se escribe con `NOMBRE_ESPERADO` / `NOMBRE_CORTO_ESPERADO`
  de un fixture nuevo `tests/fixtures/marca-esperada.ts`, cuyos valores son literales
  (`"Velox Courier"` y el valor de la P1 de la 492). Ejemplo:
  `expect(label).toBe(\`Cobró ${NOMBRE_CORTO_ESPERADO}\`)`.
  Prohibido importar `@/lib/marca/identidad` desde un test de texto (R16).
- **L2 — un solo ancla.** `tests/unit/marca/textos-ancla-493.test.ts` afirma
  `MARCA.nombre === "Velox Courier"` (literal), `MARCA.nombre === NOMBRE_ESPERADO` y
  `MARCA.nombreCorto === NOMBRE_CORTO_ESPERADO`. Es el único test de la 493 donde la constante de
  producción y la del fixture se encuentran.
  Por qué no es «aserción contra su propia fuente»: si un label se escribe a mano («Cobró Ordenex» o
  «Cobró Velox Corier»), su test lo compara con el fixture y sale rojo; si alguien cambia `MARCA`, el
  ancla sale roja hasta que se actualiza el fixture. Un futuro cambio de marca son dos líneas
  (`MARCA` + fixture), no 1.474.
- **L3 — las negativas también.** `not.toContain("… Ordenex")`, `queryByText("… Ordenex")).toBeNull()`
  y las listas de «textos retirados» de guardias existentes (p. ej. `caja-textos-459.guardia.test.ts`)
  se migran igual. Si se dejaran con «Ordenex» quedarían **verdes en vacío**: el texto viejo ya no
  puede aparecer y la regresión con el nombre nuevo pasaría. Medido: al menos 22 aserciones negativas
  con «Ordenex» (`grep` de `not.` / `queryBy…`). Donde una guardia tiene una «fuente de antes» como
  contraprueba, se migran juntas para que la contraprueba siga poniéndola roja.
- **L4 — lo que ya se comparaba con su fuente no se toca.** Los tests que hoy comparan contra un label
  importado de producción (`toBe(INGRESO_TOTAL_LABEL)`) siguen igual: esta ficha no los arregla ni
  crea otros.
- **L5 — identificadores literales intactos.** Los tests que afirman `X-Ordenex-Signature`,
  `ordenex:descarga-columnas:*`, `ordenex_tema` o claves `"ordenex"` siguen literales y verdes: son la
  prueba de R11/R12.
- **L6 — cada tramo se mata una vez.** Al cerrar cada task de superficie, se revierte UN label de esa
  superficie a «Ordenex» a mano y se comprueba que se ponen rojos su test y la guardia; se anota en
  `progress/impl_493.md` y se restaura.

## 6. La guardia

`tests/unit/guards/marca-fuente-unica-493.guardia.test.ts`. Parsea con `typescript`
(`ts.createSourceFile`, como `fuente-unica-nombre-estado.guardia.test.ts`) y recorre solo nodos de
texto: `StringLiteral`, `NoSubstitutionTemplateLiteral`, `TemplateHead/Middle/Tail`, `JsxText` e
iniciales de `JsxAttribute`. Los comentarios y los identificadores quedan fuera por construcción.

Bloques:

1. **R15 — sin «Ordenex» en texto.** Árbol: `app/`, `components/`, `hooks/`, `lib/` (`.ts`/`.tsx`);
   como texto plano `public/**/*.{js,json,html}`, `docs/ayuda/**/*.md`,
   `docs/api/guia-integracion/{guia-integracion.html,README.md}` y `docs/api/api-key-openapi.yaml`.
   Busca `/ordenex/i`.
   **Excepciones explícitas** (lista cerrada, en el propio test, cada una con su motivo):
   - cadena que empieza por `ordenex:` (claves de almacenamiento, protocolo SW, tags);
   - cadena que contiene `X-Ordenex-Signature` o `X-Ordenex-Timestamp`;
   - cadena que contiene `ordenex.co` (dominios y `soporte@ordenex.co`, P6);
   - cadena que entera es un identificador en minúsculas `^[a-z0-9_]*ordenex[a-z0-9_]*$` (`"ordenex"`,
     `"solo_ordenex"`, `"ganancia_ordenex"`, `"ordenex_tema"`…);
   - en `public/sw.js`, las líneas de las constantes `MENSAJE_*` y el `tag`.
   El fallo lista `archivo:línea — fragmento`. **Contraprueba**: una fuente sintética con
   `"Cobró Ordenex"`, un `JsxText` «Ordenex · Guía» y un `` `Total ${x} Ordenex` `` sale con 3
   hallazgos; otra con solo las excepciones sale con 0.
2. **R1 — la marca solo en su módulo.** Ningún nodo de texto fuera de `lib/marca/identidad.ts`
   contiene `MARCA.nombre` como literal, sensible a mayúsculas (comparado con el valor importado de
   producción: aquí sí se importa, porque lo que se busca es la copia). `MARCA.nombreCorto` no se
   busca suelto si es una sola palabra («Velox»), por falsos positivos; se busca en las formas
   `de ${corto}`/`Cobró ${corto}`/`Total ${corto}`. Excepciones cerradas: los archivos de §4,
   `app/_legal/datos-legales.ts` (`DATOS_LEGALES.marca`, dato legal con guardia propia, la 492 lo
   deja así) y `ROTULO_GUIA` (literal en mayúsculas por decisión de la 492).
   Contraprueba: fuente sintética con `"Total Velox Courier"` → 1 hallazgo.
3. **R14 — paridad.** `public/sw.js` `TITULO_RESERVA` === `MARCA.nombre`; el texto de
   «Aplicaciones → X → Permisos» del aviso de ubicación contiene el `short_name` de `manifest.json`.
4. **R16 — los tests no se anclan a su fuente.** Árbol `tests/` y `e2e/`: solo importan
   `@/lib/marca/identidad` los de una lista cerrada (el ancla de la 493, esta guardia y los tests de
   paridad de la 492, nombrados uno a uno al implementar T2 tras leer lo que la 492 mergeó); ningún
   nodo de texto contiene «Ordenex» fuera de las excepciones del bloque 1 y de la lista
   `MARCAS_RETIRADAS` de esta guardia. Contraprueba sintética para cada mitad.

`MARCAS_RETIRADAS = ["Ordenex"]` vive en la guardia: en un futuro cambio se le añade «Velox Courier»
y la guardia enumera cada sitio pendiente, incluidos los `.md` y el `.html` de la guía.

Nota de gate: la guardia lee el árbol con `fs`; el grafo no la relaciona con los diffs, así que
`--rapido` puede no correrla. Cada task la corre a mano (memoria «guardia estructural escapa al
--rapido»).

## 7. Zona y gate

- **Zona recomendada: `fullstack`.** Hay texto visible generado en `lib/` (rótulos del libro de caja,
  historial, plantillas, asistente, aviso de ubicación, OpenAPI, métricas, errores de servicio). La
  ficha dice `frontend`; no se cambia aquí. Secuencia sugerida: tramo `lib/` (T3–T4) antes que las
  pantallas que lo consumen (T5–T12).
- **Gate:** `./init.sh --rapido`. El diff toca `lib/types/` (`historial-accion.ts`, `plantilla-datos.ts`)
  y nombres de dinero, así que `--rapido` se amplía solo con `tests/integration/db`. Sin `.env` esa
  parte se salta: mirar los `skipped`.
- Conviene verlo en la app (Playwright o a mano) en caja, mi wallet, un cierre y analítica: el
  typecheck no dice si una frase quedó «Cobró Velox Courier Courier».

## 8. Alternativas descartadas

1. **Buscar y reemplazar «Ordenex» por «Velox Courier» en literales, sin constante.** Es el diff más
   corto, pero deja el próximo cambio igual de caro (≈230 líneas de código + 1.474 de tests) y no hay
   nada que impida que vuelva a escribirse a mano. Contradice el objetivo de la ficha.
2. **Una constante propia de la 493 (`lib/constants/marca.ts`).** Era la primera versión de este
   spec. Se descarta: la 492 ya crea `MARCA` en `lib/marca/identidad.ts` y se implementa antes; dos
   constantes con el mismo nombre de empresa son justo la divergencia que la ficha quiere evitar.
3. **Tests que importan la constante (`` `Cobró ${MARCA.nombre}` ``).** Cada test quedaría verde para
   cualquier valor de la constante y para cualquier label que la use, aunque la frase esté mal. Es la
   «aserción contra su propia fuente» que este repo ya pagó (memorias «Aserción contra su propia
   fuente» y «Literal: contrato o polizón»). Se sustituye por el fixture literal + ancla (§5).
4. **Marca por variable de entorno (`NEXT_PUBLIC_MARCA`).** Haría la marca configurable por despliegue,
   pero no hay un segundo despliegue con otra marca, añade un valor que puede faltar en un entorno
   (y pintarse vacío en silencio) y obliga a los tests a montar el entorno. Una constante basta.
5. **Marcador `{{marca}}` en `docs/ayuda/**` sustituido al cargar.** Cumpliría «una línea» también en
   la ayuda, pero cualquier lector que se salte la sustitución (tests que leen el `.md` crudo, el
   asistente, un renderer nuevo) pintaría `{{marca}}` sin que nada falle: un fallo mudo. Se prefiere
   prosa literal vigilada por `MARCAS_RETIRADAS`. Lo mismo para la guía de integración (HTML que se
   imprime a PDF desde el archivo).
6. **Renombrar también los identificadores (`ingresoOrdenex` → `ingresoEmpresa`).** Coherente, pero
   multiplica el diff en código de dinero y tipos, toca claves persistidas y no lo ve nadie (§2 b).

## 9. Riesgos

- Etiquetas en columnas estrechas con la marca larga (depende de P1): revisar en T14 que no se
  partan.
- Concordancia: «de Ordenex» → «de Velox Courier» no cambia de género ni número; aun así, T14 lee
  las frases completas.
- Conflictos con fichas abiertas que editen los mismos `*labels*`: cada task toca pocos archivos para
  que el rebase sea por tramos.
- La guía de integración se imprime a PDF: tras cambiar la prosa hay que regenerar el PDF como indica
  su `README.md` (lo hace T11).
