import { fechaCalendarioCR } from "@/lib/utils/fecha-cr";

/**
 * Feature 170 (T C.3) — día calendario (`YYYY-MM-DD`) de un instante ISO que YA viene como
 * texto desde el servidor.
 *
 * Existe porque los cuatro ledgers de dinero exponen `fechaMovimiento` como STRING ISO (no
 * como `Date`) y las cuatro tablas lo pintan con `m.fechaMovimiento.slice(0, 10)`. Las
 * columnas de export tienen que emitir EXACTAMENTE lo mismo (R11/R24), y hacerlo en cuatro
 * módulos con cuatro `slice` sueltos es cuatro sitios donde el criterio puede divergir.
 *
 * Por qué una expresión regular y no `.slice(0, 10)` sobre el valor recibido: la guardia de
 * datos sensibles ejecuta cada proyección con una SONDA (un proxy que responde a cualquier
 * lectura), y llamar a un MÉTODO sobre un campo de la sonda revienta. Con `String(valor)`
 * primero y una expresión regular después, la proyección sobrevive a la sonda Y conserva su
 * rastro (el marcador entero viaja como valor de la celda), que es justo lo que permite a la
 * guardia decir de qué campo salió cada celda.
 *
 * Un texto que no empiece por una fecha calendario se devuelve TAL CUAL en vez de recortarse
 * a ciegas: recortar los diez primeros caracteres de algo que no es una fecha produce basura
 * con pinta de dato.
 */
const DIA_ISO = /^\d{4}-\d{2}-\d{2}/;

export function fechaDiaISO(valor: string): string {
  const texto = String(valor);
  const dia = DIA_ISO.exec(texto);
  return dia ? dia[0] : texto;
}

/**
 * Ficha 459 (recorrido F1) — el DIA de Costa Rica de un `fechaMovimiento` de la wallet, para la
 * tabla Y para la descarga (`YYYY-MM-DD`, el mismo formato que ya pintaban).
 *
 * `fechaDiaISO` recorta el texto, y el texto es un ISO en UTC: un movimiento registrado a las
 * 22:00 del 24 de septiembre en Costa Rica es `2026-09-25T04:00:00Z` y se leia «2026-09-25». El
 * calculo del dia CR NO se reescribe aqui: es `fechaCalendarioCR` (`lib/utils/fecha-cr.ts`).
 * Esta funcion solo decide QUE hacer con el valor antes de dárselo:
 *
 * - **Medianoche UTC exacta** (`00:00:00.000Z`): es una FECHA guardada con la convencion
 *   `@db.Date` de la ficha 172 (`medianocheUtcDelDia`: pagos y anulaciones de la liquidacion, y
 *   su backfill), que YA es el dia calendario de Costa Rica. Pasarla por el desfase de −6 h la
 *   pintaria el dia ANTERIOR. Se devuelve su dia tal cual.
 * - **Lo que no es un instante** (texto vacio o la SONDA de la guardia de datos sensibles, un
 *   proxy que responde a cualquier lectura): cae a `fechaDiaISO`, que lo devuelve TAL CUAL.
 * - **Cualquier otro instante**: `fechaCalendarioCR`.
 */
export function fechaDiaMovimientoCR(valor: string): string {
  const texto = String(valor);
  const instante = new Date(texto);
  if (!DIA_ISO.test(texto) || Number.isNaN(instante.getTime())) return fechaDiaISO(texto);
  const esMedianocheUtc =
    instante.getUTCHours() === 0 &&
    instante.getUTCMinutes() === 0 &&
    instante.getUTCSeconds() === 0 &&
    instante.getUTCMilliseconds() === 0;
  return esMedianocheUtc ? fechaDiaISO(texto) : fechaCalendarioCR(instante);
}

/**
 * Ficha 495 — el DIA de Costa Rica (`YYYY-MM-DD`) de un INSTANTE (`timestamp`) que llega como
 * texto ISO en UTC: las fechas de los cierres (`solicitadoAt`, `resueltoAt`, `conciliadoAt`) y de
 * los incidentes (`createdAt`, `resueltoAt`). Se usa la MISMA en pantalla y en descarga, para que
 * las dos digan el mismo día por construcción.
 *
 * Cuál de las tres funciones de este módulo usar:
 *
 * - `fechaDiaISO`: el texto YA es un día calendario (o empieza por él); solo se recorta.
 * - `fechaDiaMovimientoCR`: ledgers de la wallet, que mezclan instantes con fechas `@db.Date`
 *   guardadas a medianoche UTC (ficha 172/459).
 * - `fechaDiaInstanteCR` (esta): un `timestamp` puro. SIN la excepción de medianoche: un cierre
 *   solicitado a las 18:00:00.000 de Costa Rica es `T00:00:00.000Z` y es del día ANTERIOR.
 *
 * El cálculo no se reescribe: es `fechaCalendarioCR`. Lo que no es un instante legible (texto
 * vacío, la SONDA de la guardia de datos sensibles) cae a `fechaDiaISO`, que lo devuelve TAL CUAL.
 */
export function fechaDiaInstanteCR(valor: string): string {
  const texto = String(valor);
  const instante = new Date(texto);
  if (!DIA_ISO.test(texto) || Number.isNaN(instante.getTime())) return fechaDiaISO(texto);
  return fechaCalendarioCR(instante);
}
