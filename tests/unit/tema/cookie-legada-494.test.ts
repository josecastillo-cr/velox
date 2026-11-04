// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { createElement, type ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { COOKIE_TEMA_VIEJA } from "@/lib/navegador/claves-legadas";
import { leerPreferenciaTema, migrarCookieTema } from "@/lib/tema/preferencia-tema";
import { COOKIE_TEMA, COOKIE_TEMA_MAX_AGE, type TemaElegido } from "@/lib/tema/tema";
import { TemaProvider, useTema } from "@/providers/TemaProvider";

// FEATURE 494 (T2.3, R17, design §5.4) — LA COOKIE DE TEMA CON EL NOMBRE ANTERIOR.
//
// Que el servidor pinta el tema de la vieja lo afirma `tests/components/AppLayout.test.tsx`, sobre el
// layout real. Aquí, la otra mitad: al montar, el cliente escribe la nueva y caduca la vieja. Los
// nombres van a mano: es lo que hay escrito en el navegador de la gente.

const borrar = (nombre: string) => {
  document.cookie = `${nombre}=; path=/; max-age=0`;
};
const cookie = (nombre: string) =>
  document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${nombre}=`))
    ?.slice(nombre.length + 1);

/** Registra lo que se escribe en `document.cookie` sin impedir que se escriba. */
function espiarCookie(): { escrituras: string[]; restaurar: () => void } {
  const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie")!;
  const escrituras: string[] = [];
  Object.defineProperty(document, "cookie", {
    configurable: true,
    get: () => descriptor.get!.call(document),
    set: (v: string) => {
      escrituras.push(v);
      descriptor.set!.call(document, v);
    },
  });
  return { escrituras, restaurar: () => void delete (document as unknown as { cookie?: string }).cookie };
}

beforeEach(() => {
  borrar("app_tema");
  borrar("ordenex_tema");
});

afterEach(cleanup);

describe("los nombres, a mano", () => {
  it("la nueva y la vieja", () => {
    expect(COOKIE_TEMA).toBe("app_tema");
    expect(COOKIE_TEMA_VIEJA).toBe("ordenex_tema");
  });
});

describe("494/R17 — al montar: escribe la nueva y caduca la vieja", () => {
  it("con solo la vieja, la traslada con el mismo max-age", () => {
    document.cookie = "ordenex_tema=oscuro; path=/";
    const { escrituras, restaurar } = espiarCookie();

    migrarCookieTema();
    restaurar();

    expect(cookie("app_tema")).toBe("oscuro");
    expect(cookie("ordenex_tema")).toBeUndefined();
    expect(escrituras).toHaveLength(2);
    expect(escrituras[0]).toContain("app_tema=oscuro");
    expect(escrituras[0]).toContain(`max-age=${COOKIE_TEMA_MAX_AGE}`);
    expect(escrituras[0]).toContain("path=/");
  });

  it("⭑ R20: a la vieja solo se le escribe su caducidad, nunca un valor", () => {
    document.cookie = "ordenex_tema=oscuro; path=/";
    const { escrituras, restaurar } = espiarCookie();

    migrarCookieTema();
    restaurar();

    const aLaVieja = escrituras.filter((e) => e.startsWith("ordenex_tema="));
    expect(aLaVieja).toEqual(["ordenex_tema=; path=/; max-age=0; SameSite=Lax"]);
  });

  it("con las dos, manda la nueva, y la vieja se caduca", () => {
    document.cookie = "app_tema=claro; path=/";
    document.cookie = "ordenex_tema=oscuro; path=/";
    migrarCookieTema();
    expect(cookie("app_tema")).toBe("claro");
    expect(cookie("ordenex_tema")).toBeUndefined();
  });

  it("nueva con basura y vieja válida: gana la vieja, igual que en el servidor", () => {
    document.cookie = "app_tema=azul; path=/";
    document.cookie = "ordenex_tema=oscuro; path=/";
    expect(leerPreferenciaTema()).toBe("oscuro");
    migrarCookieTema();
    expect(cookie("app_tema")).toBe("oscuro");
    expect(cookie("ordenex_tema")).toBeUndefined();
  });

  it.each(["sistema", "azul", ""])("vieja que no es un tema (%j): se caduca y NO se escribe la nueva", (valor) => {
    // «Sin elegir» se representa por la ausencia de cookie: escribirla congelaría a esa persona fuera
    // de la preferencia de su sistema.
    document.cookie = `ordenex_tema=${valor}; path=/`;
    migrarCookieTema();
    expect(cookie("app_tema")).toBeUndefined();
    expect(cookie("ordenex_tema")).toBeUndefined();
  });

  it("idempotente: sin vieja no escribe nada", () => {
    document.cookie = "app_tema=claro; path=/";
    const { escrituras, restaurar } = espiarCookie();

    migrarCookieTema();
    migrarCookieTema();
    restaurar();

    expect(escrituras).toEqual([]);
    expect(cookie("app_tema")).toBe("claro");
  });

  it("R19: si `document.cookie` lanza, no se propaga", () => {
    const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie")!;
    document.cookie = "ordenex_tema=oscuro; path=/";
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => descriptor.get!.call(document),
      set: () => {
        throw new Error("cookies bloqueadas");
      },
    });
    try {
      expect(() => migrarCookieTema()).not.toThrow();
    } finally {
      delete (document as unknown as { cookie?: string }).cookie;
    }
  });
});

describe("494/R17 — el punto de montaje real: `TemaProvider`", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    );
  });

  function Sonda() {
    const { tema } = useTema();
    return createElement("span", { "data-testid": "tema" }, String(tema));
  }

  // El archivo es `.ts`, como lo nombra la excepción E5 de la guardia: por eso sin JSX.
  const montar = (temaInicial: TemaElegido) =>
    createElement(
      TemaProvider,
      { temaInicial } as ComponentProps<typeof TemaProvider>,
      createElement(Sonda),
    );

  it("montarlo traslada la cookie, y el tema que pinta es el que vino del servidor", () => {
    document.cookie = "ordenex_tema=oscuro; path=/";

    render(montar("oscuro"));

    expect(screen.getByTestId("tema").textContent).toBe("oscuro");
    expect(document.querySelector('[data-tema="oscuro"]')?.className).toContain("dark");
    expect(cookie("app_tema")).toBe("oscuro");
    expect(cookie("ordenex_tema")).toBeUndefined();
  });

  it("montarlo sin cookie vieja no escribe ninguna: quien no eligió sigue sin elegir", () => {
    render(montar(null));
    expect(cookie("app_tema")).toBeUndefined();
    expect(cookie("ordenex_tema")).toBeUndefined();
  });
});
