# Qué se arregló en el Backoffice (7 de octubre de 2026)

Este documento explica, sin tecnicismos, qué estaba fallando y qué se corrigió. Hay cambios en
dos lugares: en el Backoffice (lo que se ve en pantalla) y en el servidor (la parte que guarda y
entrega los datos). **Los dos deben actualizarse juntos** para que todo funcione.

## El problema que se reportó

En **Administración Contable → Pedidos → pestaña Publicidad** no aparecían las compras de
Monedas. Los datos sí existían en el servidor: la pantalla abría mostrando solo las recargas que
todavía no tenían boleta o factura emitida, y las tarjetas de arriba (cantidad, monto, ganancia)
se calculaban sobre esa lista recortada. Cuando todas las recargas ya tenían su documento, la
pestaña decía "0 compras" y "no se han registrado compras", como si nunca se hubiera vendido nada.

**Ahora:** la pestaña abre con todas las compras, las tarjetas muestran los totales reales y el
botón "Sin documento (N)" sigue indicando cuántas faltan por facturar. Si la carga falla, aparece
un aviso rojo con un botón "Reintentar" en vez de una pantalla vacía.

## Qué más se revisó

Se compararon todas las pantallas del Backoffice con lo que el servidor realmente entrega, para
encontrar errores parecidos. Se encontraron y corrigieron 11 fallas graves, 20 medias y unas 25
menores. Las más importantes:

### Cosas que no funcionaban y ahora sí
- **Escalar una alerta a mediación**: el botón no hacía nada porque el servidor no tenía esa
  función. Ahora abre (o encuentra) la mediación del pedido y marca la alerta como revisada.
- **Editar o eliminar una nota de mediación**: tampoco existía en el servidor. Ahora funciona
  para las notas creadas desde el Backoffice.
- **Historial de un caso resuelto**: salía vacío por un dato mal nombrado. Ahora carga.
- **Buscador y filtros de Alertas y de Auditoría**: el servidor los ignoraba. Ahora filtran de
  verdad, y las alertas salen de la más reciente a la más antigua.
- **Vencimiento de comprobantes en Alertas**: el texto "Vence en X días" salía en blanco por un
  nombre distinto entre pantalla y servidor.
- **Feedback de usuarios**: todos aparecían como "Comprador" porque el rol se comparaba con un
  valor que el servidor nunca envía. Ahora los vendedores se identifican bien.
- **Pestaña Rechazados en Pago a captadores**: un retiro rechazado desaparecía sin dejar rastro.
  Ahora tiene su propia pestaña con el motivo.

### Riesgos de datos que se cerraron
- **Validaciones de tiendas**: con 11 o más postulaciones, aprobar o rechazar los documentos de
  una tienda podía actuar sobre la postulación de **otra** tienda. Corregido en el servidor y en
  la pantalla.
- **Suspender una tienda desde una mediación**: si la tienda tenía otros reclamos abiertos, el
  servidor cerraba el caso sin suspender y la pantalla decía "Cuenta suspendida con éxito". Ahora
  avisa que primero hay que resolver los otros reclamos y no cierra nada.
- **Retiros de captadores**: existía una copia del listado accesible con el permiso de
  Mediación y Confianza. Se eliminó; solo Administración Contable los ve.
- **Recargas de Monedas que quedaban "en el aire"**: si Flow confirmaba el pago pero el aviso
  al servidor fallaba y el comprador no volvía a la app, la recarga nunca se acreditaba ni
  aparecía en Publicidad. Ahora el servidor revisa cada 5 minutos las recargas pendientes y las
  confirma con Flow.

### Avisos de error en toda la aplicación
Antes, si una pantalla no podía cargar (por un permiso faltante o un fallo del servidor), se
veía igual que una lista vacía: "Sin alertas", "No hay retiros". Ahora aparece un aviso claro
con botón "Reintentar", y los mensajes de error muestran el motivo real que entrega el servidor
en vez de un texto técnico.

### Listados largos
Varias pantallas (Vendedores, Validaciones, Mediaciones resueltas y bloqueos, Reportes,
Soporte, Finanzas) solo mostraban los primeros 100 registros sin avisar. Ahora se traen todos.

### Otros detalles
- Los reclamos cerrados por una suspensión aparecen en la pestaña de resueltos.
- En Bloqueos se ve si la suspensión es temporal, definitiva o por fraude.
- El selector "Tienda asociada" al crear un ticket de soporte ya no sale vacío para los
  operadores de Soporte.
- Un captador al que se le desactivó el acceso ve una pantalla que lo explica, en vez de quedar
  cargando para siempre.
- "Mes actual" en el portal de captadores se calcula con la hora de Chile (a fin de mes salía
  el mes siguiente, vacío).
- Si Flow rechaza un reembolso en el acto, se avisa como rechazo y no como "solicitado".

## Qué falta hacer

1. **Desplegar el servidor y el Backoffice juntos** (el Backoffice usa funciones nuevas del
   servidor; si se sube solo uno, algunas pantallas fallarán).
2. **Probar con una cuenta de administrador** la pestaña Publicidad y, de pasada, Alertas,
   Validaciones y Mediaciones. No fue posible probarlo con las cuentas de prueba, que no tienen
   permisos de administración.
