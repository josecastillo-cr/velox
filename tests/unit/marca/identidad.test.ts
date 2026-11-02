import { describe, expect, it } from "vitest";

import { DATOS_LEGALES } from "@/app/_legal/datos-legales";
import { LOGO, MARCA } from "@/lib/marca/identidad";

// Feature 492 — R1. Los valores van como LITERALES DE CONTRATO a proposito: compararlos contra
// su propia fuente siempre estaria verde.
describe("Feature 492 — fuente unica de la marca (R1)", () => {
  it("declara nombre, nombre corto, descripcion y color de tema", () => {
    expect(MARCA.nombre).toBe("Velox Courier");
    expect(MARCA.nombreCorto).toBe("Velox");
    expect(MARCA.descripcion).toBe("Plataforma de logística y entregas Velox Courier");
    expect(MARCA.colorTema).toBe("#011027");
  });

  it("declara las rutas publicas de las tres variantes del logo", () => {
    expect(LOGO).toEqual({
      sobreOscuro: "/marca/logo-horizontal.svg",
      sobreClaro: "/marca/logo-horizontal-fondo-claro.svg",
      simbolo: "/marca/logo-simbolo.svg",
    });
  });

  it("no diverge de la marca de los datos legales (feature 490)", () => {
    expect(MARCA.nombre).toBe(DATOS_LEGALES.marca);
  });
});
