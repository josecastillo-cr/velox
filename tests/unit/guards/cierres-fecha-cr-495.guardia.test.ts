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
function recortesEn(fuente: string, formas: readonly RegExp[] = PROHIBIDAS): number[] {
  // CRLF invisible: se normaliza antes de partir por líneas.
  return lineasSinComentarios(fuente.replace(/\r\n/g, "\n"))
    .map((linea, i) => (formas.some((re) => re.test(linea)) ? i + 1 : 0))
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

// =================================================================================================
// FICHA 501 (R10) — PAGOS REGISTRADOS: LOS INSTANTES TAMPOCO SE RECORTAN EN UTC
// =================================================================================================
//
// La tabla y sus columnas de descarga viven en `components/shared/liquidacion`, fuera de las tres
// carpetas de arriba. `registradoAt` y `anuladoAt` son instantes (`fechaDiaInstanteCR`), pero
// `fechaPago` es un `@db.Date` y SÍ pasa por `fechaDiaISO` con razón; por eso el detector es otro.
//
// Lista explícita: si un archivo se mueve, `readFileSync` lanza y la guardia cae en vez de quedarse
// verde por vacía. El detector dispara también con `fechaDiaISO(iso)`: un alias único sobre los dos
// tipos de fecha es lo que escondía el defecto.

const ARCHIVOS_PAGOS_REGISTRADOS = [
  "components/shared/liquidacion/PagosRegistradosTabla.tsx",
  "components/shared/liquidacion/pagos-registrados-descarga-columnas.ts",
];

const PROHIBIDAS_PAGOS_REGISTRADOS: readonly RegExp[] = [
  /\.(?:slice|substring|substr)\(\s*0\s*,\s*10\s*\)/,
  /\.split\(\s*["'`]T["'`]\s*\)/,
  /\bfechaDiaISO\s*\(\s*(?!(?:[\w?.]+\.)?fechaPago\s*\))/,
];

const recortesDePago = (fuente: string) => recortesEn(fuente, PROHIBIDAS_PAGOS_REGISTRADOS);

describe("GUARDIA 501 — Pagos registrados solo recorta como texto `fechaPago`", () => {
  it("contraprueba: el detector encuentra las formas de antes de la ficha", () => {
    expect(recortesDePago("registradoEl: fechaDiaISO(pago.registradoAt),")).toEqual([1]);
    expect(recortesDePago("anuladoEl: a ? fechaDiaISO(a.anuladoAt) : null,")).toEqual([1]);
    expect(recortesDePago("render: (p) => fechaDiaISO(p.registradoAt),")).toEqual([1]);
    // Volver a meter un alias sobre `fechaDiaISO`, con el cuerpo en su propia línea.
    expect(recortesDePago("function dia(iso: string) {\n  return fechaDiaISO(iso);\n}")).toEqual([2]);
    expect(recortesDePago("const d = p.registradoAt.slice(0, 10);")).toEqual([1]);
    expect(recortesDePago("const d = x.substring(0, 10);")).toEqual([1]);
    expect(recortesDePago("const d = p.registradoAt.split(\"T\")[0];")).toEqual([1]);
    // Que un campo se parezca a `fechaPago` no lo salva.
    expect(recortesDePago("fechaDiaISO(p.fechaPagoRegistrada)")).toEqual([1]);
    // Nombra la línea correcta, también con CRLF.
    expect(recortesDePago("const a = 1;\r\nconst b = 2;\r\nfechaDiaISO(p.registradoAt);")).toEqual([3]);
  });

  it("contraprueba: lo que SÍ se puede escribir no salta, y un comentario no cuenta", () => {
    expect(recortesDePago("fechaPago: fechaDiaISO(pago.fechaPago),")).toEqual([]);
    expect(recortesDePago("render: (p) => fechaDiaISO(p.fechaPago),")).toEqual([]);
    expect(recortesDePago("fechaDiaISO(pago?.fechaPago)")).toEqual([]);
    expect(recortesDePago("fechaDiaISO(fechaPago)")).toEqual([]);
    expect(recortesDePago("registradoEl: fechaDiaInstanteCR(pago.registradoAt),")).toEqual([]);
    expect(recortesDePago("import { fechaDiaISO, fechaDiaInstanteCR } from \"x\";")).toEqual([]);
    expect(recortesDePago("// antes: fechaDiaISO(pago.registradoAt)")).toEqual([]);
    expect(recortesDePago("/* antes: iso.slice(0, 10) */")).toEqual([]);
  });

  it("la tabla y las columnas de descarga no cortan así ninguna fecha que no sea `fechaPago`", () => {
    // Literal a propósito: el alcance ES el contrato (R10).
    expect(ARCHIVOS_PAGOS_REGISTRADOS).toEqual([
      "components/shared/liquidacion/PagosRegistradosTabla.tsx",
      "components/shared/liquidacion/pagos-registrados-descarga-columnas.ts",
    ]);
    const hallazgos = ARCHIVOS_PAGOS_REGISTRADOS.flatMap((archivo) =>
      recortesDePago(readFileSync(path.join(RAIZ, archivo), "utf8")).map((n) => `${archivo}:${n}`),
    );
    expect(hallazgos).toEqual([]);
  });
});
