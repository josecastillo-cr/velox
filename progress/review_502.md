# Ficha 502 — Revisión

Rama `fix/502-conciliacion-satelite-menores-500`, HEAD revisado `81a0dab1`, diff `origin/dev...HEAD`. Decisiones del humano:
Q1 = salida A, Q2 = no ampliar.

Búsqueda: `codebase-memory` no conectó en esta sesión (timeout). Se usó Grep/Read sobre los archivos reales.

## Veredicto: **OK**

Sin bloqueantes. Hay 5 menores; ninguno pide cambiar código de producción. Antes de `done` falta el cierre administrativo del
leader (m1).

## Checklist

| # | Punto | Resultado |
| --- | --- | --- |
| 1 | requirements, design (§4, seis alternativas descartadas) y tasks existen | OK |
| 2 | Cada R tiene test y el test muere al romper el comportamiento | OK, medido abajo |
| 3 | Tasks marcadas | Todas salvo T10.2 (m1) |
| 4 | Mapa R a test en `progress/impl_502.md` | OK, líneas 139-157, contrastado con los archivos |
| 5 | typecheck, lint y tests | OK por el gate del leader: `progress/gate_502.log`, `INIT_EXIT=0`. No se repitió, por orden |
| 6 | Los tests de dinero se ejecutaron, no saltaron | OK: en el log, 14 de `502-corregir-de-mas` y 8 de `zona-distrito-rastro-500`; en esta revisión, 0 saltados |
| 7 | E2E de flujo crítico | No aplica: el repo no tiene harness (decisión del humano). Cubierto con Postgres real, componentes y T9 |
| 8 | RLS, migraciones, webhooks | No aplica: sin tablas, migraciones ni webhooks |
| 9 | Secretos | OK: ninguno en el diff (búsqueda por patrones) |
| 10 | Capas | OK: el código de producción tocado es de pantalla y ayuda |
| 11 | Multi-país | OK: nada de moneda a mano; el monto sale por `money` |
| 12 | `lib/`, `db/` y `app/api` sin cambios | OK: `git diff --stat origin/dev...HEAD -- lib db app/api` vacío. Actions, servicio y repositorios intactos |
| 13 | «SLA» en el diff | OK: ninguna |
| 14 | Entrada en `progress/history.md` | Pendiente (m1) |

## Lo medido

Línea base de esta revisión: 12 archivos, 211 tests, 211 verdes, 0 saltados, contra Postgres local. Son los 8 archivos de la
bitácora más `zona-distrito-rastro-500`, `502-corregir-de-mas` y las guardias `cierre-bodega-vocabulario` y
`wallet-barra-unica-467`, que el grafo puede no relacionar.

El worktree no tiene `.env`, así que sin `DATABASE_URL` los archivos de Postgres se habrían SALTADO. La URL se cargó en el
proceso, sin imprimirla, y el arnés abortaba si el host no era local.

Mutaciones: 24, temporales y aplicadas una a una con ancla única. Cada archivo volvió byte a byte, `git status` final limpio y
0 filas `zona_distrito_cambiado` residuales en la base.

| Mutación | R | Resultado | Rojo |
| --- | --- | --- | --- |
| `appendAccion(tx` a `this.prisma`, `ZonaRepository.ts:775` | R4, R5 | Muere | Solo «502/R4/R5», `expected 2 to be +0`; los otros 7 verdes |
| La nota vuelve al diálogo | R1 | Muere | `Conciliacion498` y `wallet-satelites` |
| `esCorreccion` vieja | R7 | Muere | 8 rojos, incluidos los dos de pantalla |
| Sin `estado === "recibido"` | R8 | Muere | Los dos casos de R8 |
| «Corregir» en toda conciliada | R6 | Muere | `ConciliacionAcciones500` sin tocar y los cuatro de R6 |
| `LLEGO_DE_MAS` sin excluir el cero | R6 | Muere | `-0.00` y `-0` dan botón |
| Botón nuevo, envío viejo | R9 | Muere | Corregir 0 veces |
| Aviso viejo | R10 | Muere | «Monto recibido corregido a ₡800.» no sale |
| No parte del monto; no parte de la nota | R10 | Mueren | Título, campo y nota |
| `/wallet/satelites` no pasa la falta | R7 | Muere | Solo el caso de esa pantalla |
| `/cierres-admin` no pasa la falta | R7 | Muere | Solo el caso de esa pantalla |
| El diálogo no dice el importe | R2 | Muere | `wallet-satelites` |
| Sin nota al pie; texto de la constante cambiado; ayuda sin nota | R3 | Mueren | Los literales a mano |
| La ayuda no dice «de más» | R13 | Muere | Su punto |
| Sin la regla del cero | R12 | Muere | La fila rechazada y su caso |
| Corregir no actualiza el monto | R12 | Muere | Las 6 filas y el caso real: la falta queda vieja |
| Historial sin monto anterior | R11 | Muere | `expected [] to deeply equal` |
| Sin restar lo ya asentado | R11 | Muere | 7 rojos |
| Cambia una fila de un libro | R11 | Muere | «no vuelve a asentar…», 26 filas comparadas |
| Cambia el ajuste de la marca | R11 | Muere | 8 rojos |
| Volver a llamar `asentarCierreDia` | R11 | Sobrevive | Mutante equivalente, ver m4 |

**Literal de la nota.** `NOTA_R43` sigue escrito a mano en `Conciliacion498.test.tsx:47-48`, y el texto también en
`wallet-satelites.test.tsx:461`, `aporte-satelite-fuente-unica-498.guardia.test.ts:83` y
`ayuda-wallet-satelites-498.test.ts:32`. Ninguno compara contra la constante importada: cambiarla puso rojos los tres que leen
el código. En lo nuevo no hay aserciones contra su propia fuente: los esperados de R10, R11 y R12 son literales.

**R7/R8, la condición.** `ConciliacionAcciones.tsx:145-146` es la única fuente del botón (:225), del envío (:150) y del aviso
(:158). Una sin marcar es `pendiente` y no entra; una exacta da falso en `llegoDeMas`, también con `-0.00`. La restricción
`cierre_bodega_conciliacion_coherente` garantiza que toda conciliada tiene monto, así que el diálogo siempre recibe
`montoActual` y no puede salir un «Corregir» con título de marcar.

**R11/R12, filas reales.** El test no pasa por falta de datos: exige las 7 filas, cada una partiendo de falta negativa en el
lector real de la pantalla, y los tres libros con filas. Solo cubre el repositorio; por encima, `corregirRecibida` solo filtra
por rol, y T9 recorrió la action real.

## El −₡50 que no se vio en `/cierres-admin`

**No es un problema.** Por tres razones:

1. El botón es la prueba. «Corregir» sobre la marcada por 750 solo sale si la pantalla recibió una falta negativa del lector
   real, y desapareció al corregir a 700: en T9 el dato viajó bien, aunque el número no se mirara.
2. Quien corrige ve los dos números en el diálogo: la banda «Debe» y el monto marcado en el campo
   (`MarcarRecibidoDialog.tsx:263-273`).
3. Ningún R pide enseñar la falta, y `faltaPorRecibir` es la misma función en los dos lectores.

Además, la afirmación de la bitácora es inexacta: ver m2.

## Hallazgos

Ningún `BLOQUEANTE`.

- **menor m1 — Cierre pendiente del leader.** `specs/502-menores-conciliacion-satelite/tasks.md:84` sigue sin marcar y falta la
  entrada en `progress/history.md`. CHECKPOINTS los exige para `done`. T10.2 se cumple en sustancia (`gate_502.log`:
  `INIT_EXIT=0`, T1 y T3 ejecutados); falta marcarla y anotar los 3 intermitentes. El log no registra el SHA: que corresponde a
  este HEAD se toma de la palabra del leader.
- **menor m2 — Bitácora inexacta.** `progress/impl_502.md:205-207` dice que `/cierres-admin` no enseña la falta. Vale para la
  tarjeta cerrada y el modal «Ver», pero el desplegable «Ver detalles» sí la pinta (`cierre-factura.tsx:645-650`, con los datos
  de :1133-1136). Leído en el código, sin verlo en pantalla: las capturas de T9 que miré no abren ese desplegable.
- **menor m3 — Deuda Q2, conocida.** `wallet-satelites.md:129-130` dice que una saldada «se arregla con Corregir», y una saldada
  tiene falta 0.00 y no ofrece el botón. La frase nueva de :119 deja la contradicción a once líneas. También quedan cortas :114
  y la nota del pie sobre una exacta. No es nuevo: Q2 lo aceptó. Conviene darle ficha.
- **menor m4 — «No vuelve a asentar» se mide por su efecto.** La mutación que llama de nuevo a `asentarCierreDia` sobrevive
  porque esa función es idempotente y no escribe nada: el estado resulta idéntico. Lo que R11 protege, que los libros no
  cambien, sí muerde. No pide cambios.
- **menor m5 — Texto de la bitácora.** `impl_502.md:176`, :211 y :220 citan el usuario QA de dominio `.test`, un nombre de bodega
  de la base local y actores QA. Sin credenciales, y el usuario QA ya está en muchos `progress/` de `dev`. Sin acción; se anota
  porque el repo es público.

## Lo que esta revisión no comprobó

- No se levantó la app, por orden. De T9 se miraron 4 de las 7 capturas (`t9_m5_cierres_detalle`, `t9_m5_cierres_tarjetas`,
  `t9_m5_wallet_de_mas`, `t9_m4_cierres_desmarcar`), y coinciden con la bitácora.
- No se corrió `./init.sh`, ni typecheck ni lint por separado.
- El build de Vercel: sin PR que mirar todavía. Hay que verlo antes de mergear.
