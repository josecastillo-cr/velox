// FEATURE 494 (T1.1, design §7) — EL DETECTOR DE LA GUARDIA «SIN ORDENEX».
//
// Vive aparte de la guardia (`tests/unit/guards/marca-sin-ordenex-494.guardia.test.ts`) para que el
// censo (`progress/censo_marca_494.md`) salga del MISMO codigo que juzga. A diferencia de la 493 no
// usa AST: ya no hay identificadores admitidos, asi que basta con buscar texto plano en contenido y
// en rutas.
//
// Lee el arbol con `fs`: el grafo no la relaciona con los diffs y `--rapido` puede no correrla.
//
// Regenerar el censo:
//   pnpm exec tsx tests/fixtures/marca-sin-ordenex-494.ts censo
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

export const RAIZ = path.resolve(__dirname, "../..");

export interface Hallazgo {
  archivo: string;
  /** 0 = la marca esta en el nombre del archivo o de su carpeta. */
  linea: number;
  fragmento: string;
}

export const formatear = (h: Hallazgo) => `${h.archivo}:${h.linea} — ${h.fragmento}`;

// ---------------------------------------------------------------------------------------------
// El detector
// ---------------------------------------------------------------------------------------------

const MARCA = /ordenex/gi;

// `OrdenExistente`, `ordenExigido`, `ordenExacta` son «orden» + «ex…», no la marca: `/ordenex/i` los
// ve (18 apariciones medidas en T1.3). El glosario de `requirements.md` dice «la cadena, sin distinguir
// mayusculas»; se aparta de la letra a proposito, porque renombrarlos seria tocar codigo ajeno a la
// ficha y la marca nunca se escribe con esa E mayuscula seguida de minuscula.
const NO_ES_LA_MARCA = /^[Oo]rdenEx[a-z]/;

function posiciones(texto: string): number[] {
  const acc: number[] = [];
  for (const m of texto.matchAll(MARCA)) {
    if (!NO_ES_LA_MARCA.test(texto.slice(m.index, m.index + 8))) acc.push(m.index);
  }
  return acc;
}

/** Una entrada por APARICION: el trinquete cuenta apariciones, no lineas. */
export function hallazgosEnTexto(contenido: string, archivo: string): Hallazgo[] {
  const acc: Hallazgo[] = [];
  contenido
    .replace(/\r\n/g, "\n")
    .split("\n")
    .forEach((linea, i) => {
      posiciones(linea).forEach(() => acc.push({ archivo, linea: i + 1, fragmento: linea.trim().slice(0, 120) }));
    });
  return acc;
}

/** La marca en el nombre del archivo o en cualquiera de sus carpetas. */
export function hallazgosEnRuta(rel: string): Hallazgo[] {
  return posiciones(rel).map(() => ({ archivo: rel, linea: 0, fragmento: "(nombre del archivo o de su carpeta)" }));
}

// ---------------------------------------------------------------------------------------------
// El arbol vigilado (glosario de `requirements.md`)
// ---------------------------------------------------------------------------------------------

export const ARBOL_DIRS = [
  "app",
  "components",
  "hooks",
  "lib",
  "public",
  "scripts",
  "tests",
  "e2e",
  "docs/ayuda",
  "docs/api",
  ".claude/commands",
  // Revision final (m5): corre en el navegador o describe el repo, y el glosario no los nombraba.
  "providers",
] as const;
export const ARBOL_ARCHIVOS = ["db/schema.prisma", "package.json", ".env.example", "DESIGN.md", "instrumentation.ts", "AGENTS.md", "README.md"] as const;
const DENTRO_DE_ARBOL_PERO_FUERA = new Set(["docs/api/CHANGELOG.md"]);

function recorrer(dir: string): string[] {
  const abs = path.join(RAIZ, dir);
  if (!existsSync(abs)) return [];
  const acc: string[] = [];
  const rec = (d: string) => {
    for (const e of readdirSync(d)) {
      if (e === "node_modules") continue;
      const c = path.join(d, e);
      if (statSync(c).isDirectory()) rec(c);
      else acc.push(path.relative(RAIZ, c).split(path.sep).join("/"));
    }
  };
  rec(abs);
  return acc;
}

export function archivosDelArbol(): string[] {
  return [...ARBOL_DIRS.flatMap(recorrer), ...ARBOL_ARCHIVOS.filter((f) => existsSync(path.join(RAIZ, f)))]
    .filter((f) => !DENTRO_DE_ARBOL_PERO_FUERA.has(f))
    .sort();
}

/** Contenido con CRLF normalizado; `null` si es binario (de esos solo cuenta el nombre). */
export function leerTexto(rel: string): string | null {
  const b = readFileSync(path.join(RAIZ, rel));
  if (b.includes(0)) return null;
  return b.toString("utf8").replace(/\r\n/g, "\n");
}

// ---------------------------------------------------------------------------------------------
// Excepciones (lista cerrada, design §7)
// ---------------------------------------------------------------------------------------------

export interface Excepcion {
  id: string;
  motivo: string;
  /** Archivo exacto, o carpeta si acaba en `/`. */
  rutas: readonly string[];
  /** Si existe, solo se exceptuan las lineas que lo cumplen. */
  linea?: RegExp;
}

export const EXCEPCIONES: readonly Excepcion[] = [
  {
    id: "E1",
    motivo: "Fuera del arbol. Fotos historicas: editarlas es drift.",
    rutas: ["db/migrations/"],
  },
  {
    id: "E2",
    motivo: "Fuera del arbol. Registros historicos.",
    rutas: ["specs/", "progress/", "feature_list.json", "docs/api/CHANGELOG.md", "docs/release.md", "docs/marca/velox/README.md"],
  },
  {
    id: "E3",
    motivo: "Fuera del arbol. Nombre del proyecto en el MCP, derivado de la carpeta local.",
    rutas: ["CLAUDE.md", ".claude/agents/"],
    linea: /R-job-singularis-projects-ordenex|R-ark-studio-projects-ricardo-ordenex|no `ordenex`/,
  },
  {
    id: "E4",
    motivo: "Nombre real de la base local: esos scripts abortan si no coincide, y es lo que evita que escriban en prod.",
    rutas: ["scripts/drenar-jobs.ts", "scripts/rollup-analitica-manual.ts", "scripts/contraste-454.ts", "tests/unit/services/analitica-rollup-handler.test.ts"],
    linea: /:\d+\/ordenex|ordenex_|BASE_LOCAL|=== "ordenex"/,
  },
  {
    id: "E5",
    motivo: "La clave vieja del navegador hay que poder leerla. Se retira con design §5.6.",
    rutas: ["tests/unit/navegador/", "tests/unit/tema/cookie-legada-494.test.ts"],
  },
  {
    // Por linea (m4): el modulo solo puede nombrarla como clave entre comillas. Un texto visible con la marca sale rojo.
    id: "E5.2",
    motivo: "El modulo unico de las claves viejas del navegador (R20). Se retira con design §5.6.",
    rutas: ["lib/navegador/claves-legadas.ts"],
    linea: /"ordenex(?::[a-z-]+:?|_tema)?"/,
  },
  {
    // Por linea y no por archivo, para que estos archivos sigan contando: ni `public/sw.js` ni sus tests
    // pueden tener la marca en ningun otro sitio.
    id: "E5.1",
    motivo: "Alias de relevo del service worker (R21, R22) y los tests que los afirman. Se retiran con design §5.6.",
    rutas: ["public/sw.js", "tests/unit/guards/pwa-relevo-y-purga.guardia.test.ts", "tests/unit/hooks/usePushEnVentana.test.tsx"],
    linea: /"ordenex:(relevo-ahora|relevo-ahora-no|pagina-lista|push-recibido|cualquier-otra-cosa)"/,
  },
  {
    id: "E6",
    motivo: "Hace falta para pasar la cuenta QA al correo nuevo (R29).",
    rutas: ["scripts/seed-usuarios-qa.ts", "tests/integration/db/seed-usuarios-qa-494.test.ts"],
    // Los 4 correos de la siembra, y la cuenta ajena con la que el test comprueba que el pase va por correo exacto (R30).
    linea: /\b(?:admin|mensajero|tienda|satelite)\.qa@ordenex\.test\b|\botra\.persona@ordenex\.test\b/,
  },
  {
    id: "E7",
    motivo: "Definen lo prohibido y sus contrapruebas.",
    rutas: [
      "tests/unit/guards/marca-sin-ordenex-494.guardia.test.ts",
      "tests/fixtures/marca-sin-ordenex-494.ts",
      "tests/fixtures/marca-retirada-nombre-493.ts",
      "tests/fixtures/marca-retirada-493.ts",
      "tests/unit/guards/marca-fuente-unica-493.guardia.test.ts",
    ],
  },
  {
    id: "E8",
    motivo: "Negativas: afirman que lo viejo no esta.",
    rutas: ["tests/unit/analytics/cache-clave-conteo-productos-494.test.ts", "tests/unit/api/contrato-sin-cambios-494.test.ts"],
  },
];

const cubre = (ruta: string, rel: string) => (ruta.endsWith("/") ? rel.startsWith(ruta) : rel === ruta);

/** `textoLinea` es `null` para un hallazgo en el nombre: una excepcion por linea no lo cubre. */
export function estaExceptuado(rel: string, textoLinea: string | null, lista: readonly Excepcion[] = EXCEPCIONES): boolean {
  return lista.some(
    (e) =>
      e.rutas.some((r) => cubre(r, rel)) &&
      (e.linea === undefined || (textoLinea !== null && e.linea.test(textoLinea))),
  );
}

function archivosDeRuta(ruta: string): string[] {
  if (!existsSync(path.join(RAIZ, ruta))) return [];
  return ruta.endsWith("/") ? recorrer(ruta.slice(0, -1)) : [ruta];
}

function rutaTieneAparicion(ruta: string, linea: RegExp | undefined): boolean {
  return archivosDeRuta(ruta).some((f) => {
    if (linea === undefined && hallazgosEnRuta(f).length > 0) return true;
    const texto = leerTexto(f);
    if (texto === null) return false;
    return hallazgosEnTexto(texto, f).some((h) => {
      if (linea === undefined) return true;
      return linea.test(texto.split("\n")[h.linea - 1] ?? "");
    });
  });
}

/** R3: lo que ya no coincide con nada real, o no declara motivo. */
export function excepcionesMuertas(lista: readonly Excepcion[] = EXCEPCIONES): string[] {
  const acc: string[] = [];
  for (const e of lista) {
    if (e.motivo.trim() === "") acc.push(`${e.id}: sin motivo`);
    for (const r of e.rutas) {
      if (!rutaTieneAparicion(r, e.linea)) acc.push(`${e.id}: ${r} ya no coincide con ninguna aparicion`);
    }
  }
  return acc;
}

// ---------------------------------------------------------------------------------------------
// El censo del arbol
// ---------------------------------------------------------------------------------------------

export function hallazgosDeArchivo(rel: string): Hallazgo[] {
  const acc = estaExceptuado(rel, null) ? [] : hallazgosEnRuta(rel);
  const texto = leerTexto(rel);
  if (texto === null) return acc;
  const lineas = texto.split("\n");
  return acc.concat(hallazgosEnTexto(texto, rel).filter((h) => !estaExceptuado(rel, lineas[h.linea - 1] ?? "")));
}

export function censoArbol(): Hallazgo[] {
  return archivosDelArbol().flatMap(hallazgosDeArchivo);
}

// ---------------------------------------------------------------------------------------------
// Bloque legado (R20)
// ---------------------------------------------------------------------------------------------

export const MODULO_LEGADO = "lib/navegador/claves-legadas.ts";
const CLAVE_VIEJA = /["'`]ordenex(?::|_tema)/;
const ES_COMENTARIO = /^\s*(\/\/|\/\*|\*)/;

/** Lo que el modulo exporta y da el nombre viejo sin escribirlo: un literal no los delataria. */
const SIMBOLO_VIEJO = /\b(?:COOKIE_TEMA_VIEJA|claveViejaDe|MENSAJE_\w+_LEGADO)\b/;

/** Escrituras: almacen, cookie (de navegador o de `next/headers`) y mensaje al service worker. */
const ESCRITURA = /setItem\s*\(|document\.cookie\s*=|\.set\s*\(|postMessage\s*\(/;

/**
 * La UNICA escritura admitida con un simbolo viejo, y por linea exacta: caducar la cookie al trasladarla
 * (R17). Si esa linea cambia, la guardia lo dice en vez de abrirse.
 */
export const ESCRITURA_LEGADO_ADMITIDA = {
  archivo: "lib/tema/preferencia-tema.ts",
  linea: "document.cookie = `${COOKIE_TEMA_VIEJA}=; path=/; max-age=0; SameSite=Lax`;",
} as const;

/** Desde la escritura hasta que se cierra: una llamada puede llevar la clave en la linea siguiente. */
function tramoDeEscritura(lineas: readonly string[], i: number): string {
  const inicio = lineas[i].search(ESCRITURA);
  let tramo = lineas[i].slice(inicio);
  for (let j = i + 1; j < Math.min(i + 8, lineas.length); j++) {
    const abiertos = (tramo.match(/\(/g) ?? []).length - (tramo.match(/\)/g) ?? []).length;
    if (abiertos <= 0 && tramo.includes(";")) break;
    if (abiertos <= 0 && !/=\s*$/.test(tramo)) break;
    tramo += ` ${lineas[j].trim()}`;
  }
  return tramo;
}

/**
 * Dos reglas: fuera del modulo unico (y de los alias de `public/sw.js`) la clave vieja no existe; y
 * en NINGUN sitio, tampoco en el modulo, se escribe con ella: ni directa, ni a traves de una constante
 * del mismo archivo, ni con lo que exporta el modulo (`SIMBOLO_VIEJO`, leerlo si se puede).
 */
export function hallazgosLegado(fuente: string, archivo: string): Hallazgo[] {
  const lineas = fuente.replace(/\r\n/g, "\n").split("\n");
  const constantes = new Set<string>();
  for (const l of lineas) {
    const m = l.match(/\b(?:const|let|var)\s+(\w+)\s*(?::[^=]+)?=\s*(.*)$/);
    if (m && (CLAVE_VIEJA.test(m[2]) || SIMBOLO_VIEJO.test(m[2]))) constantes.add(m[1]);
  }
  const admitida = archivo === MODULO_LEGADO || archivo === "public/sw.js";
  const acc: Hallazgo[] = [];
  lineas.forEach((l, i) => {
    if (ES_COMENTARIO.test(l)) return;
    let escribe = false;
    if (ESCRITURA.test(l)) {
      const tramo = tramoDeEscritura(lineas, i);
      const esLaAdmitida = archivo === ESCRITURA_LEGADO_ADMITIDA.archivo && l.trim() === ESCRITURA_LEGADO_ADMITIDA.linea;
      escribe =
        !esLaAdmitida &&
        (CLAVE_VIEJA.test(tramo) || SIMBOLO_VIEJO.test(tramo) || [...constantes].some((c) => new RegExp(`\\b${c}\\b`).test(tramo)));
    }
    if (escribe || (!admitida && CLAVE_VIEJA.test(l))) {
      acc.push({ archivo, linea: i + 1, fragmento: l.trim().slice(0, 120) });
    }
  });
  return acc;
}

/** `providers/` no esta en el arbol del glosario, pero tambien corre en el navegador. */
const DIRS_LEGADO = ["app", "components", "hooks", "lib", "providers", "public"] as const;

export function archivosLegado(): string[] {
  return DIRS_LEGADO.flatMap(recorrer);
}

export function censoLegado(): Hallazgo[] {
  return archivosLegado().flatMap((f) => {
    const t = leerTexto(f);
    return t === null ? [] : hallazgosLegado(t, f);
  });
}

// ---------------------------------------------------------------------------------------------
// Bloque migraciones (R11, R30)
// ---------------------------------------------------------------------------------------------

export const TABLAS_CONGELADAS = [
  "historial_accion",
  "whatsapp_envio_ejecucion",
  "chat_mensaje",
  "wallet_movimiento",
  "wallet_tienda_movimiento",
  "pago_mensajero_movimiento",
  "wallet_anotacion",
] as const;

export function hallazgosMigracion(sql: string, archivo: string): Hallazgo[] {
  const limpio = sql.replace(/\r\n/g, "\n").replace(/--[^\n]*/g, "");
  const tablas = TABLAS_CONGELADAS.join("|");
  const reglas = [
    new RegExp(`\\b(?:UPDATE|DELETE\\s+FROM|TRUNCATE(?:\\s+TABLE)?)\\s+(?:ONLY\\s+)?(?:"?public"?\\.)?"?(?:${tablas})\\b`, "gi"),
    /\bUPDATE\s+(?:ONLY\s+)?(?:"?public"?\.)?"?usuario\b[^;]*\bSET\b[^;]*\bemail\b/gi,
  ];
  return reglas.flatMap((re) =>
    [...limpio.matchAll(re)].map((m) => ({
      archivo,
      linea: limpio.slice(0, m.index).split("\n").length,
      fragmento: m[0].replace(/\s+/g, " ").slice(0, 120),
    })),
  );
}

export function censoMigraciones494(): Hallazgo[] {
  const dir = path.join(RAIZ, "db/migrations");
  return readdirSync(dir)
    .filter((n) => /_494/.test(n))
    .flatMap((n) => {
      const rel = `db/migrations/${n}/migration.sql`;
      return existsSync(path.join(RAIZ, rel)) ? hallazgosMigracion(readFileSync(path.join(RAIZ, rel), "utf8"), rel) : [];
    });
}

// ---------------------------------------------------------------------------------------------
// Bloque plantillas (R24, R26)
// ---------------------------------------------------------------------------------------------

const PLANTILLA_LITERAL = /\b(?:alerta_transito|picking_bodega)(?:_ordenex)?\b/;
const PLANTILLA_CON_MARCA = /\b(?:alerta_transito|picking_bodega|prueba_envios)_ordenex\b|\bordenex_en_camino\b/;

const porLinea = (fuente: string, archivo: string, re: RegExp): Hallazgo[] => {
  const acc: Hallazgo[] = [];
  fuente
    .replace(/\r\n/g, "\n")
    .split("\n")
    .forEach((l, i) => {
      if (re.test(l)) acc.push({ archivo, linea: i + 1, fragmento: l.trim().slice(0, 120) });
    });
  return acc;
};

/** R24: el nombre que se manda a Meta sale de `plantilla_mensaje.nombre`, nunca de un literal. */
export const hallazgosPlantillaLiteral = (fuente: string, archivo: string) => porLinea(fuente, archivo, PLANTILLA_LITERAL);
/** R26: ningun test depende del renombrado en Meta. */
export const hallazgosPlantillaConMarca = (fuente: string, archivo: string) => porLinea(fuente, archivo, PLANTILLA_CON_MARCA);

function censoPor(dirs: readonly string[], detector: (fuente: string, archivo: string) => Hallazgo[]): Hallazgo[] {
  return dirs
    .flatMap(recorrer)
    .filter((f) => !estaExceptuado(f, null))
    .flatMap((f) => {
      const t = leerTexto(f);
      return t === null ? [] : detector(t, f);
    });
}

export const censoPlantillasLiteral = () => censoPor(["lib", "app"], hallazgosPlantillaLiteral);
export const censoPlantillasConMarca = () => censoPor(["tests", "e2e"], hallazgosPlantillaConMarca);

// ---------------------------------------------------------------------------------------------
// Bloque hosts (R28)
// ---------------------------------------------------------------------------------------------

/** Los que existan de `next.config.*`, `vercel.json`, `proxy.ts`, `middleware.ts`. */
export function archivosDeHosts(): string[] {
  return readdirSync(RAIZ).filter((n) => /^next\.config\.|^vercel\.json$|^proxy\.ts$|^middleware\.ts$/.test(n));
}

// ---------------------------------------------------------------------------------------------
// Bloque proyecto (R31, R32)
// ---------------------------------------------------------------------------------------------

export const COLECCION_VIEJA = "docs/api/ordenex-api-key.postman_collection.json";
export const COLECCION_NUEVA = "docs/api/api-key.postman_collection.json";

export function hallazgosProyecto(p: { nombrePaquete: string; hayColeccionVieja: boolean; hayColeccionNueva: boolean }): string[] {
  const acc: string[] = [];
  if (p.nombrePaquete !== "velox") acc.push(`package.json: name es «${p.nombrePaquete}»`);
  if (p.hayColeccionVieja) acc.push(`sigue existiendo ${COLECCION_VIEJA}`);
  if (!p.hayColeccionNueva) acc.push(`no existe ${COLECCION_NUEVA}`);
  return acc;
}

/** R32: B2 nombra el proyecto vigente y B4 el dominio vigente; ninguna de las dos, la marca. */
export function hallazgosReleaseB2B4(md: string): string[] {
  const fila = (id: string) => md.replace(/\r\n/g, "\n").split("\n").find((l) => l.startsWith(`| ${id} |`));
  const acc: string[] = [];
  for (const [id, exige] of [
    ["B2", "velox"],
    ["B4", "velox-courier.company"],
  ] as const) {
    const l = fila(id);
    if (l === undefined) acc.push(`${id}: la fila no existe`);
    else {
      if (!l.includes(exige)) acc.push(`${id}: no nombra ${exige}`);
      if (posiciones(l).length > 0) acc.push(`${id}: nombra la marca retirada`);
    }
  }
  return acc;
}

// ---------------------------------------------------------------------------------------------
// Emision del censo (mismo codigo que juzga). El repo es publico: se cuenta, sin escribir valores.
// ---------------------------------------------------------------------------------------------

const RUTA_CENSO = "progress/censo_marca_494.md";

export function censoPorExcepcion(lista: readonly Excepcion[] = EXCEPCIONES): { id: string; motivo: string; archivos: number; apariciones: number }[] {
  // Solo lo versionado: `progress/` guarda logs locales ignorados que no son el repo.
  const versionados = new Set(execFileSync("git", ["ls-files", "-z"], { cwd: RAIZ, maxBuffer: 1e9 }).toString("utf8").split("\0"));
  return lista.map((e) => {
    const archivos = new Set<string>();
    let apariciones = 0;
    for (const f of [...new Set(e.rutas.flatMap(archivosDeRuta))].filter((r) => versionados.has(r))) {
      const texto = leerTexto(f);
      const enNombre = e.linea === undefined ? hallazgosEnRuta(f).length : 0;
      const lineas = texto?.split("\n") ?? [];
      const enTexto = texto === null ? 0 : hallazgosEnTexto(texto, f).filter((h) => e.linea === undefined || e.linea.test(lineas[h.linea - 1] ?? "")).length;
      if (enNombre + enTexto > 0) archivos.add(f);
      apariciones += enNombre + enTexto;
    }
    return { id: e.id, motivo: e.motivo, archivos: archivos.size, apariciones };
  });
}

export function emitirCenso(hallazgos: readonly Hallazgo[], sha: string): string {
  return [
    "# 494 — Censo final de la marca retirada",
    "",
    `> Emitido por \`tests/fixtures/marca-sin-ordenex-494.ts\` (\`pnpm exec tsx … censo\`) sobre \`${sha}\`, con el mismo código que juzga la guardia. Sin valores: el repo es público.`,
    "> El censo de partida y los de cada tanda están en el historial de este archivo.",
    "",
    `**Fuera de excepciones: ${hallazgos.length} apariciones.**`,
    "",
    ...hallazgos.map((h) => `- ${formatear(h)}`),
    ...(hallazgos.length > 0 ? [""] : []),
    "## Lo que se queda, por excepción",
    "",
    "Se cuenta la cadena en lo versionado, sin distinguir mayúsculas. E2 sube sola: incluye este archivo y la bitácora.",
    "",
    "| Id | Motivo | Archivos | Apariciones |",
    "| --- | --- | --- | --- |",
    ...censoPorExcepcion().map((c) => `| ${c.id} | ${c.motivo} | ${c.archivos} | ${c.apariciones} |`),
    "",
    "Fuera del árbol por motivo propio (`design.md §7`): `.design-work/**` y `design-*/`, borradores que no se ejecutan.",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------------------------
// CLI: `pnpm exec tsx tests/fixtures/marca-sin-ordenex-494.ts censo`
// ---------------------------------------------------------------------------------------------

function principal(orden: string | undefined): void {
  if (orden !== "censo") throw new Error("Uso: tsx tests/fixtures/marca-sin-ordenex-494.ts censo");
  const hallazgos = censoArbol();
  const sha = execFileSync("git", ["rev-parse", "--short=8", "HEAD"], { cwd: RAIZ }).toString().trim();
  writeFileSync(path.join(RAIZ, RUTA_CENSO), emitirCenso(hallazgos, sha));
  console.log(`${RUTA_CENSO}: ${hallazgos.length} apariciones`);
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  principal(process.argv[2]);
}
