# 504 — Diseño

Sin modelo de datos, migraciones, rutas, endpoints ni integraciones. Solo cambia
`components/shared/estado-cuenta/estado-cuenta-labels.ts`, además del test nuevo.

## 1. Lo medido en el código

- **Llamador:** uno solo, `TarjetasEstadoCuenta.tsx:54-57`, que elige la función por `vista`. Por él
  pasan las superficies de `EstadoCuenta.tsx:712`.
- **Lo que reciben:** `fraseDelSaldo(tipo, sentido, nombre, monto)` y
  `fraseDelSaldoParaLaTienda(sentido, monto)`. **No reciben el saldo:** `monto` es texto ya pintado por
  `money(sinSigno(saldoActual))`, sin signo. Un `"₡0"` no se puede comprobar sin parsear dinero, y este
  módulo declara que no convierte montos (R90 de la 458).
- **El cero existe como valor:** `en_cero`. Lo emite solo `sentidoDe`
  (`EstadoCuentaService.ts:650-655`), cuando `Prisma.Decimal(saldo).isZero()`.
- **Lo que emite el servidor:** tienda y mensajero, `empresa_debe | cuenta_debe | en_cero`; bodega,
  `por_entregar | en_cero | empresa_debe`.
- **Con un valor desconocido o `undefined`, hoy:** tienda y mensajero caen en «no se deben nada» (`:77`,
  `:87`), medido en `progress/impl_494.md:580-581` con `empresa_debe` sobre el cliente anterior. La
  bodega cae en «entregó ₡X de más» (`:73`). El tipo no protege: el valor llega del servidor en tiempo de
  ejecución. La línea de `money` sigue funcionando, porque no depende del sentido.
- **Cobertura actual de las frases:** el único literal de «no se deben nada» en `tests/` es el de la
  vista tienda (`saldo-tienda-card.negativo.test.tsx:80`). La frase en cero de la oficina y las tres de la
  bodega no tienen ningún literal.

## 2. Decisión

«Saldo en cero comprobado» es `sentido === "en_cero"`: el servidor solo lo emite tras `isZero()`, sobre el
mismo saldo que pinta la cifra (`EstadoCuentaService.ts:299-301`). Cada frase pasa a exigir su valor y la
salida por descarte es la frase neutra.

```ts
// fraseDelSaldo, rama bodega (R5)
if (sentido === "empresa_debe") return `${nombre} entregó ${monto} de más`;
return ESTADO_CUENTA_TEXTO.sentidoNoReconocido;

// fraseDelSaldo, tienda y mensajero (R1, R3)
if (sentido === "en_cero") return `${MARCA.nombre} y ${nombre} no se deben nada`;
return ESTADO_CUENTA_TEXTO.sentidoNoReconocido;

// fraseDelSaldoParaLaTienda (R2, R4)
if (sentido === "en_cero") return `${MARCA.nombre} y vos no se deben nada`;
return ESTADO_CUENTA_TEXTO.sentidoNoReconocido;
```

- **Contrato:** las firmas no cambian y siguen devolviendo `string`, así que `TarjetasEstadoCuenta.tsx` no
  se toca.
- **Texto:** clave nueva `sentidoNoReconocido` en `ESTADO_CUENTA_TEXTO`, con el literal que cierre P1. Se
  lee al llamar a la función, así que no importa que la constante se declare más abajo en el archivo.
- **Combinaciones que el servidor no emite:** tienda con `por_entregar` (hoy «no se deben nada») y bodega
  con `cuenta_debe` (hoy «entregó de más») pasan a la frase neutra. Ninguna persona las ve hoy, así que no
  rompen R6.
- **Sin aviso técnico:** las funciones son puras y se llaman al pintar. El propio texto hace visible el
  fallo.
- **Ayuda:** `docs/ayuda/` no se toca. Las frases conocidas no cambian y la neutra no es un estado del
  saldo que haya que explicar.

## 3. Trazabilidad y literales de contrato

Test nuevo: `tests/unit/components/frase-del-saldo-504.test.tsx`.

**Regla del test:** el texto esperado se escribe a mano. La marca sale de `NOMBRE_ESPERADO`
(`tests/fixtures/marca-esperada.ts`, literal independiente de `MARCA`). Prohibido comparar contra
`ESTADO_CUENTA_TEXTO.sentidoNoReconocido`, `MARCA` o las propias funciones: esa aserción sigue verde
aunque el texto cambie. Los valores ajenos al tipo se pasan con `as unknown as SentidoDelSaldo`.

Tabla de sentidos no reconocidos, `NO_RECONOCIDOS`: `"ordenex_debe"`, `"EN_CERO"`, `""`, `undefined` y `null`.

| R | Caso | Entrada | Esperado exacto |
| --- | --- | --- | --- |
| R1 | «en cero, oficina» | tienda y mensajero, `en_cero` | `Velox Courier y Tania Tienda no se deben nada`; `Velox Courier y Mario Mensajero no se deben nada` |
| R2 | «en cero, la tienda» | `en_cero` | `Velox Courier y vos no se deben nada` |
| R3 | «no reconocido, oficina» | tienda y mensajero × `NO_RECONOCIDOS` y `por_entregar` | frase neutra (literal de P1) |
| R4 | «no reconocido, la tienda» | `NO_RECONOCIDOS` y `por_entregar` | frase neutra |
| R5 | «no reconocido, bodega» | `NO_RECONOCIDOS` y `cuenta_debe` | frase neutra |
| R6 | «frases conocidas» | tienda `empresa_debe`, `₡9.000` | `Velox Courier le debe ₡9.000 a Tania Tienda` |
| R6 | | tienda `cuenta_debe`, `₡9.000` | `Tania Tienda le debe ₡9.000 a Velox Courier` |
| R6 | | mensajero `empresa_debe`, `₡9.000` | `Velox Courier le debe ₡9.000 a Mario Mensajero` |
| R6 | | mensajero `cuenta_debe`, `₡9.000` | `Mario Mensajero le debe ₡9.000 a Velox Courier` |
| R6 | | bodega `por_entregar`, `₡9.000` | `Bodega Norte tiene ₡9.000 por entregar` |
| R6 | | bodega `en_cero` | `Bodega Norte no tiene nada por entregar` |
| R6 | | bodega `empresa_debe`, `₡9.000` | `Bodega Norte entregó ₡9.000 de más` |
| R6 | | la tienda, `empresa_debe`, `₡9.000` | `Velox Courier te debe ₡9.000` |
| R6 | | la tienda, `cuenta_debe`, `₡9.000` | `Le debés ₡9.000 a Velox Courier` |
| R7 | «la tarjeta con sentido no reconocido» | `render(<TarjetasEstadoCuenta>)` en vista oficina y tienda, con `saldoActual: "-15000.00"`, `signo: "negativo"`, `sentido: "ordenex_debe"` | frase neutra y `-₡15.000`; el texto de la tarjeta no contiene `no se deben` |

### Mutaciones que deben poner rojo el test

| # | Mutación en producción | Cae |
| --- | --- | --- |
| M1 | `fraseDelSaldo`: volver a terminar en `return «no se deben nada»` sin comprobar `en_cero` | R3 |
| M2 | `fraseDelSaldoParaLaTienda`: lo mismo | R4 |
| M3 | `fraseDelSaldo`: quitar la rama `en_cero` | R1 |
| M4 | `fraseDelSaldoParaLaTienda`: quitar la rama `en_cero` | R2 |
| M5 | Bodega: volver a terminar en `return «entregó de más»` sin comprobar `empresa_debe` | R5 |
| M6 | `sentidoNoReconocido`: cambiar una palabra del texto | R3, R4, R5, R7 |
| M7 | `TarjetasEstadoCuenta`: convertir en `"en_cero"` todo sentido que no sea `empresa_debe`, `cuenta_debe` o `por_entregar` antes de llamar a la función | R7 |
| M8 | Intercambiar las frases de `empresa_debe` y `cuenta_debe` en cualquiera de las dos funciones | R6 |

M6 es la que distingue un literal de contrato de una comparación contra su propia fuente. M7 es la que
comprueba el cableado: los tests de las funciones siguen verdes con ella, y solo cae el `render` de R7.

## 4. Alternativas descartadas

1. **Comprobar el importe además del sentido** (pasar `saldoActual` o `signo` a la función y exigir que
   sea cero). Descartada: `sentido` y `signo` salen de la misma lectura en el mismo `return`, así que la
   contradicción no es alcanzable. Además obliga a cambiar firmas y llamador, o a leer dinero en un
   módulo que declara no hacerlo.
2. **Deducir la frase desde `signo` cuando el sentido es desconocido.** Descartada: repite `sentidoDe` en
   el cliente, y la bodega invierte el significado del signo. Son dos fuentes de verdad para una frase
   sobre dinero, y un nombre nuevo podría volver a desalinearlas.
3. **Alias de los nombres antiguos en el cliente** (`ordenex_debe` como `empresa_debe`). Descartada: cura
   solo el nombre que ya pasó y deja el descarte para el siguiente. Para el cruce de versiones, la 494 también
   decidió ir sin alias (`specs/494-marca-identificadores-internos/design.md §3.2`).
4. **Reescribir como `switch` exhaustivo o `Record`.** Descartada: es más cambio para el mismo resultado.
   El tipo no protege en ejecución y seguiría haciendo falta la salida por defecto.
