# Ficha 488 — Ganancia de la caja sin IVA · implementación

Rama `feat/488-ganancia-caja-sin-iva` (base 4f87ca86). SDD, spec aprobado por el humano el 2026-10-22 con los
supuestos P1–P6 tal cual. Detalle de cada fase en `progress/dev_488_backend.md` y `progress/dev_488_frontend.md`;
revisión en `progress/review_488.md`.

## Qué se hizo

- El IVA (flete, flete por devolución a origen, comisión COD) pasa de dueño «propio» a dueño `iva`: sale de la
  ganancia, de «De Ordenex» y de la composición de la ganancia.
- `derivarCaja` gana `ivaCobrado` e `ivaPorPagar` (seis `derivarBalance`, sin restas propias); el DTO gana
  `ivaCobrado`, `ivaPorPagar`, `signoIvaPorPagar` y `porcentajeIva`.
- Migración: enums `egreso_pago_iva` e `ingreso_reverso_pago_iva` + CHECKs, con `down.sql` dinámico (no borra
  valores posteriores). Ningún `down.sql` previo tocado.
- Pago de IVA desde «Registrar movimiento» («A quién» obligatorio); su anulación escribe
  `ingreso_reverso_pago_iva` y no toca la ganancia.
- Pantalla: KPI de ganancia sin IVA con «IVA cobrado a las tiendas» debajo; tercer bolsillo «IVA por pagar»;
  porción de IVA en la barra; dueño «IVA por pagar» en el libro y la descarga; línea en «Así queda» y
  «Cómo quedó»; ayuda actualizada.
- Analítica: solo el catálogo de métricas (ganancia 18 → 14 categorías).

## Desviación del design (anotada en §2.2)

`ivaCobrado = derivarBalance(cargosIva, reversosIvaCobrado)` en vez de `ingresosIva`: la fórmula original contaba
la anulación de un Pago de IVA como IVA cobrado (contra R5).

## Trazabilidad R → test

La tabla completa R1–R38 está al final de `specs/488-ganancia-caja-sin-iva/tasks.md`; el revisor comprobó que
cada R tiene un test que lo ejerce. Tests nuevos principales:

- `tests/integration/db/caja-iva-488.test.ts` (Postgres: ganancia, bolsillos, R7, pago y anulación).
- `tests/integration/db/iva-488-migration.test.ts` (CHECK, enums, down real).
- `tests/integration/db/wallet-comprobante-esta-anulado-488.test.ts` (m2).
- `tests/components/CajaResumenCard488`, `BarraComposicionCaja488`, `WalletLedgerIva488`.
- `tests/unit/docs/ayuda-wallet-caja-488.test.ts`.

## Verificación

- Gate `--rapido` (ampliado con integration/db): INIT_EXIT=0 tras el frontend; rojos de integración ajenos a la
  caja, verdes aislados.
- Mutaciones: 7 del backend, 5 del revisor y 2 de m2/m3; todas rojas.
- App vista (F.8, base local): barra en «saldo», Pago de IVA de ₡1.000 y su anulación, libro, «Cómo quedó» y
  Excel; ganancia e IVA cobrado sin cambio, IVA por pagar −1.000 y vuelta, R7 al céntimo.

## Abierto

- L.1: medir en producción (solo lectura) el IVA neto antes de desplegar.
- Con datos reales la porción de IVA de la barra puede quedar por debajo de 1 px (0,03 % en local); el spec no
  fija ancho mínimo.
- Base local: saldo inicial ₡1.000.000 (2026-08-11), un Pago de IVA anulado y las cuentas QA re-sembradas con
  `QA_PASSWORD` del `.env`.
