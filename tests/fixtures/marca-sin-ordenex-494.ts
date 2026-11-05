// FEATURE 494 (T1.1, design §7) — EL DETECTOR DE LA GUARDIA «SIN ORDENEX».
//
// Vive aparte de la guardia (`tests/unit/guards/marca-sin-ordenex-494.guardia.test.ts`) para que el
// censo (`progress/censo_marca_494.md`) y el trinquete (`tests/fixtures/marca-pendientes-494.ts`)
// salgan del MISMO codigo que juzga. A diferencia de la 493 no usa AST: ya no hay identificadores
// admitidos, asi que basta con buscar texto plano en contenido y en rutas.
//
// Lee el arbol con `fs`: el grafo no la relaciona con los diffs y `--rapido` puede no correrla.
//
// Regenerar, tras bajar apariciones en una tanda:
//   pnpm exec tsx tests/fixtures/marca-sin-ordenex-494.ts pendientes
//   pnpm exec tsx tests/fixtures/marca-sin-ordenex-494.ts censo
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

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
] as const;
export const ARBOL_ARCHIVOS = ["db/schema.prisma", "package.json", ".env.example", "DESIGN.md"] as const;
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
  /**
   * Tarea que la enciende. Hasta entonces NO exceptua nada (lo suyo sigue contando en el trinquete)
   * ni se le exige coincidencia: sus archivos aun no existen o aun no tienen la forma definitiva.
   */
  activaEn?: string;
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
    rutas: ["lib/navegador/claves-legadas.ts", "tests/unit/navegador/", "tests/unit/tema/cookie-legada-494.test.ts"],
  },
  {
    // Por linea y no por archivo, para que estos archivos sigan contando: `public/sw.js` no puede tener
    // la marca en ningun otro sitio, y los tests aun llevan datos de prueba que limpia T8.1.
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
  {
    id: "E9",
    motivo:
      "Andamiaje de la ficha: el trinquete lista rutas que contienen la marca y el script lleva la tabla viejo→nuevo. No se pueden contar a si mismos. T8.2 borra los dos archivos y esta entrada.",
    rutas: ["tests/fixtures/marca-pendientes-494.ts", "scripts/marca-494-renombrar.mjs"],
  },
];

const cubre = (ruta: string, rel: string) => (ruta.endsWith("/") ? rel.startsWith(ruta) : rel === ruta);

/** `textoLinea` es `null` para un hallazgo en el nombre: una excepcion por linea no lo cubre. */
export function estaExceptuado(rel: string, textoLinea: string | null, lista: readonly Excepcion[] = EXCEPCIONES): boolean {
  return lista.some(
    (e) =>
      e.activaEn === undefined &&
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

/** R3: lo que ya no coincide con nada real, o no declara motivo. Las aun no activas no cuentan. */
export function excepcionesMuertas(lista: readonly Excepcion[] = EXCEPCIONES): string[] {
  const acc: string[] = [];
  for (const e of lista) {
    if (e.motivo.trim() === "") acc.push(`${e.id}: sin motivo`);
    if (e.activaEn !== undefined) continue;
    for (const r of e.rutas) {
      if (!rutaTieneAparicion(r, e.linea)) acc.push(`${e.id}: ${r} ya no coincide con ninguna aparicion`);
    }
  }
  return acc;
}

// ---------------------------------------------------------------------------------------------
// El censo del arbol y el trinquete
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

export function recuentoPorArchivo(hallazgos: readonly Hallazgo[]): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const h of hallazgos) acc[h.archivo] = (acc[h.archivo] ?? 0) + 1;
  return acc;
}

/**
 * Como el de la 493: `nuevos` = archivo fuera de la lista o por encima de su numero; `desfasados` =
 * por debajo de su numero. Los dos ponen rojo: subir es una regresion, y bajar sin actualizar la
 * cifra dejaria hueco para volver a subir sin que nadie se entere.
 */
export function trinquete(
  recuento: Readonly<Record<string, number>>,
  pendientes: Readonly<Record<string, number>>,
): { nuevos: string[]; desfasados: string[] } {
  const nuevos: string[] = [];
  const desfasados: string[] = [];
  for (const [f, n] of Object.entries(recuento)) {
    const tope = pendientes[f];
    if (tope === undefined) nuevos.push(`${f}: ${n} (no esta en lo pendiente)`);
    else if (n > tope) nuevos.push(`${f}: ${n} (su tope es ${tope})`);
  }
  for (const [f, tope] of Object.entries(pendientes)) {
    const n = recuento[f] ?? 0;
    if (n < tope) desfasados.push(`${f}: ${n} (anotado ${tope})`);
  }
  return { nuevos: nuevos.sort(), desfasados: desfasados.sort() };
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
// Bloque proyecto (R31, R32). Activo desde T7.3/T7.4/T7.6; aqui solo el detector y su contraprueba.
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
// Emision: trinquete y censo (mismo codigo que juzga)
// ---------------------------------------------------------------------------------------------

const RUTA_PENDIENTES = "tests/fixtures/marca-pendientes-494.ts";
const RUTA_CENSO = "progress/censo_marca_494.md";
const RUTA_SCRIPT = "scripts/marca-494-renombrar.mjs";

export function emitirPendientes(hallazgos: readonly Hallazgo[]): string {
  const r = recuentoPorArchivo(hallazgos);
  const filas = Object.keys(r)
    .sort()
    .map((f) => `  ${JSON.stringify(f)}: ${r[f]},`);
  return [
    "// FEATURE 494 (T1.2, design §7) — LO QUE AUN FALTA, POR ARCHIVO Y CON SU NUMERO EXACTO (trinquete).",
    "//",
    "// GENERADO: no se edita a mano. `pnpm exec tsx tests/fixtures/marca-sin-ordenex-494.ts pendientes`.",
    "// Solo puede bajar con cada tanda. En un conflicto de merge se descarta y se regenera. T8.2 lo borra.",
    "",
    `/** ${hallazgos.length} apariciones en ${filas.length} archivos. */`,
    "export const PENDIENTES_494: Readonly<Record<string, number>> = {",
    ...filas,
    "};",
    "",
  ].join("\n");
}

const TIPOS: readonly { tipo: string; dondeSeResuelve: string; re: RegExp }[] = [
  {
    tipo: "Dominio, URL o correo (valor no se versiona: repo publico)",
    dondeSeResuelve: "Tanda 6 y 7 (§6, §3.5)",
    re: /@ordenex|ordenex\.(co|app|test|cr|vercel)\b/i,
  },
  {
    tipo: "Cabecera de firma vieja (negativa de contrato)",
    dondeSeResuelve: "Tanda 7 (§3.5, fixture de ids retirados)",
    re: /X-Ordenex-/i,
  },
  {
    tipo: "Clave de navegador y protocolo del service worker",
    dondeSeResuelve: "Tanda 1 (§5)",
    re: /ordenex:[\w$<-]|ordenex_tema/,
  },
  {
    tipo: "Nombre de la base local",
    dondeSeResuelve: "E4, T7.1",
    re: /:\d+\/ordenex|\/ordenex\b|ordenex_(prod|\d+|<|\[|\()|ordenex-f81/,
  },
  {
    tipo: "Ruta de modulo o de archivo",
    dondeSeResuelve: "Tanda 2 y T7.3 (§3.1, §9)",
    re: /[\w/]-ordenex|ordenex-[\w]/i,
  },
  {
    tipo: "Negativa con expresion regular o lista de marca",
    dondeSeResuelve: "Tanda 7 (§3.5)",
    re: /\/ordenex|ordenex\/[gi]/i,
  },
  {
    tipo: "Identificador compuesto (`netoOrdenex`, `NETO_ORDENEX_LABEL`, `solo_ordenex`)",
    dondeSeResuelve: "Tandas 2-4 (§3.1), y lo que no tape la tabla: abajo",
    re: /\w(Ordenex|ORDENEX|_ordenex)|(ordenex[A-Z_]|Ordenex[A-Z_]|ORDENEX_)/,
  },
  {
    tipo: "Palabra minuscula (clave, valor o variable: `.ordenex`, `\"ordenex\"`)",
    dondeSeResuelve: "Tandas 3-4 por lista de rutas (§3.1)",
    re: /\bordenex\b/,
  },
  {
    tipo: "Palabra suelta en mayuscula (`Ordenex`, `ORDENEX`: comentario o dato de prueba)",
    dondeSeResuelve: "Tanda 7 (§3.4)",
    re: /\b(Ordenex|ORDENEX)\b/,
  },
];

const SUPERFICIES = ["app", "components", "hooks", "lib", "public", "scripts", "e2e", "tests", "docs", ".claude", "db", "raiz"] as const;
const superficie = (f: string) => {
  const s = f.split("/")[0];
  return (SUPERFICIES as readonly string[]).includes(s) ? s : "raiz";
};

const tipoDeAparicion = (lineaCompleta: string, enRuta: boolean) =>
  enRuta ? { tipo: "Nombre de archivo o carpeta", dondeSeResuelve: "Tanda 2 y T7.3" } : (TIPOS.find((t) => t.re.test(lineaCompleta)) ?? { tipo: "Sin clasificar", dondeSeResuelve: "?" });

// Formas en las que `empresa` seria un identificador con el que el nuevo nombre chocaria.
const EMPRESA_DE_CODIGO = /\.empresa\b|^\s*empresa\??:|[{,]\s*empresa\??:|["'`]empresa["'`]|\b(?:const|let|var)\s+empresa\b/;
const LITERAL_DESTINO_NAVEGADOR = /["'`]app:[\w-]|\bapp_tema\b/;

interface Fila {
  viejo: string;
  nuevo: string;
}
interface Familia {
  palabras: readonly Fila[];
}

async function tablaDelScript(): Promise<Readonly<Record<string, Familia>>> {
  if (!existsSync(path.join(RAIZ, RUTA_SCRIPT))) return {};
  const m = (await import(pathToFileURL(path.join(RAIZ, RUTA_SCRIPT)).href)) as { FAMILIAS: Record<string, Familia> };
  return m.FAMILIAS;
}

const escaparRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function emitirCenso(hallazgos: readonly Hallazgo[], sha: string): Promise<string> {
  const familias = await tablaDelScript();
  const filas = Object.values(familias).flatMap((f) => f.palabras);
  const viejos = new Set(filas.map((f) => f.viejo));
  const nuevos = [...new Set(filas.map((f) => f.nuevo))].filter((n) => /^\w+$/.test(n));

  const cache = new Map<string, string[]>();
  const lineaDe = (h: Hallazgo) => {
    if (h.linea === 0) return "";
    if (!cache.has(h.archivo)) cache.set(h.archivo, (leerTexto(h.archivo) ?? "").split("\n"));
    return cache.get(h.archivo)?.[h.linea - 1] ?? "";
  };

  const porSuperficie = new Map<string, { archivos: Set<string>; n: number }>();
  const porTipo = new Map<string, { dondeSeResuelve: string; archivos: Set<string>; n: number }>();
  for (const h of hallazgos) {
    const s = porSuperficie.get(superficie(h.archivo)) ?? { archivos: new Set<string>(), n: 0 };
    s.n++;
    s.archivos.add(h.archivo);
    porSuperficie.set(superficie(h.archivo), s);
    const t = tipoDeAparicion(lineaDe(h), h.linea === 0);
    const e = porTipo.get(t.tipo) ?? { dondeSeResuelve: t.dondeSeResuelve, archivos: new Set<string>(), n: 0 };
    e.n++;
    e.archivos.add(h.archivo);
    porTipo.set(t.tipo, e);
  }

  // Identificadores (corrida de caracteres de palabra con la marca) que la tabla no tapa.
  const huecos = new Map<string, { n: number; archivos: Set<string> }>();
  const archivosConMarca = [...new Set(hallazgos.filter((h) => h.linea > 0).map((h) => h.archivo))];
  for (const f of archivosConMarca) {
    const texto = leerTexto(f) ?? "";
    for (const m of texto.matchAll(/(?<![@.\w-])\w*ordenex\w*/gi)) {
      const t = m[0];
      if (viejos.has(t) || /^(ordenex|Ordenex|ORDENEX)$/.test(t) || NO_ES_LA_MARCA.test(t)) continue;
      if (/^[Oo]rdenEx[a-z]/.test(t.slice(t.search(/ordenex/i)))) continue;
      const e = huecos.get(t) ?? { n: 0, archivos: new Set<string>() };
      e.n++;
      e.archivos.add(f);
      huecos.set(t, e);
    }
  }

  // Lo que ya existe con el nombre de destino.
  const prosaEmpresa = new Map<string, number>();
  const codigoEmpresa: string[] = [];
  const destinosCompuestos: string[] = [];
  const destinosNavegador: string[] = [];
  const reNuevos = nuevos.length ? new RegExp(`\\b(?:${nuevos.filter((n) => n !== "empresa").map(escaparRe).join("|")})\\b`) : null;
  for (const f of archivosDelArbol()) {
    const texto = leerTexto(f);
    if (texto === null || estaExceptuado(f, null)) continue;
    texto.split("\n").forEach((l, i) => {
      if (reNuevos?.test(l)) destinosCompuestos.push(`${f}:${i + 1}`);
      if (LITERAL_DESTINO_NAVEGADOR.test(l)) destinosNavegador.push(`${f}:${i + 1}`);
      if (/\bempresa\b|\bEMPRESA\b/.test(l)) {
        if (EMPRESA_DE_CODIGO.test(l)) codigoEmpresa.push(`${f}:${i + 1}`);
        else prosaEmpresa.set(f, (prosaEmpresa.get(f) ?? 0) + 1);
      }
    });
  }

  const tabla = (cabecera: string[], cuerpo: (string | number)[][]) =>
    [`| ${cabecera.join(" | ")} |`, `| ${cabecera.map(() => "---").join(" | ")} |`, ...cuerpo.map((c) => `| ${c.join(" | ")} |`)].join("\n");
  const ordenN = <T extends { n: number }>(a: [string, T], b: [string, T]) => b[1].n - a[1].n || a[0].localeCompare(b[0]);

  return [
    "# 494 — Censo de la marca retirada",
    "",
    `> Emitido por \`tests/fixtures/marca-sin-ordenex-494.ts\` (\`pnpm exec tsx … censo\`) sobre \`${sha}\`. El trinquete, por archivo, está en \`${RUTA_PENDIENTES}\`.`,
    "> El repo es público: dominios, URLs y correos solo se cuentan, sin escribir su valor. El clasificador de tipos es por línea y aproximado; el total no.",
    "",
    `**Total: ${hallazgos.length} apariciones en ${new Set(hallazgos.map((h) => h.archivo)).size} archivos**, fuera de excepciones activas.`,
    "",
    "## Por superficie",
    "",
    tabla(
      ["Superficie", "Archivos", "Apariciones"],
      [...porSuperficie.entries()].sort(ordenN).map(([k, v]) => [k, v.archivos.size, v.n]),
    ),
    "",
    "## Por tipo",
    "",
    tabla(
      ["Tipo", "Archivos", "Apariciones", "Dónde se resuelve"],
      [...porTipo.entries()].sort(ordenN).map(([k, v]) => [k, v.archivos.size, v.n, v.dondeSeResuelve]),
    ),
    "",
    "## Lo que ya existe con el nombre de destino (T1.3, design §3.1)",
    "",
    `- Identificadores de destino de la tabla (\`netoEmpresa\`, \`solo_empresa\`, …): **${destinosCompuestos.length}**${destinosCompuestos.length ? `: ${destinosCompuestos.join(", ")}` : ""}.`,
    `- \`empresa\` con forma de código (\`.empresa\`, \`empresa:\`, \`"empresa"\`): **${codigoEmpresa.length}**${codigoEmpresa.length ? `: ${codigoEmpresa.join(", ")}` : ""}.`,
    `- Destino de navegador (\`app:…\`, \`app_tema\`): **${destinosNavegador.length}**${destinosNavegador.length ? `: ${destinosNavegador.join(", ")}` : ""}.`,
    `- \`empresa\`/\`EMPRESA\` en prosa (comentario, texto visible o nombre de un test), sin colisión: **${[...prosaEmpresa.values()].reduce((a, b) => a + b, 0)} líneas en ${prosaEmpresa.size} archivos**:`,
    "",
    tabla(
      ["Archivo", "Líneas"],
      [...prosaEmpresa.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, v]) => [`\`${k}\``, v]),
    ),
    "",
    "## Identificadores que la tabla no tapa",
    "",
    "Ni en §3.1 ni en las filas añadidas al script. No son colisión: los resuelve la tarea que toque (T7.1 para los nombres de la base local, T8.1 para datos de prueba), o `tsc` y la guardia los señalan.",
    "",
    tabla(
      ["Identificador", "Archivos", "Apariciones"],
      [...huecos.entries()].sort(ordenN).map(([k, v]) => [`\`${k}\``, v.archivos.size, v.n]),
    ),
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------------------------
// CLI: `pnpm exec tsx tests/fixtures/marca-sin-ordenex-494.ts pendientes|censo`
// ---------------------------------------------------------------------------------------------

async function principal(orden: string | undefined): Promise<void> {
  const hallazgos = censoArbol();
  if (orden === "pendientes") {
    writeFileSync(path.join(RAIZ, RUTA_PENDIENTES), emitirPendientes(hallazgos));
    console.log(`${RUTA_PENDIENTES}: ${hallazgos.length} apariciones en ${Object.keys(recuentoPorArchivo(hallazgos)).length} archivos`);
  } else if (orden === "censo") {
    const sha = execFileSync("git", ["rev-parse", "--short=8", "origin/dev"], { cwd: RAIZ }).toString().trim();
    writeFileSync(path.join(RAIZ, RUTA_CENSO), await emitirCenso(hallazgos, sha));
    console.log(`${RUTA_CENSO}: ${hallazgos.length} apariciones`);
  } else {
    throw new Error("Uso: tsx tests/fixtures/marca-sin-ordenex-494.ts pendientes|censo");
  }
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  void principal(process.argv[2]);
}
