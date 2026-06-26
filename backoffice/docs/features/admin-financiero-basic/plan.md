# Plan de implementación: admin-financiero-basic

## 1. Resumen técnico

Administracion Contable vive en `frontend/src/modules/administration` y se monta en `/administracion` dentro del backoffice autenticado.

El modulo consume dos entradas de backend:

- `GET /administration/workspace` para identificar el area, las vistas y el estado operativo.
- `GET /administration/bootstrap` para hidratar pedidos, gastos, retiros, actividad, filtros, paginacion y notas iniciales.

## 2. Estrategia de implementación

- Mantener el modulo como workspace unico de administracion financiera.
- Sostener el estado local como mecanismo principal de interaccion mientras el backend madura.
- Separar la logica por vistas: Resumen, Pedidos, Liquidaciones, Gastos y Retiros.
- Mantener importacion de pedidos, historiales, notas, documentos y reportes dentro del mismo contexto operativo.
- Usar CSV como flujo local vigente y dejar Excel preparado en la interfaz.
- Recalcular metricas desde el filtro activo o desde la seleccion.
- Evitar expandir el modulo hacia contabilidad completa o flujo bancario real.

## 3. Tareas

### T-01: Workspace y navegación

- Mantener el acceso a `/administracion`.
- Resaltar la vista activa desde la ruta.
- Mostrar el workspace backend cuando esté disponible.

### T-02: Resumen

- Calcular ventas, comisión, caja, gastos, saldo de socios y saldo operacional.
- Mostrar focos recomendados y salud del periodo.
- Sostener los accesos rapidos a liquidaciones, gastos y retiros.

### T-03: Pedidos

- Mantener busqueda, filtros de fecha y paginacion.
- Permitir cambio manual de estado.
- Registrar historial de cambios por pedido.
- Soportar notas por pedido.
- Mantener la importacion CSV con validacion de columnas y errores por fila.

### T-04: Liquidaciones

- Derivar liquidaciones desde pedidos completados.
- Mantener cálculo de comisión y monto liquidado.
- Sostener selección masiva para metricas.
- Permitir emisión de documento asociado a la liquidacion.

### T-05: Gastos

- Permitir crear, editar y eliminar gastos.
- Validar comprobantes y previsualizacion.
- Mantener exportacion del listado filtrado.
- Sostener metricas del periodo visible.

### T-06: Retiros

- Mostrar el historial de retiros por socio.
- Mantener el calculo de saldos disponibles.
- Permitir registrar nuevos retiros y ver su detalle.

### T-07: QA y consistencia

- Verificar que la interfaz coincide con `spec.md`.
- Mantener tipos, constantes y datos mock sincronizados con la UI.
- Actualizar la documentacion cuando cambie el flujo real de importacion, retiro o documento.

## 4. Uso de IA

- La IA puede asistir en refactors del workspace, filtros, formularios y tablas.
- Cualquier cambio debe respetar el flujo real del bootstrap y del workspace backend.
- Antes de cerrar un cambio, validar la vista con `qa-ai-validator` usando `admin-financiero-basic`.

## 5. Notas técnicas

- La ruta local vigente para importacion de pedidos procesa CSV; Excel queda señalado en la UI como soporte preparado.
- Las notas, historiales y reportes son parte del flujo operativo actual.
- Los retiros se calculan sobre el periodo filtrado y pueden dejar saldo negativo por socio.
- El modulo sigue siendo local-first, con el backend como fuente de bootstrap y workspace.

## 6. Riesgos / pendientes

- Riesgo: ampliar el area hacia contabilidad completa. Mitigacion: mantener el alcance operativo actual.
- Riesgo: desalinear el CSV local con el bootstrap backend. Mitigacion: conservar el mismo esquema de columnas y estados.
- Riesgo: mover la logica de retiros a una capa bancaria inexistente. Mitigacion: mantenerla como registro interno.
- Pendiente: conectar importacion Excel real y persistencia completa del historial.
