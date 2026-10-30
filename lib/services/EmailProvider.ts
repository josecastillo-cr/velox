import type { IEmailProvider, SendOtpCodeParams } from "@/lib/interfaces/external/IEmailProvider";
import type { IEmailSender } from "@/lib/interfaces/external/IEmailSender";
import { emailSmtpConfigurado, loadEmailConfig, nombreMarcaCorreo } from "@/lib/config/email";
import { NodemailerEmailSender } from "@/lib/services/email/NodemailerEmailSender";
import { ConsoleEmailSender } from "@/lib/services/email/ConsoleEmailSender";
import { plantillaCodigoPorProposito } from "@/lib/services/email/plantillas";

/**
 * Caso de uso "enviar el OTP por correo": compone la plantilla y delega el
 * transporte en un IEmailSender. No sabe si detras hay SMTP o consola, de modo
 * que el mensaje se puede afirmar en un test con un emisor falso.
 *
 * El codigo en claro viaja SOLO en el cuerpo del correo: aqui se registra
 * unicamente metadata (destinatario, proposito y expiracion), nunca el codigo.
 *
 * Feature 489: la plantilla la decide el proposito y la marca llega por
 * constructor (SMTP_FROM_NAME o "Ordenex"). El log va DESPUES de enviar: si el
 * transporte lanza, no hay linea y el error se propaga. El prefijo
 * `[auth] OTP enviado` es literal: lo mide el procedimiento de encendido en los
 * logs de Vercel (R10).
 */
export class EmailNotificacionProvider implements IEmailProvider {
  constructor(
    private readonly sender: IEmailSender,
    private readonly marca: string,
  ) {}

  async sendOtpCode(params: SendOtpCodeParams): Promise<void> {
    await this.sender.enviar(plantillaCodigoPorProposito(params, this.marca));
    console.info(
      `[auth] OTP enviado a ${params.to} (${params.proposito}), expira en ${params.expiresInMinutes} min`,
    );
  }
}

/**
 * Implementacion inerte: no envia nada y no imprime el codigo. Se conserva para
 * los tests que solo necesitan una dependencia que cumpla el contrato.
 */
export class StubEmailProvider implements IEmailProvider {
  async sendOtpCode(params: SendOtpCodeParams): Promise<void> {
    console.info(
      `[auth] OTP emitido para ${params.to} (${params.proposito}), expira en ${params.expiresInMinutes} min (stub: no se envia)`,
    );
  }
}

/**
 * Selecciona el emisor segun el entorno (feature 80): con SMTP configurado se
 * envia de verdad; sin el —dev o CI— se degrada al emisor de consola en vez de
 * reventar. La decision se toma aqui, en un unico sitio, y no en cada Server
 * Action.
 */
export function crearEmailSender(): IEmailSender {
  return emailSmtpConfigurado()
    ? new NodemailerEmailSender(loadEmailConfig())
    : new ConsoleEmailSender();
}

/** Proveedor de OTP por correo ya cableado con el emisor que toque. */
export function crearEmailProvider(): IEmailProvider {
  return new EmailNotificacionProvider(crearEmailSender(), nombreMarcaCorreo());
}
