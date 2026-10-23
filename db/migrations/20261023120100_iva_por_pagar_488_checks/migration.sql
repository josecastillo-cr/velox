-- FICHA 488 (2 de 2) — el CHECK tipo<->categoria de la caja, AMPLIADO con los dos conceptos del IVA por
-- pagar (design §3.2, R35). Es la lista de la 458-B (`20260928120100_wallet_458_tablas`) con
-- `ingreso_reverso_pago_iva` al final de la rama `ingreso` y `egreso_pago_iva` al final de la rama
-- `egreso`: el pago SOLO como salida y su anulacion SOLO como entrada. Ninguna fila previa puede fallar
-- (solo se añaden valores). Sin tablas, sin columnas, sin datos.

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
