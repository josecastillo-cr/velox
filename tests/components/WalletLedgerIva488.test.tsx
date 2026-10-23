// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";

import type { WalletMovimientoDTO } from "@/lib/types/wallet";

// Ficha 488 (T F.6, R29) — el libro de la caja y su descarga rotulan el dueño «IVA por pagar» y los
// dos conceptos nuevos. Mismos dobles que `WalletLedgerVer458C.test.tsx`: el libro no se monta sin
// las Server Actions de sus paneles, y aquí no se lee ninguna.
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

function fila(over: Partial<WalletMovimientoDTO>): WalletMovimientoDTO {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    tipo: "egreso",
    categoria: "egreso_pago_iva",
    monto: "45000.00",
    origenTipo: "gasto",
    origenId: null,
    descripcion: "IVA de septiembre",
    registradoPor: null,
    fechaMovimiento: "2026-10-20T15:00:00.000Z",
    dueno: "iva",
    documento: null,
    ...over,
  };
}

const PAGO = fila({});
const ANULACION = fila({
  id: "00000000-0000-4000-8000-000000000002",
  tipo: "ingreso",
  categoria: "ingreso_reverso_pago_iva",
  origenId: PAGO.id,
});
const IVA_FLETE = fila({
  id: "00000000-0000-4000-8000-000000000003",
  tipo: "ingreso",
  categoria: "ingreso_iva_flete",
  origenTipo: "cierre_dia",
  origenId: "00000000-0000-4000-8000-000000000099",
  monto: "130.00",
});

function Envoltura({ children }: { children: ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>;
}

afterEach(() => cleanup());

describe("488 — el libro de la caja (R29)", () => {
  it("la celda de dueño de una fila de IVA dice «IVA por pagar», con su punto de color", () => {
    const { container } = render(
      <Envoltura>
        <WalletLedger movimientos={[PAGO, ANULACION, IVA_FLETE]} onCambio={vi.fn()} />
      </Envoltura>,
    );
    const celdas = [...container.querySelectorAll<HTMLElement>('[data-dueno="iva"]')];
    expect(celdas).toHaveLength(3);
    for (const celda of celdas) {
      expect(celda.textContent).toBe("IVA por pagar");
      expect(celda.querySelector('[aria-hidden="true"]')?.className).toContain("bg-chart-13");
    }
  });

  it("los dos conceptos nuevos se nombran «Pago de IVA» y «Pago de IVA anulado»", () => {
    render(
      <Envoltura>
        <WalletLedger movimientos={[PAGO, ANULACION]} onCambio={vi.fn()} />
      </Envoltura>,
    );
    const tabla = screen.getByRole("table");
    expect(within(tabla).getAllByText("Pago de IVA").length).toBeGreaterThan(0);
    expect(within(tabla).getAllByText("Pago de IVA anulado").length).toBeGreaterThan(0);
  });
});

describe("488 — la descarga del libro (R29)", () => {
  it("la columna «Es dinero de» dice «IVA por pagar» y el concepto lleva su nombre", () => {
    expect(filaBaseCaja(PAGO)).toMatchObject({ esDineroDe: "IVA por pagar", concepto: "Pago de IVA" });
    expect(filaBaseCaja(ANULACION)).toMatchObject({
      esDineroDe: "IVA por pagar",
      concepto: "Pago de IVA anulado",
    });
    expect(filaBaseCaja(IVA_FLETE)).toMatchObject({
      esDineroDe: "IVA por pagar",
      concepto: "IVA del flete cobrado a la tienda",
    });
  });
});
