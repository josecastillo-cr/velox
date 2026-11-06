-- DOWN (ficha 498, M2) — en este orden (design §3.2):
--   1. borra las filas de la caja con origen en un ajuste. Es la PERDIDA DECLARADA de la reversion: las
--      diferencias escritas mientras la tabla existio;
--   2. devuelve el CHECK tipo<->categoria EXACTAMENTE a la lista de la 488
--      (`20261023120100_iva_por_pagar_488_checks/migration.sql`);
--   3. borra la tabla de ajustes.
-- Va ANTES que el `down` de M1 (que retira los valores de enum) y DESPUES del de M4 (cuyo predicado lee
-- esta tabla). Los asientos de los cierres (origen `cierre_dia`) NO se tocan aqui.

BEGIN;

DELETE FROM "wallet_movimiento" WHERE "origen_tipo"::text = 'conciliacion_bodega_ajuste';

ALTER TABLE "wallet_movimiento" DROP CONSTRAINT "wallet_movimiento_tipo_categoria_check";
ALTER TABLE "wallet_movimiento" ADD CONSTRAINT "wallet_movimiento_tipo_categoria_check"
CHECK (
  ("tipo" = 'ingreso' AND "categoria" IN ('ingreso_flete','ingreso_flete_devolucion','ingreso_comision_cod',
     'ingreso_iva_flete','ingreso_iva_flete_devolucion','ingreso_iva_comision_cod','ingreso_ajuste',
     'ingreso_cod_recaudado','ingreso_reverso_pago_tienda',
     'ingreso_reverso_pago_por_cuenta_tienda','ingreso_aporte_capital',
     'ingreso_cobro_tienda',
     'ingreso_abono_tienda',
     'ingreso_reverso_pago_iva'))
  OR
  ("tipo" = 'egreso' AND "categoria" IN ('egreso_pago_tienda','egreso_pago_mensajero','egreso_gasto',
     'egreso_sueldo','egreso_ajuste','egreso_gasto_fijo','egreso_gasto_variable','egreso_indemnizacion',
     'egreso_pago_por_cuenta_tienda','egreso_reverso_aporte_capital',
     'egreso_reverso_cobro_tienda',
     'egreso_reverso_abono_tienda',
     'egreso_reverso_flete_devolucion','egreso_reverso_iva_flete_devolucion',
     'egreso_pago_iva'))
);

DROP TABLE "conciliacion_bodega_ajuste";

COMMIT;
