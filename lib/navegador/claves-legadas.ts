/**
 * Feature 494 (design §5) — LO QUE EL NAVEGADOR TODAVÍA GUARDA CON EL NOMBRE VIEJO.
 *
 * Las preferencias viven en el dispositivo de cada persona. Renombrar la clave sin más no da ningún
 * error: la preferencia simplemente desaparece y vuelven las columnas o el sonido que había quitado.
 * Por eso la clave vieja SE LEE Y NUNCA SE ESCRIBE (R20), y al leerla se traslada a la nueva.
 *
 * Aquí viven TODOS los nombres viejos, para que la guardia los localice y para que retirarlos sea
 * borrar este archivo (design §5.6: no antes de 90 días en producción; una PWA instalada puede tardar
 * en relevar su service worker y la cookie del tema dura un año). La única copia fuera es la de los
 * alias de `public/sw.js`, que no puede importar del bundle; las guardias `pwa-*` comprueban que
 * coinciden.
 *
 * Es puro a propósito: sin `window` ni `document`. Lo importa también el layout del servidor, y el
 * almacén llega por parámetro para probarlo con un doble que lance.
 */

/** Cookie del tema. La lee el servidor y la caduca el cliente (design §5.4). */
export const COOKIE_TEMA_VIEJA = "ordenex_tema";

/** Mensajes del protocolo página ↔ service worker de la versión anterior (design §5.5). */
export const MENSAJE_RELEVO_AHORA_LEGADO = "ordenex:relevo-ahora";
export const MENSAJE_PAGINA_LISTA_LEGADO = "ordenex:pagina-lista";
export const MENSAJE_PUSH_RECIBIDO_LEGADO = "ordenex:push-recibido";

const CLAVES_EXACTAS: Readonly<Record<string, string>> = {
  "app:sonido-notificaciones": "ordenex:sonido-notificaciones",
  "app:app-navegacion": "ordenex:app-navegacion",
};

const PREFIJOS: ReadonlyArray<readonly [nuevo: string, viejo: string]> = [
  ["app:manifiesto-columnas:", "ordenex:manifiesto-columnas:"],
  ["app:descarga-columnas:", "ordenex:descarga-columnas:"],
  ["app:sinpe-revision-aplazada:", "ordenex:sinpe-revision-aplazada:"],
];

/** La clave vieja que corresponde a una nueva, o `null` si esa clave nunca tuvo nombre anterior. */
export function claveViejaDe(nueva: string): string | null {
  const exacta = CLAVES_EXACTAS[nueva];
  if (exacta !== undefined) return exacta;
  for (const [prefijoNuevo, prefijoViejo] of PREFIJOS) {
    if (nueva.startsWith(prefijoNuevo)) {
      return prefijoViejo + nueva.slice(prefijoNuevo.length);
    }
  }
  return null;
}

/**
 * Design §5.3: la clave de una columna renombrada, guardada DENTRO del valor. `clavesUtiles` descarta
 * en silencio lo que el catálogo ya no publica, así que sin traducirla la columna oculta vuelve a
 * salir en el archivo de quien la quitó, sin ningún error.
 *
 * Devuelve el MISMO string si no hay nada que traducir: es lo que hace seguro llamarla desde un
 * snapshot de `useSyncExternalStore`. Un JSON inválido lanza y lo recoge `traducirSinLanzar`, que deja
 * el valor tal cual para que el saneo lo trate como hoy.
 */
const COLUMNA_DINERO_VIEJA = "ordenex";
const COLUMNA_DINERO_NUEVA = "empresa";

function traducirColumnasDinero(crudo: string): string {
  const parseado: unknown = JSON.parse(crudo);
  if (typeof parseado !== "object" || parseado === null || Array.isArray(parseado)) return crudo;
  const preferencia = { ...(parseado as Record<string, unknown>) };
  let cambio = false;
  for (const campo of ["ocultas", "orden"]) {
    const lista = preferencia[campo];
    if (Array.isArray(lista) && lista.includes(COLUMNA_DINERO_VIEJA)) {
      preferencia[campo] = lista.map((clave: unknown) => (clave === COLUMNA_DINERO_VIEJA ? COLUMNA_DINERO_NUEVA : clave));
      cambio = true;
    }
  }
  return cambio ? JSON.stringify(preferencia) : crudo;
}

/** Los valores cuyo contenido nombra algo renombrado, por clave nueva. Ámbito: el del catálogo con dinero. */
const TRADUCCIONES: Readonly<Record<string, (crudo: string) => string>> = {
  "app:descarga-columnas:analitica-productos-dinero": traducirColumnasDinero,
};

function borrarSinLanzar(almacen: Storage, clave: string): void {
  try {
    almacen.removeItem(clave);
  } catch {
    // Queda la vieja, y la nueva sigue mandando (R15): se reintentará en la siguiente lectura.
  }
}

function traducirSinLanzar(crudo: string, traducir: ((crudo: string) => string) | undefined): string {
  if (traducir === undefined) return crudo;
  try {
    return traducir(crudo);
  } catch {
    return crudo;
  }
}

/** Lo ya guardado bajo la nueva. Solo escribe si cambió, y si no puede escribir devuelve la traducción igual. */
function traducirGuardado(
  almacen: Storage,
  nueva: string,
  guardado: string,
  traducir: ((crudo: string) => string) | undefined,
): string {
  const valor = traducirSinLanzar(guardado, traducir);
  if (valor === guardado) return guardado;
  try {
    almacen.setItem(nueva, valor);
  } catch {
    // Se reintentará en la siguiente lectura, y mientras tanto la traducción da el mismo string.
  }
  return valor;
}

/**
 * Lee una preferencia y, de paso, la traslada a su clave nueva.
 *
 * - Hay nueva: se devuelve, y si queda vieja se borra (R15). Si procede se traduce también, y se reescribe
 *   solo si cambió: la tanda 1 pudo dejar el valor bajo la nueva con el nombre viejo dentro (design §5.3).
 * - Solo hay vieja: se traduce si procede, se copia a la nueva, se borra la vieja y se devuelve (R14).
 * - El almacén lanza al leer: `null`, como sin preferencia (R19). Nunca propaga.
 * - Solo falla la escritura: se devuelve el valor viejo y la vieja SE CONSERVA. Borrarla perdería la
 *   preferencia para siempre por un fallo de una sola carga (cuota llena, modo privado).
 *
 * Idempotente: `leerCrudo` es el snapshot de `useSyncExternalStore`, que lo llama varias veces por
 * render y compara por valor. Tras la primera lectura la vieja ya no existe, y las siguientes devuelven
 * el mismo string. Escribir aquí es seguro por eso: la segunda pasada no escribe nada.
 */
export function leerConMigracion(
  almacen: Storage,
  nueva: string,
  vieja: string,
  traducir?: (crudo: string) => string,
): string | null {
  let enNueva: string | null;
  try {
    enNueva = almacen.getItem(nueva);
  } catch {
    return null;
  }

  let enVieja: string | null;
  try {
    enVieja = almacen.getItem(vieja);
  } catch {
    enVieja = null;
  }

  if (enNueva !== null) {
    if (enVieja !== null) borrarSinLanzar(almacen, vieja);
    return traducirGuardado(almacen, nueva, enNueva, traducir);
  }

  if (enVieja === null) return null;

  const valor = traducirSinLanzar(enVieja, traducir);
  try {
    almacen.setItem(nueva, valor);
  } catch {
    return valor;
  }
  borrarSinLanzar(almacen, vieja);
  return valor;
}

/**
 * `leerConMigracion` para quien solo tiene la clave nueva. Una clave sin nombre anterior se lee sin
 * más, de modo que `leerCrudo` no tiene que distinguir familias. Nunca lanza.
 */
export function leerConLegado(almacen: Storage, nueva: string): string | null {
  const vieja = claveViejaDe(nueva);
  if (vieja !== null) return leerConMigracion(almacen, nueva, vieja, TRADUCCIONES[nueva]);
  try {
    return almacen.getItem(nueva);
  } catch {
    return null;
  }
}
