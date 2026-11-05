// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CLAVE_SONIDO } from "@/lib/audio/preferencia-sonido";
import { claveDeAmbitoDescarga, leerCrudo } from "@/lib/columnas/preferencia-columnas";
import { claveColumnas } from "@/lib/manifiesto/preferencia-columnas";
import {
  claveViejaDe,
  leerConLegado,
  leerConMigracion,
} from "@/lib/navegador/claves-legadas";
import { CLAVE_APP_NAVEGACION } from "@/lib/utils/preferencia-navegacion";

// FEATURE 494 (T2.1, design §5.2) — LA CLAVE VIEJA SE LEE, SE TRASLADA Y NUNCA SE ESCRIBE.
//
// Las claves viejas van LITERALES y a mano: son lo que hay escrito hoy en el navegador de la gente.
// Compararlas con la constante que las define estaría siempre verde con la clave rota.

const VIEJA = "ordenex:sonido-notificaciones";
const NUEVA = "app:sonido-notificaciones";

/** Un almacén real de jsdom al que se le pueden hacer lanzar métodos concretos. */
function almacenQueLanza(metodos: { getItem?: (clave: string) => boolean; setItem?: boolean; removeItem?: boolean }): Storage {
  const real = window.localStorage;
  return {
    getItem: (clave: string) => {
      if (metodos.getItem?.(clave)) throw new Error("getItem");
      return real.getItem(clave);
    },
    setItem: (clave: string, valor: string) => {
      if (metodos.setItem) throw new Error("setItem");
      real.setItem(clave, valor);
    },
    removeItem: (clave: string) => {
      if (metodos.removeItem) throw new Error("removeItem");
      real.removeItem(clave);
    },
  } as unknown as Storage;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("494/R14 — solo hay vieja: se aplica, se traslada y se borra", () => {
  it("devuelve el valor, lo deja bajo la nueva y la vieja desaparece", () => {
    window.localStorage.setItem(VIEJA, "off");
    expect(leerConMigracion(window.localStorage, NUEVA, VIEJA)).toBe("off");
    expect(window.localStorage.getItem(NUEVA)).toBe("off");
    expect(window.localStorage.getItem(VIEJA)).toBeNull();
  });

  it("`traducir` se aplica a lo que se devuelve y a lo que se guarda", () => {
    window.localStorage.setItem(VIEJA, "abc");
    const traducir = (crudo: string) => crudo.toUpperCase();
    expect(leerConMigracion(window.localStorage, NUEVA, VIEJA, traducir)).toBe("ABC");
    expect(window.localStorage.getItem(NUEVA)).toBe("ABC");
  });

  it("un `traducir` que lanza no se lleva la preferencia: se copia tal cual", () => {
    window.localStorage.setItem(VIEJA, "abc");
    const traducir = () => {
      throw new Error("no entiendo esto");
    };
    expect(leerConMigracion(window.localStorage, NUEVA, VIEJA, traducir)).toBe("abc");
    expect(window.localStorage.getItem(NUEVA)).toBe("abc");
  });

  it("sin ninguna de las dos, `null` y no se escribe nada", () => {
    expect(leerConMigracion(window.localStorage, NUEVA, VIEJA)).toBeNull();
    expect(window.localStorage.length).toBe(0);
  });
});

describe("494/R15 — hay las dos: manda la nueva y la vieja se borra", () => {
  it("devuelve la nueva y borra la vieja", () => {
    window.localStorage.setItem(VIEJA, "off");
    window.localStorage.setItem(NUEVA, "on");
    expect(leerConMigracion(window.localStorage, NUEVA, VIEJA)).toBe("on");
    expect(window.localStorage.getItem(NUEVA)).toBe("on");
    expect(window.localStorage.getItem(VIEJA)).toBeNull();
  });

  it("`traducir` corre también sobre la nueva, y la reescribe solo si cambió (design §5.3)", () => {
    window.localStorage.setItem(VIEJA, "off");
    window.localStorage.setItem(NUEVA, "on");
    const traducir = (crudo: string) => crudo.toUpperCase();
    expect(leerConMigracion(window.localStorage, NUEVA, VIEJA, traducir)).toBe("ON");
    expect(window.localStorage.getItem(NUEVA)).toBe("ON");
    expect(window.localStorage.getItem(VIEJA)).toBeNull();
  });

  it("si `traducir` no cambia nada, la nueva no se escribe: el snapshot no varía", () => {
    window.localStorage.setItem(NUEVA, "on");
    const escribir = vi.spyOn(Storage.prototype, "setItem");
    expect(leerConMigracion(window.localStorage, NUEVA, VIEJA, (crudo) => crudo)).toBe("on");
    expect(escribir).not.toHaveBeenCalled();
    escribir.mockRestore();
  });

  it("un `traducir` que lanza sobre la nueva no se la lleva", () => {
    window.localStorage.setItem(NUEVA, "on");
    const traducir = () => {
      throw new Error("no se puede");
    };
    expect(leerConMigracion(window.localStorage, NUEVA, VIEJA, traducir)).toBe("on");
    expect(window.localStorage.getItem(NUEVA)).toBe("on");
  });
});

describe("494/R19 — el almacén lanza: nunca se propaga", () => {
  it("leer lanza: `null`, como sin preferencia", () => {
    const almacen = almacenQueLanza({ getItem: () => true });
    expect(leerConMigracion(almacen, NUEVA, VIEJA)).toBeNull();
  });

  it("solo falla leer la vieja: la nueva sigue valiendo", () => {
    window.localStorage.setItem(NUEVA, "off");
    const almacen = almacenQueLanza({ getItem: (clave) => clave === VIEJA });
    expect(leerConMigracion(almacen, NUEVA, VIEJA)).toBe("off");
  });

  it("⭑ solo falla la escritura: se devuelve el valor viejo y NO se borra la vieja", () => {
    // Borrarla aquí perdería la preferencia para siempre por un fallo de una sola carga.
    window.localStorage.setItem(VIEJA, "off");
    const almacen = almacenQueLanza({ setItem: true });
    expect(leerConMigracion(almacen, NUEVA, VIEJA)).toBe("off");
    expect(window.localStorage.getItem(VIEJA)).toBe("off");
    expect(window.localStorage.getItem(NUEVA)).toBeNull();
  });

  it("solo falla el borrado: se devuelve el valor, y la siguiente lectura termina el trabajo", () => {
    window.localStorage.setItem(VIEJA, "off");
    expect(leerConMigracion(almacenQueLanza({ removeItem: true }), NUEVA, VIEJA)).toBe("off");
    expect(window.localStorage.getItem(NUEVA)).toBe("off");
    expect(window.localStorage.getItem(VIEJA)).toBe("off");

    expect(leerConMigracion(window.localStorage, NUEVA, VIEJA)).toBe("off");
    expect(window.localStorage.getItem(VIEJA)).toBeNull();
  });

  it("`leerConLegado` tampoco lanza con una clave sin nombre anterior", () => {
    expect(leerConLegado(almacenQueLanza({ getItem: () => true }), "app:sin-historia")).toBeNull();
  });
});

describe("494 — idempotente, porque `leerCrudo` es el snapshot de `useSyncExternalStore`", () => {
  it("la segunda lectura devuelve el mismo string y no escribe nada", () => {
    window.localStorage.setItem(VIEJA, "off");
    const almacen = window.localStorage;
    const primera = leerConMigracion(almacen, NUEVA, VIEJA);

    const escribe = vi.spyOn(Storage.prototype, "setItem");
    const borra = vi.spyOn(Storage.prototype, "removeItem");
    const segunda = leerConMigracion(almacen, NUEVA, VIEJA);

    expect(segunda).toBe(primera);
    expect(escribe).not.toHaveBeenCalled();
    expect(borra).not.toHaveBeenCalled();
    escribe.mockRestore();
    borra.mockRestore();
  });
});

describe("494 — cada familia de claves encuentra la suya (leído de las constantes REALES)", () => {
  // Si una familia cambiara de prefijo sin pasar por el módulo, `claveViejaDe` daría `null` y la
  // preferencia se perdería sin ningún error. Por eso la nueva sale de quien la usa de verdad.
  it.each([
    ["sonido", () => CLAVE_SONIDO, "ordenex:sonido-notificaciones"],
    ["navegación", () => CLAVE_APP_NAVEGACION, "ordenex:app-navegacion"],
    ["manifiesto", () => claveColumnas("carga_masiva"), "ordenex:manifiesto-columnas:carga_masiva"],
    ["descarga", () => claveDeAmbitoDescarga("ordenes"), "ordenex:descarga-columnas:ordenes"],
  ])("%s", (_nombre, nueva, vieja) => {
    expect(claveViejaDe(nueva())).toBe(vieja);
  });

  it("los nombres nuevos, a mano: son lo que queda escrito en el navegador a partir de ahora", () => {
    expect(CLAVE_SONIDO).toBe("app:sonido-notificaciones");
    expect(CLAVE_APP_NAVEGACION).toBe("app:app-navegacion");
    expect(claveColumnas("carga_masiva")).toBe("app:manifiesto-columnas:carga_masiva");
    expect(claveDeAmbitoDescarga("ordenes")).toBe("app:descarga-columnas:ordenes");
  });

  it("una clave sin nombre anterior no tiene vieja, y se lee sin más", () => {
    expect(claveViejaDe("app:otra-cosa")).toBeNull();
    window.localStorage.setItem("app:otra-cosa", "x");
    expect(leerConLegado(window.localStorage, "app:otra-cosa")).toBe("x");
  });

  it("`leerCrudo` migra, y sigue sin leer nada con clave `null` (R33 de la 314)", () => {
    const nueva = claveDeAmbitoDescarga("ordenes");
    window.localStorage.setItem("ordenex:descarga-columnas:ordenes", `{"ocultas":["a"]}`);
    expect(leerCrudo(null)).toBeNull();
    expect(leerCrudo(nueva)).toBe(`{"ocultas":["a"]}`);
    expect(window.localStorage.getItem("ordenex:descarga-columnas:ordenes")).toBeNull();
    expect(window.localStorage.getItem(nueva)).toBe(`{"ocultas":["a"]}`);
  });
});
