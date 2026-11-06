# Ficha 506 — Diseño

Sin migración, sin endpoints nuevos, sin cambio de contratos del servidor. Solo textos y una condición de render.

## 1. Lo comprobado en el código

| Caso | Datos | Botón real (`ConciliacionAcciones.tsx:214-250`) |
| --- | --- | --- |
| Recibida exacta con dinero | `conciliado`, falta 0, `puedeDesmarcar` falso (`conciliacion-satelite.ts:95-101`) | **Ninguno.** Fijado por `ConciliacionAcciones502.test.tsx:124-129` |
| Saldada sin corregir | Igual, y además saldada | **Ninguno** |
| Recibida exacta sin dinero | `puedeDesmarcar` verdadero | «Desmarcar» |
| Incompleta o de más | falta distinta de 0 | «Corregir», y «Desmarcar» si se puede |
| Sin marcar | sin conciliar | «Marcar recibido» |

Consecuencias:

- La frase correcta para la recibida exacta con dinero es «ningún botón», no «Corregir» ni «Desmarcar».
- **La región vacía no es exclusiva de la saldada.** Sale también con toda recibida exacta con dinero, que la 502 (Q2)
  describe como el caso más frecuente. El arreglo cubre las dos, y cumple el encargo: «no montar la región si no hay nada
  que mostrar».
- La nota solo se pinta en `ConciliacionSatelite.tsx:450`. `/cierres-admin` no la lleva.

## 2. Decisiones técnicas

- **D1. El aviso `con_asientos` entra en el alcance.** La 502 (Q2) lo cuenta entre los tres textos con esta promesa y está
  citado en `wallet-satelites.md:116-117`, dentro de lo encargado. Dejarlo obligaría a la ayuda a seguir citando una
  promesa falsa. La fila ya muestra «Corregir» cuando existe, así que el aviso no pierde nada útil.
- **D2. Los dos avisos dicen solo el hecho**, con la misma forma: no se puede revertir. Ninguno indica otra vía, porque no
  la hay en todos los casos.
- **D3. La nota sigue nombrando «Corregir», con su condición.** Quitarlo dejaría sin decir cómo se cambia un monto
  incompleto. «Si coincide, no hay botón para cambiar el monto» es verdad también en la exacta sin dinero, que ofrece
  «Desmarcar» pero ningún botón de monto, y en la saldada.
- **D4. La condición se escribe una sola vez.** Ver §4.
- **D5. El título de la sección pasa a «Una vez marcada».** Nada enlaza a su ancla (buscado en `app`, `lib`, `components`,
  `tests` y `docs`).

## 3. Textos

| Dónde | Antes | Después |
| --- | --- | --- |
| `CONCILIACION_RESPUESTA.saldadaReglaAnterior` (`conciliacion-labels.ts:105`) | «…no se puede revertir; si el monto no es el correcto, corrígelo.» | «Esta consolidación está saldada con la regla anterior: no se puede revertir.» |
| `CONCILIACION_RESPUESTA.conAsientos` (`:103`) | «Ya entró a la caja: corrige el monto en vez de revertir» | «Ya entró a la caja: no se puede revertir.» |
| `NOTA_CONCILIACION_ASIENTA` (`:118-120`) | «…Después no se puede desmarcar: si el monto no es el correcto, usa «Corregir»» | «Marcar recibido asienta el dinero en la caja. Después no se puede desmarcar, y «Corregir» solo aparece si lo recibido quedó por debajo o por encima de lo que debe: si coincide, no hay botón para cambiar el monto.» |

`NOTA_CONCILIACION_ASIENTA` sigue siendo una concatenación de cadenas entre comillas dobles, sin comillas dobles dentro: la
guardia de la 498 la lee con una expresión regular sobre esa forma.

### La sección de la ayuda (`wallet-satelites.md:110-123`, en voseo como el resto de la página)

```markdown
## Una vez marcada

> Marcar recibido asienta el dinero en la caja. Después no se puede desmarcar, y «Corregir» solo aparece si lo recibido quedó por debajo o por encima de lo que debe: si coincide, no hay botón para cambiar el monto.

Cuando la fila ofrece **Corregir**, cambia el monto: la caja recibe solo la diferencia entre lo de antes y lo
nuevo, y queda registrado **quién corrigió y cuándo**. Si intentás **Desmarcar** una consolidación que ya entró a
la caja, la app no deshace nada y te dice «Ya entró a la caja: no se puede revertir.».

**Corregir** aparece en una consolidación recibida incompleta o recibida de más.

Una consolidación recibida por el monto exacto que ya movió dinero en la caja no ofrece ningún botón, ni
**Corregir** ni **Desmarcar**: su monto no se puede cambiar desde la pantalla.

**Desmarcar** solo aparece en una consolidación que todavía no movió dinero en la caja. Si lo ves en una
que sí lo movió es porque la pantalla se cargó antes de que alguien corrigiera el monto: la app te avisa y
no cambia nada.
```

La cita de la nota va en una sola línea: la guardia hace `toContain` del literal. `actualizado:` del encabezado pasa a la
fecha de la implementación.

## 4. La región de `/cierres-admin`

En `cierre-labels.ts`, junto a `estadoConciliacionDe` y `llegoDeMas`, módulo puro que ya importan los dos lados:

```ts
export function accionesConciliacionDe(
  marca: { conciliado: boolean; faltaPorRecibir: string },
  puedeDesmarcar: boolean,
): { marcar: boolean; corregir: boolean; desmarcar: boolean };

export function hayAccionConciliacion(
  marca: { conciliado: boolean; faltaPorRecibir: string },
  puedeDesmarcar: boolean,
): boolean;
```

- `ConciliacionAcciones` deriva de `accionesConciliacionDe` sus tres botones y su `esCorreccion`, que hoy decide también el
  envío. Sin cambio de comportamiento.
- `CierresBodegaAdminModule.tsx:881` pasa a
  `puedeConciliar && hayAccionConciliacion(detalle.cierre, detalle.puedeDesmarcar)`. La misma condición que pinta los botones
  decide la región, así que no pueden separarse. Se actualiza el comentario de `:878-880`.
- `detalle` solo se asigna al abrir (`:462`) y se limpia al cerrar (`:498`), y `onCambio` cierra el detalle: la región no
  puede desmontarse con un diálogo suyo abierto.

## 5. Alternativas descartadas

1. **Condicionar la región a `saldadaReglaAnterior`.** Es lo que sugiere la ficha, pero deja vacía la recibida exacta con
   dinero, y a una saldada con falta le quitaría el «Corregir» que hoy tiene. Es la condición equivocada.
2. **Copiar la condición de los botones en el módulo.** Dos copias de la misma regla acaban diciendo cosas distintas: es el
   defecto que la cabecera de `ConciliacionAcciones` evita compartiendo el componente.
3. **Mover la `<section>` dentro de `ConciliacionAcciones`.** Arrastra una región a `/wallet/satelites`, donde hay una por
   fila, o una prop de modo. Más cambio para el mismo resultado.
4. **Añadir «Corregir» a la recibida exacta.** Descartado por la decisión Q2 de la 502.

## 6. Tests y mutaciones

### Literales que cambian (todos de contrato; ninguno se sustituye por su constante)

| Sitio | Literal | Clase | Qué se hace |
| --- | --- | --- | --- |
| `Conciliacion498.test.tsx:46` `TEXTO_R21` | aviso con asientos | Contrato 498/R21, relevado por R2 | Literal nuevo |
| `Conciliacion498.test.tsx:48` `NOTA_R43` | nota | Contrato 498/R43, relevado por R3 | Literal nuevo. El caso 502/R1 (`:288`) lo usa para afirmar ausencia y sigue valiendo |
| `Conciliacion498.test.tsx:303` | aviso saldada | Contrato de la revisión m2, relevado por R1 | Literal nuevo |
| `ConciliacionAcciones500.test.tsx:113` y `:116` | los dos avisos | Polizón: el contrato de 500/R7 es «dentro del diálogo, abierto, sin releer». Pero compara contra el texto real y mata un cambio de aviso | Literal nuevo, a mano |
| `wallet-satelites.test.tsx:461` | nota | Contrato 498/R43 | Literal nuevo |
| `aporte-satelite-fuente-unica-498.guardia.test.ts:83` | nota | Contrato 498/R43, ancla constante y ayuda | Literal nuevo |
| `ayuda-wallet-satelites-498.test.ts:26` y `:32` | aviso y nota en la ayuda | Contrato 498/R44 | Patrón nuevo; `:26` tolera el salto de línea con `\s+` |

Sin cambios, y deben seguir verdes: la fila 502/R13 (`ayuda-wallet-satelites-498.test.ts:30`), 500/R8 (`:28`), `tests/unit/guards/textos-satelite-definitivos-500.guardia.test.ts` y el bloque 503.

### Test ajeno que se pondría rojo por R9

`CierresBodegaAdminDebe498.test.tsx:206`, «el detalle dice que no (movió dinero)», monta una recibida exacta sin poder
desmarcar, y `abrirDetalle` (`:155`) espera la región: tras el cambio agotaría el tiempo. Su contrato (no hay «Desmarcar») se
conserva y se mide en todo el diálogo, no solo en la región. `abrirDetalle` deja de esperar la región y espera el diálogo
«Detalle del cierre de bodega» con el título «Totales del cierre de bodega», premisa de que el detalle cargó. Los casos con
botones piden la región aparte. Es el único archivo de tests que nombra la región.

### Tests nuevos

**Bloque «506» en `CierresBodegaAdminDebe498.test.tsx`.** `abrirDetalle` gana un parámetro de permiso.

| Req | Caso | Afirma |
| --- | --- | --- |
| R9 | Saldada sin corregir (`saldadaReglaAnterior`, falta `"0.00"`, sin desmarcar) | Premisa del detalle cargado; `queryByRole("region", { name: "Conciliación del cierre de bodega" })` nulo |
| R9 | Recibida exacta con dinero, no saldada | Lo mismo |
| R10 | Sin marcar | Región con «Marcar recibido» |
| R10 | Incompleta | Región con «Corregir» |
| R10 | De más | Región con «Corregir» |
| R10 | Exacta con `puedeDesmarcar` | Región con «Desmarcar» |
| R10 | Saldada con falta `"5000.00"` | Región con «Corregir» |
| R11 | Sin marcar, `puedeConciliar={false}` | Premisa del detalle cargado; región nula |

**Bloque «506» en `ayuda-wallet-satelites-498.test.ts`,** sobre el recorte de la sección con la misma técnica que el de la 503
(generalizar `seccionSaldada` para recibir el título):

- R4: contiene la nota literal y el aviso (tolerando saltos de línea).
- R5: patrón de la frase de la recibida exacta.
- R6: el título viejo no está en la página, y el recorte no casa con `/(usa|usá|con)\s+[«*]*Corregir/`,
  `/si\s+el\s+monto\s+(que\s+marcaste\s+)?no\s+(es|era)\s+el\s+correcto/i` ni `/corrige\s+el\s+monto/`. Incluye el voseo, el hueco
  que encontró la revisión de la 503.
- R7: patrones de «solo la diferencia» y «quién corrigió y cuándo».
- Autocomprobación: la sección vieja, sembrada a mano como literal, enciende cada patrón de R6; la sección nueva sin la frase
  de R5 apaga el suyo.

### Mutaciones que deben matar cada requisito

| R | Mutación | Debe caer |
| --- | --- | --- |
| R1 | Restaurar el aviso viejo de la saldada | `Conciliacion498` y `ConciliacionAcciones500` |
| R2 | Restaurar `conAsientos` | Los mismos |
| R3 | Restaurar la constante de la nota | `Conciliacion498` caso R43, `wallet-satelites` caso R43, guardia |
| R4 | Restaurar la cita vieja de la nota en la ayuda | Guardia y `ayuda-wallet-satelites-498:32` |
| R5 | Borrar la frase de la recibida exacta | Bloque 506 de la ayuda |
| R6 | Añadir «Si hay un error, usá **Corregir**.» a la sección | Bloque 506 de la ayuda (es la X3 que sobrevivió en la 503) |
| R7 | Borrar «quién corrigió y cuándo» | Bloque 506 de la ayuda |
| R8 | En `accionesConciliacionDe`, `corregir` sin `llegoDeMas` | `ConciliacionAcciones502` 502/R6 y 500/R3 |
| R9 | Dejar la condición en `puedeConciliar` solo | Los dos casos R9 |
| R9, R10 | Sustituir la condición por `!saldadaReglaAnterior` | R9 exacta con dinero y R10 saldada con falta |
| R10 | `hayAccionConciliacion` sin el término `desmarcar` | R10 exacta con `puedeDesmarcar` |
| R10 | `hayAccionConciliacion` sin el término `corregir` | R10 incompleta, de más y saldada con falta |
| R10 | `hayAccionConciliacion` sin el término `marcar` | R10 sin marcar |
| R11 | Quitar `puedeConciliar &&` | R11 |

## 7. Otros textos con esta promesa

Búsqueda en `app`, `lib`, `components`, `tests` y `docs/ayuda`, sin el grafo porque `codebase-memory` no conecta.

| Texto | Veredicto |
| --- | --- |
| `conciliacion-labels.ts:103` `conAsientos` | **Se cambia** (D1) |
| `wallet-satelites.md:110` título «Una vez marcada, se corrige» | **Se cambia** (D5) |
| `wallet-satelites.md:114` «Si el monto que marcaste no era el correcto, **Corregir** lo cambia» | **Se cambia** (§3) |
| Comentarios: `conciliacion-labels.ts:114-116`, `ConciliacionAcciones.tsx:67-73`, `CierresBodegaAdminModule.tsx:526-527` y `:860-862`, `lib/actions/conciliacion-satelites.ts:106` (cita el literal) | **Se actualizan.** No los ve nadie, pero repiten la promesa o el texto |
| `lib/repositories/CierresBodegaAdminRepository.ts:568`, comentario «se corrige» | Se queda: describe el servidor, que sí admite la corrección |
| `wallet-caja.md:166` «la bodega paga lo que faltaba y se corrige el monto» | Se queda: es una incompleta, que sí ofrece el botón |
| `wallet-satelites.md:119` y `CONCILIACION_ACCION.corregir` | Se quedan: ya dicen la condición correcta |
| `MarcarRecibidoDialog`, `tituloCorregir`, `confirmarCorregir` | Se quedan: solo salen con el botón pulsado |
| `cierres.md`, `wallet-tiendas.md`, `cierres-admin` de mensajero, novedades y órdenes | Otra «corrección», sin relación con la conciliación |

## 8. Riesgo

Bajo. Los cambios de texto no tocan lógica. La extracción de `accionesConciliacionDe` la cubren las suites 500, 502 y 498 tal cual
están. Una pestaña abierta durante el despliegue sigue con el texto viejo hasta recargar, sin efecto en datos.
