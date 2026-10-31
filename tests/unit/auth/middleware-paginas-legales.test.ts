import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Feature 490 (R1-R4) — las paginas legales son publicas en el middleware REAL.
 *
 * Meta pide `/privacidad` y `/eliminacion-datos` sin cookie para pasar la app de WhatsApp a Live;
 * detras del guard su rastreador recibiria un 307 a /login. Como en `middleware.test.ts`, se
 * mockea SOLO `isSessionActive` (la frontera con la DB): si se llama, la pagina estaria
 * consultando la base para servirse.
 */

const isSessionActive = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/session-guard", () => ({ isSessionActive }));

const { middleware } = await import("@/middleware");

const BASE_URL = "https://app.test";

function buildRequest(pathname: string, session?: string): NextRequest {
  const request = new NextRequest(new URL(pathname, BASE_URL));
  if (session) request.cookies.set("session", session);
  return request;
}

beforeEach(() => {
  isSessionActive.mockReset();
  isSessionActive.mockResolvedValue(false);
});

describe("middleware — paginas legales sin cookie (R1, R2)", () => {
  it.each(["/privacidad", "/eliminacion-datos"])(
    "%s responde 200 sin redirigir y sin consultar la DB",
    async (ruta) => {
      const res = await middleware(buildRequest(ruta));

      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
      expect(isSessionActive).not.toHaveBeenCalled();
    },
  );
});

describe("middleware — paginas legales con cookie (R3)", () => {
  it.each([
    ["/privacidad", true],
    ["/privacidad", false],
    ["/eliminacion-datos", true],
    ["/eliminacion-datos", false],
  ])("%s con cookie (valida=%s) se sirve igual, sin redirect ni consulta", async (ruta, valida) => {
    isSessionActive.mockResolvedValue(valida);

    const res = await middleware(buildRequest(ruta, "sesion-cualquiera"));

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(isSessionActive).not.toHaveBeenCalled();
  });
});

describe("middleware — rutas que solo comparten prefijo de texto (R4)", () => {
  it.each(["/privacidad-admin", "/eliminacion-datosx", "/privacidadx"])(
    "%s sin cookie sigue siendo privada: 307 a /login",
    async (ruta) => {
      const res = await middleware(buildRequest(ruta));

      expect(res.status).toBe(307);
      const location = new URL(res.headers.get("location") ?? "");
      expect(location.pathname).toBe("/login");
      expect(location.searchParams.get("redirect")).toBe(ruta);
    },
  );
});
