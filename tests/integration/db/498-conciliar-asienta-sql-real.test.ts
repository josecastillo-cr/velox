import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Prisma, type PrismaClient } from "@prisma/client";

import { CierresBodegaAdminRepository } from "@/lib/repositories/CierresBodegaAdminRepository";
import { asentarCierreDia, dependenciasRealesDeAsiento } from "@/lib/repositories/asentar-cierre-dia";
import { WalletMovimientoRepository } from "@/lib/repositories/WalletMovimientoRepository";
import { CajaCodFeedService } from "@/lib/services/CajaCodFeedService";
import { WalletFeedService } from "@/lib/services/WalletFeedService";
import { WalletIndemnizacionFeedService } from "@/lib/services/WalletIndemnizacionFeedService";
import { WalletMensajeroFeedService } from "@/lib/services/WalletMensajeroFeedService";
import { WalletTiendaFeedService } from "@/lib/services/WalletTiendaFeedService";
import { derivarCaja } from "@/lib/utils/caja-tesoreria";
import { HAY_BASE_DE_DATOS, clienteConSavepoint } from "./_postgres-real";
import { conEscenario, prepararMundo, type Escenario, type Mundo } from "./454/_escenario";
import {
  cierreSateliteAprobado,
  consolidacionConDosCierres,
  consolidar,
  filasDeDiferencia,
  filasDeLosLibros,
} from "./498/_satelite";
import { DIR_M3, UP, correr, sembrarConsolidacion } from "./498/_migraciones";

/**
 * FICHA 498 (T1.3, T3.6, T3.6b, T3.7, T3.8, T5.2; R8-R22, R35, R36, R54) — MARCAR, CORREGIR Y
 * REVERTIR UNA CONSOLIDACION, contra Postgres real y por el repositorio real.
 *
 * T1.3 fue ROJO contra el codigo de antes de la ficha (la aprobacion asentaba y marcar no escribia).
 * Todo corre en transacciones que SIEMPRE se revierten. Sin base, la suite se SALTA (visible).
 */

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

const repoDe = (e: Escenario) => new CierresBodegaAdminRepository(e.cliente as unknown as PrismaClient);

async function marcar(e: Escenario, cbId: string, monto: string) {
  return repoDe(e).marcarConciliado({ id: cbId, montoRecibido: monto, nota: null, actorUsuarioId: e.maestroId });
}

async function corregir(e: Escenario, cbId: string, monto: string) {
  return repoDe(e).corregirConciliacion({ id: cbId, montoRecibido: monto, nota: null, actorUsuarioId: e.maestroId });
}

/** Conteo de los tres libros y de la tabla de ajustes. */
async function conteos(e: Escenario) {
  return {
    caja: await e.tx.walletMovimiento.count(),
    tienda: await e.tx.walletTiendaMovimiento.count(),
    mensajero: await e.tx.pagoMensajeroMovimiento.count(),
    ajustes: await e.tx.conciliacionBodegaAjuste.count(),
  };
}

/** La caja ENTERA derivada como la tarjeta, y el saldo de la tienda del escenario. */
async function cajaYTienda(e: Escenario) {
  const filas = await new WalletMovimientoRepository(e.cliente as unknown as PrismaClient).agregarPorCategoriaYTipo({});
  const caja = derivarCaja(filas);
  const [t] = (await e.tx.$queryRawUnsafe(
    `SELECT COALESCE(SUM(CASE WHEN tipo::text = 'credito' THEN monto ELSE -monto END), 0)::text AS saldo
       FROM wallet_tienda_movimiento WHERE tienda_id = $1`,
    e.tiendaId,
  )) as Array<{ saldo: string }>;
  return { caja, saldoTienda: t.saldo };
}

describeSiHayBase("498 — marcar recibida asienta y escribe la diferencia (Postgres real)", () => {
  let mundo: Mundo;
  let base: Awaited<ReturnType<typeof marcarConFaltante>>;
  let sobrante: Awaited<ReturnType<typeof marcarConSobrante>>;
  let exacto: Awaited<ReturnType<typeof marcarExacto>>;
  let fallo: Awaited<ReturnType<typeof marcarConFallo>>;
  let retirado: Awaited<ReturnType<typeof cierreRetiradoSeReasienta>>;
  let check: Awaited<ReturnType<typeof resolverCierreBodegaChocaConElCheck>>;
  let ceros: Awaited<ReturnType<typeof recibidoCero>>;
  let correcciones: Awaited<ReturnType<typeof corregirDosVeces>>;
  let saldada: Awaited<ReturnType<typeof corregirUnaSaldada>>;
  let revertir: Awaited<ReturnType<typeof revertirConYSinAsientos>>;

  /** T1.3 — faltante de 500; un tercer cierre aprobado DESPUES de consolidar no debe asentarse. */
  function marcarConFaltante() {
    return conEscenario(mundo, async (e) => {
      const { c1, c2, cbId, aporte } = await consolidacionConDosCierres(e);
      // Un cierre de la MISMA zona que NO pertenece a esta consolidacion.
      const fuera = await cierreSateliteAprobado(e, [{ monto: 1000 }]);
      const recibido = aporte.minus(500);

      const antes = await filasDeLosLibros(e, [c1, c2]);
      const cajaAntes = await cajaYTienda(e);
      const res = await marcar(e, cbId, recibido.toFixed(2));
      const despues = await filasDeLosLibros(e, [c1, c2]);
      const cajaDespues = await cajaYTienda(e);
      const conteoTrasMarcar = await conteos(e);
      const segunda = await marcar(e, cbId, "1.00");
      const conteoTrasSegunda = await conteos(e);
      const marca = await e.tx.cierreBodega.findUniqueOrThrow({
        where: { id: cbId },
        select: { conciliadoAt: true, montoRecibido: true },
      });

      // R5: asentar OTRA VEZ un cierre ya asentado no añade filas (idempotencia contra Postgres).
      await asentarCierreDia(e.tx, c1, dependenciasRealesDeAsiento(e.cliente as unknown as PrismaClient));
      const trasReasentar = await filasDeLosLibros(e, [c1, c2]);

      // R13: los cinco feeds NO ponen `fechaMovimiento`.
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
        segunda,
        c1,
        c2,
        aporte: aporte.toFixed(2),
        antes,
        despues,
        trasReasentar,
        deFuera: await filasDeLosLibros(e, [fuera]),
        diferencia: await filasDeDiferencia(e, cbId),
        marca: { conciliado: marca.conciliadoAt !== null, recibido: marca.montoRecibido?.toFixed(2) ?? null },
        conteoTrasMarcar,
        conteoTrasSegunda,
        cajaAntes,
        cajaDespues,
        feeds: feeds.length,
        feedsConFecha: feeds.filter((m) => (m as { fechaMovimiento?: unknown }).fechaMovimiento !== undefined).length,
      };
    });
  }

  /** R10 — sobrante de 300: un INGRESO de diferencia por el valor absoluto. */
  function marcarConSobrante() {
    return conEscenario(mundo, async (e) => {
      const { cbId, aporte } = await consolidacionConDosCierres(e);
      const cajaAntes = await cajaYTienda(e);
      const res = await marcar(e, cbId, aporte.plus(300).toFixed(2));
      return { res, diferencia: await filasDeDiferencia(e, cbId), cajaAntes, cajaDespues: await cajaYTienda(e) };
    });
  }

  /** R11 — recibido exacto: ninguna fila de ajuste ni de diferencia; los asientos si. */
  function marcarExacto() {
    return conEscenario(mundo, async (e) => {
      const { c1, c2, cbId, aporte } = await consolidacionConDosCierres(e);
      const cajaAntes = await cajaYTienda(e);
      const res = await marcar(e, cbId, aporte.toFixed(2));
      return {
        res,
        ajustes: await e.tx.conciliacionBodegaAjuste.count({ where: { cierreBodegaId: cbId } }),
        diferencia: await filasDeDiferencia(e, cbId),
        asientos: (await filasDeLosLibros(e, [c1, c2])).length,
        cajaAntes,
        cajaDespues: await cajaYTienda(e),
      };
    });
  }

  /** R14 — un feed que LANZA revierte la marca entera (savepoint REAL). */
  function marcarConFallo() {
    return conEscenario(mundo, async (e) => {
      const { c1, c2, cbId, aporte } = await consolidacionConDosCierres(e);
      const cliente = clienteConSavepoint(e.tx);
      const deps = dependenciasRealesDeAsiento(cliente);
      const repo = new CierresBodegaAdminRepository(cliente, {
        ...deps,
        walletMensajeroFeedService: {
          construirMovimientosDePago: async () => {
            throw new Error("feed caido a proposito (R14)");
          },
        },
      });
      const antes = await conteos(e);
      let error: unknown = null;
      try {
        await repo.marcarConciliado({ id: cbId, montoRecibido: aporte.minus(500).toFixed(2), nota: null, actorUsuarioId: e.maestroId });
      } catch (err) {
        error = err;
      }
      const fila = await e.tx.cierreBodega.findUniqueOrThrow({ where: { id: cbId }, select: { conciliadoAt: true } });
      return {
        lanzo: error instanceof Error && error.message.includes("feed caido"),
        conciliadoAt: fila.conciliadoAt,
        antes,
        despues: await conteos(e),
        filas: await filasDeLosLibros(e, [c1, c2]),
        historial: await e.tx.historialAccion.count({ where: { entidadId: cbId } }),
      };
    });
  }

  /** R54 — un cierre asentado con la regla vieja, retirado por M3, se vuelve a asentar al marcar. */
  function cierreRetiradoSeReasienta() {
    return conEscenario(mundo, async (e) => {
      const { c1, c2, cbId, aporte } = await consolidacionConDosCierres(e);
      const deps = dependenciasRealesDeAsiento(e.cliente as unknown as PrismaClient);
      // La aprobacion de ANTES de la ficha: los asientos ya estaban.
      await asentarCierreDia(e.tx, c1, deps);
      const conAsientosViejos = await filasDeLosLibros(e, [c1]);
      // M3, el `up` real (idempotente: la base local ya la tiene aplicada).
      await correr(e.tx, UP(DIR_M3));
      const trasM3 = await filasDeLosLibros(e, [c1]);
      await marcar(e, cbId, aporte.toFixed(2));
      const trasMarcar = await filasDeLosLibros(e, [c1]);
      return {
        conAsientosViejos: conAsientosViejos.map((f) => f.replace(/\|[^|]*$/, "")),
        trasM3,
        trasMarcar: trasMarcar.map((f) => f.replace(/\|[^|]*$/, "")),
        c2Asentado: (await filasDeLosLibros(e, [c2])).length,
      };
    });
  }

  /** §2 — `resolverCierreBodega('aprobado')` choca con el CHECK de la 431 y no deja filas. */
  function resolverCierreBodegaChocaConElCheck() {
    return conEscenario(mundo, async (e) => {
      const { c1, c2, cbId } = await consolidacionConDosCierres(e);
      const repo = new CierresBodegaAdminRepository(clienteConSavepoint(e.tx));
      let error: unknown = null;
      try {
        await repo.resolverCierreBodega({ id: cbId, nuevoEstado: "aprobado", resueltoPor: e.maestroId, motivoRechazo: null });
      } catch (err) {
        error = err;
      }
      return {
        error: String((error as Error)?.message ?? error),
        filas: await filasDeLosLibros(e, [c1, c2]),
      };
    });
  }

  /** R15a/R15b — recibido 0, al marcar y al corregir. */
  function recibidoCero() {
    return conEscenario(mundo, async (e) => {
      const usuarioId = e.maestroId;
      const zonaId = e.zonaSateliteId;
      // Aporte POSITIVO (dos cierres reales).
      const { c1, c2, cbId } = await consolidacionConDosCierres(e);
      const conteoAntes = await conteos(e);
      const positivo = await marcar(e, cbId, "0");
      const filaPositivo = await e.tx.cierreBodega.findUniqueOrThrow({ where: { id: cbId }, select: { conciliadoAt: true } });
      const historialPositivo = await e.tx.historialAccion.count({ where: { entidadId: cbId } });
      const conteoTrasPositivo = await conteos(e);
      const filasPositivo = await filasDeLosLibros(e, [c1, c2]);
      // Aporte CERO: general = pago.
      const cbCero = await sembrarConsolidacion(e.tx, { zonaId, usuarioId, general: "500", pago: "500" });
      const cero = await marcar(e, cbCero, "0.00");
      // Aporte NEGATIVO: general 100, pago 200 → aporte −100.
      const cbNeg = await sembrarConsolidacion(e.tx, { zonaId, usuarioId, general: "100", pago: "200" });
      const negativo = await marcar(e, cbNeg, "0");
      // Corregir a 0 una conciliada con aporte positivo: la misma regla.
      const cbPos2 = await sembrarConsolidacion(e.tx, { zonaId, usuarioId, general: "800", pago: "100" });
      await marcar(e, cbPos2, "700.00");
      const corregirPositivo = await corregir(e, cbPos2, "0");
      const recibidoPos2 = (await e.tx.cierreBodega.findUniqueOrThrow({ where: { id: cbPos2 }, select: { montoRecibido: true } })).montoRecibido?.toFixed(2);
      // Corregir a 0 una conciliada con aporte cero: aceptado, sin diferencia.
      const cbCero2 = await sembrarConsolidacion(e.tx, { zonaId, usuarioId, general: "300", pago: "300" });
      await marcar(e, cbCero2, "50.00"); // llego de mas: ingreso 50
      const corregirCero = await corregir(e, cbCero2, "0"); // vuelve a lo esperado: egreso 50
      return {
        positivo,
        conciliadoPositivo: filaPositivo.conciliadoAt !== null,
        historialPositivo,
        conteoIgual: JSON.stringify(conteoTrasPositivo) === JSON.stringify(conteoAntes),
        filasPositivo,
        cero,
        diferenciaCero: await filasDeDiferencia(e, cbCero),
        negativo,
        diferenciaNegativo: await filasDeDiferencia(e, cbNeg),
        corregirPositivo,
        recibidoPos2,
        corregirCero,
        diferenciaCero2: await filasDeDiferencia(e, cbCero2),
      };
    });
  }

  /** R17-R19 — marcar con faltante y corregir dos veces (la segunda, al mismo monto). */
  function corregirDosVeces() {
    return conEscenario(mundo, async (e) => {
      const { c1, c2, cbId, aporte } = await consolidacionConDosCierres(e);
      await marcar(e, cbId, aporte.minus(500).toFixed(2));
      const filasMarca = await e.tx.$queryRawUnsafe(
        `SELECT to_jsonb(w)::text AS f FROM wallet_movimiento w
          WHERE w.origen_id IN (SELECT id FROM conciliacion_bodega_ajuste WHERE cierre_bodega_id = $1)
          UNION ALL SELECT to_jsonb(a)::text FROM conciliacion_bodega_ajuste a WHERE a.cierre_bodega_id = $1
          ORDER BY 1`,
        cbId,
      );
      const asientos = await filasDeLosLibros(e, [c1, c2]);
      const r1 = await corregir(e, cbId, aporte.minus(200).toFixed(2)); // −300 → ingreso 300
      const r2 = await corregir(e, cbId, aporte.minus(200).toFixed(2)); // mismo monto → nada
      const r3 = await corregir(e, cbId, aporte.minus(250).toFixed(2)); // +50 → egreso 50
      const filasMarcaDespues = await e.tx.$queryRawUnsafe(
        `SELECT to_jsonb(w)::text AS f FROM wallet_movimiento w
          WHERE w.origen_id IN (SELECT id FROM conciliacion_bodega_ajuste WHERE cierre_bodega_id = $1 AND evento = 'marca')
          UNION ALL SELECT to_jsonb(a)::text FROM conciliacion_bodega_ajuste a WHERE a.cierre_bodega_id = $1 AND a.evento = 'marca'
          ORDER BY 1`,
        cbId,
      );
      return {
        r: [r1, r2, r3],
        aporte: aporte.toFixed(2),
        diferencia: await filasDeDiferencia(e, cbId),
        filasMarca,
        filasMarcaDespues,
        asientosIguales: JSON.stringify(await filasDeLosLibros(e, [c1, c2])) === JSON.stringify(asientos),
      };
    });
  }

  /** R17 — corregir una SALDADA CON LA REGLA ANTERIOR de X a X − 10: una diferencia de 10, no el hueco. */
  function corregirUnaSaldada() {
    return conEscenario(mundo, async (e) => {
      // Marcada «con la regla vieja» contra el efectivo: general 10 000, efectivo 6 000, recibido 6 000.
      const cbId = await sembrarConsolidacion(e.tx, {
        zonaId: e.zonaSateliteId,
        usuarioId: e.maestroId,
        general: "10000",
        efectivo: "6000",
        pago: "1500",
        recibido: "6000",
      });
      // Lo que hace M4 sobre ella (la regularizacion), aqui sin la migracion: esperado = recibido.
      await e.tx.$executeRawUnsafe(`UPDATE cierre_bodega SET esperado_regla_anterior = monto_recibido WHERE id = $1`, cbId);
      const r = await corregir(e, cbId, "5990.00");
      return { r, diferencia: await filasDeDiferencia(e, cbId) };
    });
  }

  /** R20/R22 — revertir con asientos → `con_asientos` sin cambiar nada; sin asientos, como antes. */
  function revertirConYSinAsientos() {
    return conEscenario(mundo, async (e) => {
      const { cbId, aporte } = await consolidacionConDosCierres(e);
      await marcar(e, cbId, aporte.toFixed(2)); // sin diferencia: los asientos de los cierres bastan
      const foto = async () => ({
        fila: JSON.stringify(
          await e.tx.cierreBodega.findUniqueOrThrow({
            where: { id: cbId },
            select: { estado: true, conciliadoAt: true, montoRecibido: true, resueltoAt: true, updatedAt: true },
          }),
        ),
        historial: await e.tx.historialAccion.count({ where: { entidadId: cbId } }),
        libros: JSON.stringify(await conteos(e)),
      });
      const antes = await foto();
      const conAsientos = await repoDe(e).revertirConciliacion({ id: cbId, actorUsuarioId: e.maestroId });
      const despues = await foto();
      // Una consolidacion SIN dinero (sin cierres, recibido = aporte): se revierte como antes de la ficha.
      const cbSin = await sembrarConsolidacion(e.tx, { zonaId: e.zonaSateliteId, usuarioId: e.maestroId, general: "0" });
      await marcar(e, cbSin, "0.00");
      const sinAsientos = await repoDe(e).revertirConciliacion({ id: cbSin, actorUsuarioId: e.maestroId });
      const filaSin = await e.tx.cierreBodega.findUniqueOrThrow({ where: { id: cbSin }, select: { estado: true, conciliadoAt: true } });
      // Revision m2: una SALDADA con la regla anterior y SIN asientos (sin cierres): antes daba 23514 (CHECK
      // de M4) → error interno. Ahora es un desenlace de dominio y no cambia nada.
      const cbSaldada = await sembrarConsolidacion(e.tx, {
        zonaId: e.zonaSateliteId,
        usuarioId: e.maestroId,
        general: "300",
        recibido: "300",
      });
      await e.tx.$executeRawUnsafe(`UPDATE cierre_bodega SET esperado_regla_anterior = monto_recibido WHERE id = $1`, cbSaldada);
      const fotoSaldada = async () =>
        JSON.stringify(
          await e.tx.cierreBodega.findUniqueOrThrow({
            where: { id: cbSaldada },
            select: { estado: true, conciliadoAt: true, montoRecibido: true, esperadoReglaAnterior: true },
          }),
        );
      const saldadaAntes = await fotoSaldada();
      const saldada = await repoDe(e).revertirConciliacion({ id: cbSaldada, actorUsuarioId: e.maestroId });
      return {
        conAsientos,
        antes,
        despues,
        sinAsientos,
        filaSin,
        saldada,
        saldadaIgual: (await fotoSaldada()) === saldadaAntes,
        historialSaldada: await e.tx.historialAccion.count({ where: { entidadId: cbSaldada } }),
      };
    });
  }

  beforeAll(async () => {
    mundo = await prepararMundo();
    base = await marcarConFaltante();
    sobrante = await marcarConSobrante();
    exacto = await marcarExacto();
    fallo = await marcarConFallo();
    retirado = await cierreRetiradoSeReasienta();
    check = await resolverCierreBodegaChocaConElCheck();
    ceros = await recibidoCero();
    correcciones = await corregirDosVeces();
    saldada = await corregirUnaSaldada();
    revertir = await revertirConYSinAsientos();
  }, 600_000);

  afterAll(async () => {
    await mundo?.prisma.$disconnect();
  });

  describe("marcar (R8-R15)", () => {
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
          expect(suyas.some((f) => f.startsWith(tabla)), `${tabla} de ${c}`).toBe(true);
        }
      }
    });

    it("R8: solo se asientan los cierres DE ESTA consolidacion (uno aprobado despues queda sin filas)", () => {
      expect(base.deFuera).toEqual([]);
    });

    it("⭑ T1.3 / R9 / R10 / R12: UNA sola fila de caja `egreso_diferencia_satelite` por el faltante", () => {
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

    it("R10: llego de MAS → UN ingreso `ingreso_diferencia_satelite` por el valor absoluto", () => {
      expect(sobrante.res).toBe("updated");
      expect(sobrante.diferencia.map((d) => [d.tipo, d.categoria, d.monto, d.diferencia])).toEqual([
        ["ingreso", "ingreso_diferencia_satelite", "300.00", "-300.00"],
      ]);
    });

    it("R11: recibido = esperado → ni fila de ajuste ni movimiento de diferencia (y los asientos si)", () => {
      expect(exacto.res).toBe("updated");
      expect(exacto.ajustes).toBe(0);
      expect(exacto.diferencia).toEqual([]);
      expect(exacto.asientos).toBeGreaterThan(0);
    });

    it("R13: ninguno de los cinco feeds pone `fechaMovimiento` (la fecha la pone la transaccion de la marca)", () => {
      expect(base.feedsConFecha).toBe(0);
    });

    it("⭑ R14: un feed que falla revierte la marca entera — sin conciliar, sin filas nuevas, sin historial", () => {
      expect(fallo.lanzo).toBe(true);
      expect(fallo.conciliadoAt).toBeNull();
      expect(fallo.despues).toEqual(fallo.antes);
      expect(fallo.filas).toEqual([]);
      expect(fallo.historial).toBe(0);
    });

    it("R15: marcar otra vez → `conflict` sin escribir ninguna fila", () => {
      expect(base.segunda).toBe("conflict");
      expect(base.conteoTrasSegunda).toEqual(base.conteoTrasMarcar);
      expect(base.marca.recibido).toBe(new Prisma.Decimal(base.aporte).minus(500).toFixed(2));
    });

    it("R5: asentar otra vez un cierre ya asentado no añade filas (idempotente contra Postgres)", () => {
      expect(base.trasReasentar).toEqual(base.despues);
    });

    it("⭑ R54: un cierre retirado por M3 se vuelve a asentar al marcar, con las MISMAS filas", () => {
      expect(retirado.conAsientosViejos.length).toBeGreaterThan(0);
      expect(retirado.trasM3).toEqual([]);
      expect(retirado.trasMarcar).toEqual(retirado.conAsientosViejos);
      expect(retirado.c2Asentado).toBeGreaterThan(0);
    });

    it("§2 / R8: `resolverCierreBodega('aprobado')` choca con el CHECK de la 431 y no deja filas en los libros", () => {
      expect(check.error).toMatch(/cierre_bodega_conciliacion_coherente/);
      expect(check.filas).toEqual([]);
    });
  });

  describe("recibido 0 (Q5: R15a, R15b)", () => {
    it("⭑ R15a: con aporte POSITIVO → `recibido_cero_con_aporte`, sin conciliar, sin historial, sin filas", () => {
      expect(ceros.positivo).toBe("recibido_cero_con_aporte");
      expect(ceros.conciliadoPositivo).toBe(false);
      expect(ceros.historialPositivo).toBe(0);
      expect(ceros.conteoIgual).toBe(true);
      expect(ceros.filasPositivo).toEqual([]);
    });

    it("R15b: con aporte CERO → marcada y sin fila de diferencia", () => {
      expect(ceros.cero).toBe("updated");
      expect(ceros.diferenciaCero).toEqual([]);
    });

    it("R15b: con aporte NEGATIVO → marcada y UN ingreso de diferencia por el valor absoluto", () => {
      expect(ceros.negativo).toBe("updated");
      expect(ceros.diferenciaNegativo.map((d) => [d.tipo, d.categoria, d.monto])).toEqual([
        ["ingreso", "ingreso_diferencia_satelite", "100.00"],
      ]);
    });

    it("R15a: corregir a 0 una consolidacion con aporte positivo → `recibido_cero_con_aporte` y el monto no cambia", () => {
      expect(ceros.corregirPositivo).toBe("recibido_cero_con_aporte");
      expect(ceros.recibidoPos2).toBe("700.00");
    });

    it("R15b: corregir a 0 una consolidacion con aporte cero → aceptado; la diferencia vuelve a cero", () => {
      expect(ceros.corregirCero).toBe("updated");
      expect(ceros.diferenciaCero2.map((d) => [d.evento, d.tipo, d.monto])).toEqual([
        ["marca", "ingreso", "50.00"],
        ["correccion", "egreso", "50.00"],
      ]);
    });
  });

  describe("corregir (R17-R19)", () => {
    it("⭑ R17/R18: dos correcciones con variacion escriben SOLO la variacion; la del mismo monto, nada", () => {
      expect(correcciones.r).toEqual(["updated", "updated", "updated"]);
      expect(correcciones.diferencia.map((d) => [d.evento, d.tipo, d.monto, d.diferencia])).toEqual([
        ["marca", "egreso", "500.00", "500.00"],
        ["correccion", "ingreso", "300.00", "-300.00"],
        ["correccion", "egreso", "50.00", "50.00"],
      ]);
    });

    it("R19: ninguna fila anterior cambia (comparacion byte a byte de la marca) y no hay asientos nuevos", () => {
      // Antes de corregir solo existian las dos filas de la marca (ajuste + movimiento).
      expect((correcciones.filasMarca as unknown[]).length).toBe(2);
      expect(correcciones.filasMarcaDespues).toEqual(correcciones.filasMarca);
      expect(correcciones.asientosIguales).toBe(true);
    });

    it("⭑ R17 (Q4): corregir una SALDADA de 6 000 a 5 990 escribe UNA diferencia de 10 (no el hueco del SINPE)", () => {
      expect(saldada.r).toBe("updated");
      expect(saldada.diferencia.map((d) => [d.evento, d.tipo, d.monto, d.monto_esperado])).toEqual([
        ["correccion", "egreso", "10.00", "6000.00"],
      ]);
    });
  });

  describe("revertir (R20, R22)", () => {
    it("⭑ R20: con asientos → `con_asientos` y NADA cambia (ni la fila, ni el historial, ni los libros)", () => {
      expect(revertir.conAsientos).toBe("con_asientos");
      expect(revertir.despues).toEqual(revertir.antes);
    });

    it("⭑ revision m2: revertir una SALDADA con la regla anterior sin asientos → `saldada_regla_anterior`, sin cambios", () => {
      expect(revertir.saldada).toBe("saldada_regla_anterior");
      expect(revertir.saldadaIgual).toBe(true);
      expect(revertir.historialSaldada).toBe(0);
    });

    it("R22: una conciliada SIN asientos se revierte como antes de la ficha", () => {
      expect(revertir.sinAsientos).toBe("updated");
      expect(revertir.filaSin).toEqual({ estado: "solicitado", conciliadoAt: null });
    });
  });

  describe("la caja (T5.2: R35, R36)", () => {
    const casos = () => [
      ["faltante", base.cajaAntes, base.cajaDespues],
      ["sobrante", sobrante.cajaAntes, sobrante.cajaDespues],
      ["sin diferencia", exacto.cajaAntes, exacto.cajaDespues],
    ] as const;

    it("⭑ R36: Δ«De las tiendas» de la caja = Δ saldo de la tienda, con diferencia positiva, negativa y cero", () => {
      for (const [nombre, antes, despues] of casos()) {
        const deltaCaja = new Prisma.Decimal(despues.caja.deTerceros).minus(antes.caja.deTerceros);
        const deltaTienda = new Prisma.Decimal(despues.saldoTienda).minus(antes.saldoTienda);
        expect(deltaCaja.toFixed(2), nombre).toBe(deltaTienda.toFixed(2));
        // Anti-vacuidad: la marca SI movio el saldo de la tienda (el COD entro al conciliar).
        expect(deltaTienda.isZero(), nombre).toBe(false);
      }
    });

    it("⭑ R35: Entro − Salio = ganancia + IVA por pagar + capital + De las tiendas − Por cobrar, sobre la caja REAL", () => {
      for (const [nombre, , despues] of casos()) {
        const c = despues.caja;
        const lado = new Prisma.Decimal(c.ganancia)
          .plus(c.ivaPorPagar)
          .plus(c.capital)
          .plus(c.deTerceros)
          .minus(c.porCobrarSatelites);
        expect(lado.toFixed(2), nombre).toBe(c.enCaja);
      }
    });

    it("R33: el bolsillo «Por cobrar a satelites» sube 500 con el faltante y baja 300 con el sobrante", () => {
      const delta = (a: { caja: { porCobrarSatelites: string } }, d: { caja: { porCobrarSatelites: string } }) =>
        new Prisma.Decimal(d.caja.porCobrarSatelites).minus(a.caja.porCobrarSatelites).toFixed(2);
      expect(delta(base.cajaAntes, base.cajaDespues)).toBe("500.00");
      expect(delta(sobrante.cajaAntes, sobrante.cajaDespues)).toBe("-300.00");
      expect(delta(exacto.cajaAntes, exacto.cajaDespues)).toBe("0.00");
    });
  });
});
