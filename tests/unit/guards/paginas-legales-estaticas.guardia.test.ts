// GUARDIA DEL ARNES — LAS PAGINAS LEGALES SON ESTATICAS Y SUS DATOS LEGALES VIVEN EN UN SOLO SITIO.
//
// Feature 490. Cubre R6 (generacion estatica, sin leer cookies/cabeceras/searchParams/base), refuerza
// R5 (sin `"use client"`, el texto sale del servidor) y R18 (fuente unica: ningun archivo de las
// paginas legales salvo `app/_legal/datos-legales.ts` contiene la marca ni un correo literal).
//
// Por que importa: el rastreador de Meta pide `/privacidad` y `/eliminacion-datos` sin sesion. Una
// pagina que se volviera dinamica y tocara la base responderia 500 el dia que la base falle, y la app
// de WhatsApp no pasaria a Live. Y un dato legal repetido en dos archivos acaba divergiendo.
//
// La lectura es ESTATICA (fs). El grafo de `--rapido` puede no relacionarla con un diff: se corre a
// mano por nombre (`pnpm exec vitest run paginas-legales`).
//
// Autocomprobacion: cada detector se ejerce contra fuente sintetico sano y con la infraccion
// plantada ANTES de creerle nada sobre el arbol real. Una guardia estatica rota no falla: calla.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const RAIZ = path.resolve(__dirname, "../../..");

const DIRECTORIOS = ["app/_legal", "app/privacidad", "app/eliminacion-datos"];
const PAGINAS = ["app/privacidad/page.tsx", "app/eliminacion-datos/page.tsx"];
const FUENTE_UNICA = "app/_legal/datos-legales.ts";

function archivosDe(dirRel: string): string[] {
  const abs = path.join(RAIZ, dirRel);
  const out: string[] = [];
  for (const nombre of readdirSync(abs)) {
    const rel = `${dirRel}/${nombre}`;
    const st = statSync(path.join(RAIZ, rel));
    if (st.isDirectory()) out.push(...archivosDe(rel));
    else if (/\.(ts|tsx)$/.test(nombre)) out.push(rel);
  }
  return out;
}

function leer(rel: string): string {
  return readFileSync(path.join(RAIZ, rel), "utf8");
}

// ---------------------------------------------------------------------------------------------
// Detectores
// ---------------------------------------------------------------------------------------------

/** `export const dynamic = "force-static"` (comillas simples o dobles). */
function declaraForceStatic(fuente: string): boolean {
  return /export\s+const\s+dynamic\s*=\s*["']force-static["']/.test(fuente);
}

/** Lo que volveria dinamica la pagina o la sacaria del HTML de servidor (R5/R6). */
function infraccionesDinamicas(fuente: string): string[] {
  const reglas: Array<[string, RegExp]> = [
    ['"use client"', /^\s*["']use client["']/m],
    ["next/headers", /from\s+["']next\/headers["']/],
    ["cookies(", /\bcookies\s*\(/],
    ["@/lib/db", /from\s+["']@\/lib\/db(?:\/[^"']*)?["']/],
    ["searchParams", /\bsearchParams\b/],
  ];
  return reglas.filter(([, re]) => re.test(fuente)).map(([nombre]) => nombre);
}

/** Literales de datos legales fuera de la fuente unica (R18): la marca o un correo. */
function literalesLegales(fuente: string): string[] {
  const hallados: string[] = [];
  if (/ordenex/i.test(fuente)) hallados.push("Ordenex");
  if (/velox/i.test(fuente)) hallados.push("Velox");
  // Un correo: algo@dominio.tld. No casa con los alias de import (`@/app/...`).
  if (/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.test(fuente)) hallados.push("correo");
  return hallados;
}

// ---------------------------------------------------------------------------------------------
// Autocomprobacion
// ---------------------------------------------------------------------------------------------

describe("guardia 490 — autocomprobacion de los detectores", () => {
  it("force-static: reconoce la declaracion y rechaza su ausencia o otro valor", () => {
    expect(declaraForceStatic(`export const dynamic = "force-static";`)).toBe(true);
    expect(declaraForceStatic(`export const dynamic = 'force-static'`)).toBe(true);
    expect(declaraForceStatic(`export const dynamic = "force-dynamic";`)).toBe(false);
    expect(declaraForceStatic(`export default function P() {}`)).toBe(false);
  });

  it("dinamicas: sano limpio, y cada infraccion plantada se detecta", () => {
    const sano = `import Link from "next/link";\nexport function A() { return null; }`;
    expect(infraccionesDinamicas(sano)).toEqual([]);

    expect(infraccionesDinamicas(`"use client";\n${sano}`)).toEqual(['"use client"']);
    expect(infraccionesDinamicas(`import { headers } from "next/headers";`)).toEqual(["next/headers"]);
    expect(infraccionesDinamicas(`const c = await cookies();`)).toEqual(["cookies("]);
    expect(infraccionesDinamicas(`import { getPrismaClient } from "@/lib/db/prisma-client";`)).toEqual([
      "@/lib/db",
    ]);
    expect(infraccionesDinamicas(`export default function P({ searchParams }) {}`)).toEqual([
      "searchParams",
    ]);
  });

  it("literales: sano limpio (alias @/ incluido), y marca o correo plantados se detectan", () => {
    const sano = `import { cn } from "@/lib/utils";\nconst x = "Política de privacidad";`;
    expect(literalesLegales(sano)).toEqual([]);

    expect(literalesLegales(`const m = "Velox Courier";`)).toEqual(["Velox"]);
    expect(literalesLegales(`// la marca es Ordenex`)).toEqual(["Ordenex"]);
    expect(literalesLegales(`const c = "privacidad@ejemplo.com";`)).toEqual(["correo"]);
  });
});

// ---------------------------------------------------------------------------------------------
// Arbol real
// ---------------------------------------------------------------------------------------------

describe("guardia 490 — paginas legales en el arbol", () => {
  const archivos = DIRECTORIOS.flatMap(archivosDe);

  it("el censo no esta vacio y contiene las piezas del design", () => {
    for (const rel of [...PAGINAS, FUENTE_UNICA, "app/_legal/PaginaLegal.tsx", "app/_legal/DatoLegal.tsx"]) {
      expect(existsSync(path.join(RAIZ, rel)), rel).toBe(true);
      expect(archivos).toContain(rel);
    }
  });

  it.each(PAGINAS)("R6: %s exporta dynamic = \"force-static\"", (rel) => {
    expect(declaraForceStatic(leer(rel))).toBe(true);
  });

  it("R5/R6: ningun archivo usa \"use client\", next/headers, cookies(, @/lib/db ni searchParams", () => {
    const infracciones = archivos
      .map((rel) => [rel, infraccionesDinamicas(leer(rel))] as const)
      .filter(([, inf]) => inf.length > 0);
    expect(infracciones).toEqual([]);
  });

  it("R18: solo datos-legales.ts puede contener la marca o un correo literal", () => {
    const infracciones = archivos
      .filter((rel) => rel !== FUENTE_UNICA)
      .map((rel) => [rel, literalesLegales(leer(rel))] as const)
      .filter(([, inf]) => inf.length > 0);
    expect(infracciones).toEqual([]);
  });

  it("R18: los cuerpos reciben los datos por prop y no importan la configuracion", () => {
    for (const rel of ["app/_legal/PoliticaPrivacidad.tsx", "app/_legal/InstruccionesEliminacion.tsx"]) {
      expect(leer(rel), rel).not.toMatch(/\bDATOS_LEGALES\b/);
    }
  });
});
