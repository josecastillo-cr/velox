import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";

import { toBodegaResumenRow } from "@/lib/repositories/CierreBodegaRepository";
import {
  aporteDeConsolidacion,
  deudaDeZona,
  esSaldadaReglaAnterior,
  faltaPorRecibir,
  puedeDesmarcarse,
} from "@/lib/utils/conciliacion-satelite";

/**
 * FICHA 498 (T4.1; R26, R27, R28) — la formula unica en TypeScript. Los esperados van ESCRITOS A MANO
 * (memoria «asercion contra su propia fuente»).
 */

const D = (s: string) => new Prisma.Decimal(s);

describe("498/R26 — faltaPorRecibir", () => {
  it.each([
    ["sin marcar (null)", "1000.00", null, "1000.00"],
    ["igual", "1000.00", "1000.00", "0.00"],
    ["menor (faltante)", "1000.00", "750.50", "249.50"],
    ["mayor (llego de mas): NEGATIVO, sin recortar", "1000.00", "1200.00", "-200.00"],
    ["aporte negativo y recibido 0", "-100.00", "0", "-100.00"],
  ])("%s", (_n, aporte, recibido, esperado) => {
    expect(faltaPorRecibir(D(aporte), recibido === null ? null : D(recibido)).toFixed(2)).toBe(esperado);
  });
});

describe("498/R26/R28 — aporteDeConsolidacion (el aporte RECONOCIDO)", () => {
  const snap = { totalGeneral: D("10000.00"), totalPagoMensajero: D("3000.00"), totalIngresoBodegaRechazos: D("164.00") };

  it("⭑ sin `esperadoReglaAnterior`: «Para la central» = general − pago − rechazos, con signo", () => {
    expect(aporteDeConsolidacion({ ...snap, esperadoReglaAnterior: null }).toFixed(2)).toBe("6836.00");
    expect(
      aporteDeConsolidacion({ totalGeneral: D("0"), totalPagoMensajero: D("1500"), totalIngresoBodegaRechazos: D("0"), esperadoReglaAnterior: null }).toFixed(2),
    ).toBe("-1500.00");
  });

  it("⭑ con `esperadoReglaAnterior` (saldada con la regla anterior): ESE valor, no el aporte", () => {
    expect(aporteDeConsolidacion({ ...snap, esperadoReglaAnterior: D("6000.00") }).toFixed(2)).toBe("6000.00");
    expect(esSaldadaReglaAnterior({ esperadoReglaAnterior: D("6000.00") })).toBe(true);
    expect(esSaldadaReglaAnterior({ esperadoReglaAnterior: null })).toBe(false);
  });

  it("deudaDeZona = aportes − recibido", () => {
    expect(deudaDeZona(D("8500.00"), D("6000.00")).toFixed(2)).toBe("2500.00");
  });
});

describe("498/R27 — la tarjeta del cierre de bodega (mapper `toBodegaResumenRow`)", () => {
  function fila(over: Record<string, unknown> = {}) {
    return {
      id: "cb",
      zonaId: "z",
      solicitadoPor: "u",
      estado: "aprobado",
      totalEfectivo: D("6000.00"),
      totalSimpe: D("4000.00"),
      totalTransferencia: D("0.00"),
      totalGeneral: D("10000.00"),
      totalPagoMensajero: D("3000.00"),
      totalIngresoBodegaRechazos: D("0.00"),
      solicitadoAt: new Date("2026-11-01T12:00:00.000Z"),
      resueltoAt: new Date("2026-11-02T12:00:00.000Z"),
      motivoRechazo: null,
      montoRecibido: D("6500.00"),
      conciliadoAt: new Date("2026-11-02T12:00:00.000Z"),
      conciliadoNota: null,
      esperadoReglaAnterior: null,
      zona: { nombre: "Cartago" },
      solicitadoPorUsuario: { nombre: "Sara" },
      conciliadoPorUsuario: null,
      _count: { cierresDia: 2 },
      ...over,
    } as unknown as Parameters<typeof toBodegaResumenRow>[0];
  }

  it("⭑ Recibido + Falta por recibir = Para la central (7 000): 6 500 + 500", () => {
    const r = toBodegaResumenRow(fila());
    expect(r.paraLaCentral).toBe("7000.00");
    expect(r.faltaPorRecibir).toBe("500.00");
  });

  it("⭑ en una saldada con la regla anterior: Recibido + Falta = aporte reconocido, y Falta = 0", () => {
    const r = toBodegaResumenRow(fila({ esperadoReglaAnterior: D("6500.00") }));
    expect(r.faltaPorRecibir).toBe("0.00");
  });

  it("⭑ R16/R41a (cola de /cierres-admin): la cabecera trae `debe`, `debePositivo` y `saldadaReglaAnterior`", () => {
    // No saldada: debe = «Para la central» (10 000 − 3 000 = 7 000), positivo.
    const normal = toBodegaResumenRow(fila());
    expect([normal.debe, normal.debePositivo, normal.saldadaReglaAnterior]).toEqual(["7000.00", true, false]);
    // Saldada con la regla anterior: debe = su reconocido (6 500), no el aporte.
    const saldada = toBodegaResumenRow(fila({ esperadoReglaAnterior: D("6500.00") }));
    expect([saldada.debe, saldada.debePositivo, saldada.saldadaReglaAnterior]).toEqual(["6500.00", true, true]);
    // Aporte negativo (pago 12 000 > general 10 000): debe −2 000 y NO es positivo (el dialogo propone 0).
    const negativo = toBodegaResumenRow(fila({ totalPagoMensajero: D("12000.00"), montoRecibido: null, conciliadoAt: null, estado: "solicitado" }));
    expect([negativo.debe, negativo.debePositivo]).toEqual(["-2000.00", false]);
  });
});

describe("FICHA 500 (R3/R4) — puedeDesmarcarse: los dos cortes de revertirConciliacion", () => {
  // Tabla de verdad ENTERA (8 filas), escrita a mano: solo conciliada, sin dinero y no saldada -> true.
  it.each([
    [true, false, false, true],
    [true, true, false, false],
    [true, false, true, false],
    [true, true, true, false],
    [false, false, false, false],
    [false, true, false, false],
    [false, false, true, false],
    [false, true, true, false],
  ])("conciliado=%s conDinero=%s saldada=%s -> %s", (conciliado, conDinero, saldadaReglaAnterior, esperado) => {
    expect(puedeDesmarcarse({ conciliado, conDinero, saldadaReglaAnterior })).toBe(esperado);
  });
});
