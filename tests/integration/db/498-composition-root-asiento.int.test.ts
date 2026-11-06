import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Prisma } from "@prisma/client";

import { marcarConsolidacionRecibidaAction } from "@/lib/actions/conciliacion-satelites";
import type { Actor } from "@/lib/interfaces/services/IOrdenService";
import { HAY_BASE_DE_DATOS } from "./_postgres-real";
import { limpiarComprometido, prepararMundo, sembrarComprometido, type Comprometido, type Mundo } from "./454/_escenario";
import { SNAPSHOT_SELECT, aporteAMano, cierreSateliteAprobado, consolidar, tarifaDeLaTienda } from "./498/_satelite";

/**
 * FICHA 498 (T3.9; R6) — EL COMPOSITION ROOT DE LA CONCILIACION ASIENTA DE VERDAD.
 *
 * Se llama a `marcarConsolidacionRecibidaAction` inyectando SOLO `getActor`: corre el `buildService`
 * REAL, que construye `new CierresBodegaAdminRepository(prisma)` SIN dependencias. La prueba cuenta
 * FILAS en los tres libros (memoria «el composition root que no inyecta»: mirar el import no basta).
 *
 * Como la accion usa el cliente GLOBAL, los datos se siembran CONFIRMADOS (`sembrarComprometido`) y
 * se borran en `afterAll`, en orden de FKs.
 */

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

describeSiHayBase("498/T3.9 — el composition root de la conciliacion asienta (Postgres real, datos confirmados)", () => {
  let mundo: Mundo;
  let semilla: Comprometido | null = null;
  let cierres: string[] = [];
  let cbId = "";
  let maestro: Actor;
  let aporte = new Prisma.Decimal(0);
  let r: { status: string; libros: { caja: number; tienda: number; mensajero: number }; diferencia: number };

  beforeAll(async () => {
    mundo = await prepararMundo();
    semilla = await sembrarComprometido(mundo, async (e) => {
      await tarifaDeLaTienda(e);
      const c1 = await cierreSateliteAprobado(e, [{ monto: 6000 }, { monto: 4000, metodo: "SINPE" }]);
      const c2 = await cierreSateliteAprobado(e, [{ monto: 3000 }], e.actorMensajero2);
      cierres = [c1, c2];
      cbId = await consolidar(e);
      aporte = aporteAMano(await e.tx.cierreBodega.findUniqueOrThrow({ where: { id: cbId }, select: SNAPSHOT_SELECT }));
      maestro = e.actorMaestro;
      const ordenes = await e.tx.orden.findMany({ where: { tiendaId: e.tiendaId }, select: { id: true } });
      return { ordenIds: ordenes.map((o) => o.id) };
    });
    // Antes de marcar: los cierres satelite aprobados no tienen filas (R1).
    const res = await marcarConsolidacionRecibidaAction(
      { cierreBodegaId: cbId, montoRecibido: aporte.minus(250).toFixed(2) },
      { getActor: async () => maestro },
    );
    const contar = async (tabla: string) =>
      Number(
        (
          (await mundo.prisma.$queryRawUnsafe(
            `SELECT count(*)::int AS n FROM ${tabla} WHERE origen_id = ANY($1::text[])`,
            cierres,
          )) as Array<{ n: number }>
        )[0].n,
      );
    r = {
      status: res.status,
      libros: {
        caja: await contar("wallet_movimiento"),
        tienda: await contar("wallet_tienda_movimiento"),
        mensajero: await contar("pago_mensajero_movimiento"),
      },
      diferencia: await mundo.prisma.walletMovimiento.count({
        where: {
          categoria: "egreso_diferencia_satelite",
          origenId: { in: (await mundo.prisma.conciliacionBodegaAjuste.findMany({ where: { cierreBodegaId: cbId }, select: { id: true } })).map((a) => a.id) },
        },
      }),
    };
  }, 300_000);

  afterAll(async () => {
    if (semilla !== null) {
      const p = mundo.prisma;
      const ajustes = (await p.conciliacionBodegaAjuste.findMany({ where: { cierreBodegaId: cbId }, select: { id: true } })).map((a) => a.id);
      await p.walletMovimiento.deleteMany({ where: { origenId: { in: [...cierres, ...ajustes] } } });
      await p.walletTiendaMovimiento.deleteMany({ where: { origenId: { in: cierres } } });
      await p.pagoMensajeroMovimiento.deleteMany({ where: { origenId: { in: cierres } } });
      await p.conciliacionBodegaAjuste.deleteMany({ where: { cierreBodegaId: cbId } });
      await p.historialAccion.deleteMany({ where: { entidadId: { in: [cbId, ...cierres] } } });
      await p.historialAccion.deleteMany({ where: { actorUsuarioId: { in: semilla.usuarios } } });
      await p.cierreDia.updateMany({ where: { id: { in: cierres } }, data: { cierreBodegaId: null } });
      await p.cierreBodega.deleteMany({ where: { id: cbId } });
      await limpiarComprometido(p, semilla);
    }
    await mundo?.prisma.$disconnect();
  }, 120_000);

  it("anti-vacuidad: la accion real responde `ok` y la consolidacion tenia dinero que asentar", () => {
    expect(r.status).toBe("ok");
    expect(aporte.greaterThan(0)).toBe(true);
  });

  it("⭑ R6: sin inyectar escritores, la marca escribe FILAS en los tres libros para los cierres de la consolidacion", () => {
    expect(r.libros.caja).toBeGreaterThan(0);
    expect(r.libros.tienda).toBeGreaterThan(0);
    expect(r.libros.mensajero).toBeGreaterThan(0);
  });

  it("R6/R10: y la fila de diferencia por el faltante", () => {
    expect(r.diferencia).toBe(1);
  });
});
