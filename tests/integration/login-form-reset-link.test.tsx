// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LoginForm } from "@/app/login/_components/LoginForm";

/**
 * El «¿Olvidaste tu contraseña?» del login en sus dos estados (feature 489, R15/R16).
 *
 * Historia del nombre: nació para exigir el enlace (R18 de la feature 20); el 2026-09-04 cambió
 * de signo y exigió que NO estuviera, porque el SMTP de Gmail rechazaba la credencial (535) y el
 * paso 1 de `/recuperar-contrasena` fallaba en silencio. Desde la 489 el enlace depende del
 * interruptor `RECUPERACION_CONTRASENA_ACTIVA`, que lee `app/login/page.tsx` en el servidor y
 * llega aquí como la prop `recuperacionActiva` (default `false`).
 */

// Las Server Actions no se ejercitan en este test; se mockean para aislar el render.
vi.mock("@/lib/actions/auth", () => ({
  login: vi.fn(),
  verifyChallenge: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

/** Literales del spec, escritos a mano (no derivados del componente). */
const TEXTO_ADMIN = "¿Olvidaste tu contraseña? Pídele a un administrador que te la restablezca.";
const ENLACE = "¿Olvidaste tu contraseña?";

function hrefs(): (string | null)[] {
  return screen.getAllByRole("link").map((a) => a.getAttribute("href"));
}

describe("LoginForm — recuperación apagada (R15)", () => {
  it.each([
    ["sin la prop", undefined],
    ["con false", false],
  ])("%s: muestra el texto del administrador y ningún enlace a /recuperar-contrasena", (_, valor) => {
    render(<LoginForm redirectParam={null} recuperacionActiva={valor} />);

    // CONTROL DE NO-VACUIDAD: el formulario SÍ se renderizó.
    expect(screen.getByRole("heading", { name: "Iniciar sesión" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument();

    expect(screen.getByText(TEXTO_ADMIN)).toBeInTheDocument();
    expect(hrefs()).not.toContain("/recuperar-contrasena");
    expect(screen.queryByRole("link", { name: ENLACE })).not.toBeInTheDocument();
  });

  it("conserva el enlace de postulación pública", () => {
    render(<LoginForm redirectParam={null} />);

    // Control que distingue «falta UN enlace» de «se cayó el bloque de enlaces entero».
    expect(
      screen.getByRole("link", { name: "¿Quieres ser mensajero? Postúlate aquí" }),
    ).toHaveAttribute("href", "/postulacion");
  });
});

describe("LoginForm — recuperación encendida (R16)", () => {
  it("muestra el enlace «¿Olvidaste tu contraseña?» hacia /recuperar-contrasena y no el texto del administrador", () => {
    render(<LoginForm redirectParam={null} recuperacionActiva />);

    expect(screen.getByRole("link", { name: ENLACE })).toHaveAttribute(
      "href",
      "/recuperar-contrasena",
    );
    expect(screen.queryByText(TEXTO_ADMIN)).not.toBeInTheDocument();

    // El de postulación sigue ahí: el enlace nuevo no sustituye al otro.
    expect(
      screen.getByRole("link", { name: "¿Quieres ser mensajero? Postúlate aquí" }),
    ).toHaveAttribute("href", "/postulacion");
  });
});
