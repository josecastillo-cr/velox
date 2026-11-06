import fs from "node:fs";
import path from "node:path";

import { describe, it, expect } from "vitest";

import { quitarComentarios } from "@/tests/fixtures/sin-comentarios";

// ═════════════════════════════════════════════════════════════════════════════════════════════
// ⭑ FICHA 498 (T4.4, design §11; R28, R32, R43, R47) — UNA SOLA DEFINICION DEL APORTE DE UNA SATELITE.
// ═════════════════════════════════════════════════════════════════════════════════════════════
//
//  1. En `lib/`, la resta `total_general - … total_pago_mensajero` (SQL) solo vive en
//     `lib/repositories/deuda-satelite-sql.ts` (la gemela de `paraLaCentral`).
//  2. La formula retirada (`saldoDe(`, efectivo − recibido) no vuelve en `lib/` ni en `app/`.
//  3. La tabla de ajustes es APPEND-ONLY: nadie hace `update`/`updateMany`/`delete`/`deleteMany` sobre
//     `conciliacionBodegaAjuste` desde `lib/`.
//  4. `esperadoReglaAnterior` / `esperado_regla_anterior` solo se LEE en los sitios declarados y
//     NINGUN archivo de `lib/` ni de `app/` lo ESCRIBE (solo la migracion M4).
//  5. `marcarConsolidacionRecibidaSchema` no usa un esquema de monto que admita negativos.
//  6. R43 — los archivos de la conciliacion de `lib/`, `app/`, `components/` y `docs/ayuda/` no dicen
//     que la marca es informativa, que desmarcar no mueve dinero ni que la marca no escribe en ningun
//     libro; y la nota de la conciliacion es LITERAL (T7.3/T7.4).
//
// Lee archivos con `fs`: el grafo NO la relaciona con el diff, se corre A MANO (design §11).
// AUTOCOMPROBACION al final: cada detector se pone rojo ante una copia sembrada.

const RAIZ = path.join(__dirname, "..", "..", "..");

function archivos(dir: string): string[] {
  const salida: string[] = [];
  const recorrer = (d: string) => {
    for (const e of fs.readdirSync(path.join(RAIZ, d), { withFileTypes: true })) {
      const rel = path.posix.join(d, e.name);
      if (e.isDirectory()) recorrer(rel);
      else if (/\.(ts|tsx)$/.test(e.name)) salida.push(rel);
    }
  };
  recorrer(dir);
  return salida;
}

const leer = (rel: string) => fs.readFileSync(path.join(RAIZ, rel), "utf8");
const LIB = archivos("lib");
const APP = archivos("app");
const COMPONENTS = archivos("components");

// ── Detectores (puros, para poder autocomprobarlos) ──
export const RESTA_SQL = /total_general\s*-\s*\S*total_pago_mensajero/;
export const SALDO_DE = /\bsaldoDe\(/;
export const ESCRITURA_AJUSTE = /conciliacionBodegaAjuste\s*\.\s*(update|updateMany|delete|deleteMany|upsert)\b/;
export const LECTURA_REGULARIZACION = /esperadoReglaAnterior|esperado_regla_anterior/;
/** Una ESCRITURA de la columna: en SQL (`SET … esperado_regla_anterior =`) o en un `data` de Prisma. */
export const ESCRITURA_REGULARIZACION =
  /esperado_regla_anterior\s*=(?!=)|data\s*:\s*\{[^}]*esperadoReglaAnterior\s*:/;
export const TEXTO_INFORMATIVA = /marca[^.\n]{0,40}informativa|informativa[^.\n]{0,40}marca|no mueve dinero|no mueve un col|NINGUN LIBRO DE DINERO/i;

/** Los sitios que pueden LEER la marca de la regularizacion (design §11), con su motivo. */
const LECTORES_DE_LA_REGULARIZACION = new Set([
  "lib/utils/conciliacion-satelite.ts", // `aporteDeConsolidacion`: la unica que la interpreta en TS
  "lib/repositories/deuda-satelite-sql.ts", // `saldadaReglaAnteriorSql`
  "lib/repositories/SaldosSatelitesRepository.ts", // la consulta de Saldos (§6)
  "lib/repositories/EstadoCuentaRepository.ts", // la consulta del estado de cuenta (§7)
  // Estos dos solo la SELECCIONAN para pasarsela a `aporteDeConsolidacion` (no la interpretan):
  "lib/repositories/CierreBodegaRepository.ts", // `BODEGA_RESUMEN_SELECT` → `faltaPorRecibir` (R27)
  "lib/repositories/CierresBodegaAdminRepository.ts", // `APORTE_SELECT` → esperado de marcar/corregir
]);

/**
 * T7.3/T7.4 (R43) — los archivos de la conciliacion en PANTALLA y en la ayuda. Se enumeran por
 * carpeta (lo que nazca ahi entra solo) mas las dos piezas sueltas que la montan o la explican. El
 * resto de `app/` no se barre: «marca informativa» o «no mueve dinero» se dicen alli de OTRAS cosas
 * (la tarifa especial, las marcas de la tarjeta POS, el SINPE de bodega), y son verdad.
 */
const CONCILIACION_PANTALLA = [
  ...COMPONENTS.filter((f) => f.startsWith("components/shared/conciliacion/")),
  ...APP.filter((f) => f.startsWith("app/(app)/wallet/satelites/")),
  "app/(app)/cierres-admin/_components/CierresBodegaAdminModule.tsx",
];
const AYUDA_CONCILIACION = ["docs/ayuda/oficina/wallet-satelites.md", "docs/ayuda/oficina/wallet-caja.md"];

/** R43 — la nota de la conciliacion, LITERAL del requisito (escrita a mano, no leida de su constante). */
const NOTA_R43 =
  "Marcar recibido asienta el dinero en la caja. Después no se puede desmarcar, y «Corregir» solo aparece si lo recibido quedó por debajo o por encima de lo que debe: si coincide, no hay botón para cambiar el monto.";

/** Los archivos de la conciliacion en `lib/` (R43). */
const CONCILIACION_LIB = [
  "lib/repositories/CierresBodegaAdminRepository.ts",
  "lib/interfaces/repositories/ICierresBodegaAdminRepository.ts",
  "lib/services/ConciliacionSatelitesService.ts",
  "lib/interfaces/services/IConciliacionSatelitesService.ts",
  "lib/actions/conciliacion-satelites.ts",
  "lib/utils/conciliacion-satelite.ts",
  "lib/repositories/SaldosSatelitesRepository.ts",
  "lib/interfaces/repositories/ISaldosSatelitesRepository.ts",
  "lib/types/conciliacion-satelites.ts",
];

const codigo = (rel: string) => quitarComentarios(leer(rel));

describe("498/T4.4 — el aporte de una satelite tiene UNA sola definicion", () => {
  it("anti-vacuidad: el censo encuentra archivos", () => {
    expect(LIB.length).toBeGreaterThan(100);
    expect(APP.length).toBeGreaterThan(50);
  });

  it("⭑ R28: la resta SQL del aporte solo vive en `deuda-satelite-sql.ts`", () => {
    const con = LIB.filter((f) => RESTA_SQL.test(codigo(f)));
    expect(con).toEqual(["lib/repositories/deuda-satelite-sql.ts"]);
  });

  it("⭑ la formula retirada `saldoDe(` no vuelve en `lib/`, `app/` ni `components/`", () => {
    // `AbonoTiendaService`/`CobroTiendaService` tienen un METODO privado `this.saldoDe(` de otra cosa
    // (el saldo de una tienda): se excluyen su declaracion y sus llamadas por `this.`.
    const con = [...LIB, ...APP, ...COMPONENTS].filter((f) =>
      SALDO_DE.test(codigo(f).replace(/this\.saldoDe\(|async saldoDe\(/g, "")),
    );
    expect(con).toEqual([]);
  });

  it("⭑ R47: nadie actualiza ni borra filas de `conciliacion_bodega_ajuste` desde `lib/`", () => {
    expect(LIB.filter((f) => ESCRITURA_AJUSTE.test(codigo(f)))).toEqual([]);
  });

  it("⭑ Q4: `esperado_regla_anterior` solo se lee en los sitios declarados y NADIE lo escribe", () => {
    const lectores = [...LIB, ...APP].filter((f) => LECTURA_REGULARIZACION.test(codigo(f)));
    expect(lectores.filter((f) => !LECTORES_DE_LA_REGULARIZACION.has(f))).toEqual([]);
    expect([...LIB, ...APP].filter((f) => ESCRITURA_REGULARIZACION.test(codigo(f)))).toEqual([]);
    // Anti-vacuidad: los lectores declarados existen y de verdad la leen.
    for (const f of LECTORES_DE_LA_REGULARIZACION) expect(LECTURA_REGULARIZACION.test(codigo(f)), f).toBe(true);
  });

  it("R15b: `marcarConsolidacionRecibidaSchema` no usa un esquema de monto que admita negativos", () => {
    const src = codigo("lib/types/conciliacion-satelites.ts");
    const m = /marcarConsolidacionRecibidaSchema\s*=\s*z\s*\.object\(\{([\s\S]*?)\}\)/.exec(src);
    expect(m).not.toBeNull();
    const cuerpo = (m as RegExpExecArray)[1];
    expect(cuerpo).toMatch(/montoRecibido:\s*z\.union\(\[montoPositivoSchema,\s*montoCeroSchema\]\)/);
    expect(cuerpo).not.toMatch(/montoRecibido:\s*z\.(string|number|coerce)/);
  });

  it("⭑ R43: los archivos de la conciliacion de `lib/` no dicen que la marca es informativa ni que no mueve dinero", () => {
    const con = CONCILIACION_LIB.filter((f) => TEXTO_INFORMATIVA.test(leer(f)));
    expect(con).toEqual([]);
  });

  it("⭑ R43 (T7.3/T7.4): ni la pantalla de la conciliacion ni su ayuda lo dicen (con comentarios)", () => {
    // Anti-vacuidad: el censo de pantalla encuentra las piezas que de verdad concilian.
    expect(CONCILIACION_PANTALLA).toContain("components/shared/conciliacion/ConciliacionAcciones.tsx");
    expect(CONCILIACION_PANTALLA).toContain("components/shared/conciliacion/conciliacion-labels.ts");
    expect(CONCILIACION_PANTALLA).toContain("app/(app)/wallet/satelites/_components/ConciliacionSatelite.tsx");
    for (const f of AYUDA_CONCILIACION) expect(fs.existsSync(path.join(RAIZ, f)), f).toBe(true);
    const con = [...CONCILIACION_PANTALLA, ...AYUDA_CONCILIACION].filter((f) => TEXTO_INFORMATIVA.test(leer(f)));
    expect(con).toEqual([]);
  });

  it("⭑ R43: la nota de la conciliacion es LITERAL y la retirada no vuelve", () => {
    const src = leer("components/shared/conciliacion/conciliacion-labels.ts");
    const m = /NOTA_CONCILIACION_ASIENTA\s*=\s*((?:\s*"[^"]*"\s*\+?)+);/.exec(src);
    expect(m, "falta NOTA_CONCILIACION_ASIENTA").not.toBeNull();
    const texto = [...(m as RegExpExecArray)[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]).join("");
    expect(texto).toBe(NOTA_R43);
    expect([...APP, ...COMPONENTS].filter((f) => /DESMARCAR_NO_MUEVE_DINERO/.test(leer(f)))).toEqual([]);
    // La ayuda de satelites la cita tal cual.
    expect(leer("docs/ayuda/oficina/wallet-satelites.md")).toContain(NOTA_R43);
  });
});

describe("498/T4.4 — AUTOCOMPROBACION: cada detector se pone rojo ante una copia sembrada", () => {
  it("la resta del aporte copiada en otro archivo se ve", () => {
    expect(RESTA_SQL.test("SUM(c.total_general - c.total_pago_mensajero - c.total_ingreso_bodega_rechazos)")).toBe(true);
    expect(RESTA_SQL.test("SUM(c.total_efectivo)")).toBe(false);
  });

  it("`saldoDe(` sembrado se ve", () => {
    expect(SALDO_DE.test("faltaPorRecibir: saldoDe(r.totalEfectivo, r.montoRecibido)")).toBe(true);
  });

  it("un `update`/`delete` sobre la tabla de ajustes se ve", () => {
    expect(ESCRITURA_AJUSTE.test("await tx.conciliacionBodegaAjuste.deleteMany({ where })")).toBe(true);
    expect(ESCRITURA_AJUSTE.test("await tx.conciliacionBodegaAjuste.create({ data })")).toBe(false);
  });

  it("una escritura de la regularizacion se ve (SQL y Prisma), y un `select` no", () => {
    expect(ESCRITURA_REGULARIZACION.test("UPDATE cierre_bodega SET esperado_regla_anterior = 1")).toBe(true);
    expect(ESCRITURA_REGULARIZACION.test("tx.cierreBodega.update({ where, data: { esperadoReglaAnterior: x } })")).toBe(true);
    expect(ESCRITURA_REGULARIZACION.test("select: { esperadoReglaAnterior: true }")).toBe(false);
    expect(ESCRITURA_REGULARIZACION.test("WHERE cb.esperado_regla_anterior IS NOT NULL")).toBe(false);
  });

  it("los textos de R43 sembrados se ven", () => {
    expect(TEXTO_INFORMATIVA.test("La marca es informativa: dice si el efectivo llego")).toBe(true);
    expect(TEXTO_INFORMATIVA.test("Desmarcar no mueve dinero.")).toBe(true);
    expect(TEXTO_INFORMATIVA.test("NO ESCRIBE EN NINGUN LIBRO DE DINERO (R14)")).toBe(true);
    expect(TEXTO_INFORMATIVA.test("Marcar recibido asienta el dinero en la caja.")).toBe(false);
  });
});
