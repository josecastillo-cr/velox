import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { quitarComentarios } from "@/tests/fixtures/sin-comentarios";

// FICHA 492 (revision B2) — GUARDIA DE FORMA DE R1, SEGUNDA CLAUSULA.
//
// R1: «todo archivo TypeScript tocado por esta ficha DEBE leer esos valores de [`lib/marca/identidad`]
// en vez de escribirlos como literal». Ningun test de VALOR puede ver la regresion: si alguien
// escribe `"Velox Courier"` a mano donde iba `MARCA.nombre`, el texto que sale es identico y todo
// queda verde (medido por el reviewer: mutaciones X7 y X8 sobrevivian). Esta guardia mira la FORMA:
// sobre la lista CERRADA de archivos de codigo de la 492 que pintan la marca, quita los comentarios
// y exige que no quede ningun literal de identidad, y que los que leen la marca la importen del
// modulo unico.
//
// Excepcion cerrada (design §3.7): `ROTULO_GUIA = "VELOX · GUÍA"` vive como literal propio en
// `lib/pdf/etiquetas-dibujo.ts`, que NO esta en la lista; quien lo pinte (la vista previa) lo importa.
//
// POR QUE LEE CON fs: es una propiedad del texto fuente, no del modulo cargado. Se normaliza CRLF.

const RAIZ = process.cwd();

/** Archivos que pintan la marca leyendo `MARCA`/`LOGO`: tienen que importar el modulo unico. */
const LEEN_LA_MARCA = [
  "app/layout.tsx",
  "components/shared/Logo.tsx",
  "app/(app)/_components/Sidebar.tsx",
  "app/_landing/LandingNav.tsx",
  "app/api-docs/route.ts",
  "lib/api/openapi-spec.ts",
  "lib/config/email.ts",
  "lib/whatsapp-envios/informes/picking/pdf.ts",
  "lib/whatsapp-envios/informes/transito/pdf.ts",
] as const;

/** Archivos que pintan la marca a traves de `<Logo>` o de `ROTULO_GUIA`: sin literal, sin import propio. */
const PINTAN_SIN_IMPORTAR = [
  "app/_landing/LandingFooter.tsx",
  "app/login/page.tsx",
  "app/recuperar-contrasena/page.tsx",
  "app/postulacion/page.tsx",
  "app/paquete/[numGuia]/page.tsx",
  "app/(app)/ordenes/_components/EtiquetaGuia.tsx",
] as const;

/**
 * Literales de identidad prohibidos fuera de `lib/marca/identidad.ts`. «Velox» en cualquier forma
 * (nombre, nombre corto, rotulo de la etiqueta, mayusculas), el color de tema, las rutas de `LOGO` y
 * el arranque de la descripcion.
 */
const PROHIBIDOS: ReadonlyArray<readonly [nombre: string, patron: RegExp]> = [
  ["nombre de marca / nombre corto («Velox»)", /velox/gi],
  ["color de tema (#011027)", /#011027/gi],
  ["ruta de LOGO (/marca/logo-…)", /\/marca\/logo-/g],
  ["descripcion de la aplicacion", /Plataforma de log[ií]stica y entregas/gi],
];

const IMPORTA_MARCA = /from\s+["']@\/lib\/marca\/identidad["']/;

/**
 * FEATURE 493 (R18, P6) — excepcion CERRADA: el ORIGEN publico `https://velox-courier.company` en los
 * ejemplos de `lib/api/openapi-spec.ts` (`evidenciasUrl`). Es un dominio, no la marca pintada: no sale
 * de `MARCA` (un dominio no cambia solo porque cambie el nombre comercial). Se quita SOLO esa cadena
 * exacta y SOLO en ese archivo; un «Velox» escrito a mano en el mismo archivo sigue siendo hallazgo.
 */
const DOMINIO_PERMITIDO: Readonly<Record<string, string>> = {
  "lib/api/openapi-spec.ts": "https://velox-courier.company",
};

/** El fuente sin la excepcion cerrada de su archivo (si la tiene). */
function sinExcepcion(rel: string, fuente: string): string {
  const dominio = DOMINIO_PERMITIDO[rel];
  return dominio === undefined ? fuente : fuente.split(dominio).join("https://dominio.invalid");
}

/** Codigo sin comentarios y con finales de linea normalizados. */
function codigo(fuente: string): string {
  return quitarComentarios(fuente.replace(/\r\n/g, "\n"));
}

function hallazgos(fuente: string): string[] {
  const sin = codigo(fuente);
  const salida: string[] = [];
  for (const [nombre, patron] of PROHIBIDOS) {
    for (const m of sin.matchAll(patron)) {
      const linea = sin.slice(0, m.index).split("\n").length;
      salida.push(`linea ${linea}: ${nombre} «${m[0]}»`);
    }
  }
  return salida;
}

const leer = (rel: string) => fs.readFileSync(path.join(RAIZ, rel), "utf8");

describe("Feature 492 — R1: los archivos de la ficha no escriben la marca como literal", () => {
  it("autocomprobacion: un literal en codigo da hallazgo; el mismo texto en un comentario, no", () => {
    expect(hallazgos('l.texto("Velox Courier", MARGEN, 16);')).toHaveLength(1);
    expect(hallazgos("const t = `<title>VELOX · GUÍA</title>`;")).toHaveLength(1);
    expect(hallazgos('<meta name="theme-color" content="#011027" />')).toHaveLength(1);
    expect(hallazgos('<img src="/marca/logo-simbolo.svg" />')).toHaveLength(1);
    expect(hallazgos('const d = "Plataforma de logística y entregas X";')).toHaveLength(1);
    expect(hallazgos('// Velox Courier\n/* #011027 */\r\nconst x = MARCA.nombre;\r\n')).toEqual([]);
    expect(hallazgos('{/* Velox Courier */}\nimport { MARCA } from "@/lib/marca/identidad";')).toEqual([]);
  });

  it("493: la excepcion del dominio es cerrada — solo ese origen y solo en openapi-spec.ts", () => {
    const fuente = 'const u = "https://velox-courier.company/api/x";\nconst t = "Velox Courier";';
    // En su archivo, el dominio se admite y la marca a mano sigue siendo hallazgo.
    expect(hallazgos(sinExcepcion("lib/api/openapi-spec.ts", fuente))).toHaveLength(1);
    // En cualquier otro archivo de la lista, el dominio tambien es hallazgo.
    expect(hallazgos(sinExcepcion("lib/config/email.ts", fuente))).toHaveLength(2);
    // Otro subdominio no entra en la excepcion.
    expect(hallazgos(sinExcepcion("lib/api/openapi-spec.ts", 'const u = "https://app.velox-courier.company";'))).toHaveLength(1);
  });

  it.each([...LEEN_LA_MARCA, ...PINTAN_SIN_IMPORTAR])("%s: sin literal de identidad", (rel) => {
    expect(hallazgos(sinExcepcion(rel, leer(rel)))).toEqual([]);
  });

  it.each(LEEN_LA_MARCA)("%s: importa la marca de lib/marca/identidad", (rel) => {
    expect(codigo(leer(rel))).toMatch(IMPORTA_MARCA);
  });

  it("la vista previa de la etiqueta toma el rotulo de ROTULO_GUIA (excepcion de design §3.7)", () => {
    const vista = codigo(leer("app/(app)/ordenes/_components/EtiquetaGuia.tsx"));
    expect(vista).toMatch(/\bROTULO_GUIA\b[\s\S]*\{ROTULO_GUIA\}/);
  });
});
