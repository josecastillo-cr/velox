import fs from "node:fs";
import path from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { MARCA } from "@/lib/marca/identidad";
import { quitarComentarios } from "@/tests/fixtures/sin-comentarios";

import { MARCA_RETIRADA } from "@/tests/fixtures/marca-retirada-nombre-493";
// FICHA 492 (T4) — GUARDIA DE LA IDENTIDAD DEL DOCUMENTO Y DE LA PWA (R2, R4, R5, R6, R11).
//
// `public/manifest.json`, `public/offline.html` y `public/sw.js` no pueden importar codigo, asi
// que repiten a mano los valores de `lib/marca/identidad.ts`. Esta guardia los compara con la
// fuente unica (R2) y fija ademas los literales de contrato (R4, R11): comparar solo contra la
// fuente seria verde aunque la fuente estuviera mal.
//
// POR QUE VIVE EN `tests/unit/guards/`: un cambio en `public/**` no lo selecciona ningun grafo de
// imports, asi que fuera de aqui el gate rapido no la correria.

const RAIZ = process.cwd();
const leer = (rel: string) => fs.readFileSync(path.join(RAIZ, rel), "utf8");

interface Icono {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
}
interface Manifiesto {
  id: string;
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  scope: string;
  display: string;
  orientation: string;
  theme_color: string;
  background_color: string;
  categories: string[];
  shortcuts?: unknown;
  icons: Icono[];
}

const MANIFIESTO = JSON.parse(leer("public/manifest.json")) as Manifiesto;

describe("Feature 492 — manifiesto (R2, R4, R5)", () => {
  it("R4: nombre, nombre corto, descripcion y colores son los de Velox Courier (literales)", () => {
    expect(MANIFIESTO.name).toBe("Velox Courier");
    expect(MANIFIESTO.short_name).toBe("Velox");
    expect(MANIFIESTO.description).toBe("Plataforma de logística y entregas Velox Courier");
    expect(MANIFIESTO.theme_color).toBe("#011027");
    expect(MANIFIESTO.background_color).toBe("#011027");
  });

  it("R2: coinciden con la fuente unica", () => {
    expect(MANIFIESTO.name).toBe(MARCA.nombre);
    expect(MANIFIESTO.short_name).toBe(MARCA.nombreCorto);
    expect(MANIFIESTO.description).toBe(MARCA.descripcion);
    expect(MANIFIESTO.theme_color).toBe(MARCA.colorTema);
    expect(MANIFIESTO.background_color).toBe(MARCA.colorTema);
  });

  it("R5: conserva id, start_url, scope, display, orientation, categories, sin shortcuts y los iconos", () => {
    expect(MANIFIESTO.id).toBe("/");
    expect(MANIFIESTO.start_url).toBe("/");
    expect(MANIFIESTO.scope).toBe("/");
    expect(MANIFIESTO.display).toBe("standalone");
    expect(MANIFIESTO.orientation).toBe("portrait-primary");
    expect(MANIFIESTO.categories).toEqual(["business", "productivity"]);
    expect(MANIFIESTO).not.toHaveProperty("shortcuts");
    expect(MANIFIESTO.icons).toEqual([
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ]);
  });
});

describe("Feature 492 — offline.html (R2, R11)", () => {
  const html = leer("public/offline.html");

  it("R11: titulo «Velox Courier — Sin conexión» y theme-color #011027", () => {
    expect(html).toContain("<title>Velox Courier — Sin conexión</title>");
    expect(html).toContain('<meta name="theme-color" content="#011027" />');
  });

  it("R2: coincide con la fuente unica y no queda la marca anterior en <head>", () => {
    expect(html).toContain(`<title>${MARCA.nombre} — Sin conexión</title>`);
    expect(html).toContain(`<meta name="theme-color" content="${MARCA.colorTema}" />`);
    const head = /<head>([\s\S]*?)<\/head>/.exec(html)?.[1] ?? "";
    expect(head).not.toMatch(new RegExp(`<title>[^<]*${MARCA_RETIRADA}`));
    expect(head).not.toContain("#0d2444");
  });
});

describe("Feature 492 — sw.js (R2, R10)", () => {
  it("el titulo de reserva es el nombre de marca", () => {
    const sw = leer("public/sw.js");
    expect(sw).toContain('const TITULO_RESERVA = "Velox Courier";');
    expect(sw).toContain(`const TITULO_RESERVA = ${JSON.stringify(MARCA.nombre)};`);
  });
});

describe("Feature 492 — <head> del layout raiz (R1, R6)", () => {
  it("R1: el layout lee las metas de la fuente unica, no de literales", () => {
    const codigo = quitarComentarios(leer("app/layout.tsx"));
    expect(codigo).toContain('<meta name="theme-color" content={MARCA.colorTema} />');
    expect(codigo).toContain('<meta name="apple-mobile-web-app-title" content={MARCA.nombreCorto} />');
    expect(codigo).toMatch(/title:\s*MARCA\.nombre,/);
    expect(codigo).toMatch(/description:\s*MARCA\.descripcion,/);
    expect(codigo).not.toContain(MARCA_RETIRADA);
  });

  it("R6: metadata y el <head> pintado declaran titulo, descripcion, theme-color y nombre corto", async () => {
    vi.resetModules();
    vi.doMock("next/font/google", () => ({
      Poppins: () => ({ variable: "font-sans" }),
      JetBrains_Mono: () => ({ variable: "font-mono" }),
    }));
    vi.doMock("next/script", () => ({ default: () => null }));
    const { default: RootLayout, metadata } = await import("@/app/layout");

    expect(metadata.title).toBe("Velox Courier");
    expect(metadata.description).toBe("Plataforma de logística y entregas Velox Courier");

    const html = renderToStaticMarkup(RootLayout({ children: null }));
    expect(html).toContain('<meta name="theme-color" content="#011027"/>');
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="Velox"/>');

    vi.doUnmock("next/font/google");
    vi.doUnmock("next/script");
  });
});
