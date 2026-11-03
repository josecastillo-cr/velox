// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";

import {
  CierreBodegaFacturaResumen,
  CierreFacturaDetalle,
  CierreFacturaResumen,
  CierreFacturaResumenPropio,
  type CierreFacturaCabecera,
} from "@/app/(app)/cierres-admin/_components/cierre-factura";
import type { CierreAdminResumen } from "@/lib/interfaces/services/ICierresAdminService";
import type { CierreBodegaResumen } from "@/lib/interfaces/services/ICierreBodegaService";
import type { CierreGrupos, CierrePasadoDTO } from "@/lib/interfaces/services/ICierreDiaService";
import { marcaRecibida } from "@/tests/fixtures/marca-conciliacion";

// =================================================================================================
// FICHA 495 (R1, R2, R3, R7) — las fechas de los cierres se pintan en el día de COSTA RICA.
// =================================================================================================
//
// `2026-11-01T05:03:00Z` son las 23:03 del 31 de octubre en Costa Rica. Antes de la ficha, el
// recorte del ISO en UTC lo pintaba «2026-11-01». Los esperados son LITERALES.

const INSTANTE = "2026-11-01T05:03:00Z";
const DIA_CR = "2026-10-31";
const DIA_UTC = "2026-11-01";

const TOTALES = {
  efectivo: "5000.00",
  simpe: "0.00",
  transferencia: "3000.00",
  general: "8000.00",
};

function emptyGrupos(): CierreGrupos {
  return {
    entregado: [],
    reprogramado: [],
    novedad: [],
    devolucion_a_origen_por_rechazo: [],
    incidente: [],
  };
}

function resumen(over: Partial<CierreAdminResumen> = {}): CierreAdminResumen {
  return {
    cierreId: "c1000001",
    mensajeroId: "m1",
    mensajeroNombre: "Ana Pérez",
    estado: "aprobado",
    destinoTipo: "bodega_central",
    destinoZonaId: "z1",
    destinoZonaNombre: "GAM",
    totales: TOTALES,
    totalPagoMensajero: "1200.00",
    totalIngresoBodegaRechazos: "0.00",
    pendientePagoMensajero: null,
    solicitadoAt: INSTANTE,
    resueltoAt: INSTANTE,
    motivoRechazo: null,
    ...over,
  };
}

function cabecera(over: Partial<CierreFacturaCabecera> = {}): CierreFacturaCabecera {
  return {
    cierreId: "c1000001",
    estado: "aprobado",
    destinoTipo: "bodega_central",
    destinoZonaNombre: "GAM",
    mensajeroNombre: "Ana Pérez",
    totales: TOTALES,
    totalPagoMensajero: "1200.00",
    totalIngresoBodegaRechazos: "0.00",
    solicitadoAt: INSTANTE,
    resueltoAt: INSTANTE,
    motivoRechazo: null,
    ...over,
  };
}

function cierreBodega(over: Partial<CierreBodegaResumen> = {}): CierreBodegaResumen {
  return {
    cierreBodegaId: "b1b1b1b1-1111-4111-8111-b1b1b1b1b1b1",
    zonaId: "33333333-3333-4333-8333-333333333333",
    zonaNombre: "Limón",
    solicitadoPorId: "u1",
    solicitadoPorNombre: "Sara Satélite",
    estado: "aprobado",
    totales: TOTALES,
    totalPagoMensajero: "1200.00",
    totalIngresoBodegaRechazos: "0.00",
    cantidadCierres: 3,
    solicitadoAt: INSTANTE,
    resueltoAt: INSTANTE,
    motivoRechazo: null,
    paraLaCentral: "6800.00",
    efectivoCubreDescuentos: true,
    ...marcaRecibida("5000.00", "0.00", { conciliadoAt: INSTANTE }),
    ...over,
  };
}

function propio(over: Partial<CierrePasadoDTO> = {}): CierrePasadoDTO {
  return {
    cierreId: "c2000002",
    estado: "aprobado",
    destinoTipo: "bodega_central",
    destinoZonaId: "z1",
    totales: TOTALES,
    totalPagoMensajero: "1200.00",
    totalIngresoBodegaRechazos: "0.00",
    solicitadoAt: INSTANTE,
    resueltoAt: INSTANTE,
    motivoRechazo: null,
    ...over,
  };
}

/** El valor de la línea `rótulo / valor` cuyo rótulo es exactamente `label`. */
function lineaFecha(contenedor: HTMLElement, label: string): string | null {
  const rotulo = within(contenedor).getByText(label, { exact: true });
  return rotulo.nextElementSibling?.textContent ?? null;
}

function desplegar(nombre: RegExp) {
  fireEvent.click(screen.getByRole("button", { name: nombre }));
}

afterEach(() => {
  cleanup();
});

describe("Ficha 495 — R1: cierre del mensajero (tarjeta, hoja de resumen y comprobante)", () => {
  it("la tarjeta y la hoja de resumen pintan el día de Costa Rica", () => {
    render(<CierreFacturaResumen cierre={resumen()} />);
    const hoja = screen.getByRole("region", { name: "Comprobante del cierre de Ana Pérez" });
    expect(hoja.textContent).toContain(DIA_CR);
    expect(hoja.textContent).not.toContain(DIA_UTC);

    desplegar(/Ver detalles del cierre de Ana Pérez/);
    const fechas = within(hoja).getByRole("region", { name: "Fechas" });
    expect(lineaFecha(fechas, "Solicitado")).toBe(DIA_CR);
    expect(lineaFecha(fechas, "Resuelto")).toBe(DIA_CR);
    expect(hoja.textContent).not.toContain(DIA_UTC);
  });

  it("el comprobante en papel dice «Solicitado 2026-10-31 · Resuelto 2026-10-31»", () => {
    render(<CierreFacturaDetalle cierre={cabecera()} grupos={emptyGrupos()} />);
    const hoja = screen.getByRole("region", {
      name: "Comprobante detallado del cierre de Ana Pérez",
    });
    expect(hoja.textContent).toContain(`Solicitado ${DIA_CR} · Resuelto ${DIA_CR}`);
    expect(hoja.textContent).not.toContain(DIA_UTC);
  });
});

describe("Ficha 495 — R2: cierre de bodega (solicitado, resuelto y «Conciliado el»)", () => {
  it("las tres fechas se pintan en el día de Costa Rica", () => {
    render(<CierreBodegaFacturaResumen cierre={cierreBodega()} />);
    const hoja = screen.getByRole("region", {
      name: "Comprobante del cierre de bodega de Limón",
    });
    expect(hoja.textContent).toContain(DIA_CR);
    expect(hoja.textContent).not.toContain(DIA_UTC);

    desplegar(/Ver detalles del cierre de bodega de Limón/);
    const fechas = within(hoja).getByRole("region", { name: "Fechas" });
    expect(lineaFecha(fechas, "Solicitado")).toBe(DIA_CR);
    expect(lineaFecha(fechas, "Resuelto")).toBe(DIA_CR);
    const conciliacion = within(hoja).getByRole("region", { name: "Conciliación" });
    expect(lineaFecha(conciliacion, "Conciliado el")).toBe(DIA_CR);
    expect(hoja.textContent).not.toContain(DIA_UTC);
  });
});

describe("Ficha 495 — R3: cierre propio del mensajero", () => {
  it("la tarjeta, su nombre accesible y la hoja pintan el día de Costa Rica", () => {
    render(<CierreFacturaResumenPropio cierre={propio()} />);
    const hoja = screen.getByRole("region", { name: `Comprobante de tu cierre del ${DIA_CR}` });
    expect(hoja.textContent).toContain(DIA_CR);
    expect(hoja.textContent).not.toContain(DIA_UTC);

    desplegar(new RegExp(`Ver detalles de tu cierre del ${DIA_CR}`));
    const fechas = within(hoja).getByRole("region", { name: "Fechas" });
    expect(lineaFecha(fechas, "Solicitado")).toBe(DIA_CR);
    expect(lineaFecha(fechas, "Resuelto")).toBe(DIA_CR);
  });
});

describe("Ficha 495 — R7: una fecha ausente se pinta como hoy", () => {
  it("sin resolución ni conciliación: sin pieza «Resuelto», sin NaN ni Invalid Date", () => {
    render(
      <CierreBodegaFacturaResumen
        cierre={cierreBodega({
          estado: "solicitado",
          resueltoAt: null,
          conciliado: false,
          montoRecibido: null,
          faltaPorRecibir: "5000.00",
          conciliadoAt: null,
          conciliadoPorNombre: null,
        })}
      />,
    );
    const hoja = screen.getByRole("region", {
      name: "Comprobante del cierre de bodega de Limón",
    });
    desplegar(/Ver detalles del cierre de bodega de Limón/);
    const fechas = within(hoja).getByRole("region", { name: "Fechas" });
    expect(lineaFecha(fechas, "Solicitado")).toBe(DIA_CR);
    expect(within(fechas).queryByText("Resuelto", { exact: true })).toBeNull();
    expect(within(hoja).queryByText("Conciliado el", { exact: true })).toBeNull();
    expect(hoja.textContent).not.toMatch(/NaN|Invalid Date/);
  });

  it("el comprobante en papel sin resolución omite «· Resuelto»", () => {
    render(
      <CierreFacturaDetalle
        cierre={cabecera({ estado: "solicitado", resueltoAt: null })}
        grupos={emptyGrupos()}
      />,
    );
    const hoja = screen.getByRole("region", {
      name: "Comprobante detallado del cierre de Ana Pérez",
    });
    expect(hoja.textContent).toContain(`Solicitado ${DIA_CR}`);
    expect(hoja.textContent).not.toContain("· Resuelto");
    expect(hoja.textContent).not.toMatch(/NaN|Invalid Date/);
  });
});
