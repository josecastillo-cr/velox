import type { Prisma } from "@prisma/client";

import type { IPagoMensajeroMovimientoRepository } from "@/lib/interfaces/repositories/IPagoMensajeroMovimientoRepository";
import type { IWalletMovimientoRepository } from "@/lib/interfaces/repositories/IWalletMovimientoRepository";
import type { IWalletTiendaMovimientoRepository } from "@/lib/interfaces/repositories/IWalletTiendaMovimientoRepository";
import type { ICajaCodFeedService } from "@/lib/interfaces/services/ICajaCodFeedService";
import type { IWalletFeedService } from "@/lib/interfaces/services/IWalletFeedService";
import type { IWalletIndemnizacionFeedService } from "@/lib/interfaces/services/IWalletIndemnizacionFeedService";
import type { IWalletMensajeroFeedService } from "@/lib/interfaces/services/IWalletMensajeroFeedService";
import type { IWalletTiendaFeedService } from "@/lib/interfaces/services/IWalletTiendaFeedService";
import { PagoMensajeroMovimientoRepository } from "@/lib/repositories/PagoMensajeroMovimientoRepository";
import { WalletMovimientoRepository } from "@/lib/repositories/WalletMovimientoRepository";
import { WalletTiendaMovimientoRepository } from "@/lib/repositories/WalletTiendaMovimientoRepository";
import { CajaCodFeedService } from "@/lib/services/CajaCodFeedService";
import { WalletFeedService } from "@/lib/services/WalletFeedService";
import { WalletIndemnizacionFeedService } from "@/lib/services/WalletIndemnizacionFeedService";
import { WalletMensajeroFeedService } from "@/lib/services/WalletMensajeroFeedService";
import { WalletTiendaFeedService } from "@/lib/services/WalletTiendaFeedService";

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⭑ FICHA 498 (design §4.1, R5-R7) — ASENTAR UN CIERRE DEL DIA: el UNICO procedimiento que escribe
// su dinero en los tres libros (caja, libro por tienda, libro del mensajero).
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// Lo comparten la APROBACION (`CierresAdminRepository.resolverCierre`, solo cierres centrales) y la
// CONCILIACION (`CierresBodegaAdminRepository.marcarConciliado`, los cierres satelite de la
// consolidacion). Su cuerpo es un movimiento LITERAL de lo que la aprobacion hacia antes de la ficha
// (`CierresAdminRepository.ts:1888-1950` en `13fd57fc`), con `this.` → `deps.` y `CAJA_COD_FEED` →
// `deps.cajaCodFeed`: mismas filas, mismo orden (R3/R5).
//
// NO incluye la captura de la indemnizacion (no es dinero: es un dato de la gestion y sigue en la
// aprobacion, R2). Cuando un cierre satelite se asienta al conciliar, el feed de indemnizacion lee el
// monto que la aprobacion dejo persistido.
//
// IDEMPOTENTE: cada libro inserta con su unico de origen (`ON CONFLICT DO NOTHING` / `skipDuplicates`).
// Asentar dos veces el mismo cierre no añade filas.
//
// NUNCA escribe premios del ranking ni filas con `premio_dia` (R7): ninguno de los cinco feeds los
// construye (los escribe el cierre del ranking, por su propio camino).

export interface DependenciasAsiento {
  walletMovimientoRepo: IWalletMovimientoRepository;
  walletFeedService: IWalletFeedService;
  walletTiendaMovimientoRepo: IWalletTiendaMovimientoRepository;
  walletTiendaFeedService: IWalletTiendaFeedService;
  pagoMensajeroMovimientoRepo: IPagoMensajeroMovimientoRepository;
  walletMensajeroFeedService: IWalletMensajeroFeedService;
  walletIndemnizacionFeedService: IWalletIndemnizacionFeedService;
  cajaCodFeed: ICajaCodFeedService;
}

/** El cliente que necesitan los tres repositorios REALES de los libros. */
export type AsientoPrismaClient = ConstructorParameters<typeof WalletMovimientoRepository>[0] &
  ConstructorParameters<typeof WalletTiendaMovimientoRepository>[0] &
  ConstructorParameters<typeof PagoMensajeroMovimientoRepository>[0];

/**
 * Las implementaciones REALES (R6). Quien construye un escritor de la conciliacion sin inyectar
 * nada recibe ESTAS, no un doble mudo: la memoria «el composition root que no inyecta» (2 de 7
 * notificadores muertos con la suite verde) es la razon de que exista el valor por defecto.
 */
export function dependenciasRealesDeAsiento(prisma: AsientoPrismaClient): DependenciasAsiento {
  return {
    walletMovimientoRepo: new WalletMovimientoRepository(prisma),
    walletFeedService: new WalletFeedService(),
    walletTiendaMovimientoRepo: new WalletTiendaMovimientoRepository(prisma),
    walletTiendaFeedService: new WalletTiendaFeedService(),
    pagoMensajeroMovimientoRepo: new PagoMensajeroMovimientoRepository(prisma),
    walletMensajeroFeedService: new WalletMensajeroFeedService(),
    walletIndemnizacionFeedService: new WalletIndemnizacionFeedService(),
    cajaCodFeed: new CajaCodFeedService(),
  };
}

/**
 * Los cinco escritores de dinero de un cierre, SIN CAMBIOS y EN EL MISMO ORDEN (R5). Corre dentro
 * de la transaccion del llamador (`tx`): si algo falla, se revierte con todo lo demas (R14).
 */
export async function asentarCierreDia(
  tx: Prisma.TransactionClient,
  cierreId: string,
  deps: DependenciasAsiento,
): Promise<void> {
  const movs = await deps.walletFeedService.construirMovimientosDeIngreso(cierreId, tx);
  await deps.walletMovimientoRepo.crearMovimientos(tx, movs); // R6/R13: idempotente
  // Feature 43/T10 (R5/R7/R12/R13): TRAS alimentar la 42, alimenta el LEDGER por tienda
  // en la MISMA tx (todo-o-nada: si falla, rollback de la aprobacion Y de la 42).
  const movsTienda = await deps.walletTiendaFeedService.construirMovimientosPorTienda(
    cierreId,
    tx,
  );
  await deps.walletTiendaMovimientoRepo.crearMovimientos(tx, movsTienda); // R6/R13: idempotente

  // Feature 173/T B.2 (design §3.1, R11/R12/R15): TRAS acreditar el ledger por tienda, el
  // CONTRA-ENTREGA entra en la CAJA PRINCIPAL, en la MISMA tx (todo-o-nada: si el insert
  // falla, la aprobacion entera revierte y no queda un cierre aprobado sin su COD).
  //
  // El orden respecto a la linea de arriba NO es estetico y no se sostiene en este
  // comentario: el feed LEE del ledger los creditos que `crearMovimientos` acaba de
  // escribir (R12), asi que invertirlo dejaria la caja sin el ingreso.
  // `cierres-admin-caja-cod.test.ts` lo afirma midiendo el orden real de las llamadas.
  //
  // La guardia es la transcripcion literal del antecedente de R13 —«si un cierre no
  // acredita contra-entrega alguno»—: la acreditacion es exactamente el credito
  // `cod_recaudado` que el feed de la 43 acaba de construir. Si no lo hay, no hay nada
  // que leer ni que emitir. NO decide el MONTO (eso sale del ledger y solo del ledger):
  // decide si hay algo que preguntar.
  const acreditoCod = movsTienda.some(
    (m) => m.tipo === "credito" && m.categoria === "cod_recaudado",
  );
  if (acreditoCod) {
    const ingresoCod = await deps.cajaCodFeed.construirIngresoCod(cierreId, tx);
    if (ingresoCod.length > 0) {
      // R14/R48: idempotente por el indice unico parcial (origen_tipo, origen_id,
      // categoria) de la 42. Re-aprobar NO emite un segundo ingreso, y la barrera es la
      // base, no un `if` de aqui.
      await deps.walletMovimientoRepo.crearMovimientos(tx, ingresoCod);
    }
  }

  // Feature 44/T10 (R5/R7/R11/R12/R17): TRAS 42 y 43, alimenta el LIBRO del pago por
  // mensajero EN LA MISMA tx (todo-o-nada). El feed lee el cierre una vez y devuelve el
  // libro (devengo + pago) Y el egreso egreso_pago_mensajero=P para la caja 42 (Qa=SI).
  const movsMensajero = await deps.walletMensajeroFeedService.construirMovimientosDePago(
    cierreId,
    tx,
  );
  await deps.pagoMensajeroMovimientoRepo.crearMovimientos(tx, movsMensajero.libro); // R6/R12: idempotente
  // Qa (R17): el egreso del costo total P se inserta con el repo de la 42, idempotente por
  // el constraint existente (origen_tipo, origen_id, categoria) -> un egreso por cierre. Se
  // toca la caja 42 SOLO si hay egreso (P>0); si P=0 el feed no lo emite y no se re-inserta.
  if (movsMensajero.egresoCaja.length > 0) {
    await deps.walletMovimientoRepo.crearMovimientos(tx, movsMensajero.egresoCaja);
  }

  // Feature 158 (T1.14, R26/R27/R28): TRAS 42/43/44, el EGRESO de indemnizacion, en la
  // MISMA tx. El feed lee de la base la suma de `gestion_orden.indemnizacion` de las
  // gestiones `incidente` de ESTE cierre —lo que la aprobacion escribio antes— y devuelve 0 o 1
  // movimiento. Cierre sin incidentes -> lista vacia -> ni una fila en 0.00 (R27). Se inserta
  // con el repo de la 42, idempotente por el indice unico parcial
  // `(origen_tipo, origen_id, categoria)`: reintentar NO duplica (R28).
  const egresoIndemnizacion =
    await deps.walletIndemnizacionFeedService.construirEgresoIndemnizacion(cierreId, tx);
  if (egresoIndemnizacion.length > 0) {
    await deps.walletMovimientoRepo.crearMovimientos(tx, egresoIndemnizacion);
  }
}
