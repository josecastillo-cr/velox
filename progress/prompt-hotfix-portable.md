# Portar cinco hotfix de producción a este repositorio

## Qué es esto

Otro repositorio con el mismo sistema (el **repo de origen**) tiene en producción cinco arreglos
que este repo no tiene. Hay que reproducir aquí el **comportamiento** de esos arreglos. No se copia
el código. Son cinco arreglos independientes, H1 a H5. Las rutas y los nombres del repo de origen
solo sirven de pista: aquí pueden ser otros.

Orden recomendado:

1. **H1.** La recolección recibida en la bodega central libera al mensajero. Es independiente.
2. **H2.** La confirmación física también para las órdenes sin gestionar del cierre. Es independiente.
3. **H3.** El dinero de la bodega satélite entra a la caja de la central solo al conciliar. Va
   después de H2, porque los dos tocan la transacción que aprueba un cierre del día.
4. **H4.** Un distrito no puede quedar en dos zonas. Es independiente.
5. **H5.** La deuda de H3 y H4. **Depende de H3 y de H4.**

## Reglas generales (valen para los cinco)

- **Un arreglo, una rama, un PR.** La rama nace de la rama que va a producción. H5 puede ir en un
  solo PR o partirse por bloques.
- **Antes de tocar nada, demuestra que el bug existe aquí.**
  - Localiza el código por **comportamiento** (qué transición, qué consulta, qué pantalla), no por
    ruta.
  - Escribe primero el test de regresión y míralo **en rojo** contra el código actual.
  - Si aquí el bug no existe, o existe de otra forma, **para**. Informa al humano con la evidencia y
    no inventes el arreglo.
- **Cada test de regresión se valida con una contraprueba.**
  1. Aplica el arreglo y ve el test en verde.
  2. Muta el arreglo: quita la condición, revierte el `WHERE`, borra la columna del `data`.
  3. Ve el test en **rojo**.
  4. Restaura y confirma que el diff de la mutación queda vacío.

  Un test que no se pone rojo con la mutación no prueba nada. Se exige, sobre todo, cuando el
  criterio vive en SQL: los tests de servicio con dobles no ven el `WHERE`.
- **Nunca edites una migración ya aplicada.** Todo cambio de esquema o de datos va en una migración
  nueva, con fecha posterior a la última del repo y con su `down.sql`. El `down.sql` de una
  migración que aún no se aplicó en ningún entorno sí se puede corregir.
- **El dinero va en decimal** (`DECIMAL(12,2)` o el tipo decimal del ORM), nunca en float. Las
  restas las hace el servidor; la pantalla no calcula dinero.
- **No imprimas secretos.** No leas ni muestres `.env`, URLs de base de datos ni tokens. Para
  comprobar una variable, informa solo si existe (sí o no).
- **Producción solo se lee.** Las consultas a producción son de solo lectura y las corre o autoriza
  el humano. Al repo no va ningún dato de producción: ni ids, ni nombres, ni conteos.
- **Migraciones de datos: puerta obligatoria.**
  1. Mide en producción, en solo lectura, cuántas filas toca el criterio y con qué forma.
  2. **Para** y presenta al humano los conteos y el mapeo propuesto.
  3. Migra solo con su confirmación escrita.

  Los números del repo de origen **no aplican aquí**: no los tomes como esperados.
- **Multiempresa.** Toda lectura y escritura nueva queda acotada a la empresa activa. Toda tabla
  nueva lleva `organizacion_id` (o su equivalente aquí) y la política de RLS por empresa, si el
  repo la usa.
- **Decisiones cerradas.** Lo que abajo se marca como «Reglas de negocio decididas» lo decidió el
  humano en el repo de origen. **No lo reinventes ni lo reabras.** Si aquí no encaja con el modelo
  de datos, para y pregunta.

---

## H1 — La recolección recibida en la bodega central sigue a nombre del mensajero

**Síntoma.** El mensajero recoge un paquete en la tienda y la bodega central lo recibe. La orden
sigue asignada a ese mensajero. Esto tiene dos efectos:

- el filtro «Reasignables» del listado de órdenes no la muestra;
- el tablero de Monitoreo la sigue contando en la tarjeta del mensajero, en «Asignados» u «Otros
  estados».

**Causa raíz.** La recolección en tienda deja al recolector asignado y lleva la orden a «en ruta a
la bodega central». La recepción central (`en_ruta_bodega_central → en_bodega_central`) cambiaba
solo el estado y **no limpiaba la asignación**. El patrón culpable es un `UPDATE … SET estatus = X
WHERE estado = origen` sin tocar `mensajero_asignado_id`.

«Reasignables» se define como «en bodega central **y** sin mensajero», así que esas órdenes
quedaban fuera. En el repo de origen estaba en:

- `RecepcionBodegaCentralService` (tabla de transiciones);
- `OrdenRepository.recibirEnBodegaCentral`;
- `GestionOrdenRepository.findMisAsignacionesByIds`.

La bodega satélite no tenía el defecto, porque el ruteo a satélite ya limpia la asignación.
Compruébalo aquí también.

**Reglas de negocio decididas.**

- Arreglo mínimo de lo evidenciado: la recolección recibida en central aparece en «Reasignables» y
  no cuenta en el Monitoreo del mensajero.
- La recepción de **devoluciones** en la central (`devolviendo_a_bodega_central →
  por_devolver_a_tienda`) **conserva** la asignación.
- Las órdenes que ya están así **se corrigen con una migración de datos** que tiene `down.sql`. No
  se deja como deuda.

**Arreglo por capas.**

- **Repositorio.**
  - La recepción central recibe un parámetro obligatorio, sin valor por defecto, que indica si
    libera la asignación (`liberaAsignacion`).
  - Cuando libera, el **mismo** `UPDATE` atómico que cambia el estado pone a NULL el mensajero,
    `asignado_at` y `fecha_reparto` (o el trío equivalente aquí, que siempre se escribe y se limpia
    junto).
  - Si la recepción no transiciona (perdió la carrera, ya estaba recibida, el estado no es un
    origen válido, la orden está borrada), no se toca nada.
  - No se escribe una fila de historial extra y `num_guia` no cambia.
- **Service.** En la tabla de transiciones de la recepción central:
  - `en_ruta_bodega_central` lleva `liberaAsignacion: true`;
  - la devolución lleva `false`.
- **Lectura «Recolectadas hoy» del mensajero.** Antes filtraba por `mensajero_asignado_id = yo`.
  Ahora devuelve la orden si cumple una de estas dos condiciones:
  - está asignada a mí;
  - **no tiene mensajero** y tiene en su historial una `recoleccion_tienda` cuyo actor soy yo.

  En cuanto la central se la asigna a otro, desaparece de mi lista.
- No se crean ni modifican gestiones, pagos al mensajero, movimientos de wallet ni cierres.

**Migración de datos (con la puerta obligatoria).**

- **Criterio.** Orden no borrada, en `en_bodega_central`, con mensajero, cuya **última** fila de
  historial (desempate por `created_at` y después por `id`) sea `recepcion_bodega_central` con
  origen `en_ruta_bodega_central`.
  - La migración pone a NULL el trío de asignación y no escribe historial.
  - Si después de la recepción hay otra fila de historial, la orden no se toca: esa asignación es
    una decisión posterior.
- **`down.sql`.** Repone el mensajero desde el actor de la **última** `recoleccion_tienda` de cada
  orden que siga en ese estado y sin mensajero. No repone `asignado_at` ni `fecha_reparto`, porque
  la recolección no los estampa. Verifica que aquí tampoco los estampe.
- **Medición previa en producción.** Cuenta las órdenes que cumplen el criterio, agrupadas por
  mensajero y sin nombres. **Para** y pide la confirmación del humano.

**Tests (requisitos principales).** Son de integración contra Postgres real.

- Recibir una recolección deja el trío en NULL.
- Una recepción que no transiciona no toca la asignación.
- La recepción de una devolución conserva el mensajero.
- El historial tiene exactamente una fila de recepción y `num_guia` queda intacto.
- Tras recibir la recolección, el listado con «Reasignables» la trae. Hermana: una orden en central
  con mensajero puesto a mano no sale.
- El conteo de Monitoreo por mensajero ya no la cuenta. Hermana: una orden aún en
  `en_ruta_bodega_central` sigue contando para su mensajero.
- «Recolectadas hoy» sigue trayendo la recibida. No trae la recolectada por otro ni la mía si ya
  está asignada a otro.
- Recibir no crea filas de gestión, de wallet ni de cierre (conteos antes y después).
- Migración: libera la orden objetivo y no toca a sus hermanas (fila de historial posterior,
  devolución, borrada, sin recolección). El `down` repone al mensajero.

**Después del deploy.** Lanza en producción la consulta de verificación global (al final) y confirma
que devuelve 0.

---

## H2 — La confirmación física también exige las órdenes sin gestionar del cierre

**Prerrequisito.** Este arreglo **extiende** un mecanismo que ya debe existir: la confirmación
física al aprobar el cierre del día de un mensajero. Funciona así:

- bodega escanea, guía a guía, los paquetes de las gestiones cuyo resultado vuelve a bodega;
- el botón «Aprobar» queda deshabilitado hasta cubrirlos todos;
- el servidor valida la cobertura.

**Si aquí no existe ese mecanismo, para y pregunta**: portarlo sería una feature entera, no este
hotfix.

**Síntoma.** Se aprobó un cierre con muchas órdenes sin gestionar sin escanear ninguna. El sistema
las dio por recibidas en bodega sin prueba.

**Causa raíz.** Cuando un cierre vence, el corte diario barre las órdenes que el mensajero no
trabajó: pasan a `novedad_interna` (antes llamado «sin gestionar») y se registran, con sus datos
congelados, en una tabla por cierre (`cierre_sin_gestion`). Al aprobar, la liberación las manda a
bodega o a rechazo dentro de la transacción. La lista que hay que escanear se construía **solo
desde las gestiones** (resultado ∈ «vuelve a bodega»). Una barrida no tiene gestión ni resultado,
así que no entraba ni en la pantalla ni en la validación del servidor.

En el repo de origen estaba en:

- `lib/types/gestion-retorno.ts`: el punto único de «qué vuelve a bodega»;
- `CierresAdminService.validarConfirmacionFisica`;
- `CierresAdminRepository.resolverCierre`;
- la ventana de confirmación de `/cierres-admin`.

**Reglas de negocio decididas.**

- Los paquetes sin gestionar se escanean igual que los reprogramados, devueltos y rechazados.
- **Mientras falte uno, el cierre no se aprueba.**
- **Sin salida de emergencia**: no hay «marcar como faltante», ni aprobación parcial, ni omisión
  del cómputo. Si un paquete no llegó, la salida es rechazar el cierre con motivo.
- Se persiste una marca por barrida confirmada: columna nueva `confirmada_fisica_at`, nullable, sin
  default y **sin backfill**. NULL significa «aprobado antes del arreglo» o «sin confirmar».
- La guía contra la que se compara es la **congelada** en el registro de la barrida, no la viva de
  la orden.
- El rótulo visible de la sección es el nombre **vigente** del estado («Novedad interna»), no
  «sin gestionar» si ese nombre está retirado del producto.

**Arreglo por capas.**

- **DB.** Migración aditiva: `ALTER TABLE <tabla de barridas> ADD COLUMN confirmada_fisica_at
  TIMESTAMP(3)`. El `down.sql` hace `DROP COLUMN IF EXISTS`. Usa el **mismo nombre** que la columna
  de confirmación de las gestiones, si existe.
- **Punto único.** Añade un segundo eje, el **origen del paquete** (`gestion` | `barrida`), con una
  declaración exhaustiva:
  - `barrida` vuelve siempre;
  - `gestion` vuelve según su resultado, que delega en la tabla de resultados existente.

  Un origen nuevo no debe compilar hasta que alguien decida si vuelve.
- **Repositorio.**
  - Lectura de las barridas del cierre: `ordenId` y la guía congelada, dentro del alcance del actor.
    Se lee del **registro persistido**, no del estado actual de las órdenes.
  - En la transacción de aprobación: `UPDATE … SET confirmada_fisica_at = now()` sobre exactamente
    las barridas confirmadas.
  - Si el número de filas afectadas no es igual al de barridas, se lanza un error y se revierte
    **toda** la aprobación.
- **Service.** La validación de cobertura se hace **antes** de abrir la transacción, contra el
  conjunto esperado (gestiones que vuelven **más** todas las barridas):
  - cobertura exacta;
  - error **por fila** si falta una, sobra una, se repite una, la guía no coincide o la barrida no
    tiene guía;
  - una entrada que dice ser de un origen y apunta a una clave del otro se trata como ajena;
  - sin barridas en la petición, se trata como una lista vacía.

  Un cierre sin gestiones que vuelvan y sin barridas se aprueba igual que antes, con el mismo
  payload. Mismo criterio para cualquier actor con permiso de aprobar, incluido el administrador de
  la satélite. El rechazo y la reapertura de un cierre no escriben marcas.
- **UI.**
  - Las barridas van en la **misma** lista y con el mismo peso visual que las gestiones, en su
    propia sección rotulada.
  - Comparten **un solo** contador de progreso y de faltantes.
  - Escanear la guía de una barrida la confirma. Una guía que no es ni de gestión ni de barrida del
    cierre avisa «no es de este cierre».
  - Si alguna fila no tiene guía, se avisa **antes** de la lista, diciendo cuántas son y que el
    cierre no se podrá aprobar.
  - Los errores del servidor se pintan en su fila y la ventana sigue abierta.
  - Cerrar la ventana no envía ni persiste nada.

**Migración de datos.** No hay. La columna nace vacía a propósito.

**Puerta antes del deploy (solo lectura).** El arreglo endurece la aprobación de los cierres que ya
están en cola. Mide:

- cuántos cierres hay en estado solicitado, vencido o rechazado;
- cuántas barridas arrastran;
- cuántas de ellas tienen la guía en NULL (esas harían inaprobable su cierre).

Presenta los números al humano y **para**: él decide si avisa a bodega o drena la cola antes.

**Tests.**

- Unitarios del servicio: falta una barrida, sobra una, duplicada, guía distinta, barrida sin guía,
  cierre sin nada que exigir (payload idéntico al de antes), origen cruzado.
- Integración con SQL real:
  - la marca se escribe en la misma transacción;
  - un desajuste revierte toda la aprobación sin efectos parciales;
  - ningún monto ni movimiento de dinero cambia;
  - la migración sube y baja.
- Componente: sección propia, contador único, botón bloqueado sin puerta de escape, aviso de las
  filas sin guía.
- Los tests que fijan el orden de llamadas dentro de la transacción de aprobación siguen verdes
  **sin modificarse**.

---

## H3 — El dinero de la bodega satélite entra a la caja de la central solo al conciliar

**Prerrequisitos.** Este arreglo necesita que existan:

- cierres del día con destino `bodega_satelite`;
- la consolidación de la satélite (un cierre de bodega que agrupa cierres del día) con marca de
  «recibido» (conciliar), «corregir» y «revertir»;
- la caja de la central con su libro, el libro por tienda y el libro del pago al mensajero.

Antes de empezar, inventaría cuáles de estas piezas existen aquí. Si falta alguna, **para y
pregunta**.

**Síntoma.**

- Al aprobar un cierre del día de una satélite, la caja de la central ya registra su COD, el flete,
  el IVA, la comisión y el egreso del pago al mensajero, aunque el dinero no ha llegado.
- La pantalla de saldos de satélites la muestra **al día**.

**Causa raíz.**

1. La transacción de aprobación del cierre del día escribía los asientos de dinero (caja, libro por
   tienda, libro del mensajero, COD a caja, egreso de indemnización) **sin mirar el destino** del
   cierre.
2. El pendiente de la satélite se calculaba como Σ(`total_efectivo` − `monto_recibido`) sobre las
   **consolidaciones**. Por eso no contaba los cierres aprobados sin consolidar ni el SINPE o la
   transferencia.

En el repo de origen estaba en:

- `CierresAdminRepository.resolverCierre` (bloque de los cinco escritores de dinero);
- `SaldosSatelitesRepository`;
- `lib/utils/conciliacion-satelite.ts` (`saldoDe`);
- `CierresBodegaAdminRepository.marcarConciliado`, `corregirConciliacion` y
  `revertirConciliacion`;
- `EstadoCuentaRepository` (estado de cuenta de la bodega).

**Reglas de negocio decididas (literal).**

- **Todo** lo de un cierre del día satélite espera a la conciliación para entrar a la wallet de la
  central: COD, flete, comisión, IVA, pago al mensajero… **Nada entra al aprobar.**
- El saldo de la tienda también espera: «hasta que no se concilie el cierre no se puede mostrar
  dinero».
- Lo que no es dinero sigue al aprobar, igual que antes: la transición, el monto de indemnización
  capturado en la gestión, la liberación de las sin gestionar, las devoluciones, la aplicación de
  gestiones y el historial.
- Los cierres con destino `bodega_central` **no cambian**.
- La deuda de la satélite suma **todos los métodos de pago** (efectivo, SINPE, transferencia). De
  esa deuda se **descuentan** lo que ella paga a sus mensajeros y su ganancia, que es el dato ya
  existente `total_ingreso_bodega_rechazos` del cierre.
- Aporte de un cierre: `total_general − total_pago_mensajero − total_ingreso_bodega_rechazos`. Se
  conserva el signo y nunca se recorta a cero. Si existe una función única para «lo que la satélite
  entrega a la central», úsala: debe haber **una sola** fórmula.
- Si se recibe menos de lo esperado, los asientos de los cierres entran **completos**, y la caja
  lleva **una** fila de «diferencia de la satélite» por esperado − recibido. Esa fila es un egreso
  si llegó menos y un ingreso si llegó más. La diferencia queda como deuda abierta. Nada se
  prorratea.
- Conciliar **sí** escribe en los libros. Esto revoca cualquier regla previa de «la conciliación es
  informativa».
- Una conciliación que ya asentó dinero **no se puede revertir**. El monto se arregla con
  «Corregir», que escribe un movimiento de diferencia nuevo solo por la **variación**. No modifica
  ni borra movimientos anteriores y, si no hay variación, no escribe nada.
- La diferencia de la satélite **no** es ganancia de la empresa ni dinero «de las tiendas». Va a un
  bolsillo nuevo de la caja, **«Por cobrar a satélites»**:
  - sube cuando la satélite entrega de menos y baja cuando paga la diferencia;
  - se muestra **siempre**, también con 0;
  - si es negativo, su pista dice que la central les debe a las satélites;
  - en la barra de composición de la caja es un **tercer tramo**: no se resta del tramo de la
    empresa.
- Los premios del ranking y los incentivos del mensajero **no se tocan**. Los registra una persona
  después, no la aprobación.
- Se revierte lo ya registrado en la wallet por cierres satélite sin conciliar, para que entre al
  conciliar.

**Arreglo por capas.**

- **DB.**
  1. **Migración de enums**, sola, porque Postgres no deja usar un valor de enum en la transacción
     que lo añade. Añade:
     - las categorías de caja `egreso_diferencia_satelite` e `ingreso_diferencia_satelite`;
     - el origen `conciliacion_bodega_ajuste`.

     Su `down.sql` recrea los tipos sin esos valores (Postgres no tiene `DROP VALUE`), borrando
     antes las filas que los usan.
  2. **Tabla `conciliacion_bodega_ajuste`**: una fila por evento que mueve la diferencia,
     append-only. Columnas:
     - `id`;
     - `organizacion_id` con RLS por empresa y trigger de misma empresa, si existe;
     - `cierre_bodega_id` (FK RESTRICT);
     - `evento`, con CHECK `marca`|`correccion`;
     - `monto_esperado`, `monto_recibido` y `diferencia`, en `DECIMAL(12,2)`, con
       CHECK `diferencia <> 0`;
     - `creado_por` y `created_at`.

     Es el `origen_id` del movimiento de diferencia. Hace falta porque el único `(origen_tipo,
     origen_id, categoria)` de la caja no admite dos diferencias con el mismo origen. Actualiza el
     CHECK tipo↔categoría de la caja partiendo de su definición **vigente aquí**.
  3. **Migración de datos** (ver abajo).
- **Repositorio.**
  - Extrae los escritores de dinero de la aprobación, **sin cambios y en el mismo orden**, a una
    función compartida `asentarCierreDia(tx, cierreId, deps)`. Es idempotente gracias al único de
    origen.
  - Las dependencias reales van por defecto: un llamador que no inyecta no debe quedar mudo.
    Verifica con un test que **mira las filas escritas**, no solo el import.
  - **Aprobación.** Dentro de la transacción se lee el destino del cierre. Solo si es
    `bodega_central` se llama a `asentarCierreDia`.
  - **Marcar recibido**, en la misma transacción que la marca:
    1. por cada cierre del día aprobado, satélite, de la consolidación, `asentarCierreDia`;
    2. `esperado = aporte(snapshot de la consolidación)`;
    3. `delta = (esperado − recibido) − Σ diferencias ya asentadas`;
    4. si `delta ≠ 0`, se escriben la fila de ajuste y **un** movimiento de caja: egreso si
       `delta > 0`, ingreso por `|delta|` si es negativo.

     Fecha: el instante de la conciliación, no el de la aprobación. Si algo falla, se revierte la
     marca entera. Reintentar no duplica nada.
  - **Corregir.** Mismo cálculo con `evento='correccion'`, sin volver a asentar los cierres.
  - **Revertir.** Si la consolidación ya tiene asientos, devuelve un desenlace propio
    (`con_asientos`). La pantalla muestra «Ya entró a la caja: corrige el monto en vez de
    revertir».
  - **Saldos.** Deuda de una zona = Σ aportes de **todos** sus cierres del día aprobados con
    destino satélite (consolidados o no, sea cual sea el estado de su consolidación) − Σ
    `monto_recibido` de sus consolidaciones no rechazadas.
    - Se muestra aparte cuánto está sin consolidar y cuántos cierres lo forman.
    - La cabecera y la descarga salen de la misma fórmula, y la suma de las filas cuadra con la
      cabecera.
    - «Falta por recibir» de una consolidación = `aporte(consolidación) − (recibido ?? 0)`, desde
      una sola función, en todas las pantallas.
  - **Estado de cuenta de la bodega.** Mismo predicado y misma fórmula, extraídos a un fragmento
    SQL compartido para que los dos repositorios no diverjan:
    - el «declarado» de cada consolidación es la suma de los aportes de sus cierres, no el
      efectivo;
    - hay una fila extra por cada cierre que cuenta en la deuda y no está en una consolidación no
      rechazada.

    Sin filtros, el pendiente final es igual a la deuda de la zona en la pantalla de saldos.
- **Clasificación de la caja.** Si la caja reparte por «dueño» (propio, terceros, capital…), añade
  el dueño `por_cobrar_satelite`. Las dos categorías de diferencia van a él, con liquidez efectivo.
  - Haz explícitas las ramas por dueño, con una comprobación exhaustiva (`never`), para que un dueño
    nuevo no caiga en silencio en otro bolsillo.
  - Identidad: `Entró − Salió = ganancia + IVA + capital + De las tiendas − Por cobrar a satélites`.
  - Debe seguir cumpliéndose que «De las tiendas» = Σ saldos de las tiendas.
- **UI.**
  - La conciliación muestra, por consolidación:
    - lo recaudado por método y su total;
    - lo que pertenece a la satélite: el pago a sus mensajeros y su ganancia por rechazos;
    - lo que debe, lo recibido y lo que falta.
  - Saldos: columna «Sin consolidar».
  - Caja: bloque «Por cobrar a satélites» siempre visible y tercer tramo en la barra:
    - cada tramo entre 0 % y 100 %, y los tres suman 100 %;
    - sin división por cero;
    - con el bolsillo en ≤ 0, la barra queda exactamente como antes.
  - Libro de caja y descarga: el dueño de las filas de diferencia se rotula «Satélite».
  - La tarjeta de conciliación del cierre de bodega cumple «recibido + falta = Para la central».
  - Ningún texto dice que desmarcar no mueve dinero ni que la marca es informativa. Texto
    definitivo de la nota: «Marcar recibido asienta el dinero en la caja. Después no se puede
    desmarcar: si el monto no es el correcto, usa «Corregir»».
  - Pistas del bloque:
    - positiva: «Lo que las satélites entregaron de menos al conciliar y aún no han pagado.»;
    - negativa: «La central les debe a las satélites.».
- **Autorización.** Marcar, corregir y revertir siguen reservados a quien tenía ese permiso, con el
  guard antes de tocar cualquier repositorio.

**Migración de datos (con la puerta obligatoria).**

- **Conjunto S.** `cierre_dia` con destino `bodega_satelite` en `aprobado` que cumple una de dos
  condiciones:
  - no tiene consolidación (`cierre_bodega_id IS NULL`);
  - su consolidación no está conciliada (`conciliado_at IS NULL`).

  Se filtra por predicado, sin ids.
- **Guarda.** Si algún cierre de S tiene un pago al mensajero registrado contra él
  (`liquidacion_pago.cierre_id` o su equivalente), la migración hace `RAISE EXCEPTION` con el
  conteo y no cambia nada.
- **Respaldo.** Cada fila retirada se copia íntegra (`to_jsonb`) en un esquema **fuera de
  `public`** (`respaldo`), al que el rol de la aplicación no tiene acceso y que el ORM no compara.
  Así no hay drift. La clave es `(tabla, id)`, con `id` como columna generada desde el JSON.
- **Qué se retira.** Las filas con origen `cierre_dia` ∈ S de los tres libros. El `DELETE` filtra
  por el id **del respaldo**. Del libro del mensajero **no** se retiran las de premio de ranking, las
  de incentivo ni ninguna con fecha de premio (`premio_dia` o su equivalente). Todo va en un solo
  bloque `DO`, todo o nada.
- **`down.sql`.**
  - Reinserta desde el respaldo con `jsonb_populate_record` y `ON CONFLICT DO NOTHING`.
  - Borra **solo su** tabla de respaldo, y el esquema solo si queda vacío: otra migración, como la
    de H4, puede usar el mismo esquema.
- **Medición previa en producción.** Mide:
  - el tamaño de S;
  - las filas por libro;
  - si hay `liquidacion_pago` contra S;
  - si a alguna tienda afectada ya se le pagó un saldo que incluía ese COD. Quitar su crédito la
    dejaría en negativo hasta conciliar, y la migración no puede detectarlo.

  **Para** y pide confirmación.

**Tests.**

- Aprobar un cierre satélite no escribe en ninguno de los tres libros y hace todo lo que no es
  dinero. Aprobar uno central escribe exactamente las mismas filas que antes.
- Marcar recibido:
  - asienta los cierres y escribe la diferencia con su signo;
  - un reintento no duplica nada;
  - un fallo revierte la marca.
- Corregir escribe solo el delta.
- Revertir con asientos devuelve `con_asientos` sin cambiar nada.
- Deuda por zona con cierres sin consolidar y con SINPE. Cabecera = Σ filas.
- Estado de cuenta = deuda de la zona.
- Identidad de la caja y regla «De las tiendas» = Σ saldos, con una diferencia positiva, negativa y
  cero.
- Barra de tres tramos en los límites.
- Migración:
  - retira solo lo de S;
  - conserva los premios y los incentivos;
  - no toca los cierres centrales ni los conciliados;
  - aborta con `liquidacion_pago`;
  - up, down y up dejan el estado igual;
  - conciliar un cierre retirado lo vuelve a asentar.
- RLS de la tabla nueva con dos empresas.

**Preguntas que quedaron abiertas en el origen** (no bloquean; no las resuelvas por tu cuenta):

- La ganancia de la satélite no se registra como egreso de la caja.
- En un cierre todo SINPE, el libro del mensajero lo deja con una cuenta por pagar aunque la
  satélite ya descontó su pago.

---

## H4 — Un distrito no puede quedar en dos zonas de la misma empresa

**Síntoma.** En la configuración de zonas y tarifas, el maestro añade distritos a una zona y
guarda. Al recargar, algunos salen desmarcados, y al volver a guardar se borran de verdad. La
reconciliación de órdenes por zona puede moverlas sin avisar. Un distrito duplicado, además, hace
que el alta y la cotización de órdenes fallen con «no tiene zona asignada».

**Causa raíz.**

- La tabla N:M zona↔distrito solo tenía único `(zona_id, distrito_id)`: nada impedía el mismo
  distrito en dos zonas de la misma empresa.
- El servicio deduplicaba y comprobaba que los distritos existieran, pero no si ya tenían zona.
- El repositorio insertaba (`createMany`, o `deleteMany` + `createMany`) sin validar.
- El árbol geográfico colapsaba un distrito con dos zonas o más a «sin zona» (`zonaId: null`).
- «Editar» preseleccionaba con `d.zonaId === zona.id`, así que el distrito salía desmarcado en las
  dos zonas y el siguiente guardado lo borraba.
- El selector dejaba marcar un distrito que ya era de otra zona.
- «Editar» podía abrir con el árbol anterior al último guardado, porque el refetch no se esperaba.

En el repo de origen estaba en:

- `ZonaService.prepararDatos`;
- `ZonaRepository.create/update`;
- `GeoRepository.listArbol`;
- `ZonasTarifasModule.abrirEditar/onSaved`;
- `GeografiaSelector`;
- `CrearZonaForm`.

**Reglas de negocio decididas.**

- Un distrito que ya tiene otra zona queda **bloqueado**: no se puede seleccionar en otra.
- Si se intenta guardar con un distrito que ya tiene otra zona, sale un aviso de error y **no se
  guarda nada**.
- Datos existentes:
  - **(a)** un distrito en exactamente dos zonas, una central y otra no central, **se queda en la
    no central** y sale de la central;
  - **(b)** cualquier otra combinación (dos no centrales, tres o más zonas) queda **sin zona**,
    hasta que el maestro lo asigne desde la pantalla.
- La migración **no toca órdenes**: las ya creadas conservan su `zona_id`.
- Un distrito que se quede sin zona se queda así: lo resuelve el maestro.

**Arreglo por capas.**

- **DB.** Índice único `(organizacion_id, distrito_id)` sobre la N:M. Va **después** de la limpieza
  de datos, en su propia migración: si queda algún duplicado, falla y aborta el deploy. Sigue
  permitiendo el mismo distrito en empresas distintas.
- **Repositorio.**
  - Dentro de la transacción del guardado, **antes** de la primera escritura, se leen los conflictos:
    filas de la N:M con `distrito_id ∈ elegidos` y otra zona.
    - En la actualización, va tras comprobar que la zona existe y antes de cualquier escritura.
    - En la creación, va antes incluso de quitar la marca de central a la zona anterior.
    - El filtro por empresa lo pone la capa multiempresa y lo respalda la RLS.
  - Si hay conflictos, devuelve `{ estado: "distrito_en_otra_zona", conflictos: [{distritoNombre,
    zonaNombre}] }` sin escribir nada: ni zona, ni N:M, ni tarifas, ni marca de central, ni
    historial, ni `orden.zona_id`.
  - **Red final.** Si el índice rechaza un guardado concurrente, se devuelve el mismo estado con
    `conflictos: null`, **nunca** un error interno. Prueba contra Postgres real cómo llega el error
    del único dentro de una transacción interactiva (P2002 o un error del driver sin código) y
    detéctalo por el nombre del índice.
- **Service.** Responde `validation_error` con `fieldErrors.distritoIds`:
  - un mensaje por conflicto, `«<distrito> ya está en la zona <zona>.»`, ordenado por nombre de
    distrito;
  - con `conflictos: null`, el mensaje es «Alguno de los elegidos acaba de asignarse a otra zona.
    Recarga la página y vuelve a intentarlo.».

  Guardar una zona con sus propios distritos sin cambios responde `ok`. Un distrito en una zona de
  otra empresa no es conflicto y no se nombra.
- **Árbol.** Cada distrito trae la lista completa de zonas de la empresa a las que pertenece (`id`
  y `nombre`), ordenada por nombre. Se conserva el colapso actual de `zonaId` y `zonaNombre`.
- **UI.**
  - El selector deshabilita el distrito que pertenece a otra zona (al crear, a cualquier zona) y
    muestra `(zona: <nombre>)`.
  - Al marcar un cantón o una provincia, solo se marcan sus distritos seleccionables. Su estado
    (marcado, indeterminado o vacío) se calcula sobre ellos, y sin ninguno seleccionable la casilla
    se deshabilita.
  - Los distritos de la propia zona siguen editables.
  - «Crear» y «Editar» **leen el árbol al abrir**. Si la lectura falla, no abren y muestran un
    toast de error. La preselección sale de la lista de zonas del distrito.
  - Los errores de `distritoIds` se pintan bajo el selector. El toast muestra el primero más
    « y N más.».
  - El toast de `conflict`, que es el del nombre de zona, no menciona distritos.

**Migración de datos (con la puerta obligatoria).**

- **Medición previa en producción** (solo lectura, solo conteos):

  ```sql
  SELECT zd.organizacion_id, zd.distrito_id, count(*) AS n,
         count(*) FILTER (WHERE z.es_central) AS centrales
  FROM zona_distrito zd JOIN zona z ON z.id = zd.zona_id
  GROUP BY zd.organizacion_id, zd.distrito_id
  HAVING count(*) > 1;
  ```

  Presenta cuántos casos caen en la regla (a) y cuántos en la (b), y **para**. En el origen la
  primera decisión fue otra («quitarlo de las dos»). Se cambió al medir. Que el humano confirme el
  mapeo con los números de aquí.
- **Migración.**
  - Ventana `PARTITION BY organizacion_id, distrito_id` con `n` y `centrales`.
  - Se respaldan y se borran todas las filas de grupos con `n > 1`, **excepto** la no central del
    caso `n = 2 AND centrales = 1`.
  - El respaldo va en el esquema `respaldo`, sin acceso para el rol de la app, con columnas con
    nombre (`id`, `zona_id`, `distrito_id`, `organizacion_id`, `respaldado_at`).
  - El `DELETE` usa los ids del respaldo.
  - No toca ninguna otra tabla. Sin duplicados, no borra nada.
- **`down.sql`.** Quita el índice, restaura las filas respaldadas cuya zona y cuyo distrito sigan
  existiendo, y borra **solo su** tabla de respaldo (el esquema, solo si queda vacío).

**Tests.**

- Integración contra Postgres:
  - crear o actualizar con un distrito de otra zona responde `validation_error` y no escribe nada,
    ni órdenes ni historial;
  - los propios distritos sin cambios dan `ok`;
  - con otra empresa no hay conflicto ni se nombra su zona;
  - el índice rechaza un insert directo;
  - un guardado concurrente da el mensaje de «recarga».
- Migración:
  - caso (a);
  - caso (b) con dos no centrales y con tres zonas;
  - mismo distrito en otra empresa, intacto;
  - sin duplicados no borra nada;
  - el respaldo es inaccesible para el rol de la app;
  - las órdenes no se tocan;
  - up, down y up.
- Árbol: zonas de la empresa ordenadas, sin las de otra empresa.
- Componentes: bloqueo, marcado de grupo, estado del grupo, preselección tras guardar otra zona sin
  recargar, fallo de la lectura del árbol, mensajes y toast.
- Busca los tests existentes que siembran un distrito en dos zonas: ahora es un estado imposible y
  hay que reescribirlos.

**Pasos después del deploy (obligatorios, solo lectura, salvo el guardado manual del punto 4).**

1. Duplicados: la consulta de medición devuelve 0 filas.
2. El índice existe:

   ```sql
   SELECT indexname FROM pg_indexes
   WHERE tablename = 'zona_distrito' AND indexdef ILIKE '%(organizacion_id, distrito_id)%';
   ```

3. El respaldo tiene las filas esperadas y el total de la N:M es el de antes menos las respaldadas.
4. **Reconciliar órdenes vivas.** La migración no movió órdenes. Las de los distritos que quedaron
   solo en la zona no central siguen con la `zona_id` de la central.
   - Consulta de comprobación:

     ```sql
     SELECT o.id, o.zona_id AS zona_orden, zd.zona_id AS zona_distrito
     FROM orden o
     JOIN zona_distrito zd ON zd.distrito_id = o.distrito_id
                          AND zd.organizacion_id = o.organizacion_id
     WHERE o.deleted_at IS NULL AND o.zona_id IS DISTINCT FROM zd.zona_id;
     ```

   - Si hay filas, el maestro **abre y guarda sin cambios**, desde la pantalla, cada zona que
     recibió esos distritos. El guardado de una zona reconcilia la `zona_id` de sus órdenes
     elegibles.
   - Una orden no se mueve si:
     - ya tiene detalle congelado en un cierre;
     - tiene una gestión vigente cuyo resultado ya decidió dinero (entregada, rechazada o
       incidente);
     - está en el estante de una bodega satélite (esas se retienen y se informan).

     Verifica que aquí ese guardado reconcilia. Si no, informa al humano y no muevas órdenes con
     SQL.
   - Vuelve a lanzar la consulta. Lo que quede debería ser solo lo no elegible: enuméralo por
     conteo y estado.
5. **Distritos sin zona.** Un distrito del caso (b), o uno que ya no tenía zona, rechaza órdenes
   nuevas con «no tiene zona asignada».

   ```sql
   SELECT d.id, count(o.id) AS ordenes
   FROM distrito d
   LEFT JOIN orden o ON o.distrito_id = d.id AND o.deleted_at IS NULL
   WHERE NOT EXISTS (SELECT 1 FROM zona_distrito zd WHERE zd.distrito_id = d.id)
     AND EXISTS (SELECT 1 FROM orden o2 WHERE o2.distrito_id = d.id)
   GROUP BY d.id;
   ```

   Informa del resultado al humano. Asignarlos es decisión suya, desde la pantalla.

---

## H5 — La deuda de H3 y H4 (requiere H3 y H4 desplegados)

Son bloques mínimos, sin rediseño. Cada uno lleva su test con contraprueba.

**Bloque 1. La fecha del cierre se pintaba en UTC.**

- **Síntoma.** Pasada la medianoche UTC, las tarjetas, los comprobantes y las descargas de cierres
  muestran el día siguiente.
- **Causa.** Se obtenía el día recortando el ISO: `iso.slice(0, 10)`.
- **Arreglo.**
  - Las fechas de solicitud, resolución y conciliación de los cierres (del mensajero, de la bodega y
    los propios del mensajero), y las columnas de fecha de sus descargas, usan la utilidad única de
    «día calendario en la zona horaria del negocio». En el origen es la de Costa Rica. Si aquí no
    existe esa utilidad, créala en un solo sitio.
  - Una fecha ausente se sigue mostrando «—».
  - Añade una guardia que impida `slice(0, 10)` sobre fechas en el código de las pantallas de
    cierres, **sin excepciones**.
- **Test.** El instante `2026-11-01T05:03:00Z` se muestra como `2026-10-31` (para UTC−6).

**Bloque 2. «Desmarcar» solo cuando se puede.**

- Si una consolidación conciliada tiene dinero asentado (asientos de caja de sus cierres, o al menos
  un ajuste de diferencia), no se ofrece «Desmarcar» en ninguna pantalla. «Corregir» se sigue
  ofreciendo cuando la marca está incompleta.
- La UI decide con el **mismo** criterio que usa el servidor para rechazar la reversión: una
  función compartida `consolidacionesConDinero(ids)` que une las consolidaciones con asientos y las
  que tienen algún ajuste.

**Bloque 3. Revertir no deja una diferencia huérfana.**

- **Causa.** La reversión solo miraba los asientos de caja de los cierres.
- **Arreglo.** Una consolidación con al menos un ajuste de diferencia, aunque no tenga asientos, se
  rechaza con `con_asientos`. No cambia la marca, ni los ajustes, ni los libros, ni el historial.

**Bloque 4. Una sola fórmula del esperado.**

- **Causa.** El ajuste de diferencia calculaba el esperado a mano.
- **Arreglo.** Usa la misma función que «Falta por recibir».
- **Test.** Con un snapshot general 9.000, pago a mensajeros 1.500 y ganancia por rechazos 500, el
  esperado es 7.000. Una marca con recibido 6.900 deja un ajuste de 100.

**Bloque 5. Aislamiento por empresa.** El SQL a mano del estado de cuenta de la bodega (totales,
periodo y página) necesita un test con dos empresas y el rol de la aplicación:

- B no ve nada de A: periodo y página vacíos, totales en 0,00;
- A ve sus cifras.

**Bloque 6. Rastro de los distritos de una zona en el histórico de acciones.**

- **Reglas decididas.**
  - Una fila por distrito añadido o quitado, todas en el **mismo lote**, en la misma transacción
    del guardado.
  - En un distrito añadido, el valor anterior va vacío y el nuevo es el distrito; en uno quitado, al
    revés.
  - Texto del distrito: `«<distrito> (<cantón>)»`, recortado a 60 caracteres.
  - Categoría «mueve dinero», porque el distrito decide la zona y la zona decide la tarifa.
  - Solo al **editar**: crear o borrar una zona no deja estas filas.
  - Acción `zona_distrito_cambiado`, con la etiqueta «Cambió los distritos de una zona».
  - Sin cambios en los distritos, o con un guardado rechazado, no se escribe nada.
- **DB.** Valor nuevo del enum de acciones, en su propia migración. Su `down.sql` recrea el tipo
  sin el valor (Postgres no tiene `DROP VALUE`).
- **Código.** Añade la acción a los catálogos de tipo, categoría y etiqueta. La pantalla, el
  filtro por categoría y la descarga del histórico deben encontrarla. Ajusta las guardias o los
  tests que fijan conteos del catálogo.

**Bloque 7. Textos definitivos.** Los textos de H3 (nota de la conciliación, pistas del bloque «Por
cobrar a satélites» y dueño «Satélite») son definitivos. Quita cualquier marca de «provisional» en
el código y en los tests.

**Bloque 8. Retirar los respaldos de H3 y H4. Es irreversible: tiene puerta propia.**

- **Puerta.**
  1. Primero, en producción y en solo lectura: el número de filas de cada tabla de respaldo, la
     lista de objetos del esquema `respaldo` y la confirmación de que H3 y H4 quedaron bien (0
     movimientos de caja de cierres satélite sin conciliar y 0 distritos repetidos).
  2. **Para.** El humano verifica y autoriza por escrito.
- **Migración.** Un bloque `DO`, todo o nada:
  - `DROP TABLE IF EXISTS` de las dos tablas de respaldo;
  - `DROP SCHEMA IF EXISTS respaldo` dentro de un sub-bloque que captura
    `dependent_objects_still_exist` y emite un `NOTICE`. Si el esquema tiene otros objetos, se deja
    intacto y la migración no falla.

  No toca ninguna tabla de `public`.
- **`down.sql` de esta migración.** **No** recrea los respaldos, ni vacíos, y dice por escrito que
  los datos no se recuperan.
- **Ajuste a los `down.sql` anteriores** (solo si aún no se aplicaron en ningún entorno; si no, en
  migración nueva):
  - el de H3, sin respaldo, falla con un mensaje que nombra esta migración y dice que los asientos
    retirados no se pueden devolver. No cambia ningún libro;
  - el de H4, sin respaldo, no falla, no toca la N:M y emite un `NOTICE`.

**Bloque 9 (solo si aplica aquí).** En el origen también se estabilizaron tests inestables. Si aquí
existen los mismos, aplica el mismo criterio:

- una migración de test que toma bloqueos debe tomarlos en el orden del protocolo del repo antes
  del primer DDL (si no, deadlock 40P01);
- el rechazo de una FK `ON UPDATE RESTRICT` con hijos se acepta como `23503` o `23001`, porque
  depende de la versión de Postgres;
- un test de plan de consulta no puede depender de las estadísticas de la base local;
- un test que siembra geografía elige el cantón del país de la empresa con un orden total.

---

## Checklist de verificación global

**Por cada H:**

- [ ] El bug se reprodujo aquí con un test rojo **antes** del arreglo.
- [ ] Cada test de regresión pasó de verde a rojo con su mutación y volvió a verde. El diff de la
      mutación quedó vacío.
- [ ] El gate completo del repo (typecheck, lint, tests, E2E si los hay) está en verde.
- [ ] Ninguna migración aplicada fue editada. Cada migración nueva tiene `down.sql` y se probó up,
      down y up.
- [ ] Cada migración de datos tuvo su medición en producción, de solo lectura, y la confirmación
      escrita del humano antes de aplicarse.
- [ ] Todo el dinero va en decimal. Ninguna resta de dinero se hace en el cliente.
- [ ] Toda tabla y lectura nueva va acotada por empresa y tiene un test con dos empresas.
- [ ] Ningún secreto, URL de base ni dato de producción en el código, los tests, los commits o el
      PR.

**En producción, después de cada deploy (solo lectura):**

- [ ] **H1.** 0 órdenes en `en_bodega_central` con mensajero cuya última fila de historial sea la
      recepción central desde `en_ruta_bodega_central`:

      ```sql
      SELECT count(*) FROM orden o
      JOIN order_status s ON s.id = o.estatus_id AND s.value = 'en_bodega_central'
      WHERE o.deleted_at IS NULL AND o.mensajero_asignado_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM orden_historial_estado h
          JOIN order_status so ON so.id = h.estatus_origen_id
          WHERE h.orden_id = o.id AND h.origen_tipo = 'recepcion_bodega_central'
            AND so.value = 'en_ruta_bodega_central'
            AND NOT EXISTS (SELECT 1 FROM orden_historial_estado h2
                            WHERE h2.orden_id = o.id
                              AND (h2.created_at, h2.id) > (h.created_at, h.id)));
      ```

- [ ] **H2.** La columna `confirmada_fisica_at` existe. Tras la primera aprobación de un cierre con
      barridas, todas sus barridas tienen la marca.
- [ ] **H3.** 0 movimientos de caja con origen `cierre_dia` de cierres satélite aprobados sin
      conciliar:

      ```sql
      SELECT count(*) FROM wallet_movimiento w
      JOIN cierre_dia c ON c.id = w.origen_id
      LEFT JOIN cierre_bodega b ON b.id = c.cierre_bodega_id
      WHERE w.origen_tipo::text = 'cierre_dia' AND c.destino_tipo::text = 'bodega_satelite'
        AND c.estado::text = 'aprobado' AND (c.cierre_bodega_id IS NULL OR b.conciliado_at IS NULL);
      ```

      Repite la consulta para el libro por tienda y el del mensajero, este último excluyendo los
      premios y los incentivos. La deuda de cada satélite en la pantalla de saldos es igual al
      pendiente de su estado de cuenta.
- [ ] **H4.** 0 duplicados y el índice existe. Las órdenes desalineadas se reconciliaron guardando
      la zona, o quedaron enumeradas como no elegibles. Los distritos sin zona se informaron al
      humano.
- [ ] **H5.** Fechas de cierre correctas pasada la medianoche UTC. «Desmarcar» oculto en las
      consolidaciones con dinero. El rastro de distritos aparece en el histórico. El esquema
      `respaldo` ya no tiene las tablas de H3 y H4, y solo se retiraron tras la autorización
      escrita.
