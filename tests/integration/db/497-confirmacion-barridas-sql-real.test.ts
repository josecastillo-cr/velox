import { randomUUID } from "node:crypto";

import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { ConfirmacionFisicaNoAplicableError } from "@/lib/repositories/CierresAdminRepository";
import { asentarCierreDia, dependenciasRealesDeAsiento } from "@/lib/repositories/asentar-cierre-dia";
import type { ResolverCierreInput } from "@/lib/interfaces/repositories/ICierresAdminRepository";
import { HAY_BASE_DE_DATOS, clienteConSavepoint } from "./_postgres-real";
import {
  conEscenario,
  montarServicios,
  prepararMundo,
  type Escenario,
  type Mundo,
} from "./454/_escenario";

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
const DIA_MS = 24 * 60 * 60 * 1000;

const alcanceSat = (e: Escenario) => ({
  destinoTipo: "bodega_satelite" as const,
  destinoZonaId: e.zonaSateliteId,
});

/**
 * Siembra `barridas` ordenes en reparto (y `entregadas` gestionadas como entrega), corre el corte
 * REAL (que barre las primeras y vincula las segundas) y re-solicita el cierre que nacio.
 */
async function cierreDelCorte(e: Escenario, opts: { barridas: number; entregadas?: number }) {
  const barridas = [];
  for (let i = 0; i < opts.barridas; i++) {
    barridas.push(await e.sembrarOrden({ estatus: "en_reparto", montoCobrar: 1000 }));
  }
  for (let i = 0; i < (opts.entregadas ?? 0); i++) {
    const o = await e.sembrarOrden({ estatus: "en_reparto", montoCobrar: 2000 });
    await e.gestionarOk(o.ordenId, "entregado", { monto: 2000 });
  }
  await e.correrCorte(new Date());
  const vencido = await e.tx.cierreDia.findFirstOrThrow({
    where: { mensajeroId: e.mensajeroId, estado: "vencido" },
    select: { id: true },
  });
  const resolicitud = await e.solicitarCierre();
  if (resolicitud.status !== "ok") throw new Error(`re-solicitud fallida: ${JSON.stringify(resolicitud)}`);
  return { cierreId: vencido.id, barridas };
}

/** Las marcas de las barridas del cierre, por orden. */
async function marcasDe(e: Escenario, cierreId: string) {
  const filas = await e.tx.cierreSinGestion.findMany({
    where: { cierreId },
    select: { ordenId: true, confirmadaFisicaAt: true },
  });
  return Object.fromEntries(filas.map((f) => [f.ordenId, f.confirmadaFisicaAt]));
}

/** Los datos CONGELADOS de las barridas del cierre (todo menos la marca). */
async function congeladosDe(e: Escenario, cierreId: string) {
  return e.tx.cierreSinGestion.findMany({
    where: { cierreId },
    orderBy: { ordenId: "asc" },
    select: {
      ordenId: true,
      numGuia: true,
      numRemision: true,
      destinatario: true,
      producto: true,
      tiendaNombre: true,
      zonaNombre: true,
      estatusOrigenId: true,
      createdAt: true,
    },
  });
}

/**
 * La HUELLA de dinero de un cierre: todas las filas de las tres tablas de dinero con origen en
 * ese cierre, sin ids, ordenadas. Los cinco feeds escriben con `origen_id = cierreId`.
 */
async function huellaDeDinero(e: Escenario, cierreId: string) {
  const filas = (await e.tx.$queryRawUnsafe(
    `SELECT 'caja' AS t, tipo::text AS tipo, categoria::text AS categoria, monto::text AS monto
       FROM wallet_movimiento WHERE origen_id = $1
     UNION ALL
     SELECT 'tienda', tipo::text, categoria::text, monto::text
       FROM wallet_tienda_movimiento WHERE origen_id = $1
     UNION ALL
     SELECT 'mensajero', tipo::text, categoria::text, monto::text
       FROM pago_mensajero_movimiento WHERE origen_id = $1`,
    cierreId,
  )) as Array<{ t: string; tipo: string; categoria: string; monto: string }>;
  return filas.map((f) => `${f.t}|${f.tipo}|${f.categoria}|${f.monto}`).sort();
}

/**
 * FICHA 498 (fixture): desde la 498 aprobar un cierre SATELITE no escribe dinero (R1); su dinero entra
 * al CONCILIAR la consolidacion, por el MISMO procedimiento (`asentarCierreDia`). R39 compara el dinero
 * del cierre con y sin barridas: se asienta aqui, tras aprobar, para que la huella exista y la
 * comparacion siga diciendo algo. Ninguna asercion cambia.
 */
async function huellaAlAsentar(e: Escenario, cierreId: string) {
  await asentarCierreDia(e.tx, cierreId, dependenciasRealesDeAsiento(e.cliente));
  return huellaDeDinero(e, cierreId);
}

async function totalesDe(e: Escenario, cierreId: string) {
  const c = await e.tx.cierreDia.findUniqueOrThrow({
    where: { id: cierreId },
    select: {
      totalEfectivo: true,
      totalSimpe: true,
      totalTransferencia: true,
      totalGeneral: true,
      totalPagoMensajero: true,
      totalIngresoBodegaRechazos: true,
    },
  });
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.toString()]));
}

async function estadoCierre(e: Escenario, cierreId: string) {
  return (await e.tx.cierreDia.findUniqueOrThrow({ where: { id: cierreId }, select: { estado: true } }))
    .estado;
}

describeSiHayBase("497 — aprobar un cierre con barridas exige confirmarlas (Postgres real)", () => {
  let mundo: Mundo;
  let sinConfirmar: Awaited<ReturnType<typeof aprobarSinConfirmar>>;
  let completo: Awaited<ReturnType<typeof aprobarCompleto>>;
  let sinBarridas: Awaited<ReturnType<typeof aprobarSinBarridas>>;
  let lecturas: Awaited<ReturnType<typeof leerBarridas>>;
  let cortos: Awaited<ReturnType<typeof forzarCountCorto>>;
  let rechazo: Awaited<ReturnType<typeof rechazarConBarridas>>;

  /** T1.2 — aprobar por el SERVICIO real sin confirmar la barrida (R10/R11/R12). */
  function aprobarSinConfirmar() {
    return conEscenario(mundo, async (e) => {
      const { cierreId, barridas } = await cierreDelCorte(e, { barridas: 1, entregadas: 1 });
      // Se confirman las gestiones que vuelven (ninguna: la entregada no vuelve) y NO la barrida.
      const r = await e.s.cierresAdmin.aprobarCierre(cierreId, e.actorAdminSatelite, [], []);
      return {
        status: r.status,
        fieldErrors: r.status === "validation_error" ? r.fieldErrors : null,
        estadoCierre: await estadoCierre(e, cierreId),
        estadoOrden: await e.estadoDe(barridas[0].ordenId),
        ordenId: barridas[0].ordenId,
        marcas: await marcasDe(e, cierreId),
        huella: await huellaDeDinero(e, cierreId),
      };
    });
  }

  /** R6/R15/R22/R24/R27/R29/R39 — el camino feliz, con una guia viva cambiada despues del corte. */
  function aprobarCompleto() {
    return conEscenario(mundo, async (e) => {
      const { cierreId, barridas } = await cierreDelCorte(e, { barridas: 2, entregadas: 1 });
      const [b1] = barridas;
      const marcasTrasResolicitud = await marcasDe(e, cierreId);
      const congeladosAntes = await congeladosDe(e, cierreId);

      // R6: la guia VIVA de la orden cambia despues del corte; la congelada no.
      const guiaViva = b1.numGuia + 900_000_000;
      await e.tx.orden.update({ where: { id: b1.ordenId }, data: { numGuia: guiaViva } });
      const exacta = await e.confirmacionDe(cierreId, alcanceSat(e));
      const conGuiaViva = exacta.map((c) =>
        c.ordenId === b1.ordenId ? { ordenId: c.ordenId, numGuia: guiaViva } : c,
      );
      const rViva = await e.s.cierresAdmin.aprobarCierre(cierreId, e.actorAdminSatelite, [], conGuiaViva);

      const r = await e.aprobar(cierreId);
      const marcas = await marcasDe(e, cierreId);
      // R27: una segunda aprobacion no reescribe la marca.
      const segunda = await e.aprobar(cierreId);
      return {
        cierreId,
        exacta,
        rViva: { status: rViva.status, fieldErrors: rViva.status === "validation_error" ? rViva.fieldErrors : null },
        b1: b1.ordenId,
        marcasTrasResolicitud,
        status: r.status,
        estadoCierre: await estadoCierre(e, cierreId),
        marcas,
        marcasTrasSegunda: await marcasDe(e, cierreId),
        segunda: segunda.status,
        estados: Object.fromEntries(
          await Promise.all(barridas.map(async (b) => [b.ordenId, await e.estadoDe(b.ordenId)] as const)),
        ),
        congeladosAntes,
        congeladosDespues: await congeladosDe(e, cierreId),
        huella: await huellaAlAsentar(e, cierreId),
        totales: await totalesDe(e, cierreId),
      };
    });
  }

  /** R9/R19/R39 — el MISMO cierre sin barridas: misma huella de dinero, mismo payload. */
  function aprobarSinBarridas() {
    return conEscenario(mundo, async (e) => {
      const { cierreId } = await cierreDelCorte(e, { barridas: 0, entregadas: 1 });
      const barridasLeidas = await e.s.adminRepo.findBarridasDelCierre(cierreId, alcanceSat(e));
      const exacta = await e.confirmacionDe(cierreId, alcanceSat(e));
      const r = await e.aprobar(cierreId);
      return {
        barridasLeidas,
        exacta,
        status: r.status,
        huella: await huellaAlAsentar(e, cierreId),
        totales: await totalesDe(e, cierreId),
      };
    });
  }

  /** R5-R8 — la lectura del repositorio, contra Postgres. */
  function leerBarridas() {
    return conEscenario(mundo, async (e) => {
      const ahora = new Date();
      const a = await e.sembrarOrden({ estatus: "en_reparto" });
      const b = await e.sembrarOrden({ estatus: "en_reparto" });
      await e.correrCorte(ahora);
      const c = await e.sembrarOrden({ estatus: "en_reparto" });
      await e.correrCorte(new Date(ahora.getTime() + DIA_MS));
      const vencidos = await e.tx.cierreDia.findMany({
        where: { mensajeroId: e.mensajeroId, estado: "vencido" },
        orderBy: { solicitadoAt: "asc" },
        select: { id: true },
      });
      if (vencidos.length !== 2) throw new Error(`se esperaban 2 vencidos, hay ${vencidos.length}`);
      const [c1, c2] = vencidos.map((v) => v.id);
      // R6: la guia viva de A cambia; la lectura devuelve la congelada.
      await e.tx.orden.update({ where: { id: a.ordenId }, data: { numGuia: a.numGuia + 900_000_000 } });
      const repo = e.s.adminRepo;
      const ordenar = (xs: { ordenId: string; numGuia: number | null }[]) =>
        [...xs].sort((x, y) => x.ordenId.localeCompare(y.ordenId));
      return {
        a,
        b,
        c,
        deC1: ordenar(await repo.findBarridasDelCierre(c1, alcanceSat(e))),
        deC2: await repo.findBarridasDelCierre(c2, alcanceSat(e)),
        otraZona: await repo.findBarridasDelCierre(c1, {
          destinoTipo: "bodega_satelite",
          destinoZonaId: randomUUID(),
        }),
        central: await repo.findBarridasDelCierre(c1, { destinoTipo: "bodega_central", destinoZonaId: null }),
        inexistente: await repo.findBarridasDelCierre(randomUUID(), alcanceSat(e)),
      };
    });
  }

  /**
   * R23 — un `count` corto revierte TODO. Una barrida se borra del registro justo antes de que el
   * repositorio abra su transaccion (savepoint REAL): la liberacion mueve la que queda, la marca
   * casa 1 de 2 y lanza, y la `$transaction` deshace la liberacion, la aprobacion y el dinero.
   */
  function forzarCountCorto() {
    return conEscenario(mundo, async (e) => {
      const { cierreId, barridas } = await cierreDelCorte(e, { barridas: 2, entregadas: 1 });
      const [victima, superviviente] = barridas;
      const confirmacion = await e.confirmacionDe(cierreId, alcanceSat(e));
      const s = montarServicios(clienteConSavepoint(e.tx));
      const original = s.adminRepo.resolverCierre.bind(s.adminRepo);
      s.adminRepo.resolverCierre = async (input: ResolverCierreInput) => {
        await e.tx.cierreSinGestion.deleteMany({ where: { cierreId, ordenId: victima.ordenId } });
        return original(input);
      };
      let error: unknown = null;
      try {
        await s.cierresAdmin.aprobarCierre(cierreId, e.actorAdminSatelite, [], confirmacion);
      } catch (err) {
        error = err;
      }
      return {
        esFallaCerrada: error instanceof ConfirmacionFisicaNoAplicableError,
        estadoCierre: await estadoCierre(e, cierreId),
        estadoSuperviviente: await e.estadoDe(superviviente.ordenId),
        marcas: await marcasDe(e, cierreId),
        huella: await huellaDeDinero(e, cierreId),
      };
    });
  }

  /** R28 — rechazar un cierre con barridas no escribe marcas ni las libera. */
  function rechazarConBarridas() {
    return conEscenario(mundo, async (e) => {
      const { cierreId, barridas } = await cierreDelCorte(e, { barridas: 1 });
      const r = await e.rechazar(cierreId);
      return {
        status: r.status,
        estadoCierre: await estadoCierre(e, cierreId),
        marcas: await marcasDe(e, cierreId),
        estadoOrden: await e.estadoDe(barridas[0].ordenId),
      };
    });
  }

  beforeAll(async () => {
    mundo = await prepararMundo();
    sinConfirmar = await aprobarSinConfirmar();
    completo = await aprobarCompleto();
    sinBarridas = await aprobarSinBarridas();
    lecturas = await leerBarridas();
    cortos = await forzarCountCorto();
    rechazo = await rechazarConBarridas();
  }, 300_000);

  afterAll(async () => {
    await mundo?.prisma.$disconnect();
  });

  describe("B · el bloqueo (R10-R12, R15)", () => {
    it("T1.2/R10/R11: sin confirmar la barrida, el cierre sigue `solicitado` y la orden en `novedad_interna`", () => {
      expect(sinConfirmar.status).toBe("validation_error");
      expect(sinConfirmar.estadoCierre).toBe("solicitado");
      expect(sinConfirmar.estadoOrden).toBe("novedad_interna");
    });

    it("R12: el error va en la clave de ESA barrida (su ordenId)", () => {
      expect(Object.keys(sinConfirmar.fieldErrors ?? {})).toEqual([sinConfirmar.ordenId]);
    });

    it("R11: el rechazo no deja marca ni movimiento de dinero", () => {
      expect(Object.values(sinConfirmar.marcas)).toEqual([null]);
      expect(sinConfirmar.huella).toEqual([]);
    });

    it("R6/R15: confirmar con la guia VIVA (cambiada tras el corte) se rechaza; vale la CONGELADA", () => {
      expect(completo.rViva.status).toBe("validation_error");
      expect(completo.rViva.fieldErrors).toEqual({
        [completo.b1]: ["La guía leída no es la de este paquete."],
      });
      expect(completo.status).toBe("ok");
    });
  });

  describe("C · lo que se persiste (R22-R29)", () => {
    it("R28: re-solicitar el cierre (reabrirlo) no escribe ninguna marca", () => {
      expect(Object.values(completo.marcasTrasResolicitud)).toEqual([null, null]);
    });

    it("R22/R29: aprobar completo marca TODAS las barridas, y todas quedaron liberadas", () => {
      expect(completo.estadoCierre).toBe("aprobado");
      const marcas = Object.values(completo.marcas);
      expect(marcas).toHaveLength(2);
      for (const m of marcas) expect(m).toBeInstanceOf(Date);
      // Misma transaccion: el mismo instante para las dos.
      expect(new Set(marcas.map((m) => (m as Date).getTime())).size).toBe(1);
      for (const estado of Object.values(completo.estados)) {
        expect(estado).not.toBe("novedad_interna");
      }
    });

    it("R27: una segunda aprobacion es `conflict` y no reescribe la marca", () => {
      expect(completo.segunda).not.toBe("ok");
      expect(completo.marcasTrasSegunda).toEqual(completo.marcas);
    });

    it("R24: los datos CONGELADOS de las barridas no cambian al aprobar", () => {
      expect(completo.congeladosDespues).toEqual(completo.congeladosAntes);
      expect(completo.congeladosAntes).toHaveLength(2);
    });

    it("R23: un `count` corto revierte TODO — aprobacion, liberacion, marcas y dinero", () => {
      expect(cortos.esFallaCerrada).toBe(true);
      expect(cortos.estadoCierre).toBe("solicitado");
      expect(cortos.estadoSuperviviente).toBe("novedad_interna");
      expect(Object.values(cortos.marcas)).toEqual([null]);
      expect(cortos.huella).toEqual([]);
    });

    it("R28: rechazar un cierre con barridas no las marca ni las libera", () => {
      expect(rechazo.status).toBe("ok");
      expect(rechazo.estadoCierre).toBe("rechazado");
      expect(Object.values(rechazo.marcas)).toEqual([null]);
      expect(rechazo.estadoOrden).toBe("novedad_interna");
    });
  });

  describe("E · el dinero (R39)", () => {
    it("R39: con barridas confirmadas, el cierre mueve EXACTAMENTE el mismo dinero que sin barridas", () => {
      // Contrapunto: el cierre SI mueve dinero (la entrega), o la igualdad no diria nada.
      expect(completo.huella.length).toBeGreaterThan(0);
      expect(completo.huella).toEqual(sinBarridas.huella);
      expect(completo.totales).toEqual(sinBarridas.totales);
    });

    it("R9/R19: sin barridas, la lectura da `[]`, la confirmacion es la de siempre y aprueba", () => {
      expect(sinBarridas.barridasLeidas).toEqual([]);
      expect(sinBarridas.exacta).toEqual([]);
      expect(sinBarridas.status).toBe("ok");
    });
  });

  describe("A · la lectura del repositorio (R5-R8)", () => {
    it("R5/R8: devuelve TODAS las barridas de ESTE cierre y ninguna de otro", () => {
      expect(lecturas.deC1.map((b) => b.ordenId)).toEqual(
        [lecturas.a.ordenId, lecturas.b.ordenId].sort((x, y) => x.localeCompare(y)),
      );
      expect(lecturas.deC2.map((b) => b.ordenId)).toEqual([lecturas.c.ordenId]);
    });

    it("R6: la guia devuelta es la CONGELADA aunque la de la orden haya cambiado", () => {
      const deA = lecturas.deC1.find((b) => b.ordenId === lecturas.a.ordenId);
      expect(deA?.numGuia).toBe(lecturas.a.numGuia);
    });

    it("R7: fuera de alcance (otra satelite, o la central) o inexistente -> `[]`", () => {
      expect(lecturas.otraZona).toEqual([]);
      expect(lecturas.central).toEqual([]);
      expect(lecturas.inexistente).toEqual([]);
    });
  });
});
