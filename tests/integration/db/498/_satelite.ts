import { Prisma } from "@prisma/client";

import { CierreBodegaRepository } from "@/lib/repositories/CierreBodegaRepository";
import { CierreBodegaService } from "@/lib/services/CierreBodegaService";
import type { Actor } from "@/lib/interfaces/services/IOrdenService";
import type { Escenario } from "../454/_escenario";

/**
 * FICHA 498 — piezas compartidas de los tests de integracion de la ficha. Montan los datos por los
 * SERVICIOS reales del escenario de la 454 (gestionar, solicitar, aprobar, consolidar): nada de
 * filas sembradas a mano en los libros.
 */

/** Tarifa propia de la tienda del escenario: fletes, comision e IVA deterministas. */
export async function tarifaDeLaTienda(e: Escenario): Promise<void> {
  await e.tx.tarifa.create({
    data: {
      tiendaId: e.tiendaId,
      zonaId: null,
      valorFlete: new Prisma.Decimal("2000.00"),
      valorFleteDevuelto: new Prisma.Decimal("1000.00"),
      valorFleteGam: new Prisma.Decimal("2000.00"),
      valorFleteDevueltoGam: new Prisma.Decimal("1000.00"),
      comisionCod: new Prisma.Decimal("5.00"),
      ivaFlete: new Prisma.Decimal("13.00"),
      ivaComisionCod: new Prisma.Decimal("13.00"),
    },
  });
}

export type Entrega = { monto: number; metodo?: "efectivo" | "SINPE" | "transferencia" };

/**
 * Un cierre SATELITE aprobado por el servicio real: una entrega por elemento de `entregas`, del
 * mensajero `actor` (por defecto el primero del escenario). Devuelve el id del cierre.
 */
export async function cierreSateliteAprobado(
  e: Escenario,
  entregas: Entrega[],
  actor: Actor = e.actorMensajero,
): Promise<string> {
  for (const en of entregas) {
    const o = await e.sembrarOrden({ estatus: "en_reparto", montoCobrar: en.monto, mensajeroId: actor.usuarioId });
    await e.gestionarOk(o.ordenId, "entregado", {
      monto: en.monto,
      pagos: [{ metodo: en.metodo ?? "efectivo", monto: en.monto }],
      actor,
    });
  }
  const cierreId = await e.solicitarCierreOk(actor);
  const r = await e.aprobar(cierreId);
  if (r.status !== "ok") throw new Error(`aprobar el cierre satelite no fue ok: ${JSON.stringify(r)}`);
  return cierreId;
}

/** Consolida por el servicio real todo lo consolidable de la zona y devuelve la consolidacion. */
export async function consolidar(e: Escenario): Promise<string> {
  const r = await new CierreBodegaService(new CierreBodegaRepository(e.cliente), e.s.ordenRepo).solicitarCierreBodega(
    e.actorAdminSatelite,
  );
  if (r.status !== "ok") throw new Error(`consolidar no fue ok: ${JSON.stringify(r)}`);
  const cb = await e.tx.cierreBodega.findFirstOrThrow({
    where: { zonaId: e.zonaSateliteId },
    orderBy: { solicitadoAt: "desc" },
    select: { id: true },
  });
  return cb.id;
}

/**
 * El aporte HECHO A MANO desde el snapshot: general − pago al mensajero − ingreso por rechazos.
 * Se escribe aqui a proposito y NO se llama a `paraLaCentral`: el test compara contra una cuenta
 * independiente del codigo que mide.
 */
export function aporteAMano(r: {
  totalGeneral: Prisma.Decimal;
  totalPagoMensajero: Prisma.Decimal;
  totalIngresoBodegaRechazos: Prisma.Decimal;
}): Prisma.Decimal {
  return r.totalGeneral.minus(r.totalPagoMensajero).minus(r.totalIngresoBodegaRechazos);
}

export const SNAPSHOT_SELECT = {
  totalGeneral: true,
  totalPagoMensajero: true,
  totalIngresoBodegaRechazos: true,
} as const;

/** Las filas de los TRES libros con origen en alguno de `ids`, como texto ordenable. */
export async function filasDeLosLibros(e: Escenario, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const filas = (await e.tx.$queryRawUnsafe(
    `SELECT 'wallet_movimiento' AS tabla, tipo::text AS tipo, categoria::text AS categoria,
            monto::text AS monto, origen_tipo::text AS origen_tipo, origen_id
       FROM wallet_movimiento WHERE origen_id = ANY($1::text[])
     UNION ALL
     SELECT 'wallet_tienda_movimiento', tipo::text, categoria::text, monto::text, origen_tipo::text, origen_id
       FROM wallet_tienda_movimiento WHERE origen_id = ANY($1::text[])
     UNION ALL
     SELECT 'pago_mensajero_movimiento', tipo::text, categoria::text, monto::text, origen_tipo::text, origen_id
       FROM pago_mensajero_movimiento WHERE origen_id = ANY($1::text[])`,
    ids,
  )) as Array<{ tabla: string; tipo: string; categoria: string; monto: string; origen_tipo: string; origen_id: string }>;
  return filas
    .map((f) => `${f.tabla}|${f.tipo}|${f.categoria}|${f.monto}|${f.origen_tipo}|${f.origen_id}`)
    .sort();
}

export type FilaDiferencia = {
  tipo: string;
  categoria: string;
  monto: string;
  origen_tipo: string;
  evento: string;
  diferencia: string;
  monto_esperado: string;
  monto_recibido: string;
};

/**
 * Las filas de caja de diferencia de UNA consolidacion, con su fila de ajuste, en orden de
 * escritura. Las categorias se comparan como TEXTO y la tabla de ajustes se busca con
 * `to_regclass`: antes de M1/M2 no existen, y entonces no hay filas (el test que espera una se pone
 * rojo, que es lo que T1.3 tiene que mostrar contra el codigo de hoy).
 */
export async function filasDeDiferencia(e: Escenario, cierreBodegaId: string): Promise<FilaDiferencia[]> {
  const [{ existe }] = (await e.tx.$queryRawUnsafe(
    `SELECT to_regclass('public.conciliacion_bodega_ajuste') IS NOT NULL AS existe`,
  )) as Array<{ existe: boolean }>;
  if (!existe) return [];
  return (await e.tx.$queryRawUnsafe(
    `SELECT w.tipo::text AS tipo, w.categoria::text AS categoria, w.monto::text AS monto,
            w.origen_tipo::text AS origen_tipo, a.evento, a.diferencia::text AS diferencia,
            a.monto_esperado::text AS monto_esperado, a.monto_recibido::text AS monto_recibido
       FROM conciliacion_bodega_ajuste a
       JOIN wallet_movimiento w ON w.origen_id = a.id
      WHERE a.cierre_bodega_id = $1
      ORDER BY a.created_at, a.ctid`,
    cierreBodegaId,
  )) as FilaDiferencia[];
}

// FICHA 500 (T1.2): movido aqui desde `498-conciliar-asienta-sql-real.test.ts`, SIN cambiar su cuerpo,
// para que lo compartan los tests de la 500.
/** Dos cierres satelite aprobados (efectivo + SINPE; solo efectivo) y consolidados. */
export async function consolidacionConDosCierres(e: Escenario) {
  await tarifaDeLaTienda(e);
  const c1 = await cierreSateliteAprobado(e, [{ monto: 6000 }, { monto: 4000, metodo: "SINPE" }]);
  const c2 = await cierreSateliteAprobado(e, [{ monto: 3000 }], e.actorMensajero2);
  const cbId = await consolidar(e);
  const snap = await e.tx.cierreBodega.findUniqueOrThrow({ where: { id: cbId }, select: SNAPSHOT_SELECT });
  return { c1, c2, cbId, aporte: aporteAMano(snap) };
}
