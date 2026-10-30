// @vitest-environment jsdom
import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Feature 489 (R16, R18): `app/login/page.tsx` lee el interruptor
// `RECUPERACION_CONTRASENA_ACTIVA` EN EL SERVIDOR y lo pasa al LoginForm. Aqui se renderizan
// la pagina real y el LoginForm real (sin stub, a diferencia de tests/components/LoginPage.test.tsx):
// lo que se comprueba es el enlace que la persona ve, con la variable de entorno como unica entrada.
const cookieGetMock = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: cookieGetMock })),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/repositories/SessionRepository", () => ({
  SessionRepository: vi.fn().mockImplementation(function SessionRepositoryMock(this: {
    findValidById: () => Promise<null>;
  }) {
    this.findValidById = async () => null;
  }),
}));

vi.mock("@/lib/db/prisma-client", () => ({
  getPrismaClient: vi.fn(() => ({})),
}));

vi.mock("@/lib/actions/auth", () => ({
  login: vi.fn(),
  verifyChallenge: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const TEXTO_ADMIN = "¿Olvidaste tu contraseña? Pídele a un administrador que te la restablezca.";
const ORIG = process.env.RECUPERACION_CONTRASENA_ACTIVA;

beforeEach(() => {
  vi.clearAllMocks();
  cookieGetMock.mockReturnValue(undefined);
});

afterEach(() => {
  if (ORIG === undefined) delete process.env.RECUPERACION_CONTRASENA_ACTIVA;
  else process.env.RECUPERACION_CONTRASENA_ACTIVA = ORIG;
});

async function renderLogin() {
  const { default: LoginPage } = await import("@/app/login/page");
  const element = await LoginPage({ searchParams: Promise.resolve({}) });
  render(element);
}

describe("app/login/page.tsx — enlace de recuperación según el interruptor (R16)", () => {
  it("con RECUPERACION_CONTRASENA_ACTIVA=true muestra el enlace hacia /recuperar-contrasena", async () => {
    process.env.RECUPERACION_CONTRASENA_ACTIVA = "true";
    await renderLogin();

    expect(screen.getByRole("link", { name: "¿Olvidaste tu contraseña?" })).toHaveAttribute(
      "href",
      "/recuperar-contrasena",
    );
    expect(screen.queryByText(TEXTO_ADMIN)).not.toBeInTheDocument();
  });

  it.each([
    ["ausente", undefined],
    ["false", "false"],
  ])("con el interruptor %s no hay enlace y sí el texto del administrador", async (_, valor) => {
    if (valor === undefined) delete process.env.RECUPERACION_CONTRASENA_ACTIVA;
    else process.env.RECUPERACION_CONTRASENA_ACTIVA = valor;
    await renderLogin();

    // Control de no-vacuidad: el formulario real se montó.
    expect(screen.getByRole("heading", { name: "Iniciar sesión" })).toBeInTheDocument();
    expect(screen.getByText(TEXTO_ADMIN)).toBeInTheDocument();
    expect(
      screen.getAllByRole("link").map((a) => a.getAttribute("href")),
    ).not.toContain("/recuperar-contrasena");
  });
});
