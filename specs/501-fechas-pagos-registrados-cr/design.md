# Ficha 501 — Diseño

Arreglo mínimo en la capa de presentación. Sin migraciones, sin RLS, sin rutas nuevas, sin cambios en
contratos ni en integraciones.

## Lo confirmado en el código (2026-11-04)

Leído en el árbol de trabajo de `dev`. El MCP `codebase-memory` no conectó (timeout): la búsqueda se
hizo con Grep y Read.

| Sitio | Hoy | Tipo de dato |
|---|---|---|
| `components/shared/liquidacion/PagosRegistradosTabla.tsx:64-66` | alias local `dia(iso)` → `fechaDiaISO` | compartido, ver abajo |
| `PagosRegistradosTabla.tsx:80` | `dia(anulacion.anuladoAt)` | instante |
| `PagosRegistradosTabla.tsx:129` | `dia(p.registradoAt)` | instante |
| `PagosRegistradosTabla.tsx:98` | `dia(p.fechaPago)` | día calendario |
| `pagos-registrados-descarga-columnas.ts:71` | `fechaDiaISO(pago.registradoAt)` | instante |
| `pagos-registrados-descarga-columnas.ts:74` | `fechaDiaISO(anulacion.anuladoAt)` | instante |
| `pagos-registrados-descarga-columnas.ts:65` | `fechaDiaISO(pago.fechaPago)` | día calendario |

Origen de los datos, en `lib/repositories/LiquidacionPagoRepository.ts`:

- `registradoAt` es `createdAt.toISOString()` (`:94`).
- `anuladoAt` es `createdAt.toISOString()` (`:104` y `:447`).
- `fechaPago` es `@db.Date` recortado a `"YYYY-MM-DD"` (`:92`, `lib/types/liquidacion.ts:246`).

### La trampa de `:65`

La ficha cita `PagosRegistradosTabla.tsx:65` como si fuera un solo uso. **Esa línea es el cuerpo de un
alias que también usa `fechaPago`.** Cambiar ahí la función arreglaría las dos fechas de instante y
rompería la del pago: `fechaDiaInstanteCR("2026-07-30")` interpreta medianoche UTC y devuelve
`2026-07-29`. El test existente `PagosRegistradosTabla.test.tsx:138` caza ese error.

### Otros consumidores de los mismos instantes

Búsqueda de `registradoAt`, `anuladoAt` y `.anulacion` en `app/` y `components/`:

- **Ninguno más pinta estos instantes.** Fuera de los dos archivos de arriba, `registradoAt` y
  `anuladoAt` no aparecen en código de `app/` ni de `components/`.
- `AnularPagoDialog.tsx` y el `aria-label` de `PagosRegistradosTabla.tsx:211` usan `fechaPago`, que está
  bien.
- `PagosTiendaEstadoCuenta.tsx` y `PagoMensajeroSeccion.tsx` solo montan la tabla: el arreglo les llega a
  las dos pantallas sin tocarlas.
- `LiquidacionService.ts:1160` ordena por `registradoAt`. No lo pinta, y no se toca.
- Los `.anulacion` de `EstadoCuenta.tsx`, `estado-cuenta-lineas.ts`, `EstadoCuentaTienda.tsx` y
  `VerMovimientoCaja.tsx` son de otro tipo y otra pantalla: fuera de alcance.
- `fechaDiaISO(` no tiene más llamadas en `app/` ni en `components/`.

## Decisiones

### D1. Función

Las cuatro lecturas de instante pasan a `fechaDiaInstanteCR` (`lib/utils/fecha-dia-iso.ts:77`), de la
495. Es la que corresponde a un `timestamp` puro:

- No tiene excepción de medianoche, así que acierta en la frontera de las 18:00 CR.
- Con un valor que no es instante cae a `fechaDiaISO` y lo devuelve tal cual. Eso cubre R9 y mantiene
  viva la sonda de `tests/unit/descarga/columnas-sensibles.guardia.test.ts`.
- No depende de la zona del navegador: `fechaCalendarioCR` resta el desfase y lee con getters UTC.

`lib/utils/fecha-dia-iso.ts` no se toca.

### D2. Tabla: se retira el alias `dia`

Se borra `dia` y cada sitio nombra su función:

- `:80` y `:129` → `fechaDiaInstanteCR(...)`.
- `:98` → `fechaDiaISO(p.fechaPago)`, como ya hace la descarga en su `:65`.

Un alias único sobre dos tipos de fecha es la causa de la trampa. Se actualiza su comentario, que hoy
dice «Instante ISO como día calendario». Se importan las dos funciones.

### D3. Descarga

Se cambian `:71` y `:74` a `fechaDiaInstanteCR`. `:65` queda igual. Se importan las dos funciones. El
módulo sigue exportando exactamente dos cosas, como exige la guardia de datos sensibles.

### D4. Guardia

Se amplía `tests/unit/guards/cierres-fecha-cr-495.guardia.test.ts` con un `describe` propio. Las
guardias actuales no alcanzan estos archivos: la 495 mira tres carpetas de `app/(app)` y la 459 mira
`wallet` y `mi-wallet`, y la tabla vive en `components/shared/liquidacion`.

- **Lista explícita de los dos archivos.** Si uno se mueve, `readFileSync` lanza y la guardia cae: no
  puede quedarse verde por vacía.
- **Detector propio.** El de la 495 prohíbe todo `fechaDiaISO(` y aquí `fechaPago` lo usa con razón. Se
  mantienen sus dos formas de recorte y la tercera se sustituye por:

  ```
  /\bfechaDiaISO\s*\(\s*(?!(?:[\w?.]+\.)?fechaPago\s*\))/
  ```

  Dispara con `fechaDiaISO(p.registradoAt)` y también con `fechaDiaISO(iso)`, así que detecta volver a
  meter un alias. No dispara con `fechaDiaISO(pago.fechaPago)`.
- `recortesEn` recibe la lista de formas como parámetro, con `PROHIBIDAS` por defecto.
- **La lista literal `CARPETAS` y su test no cambian:** son el contrato de la 495.
- Incluye contraprueba: formas de antes que saltan, formas buenas que no, comentarios que no cuentan.

## Contratos

Ninguno cambia. `PagoRegistradoDTO` sigue igual; `liquidacion-money-safe.test.ts:277` fija sus 10 campos.
Encabezados, orden de columnas y formato `YYYY-MM-DD` tampoco cambian.

Los archivos ya descargados conservan la fecha con la que salieron. Los valores guardados nunca
estuvieron mal: era la lectura.

## Alternativas descartadas

1. **Cambiar el cuerpo de `dia` a `fechaDiaInstanteCR`.** Es la línea que cita la ficha y el diff de una
   línea. Descartada: desplaza «Fecha del pago» un día hacia atrás (ver «La trampa»).
2. **Usar `fechaDiaMovimientoCR`.** Parece servir también para `fechaPago`. Descartada: su excepción de
   medianoche devuelve el día UTC para `T00:00:00.000Z`, que es justo la frontera de R5. Un pago
   registrado a las 18:00:00.000 CR saldría al día siguiente.
3. **Enviar el día ya calculado desde el servidor.** Descartada: amplía el DTO y su guardia, toca capas
   que no tienen el defecto y es un rediseño para un error de lectura en dos archivos.
4. **Añadir `components/shared/liquidacion` entero a `CARPETAS`.** Descartada: el detector de la 495
   rechazaría el uso legítimo de `fechaPago`, y aflojarlo debilitaría las tres carpetas donde no hay
   excepciones.

## Trazabilidad

Todos los esperados son LITERALES: compararlos contra `fechaCalendarioCR` sería comparar la función
consigo misma.

| Req | Archivo de test | Caso |
|---|---|---|
| R1 | `tests/components/PagosRegistradosTabla.test.tsx` | `registradoAt: "2026-08-03T02:30:00.000Z"` (20:30 CR) → celda «Registrado el» `2026-08-02` |
| R2 | `tests/components/PagosRegistradosTabla.test.tsx` | `anuladoAt: "2026-08-04T02:30:00.000Z"` → `Anulado por Ana Maestra el 2026-08-03` |
| R3 | `tests/unit/descarga/pagos-registrados-descarga-columnas.test.ts` | el mismo `registradoAt` → `registradoEl: "2026-08-02"` |
| R4 | `tests/unit/descarga/pagos-registrados-descarga-columnas.test.ts` | el mismo `anuladoAt` → `anuladoEl: "2026-08-03"` |
| R5 | los dos anteriores (`it.each`) | `T00:00:00.000Z` y `T05:59:59.999Z` → día anterior; `T06:00:00.000Z` → mismo día; para registro y anulación, en tabla y en descarga |
| R6 | los dos anteriores | con un pago en la frontera, `fechaPago: "2026-07-30"` sigue `2026-07-30` en tabla y descarga |
| R7 | `tests/components/PagosRegistradosTabla.test.tsx` | un pago en la frontera: celda y `filaDescargaPagoRegistrado` igualan cada una el MISMO literal |
| R8 | `tests/unit/descarga/pagos-registrados-descarga-columnas.test.ts` y `tests/components/PagosRegistradosTabla.test.tsx` | los existentes «un comprobante VIGENTE sale marcado…» y «un pago VIGENTE se marca como tal…» |
| R9 | `tests/unit/descarga/pagos-registrados-descarga-columnas.test.ts` | `registradoAt` y `anuladoAt` `"pendiente"` salen `"pendiente"` |
| R10 | `tests/unit/guards/cierres-fecha-cr-495.guardia.test.ts` | contraprueba del detector + barrido de los dos archivos reales |

## Riesgos

- **Los fixtures existentes no cubren la frontera:** usan horas entre las 09:00 y las 18:00 UTC, donde
  los dos cálculos coinciden. Por eso siguen verdes y por eso el defecto no se vio. Los tests nuevos no
  pueden reutilizar esas horas.
- **Las guardias que leen con `fs` escapan a `--rapido`:** el grafo no las relaciona con el diff, y hay
  que correrlas a mano (T6).
