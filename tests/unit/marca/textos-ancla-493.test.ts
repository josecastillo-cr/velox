import { describe, expect, it } from "vitest";

import { MARCA } from "@/lib/marca/identidad";
import { NOMBRE_CORTO_ESPERADO, NOMBRE_ESPERADO } from "@/tests/fixtures/marca-esperada";

// FEATURE 493 (T1, design §5 L2) — EL ANCLA. Unico test de la 493 donde la constante de
// produccion y el fixture de los tests de texto se encuentran (R2).
//
// Si alguien cambia `MARCA`, esto sale rojo hasta que se actualiza el fixture; si alguien
// escribe un label a mano, lo pone rojo su propio test contra el fixture. Por eso los tests de
// texto NO importan `MARCA` (R16): compararian el label contra su propia fuente.
describe("Feature 493 — R2: el fixture de los tests de texto es la marca de produccion", () => {
  it("MARCA.nombre es exactamente «Velox Courier» (literal de contrato)", () => {
    expect(MARCA.nombre).toBe("Velox Courier");
  });

  it("MARCA.nombreCorto es exactamente «Velox» (literal de contrato, P1)", () => {
    expect(MARCA.nombreCorto).toBe("Velox");
  });

  it("el fixture coincide con la constante de produccion", () => {
    expect(MARCA.nombre).toBe(NOMBRE_ESPERADO);
    expect(MARCA.nombreCorto).toBe(NOMBRE_CORTO_ESPERADO);
  });
});
