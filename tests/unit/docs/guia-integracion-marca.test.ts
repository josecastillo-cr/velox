import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { MARCA_RETIRADA } from "@/tests/fixtures/marca-retirada-nombre-493";
// Feature 492 (R21) — la fuente de la guia de integracion lleva la marca Velox Courier en su
// identidad: `<title>`, autor, pie de pagina (`@page`), titulo de portada y `<h1>`, y la portada
// muestra el logotipo sobre fondo claro. La prosa del cuerpo y la «Base URL» son de la 493
// (P6, P7): esta prueba NO mira el cuerpo.
//
// POR QUE ESTA PRUEBA LEE EL ARCHIVO: `docs/**` no lo importa nadie; el grafo no la seleccionaria.

const CARPETA = path.join(process.cwd(), "docs", "api", "guia-integracion");
const HTML = fs.readFileSync(path.join(CARPETA, "guia-integracion.html"), "utf8");

describe("Feature 492 — identidad de la guia de integracion (R21)", () => {
  it("el <title> lleva el nombre de marca", () => {
    expect(HTML).toContain("<title>Guía de integración — API de Velox Courier</title>");
  });

  it("el autor es Velox Courier", () => {
    expect(HTML).toContain('<meta name="author" content="Velox Courier">');
  });

  it("el pie de pagina (@bottom-left) lleva el nombre de marca", () => {
    expect(HTML).toContain('@bottom-left { content: "Guía de integración — API de Velox Courier";');
  });

  it("el titulo de la portada y el <h1> de la introduccion llevan el nombre de marca", () => {
    expect(HTML).toContain('<div class="title">Guía de integración<br>API de Velox Courier</div>');
    expect(HTML).toContain("<h1>Guía de integración — API de Velox Courier</h1>");
  });

  it(`ninguna de esas cinco piezas conserva «${MARCA_RETIRADA}»`, () => {
    expect(HTML).not.toMatch(new RegExp(`<title>[^<]*${MARCA_RETIRADA}`));
    expect(HTML).not.toMatch(new RegExp(`<meta name="author" content="[^"]*${MARCA_RETIRADA}`));
    expect(HTML).not.toMatch(new RegExp(`@bottom-left \\{ content: "[^"]*${MARCA_RETIRADA}`));
    expect(HTML).not.toMatch(new RegExp(`<div class="title">[^<]*(<br>[^<]*)?${MARCA_RETIRADA}`));
    expect(HTML).not.toMatch(new RegExp(`<h1>Guía de integración[^<]*${MARCA_RETIRADA}`));
  });

  it("la portada muestra el logotipo sobre fondo claro, y la ruta resuelve a un archivo existente", () => {
    const portada = /<section class="cover">([\s\S]*?)<\/section>/.exec(HTML)?.[1] ?? "";
    const src = /<img\b[^>]*\bsrc="([^"]+)"/.exec(portada)?.[1];
    expect(src).toBeDefined();
    const resuelto = path.resolve(CARPETA, src!);
    expect(path.relative(process.cwd(), resuelto).replace(/\\/g, "/")).toBe(
      "docs/marca/velox/svg/logo-horizontal-fondo-claro.svg",
    );
    expect(fs.existsSync(resuelto)).toBe(true);
  });
});
