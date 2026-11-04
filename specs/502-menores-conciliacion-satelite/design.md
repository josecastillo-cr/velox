# Ficha 502 — Diseño

> Búsqueda: `codebase-memory` no conectó en esta sesión (timeout). Se usó Grep/Read, y cada línea citada se
> leyó en el archivo real sobre `dev` en `519740e5`. Nada de este documento se ejecutó: los efectos en dinero
> de §3.1 están calculados leyendo el código y `T3` los mide.

## 0. Modelo de datos, rutas y contratos

Sin migración, sin tablas, sin RLS, sin rutas nuevas y sin cambios de contrato. El único código de producción
que cambia es de `components/`, `app/(app)/cierres-admin/_components/cierre-labels.ts` (solo con la salida A)
y `docs/ayuda/`.

## 1. m4: la nota sale del diálogo de Desmarcar

### Qué fija hoy el texto

**R23 de la 500 no congela el texto.** Solo prohíbe marcarlo como provisional
(`textos-satelite-definitivos-500.guardia.test.ts`), y esa guardia sigue verde. El literal viene de 498/R43,
y su ubicación dentro del diálogo la fijan dos tests:

| Test | Qué afirma | Qué se hace |
| --- | --- | --- |
| `tests/components/Conciliacion498.test.tsx:278-285` | `getByText(NOTA_R43)` dentro del diálogo | Se invierte |
| `tests/integration/wallet-satelites.test.tsx:553` | el diálogo contiene «Marcar recibido asienta el dinero en la caja.» | Se invierte, con la marca `[S]` que ya usa :552 |
| `Conciliacion498.test.tsx:404-407` | la nota del pie, literal | Sin cambios |
| `wallet-satelites.test.tsx:455-464` | la nota del pie, literal | Sin cambios |
| `aporte-satelite-fuente-unica-498.guardia.test.ts:156-165` | el valor de la constante y la ayuda | Sin cambios |
| `ayuda-wallet-satelites-498.test.ts:29` | la ayuda cita la nota | Sin cambios |

### Cómo se reescribe el test

El literal escrito a mano `NOTA_R43` de `Conciliacion498.test.tsx:47` se queda, y el test NO importa
`NOTA_CONCILIACION_ASIENTA`: el texto es contrato, y una aserción contra su propia fuente siempre pasa. El
caso comprueba tres cosas: la premisa de que el diálogo es el correcto («Ahora mismo consta recibida por»), que
`queryByText(NOTA_R43)` es null, y que no aparece `/no se puede desmarcar/i`. Conserva la línea :284 de textos
de la regla vieja.

### Cambio de código

`components/shared/conciliacion/ConciliacionAcciones.tsx`:

- borrar las líneas 288-289 y la importación de la línea 26;
- corregir el comentario de cabecera, líneas 61-62, que dice que la confirmación lleva la nota.

`components/shared/conciliacion/conciliacion-labels.ts`: en el comentario de la línea 116, quitar «y dentro del
diálogo de «Desmarcar»». La constante y su valor no se tocan.

### Consecuencia aceptada

`/cierres-admin` deja de mostrar la nota en todos sus estados: el diálogo de Desmarcar era el único sitio donde
salía allí, y desde la 500 ese diálogo solo aparece cuando aún no hay dinero. 498/R43 fija el texto, no que esté
en las dos pantallas. El pie de `/wallet/satelites` sigue igual.

## 2. m1: un test que distingue `tx` de `this.prisma`

### Por qué sobrevive hoy

`clienteConSavepoint` (`tests/integration/db/_postgres-real.ts:167-196`) entrega el mismo proxy como raíz y como
`tx` (`fn(proxy)`, línea 182). Por eso la mutación de `ZonaRepository.ts:774-775`
(`appendAccion(this.prisma, …)`) es indistinguible.

### La solución: dos conexiones de verdad

Un caso nuevo en `tests/integration/db/zona-distrito-rastro-500.test.ts`, que ya tiene el escenario. El
repositorio recibe como raíz el `prisma` real del test, y su `$transaction` entrega la `tx` del escenario:

```ts
function raizDistintaDeTx(raiz: PrismaClient, tx: TxDeTest): PrismaClient {
  return new Proxy(raiz, {
    get(objetivo, prop) {
      if (prop === "$transaction") return async (fn: (t: TxDeTest) => unknown) => fn(tx);
      const valor = Reflect.get(objetivo, prop) as unknown;
      return typeof valor === "function" ? valor.bind(objetivo) : valor;
    },
  });
}
```

Es local al archivo del test. Postgres hace la distinción, por visibilidad en READ COMMITTED:

| | Dentro de la `tx` | Desde `prisma` (otra conexión) | Tras revertir |
| --- | --- | --- | --- |
| Código actual, `appendAccion(tx, …)` | 2 filas | **0** | **0** |
| Mutación, `appendAccion(this.prisma, …)` | 2 filas | **2** (ya commiteadas) | **2** |

El caso añade un distrito y quita otro. Las dos primeras lecturas de la tabla van dentro de `conEscenario`, y la
de «tras revertir», fuera.

Comprobado leyendo el código, para que el caso funcione:

- `crearPrismaDeTest` abre un pool de 2 conexiones (`_postgres-real.ts:42`): la `tx` ocupa una y queda la otra.
- `update` hace todo por `tx` dentro de `$transaction` (`ZonaRepository.ts:469`), sin lecturas previas por
  `this.prisma` que no verían la zona sembrada sin commitear.
- `historial_accion.entidad_id` no tiene FK (`db/schema.prisma:4310-4315`), así que la fila mutada se escribe
  aunque la zona no esté commiteada. `actor_usuario_id` apunta a un usuario ya commiteado.
- `serializarEscriturasReales` toma un candado advisory que la segunda conexión no pide: no hay espera.

### Limpieza

Con la mutación, las filas quedan commiteadas en la base compartida. El test las borra por `entidadId`, con el id
de esa zona, **antes de los `expect`**, porque un `expect` rojo saltaría una limpieza puesta después. Con el código
correcto, ese borrado afecta a 0 filas.

### Lo que no cubre

Las otras tres `appendAccion` de `update` (:661, :695, :743) siguen sin este test: el caso filtra por
`zona_distrito_cambiado`. Es lo que pide la ficha.

## 3. m5: la consolidación recibida de más

### 3.1 Qué haría «Corregir» en ese estado (leído en `CierresBodegaAdminRepository.ts:746-819` y :846-895)

Fórmula: `delta = esperado − recibido − Σ ajustes anteriores`. Si `delta` es positivo, escribe un egreso; si es
negativo, un ingreso; si es 0, nada. Siempre: una fila de ajuste (append-only) y un movimiento. No llama a
`asentarCierreDia`.

| Debe | Marcada por (ajuste de la marca) | Corregir a | Ajuste nuevo | Movimiento nuevo | Falta queda en | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | 90 (−90, ingreso 90) | 0 | +90 | egreso 90 | 0.00 | Recibido |
| 800 | 1000 (−200, ingreso 200) | 800 | +200 | egreso 200 | 0.00 | Recibido |
| 800 | 1000 | 700 | +300 | egreso 300 | 100.00 | Recibido incompleto |
| 800 | 1000 | 900 | +100 | egreso 100 | −100.00 | Recibido |
| 800 | 1000 | 1100 | −100 | ingreso 100 | −300.00 | Recibido |
| 800 | 1000 | 0 | ninguno | ninguno: `recibido_cero_con_aporte` | −200.00 | Recibido |
| −100 | 0 (−100, ingreso 100) | 30 | −30 | ingreso 30 | −130.00 | Recibido |

Otros efectos, los mismos que hoy con «Recibido incompleto»:

- **Asientos:** ninguno nuevo y ninguna fila anterior cambia (498/R19).
- **Historial:** una fila `cierre_bodega_conciliado` con `valorAnterior` y `valorNuevo`.
- **Campos de la marca:** reescribe `conciliado_at`, `conciliado_por`, `resuelto_at`, `resuelto_por` y la nota.
  La consolidación se mueve a «Recibido este mes» del mes de la corrección (`SaldosSatelitesRepository.ts:462`).
- **Concurrencia:** el compare-and-swap del monto en el `WHERE` responde `conflict` si otra persona corrigió antes.
- **Permisos:** `ConciliacionSatelitesService.corregirRecibida` filtra por rol primero.

No hace falta ningún cambio de servidor: `corregirConciliacion` no comprueba que la marca esté incompleta.

### 3.2 Salida A: cambio de pantalla

**Dos trampas medidas en el código, y las dos las debe cubrir un test:**

1. `ConciliacionAcciones.tsx:139`: `esCorreccion = estado === "incompleto"` decide a qué action se envía. Si solo se
   cambia el botón de la línea 218, el diálogo manda la corrección a `marcarConsolidacionRecibidaAction`, que
   responde `conflict` siempre. Es el defecto que 473/R14 ya arregló una vez. R9 lo cubre.
2. El signo solo no basta. Una consolidación **sin marcar** que debe −450 trae `faltaPorRecibir: "-450.00"`
   (`CierresBodegaAdminDebe498.test.tsx:184`). Sin condicionar a «conciliada» saldría «Corregir» en una pendiente.
   R8 lo cubre.

`app/(app)/cierres-admin/_components/cierre-labels.ts`, junto a `hayFaltantePorRecibir` (:652):

```ts
const LLEGO_DE_MAS = /^\s*-(?!0+(\.0+)?\s*$)/;

/** ¿Llegó más de lo que debía? Comparación textual, money-safe. `-0.00` no cuenta. */
export function llegoDeMas(faltaPorRecibir: string): boolean {
  return LLEGO_DE_MAS.test(faltaPorRecibir);
}
```

`estadoConciliacionDe` y su tipo no cambian: el badge sigue siendo «Recibido».

`ConciliacionAcciones.tsx`:

```ts
const esCorreccion =
  estado === "incompleto" || (estado === "recibido" && llegoDeMas(marca.faltaPorRecibir));
```

La línea 218 pasa a `{esCorreccion ? …}`, una sola condición para el botón y el envío. También se actualizan el
comentario de las líneas 45-48 y 136-138, y el de `CONCILIACION_ACCION.corregir`. El resto ya funciona:
`montoActual` (:252) entrega el monto, y con él `MarcarRecibidoDialog` usa el título y la pista de corregir.

**No se condiciona a «con dinero».** La pantalla solo tiene `puedeDesmarcar`, que también es `false` en una saldada,
y 500/R5 ya fija «tenga o no dinero» para la incompleta. Una de más sin dinero ofrece los dos botones, igual que la
incompleta desmarcable (`ConciliacionAcciones500.test.tsx:104-108`).

Las dos pantallas pasan el valor del servidor sin recortar (`ConciliacionSatelite.tsx:340`,
`CierresBodegaAdminModule.tsx:894`; origen en `SaldosSatelitesRepository.ts:108` y `CierreBodegaRepository.ts:144`).

**Test de Postgres (`502-corregir-de-mas-sql-real.test.ts`):** las filas de §3.1 con literales escritos a mano, usando
`conEscenario`, `sembrarConsolidacion`, `consolidacionConDosCierres`, `filasDeDiferencia` y `filasDeLosLibros` de la
498. La falta se lee con `SaldosSatelitesRepository.findConsolidacionesPaginado`, el lector real de la pantalla.

**Ayuda (`docs/ayuda/oficina/wallet-satelites.md`).** Texto propuesto, en voseo como el párrafo vecino. En la tabla de la
línea 93, «Llegó completo» pasa a «Llegó completo o de más». Tras el párrafo de la línea 114-117 se añade:

> **Corregir** aparece en una consolidación recibida incompleta o recibida de más.


## 4. Alternativas descartadas

**A1. El unitario con doble que propuso la revisión (m1).** Un `$transaction` falso en `zona-repository.test.ts` que
entregue un `tx` distinto. Mataría la mutación, pero solo comprobaría a qué objeto se llamó. La ficha pide Postgres, y
este repo ya aprendió que los dobles no ven lo que pasa en la base. Con dos conexiones, lo que se afirma es lo que
importa: la fila no existe fuera de la transacción.

**A2. Cambiar `clienteConSavepoint` para que entregue un `tx` distinto.** Arreglaría la limitación para todos, pero ese
ayudante lo usan decenas de archivos de `tests/integration/db`. El radio no compensa para un menor.

**A3. Una raíz espía que lance al recibir `historialAccion.createMany`.** No deja filas ni pide limpieza, y por eso
tentaba. Se descarta porque sigue midiendo la identidad de un doble, con el mismo defecto de A1, y porque R4 y R5 hablan
de lo que se ve en la base.

**A4. Un cuarto estado «recibido de más» en `EstadoConciliacion` (m5).** Cambiaría el badge, `ESTADO_CONCILIACION_VARIANT`
y la guardia de vocabulario. Es rediseño, y para decidir un botón basta el predicado.

**A5. Que el servidor mande `puedeCorregir`, como `puedeDesmarcar` (m5).** Tocaría DTO, repositorios y servicio en dos
lecturas. `puedeDesmarcar` existe porque depende de consultas que la pantalla no puede hacer; aquí el dato
(`faltaPorRecibir`) ya llega. Y el servidor no rechaza esa corrección, así que no hay dos criterios que puedan
contradecirse.

**A6. Borrar `NOTA_CONCILIACION_ASIENTA` o reescribirla (m4).** El defecto es dónde sale, no lo que dice. Al pie sigue
siendo cierta antes de marcar.
