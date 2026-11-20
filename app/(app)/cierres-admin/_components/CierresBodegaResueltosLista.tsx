"use client";

import { useState } from "react";
import type { FiltrosCierresBodega } from "@/lib/types/filtros-cierres";
import type { DescargaResumenCierres } from "./DescargarCierresButton";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/shared/Pagination";
import { filasDesdeResultado } from "@/components/shared/descarga-resultado";
import { cierreBodegaConfig } from "@/lib/config/cierre-bodega";
import {
  listarHistoricoCierresBodegaPaginado,
} from "@/lib/actions/cierre-bodega";
import type { CierreBodegaResumen } from "@/lib/interfaces/services/ICierreBodegaService";

import { CierreBodegaFacturaResumen } from "./cierre-factura";
import { ListaComprobantes } from "./ListaComprobantes";
import {
  AMBITO_DESCARGA_BODEGA_RESUELTOS,
  COLUMNAS_DESCARGA_BODEGA_RESUELTOS,
  filaDescargaBodegaResuelto,
} from "./cierres-bodega-descarga-columnas";
import { descargarDatos } from "@/components/shared/descarga-datos";

/**
 * Feature 170 — FASE 2 (T I.2, R43/R44/R52): el HISTÓRICO de «Cierres de bodega resueltos»
 * (feature 40, R15), paginado en el servidor.
 *
 * Pedido humano del 2026-08-16 — DEJA DE SER UNA TABLA: cada cierre de bodega resuelto se lee
 * como el comprobante compacto de `cierre-factura`. Las nueve columnas siguen estando, cada
 * una en su sitio de la hoja: estado (badge), zona y quién solicitó (las partes), fecha
 * resuelta (columna «Fechas» del desglose), total general (cabecera), pago a mensajeros e
 * ingreso de bodega («Ajustes»), motivo de rechazo (línea propia) y la acción «Ver».
 *
 * POR QUÉ SIGUE VIVIENDO EN SU PROPIO ARCHIVO: `CierresBodegaAdminModule` enseña, junto a este
 * listado, el contador de su cola. La guardia de T H.3 prohíbe —con razón— que un contador
 * derivado de un array conviva con un control de paginación en el mismo archivo.
 */

/** La página que pre-carga el Server Component (R44: es la que el usuario ve al entrar). */
export interface CierresBodegaResueltosPagina {
  items: CierreBodegaResumen[];
  total: number;
  pageSize: number;
}

export interface CierresBodegaResueltosListaProps {
  /** Página 1 resuelta server-side; alimenta el `fallbackData` de SWR. */
  initialData: CierresBodegaResueltosPagina;
  /** Abre el detalle agregado del cierre de bodega (el modal vive en el módulo padre). */
  onAbrir: (cierreBodegaId: string) => void;
  /**
   * Ficha 510: los filtros de la barra del módulo (bodega, fechas). Obligatorios a propósito:
   * olvidarlos fue el bug —la pestaña Pendientes recortaba y ésta seguía enseñando todas—.
   */
  filtros: FiltrosCierresBodega;
}

/** Sin ningún filtro puesto: el único caso en que la página del Server Component vale. */
function sinFiltrosBodega(filtros: FiltrosCierresBodega): boolean {
  return Object.values(filtros).every((v) => v === undefined);
}

/** Nombre visible del listado: hoja, base del archivo y nombre del control (R12/R13). */
const TITULO_DESCARGA = "Cierres de bodega resueltos";
/** Nombre accesible del control (R43). Propio: la pantalla monta varios listados paginados. */
export const PAGINACION_BODEGA_RESUELTOS_LABEL =
  "Paginación de los cierres de bodega resueltos";
const ERROR_CARGA = "No se pudieron cargar los cierres de bodega resueltos.";

// R40: el tamaño sale de la config del dominio (T H.1), nunca de un literal de pantalla.
const PAGE_SIZE_OPTIONS = [10, 25, 50].filter(
  (s) => s <= cierreBodegaConfig.MAX_PAGE_SIZE,
);

async function leerPagina(
  page: number,
  pageSize: number,
  filtros: FiltrosCierresBodega,
): Promise<CierresBodegaResueltosPagina> {
  const res = await listarHistoricoCierresBodegaPaginado({ page, pageSize, filtros });
  if (res.status !== "ok") throw new Error(res.status);
  return { items: res.items, total: res.total, pageSize: res.pageSize };
}

/**
 * La configuración de descarga de «Cierres de bodega resueltos», para que la monte quien pinta
 * la fila de las pestañas (pedido humano del 2026-08-16: el botón va alineado con las pestañas, no en una
 * fila propia encima de la lista). Vive aquí, con el listado del que habla: el título, las
 * columnas y la lectura de la que sale el archivo son suyos.
 *
 * Feature 170 (T I.2, R52) — el listado pinta UNA página; el archivo es el CONJUNTO, cortado en
 * la BASE con el mismo criterio y el mismo orden que la página, y con el tope de filas evaluado
 * en el servidor (R6). El alcance lo aplica el servicio desde la sesión: descargar no amplía lo
 * que el actor podía ver (R44). Pedido humano del 2026-08-16: «el CONJUNTO» pasa a significar
 * «el conjunto FILTRADO» — los `filtros` viajan porque el usuario los puso; el alcance, nunca.
 */
export function descargaBodegaResueltos(
  filtros: FiltrosCierresBodega,
): DescargaResumenCierres {
  return {
    titulo: TITULO_DESCARGA,
    columnas: COLUMNAS_DESCARGA_BODEGA_RESUELTOS,
    // Ficha 314: enciende el selector de columnas de esta descarga (ámbito propio, R10).
    ambitoColumnas: AMBITO_DESCARGA_BODEGA_RESUELTOS,
    obtenerFilas: () =>
      filasDesdeResultado(
        descargarDatos("listarHistoricoCierresBodegaCompleto", { filtros }),
        filaDescargaBodegaResuelto,
      ),
  };
}

export function CierresBodegaResueltosLista({
  initialData,
  onAbrir,
  filtros,
}: Readonly<CierresBodegaResueltosListaProps>) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialData.pageSize);

  // Ficha 510: filtrar devuelve el listado a su página 1, como `aplicarFiltros` hace con la cola
  // de Pendientes — pedir la 7 de un conjunto recién recortado da vacío. Se ajusta en el render
  // (patrón de React para «estado que depende de una prop»), no en un efecto: así la petición de
  // la página vieja con los filtros nuevos no llega a salir.
  const [filtrosVistos, setFiltrosVistos] = useState(filtros);
  if (filtrosVistos !== filtros) {
    setFiltrosVistos(filtros);
    setPage(1);
  }

  const { data, error } = useSWR(
    ["cierres-bodega:resueltos", page, pageSize, filtros],
    () => leerPagina(page, pageSize, filtros),
    {
      // El `fallbackData` del Server Component solo vale SIN filtros: con un filtro puesto, la
      // página 1 pre-cargada es la del conjunto sin filtrar, y servirla sería enseñar cierres
      // que el filtro excluye.
      fallbackData:
        page === 1 && pageSize === initialData.pageSize && sinFiltrosBodega(filtros)
          ? initialData
          : undefined,
    },
  );

  // R44: el esqueleto de carga se muestra sólo cuando NO hay nada que pintar. `isLoading` de
  // SWR sigue siendo `true` mientras revalida aunque haya `fallbackData`, y usarlo tal cual
  // haría que la página 1 —la que el Server Component ya resolvió— apareciera como esqueleto
  // antes de enseñar los comprobantes que el usuario veía antes de paginar.
  const cargando = data === undefined;

  return (
    <section
      aria-label="Cierres de bodega resueltos"
      className="flex flex-col gap-3"
    >
      {/* Sin encabezado visible: la pestaña ya lo dice. El `aria-label` de la sección se
          queda —es el nombre para quien no ve la pantalla, y por el que lo localizan los tests—. */}
      <ListaComprobantes
        ariaLabel="Cierres de bodega resueltos"
        items={data?.items ?? []}
        clave={(c) => c.cierreBodegaId}
        isLoading={cargando}
        error={error ? ERROR_CARGA : null}
        emptyMessage="Aún no hay cierres de bodega resueltos."
        render={(c) => (
          <CierreBodegaFacturaResumen
            cierre={c}
            acciones={
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label={`Ver el cierre de bodega resuelto de ${c.zonaNombre}`}
                onClick={() => onAbrir(c.cierreBodegaId)}
              >
                Ver
              </Button>
            }
          />
        )}
      />

      <Pagination
        page={page}
        pageSize={pageSize}
        total={data?.total ?? 0}
        disabled={cargando}
        showFirstLast
        siblingCount={1}
        ariaLabel={PAGINACION_BODEGA_RESUELTOS_LABEL}
        onPageChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s);
          setPage(1);
        }}
        pageSizeOptions={PAGE_SIZE_OPTIONS}
      />
    </section>
  );
}
