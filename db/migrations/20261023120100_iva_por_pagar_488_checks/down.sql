-- DOWN (ficha 488, 2 de 2) — el CHECK tipo<->categoria de la caja vuelve a la lista EXACTA de la 458-B
-- (`20260928120100_wallet_458_tablas/migration.sql`). Va ANTES que el `down` de la migracion 1, que retira
-- los dos valores del enum.
--
-- PRECONDICION RUIDOSA (R36): si algun movimiento de la caja usa `egreso_pago_iva` o
-- `ingreso_reverso_pago_iva`, se ABORTA sin tocar nada, diciendo cual. Un Pago de IVA es dinero que salio
-- hacia Hacienda: un rollback no es la forma de borrarlo. (Sin esta guardia, re-validar el CHECK fallaria
-- con 23514 sin decir por que.)

BEGIN;

DO $$
DECLARE
  v_pagos bigint;
  v_anulaciones bigint;
BEGIN
  SELECT count(*) INTO v_pagos FROM "wallet_movimiento" WHERE "categoria"::text = 'egreso_pago_iva';
  SELECT count(*) INTO v_anulaciones FROM "wallet_movimiento" WHERE "categoria"::text = 'ingreso_reverso_pago_iva';
  IF v_pagos > 0 THEN
    RAISE EXCEPTION 'rollback 488: % movimientos de la caja usan egreso_pago_iva; se aborta sin borrar nada', v_pagos;
  END IF;
  IF v_anulaciones > 0 THEN
    RAISE EXCEPTION 'rollback 488: % movimientos de la caja usan ingreso_reverso_pago_iva; se aborta sin borrar nada', v_anulaciones;
  END IF;
END
$$;

ALTER TABLE "wallet_movimiento" DROP CONSTRAINT "wallet_movimiento_tipo_categoria_check";
ALTER TABLE "wallet_movimiento" ADD CONSTRAINT "wallet_movimiento_tipo_categoria_check"
CHECK (
  ("tipo" = 'ingreso' AND "categoria" IN ('ingreso_flete','ingreso_flete_devolucion','ingreso_comision_cod',
     'ingreso_iva_flete','ingreso_iva_flete_devolucion','ingreso_iva_comision_cod','ingreso_ajuste',
     'ingreso_cod_recaudado','ingreso_reverso_pago_tienda',
     'ingreso_reverso_pago_por_cuenta_tienda','ingreso_aporte_capital',
     'ingreso_cobro_tienda',
     'ingreso_abono_tienda'))
  OR
  ("tipo" = 'egreso' AND "categoria" IN ('egreso_pago_tienda','egreso_pago_mensajero','egreso_gasto',
     'egreso_sueldo','egreso_ajuste','egreso_gasto_fijo','egreso_gasto_variable','egreso_indemnizacion',
     'egreso_pago_por_cuenta_tienda','egreso_reverso_aporte_capital',
     'egreso_reverso_cobro_tienda',
     'egreso_reverso_abono_tienda',
     'egreso_reverso_flete_devolucion','egreso_reverso_iva_flete_devolucion'))
);

COMMIT;
