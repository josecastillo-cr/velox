import { describe, it, expect, afterEach } from "vitest";
import { loadEmailConfig, nombreMarcaCorreo } from "@/lib/config/email";

// Feature 489 — R2/R3: la marca de los correos sale de SMTP_FROM_NAME y, si no
// esta o esta vacia, es "Ordenex". No exige credenciales SMTP.

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

  it("R3: sin SMTP_FROM_NAME la marca es Ordenex", () => {
    delete process.env.SMTP_FROM_NAME;
    expect(nombreMarcaCorreo()).toBe("Ordenex");
  });

  it("R3: con SMTP_FROM_NAME vacio o en blanco la marca es Ordenex", () => {
    process.env.SMTP_FROM_NAME = "";
    expect(nombreMarcaCorreo()).toBe("Ordenex");
    process.env.SMTP_FROM_NAME = "   ";
    expect(nombreMarcaCorreo()).toBe("Ordenex");
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
    expect(loadEmailConfig().fromName).toBe("Ordenex");
  });
});
