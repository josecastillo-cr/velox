import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { HAY_BASE_DE_DATOS } from "./_postgres-real";
import { conEscenario, prepararMundo, type Escenario, type Mundo } from "./454/_escenario";
import { tarifaDeLaTienda } from "./498/_satelite";

/**
 * FICHA 498 (T1.1, T1.2, T3.3; R1-R4, R55) — APROBAR UN CIERRE DEL DIA, contra Postgres real y por
 * el SERVICIO real (`CierresAdminService.aprobarCierre` → `CierresAdminRepository.resolverCierre`).
 *
 *   · R1: aprobar un cierre SATELITE no deja ninguna fila en los tres libros. ROJO antes del arreglo
 *     (la aprobacion asentaba sin mirar el destino).
 *   · R2: lo que no es dinero sigue pasando en la misma transaccion.
 *   · R3/R55: aprobar un cierre CENTRAL escribe el MISMO multiconjunto de filas que antes de la
 *     ficha. El literal `FOTO_CENTRAL` se tomo con el codigo de `dev` en `13fd57fc` (T1.2) y ES el
 *     contrato (memoria «literal: contrato o polizon»): no se sustituye por su propia fuente.
 *
 * Todo corre en transacciones que SIEMPRE se revierten. Sin base, la suite se SALTA (visible).
 */

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

/** Las filas de los TRES libros con origen en `cierreId`, sin ids y ordenadas. */
async function filasDeLosLibros(e: Escenario, cierreId: string): Promise<string[]> {
  const filas = (await e.tx.$queryRawUnsafe(
    `SELECT 'wallet_movimiento' AS tabla, tipo::text AS tipo, categoria::text AS categoria,
            monto::text AS monto, origen_tipo::text AS origen_tipo
       FROM wallet_movimiento WHERE origen_id = $1
     UNION ALL
     SELECT 'wallet_tienda_movimiento', tipo::text, categoria::text, monto::text, origen_tipo::text
       FROM wallet_tienda_movimiento WHERE origen_id = $1
     UNION ALL
     SELECT 'pago_mensajero_movimiento', tipo::text, categoria::text, monto::text, origen_tipo::text
       FROM pago_mensajero_movimiento WHERE origen_id = $1`,
    cierreId,
  )) as Array<{ tabla: string; tipo: string; categoria: string; monto: string; origen_tipo: string }>;
  return filas
    .map((f) => `${f.tabla}|${f.tipo}|${f.categoria}|${f.monto}|${f.origen_tipo}|<cierre>`)
    .sort();
}

/**
 * T1.2 — LA FOTO de los cierres centrales, tomada con el codigo de ANTES de la ficha (`13fd57fc`).
 * Cierre central con: una entrega en efectivo (COD 10 000), una por SINPE (5 000), un rechazo y un
 * incidente con indemnizacion 3 000. Tarifa de la tienda 2 000 / 1 000, comision 5 %, IVA 13 %.
 * Tarifa del mensajero de la central 1 500 / 164 (la fija el escenario).
 */
const FOTO_CENTRAL: string[] = [
  "pago_mensajero_movimiento|devengo|pago_devengado|3000.00|cierre_dia|<cierre>",
  "pago_mensajero_movimiento|pago|pago_efectivo|3000.00|cierre_dia|<cierre>",
  "wallet_movimiento|egreso|egreso_indemnizacion|3000.00|cierre_dia|<cierre>",
  "wallet_movimiento|egreso|egreso_pago_mensajero|3000.00|cierre_dia|<cierre>",
  "wallet_movimiento|ingreso|ingreso_cod_recaudado|15000.00|cierre_dia|<cierre>",
  "wallet_movimiento|ingreso|ingreso_comision_cod|750.00|cierre_dia|<cierre>",
  "wallet_movimiento|ingreso|ingreso_flete_devolucion|1000.00|cierre_dia|<cierre>",
  "wallet_movimiento|ingreso|ingreso_flete|4000.00|cierre_dia|<cierre>",
  "wallet_movimiento|ingreso|ingreso_iva_comision_cod|97.50|cierre_dia|<cierre>",
  "wallet_movimiento|ingreso|ingreso_iva_flete_devolucion|130.00|cierre_dia|<cierre>",
  "wallet_movimiento|ingreso|ingreso_iva_flete|520.00|cierre_dia|<cierre>",
  "wallet_tienda_movimiento|credito|cod_recaudado|15000.00|cierre_dia|<cierre>",
  "wallet_tienda_movimiento|debito|comision_cod|750.00|cierre_dia|<cierre>",
  "wallet_tienda_movimiento|debito|flete_devolucion|1000.00|cierre_dia|<cierre>",
  "wallet_tienda_movimiento|debito|flete|4000.00|cierre_dia|<cierre>",
  "wallet_tienda_movimiento|debito|iva_comision_cod|97.50|cierre_dia|<cierre>",
  "wallet_tienda_movimiento|debito|iva_flete_devolucion|130.00|cierre_dia|<cierre>",
  "wallet_tienda_movimiento|debito|iva_flete|520.00|cierre_dia|<cierre>",
];

describeSiHayBase("498 — aprobar un cierre del dia mira el destino (Postgres real)", () => {
  let mundo: Mundo;
  let satelite: Awaited<ReturnType<typeof aprobarSatelite>>;
  let central: Awaited<ReturnType<typeof aprobarCentral>>;

  /** T1.1 — cierre SATELITE con COD en efectivo, SINPE y pago al mensajero (R1). */
  function aprobarSatelite() {
    return conEscenario(mundo, async (e) => {
      await tarifaDeLaTienda(e);
      const ef = await e.sembrarOrden({ estatus: "en_reparto", montoCobrar: 6000 });
      const sp = await e.sembrarOrden({ estatus: "en_reparto", montoCobrar: 4000 });
      await e.gestionarOk(ef.ordenId, "entregado", { monto: 6000 });
      await e.gestionarOk(sp.ordenId, "entregado", { monto: 4000, pagos: [{ metodo: "SINPE", monto: 4000 }] });
      const cierreId = await e.solicitarCierreOk();
      const r = await e.aprobar(cierreId);
      const cierre = await e.tx.cierreDia.findUniqueOrThrow({
        where: { id: cierreId },
        select: { estado: true, destinoTipo: true, totalPagoMensajero: true, totalGeneral: true },
      });
      return {
        status: r.status,
        estado: cierre.estado,
        destinoTipo: cierre.destinoTipo,
        totalPagoMensajero: cierre.totalPagoMensajero.toFixed(2),
        totalGeneral: cierre.totalGeneral.toFixed(2),
        filas: await filasDeLosLibros(e, cierreId),
        historial: await e.tx.historialAccion.count({
          where: { entidadId: cierreId, accion: "cierre_dia_aprobado" },
        }),
        estados: [await e.estadoDe(ef.ordenId), await e.estadoDe(sp.ordenId)],
      };
    });
  }

  /** T1.2 — cierre CENTRAL con todos los conceptos (R3). */
  function aprobarCentral() {
    return conEscenario(mundo, async (e) => {
      await tarifaDeLaTienda(e);
      const c = await e.mensajeroCentral();
      const ef = await e.sembrarOrden({ estatus: "en_reparto", montoCobrar: 10000, mensajeroId: c.mensajeroId });
      const sp = await e.sembrarOrden({ estatus: "en_reparto", montoCobrar: 5000, mensajeroId: c.mensajeroId });
      const re = await e.sembrarOrden({ estatus: "en_reparto", montoCobrar: 7000, mensajeroId: c.mensajeroId });
      const inc = await e.sembrarOrden({ estatus: "en_reparto", montoCobrar: 0, mensajeroId: c.mensajeroId });
      await e.gestionarOk(ef.ordenId, "entregado", { monto: 10000, actor: c.actor });
      await e.gestionarOk(sp.ordenId, "entregado", {
        monto: 5000,
        pagos: [{ metodo: "SINPE", monto: 5000 }],
        actor: c.actor,
      });
      await e.gestionarOk(re.ordenId, "devolucion_a_origen_por_rechazo", { actor: c.actor });
      const gInc = await e.gestionarOk(inc.ordenId, "incidente", { actor: c.actor });
      const cierreId = await e.solicitarCierreOk(c.actor);
      const r = await e.aprobar(cierreId, e.actorMaestro, [{ gestionId: gInc, monto: "3000.00" }]);
      const cierre = await e.tx.cierreDia.findUniqueOrThrow({
        where: { id: cierreId },
        select: { estado: true, destinoTipo: true },
      });
      return { status: r.status, estado: cierre.estado, destinoTipo: cierre.destinoTipo, filas: await filasDeLosLibros(e, cierreId) };
    });
  }

  beforeAll(async () => {
    mundo = await prepararMundo();
    satelite = await aprobarSatelite();
    central = await aprobarCentral();
  }, 300_000);

  afterAll(async () => {
    await mundo?.prisma.$disconnect();
  });

  it("anti-vacuidad: los dos cierres se aprueban y tienen el destino esperado", () => {
    expect(satelite.status).toBe("ok");
    expect(satelite.estado).toBe("aprobado");
    expect(satelite.destinoTipo).toBe("bodega_satelite");
    // El cierre satelite TIENE dinero que asentar: si no lo tuviera, «cero filas» no diria nada.
    expect(satelite.totalGeneral).toBe("10000.00");
    expect(satelite.totalPagoMensajero).toBe("3000.00");
    expect(central.status).toBe("ok");
    expect(central.estado).toBe("aprobado");
    expect(central.destinoTipo).toBe("bodega_central");
  });

  it("⭑ T1.1 / R1: aprobar un cierre SATELITE no escribe NINGUNA fila en los tres libros", () => {
    expect(satelite.filas).toEqual([]);
  });

  it("⭑ T1.2 / R3 / R55: aprobar un cierre CENTRAL escribe exactamente la foto de antes de la ficha", () => {
    expect(central.filas).toEqual(FOTO_CENTRAL);
  });
});
