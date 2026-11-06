# Ficha 506 — Revisión

Rama `fix/506-saldadas-textos-corregir`, revisada en `c78b4912e` contra `origin/dev` (`cb61df61b`, igual a la merge-base).
Búsqueda con Grep/Read: `codebase-memory-mcp` no conectó. Por encargo del leader no se corrió el gate, ni la suite completa,
ni dev server. Su gate se comprobó en `progress/gate_506.log`: `INIT_EXIT=0`, sobre `a316021c4`; `c78b4912e` solo toca
`progress/impl_506.md` y `tasks.md`.

## Veredicto: OK

Sin bloqueantes. Cinco hallazgos menores, abajo. El más importante para el leader es M1: **el encargo y el spec discrepan
sobre el rol sin permiso**, y el código sigue al spec.

## Checklist

- [x] **Trazabilidad.** R1 a R11 leídos en el test real; ninguno vacío. Tabla abajo.
- [x] **Tasks.** 13 de 13 en `[x]`.
- [x] **Literales contra `design.md` §3.** Medido con script: los dos avisos y la nota, idénticos en diseño y constante; la
      sección de la ayuda, idéntica byte a byte al bloque del diseño. LF, 0 CR. `actualizado: 2026-11-06`.
- [x] **«El servidor no cambia».** `lib/actions/conciliacion-satelites.ts` aparece en el diff con UNA línea, dentro de un
      bloque de comentario (`:106`). Inocuo, previsto en `design.md` §7 y en T2.3. Ningún otro archivo de `lib/` cambia.
- [x] **Sin botones nuevos.** `accionesConciliacionDe` reproduce las tres condiciones de origen tal cual; `montoActual` y
      `esCorreccion` equivalen a los de antes.
- [x] **Tests ajenos adaptados.** Ninguna aserción se quita (detalle abajo).
- [x] **Ninguna aserción contra su propia fuente.** Ningún test importa `CONCILIACION_RESPUESTA`, `NOTA_CONCILIACION_ASIENTA`,
      `accionesConciliacionDe` ni `hayAccionConciliacion`. La guardia de la 498 lee la constante por regex y la compara con un
      literal a mano, que es su contrato.
- [x] **Mutaciones propias.** 7, 6 matadas y 1 viva (M2). Árbol restaurado, blobs verificados.
- [x] **Tests ejecutados por el revisor.** 8 archivos, 180 de 180, 0 `skipped`, antes y después de las mutaciones.
- [x] **E2E.** No aplica en este repo; los flujos de dinero no cambian.
- [x] **Datos y seguridad.** Sin migración, sin tablas, sin webhooks, sin secretos, sin hardcode de contexto.
- [x] **Capas.** `cierre-labels.ts` es módulo puro y `ConciliacionAcciones` ya lo importaba.
- [ ] **`progress/history.md`.** Sin entrada, como corresponde: `AGENTS.md` F2.6 la pide tras el merge. Pendiente del cierre.

## Los textos, contra el código

**«Ya entró a la caja: no se puede revertir.» cuando la fila SÍ ofrece «Corregir».** Es cierto y no contradice al botón.

- Solo se pinta dentro del diálogo de «Desmarcar», tras responder el servidor `con_asientos`
  (`ConciliacionAcciones.tsx:187-191`), y el repositorio devuelve eso sin escribir nada (`CierresBodegaAdminRepository.ts:664`).
- Habla de revertir, no del monto: no dice que el monto no se pueda cambiar. Si la fila ofrece «Corregir», ese botón sigue
  ahí y sigue valiendo.
- En la exacta con dinero, con la pantalla desactualizada, es donde el texto viejo mentía, porque esa fila no tiene «Corregir».

**Aviso de la saldada.** Cierto: lo devuelve el corte de `:673`. Una saldada con dinero cae antes en `con_asientos` y recibe el
otro aviso, también cierto.

**La nota.** «Corregir solo aparece si quedó por debajo o por encima» es exactamente incompleto, o recibido con `llegoDeMas`,
con `-0.00` contado como cero (fijado por 502/R6). «Si coincide, no hay botón para cambiar el monto» vale también en la exacta
sin dinero, que ofrece «Desmarcar» y ningún botón de monto. «Después no se puede desmarcar» no vale para una recibida sin dinero:
fuera de alcance por escrito en `requirements.md` y acotado en la ayuda.

**La ayuda, R5.** `puedeDesmarcarse` da falso con dinero (`conciliacion-satelite.ts:100`) y falta 0 no da `corregir`: ningún
botón. Cierto.

## La región de `/cierres-admin`

`CierresBodegaAdminModule.tsx:884`: exige `puedeConciliar` y `hayAccionConciliacion(detalle.cierre, detalle.puedeDesmarcar)`.

| Caso | Región | Medido en |
| --- | --- | --- |
| Puede conciliar, sin ninguna acción (saldada sin corregir, exacta con dinero) | No | R9, `:255` |
| Puede conciliar, con alguna acción (5 filas) | Sí, con el botón dentro | R10, `:264` |
| Sin permiso, cualquier estado | **No** | R11, `:276` |

- La región tiene un único hijo, `ConciliacionAcciones`, con los mismos dos datos que la condición. «Sin acción» equivale a «sin
  contenido»: no se oculta nada más.
- `detalle` se asigna solo al abrir (`:463`) y se limpia al cerrar (`:499`); `onCambio` cierra: no se desmonta con un diálogo abierto.
- El resto del detalle no depende de esta condición: los tests esperan el diálogo con sus totales antes de afirmar la ausencia.

## Mapa R → test, leído

| R | Test | Qué afirma de verdad |
| --- | --- | --- |
| R1 | `Conciliacion498.test.tsx:293`, `ConciliacionAcciones500.test.tsx:112` | `toBe` del literal, dentro del diálogo, sin `onCambio` |
| R2 | `Conciliacion498.test.tsx:261`, `ConciliacionAcciones500.test.tsx:112` | Igual; la mutación 3 (quitar el punto final) cae en los dos |
| R3 | `Conciliacion498.test.tsx:410`, `wallet-satelites.test.tsx:455`, guardia `:156` | `toBe` del `role=note` y de la constante |
| R4 | Guardia `:164`, `ayuda-wallet-satelites-498.test.ts:26`, `:32`, `:188` | Sección recortada, literal a mano |
| R5 | Ayuda `:193` | Regex de la frase, con autocomprobación `:227` |
| R6 | Ayuda `:197`, `:201` | Lista de patrones prohibidos: ver M2 |
| R7 | Ayuda `:205`, `:30` | Tres patrones sobre el recorte |
| R8 | `ConciliacionAcciones502.test.tsx:124`, `ConciliacionAcciones500.test.tsx:71`, `Conciliacion498.test.tsx:467` | Cero botones en la fila |
| R9 | `CierresBodegaAdminDebe498.test.tsx:255` | Región nula tras esperar el diálogo con «Totales del cierre de bodega» |
| R10 | `CierresBodegaAdminDebe498.test.tsx:264` | Botón `within` la región |
| R11 | `CierresBodegaAdminDebe498.test.tsx:276` | Región nula, con la misma premisa |

## Tests ajenos adaptados

- `CierresBodegaAdminDebe498`: 500/R3 «dice que no» pasa de medir en la región a medir en todo el diálogo: la red se amplía, y una
  carga fallida no la deja en verde porque la premisa de los totales es previa. 500/R3 «dice que sí» y 502/R7 siguen midiendo dentro
  de la región, ahora pedida aparte, y las mutaciones 1 y 2 los ponen rojos.
- `Conciliacion498`, `ConciliacionAcciones500`, `wallet-satelites`, la guardia y las dos filas de R44: solo cambia el literal, y sigue
  escrito a mano.
- Es el único archivo de tests que nombra la región (`:162`).

## Mutaciones del revisor

Distintas de las 14 del implementer. Arnés propio con reporte JSON de vitest: línea base 180 de 180 exigida antes de empezar, y patrón único.

| # | Mutación | Corridos | Rojos | Resultado |
| --- | --- | --- | --- | --- |
| 1 | `corregir` sin la rama de más | 180 | 9 | Matada: R10 «de más», 502/R7, 502/R9, 502/R10 |
| 2 | La región pasa `false` en vez de `detalle.puedeDesmarcar` | 180 | 2 | Matada: R10 «exacta que se puede desmarcar», 500/R3 |
| 3 | `conAsientos` sin punto final | 180 | 2 | Matada: 498/R21, 500/R7 |
| 4 | La ayuda cita «no se puede deshacer» | 180 | 2 | Matada: 498/R44, R4 |
| 5 | Añadir a la sección «Si te equivocaste en el monto, **Corregir** lo cambia.» | 180 | 0 | **VIVA**: ver M2 |
| 6 | `desmarcar` sin mirar el estado | 180 | 1 | Matada: 500/R3 «sin marcar» |
| 7 | `esCorreccion` también con `desmarcar` | 180 | 5 | Matada, de rebote: ver M5 |

Blobs tras revertir, iguales a `HEAD` con `git hash-object`: `cierre-labels.ts` `f6bb5893d`, `CierresBodegaAdminModule.tsx` `4297454c1`,
`conciliacion-labels.ts` `38a43764d`, `ConciliacionAcciones.tsx` `72246ad50`, `wallet-satelites.md` `98c0c4e6d`.

## `design.md` §7: ¿queda algún texto con la misma promesa?

**Visible para el usuario: ninguno.** Sin rastro de los textos viejos en `app`, `components`, `docs/ayuda`, `hooks`, `public` ni `scripts`.
En `app/(app)/wallet/satelites` no aparece «Corregir» escrito: sale de las constantes compartidas.

- `wallet-caja.md:166` «la bodega paga lo que faltaba y se corrige el monto»: se queda, habla de una incompleta. Cierto.
- `conciliacion-labels.ts:22`: lleva su condición. Cierto.
- `wallet-satelites.md:124` «antes de que alguien corrigiera el monto»: describe un caso real (incompleta sin dinero, y otra persona corrige).

**En comentarios, sí:** ver M3.

## Hallazgos

**M1, menor. El encargo y el spec discrepan sobre el rol sin permiso.** El encargo pedía comprobar que la región «sigue montada [...]
incluido el rol sin permiso». El código hace lo contrario, y es correcto: R11 exige NO montarla, `origin/dev` ya tampoco la montaba
y `ConciliacionAcciones` devuelve `null` sin permiso. No es regresión ni defecto; se anota para que el leader
no lea como cumplida esa frase.

**M2, menor. R6 es una lista de patrones y deja pasar otra redacción.** «Si te equivocaste en el monto, **Corregir** lo cambia.» dice sin
condición lo que R6 prohíbe y sobrevive con 0 rojos, aunque «**Corregir** lo cambia» es justo un fragmento de la sección vieja. El texto de
hoy cumple R6; lo que falta es red para el futuro. Basta añadir a `PROHIBIDOS_R6` un patrón para «**Corregir** lo cambia».

**M3, menor. Comentarios con la promesa, fuera de la tabla de `design.md` §7.** No los ve nadie, pero el §7 decidió actualizar los que
repiten la promesa.

- `lib/interfaces/services/IConciliacionSatelitesService.ts:74`, «la pantalla pide corregir el monto en vez de revertir»: **ya es falso**, y
  describe la pantalla. Es el que hay que cambiar.
- `IConciliacionSatelitesService.ts:82` «no se revierte, se corrige» y `:105`; `CierresBodegaAdminRepository.ts:662`
  «Se corrige el monto en vez de revertir (R21)»; `ICierresBodegaAdminRepository.ts:216`: describen el servidor, que sí admite la
  corrección, como `:568`, que el §7 dejó. Pueden quedarse.

**M4, menor. `progress/impl_506.md` quedó con frases viejas.** «`tasks.md`: marcado, con T4.3 abierta», «El gate no se corrió» y la sección
«Sin ejecutar» siguen ahí, aunque `tasks.md` tiene T4.3 en `[x]` y la sección final registra el gate. La sección final deja claro el estado real.

**M5, menor. Sin caso directo para «la exacta desmarcable no ofrece Corregir».** La nota lo afirma («si coincide, no hay botón para cambiar el
monto», D3). La mutación 7 cae, pero de rebote: los 5 rojos son R25 y 473/R14-R17, escritos para una incompleta. La fila R10 «exacta que se puede
desmarcar» solo mira que esté «Desmarcar». Un `queryByRole` de «Corregir» en esa fila lo fijaría.

Ninguno bloquea: M2, M3 y M5 se pueden recoger aquí o dejar como deuda, a criterio del leader.
