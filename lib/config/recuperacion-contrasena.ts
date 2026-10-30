// Interruptor de la recuperacion de contrasena (feature 489, R17/R18).
//
// RECUPERACION_CONTRASENA_ACTIVA decide si /recuperar-contrasena monta el
// formulario y si el login muestra el enlace. Se lee SOLO en el servidor (sin
// prefijo NEXT_PUBLIC_, R18) y es una funcion, no una constante de modulo: se
// evalua en cada render, asi nada queda congelado en un modulo cacheado y los
// tests pueden cambiar process.env entre casos.

/**
 * RECUPERACION_CONTRASENA_ACTIVA: "true"/"1" (sin distinguir mayusculas, con
 * espacios alrededor ignorados) => true; cualquier otro valor, vacio o
 * ausencia => false (apagado).
 */
export function recuperacionContrasenaActiva(): boolean {
  const raw = process.env.RECUPERACION_CONTRASENA_ACTIVA;
  if (raw === undefined) return false;
  const valor = raw.trim().toLowerCase();
  return valor === "true" || valor === "1";
}
