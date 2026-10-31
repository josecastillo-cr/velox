import Link from "next/link";
import type { ReactNode } from "react";

import { VolverAlInicioLink } from "@/components/shared/VolverAlInicioLink";
import { cn } from "@/lib/utils";

import { LandingFooter } from "../_landing/LandingFooter";
import { RotuloSeccion, Seccion, TituloSeccion } from "../_landing/primitivas";
import { DatoLegal } from "./DatoLegal";

/**
 * Feature 490 — armazon comun de las paginas legales (`/privacidad`, `/eliminacion-datos`).
 *
 * Server Component puro, con el estilo de la landing (`tema-claro`, `bg-kraft-canvas`, tokens
 * `asfalto-*`/`navy-deep`) y sus primitivas. La cabecera pinta la MARCA COMO TEXTO desde los datos
 * legales y no el `Logo` compartido: ese es un wordmark fijo y la marca a mostrar esta abierta.
 * No reutiliza `LandingNav`: sus anclas solo existen en `/` y monta una isla cliente. El pie
 * recibe la misma marca, asi que el wordmark compartido no aparece en estas paginas: una sola marca.
 *
 * Exactamente un `<h1>` (R8): el titulo. Las secciones del cuerpo van en `<h2>` (`SeccionLegal`).
 */
export function PaginaLegal({
  marca,
  rotulo,
  titulo,
  children,
}: Readonly<{
  marca: string | null;
  rotulo: ReactNode;
  titulo: ReactNode;
  children: ReactNode;
}>) {
  return (
    <div className="tema-claro flex min-h-dvh flex-col bg-kraft-canvas font-sans text-asfalto-9">
      <header className="bg-navy-deep px-6 md:px-12">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 py-3">
          <Link
            href="/"
            className="font-heading text-lg font-bold tracking-[-0.02em] text-white outline-none focus-visible:ring-3 focus-visible:ring-brand-light/60"
          >
            <DatoLegal valor={marca} />
          </Link>
          <VolverAlInicioLink className="text-asfalto-2/80 hover:bg-white/10 hover:text-white" />
        </div>
      </header>

      <main className="flex-1">
        <Seccion className="max-w-[880px] md:py-16">
          <RotuloSeccion>{rotulo}</RotuloSeccion>
          <h1 className="mb-6 font-heading text-[clamp(30px,5vw,44px)] leading-[1.08] font-bold tracking-[-0.025em] text-asfalto-9">
            {titulo}
          </h1>
          <div className="space-y-10 text-[15px] leading-relaxed text-asfalto-7">{children}</div>
        </Seccion>
      </main>

      <LandingFooter marca={<DatoLegal valor={marca} />} />
    </div>
  );
}

/** Seccion del cuerpo legal: un `<h2>` y su contenido. */
export function SeccionLegal({
  titulo,
  children,
}: Readonly<{ titulo: ReactNode; children: ReactNode }>) {
  return (
    <section className="space-y-3">
      <TituloSeccion className="mb-2 max-w-none text-[clamp(20px,3vw,26px)] leading-tight">
        {titulo}
      </TituloSeccion>
      {children}
    </section>
  );
}

/** Lista semantica con viñetas, para las categorias de datos y sus usos. */
export function ListaLegal({
  children,
  className,
}: Readonly<{ children: ReactNode; className?: string }>) {
  return <ul className={cn("list-disc space-y-1.5 pl-5", className)}>{children}</ul>;
}

/** Subtitulo dentro de una seccion («Qué datos», «Para qué se usan»). */
export function SubtituloLegal({ children }: Readonly<{ children: ReactNode }>) {
  return <h3 className="pt-1 text-base font-semibold text-asfalto-9">{children}</h3>;
}

/** Enlace de texto dentro del cuerpo legal (contraste AA sobre el lienzo claro). */
export function EnlaceLegal({ href, children }: Readonly<{ href: string; children: ReactNode }>) {
  return (
    <Link
      href={href}
      className="font-semibold text-primary-strong underline underline-offset-2 hover:text-asfalto-9"
    >
      {children}
    </Link>
  );
}

/**
 * Ficha del responsable: los datos legales como lista de definiciones. Cada valor pasa por
 * `DatoLegal`, asi que un dato sin definir sale como marcador (R19) y uno definido tal cual (R20).
 */
export function FichaResponsable({
  filas,
}: Readonly<{ filas: ReadonlyArray<{ etiqueta: string; valor: ReactNode }> }>) {
  return (
    <dl className="grid gap-x-6 gap-y-2 rounded-xl border border-asfalto-2 bg-kraft-card p-5 sm:grid-cols-[max-content_1fr]">
      {filas.map((fila) => (
        <div key={fila.etiqueta} className="contents">
          <dt className="font-semibold text-asfalto-9">{fila.etiqueta}</dt>
          <dd>{fila.valor}</dd>
        </div>
      ))}
    </dl>
  );
}
