# Ficha 503 — Revisión

Rama `fix/503-ayuda-satelites-saldadas`, revisada en `51ebfea1a` contra `origin/dev` (`11aea840b`, que es la merge-base).
Búsqueda con Grep/Read: `codebase-memory-mcp` no conectó.

## Veredicto: OK

Sin bloqueantes. Dos hallazgos menores, ninguno pide cambiar la frase ni la pantalla.

## Checklist

### Trazabilidad, con cada test leído en el archivo real

| R | Test | Comprobado |
| --- | --- | --- |
| R1 | `tests/unit/docs/ayuda-wallet-satelites-498.test.ts:111` | Contra la sección recortada, literal a mano. Rojo con X4. |
| R2 | `ayuda-wallet-satelites-498.test.ts:115` (2 patrones) | Contra la sección. La frase vieja lo pone rojo (M1 del informe y autocomprobación). Ver hallazgo m1. |
| R3 | `ayuda-wallet-satelites-498.test.ts:119` (3 patrones) | Rojo con X1. El informe lo dejaba sin mutación: queda cerrado. |
| R4 | `tests/components/Conciliacion498.test.tsx:467`, aserción en `:495` | Monta `ConciliacionSatelite` real, busca la fila desde el rótulo, 0 botones, y una fila de control con «Corregir». Rojo con X2. |
| R5 | `tests/components/ConciliacionAcciones500.test.tsx:71-76` y `tests/integration/db/500-con-dinero-sql-real.test.ts:257`, `:275-276` | El fixture D es `esperado_regla_anterior = monto_recibido` (`:117`) y `:276` mide `cierresAdmin` en D. X2 pone rojo el de componente. La parte de Postgres no se repitió: T5 del leader. |

Apoyo fuera del mapa: la falta 0 de la saldada, que es lo que quita «Corregir», la fija
`tests/unit/utils/conciliacion-satelite.test.ts` también para `toBodegaResumenRow`, de donde lee `/cierres-admin`. Rojo con X5.

### La frase es cierta para la saldada

Leído en el código, no en el spec:

- [x] **Falta 0.** La migración M4 fija `esperado_regla_anterior = monto_recibido`; `aporteDeConsolidacion` devuelve ese valor y
  `faltaPorRecibir` resta el recibido. Las dos pantallas usan esas funciones (`SaldosSatelitesRepository.ts:94,108` y `CierreBodegaRepository.ts:116,144`).
- [x] **Estado «recibido».** `estadoConciliacionDe` (`cierre-labels.ts:676`): conciliada y sin faltante.
- [x] **Sin «Corregir».** `esCorreccion` (`ConciliacionAcciones.tsx:145-146`) exige «incompleto» o «recibido» de más.
- [x] **Sin «Marcar recibido».** Solo con «pendiente» (`:214`).
- [x] **Sin «Desmarcar».** `:237` exige `puedeDesmarcar`, y `puedeDesmarcarse` lo niega con `saldadaReglaAnterior` (`conciliacion-satelite.ts:100`).
  Las dos pantallas pasan el valor del servidor (`ConciliacionSatelite.tsx:345`, `CierresBodegaAdminModule.tsx:898`; el detalle lo calcula en `CierresBodegaAdminRepository.ts:422`).
- [x] **Sin otra vía.** `ConciliacionAcciones.tsx:151` es el único llamador de `corregirConsolidacionRecibidaAction` fuera de tests.
- [x] **El monto no se cambia desde la pantalla.** Sale de los puntos anteriores: el diálogo solo lo abren esos botones.

### Alcance

- [x] Fuera de `tests/`, `specs/` y `progress/` solo cambia `docs/ayuda/oficina/wallet-satelites.md`, tres líneas: `actualizado:` y la frase.
- [x] Sin cambios en `app/`, `components/`, `lib/` ni `db/`.
- [x] `fuentes:` ya lista los archivos que respaldan la frase.

### Aserciones

- [x] **Contra su propia fuente: no.** El test de la ayuda no importa nada de `components/` ni lee la frase de otro sitio, y los literales de «503/R4» van a mano.
  La verdad la mide el DOM, no la comparación de textos. `puedeDesmarcar: false` y la falta 0 del fixture son afirmaciones del doble, respaldadas por R5 y X5.
- [x] **CRLF: no se rompe.** Medido con la ayuda entera en CRLF en disco: 30 passed. El repo fija `eol=lf` y los tres archivos están en `i/lf w/lf`.
- [x] Las autocomprobaciones ejercen de verdad el recorte y los patrones; la sección vacía la caza R1 y el primer caso de autocomprobación.

### Tasks y checkpoints

- [x] T0-T7 marcadas `[x]`.
- [x] requirements (R numerados), design con alternativas descartadas (A1-A3), tasks.
- [x] Mapa R -> test en `progress/impl_503.md`, con líneas que coinciden con el archivo real.
- [x] Typecheck, lint y tests: gate del leader, `INIT_EXIT=0` en `progress/gate_503.log`. Medido sobre `92b423eea`; de ahí a HEAD solo cambian `impl_503.md` y `tasks.md`.
- [x] E2E: no aplica en este repo.
- [x] Tablas, RLS, migraciones, webhooks, capas, permisos, multi-país: no aplican, sin código de producción. Sin secretos en el diff.
- [ ] `progress/history.md`: pendiente, se hace al cerrar (`AGENTS.md`, paso 12). No bloquea esta revisión.

## Mutaciones propias

Una a una, con los tests reales, sobre `51ebfea1a`. Línea base sin mutar: 4 archivos, 83 passed. Cada mutación se comprobó aplicada antes de correr.

| Id | Mutación | Resultado |
| --- | --- | --- |
| X1 | Ayuda: «no deben nada» -> «no deben casi nada» | Muerta: R3 (1 failed, 29 passed) |
| X2 | `ConciliacionAcciones.tsx:214`: `estado !== "incompleto"`, «Marcar recibido» sale en la saldada | Muerta: «503/R4» y `ConciliacionAcciones500` (2 failed, 32 passed) |
| X3 | Ayuda: conservar la frase y añadir «Si hay un error, usá **Corregir**.» | **Sobrevive** (30 passed). Hallazgo m1 |
| X4 | Ayuda: la frase sin «ni **Desmarcar**» | Muerta: R1 (1 failed, 29 passed) |
| X5 | `aporteDeConsolidacion` ignora `esperadoReglaAnterior` | Muerta: 3 failed, 16 passed |

Revertidas con `git checkout`. Blobs con `git hash-object --no-filters`, para que el filtro `eol=lf` no tape un resto, iguales a HEAD:
ayuda `63db0c2026`, `ConciliacionAcciones.tsx` `490ae9627f`, `conciliacion-satelite.ts` `d78fd71e3c`. `git status --porcelain` vacío al terminar.

No se corrió el gate, ni la suite completa, ni dev server. T5, T6 y el gate son del leader y no se repitieron.

## Hallazgos

- **m1, menor. El patrón de R2 no ve la forma en voseo.** `/(usa|con)\s+[«*]*Corregir/` no casa con «usá **Corregir**», y la página está en voseo (X3 sobrevive).
  Solo afecta a una regresión futura: el texto de hoy cumple R2, y la frase vieja sí se detecta. El patrón es el que fija `design.md` §2, así que el implementer lo siguió. Bastaría `us[aá]`.
- **m2, menor. `progress/impl_503.md` tiene dos líneas rancias.** La tabla de estado dice «T7 | Parcial» y «Archivos tocados» dice «T0 a T6 marcadas», pero T7 está `[x]` y la sección «Gate del leader», al final del mismo archivo, ya lo cierra.

Lo ya conocido y fuera de alcance (región vacía en `/cierres-admin`, nota de 498/R43 para la ficha 506) no cambia el veredicto.
