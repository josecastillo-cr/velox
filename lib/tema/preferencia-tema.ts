/**
 * Feature 211 — lectura y escritura de la preferencia de tema en la cookie.
 *
 * La ESCRITURA es del navegador a propósito. Una Server Action obligaría a esperar un
 * viaje al servidor para cambiar un color, y nadie espera a que responda un servidor para
 * ver el tema cambiar. El cambio visual lo hace React al instante (`TemaProvider`) y esta
 * cookie sólo sirve para que la PRÓXIMA carga ya llegue del servidor con la clase puesta.
 * Es exactamente lo que ya hace `components/ui/sidebar.tsx` con `sidebar_state`.
 *
 * La LECTURA del servidor no pasa por aquí: la hace `app/(app)/layout.tsx` con
 * `cookies()` de `next/headers`.
 */

import { COOKIE_TEMA_VIEJA } from "@/lib/navegador/claves-legadas";

import {
  COOKIE_TEMA,
  COOKIE_TEMA_MAX_AGE,
  normalizarTema,
  type Tema,
  type TemaElegido,
} from "./tema";

/**
 * `path=/` para que valga en todo el portal y `SameSite=Lax` porque no hay ningún flujo
 * cross-site que necesite más. No es `HttpOnly` a propósito: el cliente tiene que poder
 * escribirla sin servidor. No lleva nada sensible: es un enum de dos valores.
 *
 * Sólo recibe `Tema`, nunca «sin elegir»: la ausencia de elección se representa por la
 * AUSENCIA de cookie, no por un valor escrito. Guardar «no he elegido» sería indistinguible
 * de haber elegido, y congelaría a esa persona fuera de la preferencia de su sistema.
 */
export function guardarPreferenciaTema(tema: Tema): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_TEMA}=${tema}; path=/; max-age=${COOKIE_TEMA_MAX_AGE}; SameSite=Lax`;
}

function valorDeCookie(nombre: string): string | undefined {
  return document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${nombre}=`))
    ?.slice(nombre.length + 1);
}

/**
 * Lee la cookie del documento. Usada por los tests y como red de seguridad en cliente.
 * `null` = nunca se eligió (o la cookie trae basura, o el `"sistema"` de la versión
 * anterior): en los tres casos manda la preferencia del sistema.
 *
 * Misma regla que `app/(app)/layout.tsx`: la nueva si es válida, si no la vieja.
 */
export function leerPreferenciaTema(): TemaElegido {
  if (typeof document === "undefined") return normalizarTema(undefined);
  return normalizarTema(valorDeCookie(COOKIE_TEMA)) ?? normalizarTema(valorDeCookie(COOKIE_TEMA_VIEJA));
}

/**
 * Feature 494 (R17, design §5.4) — traslada la cookie del nombre viejo al nuevo.
 *
 * Es del cliente porque un Server Component no puede escribir cookies: el servidor ya pintó bien
 * leyendo las dos, y esto solo deja de depender de la vieja. Si la vieja no vale un tema (el
 * `"sistema"` de versiones anteriores, o basura) se caduca sin escribir la nueva: «sin elegir» se
 * representa por la AUSENCIA de cookie. Idempotente: sin vieja no hace nada.
 */
export function migrarCookieTema(): void {
  if (typeof document === "undefined") return;
  try {
    const vieja = valorDeCookie(COOKIE_TEMA_VIEJA);
    if (vieja === undefined) return;
    const tema = leerPreferenciaTema();
    if (tema !== null && normalizarTema(valorDeCookie(COOKIE_TEMA)) === null) {
      guardarPreferenciaTema(tema);
    }
    document.cookie = `${COOKIE_TEMA_VIEJA}=; path=/; max-age=0; SameSite=Lax`;
  } catch {
    // Cookies bloqueadas: el servidor sigue leyendo la vieja, y un color no rompe la carga.
  }
}
