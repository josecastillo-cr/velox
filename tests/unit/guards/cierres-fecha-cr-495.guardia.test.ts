import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

import { lineasSinComentarios } from "@/tests/fixtures/sin-comentarios";

// =================================================================================================
// GUARDIA — FICHA 495 — NINGUNA FECHA DE CIERRE NI DE INCIDENTE SE RECORTA EN UTC (R9, R13)
// =================================================================================================
//
// Las fechas de los cierres (`solicitadoAt`, `resueltoAt`, `conciliadoAt`) y de los incidentes
// (`createdAt`, `resueltoAt`) son `timestamp` y viajan como ISO en UTC. Recortarlas con
// `.slice(0, 10)`, cortarlas por la «T» o pasarlas por `fechaDiaISO` da el día UTC: todo lo
// hecho después de las 18:00 de Costa Rica salía fechado al día SIGUIENTE en tarjetas,
// comprobantes, tablas y descargas. El día se saca con `fechaDiaInstanteCR`
// (`lib/utils/fecha-dia-iso.ts`).
//
// Alcance: todo `app/(app)/cierres-admin/**`, `app/(app)/cierre-dia/**` y
// `app/(app)/incidentes/**`, sin comentarios y SIN lista de excepciones: en estas carpetas toda
// fecha que llega como ISO es un instante; las que ya son día (`fechaGestion`, `diaReparto`,
// `fechaCreacionOrden`) se copian sin pasar por ninguna función.

const RAIZ = path.resolve(__dirname, "../../..");
const CARPETAS = ["app/(app)/cierres-admin", "app/(app)/cierre-dia", "app/(app)/incidentes"];

/** Las formas prohibidas: recorte de 10 caracteres, corte por la «T» o `fechaDiaISO(...)`. */
const PROHIBIDAS: readonly RegExp[] = [
  /\.(?:slice|substring|substr)\(\s*0\s*,\s*10\s*\)/,
  /\.split\(\s*["'`]T["'`]\s*\)/,
  /\bfechaDiaISO\s*\(/,
];

function archivosDe(dir: string): string[] {
  const salida: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = path.join(dir, nombre);
    if (statSync(ruta).isDirectory()) salida.push(...archivosDe(ruta));
    else if (/\.(ts|tsx)$/.test(nombre)) salida.push(ruta);
  }
  return salida;
}

/** Números de línea (1-based) de código, sin comentarios, con una forma prohibida. */
function recortesEn(fuente: string): number[] {
  // CRLF invisible: se normaliza antes de partir por líneas.
  return lineasSinComentarios(fuente.replace(/\r\n/g, "\n"))
    .map((linea, i) => (PROHIBIDAS.some((re) => re.test(linea)) ? i + 1 : 0))
    .filter((n) => n > 0);
}

describe("GUARDIA 495 — cierres e incidentes no recortan fechas en UTC", () => {
  it("contraprueba: el detector encuentra las formas de antes de la ficha", () => {
    expect(recortesEn("return iso ? iso.slice(0, 10) : \"—\";")).toEqual([1]);
    expect(recortesEn("aria-label={`del ${c.solicitadoAt.slice(0, 10)}`}")).toEqual([1]);
    expect(recortesEn("fecha: fechaDiaISO(cierre.solicitadoAt),")).toEqual([1]);
    expect(recortesEn("const d = x.substring(0, 10);")).toEqual([1]);
    expect(recortesEn("const d = iso.split(\"T\")[0];")).toEqual([1]);
    expect(recortesEn("render: (i) => i.resueltoAt?.slice(0, 10) ?? \"—\",")).toEqual([1]);
    // Nombra la línea correcta, también con CRLF.
    expect(recortesEn("const a = 1;\r\nconst b = 2;\r\nfecha: fechaDiaISO(i.createdAt),")).toEqual([3]);
    // Lo que SÍ se puede escribir no salta.
    expect(recortesEn("fecha: fechaDiaInstanteCR(c.solicitadoAt),")).toEqual([]);
    expect(recortesEn("const folio = cierreId.slice(-8);")).toEqual([]);
    // Y en un comentario no cuenta.
    expect(recortesEn("// antes: iso.slice(0, 10)")).toEqual([]);
    expect(recortesEn("/* antes: fechaDiaISO(cierre.solicitadoAt) */")).toEqual([]);
  });

  it("revisa archivos de las tres carpetas (R13: incidentes incluida)", () => {
    // Literal a propósito: el alcance ES el contrato (R9 + R13).
    expect(CARPETAS).toEqual([
      "app/(app)/cierres-admin",
      "app/(app)/cierre-dia",
      "app/(app)/incidentes",
    ]);
    for (const carpeta of CARPETAS) {
      expect(archivosDe(path.join(RAIZ, carpeta)).length, carpeta).toBeGreaterThan(0);
    }
  });

  it("ningún archivo de /cierres-admin, /cierre-dia ni /incidentes corta una fecha así", () => {
    const hallazgos: string[] = [];
    let revisados = 0;
    for (const carpeta of CARPETAS) {
      for (const ruta of archivosDe(path.join(RAIZ, carpeta))) {
        revisados += 1;
        for (const n of recortesEn(readFileSync(ruta, "utf8"))) {
          hallazgos.push(`${path.relative(RAIZ, ruta).replace(/\\/g, "/")}:${n}`);
        }
      }
    }
    // Sin archivos que mirar la guardia sería verde por vacía.
    expect(revisados).toBeGreaterThan(30);
    expect(hallazgos).toEqual([]);
  });
});
