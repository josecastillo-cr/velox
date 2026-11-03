import { describe, it, expect } from "vitest";

import { fechaDiaInstanteCR } from "@/lib/utils/fecha-dia-iso";

// Ficha 495 (R6, R8) — día de Costa Rica (UTC−6 fijo) de un INSTANTE (`timestamp`) que llega
// como texto ISO. Los esperados son LITERALES: compararlos contra `fechaCalendarioCR` sería
// comparar la función contra su propia fuente.

describe("fechaDiaInstanteCR (ficha 495)", () => {
  it("R6: entre las 00:00 y las 05:59 UTC devuelve el día ANTERIOR del calendario UTC", () => {
    expect(fechaDiaInstanteCR("2026-11-01T05:03:00Z")).toBe("2026-10-31");
    expect(fechaDiaInstanteCR("2026-11-01T05:59:59.999Z")).toBe("2026-10-31");
  });

  it("R6: la medianoche UTC exacta es un instante (18:00 CR), no una fecha @db.Date", () => {
    expect(fechaDiaInstanteCR("2026-11-01T00:00:00.000Z")).toBe("2026-10-31");
  });

  it("R6: a partir de las 06:00 UTC devuelve el mismo día UTC", () => {
    expect(fechaDiaInstanteCR("2026-11-01T06:00:00Z")).toBe("2026-11-01");
    expect(fechaDiaInstanteCR("2026-11-01T23:59:00Z")).toBe("2026-11-01");
  });

  it("R8: lo que no es un instante legible se devuelve TAL CUAL", () => {
    expect(fechaDiaInstanteCR("")).toBe("");
    expect(fechaDiaInstanteCR("pendiente")).toBe("pendiente");
  });
});
