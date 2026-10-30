import type { EmailMessage } from "@/lib/interfaces/external/IEmailSender";
import type { SendOtpCodeParams } from "@/lib/interfaces/external/IEmailProvider";
import { componerCorreoCodigo } from "@/lib/services/email/plantillas/base-codigo";

export type PlantillaCodigoParams = Pick<SendOtpCodeParams, "to" | "code" | "expiresInMinutes">;

/**
 * Correo «código para entrar» (feature 489, R4). Textos de design.md §3.2; no se
 * reescriben sin volver al spec. El asunto no lleva el código (R6).
 */
export function plantillaCodigoInicioSesion(
  params: PlantillaCodigoParams,
  marca: string,
): EmailMessage {
  const { html, text } = componerCorreoCodigo({
    marca,
    titulo: "Tu código para entrar",
    introduccion: `Alguien está entrando a tu cuenta de ${marca} desde un dispositivo nuevo. Para confirmar que eres tú, escribe este código:`,
    codigo: params.code,
    expiresInMinutes: params.expiresInMinutes,
    avisoSiNoFuisteTu: "Si no fuiste tú, no compartas este código con nadie.",
  });
  return {
    to: params.to,
    subject: `Tu código para entrar a ${marca}`,
    text,
    html,
  };
}
