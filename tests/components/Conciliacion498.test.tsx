// @vitest-environment jsdom
//
// FICHA 498 (T7.2, design §8.4 y §9) — la conciliación de una satélite en pantalla, con la regla nueva:
// lo que DEBE y no el efectivo (R16), lo recaudado por método y el texto literal de que lo recibido es
// un TOTAL (R16a/R16b), el recibido 0 con dinero por entregar (R15a), revertir con asientos (R21),
// los tres bloques y el rótulo de la saldada (R41/R41a), la nota literal (R43) y la columna «Sin
// consolidar» (R42).
//
// Los textos esperados van escritos A MANO, no leídos de la constante que los pinta (memoria
// «aserción contra su propia fuente»). Los importes del doble son distintos entre sí a propósito: el
// efectivo, lo que debe y el general nunca coinciden, así que un cableado al campo equivocado se ve.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";

import { ToastProvider } from "@/providers/ToastProvider";
import type { ConsolidacionSateliteDTO, SaldoSateliteDTO } from "@/lib/types/conciliacion-satelites";

const marcarMock = vi.fn();
const corregirMock = vi.fn();
const revertirMock = vi.fn();
const listarConsolidacionesMock = vi.fn();
const listarSaldosMock = vi.fn();
vi.mock("@/lib/actions/conciliacion-satelites", () => ({
  corregirConsolidacionRecibidaAction: (...a: unknown[]) => corregirMock(...a),
  marcarConsolidacionRecibidaAction: (...a: unknown[]) => marcarMock(...a),
  revertirConciliacionAction: (...a: unknown[]) => revertirMock(...a),
  listarConsolidacionesSateliteAction: (...a: unknown[]) => listarConsolidacionesMock(...a),
  listarConsolidacionesSateliteCompletoAction: vi.fn(),
  listarSaldosSatelitesAction: (...a: unknown[]) => listarSaldosMock(...a),
  listarSaldosSatelitesCompletoAction: vi.fn(),
  obtenerResumenSatelitesAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

import { MarcarRecibidoDialog } from "@/components/shared/conciliacion/MarcarRecibidoDialog";
import { ConciliacionAcciones } from "@/components/shared/conciliacion/ConciliacionAcciones";
import { ConciliacionSatelite } from "@/app/(app)/wallet/satelites/_components/ConciliacionSatelite";
import { SaldosSatelitesTable } from "@/app/(app)/wallet/satelites/_components/SaldosSatelitesTable";

const TEXTO_R16A =
  "Escribe todo lo que recibió la central por esta consolidación: lo que entregó la satélite más el SINPE o la transferencia que llegó directo a la cuenta de la central.";
const TEXTO_R15A = "Esta consolidación tiene dinero por entregar: el monto recibido no puede ser 0.";
const TEXTO_R21 = "Ya entró a la caja: corrige el monto en vez de revertir";
const NOTA_R43 =
  "Marcar recibido asienta el dinero en la caja. Después no se puede desmarcar: si el monto no es el correcto, usa «Corregir»";

const RECAUDADO = { efectivo: "70000.00", simpe: "25500.50", transferencia: "4300.00" };

function Envoltura({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <ToastProvider>{children}</ToastProvider>
    </SWRConfig>
  );
}

function consolidacion(over: Partial<ConsolidacionSateliteDTO> = {}): ConsolidacionSateliteDTO {
  return {
    cierreBodegaId: "cb-1",
    solicitadoAt: "2026-10-20T14:00:00.000Z",
    totales: { ...RECAUDADO, general: "99800.50" },
    montoRecibido: null,
    faltaPorRecibir: "91350.25",
    totalPagoMensajero: "7200.00",
    totalIngresoBodegaRechazos: "1250.25",
    paraLaCentral: "91350.25",
    debe: "91350.25",
    debePositivo: true,
    saldadaReglaAnterior: false,
    puedeDesmarcar: false, // ficha 500
    conciliado: false,
    conciliadoAt: null,
    conciliadoPorNombre: null,
    nota: null,
    cantidadCierres: 2,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(cleanup);

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe("R16 — el diálogo propone lo que DEBE, o 0; nunca el efectivo", () => {
  function abrir(debe: { monto: string; positivo: boolean } | null, montoActual: string | null = null) {
    return render(
      <MarcarRecibidoDialog
        open
        onOpenChange={vi.fn()}
        bodega="FGAM Limón"
        fecha="20 oct"
        recaudado={RECAUDADO}
        debe={debe}
        montoActual={montoActual}
        onMarcar={marcarMock}
      />,
    );
  }

  it("debe positivo → el campo nace con lo que debe, y la banda «Debe» lo enseña", () => {
    abrir({ monto: "91350.25", positivo: true });
    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByLabelText(/Monto recibido/)).toHaveValue("91350.25");
    expect(dialogo.querySelector('[data-banda="debe"]')).toHaveTextContent("Debe");
    expect(dialogo.querySelector('[data-banda="debe"]')).toHaveTextContent("₡91.350,25");
  });

  it("debe cero → el campo nace con 0", () => {
    abrir({ monto: "0.00", positivo: false });
    expect(screen.getByLabelText(/Monto recibido/)).toHaveValue("0");
  });

  it("debe negativo → el campo nace con 0, y la banda enseña el aporte tal cual", () => {
    abrir({ monto: "-1500.00", positivo: false });
    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByLabelText(/Monto recibido/)).toHaveValue("0");
    expect(dialogo.querySelector('[data-banda="debe"]')).toHaveTextContent("-₡1.500");
  });

  it("el signo lo decide el SERVIDOR: un monto positivo con `positivo: false` prefija 0", () => {
    abrir({ monto: "91350.25", positivo: false });
    expect(screen.getByLabelText(/Monto recibido/)).toHaveValue("0");
  });

  it("nunca el efectivo, ni siquiera sin dato de lo que debe: el campo arranca vacío", () => {
    abrir(null);
    const dialogo = screen.getByRole("dialog");
    expect(within(dialogo).getByLabelText(/Monto recibido/)).toHaveValue("");
    expect(within(dialogo).getByLabelText(/Monto recibido/)).not.toHaveValue("70000.00");
    expect(dialogo.querySelector('[data-banda="debe"]')).toBeNull();
  });

  it("corregir parte del monto ya marcado, no de lo que debe", () => {
    abrir({ monto: "91350.25", positivo: true }, "80000.00");
    expect(screen.getByLabelText(/Monto recibido/)).toHaveValue("80000.00");
  });
});

describe("R16a/R16b — lo recaudado por método, el texto literal y UN solo monto", () => {
  it.each([
    ["marcar", null],
    ["corregir", "80000.00"],
  ] as const)("al %s", (_modo, montoActual) => {
    render(
      <MarcarRecibidoDialog
        open
        onOpenChange={vi.fn()}
        bodega="FGAM Limón"
        fecha="20 oct"
        recaudado={RECAUDADO}
        debe={{ monto: "91350.25", positivo: true }}
        montoActual={montoActual}
        onMarcar={marcarMock}
      />,
    );
    const dialogo = screen.getByRole("dialog");
    const recaudado = dialogo.querySelector<HTMLElement>('dl[aria-label="Recaudado"]') as HTMLElement;
    expect(recaudado).not.toBeNull();
    expect(within(recaudado).getByText("Efectivo").nextElementSibling).toHaveTextContent("₡70.000");
    expect(within(recaudado).getByText("SINPE").nextElementSibling).toHaveTextContent("₡25.500,50");
    expect(within(recaudado).getByText("Transferencia").nextElementSibling).toHaveTextContent("₡4.300");
    expect(within(dialogo).getByText(TEXTO_R16A)).toBeInTheDocument();
    // R16b: UN solo campo de monto. El otro campo de texto es la nota (un `textarea`).
    const inputs = dialogo.querySelectorAll("input");
    expect(inputs).toHaveLength(1);
    expect(within(dialogo).getAllByRole("textbox")).toHaveLength(2);
    expect(within(dialogo).queryByLabelText(/SINPE|Transferencia|Efectivo/)).toBeNull();
  });
});

describe("R15a — recibido 0 con dinero por entregar", () => {
  it("el 0 llega al servidor; si responde `recibido_cero_con_aporte`, se dice y no cambia nada", async () => {
    const user = userEvent.setup();
    const onMarcado = vi.fn();
    const onOpenChange = vi.fn();
    marcarMock.mockResolvedValue({ status: "recibido_cero_con_aporte" });
    render(
      <MarcarRecibidoDialog
        open
        onOpenChange={onOpenChange}
        bodega="FGAM Limón"
        fecha="20 oct"
        recaudado={RECAUDADO}
        debe={{ monto: "91350.25", positivo: true }}
        onMarcar={marcarMock}
        onMarcado={onMarcado}
      />,
    );
    const campo = screen.getByLabelText(/Monto recibido/);
    await user.clear(campo);
    await user.type(campo, "0");
    const confirmar = screen.getByRole("button", { name: "Marcar recibido" });
    expect(confirmar).toBeEnabled();
    await user.click(confirmar);

    await waitFor(() => expect(marcarMock).toHaveBeenCalledWith({ montoRecibido: "0" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(TEXTO_R15A);
    expect(onMarcado).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    // El campo conserva lo tecleado: nada se tragó.
    expect(screen.getByLabelText(/Monto recibido/)).toHaveValue("0");
  });

  it("el cliente no es más estricto que el borde: 0, 0.0 y 0.00 habilitan; -1 y 0.001 no", async () => {
    const user = userEvent.setup();
    render(
      <MarcarRecibidoDialog
        open
        onOpenChange={vi.fn()}
        bodega="FGAM Limón"
        fecha="20 oct"
        recaudado={RECAUDADO}
        debe={{ monto: "0.00", positivo: false }}
        onMarcar={marcarMock}
      />,
    );
    const campo = screen.getByLabelText(/Monto recibido/);
    const confirmar = screen.getByRole("button", { name: "Marcar recibido" });
    for (const [valor, habilitado] of [
      ["0", true],
      ["0.0", true],
      ["0.00", true],
      ["-1", false],
      ["0.001", false],
    ] as const) {
      await user.clear(campo);
      await user.type(campo, valor);
      if (habilitado) expect(confirmar, valor).toBeEnabled();
      else expect(confirmar, valor).toBeDisabled();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe("R21 — revertir una consolidación que ya entró a la caja", () => {
  function montar(onCambio = vi.fn()) {
    render(
      <ConciliacionAcciones
        cierreBodegaId="cb-9"
        bodega="FGAM Limón"
        fecha="20 oct"
        recaudado={RECAUDADO}
        debe={{ monto: "91350.25", positivo: true }}
        marca={{ conciliado: true, faltaPorRecibir: "0.00", montoRecibido: "91350.25" }}
        puedeConciliar
        // Ficha 500: la pantalla se cargó cuando aún se podía desmarcar (datos viejos, R7); el
        // servidor es quien responde `con_asientos` / `saldada_regla_anterior`.
        puedeDesmarcar
        onCambio={onCambio}
      />,
      { wrapper: Envoltura },
    );
    return onCambio;
  }

  it("con `con_asientos`, el texto LITERAL aparece en el diálogo y la marca queda tal cual", async () => {
    const user = userEvent.setup();
    revertirMock.mockResolvedValue({ status: "con_asientos" });
    const onCambio = montar();
    await user.click(screen.getByRole("button", { name: /Desmarcar la consolidación de FGAM Limón/ }));
    const dialogo = await screen.findByRole("dialog");
    await user.click(within(dialogo).getByRole("button", { name: "Desmarcar" }));

    await waitFor(() => expect(revertirMock).toHaveBeenCalledWith({ cierreBodegaId: "cb-9" }));
    const aviso = await within(dialogo).findByRole("alert");
    expect(aviso.textContent).toBe(TEXTO_R21);
    // No cambió nada: el diálogo sigue abierto, no se relee la lista y no se anuncia «Marca deshecha».
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onCambio).not.toHaveBeenCalled();
    expect(screen.queryByText(/Marca deshecha/)).toBeNull();
  });

  // [S] Ficha 502 (R1), decisión del humano del 2026-11-04: este caso afirmaba la nota DENTRO del diálogo. Se
  // invierte: quien está por desmarcar leía que «después no se puede desmarcar». El literal `NOTA_R43` se queda
  // a mano; este archivo no importa la constante, que el texto es contrato.
  it("502/R1 — el diálogo de «Desmarcar» NO lleva la nota de R43 ni dice que no se puede desmarcar", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: /Desmarcar la consolidación de FGAM Limón/ }));
    const dialogo = await screen.findByRole("dialog");
    // Premisa: es el diálogo de Desmarcar, el que dice el importe (R2). Sin esto, las dos ausencias de abajo no prueban nada.
    expect(dialogo).toHaveTextContent("Ahora mismo consta recibida por");
    expect(within(dialogo).queryByText(NOTA_R43)).toBeNull();
    expect(dialogo).not.toHaveTextContent(/no se puede desmarcar/i);
    expect(dialogo).not.toHaveTextContent(/no mueve|informativa|ningún col|ningun col/i);
  });

  it("revisión m2 — con `saldada_regla_anterior`, el aviso LITERAL aparece en el diálogo y no cambia nada", async () => {
    const user = userEvent.setup();
    revertirMock.mockResolvedValue({ status: "saldada_regla_anterior" });
    const onCambio = montar();
    await user.click(screen.getByRole("button", { name: /Desmarcar la consolidación de FGAM Limón/ }));
    const dialogo = await screen.findByRole("dialog");
    await user.click(within(dialogo).getByRole("button", { name: "Desmarcar" }));

    const aviso = await within(dialogo).findByRole("alert");
    expect(aviso.textContent).toBe(
      "Esta consolidación está saldada con la regla anterior: no se puede revertir; si el monto no es el correcto, corrígelo.",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onCambio).not.toHaveBeenCalled();
    expect(screen.queryByText(/No se pudo completar la operación/)).toBeNull();
  });

  it("sin asientos (R22), revertir sigue como siempre: cierra y relee", async () => {
    const user = userEvent.setup();
    revertirMock.mockResolvedValue({ status: "ok", cierreBodegaId: "cb-9" });
    const onCambio = montar();
    await user.click(screen.getByRole("button", { name: /Desmarcar la consolidación de FGAM Limón/ }));
    const dialogo = await screen.findByRole("dialog");
    await user.click(within(dialogo).getByRole("button", { name: "Desmarcar" }));
    await waitFor(() => expect(onCambio).toHaveBeenCalled());
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe("R41/R41a/R43 — la conciliación de una bodega", () => {
  async function montar(items: ConsolidacionSateliteDTO[]) {
    listarConsolidacionesMock.mockResolvedValue({ status: "ok", items, total: items.length, page: 1, pageSize: 25 });
    render(
      <ConciliacionSatelite
        bodega={{ zonaId: "z-limon", zonaNombre: "FGAM Limón" }}
        pendiente="91350.25"
        puedeConciliar
      />,
      { wrapper: Envoltura },
    );
    return screen.findByRole("region", { name: "Conciliación de FGAM Limón" });
  }

  /** El valor de un dato rotulado dentro de un bloque. */
  function dato(bloque: HTMLElement, rotulo: string): string {
    return within(bloque).getByText(rotulo).nextElementSibling?.textContent ?? "";
  }

  it("R41 — los tres bloques, con los importes del DTO tal cual", async () => {
    const region = await montar([consolidacion()]);
    const bloque = (nombre: string) =>
      region.querySelector<HTMLElement>(`dl[aria-label="${nombre} del 20 oct"]`) as HTMLElement;

    await waitFor(() => expect(bloque("Recaudado")).not.toBeNull());
    expect(dato(bloque("Recaudado"), "Efectivo")).toBe("₡70.000");
    expect(dato(bloque("Recaudado"), "SINPE")).toBe("₡25.500,50");
    expect(dato(bloque("Recaudado"), "Transferencia")).toBe("₡4.300");
    expect(dato(bloque("Recaudado"), "Total")).toBe("₡99.800,50");

    expect(dato(bloque("De la satélite"), "Pago a sus mensajeros")).toBe("₡7.200");
    expect(dato(bloque("De la satélite"), "Su ganancia por rechazos")).toBe("₡1.250,25");

    const cuenta = bloque("Debe y recibido");
    expect(dato(cuenta, "Debe")).toBe("₡91.350,25");
    expect(dato(cuenta, "Monto recibido")).toBe("—");
    expect(dato(cuenta, "Falta por recibir")).toBe("₡91.350,25");
    // Sin la saldada, no hay rótulo.
    expect(within(region).queryByText("Saldada con la regla anterior")).toBeNull();
  });

  it("R41a — una saldada con la regla anterior lleva su rótulo y «Debe» = `debe`", async () => {
    const region = await montar([
      consolidacion({
        saldadaReglaAnterior: true,
        debe: "64000.00",
        paraLaCentral: "91350.25",
        montoRecibido: "64000.00",
        faltaPorRecibir: "0.00",
        conciliado: true,
        conciliadoAt: "2026-10-21T15:00:00.000Z",
        conciliadoPorNombre: "Ana Rojas",
      }),
    ]);
    expect(await within(region).findByText("Saldada con la regla anterior")).toBeInTheDocument();
    const cuenta = region.querySelector<HTMLElement>('dl[aria-label="Debe y recibido del 20 oct"]') as HTMLElement;
    expect(dato(cuenta, "Debe")).toBe("₡64.000");
    expect(dato(cuenta, "Monto recibido")).toBe("₡64.000");
  });

  it("R41 — el aviso de la diferencia habla de lo que DEBÍA, no del efectivo", async () => {
    const region = await montar([
      consolidacion({
        montoRecibido: "90000.00",
        faltaPorRecibir: "1350.25",
        conciliado: true,
        conciliadoAt: "2026-10-21T15:00:00.000Z",
        conciliadoPorNombre: "Ana Rojas",
      }),
    ]);
    const aviso = await within(region).findByRole("status");
    expect(aviso).toHaveTextContent(
      "Debía ₡91.350,25 y se recibieron ₡90.000. La diferencia de ₡1.350,25 sigue contando como pendiente",
    );
    expect(aviso).not.toHaveTextContent("₡70.000");
  });

  it("R16 — «Marcar recibido» abre el diálogo con lo que debe y lo recaudado del DTO", async () => {
    const user = userEvent.setup();
    const region = await montar([consolidacion()]);
    await user.click(
      await within(region).findByRole("button", { name: /Marcar recibido la consolidación de FGAM Limón/ }),
    );
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByLabelText(/Monto recibido/)).toHaveValue("91350.25");
    expect(within(dialogo).getByText(TEXTO_R16A)).toBeInTheDocument();
  });

  it("R43 — la nota del pie es LITERAL", async () => {
    const region = await montar([consolidacion()]);
    expect(within(region).getByRole("note").textContent).toBe(NOTA_R43);
  });

  it("502/R7 — una recibida de más ofrece «Corregir» en la conciliación, con su badge «Recibido»", async () => {
    const region = await montar([
      consolidacion({
        montoRecibido: "91440.25",
        faltaPorRecibir: "-90.00",
        conciliado: true,
        conciliadoAt: "2026-10-21T15:00:00.000Z",
        conciliadoPorNombre: "Ana Rojas",
      }),
    ]);
    expect(
      await within(region).findByRole("button", { name: /Corregir el monto recibido de FGAM Limón del 20 oct/ }),
    ).toBeInTheDocument();
    expect(within(region).queryByRole("button", { name: /Desmarcar/ })).toBeNull();
    // El estado no cambia (fuera de alcance de la 502): sigue diciendo «Recibido», no incompleto.
    expect(within(region).getByText("Recibido")).toBeInTheDocument();
    expect(within(region).queryByText("Recibido incompleto")).toBeNull();
  });

  it("500/R3 — `puedeDesmarcar` del DTO llega al botón: solo la conciliada sin dinero ofrece «Desmarcar»", async () => {
    const user = userEvent.setup();
    const conciliada = {
      montoRecibido: "91350.25",
      faltaPorRecibir: "0.00",
      conciliado: true,
      conciliadoAt: "2026-10-21T15:00:00.000Z",
      conciliadoPorNombre: "Ana Rojas",
    };
    revertirMock.mockResolvedValue({ status: "ok", cierreBodegaId: "cb-sin-dinero" });
    const region = await montar([
      consolidacion({ ...conciliada, cierreBodegaId: "cb-con-dinero", puedeDesmarcar: false }),
      consolidacion({
        ...conciliada,
        cierreBodegaId: "cb-sin-dinero",
        solicitadoAt: "2026-10-21T14:00:00.000Z",
        puedeDesmarcar: true,
      }),
    ]);

    await within(region).findByRole("button", { name: /Desmarcar la consolidación de FGAM Limón del 21 oct/ });
    const botones = within(region).getAllByRole("button", { name: /Desmarcar/ });
    expect(botones).toHaveLength(1);

    await user.click(botones[0]);
    const dialogo = await screen.findByRole("dialog");
    await user.click(within(dialogo).getByRole("button", { name: "Desmarcar" }));
    await waitFor(() => expect(revertirMock).toHaveBeenCalledWith({ cierreBodegaId: "cb-sin-dinero" }));
  });

  // Ficha 503: la ayuda dice que esta fila no ofrece ningún botón. Si un día gana uno, este caso se pone rojo y
  // obliga a revisar la frase. `puedeDesmarcar: false` lo afirma este doble; el valor real del servidor para una
  // saldada lo mide `500-con-dinero-sql-real.test.ts` contra Postgres.
  it("503/R4 — una saldada sin corregir lleva su rótulo y su fila no ofrece ningún botón, aunque el actor pueda conciliar", async () => {
    const region = await montar([
      consolidacion({
        cierreBodegaId: "cb-saldada",
        saldadaReglaAnterior: true,
        puedeDesmarcar: false,
        debe: "64000.00",
        paraLaCentral: "91350.25",
        montoRecibido: "64000.00",
        faltaPorRecibir: "0.00",
        conciliado: true,
        conciliadoAt: "2026-10-21T15:00:00.000Z",
        conciliadoPorNombre: "Ana Rojas",
      }),
      consolidacion({
        cierreBodegaId: "cb-control",
        solicitadoAt: "2026-10-22T14:00:00.000Z",
        montoRecibido: "90000.00",
        faltaPorRecibir: "1350.25",
        conciliado: true,
        conciliadoAt: "2026-10-23T15:00:00.000Z",
        conciliadoPorNombre: "Ana Rojas",
      }),
    ]);

    const rotulo = await within(region).findByText("Saldada con la regla anterior");
    const filaSaldada = rotulo.closest("tr") as HTMLElement;
    expect(filaSaldada).not.toBeNull();
    expect(within(filaSaldada).queryAllByRole("button")).toHaveLength(0);

    // Control: la otra fila, en la misma pantalla y con el mismo actor, sí ofrece «Corregir». Sin esto, los 0
    // botones de arriba pasarían también con `puedeConciliar` caído.
    const corregir = await within(region).findByRole("button", {
      name: /Corregir el monto recibido de FGAM Limón del 22 oct/,
    });
    const filaControl = corregir.closest("tr") as HTMLElement;
    expect(filaControl).not.toBeNull();
    expect(filaControl).not.toBe(filaSaldada);
    expect(within(filaControl).getByText("Recibido incompleto")).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
describe("R42 — la tabla de saldos lleva la columna «Sin consolidar»", () => {
  const SALDO: SaldoSateliteDTO = {
    zonaId: "z-limon",
    zonaNombre: "FGAM Limón",
    saldoSinConciliar: "133700.25",
    sinConsolidar: "42350.00",
    cierresSinConsolidar: 3,
    totalEfectivo: "70000.00",
    totalConsolidado: "99800.50",
    totalRecibido: "0.00",
    consolidacionesSinConciliar: 1,
    diasDeLaMasAntigua: 2,
    fechaDeLaMasAntigua: "2026-10-20T14:00:00.000Z",
    ultimaRecibida: null,
  };

  function montar(items: SaldoSateliteDTO[]) {
    listarSaldosMock.mockResolvedValue({ status: "ok", items, total: items.length, page: 1, pageSize: 25 });
    return render(<SaldosSatelitesTable initialData={{ items, total: items.length, pageSize: 25 }} resumen={null} />, {
      wrapper: Envoltura,
    });
  }

  it("el importe sin consolidar y, debajo, «N cierres»", () => {
    montar([SALDO]);
    expect(screen.getByRole("columnheader", { name: "Sin consolidar" })).toBeInTheDocument();
    const fila = screen.getByText("FGAM Limón").closest("tr") as HTMLElement;
    expect(within(fila).getByText("₡42.350")).toBeInTheDocument();
    expect(within(fila).getByText("3 cierres")).toBeInTheDocument();
  });

  it("singular con un cierre, y «—» sin ninguno", () => {
    montar([
      { ...SALDO, cierresSinConsolidar: 1, sinConsolidar: "9000.00" },
      { ...SALDO, zonaId: "z-guana", zonaNombre: "FGAM Guanacaste", cierresSinConsolidar: 0, sinConsolidar: "0.00" },
    ]);
    expect(screen.getByText("1 cierre")).toBeInTheDocument();
    const guana = screen.getByText("FGAM Guanacaste").closest("tr") as HTMLElement;
    expect(within(guana).queryByText(/cierres?$/)).toBeNull();
  });

  it("con cierres sin consolidar, la bodega NO se marca «Recibido incompleto» aunque no tenga cola", () => {
    montar([{ ...SALDO, consolidacionesSinConciliar: 0 }]);
    const fila = screen.getByText("FGAM Limón").closest("tr") as HTMLElement;
    expect(within(fila).queryByText("Recibido incompleto")).toBeNull();
  });
});
