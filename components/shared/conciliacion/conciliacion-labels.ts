import { money } from "@/lib/config/moneda";

/**
 * ⭑ FICHA 431 — TEXTOS de la marca de conciliación de una consolidación de bodega.
 *
 * Módulo PURO (sin React): `docs/conventions` manda los textos de UI fuera del componente, e
 * i18n-ready — nada de literales incrustados en el JSX. Las que llevan un dato dentro son
 * FUNCIONES y no concatenaciones sueltas, para que el día que haya i18n el dato siga siendo un
 * parámetro.
 *
 * Vive en `components/shared/` porque lo montan DOS pantallas con la misma API: el desglose de
 * `/wallet/satelites` y la cola de `/cierres-admin` (`docs/architecture.md`: se promueve cuando
 * dos features lo necesitan igual). El vocabulario de ESTADO —«Pendiente de conciliar»,
 * «Recibido», «Recibido incompleto»— NO se redefine aquí: sale de `cierre-labels.ts`, que es
 * donde la guardia de vocabulario lo ancla a mano.
 */

/** La acción, por lo que hace y no por el estado al que lleva. */
export const CONCILIACION_ACCION = {
  /** Sobre una consolidación sin conciliar. */
  marcar: "Marcar recibido",
  /** Sobre una que llegó incompleta o de más (502/R7): no se vuelve a marcar, se corrige el monto. */
  corregir: "Corregir",
  /**
   * R12 — deshacer la marca. NO dice «Rechazar»: no rechaza nada, sólo borra la marca. FICHA 498
   * (R20/R22): solo prospera mientras la consolidación no tenga asientos; si ya entró a la caja, el
   * servidor responde `con_asientos` y la pantalla lo dice (R21).
   */
  desmarcar: "Desmarcar",
  cancelar: "Cancelar",
} as const;

/** El diálogo de marcar/corregir. */
export const MARCAR_RECIBIDO_TEXTO = {
  titulo: CONCILIACION_ACCION.marcar,
  tituloCorregir: "Corregir el monto recibido",
  /**
   * Quién consolidó y cuándo. Es lo que identifica el bulto del que se habla cuando una bodega
   * tiene varias consolidaciones abiertas — desde esta ficha puede tener cuantas quiera.
   */
  descripcion: (bodega: string, fecha: string) =>
    `Consolidación de ${bodega} del ${fecha}.`,
  /**
   * FICHA 498 (design §8.4, R16) — lo que DEBE la consolidación: su aporte reconocido, del servidor.
   * Sustituye a «Declarado por la bodega» (el efectivo), que ya no es lo que se espera recibir.
   */
  debe: "Debe",
  /** FICHA 498 (R16a) — lo recaudado por método, encima del campo. */
  recaudado: "Recaudado",
  metodo: {
    efectivo: "Efectivo",
    simpe: "SINPE",
    transferencia: "Transferencia",
  },
  /** FICHA 498 (R16a) — texto LITERAL del requisito: lo recibido es un total (R16b). */
  recibidoEsTotal:
    "Escribe todo lo que recibió la central por esta consolidación: lo que entregó la satélite más " +
    "el SINPE o la transferencia que llegó directo a la cuenta de la central.",
  montoRecibido: "Monto recibido",
  /**
   * La pista del campo. FICHA 498 (R16): el campo viene con lo que DEBE (o con 0 si no debe nada),
   * ya no con el efectivo declarado.
   */
  montoAyuda: "Viene con lo que debe. Cámbialo solo si la central recibió una cantidad distinta.",
  /**
   * FICHA 498 — la pista cuando quien monta el diálogo no tiene «lo que debe» del servidor (la cola
   * de `/cierres-admin`, ver `progress/impl_498.md`): el campo arranca vacío y no promete nada.
   */
  montoAyudaSinDebe: "Escribe el total que recibió la central.",
  nota: "Nota",
  notaAyuda: "Opcional. Por ejemplo: «faltaron ₡15.000, entran el lunes».",
  confirmar: CONCILIACION_ACCION.marcar,
  /** 473 (R15) — en modo corrección el botón dice lo que hace: corregir, no volver a marcar. */
  confirmarCorregir: CONCILIACION_ACCION.corregir,
} as const;

/** Errores de campo que este formulario puede levantar por sí solo, antes de enviar. */
export const MARCAR_RECIBIDO_ERROR = {
  // FICHA 498 (Q5): el cero se admite en el borde (el servidor decide si la consolidación lo permite).
  monto: "Escribe un monto válido: cero o más, con dos decimales como máximo.",
  notaLarga: (max: number) => `La nota no puede pasar de ${max} caracteres.`,
} as const;

/** Lo que responde el servidor, traducido a algo accionable. */
export const CONCILIACION_RESPUESTA = {
  marcada: (monto: string) => `Marcada como recibida por ${money(monto)}.`,
  /** 473 (R16) — la corrección dice el monto que quedó, no el que había. */
  corregida: (monto: string) => `Monto recibido corregido a ${money(monto)}.`,
  revertida: "Marca deshecha. La consolidación vuelve a estar pendiente de conciliar.",
  /**
   * R11 — alguien la marcó (o la desmarcó) mientras este diálogo estaba abierto. Desde la 473
   * (R17) «Actualizando la lista» es verdad: quien monta el diálogo lo cierra y refresca.
   */
  conflicto: "Esta consolidación ya cambió de estado. Actualizando la lista.",
  noEncontrada: "Esta consolidación ya no está disponible.",
  // FICHA 498 — en tuteo, como los textos literales de R16a, R21 y R43 que este mismo diálogo pinta.
  forbidden: "No tienes permiso para conciliar consolidaciones de bodega.",
  unauthenticated: "Tu sesión expiró. Inicia sesión de nuevo.",
  fallo: "No se pudo completar la operación. Intenta de nuevo.",
  /** FICHA 498 (Q5, design §4.4 bis, R15a) — recibido 0 con dinero por entregar: no cambió nada. */
  reciboCeroConAporte: "Esta consolidación tiene dinero por entregar: el monto recibido no puede ser 0.",
  /** FICHA 498 (R21) — revertir una consolidación que ya entró a la caja: no cambió nada. */
  conAsientos: "Ya entró a la caja: no se puede revertir.",
  /** FICHA 498 (revisión m2) — revertir una consolidación saldada con la regla anterior: no cambió nada. */
  saldadaReglaAnterior: "Esta consolidación está saldada con la regla anterior: no se puede revertir.",
} as const;

/** Tope de la nota, el MISMO que el `.max(500)` del schema del borde. */
export const CONCILIACION_NOTA_MAX = 500;

/**
 * FICHA 498 (R43) — LA NOTA DE LA CONCILIACIÓN, texto LITERAL del requisito.
 *
 * Sustituye a la de la 431, que decía lo contrario: desde esta ficha marcar recibido ASIENTA el
 * dinero de los cierres de la consolidación en la caja, y por eso la marca ya no se deshace. FICHA 506:
 * nombra «Corregir» con su condición, porque una recibida exacta no lo ofrece. Va al pie de la conciliación.
 */
export const NOTA_CONCILIACION_ASIENTA =
  "Marcar recibido asienta el dinero en la caja. Después no se puede desmarcar, y «Corregir» solo " +
  "aparece si lo recibido quedó por debajo o por encima de lo que debe: si coincide, no hay botón " +
  "para cambiar el monto.";
