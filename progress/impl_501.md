# Ficha 501 — Implementación

Rama `fix/501-pagos-registrados-fecha-cr`, desde `origin/dev` (be662423). El MCP `codebase-memory` no
conectó (timeout): la búsqueda se hizo con Grep y Read.

## Archivos

- `components/shared/liquidacion/PagosRegistradosTabla.tsx`: se retira el alias `dia`; `registradoAt` y
  `anuladoAt` pasan a `fechaDiaInstanteCR`, y `fechaPago` a `fechaDiaISO`.
- `components/shared/liquidacion/pagos-registrados-descarga-columnas.ts`: `registradoEl` y `anuladoEl`
  pasan a `fechaDiaInstanteCR`; `fechaPago` no cambia.
- `tests/components/PagosRegistradosTabla.test.tsx`, bloque «ficha 501».
- `tests/unit/descarga/pagos-registrados-descarga-columnas.test.ts`, bloque «ficha 501».
- `tests/unit/guards/cierres-fecha-cr-495.guardia.test.ts`, bloque «GUARDIA 501». `CARPETAS` y su test no
  cambian; `recortesEn` recibe las formas por parámetro, con `PROHIBIDAS` por defecto.

**Decisión sobre el alias `dia`:** se borra, no se reescribe. Cambiar su cuerpo a `fechaDiaInstanteCR`
desplazaría «Fecha del pago» un día hacia atrás. Cada sitio nombra su función y la guardia rechaza volver
a meter un alias que llame a `fechaDiaISO(iso)`.

## Mapa R → test

`T` = `tests/components/PagosRegistradosTabla.test.tsx`;
`D` = `tests/unit/descarga/pagos-registrados-descarga-columnas.test.ts`;
`G` = `tests/unit/guards/cierres-fecha-cr-495.guardia.test.ts`.

| Req | Archivo | Test |
|---|---|---|
| R1 | T | `R1: un registro de las 20:30 de Costa Rica se ve con SU día, no con el siguiente` |
| R2 | T | `R2: una anulación de las 20:30 de Costa Rica se ve con SU día, no con el siguiente` |
| R3 | D | `R3: un registro de las 20:30 de Costa Rica sale con SU día, no con el siguiente` |
| R4 | D | `R4: una anulación de las 20:30 de Costa Rica sale con SU día, no con el siguiente` |
| R5 | T, D | `R5: el instante %s se ve como %s, en registro y en anulación` y `R5: el instante %s sale como %s, en registro y en anulación`: `T00:00:00.000Z`, `T05:59:59.999Z`, `T06:00:00.000Z`, cambio de mes y de año |
| R6 | T, D | `R6: «Fecha del pago» es un día calendario y no recibe el desfase, ni en la frontera` |
| R7 | T | `R7: la pantalla y la descarga dicen el MISMO día de registro y de anulación` |
| R8 | D, T | `un comprobante VIGENTE sale marcado como tal y sin datos de anulación`; `un pago VIGENTE se marca como tal y no enseña datos de anulación`; `R8: un pago VIGENTE en la frontera sigue sin texto de anulación` |
| R9 | D, T | `R9: lo que no es un instante legible sale TAL CUAL, sin inventar fecha ni fallar`; `R9: lo que no es un instante legible se ve TAL CUAL, sin inventar fecha ni fallar` |
| R10 | G | `contraprueba: el detector encuentra las formas de antes de la ficha`; `contraprueba: lo que SÍ se puede escribir no salta, y un comentario no cuenta`; `la tabla y las columnas de descarga no cortan así ninguna fecha que no sea \`fechaPago\`` |

Añadido al spec: el caso R9 también en la tabla (sin él, la mutación `fechaCalendarioCR(new Date(...))` en
la tabla sobreviviría) y un R8 de tabla con el instante en la frontera.

## T1 y T2: rojo contra el código sin arreglar

70 tests, 14 rojos, 56 verdes. Los rojos dan el día siguiente como recibido:

```
R1  expected '2026-08-03' to be '2026-08-02'
R3  expected '2026-08-03' to be '2026-08-02'
R4  expected '2026-08-04' to be '2026-08-03'
R5  (T y D) 00:00:00.000Z y 05:59:59.999Z: expected '2026-08-03' to be '2026-08-02'
R5  (T y D) 2026-09-01T00:00Z: expected '2026-09-01' to be '2026-08-31'
R5  (T y D) 2027-01-01T05:00Z: expected '2027-01-01' to be '2026-12-31'
R7  expected '2026-08-03' to be '2026-08-02'
R2  Unable to find an element with the text: Anulado por Ana Maestra el 2026-08-03
```

Los casos `T06:00:00.000Z` de R5 ya pasaban: ahí coinciden los dos días, y su prueba son las mutaciones a
`fechaDiaMovimientoCR` y similares. R6 y R9 ya pasaban, como preveía la tarea.

La guardia, en rojo, nombró exactamente lo previsto:

```
+   "components/shared/liquidacion/PagosRegistradosTabla.tsx:65",
+   "components/shared/liquidacion/pagos-registrados-descarga-columnas.ts:71",
+   "components/shared/liquidacion/pagos-registrados-descarga-columnas.ts:74",
```

## T5: mutaciones

Base `total=70 fallidos=0`; cada mutación ejecutó 70 tests; final `total=70 fallidos=0`, **0 supervivientes**
de 18, árbol restaurado por el propio arnés y comprobado con `git diff`.

| Mutación | Rojos | Test que la tumba (entre otros) |
|---|---|---|
| tabla `registradoAt` → `fechaDiaISO` | 7 | R1, guardia |
| tabla `anuladoAt` → `fechaDiaISO` | 7 | R2, guardia |
| descarga `registradoEl` → `fechaDiaISO` | 7 | R3, guardia |
| descarga `anuladoEl` → `fechaDiaISO` | 7 | R4, guardia |
| tabla `fechaPago` → `fechaDiaInstanteCR` | 24 | R6 |
| descarga `fechaPago` → `fechaDiaInstanteCR` | 3 | R6 |
| tabla `registradoAt` → `fechaDiaMovimientoCR` | 3 | R5 `2026-08-03T00:00:00.000Z` |
| tabla `anuladoAt` → `fechaDiaMovimientoCR` | 3 | R5 `2026-08-03T00:00:00.000Z` |
| descarga `registradoEl` → `fechaDiaMovimientoCR` | 3 | R5 `2026-08-03T00:00:00.000Z` |
| descarga `anuladoEl` → `fechaDiaMovimientoCR` | 3 | R5 `2026-08-03T00:00:00.000Z` |
| tabla `registradoAt` → `fechaCalendarioCR(new Date(...))` | 1 | R9 |
| tabla `anuladoAt` → `fechaCalendarioCR(new Date(...))` | 1 | R9 |
| descarga `registradoEl` → `fechaCalendarioCR(new Date(...))` | 1 | R9 |
| descarga `anuladoEl` → `fechaCalendarioCR(new Date(...))` | 1 | R9 |
| descarga sin `anulacion ?`, con `anulacion!` | 14 | `un comprobante VIGENTE sale marcado como tal y sin datos de anulación` |
| descarga sin `anulacion ?`, con `anulacion?.anuladoAt ?? ""` | 1 | `un comprobante VIGENTE sale marcado como tal y sin datos de anulación` |
| tabla: alias `dia` sobre `fechaDiaISO`, solo para `fechaPago` | 1 | guardia: `la tabla y las columnas de descarga no cortan así…` |
| tabla: `p.registradoAt.slice(0, 10)` | 7 | R1, guardia |

Límite conocido del detector: como pide D4, mira llamadas por línea. Un alias por referencia
(`const dia = fechaDiaISO;`) no lo dispara; las pruebas de comportamiento siguen cayendo si se usa sobre un
instante.

## T6: verificación

| Comando | Resultado |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | 0 errores, 235 avisos, ninguno en los cinco archivos tocados (`eslint` sobre ellos, exit 0) |
| `pnpm exec vitest related --run` sobre los dos componentes | 39 archivos, 654 tests, todos verdes |
| Guardias a mano: `cierres-fecha-cr-495.guardia`, `wallet-fecha-cr-459.guardia`, `liquidacion-money-safe`, `liquidacion-alcance`, `columnas-sensibles.guardia`, `columnas-asercion-de-orden.guardia` | 6 archivos, 27 tests, todos verdes |

**Gate del leader (T6), sobre 3291f771:** `./init.sh --rapido` dio `INIT_EXIT=1` con 4 archivos en rojo, ninguno de esta ficha. Se repitieron aislados, sin repetir el gate (CLAUDE.md, regla 5):

| Archivo | Aislado | Causa |
| --- | --- | --- |
| `marca-fuente-unica-493.guardia` | verde | intermitente |
| `ranking-snapshot-migration` | verde | intermitente |
| `498-satelite-migraciones` | rojo y luego verde (7/7) | datos del T9 de la 502 en la base compartida: 4 filas donde esperaba 1 |
| `iva-488-migration` | rojo y luego verde (8/8) | rojo a la vez que esos datos; verde al limpiarlos |

No se abrió el PR hasta tener los cuatro en verde. Las guardias a mano y `vitest related` están arriba.

## T7: ver la app

Hecho el 2026-11-04 con `admin.qa@ordenex.test`, tras rotar el leader las cuentas QA locales. Primer intento
fallido por contraseña rotada; segundo, con login correcto. Base `localhost`, dev server `next dev --webpack`
en el 3501. El aviso «Confirmá el SINPE de GAM» se aplazó con «Ahora no», que no llama a ninguna acción.

**Datos:** con autorización del leader se movieron y restauraron los `created_at` de dos pagos ya anulados
del cierre `942993c5-9c11-4153-a207-9af086b22fc3`, sin crear filas.

| Pago | Pago, original | Anulación, original | Pago, en la prueba | Anulación, en la prueba |
|---|---|---|---|---|
| `6a657651-e3cb-45c4-a420-1030ad5a6e74` | `2026-08-13 15:05:20.245` | `2026-08-13 16:06:23.82` | `2026-08-16 00:00:00` | `2026-08-17 05:59:59.999` |
| `e3b52741-7365-4ad8-a8fd-127fa594fe10` | `2026-08-13 20:23:43.478` | `2026-08-13 20:24:51.867` | `2026-08-18 06:00:00` | `2026-08-19 00:00:00` |

**`/cierres-admin`, esperado contra obtenido.** El esperado se calculó a mano restando 6 h al `created_at` crudo.

| `created_at` en la prueba (UTC) | Campo | Esperado | Pantalla | xlsx |
|---|---|---|---|---|
| `2026-08-16 00:00:00` | Registrado el | `2026-08-15` | `2026-08-15` | `2026-08-15` |
| `2026-08-17 05:59:59.999` | Anulado el | `2026-08-16` | `2026-08-16` | `2026-08-16` |
| `2026-08-18 06:00:00` | Registrado el | `2026-08-18` | `2026-08-18` | `2026-08-18` |
| `2026-08-19 00:00:00` | Anulado el | `2026-08-18` | `2026-08-18` | `2026-08-18` |
| `fecha_pago` `2026-08-13`, las dos filas | Fecha del pago | `2026-08-13` | `2026-08-13` | `2026-08-13` |

`innerText` de las celdas:

```
["2026-08-13","₡3.400","Efectivo","—","—","Ana","2026-08-18","Anulado\nAnulado por Ana el 2026-08-18\nMotivo: Reparto mal imputado: se corrige entero.",""]
["2026-08-13","₡1.400","Efectivo","—","—","Ana","2026-08-15","Anulado\nAnulado por Ana el 2026-08-16\nMotivo: Verificacion de la ficha 210: la insignia de anulado cambia de variante.",""]
```

Celdas del archivo `pagos-registrados-de-marco-mensajero-2026-11-04.xlsx`:

```
["Fecha del pago","Monto","Método","Referencia","Nota","Registró","Registrado el","Estado","Anulado por","Anulado el","Motivo de la anulación"]
["2026-08-13","3400.00","Efectivo",null,null,"Ana","2026-08-18","Anulado","Ana","2026-08-18","Reparto mal imputado: se corrige entero."]
["2026-08-13","1400.00","Efectivo",null,null,"Ana","2026-08-15","Anulado","Ana","2026-08-16","Verificacion de la ficha 210: la insignia de anulado cambia de variante."]
```

**Cobertura.** La frontera de las 18:00 CR (`T00:00:00.000Z`) se vio en tabla y descarga, tanto en registro
como en anulación. `T05:59:59.999Z` se vio solo en anulación y `T06:00:00.000Z` solo en registro; las
combinaciones restantes quedan cubiertas por los tests de R5.

**No se vio:**

- `/wallet/tiendas`: la base local no tiene ningún pago de tienda, y no se crearon filas. Monta la misma
  `PagosRegistradosTabla`, pero en esa pantalla no hay observación directa.
- Un pago VIGENTE en la frontera (R8): los tres pagos locales están anulados. R8 queda cubierto solo por tests.
- Un valor no legible (R9): solo por tests.

**Restauración comprobada con una consulta aparte**, ya terminada la prueba: los dos pagos volvieron a los
valores originales de la tabla, el tercero (`b63ca15a-56fe-49aa-8741-399f391db8fa`) no se tocó y los totales
siguen en 3 pagos y 3 anulaciones. Durante la prueba, otro agente que usara la misma base habría podido leer
las fechas movidas de esas dos filas.

Dos cosas para quien lo repita:

- **Turbopack cae en un worktree con junction:** `Symlink [project]/node_modules is invalid`. Hay que usar
  `next dev --webpack`. Con webpack, el primer login tarda: esperar con `waitForURL`, no con un tiempo fijo.
- **El dev server escribe la contraseña del login en claro en su log**, porque registra los argumentos de
  las Server Actions. Los logs de estas sesiones se borraron sin commitear.
