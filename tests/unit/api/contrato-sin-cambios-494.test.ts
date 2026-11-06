import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { METRICAS } from "@/lib/analytics/metrics";
import { esMetricaPublicableApiKey, METRICAS_API_KEY } from "@/lib/analytics/publicacion-api-key";
import { openApiSpec } from "@/lib/api/openapi-spec";

// FEATURE 494 (R6, design §3.2) — LA API PÚBLICA NO SE RENOMBRA.
//
// El renombrado interno cambia `ordenex` por `empresa` en cientos de sitios, y ninguno puede llegar a un
// integrador. Todo lo esperado va LITERAL, copiado de la OpenAPI de `origin/dev` antes de renombrar
// (`progress/impl_494.md`, «Contrato para R6»): compararlo contra `openApiSpec` lo dejaría siempre verde.
// Se comprueban las dos copias que se publican: el objeto de `lib/api/openapi-spec.ts` y el `.yaml`.

const RAIZ = path.resolve(__dirname, "../../..");

const RUTAS: Readonly<Record<string, readonly string[]>> = {
  "/api/ordenes/api-key": ["get"],
  "/api/ordenes/api-key/analitica": ["get"],
  "/api/ordenes/api-key/carga": ["post"],
  "/api/ordenes/api-key/carga/{cargaId}/generate": ["post"],
  "/api/ordenes/api-key/cotizacion": ["post"],
  "/api/ordenes/api-key/habilitar": ["post"],
  "/api/ordenes/api-key/orden/{id}": ["delete", "get"],
  "/api/ordenes/api-key/orden/{id}/generate": ["post"],
  "/api/ordenes/api-key/{numGuia}/cancelar": ["put"],
};

/** Nombres de campo por esquema, sin descender por `$ref`. */
const CAMPOS: Readonly<Record<string, readonly string[]>> = {
  AnaliticaRespuesta: ["desde", "hasta", "metricas", "rango"],
  AnaliticaSerie: ["cobertura", "corteAt", "data", "fecha", "fechasNoComparables", "metrica", "parcial", "penumbra", "unidad", "valor"],
  CancelacionResponse: ["estado", "estadoAnterior", "estadoAnteriorNombre", "estadoNombre", "numGuia"],
  CargaFilaError: ["errores", "fila", "numRemision", "resultado"],
  CargaOrden: ["costoEnvio", "estado", "estadoNombre", "fulfillment", "id", "numGuia", "numRemision"],
  CargaRequest: ["ordenes"],
  CargaResponse: ["cargaId", "conError", "creadas", "duplicadas", "errores", "filas", "ordenes", "total"],
  CargaRow: ["canton", "destinatario", "direccion", "distrito", "monto_cobrar", "notas", "num_remision", "peso", "producto", "provincia", "telefono"],
  CargaRowResult: ["estado", "estadoNombre", "fila", "numGuia", "numRemision", "resultado"],
  CotizacionCostos: ["devuelto", "entregado"],
  CotizacionEscenarioDevuelto: ["comision", "flete", "fulfillment", "iva", "total"],
  CotizacionEscenarioEntregado: ["comision", "flete", "fulfillment", "iva", "ivaComision", "total"],
  CotizacionFilaError: ["errores", "fila", "numRemision", "resultado"],
  CotizacionRequest: ["ordenes"],
  CotizacionResponse: ["conError", "cotizadas", "errores", "filas", "total"],
  CotizacionRow: ["canton", "direccion", "distrito", "monto_cobrar", "num_remision", "provincia"],
  CotizacionRowResult: ["costos", "fila", "montoCobrar", "numRemision", "resultado"],
  EliminacionResponse: ["estado", "estadoNombre", "numGuia", "numRemision"],
  Error: ["code", "details", "message", "status"],
  Evidencia: ["contentType", "expiraEnSegundos", "resultado", "resultadoNombre", "url"],
  HabilitacionRequest: ["ordenes"],
  HabilitacionResponse: ["resultados", "resumen"],
  HabilitacionResumen: ["conError", "habilitadas", "habilitadasSinCambioDeEstado", "total"],
  HabilitacionRow: ["nota", "num_guia"],
  HabilitacionRowResult: ["ayudaCerrada", "codigo", "error", "estado", "estadoNombre", "mensaje", "numGuia", "resultado"],
  Listado: ["items", "pagination"],
  Mensajero: ["id", "nombre"],
  OrdenCosto: ["comision", "flete", "fulfillment", "iva", "ivaComision"],
  OrdenDetalle: ["evidencias", "gestiones"],
  OrdenGestion: ["createdAt", "estadoResultante", "estadoResultanteNombre", "mensajero", "motivo", "pendienteConfirmacion", "resultado", "resultadoNombre"],
  OrdenListItem: ["costoEstimado", "costoReal", "createdAt", "destinatario", "direccion", "estado", "estadoNombre", "id", "mensajero", "montoCobrar", "nombre", "numGuia", "numRemision", "producto", "telefonoDest", "zona"],
  Pagination: ["limit", "offset", "total"],
  PdfGenerateResponse: ["expiraEnSegundos", "url"],
  WebhookOrdenEstadoActualizado: ["data", "estado", "estadoNombre", "evento", "eventoId", "evidenciasUrl", "id", "mensajero", "motivo", "nombre", "numGuia", "numRemision", "ocurridoAt"],
  WebhookOrdenEvento: ["data", "evento", "eventoId", "gestionId", "id", "mensajero", "motivo", "nombre", "numGuia", "numRemision", "ocurridoAt", "pendienteConfirmacion", "resultado", "resultadoAnterior", "resultadoAnteriorNombre", "resultadoNombre", "via"],
  Zona: ["id", "nombre"],
};

const METODOS = new Set(["get", "post", "put", "patch", "delete"]);
const ANIDA = new Set(["items", "allOf", "oneOf", "anyOf", "additionalProperties"]);

/** Los nombres bajo cualquier `properties` del nodo, recorriendo lo anidado pero sin seguir `$ref`. */
function camposDe(nodo: unknown, acc: Set<string> = new Set()): Set<string> {
  if (Array.isArray(nodo)) {
    for (const n of nodo) camposDe(n, acc);
  } else if (typeof nodo === "object" && nodo !== null) {
    for (const [k, v] of Object.entries(nodo)) {
      if (k === "properties" && typeof v === "object" && v !== null) {
        for (const nombre of Object.keys(v)) acc.add(nombre);
        for (const hijo of Object.values(v)) camposDe(hijo, acc);
      } else if (ANIDA.has(k)) {
        camposDe(v, acc);
      }
    }
  }
  return acc;
}

const ordenados = (c: Iterable<string>) => [...c].sort((a, b) => a.localeCompare(b, "en"));
const porNombre = (o: Readonly<Record<string, readonly string[]>>) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, ordenados(v)]));

const yaml = readFileSync(path.join(RAIZ, "docs/api/api-key-openapi.yaml"), "utf8").replace(/\r\n/g, "\n").split("\n");
const sangria = (l: string) => l.length - l.trimStart().length;
const esRelleno = (l: string) => l.trim() === "" || l.trimStart().startsWith("#");

function seccionYaml(cabecera: string): string[] {
  const inicio = yaml.indexOf(cabecera);
  if (inicio === -1) throw new Error(`el yaml no declara ${cabecera}`);
  const propia = sangria(cabecera);
  const acc: string[] = [];
  for (let i = inicio + 1; i < yaml.length; i++) {
    const l = yaml[i]!;
    if (!esRelleno(l) && sangria(l) <= propia) break;
    acc.push(l);
  }
  return acc;
}

const CLAVE_YAML = /^\s*"?([^"\s:]+)"?:(\s|$)/;

/** Parte una sección en sus hijos directos: nombre y líneas. */
function hijosYaml(lineas: readonly string[]): Map<string, string[]> {
  const base = Math.min(...lineas.filter((l) => !esRelleno(l)).map(sangria));
  const acc = new Map<string, string[]>();
  let actual: string[] | null = null;
  for (const l of lineas) {
    const clave = !esRelleno(l) && sangria(l) === base ? CLAVE_YAML.exec(l) : null;
    if (clave) {
      actual = [];
      acc.set(clave[1]!, actual);
    } else {
      actual?.push(l);
    }
  }
  return acc;
}

/** Como `camposDe`, sobre el texto: lo que cuelga directamente de cada `properties:`. */
function camposDeYaml(lineas: readonly string[]): Set<string> {
  const acc = new Set<string>();
  lineas.forEach((l, i) => {
    if (l.trim() !== "properties:") return;
    const propia = sangria(l);
    let hijo: number | null = null;
    for (let j = i + 1; j < lineas.length; j++) {
      const s = lineas[j]!;
      if (esRelleno(s)) continue;
      if (sangria(s) <= propia) break;
      hijo ??= sangria(s);
      const clave = sangria(s) === hijo ? CLAVE_YAML.exec(s) : null;
      if (clave) acc.add(clave[1]!);
    }
  });
  return acc;
}

function archivosDe(rel: string): string[] {
  const abs = path.join(RAIZ, rel);
  if (statSync(abs).isFile()) return [rel];
  return readdirSync(abs).flatMap((n) => archivosDe(`${rel}/${n}`));
}

describe("494/R6 — las rutas públicas", () => {
  it("el objeto declara exactamente estas rutas y métodos", () => {
    const declaradas = Object.fromEntries(
      Object.entries(openApiSpec.paths).map(([ruta, op]) => [ruta, ordenados(Object.keys(op).filter((k) => METODOS.has(k)))]),
    );
    expect(declaradas).toEqual(RUTAS);
  });

  it("el `.yaml` declara exactamente las mismas", () => {
    const declaradas = Object.fromEntries(
      [...hijosYaml(seccionYaml("paths:"))].map(([ruta, cuerpo]) => [ruta, ordenados([...hijosYaml(cuerpo).keys()].filter((k) => METODOS.has(k)))]),
    );
    expect(declaradas).toEqual(RUTAS);
  });
});

describe("494/R6 — los campos públicos", () => {
  it("el objeto declara exactamente estos esquemas y campos", () => {
    const declarados = Object.fromEntries(Object.entries(openApiSpec.components.schemas).map(([n, s]) => [n, ordenados(camposDe(s))]));
    expect(declarados).toEqual(porNombre(CAMPOS));
  });

  it("el `.yaml` declara exactamente los mismos", () => {
    const declarados = Object.fromEntries([...hijosYaml(seccionYaml("  schemas:"))].map(([n, cuerpo]) => [n, ordenados(camposDeYaml(cuerpo))]));
    expect(declarados).toEqual(porNombre(CAMPOS));
  });

  it("ningún campo lleva la marca retirada ni la palabra que la sustituye", () => {
    expect(Object.values(CAMPOS).flat().filter((c) => /ordenex|empresa/i.test(c))).toEqual([]);
  });

  it("el código que arma lo público no tiene ningún campo con esa palabra", () => {
    const fuentes = ["app/api/ordenes/api-key", "lib/api", "lib/types/api-orden.ts", "lib/types/api-key.ts", "lib/types/habilitacion-api.ts"].flatMap(archivosDe);
    expect(fuentes.length).toBeGreaterThan(10);
    const hallados = fuentes.flatMap((f) =>
      readFileSync(path.join(RAIZ, f), "utf8")
        .split("\n")
        .filter((l) => /\b\w*(?:empresa|Empresa|ordenex|Ordenex)\w*\??\s*:(?!:)/.test(l) && !/^\s*(?:\/\/|\*|\/\*)/.test(l))
        .map((l) => `${f}: ${l.trim()}`),
    );
    expect(hallados).toEqual([]);
  });
});

describe("494/R6 — las métricas publicadas", () => {
  it("la lista es esta, y en este orden", () => {
    expect(METRICAS_API_KEY).toEqual([
      "ordenes_creadas",
      "ordenes_por_estado",
      "entregas",
      "devoluciones",
      "rechazos",
      "reprogramaciones",
      "tasa_entrega",
      "tasa_devolucion",
      "tasa_rechazo",
      "tiempo_ciclo",
    ]);
  });

  it("la ganancia no se publica, ni con el nombre nuevo ni con el viejo", () => {
    expect(esMetricaPublicableApiKey("ganancia_empresa")).toBe(false);
    expect(esMetricaPublicableApiKey("ganancia_ordenex")).toBe(false);
  });

  it("ninguna métrica financiera se publica", () => {
    const financieras = METRICAS.filter((m) => m.dominio === "financiera").map((m) => m.id);
    expect(financieras).toContain("ganancia_empresa");
    expect(financieras.filter(esMetricaPublicableApiKey)).toEqual([]);
  });
});
