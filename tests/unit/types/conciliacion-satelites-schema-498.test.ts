import { describe, it, expect } from "vitest";

import { marcarConsolidacionRecibidaSchema, montoCeroSchema } from "@/lib/types/conciliacion-satelites";
import { montoPositivoSchema } from "@/lib/types/wallet";

/**
 * FICHA 498 (T3.6b; Q5, R15a/R15b) — el borde de MARCAR y CORREGIR admite el CERO literal, y nada
 * mas: la decision («solo si el aporte reconocido es <= 0») la toma el repositorio con el dato.
 * `montoPositivoSchema` NO se toca: lo comparten la liquidacion, los gastos fijos, los efectos y los
 * cierres admin, que siguen sin aceptar 0 (red de sus otros consumidores).
 */

const CB = "6c2f2f8a-3b0e-4b0e-9a55-498000000002";
const valido = (montoRecibido: unknown) =>
  marcarConsolidacionRecibidaSchema.safeParse({ cierreBodegaId: CB, montoRecibido }).success;

describe("498/R15b — el borde de marcar/corregir", () => {
  it.each(["0", "0.0", "0.00"])("⭑ acepta el cero literal %s", (m) => {
    expect(valido(m)).toBe(true);
  });

  it.each(["485.00", "1", "0.01"])("sigue aceptando un monto positivo %s", (m) => {
    expect(valido(m)).toBe(true);
  });

  it.each(["-1", "-0.01", "0.001", "", "00.0.0", "cero", " 0"])("⭑ rechaza %j (negativo, tres decimales, vacio o basura)", (m) => {
    expect(valido(m)).toBe(false);
  });

  it("`montoCeroSchema` solo admite el cero", () => {
    expect(montoCeroSchema.safeParse("0.00").success).toBe(true);
    expect(montoCeroSchema.safeParse("1.00").success).toBe(false);
  });
});

describe("498/R15b — `montoPositivoSchema` NO cambia (sus otros consumidores no aceptan 0)", () => {
  it.each(["0", "0.00"])("⭑ sigue rechazando %s", (m) => {
    expect(montoPositivoSchema.safeParse(m).success).toBe(false);
  });

  it("y sigue aceptando un positivo", () => {
    expect(montoPositivoSchema.safeParse("0.01").success).toBe(true);
  });
});
