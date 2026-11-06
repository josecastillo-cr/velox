// @vitest-environment jsdom
//
// FICHA 502 (T6-A, design §3.2, salida A de Q1) — «Corregir» en una consolidación recibida de más.
//
//   R6  — una recibida exacta que no se puede desmarcar no ofrece nada, ni con `-0.00`.
//   R7  — una recibida de más ofrece «Corregir», se pueda desmarcar o no.
//   R8  — una SIN marcar nunca ofrece «Corregir», aunque deba un monto negativo.
//   R9  — confirmar lo envía como corrección y NUNCA como marca (la action de marcar exige una sin marcar y
//         respondería `conflict` siempre: es el defecto que 473/R14 ya arregló una vez).
//   R10 — título, monto y nota de partida, y aviso con el monto que quedó.
//
// Los textos esperados van escritos A MANO (memoria «aserción contra su propia fuente»). Los importes de
// lo que debe y lo marcado son distintos a propósito: partir del campo equivocado se ve.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import { ToastProvider } from "@/providers/ToastProvider";

const marcarMock = vi.fn();
const corregirMock = vi.fn();
vi.mock("@/lib/actions/conciliacion-satelites", () => ({
  corregirConsolidacionRecibidaAction: (...a: unknown[]) => corregirMock(...a),
  marcarConsolidacionRecibidaAction: (...a: unknown[]) => marcarMock(...a),
  revertirConciliacionAction: vi.fn(),
}));

import {
  ConciliacionAcciones,
  type ConciliacionAccionesProps,
} from "@/components/shared/conciliacion/ConciliacionAcciones";
import { llegoDeMas } from "@/app/(app)/cierres-admin/_components/cierre-labels";

/** Debe ₡800 y se marcó por ₡890: llegaron ₡90 de más. */
const DE_MAS = { conciliado: true, faltaPorRecibir: "-90.00", montoRecibido: "890.00" };

const CORREGIR = /Corregir el monto recibido de FGAM Limón del 20 oct/;
const DESMARCAR = /Desmarcar la consolidación de FGAM Limón del 20 oct/;
const MARCAR = /Marcar recibido la consolidación de FGAM Limón del 20 oct/;

function Envoltura({ children }: Readonly<{ children: ReactNode }>) {
  return <ToastProvider>{children}</ToastProvider>;
}

function montar(over: Partial<ConciliacionAccionesProps> = {}) {
  const onCambio = vi.fn();
  render(
    <ConciliacionAcciones
      cierreBodegaId="cb-502"
      bodega="FGAM Limón"
      fecha="20 oct"
      recaudado={{ efectivo: "700.00", simpe: "200.00", transferencia: "50.00" }}
      debe={{ monto: "800.00", positivo: true }}
      marca={DE_MAS}
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

describe("502/R7 — una recibida de más ofrece «Corregir», tenga o no dinero", () => {
  it("de más sin poder desmarcar → un solo botón, «Corregir»", () => {
    montar({ puedeDesmarcar: false });
    expect(screen.getByRole("button", { name: CORREGIR })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("de más pudiendo desmarcar → «Corregir» y «Desmarcar»", () => {
    montar({ puedeDesmarcar: true });
    expect(screen.getByRole("button", { name: CORREGIR })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: DESMARCAR })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("la que debe un negativo y se marcó por 0 también es de más, y parte de 0.00", async () => {
    const user = userEvent.setup();
    montar({
      debe: { monto: "-100.00", positivo: false },
      marca: { conciliado: true, faltaPorRecibir: "-100.00", montoRecibido: "0.00" },
    });
    await user.click(screen.getByRole("button", { name: CORREGIR }));
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByLabelText(/Monto recibido/)).toHaveValue("0.00");
  });

  it("sin permiso de conciliar no hay nada: `puedeConciliar` sigue mandando", () => {
    montar({ puedeConciliar: false });
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});

describe("502/R8 — una sin marcar nunca ofrece «Corregir»", () => {
  it("debe −450 sin marcar → «Marcar recibido» y ningún «Corregir»", () => {
    montar({
      debe: { monto: "-450.00", positivo: false },
      marca: { conciliado: false, faltaPorRecibir: "-450.00", montoRecibido: null },
    });
    expect(screen.getByRole("button", { name: MARCAR })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Corregir/ })).toBeNull();
  });

  it("y al confirmarla va a la action de marcar, no a la de corregir", async () => {
    const user = userEvent.setup();
    marcarMock.mockResolvedValue({ status: "ok", cierreBodegaId: "cb-502" });
    montar({
      debe: { monto: "-450.00", positivo: false },
      marca: { conciliado: false, faltaPorRecibir: "-450.00", montoRecibido: null },
    });
    await user.click(screen.getByRole("button", { name: MARCAR }));
    const dialogo = await screen.findByRole("dialog");
    await user.click(within(dialogo).getByRole("button", { name: "Marcar recibido" }));
    await waitFor(() => expect(marcarMock).toHaveBeenCalledTimes(1));
    expect(corregirMock).not.toHaveBeenCalled();
  });
});

describe("502/R6 — una recibida exacta sigue sin ofrecer nada", () => {
  it.each(["0.00", "-0.00", "-0", "0"])("falta %s sin poder desmarcar → 0 botones", (falta) => {
    montar({ marca: { conciliado: true, faltaPorRecibir: falta, montoRecibido: "800.00" } });
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});

describe("502/R9 — confirmar envía una corrección, nunca una marca", () => {
  it("se llama a la action de corregir una vez y a la de marcar cero veces", async () => {
    const user = userEvent.setup();
    corregirMock.mockResolvedValue({ status: "ok", cierreBodegaId: "cb-502" });
    const onCambio = montar({ puedeDesmarcar: false });

    await user.click(screen.getByRole("button", { name: CORREGIR }));
    const dialogo = await screen.findByRole("dialog");
    const campo = within(dialogo).getByLabelText(/Monto recibido/);
    await user.clear(campo);
    await user.type(campo, "800");
    await user.click(within(dialogo).getByRole("button", { name: "Corregir" }));

    await waitFor(() => expect(corregirMock).toHaveBeenCalledTimes(1));
    expect(corregirMock.mock.calls[0][0]).toEqual({ cierreBodegaId: "cb-502", montoRecibido: "800" });
    expect(marcarMock).not.toHaveBeenCalled();
    await waitFor(() => expect(onCambio).toHaveBeenCalled());
  });
});

describe("502/R10 — lo que dice «Corregir» sobre una recibida de más", () => {
  it("se titula «Corregir el monto recibido» y parte del monto marcado y de su nota, no de lo que debe", async () => {
    const user = userEvent.setup();
    montar({ nota: "llegaron ₡90 de más" });
    await user.click(screen.getByRole("button", { name: CORREGIR }));
    const dialogo = await screen.findByRole("dialog", { name: "Corregir el monto recibido" });
    expect(within(dialogo).getByLabelText(/Monto recibido/)).toHaveValue("890.00");
    expect(within(dialogo).getByLabelText(/Nota/)).toHaveValue("llegaron ₡90 de más");
    expect(within(dialogo).queryByRole("button", { name: "Marcar recibido" })).toBeNull();
  });

  it("al confirmar el servidor, anuncia «Monto recibido corregido a» y el monto que quedó", async () => {
    const user = userEvent.setup();
    corregirMock.mockResolvedValue({ status: "ok", cierreBodegaId: "cb-502" });
    montar();
    await user.click(screen.getByRole("button", { name: CORREGIR }));
    const dialogo = await screen.findByRole("dialog");
    const campo = within(dialogo).getByLabelText(/Monto recibido/);
    await user.clear(campo);
    await user.type(campo, "800");
    await user.click(within(dialogo).getByRole("button", { name: "Corregir" }));

    expect(await screen.findByText("Monto recibido corregido a ₡800.")).toBeInTheDocument();
    expect(screen.queryByText(/Marcada como recibida/)).toBeNull();
  });
});

describe("502 — `llegoDeMas`: comparación textual, money-safe", () => {
  it.each(["-90.00", "-0.01", "-1", " -90.00 ", "-100000.50"])("%s es de más", (falta) => {
    expect(llegoDeMas(falta)).toBe(true);
  });

  it.each(["0.00", "0", "-0", "-0.00", "-000.000", "90.00", "0.01", " -0.00 "])("%s no es de más", (falta) => {
    expect(llegoDeMas(falta)).toBe(false);
  });
});
