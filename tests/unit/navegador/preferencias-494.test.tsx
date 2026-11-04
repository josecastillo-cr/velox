// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AMBITO_DESCARGA_ANALITICA_PRODUCTOS_DINERO,
  COLUMNAS_DESCARGA_ANALITICA_PRODUCTOS_DINERO,
} from "@/app/(app)/analitica/_components/entregas/analitica-productos-descarga-columnas";
import { usePreferenciaColumnas } from "@/hooks/usePreferenciaColumnas";
import { usePreferenciaSonido } from "@/hooks/usePreferenciaSonido";
import { leerPreferenciaSonido } from "@/lib/audio/preferencia-sonido";
import { claveDeAmbitoDescarga } from "@/lib/columnas/preferencia-columnas";
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

describe("494, design §5.3 — la columna de dinero con el catálogo de HOY", () => {
  // `clavesUtiles` descarta en silencio las claves no publicadas. Este ámbito guarda el identificador
  // de columna DENTRO del valor, y hoy el catálogo aún publica el nombre viejo: traducirlo ya haría
  // reaparecer la columna oculta, sin error. Por eso aquí se copia tal cual.
  //
  // AVISO PARA T5.1/T5.3: al renombrar la columna este test sale rojo, y es lo que tiene que pasar. Ahí
  // se sustituye por R16 (con `traducir`). Sin `traducir`, la columna oculta reaparecería.
  const COLUMNA = "ordenex";
  const nueva = claveDeAmbitoDescarga(AMBITO_DESCARGA_ANALITICA_PRODUCTOS_DINERO);
  const vieja = `ordenex:descarga-columnas:${AMBITO_DESCARGA_ANALITICA_PRODUCTOS_DINERO}`;

  it("el catálogo real publica esa columna (si no, este test no prueba nada)", () => {
    expect(COLUMNAS_DESCARGA_ANALITICA_PRODUCTOS_DINERO.map(claveDeColumna)).toContain(COLUMNA);
  });

  it("la columna oculta sigue oculta tras migrar, y el orden elegido se conserva", () => {
    const publicadas = COLUMNAS_DESCARGA_ANALITICA_PRODUCTOS_DINERO.map(claveDeColumna);
    const primera = publicadas[0]!;
    window.localStorage.setItem(vieja, JSON.stringify({ ocultas: [COLUMNA], orden: [publicadas[1], primera] }));

    const { result } = renderHook(() =>
      usePreferenciaColumnas(nueva, COLUMNAS_DESCARGA_ANALITICA_PRODUCTOS_DINERO, claveDeColumna),
    );

    expect(result.current.clavesVisibles).not.toContain(COLUMNA);
    expect(result.current.clavesVisibles.length).toBe(publicadas.length - 1);
    expect(result.current.clavesVisibles.indexOf(publicadas[1]!)).toBeLessThan(result.current.clavesVisibles.indexOf(primera));
    expect(window.localStorage.getItem(vieja)).toBeNull();
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

  it("control: la marca vieja de OTRA bodega no aplaza esta", () => {
    window.sessionStorage.setItem("ordenex:sinpe-revision-aplazada:z-otra", "1");
    render(<RevisionSinpeBodega bodega={BODEGA} />);
    expect(screen.getByText("Confirmá el SINPE de Guanacaste")).toBeInTheDocument();
  });
});
