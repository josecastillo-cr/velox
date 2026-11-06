# Ficha 501 — Fechas de Pagos registrados en hora de Costa Rica: requisitos

## Problema

«Registrado el» y «Anulado el» de la lista Pagos registrados, en pantalla y en la descarga, recortan
un instante ISO en UTC. Lo registrado o anulado desde las 18:00 de Costa Rica sale fechado al día
siguiente. Hallazgo m2 de la revisión de la 495.

«Fecha del pago» es una fecha calendario (`@db.Date`), no un instante: es correcta y no cambia.

## Definiciones

- **Día CR:** el día calendario `YYYY-MM-DD` de un instante en Costa Rica (UTC−6 fijo).
- **Pagos registrados:** la lista de comprobantes de un beneficiario y su descarga, tal como se montan
  en `/wallet/tiendas` y en `/cierres-admin`.
- **Frontera:** `00:00:00.000Z` son las 18:00:00.000 de Costa Rica del día UTC anterior.

## Requisitos

### Pantalla

- **R1.** CUANDO la lista muestra la columna «Registrado el» de un pago, el sistema DEBE mostrar el
  día CR del instante de registro, en formato `YYYY-MM-DD`.
- **R2.** CUANDO la lista muestra el estado de un pago anulado, el sistema DEBE mostrar en el texto
  «Anulado por `<nombre>` el `<día>`» el día CR del instante de anulación, en formato `YYYY-MM-DD`.

### Descarga

- **R3.** CUANDO se descarga la lista, el sistema DEBE emitir en la columna «Registrado el» el día CR
  del instante de registro, en formato `YYYY-MM-DD`.
- **R4.** CUANDO se descarga un pago anulado, el sistema DEBE emitir en la columna «Anulado el» el día
  CR del instante de anulación, en formato `YYYY-MM-DD`.

### Frontera

- **R5.** SI un instante de registro o de anulación cae entre `00:00:00.000Z` y `05:59:59.999Z`, ambos
  incluidos, ENTONCES el sistema DEBE mostrarlo y emitirlo con el día anterior del calendario UTC; y SI
  cae en `06:00:00.000Z` o después, ENTONCES DEBE mostrarlo y emitirlo con el mismo día del calendario
  UTC.

### Lo que no cambia

- **R6.** El sistema DEBE mostrar y emitir «Fecha del pago» con el mismo día calendario que recibe, sin
  aplicarle el desfase de Costa Rica.
- **R7.** CUANDO un mismo pago se ve en pantalla y se descarga, el sistema DEBE dar el mismo día en
  «Registrado el» en los dos sitios, y el mismo día de anulación si está anulado.
- **R8.** SI un pago está vigente, ENTONCES el sistema DEBE dejar vacía la celda «Anulado el» de la
  descarga y NO DEBE mostrar texto de anulación en pantalla.
- **R9.** SI el valor de un instante de registro o de anulación no es un instante legible, ENTONCES el
  sistema DEBE emitirlo tal cual, sin inventar una fecha ni fallar.

### Protección

- **R10.** SI el código de la tabla o de las columnas de descarga de Pagos registrados recorta una fecha
  a 10 caracteres, la corta por la «T» o pasa por el recorte de texto cualquier valor distinto de
  `fechaPago`, ENTONCES la suite DEBE fallar nombrando el archivo y la línea.

## Fuera de alcance

- Otras pantallas y otras descargas.
- Mostrar la hora, cambiar el formato de fecha o las columnas.
- Cambiar los datos guardados o lo que devuelve el servidor.

## Preguntas abiertas

Ninguna. Aprobado por el humano el 2026-11-04; `spec_path` de la ficha alineado.
