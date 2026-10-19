import type { Escenario } from "./454/_escenario";

/**
 * FICHA 484 — utilidades compartidas por los `484-puntero-*` (Postgres real, tx revertida).
 *
 * El puntero es `usuario.orden_en_gestion_id`. Aqui se PLANTA a mano —como lo dejo el incidente
 * BLST-765, o un puntero heredado de antes del despliegue— y se LEE de la misma transaccion.
 */

export async function plantarPuntero(e: Escenario, usuarioId: string, ordenId: string | null) {
  await e.tx.usuario.update({ where: { id: usuarioId }, data: { ordenEnGestionId: ordenId } });
}

export async function punteroDe(e: Escenario, usuarioId: string): Promise<string | null> {
  const u = await e.tx.usuario.findUniqueOrThrow({
    where: { id: usuarioId },
    select: { ordenEnGestionId: true },
  });
  return u.ordenEnGestionId;
}

/** La fila COMPLETA del usuario (todas las columnas escalares), para medir neutralidad (R8). */
export async function filaUsuario(e: Escenario, usuarioId: string): Promise<Record<string, unknown>> {
  const u = await e.tx.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
  return JSON.parse(JSON.stringify(u)) as Record<string, unknown>;
}

/**
 * La fila sin las dos columnas que la limpieza PUEDE tocar: el puntero y `updated_at`. Este ultimo
 * lo sella Prisma (`@updatedAt`) en todo `updateMany` sobre `usuario`; es el mismo sello que ya
 * ponen los otros dos escritores del puntero (`liberarOrdenEnGestion`, `registrarGestionPendiente`).
 */
export function sinPunteroNiSello(fila: Record<string, unknown>): Record<string, unknown> {
  const { ordenEnGestionId: _p, updatedAt: _u, ...resto } = fila;
  void _p;
  void _u;
  return resto;
}

/** Recuentos GLOBALES de los tres libros de dinero, para medir deltas dentro de la tx (R8). */
export async function librosDeDinero(e: Escenario) {
  return {
    caja: await e.tx.walletMovimiento.count(),
    tienda: await e.tx.walletTiendaMovimiento.count(),
    mensajero: await e.tx.pagoMensajeroMovimiento.count(),
  };
}
