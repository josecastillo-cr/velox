/**
 * Feature 490 — UNICA fuente de los datos legales de las paginas `/privacidad` y
 * `/eliminacion-datos` y del pie de la landing (R18).
 *
 * Fuente (T8, decisiones del humano del 2026-10-30): certificacion de personeria juridica del
 * Registro Nacional de Costa Rica, RNPDIGITAL-1541420-2026. El correo es el inscrito en el
 * Registro. A proposito NO se publica al gerente ni su cedula personal.
 *
 * Un dato a `null` se pinta como `MARCADOR_PENDIENTE` (R19); cambiar un dato es editar UNA linea
 * de este archivo. Una guardia estatica (`tests/unit/guards/paginas-legales-estaticas.guardia.test.ts`)
 * vigila que ningun otro archivo de las paginas legales contenga estos valores ni la marca como
 * literal.
 */
export interface DatosLegales {
  /** Marca / nombre comercial. */
  marca: string | null;
  /** Razon social de quien trata los datos. */
  razonSocial: string | null;
  /** Cedula juridica. */
  cedulaJuridica: string | null;
  /** Domicilio social que se publica. */
  domicilio: string | null;
  /** Correo de contacto de privacidad, destino de las solicitudes de eliminacion. */
  correoPrivacidad: string | null;
  /** Fecha de ultima actualizacion, ya legible: "30 de octubre de 2026". */
  ultimaActualizacion: string | null;
  /** Plazo maximo de respuesta a una solicitud, ya legible: "30 días naturales". */
  plazoRespuesta: string | null;
}

export const DATOS_LEGALES: DatosLegales = {
  marca: "Velox Courier",
  razonSocial: "3-102-965944 SOCIEDAD DE RESPONSABILIDAD LIMITADA",
  cedulaJuridica: "3-102-965944",
  domicilio:
    "San José, Aserrí, Barrio Corazón de Jesús, 200 metros al norte de la Clínica de Salud, casa a mano derecha con rótulo Tiendas Battos",
  correoPrivacidad: "battos.sa@gmail.com",
  ultimaActualizacion: "30 de octubre de 2026",
  plazoRespuesta: "30 días naturales",
};

export const MARCADOR_PENDIENTE = "[pendiente de definir]";
