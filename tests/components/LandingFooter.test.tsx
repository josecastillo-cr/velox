// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { LandingFooter } from "@/app/_landing/LandingFooter";

/**
 * Feature 490 (R22) — el pie de la landing enlaza las paginas legales. Hasta la 490 «Política de
 * Privacidad» era un `<span>` porque no habia ruta; ahora la hay y es publica.
 */
describe("LandingFooter — enlaces legales (R22)", () => {
  it("«Política de Privacidad» es un enlace a /privacidad", () => {
    render(<LandingFooter />);
    expect(screen.getByRole("link", { name: "Política de Privacidad" })).toHaveAttribute(
      "href",
      "/privacidad",
    );
  });

  it("«Eliminación de datos» es un enlace a /eliminacion-datos", () => {
    render(<LandingFooter />);
    expect(screen.getByRole("link", { name: "Eliminación de datos" })).toHaveAttribute(
      "href",
      "/eliminacion-datos",
    );
  });

  it("los dos enlaces viven en la columna «Legal»", () => {
    const { container } = render(<LandingFooter />);
    const titulo = [...container.querySelectorAll("p")].find((p) => p.textContent === "Legal");
    const columna = titulo?.parentElement;

    expect(columna?.querySelector('a[href="/privacidad"]')).not.toBeNull();
    expect(columna?.querySelector('a[href="/eliminacion-datos"]')).not.toBeNull();
  });

  it("la linea de copyright lee marca y razon social de los datos legales, sin literal fijo", () => {
    const { container } = render(<LandingFooter />);
    const linea = [...container.querySelectorAll("span")].find((el) =>
      el.textContent?.startsWith("© 2026"),
    );

    expect(linea).toBeDefined();
    expect(linea!.textContent).not.toContain("Ordenex S.A.");
    expect(linea!.querySelector("[data-pendiente]")).toBeNull();
    // Contrato de la ficha 490 / T8, fijado como literal a proposito (no contra su fuente).
    expect(linea!.textContent?.replace(/\s+/g, " ")).toBe(
      "© 2026 · Velox Courier · 3-102-965944 SOCIEDAD DE RESPONSABILIDAD LIMITADA · Costa Rica",
    );
  });
});
