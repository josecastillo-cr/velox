// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mocks de las dependencias server-side de app/recuperar-contrasena/page.tsx.
// El page.tsx (Server Component real) se importa sin mockear: se ejercita su logica real.
//
// Feature 489 — la pagina obedece al interruptor `RECUPERACION_CONTRASENA_ACTIVA`:
// apagado (ausente o cualquier valor que no sea true/1) monta `RecuperacionDesactivadaAviso`
// —exactamente lo que habia desde el 2026-09-04—; encendido monta el formulario de 3 pasos.
// El aviso y el formulario se renderizan DE VERDAD, sin stub: se comprueba el texto que la
// persona lee, no que la pagina importe un modulo. Solo se mockean las Server Actions.
const cookieGetMock = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: cookieGetMock })),
}));

const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

const findValidByIdMock = vi.fn();
vi.mock("@/lib/repositories/SessionRepository", () => ({
  SessionRepository: vi.fn().mockImplementation(function SessionRepositoryMock(this: {
    findValidById: typeof findValidByIdMock;
  }) {
    this.findValidById = findValidByIdMock;
  }),
}));

vi.mock("@/lib/db/prisma-client", () => ({
  getPrismaClient: vi.fn(() => ({})),
}));

vi.mock("@/lib/actions/password-reset", () => ({
  solicitarRecuperacion: vi.fn(),
  verificarCodigoRecuperacion: vi.fn(),
  restablecerContrasena: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

/** Textos acordados, escritos LITERAL. No se derivan de los componentes: comparar el mensaje
 *  con la constante que lo genera estaria verde siempre, incluso con la pantalla vacia. */
const MENSAJE_ADMIN =
  "Para recuperar tu contraseña, pídele a un administrador que te la restablezca.";
const SUBTITULO_APAGADO = "Te ayudamos a volver a entrar a tu cuenta.";
const SUBTITULO_ENCENDIDO = "Recupera el acceso a tu cuenta de forma segura";

const ORIG = process.env.RECUPERACION_CONTRASENA_ACTIVA;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  if (ORIG === undefined) delete process.env.RECUPERACION_CONTRASENA_ACTIVA;
  else process.env.RECUPERACION_CONTRASENA_ACTIVA = ORIG;
});

function fijarInterruptor(valor: string | undefined) {
  if (valor === undefined) delete process.env.RECUPERACION_CONTRASENA_ACTIVA;
  else process.env.RECUPERACION_CONTRASENA_ACTIVA = valor;
}

async function renderSinSesion() {
  const { default: RecuperarContrasenaPage } = await import("@/app/recuperar-contrasena/page");
  cookieGetMock.mockReturnValue(undefined);
  const element = await RecuperarContrasenaPage();
  render(element);
}

describe("app/recuperar-contrasena/page.tsx — sesion activa (R14)", () => {
  it.each([
    ["apagado", undefined],
    ["encendido", "true"],
  ])("con el interruptor %s redirige a /dashboard si la cookie es valida", async (_, valor) => {
    fijarInterruptor(valor);
    const { default: RecuperarContrasenaPage } = await import(
      "@/app/recuperar-contrasena/page"
    );
    cookieGetMock.mockReturnValue({ value: "session-abc" });
    findValidByIdMock.mockResolvedValue({
      id: "session-abc",
      userId: "user-1",
      expiresAt: new Date(Date.now() + 1000 * 60),
      createdAt: new Date(),
    });

    await expect(RecuperarContrasenaPage()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(findValidByIdMock).toHaveBeenCalledWith("session-abc");
  });
});

describe("app/recuperar-contrasena/page.tsx — interruptor apagado (R12, R17)", () => {
  it.each([
    ["ausente", undefined],
    ["false", "false"],
    ["vacio", ""],
    ["si", "si"],
  ])("con el interruptor %s dice a quien acudir y no pide un correo", async (_, valor) => {
    fijarInterruptor(valor);
    await renderSinSesion();

    expect(redirectMock).not.toHaveBeenCalled();
    expect(screen.getByText(MENSAJE_ADMIN)).toBeInTheDocument();
    expect(screen.getByText(SUBTITULO_APAGADO)).toBeInTheDocument();
    expect(screen.queryByText(SUBTITULO_ENCENDIDO)).not.toBeInTheDocument();

    // No es un callejon sin salida: hay camino de vuelta al login.
    expect(screen.getByRole("link", { name: "Volver a iniciar sesión" })).toHaveAttribute(
      "href",
      "/login",
    );

    // Y NO queda ni un campo del formulario.
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryByLabelText("Correo electrónico")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Enviar|Verificar/ })).not.toBeInTheDocument();
  });

  it("con la sesion de la cookie expirada/invalida muestra el mismo aviso, no el formulario", async () => {
    fijarInterruptor(undefined);
    const { default: RecuperarContrasenaPage } = await import(
      "@/app/recuperar-contrasena/page"
    );
    cookieGetMock.mockReturnValue({ value: "session-expired" });
    findValidByIdMock.mockResolvedValue(null);

    const element = await RecuperarContrasenaPage();
    render(element);

    expect(redirectMock).not.toHaveBeenCalled();
    expect(screen.getByText(MENSAJE_ADMIN)).toBeInTheDocument();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });
});

describe("app/recuperar-contrasena/page.tsx — interruptor encendido (R13)", () => {
  it.each([
    ["true", "true"],
    ["1", "1"],
  ])("con el interruptor %s monta el formulario y no el aviso", async (_, valor) => {
    fijarInterruptor(valor);
    await renderSinSesion();

    expect(redirectMock).not.toHaveBeenCalled();
    // Paso 1 del formulario: el campo de correo y su boton.
    expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar código" })).toBeInTheDocument();
    expect(screen.getByText(SUBTITULO_ENCENDIDO)).toBeInTheDocument();

    expect(screen.queryByText(MENSAJE_ADMIN)).not.toBeInTheDocument();
    expect(screen.queryByText(SUBTITULO_APAGADO)).not.toBeInTheDocument();
  });
});
