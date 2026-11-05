import { describe, it, expect } from "vitest";

import {
  filaDescargaCierreHistorico,
  filaDescargaCierrePendiente,
} from "@/app/(app)/cierres-admin/_components/cierres-admin-descarga-columnas";
import {
  filaDescargaBodegaPendiente,
  filaDescargaBodegaResuelto,
  filaDescargaBodegaSolicitado,
} from "@/app/(app)/cierres-admin/_components/cierres-bodega-descarga-columnas";
import { filaDescargaGestionFundida } from "@/app/(app)/cierres-admin/_components/cierres-gestiones-fundida-descarga-columnas";
import { filaDescargaDiaCierrePasado } from "@/app/(app)/cierre-dia/_components/cierre-dia-descarga-columnas";
import {
  filaDescargaIncidenteHistorico,
  filaDescargaIncidentePendiente,
} from "@/app/(app)/incidentes/_components/incidentes-descarga-columnas";
import type { CierreBodegaResumen } from "@/lib/interfaces/services/ICierreBodegaService";
import type {
  CierrePasadoDTO,
  IngresoEmpresaDTO,
} from "@/lib/interfaces/services/ICierreDiaService";
import type {
  CierreAdminResumen,
  CierreGestionDescargaDTO,
} from "@/lib/interfaces/services/ICierresAdminService";
import type { IncidenteAdminDTO } from "@/lib/interfaces/services/IIncidenteAdminService";
import { marcaRecibida } from "@/tests/fixtures/marca-conciliacion";

// =================================================================================================
// FICHA 495 (R4, R5, R7, R11, R12) — las DESCARGAS de cierres y de incidentes escriben el día de
// COSTA RICA de cada instante. `2026-11-01T05:03:00Z` son las 23:03 del 31 de octubre en CR.
// =================================================================================================
//
// R5/R11: el literal esperado (`2026-10-31`) es el MISMO que afirman los tests de pantalla
// (`tests/components/cierres-fechas-cr-495.test.tsx` e `incidentes-fechas-cr-495.test.tsx`). No
// se compara una salida contra la otra ni contra la función que la produce: eso sería verde
// por construcción.

const INSTANTE = "2026-11-01T05:03:00Z";
const DIA_CR = "2026-10-31";

const TOTALES = {
  efectivo: "5000.00",
  simpe: "0.00",
  transferencia: "3000.00",
  general: "8000.00",
};

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

const PROPIO: CierrePasadoDTO = {
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
};

function ingreso(): IngresoEmpresaDTO {
  return {
    montoCobrar: "1000.10",
    cobraComision: true,
    esCentral: true,
    esZonaEspecial: false,
    fleteOrigen: "normal",
    fleteDevolucionOrigen: "normal",
    flete: "100.00",
    ivaFlete: "13.00",
    fleteDevolucion: "40.00",
    ivaFleteDevolucion: "5.20",
    comisionCod: "50.00",
    ivaComisionCod: "6.50",
    fleteConIva: "113.00",
    fleteDevolucionConIva: "45.20",
    comisionConIva: "56.50",
    total: "169.50",
    tarifa: null,
  };
}

const GESTION: CierreGestionDescargaDTO = {
  mensajeroNombre: "Ana Mensajera",
  cierreSolicitadoAt: INSTANTE,
  fechaGestion: "2026-07-12",
  diaReparto: "2026-07-10",
  fechaCreacionOrden: "2026-07-08",
  numGuia: 1001,
  numRemision: "REM-1",
  destinatario: "Ana Pérez",
  direccion: "Calle 1, casa 2",
  zonaNombre: "Limón",
  provinciaNombre: "Limón",
  cantonNombre: "Central",
  distritoNombre: "Limón",
  producto: "Caja mediana",
  tiendaNombre: "Tienda X",
  intentosContactoTienda: 3,
  intentosEntrega: 5,
  resultado: "entregado",
  montoRecibido: null,
  pagos: [],
  motivo: null,
  fechaReprogramacion: null,
  esRechazoSla: false,
  causaIncidente: null,
  indemnizacion: null,
  pagoMensajero: "100.10",
  ingresoBodegaRechazo: null,
  ingresoEmpresa: ingreso(),
};

function incidente(over: Partial<IncidenteAdminDTO> = {}): IncidenteAdminDTO {
  return {
    incidenteId: "i1",
    ordenId: "o-i1",
    numGuia: 1001,
    numRemision: "REM-001",
    destinatario: "Beto Ruiz",
    zonaNombre: "GAM",
    estatusValue: "incidente",
    causa: "danado",
    motivo: "Caja aplastada",
    estado: "aprobado",
    indemnizacion: "1000.00",
    reportadoPorNombre: "Ana Admin",
    resueltoPorNombre: "Rita Resolutora",
    resueltoAt: INSTANTE,
    motivoRechazo: null,
    createdAt: INSTANTE,
    evidenciaUrls: [],
    esPropio: false,
    ...over,
  };
}

describe("Ficha 495 — R4/R5: las descargas de cierres escriben el día de Costa Rica", () => {
  it("cierres del mensajero: «Fecha» (pendientes) y «Fecha resuelta» (histórico)", () => {
    expect(filaDescargaCierrePendiente(resumen()).fecha).toBe(DIA_CR);
    expect(filaDescargaCierreHistorico(resumen()).fechaResuelta).toBe(DIA_CR);
  });

  it("cierres de bodega: «Fecha», «Fecha resuelta» y «Fecha solicitud»", () => {
    expect(filaDescargaBodegaPendiente(cierreBodega()).fecha).toBe(DIA_CR);
    expect(filaDescargaBodegaResuelto(cierreBodega()).fechaResuelta).toBe(DIA_CR);
    expect(filaDescargaBodegaSolicitado(cierreBodega()).fechaSolicitud).toBe(DIA_CR);
  });

  it("cierres propios del mensajero: «Fecha»", () => {
    expect(filaDescargaDiaCierrePasado(PROPIO).fecha).toBe(DIA_CR);
  });

  it("detalle de gestiones del cierre: «Fecha del cierre»; las fechas que ya son día no cambian", () => {
    const fila = filaDescargaGestionFundida(GESTION);
    expect(fila.fechaCierre).toBe(DIA_CR);
    expect(fila.fechaGestion).toBe("2026-07-12");
    expect(fila.diaReparto).toBe("2026-07-10");
    expect(fila.fechaCreacionOrden).toBe("2026-07-08");
  });
});

describe("Ficha 495 — R7: una fecha de cierre ausente es celda vacía", () => {
  it("«Fecha resuelta» sin resolución es null, no NaN ni Invalid Date", () => {
    expect(filaDescargaCierreHistorico(resumen({ resueltoAt: null })).fechaResuelta).toBeNull();
    expect(
      filaDescargaBodegaResuelto(cierreBodega({ resueltoAt: null })).fechaResuelta,
    ).toBeNull();
  });
});

describe("Ficha 495 — R11/R12: las descargas de incidentes escriben el día de Costa Rica", () => {
  it("cola de pendientes: «Fecha»; histórico: «Fecha resuelta»", () => {
    expect(filaDescargaIncidentePendiente(incidente()).fecha).toBe(DIA_CR);
    expect(filaDescargaIncidenteHistorico(incidente()).fechaResuelta).toBe(DIA_CR);
  });

  it("R12: sin resolución, «Fecha resuelta» es celda vacía", () => {
    expect(
      filaDescargaIncidenteHistorico(incidente({ resueltoAt: null })).fechaResuelta,
    ).toBeNull();
  });
});
