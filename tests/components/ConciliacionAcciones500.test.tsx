// @vitest-environment jsdom
//
// FICHA 500 (T7.1, design §2.4) — «Desmarcar» solo cuando se puede.
//
//   R3 — una consolidación conciliada ofrece «Desmarcar» solo si quien monta dice que se puede
//        (`puedeDesmarcar`, que el SERVIDOR calcula: sin dinero y no saldada con la regla anterior).
//   R5 — una «Recibido incompleto» sigue ofreciendo «Corregir», se pueda desmarcar o no.
//   R6 — si quien monta no lo dice, NO se ofrece (falla cerrado, como `puedeConciliar`).
//   R7 — si el servidor responde `con_asientos` / `saldada_regla_anterior` a un «Desmarcar» ofrecido con
//        datos viejos, el aviso de la 498 sale DENTRO del diálogo y la marca no cambia.
//
// Los textos esperados van escritos A MANO (memoria «aserción contra su propia fuente»).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { ToastProvider } from "@/providers/ToastProvider";

const revertirMock = vi.fn();
vi.mock("@/lib/actions/conciliacion-satelites", () => ({
  corregirConsolidacionRecibidaAction: vi.fn(),
  marcarConsolidacionRecibidaAction: vi.fn(),
  revertirConciliacionAction: (...a: unknown[]) => revertirMock(...a),
}));

import {
  ConciliacionAcciones,
  type ConciliacionAccionesProps,
} from "@/components/shared/conciliacion/ConciliacionAcciones";

const RECIBIDA = { conciliado: true, faltaPorRecibir: "0.00", montoRecibido: "91350.25" };
const INCOMPLETA = { conciliado: true, faltaPorRecibir: "1350.25", montoRecibido: "90000.00" };
const SIN_MARCAR = { conciliado: false, faltaPorRecibir: "91350.25", montoRecibido: null };

const DESMARCAR = /Desmarcar la consolidación de FGAM Limón del 20 oct/;
const CORREGIR = /Corregir el monto recibido de FGAM Limón del 20 oct/;

function Envoltura({ children }: Readonly<{ children: ReactNode }>) {
  return <ToastProvider>{children}</ToastProvider>;
}

function montar(over: Partial<ConciliacionAccionesProps> = {}) {
  const onCambio = vi.fn();
  render(
    <ConciliacionAcciones
      cierreBodegaId="cb-500"
      bodega="FGAM Limón"
      fecha="20 oct"
      recaudado={{ efectivo: "70000.00", simpe: "25500.50", transferencia: "4300.00" }}
      debe={{ monto: "91350.25", positivo: true }}
      marca={RECIBIDA}
      puedeConciliar
      onCambio={onCambio}
      {...over}
    />,
    { wrapper: Envoltura },
  );
  return onCambio;
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("500/R3 — una conciliada ofrece «Desmarcar» solo si se puede", () => {
  it("recibida con `puedeDesmarcar` → hay «Desmarcar»", () => {
    montar({ puedeDesmarcar: true });
    expect(screen.getByRole("button", { name: DESMARCAR })).toBeInTheDocument();
  });

  it("recibida con `puedeDesmarcar={false}` (tiene dinero o está saldada) → no hay «Desmarcar» ni ningún otro botón", () => {
    montar({ puedeDesmarcar: false });
    expect(screen.queryByRole("button", { name: /Desmarcar/ })).toBeNull();
    // Una recibida entera no tiene nada más que hacer: ni marcar ni corregir.
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("sin marcar → «Marcar recibido», nunca «Desmarcar», aunque llegue `puedeDesmarcar`", () => {
    montar({ marca: SIN_MARCAR, puedeDesmarcar: true });
    expect(screen.getByRole("button", { name: /Marcar recibido la consolidación de FGAM Limón/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Desmarcar/ })).toBeNull();
  });
});

describe("500/R6 — quien monta sin decirlo no ofrece «Desmarcar» (falla cerrado)", () => {
  it("recibida SIN la prop → no hay «Desmarcar»", () => {
    montar();
    expect(screen.queryByRole("button", { name: /Desmarcar/ })).toBeNull();
  });

  it("incompleta SIN la prop → no hay «Desmarcar»", () => {
    montar({ marca: INCOMPLETA });
    expect(screen.queryByRole("button", { name: /Desmarcar/ })).toBeNull();
  });
});

describe("500/R5 — una incompleta sigue ofreciendo «Corregir», tenga o no dinero", () => {
  it("incompleta que NO se puede desmarcar → «Corregir» sí, «Desmarcar» no", () => {
    montar({ marca: INCOMPLETA, puedeDesmarcar: false });
    expect(screen.getByRole("button", { name: CORREGIR })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Desmarcar/ })).toBeNull();
  });

  it("incompleta que SÍ se puede desmarcar → «Corregir» y «Desmarcar»", () => {
    montar({ marca: INCOMPLETA, puedeDesmarcar: true });
    expect(screen.getByRole("button", { name: CORREGIR })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: DESMARCAR })).toBeInTheDocument();
  });
});

describe("500/R7 — con datos viejos, el servidor sigue siendo la última palabra", () => {
  it.each([
    ["con_asientos", "Ya entró a la caja: no se puede revertir."],
    [
      "saldada_regla_anterior",
      "Esta consolidación está saldada con la regla anterior: no se puede revertir.",
    ],
  ])("`%s` → el aviso de la 498 dentro del diálogo, que sigue abierto, y no se relee nada", async (status, aviso) => {
    const user = userEvent.setup();
    revertirMock.mockResolvedValue({ status });
    const onCambio = montar({ puedeDesmarcar: true });

    await user.click(screen.getByRole("button", { name: DESMARCAR }));
    const dialogo = await screen.findByRole("dialog");
    await user.click(within(dialogo).getByRole("button", { name: "Desmarcar" }));

    await waitFor(() => expect(revertirMock).toHaveBeenCalledWith({ cierreBodegaId: "cb-500" }));
    const alerta = await within(dialogo).findByRole("alert");
    expect(alerta.textContent).toBe(aviso);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onCambio).not.toHaveBeenCalled();
    expect(screen.queryByText(/Marca deshecha/)).toBeNull();
  });
});
