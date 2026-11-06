// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AMBITO_DESCARGA_ANALITICA_PRODUCTOS_DINERO,
  COLUMNAS_DESCARGA_ANALITICA_PRODUCTOS_DINERO,
} from "@/app/(app)/analitica/_components/entregas/analitica-productos-descarga-columnas";
import { usePreferenciaColumnas } from "@/hooks/usePreferenciaColumnas";
import { usePreferenciaSonido } from "@/hooks/usePreferenciaSonido";
import { leerPreferenciaSonido } from "@/lib/audio/preferencia-sonido";
import { claveDeAmbitoDescarga, leerCrudo } from "@/lib/columnas/preferencia-columnas";
import { leerAppPreferida } from "@/lib/utils/preferencia-navegacion";
import type { SinpeBodegaDTO } from "@/lib/types/sinpe-bodega";

// FEATURE 494 (T2.2) — CON LA PREFERENCIA VIEJA SEMBRADA, SE APLICA.
//
// El módulo se prueba solo en `migrar-clave-494.test.ts`. Aquí se comprueba lo que un test del módulo
// no ve: que cada lector REAL pasa por él. Un `getItem` directo que quedara en un lector dejaría todos
// los tests del módulo en verde y la preferencia perdida. Claves viejas literales, a propósito.

vi.mock("@/lib/actions/sinpe-bodega", () => ({
  guardarSinpeBodega: vi.fn(),
  confirmarSinpeBodega: vi.fn(),
  listarSinpeBodegas: vi.fn(),
}));
vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), show: vi.fn(), dismiss: vi.fn() }),
}));

const { RevisionSinpeBodega } = await import("@/components/shared/RevisionSinpeBodega");

const claveDeColumna = (c: { clave: string }) => c.clave;

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(cleanup);

describe("494/R14 — sonido", () => {
  it("quien había silenciado sigue silenciado, y la clave se traslada", () => {
    window.localStorage.setItem("ordenex:sonido-notificaciones", "off");
    expect(leerPreferenciaSonido()).toBe(false);
    expect(window.localStorage.getItem("app:sonido-notificaciones")).toBe("off");
    expect(window.localStorage.getItem("ordenex:sonido-notificaciones")).toBeNull();
  });

  it("el hook lo aplica, y cambiarlo escribe solo la nueva (R20)", () => {
    window.localStorage.setItem("ordenex:sonido-notificaciones", "off");
    const { result } = renderHook(() => usePreferenciaSonido());
    expect(result.current.activado).toBe(false);

    act(() => result.current.establecer(true));

    expect(result.current.activado).toBe(true);
    expect(window.localStorage.getItem("app:sonido-notificaciones")).toBe("on");
    expect(window.localStorage.getItem("ordenex:sonido-notificaciones")).toBeNull();
  });
});

describe("494/R14 — app de navegación", () => {
  it("se conserva la app elegida", () => {
    window.localStorage.setItem("ordenex:app-navegacion", "waze");
    expect(leerAppPreferida()).toBe("waze");
    expect(window.localStorage.getItem("app:app-navegacion")).toBe("waze");
    expect(window.localStorage.getItem("ordenex:app-navegacion")).toBeNull();
  });
});

const COLUMNAS_SINTETICAS = [{ clave: "a" }, { clave: "b" }, { clave: "c" }];

describe("494/R14 — columnas por el hook real, sin bucle de `useSyncExternalStore`", () => {
  it.each([
    ["manifiesto", "ordenex:manifiesto-columnas:carga_masiva", "app:manifiesto-columnas:carga_masiva"],
    ["descarga", "ordenex:descarga-columnas:ordenes", "app:descarga-columnas:ordenes"],
  ])("%s: la oculta sigue oculta y el orden se conserva", (_nombre, vieja, nueva) => {
    const guardado = JSON.stringify({ ocultas: ["a"], orden: ["c", "b", "a"] });
    window.localStorage.setItem(vieja, guardado);

    const { result } = renderHook(() => usePreferenciaColumnas(nueva, COLUMNAS_SINTETICAS, claveDeColumna));

    expect(result.current.clavesVisibles).toEqual(["c", "b"]);
    expect(window.localStorage.getItem(nueva)).toBe(guardado);
    expect(window.localStorage.getItem(vieja)).toBeNull();
  });

  it("alternar tras migrar parte de lo migrado y escribe solo la nueva (R20)", () => {
    const vieja = "ordenex:descarga-columnas:ordenes";
    const nueva = "app:descarga-columnas:ordenes";
    window.localStorage.setItem(vieja, JSON.stringify({ ocultas: ["a"] }));

    const { result } = renderHook(() => usePreferenciaColumnas(nueva, COLUMNAS_SINTETICAS, claveDeColumna));
    act(() => result.current.alternar("b"));

    expect(window.localStorage.getItem(nueva)).toBe(JSON.stringify({ ocultas: ["a", "b"] }));
    expect(window.localStorage.getItem(vieja)).toBeNull();
  });

  it("JSON inválido: se copia tal cual y el saneo lo trata como sin preferencia", () => {
    window.localStorage.setItem("ordenex:descarga-columnas:ordenes", "{no es json");
    const { result } = renderHook(() =>
      usePreferenciaColumnas("app:descarga-columnas:ordenes", COLUMNAS_SINTETICAS, claveDeColumna),
    );
    expect(result.current.clavesVisibles).toEqual(["a", "b", "c"]);
    expect(window.localStorage.getItem("app:descarga-columnas:ordenes")).toBe("{no es json");
  });
});

describe("494/R16, design §5.3 — la columna de dinero guardada con su nombre viejo", () => {
  // `clavesUtiles` descarta en silencio las claves no publicadas, y este ámbito guarda la clave de la
  // columna DENTRO del valor. Sin `traducir` la columna oculta vuelve a salir, sin ningún error.
  //
  // Hay DOS caminos, y por eso dos casos: el navegador que aún tiene la clave vieja, y el que ya pasó por
  // la tanda 1, que dejó el valor bajo `app:` con el nombre viejo dentro.
  const nueva = "app:descarga-columnas:analitica-productos-dinero";
  const vieja = "ordenex:descarga-columnas:analitica-productos-dinero";

  const montar = () =>
    renderHook(() => usePreferenciaColumnas(nueva, COLUMNAS_DESCARGA_ANALITICA_PRODUCTOS_DINERO, claveDeColumna));

  it("el ámbito del catálogo es el de estas claves, y publica la columna con el nombre nuevo", () => {
    expect(claveDeAmbitoDescarga(AMBITO_DESCARGA_ANALITICA_PRODUCTOS_DINERO)).toBe(nueva);
    const publicadas = COLUMNAS_DESCARGA_ANALITICA_PRODUCTOS_DINERO.map(claveDeColumna);
    expect(publicadas).toContain("empresa");
    expect(publicadas).not.toContain("ordenex");
  });

  it.each([
    ["la clave vieja", vieja],
    ["lo ya guardado bajo `app:`", nueva],
  ])("%s: la columna oculta sigue oculta y el orden elegido se conserva", (_camino, sembrada) => {
    window.localStorage.setItem(
      sembrada,
      JSON.stringify({ ocultas: ["ordenex"], orden: ["recaudado", "ordenex", "producto"] }),
    );

    const { result } = montar();

    expect(result.current.clavesVisibles).not.toContain("empresa");
    expect(result.current.clavesVisibles.indexOf("recaudado")).toBeLessThan(result.current.clavesVisibles.indexOf("producto"));
    // La oculta conserva su sitio en el orden: se ve en el selector, que lista también las desmarcadas.
    const ordenadas = result.current.ordenadas.map(claveDeColumna);
    expect(ordenadas.filter((c) => ["recaudado", "empresa", "producto"].includes(c))).toEqual(["recaudado", "empresa", "producto"]);
    expect(JSON.parse(window.localStorage.getItem(nueva)!)).toEqual({
      ocultas: ["empresa"],
      orden: ["recaudado", "empresa", "producto"],
    });
    expect(window.localStorage.getItem(vieja)).toBeNull();
  });

  // El hook lee varias veces por render, así que por el hook un camino tapa al otro: la segunda lectura
  // traduce lo que la primera dejó bajo `app:`. Cada camino se afirma aquí, en UNA sola lectura.
  it.each([
    ["la clave vieja", vieja],
    ["lo ya guardado bajo `app:`", nueva],
  ])("%s: la primera lectura ya sale traducida, y la segunda da el mismo string sin escribir", (_camino, sembrada) => {
    window.localStorage.setItem(sembrada, JSON.stringify({ ocultas: ["ordenex"], orden: ["ordenex"] }));

    const primera = leerCrudo(nueva);

    expect(primera).toBe(JSON.stringify({ ocultas: ["empresa"], orden: ["empresa"] }));
    expect(window.localStorage.getItem(nueva)).toBe(primera);

    const escribir = vi.spyOn(Storage.prototype, "setItem");
    expect(leerCrudo(nueva)).toBe(primera);
    expect(escribir).not.toHaveBeenCalled();
    escribir.mockRestore();
  });

  it("volver a leer no escribe, y una preferencia sin esa columna no se reserializa", () => {
    // Con un espacio a propósito: reserializarlo lo cambiaría, y el snapshot variaría sin motivo.
    const guardado = '{"orden": ["recaudado"], "ocultas": ["producto"]}';
    window.localStorage.setItem(nueva, guardado);
    const escribir = vi.spyOn(Storage.prototype, "setItem");

    const { result } = montar();

    expect(result.current.clavesVisibles).not.toContain("producto");
    expect(escribir).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(nueva)).toBe(guardado);
    escribir.mockRestore();
  });

  it("alternar tras traducir parte de lo traducido y nunca vuelve a escribir el nombre viejo (R20)", () => {
    window.localStorage.setItem(nueva, JSON.stringify({ ocultas: ["ordenex"] }));

    const { result } = montar();
    act(() => result.current.alternar("producto"));

    expect(JSON.parse(window.localStorage.getItem(nueva)!).ocultas).toEqual(["empresa", "producto"]);
    expect(window.localStorage.getItem(nueva)).not.toContain("ordenex");
  });

  it("si no se puede escribir, la columna oculta sigue oculta en esta carga", () => {
    window.localStorage.setItem(nueva, JSON.stringify({ ocultas: ["ordenex"] }));
    const escribir = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("cuota");
    });

    const { result } = montar();

    expect(result.current.clavesVisibles).not.toContain("empresa");
    escribir.mockRestore();
  });

  it("JSON inválido bajo `app:`: se deja tal cual y el saneo lo trata como sin preferencia", () => {
    window.localStorage.setItem(nueva, "{no es json");
    const { result } = montar();
    expect(result.current.clavesVisibles).toContain("empresa");
    expect(window.localStorage.getItem(nueva)).toBe("{no es json");
  });

  it("otro ámbito con una columna que se llame igual no se traduce", () => {
    const guardado = JSON.stringify({ ocultas: ["ordenex"] });
    window.localStorage.setItem("app:descarga-columnas:ordenes", guardado);
    renderHook(() => usePreferenciaColumnas("app:descarga-columnas:ordenes", COLUMNAS_SINTETICAS, claveDeColumna));
    expect(window.localStorage.getItem("app:descarga-columnas:ordenes")).toBe(guardado);
  });
});

describe("494/R18 — el aviso de SINPE aplazado", () => {
  const BODEGA: SinpeBodegaDTO = {
    zonaId: "z-prueba",
    zonaNombre: "Guanacaste",
    esCentral: false,
    numero: "80000000",
    nombre: "Titular de Prueba",
    revisadoAt: null,
    editable: true,
  };

  it("con la marca vieja no vuelve a salir en esa sesión, y la marca se traslada", () => {
    window.sessionStorage.setItem("ordenex:sinpe-revision-aplazada:z-prueba", "1");
    render(<RevisionSinpeBodega bodega={BODEGA} />);
    expect(screen.queryByText("Confirmá el SINPE de Guanacaste")).toBeNull();
    expect(window.sessionStorage.getItem("app:sinpe-revision-aplazada:z-prueba")).toBe("1");
    expect(window.sessionStorage.getItem("ordenex:sinpe-revision-aplazada:z-prueba")).toBeNull();
  });

  it("R20: aplazar el aviso escribe solo la clave nueva", async () => {
    const user = userEvent.setup();
    render(<RevisionSinpeBodega bodega={BODEGA} />);
    await user.click(screen.getByRole("button", { name: "Ahora no" }));
    expect(window.sessionStorage.getItem("app:sinpe-revision-aplazada:z-prueba")).toBe("1");
    expect(window.sessionStorage.getItem("ordenex:sinpe-revision-aplazada:z-prueba")).toBeNull();
  });

  it("control: la marca vieja de OTRA bodega no aplaza esta", () => {
    window.sessionStorage.setItem("ordenex:sinpe-revision-aplazada:z-otra", "1");
    render(<RevisionSinpeBodega bodega={BODEGA} />);
    expect(screen.getByText("Confirmá el SINPE de Guanacaste")).toBeInTheDocument();
  });
});
