import type { CierreTotales } from "@/lib/interfaces/services/ICierreDiaService";
import type { CierreGestionDescargaDTO } from "@/lib/interfaces/services/ICierresAdminService";
import type { FiltrosDescargaGestiones } from "@/lib/types/filtros-cierres";
import type { CierreBodegaResumenRow } from "@/lib/interfaces/repositories/ICierreBodegaRepository";
import type { CierreGestionPendienteRow } from "@/lib/interfaces/repositories/ICierreDiaRepository";
import type { PaginaRepositorio, RangoPagina } from "@/lib/utils/rango-pagina";
import type { FiltrosCierresBodega } from "@/lib/types/filtros-cierres";

// Feature 40 — contrato del repositorio de "Cierres de bodega" del maestro (aprobar /
// rechazar). Solo queries Prisma; sin logica de negocio (esa vive en
// CierresBodegaAdminService). El maestro NO se acota por zona (todo va a la central).
// Money-safe: los Decimal se devuelven ya serializados a STRING. Reusa
// CierreGestionPendienteRow + WITH_DETALLE/toPendienteRow de la feature 37 para el
// detalle de gestiones.

// Cabecera de un cierre_dia incluido en un cierre de bodega (para el detalle): el
// mensajero + totales snapshot (STRING). El detalle deriva de sus gestiones.
export interface CierreBodegaDetalleCierreRow {
  cierreDiaId: string;
  mensajeroId: string;
  mensajeroNombre: string;
  totales: CierreTotales; // snapshot del cierre_dia (STRING escala 2)
  totalPagoMensajero: string; // feature 39/R20: snapshot del pago al mensajero del cierre_dia (STRING)
  totalIngresoBodegaRechazos: string; // feature 56/R19: snapshot del ingreso de bodega por rechazos del cierre_dia (STRING)
}

// Datos de la transicion guardada (aprobar/rechazar) de un cierre de bodega.
// `motivoRechazo` = null al aprobar; el motivo (ya validado) al rechazar.
export interface ResolverCierreBodegaInput {
  id: string;
  nuevoEstado: "aprobado" | "rechazado";
  resueltoPor: string;
  motivoRechazo: string | null;
}

// Resultado de la transicion guardada: `updated` (aplicada), `conflict` (existe pero
// ya no esta `solicitado`, R18), `fuera_de_alcance` (no existe, R19).
export type ResolverCierreBodegaResult = "updated" | "conflict" | "fuera_de_alcance";

/**
 * ⭑ FICHA 431 (R8/R9) — los datos de LA MARCA DE CONCILIACION: «este bulto de efectivo llego».
 *
 * `montoRecibido` viaja como STRING de escala 2 y NUNCA como `number`: es el mismo contrato
 * money-safe de todo el repo, y el repositorio lo convierte a `Prisma.Decimal` en el borde de la
 * escritura. `nota` es opcional SIEMPRE y no entra al historial (R5 de la 362: texto libre).
 */
export interface MarcarConciliadoInput {
  id: string;
  /**
   * STRING de escala 2, ya validado en el borde (`marcarConsolidacionRecibidaSchema`: > 0, o el cero
   * literal desde la ficha 498). Si es 0, el repositorio decide con el dato (R15a/R15b).
   */
  montoRecibido: string;
  nota: string | null;
  /** Quien marca (`esAccesoTotal`). Va a `conciliado_por` Y al espejo `resuelto_por` (§4.1). */
  actorUsuarioId: string;
}

/** ⭑ FICHA 431 (R12) — deshacer la marca. No hace falta monto: se BORRA el que hubiera. */
export interface RevertirConciliacionInput {
  id: string;
  actorUsuarioId: string;
}

/**
 * ⭑ FICHA 473 (R1-R8) — CORREGIR el monto de una consolidacion YA conciliada. Mismos campos que la
 * marca: el monto sustituye al registrado, la nota sustituye a la anterior (o la vacia) y el actor
 * pasa a ser el autor de la conciliacion. Un tipo con nombre propio porque es OTRA transicion.
 */
export interface CorregirConciliacionInput {
  id: string;
  /** STRING de escala 2, ya validado en el borde (> 0, o el cero literal desde la ficha 498). */
  montoRecibido: string;
  nota: string | null;
  /** Quien corrige (`esAccesoTotal`). Va a `conciliado_por` Y al espejo `resuelto_por`. */
  actorUsuarioId: string;
}

/**
 * ⭑ FICHA 431 — mismo trio de desenlaces que `ResolverCierreBodegaResult`, y a proposito: la
 * guarda por estado vive en el `WHERE` y `count !== 1` distingue «ya estaba asi» (R11) de «no
 * existe». Es un alias con nombre propio porque describe OTRA transicion, no la misma.
 */
export type MarcaConciliacionResult =
  | "updated"
  | "conflict"
  | "fuera_de_alcance"
  // FICHA 498 (Q5, design §4.4 bis, R15a): recibido 0 con aporte reconocido POSITIVO. Sin cambios.
  | "recibido_cero_con_aporte";

/**
 * FICHA 498 (design §4.6, R20): revertir gana un desenlace propio. `con_asientos` = la consolidacion
 * ya entro a la caja (filas de sus cierres en los libros o filas de ajuste): no se revierte nada.
 */
export type RevertirConciliacionResult =
  | "updated"
  | "conflict"
  | "fuera_de_alcance"
  | "con_asientos"
  // FICHA 498 (revision m2): saldada con la regla anterior (Q4). No se revierte: su marca de
  // regularizacion exige `conciliado_at` (CHECK de M4) y el humano la dio por saldada. Se corrige.
  | "saldada_regla_anterior";

export interface ICierresBodegaAdminRepository {
  /**
   * R15: todos los cierres de bodega, join a zona/usuario para nombres +
   * _count.cierresDia, orderBy solicitadoAt desc. Totales snapshot -> STRING. Sin
   * filtro de zona (el maestro es global).
   */
  findCierresBodega(): Promise<CierreBodegaResumenRow[]>;
  /**
   * Feature 184 — Tanda E (T E.1, R1/R14/R15/R16): el HISTORICO ENTERO (cierres de bodega ya
   * RESUELTOS), sin recorte. Es el conjunto del que sale el archivo del listado 5.
   *
   * NO es `findCierresBodega`: aquel devuelve la UNION de la cola y el historico, que es
   * justamente el listado compuesto que R1 prohibe releer para producir un archivo. Es
   * `findHistoricoPaginado` sin `skip`/`take` y sin el `count`, con el MISMO `where` y el MISMO
   * `orderBy` por construccion (R16), de modo que la pagina N es el segmento N de este conjunto
   * (R5). UNA sola consulta (R15).
   */
  /**
   * Pedido humano del 2026-08-16 — `filtros` es OPCIONAL (fecha + zona, SIN mensajero: un cierre
   * de bodega consolida los de varios) y RECORTA dentro del alcance, componiendose con `AND` y
   * nunca en lugar de el. Omitirlo deja el criterio IDENTICO al de antes.
   */
  findHistoricoCompleto(filtros?: FiltrosCierresBodega): Promise<CierreBodegaResumenRow[]>;
  /**
   * Feature 184 — Tanda E (T E.1, R1/R14/R15/R16): la COLA ENTERA de cierres de bodega
   * PENDIENTES (`solicitado`), sin recorte. Es el conjunto del que sale el archivo del listado 4.
   *
   * COMPLEMENTO EXACTO del de arriba, con la MISMA constante de estados (`in` aqui, `notIn`
   * alli): los dos conjuntos particionan la tabla igual que las dos paginas.
   */
  findColaCompleta(filtros?: FiltrosCierresBodega): Promise<CierreBodegaResumenRow[]>;
  /**
   * Feature 170 — FASE 2 (T I.1, R40/R41/R44/R51/R54): UNA PAGINA del historico (los cierres
   * de bodega ya RESUELTOS) + el TOTAL del conjunto.
   *
   * Es `findCierresBodega` con dos anadidos: `estado NOT IN <cola>` —el espejo del `else`
   * con que el servicio parte hoy las dos listas (R44)— y el recorte `skip`/`take`. Mismo
   * `orderBy solicitadoAt desc` (R51) y mismas proyecciones. Pagina y total en la MISMA
   * llamada: el `count` es la unica consulta que R54 permite anadir.
   */
  findHistoricoPaginado(
    rango: RangoPagina,
    filtros?: FiltrosCierresBodega,
  ): Promise<PaginaRepositorio<CierreBodegaResumenRow>>;
  /**
   * Feature 170 — FASE 2 (T J.1, R40/R41/R44/R51/R54): UNA PAGINA de la COLA de cierres de
   * bodega PENDIENTES (`solicitado`) + el TOTAL del conjunto, que es el que la cabecera de la
   * pantalla mostrara (R42).
   *
   * COMPLEMENTO EXACTO de `findHistoricoPaginado`: misma proyeccion, mismo orden y la MISMA
   * constante de estados, con `in` en vez de `notIn`.
   */
  findColaPaginada(
    rango: RangoPagina,
    filtros?: FiltrosCierresBodega,
  ): Promise<PaginaRepositorio<CierreBodegaResumenRow>>;
  /**
   * R11: el cierre de bodega (cabecera + totales snapshot) + por cada cierre_dia
   * incluido (WHERE cierre_bodega_id=id) su cabecera y sus gestiones (WITH_DETALLE,
   * reuso 37, WHERE cierre_id=cierre_dia.id). `null` si el cierre de bodega no existe
   * (R19).
   */
  findCierreBodegaConDetalle(id: string): Promise<{
    cierre: CierreBodegaResumenRow;
    cierresDia: {
      resumen: CierreBodegaDetalleCierreRow;
      gestiones: CierreGestionPendienteRow[];
    }[];
    /** FICHA 500 (R3/R4): conciliada, sin dinero (`consolidacionesConDinero`) y no saldada con la regla anterior. */
    puedeDesmarcar: boolean;
  } | null>;
  /**
   * Feature 230 — Tanda 7 (T7.1, R11/R24/R26/R41): TODAS las gestiones de los cierres del dia YA
   * CONSOLIDADOS en un cierre de bodega que casan los recortes del dialogo, a grano de GESTION.
   *
   * `cierre_bodega_id IS NOT NULL` en el WHERE es la traduccion exacta de R24. Sin alcance por
   * zona: este listado es de acceso total y el guard de rol vive en el servicio (R25).
   *
   * MISMA proyeccion, MISMO orden y MISMO compositor que el camino de «cierres del dia» (R26):
   * las dos salidas tienen que producir la misma fila o el mismo mensajero saldria distinto
   * segun desde donde se descargue.
   *
   * FICHA 394 (2026-09-08) — y el MISMO derivador en lote de `intentosEntrega`
   * (`contarIntentosVigentesEnLoteCon`), por ese mismo R26: si esta hoja contara los intentos
   * de otra forma que la de «cierres del dia», la misma orden saldria con dos numeros.
   */
  findGestionesDeCierresBodegaCompleto(
    filtros: FiltrosDescargaGestiones,
  ): Promise<CierreGestionDescargaDTO[]>;
  /**
   * R16-R22: transicion atomica y guardada de `solicitado` -> nuevoEstado, SOLO si el
   * cierre de bodega sigue `solicitado` (updateMany con guardia de estado). Un solo
   * UPDATE de estado + auditoria; NO toca cierre_dia ni otra tabla (R21/R22).
   * Distingue updated/conflict/fuera_de_alcance.
   */
  resolverCierreBodega(input: ResolverCierreBodegaInput): Promise<ResolverCierreBodegaResult>;
  /**
   * ⭑ FICHA 431 (R8/R9/R11/R13) — MARCA una consolidacion como RECIBIDA, con su monto.
   *
   * Guarda por estado en el `WHERE` (`estado='solicitado'` Y `conciliado_at IS NULL`), atomico con
   * su fila de historial (`cierre_bodega_conciliado`) dentro de la MISMA `$transaction`.
   *
   * ⚠️ ESCRIBE TAMBIEN `resuelto_at`/`resuelto_por` EN ESPEJO, y no es duplicacion por descuido:
   * el repositorio de analitica de conciliacion de cierres (`contarCierresPorEstado`, que NO se
   * nombra entero aqui a proposito: la guardia de fuente de la 127 mete en su censo cualquier
   * archivo que escriba su nombre, y este no es un archivo de analitica) selecciona los cierres
   * aprobados POR `resuelto_at` dentro del rango. Si la marca no los rellenara, los cierres de
   * bodega desaparecerian de la analitica financiera sin que nada se pusiera rojo.
   *
   * ⭑ FICHA 498 (R8-R15) — MARCAR ASIENTA EL DINERO. En la MISMA transaccion: asienta cada cierre
   * satelite aprobado de la consolidacion en los tres libros (`asentarCierreDia`) y, si el recibido
   * no es el esperado, escribe UNA fila de ajuste y UN movimiento de caja de «diferencia de la
   * satelite». Ya no es reversible: despues se corrige. Recibido 0 con aporte positivo →
   * `recibido_cero_con_aporte` sin escribir nada (R15a).
   */
  marcarConciliado(input: MarcarConciliadoInput): Promise<MarcaConciliacionResult>;
  /**
   * ⭑ FICHA 431 (R12/R13) — DESHACE la marca: vuelve a `solicitado` y VACIA las cuatro columnas de
   * la conciliacion mas las dos del espejo (`resuelto_at`/`resuelto_por`).
   *
   * ⚠️ METODO PROPIO Y NO UN BOOLEANO EN `marcarConciliado`. La guardia del censo de historial mide
   * POR METODO, no por escritura (medido en las fichas 376 y 380): con las dos acciones en el
   * mismo metodo, borrar uno de los dos `appendAccion` la dejaria VERDE.
   *
   * ⚠️ CONSECUENCIA DECLARADA: revertir CAMBIA HACIA ATRAS lo que la analitica financiera cuenta en
   * ese periodo, porque vacia el `resuelto_at` del que se sirve. Es lo correcto —no se recibio— y
   * se escribe aqui para que no sorprenda.
   *
   * El `monto` de la fila de historial es EL QUE SE BORRA: tras esto, ningun sitio de
   * `cierre_bodega` recuerda cuanto se habia dado por recibido.
   */
  /**
   * ⭑ FICHA 498 (R20/R22): si la consolidacion tiene asientos (filas de sus cierres en los libros o
   * filas de ajuste) responde `con_asientos` sin cambiar NADA. Sin asientos, revierte como antes.
   */
  revertirConciliacion(input: RevertirConciliacionInput): Promise<RevertirConciliacionResult>;
  /**
   * ⭑ FICHA 473 (R1-R8) — CORRIGE el monto recibido de una consolidacion que SIGUE conciliada, en una
   * sola transaccion y sin pasar por «Pendiente de conciliar».
   *
   * Guarda en el `WHERE`: `estado='aprobado'` Y `conciliado_at IS NOT NULL` (R6) Y el monto leido en
   * la misma transaccion (compare-and-swap, R8). Reescribe monto, nota, autor/instante de la
   * conciliacion y el espejo `resuelto_*` (D3: la analitica la cuenta en el periodo de la correccion).
   *
   * ⚠️ METODO PROPIO Y NO UN BOOLEANO EN `marcarConciliado` (la guardia del censo mide POR METODO).
   * Reusa el tipo `cierre_bodega_conciliado` (D1); su fila se distingue de una marca porque lleva
   * `valor_anterior`/`valor_nuevo`. La nota NO entra al historial.
   *
   * ⭑ FICHA 498 (R17-R19): escribe la DIFERENCIA solo por la variacion (fila de ajuste `correccion`
   * + un movimiento de caja), contra el aporte reconocido; no vuelve a asentar los cierres y no
   * modifica ni borra nada anterior. Recibido 0 con aporte positivo → `recibido_cero_con_aporte`.
   */
  corregirConciliacion(input: CorregirConciliacionInput): Promise<MarcaConciliacionResult>;
}
