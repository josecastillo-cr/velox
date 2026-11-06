import type { Prisma } from "@prisma/client";

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⭑ FICHA 500 (bloque 2 de H5, R1) — ¿QUE CONSOLIDACIONES TIENEN DINERO? Un solo criterio.
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// Lo comparten el servidor (`CierresBodegaAdminRepository.revertirConciliacion`, R2) y las dos
// lecturas que alimentan las acciones de conciliacion (`SaldosSatelitesRepository` y
// `CierresBodegaAdminRepository.findCierreBodegaConDetalle`, R3/R4). Si la pantalla y el servidor
// usaran dos criterios, la pantalla ofreceria «Desmarcar» a una consolidacion que el servidor
// rechaza (o al reves).
//
// Es el predicado de `tieneAsientos` de la 498 (borrado en la 500), POR LOTES y sin cambiar su
// semantica: una fila de ajuste, o una fila de los tres libros con origen `cierre_dia` en uno de
// sus cierres. Sin filtro de estado ni de destino del cierre, y el libro del mensajero NO excluye
// premios (igual que antes): R4 exige el mismo criterio que el servidor.
//
// Cinco consultas por llamada, sea cual sea el numero de ids: no hay N+1 por fila.

/** Lo que la funcion necesita del cliente: vale el `tx` de una transaccion y el cliente raiz. */
export type ClienteConDinero = Pick<
  Prisma.TransactionClient,
  | "conciliacionBodegaAjuste"
  | "cierreDia"
  | "walletMovimiento"
  | "walletTiendaMovimiento"
  | "pagoMensajeroMovimiento"
>;

/**
 * FICHA 500 (R1) — de estas consolidaciones, ¿cuales tienen dinero? Una fila de ajuste, o una fila
 * de los tres libros con origen `cierre_dia` en uno de sus cierres.
 */
export async function consolidacionesConDinero(
  cliente: ClienteConDinero,
  ids: readonly string[],
): Promise<Set<string>> {
  const conDinero = new Set<string>();
  if (ids.length === 0) return conDinero;

  // 1 · Las que tienen alguna fila de ajuste (la diferencia escrita al marcar o al corregir).
  const ajustes = await cliente.conciliacionBodegaAjuste.findMany({
    where: { cierreBodegaId: { in: [...ids] } },
    select: { cierreBodegaId: true },
    distinct: ["cierreBodegaId"],
  });
  for (const a of ajustes) conDinero.add(a.cierreBodegaId);

  const resto = ids.filter((id) => !conDinero.has(id));
  if (resto.length === 0) return conDinero;

  // 2 · Los cierres de las que faltan.
  const cierres = await cliente.cierreDia.findMany({
    where: { cierreBodegaId: { in: resto } },
    select: { id: true, cierreBodegaId: true },
  });
  if (cierres.length === 0) return conDinero;

  // 3 · En los tres libros, los cierres que ya movieron dinero.
  const deCierres = {
    origenTipo: "cierre_dia" as const,
    origenId: { in: cierres.map((c) => c.id) },
  };
  // En SERIE, no en `Promise.all`: dentro de una transaccion interactiva las consultas comparten una
  // conexion y el driver `pg` avisa (y en pg@9 rechazara) consultas concurrentes sobre ella.
  const sel = { select: { origenId: true }, distinct: ["origenId"] as ["origenId"] };
  const caja = await cliente.walletMovimiento.findMany({ where: deCierres, ...sel });
  const tienda = await cliente.walletTiendaMovimiento.findMany({ where: deCierres, ...sel });
  const mensajero = await cliente.pagoMensajeroMovimiento.findMany({ where: deCierres, ...sel });
  const cierresConDinero = new Set<string | null>(
    [...caja, ...tienda, ...mensajero].map((m) => m.origenId),
  );
  for (const c of cierres) {
    if (c.cierreBodegaId !== null && cierresConDinero.has(c.id)) conDinero.add(c.cierreBodegaId);
  }
  return conDinero;
}
