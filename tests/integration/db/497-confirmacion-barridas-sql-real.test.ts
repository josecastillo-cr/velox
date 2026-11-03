import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { HAY_BASE_DE_DATOS } from "./_postgres-real";
import { conEscenario, prepararMundo, type Escenario, type Mundo } from "./454/_escenario";

/**
 * FICHA 497 (T1.2/T3.2/T3.6) — LAS BARRIDAS DEL CIERRE SE CONFIRMAN FISICAMENTE, contra Postgres.
 *
 * Modelo de AQUI (design §2): el corte REAL crea el cierre `vencido` y, en la misma transaccion,
 * pasa las ordenes a `novedad_interna` y escribe sus filas en `cierre_sin_gestion`. Para aprobarlo,
 * el mensajero lo re-solicita (pasa a `solicitado`). No se simula un «vencer» que aqui no existe.
 *
 * Todo corre en transacciones que SIEMPRE se revierten (`conEscenario`): la base local es compartida.
 * Sin base alcanzable la suite se SALTA de forma visible (`describe.skip`), nunca pasa en verde vacia.
 */

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

/** Siembra una orden en reparto, corre el corte (la barre) y re-solicita el cierre que nacio. */
async function cierreConBarridas(e: Escenario, n = 1) {
  const ordenes = [];
  for (let i = 0; i < n; i++) {
    ordenes.push(await e.sembrarOrden({ estatus: "en_reparto", montoCobrar: 1000 }));
  }
  await e.correrCorte(new Date());
  const vencido = await e.tx.cierreDia.findFirstOrThrow({
    where: { mensajeroId: e.mensajeroId, estado: "vencido" },
    select: { id: true },
  });
  const resolicitud = await e.solicitarCierre();
  if (resolicitud.status !== "ok") throw new Error(`re-solicitud fallida: ${JSON.stringify(resolicitud)}`);
  return { cierreId: vencido.id, ordenes };
}

describeSiHayBase("497 — aprobar un cierre con barridas exige confirmarlas (Postgres real)", () => {
  let mundo: Mundo;
  let sinConfirmar: Awaited<ReturnType<typeof aprobarSinConfirmar>>;

  /** T1.2 — aprobar por el SERVICIO real sin confirmar la barrida. */
  function aprobarSinConfirmar() {
    return conEscenario(mundo, async (e) => {
      const { cierreId, ordenes } = await cierreConBarridas(e, 1);
      const r = await e.s.cierresAdmin.aprobarCierre(cierreId, e.actorAdminSatelite, [], []);
      const cierre = await e.tx.cierreDia.findUniqueOrThrow({
        where: { id: cierreId },
        select: { estado: true },
      });
      return {
        status: r.status,
        fieldErrors: r.status === "validation_error" ? r.fieldErrors : null,
        estadoCierre: cierre.estado,
        estadoOrden: await e.estadoDe(ordenes[0].ordenId),
        ordenId: ordenes[0].ordenId,
      };
    });
  }

  beforeAll(async () => {
    mundo = await prepararMundo();
    sinConfirmar = await aprobarSinConfirmar();
  }, 180_000);

  afterAll(async () => {
    await mundo?.prisma.$disconnect();
  });

  it("T1.2/R10/R11: sin confirmar la barrida, el cierre sigue `solicitado` y la orden en `novedad_interna`", () => {
    expect(sinConfirmar.status).toBe("validation_error");
    expect(sinConfirmar.estadoCierre).toBe("solicitado");
    expect(sinConfirmar.estadoOrden).toBe("novedad_interna");
  });

  it("R12: el error va en la clave de ESA barrida (su ordenId)", () => {
    expect(Object.keys(sinConfirmar.fieldErrors ?? {})).toEqual([sinConfirmar.ordenId]);
  });
});
