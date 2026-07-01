# Feature: gestion-confianza

## 1. Contexto

Gestion de Confianza es el area del backoffice interno de RepuesTop orientada a revisar vendedores, documentos, mediaciones, alertas y trazabilidad operativa.

La ruta actual vive en `/confianza/*` y comparte el mismo shell autenticado del resto del backoffice.

## 2. Problema

El equipo necesita una vista unica para controlar el ciclo de vida del vendedor, la documentacion, los riesgos y las mediaciones sin mezclarlo con administracion financiera o soporte.

## 3. Objetivo

Gestionar la confianza del marketplace mediante:

- Resumen operativo del estado general.
- Vendedores registrados.
- Validaciones documentales.
- Mediaciones y casos escalados.
- Alertas y seguimiento de boletas.
- Bitacora de acciones sensibles.

## 4. Vistas implementadas

- Resumen.
- Vendedores.
- Validaciones.
- Mediaciones.
- Alertas.
- Bitacora.

## 5. Criterios de aceptación

### CA-01: Integracion en backoffice

- Debe existir acceso protegido bajo `/confianza`.
- Debe convivir con Administracion Contable y Soporte.
- Debe usar el mismo shell autenticado del backoffice.
- Debe permitir enlaces contextuales a pedidos, soporte o administracion cuando corresponda.

### CA-02: Resumen

- Debe mostrar el pulso operativo del marketplace.
- Debe mostrar vendedores activos, casos escalados, casos en mediacion y documentación revisada.
- Debe mostrar el indice global de confianza y su nivel.
- Debe mostrar paneles de mediaciones, escalaciones, validaciones y seguimiento de boletas.
- Debe mostrar cuentas suspendidas, documentos por vencer y reclamos sin respuesta.

### CA-03: Vendedores

- La vista debe mostrar solo vendedores aprobados y visibles operativamente.
- Debe permitir buscar por tienda, RUT o ciudad.
- Debe permitir filtrar por Todos, Mediación y Escalado.
- Debe mostrar métricas de vendedores activos, mediaciones activas y escalados.
- Debe mostrar tabla con Tienda, RUT, Ciudad, Estado de cuenta, Riesgos, Última respuesta, Mediaciones y Acciones.
- Debe permitir ver documentación, abrir mediaciones y revisar riesgos.
- Debe permitir expandir el detalle del vendedor.

### CA-04: Detalle de vendedor

- Debe mostrar ficha del vendedor con estado, confianza, cuenta bancaria, documentos, mediaciones, riesgos y actividad reciente.
- Debe mostrar documentos del vendedor.
- Debe mostrar casos en mediación y casos escalados relacionados.
- Debe mostrar tickets abiertos solo como parte del contexto operativo del perfil.
- Debe permitir bloquear por falta grave desde la ficha o el detalle.

### CA-05: Validaciones

- Debe listar solicitudes documentales no aprobadas.
- Debe permitir filtrar por estado.
- Debe permitir aprobar, solicitar corrección o rechazar.
- Al aprobar una validación y completar el conjunto requerido, el vendedor debe pasar a aprobado.
- Al rechazar una validación, el nivel de confianza debe bajar.
- Debe mostrar documentos, responsable, fecha de carga, vencimiento y notas.

### CA-06: Mediaciones

- Debe mostrar estados En disputa, Escalado, En mediación, Resuelta y Cerrada.
- Debe mostrar icono gris para escaladas e icono violeta para mediaciones en curso.
- Debe permitir iniciar mediación desde un caso escalado.
- Debe permitir revisar mediación en curso.
- Debe permitir bloquear cuenta si no existe bloqueo previo del mismo vendedor.
- Debe permitir resolver mediación con documento adjunto.
- Debe permitir reactivar una cuenta bloqueada con documento acreditador.

### CA-07: Mensajería y notas

- Debe permitir agregar, editar y eliminar mensajes de mediación.
- Debe diferenciar mensajes y notas por tipo operativo.
- Debe mostrar historial de mensajes o notas en un panel dedicado.
- Debe mantener la conversación como un espacio minimalista de trabajo.

### CA-08: Casos resueltos y cuentas bloqueadas

- Debe mostrar el histórico de mediaciones resueltas con documento adjunto.
- Debe mostrar cuentas bloqueadas activas.
- Debe permitir ver el documento acreditador de la resolución.
- Debe permitir revisar el caso resuelto o bloqueado desde sus acciones.

### CA-09: Alertas y boletas

- Debe mostrar alertas por severidad.
- Debe permitir marcarlas como revisadas.
- Debe permitir escalarlas a mediación.
- Debe mostrar seguimiento de boletas pendientes.
- Las acciones deben quedar registradas en la bitácora.

### CA-10: Bitacora

- Debe mostrar acciones relevantes del area.
- Debe permitir filtrar por usuario, modulo y rango de fechas.
- Debe mostrar detalle del registro seleccionado.

## 6. Diseño

- Mantener una interfaz operativa, clara y densa.
- Priorizar tablas, paneles y acciones directas.
- Evitar elementos invasivos en la vista de mediación.
- Mantener consistencia entre listados, modales y detalles.

## 7. Consideraciones técnicas

- El frontend vive en `frontend/src/components/*` y `frontend/src/pages/*` para el area de confianza.
- El backend expone endpoints para dashboard, sellers, validations, mediations, alerts, receipts, audits y files.
- Las vistas actuales se nutren de datos reales del backend o de respuestas de respaldo durante el arranque.
- La mediacion usa estados `ESPERANDO_VENDEDOR`, `ESCALADO`, `EN_MEDIACION`, `RESUELTA` y `CERRADA`.
- El vendedor usa estados `APROBADO`, `EN_REVISION` y `SUSPENDIDO`.

## 8. Definición de terminado

- La ruta `/confianza` muestra las seis vistas actuales.
- Vendedores, Validaciones, Mediaciones, Alertas y Bitacora reflejan la logica actual del sistema.
- El resumen operativo coincide con los totales del backend.
- Los cambios sensibles quedan trazables y las vistas de detalle siguen siendo accionables.
- La documentacion `spec.md` y `plan.md` coincide con el estado actual del area.
