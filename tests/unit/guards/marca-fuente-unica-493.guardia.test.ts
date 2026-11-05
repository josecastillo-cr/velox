import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { MARCA } from "@/lib/marca/identidad";
import { avisoUbicacionDenegada } from "@/lib/utils/aviso-ubicacion-denegada";
import {
  MODULO_MARCA,
  PUEDEN_IMPORTAR_LA_MARCA,
  RAIZ,
  censoContrato,
  censoR1,
  censoR10Ayuda,
  censoR15Codigo,
  censoR15Public,
  censoR16Imports,
  censoR16Textos,
  censoR9Integradores,
  formatear,
  hallazgosContratoEnCodigo,
  hallazgosContratoEnTextoPlano,
  hallazgosMarcaAMano,
  hallazgosRetiradaEnCodigo,
  hallazgosRetiradaEnTextoPlano,
  hallazgosRetiradaExigibles,
  importaIdentidad,
  leer,
  type Hallazgo,
} from "@/tests/fixtures/marca-retirada-493";

// FEATURE 493 (T2, design §6) — LA MARCA VIVE EN UN SITIO Y LA RETIRADA NO VUELVE.
//
// Cinco bloques: R15 (sin «Ordenex» en texto), R1 (la marca vigente no se escribe a mano), R14
// (paridad de lo que no puede importar `MARCA`), R16 (los tests no se anclan a su fuente) y el
// contrato con integradores (R17, R18, R20). El detector, las listas cerradas y los recorridos
// viven en `tests/fixtures/marca-retirada-493.ts`, que es tambien lo que emite el censo de T2
// (`progress/censo_marca_493.md`): el censo y el veredicto salen del mismo codigo.
//
// Lee el arbol con `fs`: el grafo no la relaciona con los diffs y `--rapido` puede no correrla
// (memoria «guardia estructural escapa al --rapido»). Cada task la corre a mano.
//
// T2 → T13: mientras se migraba, los bloques del arbol iban con un trinquete por archivo
// (`tests/fixtures/marca-pendientes-493.ts`). T13 cerro todas las superficies, borro el trinquete
// y dejo cada bloque como `it` llano: cualquier hallazgo lo pone rojo.

const lista = (h: Hallazgo[]) => h.map(formatear);

// ---------------------------------------------------------------------------------------------
// 1. El detector no esta roto (contrapruebas sinteticas, design §6)
// ---------------------------------------------------------------------------------------------

describe("493 — el detector de marca no esta roto", () => {
  it("R15: ve la marca retirada en cualquier nodo de texto, tambien clave, valor o id; no lo que no es texto", () => {
    const infractor = [
      `const a = "Cobró Ordenex";`,
      `const b = <p>Ordenex · Guía</p>;`,
      "const c = `Total ${x} Ordenex`;",
      // 494: lo que la excepcion R11 admitia ya no se admite.
      `const k = "ordenex:descarga-columnas:cierres";`,
      "const t = `ordenex:${evento}`;",
      `const col = "ordenex";`,
      `const z = "solo_ordenex";`,
      `const g = "ganancia_ordenex";`,
    ].join("\n");
    expect(hallazgosRetiradaEnCodigo(infractor).map((h) => h.linea)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    // Esto no es texto: lo vigila la guardia de la 494, que busca en texto plano.
    const sinTexto = [
      `// Ordenex en un comentario`,
      `/* Ordenex */ const ingresoOrdenex = 1;`,
      `import { x } from "@/lib/utils/ingreso-ordenex";`,
      `vi.mock("@/lib/utils/ingreso-ordenex");`,
      `const e = <div>{/* Ordenex */}</div>;`,
      // «orden» + «ex…» no es la marca.
      `const o = "OrdenExistente ordenExigido";`,
    ].join("\n");
    expect(hallazgosRetiradaEnCodigo(sinTexto)).toEqual([]);
  });

  it("R15: una sola lista de excepciones, la de la 494, con su alcance", () => {
    const clave = `const k = "ordenex:sonido";`;
    expect(hallazgosRetiradaExigibles(clave, "lib/audio/x.ts")).toHaveLength(1);
    expect(hallazgosRetiradaExigibles(clave, "lib/navegador/claves-legadas.ts")).toEqual([]);
    expect(hallazgosRetiradaExigibles(`const t = "Cobró Ordenex";`, "lib/navegador/claves-legadas.ts")).toHaveLength(1);
    // E5.1 va por linea: en `public/sw.js` el alias se admite y otra clave no.
    expect(hallazgosRetiradaExigibles(`const A = "ordenex:relevo-ahora";`, "public/sw.js")).toEqual([]);
    expect(hallazgosRetiradaExigibles(clave, "public/sw.js")).toHaveLength(1);
  });

  it("R15: en texto plano cada linea con la marca retirada es hallazgo", () => {
    const md = "# Ayuda\nOrdenex te cobra.\nNada aqui.\nver ordenex-api-key.postman_collection.json\n";
    expect(hallazgosRetiradaEnTextoPlano(md, "x.md").map((h) => h.linea)).toEqual([2, 4]);
  });

  it("R1: ve la marca vigente escrita a mano; no lo que la interpola", () => {
    const fuente = [
      `const a = "Total Velox Courier";`,
      "const b = `Total ${MARCA.nombreCorto}`;",
      "const c = `Ganancia de ${MARCA.nombre}`;",
    ].join("\n");
    expect(hallazgosMarcaAMano(fuente, "f.ts", MARCA).map((h) => h.linea)).toEqual([1]);
    expect(hallazgosMarcaAMano(`const x = "Cobró Velox";`, "f.ts", MARCA)).toHaveLength(1);
    expect(hallazgosMarcaAMano(`const h = "X-Velox-Signature";`, "f.ts", MARCA)).toEqual([]);
  });

  it("R16: ve el import de la marca por alias, ruta relativa y mock; no un comentario", () => {
    expect(importaIdentidad(`import { MARCA } from "@/lib/marca/identidad";`)).toBe(true);
    expect(importaIdentidad(`import { MARCA } from "../../lib/marca/identidad";`)).toBe(true);
    expect(importaIdentidad(`vi.mock("@/lib/marca/identidad", () => ({}));`)).toBe(true);
    expect(importaIdentidad(`// import { MARCA } from "@/lib/marca/identidad";\nconst x = 1;`)).toBe(false);
    expect(importaIdentidad(`import { NOMBRE_ESPERADO } from "@/tests/fixtures/marca-esperada";`)).toBe(false);
  });

  it("R16: en un test ve la marca en cualquier texto: dicha, identificador, ruta, dato de prueba o cabecera", () => {
    const malo = [
      `expect(label).toBe("Cobró Ordenex");`,
      `it("ORDENEX paga", () => {});`,
      `const r = "ganancia de ordenex";`,
      `const h = { "X-Ordenex-Signature": "sha256=x" };`,
      `it("deOrdenex y NETO_ORDENEX_LABEL", () => {});`,
      `const p = "lib/utils/ingreso-ordenex.ts";`,
      `const s = "[data-bolsillo='ordenex']";`,
      `const m = "no-reply@ordenex.co";`,
      `const u = "https://ordenex.app/paquete/1";`,
      `not.toHaveProperty("X-Ordenex-Signature");`,
    ].join("\n");
    expect(hallazgosRetiradaEnCodigo(malo, "t.test.ts").map((h) => h.linea)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("contrato: ve la cabecera y el dominio viejos en texto; no en comentarios", () => {
    const fuente = [
      `const h = "X-Ordenex-Signature";`,
      `const u = "https://app.ordenex.co/x";`,
      `// X-Ordenex-Signature y https://ordenex.co en un comentario`,
    ].join("\n");
    expect(hallazgosContratoEnCodigo(fuente)).toHaveLength(2);
    expect(hallazgosContratoEnTextoPlano("mailto:soporte@ordenex.co\nnada", "x.md")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------------------------
// 2. El arbol
// ---------------------------------------------------------------------------------------------

describe("493 — R15/R10/R9: sin la marca retirada en texto", () => {
  it("app/, components/, hooks/, lib/ (nodos de texto)", () => {
    expect(lista(censoR15Codigo()), "texto con la marca retirada: usa MARCA.nombre / MARCA.nombreCorto").toEqual([]);
  });

  it("public/ (sw.js por AST; manifest y offline como texto)", () => {
    expect(lista(censoR15Public())).toEqual([]);
  });

  it("docs/ayuda/** (R10)", () => {
    expect(lista(censoR10Ayuda()), "prosa literal «Velox Courier»").toEqual([]);
  });

  it("documentacion para integradores: guia, su README y el .yaml (R9)", () => {
    expect(lista(censoR9Integradores()), "prosa literal «Velox Courier»").toEqual([]);
  });
});

describe("493 — R1: la marca vigente solo vive en su modulo", () => {
  it("ningun texto fuera de lib/marca/identidad.ts escribe la marca a mano", () => {
    expect(lista(censoR1(MARCA)), "interpola MARCA.nombre / MARCA.nombreCorto").toEqual([]);
  });

  it("no-vacuidad: el modulo de la marca SI la contiene (el detector la veria)", () => {
    expect(hallazgosMarcaAMano(leer(MODULO_MARCA), MODULO_MARCA, MARCA).length).toBeGreaterThan(0);
  });
});

describe("493 — R14: paridad de lo que no puede importar MARCA", () => {
  it("public/sw.js: TITULO_RESERVA es MARCA.nombre", () => {
    const m = leer("public/sw.js").match(/const TITULO_RESERVA = "([^"]*)";/);
    expect(m, "public/sw.js ya no declara TITULO_RESERVA").not.toBeNull();
    expect(m?.[1]).toBe(MARCA.nombre);
  });

  it("aviso de ubicacion denegada: manda a buscar el short_name del manifiesto", () => {
    const corto = (JSON.parse(leer("public/manifest.json")) as { short_name: string }).short_name;
    const instalada = avisoUbicacionDenegada("app_instalada", "denegado");
    const sinDecidir = avisoUbicacionDenegada("app_instalada", "sin_decidir");
    expect(instalada.pasos).toContain(`Entrá en Aplicaciones y buscá ${corto}.`);
    expect(sinDecidir.nota).toContain(`Aplicaciones → ${corto} → Permisos`);
  });
});

describe("493 — R16: los tests no se anclan a su fuente", () => {
  it("solo la lista cerrada importa lib/marca/identidad", () => {
    expect(censoR16Imports(), "un test de texto escribe la marca desde tests/fixtures/marca-esperada.ts").toEqual([]);
  });

  it("la lista cerrada existe (no se queda apuntando a archivos borrados)", () => {
    for (const f of PUEDEN_IMPORTAR_LA_MARCA) expect(existsSync(path.join(RAIZ, f)), f).toBe(true);
  });

  it("ningun test dice la marca retirada en un texto", () => {
    expect(
      lista(censoR16Textos()),
      "escribe la marca con NOMBRE_ESPERADO / NOMBRE_CORTO_ESPERADO de tests/fixtures/marca-esperada.ts; una negativa, con MARCA_RETIRADA de tests/fixtures/marca-retirada-nombre-493.ts",
    ).toEqual([]);
  });
});

describe("493 — contrato con integradores (R17, R18, R20)", () => {
  it("sin X-Ordenex-*, ordenex.co ni soporte@ordenex.co en codigo, public/, ayuda y docs/api (sin CHANGELOG)", () => {
    expect(lista(censoContrato())).toEqual([]);
  });

  it("lib/crypto/webhook-firma.ts declara X-Velox-Signature y X-Velox-Timestamp", () => {
    const fuente = leer("lib/crypto/webhook-firma.ts");
    expect(fuente).toContain(`"X-Velox-Signature"`);
    expect(fuente).toContain(`"X-Velox-Timestamp"`);
  });
});
