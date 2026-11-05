import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Prisma, type PrismaClient } from "@prisma/client";

import { CierresBodegaAdminRepository } from "@/lib/repositories/CierresBodegaAdminRepository";
import { EstadoCuentaRepository } from "@/lib/repositories/EstadoCuentaRepository";
import { SaldosSatelitesRepository } from "@/lib/repositories/SaldosSatelitesRepository";
import { aporteCierreSql } from "@/lib/repositories/deuda-satelite-sql";
import { aporteDeConsolidacion } from "@/lib/utils/conciliacion-satelite";
import { paraLaCentral } from "@/lib/utils/ingreso-empresa";
import { HAY_BASE_DE_DATOS } from "./_postgres-real";
import { conEscenario, prepararMundo, type Escenario, type Mundo } from "./454/_escenario";
import {
  SNAPSHOT_SELECT,
  aporteAMano,
  cierreSateliteAprobado,
  consolidar,
  tarifaDeLaTienda,
} from "./498/_satelite";

/**
 * FICHA 498 (T1.4, T4.1-T4.3; R23-R32, R41a, R54c) — LA DEUDA DE UNA SATELITE, contra Postgres real.
 *
 * Formula de R23, HECHA A MANO en el test (no se llama a `paraLaCentral` para el esperado):
 *   deuda = Σ aportes de sus cierres aprobados (fuera de saldadas con la regla anterior)
 *         + Σ aporte reconocido de sus saldadas no rechazadas
 *         − Σ monto_recibido de sus consolidaciones no rechazadas.
 * El aporte incluye TODOS los metodos de pago.
 *
 * T1.4 fue ROJO contra el codigo de antes de la ficha (Σ efectivo de las consolidaciones − Σ recibido).
 */

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;
const cero = () => new Prisma.Decimal(0);

/**
 * La consolidacion se marca «con la regla vieja» y se REGULARIZA a mano (lo que hacen el codigo de
 * antes y M4): conciliada contra el efectivo, sin asientos ni ajustes, con `esperado_regla_anterior`.
 */
async function saldarConLaReglaAnterior(e: Escenario, cbId: string): Promise<string> {
  const { totalEfectivo } = await e.tx.cierreBodega.findUniqueOrThrow({ where: { id: cbId }, select: { totalEfectivo: true } });
  await e.tx.$executeRawUnsafe(
    `UPDATE cierre_bodega
        SET estado = 'aprobado', conciliado_at = now(), conciliado_por = $2, monto_recibido = $3::numeric,
            resuelto_at = now(), resuelto_por = $2, esperado_regla_anterior = $3::numeric
      WHERE id = $1`,
    cbId,
    e.maestroId,
    totalEfectivo.toFixed(2),
  );
  return totalEfectivo.toFixed(2);
}

const ventana = {
  pares: null,
  sortDir: "asc" as const,
  conNombreRegistrador: true,
  skip: 0,
  take: 500,
};

describeSiHayBase("498 — la deuda de una satelite (Postgres real)", () => {
  let mundo: Mundo;
  let base: Awaited<ReturnType<typeof deudaConSinConsolidarYSinpe>>;
  let rica: Awaited<ReturnType<typeof zonaCompleta>>;
  let soloSaldada: Awaited<ReturnType<typeof zonaSoloSaldada>>;
  let gemela: Awaited<ReturnType<typeof gemelaSql>>;

  /** T1.4 — un cierre consolidado con SINPE y otro aprobado SIN consolidar. */
  function deudaConSinConsolidarYSinpe() {
    return conEscenario(mundo, async (e) => {
      await tarifaDeLaTienda(e);
      const a = await cierreSateliteAprobado(e, [{ monto: 6000 }, { monto: 4000, metodo: "SINPE" }]);
      await consolidar(e);
      const b = await cierreSateliteAprobado(e, [{ monto: 3000 }], e.actorMensajero2);
      const cierres = await e.tx.cierreDia.findMany({ where: { id: { in: [a, b] } }, select: SNAPSHOT_SELECT });
      const formula = cierres.reduce((s, c) => s.plus(aporteAMano(c)), cero());
      const filas = await new SaldosSatelitesRepository(e.cliente as unknown as PrismaClient).findSaldosCompleto();
      return { formula: formula.toFixed(2), fila: filas.find((f) => f.zonaId === e.zonaSateliteId) ?? null };
    });
  }

  /**
   * R23-R25, R29-R31, R41a — una zona con: un cierre SIN consolidar (A), uno en una consolidacion
   * pendiente con SINPE (B), uno en una consolidacion RECHAZADA (C), uno conciliado con faltante (D)
   * y una consolidacion SALDADA con la regla anterior con hueco SINPE (E).
   */
  function zonaCompleta() {
    return conEscenario(mundo, async (e) => {
      await tarifaDeLaTienda(e);
      // E — saldada con la regla anterior (efectivo 5 000, SINPE 2 000).
      const cE = await cierreSateliteAprobado(e, [{ monto: 5000 }, { monto: 2000, metodo: "SINPE" }]);
      const cbE = await consolidar(e);
      const recibidoE = await saldarConLaReglaAnterior(e, cbE);
      // C — consolidacion rechazada (Q3): su cierre vuelve a contar como «sin consolidar».
      const cC = await cierreSateliteAprobado(e, [{ monto: 2500 }]);
      const cbC = await consolidar(e);
      await e.tx.$executeRawUnsafe(`UPDATE cierre_bodega SET estado = 'rechazado' WHERE id = $1`, cbC);
      // D — conciliada con faltante de 700 (codigo nuevo: asienta y escribe la diferencia).
      const cD = await cierreSateliteAprobado(e, [{ monto: 8000 }]);
      const cbD = await consolidar(e);
      const snapD = await e.tx.cierreBodega.findUniqueOrThrow({ where: { id: cbD }, select: SNAPSHOT_SELECT });
      const recibidoD = aporteAMano(snapD).minus(700);
      await new CierresBodegaAdminRepository(e.cliente as unknown as PrismaClient).marcarConciliado({
        id: cbD,
        montoRecibido: recibidoD.toFixed(2),
        nota: null,
        actorUsuarioId: e.maestroId,
      });
      // B — pendiente de conciliar, con SINPE.
      const cB = await cierreSateliteAprobado(e, [{ monto: 1000 }, { monto: 4000, metodo: "SINPE" }]);
      const cbB = await consolidar(e);
      // A — aprobado y SIN consolidar.
      const cA = await cierreSateliteAprobado(e, [{ monto: 3000 }], e.actorMensajero2);

      const aporte = async (id: string) =>
        aporteAMano(await e.tx.cierreDia.findUniqueOrThrow({ where: { id }, select: SNAPSHOT_SELECT }));
      // E no entra: es saldada con la regla anterior y aporta su reconocido, no sus cierres.
      const [aA, aB, aC, aD] = [await aporte(cA), await aporte(cB), await aporte(cC), await aporte(cD)];
      // La formula de R23, a mano: E aporta su reconocido (= recibido) y no sus cierres.
      const deuda = aA.plus(aB).plus(aC).plus(aD).plus(recibidoE).minus(recibidoD).minus(recibidoE);
      const sinConsolidar = aA.plus(aC);

      const saldos = new SaldosSatelitesRepository(e.cliente as unknown as PrismaClient);
      const completo = await saldos.findSaldosCompleto();
      const pagina = await saldos.findSaldosPaginado({ skip: 0, take: 100_000 });
      const resumen = await saldos.findResumen();
      const consolidaciones = await saldos.findConsolidacionesCompleto(e.zonaSateliteId);

      const ec = new EstadoCuentaRepository(e.cliente as unknown as PrismaClient);
      const totales = await ec.totalesDeBodega(e.zonaSateliteId);
      const libro = await ec.paginaDeBodega(e.zonaSateliteId, ventana);
      // Un corte a mitad: el instante de aprobacion de A (las consolidaciones nacen con `now()` de la tx).
      const { resueltoAt: corteA } = await e.tx.cierreDia.findUniqueOrThrow({ where: { id: cA }, select: { resueltoAt: true } });
      const corte = corteA as Date;
      const alInicio = await ec.totalesDeBodega(e.zonaSateliteId, corte);
      const periodo = await ec.periodoDeBodega(e.zonaSateliteId, corte, undefined);

      return {
        ids: { cA, cB, cC, cD, cE, cbB, cbD, cbE },
        aportes: { aB: aB.toFixed(2), aD: aD.toFixed(2) },
        recibidoE,
        deuda: deuda.toFixed(2),
        sinConsolidar: sinConsolidar.toFixed(2),
        fila: completo.find((f) => f.zonaId === e.zonaSateliteId) ?? null,
        filaPagina: pagina.items.find((f) => f.zonaId === e.zonaSateliteId) ?? null,
        sumaFilas: completo.reduce((s, f) => s.plus(f.saldoSinConciliar), cero()).toFixed(2),
        resumen,
        consolidaciones,
        totales,
        libro,
        alInicio,
        periodo,
      };
    });
  }

  /** R54c — una zona con SOLO una consolidacion saldada con la regla anterior (con hueco SINPE). */
  function zonaSoloSaldada() {
    return conEscenario(mundo, async (e) => {
      await tarifaDeLaTienda(e);
      await cierreSateliteAprobado(e, [{ monto: 4000 }, { monto: 6000, metodo: "SINPE" }]);
      const cb = await consolidar(e);
      await saldarConLaReglaAnterior(e, cb);
      const fila = (await new SaldosSatelitesRepository(e.cliente as unknown as PrismaClient).findSaldosCompleto()).find(
        (f) => f.zonaId === e.zonaSateliteId,
      );
      const ec = new EstadoCuentaRepository(e.cliente as unknown as PrismaClient);
      return { fila, totales: await ec.totalesDeBodega(e.zonaSateliteId) };
    });
  }

  /** R28 — `aporteCierreSql` = `paraLaCentral` sobre filas reales: positivo, cero y negativo. */
  function gemelaSql() {
    return conEscenario(mundo, async (e) => {
      const casos = [
        { general: "10000.00", pago: "3000.00", rechazos: "164.00" },
        { general: "1500.00", pago: "1500.00", rechazos: "0.00" },
        { general: "0.00", pago: "1500.00", rechazos: "164.00" },
      ];
      const ids: string[] = [];
      for (const c of casos) {
        const fila = await e.tx.cierreDia.create({
          data: {
            mensajeroId: e.mensajeroId,
            estado: "solicitado",
            destinoTipo: "bodega_satelite",
            destinoZonaId: e.zonaSateliteId,
            totalGeneral: new Prisma.Decimal(c.general),
            totalPagoMensajero: new Prisma.Decimal(c.pago),
            totalIngresoBodegaRechazos: new Prisma.Decimal(c.rechazos),
          },
          select: { id: true },
        });
        ids.push(fila.id);
      }
      const sql = await e.tx.$queryRaw<{ id: string; aporte: string }[]>`
        SELECT c.id, ${aporteCierreSql("c")}::text AS aporte FROM cierre_dia c WHERE c.id = ANY(${ids}::text[])`;
      const porId = new Map(sql.map((f) => [f.id, new Prisma.Decimal(f.aporte).toFixed(2)]));
      return casos.map((c, i) => ({ sql: porId.get(ids[i]), ts: paraLaCentral(c.general, c.pago, c.rechazos) }));
    });
  }

  beforeAll(async () => {
    mundo = await prepararMundo();
    base = await deudaConSinConsolidarYSinpe();
    rica = await zonaCompleta();
    soloSaldada = await zonaSoloSaldada();
    gemela = await gemelaSql();
  }, 600_000);

  afterAll(async () => {
    await mundo?.prisma.$disconnect();
  });

  describe("Saldos (R23-R25, R42, R41a)", () => {
    it("anti-vacuidad: la zona aparece en Saldos y la formula a mano es positiva", () => {
      expect(base.fila).not.toBeNull();
      expect(new Prisma.Decimal(base.formula).greaterThan(0)).toBe(true);
    });

    it("⭑ T1.4 / R23: la deuda de Saldos es la formula de R23 hecha a mano (todos los metodos, con los sin consolidar)", () => {
      expect(base.fila?.saldoSinConciliar).toBe(base.formula);
    });

    it("⭑ R23: con sin consolidar, SINPE, rechazada, conciliada con faltante y SALDADA, la deuda es la formula a mano", () => {
      expect(rica.fila?.saldoSinConciliar).toBe(rica.deuda);
    });

    it("R24 / R42: «Sin consolidar» = el aporte del cierre suelto + el de la consolidacion rechazada, y son 2 cierres", () => {
      expect(rica.fila?.sinConsolidar).toBe(rica.sinConsolidar);
      expect(rica.fila?.cierresSinConsolidar).toBe(2);
    });

    it("R25: la descarga es igual a la pagina, y Σ filas = `pendienteTotal` de la cabecera", () => {
      expect(rica.filaPagina).toEqual(rica.fila);
      expect(rica.resumen.pendienteTotal).toBe(rica.sumaFilas);
    });

    it("⭑ R41a / R26: el DTO de la saldada trae `saldadaReglaAnterior`, `debe` = su reconocido y falta 0", () => {
      const e = rica.consolidaciones.find((c) => c.cierreBodegaId === rica.ids.cbE);
      expect(e?.saldadaReglaAnterior).toBe(true);
      expect(e?.debe).toBe(rica.recibidoE);
      expect(e?.faltaPorRecibir).toBe("0.00");
      // Y la de la regla nueva: `debe` = «Para la central», falta = lo que no llego.
      const d = rica.consolidaciones.find((c) => c.cierreBodegaId === rica.ids.cbD);
      expect(d?.saldadaReglaAnterior).toBe(false);
      expect(d?.debe).toBe(rica.aportes.aD);
      expect(d?.paraLaCentral).toBe(rica.aportes.aD);
      expect(d?.faltaPorRecibir).toBe("700.00");
      const b = rica.consolidaciones.find((c) => c.cierreBodegaId === rica.ids.cbB);
      expect(b?.debe).toBe(rica.aportes.aB);
      expect(b?.debePositivo).toBe(true);
      expect(b?.faltaPorRecibir).toBe(rica.aportes.aB);
    });

    it("⭑ R54c: una zona con SOLO una saldada (con hueco SINPE) debe 0 en Saldos y en el estado de cuenta", () => {
      expect(soloSaldada.fila?.saldoSinConciliar).toBe("0.00");
      expect(
        new Prisma.Decimal(soloSaldada.totales.declarado).minus(soloSaldada.totales.recibido).toFixed(2),
      ).toBe("0.00");
    });
  });

  describe("Estado de cuenta de la bodega (R29-R32)", () => {
    it("⭑ R29: el declarado de cada consolidacion es Σ aportes de sus cierres; el de la saldada, su reconocido", () => {
      const declarado = (id: string) =>
        rica.libro.filas.find((f) => f.tipo === "declarado" && f.origenTipo === "cierre_bodega" && f.origenId === id)?.monto;
      expect(declarado(rica.ids.cbB)).toBe(rica.aportes.aB);
      expect(declarado(rica.ids.cbD)).toBe(rica.aportes.aD);
      expect(declarado(rica.ids.cbE)).toBe(rica.recibidoE);
    });

    it("⭑ R30: hay UNA fila por cierre sin consolidar (el suelto y el de la rechazada), con origen `cierre_dia`", () => {
      const sueltos = rica.libro.filas.filter((f) => f.origenTipo === "cierre_dia").map((f) => f.origenId).sort();
      expect(sueltos).toEqual([rica.ids.cA, rica.ids.cC].sort());
    });

    it("⭑ R31: sin filtros, el pendiente final = la deuda de Saldos", () => {
      expect(new Prisma.Decimal(rica.totales.declarado).minus(rica.totales.recibido).toFixed(2)).toBe(
        rica.fila?.saldoSinConciliar,
      );
    });

    it("R31: para un periodo, «al inicio» + declarado − recibido = «al final»", () => {
      const inicio = new Prisma.Decimal(rica.alInicio.declarado).minus(rica.alInicio.recibido);
      const declarado = rica.periodo.filter((m) => m.tipo === "declarado").reduce((s, m) => s.plus(m.monto), cero());
      const recibido = rica.periodo.filter((m) => m.tipo === "recibido").reduce((s, m) => s.plus(m.monto), cero());
      const final = new Prisma.Decimal(rica.totales.declarado).minus(rica.totales.recibido);
      expect(inicio.plus(declarado).minus(recibido).toFixed(2)).toBe(final.toFixed(2));
      // Anti-vacuidad: el corte deja algo a cada lado.
      expect(rica.periodo.length).toBeGreaterThan(0);
      expect(rica.periodo.length).toBeLessThan(rica.libro.total);
    });
  });

  describe("una sola definicion (R28, R32)", () => {
    it("⭑ R28: `aporteCierreSql` es igual a `paraLaCentral` con signo positivo, cero y negativo, sobre filas reales", () => {
      expect(gemela.map((g) => g.ts)).toEqual(["6836.00", "0.00", "-1664.00"]);
      for (const g of gemela) expect(g.sql).toBe(g.ts);
    });

    it("R28: el declarado SQL de la saldada es `aporteDeConsolidacion` de esa fila", () => {
      const fila = {
        totalGeneral: new Prisma.Decimal("1"),
        totalPagoMensajero: new Prisma.Decimal("0"),
        totalIngresoBodegaRechazos: new Prisma.Decimal("0"),
        esperadoReglaAnterior: new Prisma.Decimal(rica.recibidoE),
      };
      const declaradoSql = rica.libro.filas.find(
        (f) => f.tipo === "declarado" && f.origenId === rica.ids.cbE,
      )?.monto;
      expect(declaradoSql).toBe(aporteDeConsolidacion(fila).toFixed(2));
    });
  });
});
