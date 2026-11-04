import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PENDIENTES_494 } from "@/tests/fixtures/marca-pendientes-494";
import {
  COLECCION_NUEVA,
  COLECCION_VIEJA,
  EXCEPCIONES,
  RAIZ,
  archivosDeHosts,
  archivosDelArbol,
  censoArbol,
  censoMigraciones494,
  censoPlantillasConMarca,
  censoPlantillasLiteral,
  estaExceptuado,
  excepcionesMuertas,
  formatear,
  hallazgosEnRuta,
  hallazgosEnTexto,
  hallazgosLegado,
  hallazgosMigracion,
  hallazgosPlantillaConMarca,
  hallazgosPlantillaLiteral,
  hallazgosProyecto,
  hallazgosReleaseB2B4,
  leerTexto,
  recuentoPorArchivo,
  trinquete,
  type Hallazgo,
} from "@/tests/fixtures/marca-sin-ordenex-494";

// FEATURE 494 (T1.1, T1.2, design §7) — LA MARCA RETIRADA NO VIVE EN EL ARBOL.
//
// Detector y recorridos en `tests/fixtures/marca-sin-ordenex-494.ts`; lo que aun falta, por archivo,
// en `tests/fixtures/marca-pendientes-494.ts` (trinquete, solo baja). La tanda 7 borra el trinquete y
// deja el bloque «arbol» como `it` llano.
//
// Lee con `fs`: `--rapido` no la relaciona con un diff. Cada tanda la corre a mano.

const lista = (h: readonly Hallazgo[]) => h.map(formatear);

describe("494 — el detector no esta roto (R2)", () => {
  it("codigo, cadena y comentario salen con hallazgo, en cualquier caja", () => {
    const fuente = [
      `const ingresoOrdenex = 1;`,
      `const a = "cobro de ordenex";`,
      `// ORDENEX en un comentario`,
      `/* Ordenex en un bloque */`,
      `nada que ver`,
    ].join("\n");
    expect(hallazgosEnTexto(fuente, "x.ts").map((h) => h.linea)).toEqual([1, 2, 3, 4]);
  });

  it("nombre de archivo y de carpeta salen con hallazgo", () => {
    expect(hallazgosEnRuta("lib/utils/ingreso-ordenex.ts")).toHaveLength(1);
    expect(hallazgosEnRuta("docs/ORDENEX/x.md")).toHaveLength(1);
    expect(hallazgosEnRuta("lib/utils/ingreso.ts")).toEqual([]);
  });

  it("nombra archivo, linea y fragmento", () => {
    const [h] = hallazgosEnTexto(`\n  const v = "ordenex";`, "lib/x.ts");
    expect(formatear(h)).toBe(`lib/x.ts:2 — const v = "ordenex";`);
    expect(formatear(hallazgosEnRuta("lib/ordenex.ts")[0])).toContain("lib/ordenex.ts:0");
  });

  it("cuenta apariciones, no lineas, y un CRLF no mueve la linea", () => {
    expect(hallazgosEnTexto("ordenex y Ordenex", "x.ts")).toHaveLength(2);
    expect(hallazgosEnTexto("a\r\nb\r\nordenex\r\n", "x.ts").map((h) => h.linea)).toEqual([3]);
  });

  it("«orden» + «ex…» no es la marca; un compuesto de la marca, si", () => {
    expect(hallazgosEnTexto("OrdenExistente ordenExigido ordenExacta", "x.ts")).toEqual([]);
    expect(hallazgosEnTexto("ordenexCobra", "x.ts")).toHaveLength(1);
    expect(hallazgosEnTexto("OrdenexPista", "x.ts")).toHaveLength(1);
    expect(hallazgosEnTexto("ORDENEXISTE", "x.ts")).toHaveLength(1);
  });
});

describe("494 — excepciones (R3)", () => {
  it("todas declaran motivo y coinciden con algo real", () => {
    expect(excepcionesMuertas()).toEqual([]);
  });

  it("contraprueba: una excepcion muerta sale roja, nombrandola", () => {
    const muerta = { id: "EX", motivo: "sintetica", rutas: ["no/existe.ts"] };
    expect(excepcionesMuertas([muerta])).toEqual(["EX: no/existe.ts ya no coincide con ninguna aparicion"]);
    // Existe, pero la marca ya no esta: tambien muerta.
    const limpia = { id: "EY", motivo: "sintetica", rutas: ["tsconfig.json"] };
    expect(excepcionesMuertas([limpia])).toEqual(["EY: tsconfig.json ya no coincide con ninguna aparicion"]);
    // Sigue teniendo la marca, pero ninguna linea cumple el patron.
    const sinLinea = { id: "EZ", motivo: "sintetica", rutas: ["CLAUDE.md"], linea: /patron-que-no-esta/ };
    expect(excepcionesMuertas([sinLinea])).toEqual(["EZ: CLAUDE.md ya no coincide con ninguna aparicion"]);
  });

  it("contraprueba: sin motivo sale roja", () => {
    expect(excepcionesMuertas([{ id: "EX", motivo: " ", rutas: ["CLAUDE.md"], activaEn: "T0" }])).toEqual(["EX: sin motivo"]);
  });

  it("una entrada aun no activa no exceptua nada", () => {
    const e = { id: "EX", motivo: "m", rutas: ["lib/x.ts"], activaEn: "T9" };
    expect(estaExceptuado("lib/x.ts", "ordenex", [e])).toBe(false);
    expect(estaExceptuado("lib/x.ts", "ordenex", [{ ...e, activaEn: undefined }])).toBe(true);
  });

  it("una excepcion por linea no cubre el resto del archivo ni su nombre", () => {
    const e = { id: "EX", motivo: "m", rutas: ["lib/x.ts"], linea: /base-local/ };
    expect(estaExceptuado("lib/x.ts", "base-local ordenex", [e])).toBe(true);
    expect(estaExceptuado("lib/x.ts", "ingresoOrdenex", [e])).toBe(false);
    expect(estaExceptuado("lib/x.ts", null, [e])).toBe(false);
  });

  it("la lista es la cerrada de design §7, mas el andamiaje E9", () => {
    expect(EXCEPCIONES.map((e) => e.id)).toEqual(["E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8", "E9"]);
  });

  // T8.2: al cerrar, ninguna entrada puede seguir sin activar, y E9 ya no existe.
  it.todo("T8.2: ninguna excepcion queda con `activaEn`, y E9 se ha retirado");
});

describe("494 — arbol con trinquete (R1, R2)", () => {
  it("no-vacuidad: el recorrido ve el arbol, y el arbol incluye lo que dice el glosario", () => {
    const arbol = archivosDelArbol();
    expect(arbol.length).toBeGreaterThan(1000);
    for (const f of ["package.json", "DESIGN.md", ".env.example", "db/schema.prisma", "public/sw.js"]) {
      expect(arbol, f).toContain(f);
    }
    expect(arbol).not.toContain("docs/api/CHANGELOG.md");
  });

  it("contraprueba del trinquete: uno nuevo y uno por encima, rojo; uno por debajo, desfasado", () => {
    const { nuevos, desfasados } = trinquete({ "a.ts": 1, "b.ts": 3, "c.ts": 1 }, { "b.ts": 2, "c.ts": 2 });
    expect(nuevos).toEqual(["a.ts: 1 (no esta en lo pendiente)", "b.ts: 3 (su tope es 2)"]);
    expect(desfasados).toEqual(["c.ts: 1 (anotado 2)"]);
  });

  const { nuevos, desfasados } = trinquete(recuentoPorArchivo(censoArbol()), PENDIENTES_494);

  it("nada fuera de lo pendiente ni por encima de su numero", () => {
    expect(nuevos, "marca retirada donde no toca: usa `empresa` / `app:` (design §3.1)").toEqual([]);
  });

  it("cada pendiente sigue con su numero exacto (al bajar, se regenera)", () => {
    expect(desfasados, "pnpm exec tsx tests/fixtures/marca-sin-ordenex-494.ts pendientes").toEqual([]);
  });
});

describe("494 — legado del navegador (R20)", () => {
  it("contraprueba: un setItem con clave vieja sale rojo, directo o por constante", () => {
    expect(hallazgosLegado(`localStorage.setItem("ordenex:sonido", "on");`, "lib/navegador/claves-legadas.ts")).toHaveLength(1);
    const porConstante = [`const CLAVE = "ordenex:sonido";`, `almacen.setItem(CLAVE, "on");`].join("\n");
    expect(hallazgosLegado(porConstante, "lib/navegador/claves-legadas.ts").map((h) => h.linea)).toEqual([2]);
    expect(hallazgosLegado("document.cookie = `ordenex_tema=oscuro`;", "lib/navegador/claves-legadas.ts")).toHaveLength(1);
  });

  it("contraprueba: fuera del modulo, la clave vieja no existe; en un comentario no cuenta", () => {
    expect(hallazgosLegado(`const k = "ordenex:sonido";`, "lib/audio/x.ts")).toHaveLength(1);
    expect(hallazgosLegado(`// "ordenex:sonido" era la clave`, "lib/audio/x.ts")).toEqual([]);
  });

  it("sano: el modulo la lee y la borra, y escribe solo la nueva", () => {
    const fuente = [
      `const VIEJA = "ordenex:sonido";`,
      `const NUEVA = "app:sonido";`,
      `const crudo = almacen.getItem(VIEJA);`,
      `almacen.setItem(NUEVA, crudo);`,
      `almacen.removeItem(VIEJA);`,
    ].join("\n");
    expect(hallazgosLegado(fuente, "lib/navegador/claves-legadas.ts")).toEqual([]);
  });

  it.todo("T2.5: ningun archivo de app/, components/, hooks/, lib/ ni public/ tiene hallazgos de legado");
});

describe("494 — migraciones (R11, R30)", () => {
  it("contraprueba: tocar evidencia congelada o `usuario.email` sale rojo", () => {
    expect(hallazgosMigracion(`UPDATE "historial_accion" SET x = 1;`, "m.sql")).toHaveLength(1);
    expect(hallazgosMigracion(`delete from public.chat_mensaje where true;`, "m.sql")).toHaveLength(1);
    expect(hallazgosMigracion(`UPDATE wallet_movimiento SET descripcion = 'a';`, "m.sql")).toHaveLength(1);
    expect(hallazgosMigracion(`UPDATE "usuario"\n  SET "email" = 'x';`, "m.sql")).toHaveLength(1);
  });

  it("sano: otra tabla, otra columna de usuario, o un comentario", () => {
    expect(hallazgosMigracion(`UPDATE "vista_filtro" SET filtro = '{}';`, "m.sql")).toEqual([]);
    expect(hallazgosMigracion(`UPDATE usuario SET nombre = 'x';`, "m.sql")).toEqual([]);
    expect(hallazgosMigracion(`-- UPDATE chat_mensaje SET x = 1;`, "m.sql")).toEqual([]);
  });

  it("ninguna migracion de la ficha lo hace", () => {
    expect(lista(censoMigraciones494())).toEqual([]);
  });
});

describe("494 — plantillas de WhatsApp (R24, R26)", () => {
  it("contraprueba: el nombre como literal sale rojo", () => {
    expect(hallazgosPlantillaLiteral(`const n = "alerta_transito";`, "lib/x.ts")).toHaveLength(1);
    expect(hallazgosPlantillaLiteral(`const n = "picking_bodega_ordenex";`, "lib/x.ts")).toHaveLength(1);
    expect(hallazgosPlantillaLiteral(`const n = "listo_para_entrega_mensajero";`, "lib/x.ts")).toEqual([]);
    expect(hallazgosPlantillaConMarca(`nombre: "alerta_transito_ordenex",`, "t.test.ts")).toHaveLength(1);
    expect(hallazgosPlantillaConMarca(`nombre: "alerta_transito",`, "t.test.ts")).toEqual([]);
  });

  it("R24: lib/ y app/ no nombran las plantillas de Meta", () => {
    expect(lista(censoPlantillasLiteral())).toEqual([]);
  });

  it("R26: ningun test nombra una plantilla con la marca", () => {
    expect(lista(censoPlantillasConMarca())).toEqual([]);
  });
});

describe("494 — hosts (R28)", () => {
  it("no-vacuidad: se leen los archivos de configuracion que existen", () => {
    expect(archivosDeHosts()).toEqual(expect.arrayContaining(["middleware.ts", "next.config.ts", "vercel.json"]));
  });

  it("ninguno contiene la marca", () => {
    const hallazgos = archivosDeHosts().flatMap((f) => hallazgosEnTexto(leerTexto(f) ?? "", f));
    expect(lista(hallazgos)).toEqual([]);
  });
});

describe("494 — proyecto (R31, R32)", () => {
  const sano = { nombrePaquete: "velox", hayColeccionVieja: false, hayColeccionNueva: true };

  it("contraprueba R31: nombre viejo, coleccion vieja o sin coleccion nueva salen rojos", () => {
    expect(hallazgosProyecto(sano)).toEqual([]);
    expect(hallazgosProyecto({ ...sano, nombrePaquete: "ordenex" })).toHaveLength(1);
    expect(hallazgosProyecto({ ...sano, hayColeccionVieja: true })).toHaveLength(1);
    expect(hallazgosProyecto({ ...sano, hayColeccionNueva: false })).toHaveLength(1);
  });

  it("contraprueba R32: la fila con la marca, sin lo vigente, o ausente sale roja", () => {
    const bien = "| B2 | proyecto `velox` |\n| B4 | alias `velox-courier.company` |";
    expect(hallazgosReleaseB2B4(bien)).toEqual([]);
    expect(hallazgosReleaseB2B4("| B2 | proyecto `velox` y `ordenex` |\n| B4 | alias `velox-courier.company` |")).toEqual(["B2: nombra la marca retirada"]);
    expect(hallazgosReleaseB2B4("| B2 | proyecto `velox` |\n| B4 | alias `otro` |")).toEqual(["B4: no nombra velox-courier.company"]);
    expect(hallazgosReleaseB2B4("| B2 | proyecto `velox` |")).toEqual(["B4: la fila no existe"]);
  });

  it("las rutas de la coleccion son las de design §9", () => {
    // La vieja sigue existiendo hasta T7.3, y la nueva aun no: lo ata el `todo` de abajo.
    expect(existsSync(path.join(RAIZ, COLECCION_VIEJA))).toBe(true);
    expect(COLECCION_NUEVA).toBe("docs/api/api-key.postman_collection.json");
  });

  it.todo("T7.3 y T7.6: R31 contra `package.json` y `docs/api/`");
  it.todo("T7.4: R32 contra `docs/release.md`");
});
