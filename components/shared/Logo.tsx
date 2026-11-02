import { LOGO, MARCA } from "@/lib/marca/identidad";
import { cn } from "@/lib/utils";

/**
 * Sobre que fondo se pinta el logo (feature 492, R12):
 * - `oscuro`: logotipo original (VELOX blanco). Barra lateral, landing, paneles navy.
 * - `claro`: adaptacion con VELOX en azul marino.
 * - `tema`: la clara en tema claro y la oscura en tema oscuro (fondos que giran con el tema).
 */
export type FondoLogo = "oscuro" | "claro" | "tema";

interface LogoProps {
  /** Fondo sobre el que va el logo. Por defecto `oscuro`. */
  fondo?: FondoLogo;
  /**
   * Clases de tamano y posicion. El alto del logo sigue al `font-size` (`text-xl`, `text-lg`…):
   * asi cada consumidor conserva su tamano relativo sin cambiar sus clases.
   */
  className?: string;
}

const IMAGEN = "h-[1.25em] w-auto";

/**
 * Logotipo de Velox Courier, componente compartido (feature 86, R6; imagen desde la 492, R12).
 * Presentacion pura, server-compatible; sin dependencias de datos.
 *
 * Un unico nombre accesible venga una imagen o dos: la raiz es `role="img"` con el nombre de
 * marca y las imagenes de dentro van con `alt=""` y `aria-hidden`. En la variante `tema` las dos
 * estan en el DOM y un lector no debe oir la marca dos veces.
 *
 * `<img>` y no `next/image`: los SVG exigen `dangerouslyAllowSVG` en `next/image`.
 */
export function Logo({ fondo = "oscuro", className }: Readonly<LogoProps>) {
  return (
    <span
      role="img"
      aria-label={MARCA.nombre}
      className={cn("inline-flex items-center text-2xl", className)}
    >
      {fondo === "tema" ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO.sobreClaro} alt="" aria-hidden="true" className={cn(IMAGEN, "dark:hidden")} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LOGO.sobreOscuro}
            alt=""
            aria-hidden="true"
            className={cn(IMAGEN, "hidden dark:inline-block")}
          />
        </>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fondo === "claro" ? LOGO.sobreClaro : LOGO.sobreOscuro}
          alt=""
          aria-hidden="true"
          className={IMAGEN}
        />
      )}
    </span>
  );
}
