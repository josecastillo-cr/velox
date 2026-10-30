import type { EmailMessage } from "@/lib/interfaces/external/IEmailSender";
import type { SendOtpCodeParams } from "@/lib/interfaces/external/IEmailProvider";
import { plantillaCodigoInicioSesion } from "@/lib/services/email/plantillas/codigo-inicio-sesion";
import { plantillaCodigoCambioContrasena } from "@/lib/services/email/plantillas/codigo-cambio-contrasena";

/**
 * Elige la plantilla del correo de código según su propósito (feature 489).
 * Switch exhaustivo: un propósito nuevo rompe el typecheck en vez de caer en
 * la plantilla de otro flujo.
 */
export function plantillaCodigoPorProposito(
  params: SendOtpCodeParams,
  marca: string,
): EmailMessage {
  switch (params.proposito) {
    case "inicio_sesion":
      return plantillaCodigoInicioSesion(params, marca);
    case "cambio_contrasena":
      return plantillaCodigoCambioContrasena(params, marca);
    default: {
      const imposible: never = params.proposito;
      throw new Error(`email: propósito de código desconocido (${String(imposible)})`);
    }
  }
}
