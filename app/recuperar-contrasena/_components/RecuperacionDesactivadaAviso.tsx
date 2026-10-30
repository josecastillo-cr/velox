import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * AVISO QUE SUSTITUYE AL FORMULARIO DE RECUPERACIÓN mientras el interruptor
 * `RECUPERACION_CONTRASENA_ACTIVA` esté apagado (feature 489).
 *
 * ── HISTORIA (en una línea)
 * Nació el 2026-09-04: el SMTP de Gmail rechazaba la credencial (535) y el paso 1, que responde
 * un `ok` genérico anti-enumeración, fallaba en silencio (12 intentos de 2 personas reales).
 *
 * ── QUÉ DICE, Y POR QUÉ ESO
 * Da la salida que funciona sin correo: un administrador restablece la contraseña desde
 * Configuración → Usuarios (ficha 287, `UsuarioService.restablecerContrasena`, que no toca el
 * proveedor de correo ni para fallar).
 * No dice «vuelve más tarde» ni enseña un error técnico: quien llega aquí necesita saber
 * A QUIÉN ACUDIR, no de qué murió el SMTP.
 *
 * ── LA RUTA SIGUE PÚBLICA
 * La ruta sigue siendo pública en `middleware.ts`: si se cerrara, quien tenga el enlace
 * guardado acabaría en `/login` sin explicación, que es el callejón que esto evita.
 *
 * ── CÓMO SE ENCIENDE (feature 489): sin tocar código
 * El correo ahora sale por Brevo. `app/recuperar-contrasena/page.tsx` y el login leen en el
 * servidor `RECUPERACION_CONTRASENA_ACTIVA`: con `true`/`1` + redeploy, la página monta
 * `RecuperarContrasenaForm` y el login muestra el enlace «¿Olvidaste tu contraseña?»; con
 * cualquier otro valor o sin la variable, se muestra ESTE aviso (procedimiento en
 * `docs/release.md`, sección 489). Lo vigilan
 * `tests/integration/login-form-reset-link.test.tsx` y
 * `tests/integration/recuperar-contrasena-page.test.tsx`.
 */
export function RecuperacionDesactivadaAviso() {
  return (
    <Card className="w-full max-w-md border-t-4 border-t-brand p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-center text-foreground">
          ¿Olvidaste tu contraseña?
        </h1>
        <p className="text-sm text-muted-foreground text-center mt-2">
          Para recuperar tu contraseña, pídele a un administrador que te la restablezca.
        </p>
      </div>

      {/* `cn(...)` y no `buttonVariants(...)` a pelo: ficha 439. Esta variante es la de
          fondo solido, asi que HOY no se ve nada raro, pero la composicion es la misma que
          dejo la salida de `ErrorState` sin borde visible —sin tailwind-merge sobreviven las
          clases en conflicto y gana la de la base—. Un enlace con pinta de boton pasa por
          `cn`, siempre. Lo sostiene
          `tests/unit/guards/buttonvariants-pasa-por-cn.guardia.test.ts`. */}
      <Link href="/login" className={cn(buttonVariants({ className: "w-full" }))}>
        Volver a iniciar sesión
      </Link>
    </Card>
  );
}
