import type { EmailMessage } from "@/lib/interfaces/external/IEmailSender";
import { componerCorreoCodigo } from "@/lib/services/email/plantillas/base-codigo";
import type { PlantillaCodigoParams } from "@/lib/services/email/plantillas/codigo-inicio-sesion";

/**
 * Correo «código para cambiar la contraseña» (feature 489, R5). Textos de
 * design.md §3.2; no se reescriben sin volver al spec. El asunto no lleva el
 * código (R6).
 */
export function plantillaCodigoCambioContrasena(
  params: PlantillaCodigoParams,
  marca: string,
): EmailMessage {
  const { html, text } = componerCorreoCodigo({
    marca,
    titulo: "Tu código para cambiar la contraseña",
    introduccion: `Pediste cambiar la contraseña de tu cuenta de ${marca}. Escribe este código para continuar:`,
    codigo: params.code,
    expiresInMinutes: params.expiresInMinutes,
    avisoSiNoFuisteTu: "Si no fuiste tú, ignora este mensaje: tu contraseña sigue igual.",
  });
  return {
    to: params.to,
    subject: `Tu código para cambiar la contraseña de ${marca}`,
    text,
    html,
  };
}
