import { Prisma, type PrismaClient } from "@prisma/client";

import type { ISaldosSatelitesRepository } from "@/lib/interfaces/repositories/ISaldosSatelitesRepository";
import type {
  ConsolidacionSateliteDTO,
  ResumenSatelitesDTO,
  SaldoSateliteDTO,
  UltimaRecibidaDTO,
} from "@/lib/types/conciliacion-satelites";
import {
  aporteDeConsolidacion,
  deudaDeZona,
  esSaldadaReglaAnterior,
  faltaPorRecibir,
  puedeDesmarcarse,
} from "@/lib/utils/conciliacion-satelite";
import {
  consolidacionesConDinero,
  type ClienteConDinero,
} from "@/lib/repositories/consolidaciones-con-dinero";
import {
  aporteCierreSql,
  cuentaEnLaDeudaSql,
  saldadaReglaAnteriorSql,
  sinConsolidarSql,
} from "@/lib/repositories/deuda-satelite-sql";
import { paraLaCentral } from "@/lib/utils/ingreso-empresa";
import { diasNaturalesCRDesde, inicioDelMesCREnUtc } from "@/lib/utils/fecha-cr";
import { CUENTA_USUARIO_SELECT, etiquetaDeCuenta } from "@/lib/utils/etiqueta-cuenta";
import type { PaginaRepositorio, RangoPagina } from "@/lib/utils/rango-pagina";

/**
 * ⭑ FICHA 431 → FICHA 498 — LA DEUDA DE LAS BODEGAS SATELITE. Solo consultas; cero logica de
 * negocio (el guard de rol lo aplica `ConciliacionSatelitesService` ANTES de llegar aqui).
 *
 * ⭑ FICHA 498 (R23-R25, decision del humano del 2026-11-02, que REVOCA la Q2 del 2026-09-16): la
 * deuda ya no es el efectivo. Es Σ aportes de los cierres aprobados de la zona (todos los metodos de
 * pago, menos lo que pertenece a la satelite), consolidados o no, + Σ aporte reconocido de sus
 * saldadas con la regla anterior − Σ recibido. Las piezas SQL viven en `deuda-satelite-sql.ts`; las
 * de TypeScript en `lib/utils/conciliacion-satelite.ts`. Las filas, la descarga y la cabecera salen
 * de las MISMAS dos agregaciones (`agregarDeuda`), asi que la suma de las filas ES la cabecera.
 */

/** El estado retirado de la pantalla (D2). En produccion hay CERO; queda declarado como limite. */
const ESTADO_RECHAZADO = "rechazado";

/** Solo las bodegas SATELITE: la central no se consolida a si misma. */
const ZONA_SATELITE_WHERE = { esCentral: false } as const;

/**
 * El alcance del DINERO: todas las consolidaciones de la zona que no esten rechazadas — incluidas
 * las YA conciliadas, porque sin ellas la diferencia parcial de R18 desapareceria del saldo.
 */
const NO_RECHAZADAS = { estado: { not: ESTADO_RECHAZADO } } as const;

const DEUDA_CERO = {
  deuda: new Prisma.Decimal(0),
  sinConsolidar: new Prisma.Decimal(0),
  cierresSinConsolidar: 0,
  efectivo: new Prisma.Decimal(0),
  general: new Prisma.Decimal(0),
  recibido: new Prisma.Decimal(0),
} as const;

const CONSOLIDACION_SELECT = {
  id: true,
  solicitadoAt: true,
  totalEfectivo: true,
  totalSimpe: true,
  totalTransferencia: true,
  totalGeneral: true,
  // FICHA 498 (R41/R41a): lo que pertenece a la satelite y la marca de la regularizacion.
  totalPagoMensajero: true,
  totalIngresoBodegaRechazos: true,
  esperadoReglaAnterior: true,
  montoRecibido: true,
  conciliadoAt: true,
  conciliadoNota: true,
  conciliadoPorUsuario: { select: CUENTA_USUARIO_SELECT },
  _count: { select: { cierresDia: true } },
} as const;

type ConsolidacionRow = Prisma.CierreBodegaGetPayload<{ select: typeof CONSOLIDACION_SELECT }>;

// LA FORMULA (R17/R18) vive en `lib/utils/conciliacion-satelite.ts` y se importa arriba.
//
// ⭑ FICHA 431 (pasada de frontend) — SALIO DE ESTE ARCHIVO al ganar su SEGUNDO lector en el
// servidor: `CierreBodegaRepository.toBodegaResumenRow`, que deriva el MISMO `faltaPorRecibir`
// para las superficies de `/cierres-admin` —las que ve la bodega satelite (R26)—. Copiarla habria
// dejado a la satelite y a la central capaces de leer la misma consolidacion con dos cifras
// distintas. Sigue siendo `Prisma.Decimal` -> `toFixed(2)` en el emisor; aqui no cambia nada mas.

function toConsolidacionDTO(r: ConsolidacionRow, conDinero: boolean): ConsolidacionSateliteDTO {
  const debe = aporteDeConsolidacion(r);
  const conciliado = r.conciliadoAt !== null;
  const saldadaReglaAnterior = esSaldadaReglaAnterior(r);
  return {
    cierreBodegaId: r.id,
    solicitadoAt: r.solicitadoAt.toISOString(),
    totales: {
      efectivo: r.totalEfectivo.toFixed(2),
      simpe: r.totalSimpe.toFixed(2),
      transferencia: r.totalTransferencia.toFixed(2),
      general: r.totalGeneral.toFixed(2),
    },
    montoRecibido: r.montoRecibido === null ? null : r.montoRecibido.toFixed(2),
    // FICHA 498 (R26): la resta se hace AQUI, con Decimal, sobre lo que DEBE. La pantalla no resta.
    faltaPorRecibir: faltaPorRecibir(debe, r.montoRecibido).toFixed(2),
    totalPagoMensajero: r.totalPagoMensajero.toFixed(2),
    totalIngresoBodegaRechazos: r.totalIngresoBodegaRechazos.toFixed(2),
    paraLaCentral: paraLaCentral(
      r.totalGeneral.toFixed(2),
      r.totalPagoMensajero.toFixed(2),
      r.totalIngresoBodegaRechazos.toFixed(2),
    ),
    debe: debe.toFixed(2),
    debePositivo: debe.greaterThan(0),
    saldadaReglaAnterior,
    // ⭑ FICHA 500 (R3/R4): los MISMOS dos cortes que `revertirConciliacion`.
    puedeDesmarcar: puedeDesmarcarse({ conciliado, conDinero, saldadaReglaAnterior }),
    conciliado,
    conciliadoAt: r.conciliadoAt === null ? null : r.conciliadoAt.toISOString(),
    conciliadoPorNombre:
      r.conciliadoPorUsuario === null ? null : etiquetaDeCuenta(r.conciliadoPorUsuario),
    nota: r.conciliadoNota,
    cantidadCierres: r._count.cierresDia,
  };
}

// FICHA 500: + los cinco delegados de `consolidacionesConDinero` (R1).
type ClienteSaldosSatelites = Pick<PrismaClient, "cierreBodega" | "zona" | "$queryRaw"> &
  ClienteConDinero;

/** FICHA 498: lo que las dos agregaciones de la deuda dan por zona (R23/R24). */
interface DeudaDeZona {
  deuda: Prisma.Decimal;
  sinConsolidar: Prisma.Decimal;
  cierresSinConsolidar: number;
  efectivo: Prisma.Decimal;
  general: Prisma.Decimal;
  recibido: Prisma.Decimal;
}

export class SaldosSatelitesRepository implements ISaldosSatelitesRepository {
  constructor(private readonly prisma: ClienteSaldosSatelites) {}

  async findSaldosPaginado(rango: RangoPagina): Promise<PaginaRepositorio<SaldoSateliteDTO>> {
    const [zonas, total] = await Promise.all([
      this.prisma.zona.findMany({
        where: ZONA_SATELITE_WHERE,
        orderBy: { nombre: "asc" },
        skip: rango.skip,
        take: rango.take,
        select: { id: true, nombre: true },
      }),
      this.prisma.zona.count({ where: ZONA_SATELITE_WHERE }),
    ]);
    return { items: await this.componerSaldos(zonas), total };
  }

  async findSaldosCompleto(): Promise<SaldoSateliteDTO[]> {
    // MISMO `where` y MISMO `orderBy` que la pagina, a proposito: la pagina N tiene que ser el
    // segmento N de este conjunto o la descarga describiria otra cosa que la pantalla.
    const zonas = await this.prisma.zona.findMany({
      where: ZONA_SATELITE_WHERE,
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    });
    return this.componerSaldos(zonas);
  }

  /**
   * LAS DOS AGREGACIONES, Y POR QUE SON DOS. Preguntan cosas distintas sobre poblaciones distintas:
   *
   *  (a) EL DINERO — incluye lo ya conciliado. Sin ello, una consolidacion marcada por menos de lo
   *      declarado dejaria de aportar su diferencia y el saldo perderia exactamente el caso que
   *      R18 existe para cubrir.
   *  (b) LA COLA — solo lo que sigue SIN marcar, que es lo que se cuenta (R21) y de lo que se mide
   *      la antiguedad.
   *
   * Un `groupBy` de Prisma no hace agregados condicionales, y meterlo en un `$queryRaw` con
   * `FILTER (WHERE …)` cambiaria dos consultas legibles por una cadena de SQL a mano en un camino
   * de dinero.
   *
   * Los nombres de zona NO se resuelven en el cliente: llegan de la lectura de `zona` de arriba.
   */
  private async componerSaldos(
    zonas: { id: string; nombre: string }[],
  ): Promise<SaldoSateliteDTO[]> {
    if (zonas.length === 0) return [];
    const zonaIds = zonas.map((z) => z.id);
    const ahora = new Date();

    const [deudas, cola, ultimas] = await Promise.all([
      this.agregarDeuda(zonaIds),
      this.prisma.cierreBodega.groupBy({
        by: ["zonaId"],
        where: { zonaId: { in: zonaIds }, conciliadoAt: null, ...NO_RECHAZADAS },
        _count: { _all: true },
        _min: { solicitadoAt: true },
      }),
      // (c) LA ULTIMA RECIBIDA — el INSTANTE de la mas reciente de cada zona. Solo la fecha: un
      // `groupBy` devuelve agregados, no la fila que los produjo, asi que el importe se busca
      // despues con esa fecha.
      this.prisma.cierreBodega.groupBy({
        by: ["zonaId"],
        where: { zonaId: { in: zonaIds }, conciliadoAt: { not: null }, ...NO_RECHAZADAS },
        _max: { conciliadoAt: true },
      }),
    ]);

    const colaPorZona = new Map(cola.map((c) => [c.zonaId, c]));
    const ultimaPorZona = await this.leerUltimasRecibidas(ultimas);

    return zonas.map((zona) => {
      const d = deudas.get(zona.id) ?? DEUDA_CERO;
      const c = colaPorZona.get(zona.id);
      const masAntigua = c?._min.solicitadoAt ?? null;

      return {
        zonaId: zona.id,
        zonaNombre: etiquetaDeCuenta(zona),
        saldoSinConciliar: d.deuda.toFixed(2),
        sinConsolidar: d.sinConsolidar.toFixed(2),
        cierresSinConsolidar: d.cierresSinConsolidar,
        totalEfectivo: d.efectivo.toFixed(2),
        totalConsolidado: d.general.toFixed(2),
        totalRecibido: d.recibido.toFixed(2),
        consolidacionesSinConciliar: c?._count._all ?? 0,
        // R21: los dias se derivan EN EL SERVIDOR con el calendario de Costa Rica. `null` = no hay
        // cola, que NO es lo mismo que `0` («la mas vieja es de hoy»).
        diasDeLaMasAntigua: masAntigua === null ? null : diasNaturalesCRDesde(masAntigua, ahora),
        fechaDeLaMasAntigua: masAntigua === null ? null : masAntigua.toISOString(),
        // La ULTIMA que llego. `null` = a esta bodega nunca se le marco ninguna. NO es el
        // acumulado `totalRecibido` que va arriba: es UNA fila, con su fecha y su importe.
        ultimaRecibida: ultimaPorZona.get(zona.id) ?? null,
      };
    });
  }

  /**
   * ⭑ FICHA 498 (design §6, R23-R25) — LAS DOS AGREGACIONES DE LA DEUDA, por zona. Las comparten las
   * filas, la descarga y la cabecera: por construccion, Σ filas = cabecera.
   *
   *  1. APORTES, sobre `cierre_dia` (con `LEFT JOIN cierre_bodega`): los cierres que cuentan en la
   *     deuda y NO pertenecen a una saldada con la regla anterior. Σ aporte, y con `FILTER` el
   *     aporte y el conteo de los sin consolidar.
   *  2. RECIBIDO y APORTE RECONOCIDO de las saldadas, sobre las consolidaciones no rechazadas
   *     (Σ `monto_recibido` y Σ `esperado_regla_anterior`, que solo suma las saldadas).
   *
   *  deuda = deudaDeZona(aportes + Σ esperado_regla_anterior, recibido). Una saldada aporta su
   *  `monto_recibido` por los dos lados y suma 0 (R54c).
   */
  private async agregarDeuda(zonaIds: string[]): Promise<Map<string, DeudaDeZona>> {
    if (zonaIds.length === 0) return new Map();
    const [aportes, consolidaciones] = await Promise.all([
      this.prisma.$queryRaw<
        { zona_id: string; aportes: Prisma.Decimal | null; sin_consolidar: Prisma.Decimal | null; cierres: number }[]
      >`
        SELECT c.destino_zona_id AS zona_id,
               SUM(${aporteCierreSql("c")}) AS aportes,
               SUM(${aporteCierreSql("c")}) FILTER (WHERE ${sinConsolidarSql("c", "cb")}) AS sin_consolidar,
               (COUNT(*) FILTER (WHERE ${sinConsolidarSql("c", "cb")}))::int AS cierres
          FROM cierre_dia c
          LEFT JOIN cierre_bodega cb ON cb.id = c.cierre_bodega_id
         WHERE ${cuentaEnLaDeudaSql("c")}
           AND NOT COALESCE(${saldadaReglaAnteriorSql("cb")}, false)
           AND c.destino_zona_id = ANY(${zonaIds}::text[])
         GROUP BY c.destino_zona_id`,
      this.prisma.cierreBodega.groupBy({
        by: ["zonaId"],
        where: { zonaId: { in: zonaIds }, ...NO_RECHAZADAS },
        _sum: {
          totalEfectivo: true,
          totalGeneral: true,
          montoRecibido: true,
          esperadoReglaAnterior: true,
        },
      }),
    ]);
    const cero = new Prisma.Decimal(0);
    const aportesPorZona = new Map(aportes.map((a) => [a.zona_id, a]));
    const consolidacionesPorZona = new Map(consolidaciones.map((g) => [g.zonaId, g]));
    const salida = new Map<string, DeudaDeZona>();
    for (const zonaId of zonaIds) {
      const a = aportesPorZona.get(zonaId);
      const g = consolidacionesPorZona.get(zonaId);
      // `SUM`/`_sum` de un conjunto vacio es NULL: una bodega sin nada vale CERO.
      const deCierres = a?.aportes === null || a === undefined ? cero : new Prisma.Decimal(a.aportes);
      const reconocido = g?._sum.esperadoReglaAnterior ?? cero;
      // `_sum.montoRecibido` ignora los NULL, que es justo lo que la formula quiere.
      const recibido = g?._sum.montoRecibido ?? cero;
      salida.set(zonaId, {
        deuda: deudaDeZona(deCierres.plus(reconocido), recibido),
        sinConsolidar:
          a?.sin_consolidar === null || a === undefined ? cero : new Prisma.Decimal(a.sin_consolidar),
        cierresSinConsolidar: a === undefined ? 0 : a.cierres, // `::int` en el SQL: un conteo, no dinero
        efectivo: g?._sum.totalEfectivo ?? cero,
        general: g?._sum.totalGeneral ?? cero,
        recibido,
      });
    }
    return salida;
  }

  /**
   * ⭑ LA ULTIMA CONSOLIDACION RECIBIDA de cada zona, en DOS pasos y no en uno.
   *
   * POR QUE DOS: el `groupBy` de arriba sabe CUANDO fue la ultima (`_max.conciliado_at`) pero no
   * devuelve la fila que lo produjo, y el importe vive en esa fila. Aqui se piden exactamente
   * esas N filas —una por zona con alguna recibida— por su par (zona, instante).
   *
   * POR QUE NO UN `findMany` + `distinct`: el recorte a una fila por zona lo haria Prisma, pero
   * si la version de turno no empuja el `DISTINCT ON` a Postgres, la consulta se trae TODAS las
   * consolidaciones conciliadas de la operacion para quedarse con cinco. Este par de consultas
   * esta acotado por construccion —como mucho una fila por zona— y no depende de esa semantica.
   *
   * EL EMPATE, dicho: dos consolidaciones de la MISMA zona marcadas en el MISMO microsegundo
   * traerian dos filas. Se queda la primera y es DETERMINISTA por el `orderBy`: entre dos bultos
   * marcados a la vez, cualquiera de los dos responde igual de bien a «cuando llego el ultimo»,
   * pero alternar entre ellos en dos recargas si seria un defecto.
   */
  private async leerUltimasRecibidas(
    ultimas: { zonaId: string; _max: { conciliadoAt: Date | null } }[],
  ): Promise<Map<string, UltimaRecibidaDTO>> {
    const pares = ultimas.flatMap((u) =>
      u._max.conciliadoAt === null ? [] : [{ zonaId: u.zonaId, conciliadoAt: u._max.conciliadoAt }],
    );
    if (pares.length === 0) return new Map();

    const filas = await this.prisma.cierreBodega.findMany({
      where: { OR: pares },
      orderBy: [{ conciliadoAt: "desc" }, { id: "asc" }], // el desempate, ver arriba
      select: {
        zonaId: true,
        conciliadoAt: true,
        montoRecibido: true,
        totalGeneral: true,
        totalPagoMensajero: true,
        totalIngresoBodegaRechazos: true,
        esperadoReglaAnterior: true,
      },
    });

    const porZona = new Map<string, UltimaRecibidaDTO>();
    for (const f of filas) {
      // `conciliadoAt` no puede ser nulo aqui —se busco por su valor— pero el tipo lo admite y
      // un `!` seria la afirmacion que un dia deja de ser cierta sin avisar.
      if (f.conciliadoAt === null || porZona.has(f.zonaId)) continue;
      const debe = aporteDeConsolidacion(f);
      porZona.set(f.zonaId, {
        fecha: f.conciliadoAt.toISOString(),
        // Una fila con `conciliado_at` SIEMPRE tiene `monto_recibido`: lo impone el `CHECK`
        // `cierre_bodega_conciliacion_coherente`. El `?? 0` es la lectura defensiva del tipo
        // nulable, no una suposicion sobre el dato.
        monto: (f.montoRecibido ?? new Prisma.Decimal(0)).toFixed(2),
        // FICHA 498: lo que DEBIA (aporte reconocido), no el efectivo.
        declarado: debe.toFixed(2),
        // R26: la resta de ESA fila, con la MISMA `faltaPorRecibir` de toda la ficha.
        faltaPorRecibir: faltaPorRecibir(debe, f.montoRecibido).toFixed(2),
      });
    }
    return porZona;
  }

  async findConsolidacionesPaginado(
    zonaId: string,
    rango: RangoPagina,
    soloSinConciliar?: boolean,
  ): Promise<PaginaRepositorio<ConsolidacionSateliteDTO>> {
    // El `where` se construye UNA vez y lo comparten `findMany` y `count`. Que el `zonaId` sea el
    // MISMO objeto en las dos consultas no es cosmetico: es lo que impide que el total cuente las
    // consolidaciones de toda la operacion mientras la pagina muestra las de una bodega.
    const where = this.consolidacionesWhere(zonaId, soloSinConciliar);
    const [rows, total] = await Promise.all([
      this.prisma.cierreBodega.findMany({
        where,
        orderBy: { solicitadoAt: "desc" },
        skip: rango.skip,
        take: rango.take,
        select: CONSOLIDACION_SELECT,
      }),
      this.prisma.cierreBodega.count({ where }),
    ]);
    // FICHA 500 (R1/R3): UNA llamada por pagina, no por fila.
    const conDinero = await consolidacionesConDinero(this.prisma, rows.map((r) => r.id));
    return { items: rows.map((r) => toConsolidacionDTO(r, conDinero.has(r.id))), total };
  }

  async findConsolidacionesCompleto(
    zonaId: string,
    soloSinConciliar?: boolean,
  ): Promise<ConsolidacionSateliteDTO[]> {
    const rows = await this.prisma.cierreBodega.findMany({
      where: this.consolidacionesWhere(zonaId, soloSinConciliar),
      orderBy: { solicitadoAt: "desc" }, // el MISMO orden que la pagina (R29)
      select: CONSOLIDACION_SELECT,
    });
    const conDinero = await consolidacionesConDinero(this.prisma, rows.map((r) => r.id));
    return rows.map((r) => toConsolidacionDTO(r, conDinero.has(r.id)));
  }

  /** UN solo `where` para las cuatro lecturas del desglose, por el motivo de arriba. */
  private consolidacionesWhere(zonaId: string, soloSinConciliar?: boolean) {
    return {
      zonaId,
      ...NO_RECHAZADAS,
      ...(soloSinConciliar === true ? { conciliadoAt: null } : {}),
    };
  }

  /**
   * ⭑ R20/R23 → FICHA 498 (R25) — LAS TRES CIFRAS DE CABECERA, derivadas en el servidor.
   *
   * «Pendiente» = Σ de las deudas por zona calculadas con las MISMAS dos agregaciones que las filas
   * (`agregarDeuda`) sobre TODAS las zonas satelite: la suma de la columna de la tabla ES esta
   * cifra. «Bodegas con pendiente» sale de ese mismo mapa.
   *
   * «Recibido este mes» y «Con diferencia» se leen por consolidacion (las no rechazadas): la
   * diferencia de cada conciliada es `faltaPorRecibir` sobre su aporte reconocido, y solo cuenta el
   * faltante POSITIVO (una que llego de mas no compensa a otra que llego de menos).
   */
  async findResumen(ahora: Date = new Date()): Promise<ResumenSatelitesDTO> {
    const [zonas, filas] = await Promise.all([
      this.prisma.zona.findMany({ where: ZONA_SATELITE_WHERE, select: { id: true } }),
      this.prisma.cierreBodega.findMany({
        where: { ...NO_RECHAZADAS, zona: ZONA_SATELITE_WHERE },
        select: {
          totalGeneral: true,
          totalPagoMensajero: true,
          totalIngresoBodegaRechazos: true,
          esperadoReglaAnterior: true,
          montoRecibido: true,
          conciliadoAt: true,
        },
      }),
    ]);
    const deudas = await this.agregarDeuda(zonas.map((z) => z.id));

    let pendiente = new Prisma.Decimal(0);
    let bodegasConPendiente = 0;
    for (const d of deudas.values()) {
      pendiente = pendiente.plus(d.deuda);
      if (!d.deuda.isZero()) bodegasConPendiente += 1;
    }

    // El corte del mes, en el calendario de COSTA RICA y resuelto en el SERVIDOR: con el mes del
    // navegador, quien mirara la pantalla desde otro huso veria otra cifra de la misma caja.
    const inicioDelMes = inicioDelMesCREnUtc(ahora);

    let recibidoMes = new Prisma.Decimal(0);
    let diferencia = new Prisma.Decimal(0);
    let sinConciliar = 0;
    let recibidasMes = 0;
    let conDiferencia = 0;

    for (const f of filas) {
      if (f.conciliadoAt === null) {
        sinConciliar += 1;
        continue;
      }
      if (f.conciliadoAt >= inicioDelMes) {
        recibidasMes += 1;
        recibidoMes = recibidoMes.plus(f.montoRecibido ?? new Prisma.Decimal(0));
      }
      const falta = faltaPorRecibir(aporteDeConsolidacion(f), f.montoRecibido);
      if (falta.greaterThan(0)) {
        conDiferencia += 1;
        diferencia = diferencia.plus(falta);
      }
    }

    return {
      pendienteTotal: pendiente.toFixed(2),
      consolidacionesSinConciliar: sinConciliar,
      bodegasConPendiente,
      recibidoEsteMes: recibidoMes.toFixed(2),
      consolidacionesRecibidasEsteMes: recibidasMes,
      diferenciaTotal: diferencia.toFixed(2),
      consolidacionesConDiferencia: conDiferencia,
    };
  }
}
