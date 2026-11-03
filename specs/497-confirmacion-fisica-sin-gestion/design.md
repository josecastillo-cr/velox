# Ficha 497 — Diseño

> **Arreglo mínimo, no modelo nuevo.** Los datos ya están persistidos: `cierre_sin_gestion` (264)
> guarda la guía congelada de cada barrida. La maquinaria de confirmación ya existe (238). Lo que
> falta es conectar el segundo origen al conjunto esperado, a la validación del servidor, a la marca
> en la transacción y a la ventana, sin partir en dos la regla de «qué vuelve a bodega».
>
> **Relación con la 451.** `specs/451-confirmacion-fisica-sin-gestionar/` describe el mismo defecto
> y este diseño reutiliza buena parte de su análisis. Cambia en tres puntos, por hechos posteriores
> a la 451: el rótulo es «Novedad interna» (455); el contrato del repositorio no añade un campo
> obligatorio, para que `cierres-admin-caja-cod.test.ts` compile sin tocarse (§5.4); y el gate es
> `--rapido` (regla del 2026-10-05). Ver Q1 de `requirements.md`.

Búsqueda hecha con el MCP `codebase-memory` (proyecto `R-job-singularis-projects-ordenex`) y
confirmada leyendo cada archivo citado el 2026-11-02 sobre `dev` (`82cc4f36`).

---

## 1 · Qué hay hoy, verificado en el archivo

| Pieza | Dónde | Estado |
| --- | --- | --- |
| Punto único | `lib/types/gestion-retorno.ts:33-61` | `RETORNA_A_BODEGA` (`as const satisfies Record<GestionResultado, boolean>`), `RESULTADOS_QUE_VUELVEN` derivada, `vuelveABodega`. Módulo puro. |
| Validación de cobertura | `lib/services/CierresAdminService.ts:978-983` (llamada), `:1282-1351` (`validarConfirmacionFisica`) | Solo lee `findGestionesRetornablesDelCierre`. Atajo `esperadas.length === 0 && confirmacionFisica.length === 0 → null` en `:1291`. |
| Lectura del conjunto | `lib/repositories/CierresAdminRepository.ts:1010-1028` | `gestionOrden.findMany` con `cierreId`, `resultado IN RESULTADOS_QUE_VUELVEN`, `anuladaAt: null`, `cierre: alcanceWhere(alcance)`. |
| Marca en la tx | `CierresAdminRepository.ts:2372-2421` | `tx.gestionOrden.updateMany` con `{ id IN ids, cierreId, resultado IN … }`, `data: { confirmadaFisicaAt: new Date() }`, `count !== ids.length → ConfirmacionFisicaNoAplicableError`. Va después de los cinco feeds de dinero. |
| Contrato del repo | `lib/interfaces/repositories/ICierresAdminRepository.ts:178-180, 312, 322` | `ConfirmacionFisicaGestion { gestionId }`; `confirmacionFisica` obligatorio en `aprobado`, `?: never` en `rechazado`. |
| Borde | `lib/types/cierres-admin.ts:99-117` | `confirmacionFisicaSchema = { gestionId: uuid, numGuia: int > 0 }`; `.default([])`. |
| Barridas | `db/schema.prisma:2843-2878` (`CierreSinGestion`) | `numGuia Int?` sin `@unique` (copia), `@@unique([cierreId, ordenId])`, sin `updated_at`/`deleted_at`. |
| Quién barre | `lib/repositories/CierreDiaRepository.ts:955-1137` (`crearCierre`), llamado por `CorteDiarioService.ts:211-218` con `estado: "vencido"` y `corteSinGestionar` | **Única** escritura de `cierre_sin_gestion` en `lib/` (`:1124`, `createMany`). |
| Liberación al aprobar | `CierresAdminRepository.ts:~1940-…` (lee `tx.cierreSinGestion.findMany` en `:1984`) | Libera las barridas de este cierre a bodega o a rechazo por tope (109/276), en la misma tx. |
| Barridas en el detalle | `CierreOrdenSinGestion` (`lib/interfaces/services/ICierreDiaService.ts:351-…`: `ordenId`, `numGuia`, …); `CierresAdminModule.tsx:379, 679` | Ya viajan al cliente y ya están en el estado del módulo. |
| Ventana | `app/(app)/cierres-admin/_components/cierre-confirmacion-fisica.tsx:157-331`; `CierresAdminModule.tsx:611-624, 792-884` | Todo se construye desde `retornablesDelCierre(detalle.grupos)`; `pedirAprobacion` abre la ventana solo si `retornables.length > 0`. |
| Rótulo vigente | `cierre-factura.tsx:1442` | «Sin gestionar» es el nombre retirado de `novedad_interna` (455); la guardia `tests/unit/guards/nombres-estado-retirados.guardia.test.ts` prohíbe la frase en la UI. |

**Los dos conjuntos son disjuntos.** El corte excluye toda orden con gestión pendiente
(`whereOrdenSinGestionPendiente()`, `CierreDiaRepository.ts:1079`), y las gestiones del cierre son
precisamente las pendientes que `crearCierre` vincula. Una orden no puede ser a la vez barrida y
gestión del mismo cierre. Con `orden.numGuia` `@unique`, una guía tampoco puede casar a la vez con
una gestión y con una barrida del mismo cierre.

---

## 2 · El modelo de aquí: las barridas nacen con el cierre

En el repo de origen las barridas se escriben cuando un cierre existente vence. Aquí no: el corte
diario **crea** el cierre en estado `vencido` y, **en la misma transacción**, mueve las órdenes a
`novedad_interna` y escribe sus filas en `cierre_sin_gestion`. Ninguna otra ruta escribe esa tabla.

Consecuencias para el diseño:

1. **El conjunto de barridas está fijo desde que el cierre nace.** No hay un evento posterior que
   añada filas, así que la lectura de §5.3 no compite con ninguna escritura concurrente sobre la
   misma clave.
2. **Un cierre con barridas nunca está en `solicitado` al nacer.** Para aprobarlo, antes tiene que
   pasar a `solicitado` (re-solicitud del mensajero o la válvula de escape de la 111), porque
   `ESTADOS_RESOLUBLES = ["solicitado"]` (`CierresAdminRepository.ts:133`). Esta ficha no toca esas
   transiciones. Por R28, ninguna escribe marcas.
3. **Un cierre `solicitado` creado por el mensajero no tiene barridas** (`solicitarCierre` no pasa
   `corteSinGestionar`). Para él, R9 sale gratis: la lectura devuelve `[]`.
4. **Fixtures de test.** Las suites de integración crean el cierre con sus barridas como lo hace la
   producción (o insertan directamente en `cierre_sin_gestion`), y luego lo ponen en `solicitado`
   antes de aprobar. No se simula un «vencer» que aquí no existe.

---

## 3 · El punto único con dos orígenes

Una barrida **no es** un `GestionResultado`: no cabe en `RETORNA_A_BODEGA` sin destruir su red de
exhaustividad. Se añade un **segundo eje** en el mismo módulo, igual de exhaustivo, que delega en el
primero.

```ts
// lib/types/gestion-retorno.ts — SE AÑADE; no cambia ni una línea de las 33-61 actuales

/** Ficha 497 — de dónde sale una fila que el cierre pone delante de bodega. */
export type OrigenDelPaquete = "gestion" | "barrida";

/**
 * Ficha 497 — QUÉ VUELVE, POR ORIGEN. Exhaustivo a propósito: un tercer origen no compila
 * hasta que alguien decida si su paquete vuelve. `gestion` DELEGA en RETORNA_A_BODEGA (no copia
 * sus valores); `barrida` vuelve siempre (decisión H2 adoptada el 2026-11-02).
 */
export const RETORNO_POR_ORIGEN = {
  gestion: "segun_resultado",
  barrida: "siempre",
} as const satisfies Record<OrigenDelPaquete, "siempre" | "nunca" | "segun_resultado">;

export type PaqueteDelCierre =
  | { readonly origen: "gestion"; readonly resultado: GestionResultado }
  | { readonly origen: "barrida" };

export function vuelveABodegaElPaquete(p: PaqueteDelCierre): boolean {
  switch (p.origen) {
    case "gestion":
      return vuelveABodega(p.resultado);
    case "barrida":
      return RETORNO_POR_ORIGEN.barrida === "siempre";
  }
}
```

- **R2:** `RETORNA_A_BODEGA` queda igual, byte a byte.
- **R3:** el `satisfies Record<OrigenDelPaquete, …>` y el `switch` sin `default` (con
  `noImplicitReturns` / tipo de retorno `boolean`) rompen el typecheck ante un tercer origen.
- **R4:** no hay segunda lista. La guardia
  `tests/unit/guards/confirmacion-incidentes-excluidos.guardia.test.ts` gana dos casos: la presencia
  del `satisfies Record<OrigenDelPaquete,` en el punto único, y que ningún archivo de producción fuera
  del punto único declare una regla de origen propia (un literal `barrida` junto a `vuelve`/`retorna`).
  Los dos llevan su autocomprobación.
- **Consumidores:** el servicio (§5.2) y la ventana (§6) incluyen las barridas porque
  `vuelveABodegaElPaquete({ origen: "barrida" })` es `true`, no por un `if` propio. El repositorio lee
  todas las barridas del cierre sin filtrar por la regla, porque `"siempre"` no admite filtro. Un
  test lo deja dicho: si `barrida` pasara a `"nunca"`, la ventana y el servicio la excluirían a la
  vez.

---

## 4 · Modelo de datos: una columna

```prisma
model CierreSinGestion {
  // ... todo lo existente, intacto ...

  // FICHA 497 (R22/R25/R26) — instante en que bodega declaró tener ESTE paquete delante al aprobar
  // el cierre. MISMO nombre que `gestion_orden.confirmada_fisica_at` (238): es el mismo hecho sobre
  // el otro origen, y así la guardia `confirmacion-sin-lectores` lo cubre sin tocar su registro.
  // No contradice la inmutabilidad de la fila: los datos CONGELADOS no se tocan (R24); esto es un
  // hecho nuevo, escrito una vez, en la transacción que aprueba.
  confirmadaFisicaAt DateTime? @map("confirmada_fisica_at")
}
```

**Migración** `db/migrations/20261102120000_cierre_sin_gestion_confirmacion_fisica/` (fecha
posterior a `20261023120100_iva_por_pagar_488_checks`; si otra ficha en paralelo mergea antes una
migración con fecha mayor, se renombra **antes de aplicarla en ningún entorno**):

- `migration.sql`: `ALTER TABLE "cierre_sin_gestion" ADD COLUMN "confirmada_fisica_at" TIMESTAMP(3);`
- `down.sql`: `ALTER TABLE "cierre_sin_gestion" DROP COLUMN IF EXISTS "confirmada_fisica_at";`

Aditiva: no toca filas, índices, RLS ni enums. Molde exacto de
`20260819170000_gestion_orden_confirmacion_fisica`. **Nullable, sin default, sin CHECK, sin índice,
sin backfill** (decisión adoptada): `NULL` significa «aprobado antes del arreglo» o «sin confirmar»
(R25). Ninguna consulta filtra por ella.

**R41:** la columna nace sin lectores (no se proyecta en ningún `select`, no viaja a ningún DTO), así
que la base revertida es la que el código anterior espera. Pérdida declarada al revertir: las marcas
escritas mientras la columna existió.

**RLS:** sin superficie nueva. `cierre_sin_gestion` ya existe con el patrón del repo (RLS habilitada
sin policies, solo service role). Sin multiempresa.

---

## 5 · Contratos

### 5.1 · Borde — `lib/types/cierres-admin.ts`

Cada entrada identifica su origen **por su clave**, sin campo discriminante:

```ts
const confirmacionGestionSchema = z.object({
  gestionId: z.string().uuid(),
  numGuia: z.number().int().positive(),
}).strict();

const confirmacionBarridaSchema = z.object({
  ordenId: z.string().uuid(),
  numGuia: z.number().int().positive(),
}).strict();

export const confirmacionFisicaSchema = z.union([confirmacionGestionSchema, confirmacionBarridaSchema]);
```

- Una entrada de gestión tiene **exactamente** la forma de hoy, así que un cierre sin barridas manda
  el **mismo payload** que antes (R19), byte a byte.
- `.strict()` en las dos ramas: una entrada con `gestionId` **y** `ordenId` es error de forma, no se
  recorta en silencio a una de las dos. Antes de añadir `.strict()` a la rama de gestión, el
  implementador comprueba que ningún llamador envía claves extra (hoy la pantalla manda solo
  `{ gestionId, numGuia }`, `CierresAdminModule.tsx:794`).
- `confirmacionFisica: z.array(confirmacionFisicaSchema).default([])` se conserva (R18).
- La **cobertura** sigue en el servicio: el borde no sabe qué barridas tiene el cierre.

### 5.2 · Servicio — `CierresAdminService`

`aprobarCierre(cierreId, actor, indemnizaciones = [], confirmacionFisica = [])` **conserva su firma**.
Solo cambia el tipo del elemento: `ConfirmacionFisicaInput` (`ICierresAdminService.ts:514`) pasa a ser
la unión `{ gestionId, numGuia } | { ordenId, numGuia }`.

`validarConfirmacionFisica` pasa a:

1. Leer las gestiones que vuelven (`findGestionesRetornablesDelCierre`, intacta) y las barridas
   (`findBarridasDelCierre`, §5.3).
2. **Atajo de R19:** si no hay gestiones que vuelvan, ni barridas, ni entradas, devuelve `null`.
3. Montar dos mapas, uno por origen: `gestionId → guía viva` y `ordenId → guía congelada`. Una
   entrada se busca **solo** en el mapa de su origen. Una entrada `{ ordenId: <id de una gestión> }`
   no está en el mapa de barridas y es ajena (R13), y al revés igual.
4. Recorrer las entradas con el bucle de hoy: duplicada (por clave dentro de su origen) →
   `MSG_CONFIRMACION_DUPLICADA` (R14); no esperada → `MSG_CONFIRMACION_AJENA` (para gestiones se
   conserva la distinción `MSG_CONFIRMACION_INCIDENTE`); sin guía congelada →
   `MSG_CONFIRMACION_SIN_GUIA` (R16); guía distinta de la congelada →
   `MSG_CONFIRMACION_GUIA_DISTINTA` (R15).
5. Cerrar con el barrido de faltantes sobre **los dos** conjuntos → `MSG_CONFIRMACION_FALTANTE` en la
   clave que falta (R12).
6. `fieldErrors` se indexa por `gestionId` o por `ordenId`. Son uuid de tablas distintas y los
   conjuntos son disjuntos (§1), así que no colisionan.

Los mensajes existentes se reutilizan tal cual. No hay mensaje nuevo.

Si la validación pasa, el servicio entrega al repositorio `confirmacionFisica` con las **mismas**
entradas, ya sin `numGuia`: `{ gestionId } | { ordenId }`.

Mismo criterio para cualquier actor con permiso de aprobar (R21): la validación ya corre con
`scope.alcance` para todos, incluido `adminSatelite`. No hay rama por rol.

### 5.3 · Repositorio — lectura

```ts
// ICierresAdminRepository
export interface BarridaDelCierre {
  ordenId: string;
  numGuia: number | null; // la CONGELADA (cierre_sin_gestion.num_guia), no la viva
}
findBarridasDelCierre(cierreId: string, alcance: Alcance): Promise<BarridaDelCierre[]>;

// CierresAdminRepository — molde de findGestionesRetornablesDelCierre
this.prisma.cierreSinGestion.findMany({
  where: { cierreId, cierre: alcanceWhere(alcance) },
  select: { ordenId: true, numGuia: true },
});
```

- **Alcance en el `WHERE`** por la relación al cierre (R7): un cierre fuera de alcance devuelve `[]`,
  indistinguible de uno inexistente.
- **Del registro persistido** (R6): no lee `orden.estatus_id` ni `orden.num_guia`.
- **No mira `cierre_dia.sin_gestion_registrado`.** Un cierre anterior a la 264 no tiene filas y la
  lectura devuelve `[]` (R9). Un `if` sobre la bandera sería un camino extra que, mal escrito,
  podría saltarse el bloqueo.

### 5.4 · Repositorio — escritura en la transacción (y por qué el contrato es una unión)

**El contrato.** `ConfirmacionFisicaGestion` gana `ordenId?: never` y aparece
`ConfirmacionFisicaBarrida { ordenId: string; gestionId?: never }`. El campo `confirmacionFisica` de
la rama `aprobado` pasa a `ReadonlyArray<ConfirmacionFisicaGestion | ConfirmacionFisicaBarrida>`.
Sigue siendo obligatorio en `aprobado` y `?: never` en `rechazado` (R28).

**Por qué no un campo nuevo `confirmacionBarridas` (lo que proponía la 451).**
`tests/unit/repositories/cierres-admin-caja-cod.test.ts:237-247` construye la entrada de
`resolverCierre` como un literal con `confirmacionFisica: []`, y `tsconfig.json` incluye `tests/`
en el typecheck. Un campo obligatorio nuevo dejaría ese archivo sin compilar, y habría que
modificarlo, cosa que R40 prohíbe. Un campo opcional evitaría el error, pero un olvido en el
cableado dejaría la marca sin escribir **sin que fallara nada**. La unión no tiene ninguno de los dos
problemas: los literales de hoy (`[]` o `{ gestionId }`) siguen compilando, y una entrada mal formada
(`{ gestionId, ordenId }`) no compila.

**La escritura**, dentro del mismo bloque comentado de la 238 (`:2372-2421`):

```ts
const gestionIds = confirmacionFisica.flatMap((c) => (c.gestionId !== undefined ? [c.gestionId] : []));
const ordenIds = confirmacionFisica.flatMap((c) => (c.ordenId !== undefined ? [c.ordenId] : []));

if (gestionIds.length > 0) {
  // el updateMany de la 238, SIN CAMBIOS salvo que recibe `gestionIds` en vez de todos los ids
}

// FICHA 497 — LA MARCA DE LAS BARRIDAS. Pegada a la de la 238, en el mismo punto money-neutral.
if (ordenIds.length > 0) {
  const aplicado = await tx.cierreSinGestion.updateMany({
    where: { cierreId, ordenId: { in: ordenIds } }, // `cierreId` es GUARDIA: sin él se marcaría otro cierre
    data: { confirmadaFisicaAt: new Date() },       // R24: una sola clave; ni dinero ni datos congelados
  });
  if (aplicado.count !== ordenIds.length) throw new ConfirmacionFisicaNoAplicableError(cierreId); // R23
}
```

Por qué así:

- **R40, `cierres-admin-caja-cod.test.ts` queda intacto.** El bloque va después de los cinco feeds de
  dinero, así que no mueve ninguna aserción de orden. Ese doble de Prisma no tiene
  `cierreSinGestion` y aprueba con `confirmacionFisica: []`. Como el `updateMany` nuevo solo corre si
  `ordenIds.length > 0`, no se llama y la suite pasa sin cambios. Un rojo ahí es regresión, no una
  aserción que actualizar.
- **R22:** misma transacción. **R23:** el `count` corto lanza y la `$transaction` revierte todo,
  incluida la liberación y el dinero.
- **R27, idempotencia por construcción:** el bloque vive dentro de `res.count === 1 && aprobado`, y la
  transición del cierre está guardada por `estado IN ["solicitado"]`. Un cierre ya aprobado no entra.
  **No** se añade `confirmadaFisicaAt: null` al `WHERE`, por la misma razón que la 238: un reintento
  legítimo tras un rollback lanzaría por `count`.
- **R29 sale de la transacción y se mide.** La liberación ya está acotada a las barridas de este
  cierre (271). Como la cobertura exacta se validó antes (R17), toda barrida liberada tiene su marca
  en la misma transacción. Se mide contra Postgres (§11).
- **Inventario de la guardia.** `tx.cierreSinGestion.updateMany` es una escritura nueva de la
  aprobación: entra en `ESCRITURAS_DE_LA_APROBACION` de
  `aprobacion-escrituras-cubiertas.guardia.test.ts` (ver §8 y Q2).

---

## 6 · La ventana de confirmación

**No es pantalla nueva:** cambia el cuerpo de la ventana existente. No pasa por `/design`.

### 6.1 · Dónde van las barridas

En la **misma lista**, como **última sección**, rotulada **«Novedad interna (N)»**, después de las
secciones derivadas de `RESULTADOS_QUE_VUELVEN`. La fila es igual que la de gestión: guía · remisión,
destinatario · tienda, badge `Pendiente`/`Confirmada`. Donde la de gestión pinta su resultado, la de
barrida pinta un badge **«Novedad interna»**. El texto sale de la etiqueta vigente del estado
`novedad_interna`, no de un literal nuevo, si esa etiqueta ya está exportada para cliente. Si no, el
implementador lo dice y lo escribe una vez, junto a su comentario.

Por qué no en otro sitio:

- **Mezcladas sin distinguir:** una barrida no tiene resultado y quien escanea perdería la razón por
  la que ese paquete está ahí.
- **En una caja aparte:** la única caja aparte de esta ventana es la de incidentes, que dice «esto no
  se escanea». Una caja hermana las haría leerse como opcionales.
- **En un segundo paso:** habría dos contadores y un «Están todos» con barridas pendientes detrás.

### 6.2 · Qué cambia por dentro (`cierre-confirmacion-fisica.tsx` y `CierresAdminModule.tsx`)

Una **vista unificada** permite tener un solo contador y un solo intérprete de lecturas:

```ts
export type FilaAConfirmar =
  | { origen: "gestion"; clave: string /* gestionId */; numGuia: number | null; numRemision: string;
      destinatario: string; tiendaNombre: string; resultado: CierreResultado }
  | { origen: "barrida"; clave: string /* ordenId */; numGuia: number | null /* congelada */;
      numRemision: string; destinatario: string; tiendaNombre: string };
```

- `filasAConfirmar(grupos, ordenesSinGestion)` construye el conjunto esperado del cliente con el
  **mismo detalle ya cargado** (`detalle.grupos` y `detalle.ordenesSinGestion`). Incluye una barrida
  porque `vuelveABodegaElPaquete({ origen: "barrida" })` es `true` (§3). No hace consultas nuevas.
- `interpretarLectura` busca la guía en todas las gestiones del cierre **y** en las barridas. Una guía
  que no casa con ninguna da `LECTURA_AJENA` (R34). `lecturaNoVuelve` solo puede dispararla una
  gestión. El desenlace `confirma` pasa a devolver `claves` (gestionIds u ordenIds).
- `clavePaquete`, `agruparPorPaquete` y `progresoDePaquetes` operan sobre `FilaAConfirmar`, con el
  mismo criterio (`guia:<n>`, o `sin-guia:<origen>:<clave>` si no hay guía). Un solo contador (R32).
- `confirmadas` pasa a indexarse por `clave` (gestionId u ordenId).
- **R35:** si alguna fila no tiene guía, aparece un aviso **encima de la lista** con cuántas filas son
  y que el cierre no se podrá aprobar. El aviso por fila de la 238 se conserva.
- **R38:** `pedirAprobacion` abre la ventana si `filasAConfirmar.length > 0`, no si
  `retornables.length > 0`. Sin esto, un cierre solo con barridas se aprobaría de un clic contra un
  servidor que ahora lo rechaza.
- **Envío:** `confirmarAprobacion` manda `{ gestionId, numGuia }` por cada gestión confirmada y
  `{ ordenId, numGuia }` por cada barrida confirmada. Si el cierre no tiene barridas, el payload es
  el de hoy (R19).
- **R36:** `repartirErroresDelServidor` considera «de confirmación» las claves `gestionIds ∪ ordenIds`
  del conjunto esperado. El bolsón de montos no cambia.
- **R37:** cerrar la ventana no llama a la Server Action (comportamiento de hoy, extendido por test).
- Las funciones que queden sin uso tras unificar (`retornablesDelCierre` y `agruparRetornables`, si
  pasa) se **borran en su tarea**, con sus tests sustituidos (no eliminados sin red).

---

## 7 · Preparado para la 498

La 498 extraerá de `resolverCierre` los cinco escritores de dinero (caja, libro por tienda, COD,
libro del mensajero, indemnización: `CierresAdminRepository.ts:~1872-1936`) para condicionarlos al
destino. Esta ficha lo deja limpio:

- **No toca ninguna línea** de los escritores de dinero ni del bloque de la liberación. Todo lo nuevo
  va en el bloque de la 238 (`:2372-2421`), que está **después** de los feeds y es money-neutral.
- **No añade campos a `ResolverCierreInput`**: solo cambia el tipo del elemento de un campo que ya
  existe. La 498, si añade un parámetro de destino, no choca con esta firma.
- **No lee `destino_tipo`** ni lo condiciona: la confirmación física es igual para central y
  satélite (R21).
- **No introduce helpers nuevos dentro de `resolverCierre`.** El cálculo de `gestionIds`/`ordenIds` es
  local al bloque de la marca. Si la 498 mueve los feeds a una función propia, el diff de esta ficha
  y el suyo no se solapan.
- `aprobacion-escrituras-cubiertas` gana una entrada nueva aquí. La 498 cambiará entradas de
  **otros** escritores (los inyectados). Las dos ediciones van en bloques distintos del archivo.

---

## 8 · Guardias afectadas

| Guardia | Efecto | Acción |
| --- | --- | --- |
| `tests/unit/guards/aprobacion-escrituras-cubiertas.guardia.test.ts` | **Se pone roja** con la escritura nueva: es un inventario cerrado. | Cambio **solo aditivo**: entrada `tx.cierreSinGestion.updateMany` en `ESCRITURAS_DE_LA_APROBACION` con `cubiertaPor` = suite unitaria + suite de integración nueva, y un caso «497: la suite que nombra la marca de las barridas la afirma» (molde del caso 238/T3.7). Ninguna aserción existente cambia. **Pendiente de confirmar por el humano (Q2).** |
| `tests/unit/guards/confirmacion-sin-lectores.guardia.test.ts` | Cubre la columna nueva por su nombre. Los dos archivos que la nombran (`db/schema.prisma`, `CierresAdminRepository.ts`) ya están permitidos. | Ninguna. Que siga verde demuestra que el nombre se reutilizó bien. |
| `tests/unit/guards/confirmacion-incidentes-excluidos.guardia.test.ts` | Censo de listas sueltas. | Dos casos nuevos (§3), con autocomprobación. |
| `tests/unit/guards/nombres-estado-retirados.guardia.test.ts` | Prohíbe «sin gestionar» en la UI. | Ninguna. Debe seguir verde con el rótulo «Novedad interna». |
| `tests/unit/guards/cierre-sin-gestion-sin-dinero.guardia.test.ts` | `cierre_sin_gestion` sin dinero. | Ninguna. Debe seguir verde. |

Estas guardias leen archivos con `fs` y el grafo no las relaciona con el diff. Se corren **a mano**
además del `--rapido`.

---

## 9 · Alternativas descartadas

**A · Una clave `novedad_interna` en `RETORNA_A_BODEGA`.** No es un `GestionResultado`. Para que
compilara habría que relajar el `satisfies` (se pierde la red: un resultado nuevo caería en
`undefined` y quedaría excluido en silencio) o añadir el valor al enum de Prisma (contamina
`gestion_orden.resultado` con un valor imposible). Descartada: el arreglo se pagaría con la garantía
que lo protege.

**B · Un campo nuevo obligatorio `confirmacionBarridas` en `ResolverCierreInput` (diseño de la 451).**
Rompe el typecheck de `cierres-admin-caja-cod.test.ts`, que R40 obliga a dejar intacto. La versión
opcional deja un olvido de cableado sin ninguna señal. Descartada en favor de la unión (§5.4).

**C · Unión discriminada con `origen` obligatorio en el borde.** Es lo que proponía la 451. Cambia
el payload de **todo** cierre con gestiones que vuelven, aunque no tenga barridas. Eso choca con R19
(mismo payload que antes) y obliga a reescribir los tests de forma del borde. La identificación por
clave (`gestionId` / `ordenId`) con `.strict()` da la misma seguridad sin tocar el payload de hoy.

**D · No persistir nada, solo bloquear.** Evita la migración, pero deja la mitad del defecto abierta:
un cierre aprobado no podría demostrar que alguien tuvo esos bultos delante. Además contradice la
decisión adoptada (marca `confirmada_fisica_at`).

**E · Tabla nueva de confirmaciones (una fila por paquete, con origen).** Es superficie nueva (tabla,
RLS, índices, guardias) para un dato que cabe en una columna de una tabla existente. Sería rediseñar
en vez de arreglar lo evidenciado. La 238 ya la descartó (§10-C).

**F · Comparar contra la guía viva de la orden.** Decisión cerrada en contra: se usa la congelada.
Además, la pantalla ya pinta la congelada. Con la viva, pantalla y servidor podrían pedir números
distintos y el botón se quedaría bloqueado sin explicación.

**G · Escribir la marca por SQL crudo o por un repositorio inyectado para no tocar la guardia de
escrituras.** Sería engañar a la guardia: su censo de SQL crudo solo cuenta `UPDATE "orden"`, así que
la escritura quedaría fuera del inventario sin ninguna señal. Es el fallo de agosto de 2026 que la
guardia existe para impedir.

---

## 10 · Riesgos y límites

| Riesgo | Decisión |
| --- | --- |
| Un cierre con una barrida sin guía congelada queda inaprobable. | Decisión cerrada: sin salida de emergencia. R16 + R35 convierten el bloqueo en uno **con nombre**, avisado antes de escanear. La salida es rechazar el cierre. |
| Una barrida cuya orden ya no está en `novedad_interna` (la movió otra ruta antes de aprobar) se sigue exigiendo, aunque la liberación no la mueva. | Aceptado por la regla «todas las barridas» y por R6 (registro persistido, no estado vivo). R29 sigue valiendo porque toda barrida **liberada** tiene marca. |
| Más cierres difíciles de aprobar ⇒ más devoluciones esperando la aprobación (239). | Efecto buscado. Bodega está avisada (puerta resuelta por el humano). |
| La migración corre sobre la base local compartida entre worktrees. | Pone rojo el gate de otras features. Aplicar en el worktree propio y avisar al leader. |
| Choque de fecha de migración con otra ficha en paralelo. | Comprobar la última de `origin/dev` antes de aplicar. Renombrar solo si aún no se aplicó en ningún entorno. |

---

## 11 · Trazabilidad `R<n> → test`

`[E]` suite existente que se extiende · `[N]` archivo nuevo · `[=]` existente que debe quedar verde
**sin modificarse**.

| R | Test |
| --- | --- |
| R1, R2, R3 | `[E]` `tests/unit/types/gestion-retorno.test.ts`: `RETORNO_POR_ORIGEN` nombra los dos orígenes con `satisfies`; `vuelveABodegaElPaquete` para `barrida` y para los cinco resultados; `RETORNA_A_BODEGA` sin cambios; un `@ts-expect-error` con un tercer origen. |
| R4 | `[E]` `tests/unit/guards/confirmacion-incidentes-excluidos.guardia.test.ts`: dos casos nuevos con autocomprobación. |
| R5, R6, R7, R8, R9 | `[E]` `tests/unit/repositories/cierres-admin-confirmacion-fisica.test.ts` (`findBarridasDelCierre`: `WHERE` con `cierreId` y `alcanceWhere`, `select` de `ordenId`/`numGuia` congelada) **+** `[N]` `tests/integration/db/497-confirmacion-barridas-sql-real.test.ts` (contra Postgres: devuelve las barridas de este cierre y no las de otro; fuera de alcance da `[]`; la guía devuelta es la congelada aunque la de la orden cambie; un cierre sin filas da `[]`). |
| R10-R18, R20 | `[E]` `tests/unit/services/cierres-admin-confirmacion-fisica.test.ts`: falta una barrida, sobra una, duplicada, guía distinta de la congelada, barrida sin guía, origen cruzado (los dos sentidos), petición sin entradas de barrida, casos mixtos (gestiones completas + barrida faltante, y al revés), lista parcial que nunca aprueba. En todos, `repo.resolverCierre` **no se llama** y el error está en **su** clave. |
| R13, R18 (forma) | `[E]` `tests/unit/types/cierres-admin-confirmacion-schema.test.ts`: acepta `{ gestionId, numGuia }` y `{ ordenId, numGuia }`; rechaza una entrada con las dos claves; `.default([])`. |
| R19 | `[E]` `tests/unit/services/cierres-admin-confirmacion-fisica.test.ts` (sin gestiones que vuelvan ni barridas: `null` y `resolverCierre` con `confirmacionFisica: []`) **+** `[E]` `tests/components/CierresAdminConfirmacionFisica.test.tsx` (el payload de un cierre sin barridas es idéntico al de hoy). |
| R21 | `[E]` `tests/unit/services/cierres-admin-confirmacion-fisica.test.ts`: mismo bloqueo con un actor `adminSatelite`. |
| R22, R23, R24, R27, R28 | `[E]` `tests/unit/repositories/cierres-admin-confirmacion-fisica.test.ts`: `tx.cierreSinGestion.updateMany` con `WHERE { cierreId, ordenId IN }` (caso «TESTIGO del `cierreId` de la barrida»), `data` con una sola clave `confirmadaFisicaAt`; `count` corto lanza `ConfirmacionFisicaNoAplicableError`; con rechazo no se llama; con el cierre ya resuelto (`count = 0` en la transición) no se llama; sin barridas no se llama. |
| R11, R23, R29, R39 | `[N]` `tests/integration/db/497-confirmacion-barridas-sql-real.test.ts`: aprobar con la lista incompleta deja el cierre en `solicitado`, cero marcas, órdenes sin liberar y conteos de `wallet_movimiento`, `wallet_tienda_movimiento` y `pago_mensajero_movimiento` sin cambios; aprobar completo marca **todas** las barridas liberadas en la misma tx; forzar un `count` corto (una barrida borrada del set antes de escribir) revierte todo; los montos del cierre y las filas de dinero son iguales con y sin barridas confirmadas. |
| R24 (datos congelados) | `[N]` mismo archivo: `num_guia`, `num_remision`, `destinatario`, `producto`, `tienda_nombre`, `zona_nombre`, `estatus_origen_id` y `created_at` de la barrida no cambian tras aprobar. |
| R24 (dinero), R39 | `[=]` `tests/unit/guards/cierre-sin-gestion-sin-dinero.guardia.test.ts`. |
| R25, R41 | `[N]` `tests/integration/db/497-cierre-sin-gestion-confirmacion-migration.test.ts`: la columna existe, es `timestamp(3)`, nullable y sin default; las filas existentes quedan en `NULL`; el `down.sql` existe, la suelta y es idempotente. Molde: `tests/integration/db/confirmacion-fisica-migration.test.ts`. |
| R26 | `[=]` `tests/unit/guards/confirmacion-sin-lectores.guardia.test.ts`. |
| R29 | `[E]` `tests/unit/services/cierres-admin-service.aprobar.sin-gestion.test.ts`: el servicio pasa al repo las entradas de barrida validadas cuando hay liberación. |
| R30, R31 | `[E]` `tests/components/CierresAdminConfirmacionFisica.test.tsx`: sección «Novedad interna (N)» dentro de la misma lista, al final; filas con guía congelada, remisión, destinatario y estado; ningún texto «sin gestionar» (y `[=]` `nombres-estado-retirados.guardia.test.ts`). |
| R32, R33, R34, R35 | `[E]` `tests/components/CierresAdminConfirmacionFisica.test.tsx`: contador único que incluye barridas; leer la guía de una barrida la confirma; guía ajena avisa «no es de este cierre» y no marca; aviso de filas sin guía encima de la lista con su número. |
| R20 (UI), R36, R37, R38 | `[E]` `tests/components/CierresAdminConfirmacionFisica.test.tsx` (o la suite del módulo que ya prueba `pedirAprobacion`): botón bloqueado con una barrida pendiente y sin control de «aprobar de todas formas»; error del servidor en la fila de la barrida con la ventana abierta; cerrar la ventana no llama a la action; cierre solo con barridas abre la ventana. |
| R40 | `[=]` `tests/unit/repositories/cierres-admin-caja-cod.test.ts`: **verde sin tocar** (`git diff` vacío sobre el archivo). |

**Test rojo antes del arreglo** (tasks T1): el caso del servicio «falta una barrida» y el de la
integración «aprobar sin confirmar las barridas deja el cierre en `solicitado`» se escriben primero y
se ven en **rojo** contra el código de hoy, que aprueba.

**Contraprueba por mutación** (tasks T6): cada mutación debe poner rojo al menos un test nombrado
arriba, y el diff de la mutación debe quedar vacío al restaurar:

1. quitar las barridas del conjunto esperado del servicio;
2. comparar contra la guía viva en vez de la congelada (o no comparar);
3. quitar `cierreId` del `WHERE` del `updateMany` de barridas;
4. borrar `confirmadaFisicaAt` del `data` (o cambiar la clave);
5. quitar el `count !== ordenIds.length`;
6. quitar `cierre: alcanceWhere(alcance)` de `findBarridasDelCierre`;
7. en la UI, excluir las barridas de `progresoDePaquetes`;
8. en la UI, dejar `pedirAprobacion` con `retornables.length > 0`.

---

## 12 · Gate

El diff toca `db/schema.prisma`, una migración y `lib/types/`, así que `./init.sh --rapido` **se
amplía solo** con toda `tests/integration/db` (regla 5 de `CLAUDE.md`). No hace falta el completo:
esta ficha no toca el gate, ni `tests/fixtures/sin-comentarios.ts`, ni la config de build/tests.
Además se corren **a mano** las cinco guardias de §8. Hay que mirar los `skipped` de
`integration/db`, no solo el exit code.
