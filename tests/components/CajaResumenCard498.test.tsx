// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, within, cleanup } from "@testing-library/react";

import { CajaResumenCard } from "@/app/(app)/wallet/_components/CajaResumenCard";
import type { CajaResumenDTO, EstadoCaja } from "@/lib/types/wallet";

/**
 * Ficha 498 (T7.1, design §8.3) — el cuarto bolsillo de la tarjeta de la caja, «Por cobrar a
 * satélites» (R37).
 *
 *  - SIEMPRE visible: en «flujo» y en «saldo», con y sin filtros, también con 0.
 *  - La pista sale del SIGNO del servidor, con texto LITERAL de R37 (escrito a mano aquí, no leído
 *    de la constante que lo pinta: memoria «aserción contra su propia fuente»). En cero, sin pista.
 */
const PISTA_POSITIVO = "Lo que las satélites entregaron de menos al conciliar y aún no han pagado.";
const PISTA_NEGATIVO = "La central les debe a las satélites.";

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
  porcentajeTiendas: "70.00",
  ivaCobrado: "1635.50",
  ivaPorPagar: "1235.50",
  signoIvaPorPagar: "positivo",
  porcentajeIva: "10.30",
  porCobrarSatelites: "500.00",
  signoPorCobrarSatelites: "positivo",
  porcentajePorCobrar: "4.15",
  modoComposicion: "dos_bolsillos",
  capital: "264.50",
  signoCapital: "positivo",
  deEmpresa: "1764.50",
  signoDeTerceros: "positivo",
  deTercerosAbsoluto: "9000.00",
  estado: "saldo",
  flujoDesde: "2026-08-25",
};

function pintar(overrides: Partial<CajaResumenDTO> = {}) {
  return render(<CajaResumenCard resumen={{ ...RESUMEN, ...overrides }} movimientos={7} />);
}

function bolsillo(container: HTMLElement): HTMLElement {
  const nodo = container.querySelector<HTMLElement>('[data-bolsillo="por-cobrar-satelites"]');
  expect(nodo, "falta el bolsillo «Por cobrar a satélites»").not.toBeNull();
  return nodo as HTMLElement;
}

afterEach(() => {
  cleanup();
});

describe("498 — el bolsillo «Por cobrar a satélites» (R37)", () => {
  const VARIANTES: { estado: EstadoCaja; periodoFiltrado: boolean }[] = [
    { estado: "flujo", periodoFiltrado: false },
    { estado: "flujo", periodoFiltrado: true },
    { estado: "saldo", periodoFiltrado: false },
    { estado: "saldo", periodoFiltrado: true },
  ];

  it.each(VARIANTES)("estado $estado, filtros $periodoFiltrado: región, importe, insignia y pista", (v) => {
    const b = bolsillo(pintar(v).container);
    expect(b.tagName).toBe("SECTION");
    expect(b.getAttribute("aria-label")).toBe("Por cobrar a satélites");
    expect(within(b).getByText("₡500")).toBeInTheDocument();
    expect(within(b).getByText("Positivo")).toBeInTheDocument();
    expect(within(b).getByText(PISTA_POSITIVO)).toBeInTheDocument();
  });

  it("visible también con 0: importe ₡0, insignia «En cero» y SIN pista", () => {
    const b = bolsillo(
      pintar({ porCobrarSatelites: "0.00", signoPorCobrarSatelites: "cero", porcentajePorCobrar: "0.00" })
        .container,
    );
    expect(within(b).getByText("₡0")).toBeInTheDocument();
    expect(within(b).getByText("En cero")).toBeInTheDocument();
    expect(within(b).queryByText(PISTA_POSITIVO)).toBeNull();
    expect(within(b).queryByText(PISTA_NEGATIVO)).toBeNull();
    expect(b.querySelector("[data-pista]")).toBeNull();
  });

  it("negativo: la central les debe a las satélites", () => {
    const b = bolsillo(
      pintar({ porCobrarSatelites: "-250.00", signoPorCobrarSatelites: "negativo", porcentajePorCobrar: "0.00" })
        .container,
    );
    expect(within(b).getByText("-₡250")).toBeInTheDocument();
    expect(within(b).getByText("Negativo")).toBeInTheDocument();
    expect(within(b).getByText(PISTA_NEGATIVO)).toBeInTheDocument();
    expect(within(b).queryByText(PISTA_POSITIVO)).toBeNull();
  });

  it("la pista la decide el SIGNO del servidor, no el importe", () => {
    // El importe dice 500 pero el servidor dice «cero»: sin pista.
    const b = bolsillo(pintar({ signoPorCobrarSatelites: "cero" }).container);
    expect(within(b).queryByText(PISTA_POSITIVO)).toBeNull();
  });

  it("es HERMANO de los otros tres bolsillos, no está dentro de ninguno", () => {
    const { container } = pintar();
    const b = bolsillo(container);
    for (const otro of ["tiendas", "empresa", "iva"]) {
      const o = container.querySelector<HTMLElement>(`[data-bolsillo="${otro}"]`) as HTMLElement;
      expect(b.parentElement).toBe(o.parentElement);
      expect(o.contains(b)).toBe(false);
    }
  });

  it("cero controles interactivos en la tarjeta (R8 de la 231), con el bolsillo nuevo", () => {
    const { container } = pintar();
    expect(container.querySelectorAll("button, input, select, textarea, details, summary")).toHaveLength(0);
    expect(container.querySelectorAll("a")).toHaveLength(1);
  });
});
