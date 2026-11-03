import type { Actor } from "@/lib/interfaces/services/IOrdenService";
import type {
  ConsolidacionSateliteDTO,
  ListarConsolidacionesSateliteCompletoInput,
  ListarConsolidacionesSateliteInput,
  ListarSaldosSatelitesCompletoInput,
  ListarSaldosSatelitesInput,
  MarcarConsolidacionRecibidaInput,
  ResumenSatelitesDTO,
  RevertirConciliacionInputBorde,
  SaldoSateliteDTO,
} from "@/lib/types/conciliacion-satelites";
import type { ListarCompletoServiceResult } from "@/lib/types/descarga-listado";
import type { ListarPaginadoServiceResult } from "@/lib/types/listado-paginado";

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⭑ FICHA 431 — CONTRATO DEL SERVICIO DE CONCILIACION DE SATELITES.
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// Logica de negocio pura: no conoce HTTP (Request/Response/headers) ni Prisma. El borde (Server
// Action) resuelve `unauthenticated` y `validation_error`; el ROL lo decide ESTE servicio, porque
// es dominio y no transporte (R27, y el mismo reparto que `CierresBodegaAdminService`).
//
// QUIEN PUEDE (Q3, confirmado por el humano el 2026-09-16): `esAccesoTotal` = `maestro` **o**
// `admin`. Es exactamente quien aprueba hoy. Estrechar a `maestro` devolveria la dependencia de una
// sola persona, que es parte de lo que esta ficha viene a quitar.
//
// Money-safe: los importes cruzan como STRING de escala 2 en las dos direcciones (R20).

/** R23 — una pagina de la tabla de saldos por bodega satelite. */
export type ListarSaldosSatelitesServiceResult = ListarPaginadoServiceResult<SaldoSateliteDTO>;

/** R29 — el conjunto entero de saldos, para la descarga. */
export type ListarSaldosSatelitesCompletoServiceResult =
  ListarCompletoServiceResult<SaldoSateliteDTO>;

/** R24 — una pagina del desglose de consolidaciones de UNA bodega. */
export type ListarConsolidacionesSateliteServiceResult =
  ListarPaginadoServiceResult<ConsolidacionSateliteDTO>;

/** R29 — el desglose entero de esa bodega, para la descarga. */
export type ListarConsolidacionesSateliteCompletoServiceResult =
  ListarCompletoServiceResult<ConsolidacionSateliteDTO>;

/**
 * R9/R11 — el desenlace de MARCAR o de REVERTIR.
 *
 * `conflict` = la consolidacion existe pero ya no esta en el estado que la accion exige (R11: ya
 * estaba marcada; o al revertir, ya estaba pendiente). `no_encontrada` = no existe.
 *
 * NO hay `validation_error` aqui: el monto lo mata zod en el borde (R10). Si el servicio lo
 * redeclarara, serian dos definiciones de «cuanto dinero es valido».
 */
/**
 * ⭑ R20/R23 — las TRES cifras de cabecera de `/wallet/satelites`.
 *
 * Existe porque la pantalla NO PUEDE sumarlas: R20 prohibe aritmetica de dinero en el navegador y
 * las tres son sumas sobre TODAS las bodegas. `forbidden` por el mismo predicado que el resto.
 */
export type ResumenSatelitesServiceResult =
  | { status: "ok"; resumen: ResumenSatelitesDTO }
  | { status: "forbidden" };

export type MarcaConciliacionServiceResult =
  | { status: "ok"; cierreBodegaId: string }
  | { status: "conflict" }
  | { status: "no_encontrada" }
  | { status: "forbidden" }
  // FICHA 498 (Q5, R15a): recibido 0 con aporte reconocido positivo. No cambio nada.
  | { status: "recibido_cero_con_aporte" };

/**
 * FICHA 498 (R20/R21): revertir gana `con_asientos` — la consolidacion ya entro a la caja y no se
 * revierte nada; la pantalla pide corregir el monto en vez de revertir.
 */
export type RevertirConciliacionServiceResult =
  | { status: "ok"; cierreBodegaId: string }
  | { status: "conflict" }
  | { status: "no_encontrada" }
  | { status: "forbidden" }
  | { status: "con_asientos" }
  // FICHA 498 (revision m2): saldada con la regla anterior: no se revierte, se corrige.
  | { status: "saldada_regla_anterior" };

export interface IConciliacionSatelitesService {
  listarSaldosSatelites(
    input: ListarSaldosSatelitesInput,
    actor: Actor,
  ): Promise<ListarSaldosSatelitesServiceResult>;
  listarSaldosSatelitesCompleto(
    input: ListarSaldosSatelitesCompletoInput,
    actor: Actor,
  ): Promise<ListarSaldosSatelitesCompletoServiceResult>;
  listarConsolidacionesSatelite(
    input: ListarConsolidacionesSateliteInput,
    actor: Actor,
  ): Promise<ListarConsolidacionesSateliteServiceResult>;
  listarConsolidacionesSateliteCompleto(
    input: ListarConsolidacionesSateliteCompletoInput,
    actor: Actor,
  ): Promise<ListarConsolidacionesSateliteCompletoServiceResult>;
  /**
   * R9/R13 — marca la consolidacion como RECIBIDA con su monto. ⭑ FICHA 498 (R8-R15): marcar
   * ASIENTA el dinero de sus cierres en la caja y escribe la diferencia; despues ya no se desmarca,
   * se corrige. `recibido_cero_con_aporte` si el monto es 0 y hay dinero por entregar.
   */
  marcarRecibida(
    input: MarcarConsolidacionRecibidaInput,
    actor: Actor,
  ): Promise<MarcaConciliacionServiceResult>;
  /**
   * R12/R13 — deshace la marca. El monto que se borra queda en el historial. ⭑ FICHA 498 (R20/R22):
   * solo si la consolidacion NO tiene asientos; si los tiene, `con_asientos` sin cambiar nada.
   */
  revertirConciliacion(
    input: RevertirConciliacionInputBorde,
    actor: Actor,
  ): Promise<RevertirConciliacionServiceResult>;
  /**
   * ⭑ FICHA 473 (R1-R9) — CORRIGE el monto recibido de una consolidacion YA conciliada, sin pasar
   * por «Pendiente de conciliar». Mismo input que marcar (los campos son identicos) y mismo
   * resultado: `conflict` si ya no esta conciliada o su monto cambio entre lectura y escritura,
   * `no_encontrada` si no existe, `forbidden` sin acceso total. ⭑ FICHA 498 (R17-R19): escribe la
   * diferencia solo por la variacion; `recibido_cero_con_aporte` con la misma regla que marcar.
   */
  corregirRecibida(
    input: MarcarConsolidacionRecibidaInput,
    actor: Actor,
  ): Promise<MarcaConciliacionServiceResult>;
  /**
   * R20/R23 — las tres cifras de cabecera, YA CUADRADAS. No recibe input: el conjunto es «todas
   * las bodegas satelite», que es el mismo de la tabla que encabeza.
   */
  obtenerResumenSatelites(actor: Actor): Promise<ResumenSatelitesServiceResult>;
}
