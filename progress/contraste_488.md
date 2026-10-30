# Ficha 488 — L.1: medición en producción antes de desplegar

2026-10-22, MCP `supabase` (proyecto `scfnwxqbsgkzwsdntdvd`, confirmado con `get_project_url` = producción),
transacción `read only`, tabla `wallet_movimiento`.

| Categoría | Movimientos | Total |
| --- | ---: | ---: |
| `ingreso_iva_comision_cod` | 358 | 337.058,03 |
| `ingreso_iva_flete` | 359 | 1.281.332,00 |
| `ingreso_iva_flete_devolucion` | 482 | 722.748,00 |
| `egreso_reverso_iva_flete_devolucion` | 0 | 0,00 |
| **IVA neto** | | **2.341.138,03** |

Al desplegar la 488:
- «Ganancia de Ordenex» y «De Ordenex» bajan exactamente **₡2.341.138,03**.
- «IVA cobrado a las tiendas» e «IVA por pagar» nacen en **₡2.341.138,03** (no hay ningún Pago de IVA todavía).
- La cifra principal, «Entró», «Salió», «De las tiendas» y el capital no cambian.

No se midió la ganancia total actual: su derivación cruza todas las categorías propias y no hace falta para
saber cuánto se mueve.
