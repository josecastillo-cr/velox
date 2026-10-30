import { describe, it, expect, vi, afterEach } from "vitest";
import type {
  EmailMessage,
  EmailSendResult,
  IEmailSender,
} from "@/lib/interfaces/external/IEmailSender";
import {
  EmailNotificacionProvider,
  crearEmailProvider,
  crearEmailSender,
} from "@/lib/services/EmailProvider";
import { ConsoleEmailSender } from "@/lib/services/email/ConsoleEmailSender";
import { NodemailerEmailSender } from "@/lib/services/email/NodemailerEmailSender";

// Feature 80 — la capa de notificaciones por correo: un caso de uso (OTP) que
// compone y delega, y la seleccion de transporte por entorno. Feature 489: la
// plantilla la elige el proposito del codigo.

const CODIGO = "045912";

class SenderEspia implements IEmailSender {
  public enviados: EmailMessage[] = [];
  async enviar(mensaje: EmailMessage): Promise<EmailSendResult> {
    this.enviados.push(mensaje);
    return { messageId: "id-de-prueba" };
  }
}

// El describe("plantillaOtpCodigo") de la feature 80 migro, con la plantilla, a
// tests/unit/services/email/plantillas-codigo.test.ts (feature 489).

describe("EmailNotificacionProvider", () => {
  afterEach(() => vi.restoreAllMocks());

  it("entrega al transporte el mensaje renderizado con el codigo", async () => {
    const sender = new SenderEspia();
    await new EmailNotificacionProvider(sender, "Velox").sendOtpCode({
      to: "ana@example.com",
      code: CODIGO,
      expiresInMinutes: 10,
      proposito: "cambio_contrasena",
    });
    expect(sender.enviados).toHaveLength(1);
    expect(sender.enviados[0].to).toBe("ana@example.com");
    expect(sender.enviados[0].text).toContain(CODIGO);
  });

  // Feature 489 — R4/R5: el proposito decide la plantilla. Mutacion de control
  // (progress/impl_489.md): con el switch devolviendo siempre la de entrar,
  // el caso cambio_contrasena sale rojo.
  it("R4: con inicio_sesion el transporte recibe el correo para entrar", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const sender = new SenderEspia();
    await new EmailNotificacionProvider(sender, "Velox").sendOtpCode({
      to: "ana@example.com",
      code: CODIGO,
      expiresInMinutes: 10,
      proposito: "inicio_sesion",
    });
    expect(sender.enviados[0].subject).toBe("Tu código para entrar a Velox");
  });

  it("R5: con cambio_contrasena el transporte recibe el correo de la contraseña", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const sender = new SenderEspia();
    await new EmailNotificacionProvider(sender, "Velox").sendOtpCode({
      to: "ana@example.com",
      code: CODIGO,
      expiresInMinutes: 10,
      proposito: "cambio_contrasena",
    });
    expect(sender.enviados[0].subject).toBe("Tu código para cambiar la contraseña de Velox");
    expect(sender.enviados[0].text).toContain(
      "Si no fuiste tú, ignora este mensaje: tu contraseña sigue igual.",
    );
  });

  it("la marca del correo es la que recibe por constructor", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const sender = new SenderEspia();
    await new EmailNotificacionProvider(sender, "Ordenex").sendOtpCode({
      to: "ana@example.com",
      code: CODIGO,
      expiresInMinutes: 10,
      proposito: "inicio_sesion",
    });
    expect(sender.enviados[0].subject).toBe("Tu código para entrar a Ordenex");
  });

  it.each(["inicio_sesion", "cambio_contrasena"] as const)(
    "R9/R10 (%s): la linea de log empieza por [auth] OTP enviado, con destinatario, proposito y minutos, sin el codigo",
    async (proposito) => {
      const info = vi.spyOn(console, "info").mockImplementation(() => {});
      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      await new EmailNotificacionProvider(new SenderEspia(), "Velox").sendOtpCode({
        to: "ana@example.com",
        code: CODIGO,
        expiresInMinutes: 10,
        proposito,
      });
      const lineas = info.mock.calls.map((c) => c.map(String).join(" "));
      const linea = lineas.find((l) => l.startsWith("[auth] OTP enviado"));
      expect(linea).toBeDefined();
      expect(linea).toBe(`[auth] OTP enviado a ana@example.com (${proposito}), expira en 10 min`);
      const escrito = [...info.mock.calls, ...log.mock.calls, ...warn.mock.calls].flat().join(" ");
      expect(escrito).not.toContain(CODIGO);
    },
  );

  it("R11: propaga el fallo del transporte y no registra [auth] OTP enviado", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const sender: IEmailSender = {
      enviar: vi.fn().mockRejectedValue(new Error("smtp caido")),
    };
    await expect(
      new EmailNotificacionProvider(sender, "Velox").sendOtpCode({
        to: "ana@example.com",
        code: CODIGO,
        expiresInMinutes: 10,
        proposito: "cambio_contrasena",
      }),
    ).rejects.toThrow("smtp caido");
    const escrito = info.mock.calls.flat().join(" ");
    expect(escrito).not.toContain("[auth] OTP enviado");
  });
});

describe("crearEmailProvider (feature 489)", () => {
  const ORIG = {
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    nombre: process.env.SMTP_FROM_NAME,
  };
  afterEach(() => {
    for (const [k, v] of [
      ["SMTP_USER", ORIG.user],
      ["SMTP_PASSWORD", ORIG.password],
      ["SMTP_FROM_NAME", ORIG.nombre],
    ] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    vi.restoreAllMocks();
  });

  it("R2: pasa SMTP_FROM_NAME como marca, tambien sin SMTP (emisor de consola)", async () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    process.env.SMTP_FROM_NAME = "Velox";
    const enviar = vi
      .spyOn(ConsoleEmailSender.prototype, "enviar")
      .mockResolvedValue({ messageId: null });
    vi.spyOn(console, "info").mockImplementation(() => {});
    await crearEmailProvider().sendOtpCode({
      to: "ana@example.com",
      code: CODIGO,
      expiresInMinutes: 10,
      proposito: "cambio_contrasena",
    });
    expect(enviar.mock.calls[0][0].subject).toBe("Tu código para cambiar la contraseña de Velox");
  });
});

describe("ConsoleEmailSender", () => {
  const ORIG = process.env.AUTH_OTP_DEBUG_LOG;
  afterEach(() => {
    if (ORIG === undefined) delete process.env.AUTH_OTP_DEBUG_LOG;
    else process.env.AUTH_OTP_DEBUG_LOG = ORIG;
    vi.restoreAllMocks();
  });

  const mensaje: EmailMessage = {
    to: "ana@example.com",
    subject: "asunto",
    text: `codigo ${CODIGO}`,
  };

  it("sin el flag de debug no imprime el cuerpo, solo metadata", async () => {
    delete process.env.AUTH_OTP_DEBUG_LOG;
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const resultado = await new ConsoleEmailSender().enviar(mensaje);
    expect(resultado.messageId).toBeNull();
    expect(info.mock.calls.flat().join(" ")).toContain("ana@example.com");
    expect([...info.mock.calls, ...warn.mock.calls].flat().join(" ")).not.toContain(CODIGO);
  });

  it("con AUTH_OTP_DEBUG_LOG=1 vuelca el cuerpo para poder probar en local", async () => {
    process.env.AUTH_OTP_DEBUG_LOG = "1";
    vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await new ConsoleEmailSender().enviar(mensaje);
    expect(warn.mock.calls.flat().join(" ")).toContain(CODIGO);
  });
});

describe("crearEmailSender", () => {
  const ORIG = { user: process.env.SMTP_USER, password: process.env.SMTP_PASSWORD };
  afterEach(() => {
    if (ORIG.user === undefined) delete process.env.SMTP_USER;
    else process.env.SMTP_USER = ORIG.user;
    if (ORIG.password === undefined) delete process.env.SMTP_PASSWORD;
    else process.env.SMTP_PASSWORD = ORIG.password;
  });

  it("sin credencial de Google devuelve el emisor de consola", () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    expect(crearEmailSender()).toBeInstanceOf(ConsoleEmailSender);
  });

  it("con credencial de Google devuelve el emisor de nodemailer", () => {
    process.env.SMTP_USER = "no-reply@ordenex.co";
    process.env.SMTP_PASSWORD = "abcdefghijklmnop";
    expect(crearEmailSender()).toBeInstanceOf(NodemailerEmailSender);
  });
});
