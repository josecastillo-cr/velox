import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { OrdenHistorialOrigenTipo, PrismaClient } from "@prisma/client";

import { GestionOrdenRepository } from "@/lib/repositories/GestionOrdenRepository";
import { OrdenRepository } from "@/lib/repositories/OrdenRepository";
import { RecepcionBodegaCentralService } from "@/lib/services/RecepcionBodegaCentralService";

import {
  instanteCR,
  diaReparto,
  estatusId,
  sembrarBase,
  type BaseSembrada,
} from "../_semilla-tablero-dia";
import {
  HAY_BASE_DE_DATOS,
  clienteConTransaccionAnidada,
  crearPrismaDeTest,
  enTransaccionRevertida,
  type TxDeTest,
} from "./_postgres-real";

// ═════════════════════════════════════════════════════════════════════════════════════════════
// FICHA 496 / T1 — la recepción central de una RECOLECCIÓN libera al mensajero (R1–R7, R10–R13).
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// Contra Postgres real: los criterios viven en el `data`/`WHERE` de Prisma y un doble no los ve
// (memoria «probar el WHERE donde vive»). La recepción va por el SERVICE real
// (`RecepcionBodegaCentralService` + `OrdenRepository`), así la tabla de transiciones también queda
// cubierta. Todo dentro de `enTransaccionRevertida`: no queda ni una fila.
//
// Siembra: `sembrarBase` de la 192 (tienda, dos mensajeros y un maestro propios del caso). Si el
// catálogo falta, LANZA: nunca un `return` temprano que deje el test verde sin afirmar nada.
//
// Correr: `pnpm exec vitest run tests/integration/db/recepcion-central-libera-496.test.ts`.

const describeSiHayBase = HAY_BASE_DE_DATOS ? describe : describe.skip;

const DIA = "2001-06-15";
const ASIGNADO_AT = instanteCR(DIA, "07:30");
const FECHA_REPARTO = diaReparto(DIA);

let guia = 1_700_000_000 + Math.floor(Math.random() * 100_000_000);

interface SemillaOrden496 {
  clave: string;
  estatus: string;
  mensajeroId: string | null;
  /** Con mensajero, por defecto se siembra también `asignado_at` y `fecha_reparto` (el trío entero). */
  trioCompleto?: boolean;
  deletedAt?: Date | null;
}

async function crearOrden(
  tx: TxDeTest,
  base: BaseSembrada,
  s: SemillaOrden496,
): Promise<{ id: string; numGuia: number }> {
  const numGuia = (guia += 1);
  const conTrio = s.mensajeroId !== null && s.trioCompleto !== false;
  const o = await tx.orden.create({
    data: {
      numRemision: `${base.sufijo}-${s.clave}`,
      numGuia,
      destinatario: `Cliente ${s.clave}`,
      telefonoDest: "80000000",
      direccion: `Direccion ${s.clave}`,
      producto: "caja",
      estatusId: estatusId(base, s.estatus),
      tiendaId: base.tienda,
      zonaId: base.zonaA,
      provinciaId: base.provinciaId,
      cantonId: base.cantonId,
      mensajeroAsignadoId: s.mensajeroId,
      asignadoAt: conTrio ? ASIGNADO_AT : null,
      fechaReparto: conTrio ? FECHA_REPARTO : null,
      createdAt: instanteCR(DIA, "07:00"),
      deletedAt: s.deletedAt ?? null,
    },
    select: { id: true },
  });
  return { id: o.id, numGuia };
}

async function historial(
  tx: TxDeTest,
  base: BaseSembrada,
  ordenId: string,
  h: { origen: string; destino: string; origenTipo: OrdenHistorialOrigenTipo; actor: string; hora: string },
): Promise<void> {
  await tx.ordenHistorialEstado.create({
    data: {
      ordenId,
      estatusOrigenId: estatusId(base, h.origen),
      estatusDestinoId: estatusId(base, h.destino),
      actorUsuarioId: h.actor,
      origenTipo: h.origenTipo,
      createdAt: instanteCR(DIA, h.hora),
    },
  });
}

/** El recorrido de la recolección: el maestro la asigna a `mensajero` y `mensajero` la recolecta. */
async function recorridoDeRecoleccion(
  tx: TxDeTest,
  base: BaseSembrada,
  ordenId: string,
  mensajero: string,
): Promise<void> {
  await historial(tx, base, ordenId, {
    origen: "por_recolectar_en_tienda",
    destino: "recolectando",
    origenTipo: "asignacion_recoleccion",
    actor: base.maestro,
    hora: "08:00",
  });
  await historial(tx, base, ordenId, {
    origen: "recolectando",
    destino: "en_ruta_bodega_central",
    origenTipo: "recoleccion_tienda",
    actor: mensajero,
    hora: "09:00",
  });
}

function servicio(tx: TxDeTest): RecepcionBodegaCentralService {
  return new RecepcionBodegaCentralService(new OrdenRepository(clienteConTransaccionAnidada(tx)));
}

function recibir(tx: TxDeTest, base: BaseSembrada, numGuia: number) {
  return servicio(tx).recibirEnBodegaCentral(numGuia, { usuarioId: base.maestro, rol: "maestro" });
}

async function leer(tx: TxDeTest, id: string) {
  const o = await tx.orden.findUniqueOrThrow({
    where: { id },
    select: {
      mensajeroAsignadoId: true,
      asignadoAt: true,
      fechaReparto: true,
      numGuia: true,
      estatus: { select: { value: true } },
    },
  });
  return {
    estado: o.estatus.value,
    mensajero: o.mensajeroAsignadoId,
    asignadoAt: o.asignadoAt?.toISOString() ?? null,
    fechaReparto: o.fechaReparto?.toISOString() ?? null,
    numGuia: o.numGuia,
  };
}

async function filasDeHistorial(tx: TxDeTest, ordenId: string) {
  return tx.ordenHistorialEstado.findMany({
    where: { ordenId },
    select: { origenTipo: true },
  });
}

async function reasignables(tx: TxDeTest, base: BaseSembrada): Promise<string[]> {
  const r = await new OrdenRepository(clienteConTransaccionAnidada(tx)).list({
    // `tiendaId` = la tienda recién sembrada: aísla el resultado de los datos de la base compartida.
    where: { reasignables: true, tiendaId: base.tienda },
    sortBy: "created_at",
    sortDir: "desc",
    skip: 0,
    take: 100,
  });
  return r.items.map((i) => i.id).sort();
}

function recolectadas(tx: TxDeTest, mensajeroId: string, ids: string[]) {
  return new GestionOrdenRepository(tx as unknown as PrismaClient).findMisAsignacionesByIds(mensajeroId, ids);
}

describeSiHayBase("496 — la recepción central de una recolección libera al mensajero (Postgres real)", () => {
  let prisma: PrismaClient;
  beforeAll(() => {
    prisma = crearPrismaDeTest();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("⭑ R1: recepción de recolección deja el trío en NULL", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      const base = await sembrarBase(tx);
      const o = await crearOrden(tx, base, { clave: "r1", estatus: "en_ruta_bodega_central", mensajeroId: base.mensajero1 });
      await recorridoDeRecoleccion(tx, base, o.id, base.mensajero1);
      const antes = await leer(tx, o.id);
      const resultado = await recibir(tx, base, o.numGuia);
      return { antes, resultado, despues: await leer(tx, o.id), id: o.id, m1: base.mensajero1 };
    });
    // La siembra tenía el trío completo: sin esto el NULL de abajo podría ser de nacimiento.
    expect(r.antes).toMatchObject({
      mensajero: r.m1,
      asignadoAt: "2001-06-15T13:30:00.000Z",
      fechaReparto: "2001-06-15T00:00:00.000Z",
    });
    expect(r.resultado).toEqual({ status: "ok", ordenId: r.id, estado: "en_bodega_central" });
    expect(r.despues).toMatchObject({
      estado: "en_bodega_central",
      mensajero: null,
      asignadoAt: null,
      fechaReparto: null,
    });
  });

  it("⭑ R2: recepción de devolución conserva el trío", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      const base = await sembrarBase(tx);
      const o = await crearOrden(tx, base, { clave: "r2", estatus: "devolviendo_a_bodega_central", mensajeroId: base.mensajero1 });
      const resultado = await recibir(tx, base, o.numGuia);
      return { resultado, despues: await leer(tx, o.id), m1: base.mensajero1 };
    });
    expect(r.resultado).toMatchObject({ status: "ok", estado: "por_devolver_a_tienda" });
    expect(r.despues).toMatchObject({
      estado: "por_devolver_a_tienda",
      mensajero: r.m1,
      asignadoAt: "2001-06-15T13:30:00.000Z",
      fechaReparto: "2001-06-15T00:00:00.000Z",
    });
  });

  it("⭑ R3: recepción que no transiciona no toca la asignación ni escribe historial (ya recibida, borrada, estado no origen, carrera)", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      const base = await sembrarBase(tx);
      const ya = await crearOrden(tx, base, { clave: "r3-ya", estatus: "en_bodega_central", mensajeroId: base.mensajero1 });
      const borrada = await crearOrden(tx, base, {
        clave: "r3-borrada",
        estatus: "en_ruta_bodega_central",
        mensajeroId: base.mensajero1,
        deletedAt: instanteCR(DIA, "10:00"),
      });
      const sat = await crearOrden(tx, base, { clave: "r3-sat", estatus: "en_bodega_satelite", mensajeroId: base.mensajero1 });
      const resultados = [
        await recibir(tx, base, ya.numGuia),
        await recibir(tx, base, borrada.numGuia),
        await recibir(tx, base, sat.numGuia),
      ];
      // La carrera perdida: el service ya leyó `en_ruta_bodega_central` pero la orden cambió antes
      // del UPDATE. Se llama al repo con ese origen sobre una orden que YA no está en él: la guarda
      // del `updateMany` es la única defensa, y con ella no debe liberarse nada.
      const repo = new OrdenRepository(clienteConTransaccionAnidada(tx));
      const carrera = await repo.recibirEnBodegaCentral(
        sat.id,
        "en_ruta_bodega_central",
        estatusId(base, "en_bodega_central"),
        true,
        { actorUsuarioId: base.maestro, origenTipo: "recepcion_bodega_central" },
      );
      const ordenes = await Promise.all([ya.id, borrada.id, sat.id].map((id) => leer(tx, id)));
      const historiales = await Promise.all([ya.id, borrada.id, sat.id].map((id) => filasDeHistorial(tx, id)));
      return { resultados, carrera, ordenes, historiales: historiales.map((h) => h.length), m1: base.mensajero1 };
    });
    expect(r.resultados).toEqual([
      { status: "ya_recibida" },
      { status: "no_encontrada" },
      { status: "estado_invalido", estado: "en_bodega_satelite" },
    ]);
    expect(r.carrera).toBe(false);
    for (const o of r.ordenes) {
      expect(o).toMatchObject({
        mensajero: r.m1,
        asignadoAt: "2001-06-15T13:30:00.000Z",
        fechaReparto: "2001-06-15T00:00:00.000Z",
      });
    }
    expect(r.ordenes.map((o) => o.estado)).toEqual(["en_bodega_central", "en_ruta_bodega_central", "en_bodega_satelite"]);
    expect(r.historiales).toEqual([0, 0, 0]);
  });

  it("⭑ R4: una sola fila de recepción y num_guia intacto (las dos aristas)", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      const base = await sembrarBase(tx);
      const rec = await crearOrden(tx, base, { clave: "r4-rec", estatus: "en_ruta_bodega_central", mensajeroId: base.mensajero1 });
      await recorridoDeRecoleccion(tx, base, rec.id, base.mensajero1);
      const dev = await crearOrden(tx, base, { clave: "r4-dev", estatus: "devolviendo_a_bodega_central", mensajeroId: base.mensajero1 });
      await recibir(tx, base, rec.numGuia);
      await recibir(tx, base, dev.numGuia);
      return {
        guias: [rec.numGuia, dev.numGuia],
        despues: [(await leer(tx, rec.id)).numGuia, (await leer(tx, dev.id)).numGuia],
        histRec: (await filasDeHistorial(tx, rec.id)).map((h) => h.origenTipo).sort(),
        histDev: (await filasDeHistorial(tx, dev.id)).map((h) => h.origenTipo),
      };
    });
    expect(r.despues).toEqual(r.guias);
    // Las dos sembradas + exactamente UNA de la recepción (ninguna de «desasignación»).
    expect(r.histRec).toEqual(["asignacion_recoleccion", "recepcion_bodega_central", "recoleccion_tienda"]);
    expect(r.histDev).toEqual(["recepcion_bodega_central"]);
  });

  it("⭑ R5: conteos de gestión, wallet, pagos y cierres sin cambio", async () => {
    // REPEATABLE READ: los cinco conteos son globales y la base la comparten otros gates; con esta
    // aislación la foto es fija y solo nuestras propias escrituras podrían moverla.
    const r = await prisma
      .$transaction(
        async (tx) => {
          const contar = async () => {
            const filas = await tx.$queryRawUnsafe<{ t: string; n: bigint }[]>(
              `SELECT 'gestion_orden' AS t, count(*) AS n FROM gestion_orden
               UNION ALL SELECT 'wallet_movimiento', count(*) FROM wallet_movimiento
               UNION ALL SELECT 'wallet_tienda_movimiento', count(*) FROM wallet_tienda_movimiento
               UNION ALL SELECT 'pago_mensajero_movimiento', count(*) FROM pago_mensajero_movimiento
               UNION ALL SELECT 'cierre_dia', count(*) FROM cierre_dia`,
            );
            return Object.fromEntries(filas.map((f) => [f.t, Number(f.n)]));
          };
          const base = await sembrarBase(tx);
          const rec = await crearOrden(tx, base, { clave: "r5-rec", estatus: "en_ruta_bodega_central", mensajeroId: base.mensajero1 });
          await recorridoDeRecoleccion(tx, base, rec.id, base.mensajero1);
          const dev = await crearOrden(tx, base, { clave: "r5-dev", estatus: "devolviendo_a_bodega_central", mensajeroId: base.mensajero1 });
          const antes = await contar();
          const res = [await recibir(tx, base, rec.numGuia), await recibir(tx, base, dev.numGuia)];
          throw new Revertir({ antes, despues: await contar(), estados: res.map((x) => x.status) });
        },
        { isolationLevel: "RepeatableRead", timeout: 30_000, maxWait: 15_000 },
      )
      .catch((e: unknown) => {
        if (e instanceof Revertir) return e.valor;
        throw e;
      });
    expect(r.estados).toEqual(["ok", "ok"]);
    expect(Object.keys(r.antes).sort()).toEqual([
      "cierre_dia",
      "gestion_orden",
      "pago_mensajero_movimiento",
      "wallet_movimiento",
      "wallet_tienda_movimiento",
    ]);
    expect(r.despues).toEqual(r.antes);
  });

  it("⭑ R6: Reasignables trae la recolección recibida", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      const base = await sembrarBase(tx);
      const o = await crearOrden(tx, base, { clave: "r6", estatus: "en_ruta_bodega_central", mensajeroId: base.mensajero1 });
      await recorridoDeRecoleccion(tx, base, o.id, base.mensajero1);
      const antes = await reasignables(tx, base);
      await recibir(tx, base, o.numGuia);
      return { antes, despues: await reasignables(tx, base), id: o.id };
    });
    expect(r.antes).toEqual([]);
    expect(r.despues).toEqual([r.id]);
  });

  it("⭑ R7: Reasignables no trae una orden en central con mensajero", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      const base = await sembrarBase(tx);
      const conMensajero = await crearOrden(tx, base, { clave: "r7-con", estatus: "en_bodega_central", mensajeroId: base.mensajero1 });
      // Control: sin mensajero SÍ sale. Sin él, un listado vacío por cualquier otra razón pasaría.
      const sinMensajero = await crearOrden(tx, base, { clave: "r7-sin", estatus: "en_bodega_central", mensajeroId: null });
      return { lista: await reasignables(tx, base), con: conMensajero.id, sin: sinMensajero.id };
    });
    expect(r.lista).toEqual([r.sin]);
    expect(r.lista).not.toContain(r.con);
  });

  it("⭑ R10: Recolectadas hoy trae la recibida (sin mensajero) y la asignada a mí", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      const base = await sembrarBase(tx);
      const recibida = await crearOrden(tx, base, { clave: "r10-recibida", estatus: "en_ruta_bodega_central", mensajeroId: base.mensajero1 });
      await recorridoDeRecoleccion(tx, base, recibida.id, base.mensajero1);
      const enRuta = await crearOrden(tx, base, { clave: "r10-en-ruta", estatus: "en_ruta_bodega_central", mensajeroId: base.mensajero1 });
      await recorridoDeRecoleccion(tx, base, enRuta.id, base.mensajero1);
      await recibir(tx, base, recibida.numGuia);
      const filas = await recolectadas(tx, base.mensajero1, [recibida.id, enRuta.id]);
      return {
        filas: filas.map((f) => [f.id, f.estatusValue]).sort(),
        esperado: [
          [recibida.id, "en_bodega_central"],
          [enRuta.id, "en_ruta_bodega_central"],
        ].sort(),
        mensajeroRecibida: (await leer(tx, recibida.id)).mensajero,
      };
    });
    // La recibida queda SIN mensajero (lo pone R1) y aun así es mía por el historial.
    expect(r.mensajeroRecibida).toBeNull();
    expect(r.filas).toEqual(r.esperado);
  });

  it("⭑ R11: Recolectadas hoy no trae la mía asignada a otro", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      const base = await sembrarBase(tx);
      const deOtro = await crearOrden(tx, base, { clave: "r11", estatus: "en_bodega_central", mensajeroId: base.mensajero2 });
      await recorridoDeRecoleccion(tx, base, deOtro.id, base.mensajero1);
      // Control: la misma consulta con el mensajero dueño SÍ la trae.
      return {
        mia: await recolectadas(tx, base.mensajero1, [deOtro.id]),
        delOtro: (await recolectadas(tx, base.mensajero2, [deOtro.id])).map((f) => f.id),
        id: deOtro.id,
      };
    });
    expect(r.mia).toEqual([]);
    expect(r.delOtro).toEqual([r.id]);
  });

  it("⭑ R12: no trae la sin mensajero recolectada por otro (ni la que no tiene recolección)", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      const base = await sembrarBase(tx);
      const deOtro = await crearOrden(tx, base, { clave: "r12-otro", estatus: "en_bodega_central", mensajeroId: null });
      await recorridoDeRecoleccion(tx, base, deOtro.id, base.mensajero2);
      // Historial con M1 como actor pero de OTRO tipo: tampoco le da propiedad.
      const otroTipo = await crearOrden(tx, base, { clave: "r12-tipo", estatus: "en_bodega_central", mensajeroId: null });
      await historial(tx, base, otroTipo.id, {
        origen: "por_recolectar_en_tienda",
        destino: "recolectando",
        origenTipo: "asignacion_recoleccion",
        actor: base.mensajero1,
        hora: "08:00",
      });
      const sinHistorial = await crearOrden(tx, base, { clave: "r12-nada", estatus: "en_bodega_central", mensajeroId: null });
      return {
        m1: await recolectadas(tx, base.mensajero1, [deOtro.id, otroTipo.id, sinHistorial.id]),
        // Control: el recolector real SÍ la ve, así que la fila existe y es legible.
        m2: (await recolectadas(tx, base.mensajero2, [deOtro.id])).map((f) => f.id),
        id: deOtro.id,
      };
    });
    expect(r.m1).toEqual([]);
    expect(r.m2).toEqual([r.id]);
  });

  it("⭑ R13: no trae la recolectada borrada (con y sin mensajero)", async () => {
    const r = await enTransaccionRevertida(prisma, async (tx) => {
      const base = await sembrarBase(tx);
      const borrada = instanteCR(DIA, "11:00");
      const sinMensajero = await crearOrden(tx, base, {
        clave: "r13-sin",
        estatus: "en_bodega_central",
        mensajeroId: null,
        deletedAt: borrada,
      });
      await recorridoDeRecoleccion(tx, base, sinMensajero.id, base.mensajero1);
      const conMensajero = await crearOrden(tx, base, {
        clave: "r13-con",
        estatus: "en_ruta_bodega_central",
        mensajeroId: base.mensajero1,
        deletedAt: borrada,
      });
      await recorridoDeRecoleccion(tx, base, conMensajero.id, base.mensajero1);
      return recolectadas(tx, base.mensajero1, [sinMensajero.id, conMensajero.id]);
    });
    expect(r).toEqual([]);
  });
});

/** Portador del valor para revertir la transacción REPEATABLE READ de R5 sin perder lo medido. */
class Revertir {
  constructor(
    readonly valor: {
      antes: Record<string, number>;
      despues: Record<string, number>;
      estados: string[];
    },
  ) {}
}
