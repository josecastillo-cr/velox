import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { NOMBRE_CORTO_ESPERADO, NOMBRE_ESPERADO } from "@/tests/fixtures/marca-esperada";
import { MARCA_RETIRADA } from "@/tests/fixtures/marca-retirada-nombre-493";

// FEATURE 493 (T15, R19) — EL AVISO A LOS INTEGRADORES EXISTE Y DICE LOS CAMBIOS DE CONTRATO.
//
// El changelog del canal es el aviso que se copia y se manda (su propia convención): si la entrada
// no está, o no nombra lo que el integrador tiene que tocar, la release sale sin aviso. Los
// valores nuevos se escriben LITERALES (L5b): ni la cabecera ni el dominio salen de una constante
// de producción. La guía de integración tiene que reflejar lo mismo.

const DOCS = path.join(__dirname, "..", "..", "..", "docs", "api");
const changelog = fs.readFileSync(path.join(DOCS, "CHANGELOG.md"), "utf8").replace(/\r\n/g, "\n");
const guia = fs.readFileSync(path.join(DOCS, "guia-integracion", "guia-integracion.html"), "utf8");

/** La entrada de la 493: desde su encabezado hasta el separador siguiente. */
function entrada(): string {
  const inicio = changelog.search(/^## 2026-11-\d\d — ⚠️ RUPTURA — .*Velox Courier/m);
  expect(inicio, "no hay entrada de noviembre 2026 marcada como RUPTURA que nombre Velox Courier").toBeGreaterThan(-1);
  const fin = changelog.indexOf("\n---\n", inicio);
  return changelog.slice(inicio, fin === -1 ? undefined : fin);
}

describe("493/R19 — la entrada del CHANGELOG del canal", () => {
  // Ya no se exige que sea la primera de todas: eso se rompe con cualquier entrada posterior, también
  // sin ruptura. El contrato es que sea la ruptura más reciente y que el archivo siga con lo último arriba.
  it("es la RUPTURA más reciente del canal, fechada", () => {
    const primeraRuptura = changelog.match(/^## .*RUPTURA.*$/m)?.[0] ?? "";
    expect(primeraRuptura).toMatch(/^## 2026-11-\d\d — ⚠️ RUPTURA — /);
  });

  it("las entradas van por fecha descendente (la más reciente arriba)", () => {
    const fechas = [...changelog.matchAll(/^## (\d{4}-\d{2}-\d{2})\b/gm)].map((m) => m[1]);
    expect(fechas.length, "el recorrido no ve las entradas").toBeGreaterThan(20);
    expect(fechas).toEqual([...fechas].sort().reverse());
  });

  it("R17: nombra las cabeceras nuevas y las que se retiran", () => {
    const e = entrada();
    expect(e).toContain("X-Velox-Signature");
    expect(e).toContain("X-Velox-Timestamp");
    expect(e).toContain(`X-${MARCA_RETIRADA}-Signature`);
    expect(e).toContain(`X-${MARCA_RETIRADA}-Timestamp`);
    expect(e).toMatch(/sin periodo de doble cabecera|dejan de enviarse/i);
  });

  it("R18: nombra el dominio nuevo como Base URL y como origen de evidenciasUrl", () => {
    const e = entrada();
    expect(e).toContain("https://velox-courier.company");
    expect(e).toContain("evidenciasUrl");
  });

  it("R13: lista los encabezados de descarga nuevos con su antes", () => {
    const e = entrada();
    expect(e).toContain(`«Cobró ${NOMBRE_CORTO_ESPERADO} (no sumar: importe de la orden completa)»`);
    expect(e).toContain(`«Total ${NOMBRE_CORTO_ESPERADO}»`);
    expect(e).toContain(`«Cobró ${MARCA_RETIRADA} (no sumar: importe de la orden completa)»`);
    expect(e).toContain(`«Total ${MARCA_RETIRADA}»`);
  });

  it("R20: nombra la empresa y el correo de soporte", () => {
    const e = entrada();
    expect(e).toContain(NOMBRE_ESPERADO);
    expect(e).toContain("battos.sa@gmail.com");
  });
});

describe("493/R19 — la guía de integración refleja los mismos cambios", () => {
  it("tiene la sección de cambios de noviembre con las cabeceras, el dominio y los encabezados nuevos", () => {
    expect(guia).toContain("Versión del documento: noviembre 2026");
    expect(guia).toContain("Cambios respecto de la versión de septiembre 2026");
    expect(guia).toContain("X-Velox-Signature");
    expect(guia).toContain("X-Velox-Timestamp");
    expect(guia).toContain("https://velox-courier.company");
    expect(guia).toContain(`«Cobró ${NOMBRE_CORTO_ESPERADO} (no sumar: importe de la orden completa)»`);
    expect(guia).toContain("battos.sa@gmail.com");
  });

  it("no conserva la marca retirada (las cabeceras y el dominio viejos solo viven en el changelog)", () => {
    expect(guia).not.toContain(MARCA_RETIRADA);
    expect(guia.toLowerCase()).not.toContain(MARCA_RETIRADA.toLowerCase());
  });
});
