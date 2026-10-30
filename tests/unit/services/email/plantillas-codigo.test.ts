import { describe, it, expect } from "vitest";
import { plantillaCodigoInicioSesion } from "@/lib/services/email/plantillas/codigo-inicio-sesion";
import { plantillaCodigoCambioContrasena } from "@/lib/services/email/plantillas/codigo-cambio-contrasena";
import { plantillaCodigoPorProposito } from "@/lib/services/email/plantillas";

// Feature 489 — plantillas de los dos correos de código sobre una base común.
// Los literales se escriben aquí, no se recomponen con la base (memoria
// «aserción contra su propia fuente»).

const CODIGO = "045912";
const PARAMS = { to: "ana@example.com", code: CODIGO, expiresInMinutes: 10 };

const entrar = () => plantillaCodigoInicioSesion(PARAMS, "Velox");
const contrasena = () => plantillaCodigoCambioContrasena(PARAMS, "Velox");

describe("base común (R1)", () => {
  it.each([
    ["entrar", entrar],
    ["contraseña", contrasena],
  ])("%s: el HTML trae cabecera (marca), cuerpo (código) y pie, en ese orden", (_n, plantilla) => {
    const { html } = plantilla();
    expect(html).toBeDefined();
    const h = html as string;
    const iMarca = h.indexOf(">Velox<");
    const iCodigo = h.indexOf(CODIGO);
    const iPie = h.indexOf("Este correo lo envió Velox de forma automática; no respondas a este mensaje.");
    expect(iMarca).toBeGreaterThanOrEqual(0);
    expect(iCodigo).toBeGreaterThan(iMarca);
    expect(iPie).toBeGreaterThan(iCodigo);
    expect(h).toContain('<meta charset="utf-8">');
  });

  it("entrar: el texto plano lleva marca, código, minutos y el aviso", () => {
    const { text } = entrar();
    expect(text.trim().length).toBeGreaterThan(0);
    expect(text).toContain("Velox");
    expect(text).toContain(CODIGO);
    expect(text).toContain("10 minutos");
    expect(text).toContain("Si no fuiste tú, no compartas este código con nadie.");
  });

  it("contraseña: el texto plano lleva marca, código, minutos y el aviso", () => {
    const { text } = contrasena();
    expect(text).toContain("Velox");
    expect(text).toContain(CODIGO);
    expect(text).toContain("10 minutos");
    expect(text).toContain("Si no fuiste tú, ignora este mensaje: tu contraseña sigue igual.");
  });

  it("el texto plano sigue el mismo orden: marca, código, pie", () => {
    const { text } = contrasena();
    const iMarca = text.indexOf("Velox");
    const iCodigo = text.indexOf(CODIGO);
    const iPie = text.indexOf("Este correo lo envió Velox");
    expect(iMarca).toBe(0);
    expect(iCodigo).toBeGreaterThan(iMarca);
    expect(iPie).toBeGreaterThan(iCodigo);
  });
});

describe("marca (R2)", () => {
  it.each([
    ["entrar", entrar],
    ["contraseña", contrasena],
  ])("%s: con marca Velox, asunto y cuerpo dicen Velox y no Ordenex", (_n, plantilla) => {
    const m = plantilla();
    for (const campo of [m.subject, m.html ?? "", m.text]) {
      expect(campo).toContain("Velox");
      expect(campo).not.toContain("Ordenex");
    }
  });
});

describe("código para entrar (R4)", () => {
  it("dice dispositivo nuevo, el código, que vence, que sirve una vez y que no se comparta", () => {
    const m = entrar();
    expect(m.to).toBe("ana@example.com");
    expect(m.subject).toBe("Tu código para entrar a Velox");
    for (const campo of [m.html ?? "", m.text]) {
      expect(campo).toContain("Tu código para entrar");
      expect(campo).toContain(
        "Alguien está entrando a tu cuenta de Velox desde un dispositivo nuevo. Para confirmar que eres tú, escribe este código:",
      );
      expect(campo).toContain("dispositivo nuevo");
      expect(campo).toContain(CODIGO);
      expect(campo).toContain("Vence en 10 minutos y solo sirve una vez.");
      expect(campo).toContain("no compartas");
    }
  });
});

describe("código para cambiar la contraseña (R5)", () => {
  it("muestra el código, minutos, una sola vez y el aviso literal", () => {
    const m = contrasena();
    expect(m.to).toBe("ana@example.com");
    expect(m.subject).toBe("Tu código para cambiar la contraseña de Velox");
    for (const campo of [m.html ?? "", m.text]) {
      expect(campo).toContain("Tu código para cambiar la contraseña");
      expect(campo).toContain(
        "Pediste cambiar la contraseña de tu cuenta de Velox. Escribe este código para continuar:",
      );
      expect(campo).toContain(CODIGO);
      expect(campo).toContain("Vence en 10 minutos y solo sirve una vez.");
      expect(campo).toContain("Si no fuiste tú, ignora este mensaje: tu contraseña sigue igual.");
    }
  });
});

describe("asuntos (R6)", () => {
  it("son distintos entre sí y ninguno contiene el código", () => {
    const a = entrar().subject;
    const b = contrasena().subject;
    expect(a).not.toBe(b);
    expect(a).not.toContain(CODIGO);
    expect(b).not.toContain(CODIGO);
  });
});

describe("sin siglas (R7)", () => {
  it.each([
    ["entrar", entrar],
    ["contraseña", contrasena],
  ])("%s: ni subject ni html ni text dicen OTP ni SLA", (_n, plantilla) => {
    const m = plantilla();
    for (const campo of [m.subject, m.html ?? "", m.text]) {
      expect(campo).not.toMatch(/\bOTP\b|\bSLA\b/i);
    }
  });
});

describe("escapado (R8)", () => {
  it.each([
    ["entrar", plantillaCodigoInicioSesion],
    ["contraseña", plantillaCodigoCambioContrasena],
  ])("%s: una marca con marcado sale escapada en HTML y literal en texto", (_n, plantilla) => {
    const m = plantilla(PARAMS, 'A<b>&"');
    const html = m.html ?? "";
    expect(html).toContain("A&lt;b&gt;&amp;&quot;");
    expect(html).not.toContain('A<b>&"');
    expect(m.text).toContain('A<b>&"');
  });

  it("el código también se escapa en el HTML", () => {
    const m = plantillaCodigoCambioContrasena({ ...PARAMS, code: "<script>x</script>" }, "Velox");
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
  });
});

describe("plantillaCodigoPorProposito", () => {
  it("inicio_sesion elige el correo para entrar", () => {
    const m = plantillaCodigoPorProposito({ ...PARAMS, proposito: "inicio_sesion" }, "Velox");
    expect(m.subject).toBe("Tu código para entrar a Velox");
  });

  it("cambio_contrasena elige el correo de la contraseña", () => {
    const m = plantillaCodigoPorProposito({ ...PARAMS, proposito: "cambio_contrasena" }, "Velox");
    expect(m.subject).toBe("Tu código para cambiar la contraseña de Velox");
  });
});
