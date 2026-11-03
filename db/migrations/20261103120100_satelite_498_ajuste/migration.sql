-- FICHA 498 (M2, 2 de 4) — la tabla de AJUSTES de la conciliacion y el CHECK tipo<->categoria de la caja
-- (design §3.2, R46, R47).
--
-- `conciliacion_bodega_ajuste`: cada evento que mueve la diferencia de una consolidacion (`marca` o
-- `correccion`). APPEND-ONLY: sin `updated_at` ni `deleted_at`, y el repositorio no expone ni `update` ni
-- `delete` sobre ella (lo vigila `aporte-satelite-fuente-unica-498.guardia.test.ts`). La FK a la
-- consolidacion es RESTRICT: una consolidacion con ajustes no se puede borrar. Como mucho UNA fila `marca`
-- por consolidacion (indice unico parcial): defensa en la base del «reintentar no duplica».
-- `evento` es TEXT con CHECK, no un enum: asi el `down` de M1 no tiene un tercer tipo que tocar.
-- Los ids son TEXT, como `cierre_bodega.id` y `usuario.id` (`db/schema.prisma`, comprobado en T2.2).
-- RLS habilitada SIN policies: patron del repo (solo el rol de servicio, como `wallet_movimiento`).

CREATE TABLE "conciliacion_bodega_ajuste" (
  "id"               TEXT          NOT NULL,
  "cierre_bodega_id" TEXT          NOT NULL,
  "evento"           TEXT          NOT NULL,
  "monto_esperado"   DECIMAL(12,2) NOT NULL,
  "monto_recibido"   DECIMAL(12,2) NOT NULL,
  "diferencia"       DECIMAL(12,2) NOT NULL,
  "creado_por"       TEXT          NOT NULL,
  "created_at"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conciliacion_bodega_ajuste_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "conciliacion_bodega_ajuste_evento_check"     CHECK ("evento" IN ('marca','correccion')),
  CONSTRAINT "conciliacion_bodega_ajuste_diferencia_check" CHECK ("diferencia" <> 0)
);

CREATE INDEX "conciliacion_bodega_ajuste_cierre_bodega_id_idx" ON "conciliacion_bodega_ajuste"("cierre_bodega_id");
CREATE UNIQUE INDEX "conciliacion_bodega_ajuste_marca_uq"
  ON "conciliacion_bodega_ajuste"("cierre_bodega_id") WHERE "evento" = 'marca';

ALTER TABLE "conciliacion_bodega_ajuste" ADD CONSTRAINT "conciliacion_bodega_ajuste_cierre_bodega_id_fkey"
  FOREIGN KEY ("cierre_bodega_id") REFERENCES "cierre_bodega"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conciliacion_bodega_ajuste" ADD CONSTRAINT "conciliacion_bodega_ajuste_creado_por_fkey"
  FOREIGN KEY ("creado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "conciliacion_bodega_ajuste" ENABLE ROW LEVEL SECURITY;

-- CHECK tipo<->categoria de la caja: la lista VIGENTE de la 488 (`20261023120100_iva_por_pagar_488_checks`),
-- LITERAL, con `ingreso_diferencia_satelite` al final de la rama `ingreso` y `egreso_diferencia_satelite`
-- al final de la rama `egreso`. Ninguna fila previa puede fallar: solo se añaden valores.
ALTER TABLE "wallet_movimiento" DROP CONSTRAINT "wallet_movimiento_tipo_categoria_check";
ALTER TABLE "wallet_movimiento" ADD CONSTRAINT "wallet_movimiento_tipo_categoria_check"
CHECK (
  ("tipo" = 'ingreso' AND "categoria" IN ('ingreso_flete','ingreso_flete_devolucion','ingreso_comision_cod',
     'ingreso_iva_flete','ingreso_iva_flete_devolucion','ingreso_iva_comision_cod','ingreso_ajuste',
     'ingreso_cod_recaudado','ingreso_reverso_pago_tienda',
     'ingreso_reverso_pago_por_cuenta_tienda','ingreso_aporte_capital',
     'ingreso_cobro_tienda',
     'ingreso_abono_tienda',
     'ingreso_reverso_pago_iva',
     'ingreso_diferencia_satelite'))
  OR
  ("tipo" = 'egreso' AND "categoria" IN ('egreso_pago_tienda','egreso_pago_mensajero','egreso_gasto',
     'egreso_sueldo','egreso_ajuste','egreso_gasto_fijo','egreso_gasto_variable','egreso_indemnizacion',
     'egreso_pago_por_cuenta_tienda','egreso_reverso_aporte_capital',
     'egreso_reverso_cobro_tienda',
     'egreso_reverso_abono_tienda',
     'egreso_reverso_flete_devolucion','egreso_reverso_iva_flete_devolucion',
     'egreso_pago_iva',
     'egreso_diferencia_satelite'))
);
