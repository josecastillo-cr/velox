import { MARCADOR_PENDIENTE } from "./datos-legales";

const CLASE_PENDIENTE =
  "rounded bg-brand-soft px-1 font-semibold text-primary-strong";

/** Marcador visible de un dato legal sin definir (R19). */
function Pendiente() {
  return (
    <span data-pendiente="" className={CLASE_PENDIENTE}>
      {MARCADOR_PENDIENTE}
    </span>
  );
}

/**
 * Feature 490 — pinta un dato legal tal cual (R20) o, si vale `null`, el marcador de pendiente
 * (R19). Nunca un valor sustituto: un dato legal inventado es peor que uno que se ve que falta.
 */
export function DatoLegal({ valor }: Readonly<{ valor: string | null }>) {
  if (valor === null) return <Pendiente />;
  return <>{valor}</>;
}

/**
 * El correo de contacto de privacidad como enlace `mailto:` (R15). Sin correo definido NO hay
 * enlace: un `mailto:` a un marcador no lleva a ninguna parte, y se pinta el marcador como texto
 * (R21).
 */
export function CorreoLegal({ correo }: Readonly<{ correo: string | null }>) {
  if (correo === null) return <Pendiente />;
  return (
    <a
      href={`mailto:${correo}`}
      className="font-semibold text-primary-strong underline underline-offset-2 hover:text-asfalto-9"
    >
      {correo}
    </a>
  );
}
