import { ListaLegal } from "./PaginaLegal";

/**
 * Feature 490 — lo que se conserva aunque una persona pida eliminar sus datos.
 *
 * Solo afirma lo que el esquema y el codigo obligan a conservar (verificado el 2026-10-30):
 *  - Los libros de dinero (`wallet_movimiento`, `wallet_tienda_movimiento`,
 *    `pago_mensajero_movimiento`) son INMUTABLES: sin `updated_at`/`deleted_at` y sin ningun
 *    `update`/`delete` en `lib/` ni `app/`. Sus comprobantes (`wallet_comprobante`) cuelgan de esas
 *    filas con FK `Restrict`.
 *  - El historial de acciones (`historial_accion`) es inmutable y su FK al actor es `Restrict`: la
 *    base no deja borrar a un usuario con acciones registradas. Nombre y rol del actor van
 *    congelados en la fila.
 *
 * No promete plazos de conservacion ni que el resto se borre de una forma concreta: nadie lo ha
 * decidido.
 */
export function ConservacionLegal() {
  return (
    <>
      <p>
        Algunos registros no se borran aunque se pida la eliminación, porque son el respaldo de
        operaciones ya hechas:
      </p>
      <ListaLegal>
        <li>
          Los movimientos de dinero con mensajeros y tiendas (cobros, pagos y ajustes) y sus
          comprobantes. Son registros que la aplicación no modifica ni borra.
        </li>
        <li>
          El historial de acciones: quién hizo cada acción en la aplicación, con su nombre y su rol
          en ese momento. La base de datos no permite borrar a un usuario que tenga acciones
          registradas.
        </li>
      </ListaLegal>
    </>
  );
}
