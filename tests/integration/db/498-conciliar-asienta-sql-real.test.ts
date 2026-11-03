import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Prisma, type PrismaClient } from "@prisma/client";

import { CierresBodegaAdminRepository } from "@/lib/repositories/CierresBodegaAdminRepository";
import { CajaCodFeedService } from "@/lib/services/CajaCodFeedService";
import { WalletFeedService } from "@/lib/services/WalletFeedService";
import { WalletIndemnizacionFeedService } from "@/lib/services/WalletIndemnizacionFeedService";
import { WalletMensajeroFeedService } from "@/lib/services/WalletMensajeroFeedService";
import { WalletTiendaFeedService } from "@/lib/services/WalletTiendaFeedService";
import { HAY_BASE_DE_DATOS } from "./_postgres-real";
import { conEscenario, prepararMundo, type Mundo } from "./454/_escenario";
import {
  SNAPSHOT_SELECT,
  aporteAMano,
  cierreSateliteAprobado,
  consolidar,
  filasDeDiferencia,
  filasDeLosLibros,
  tarifaDeLaTienda,
} from "./498/_satelite";

/**
 * FICHA 498 (T1.3, T3.6; R8-R15, R54) — MARCAR RECIBIDA UNA CONSOLIDACION ASIENTA SUS CIERRES Y
 * ESCRIBE LA DIFERENCIA, contra Postgres real.
 *
 * T1.3 es ROJO contra el codigo de antes de la ficha: alli la aprobacion asentaba (las filas ya
 * estaban ANTES de marcar) y marcar no escribia en ningun libro (no habia diferencia).
 *
 * Todo corre en transacciones que SIEMPRE se revierten. Sin base, la suite se SALTA (visible).
 */

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

describeSiHayBase("498 — marcar recibida asienta y escribe la diferencia (Postgres real)", () => {
  let mundo: Mundo;
  let base: Awaited<ReturnType<typeof marcarConFaltante>>;

  /**
   * T1.3 — dos cierres satelite aprobados (uno con efectivo + SINPE, otro solo efectivo),
   * consolidados; se marca recibida por 500 MENOS que el aporte.
   */
  function marcarConFaltante() {
    return conEscenario(mundo, async (e) => {
      await tarifaDeLaTienda(e);
      const c1 = await cierreSateliteAprobado(e, [{ monto: 6000 }, { monto: 4000, metodo: "SINPE" }]);
      const c2 = await cierreSateliteAprobado(e, [{ monto: 3000 }], e.actorMensajero2);
      const cbId = await consolidar(e);
      const snap = await e.tx.cierreBodega.findUniqueOrThrow({ where: { id: cbId }, select: SNAPSHOT_SELECT });
      const aporte = aporteAMano(snap);
      const recibido = aporte.minus(500);

      const antes = await filasDeLosLibros(e, [c1, c2]);
      const repo = new CierresBodegaAdminRepository(e.cliente as unknown as PrismaClient);
      const res = await repo.marcarConciliado({
        id: cbId,
        montoRecibido: recibido.toFixed(2),
        nota: null,
        actorUsuarioId: e.maestroId,
      });
      const despues = await filasDeLosLibros(e, [c1, c2]);
      const diferencia = await filasDeDiferencia(e, cbId);
      const marca = await e.tx.cierreBodega.findUniqueOrThrow({
        where: { id: cbId },
        select: { conciliadoAt: true, montoRecibido: true },
      });

      // R13: los cinco feeds NO ponen `fechaMovimiento`: la fecha es el DEFAULT now() de la
      // transaccion que escribe, o sea la de la marca. Se mira el objeto que cada feed devuelve.
      const feeds = [
        ...(await new WalletFeedService().construirMovimientosDeIngreso(c1, e.tx)),
        ...(await new WalletTiendaFeedService().construirMovimientosPorTienda(c1, e.tx)),
        ...(await new CajaCodFeedService().construirIngresoCod(c1, e.tx)),
        ...(await (async () => {
          const m = await new WalletMensajeroFeedService().construirMovimientosDePago(c1, e.tx);
          return [...m.libro, ...m.egresoCaja];
        })()),
        ...(await new WalletIndemnizacionFeedService().construirEgresoIndemnizacion(c1, e.tx)),
      ];
      return {
        res,
        c1,
        c2,
        aporte: aporte.toFixed(2),
        antes,
        despues,
        diferencia,
        marca: { conciliado: marca.conciliadoAt !== null, recibido: marca.montoRecibido?.toFixed(2) ?? null },
        feeds: feeds.length,
        feedsConFecha: feeds.filter((m) => (m as { fechaMovimiento?: unknown }).fechaMovimiento !== undefined).length,
      };
    });
  }

  beforeAll(async () => {
    mundo = await prepararMundo();
    base = await marcarConFaltante();
  }, 300_000);

  afterAll(async () => {
    await mundo?.prisma.$disconnect();
  });

  it("anti-vacuidad: la marca se aplica y la consolidacion tiene aporte positivo", () => {
    expect(base.res).toBe("updated");
    expect(base.marca.conciliado).toBe(true);
    expect(new Prisma.Decimal(base.aporte).greaterThan(0)).toBe(true);
    expect(base.feeds).toBeGreaterThan(0);
  });

  it("⭑ T1.3 / R1: ANTES de marcar, los cierres satelite aprobados no tienen ninguna fila en los libros", () => {
    expect(base.antes).toEqual([]);
  });

  it("⭑ T1.3 / R8: DESPUES de marcar, cada cierre tiene filas en los TRES libros", () => {
    for (const c of [base.c1, base.c2]) {
      const suyas = base.despues.filter((f) => f.endsWith(`|${c}`));
      for (const tabla of ["wallet_movimiento|", "wallet_tienda_movimiento|", "pago_mensajero_movimiento|"]) {
        expect(suyas.some((f) => f.startsWith(tabla))).toBe(true);
      }
    }
  });

  it("⭑ T1.3 / R10 / R12: UNA sola fila de caja `egreso_diferencia_satelite` por el faltante", () => {
    expect(base.diferencia).toEqual([
      {
        tipo: "egreso",
        categoria: "egreso_diferencia_satelite",
        monto: "500.00",
        origen_tipo: "conciliacion_bodega_ajuste",
        evento: "marca",
        diferencia: "500.00",
        monto_esperado: base.aporte,
        monto_recibido: new Prisma.Decimal(base.aporte).minus(500).toFixed(2),
      },
    ]);
  });

  it("R13: ninguno de los cinco feeds pone `fechaMovimiento` (la fecha la pone la transaccion de la marca)", () => {
    expect(base.feedsConFecha).toBe(0);
  });
});
