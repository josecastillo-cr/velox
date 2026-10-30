import { describe, it, expect, afterEach } from "vitest";
import { recuperacionContrasenaActiva } from "@/lib/config/recuperacion-contrasena";

// Feature 489 — R17: el interruptor solo enciende con "true"/"1" (sin
// mayusculas, trim); cualquier otro valor, vacio o ausencia es apagado.

const ORIG = process.env.RECUPERACION_CONTRASENA_ACTIVA;

afterEach(() => {
  if (ORIG === undefined) delete process.env.RECUPERACION_CONTRASENA_ACTIVA;
  else process.env.RECUPERACION_CONTRASENA_ACTIVA = ORIG;
});

describe("recuperacionContrasenaActiva (R17)", () => {
  it.each(["true", "TRUE", " 1 ", "1", " True "])("%j enciende", (valor) => {
    process.env.RECUPERACION_CONTRASENA_ACTIVA = valor;
    expect(recuperacionContrasenaActiva()).toBe(true);
  });

  it.each(["false", "0", "si", "", "   ", "yes", "on", "truee"])("%j apaga", (valor) => {
    process.env.RECUPERACION_CONTRASENA_ACTIVA = valor;
    expect(recuperacionContrasenaActiva()).toBe(false);
  });

  it("ausente apaga", () => {
    delete process.env.RECUPERACION_CONTRASENA_ACTIVA;
    expect(recuperacionContrasenaActiva()).toBe(false);
  });

  it("se evalua en cada llamada, no queda congelado", () => {
    process.env.RECUPERACION_CONTRASENA_ACTIVA = "true";
    expect(recuperacionContrasenaActiva()).toBe(true);
    delete process.env.RECUPERACION_CONTRASENA_ACTIVA;
    expect(recuperacionContrasenaActiva()).toBe(false);
  });
});
