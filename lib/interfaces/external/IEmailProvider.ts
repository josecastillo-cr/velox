/**
 * Para que se emite el codigo (feature 489). Solo decide el TEXTO del correo;
 * no se persiste. Un tercer valor rompe el typecheck del selector de plantilla.
 */
export type PropositoCodigo = "inicio_sesion" | "cambio_contrasena";

export interface SendOtpCodeParams {
  to: string;
  code: string;
  expiresInMinutes: number;
  /** Obligatorio: cada flujo dice que es, y el proveedor elige la plantilla. */
  proposito: PropositoCodigo;
}

export interface IEmailProvider {
  /** Envia el codigo OTP en claro por email. El codigo NUNCA se persiste (solo su hash). */
  sendOtpCode(params: SendOtpCodeParams): Promise<void>;
}
