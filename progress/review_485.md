# Revision — Ficha 485 · «Producto» en «Detalle por guia» de la caja

Rama `feat/485-producto-detalle-guia-caja`, HEAD revisado 4281a1e3, base `dev` 3e8b100c. sdd:false (sin
carpeta de specs): el contrato es el pedido del humano.

Busqueda: grep y lectura directa de los archivos del diff y de sus consumidores (el diff es de 11 archivos
de codigo y la cadena venia trazada en la bitacora; cada eslabon se confirmo en el archivo real).

## Checklist

- [x] Columna «Producto» justo tras «Remision» en `COLUMNAS_DESCARGA_DETALLE_GUIA_CAJA`.
- [x] Desmarcable: `FIJAS_DETALLE_POR_GUIA` sin cambios; test `columnasFijas not.toContain("producto")`.
- [x] Marcada por defecto y con preferencia vieja: la preferencia es lista de exclusion (`ocultas`);
      test con JSON viejo escrito a mano → `["guia","remision","producto"]`.
- [x] SOLO la caja: `producto` se anade en `filaCabeceraGuiaCaja` (spread sobre la cabecera compartida);
      `filaCabeceraDeGuia` no se toca; ninguna otra lista declara la columna (test por clave y por
      encabezado en 6 catalogos) y las cabeceras de tienda/mensajero/mi-wallet no emiten la clave.
- [x] Fuente congelada, misma fila que la remision: `SELECT_DE_APORTE` (`producto: true` junto a
      `numRemision`) → `aFilaDeAporte` → `DetalleEnLoteService` (`producto: fila.producto`) →
      `agruparPorGuia` toma `reciente.producto` del mismo `CierreDelBloque` que `reciente.remision`.
      Ninguna lectura de `orden.producto` vivo en el camino.
- [x] Integracion contra Postgres real: la orden viva siembra «Caja viva» y el snapshot `Producto o<n>`;
      la asercion regex distingue ambas (una lectura de la orden viva o un SELECT sin el campo la ponen
      roja; la bitacora documenta la mutacion del SELECT).
- [x] Unit de la regla R39: el producto viene del cierre MAS RECIENTE aunque llegue antes en la hoja
      (valores distintos «Producto nuevo»/«Producto viejo»); orden sin guia con su producto.
- [x] Contratos de columnas escritos a mano (encabezados y claves literales, archivo real de la caja con
      celdas leidas del Excel: «Camisa» en la cabecera, `null` en la fila de concepto, «Gorra» en el
      bloque sin guia). No hay aserciones contra su propia fuente.
- [x] Otras superficies sin cambios de contenido: el escritor emite solo las columnas declaradas; las
      cabeceras compartidas no llevan la clave; las filas de concepto/total no la llevan.
- [x] Otros consumidores: `DetalleMovimientoService.aDTO` (panel/comprobante) construye `OrdenAporteDTO`
      campo a campo, no propaga `producto`; `filaCabeceraGuiaCaja` solo la usa `WalletModule`. Los
      fixtures restantes solo ganan el campo obligatorio.
- [x] Sin migracion (`cierre_detail.producto` ya existia). Sin tablas nuevas, sin secretos, capas
      respetadas (repo → service → util → componente).
- [x] Verificacion propia: 9 archivos dirigidos (incluida la integracion `detalle-en-lote-464`) →
      133 passed, 0 skipped. `tsc --noEmit` limpio.
- [x] Gates del implementer: `gate_485_backend.log` y `gate_485_frontend.log` con `INIT_EXIT=0` y
      «init OK»; el unico rojo de `integration/db` en cada uno se repitio aislado en verde
      (intermitente de base compartida, ajeno al diff). No se corrio el gate completo.

## Hallazgos

- menor — `OrdenDelLoteDTO`/`BloqueDeGuiaDTO` viajan con `producto` tambien a mi-wallet y a los estados de
  cuenta de tienda/mensajero (no se pinta ni se descarga alli). No es filtracion: son ordenes que esa
  tienda/mensajero ya ve con su producto; solo es payload de mas.
- menor — `COLUMNA_LIBRO.producto` vive en el catalogo compartido; hoy solo lo declara la caja (el test
  «485» lo guarda), pero una superficie futura podria tomarlo sin que su cabecera lo rellene.
- menor — el gate de la parte frontend reporta 9 `skipped` en `integration/db` (el de backend, 0); los
  archivos del diff corrieron sin saltos en la corrida de esta revision.

## Veredicto

OK — 0 bloqueantes, 3 menores.
