import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";

import { derivarCaja, derivarComposicionGanancia } from "@/lib/utils/caja-tesoreria";
import {
  WALLET_MOVIMIENTO_CATEGORIA_SEED,
  type AgregadoCajaRow,
  type WalletMovimientoCategoria,
} from "@/lib/types/wallet";

/**
 * FICHA 459 / T A.2 — la derivacion nueva de la caja (R1–R7, R10, R11; design §2.2–§2.4).
 *
 * Los literales son los de PRODUCCION medidos el 2026-09-24 (M6 de `progress/medicion_457.md`) y
 * las columnas 2 y 3 de design §2.4, escritos A MANO: nunca calculados con `derivarCaja`.
 *
 * FICHA 488 (design §2.1): el IVA deja de ser ganancia. El IVA de M6 es 568 360,00 + 132 223,43 +
 * 227 916,00 = 928 499,43, y pasa al bolsillo «IVA por pagar». Se reescriben SOLO las cifras que lo
 * llevaban dentro (ganancia, ingresos propios, «De Ordenex», la composicion y la porcion de la barra),
 * con el valor de antes en su comentario. La cifra principal, «Entro», «Salio» y «De las tiendas» NO
 * cambian (R8 de la 488).
 */

const fila = (categoria: WalletMovimientoCategoria, total: string): AgregadoCajaRow => ({
  categoria,
  tipo: categoria.startsWith("ingreso_") ? "ingreso" : "egreso",
  total,
});

/** El libro de la caja de produccion, agregado por concepto (M6, 2026-09-24). */
const M6: AgregadoCajaRow[] = [
  fila("ingreso_cod_recaudado", "29059224.00"),
  fila("ingreso_flete", "4372000.00"),
  fila("ingreso_comision_cod", "1017074.04"),
  fila("ingreso_flete_devolucion", "1753200.00"),
  fila("ingreso_iva_flete", "568360.00"),
  fila("ingreso_iva_comision_cod", "132223.43"),
  fila("ingreso_iva_flete_devolucion", "227916.00"),
  fila("egreso_sueldo", "8871709.00"),
  fila("egreso_pago_mensajero", "3439700.00"),
  fila("egreso_gasto_variable", "165000.00"),
  fila("egreso_indemnizacion", "1.00"),
];

describe("459/A.2 — la caja de produccion (M6) con la formula nueva, sin reclasificar", () => {
  const r = derivarCaja(M6);

  it("R2/R3: Entro 29 059 224,00 (solo el contra-entrega), Salio 12 476 410,00, cifra 16 582 814,00", () => {
    // Hoy la app dice Entro 37 129 997,47 y «Dinero en caja» 24 653 587,47: le sobran
    // 8 070 773,47, exactamente la suma de los seis cargos (F2).
    expect(r.entradas).toBe("29059224.00");
    expect(r.salidas).toBe("12476410.00");
    expect(r.enCaja).toBe("16582814.00");
    expect(r.signoEnCaja).toBe("positivo");
  });

  it("R4 (488): la ganancia SIN IVA: −4 405 636,53 − 928 499,43 = −5 334 135,96", () => {
    // 459: 8 070 773,47 de cargos (ingresos propios) − 12 476 410,00 = −4 405 636,53.
    // 488: los cargos sin el IVA: 8 070 773,47 − 928 499,43 = 7 142 274,04 − 12 476 410,00.
    expect(r.ingresosPropios).toBe("7142274.04");
    expect(r.egresosPropios).toBe("12476410.00");
    expect(r.ganancia).toBe("-5334135.96");
    expect(r.ivaPorPagar).toBe("928499.43");
    expect(r.ivaCobrado).toBe("928499.43");
  });

  it("R5: «De las tiendas» = 29 059 224,00 − 8 070 773,47 = 20 988 450,53", () => {
    expect(r.deTerceros).toBe("20988450.53");
    expect(r.signoDeTerceros).toBe("positivo");
    expect(r.deTercerosAbsoluto).toBe("20988450.53");
  });

  it("R6/R11: capital 0,00 y «De Ordenex» = la ganancia", () => {
    expect(r.capital).toBe("0.00");
    expect(r.signoCapital).toBe("cero");
    expect(r.deOrdenex).toBe("-5334135.96"); // 459: −4 405 636,53 (con el IVA dentro)
  });

  it("R7 (488): −5 334 135,96 + 20 988 450,53 + 0 + 928 499,43 = 16 582 814,00", () => {
    expect(
      new Prisma.Decimal(r.ganancia).add(r.deTerceros).add(r.capital).add(r.ivaPorPagar).toFixed(2),
    ).toBe(r.enCaja);
  });

  it("R11 (488): solo_tiendas; la barra se parte entre las tiendas y el IVA por pagar", () => {
    // S = 20 988 450,53 + 928 499,43 = 21 916 949,96 ; T / S = 95,7636… → 95,76 ; I / S = 4,2364… → 4,24.
    // 459: porcentajeTiendas 100,00 (sin IVA por pagar).
    expect(r.modoComposicion).toBe("solo_tiendas");
    expect(r.porcentajeTiendas).toBe("95.76");
    expect(r.porcentajeIva).toBe("4.24");
  });

  it("R4/R93 (488): la composicion de la ganancia, sin IVA (misma entrada, misma funcion)", () => {
    const c = derivarComposicionGanancia(M6);
    expect(c.totalIngresos).toBe("7142274.04"); // 459: 8 070 773,47
    expect(c.totalEgresos).toBe("12476410.00");
  });
});

describe("459/B.14 — columna 3 de design §2.4: + los 203 cobros reclasificados (25 769 034,50)", () => {
  // La reclasificacion (T C.4) escribe UNA salida de terceros por cobro, por su mismo monto.
  const r = derivarCaja([...M6, fila("egreso_pago_por_cuenta_tienda", "25769034.50")]);

  it("R3: Entro no cambia; Salio 12 476 410,00 + 25 769 034,50 = 38 245 444,50; cifra −9 186 220,50", () => {
    expect(r.entradas).toBe("29059224.00");
    expect(r.salidas).toBe("38245444.50");
    expect(r.enCaja).toBe("-9186220.50");
    expect(r.signoEnCaja).toBe("negativo");
  });

  it("R4: la ganancia sigue en −5 334 135,96 (488; un pago por cuenta NO es un gasto de Ordenex)", () => {
    expect(r.ganancia).toBe("-5334135.96"); // 459: −4 405 636,53
    expect(r.egresosPropios).toBe("12476410.00");
  });

  it("R5/R8: «De las tiendas» = 20 988 450,53 − 25 769 034,50 = −4 780 583,97 = Σ saldos medida en M6", () => {
    expect(r.deTerceros).toBe("-4780583.97");
    expect(r.signoDeTerceros).toBe("negativo");
    expect(r.deTercerosAbsoluto).toBe("4780583.97");
  });

  it("R7 (488): −5 334 135,96 − 4 780 583,97 + 0 + 928 499,43 = −9 186 220,50; y la barra, sin reparto", () => {
    expect(
      new Prisma.Decimal(r.ganancia).add(r.deTerceros).add(r.capital).add(r.ivaPorPagar).toFixed(2),
    ).toBe(r.enCaja);
    expect(r.modoComposicion).toBe("sin_reparto");
    expect(r.porcentajeIva).toBe("100.00"); // 488: el unico bolsillo positivo es el IVA por pagar
  });
});

describe("459/B.14 — columna 4 de design §2.4: + un saldo inicial S (simbolico) y su anulacion", () => {
  // S NO se estima (HF4, R27): 1 000 000,00 es un numero de prueba, no una propuesta.
  const base = [...M6, fila("egreso_pago_por_cuenta_tienda", "25769034.50")];

  it("R6/R7: capital = S, cifra principal = S − 9 186 220,50, ganancia y «De las tiendas» intactas", () => {
    const r = derivarCaja([...base, fila("ingreso_aporte_capital", "1000000.00")], {
      haySaldoInicialVigente: true,
    });
    expect(r.capital).toBe("1000000.00");
    expect(r.enCaja).toBe("-8186220.50");
    expect(r.ganancia).toBe("-5334135.96"); // 459: −4 405 636,53
    expect(r.deTerceros).toBe("-4780583.97");
    expect(r.deOrdenex).toBe("-4334135.96"); // 459: −3 405 636,53
    expect(r.estado).toBe("saldo");
  });

  it("R74/R75: la anulacion lo devuelve todo a la columna 3", () => {
    const r = derivarCaja([
      ...base,
      fila("ingreso_aporte_capital", "1000000.00"),
      fila("egreso_reverso_aporte_capital", "1000000.00"),
    ]);
    expect([r.capital, r.enCaja, r.ganancia, r.deTerceros, r.estado]).toEqual([
      "0.00",
      "-9186220.50",
      "-5334135.96", // 459: −4 405 636,53
      "-4780583.97",
      "flujo",
    ]);
  });
});

describe("459/A.2 — R7 sobre subconjuntos al azar (semilla fija)", () => {
  /** mulberry32: PRNG determinista, para que un rojo se pueda reproducir. */
  function prng(semilla: number): () => number {
    let a = semilla >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  it("R7 (488): cifra principal = ganancia + «De las tiendas» + capital + IVA por pagar, al centimo, en 500 conjuntos", () => {
    const azar = prng(459);
    let comprobados = 0;
    for (let n = 0; n < 500; n += 1) {
      const filas: AgregadoCajaRow[] = [];
      for (const categoria of WALLET_MOVIMIENTO_CATEGORIA_SEED) {
        if (azar() < 0.4) continue;
        // Importe en CENTIMOS enteros, llevado a escala 2 con Decimal: sin un solo float de dinero.
        const centimos = Math.floor(azar() * 100_000_000);
        filas.push(fila(categoria, new Prisma.Decimal(centimos).div(100).toFixed(2)));
      }
      const r = derivarCaja(filas, { periodoFiltrado: azar() < 0.5 });
      const suma = new Prisma.Decimal(r.ganancia).add(r.deTerceros).add(r.capital).add(r.ivaPorPagar);
      expect(suma.toFixed(2), `conjunto ${n}`).toBe(r.enCaja);
      expect(
        new Prisma.Decimal(r.deOrdenex).add(r.deTerceros).add(r.ivaPorPagar).toFixed(2),
        `conjunto ${n}`,
      ).toBe(r.enCaja);
      comprobados += 1;
    }
    expect(comprobados).toBe(500);
  });
});

describe("459/A.2 — R10: la derivacion no escribe nada", () => {
  it("es pura: no muta la entrada y da lo mismo dos veces", () => {
    const copia = structuredClone(M6);
    const a = derivarCaja(M6);
    const b = derivarCaja(M6);
    expect(M6).toEqual(copia);
    expect(a).toEqual(b);
  });
});
