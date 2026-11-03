// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { LandingFooter } from "@/app/_landing/LandingFooter";

import { MARCA_RETIRADA } from "@/tests/fixtures/marca-retirada-nombre-493";
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
    expect(linea!.textContent).not.toContain(`${MARCA_RETIRADA} S.A.`);
    expect(linea!.querySelector("[data-pendiente]")).toBeNull();
    // Contrato de la ficha 490 / T8, fijado como literal a proposito (no contra su fuente).
    expect(linea!.textContent?.replace(/\s+/g, " ")).toBe(
      "© 2026 · Velox Courier · 3-102-965944 SOCIEDAD DE RESPONSABILIDAD LIMITADA · Costa Rica",
    );
  });
});

describe("LandingFooter — marca del pie (revision 490, e)", () => {
  it("sin `marca` (la landing) pinta el logo compartido, como siempre", () => {
    // Feature 492 (R15): el logo es la imagen de Velox Courier sobre fondo oscuro.
    const { container } = render(<LandingFooter />);
    const logo = screen.getByRole("img", { name: "Velox Courier" });
    expect(Array.from(logo.querySelectorAll("img")).map((i) => i.getAttribute("src"))).toEqual([
      "/marca/logo-horizontal.svg",
    ]);
    expect(container.querySelector("footer span.font-heading")).toBeNull();
  });

  it("con `marca` pinta ese texto en lugar del wordmark", () => {
    const { container } = render(<LandingFooter marca="MARCA-PRUEBA" />);
    expect(container.querySelector("footer span.font-heading")?.textContent).toBe("MARCA-PRUEBA");
    expect(container.textContent).not.toContain(MARCA_RETIRADA);
  });
});
