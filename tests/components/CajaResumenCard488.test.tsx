// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, within, cleanup } from "@testing-library/react";

import { CajaResumenCard } from "@/app/(app)/wallet/_components/CajaResumenCard";
import type { CajaResumenDTO, EstadoCaja } from "@/lib/types/wallet";

/**
 * Ficha 488 (T F.2, design §6.1) — la tarjeta de la caja con la ganancia SIN IVA (R11–R13).
 *
 *  - R11: la cifra grande del bloque «Ganancia de Ordenex» es `ganancia` (ya sin IVA).
 *  - R12: debajo, DENTRO de la misma región y en tipografía menor, «IVA cobrado a las tiendas: ₡X».
 *  - R13: un tercer bolsillo, «IVA por pagar», con importe, insignia de signo y pista, en «flujo» y en
 *    «saldo», con y sin filtros.
 *
 * Importes distintos entre sí a propósito y textos esperados escritos a mano.
 */
const RESUMEN: CajaResumenDTO = {
  entradas: "15000.00",
  salidas: "3000.00",
  enCaja: "12000.00",
  signoEnCaja: "positivo",
  ingresosPropios: "4200.00",
  egresosPropios: "2700.00",
  ganancia: "1500.00",
  signoGanancia: "positivo",
  deTerceros: "9000.00",
  periodoFiltrado: false,
  porcentajeTiendas: "75.00",
  ivaCobrado: "1635.50",
  ivaPorPagar: "1235.50",
  signoIvaPorPagar: "positivo",
  porcentajeIva: "10.30",
  modoComposicion: "dos_bolsillos",
  capital: "264.50",
  signoCapital: "positivo",
  deOrdenex: "1764.50",
  signoDeTerceros: "positivo",
  deTercerosAbsoluto: "9000.00",
  estado: "saldo",
  flujoDesde: "2026-08-25",
};

function pintar(overrides: Partial<CajaResumenDTO> = {}) {
  return render(<CajaResumenCard resumen={{ ...RESUMEN, ...overrides }} movimientos={7} />);
}

function region(container: HTMLElement, nombre: string): HTMLElement {
  const nodo = container.querySelector<HTMLElement>(`section[aria-label="${nombre}"]`);
  expect(nodo, `falta la región «${nombre}»`).not.toBeNull();
  return nodo as HTMLElement;
}

afterEach(() => {
  cleanup();
});

describe("488 — el bloque «Ganancia de Ordenex» (R11/R12)", () => {
  it("R11: la cifra grande del bloque es la ganancia sin IVA", () => {
    const { container } = pintar();
    const ganancia = region(container, "Ganancia de Ordenex");
    const cifra = ganancia.querySelector<HTMLElement>(".text-2xl");
    expect(cifra?.textContent).toBe("₡1.500");
  });

  it("R12: debajo, en la misma región, el IVA cobrado con su rótulo", () => {
    const { container } = pintar();
    const ganancia = region(container, "Ganancia de Ordenex");
    const linea = ganancia.querySelector<HTMLElement>('[data-dato="iva-cobrado"]');
    expect(linea, "falta la línea del IVA cobrado dentro del bloque").not.toBeNull();
    expect(linea?.textContent).toBe("IVA cobrado a las tiendas: ₡1.635,50");
  });

  it("R12: la línea del IVA va DESPUÉS de la cifra y con tipografía menor", () => {
    const { container } = pintar();
    const ganancia = region(container, "Ganancia de Ordenex");
    const cifra = ganancia.querySelector<HTMLElement>(".text-2xl") as HTMLElement;
    const linea = ganancia.querySelector<HTMLElement>('[data-dato="iva-cobrado"]') as HTMLElement;
    // DOCUMENT_POSITION_FOLLOWING = 4: la línea viene después de la cifra.
    expect(cifra.compareDocumentPosition(linea) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(linea.className.split(/\s+/)).toContain("text-xs");
    expect(linea.className).not.toMatch(/text-2xl|text-3xl|text-lg/);
  });

  it("R12: el IVA cobrado NO es la cifra de ningún otro bloque", () => {
    const { container } = pintar();
    const bolsilloIva = container.querySelector<HTMLElement>('[data-bolsillo="iva"]') as HTMLElement;
    expect(within(bolsilloIva).queryByText("₡1.635,50")).toBeNull();
  });
});

describe("488 — el tercer bolsillo «IVA por pagar» (R13)", () => {
  const VARIANTES: { estado: EstadoCaja; periodoFiltrado: boolean }[] = [
    { estado: "flujo", periodoFiltrado: false },
    { estado: "flujo", periodoFiltrado: true },
    { estado: "saldo", periodoFiltrado: false },
    { estado: "saldo", periodoFiltrado: true },
  ];

  it.each(VARIANTES)("estado $estado, filtros $periodoFiltrado: importe, insignia y pista", (v) => {
    const { container } = pintar(v);
    const bolsillo = container.querySelector<HTMLElement>('[data-bolsillo="iva"]');
    expect(bolsillo, "falta el bolsillo del IVA").not.toBeNull();
    const b = bolsillo as HTMLElement;
    expect(b.tagName).toBe("SECTION");
    expect(b.getAttribute("aria-label")).toBe("IVA por pagar");
    expect(within(b).getByText("₡1.235,50")).toBeInTheDocument();
    expect(within(b).getByText("Positivo")).toBeInTheDocument();
    expect(
      within(b).getByText(
        "El IVA cobrado a las tiendas menos lo ya pagado a Hacienda. No es ganancia de Ordenex.",
      ),
    ).toBeInTheDocument();
  });

  it("es HERMANO de los otros dos bolsillos, no está dentro de ninguno", () => {
    const { container } = pintar();
    const iva = container.querySelector<HTMLElement>('[data-bolsillo="iva"]') as HTMLElement;
    const tiendas = container.querySelector<HTMLElement>('[data-bolsillo="tiendas"]') as HTMLElement;
    const ordenex = container.querySelector<HTMLElement>('[data-bolsillo="ordenex"]') as HTMLElement;
    expect(iva.parentElement).toBe(tiendas.parentElement);
    expect(iva.parentElement).toBe(ordenex.parentElement);
    expect(ordenex.contains(iva)).toBe(false);
  });

  it("el signo lo da el servidor: negativo y cero con su insignia", () => {
    const negativo = pintar({ ivaPorPagar: "-320.00", signoIvaPorPagar: "negativo" });
    const bNeg = negativo.container.querySelector<HTMLElement>('[data-bolsillo="iva"]') as HTMLElement;
    expect(within(bNeg).getByText("-₡320")).toBeInTheDocument();
    expect(within(bNeg).getByText("Negativo")).toBeInTheDocument();
    cleanup();

    const cero = pintar({ ivaPorPagar: "0.00", signoIvaPorPagar: "cero" });
    const bCero = cero.container.querySelector<HTMLElement>('[data-bolsillo="iva"]') as HTMLElement;
    expect(within(bCero).getByText("₡0")).toBeInTheDocument();
    expect(within(bCero).getByText("En cero")).toBeInTheDocument();
  });

  it("cero controles interactivos en la tarjeta (R8 de la 231), con el bolsillo nuevo", () => {
    const { container } = pintar();
    expect(container.querySelectorAll("button, input, select, textarea, details, summary")).toHaveLength(0);
    // El único enlace sigue siendo el de la deuda con las tiendas.
    expect(container.querySelectorAll("a")).toHaveLength(1);
  });
});
