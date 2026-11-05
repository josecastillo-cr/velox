// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { NOMBRE_ESPERADO } from "@/tests/fixtures/marca-esperada";
import { MARCA_RETIRADA } from "@/tests/fixtures/marca-retirada-nombre-493";

// FEATURE 493 (T11, R8) — el aviso de versión nueva y la sección de postulación de la landing
// nombran a la empresa con la marca. Frases literales; la marca, desde el fixture (L1, R16).

vi.mock("@/hooks/useActualizacionPwa", () => ({
  useActualizacionPwa: () => ({ seAvisa: true, actualizar: vi.fn() }),
}));
vi.mock("@/lib/actions/postulacion-recurso", () => ({
  postularRecurso: vi.fn(),
}));

import { AvisoVersionNueva } from "@/components/shared/AvisoVersionNueva";
import { LandingPostular } from "@/app/_landing/LandingPostular";

afterEach(() => cleanup());

describe("493/R8 — PWA y landing con la marca", () => {
  it("el aviso de versión nueva dice de qué app es la versión", () => {
    render(<AvisoVersionNueva />);
    expect(screen.getByRole("status")).toHaveTextContent(`Hay una versión nueva de ${NOMBRE_ESPERADO}`);
    expect(document.body.textContent).not.toContain(MARCA_RETIRADA);
  });

  // FEATURE 505 — `Alert` es un grid `auto 1fr` cuando lleva icono: sin extenderse a las dos
  // columnas, los botones caen en la del icono, la ensanchan y empujan el texto a la derecha.
  // jsdom no calcula grid, así que lo comprobable aquí es la clase; la medida se hizo en navegador.
  it("los botones del aviso ocupan todo el ancho de la tarjeta, no la columna del icono", () => {
    render(<AvisoVersionNueva />);
    const fila = screen.getByRole("button", { name: "Actualizar ahora" }).parentElement as HTMLElement;
    expect(fila.parentElement).toBe(screen.getByRole("status"));
    expect(fila.classList.contains("col-span-2")).toBe(true);
  });

  it("la sección de postulación invita a sumarse a la marca, con sus dos copys", () => {
    render(<LandingPostular />);
    expect(screen.getByText(`Sumate a ${NOMBRE_ESPERADO}`)).toBeInTheDocument();
    expect(
      screen.getByText(
        `¿Tenés un camión, carro o moto que no estás manejando? Ponelo a trabajar con ${NOMBRE_ESPERADO} y generá ingresos con nuestra operación.`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `¿Tenés otra forma de aportar o querés ser parte del equipo ${NOMBRE_ESPERADO}? Postulate y conversemos.`,
      ),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(MARCA_RETIRADA);
  });
});
