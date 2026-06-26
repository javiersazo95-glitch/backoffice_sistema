# Plan de implementacion: gestion-confianza

## 1. Resumen tecnico

Gestion de Confianza vive en `/confianza/*` y usa el shell autenticado del backoffice.

El area se alimenta de endpoints backend para dashboard, sellers, validations, mediations, alerts, receipts, audits y files.

## 2. Estrategia de implementacion

- Mantener el area separada por vistas, pero dentro del mismo backoffice.
- Hidratar primero el resumen y luego profundizar en listados y modales.
- Reutilizar el modelo de vendedor como centro del seguimiento operativo.
- Sostener mediaciones, alertas y validaciones con datos del backend y mutaciones claras.
- Mantener la trazabilidad de acciones sensibles en bitacora.
- Evitar mezclar confianza con administracion financiera o soporte.

## 3. Tareas

### T-01: Resumen

- Mostrar el pulso operativo con confianza global, vendedores activos, casos abiertos y alertas criticas.
- Consumir métricas y paneles de preview desde backend.
- Mostrar validaciones, mediaciones, escalaciones y boletas pendientes.

### T-02: Vendedores

- Mantener la tabla de vendedores aprobados.
- Mantener busqueda por tienda, RUT y ciudad.
- Mantener filtros de vista por mediaciones o escalados.
- Conservar el detalle desplegable y la ficha de vendedor.
- Conservar acceso a documentos, mediaciones y bloqueos disciplinarios.

### T-03: Validaciones

- Listar validaciones pendientes, aprobadas y rechazadas.
- Agrupar por vendedor cuando corresponda.
- Permitir aprobar, corregir o rechazar.
- Sincronizar los cambios con el vendedor asociado y con la trazabilidad del area.

### T-04: Mediaciones

- Mantener estados, filtros y acciones de mediacion.
- Inicializar casos escalados.
- Revisar mediaciones en curso con mensajeria interna.
- Bloquear cuenta cuando no exista bloqueo previo.
- Resolver o reactivar con documento acreditador.

### T-05: Alertas y boletas

- Mantener la lista de alertas por severidad.
- Permitir marcar revisadas y escalar a mediacion.
- Mantener el panel de seguimiento de boletas pendientes.

### T-06: Bitacora

- Registrar acciones sensibles y movimientos relevantes del area.
- Mantener filtros y detalle lateral del registro.

### T-07: QA y consistencia

- Verificar que cada vista coincide con el SPEC.
- Mantener tipos y contratos alineados con el backend.
- Actualizar documentación cuando cambien estados, vistas o acciones.

## 4. Uso de IA

- La IA puede asistir en ajustes de tablas, modales y mutaciones.
- Antes de ampliar alcance, validar que no se rompa la separacion entre confianza, soporte y administracion.
- Usar `qa-ai-validator` con `gestion-confianza` para revisar cumplimiento.

## 5. Notas técnicas

- Los estados de mediacion vigentes son `ESPERANDO_VENDEDOR`, `ESCALADO`, `EN_MEDIACION`, `RESUELTA` y `CERRADA`.
- Los estados de vendedor vigentes son `APROBADO`, `EN_REVISION` y `SUSPENDIDO`.
- Los listados de sellers muestran solo el segmento operativo actual y la ficha del vendedor puede exponer tickets, mediaciones, riesgos y documentos.
- El backend ya soporta resoluciones con documento adjunto y reactivaciones.

## 6. Riesgos / pendientes

- Riesgo: alejar la UI del contrato real del backend. Mitigacion: sostener el SPEC como espejo del comportamiento actual.
- Riesgo: mezclar tickets externos con mediaciones internas. Mitigacion: mantenerlos como contexto, no como objetivo principal.
- Riesgo: introducir nuevas acciones sin permisos reales. Mitigacion: mantener la seguridad como responsabilidad del backend.
- Pendiente: profundizar la bitacora y los permisos por rol cuando el producto lo requiera.
