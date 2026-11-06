// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";

import type { CierreBodegaResumen } from "@/lib/interfaces/services/ICierreBodegaService";
import type { TotalesIngresoEmpresa } from "@/lib/interfaces/services/ICierreDiaService";

/**
 * FICHA 498 (R16, design §8.4) — en la cola de `/cierres-admin`, el diálogo de «Marcar recibido» de una
 * consolidación propone lo que DEBE (el aporte reconocido, del servidor) si es positivo, y 0 si no;
 * nunca el efectivo.
 *
 * El doble tiene el efectivo, el general, `paraLaCentral` y `debe` DISTINTOS entre sí a propósito: un
 * cableado al campo equivocado se ve. El signo lo decide el servidor (`debePositivo`), no el navegador.
 */

vi.mock("@/lib/actions/cierre-bodega", () => ({
  verCierreBodegaDetalle: vi.fn(),
  aprobarCierreBodega: vi.fn(),
  rechazarCierreBodega: vi.fn(),
  listarPendientesCierresBodegaPaginado: vi.fn(),
  listarPendientesCierresBodegaCompleto: vi.fn(),
  listarHistoricoCierresBodegaPaginado: vi.fn(),
  listarHistoricoCierresBodegaCompleto: vi.fn(),
  listarGestionesCierresBodegaCompleto: vi.fn(),
}));
vi.mock("@/lib/actions/conciliacion-satelites", () => ({
  marcarConsolidacionRecibidaAction: vi.fn(),
  corregirConsolidacionRecibidaAction: vi.fn(),
  revertirConciliacionAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/cierres-admin",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    show: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

import {
  listarHistoricoCierresBodegaPaginado,
  listarPendientesCierresBodegaPaginado,
  verCierreBodegaDetalle,
} from "@/lib/actions/cierre-bodega";
import { CierresBodegaAdminModule } from "@/app/(app)/cierres-admin/_components/CierresBodegaAdminModule";
import { paginaInicial } from "@/tests/fixtures/pagina-inicial";

const TOTALES_INGRESO = {
  montoCobrar: "0.00",
  flete: "3000.00",
  ivaFlete: "0.00",
  fleteDevolucion: "0.00",
  ivaFleteDevolucion: "0.00",
  comisionCod: "0.00",
  ivaComisionCod: "0.00",
  total: "3000.00",
  // Los «con IVA» que pinta la cascada (mismo molde que `CierreBodegaDetalleCascadas`).
  fleteConIva: "3000.00",
  comisionConIva: "0.00",
  fleteDevolucionConIva: "0.00",
} as TotalesIngresoEmpresa;

function cabecera(over: Partial<CierreBodegaResumen> = {}): CierreBodegaResumen {
  return {
    cierreBodegaId: "b4980000-1111-4111-8111-b1b1b1b1b1b1",
    zonaId: "33333333-3333-4333-8333-333333333333",
    zonaNombre: "Limón",
    solicitadoPorId: "u1",
    solicitadoPorNombre: "Sara Satélite",
    estado: "solicitado",
    totales: { efectivo: "70000.00", simpe: "25500.50", transferencia: "4300.00", general: "99800.50" },
    totalPagoMensajero: "7200.00",
    totalIngresoBodegaRechazos: "1250.25",
    cantidadCierres: 1,
    solicitadoAt: "2026-10-20T14:00:00.000Z",
    resueltoAt: null,
    motivoRechazo: null,
    paraLaCentral: "91350.25",
    efectivoCubreDescuentos: true,
    conciliado: false,
    montoRecibido: null,
    faltaPorRecibir: "88000.75",
    debe: "88000.75",
    debePositivo: true,
    saldadaReglaAnterior: false,
    conciliadoAt: null,
    conciliadoPorNombre: null,
    conciliadoNota: null,
    ...over,
  };
}

/**
 * Monta la cola con `cab` y abre su detalle. `puedeDesmarcar` viaja en el resultado de
 * `verCierreBodegaDetalle` (ficha 500), no en la cabecera del listado.
 */
async function abrirDetalle(cab: CierreBodegaResumen, puedeDesmarcar = false, puedeConciliar = true) {
  vi.mocked(listarPendientesCierresBodegaPaginado).mockResolvedValue({
    status: "ok",
    page: 1,
    ...paginaInicial([cab]),
  });
  vi.mocked(listarHistoricoCierresBodegaPaginado).mockResolvedValue({
    status: "ok",
    page: 1,
    ...paginaInicial([]),
  });
  vi.mocked(verCierreBodegaDetalle).mockResolvedValue({
    status: "ok",
    cierre: cab,
    cierres: [],
    totalesIngreso: TOTALES_INGRESO,
    ganancia: "0.00",
    pagoTienda: "0.00",
    cobradoSobreRecaudado: "0.00",
    netoEmpresa: "0.00",
    ganaLaTienda: "0.00",
    partesPorTienda: [],
    paraLaCentral: cab.paraLaCentral,
    efectivoCubreDescuentos: true,
    // La marca de conciliación viaja también en el detalle (mismo molde que `CierreBodegaDetalleCascadas`).
    conciliado: cab.conciliado,
    montoRecibido: cab.montoRecibido,
    faltaPorRecibir: cab.faltaPorRecibir,
    debe: cab.debe,
    debePositivo: cab.debePositivo,
    saldadaReglaAnterior: cab.saldadaReglaAnterior,
    conciliadoAt: cab.conciliadoAt,
    conciliadoPorNombre: cab.conciliadoPorNombre,
    conciliadoNota: cab.conciliadoNota,
    puedeDesmarcar,
  } as never);

  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <CierresBodegaAdminModule
        pendientes={paginaInicial([cab])}
        historico={paginaInicial([])}
        puedeConciliar={puedeConciliar}
      />
    </SWRConfig>,
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Ver / decidir el cierre de bodega de Limón" }));
  // FICHA 506 (R9): la región de conciliación ya no sale siempre, así que la premisa de «el detalle cargó» es otra: el
  // diálogo con sus totales. Sin ella, una región ausente no probaría nada.
  const dialogo = await screen.findByRole("dialog", { name: "Detalle del cierre de bodega" });
  await within(dialogo).findByText("Totales del cierre de bodega");
  return { user, dialogo };
}

const REGION_CONCILIACION = { name: "Conciliación del cierre de bodega" };

async function abrirDialogo(cab: CierreBodegaResumen) {
  const { user } = await abrirDetalle(cab);
  await user.click(await screen.findByRole("button", { name: /Marcar recibido la consolidación de Limón/ }));
  const dialogos = await screen.findAllByRole("dialog");
  const dialogo = dialogos.find((d) => within(d).queryByLabelText(/Monto recibido/)) as HTMLElement;
  expect(dialogo, "no se abrió el diálogo de marcar").toBeDefined();
  return dialogo;
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("498 (R16) — /cierres-admin: el diálogo propone lo que DEBE, o 0; nunca el efectivo", () => {
  it("debe positivo → el campo nace con `debe` y la banda «Debe» lo enseña", async () => {
    const dialogo = await abrirDialogo(cabecera());
    const campo = within(dialogo).getByLabelText(/Monto recibido/);
    expect(campo).toHaveValue("88000.75");
    expect(campo).not.toHaveValue("70000.00");
    expect(dialogo.querySelector('[data-banda="debe"]')).toHaveTextContent("₡88.000,75");
    // Lo recaudado por método, del mismo doble (R16a).
    const recaudado = dialogo.querySelector<HTMLElement>('dl[aria-label="Recaudado"]') as HTMLElement;
    expect(within(recaudado).getByText("SINPE").nextElementSibling).toHaveTextContent("₡25.500,50");
  });

  it("no debe nada (el servidor dice `debePositivo: false`) → el campo nace con 0", async () => {
    const dialogo = await abrirDialogo(
      cabecera({ debe: "-450.00", debePositivo: false, faltaPorRecibir: "-450.00" }),
    );
    expect(within(dialogo).getByLabelText(/Monto recibido/)).toHaveValue("0");
    expect(dialogo.querySelector('[data-banda="debe"]')).toHaveTextContent("-₡450");
  });
});

describe("500 (R3) — /cierres-admin: «Desmarcar» sale del `puedeDesmarcar` del DETALLE", () => {
  const conciliada = cabecera({
    estado: "aprobado",
    conciliado: true,
    montoRecibido: "88000.75",
    faltaPorRecibir: "0.00",
    conciliadoAt: "2026-10-21T15:00:00.000Z",
    conciliadoPorNombre: "Ana Rojas",
  });

  it("el detalle dice que se puede → hay «Desmarcar»", async () => {
    const { dialogo } = await abrirDetalle(conciliada, true);
    const seccion = within(dialogo).getByRole("region", REGION_CONCILIACION);
    expect(within(seccion).getByRole("button", { name: /Desmarcar la consolidación de Limón/ })).toBeInTheDocument();
  });

  it("el detalle dice que no (movió dinero) → no hay «Desmarcar»", async () => {
    // [S] Adaptado (ficha 506/R9): esta recibida exacta ya no monta la región, así que la ausencia de «Desmarcar» se mide en
    // todo el diálogo. El contrato de 500/R3 no cambia.
    const { dialogo } = await abrirDetalle(conciliada, false);
    expect(within(dialogo).queryByRole("button", { name: /Desmarcar/ })).toBeNull();
  });
});

describe("502 (R7) — /cierres-admin: una recibida de más ofrece «Corregir»", () => {
  it("con dinero (no se puede desmarcar) → «Corregir» sí, «Desmarcar» no", async () => {
    const { dialogo } = await abrirDetalle(
      cabecera({
        estado: "aprobado",
        conciliado: true,
        montoRecibido: "88090.75",
        faltaPorRecibir: "-90.00",
        conciliadoAt: "2026-10-21T15:00:00.000Z",
        conciliadoPorNombre: "Ana Rojas",
      }),
      false,
    );
    const seccion = within(dialogo).getByRole("region", REGION_CONCILIACION);
    expect(
      within(seccion).getByRole("button", { name: /Corregir el monto recibido de Limón/ }),
    ).toBeInTheDocument();
    expect(within(seccion).queryByRole("button", { name: /Desmarcar/ })).toBeNull();
  });
});

describe("506 — /cierres-admin: la región de conciliación sale solo si hay una acción dentro", () => {
  const marcada = (faltaPorRecibir: string, over: Partial<CierreBodegaResumen> = {}) =>
    cabecera({
      estado: "aprobado",
      conciliado: true,
      montoRecibido: "88000.75",
      faltaPorRecibir,
      conciliadoAt: "2026-10-21T15:00:00.000Z",
      conciliadoPorNombre: "Ana Rojas",
      ...over,
    });

  // `abrirDetalle` ya esperó el diálogo con sus totales: esa es la premisa de los casos que afirman la ausencia.
  it.each([
    ["saldada sin corregir", marcada("0.00", { saldadaReglaAnterior: true })],
    ["recibida exacta con dinero, no saldada", marcada("0.00")],
  ])("R9 — %s: el detalle no monta la región", async (_caso, cab) => {
    const { dialogo } = await abrirDetalle(cab, false);
    expect(within(dialogo).queryByRole("region", REGION_CONCILIACION)).toBeNull();
    expect(within(dialogo).queryByRole("button", { name: /Marcar recibido|Corregir|Desmarcar/ })).toBeNull();
  });

  it.each([
    ["sin marcar", cabecera(), false, /Marcar recibido la consolidación de Limón/],
    ["incompleta", marcada("5000.00"), false, /Corregir el monto recibido de Limón/],
    ["de más", marcada("-90.00"), false, /Corregir el monto recibido de Limón/],
    ["exacta que se puede desmarcar", marcada("0.00"), true, /Desmarcar la consolidación de Limón/],
    ["saldada con falta", marcada("5000.00", { saldadaReglaAnterior: true }), false, /Corregir el monto recibido de Limón/],
  ] as const)("R10 — %s: la región se monta con su acción dentro", async (_caso, cab, puedeDesmarcar, boton) => {
    const { dialogo } = await abrirDetalle(cab, puedeDesmarcar);
    const seccion = within(dialogo).getByRole("region", REGION_CONCILIACION);
    expect(within(seccion).getByRole("button", { name: boton })).toBeInTheDocument();
  });

  it("R11 — sin permiso para conciliar, el detalle no monta la región aunque esté sin marcar", async () => {
    const { dialogo } = await abrirDetalle(cabecera(), false, false);
    expect(within(dialogo).queryByRole("region", REGION_CONCILIACION)).toBeNull();
  });
});
