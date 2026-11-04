"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";

import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Pagination } from "@/components/shared/Pagination";
import { SegmentedToggle } from "@/components/shared/SegmentedToggle";
import { filasDesdeResultado } from "@/components/shared/descarga-resultado";
import { ConciliacionAcciones } from "@/components/shared/conciliacion/ConciliacionAcciones";
import { NOTA_CONCILIACION_ASIENTA } from "@/components/shared/conciliacion/conciliacion-labels";
import {
  listarConsolidacionesSateliteAction,
} from "@/lib/actions/conciliacion-satelites";
import { cierreBodegaConfig } from "@/lib/config/cierre-bodega";
import type { ConsolidacionSateliteDTO } from "@/lib/types/conciliacion-satelites";

import {
  COLUMNAS_DESCARGA_CONSOLIDACIONES_SATELITE,
  filaDescargaConsolidacionSatelite,
} from "./consolidaciones-satelite-descarga-columnas";
import {
  CONSOLIDACION_BLOQUES,
  DESGLOSE_SATELITE,
  DESGLOSE_SATELITE_COLUMNAS,
  DESGLOSE_SATELITE_ERROR,
  DESGLOSE_SATELITE_FILTRO,
  DESGLOSE_SATELITE_NOMBRE,
  DESGLOSE_SATELITE_VACIO,
  ESTADO_CONCILIACION_LABEL,
  ESTADO_CONCILIACION_VARIANT,
  FALTA_POR_RECIBIR_LABEL,
  MONTO_RECIBIDO_LABEL,
  SIN_DATO,
  diaCR,
  estadoConciliacionDe,
  money,
} from "./satelites-labels";
import { descargarDatos } from "@/components/shared/descarga-datos";

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⭑ FICHA 431 (T21, R22/R24/R25) — LA CONCILIACIÓN DE UNA BODEGA SATÉLITE.
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
// FICHA 458-D (T D.4/T D.8, R31, D14) — hasta la 458-D esto era el DESGLOSE que se desplegaba en la
// fila de `SaldosSatelitesTable`. El desplegable se retira: la bodega tiene su ESTADO DE CUENTA
// (`/wallet/satelites/[zonaId]`), y esta tabla de consolidaciones con sus acciones de conciliación
// (marcar y desmarcar lo recibido) se muda a esa página, DEBAJO del extracto, con el MISMO efecto y
// los MISMOS textos (`ConciliacionAcciones`, `MarcarRecibidoDialog`, sin tocar). Lo único que cambia:
// el «Pendiente de llegar» llega del estado de cuenta (la misma deuda que el listado, R22) y,
// tras marcar o desmarcar, se relee también el estado de cuenta de ESTA bodega (R30).
//
// ── FICHA 498 (T7.2, design §9, R41/R41a) — LOS TRES BLOQUES DE CADA CONSOLIDACIÓN
// La columna «Declarado» (el efectivo) se sustituye por tres bloques, todos con importes del DTO
// pintados tal cual: (1) lo recaudado por método y su total; (2) lo que es de la satélite —el pago
// a sus mensajeros y su ganancia por rechazos—; (3) lo que debe (el aporte reconocido), lo recibido
// y lo que falta. Una consolidación saldada con la regla anterior lleva su rótulo (R41a). La nota
// del pie es la de R43: marcar asienta el dinero en la caja y ya no se desmarca.
//
// ── MONEY-SAFE (R20): CERO `Number(`, CERO `parseFloat`, CERO restas.
// Los cinco importes de cada fila y el «Pendiente de llegar» de la cabecera llegan como STRING ya
// derivados del SERVIDOR y se pintan TAL CUAL con `money`. En particular `faltaPorRecibir` NO se
// calcula aquí: la identidad `declarado − recibido = falta` es exactamente la clase de resta que
// la ficha 359 encontró rota en 13 pantallas, y por eso este par entra en
// `tests/components/DineroIdentidadesEnPantalla.test.tsx`.
//
// ── EL AVISO DE LA CABECERA NO ES DECORACIÓN
// Es la mitad que faltaba del control de seguimiento (Q7). Cuando la central marca por menos de lo
// declarado, la diferencia tiene que estar A LA VISTA de las dos partes; si sólo viviera en una
// columna de una tabla, la bodega la descubriría semanas después, cuando alguien se la reclame.

/**
 * Tamaño de página del desglose. Sale de la CONFIG DEL DOMINIO (`cierreBodegaConfig`), que es la
 * misma de la que comen los dos listados de `/cierres-admin`: son el mismo dominio y el mismo
 * borde, y su schema valida el `pageSize` contra ese tope. Un literal aquí sería el número que un
 * día deja de caber en lo que el servidor acepta, y el desglose respondería `validation_error`
 * en vez de filas.
 */
const DESGLOSE_PAGE_SIZE = cierreBodegaConfig.DEFAULT_PAGE_SIZE;

/** Prefijo de la clave SWR. Identifica esta lectura entre todas las de la app. */
const CLAVE_DESGLOSE = "wallet-satelites:conciliacion";

/** Los dos conjuntos que el conmutador ofrece. */
type FiltroDesglose = "sin_conciliar" | "todas";

/** Clave SWR de las consolidaciones de UNA bodega (página y filtro). */
export function claveConciliacionSatelite(
  zonaId: string,
  page: number = 1,
  filtro: FiltroDesglose = "sin_conciliar",
): readonly [string, string, number, string] {
  return [CLAVE_DESGLOSE, zonaId, page, filtro] as const;
}

/** Input del listado PAGINADO. `soloSinConciliar` sólo viaja cuando recorta: el schema es
 *  `.strict()` y un `false` explícito sería un filtro que no filtra. */
function buildInput(zonaId: string, page: number, filtro: FiltroDesglose) {
  return {
    zonaId,
    page,
    pageSize: DESGLOSE_PAGE_SIZE,
    ...(filtro === "sin_conciliar" ? { soloSinConciliar: true } : {}),
  };
}

/** Input del modo COMPLETO (la descarga): el MISMO filtro vigente, SIN paginación. Su schema es
 *  `.strict()`, así que colar `page` devolvería `validation_error` en vez de un archivo. */
function buildInputCompleto(zonaId: string, filtro: FiltroDesglose) {
  return {
    zonaId,
    ...(filtro === "sin_conciliar" ? { soloSinConciliar: true } : {}),
  };
}

interface PaginaDesglose {
  items: ConsolidacionSateliteDTO[];
  total: number;
}

/** Fetcher SWR: pide la página y traduce un status != ok a un throw (SWR lo marca error). */
async function leerDesglose(
  zonaId: string,
  page: number,
  filtro: FiltroDesglose,
): Promise<PaginaDesglose> {
  const res = await listarConsolidacionesSateliteAction(buildInput(zonaId, page, filtro));
  if (res.status !== "ok") throw new Error(res.status);
  return { items: res.items, total: res.total };
}

/** FICHA 498 (R41) — un bloque de importes rotulados: una lista de definición, tal cual del DTO. */
function BloqueImportes({
  nombre,
  filas,
}: {
  nombre: string;
  filas: readonly { rotulo: string; valor: string; clave: string; className?: string }[];
}) {
  return (
    <dl aria-label={nombre} className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 text-xs">
      {filas.map((f) => (
        <div key={f.clave} data-dato={f.clave} className="contents">
          <dt className="text-muted-foreground">{f.rotulo}</dt>
          <dd className={`text-right tabular-nums ${f.className ?? "text-foreground"}`}>{f.valor}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Quién marcó y cuándo, en una línea. Sin marca no hay nada que decir. */
function conciliadoPorTexto(c: ConsolidacionSateliteDTO): string {
  if (c.conciliadoPorNombre === null || c.conciliadoAt === null) return SIN_DATO;
  return `${c.conciliadoPorNombre} · ${diaCR(c.conciliadoAt)}`;
}

export interface ConciliacionSateliteProps {
  /** La bodega. El nombre baja por props (lo trae el estado de cuenta); el id solo viaja. */
  bodega: { zonaId: string; zonaNombre: string };
  /**
   * «Pendiente de llegar» de ESTA bodega: el saldo actual de su estado de cuenta, STRING del servidor
   * (la misma resta que el listado, R22). Aquí no se suma nada.
   */
  pendiente: string;
  /**
   * Si el actor puede marcar y desmarcar. Lo decide el SERVIDOR (`esAccesoTotal`, el mismo
   * predicado con el que el servicio responde `forbidden`) y baja por props. **Default `false`:
   * falla cerrado.**
   */
  puedeConciliar?: boolean;
  /** R30 — tras marcar o desmarcar: relee el estado de cuenta de ESTA bodega. */
  onCambio?: () => Promise<void> | void;
}

export function ConciliacionSatelite({
  bodega,
  pendiente,
  puedeConciliar = false,
  onCambio,
}: Readonly<ConciliacionSateliteProps>) {
  const { zonaId, zonaNombre } = bodega;
  const { mutate } = useSWRConfig();
  const [page, setPage] = useState(1);
  // Arranca en «Sin conciliar» porque es la pregunta que trae a alguien a esta pantalla: qué
  // falta por llegar. Lo ya recibido es historia y está a un clic.
  const [filtro, setFiltro] = useState<FiltroDesglose>("sin_conciliar");

  const { data, error, isLoading } = useSWR(claveConciliacionSatelite(zonaId, page, filtro), () =>
    leerDesglose(zonaId, page, filtro),
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  /**
   * Las consolidaciones de ESTA página que llegaron incompletas. Se usa SÓLO para decidir si el
   * aviso se enciende y para contarlas — **nunca para sumar dinero**: el importe del aviso es
   * `pendiente`, que el servidor ya cuadró sobre la bodega entera.
   */
  const incompletas = items.filter((c) => estadoConciliacionDe(c) === "incompleto");

  /** Refresco DIRIGIDO tras marcar o desmarcar: esta bodega (su tabla y su estado de cuenta), nada más. */
  async function refrescar() {
    await Promise.all([
      onCambio?.(),
      // Todas las páginas y filtros de ESTE desglose (la fila puede haberse movido de conjunto).
      mutate((clave) => Array.isArray(clave) && clave[0] === CLAVE_DESGLOSE && clave[1] === zonaId),
      // Y el listado de bodegas, cuyo «Pendiente» y cuyas tres tarjetas acaban de cambiar.
      mutate((clave) => Array.isArray(clave) && clave[0] === "wallet-satelites:saldos"),
    ]);
  }

  const COLUMNS: Column<ConsolidacionSateliteDTO>[] = [
    {
      id: "consolidada",
      value: DESGLOSE_SATELITE_COLUMNAS.consolidada,
      render: (c) => diaCR(c.solicitadoAt),
    },
    {
      id: "recaudado",
      // FICHA 498 (R41) — bloque 1: lo recaudado por método y su total.
      value: DESGLOSE_SATELITE_COLUMNAS.recaudado,
      render: (c) => (
        <BloqueImportes
          nombre={`${DESGLOSE_SATELITE_COLUMNAS.recaudado} del ${diaCR(c.solicitadoAt)}`}
          filas={[
            { clave: "efectivo", rotulo: CONSOLIDACION_BLOQUES.recaudado.efectivo, valor: money(c.totales.efectivo) },
            { clave: "simpe", rotulo: CONSOLIDACION_BLOQUES.recaudado.simpe, valor: money(c.totales.simpe) },
            {
              clave: "transferencia",
              rotulo: CONSOLIDACION_BLOQUES.recaudado.transferencia,
              valor: money(c.totales.transferencia),
            },
            {
              clave: "total",
              rotulo: CONSOLIDACION_BLOQUES.recaudado.total,
              valor: money(c.totales.general),
              className: "font-medium text-foreground",
            },
          ]}
        />
      ),
    },
    {
      id: "deLaSatelite",
      // FICHA 498 (R41) — bloque 2: lo que pertenece a la satélite y no viaja a la central.
      value: DESGLOSE_SATELITE_COLUMNAS.deLaSatelite,
      render: (c) => (
        <BloqueImportes
          nombre={`${DESGLOSE_SATELITE_COLUMNAS.deLaSatelite} del ${diaCR(c.solicitadoAt)}`}
          filas={[
            {
              clave: "pagoMensajeros",
              rotulo: CONSOLIDACION_BLOQUES.deLaSatelite.pagoMensajeros,
              valor: money(c.totalPagoMensajero),
            },
            {
              clave: "rechazos",
              rotulo: CONSOLIDACION_BLOQUES.deLaSatelite.rechazos,
              valor: money(c.totalIngresoBodegaRechazos),
            },
          ]}
        />
      ),
    },
    {
      id: "cuenta",
      // FICHA 498 (R41/R41a) — bloque 3: lo que debe (aporte reconocido), lo recibido y lo que falta.
      // Sin marcar, «Recibido» se pinta «—» y NO «₡0»: «nadie lo ha mirado» no es «llegaron cero».
      value: DESGLOSE_SATELITE_COLUMNAS.cuenta,
      render: (c) => (
        <div className="flex flex-col gap-1">
          {c.saldadaReglaAnterior ? (
            <Badge variant="secondary" data-rotulo="saldada-regla-anterior" className="w-fit">
              {CONSOLIDACION_BLOQUES.saldadaReglaAnterior}
            </Badge>
          ) : null}
          <BloqueImportes
            nombre={`${DESGLOSE_SATELITE_COLUMNAS.cuenta} del ${diaCR(c.solicitadoAt)}`}
            filas={[
              {
                clave: "debe",
                rotulo: CONSOLIDACION_BLOQUES.cuenta.debe,
                valor: money(c.debe),
                className: "font-medium text-foreground",
              },
              {
                clave: "recibido",
                rotulo: MONTO_RECIBIDO_LABEL,
                valor: c.montoRecibido === null ? SIN_DATO : money(c.montoRecibido),
                className:
                  c.montoRecibido === null
                    ? "text-muted-foreground"
                    : estadoConciliacionDe(c) === "incompleto"
                      ? "font-medium text-warning-strong"
                      : "font-medium text-foreground",
              },
              { clave: "falta", rotulo: FALTA_POR_RECIBIR_LABEL, valor: money(c.faltaPorRecibir) },
            ]}
          />
        </div>
      ),
    },
    {
      id: "estado",
      value: DESGLOSE_SATELITE_COLUMNAS.estado,
      render: (c) => {
        const estado = estadoConciliacionDe(c);
        return (
          <Badge variant={ESTADO_CONCILIACION_VARIANT[estado]}>
            {ESTADO_CONCILIACION_LABEL[estado]}
          </Badge>
        );
      },
    },
    {
      id: "conciliadoPor",
      value: DESGLOSE_SATELITE_COLUMNAS.conciliadoPor,
      render: (c) => (
        <div className="flex flex-col">
          <span className="text-muted-foreground">{conciliadoPorTexto(c)}</span>
          {/* La NOTA se ve: es lo que distingue una conciliación real de la retroactiva del
              backfill de la migración (R30). No baja a la descarga (texto libre). */}
          {c.nota ? <span className="text-xs text-muted-foreground">{c.nota}</span> : null}
        </div>
      ),
    },
    {
      id: "acciones",
      value: "",
      render: (c) => (
        <ConciliacionAcciones
          cierreBodegaId={c.cierreBodegaId}
          bodega={zonaNombre}
          fecha={diaCR(c.solicitadoAt)}
          recaudado={c.totales}
          debe={{ monto: c.debe, positivo: c.debePositivo }}
          marca={c}
          nota={c.nota}
          puedeConciliar={puedeConciliar}
          // FICHA 500 (R3): «Desmarcar» solo si el SERVIDOR dice que se puede (sin dinero y no
          // saldada con la regla anterior). Sin esta línea no saldría nunca: el default es `false`.
          puedeDesmarcar={c.puedeDesmarcar}
          onCambio={refrescar}
        />
      ),
    },
  ];

  return (
    <section
      aria-label={DESGLOSE_SATELITE_NOMBRE.region(zonaNombre)}
      className="flex flex-col gap-4 rounded-lg bg-muted/40 p-4"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-stretch">
        {/* «Pendiente de llegar»: el saldo de ESTA bodega, cuadrado por el servidor. */}
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4 md:w-72">
          <span className="text-sm text-muted-foreground">
            {DESGLOSE_SATELITE.pendienteRotulo}
          </span>
          <span className="text-2xl font-semibold tabular-nums text-foreground">
            {money(pendiente)}
          </span>
        </div>

        {/*
          Q7 — EL AVISO DE LA DIFERENCIA, explicado y no sólo señalado.
          `role="status"` y no `alert`: es información que hay que ver, no una alarma — nadie ha
          hecho nada mal, y teñir de rojo una conciliación parcial legítima la haría parecer un
          error. Tokens semánticos de `DESIGN.md`, cero hex.
        */}
        {incompletas.length > 0 ? (
          <div
            role="status"
            className="flex flex-1 flex-col gap-1 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-strong"
          >
            <span className="font-medium">
              {DESGLOSE_SATELITE.diferenciaTitulo(incompletas.length)}
            </span>
            <span className="text-[13px] leading-relaxed">
              {incompletas.length === 1
                ? DESGLOSE_SATELITE.diferenciaDetalle(
                    money(incompletas[0].debe),
                    money(incompletas[0].montoRecibido),
                    money(incompletas[0].faltaPorRecibir),
                  )
                : DESGLOSE_SATELITE.diferenciaDetalleVarias(money(pendiente))}
            </span>
          </div>
        ) : null}
      </div>

      {/* El conmutador del desglose: la cola primero, la historia a un clic. */}
      <SegmentedToggle
        options={[
          { valor: "sin_conciliar", etiqueta: DESGLOSE_SATELITE_FILTRO.sinConciliar },
          { valor: "todas", etiqueta: DESGLOSE_SATELITE_FILTRO.todas },
        ]}
        valor={filtro}
        onChange={(v) => {
          setFiltro(v);
          setPage(1); // cambiar de conjunto vuelve a la primera página
        }}
        ariaLabel={DESGLOSE_SATELITE_NOMBRE.filtro(zonaNombre)}
      />

      <div className="overflow-x-auto">
        <DataTable
          columns={COLUMNS}
          data={items}
          rowKey="cierreBodegaId"
          ariaLabel={DESGLOSE_SATELITE_NOMBRE.tabla(zonaNombre)}
          isLoading={isLoading}
          /* El fallo se cuenta DENTRO de esta fila; la tabla de saldos sigue en pie. */
          error={error ? DESGLOSE_SATELITE_ERROR : null}
          emptyMessage={DESGLOSE_SATELITE_VACIO}
          /**
           * R29 — descarga del CONJUNTO FILTRADO de esta bodega, no de la página visible. El
           * título lleva el nombre de la bodega para que el control tenga un nombre accesible
           * ÚNICO: pueden estar varias filas abiertas, y tres botones llamados «Descargar» no
           * identificarían nada. El tope de filas lo evalúa el SERVIDOR y `limite_excedido` viaja
           * sin filas, así que nunca sale un archivo al que le faltan filas sin avisar.
           */
          descarga={{
            titulo: DESGLOSE_SATELITE_NOMBRE.region(zonaNombre),
            columnas: COLUMNAS_DESCARGA_CONSOLIDACIONES_SATELITE,
            obtenerFilas: () =>
              filasDesdeResultado(
                descargarDatos("listarConsolidacionesSateliteCompleto", buildInputCompleto(zonaId, filtro)),
                filaDescargaConsolidacionSatelite,
              ),
          }}
        />
      </div>

      {/* Paginación SERVER-SIDE: el total es el del conjunto filtrado, no el de la página. */}
      <Pagination
        page={page}
        pageSize={DESGLOSE_PAGE_SIZE}
        total={total}
        onPageChange={setPage}
        disabled={isLoading}
        ariaLabel={DESGLOSE_SATELITE_NOMBRE.paginacion(zonaNombre)}
      />

      {/* FICHA 498 (R43) — la nota literal de la conciliación. Al pie y visible. */}
      <p role="note" className="text-xs leading-relaxed text-muted-foreground">
        {NOTA_CONCILIACION_ASIENTA}
      </p>
    </section>
  );
}
