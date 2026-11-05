import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PENDIENTES_494 } from "@/tests/fixtures/marca-pendientes-494";
import {
  COLECCION_NUEVA,
  COLECCION_VIEJA,
  ESCRITURA_LEGADO_ADMITIDA,
  EXCEPCIONES,
  MODULO_LEGADO,
  RAIZ,
  archivosDeHosts,
  archivosDelArbol,
  archivosLegado,
  censoArbol,
  censoLegado,
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

  it("la lista es la cerrada de design §7, mas el andamiaje E9; E5 se parte en archivo y linea", () => {
    expect(EXCEPCIONES.map((e) => e.id)).toEqual(["E1", "E2", "E3", "E4", "E5", "E5.1", "E6", "E7", "E8", "E9"]);
  });

  it("E5.1 cubre los alias y solo los alias: en `public/sw.js` lo demas sigue contando", () => {
    expect(estaExceptuado("public/sw.js", `const A = "ordenex:relevo-ahora";`)).toBe(true);
    expect(estaExceptuado("public/sw.js", `// ordenex en un comentario`)).toBe(false);
    expect(estaExceptuado("public/sw.js", `tag: "ordenex:" + carga.evento,`)).toBe(false);
    expect(estaExceptuado("public/sw.js", null)).toBe(false);
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

  it("contraprueba: escribir con lo que exporta el modulo sale rojo, aunque no haya literal", () => {
    for (const fuente of [
      `window.sessionStorage.setItem(claveViejaDe(claveDeSesion(zonaId))!, "1");`,
      `almacen.setItem(MENSAJE_RELEVO_AHORA_LEGADO, "x");`,
      "document.cookie = `${COOKIE_TEMA_VIEJA}=oscuro; path=/`;",
      `(await cookies()).set(COOKIE_TEMA_VIEJA, "oscuro");`,
      `esperando.postMessage({ tipo: MENSAJE_RELEVO_AHORA_LEGADO });`,
    ]) {
      expect(hallazgosLegado(fuente, "lib/audio/x.ts"), fuente).toHaveLength(1);
      expect(hallazgosLegado(fuente, MODULO_LEGADO), fuente).toHaveLength(1);
    }
  });

  it("contraprueba: tampoco por una constante, en varias lineas, ni concatenando el prefijo", () => {
    const porConstante = [`const k = claveViejaDe(CLAVE);`, `almacen.setItem(k!, "on");`].join("\n");
    expect(hallazgosLegado(porConstante, "lib/audio/x.ts").map((h) => h.linea)).toEqual([2]);
    const enVariasLineas = [`almacen.setItem(`, `  claveViejaDe(CLAVE)!,`, `  "on",`, `);`].join("\n");
    expect(hallazgosLegado(enVariasLineas, "lib/audio/x.ts").map((h) => h.linea)).toEqual([1]);
    const conLiteral = [`almacen.setItem(`, `  "ordenex:sonido",`, `  "on",`, `);`].join("\n");
    expect(hallazgosLegado(conLiteral, MODULO_LEGADO).map((h) => h.linea)).toEqual([1]);
    expect(hallazgosLegado(`almacen.setItem("ordenex:" + k, v);`, MODULO_LEGADO)).toHaveLength(1);
    expect(hallazgosLegado(`almacen.setItem("ordenex:" + k, v);`, "lib/audio/x.ts")).toHaveLength(1);
    const cookieEnDosLineas = ["document.cookie =", "  `${COOKIE_TEMA_VIEJA}=oscuro`;"].join("\n");
    expect(hallazgosLegado(cookieEnDosLineas, "lib/audio/x.ts").map((h) => h.linea)).toEqual([1]);
  });

  it("sano: leer con esos simbolos no es escribir, y escribir en la clave nueva tampoco", () => {
    const fuente = [
      `const tema = normalizarTema(almacenCookies.get(COOKIE_TEMA_VIEJA)?.value);`,
      `const vale = tipo === MENSAJE_PUSH_RECIBIDO_LEGADO;`,
      `const vieja = claveViejaDe(nueva);`,
      `almacen.setItem(nueva, valor);`,
      `almacen.removeItem(vieja);`,
      `esperando.postMessage({ tipo: MENSAJE_RELEVO_AHORA });`,
    ].join("\n");
    expect(hallazgosLegado(fuente, "lib/audio/x.ts")).toEqual([]);
  });

  it("la caducidad de la cookie se admite por linea exacta, y solo en su archivo", () => {
    const { archivo, linea } = ESCRITURA_LEGADO_ADMITIDA;
    // Si esa linea deja de existir, la excepcion esta muerta: rojo, como pide R3 para las demas.
    expect(leerTexto(archivo)?.split("\n").map((l) => l.trim())).toContain(linea);
    expect(hallazgosLegado(linea, archivo)).toEqual([]);
    expect(hallazgosLegado(linea, "lib/audio/x.ts")).toHaveLength(1);
    // En el mismo archivo, cualquier otra escritura con el nombre viejo sale roja.
    expect(hallazgosLegado("document.cookie = `${COOKIE_TEMA_VIEJA}=oscuro; path=/`;", archivo)).toHaveLength(1);
  });

  it("no-vacuidad: el recorrido ve el modulo, el service worker y quien migra la cookie", () => {
    expect(archivosLegado()).toEqual(
      expect.arrayContaining([MODULO_LEGADO, "public/sw.js", "lib/tema/preferencia-tema.ts", "providers/TemaProvider.tsx"]),
    );
    // El modulo y el SW siguen conteniendo lo viejo: si no, esta guardia no estaria mirando nada.
    expect(leerTexto(MODULO_LEGADO)).toContain("ordenex_tema");
    expect(leerTexto("public/sw.js")).toContain("ordenex:relevo-ahora");
  });

  it("T2.5: ningun archivo de app/, components/, hooks/, lib/, providers/ ni public/ tiene hallazgos de legado", () => {
    expect(lista(censoLegado())).toEqual([]);
  });
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
    expect(COLECCION_VIEJA).toBe("docs/api/ordenex-api-key.postman_collection.json");
    expect(COLECCION_NUEVA).toBe("docs/api/api-key.postman_collection.json");
  });

  it("R31: la coleccion publicada existe con su nombre nuevo, y la vieja no", () => {
    expect(existsSync(path.join(RAIZ, COLECCION_VIEJA))).toBe(false);
    expect(existsSync(path.join(RAIZ, COLECCION_NUEVA))).toBe(true);
  });

  it("R31: la coleccion se titula sin la marca retirada", () => {
    const coleccion = JSON.parse(leerTexto(COLECCION_NUEVA) ?? "") as { info: { name: string } };
    expect(coleccion.info.name).toBe("Velox Courier — API key");
  });

  it("R31: package.json se llama velox, contra el archivo y contra el detector", () => {
    const paquete = JSON.parse(leerTexto("package.json") ?? "") as { name: string };
    expect(paquete.name).toBe("velox");
    expect(
      hallazgosProyecto({
        nombrePaquete: paquete.name,
        hayColeccionVieja: existsSync(path.join(RAIZ, COLECCION_VIEJA)),
        hayColeccionNueva: existsSync(path.join(RAIZ, COLECCION_NUEVA)),
      }),
    ).toEqual([]);
  });

  it("R32: B2 y B4 de docs/release.md nombran el proyecto y el dominio vigentes", () => {
    expect(hallazgosReleaseB2B4(leerTexto("docs/release.md") ?? "")).toEqual([]);
  });

  it("T7.4: docs/release.md trae el paso del cruce entre versiones de design §3.2", () => {
    const md = leerTexto("docs/release.md") ?? "";
    const tramo = md.slice(md.indexOf("### 494 "), md.indexOf("### 473 y 474"));
    for (const exigido of ["Skew Protection", "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY", "se despliega fuera de la operación"]) {
      expect(tramo, exigido).toContain(exigido);
    }
  });
});
