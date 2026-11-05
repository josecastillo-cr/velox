// FEATURE 494 (T1.4, design §3.1) — RENOMBRADO POR TABLA.
//
//   node scripts/marca-494-renombrar.mjs --familia <cierres|caja|analitica|comentarios> [--comprobar] [--parcial]
//
// Aplica una tabla cerrada viejo → nuevo sobre los archivos versionados. Es determinista y se puede
// repetir: un conflicto de rebase se resuelve descartando y reejecutando, NUNCA a mano, que es donde
// se cuela un cambio de importe. Tras ejecutarlo, regenerar el trinquete:
//
//   pnpm exec tsx tests/fixtures/marca-sin-ordenex-494.ts pendientes
//
// --comprobar  no escribe: lista lo que cambiaria y sale con 2 si queda algo por hacer.
// --parcial    rama ajena que mergeo `dev` con la familia ya aplicada (design §10.5): hay destinos en
//              el arbol y a la vez nombres viejos suyos. La colision solo se busca DENTRO de cada
//              archivo, en vez de en todo el arbol.
//
// Sale con 1 y sin escribir nada si un destino ya existe. T8.2 borra este archivo.
//
// No toca `db/migrations`, `specs`, `progress`, `docs` ni `db/schema.prisma`: ni siquiera estan entre
// las raices. Los comentarios del esquema son de T7.5.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const RAICES = ["app", "components", "hooks", "lib", "scripts", "tests", "e2e"];

// E7, E8 y E9 (design §7): definen lo prohibido. Las contrapruebas de la 493 las retira T8.2 a mano. El test
// de contrato cita `ganancia_ordenex` a proposito: con el destino en el arbol, comprobar abortaria.
const NUNCA = new Set([
  "tests/unit/api/contrato-sin-cambios-494.test.ts",
  "tests/unit/guards/marca-sin-ordenex-494.guardia.test.ts",
  "tests/fixtures/marca-sin-ordenex-494.ts",
  "tests/fixtures/marca-pendientes-494.ts",
  "tests/fixtures/marca-retirada-nombre-493.ts",
  "tests/fixtures/marca-retirada-493.ts",
  "tests/unit/guards/marca-fuente-unica-493.guardia.test.ts",
  "scripts/marca-494-renombrar.mjs",
]);

// E4, E5, E6 y E8: se quedan con la palabra vieja a proposito. Solo importa a `comentarios`, que es la
// unica familia con un patron lo bastante ancho como para tocarlos.
const NUNCA_EN_COMENTARIOS = new Set([
  "scripts/drenar-jobs.ts",
  "scripts/rollup-analitica-manual.ts",
  "scripts/contraste-454.ts",
  "scripts/seed-usuarios-qa.ts",
  "lib/navegador/claves-legadas.ts",
  "tests/integration/db/seed-usuarios-qa-494.test.ts",
  "tests/unit/tema/cookie-legada-494.test.ts",
  "tests/unit/analytics/cache-clave-conteo-productos-494.test.ts",
  "tests/unit/services/analitica-rollup-handler.test.ts",
]);
const CARPETAS_NUNCA_EN_COMENTARIOS = ["tests/unit/navegador/"];

const EXTENSIONES = /\.(tsx?|jsx?|mjs|cjs|css|json|md|sql|html|ya?ml)$/;

const fila = (viejo, nuevo) => ({ viejo, nuevo });
const conEmpresa = (viejos) => viejos.map((v) => fila(v, v.replace("Ordenex", "Empresa").replace("ORDENEX", "EMPRESA").replace("ordenex", "empresa")));

// La palabra minuscula suelta. Fuera de sus listas de rutas puede ser clave de navegador, dominio o
// nombre de la base, que tienen su propia tanda. Deja fuera: `x-ordenex`, `@ordenex`, `/ordenex`,
// `ordenex-x`, `ordenex.co` y compañia, y el prefijo `ordenex:algo`. `ordenex: 1` (clave de objeto) si entra.
const PALABRA_SUELTA = /(?<![-@/\w])ordenex(?![-\w]|\.(?:co|app|test|cr|vercel)\b|:[\w$<])/g;

export const FAMILIAS = {
  cierres: {
    archivos: [
      fila("lib/utils/ingreso-ordenex.ts", "lib/utils/ingreso-empresa.ts"),
      fila("tests/unit/utils/ingreso-ordenex.test.ts", "tests/unit/utils/ingreso-empresa.test.ts"),
    ],
    palabras: [
      fila("ingreso-ordenex", "ingreso-empresa"),
      ...conEmpresa([
        "ingresoOrdenex",
        "toIngresoOrdenex",
        "IngresoOrdenexDTO",
        "DesgloseIngresoOrdenex",
        "TotalesIngresoOrdenex",
        "totalesIngresoOrdenex",
        "gananciaOrdenex",
        "netoOrdenex",
        "netoOrdenexAgregado",
        "lineasNetoOrdenex",
        "pagoTiendaOrdenex",
        "NETO_ORDENEX_LABEL",
        "NETO_ORDENEX_NOTA",
        "NETO_ORDENEX_NEGATIVO_NOTA",
        "FACTURADO_ORDENEX_LABEL",
        "CASCADA_NETO_ORDENEX_TITULO",
        // No estaba en §3.1 (T1.3): constante local de un test de cierres.
        "TARIFA_ORDENEX",
      ]),
    ],
    sueltaEn: [],
    extra: [],
  },
  caja: {
    archivos: [],
    palabras: conEmpresa([
      "deOrdenex",
      "esOrdenex",
      "gastoDeOrdenex",
      "SuperficieOrdenex",
      "ORDENEX_NEUTRO",
      "BOLSILLO_ORDENEX",
      "ordenexCobra",
      "ordenexPaga",
      "solo_ordenex",
      "ordenex_debe",
      "gasto_ordenex",
      "tienda_paga_a_ordenex",
      "concepto_ordenex",
      // No estaban en §3.1 (T1.3): constantes locales de tests de caja.
      "SOLO_ORDENEX",
      "ORDENEX_PAGA",
      "DESDE_ORDENEX",
      "OTROS_EGRESOS_DE_ORDENEX",
    ]),
    sueltaEn: [
      "app/(app)/wallet/_components/BarraComposicionCaja.tsx",
      "app/(app)/wallet/_components/CajaResumenCard.tsx",
      "app/(app)/wallet/_components/wallet-labels.ts",
      "lib/repositories/libro-caja-a-quien-sql.ts",
      "tests/components/BarraComposicionCaja488.test.tsx",
      "tests/components/BarraComposicionCaja498.test.tsx",
      "tests/components/CajaComposicionBarra.test.tsx",
      "tests/components/CajaResumenCard.test.tsx",
      "tests/components/CajaResumenCard488.test.tsx",
      "tests/components/CajaResumenCard498.test.tsx",
    ],
    // Las barras de composicion se afirman como `clave:medida`.
    extra: [fila("ordenex:resto", "empresa:resto"), fila("ordenex:todo", "empresa:todo")],
  },
  analitica: {
    archivos: [],
    palabras: conEmpresa([
      "ganancia_ordenex",
      "ordenexPista",
      // No estaba en §3.1 (T1.3): alias de SQL en un test de integracion.
      "cobro_ordenex",
    ]),
    sueltaEn: [
      "app/(app)/analitica/_components/entregas/DineroProductoDetalle.tsx",
      "app/(app)/analitica/_components/entregas/ProductosTabla.tsx",
      "app/(app)/analitica/_components/entregas/analitica-productos-descarga-columnas.ts",
      "lib/services/ConteoProductosService.ts",
      "lib/services/DetalleDineroProductoService.ts",
      "lib/types/conteo-productos.ts",
      "lib/types/dinero-productos.ts",
      "lib/utils/dinero-por-producto.ts",
      "tests/components/DineroIdentidadesEnPantalla.test.tsx",
      "tests/components/ProductosTablaDinero.test.tsx",
      "tests/components/descarga/ProductosDescargaColumnas.test.tsx",
      "tests/integration/repositories/dinero-productos.int.test.ts",
      "tests/unit/analytics/_dinero-falso.ts",
      "tests/unit/analytics/conteo-productos-dinero.test.ts",
      "tests/unit/analytics/detalle-dinero-producto.test.ts",
      "tests/unit/analytics/dinero-producto-no-sumable.guardia.test.ts",
      "tests/unit/analytics/fulfillment-fuera-de-la-formula.guardia.test.ts",
      "tests/unit/descarga/analitica-productos-descarga-columnas.test.ts",
      "tests/unit/utils/dinero-por-producto.test.ts",
    ],
    extra: [],
  },
  comentarios: {
    archivos: [],
    // No estaba en §3.1 (T1.3): plantilla inventada de un test, dato de prueba (R26).
    palabras: [fila("bienvenida_ordenex", "bienvenida_empresa")],
    sueltaEn: [],
    extra: [],
  },
};

// Tanda 7 (design §3.4 y §3.5). El orden importa: primero lo que necesita contexto.
const SIN_GUION = "(?<![-\\w])";
const FIN = "(?![-\\w])";
const REGLAS_COMENTARIOS = [
  [new RegExp(`${SIN_GUION}del Ordenex${FIN}`, "g"), "de la empresa"],
  [new RegExp(`${SIN_GUION}al Ordenex${FIN}`, "g"), "a la empresa"],
  [new RegExp(`(^[ \\t]*(?://+|/?\\*+|#+|<!--|\\{/\\*)?[ \\t]*)Ordenex${FIN}`, "gm"), "$1La empresa"],
  [new RegExp(`([.!?][ \\t]+)Ordenex${FIN}`, "g"), "$1La empresa"],
  [new RegExp(`${SIN_GUION}Ordenex${FIN}`, "g"), "la empresa"],
  [new RegExp(`${SIN_GUION}ORDENEX${FIN}`, "g"), "LA EMPRESA"],
];

// Los unicos tests que dependen de un TLD real (§3.5). El resto va a `ejemplo.test`.
const TLD_REAL = /linkificar|email-config/;
const DOMINIO = /(?<![-\w])ordenex\.(?:co|app|test|cr)\b/gi;

function archivosVersionados() {
  return execFileSync("git", ["ls-files", "-z", "--", ...RAICES], { cwd: RAIZ, maxBuffer: 1e9 })
    .toString("utf8")
    .split("\0")
    .filter((f) => f !== "" && !NUNCA.has(f) && EXTENSIONES.test(f) && existsSync(path.join(RAIZ, f)));
}

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const palabra = (s) => new RegExp(`(?<![\\w])${escapar(s)}(?![\\w])`, "g");

// Formas en las que `empresa` es un identificador. En prosa («la plata de la empresa») no choca con
// nada: hay 67 apariciones medidas en T1.3, y abortar por ellas haria el script inservible.
const EMPRESA_DE_CODIGO = /\.empresa\b|^\s*empresa\??:|[{,]\s*empresa\??:|["'`]empresa["'`]|\b(?:const|let|var)\s+empresa\b/m;

function aplicarSuelta(texto, familia) {
  let t = texto.replace(PALABRA_SUELTA, "empresa");
  for (const { viejo, nuevo } of familia.extra) t = t.replace(palabra(viejo), nuevo);
  return t;
}

function transformar(rel, texto, nombre, familia) {
  let t = texto;
  for (const { viejo, nuevo } of familia.palabras) t = t.replace(palabra(viejo), nuevo);
  if (familia.sueltaEn.includes(rel)) t = aplicarSuelta(t, familia);
  if (nombre === "comentarios") {
    t = t.replace(DOMINIO, TLD_REAL.test(rel) ? "ejemplo.co" : "ejemplo.test");
    for (const [re, por] of REGLAS_COMENTARIOS) t = t.replace(re, por);
  }
  return t;
}

/** Colisiones de destino: nombre viejo y nombre nuevo a la vez. Vacio si no hay nada que hacer. */
function colisiones(textos, familia, parcial) {
  const acc = [];
  const viejosPresentes = (rel, texto) => {
    const v = familia.palabras.filter(({ viejo }) => palabra(viejo).test(texto));
    return familia.sueltaEn.includes(rel) && new RegExp(PALABRA_SUELTA.source).test(texto) ? [...v, fila("ordenex", "empresa")] : v;
  };
  const destinoEn = (nuevo, texto) => (nuevo === "empresa" ? EMPRESA_DE_CODIGO.test(texto) : palabra(nuevo).test(texto));

  const conViejo = new Map();
  for (const [rel, texto] of textos) {
    for (const f of viejosPresentes(rel, texto)) {
      if (!conViejo.has(f.nuevo)) conViejo.set(f.nuevo, { viejo: f.viejo, rutas: new Set() });
      conViejo.get(f.nuevo).rutas.add(rel);
    }
  }
  for (const [nuevo, { viejo, rutas }] of conViejo) {
    // `empresa` solo se escribe en su lista de rutas: fuera de ella no compite con nada.
    const alcance = parcial || nuevo === "empresa" ? [...rutas] : [...textos.keys()];
    const hay = alcance.filter((rel) => destinoEn(nuevo, textos.get(rel)));
    if (hay.length) acc.push(`${viejo} -> ${nuevo}: el destino ya existe en ${hay.slice(0, 5).join(", ")}`);
  }
  return acc;
}

function principal(args) {
  const i = args.indexOf("--familia");
  const nombre = i >= 0 ? args[i + 1] : undefined;
  const comprobar = args.includes("--comprobar");
  const parcial = args.includes("--parcial");
  const familia = nombre === undefined ? undefined : FAMILIAS[nombre];
  if (familia === undefined) {
    console.error(`Uso: --familia ${Object.keys(FAMILIAS).join("|")} [--comprobar] [--parcial]`);
    return 1;
  }

  const movidas = familia.archivos.filter(({ viejo }) => existsSync(path.join(RAIZ, viejo)));
  const destinosOcupados = movidas.filter(({ nuevo }) => existsSync(path.join(RAIZ, nuevo)));

  const textos = new Map();
  for (const rel of archivosVersionados()) {
    const b = readFileSync(path.join(RAIZ, rel));
    if (!b.includes(0)) textos.set(rel, b.toString("utf8"));
  }

  const choques = [...destinosOcupados.map(({ viejo, nuevo }) => `${viejo} -> ${nuevo}: el archivo de destino ya existe`), ...colisiones(textos, familia, parcial)];
  if (choques.length) {
    console.error(`ABORTA, sin escribir nada. Destinos ocupados (${choques.length}):`);
    for (const c of choques) console.error(`  ${c}`);
    return 1;
  }

  const excluido = (rel) => nombre === "comentarios" && (NUNCA_EN_COMENTARIOS.has(rel) || CARPETAS_NUNCA_EN_COMENTARIOS.some((c) => rel.startsWith(c)));
  const cambios = [];
  for (const [rel, texto] of textos) {
    if (excluido(rel)) continue;
    const nuevo = transformar(rel, texto, nombre, familia);
    if (nuevo !== texto) cambios.push([rel, nuevo]);
  }

  if (comprobar) {
    console.log(`[comprobar] ${nombre}: ${movidas.length} archivos a mover, ${cambios.length} a reescribir.`);
    for (const { viejo, nuevo } of movidas) console.log(`  mv ${viejo} -> ${nuevo}`);
    for (const [rel] of cambios) console.log(`  ${rel}`);
    return movidas.length || cambios.length ? 2 : 0;
  }

  // Primero el contenido, en la ruta vieja; luego `git mv`, para conservar la historia.
  for (const [rel, nuevo] of cambios) writeFileSync(path.join(RAIZ, rel), nuevo);
  for (const { viejo, nuevo } of movidas) execFileSync("git", ["mv", viejo, nuevo], { cwd: RAIZ });
  console.log(`${nombre}: ${movidas.length} archivos movidos, ${cambios.length} reescritos.`);
  return 0;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = principal(process.argv.slice(2));
}
