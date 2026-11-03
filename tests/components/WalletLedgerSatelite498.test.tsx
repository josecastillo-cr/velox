// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";

import type { WalletMovimientoDTO } from "@/lib/types/wallet";

// Ficha 498 (T7.1, design §8.3, R40) — el libro de la caja y su descarga rotulan «Satélite» el dueño
// de las filas de diferencia, y nombran las dos categorías y el origen. Mismos dobles que
// `WalletLedgerIva488.test.tsx`.
vi.mock("@/lib/actions/wallet-anulacion", () => ({ anularMovimientoAction: vi.fn() }));
vi.mock("@/lib/actions/wallet-comprobante", () => ({
  verComprobanteAction: vi.fn(),
  adjuntarComprobanteAction: vi.fn(),
}));
vi.mock("@/lib/actions/libro-caja-autoria", () => ({
  autoriaDelLibroCajaAction: vi.fn(() => new Promise(() => {})),
}));
vi.mock("@/lib/actions/como-quedo", () => ({ comoQuedoAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), show: vi.fn(), dismiss: vi.fn() }),
}));

import { WalletLedger } from "@/app/(app)/wallet/_components/WalletLedger";
import { filaBaseCaja } from "@/app/(app)/wallet/_components/wallet-ledger-descarga-columnas";
import { CONCEPTOS_MANUALES } from "@/app/(app)/wallet/_components/wallet-conceptos-manuales";

function fila(over: Partial<WalletMovimientoDTO>): WalletMovimientoDTO {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    tipo: "egreso",
    categoria: "egreso_diferencia_satelite",
    monto: "500.00",
    origenTipo: "conciliacion_bodega_ajuste",
    origenId: "00000000-0000-4000-8000-000000000099",
    descripcion: null,
    registradoPor: null,
    fechaMovimiento: "2026-11-03T15:00:00.000Z",
    dueno: "por_cobrar_satelite",
    documento: null,
    ...over,
  };
}

const FALTO = fila({});
const SOBRO = fila({
  id: "00000000-0000-4000-8000-000000000002",
  tipo: "ingreso",
  categoria: "ingreso_diferencia_satelite",
  monto: "250.00",
});

function Envoltura({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
}

afterEach(() => cleanup());

describe("498 — el libro de la caja (R40)", () => {
  it("la celda de dueño de las dos filas de diferencia dice «Satélite», con el punto del bolsillo", () => {
    const { container } = render(
      <Envoltura>
        <WalletLedger movimientos={[FALTO, SOBRO]} onCambio={vi.fn()} />
      </Envoltura>,
    );
    const celdas = [...container.querySelectorAll<HTMLElement>('[data-dueno="por_cobrar_satelite"]')];
    expect(celdas).toHaveLength(2);
    for (const celda of celdas) {
      expect(celda.textContent).toBe("Satélite");
      // El MISMO token que el tramo de la barra (design §8.3).
      expect(celda.querySelector('[aria-hidden="true"]')?.className).toContain("bg-chart-16");
    }
  });

  it("las dos categorías se nombran con sus etiquetas (confirmadas por el humano el 2026-11-03)", () => {
    render(
      <Envoltura>
        <WalletLedger movimientos={[FALTO, SOBRO]} onCambio={vi.fn()} />
      </Envoltura>,
    );
    const tabla = screen.getByRole("table");
    expect(within(tabla).getAllByText("Diferencia de la satélite (faltó)").length).toBeGreaterThan(0);
    expect(within(tabla).getAllByText("Diferencia de la satélite (sobró o pagó)").length).toBeGreaterThan(0);
  });
});

describe("498 — la descarga del libro (R40)", () => {
  it("la columna «Es dinero de» dice «Satélite» y el concepto lleva su nombre", () => {
    expect(filaBaseCaja(FALTO)).toMatchObject({
      esDineroDe: "Satélite",
      concepto: "Diferencia de la satélite (faltó)",
    });
    expect(filaBaseCaja(SOBRO)).toMatchObject({
      esDineroDe: "Satélite",
      concepto: "Diferencia de la satélite (sobró o pagó)",
    });
  });
});

describe("498 — las diferencias no son un concepto manual (design §8.3)", () => {
  it("ningún concepto que una persona registra a mano es una diferencia de satélite", () => {
    const texto = JSON.stringify(CONCEPTOS_MANUALES);
    expect(texto).not.toContain("egreso_diferencia_satelite");
    expect(texto).not.toContain("ingreso_diferencia_satelite");
  });
});
