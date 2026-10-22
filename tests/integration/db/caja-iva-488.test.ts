import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";

import { consultarMetricaFinanciera } from "@/lib/actions/analitica-financiera";
import { previsualizarMovimientoAction } from "@/lib/actions/efecto-movimiento";
import { verResumenCajaAction } from "@/lib/actions/wallet";
import { anularEgresoCajaAction, anularMovimientoAction } from "@/lib/actions/wallet-anulacion";
import { registrarEgresoAdministrativoAction } from "@/lib/actions/wallet-egresos";
import type { Actor } from "@/lib/interfaces/services/IOrdenService";
import { AporteCapitalRepository } from "@/lib/repositories/AporteCapitalRepository";
import { ConciliacionCierresAnaliticaRepository } from "@/lib/repositories/ConciliacionCierresAnaliticaRepository";
import { CuentasPorPagarAnaliticaRepository } from "@/lib/repositories/CuentasPorPagarAnaliticaRepository";
import { FinanzasDiarioRepository } from "@/lib/repositories/FinanzasDiarioRepository";
import { IngresosAnaliticaRepository } from "@/lib/repositories/IngresosAnaliticaRepository";
import { PagoMensajeroMovimientoRepository } from "@/lib/repositories/PagoMensajeroMovimientoRepository";
import { RecaudoAnaliticaRepository } from "@/lib/repositories/RecaudoAnaliticaRepository";
import { UserRepository } from "@/lib/repositories/UserRepository";
import { WalletAnulacionDestinoRepository } from "@/lib/repositories/WalletAnulacionDestinoRepository";
import { WalletMovimientoRepository } from "@/lib/repositories/WalletMovimientoRepository";
import { WalletTiendaMovimientoRepository } from "@/lib/repositories/WalletTiendaMovimientoRepository";
import { AnaliticaFinancieraService } from "@/lib/services/AnaliticaFinancieraService";
import { PrevisualizarMovimientoService } from "@/lib/services/PrevisualizarMovimientoService";
import { WalletAnulacionService } from "@/lib/services/WalletAnulacionService";
import type { ImporteAnalitico } from "@/lib/types/analitica-financiera";
import type { EfectoMovimientoDTO } from "@/lib/types/efecto-movimiento";
import type { CajaResumenDTO, ComposicionGananciaDTO, WalletMovimientoDTO } from "@/lib/types/wallet";
import { derivarFinanzasDiarias } from "@/lib/utils/finanzas-diarias";

import { HAY_BASE_DE_DATOS, crearPrismaDeTest, type TxDeTest } from "./_postgres-real";
import {
  cargarCatalogo459,
  enTransaccionRevertida459,
  menos,
  montarServicios459,
  sembrarEscenario459,
} from "./_fixtures/caja-459";

// ═════════════════════════════════════════════════════════════════════════════════════════════
// FICHA 488 — LA GANANCIA DE LA CAJA, SIN IVA (Postgres real, por las Server Actions reales).
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// El escenario de la fase 0 de la 459 (servicios reales: cierre con los tres IVA, cobro por
// devolucion a origen, pagos a tienda, egresos, ajustes, gasto fijo y premio) MAS un aporte de
// capital, y la anulacion del cobro por devolucion a origen (que deja el reverso del IVA de la
// 458-B). La base local es compartida: todo se mide POR DIFERENCIA dentro de UNA transaccion
// REPEATABLE READ que se revierte, igual que la fotografia de la 459.
//
// B.0 — CARACTERIZACION PREVIA (R8). Se escribio y se puso en verde sobre `dev` (4f87ca86) SIN
// tocar codigo. Sus literales son lo que la ficha 488 promete NO mover: la cifra principal,
// «Entro», «Salio», «De las tiendas» y el capital. No se tocan en el resto de la ficha.
//
// B.10 — el resto, todo por las Server Actions reales cableadas sobre la tx (los mismos servicios
// que su `buildService()`): `verResumenCajaAction`, `registrarEgresoAdministrativoAction`,
// `anularMovimientoAction` → `anularEgresoCajaAction`, `previsualizarMovimientoAction` y
// `consultarMetricaFinanciera`. Los WHERE (el estado «anulado» del libro, los filtros, la metrica) se
// miden aqui, donde viven, y no con dobles (memoria «probar el WHERE donde vive»).

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

const APORTE = "20000.00";
const PAGO_IVA = "700.00";
/** Un dia lejano y vacio para el filtro de periodo (R9): sus filas las siembra el test, a mano. */
const DIA = "2020-01-15";
const DIA_FUERA = "2020-01-20";
const PERIODO = { desde: DIA, hasta: DIA };

type Resumen = CajaResumenDTO;
type Lectura = { resumen: Resumen; composicion: ComposicionGananciaDTO };

interface Medida {
  antes: Resumen;
  base: Resumen;
  // §1/§3
  antesLectura: Lectura;
  baseLectura: Lectura;
  trasAporte: Resumen;
  // §2 — filtros
  antesPeriodo: Lectura;
  periodo: Lectura;
  antesIvaFlete: Resumen;
  ivaFlete: Resumen;
  antesFlete: Resumen;
  flete: Resumen;
  antesAQuien: Resumen;
  aQuien: Resumen;
  // §4 — el Pago de IVA
  antesPago: Resumen;
  trasPago: Resumen;
  respuestasPago: Record<string, string>;
  filaPago: string;
  filasConClave: number;
  filasConClaveAjena: number;
  librosAjenos: { tiendaAntes: number; tiendaDespues: number; mensajeroAntes: number; mensajeroDespues: number; conOrigenDelPago: number };
  // §5 — su anulacion
  respuestasAnulacion: Record<string, unknown>;
  reversosTrasForbidden: number;
  trasAnular: Resumen;
  reverso: string[];
  documentoPago: WalletMovimientoDTO["documento"];
  // §6 — «Así queda»
  asiQueda: EfectoMovimientoDTO;
  // §7 — la analitica
  gananciaMetrica: ImporteAnalitico;
  egresosMetricaAntes: ImporteAnalitico;
  egresosMetricaDespues: ImporteAnalitico;
  // §8 — finanzas diarias
  diaAntes: { ganancia: string; egresos: string; ingresos: string };
  diaDespues: { ganancia: string; egresos: string; ingresos: string };
}

describeSiHayBase("⭑ 488 — la ganancia de la caja sin IVA (Postgres real)", () => {
  let prisma: PrismaClient;
  let medida: Medida | undefined;
  let fallo: unknown;

  /** La medida, o el error de la siembra: cada caso cae en ROJO con su nombre (nunca «skipped»). */
  function m(): Medida {
    if (fallo !== undefined) throw fallo;
    if (medida === undefined) throw new Error("la medida no llego a tomarse");
    return medida;
  }

  beforeAll(async () => {
    prisma = crearPrismaDeTest();
    const cat = await cargarCatalogo459(prisma);
    try {
      medida = await enTransaccionRevertida459(prisma, async (tx) => medir(tx, cat));
    } catch (error) {
      fallo = error;
    }
  }, 300_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  async function medir(tx: TxDeTest, cat: Awaited<ReturnType<typeof cargarCatalogo459>>): Promise<Medida> {
    const s = montarServicios459(tx);
    const c = s.cliente;
    const lector: Actor = { usuarioId: "00000000-0000-4000-8000-000000000488", rol: "maestro" };
    const HACIENDA = `Hacienda 488 ${randomUUID().slice(0, 8)}`;

    const leer = async (actor: Actor, filtros: Record<string, unknown> = {}): Promise<Lectura> => {
      const r = await verResumenCajaAction(
        { page: 1, pageSize: 10, ...filtros },
        { getActor: async () => actor, service: s.wallet },
      );
      if (r.status !== "ok") throw new Error(`verResumenCajaAction respondio ${JSON.stringify(r)}`);
      return { resumen: r.resumen, composicion: r.composicion };
    };
    const resumen = async (actor: Actor, filtros: Record<string, unknown> = {}) => (await leer(actor, filtros)).resumen;

    const analitica = new AnaliticaFinancieraService(
      new IngresosAnaliticaRepository(c),
      new RecaudoAnaliticaRepository(c),
      new CuentasPorPagarAnaliticaRepository(c),
      new ConciliacionCierresAnaliticaRepository(c),
      { logError: () => {} },
    );
    const metrica = async (id: string, actor: Actor): Promise<ImporteAnalitico> => {
      const r = await consultarMetricaFinanciera(
        id,
        { rango: "personalizado", desde: DIA, hasta: DIA },
        { service: analitica, getActor: async () => actor, logger: { logError: () => {} } },
      );
      if (r.status !== "ok" || r.datos.tipo !== "vistas") throw new Error(`${id}: ${JSON.stringify(r)}`);
      return r.datos.vistas[0].total;
    };
    const finanzas = new FinanzasDiarioRepository(c);
    const delDia = async () => {
      const filas = await finanzas.sumarPorDia(new Date(`${DIA}T06:00:00.000Z`), new Date("2020-01-16T06:00:00.000Z"));
      const dia = derivarFinanzasDiarias(filas).find((d) => d.fecha === DIA);
      return { ganancia: dia?.ganancia ?? "0.00", egresos: dia?.egresos ?? "0.00", ingresos: dia?.ingresos ?? "0.00" };
    };

    // ── Lo de antes, con cada filtro que se va a medir ─────────────────────────────────────────
    const antesLectura = await leer(lector);
    const antes = antesLectura.resumen;
    const antesPeriodo = await leer(lector, PERIODO);
    const antesIvaFlete = await resumen(lector, { categoria: "ingreso_iva_flete" });
    const antesFlete = await resumen(lector, { categoria: "ingreso_flete" });
    const antesAQuien = await resumen(lector, { aQuien: { nombre: HACIENDA } });
    const egresosMetricaAntes = await metrica("egresos", lector);
    const diaAntes = await delDia();

    // ── El escenario (B.0) ─────────────────────────────────────────────────────────────────────
    const esc = await sembrarEscenario459(tx, cat);
    const actor = esc.maestro;
    const tienda: Actor = { usuarioId: esc.tiendaA, rol: "adminTienda" };
    const aporte = await s.aporteCapital.registrar(
      { claveIdempotencia: randomUUID(), clase: "aporte", monto: APORTE, fecha: "2026-09-01", motivo: "Aporte 488" },
      null,
      actor,
    );
    if (aporte.status !== "ok") throw new Error(`aporte: ${JSON.stringify(aporte)}`);
    const trasAporte = await resumen(actor);
    const cobro = await tx.rechazoTiendaCobro.findFirstOrThrow({
      where: { tiendaId: esc.tiendaA, estado: "aprobado" },
      select: { id: true },
    });
    const anulado = await s.rechazoCobro.anular({ cobroId: cobro.id, motivo: "Fotografia 488" }, actor, new Date());
    if (anulado.status !== "ok") throw new Error(`anular rechazo: ${JSON.stringify(anulado)}`);
    const baseLectura = await leer(actor);
    const base = baseLectura.resumen;

    // ── §2: filtros por concepto (sobre el escenario) ──────────────────────────────────────────
    const ivaFlete = await resumen(actor, { categoria: "ingreso_iva_flete" });
    const flete = await resumen(actor, { categoria: "ingreso_flete" });

    // ── §6: «Así queda» del Pago de IVA, ANTES de registrarlo ──────────────────────────────────
    const previsualizar = new PrevisualizarMovimientoService(
      new WalletMovimientoRepository(c),
      new AporteCapitalRepository(c),
      new WalletTiendaMovimientoRepository(c),
      new UserRepository(c),
      new PagoMensajeroMovimientoRepository(c),
    );
    const prev = await previsualizarMovimientoAction(
      { concepto: "pago_iva", monto: PAGO_IVA },
      { getActor: async () => actor, service: previsualizar },
    );
    if (prev.status !== "ok") throw new Error(`previsualizar: ${JSON.stringify(prev)}`);

    // ── §4: registrar el Pago de IVA ───────────────────────────────────────────────────────────
    const antesPago = await resumen(actor);
    const tiendaAntes = await tx.walletTiendaMovimiento.count();
    const mensajeroAntes = await tx.pagoMensajeroMovimiento.count();
    const clave = randomUUID();
    const entrada = {
      tipoEgreso: "pago_iva",
      monto: PAGO_IVA,
      descripcion: "IVA de septiembre declarado a Hacienda",
      claveIdempotencia: clave,
      contraparteNombre: HACIENDA,
    };
    const deps = (a: Actor) => ({ getActor: async () => a, service: s.egresos });
    const respuestasPago: Record<string, string> = {};
    respuestasPago.primero = (await registrarEgresoAdministrativoAction(entrada, deps(actor))).status;
    respuestasPago.mismaClave = (await registrarEgresoAdministrativoAction(entrada, deps(actor))).status;
    const claveAjena = randomUUID();
    respuestasPago.sinAccesoTotal = (
      await registrarEgresoAdministrativoAction({ ...entrada, claveIdempotencia: claveAjena }, deps(tienda))
    ).status;
    const trasPago = await resumen(actor);
    const aQuien = await resumen(actor, { aQuien: { nombre: HACIENDA } });
    const pago = await tx.walletMovimiento.findFirstOrThrow({ where: { claveIdempotencia: clave } });
    const filaPago = `${pago.tipo}|${pago.categoria}|${pago.monto.toFixed(2)}|${pago.origenTipo}|${pago.origenId}`;
    const filasConClave = await tx.walletMovimiento.count({ where: { claveIdempotencia: clave } });
    const filasConClaveAjena = await tx.walletMovimiento.count({ where: { claveIdempotencia: claveAjena } });
    const librosAjenos = {
      tiendaAntes,
      tiendaDespues: await tx.walletTiendaMovimiento.count(),
      mensajeroAntes,
      mensajeroDespues: await tx.pagoMensajeroMovimiento.count(),
      conOrigenDelPago:
        (await tx.walletTiendaMovimiento.count({ where: { origenId: pago.id } })) +
        (await tx.pagoMensajeroMovimiento.count({ where: { origenId: pago.id } })),
    };

    // ── §5: anularlo con motivo ────────────────────────────────────────────────────────────────
    const respuestasAnulacion: Record<string, unknown> = {};
    respuestasAnulacion.sinAccesoTotal = await anularEgresoCajaAction(
      { movimientoId: pago.id, motivo: "No me corresponde" },
      { getActor: async () => tienda, egresos: s.egresoAnulacion },
    );
    const reversosTrasForbidden = await tx.walletMovimiento.count({ where: { origenTipo: "gasto", origenId: pago.id } });
    const depsAnulacion = {
      getActor: async () => actor,
      router: new WalletAnulacionService(new WalletAnulacionDestinoRepository(c)),
      caminos: {
        egreso_caja: (movimientoId: string, motivo: string, a: Actor) =>
          anularEgresoCajaAction({ movimientoId, motivo }, { getActor: async () => a, egresos: s.egresoAnulacion }),
      },
    };
    respuestasAnulacion.primera = await anularMovimientoAction(
      { destino: { libro: "caja", movimientoId: pago.id }, motivo: "Se pagó dos veces" },
      depsAnulacion,
    );
    const trasAnular = await resumen(actor);
    const reverso = (await tx.walletMovimiento.findMany({ where: { origenTipo: "gasto", origenId: pago.id } })).map(
      (f) => `${f.tipo}|${f.categoria}|${f.monto.toFixed(2)}`,
    );
    respuestasAnulacion.otraVez = await anularMovimientoAction(
      { destino: { libro: "caja", movimientoId: pago.id }, motivo: "otra vez" },
      depsAnulacion,
    );
    // R25: el libro lo dice «anulado» aunque su contra-asiento NO este en la pagina (filtro por concepto).
    const pagina = await s.wallet.listarMovimientos({ page: 1, pageSize: 100, categoria: "egreso_pago_iva" }, actor);
    const documentoPago =
      pagina.status === "ok" ? (pagina.data.movimientos.find((x) => x.id === pago.id)?.documento ?? null) : null;

    // ── §2/§7/§8: un dia lejano con filas sembradas A MANO (respetando el CHECK) ───────────────
    const enDia = (dia: string) => new Date(`${dia}T18:00:00.000Z`); // 12:00 de Costa Rica
    const sembrar = (tipo: "ingreso" | "egreso", categoria: string, monto: string, dia: string, origenTipo: "cierre_dia" | "gasto", origenId: string | null) =>
      tx.walletMovimiento.create({
        data: {
          tipo,
          categoria: categoria as never,
          monto: new Prisma.Decimal(monto),
          origenTipo,
          origenId,
          fechaMovimiento: enDia(dia),
        },
        select: { id: true },
      });
    await sembrar("ingreso", "ingreso_flete", "500.00", DIA, "cierre_dia", randomUUID());
    await sembrar("ingreso", "ingreso_iva_flete", "50.00", DIA, "cierre_dia", randomUUID());
    const pagoDelDia = await sembrar("egreso", "egreso_pago_iva", "20.00", DIA, "gasto", null);
    await sembrar("ingreso", "ingreso_reverso_pago_iva", "5.00", DIA, "gasto", pagoDelDia.id);
    await sembrar("ingreso", "ingreso_iva_flete", "999.00", DIA_FUERA, "cierre_dia", randomUUID()); // fuera del periodo
    const periodo = await leer(actor, PERIODO);
    const gananciaMetrica = await metrica("ganancia_ordenex", actor);
    const egresosMetricaDespues = await metrica("egresos", actor);
    const diaDespues = await delDia();

    return {
      antes,
      base,
      antesLectura,
      baseLectura,
      trasAporte,
      antesPeriodo,
      periodo,
      antesIvaFlete,
      ivaFlete,
      antesFlete,
      flete,
      antesAQuien,
      aQuien,
      antesPago,
      trasPago,
      respuestasPago,
      filaPago,
      filasConClave,
      filasConClaveAjena,
      librosAjenos,
      respuestasAnulacion,
      reversosTrasForbidden,
      trasAnular,
      reverso,
      documentoPago,
      asiQueda: prev.efecto,
      gananciaMetrica,
      egresosMetricaAntes,
      egresosMetricaDespues,
      diaAntes,
      diaDespues,
    };
  }

  const d = (a: Resumen, b: Resumen, campo: keyof Resumen) => menos(b[campo] as string, a[campo] as string);
  /** a + b + … en STRING/Decimal. */
  const suma = (...xs: string[]) => xs.reduce((acc, x) => acc.add(new Prisma.Decimal(x)), new Prisma.Decimal(0)).toFixed(2);

  // ───────────────────────────────────────────────────────────────────────────────────────────
  // B.0 / R8 — lo que NO se mueve. Literales A MANO desde la fotografia de la 459 (+ 458-B):
  //   Entro  = 87 517,25 + aporte 20 000,00                     = 107 517,25
  //   Salio  = 161 845,77 (la anulacion del rechazo no saca dinero)
  //   cifra  = 107 517,25 − 161 845,77                          = −54 328,52
  //   De las tiendas = 14 175,82 (459 tras anular el rechazo: 13 045,82 + 1 130,00)
  //   capital = 20 000,00
  // ───────────────────────────────────────────────────────────────────────────────────────────
  it("B.0/R8: cifra principal, «Entro», «Salio», «De las tiendas» y capital (literales de antes de la 488)", () => {
    const { antes, base } = m();
    expect({
      entradas: d(antes, base, "entradas"),
      salidas: d(antes, base, "salidas"),
      enCaja: d(antes, base, "enCaja"),
      deTerceros: d(antes, base, "deTerceros"),
      capital: d(antes, base, "capital"),
    }).toEqual({
      entradas: "107517.25",
      salidas: "161845.77",
      enCaja: "-54328.52",
      deTerceros: "14175.82",
      capital: APORTE,
    });
  });

  // ───────────────────────────────────────────────────────────────────────────────────────────
  // §1 — R2–R7 sobre el libro real. A mano (IVA del escenario: 1 040 + 195 + 130 + 127,21 = 1 492,21):
  //   ingresos propios = 66 471,43 (459/461) − 1 492,21 = 64 979,22
  //   egresos propios  = 153 845,77 + 1 000,00 (reverso del FLETE del cobro anulado) = 154 845,77
  //   ganancia = 64 979,22 − 154 845,77 = −89 866,55
  //   IVA cobrado = IVA por pagar = 1 492,21 − 130,00 (reverso del IVA del cobro) = 1 362,21
  //   De Ordenex = −89 866,55 + 20 000,00 = −69 866,55
  //   R7: −69 866,55 + 14 175,82 + 1 362,21 = −54 328,52 = la cifra principal de B.0
  // ───────────────────────────────────────────────────────────────────────────────────────────
  it("§1 R2/R3/R4/R5/R6: ganancia, ingresos y gastos de Ordenex SIN IVA; IVA cobrado; IVA por pagar; «De Ordenex»", () => {
    // Mutacion m1 (design §13: `ingreso_iva_flete` como «propio») pone rojo este caso.
    const { antes, base } = m();
    expect({
      ingresosPropios: d(antes, base, "ingresosPropios"),
      egresosPropios: d(antes, base, "egresosPropios"),
      ganancia: d(antes, base, "ganancia"),
      ivaCobrado: d(antes, base, "ivaCobrado"),
      ivaPorPagar: d(antes, base, "ivaPorPagar"),
      deOrdenex: d(antes, base, "deOrdenex"),
    }).toEqual({
      ingresosPropios: "64979.22",
      egresosPropios: "154845.77",
      ganancia: "-89866.55",
      ivaCobrado: "1362.21",
      ivaPorPagar: "1362.21",
      deOrdenex: "-69866.55",
    });
  });

  it("§1 R7: cifra principal = «De Ordenex» + «De las tiendas» + IVA por pagar, al centimo (diferencia y libro entero)", () => {
    const { antes, base, trasPago, trasAnular } = m();
    expect(suma(d(antes, base, "deOrdenex"), d(antes, base, "deTerceros"), d(antes, base, "ivaPorPagar"))).toBe(
      d(antes, base, "enCaja"),
    );
    for (const r of [base, trasPago, trasAnular]) {
      expect(suma(r.deOrdenex, r.deTerceros, r.ivaPorPagar)).toBe(r.enCaja);
    }
  });

  it("§1 R19: la composicion NO tiene filas de IVA y su total de ingresos es el de la tarjeta", () => {
    const { antesLectura, baseLectura } = m();
    const claves = [...Object.keys(baseLectura.composicion.ingresos), ...Object.keys(baseLectura.composicion.egresos)];
    expect(claves.filter((k) => k.includes("iva"))).toEqual([]);
    expect(menos(baseLectura.composicion.totalIngresos, antesLectura.composicion.totalIngresos)).toBe("64979.22");
    expect(menos(baseLectura.composicion.totalEgresos, antesLectura.composicion.totalEgresos)).toBe("154845.77");
  });

  it("§1 R34: los campos nuevos cruzan como STRING de escala 2", () => {
    const r = m().base;
    for (const v of [r.ivaCobrado, r.ivaPorPagar, r.porcentajeIva]) expect(v).toMatch(/^-?\d+\.\d{2}$/);
    expect(["positivo", "negativo", "cero"]).toContain(r.signoIvaPorPagar);
  });

  // ───────────────────────────────────────────────────────────────────────────────────────────
  // §2 — R9: con filtros, todo sobre el MISMO conjunto que el libro.
  // ───────────────────────────────────────────────────────────────────────────────────────────
  it("§2 R9 (periodo): sobre el dia sembrado — ganancia 500; IVA cobrado 50; IVA por pagar 50 − 20 + 5 = 35; el dia de fuera no entra", () => {
    // Filas del dia: flete 500 · IVA 50 · Pago de IVA 20 · su anulacion 5. Fuera: IVA 999 (otro dia).
    // cifra = 5 − 20 = −15 ; De las tiendas = −(500 + 50) = −550 ; R7: 500 − 550 + 0 + 35 = −15.
    const { antesPeriodo, periodo } = m();
    const a = antesPeriodo.resumen;
    const b = periodo.resumen;
    expect({
      ganancia: d(a, b, "ganancia"),
      ingresosPropios: d(a, b, "ingresosPropios"),
      ivaCobrado: d(a, b, "ivaCobrado"),
      ivaPorPagar: d(a, b, "ivaPorPagar"),
      enCaja: d(a, b, "enCaja"),
      deTerceros: d(a, b, "deTerceros"),
      totalIngresos: menos(periodo.composicion.totalIngresos, antesPeriodo.composicion.totalIngresos),
    }).toEqual({
      ganancia: "500.00",
      ingresosPropios: "500.00",
      ivaCobrado: "50.00",
      ivaPorPagar: "35.00",
      enCaja: "-15.00",
      deTerceros: "-550.00",
      totalIngresos: "500.00",
    });
    expect(b.periodoFiltrado).toBe(true);
  });

  it("§2 R9 (concepto): filtrando el IVA del flete, todo es IVA; filtrando el flete, todo es ganancia", () => {
    const { antesIvaFlete, ivaFlete, antesFlete, flete } = m();
    expect({
      ivaCobrado: d(antesIvaFlete, ivaFlete, "ivaCobrado"),
      ivaPorPagar: d(antesIvaFlete, ivaFlete, "ivaPorPagar"),
      ganancia: d(antesIvaFlete, ivaFlete, "ganancia"),
      ingresosPropios: d(antesIvaFlete, ivaFlete, "ingresosPropios"),
    }).toEqual({ ivaCobrado: "1040.00", ivaPorPagar: "1040.00", ganancia: "0.00", ingresosPropios: "0.00" });
    expect({
      ivaCobrado: d(antesFlete, flete, "ivaCobrado"),
      ivaPorPagar: d(antesFlete, flete, "ivaPorPagar"),
      ganancia: d(antesFlete, flete, "ganancia"),
    }).toEqual({ ivaCobrado: "0.00", ivaPorPagar: "0.00", ganancia: "8000.00" });
  });

  it("§2 R9 («A quién»): el Pago de IVA anotado a Hacienda es lo unico del filtro — IVA por pagar −700, ganancia 0", () => {
    const { antesAQuien, aQuien } = m();
    expect({
      salidas: d(antesAQuien, aQuien, "salidas"),
      ivaPorPagar: d(antesAQuien, aQuien, "ivaPorPagar"),
      ivaCobrado: d(antesAQuien, aQuien, "ivaCobrado"),
      ganancia: d(antesAQuien, aQuien, "ganancia"),
    }).toEqual({ salidas: PAGO_IVA, ivaPorPagar: `-${PAGO_IVA}`, ivaCobrado: "0.00", ganancia: "0.00" });
  });

  // ───────────────────────────────────────────────────────────────────────────────────────────
  // §3 — R10: anular un cobro por devolucion a origen (1 000 de flete + 130 de IVA).
  // ───────────────────────────────────────────────────────────────────────────────────────────
  it("§3 R10: la anulacion baja el IVA por pagar y el IVA cobrado en 130 y la ganancia en 1 000 (solo el flete)", () => {
    const { trasAporte, base } = m();
    expect({
      ganancia: d(trasAporte, base, "ganancia"),
      ivaPorPagar: d(trasAporte, base, "ivaPorPagar"),
      ivaCobrado: d(trasAporte, base, "ivaCobrado"),
      deTerceros: d(trasAporte, base, "deTerceros"),
      enCaja: d(trasAporte, base, "enCaja"),
    }).toEqual({ ganancia: "-1000.00", ivaPorPagar: "-130.00", ivaCobrado: "-130.00", deTerceros: "1130.00", enCaja: "0.00" });
  });

  // ───────────────────────────────────────────────────────────────────────────────────────────
  // §4 — R22/R23/R27/R28: registrar el Pago de IVA.
  // ───────────────────────────────────────────────────────────────────────────────────────────
  it("§4 R22: UNA salida `egreso_pago_iva` origen `gasto` por M; «Salio» +M, cifra −M, IVA por pagar −M; ganancia, tiendas y capital igual", () => {
    const { antesPago, trasPago, filaPago, respuestasPago } = m();
    expect(respuestasPago.primero).toBe("ok");
    expect(filaPago).toBe(`egreso|egreso_pago_iva|${PAGO_IVA}|gasto|null`);
    expect({
      salidas: d(antesPago, trasPago, "salidas"),
      entradas: d(antesPago, trasPago, "entradas"),
      enCaja: d(antesPago, trasPago, "enCaja"),
      ivaPorPagar: d(antesPago, trasPago, "ivaPorPagar"),
      ivaCobrado: d(antesPago, trasPago, "ivaCobrado"),
      ganancia: d(antesPago, trasPago, "ganancia"),
      deTerceros: d(antesPago, trasPago, "deTerceros"),
      capital: d(antesPago, trasPago, "capital"),
    }).toEqual({
      salidas: PAGO_IVA,
      entradas: "0.00",
      enCaja: `-${PAGO_IVA}`,
      ivaPorPagar: `-${PAGO_IVA}`,
      ivaCobrado: "0.00",
      ganancia: "0.00",
      deTerceros: "0.00",
      capital: "0.00",
    });
  });

  it("§4 R23: el Pago de IVA no escribe en el libro de ninguna tienda ni de ningun mensajero", () => {
    const l = m().librosAjenos;
    expect(l.tiendaDespues).toBe(l.tiendaAntes);
    expect(l.mensajeroDespues).toBe(l.mensajeroAntes);
    expect(l.conOrigenDelPago).toBe(0);
  });

  it("§4 R28: dos envios con la MISMA clave escriben UNA sola salida", () => {
    expect(m().respuestasPago.mismaClave).toBe("ya_registrado");
    expect(m().filasConClave).toBe(1);
  });

  it("§4 R27: sin acceso total, registrar un Pago de IVA es `forbidden` y no escribe nada", () => {
    expect(m().respuestasPago.sinAccesoTotal).toBe("forbidden");
    expect(m().filasConClaveAjena).toBe(0);
  });

  // ───────────────────────────────────────────────────────────────────────────────────────────
  // §5 — R25/R26/R27: anularlo con motivo desde el libro de la caja.
  // ───────────────────────────────────────────────────────────────────────────────────────────
  it("§5 R25: UNA entrada `ingreso_reverso_pago_iva` por M; IVA por pagar y cifra +M; la ganancia NO cambia", () => {
    // Mutacion m2 (design §13: contra-asiento como `ingreso_ajuste`) pone rojo este caso por los dos lados.
    const { trasPago, trasAnular, reverso, respuestasAnulacion } = m();
    expect(respuestasAnulacion.primera).toEqual({ status: "ok", camino: "egreso_caja" });
    expect(reverso).toEqual([`ingreso|ingreso_reverso_pago_iva|${PAGO_IVA}`]);
    expect({
      ivaPorPagar: d(trasPago, trasAnular, "ivaPorPagar"),
      enCaja: d(trasPago, trasAnular, "enCaja"),
      entradas: d(trasPago, trasAnular, "entradas"),
      ganancia: d(trasPago, trasAnular, "ganancia"),
      ivaCobrado: d(trasPago, trasAnular, "ivaCobrado"),
      deTerceros: d(trasPago, trasAnular, "deTerceros"),
      capital: d(trasPago, trasAnular, "capital"),
    }).toEqual({
      ivaPorPagar: PAGO_IVA,
      enCaja: PAGO_IVA,
      entradas: PAGO_IVA,
      ganancia: "0.00",
      ivaCobrado: "0.00",
      deTerceros: "0.00",
      capital: "0.00",
    });
  });

  it("§5 R25: el libro marca el Pago de IVA como anulado aunque su contra-asiento NO este en la pagina (el WHERE)", () => {
    // Mutacion m3 (design §13: quitar `ingreso_reverso_pago_iva` del `in` del repositorio de documentos).
    expect(m().documentoPago).toEqual({ tipo: "egreso_caja", anulado: true, tieneComprobante: false });
  });

  it("§5 R26: anularlo otra vez responde `ya_anulado` sin escribir nada", () => {
    expect(m().respuestasAnulacion.otraVez).toEqual({ status: "ya_anulado", camino: "egreso_caja" });
    expect(m().reverso).toHaveLength(1);
  });

  it("§5 R27: sin acceso total, anular el Pago de IVA es `forbidden` y no escribe nada", () => {
    expect(m().respuestasAnulacion.sinAccesoTotal).toEqual({ status: "forbidden" });
    expect(m().reversosTrasForbidden).toBe(0);
  });

  // ───────────────────────────────────────────────────────────────────────────────────────────
  // §6 — R24: «Así queda» del Pago de IVA.
  // ───────────────────────────────────────────────────────────────────────────────────────────
  it("§6 R24: «Así queda» trae el IVA por pagar antes y despues, calculado en el servidor, y coincide con lo registrado", () => {
    const { asiQueda, antesPago, trasPago } = m();
    expect(asiQueda.lineas.ivaPorPagar).toEqual({ antes: antesPago.ivaPorPagar, despues: trasPago.ivaPorPagar, cambia: true });
    expect(menos(asiQueda.lineas.ivaPorPagar.despues, asiQueda.lineas.ivaPorPagar.antes)).toBe(`-${PAGO_IVA}`);
    expect(asiQueda.lineas.ganancia.cambia).toBe(false);
    expect(asiQueda.lineas.deTiendas.cambia).toBe(false);
    expect(asiQueda.lineas.capital.cambia).toBe(false);
    expect(asiQueda.lineas.cuenta).toBeNull();
  });

  // ───────────────────────────────────────────────────────────────────────────────────────────
  // §7 — R31/R32: la analitica financiera sobre el mismo periodo.
  // ───────────────────────────────────────────────────────────────────────────────────────────
  it("§7 R31: `ganancia_ordenex` del tablero = la ganancia de la tarjeta sobre el MISMO periodo (sin IVA)", () => {
    const { gananciaMetrica, periodo } = m();
    expect(gananciaMetrica.forma).toBe("bruto_y_neto");
    expect((gananciaMetrica as { neto: string }).neto).toBe(periodo.resumen.ganancia);
  });

  it("§7 R32: `egresos` cuenta el Pago de IVA (20) y DESCUENTA su anulacion (5): el neto baja 15", () => {
    const { egresosMetricaAntes, egresosMetricaDespues } = m();
    const neto = (x: ImporteAnalitico) => (x as { neto: string }).neto;
    expect(menos(neto(egresosMetricaDespues), neto(egresosMetricaAntes))).toBe("-15.00");
  });

  // ───────────────────────────────────────────────────────────────────────────────────────────
  // §8 — R33: la serie diaria, sobre las filas del repositorio real.
  // ───────────────────────────────────────────────────────────────────────────────────────────
  it("§8 R33: la ganancia del dia no lleva IVA (500) y el Pago de IVA cae en las salidas del dia (20)", () => {
    const { diaAntes, diaDespues } = m();
    expect({
      ganancia: menos(diaDespues.ganancia, diaAntes.ganancia),
      egresos: menos(diaDespues.egresos, diaAntes.egresos),
      ingresos: menos(diaDespues.ingresos, diaAntes.ingresos),
    }).toEqual({ ganancia: "500.00", egresos: "20.00", ingresos: "5.00" });
  });
});
