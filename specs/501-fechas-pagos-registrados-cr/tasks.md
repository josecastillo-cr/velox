# Ficha 501 — Tareas

Zona frontend. Implementa `frontend_dev`. Requisitos en `requirements.md`; casos literales en
`design.md > Trazabilidad`.

**Orden:** T1 y T2 → T3 y T4 → T5 → T6 → T7 → T8.

## Tests primero

- [x] **T1 [P]. Tests de pantalla y descarga** (R1-R7, R9)
  - En `tests/components/PagosRegistradosTabla.test.tsx` y
    `tests/unit/descarga/pagos-registrados-descarga-columnas.test.ts`, con esperados literales.
  - **Hecho:** los casos de R1-R5 y R7 fallan contra el código actual, con el día siguiente como valor
    recibido. Salida anotada en `progress/impl_501.md`. Los de R6 y R9 ya pasan: su prueba es T5.

- [x] **T2 [P]. Ampliar la guardia** (R10)
  - En `tests/unit/guards/cierres-fecha-cr-495.guardia.test.ts`, según `design.md` D4, sin cambiar
    `CARPETAS` ni su test.
  - **Hecho:** la contraprueba pasa y el barrido real falla nombrando exactamente
    `PagosRegistradosTabla.tsx:65` y `pagos-registrados-descarga-columnas.ts:71,74`. Los tests de la 495
    siguen verdes.

## Arreglo

- [x] **T3 [P]. Descarga** (depende de T1) (R3, R4, R5, R9)
  - `:71` y `:74` pasan a `fechaDiaInstanteCR`. `:65` no se toca.
  - **Hecho:** los casos de descarga de T1 pasan y el módulo sigue exportando solo dos cosas.

- [x] **T4 [P]. Tabla** (depende de T1) (R1, R2, R5, R6)
  - Se retira el alias `dia`. `:80` y `:129` pasan a `fechaDiaInstanteCR`; `:98` a `fechaDiaISO`.
  - **Hecho:** todo `tests/components/PagosRegistradosTabla.test.tsx` pasa, incluidos los existentes, y
    no queda ninguna referencia a `dia(`. T2 pasa a verde con T3 y T4.

## Verificación

- [x] **T5. Mutaciones, una a una** (depende de T3, T4)
  - Autocomprobación primero: una mutación que deba caer tiene que poner rojo un test ejecutado, con
    número de tests mayor que cero.
  - Revertir a `fechaDiaISO` cada sitio por separado: tabla `registradoAt`, tabla `anuladoAt`, descarga
    `registradoEl`, descarga `anuladoEl`.
  - Pasar `fechaPago` a `fechaDiaInstanteCR`, en tabla y en descarga por separado.
  - Pasar un instante a `fechaDiaMovimientoCR`: debe caer el caso `T00:00:00.000Z`.
  - Sustituir un instante por `fechaCalendarioCR(new Date(...))` directo: debe caer R9.
  - Quitar el `anulacion ?` de la descarga: debe caer R8.
  - Reintroducir un alias `dia` sobre `fechaDiaISO`: debe caer la guardia.
  - **Hecho:** cada mutación tumba al menos un test, anotado con su nombre en `progress/impl_501.md`, y
    el árbol queda restaurado. Una superviviente reabre T1 o T2.

- [x] **T6. Gate** (depende de T5, sin mutaciones en curso). Corrida con `INIT_EXIT=1` por rojos ajenos a la ficha, verdes al repetirlos aislados: detalle en `progress/impl_501.md`.
  - `./init.sh --rapido`. No correr el completo. Un rojo se repite aislado.
  - Guardias a mano, porque leen con `fs` y el grafo no las relaciona:
    `cierres-fecha-cr-495.guardia`, `wallet-fecha-cr-459.guardia`, `liquidacion-money-safe`,
    `liquidacion-alcance` (en `tests/unit/guards/`) y `columnas-sensibles.guardia`,
    `columnas-asercion-de-orden.guardia` (en `tests/unit/descarga/`).
  - **Hecho:** `INIT_EXIT=0` escrito dentro del log, los `skipped` revisados y las guardias verdes.

- [x] **T7. Ver la app** (depende de T6)
  - Solo base local: confirmar el host antes de nada. Un solo dev server.
  - **Datos, primero en solo lectura:** buscar en `liquidacion_pago` y `liquidacion_anulacion` filas con
    `created_at` entre las 00:00 y las 05:59 UTC. Si no hay, crear un pago de monto pequeño y anularlo
    por la app, llevar sus `created_at` a la frontera, anotar los ids y pedir al leader la limpieza. Hoy
    se desconoce qué hay en la base local.
  - **Mirar:** `/cierres-admin` y `/wallet/tiendas` con `admin.qa@ordenex.test`, en cada pantalla donde
    haya fila en la frontera.
  - **Comparar con el `created_at` crudo:** en pantalla y en el xlsx descargado, «Registrado el» y
    «Anulado el» dan el día CR esperado, calculado a mano, y «Fecha del pago» es igual a `fecha_pago`.
  - **Hecho:** `innerText` y celdas del archivo citados en `progress/impl_501.md`, con pantallas mostradas
    y no mostradas; base local limpia o limpieza pendiente declarada.

- [x] **T8. Mapa de trazabilidad** (depende de T7)
  - Mapa `R<n>` → test concreto en `progress/impl_501.md`, con mutaciones de T5, evidencia de T7 y la
    decisión sobre el alias `dia`.
  - **Hecho:** R1-R10 mapeados, cada uno con archivo y nombre real del test.
