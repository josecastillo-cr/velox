import { describe, it, expect, afterEach } from "vitest";
import { loadEmailConfig, nombreMarcaCorreo } from "@/lib/config/email";
import { plantillaCodigoPorProposito } from "@/lib/services/email/plantillas";

import { MARCA_RETIRADA, MARCA_RETIRADA_RE } from "@/tests/fixtures/marca-retirada-nombre-493";
// Feature 489 — R2/R3: la marca de los correos sale de SMTP_FROM_NAME y, si no
// esta o esta vacia, es el nombre de marca: «Velox Courier» desde la feature 492 (R19). No exige
// credenciales SMTP. Literal de contrato, no `MARCA.nombre`.

const VARS = ["SMTP_FROM_NAME", "SMTP_USER", "SMTP_PASSWORD"] as const;
const ORIG = new Map(VARS.map((v) => [v, process.env[v]]));

afterEach(() => {
  for (const v of VARS) {
    const original = ORIG.get(v);
    if (original === undefined) delete process.env[v];
    else process.env[v] = original;
  }
});

describe("nombreMarcaCorreo", () => {
  it("R2: usa SMTP_FROM_NAME configurado (recortado)", () => {
    process.env.SMTP_FROM_NAME = "  Velox ";
    expect(nombreMarcaCorreo()).toBe("Velox");
  });

  it("R3: sin SMTP_FROM_NAME la marca es Velox Courier", () => {
    delete process.env.SMTP_FROM_NAME;
    expect(nombreMarcaCorreo()).toBe("Velox Courier");
  });

  it("R3: con SMTP_FROM_NAME vacio o en blanco la marca es Velox Courier", () => {
    process.env.SMTP_FROM_NAME = "";
    expect(nombreMarcaCorreo()).toBe("Velox Courier");
    process.env.SMTP_FROM_NAME = "   ";
    expect(nombreMarcaCorreo()).toBe("Velox Courier");
  });

  it("no exige credenciales SMTP", () => {
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    process.env.SMTP_FROM_NAME = "Velox";
    expect(() => nombreMarcaCorreo()).not.toThrow();
  });

  it("el From visible de la config SMTP y la marca son la misma fuente", () => {
    process.env.SMTP_USER = "no-reply@velox-courier.company";
    process.env.SMTP_PASSWORD = "abcdefghijklmnop";
    process.env.SMTP_FROM_NAME = "Velox";
    expect(loadEmailConfig().fromName).toBe("Velox");
    delete process.env.SMTP_FROM_NAME;
    expect(loadEmailConfig().fromName).toBe("Velox Courier");
  });
});

describe("feature 492 (R19) — correo compuesto sin SMTP_FROM_NAME", () => {
  it.each(["inicio_sesion", "cambio_contrasena"] as const)(
    `%s: cabecera y pie llevan «Velox Courier» y no «${MARCA_RETIRADA}»`,
    (proposito) => {
      delete process.env.SMTP_FROM_NAME;
      const correo = plantillaCodigoPorProposito(
        { to: "a@b.co", code: "123456", expiresInMinutes: 10, proposito },
        nombreMarcaCorreo(),
      );
      // Cabecera: la primera celda con la marca; pie: la linea «lo envió <marca>».
      expect(correo.html).toMatch(/font-weight:700;">Velox Courier<\/td><\/tr>/);
      expect(correo.html).toContain("Este correo lo envió Velox Courier de forma automática");
      expect(correo.text.split(/\n\n/)[0]).toBe("Velox Courier");
      expect(correo.text).toContain("Este correo lo envió Velox Courier de forma automática");
      expect(`${correo.subject} ${correo.html} ${correo.text}`).not.toMatch(MARCA_RETIRADA_RE);
    },
  );
});
