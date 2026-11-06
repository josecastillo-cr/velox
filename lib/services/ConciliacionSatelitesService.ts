import { esAccesoTotal } from "@/lib/auth/acceso-total";
import { descargaConfig } from "@/lib/config/descarga";
import type {
  ICierresBodegaAdminRepository,
  MarcaConciliacionResult,
} from "@/lib/interfaces/repositories/ICierresBodegaAdminRepository";
import type { ISaldosSatelitesRepository } from "@/lib/interfaces/repositories/ISaldosSatelitesRepository";
import type { Actor } from "@/lib/interfaces/services/IOrdenService";
import type {
  IConciliacionSatelitesService,
  ListarConsolidacionesSateliteCompletoServiceResult,
  ListarConsolidacionesSateliteServiceResult,
  ListarSaldosSatelitesCompletoServiceResult,
  ListarSaldosSatelitesServiceResult,
  MarcaConciliacionServiceResult,
  ResumenSatelitesServiceResult,
  RevertirConciliacionServiceResult,
} from "@/lib/interfaces/services/IConciliacionSatelitesService";
import type {
  ListarConsolidacionesSateliteCompletoInput,
  ListarConsolidacionesSateliteInput,
  ListarSaldosSatelitesCompletoInput,
  ListarSaldosSatelitesInput,
  MarcarConsolidacionRecibidaInput,
  RevertirConciliacionInputBorde,
} from "@/lib/types/conciliacion-satelites";
import { rangoDePagina } from "@/lib/utils/rango-pagina";

/**
 * ⭑ FICHA 431 — LA CONCILIACION DE LAS CONSOLIDACIONES DE BODEGA.
 *
 * Responde la misma pregunta que `/wallet/tiendas` y `/wallet/mensajeros` ya responden para sus
 * dos poblaciones —«¿cuanta plata hay alla afuera que todavia no ha llegado?»—, solo que aqui en
 * vez de deberle a una tienda, una bodega te debe a ti.
 *
 * DOS REPOSITORIOS POR CONSTRUCTOR, y la asimetria es a proposito:
 *   · `ISaldosSatelitesRepository` — las LECTURAS. Nace con esta ficha y solo lee.
 *   · un `Pick` de `ICierresBodegaAdminRepository` con las DOS ESCRITURAS. No el contrato entero:
 *     este servicio no tiene nada que hacer con `findCierreBodegaConDetalle` ni con
 *     `resolverCierreBodega`, y un `Pick` deja escrito en el tipo exactamente lo que toca.
 *
 * EL GUARD DE ROL VA PRIMERO, ANTES DE TOCAR NINGUN REPOSITORIO, en las seis operaciones. Con el
 * guard despues, el saldo de todas las bodegas —dinero agregado de la operacion entera— ya habria
 * salido de la base aunque la respuesta fuera un error. Es el mismo orden de
 * `CierresBodegaAdminService` y por el mismo motivo.
 *
 * ⭑ FICHA 498 (decision del humano del 2026-11-02, que REVOCA el caracter informativo y reversible de
 * las fichas 431 y 473): marcar recibida ASIENTA el dinero de los cierres satelite en la caja y en los
 * libros, y escribe la diferencia; corregir escribe la diferencia por la variacion; revertir una
 * consolidacion con asientos responde `con_asientos` sin cambiar nada. El guard de rol sigue PRIMERO
 * tambien en esos caminos nuevos (R45).
 */
export class ConciliacionSatelitesService implements IConciliacionSatelitesService {
  constructor(
    private readonly saldos: ISaldosSatelitesRepository,
    private readonly escrituras: Pick<
      ICierresBodegaAdminRepository,
      "marcarConciliado" | "revertirConciliacion" | "corregirConciliacion"
    >,
  ) {}

  async listarSaldosSatelites(
    input: ListarSaldosSatelitesInput,
    actor: Actor,
  ): Promise<ListarSaldosSatelitesServiceResult> {
    if (!esAccesoTotal(actor.rol)) return { status: "forbidden" }; // R27

    const { items, total } = await this.saldos.findSaldosPaginado(rangoDePagina(input));
    return {
      status: "ok",
      items,
      page: input.page,
      pageSize: input.pageSize,
      total, // el total del CONJUNTO, nunca `items.length`
    };
  }

  async listarSaldosSatelitesCompleto(
    _input: ListarSaldosSatelitesCompletoInput,
    actor: Actor,
  ): Promise<ListarSaldosSatelitesCompletoServiceResult> {
    if (!esAccesoTotal(actor.rol)) return { status: "forbidden" }; // R27

    const items = await this.saldos.findSaldosCompleto();
    // El tope lo evalua y lo aplica el SERVICIO, y `limite_excedido` viaja SIN filas.
    if (items.length > descargaConfig.MAX_FILAS) {
      return { status: "limite_excedido", total: items.length, limite: descargaConfig.MAX_FILAS };
    }
    return { status: "ok", items, total: items.length };
  }

  async listarConsolidacionesSatelite(
    input: ListarConsolidacionesSateliteInput,
    actor: Actor,
  ): Promise<ListarConsolidacionesSateliteServiceResult> {
    if (!esAccesoTotal(actor.rol)) return { status: "forbidden" }; // R27

    const { items, total } = await this.saldos.findConsolidacionesPaginado(
      input.zonaId,
      rangoDePagina(input),
      input.soloSinConciliar,
    );
    return { status: "ok", items, page: input.page, pageSize: input.pageSize, total };
  }

  async listarConsolidacionesSateliteCompleto(
    input: ListarConsolidacionesSateliteCompletoInput,
    actor: Actor,
  ): Promise<ListarConsolidacionesSateliteCompletoServiceResult> {
    if (!esAccesoTotal(actor.rol)) return { status: "forbidden" }; // R27

    const items = await this.saldos.findConsolidacionesCompleto(
      input.zonaId,
      input.soloSinConciliar,
    );
    if (items.length > descargaConfig.MAX_FILAS) {
      return { status: "limite_excedido", total: items.length, limite: descargaConfig.MAX_FILAS };
    }
    return { status: "ok", items, total: items.length };
  }

  /**
   * R9/R11/R13 — MARCAR RECIBIDA.
   *
   * El monto llega YA validado por zod (`montoPositivoSchema`: STRING, > 0, ≤ 2 decimales). Aqui
   * NO se revalida y es deliberado: una segunda definicion de «cuanto dinero es valido» es la que
   * un dia diverge de la primera (leccion de la ficha 381).
   *
   * La `nota` opcional se normaliza a `null` en este punto —no en el repositorio— porque el
   * `CHECK` de la base distingue NULL de cadena vacia y el contrato del repositorio ya declara
   * `string | null`.
   */
  async marcarRecibida(
    input: MarcarConsolidacionRecibidaInput,
    actor: Actor,
  ): Promise<MarcaConciliacionServiceResult> {
    if (!esAccesoTotal(actor.rol)) return { status: "forbidden" }; // R27

    const res = await this.escrituras.marcarConciliado({
      id: input.cierreBodegaId,
      montoRecibido: input.montoRecibido,
      nota: input.nota ?? null,
      actorUsuarioId: actor.usuarioId,
    });
    return aResultadoDeMarca(res, input.cierreBodegaId); // R11: `conflict` = ya estaba marcada
  }

  /** R12/R13 — REVERTIR. El monto que se borra queda documentado en el historial. */
  async revertirConciliacion(
    input: RevertirConciliacionInputBorde,
    actor: Actor,
  ): Promise<RevertirConciliacionServiceResult> {
    if (!esAccesoTotal(actor.rol)) return { status: "forbidden" }; // R27

    const res = await this.escrituras.revertirConciliacion({
      id: input.cierreBodegaId,
      actorUsuarioId: actor.usuarioId,
    });
    // `switch` exhaustivo: un desenlace nuevo del repositorio no compila sin decidir su traduccion
    // (un `if` encadenado lo habria mandado en silencio a `no_encontrada`).
    switch (res) {
      case "updated":
        return { status: "ok", cierreBodegaId: input.cierreBodegaId };
      case "conflict":
        return { status: "conflict" }; // ya estaba pendiente de conciliar
      case "fuera_de_alcance":
        return { status: "no_encontrada" };
      case "con_asientos":
        return { status: "con_asientos" }; // FICHA 498 (R20)
      case "saldada_regla_anterior":
        return { status: "saldada_regla_anterior" }; // FICHA 498 (revision m2)
      default: {
        const _n: never = res;
        return _n;
      }
    }
  }

  /**
   * ⭑ FICHA 473 (R1-R9) — CORREGIR el monto de una consolidacion ya conciliada.
   *
   * Guard de rol PRIMERO (R9), antes de tocar el repositorio. El monto llega validado por el mismo
   * schema que marcar; la nota se normaliza a `null` aqui por el mismo motivo que en `marcarRecibida`.
   * Llama a `corregirConciliacion` y NUNCA a `marcarConciliado`: el `WHERE` de la marca exige una
   * consolidacion SIN marcar y responderia `conflict` siempre (el defecto de la ficha).
   */
  async corregirRecibida(
    input: MarcarConsolidacionRecibidaInput,
    actor: Actor,
  ): Promise<MarcaConciliacionServiceResult> {
    if (!esAccesoTotal(actor.rol)) return { status: "forbidden" }; // R9

    const res = await this.escrituras.corregirConciliacion({
      id: input.cierreBodegaId,
      montoRecibido: input.montoRecibido,
      nota: input.nota ?? null,
      actorUsuarioId: actor.usuarioId,
    });
    // R6/R8: `conflict` = ya no conciliada o monto movido; R7: `no_encontrada`.
    return aResultadoDeMarca(res, input.cierreBodegaId);
  }

  /**
   * R20/R23 — las TRES cifras de cabecera de `/wallet/satelites`, ya cuadradas por el repositorio.
   *
   * El guard va PRIMERO, igual que en las otras cinco: estas tres cifras son el dinero agregado de
   * la operacion entera, o sea la lectura mas sensible de la pantalla, no la menos.
   *
   * Aqui no se suma nada: el servicio deja pasar lo que el repositorio ya derivo con la MISMA
   * formula que la tabla. Sumar por segunda vez seria la copia que un dia dice otra cosa.
   */
  async obtenerResumenSatelites(actor: Actor): Promise<ResumenSatelitesServiceResult> {
    if (!esAccesoTotal(actor.rol)) return { status: "forbidden" }; // R27
    return { status: "ok", resumen: await this.saldos.findResumen() };
  }
}

/**
 * FICHA 498 — la traduccion de los desenlaces de marcar y corregir, con `switch` exhaustivo: un
 * desenlace nuevo del repositorio (como `recibido_cero_con_aporte`) no compila sin su traduccion, en
 * vez de caer en silencio en `no_encontrada`.
 */
function aResultadoDeMarca(res: MarcaConciliacionResult, cierreBodegaId: string): MarcaConciliacionServiceResult {
  switch (res) {
    case "updated":
      return { status: "ok", cierreBodegaId };
    case "conflict":
      return { status: "conflict" };
    case "fuera_de_alcance":
      return { status: "no_encontrada" };
    case "recibido_cero_con_aporte":
      return { status: "recibido_cero_con_aporte" }; // R15a
    default: {
      const _n: never = res;
      return _n;
    }
  }
}
