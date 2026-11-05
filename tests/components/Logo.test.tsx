// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Logo } from "@/components/shared/Logo";

import { MARCA_RETIRADA, MARCA_RETIRADA_RE } from "@/tests/fixtures/marca-retirada-nombre-493";
// Feature 492 (R12) — el logo compartido pasa de wordmark de texto («Orden» + «ex») a imagen del
// logotipo de Velox Courier. Los casos de la 86 se conservan transformados: el nombre de marca
// (antes `textContent`) es ahora el nombre accesible, y el `className` sigue llegando a la raiz.
// Las rutas van como LITERALES de contrato, no contra `LOGO`.

const SOBRE_OSCURO = "/marca/logo-horizontal.svg";
const SOBRE_CLARO = "/marca/logo-horizontal-fondo-claro.svg";

function imagenesInternas(container: HTMLElement) {
  return Array.from(container.querySelectorAll("img"));
}

describe("components/shared/Logo — logotipo de Velox Courier (feature 86 R6, feature 492 R12)", () => {
  it.each(["oscuro", "claro", "tema"] as const)(
    "variante %s: un unico img accesible llamado «Velox Courier»",
    (fondo) => {
      render(<Logo fondo={fondo} />);
      const logos = screen.getAllByRole("img");
      expect(logos).toHaveLength(1);
      expect(logos[0]).toHaveAccessibleName("Velox Courier");
    },
  );

  it("por defecto (sin `fondo`) es la variante sobre fondo oscuro", () => {
    const { container } = render(<Logo />);
    expect(imagenesInternas(container).map((i) => i.getAttribute("src"))).toEqual([SOBRE_OSCURO]);
  });

  it("`oscuro` pinta el logotipo original", () => {
    const { container } = render(<Logo fondo="oscuro" />);
    expect(imagenesInternas(container).map((i) => i.getAttribute("src"))).toEqual([SOBRE_OSCURO]);
  });

  it("`claro` pinta la adaptacion con VELOX en azul marino", () => {
    const { container } = render(<Logo fondo="claro" />);
    expect(imagenesInternas(container).map((i) => i.getAttribute("src"))).toEqual([SOBRE_CLARO]);
  });

  it("`tema` pinta las dos: la clara se oculta en oscuro y la oscura solo aparece en oscuro", () => {
    const { container } = render(<Logo fondo="tema" />);
    const [clara, oscura] = imagenesInternas(container);
    expect(clara).toHaveAttribute("src", SOBRE_CLARO);
    expect(clara).toHaveClass("dark:hidden");
    expect(oscura).toHaveAttribute("src", SOBRE_OSCURO);
    expect(oscura).toHaveClass("hidden", "dark:inline-block");
  });

  it("las imagenes internas son decorativas (alt vacio): el nombre lo lleva la raiz", () => {
    const { container } = render(<Logo fondo="tema" />);
    for (const img of imagenesInternas(container)) {
      expect(img).toHaveAttribute("alt", "");
      expect(img).toHaveAttribute("aria-hidden", "true");
    }
  });

  it(`no queda ningun texto «${MARCA_RETIRADA}» (ni el wordmark partido)`, () => {
    const { container } = render(<Logo fondo="tema" />);
    expect(container.textContent).toBe("");
    expect(container.innerHTML).not.toMatch(MARCA_RETIRADA_RE);
  });

  it("el `className` de tamano y posicion llega a la raiz (feature 86)", () => {
    const { container } = render(<Logo className="text-xl absolute" />);
    expect(container.firstElementChild).toHaveClass("text-xl", "absolute");
  });
});
