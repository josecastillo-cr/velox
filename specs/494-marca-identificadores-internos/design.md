# 494 — Marca Velox Courier: identificadores internos · design

> Lee primero `requirements.md`. Medido con `Grep`/`Read` el 2026-11-04 sobre `dev` `519740e5` (el MCP
> `codebase-memory` no conectó). Las citas `archivo:línea` se leyeron en el archivo real. Lo que no sale del repo
> (memoria, Vercel, Meta) lo dice expresamente y hay que re-medirlo. Nombres con el valor por defecto de P1 y P2.

## 1. Resumen de la decisión

1. **Una tabla de renombrado, un script.** `scripts/marca-494-renombrar.mjs` aplica una tabla cerrada
   viejo → nuevo, por familias, sobre listas de rutas. Es determinista y se puede repetir: un conflicto de rebase
   se resuelve descartando y regenerando, no a mano. Se borra al cerrar la ficha.
2. **Palabra neutral** (P1): `empresa` y prefijo `app:`. La marca vive en `MARCA`, no en los identificadores.
3. **Guardia nueva con trinquete** (`marca-sin-ordenex-494`): búsqueda de texto sobre todo el árbol, sin AST, con
   lista cerrada de excepciones. El trinquete baja con cada tanda y desaparece en la última.
4. **Navegador y service worker: la clave vieja se lee, nunca se escribe.** Todo lo viejo vive en un módulo, y cada
   rama del service worker acepta los dos nombres. Quitar el legado es otra ficha.
5. **Filas: primero el número.** Por el código se espera 0 en columnas leídas, pero el backfill se diseña en función de
   la medición de §4, no al revés.
6. **Plantillas de Meta: después del merge, y con un humano.** El código ya no conoce sus nombres; se cambian por SQL en
   prod cuando Meta apruebe las nuevas (§8). No bloquean nada.
7. **Sin cambios de dominio.** No hay ninguno vivo en el repo (§6).
8. **Ocho tandas** con PR propio, en el orden de §10.

## 2. Censo clasificado

Conteos por `Grep`, sin distinguir mayúsculas salvo lo indicado. «≈» = suma de líneas de una búsqueda `-o`; el censo
exacto lo emite la guardia en T1.

| Tipo | Riesgo | Volumen en código (`app`, `lib`, `components`, `hooks`, `public`) | En `tests/` | Dónde se resuelve |
| --- | --- | --- | --- | --- |
| Palabra suelta en comentario (`Ordenex`, `ORDENEX`) | ninguno | `lib` 273 en 115 archivos; `app` 191 en 49 (la guardia de la 493 ya garantiza que no son texto visible) | 374 en 162 | §3.4 |
| Identificador renombrable (`netoOrdenex`, `TotalesIngresoOrdenex`, `*_ORDENEX_*`) | bajo: `tsc` lo atrapa | ≈210 | 445 en 89 | §3.1 |
| Clave de objeto minúscula (`.ordenex`, `ordenexCobra`, `liquidado.ordenex`) | bajo, salvo caché (§3.3) | ≈70 | incluidas arriba | §3.1 |
| Ruta de módulo (`lib/utils/ingreso-ordenex.ts`) | bajo | ≈45 | 33 en 26, y `tests/unit/utils/ingreso-ordenex.test.ts` | §3.1 |
| Valor de dominio en cadena (6 de la ficha + `"ordenex"`) | medio: ver §3.2 y §4 | ≈50 | 61 en 25, y 59 en 22 de `ganancia_ordenex` | §3.2 |
| Valor guardado en filas | **a medir** | 0 columnas ni enums; posible solo en JSONB o texto | — | §4 |
| Contrato externo | ninguno medido | 0 campos públicos con la marca; 1 archivo Postman | — | §3.2, §9 |
| Clave de navegador y protocolo del service worker | alto si se hace mal: fallos mudos | 15 literales | 87 en 37 | §5 |
| Dominio o URL viva | ninguno | 0 configuración; 10 líneas de ejemplo o comentario | 160 en 67 (datos de prueba) | §6 |
| Plantilla de Meta | depende de un humano | 0 en código | 0 | §8 |
| Configuración del proyecto | bajo | `package.json:2`, `CLAUDE.md` (3), `.claude/agents/*` (5), `.claude/commands/test_jobs.md`, `DESIGN.md`, `.env.example:172`, `docs/release.md` (26), Postman. `.mcp.json`: 0 | — | §9 |

## 3. Renombrado en código

### 3.1 La tabla (valor por defecto de P1)

| Viejo | Nuevo | Familia |
| --- | --- | --- |
| `lib/utils/ingreso-ordenex.ts`, `tests/unit/utils/ingreso-ordenex.test.ts` | `ingreso-empresa.ts`, `ingreso-empresa.test.ts` | cierres |
| `ingresoOrdenex`, `toIngresoOrdenex`, `IngresoOrdenexDTO`, `DesgloseIngresoOrdenex`, `TotalesIngresoOrdenex`, `totalesIngresoOrdenex` | mismo patrón con `Empresa` | cierres |
| `gananciaOrdenex`, `netoOrdenex`, `netoOrdenexAgregado`, `lineasNetoOrdenex`, `pagoTiendaOrdenex` | mismo patrón con `Empresa` | cierres |
| `NETO_ORDENEX_LABEL`, `NETO_ORDENEX_NOTA`, `NETO_ORDENEX_NEGATIVO_NOTA`, `FACTURADO_ORDENEX_LABEL`, `CASCADA_NETO_ORDENEX_TITULO` | mismo patrón con `EMPRESA` | cierres |
| `deOrdenex`, `esOrdenex`, `gastoDeOrdenex`, `SuperficieOrdenex`, `ORDENEX_NEUTRO`, `BOLSILLO_ORDENEX` | mismo patrón | caja |
| `ordenexCobra`, `ordenexPaga`, `CAJA_COMPOSICION_LABEL.ordenex` | `empresaCobra`, `empresaPaga`, `.empresa` | caja |
| `solo_ordenex`, `ordenex_debe`, `gasto_ordenex`, `tienda_paga_a_ordenex`, `concepto_ordenex`, `"ordenex"` de `A_QUIEN_POR_ORIGEN` | `solo_empresa`, `empresa_debe`, `gasto_empresa`, `tienda_paga_a_empresa`, `concepto_empresa`, `"empresa"` | caja |
| `ganancia_ordenex` | `ganancia_empresa` | analítica |
| `liquidado.ordenex`, `reparto.ordenex`, `ordenex`/`ordenexPista` de `DETALLE_DINERO_TEXTOS` y `PRODUCTOS_COLUMNAS`, `IdDinero`, `clave: "ordenex"` | `.empresa`, `empresaPista`, `"empresa"` | analítica |

Reglas del script:

- Sustituye por palabra completa (`\b`), sensible a mayúsculas. Para la palabra minúscula `ordenex` solo actúa en las
  rutas de la familia: en el resto puede ser clave de navegador o dominio, que tienen su propia tanda.
- **Aborta si el destino ya existe.** Medido: `empresa` aparece 8 veces en 5 archivos de `lib/` y 16 en 7 de `app/`, entre
  ellos 9 en `cierre-factura.tsx`; los de `lib/` leídos son comentarios, los de `app/` están sin clasificar. T1 los lista.
- `git mv` para los archivos, para conservar la historia.
- Lo que no tape la tabla lo atrapa `tsc`, y si es una cadena, la guardia.

### 3.2 Valores de dominio: qué son

Ninguno tiene columna ni enum en `db/schema.prisma` (en él, `ordenex` solo aparece en comentarios).

| Valor | Definición | Qué es | Cruza una frontera |
| --- | --- | --- | --- |
| `ganancia_ordenex` | `lib/analytics/metrics.ts:755`, `lib/types/analitica-financiera.ts:320,370`, `AnaliticaFinancieraService.ts:239` | id de métrica | Solo server action → tablero. **Ni en `METRICAS_API_KEY` ni en `docs/api/**`** |
| `solo_ordenex` | `lib/types/wallet.ts:495`, `lib/utils/caja-tesoreria.ts:388` | modo derivado al leer | servidor → página |
| `ordenex_debe` | `lib/types/estado-cuenta.ts:150`, `EstadoCuentaService.ts:653-654` | sentido derivado al leer | servidor → página |
| `concepto_ordenex` | `lib/utils/aporte-por-orden.ts:35`, `DetalleEnLoteService.ts:290` | discriminante interno de una constante | no |
| `gasto_ordenex`, `tienda_paga_a_ordenex` | `lib/types/efecto-movimiento.ts:19,29`, `lib/utils/efecto-movimiento.ts:30,45,108` | **entrada** zod de la previsualización («no escribe nada») | página → servidor |
| `"ordenex"` | `lib/repositories/libro-caja-a-quien-sql.ts:114,124` | valor interno de una tabla de código | no |
| clave `"ordenex"` | `analitica-productos-descarga-columnas.ts:154`, ámbito `analitica-productos-dinero` | clave de columna | **guardada en `localStorage`** (§5.3) |

Sobre la ficha: «`ganancia_ordenex` rompe la API de métricas» **no se sostiene**. El único canal con API key es
`GET /api/ordenes/api-key/analitica`, que publica la lista cerrada de `lib/analytics/publicacion-api-key.ts:56`, sin
ninguna métrica financiera (R17 de la 267). `lib/api/openapi-spec.ts` solo contiene la marca en dos comentarios (`:901`,
`:957`) y `lib/types/api-orden.ts:101` en otro. Coincide con los 0 consumidores de la ficha, y además no hace falta
entrada de ruptura en el `CHANGELOG.md`. R6 lo deja atado con un test.

**Pestaña vieja abierta durante el despliegue.** Si envía `gasto_ordenex` a la previsualización, recibe error de validación
(R7) hasta recargar. `AvisoVersionNueva` no cuenta como mitigación: `useActualizacionPwa` no llama a `reg.update()`, así
que una pestaña que no recarga puede no ver el aviso. No se acepta el alias en el servidor: la previsualización no
escribe, así que el peor caso es un «Así queda» que no carga hasta recargar. Se acepta.

**Servidor nuevo con pestaña vieja (tandas 2, 3 y 4). Decisión del leader, PENDIENTE DE CONFIRMAR POR EL HUMANO ANTES DE LA
RELEASE.** Sin alias y sin código.

- **Navegación RSC:** el build distinto hace carga completa, así que la respuesta nueva no llega a la pestaña vieja.
- **Respuesta de Server Action:** llega si el id de la action sigue valiendo.
- **Daño en cierres y caja (tandas 2 y 3):** frase falsa de saldo debajo de la cifra correcta, o panel que no abre, hasta recargar. No se escribe nada.
- **Daño en productos (tanda 4), cerrado con otro nombre de action:** recargar no lo arreglaba. Las filas pedidas después del despliegue llegaban con `liquidado.empresa`, y su archivo se guardaba con «Cobró Velox» vacía, sin error, que además se lee como «nada liquidado». Un archivo ya bajado no se corrige recargando. Lo ya cargado antes del despliegue seguía en memoria con su forma, y se descargaba bien.
  `consultarConteoProductosV2` y `consultarDetalleDineroProductoV2` cortan ese caso: **medido en `next build --webpack`, con la misma caché y la misma sal, los dos ids viejos desaparecen y los otros 332 de 334 no cambian.** **Producción construye con Turbopack** (`next build`, sin `--webpack`) y allí no se pudo medir: en un worktree cae por el junction de `node_modules`. Que el id dependa del nombre también con Turbopack es supuesto, comprobable en un checkout sin junction. La pestaña vieja recibe `UnrecognizedActionError` (leído en Next, sin ejecutar) y la tabla pinta su mensaje de error (`ProductosTabla.test.tsx`). Sin alias y sin excepción de guardia. Si la forma del DTO vuelve a cambiar, el sufijo sube.
- **Antes de la release:** comparar los ids de dos despliegues de preview **no predice** la release: la sal es la clave de cifrado, guardada en `.rscinfo` dentro de la caché de build, caduca a los 14 días y depende de que esa caché se restaure. Por eso se mide lo que no caduca:
  1. **Skew Protection en el proyecto de Vercel:** es lo único que da una respuesta firme. Activa, la pestaña vieja sigue hablando con su despliegue y el cruce no se da mientras dure su ventana.
  2. **`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` en el entorno de producción:** si está fijada, los ids sobreviven siempre.
  3. **Sin ninguna de las dos:** no se sabe si los ids sobreviven a ese despliegue, y se actúa como si sí. Se despliega fuera de la operación y se avisa de que recarguen.

  Es parte de T7.4, para que entre en `docs/release.md` con R32.

### 3.3 Caché de analítica

De los 12 archivos que usan `envolver`, el único DTO con un campo renombrado es `ConteoProductosDTO`
(`ConteoProductosService.ts:152`, ventana de 15 min según su comentario; `.liquidado.ordenex`). Una entrada vieja
leída por el código nuevo daría `liquidado.empresa === undefined`: las cifras se pintarían vacías y sin error. No está medido si la
Data Cache de Vercel sobrevive al despliegue, y no hace falta medirlo: `claveDeConteoProductos` cambia de prefijo y la
entrada vieja nunca se lee (R9). T5.2 revisa en la tanda que los otros 11 no llevan campos renombrados.
`AnaliticaFinancieraService` no usa `envolver`.

### 3.4 Comentarios (P4)

El script cambia «Ordenex» por «la empresa», y «de Ordenex» o «a Ordenex» por «de la empresa» o «a la empresa»; al inicio
de frase, «La empresa». Las rutas nombradas ya cambiaron en su familia. Los comentarios que describen historia («la fase
del monograma de Ordenex») no se reescriben a mano: basta con que no digan la palabra.

### 3.5 Tests

Sigue valiendo lo aprendido en la 493 (`specs/493-marca-velox-textos/design.md §5`):

- **Importes y textos, literales.** El renombrado no toca ninguna cifra; un diff que cambie un importe en un test es un
  fallo, y T3.4 lo comprueba por `git diff` contra una expresión de números.
- **Las negativas se migran a la vez.** `MARCA_RETIRADA` sigue en `tests/fixtures/marca-retirada-nombre-493.ts`; los ids
  viejos se afirman ausentes desde un fixture, no con el literal repartido por los tests.
- **Datos de prueba de dominio** (`ordenex.co`, `ordenex.app`, `@ordenex.test`, 160 en 67 archivos): `ejemplo.test`, o
  `ejemplo.co` donde el test dependa de un TLD real (`linkificar`, `email-config`). No afirman contrato.
- `tests/fixtures/sin-comentarios.ts` no contiene la marca (medido) y **no se toca**: tocarlo exige el gate completo.

## 4. Filas de producción: SQL de solo lectura, **A MEDIR POR EL LEADER**

Ningún agente de esta ficha tiene acceso a prod. Se corre por el MCP `supabase` tras confirmar con `get_project_url` que es
producción; ninguna consulta escribe. Resultado en `progress/impl_494.md` antes de la tanda 5 (T6.0).

Columnas comprobadas en `db/schema.prisma` (`@map`/`@@map`). `whatsapp_envio.activo` es la columna que en TS se llama
`encendido`.

### Q1 — ¿Hay marca en el catálogo?

Esperado: 0 filas. Con una sola, parar: la premisa de R13 es falsa.

```sql
SELECT 'enum' AS objeto, t.typname || '.' || e.enumlabel AS nombre
  FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
 WHERE e.enumlabel ILIKE '%ordenex%'
UNION ALL
SELECT 'constraint', conrelid::regclass::text || '.' || conname
  FROM pg_constraint
 WHERE connamespace = 'public'::regnamespace AND pg_get_constraintdef(oid) ILIKE '%ordenex%'
UNION ALL
SELECT 'funcion', p.proname
  FROM pg_proc p
 WHERE p.pronamespace = 'public'::regnamespace AND p.prosrc ILIKE '%ordenex%'
UNION ALL
SELECT 'vista', viewname
  FROM pg_views
 WHERE schemaname = 'public' AND definition ILIKE '%ordenex%'
UNION ALL
SELECT 'columna', table_name || '.' || column_name
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND (column_name ILIKE '%ordenex%' OR column_default ILIKE '%ordenex%')
UNION ALL
SELECT 'tabla', table_name
  FROM information_schema.tables
 WHERE table_schema = 'public' AND table_name ILIKE '%ordenex%';
```

### Q2 — ¿En qué columnas y cuántas filas? (censo completo, incluye los seis valores)

Una pasada por tabla y, solo en las que tienen coincidencia, una por columna. Busca también dentro de JSONB y arrays
(`::text`). `filas_con_valor` cuenta los seis valores de la ficha como palabra entera. Excluye `_prisma_migrations`.

```sql
WITH tablas AS (
  SELECT table_name
    FROM information_schema.tables
   WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'
), con_marca AS MATERIALIZED (
  SELECT table_name
    FROM tablas,
         LATERAL query_to_xml(
           format($q$SELECT count(*) FILTER (WHERE t::text ILIKE '%%ordenex%%') AS n FROM public.%I t$q$, table_name),
           false, true, '') AS x
   WHERE (xpath('/row/n/text()', x))[1]::text::bigint > 0
), columnas AS (
  SELECT c.table_name, c.column_name, c.data_type
    FROM information_schema.columns c
    JOIN con_marca USING (table_name)
   WHERE c.table_schema = 'public'
     AND c.data_type IN ('text', 'character varying', 'json', 'jsonb', 'ARRAY', 'USER-DEFINED')
), medida AS (
  SELECT table_name, column_name, data_type,
         query_to_xml(
           format(
             $q$SELECT count(*) FILTER (WHERE %1$I::text ILIKE '%%ordenex%%') AS marca,
                       count(*) FILTER (WHERE %1$I::text ~ $r$\m(ganancia_ordenex|solo_ordenex|concepto_ordenex|gasto_ordenex|tienda_paga_a_ordenex|ordenex_debe)\M$r$) AS valor
                  FROM public.%2$I$q$,
             column_name, table_name),
           false, true, '') AS x
    FROM columnas
)
SELECT table_name, column_name, data_type,
       (xpath('/row/marca/text()', x))[1]::text::bigint AS filas_con_marca,
       (xpath('/row/valor/text()', x))[1]::text::bigint AS filas_con_valor
  FROM medida
 WHERE (xpath('/row/marca/text()', x))[1]::text::bigint > 0
 ORDER BY filas_con_valor DESC, table_name, column_name;
```

### Q3 — Plantillas con la marca, también las borradas (`prueba_envios_ordenex` puede existir: `progress/current.md:95`)

```sql
SELECT nombre, estado, template_id, template_idioma, informe_clave, lleva_documento,
       welcome_message, deleted_at, cuerpo ILIKE '%ordenex%' AS cuerpo_con_marca
  FROM plantilla_mensaje
 WHERE nombre ILIKE '%ordenex%' OR cuerpo ILIKE '%ordenex%'
 ORDER BY nombre;
```

### Q4 — Qué depende de esas plantillas

```sql
SELECT p.nombre AS plantilla, e.id AS envio_id, e.nombre AS envio, e.activo, e.deleted_at
  FROM whatsapp_envio e
  JOIN plantilla_mensaje p ON p.id = e.plantilla_id
 WHERE p.nombre ILIKE '%ordenex%'
 ORDER BY p.nombre, e.nombre;

SELECT plantilla_nombre, estado, count(*) AS ejecuciones, max(created_at) AS ultima
  FROM whatsapp_envio_ejecucion
 WHERE plantilla_nombre ILIKE '%ordenex%'
 GROUP BY plantilla_nombre, estado
 ORDER BY plantilla_nombre, estado;
```

### Q5 — Cuentas (dominio de correo y nombre; por separado, ver §6)

```sql
SELECT split_part(lower(email), '@', 2) AS dominio, estado, count(*) AS cuentas
  FROM usuario
 WHERE email ILIKE '%ordenex%' OR nombre ILIKE '%ordenex%'
 GROUP BY 1, 2
 ORDER BY 1, 2;

SELECT email, nombre, estado
  FROM usuario
 WHERE email ILIKE '%ordenex%' OR nombre ILIKE '%ordenex%'
 ORDER BY email;
```

### Qué se hace según el número

| Resultado de Q2 | Decisión |
| --- | --- |
| `filas_con_valor` = 0 en todas (esperado por el código) | **Sin migración.** T6.0 se cierra anotando el número; R10 no aplica |
| > 0 en `vista_filtro.filtro` | Migración (R10). Por `lib/types/vista-filtro.ts` una fila que no parsea queda ILEGIBLE: romperla sería un fallo mudo para esa persona |
| > 0 en `whatsapp_envio.parametros` | Migración (R10) |
| > 0 en `jobs.payload` con `estado` no terminado | Migración (R10). Terminados: se dejan |
| > 0 en `historial_accion`, `whatsapp_envio_ejecucion`, `chat_mensaje`, libros de dinero | **No se tocan** (R11): son evidencia congelada |
| > 0 en otra columna | Se para y se pregunta |
| `filas_con_marca` > 0 sin `filas_con_valor` (p. ej. la palabra en un texto o un nombre) | No se toca: es dato (P5 de la 493) |

Una migración, si hace falta: escribe el respaldo en el esquema `respaldo`, como la 499; `UPDATE` acotado por tabla y
columna; `down.sql` que restaura del respaldo; timestamp posterior al último de `dev`; declarada en `posteriores` (R12).
Antes de desplegarla, se mide su `SELECT` en prod (memoria «Medir el backfill antes de desplegar»).

## 5. Navegador

### 5.1 Inventario

| Viejo | Dónde | Lo guarda | Nuevo | Tratamiento |
| --- | --- | --- | --- | --- |
| `ordenex_tema` | `lib/tema/tema.ts:44`; leído en `app/(app)/layout.tsx:45` y `lib/tema/preferencia-tema.ts:46` | cookie, 1 año | `app_tema` | §5.4 |
| `ordenex:sonido-notificaciones` | `lib/audio/preferencia-sonido.ts:13` | `localStorage` | `app:sonido-notificaciones` | §5.2 |
| `ordenex:app-navegacion` | `lib/utils/preferencia-navegacion.ts:13` | `localStorage` | `app:app-navegacion` | §5.2 |
| `ordenex:manifiesto-columnas:<flujo>` | `lib/manifiesto/preferencia-columnas.ts:19` | `localStorage` | `app:manifiesto-columnas:<flujo>` | §5.2 |
| `ordenex:descarga-columnas:<ámbito>` | `lib/columnas/preferencia-columnas.ts:70` | `localStorage` | `app:descarga-columnas:<ámbito>` | §5.2 y §5.3 |
| `ordenex:sinpe-revision-aplazada:<zonaId>` | `components/shared/RevisionSinpeBodega.tsx:65` | `sessionStorage` | `app:sinpe-revision-aplazada:<zonaId>` | §5.2 |
| `ordenex:sonido-notificaciones-cambio`, `ordenex:columnas-cambio` | `hooks/usePreferenciaSonido.ts:21`, `hooks/usePreferenciaColumnas.ts:50` | evento de la propia ventana | `app:…` | se renombran sin más: no persisten |
| `ordenex:relevo-ahora`, `ordenex:pagina-lista`, `ordenex:push-recibido` | `public/sw.js:100-103`, `lib/pwa/actualizacion.ts:21,28,43` | protocolo página ↔ SW | `app:…` | §5.5 |
| `"ordenex:" + carga.evento` | `public/sw.js:160` | tag de notificación | `"app:" + evento` | §5.5 |

Hoy los dos comentarios de `lib/manifiesto/preferencia-columnas.ts:9-12` y `lib/columnas/preferencia-columnas.ts:66-68`
prohíben mover el prefijo porque «huerfanaría» lo guardado. Es correcto: por eso la migración lee la vieja. Esos comentarios
se reescriben con ella.

Dato para calibrar: el origen cambió a `velox-courier.company` el 2026-10-30 (memoria), así que lo guardado hoy es de
los últimos días. No cambia el diseño: sigue siendo un fallo mudo para quien ya eligió.

### 5.2 Módulo único

`lib/navegador/claves-legadas.ts`, puro:

```ts
export function leerConMigracion(
  almacen: Storage,
  nueva: string,
  vieja: string,
  traducir?: (crudo: string) => string,
): string | null;
```

- Hay nueva: se devuelve, y si queda vieja se borra (R15).
- Solo hay vieja: se traduce si procede, se copia a la nueva, se borra la vieja y se devuelve (R14).
- `getItem`, `setItem` o `removeItem` lanzan: nunca se propaga (R19). Si solo falla la escritura, se devuelve el valor viejo
  para no perder la preferencia en esa carga.
- Idempotente, porque `leerCrudo` es el *snapshot* de `useSyncExternalStore`: tras la primera lectura devuelve siempre el mismo
  string, sin array nuevo ni cambio de identidad.
- Aquí viven **todas** las claves viejas, para que la guardia (R20) las localice y para que retirarlas sea borrar un archivo.

### 5.3 Claves de columna dentro del valor guardado

`clavesUtiles` (`lib/columnas/preferencia-columnas.ts:114`) descarta sin avisar las claves no publicadas. Si la columna
`"ordenex"` pasa a `"empresa"` y nadie traduce, quien la tenía oculta la vuelve a ver en su archivo, sin error. Por eso, al migrar
el ámbito `analitica-productos-dinero`, `traducir` reemplaza `"ordenex"` por `"empresa"` en `ocultas` y en `orden` (R16). JSON
inválido: se copia tal cual y el saneo existente lo trata como hoy.

`traducir` corre **también sobre lo ya guardado bajo `app:`** en ese ámbito, sin condición, no solo al leer la clave vieja. La tanda 1
traslada el valor a `app:` con la columna aún sin traducir, porque hasta T5.1 el catálogo publica el nombre viejo. Traducir solo la
vieja dejaría ese valor sin pasar por `traducir`, y la columna oculta reaparecería al renombrar el catálogo (medido en
`progress/review_494_t1.md`). Es idempotente: una vez traducido no queda nada que cambiar, no se escribe y el snapshot no varía.

### 5.4 Cookie de tema

- Servidor (`app/(app)/layout.tsx:45`): nueva, si no vieja, ya normalizada. Evita el parpadeo: el servidor no puede
  escribir cookies en un RSC, pero sí leer las dos.
- Cliente: al montar, si solo hay vieja, escribe la nueva con el mismo `max-age`, y la vieja con `max-age=0` (R17). El punto
  de montaje es el `TemaProvider`; T2.3 confirma en el archivo.

### 5.5 Service worker: la trampa

`hooks/useActualizacionPwa.ts:194` manda el mensaje de relevo al SW **en espera**. El día del despliegue el orden es:
página **vieja** abierta, SW **nuevo** en espera. Con solo el nombre nuevo, el nuevo SW ignoraría el botón «actualizar» y
se quedaría en `waiting`: la app parecería no actualizarse nunca, sin ningún error. Es el fallo que `sw.js:15-21` describe.

| Quién envía | A quién | Qué pasa | Decisión |
| --- | --- | --- | --- |
| Página vieja | SW nuevo (relevo) | Mensaje viejo | **El SW acepta los dos nombres** (R21) |
| Página nueva | SW viejo que controla (página lista) | Lo ignora: la purga se aplaza hasta el relevo | Se acepta |
| SW viejo | Página nueva (push) | Mensaje viejo | **La página acepta los dos nombres** (R22) |
| SW nuevo | Pestaña vieja (push, con otra pestaña que ya relevó) | No entiende el mensaje nuevo: suena un tono de más hasta recargar. Ningún aviso se pierde: la notificación del sistema sale igual y el sondeo de 60 s pone la campana al día | Se acepta. Mandar los dos nombres haría revalidar dos veces a toda página nueva |
| Tag | — | Una notificación con el tag viejo no se fusiona con una del nuevo durante el cambio | Se acepta: es una vez |

`pwa-relevo-y-purga.guardia` y `pwa-push.guardia` ya comprueban la paridad de literales entre `sw.js` y
`lib/pwa/actualizacion.ts`; se amplían a los alias.

### 5.6 Retirada del legado

No es de esta ficha. Al cerrarla, el leader registra una ficha para borrar `claves-legadas.ts` y los alias, no antes de 90
días en prod: una PWA instalada puede tardar en relevar su SW, y la cookie dura 1 año. Mientras, son excepción E5.

## 6. Dominios y cuentas

### Dominios

| Dónde | Qué es | Tratamiento |
| --- | --- | --- |
| `next.config.*`, `vercel.json`, `proxy.ts`, `middleware.ts` | **0 apariciones.** Sin configuración viva en el repo | No se tocan (R28) |
| `app/globals.css:156,174`, `app/page.tsx:12`, `app/_landing/primitivas.tsx:7`, `LandingNav.tsx:11`, `lib/utils/linkificar.ts:24,27` | comentarios | Tanda 7 |
| `scripts/seed-maestro.ts:13,40`, `.env.example:172` | ejemplos; el de `.env.example` además está desfasado (el contacto VAPID ya es otro, R20 de la 493) | Tanda 6: `admin@ejemplo.test`, y se corrige el comentario |
| Enlaces reales que genera la app | salen de `NEXT_PUBLIC_APP_URL`/`NEXT_PUBLIC_SITE_URL`, ya en `velox-courier.company` (memoria, 2026-10-30) | Nada |
| Tests | dato de prueba (160 en 67) | Tanda 7, §3.5 |
| `docs/release.md:711,713` | **instrucción vigente desfasada**: B2 manda mirar el proyecto `ordenex`, B4 el alias `ordenex.co`. Hoy son `velox` y `velox-courier.company` (memoria). Con esto, la verificación de una release mediría el proyecto equivocado | Tanda 6 (R32). El resto del archivo es registro fechado |

**Fuera del repo, y no se toca** (memoria, sin re-medir): `ordenex.co` y `www.ordenex.co` quitados del proyecto el
2026-10-30; `ordenex.vercel.app` con 307 a `velox-courier.vercel.app`; la app vieja `ordenex-app` (otro repo) fuerza su host a
`ordenex.co` desde cualquier hostname. Por la experiencia del 2026-09-04, nada de esto se mueve sin comprobar antes con
`curl -sI` qué URL deja a la otra parte. Ver P5. Como esta ficha no cambia ningún dominio, no deja ningún host sin alcanzar.

### Cuentas QA `@ordenex.test` (P3)

`scripts/seed-usuarios-qa.ts:40-68` define 4 cuentas `*.qa@ordenex.test`; TLD reservado, sin correo real. La siembra es idempotente
**por email** y `cedula` es `@unique`: cambiar solo el literal haría fallar la siguiente corrida contra una base ya sembrada. Por
eso, antes del upsert, si existe la vieja y no la nueva, se actualiza `email` (R29). Deja el correo viejo como excepción E6. Se
corre en local y preview. **En prod no se corre** (memoria «Correr seeds contra producción»); si Q5 las muestra allí, se informa al
humano y no se toca.

### Correos reales

Los `@ordenex.co` que Q5 muestre son credencial de acceso de una persona y **no se tocan** (R30, P5 de la 493). Hay
constancia de que `mensajero@ordenex.co` no existe como buzón (`docs/release.md:221`). Cambiarlos, si se quiere, es decisión del
humano por cuenta. `Maestro Ordenex` (`scripts/seed-maestro.ts:61`) pasa a `Maestro` como valor por defecto del script; las filas
ya creadas siguen igual.

## 7. La guardia

`tests/unit/guards/marca-sin-ordenex-494.guardia.test.ts`, con su detector en `tests/fixtures/marca-sin-ordenex-494.ts` (para que
el censo y el veredicto salgan del mismo código). Búsqueda de texto plano `/ordenex/i` en contenido y en rutas: a diferencia de
la 493, no necesita AST porque ya no hay identificadores admitidos. Lee con `fs`, así que `--rapido` no la relaciona: se corre a mano en
cada tanda (memoria «Guardia estructural escapa al --rapido»). Normaliza CRLF.

**Bloques:** detector (contrapruebas), árbol con trinquete, excepciones (R3), legado (R20), migraciones (R11, R30), plantillas (R24, R26),
hosts (R28), proyecto (R31, R32).

**Trinquete:** `tests/fixtures/marca-pendientes-494.ts`, lista por archivo con su número de apariciones. Solo puede bajar: un archivo con
más apariciones que su cifra, o uno nuevo, pone rojo. La tanda 7 borra el archivo y deja un `it` llano. Precedente: `marca-pendientes-493`.

### Excepciones (lista cerrada)

Cada una con un patrón de ruta y, si cabe, de línea. Si deja de coincidir, rojo (R3).

| Id | Dónde | Por qué se queda |
| --- | --- | --- |
| E1 | `db/migrations/**` (fuera del árbol) | Fotos históricas: editarlas es drift (memoria «Migración editada en sitio») |
| E2 | `specs/`, `progress/`, `feature_list.json`, `docs/api/CHANGELOG.md`, `docs/release.md` salvo B2/B4, `docs/marca/velox/README.md` (fuera del árbol) | Registros históricos |
| E3 | `CLAUDE.md`, `.claude/agents/*.md`: `R-job-singularis-projects-ordenex`, `R-ark-studio-projects-ricardo-ordenex` y la línea que advierte de `ordenex` (fuera del árbol) | Nombre del proyecto en el MCP, derivado de la carpeta local. Cambia solo si cambia la carpeta |
| E4 | `scripts/drenar-jobs.ts`, `scripts/rollup-analitica-manual.ts`, `scripts/contraste-454.ts` y `tests/unit/services/analitica-rollup-handler.test.ts` (T7.1: `tests/unit/scripts/*` solo llevaba datos inventados, y ya no lleva la marca): `localhost:5432/ordenex`, `ordenex_<sufijo>` | Es el nombre real de la base local; esos scripts abortan si no coincide, y es lo que evita que escriban en prod. Renombrar la base es tocar el entorno de cada máquina |
| E5 | `lib/navegador/claves-legadas.ts`, los alias de `public/sw.js`, `tests/unit/navegador/*`, `tests/unit/tema/cookie-legada-494.test.ts` y los tests de R16, R18, R21 y R22 | La clave vieja hay que poder leerla. Se retira con §5.6 |
| E6 | `scripts/seed-usuarios-qa.ts` y `tests/integration/db/seed-usuarios-qa-494.test.ts`, por línea: los 4 correos viejos y la cuenta ajena del test de R30 | Hace falta para pasar la cuenta al correo nuevo (R29) |
| E7 | `tests/unit/guards/marca-sin-ordenex-494.guardia.test.ts`, `tests/fixtures/marca-sin-ordenex-494.ts`, `tests/fixtures/marca-retirada-nombre-493.ts`, `tests/fixtures/marca-retirada-493.ts`, `tests/unit/guards/marca-fuente-unica-493.guardia.test.ts` | Definen lo prohibido y sus contrapruebas |
| E8 | `tests/unit/analytics/cache-clave-conteo-productos-494.test.ts`, `tests/unit/api/contrato-sin-cambios-494.test.ts`, el fixture de ids retirados | Negativas: afirman que lo viejo no está |

La traducción `"ordenex"` → `"empresa"` de §5.3 vive también en `lib/navegador/claves-legadas.ts`: no necesita excepción aparte.

Fuera del árbol por motivo propio: `.design-work/**` y `design-*/` (borradores de diseño, no se ejecutan).

### La guardia de la 493

`marca-fuente-unica-493` sigue viva porque vigila los textos, pero sus excepciones R11 (`EXCEPCIONES_R11`, `quitarIdentificadores`,
`POSTMAN`) quedan sin objeto y su bloque R16 admite datos que dejan de existir. La tanda 7 las retira y actualiza sus contrapruebas
(`const k = "ordenex:…"`, `ingresoOrdenex` como casos sanos), porque si no seguirían dejando pasar lo que esta ficha prohíbe. R11 y
R12 de la 493 («conservar el identificador») quedan sustituidos por esta ficha.

## 8. Plantillas de WhatsApp

Medido: 0 apariciones de `alerta_transito_ordenex`, `picking_bodega_ordenex` en `lib/`, `app/`, `docs/` no históricos, y en `tests/` y `scripts/`. El envío
usa `plantilla_mensaje.nombre` + idioma (`schema.prisma:264-266`), y `whatsapp_envio` enlaza por `plantilla_id` (FK), así que el cambio de
nombre **no toca código ni configuración de envíos**. `whatsapp_envio_ejecucion.plantilla_nombre` es la foto de cuando se fijó: se queda.

**No cambiar el nombre por la pantalla.** `PlantillaMensajeService` (`:293-295`), al editar una plantilla ya en Meta, llama a `trasActualizar` y la deja
`pending`: fuera de `listarEnviables`, hasta el cron de 24 h. Por pantalla se dejaría de enviar en silencio.

**Procedimiento, tras el merge y sin bloquearlo** (lo ejecuta un humano con el token de la cuenta de José; T9):

1. Medir Q3 y Q4. `cuerpo`, variables y cabecera DOCUMENT se copian de la plantilla actual; payload como el que arma
   `lib/clients/whatsapp-cloud.ts`.
2. Crear en Meta `alerta_transito` y `picking_bodega` (WABA `2115650402656273`, según `progress/traspaso_meta_whatsapp.md`; confirmar). Mientras
   tanto el sync las ignora: no tienen fila local (`SincronizarPlantillasWhatsappService.ts:72`, R27), y todo sigue enviando con las viejas (R26).
3. Esperar `APPROVED` por `GET /{waba}/message_templates`. Plazo desconocido: depende de Meta, y la verificación del negocio estaba pendiente
   el 2026-11-01.
4. En prod, en la misma sentencia, para que nunca haya una fila con nombre nuevo y enlace viejo:
   ```sql
   -- NO SE CORRE HASTA EL PASO 4. Escribe en producción: requiere autorización del humano.
   UPDATE plantilla_mensaje
      SET nombre = 'alerta_transito', template_id = '<id de Meta>', updated_at = now()
    WHERE nombre = 'alerta_transito_ordenex' AND deleted_at IS NULL;
   UPDATE plantilla_mensaje
      SET nombre = 'picking_bodega', template_id = '<id de Meta>', updated_at = now()
    WHERE nombre = 'picking_bodega_ordenex' AND deleted_at IS NULL;
   ```
   Si el sync de 24 h corre antes, solo refresca estado y enlace por nombre. Reversión: el mismo `UPDATE` a la inversa; por eso las viejas siguen en Meta.
5. Probar un envío real de cada informe («Probar ahora») y medir `whatsapp_envio_entrega`; un POST 200 de Meta no prueba entrega.
6. Borrar las viejas en Meta **solo** cuando Q4 no muestre ejecuciones en curso con su nombre.

El `UPDATE` directo no deja rastro en `historial_accion`: se anota en `progress/` con la hora. Si preview tiene filas con la marca, se decide al
medirlas con `supabase-preview`; no está medido.

## 9. Configuración del proyecto

| Archivo | Cambio |
| --- | --- |
| `package.json:2` | `"name": "velox"` (como el repo y el proyecto de Vercel, según memoria). T7.6 comprueba que nada lee ese nombre |
| `docs/api/ordenex-api-key.postman_collection.json` | Se renombra a `api-key.postman_collection.json` y su `name` a `Velox Courier — API key`. `tests/unit/api/openapi-320-eliminar.test.ts:248` y `openapi-266-habilitar.test.ts:165` leen la ruta. Una línea en `CHANGELOG.md`, sin ruptura |
| `.env.example:172`, `DESIGN.md`, `.claude/commands/test_jobs.md` | Se limpian |
| `CLAUDE.md`, `.claude/agents/*` | Solo el título de `CLAUDE.md`; el resto es E3. **`.claude/agents/*` y `CLAUDE.md` no los edita un subagente sin indicación del leader** |
| `.mcp.json` | 0 apariciones: nada |
| `db/schema.prisma` | 46 comentarios; verifica `prisma migrate diff` sin diferencias (R13). Toca datos según el gate: `--rapido` se amplía solo con `tests/integration/db` |

**Gate y `package.json`.** `--rapido` puede negarse al ver config de build o tests y pedir el completo, que un subagente no corre. El nombre del
paquete va en commit y tanda propios; si el gate se niega, se para y lo decide el leader.

## 10. Tandas y orden

Cada tanda es un PR contra `dev`: se revisa sola, y pasa `--rapido` y la guardia a mano. Toca `lib/types/` o nombres de dinero, así que se amplía con
`tests/integration/db` (mirar los `skipped`, memoria «Gate sin `.env`»).

| Tanda | Contenido | Archivos aprox. | Riesgo | Por qué en ese lugar |
| --- | --- | --- | --- | --- |
| 0 | Guardia con trinquete, script, fixture | 4 | ninguno | Red antes de mover nada |
| 1 | Navegador y SW | ≈25 | **el mayor en conducta**, poco diff | Pocos archivos y aislados; se puede revisar con calma |
| 2 | Familia cierres + `ingreso-empresa.ts` | ≈60 + tests | bajo | Mayor radio de imports: cuanto antes, menos ramas lo pisan |
| 3 | Familia caja | ≈30 + tests | bajo | |
| 4 | Familia analítica + caché | ≈20 + tests | medio (caché y columna) | Depende de la tanda 1 (`traducir`) |
| 5 | Filas, condicional a §4 | 0 o 2-3 | según número | Con los valores ya nuevos |
| 6 | Configuración, scripts, docs, schema | ≈15 | bajo | |
| 7 | Comentarios, datos de prueba, cierre de guardia | ≈450 | ninguno en conducta | **Última**: es la que toca más archivos y solo se puede regenerar |
| 8 (T9) | Plantillas en Meta | 0 | humano | Tras el merge, no bloquea |

**Cómo se minimizan las colisiones con otras ramas:**

1. **Mergear antes 501 y 502** y empezar la 494 con el mínimo de ramas abiertas (`progress/current.md`: `in_progress` = 0 el 2026-11-03; el
   humano pidió terminar las tres y luego una sola release, sin fijar el orden entre ellas). Son pequeñas: esperarlas cuesta menos que rebasarlas
   contra un renombrado masivo. No se midió qué archivos tocan, porque sus specs no existían al escribir esto; T0.3 lo comprueba.
2. **Tandas 2-4 y 7 en días seguidos**, sin intercalar fichas grandes de cierres o wallet. Abrir la siguiente desde el `dev` recién mergeado.
3. **Las familias son disjuntas por símbolo**, pero no siempre por archivo: si dos tocan el mismo, gana la que llega primero y la siguiente se
   regenera.
4. **Conflicto en tanda de script: no se resuelve a mano.** Se descarta, se rebasa y se reejecuta el script. A mano es donde se cuela un cambio de
   importe.
5. **Una rama ajena abierta** ejecuta el script sobre sí misma tras mergear `dev`, en vez de resolver cientos de conflictos.
6. **Worktree aislado** por tanda (memoria: «Agente sin worktree cambia la rama»), y nada de `feature_list.json` con agentes dentro. La base local es
   compartida: si la tanda 5 trae migración, avisa a las demás ramas (memoria «Base local compartida»).
7. **Release a `prod` al terminar la 7**, con gate completo: lo decide el leader (ya previsto con 498, 500, 501 y 502).

## 11. Alternativas descartadas

1. **Sustituir por `velox`** (`ingresoVelox`, `velox:sonido-notificaciones`). Es la lectura más literal de la ficha, pero repite el coste en el siguiente
   cambio de marca: 558 archivos y otra migración de claves del navegador. Además choca con la guardia de la 492, que prohíbe `/velox/i` en la
   OpenAPI, y mete el nombre de la marca en un sitio que la 493 sacó a `MARCA`. Queda como P1 porque el humano puede preferirlo.
2. **Un PR único de 558 archivos.** Es el más simple de escribir, pero no se puede revisar: un cambio de importe entre 2.277 líneas no se ve, y bloquea todas
   las ramas mientras dure.
3. **Dejar las claves del navegador y el protocolo del SW como están** (como hizo la 493). Es el diff más seguro y nadie las ve, pero la ficha las pide, y
   dejaría una excepción permanente que un `grep` no distinguiría de una regresión. Con módulo único, la excepción tiene fecha de retirada.
4. **Cambiar el nombre del mensaje del SW sin alias.** Es menos código, pero rompe el relevo el día del despliegue, sin error (§5.5).
5. **Codemod por AST (`ts-morph`).** Es más preciso con los símbolos, pero no alcanza cadenas, comentarios, SQL, `.md` ni `sw.js`, que son la mayoría. `tsc`
   más la guardia ya atrapan lo que se escape de una tabla por palabra.
6. **Migración de datos preventiva sin medir.** Tocaría filas que probablemente no existen, con riesgo sobre un JSONB ajeno, y exigiría declaración y
   `down` para nada. Decide el número (§4).
7. **Cambiar el nombre de la plantilla por la pantalla.** Deja la plantilla `pending` y deja de enviar (§8).
8. **Aceptar el concepto viejo en el servidor durante un tiempo.** Protege a una pestaña abierta unos minutos en una lectura sin escritura; no se paga una
   excepción más por eso (§3.2).

## 12. Riesgos

- **Fallo mudo en preferencias o caché:** cubierto por R9, R14 y R16; conviene ver la app con preferencia y cookie viejas sembradas (T8.3). Los tests no ven lo que el usuario ve (memoria «Ver la app encuentra lo que la suite no»).
- **Service worker:** el fallo solo se ve en un dispositivo con PWA instalada y versión anterior. La guardia cubre el código; el relevo real se comprueba en preview (T8.3).
- **El índice del grafo** queda rancio tras la tanda 2: conviene reindexar `R-job-singularis-projects-ordenex`.
- **`.env` QA y memoria:** la receta de acceso con cuentas QA cambia con P3.
- **servi_logistic:** es una copia de este repo (memoria). Portar esta ficha allí se decide al cerrarla.
