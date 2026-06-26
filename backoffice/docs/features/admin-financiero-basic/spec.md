# Feature: admin-financiero-basic

## 1. Contexto

Administracion Contable es el area interna de RepuesTop para operar pedidos, liquidaciones, gastos y retiros desde el backoffice.

La ruta actual vive en `/administracion` dentro del shell autenticado del backoffice y se alimenta desde el backend con `/administration/workspace` y `/administration/bootstrap`.

## 2. Problema

El equipo necesita una vista operativa para revisar el flujo financiero del marketplace sin convertir el backoffice en un sistema contable completo.

Hoy el sistema debe cubrir la trazabilidad de pedidos, comisiones, liquidaciones, gastos y retiros de socios, manteniendo el trabajo manual simple y auditable.

## 3. Objetivo

Entregar un workspace financiero con:

- Resumen del periodo.
- Gestión de pedidos importados y editables.
- Liquidaciones derivadas de pedidos completados.
- Registro y edicion de gastos con comprobante.
- Seguimiento de retiros de socios.
- Historial de actividad, estados y notas.

## 4. Flujo de usuario

1. El usuario interno entra al backoffice.
2. Selecciona Administracion Contable.
3. Revisa el resumen del periodo.
4. Navega entre Pedidos, Liquidaciones, Gastos y Retiros.
5. Filtra por rango de fechas y texto segun la vista.
6. Importa pedidos desde CSV o prepara importacion Excel.
7. Cambia estados de pedidos o liquidaciones cuando corresponde.
8. Registra gastos, retiros y notas operativas.
9. Consulta historial, comprobantes y reportes generados por la vista.

## 5. Criterios de aceptación

### CA-01: Navegacion y workspace

- Debe existir acceso a Administracion Contable desde el backoffice.
- Debe mostrar las vistas Resumen, Pedidos, Liquidaciones, Gastos y Retiros.
- La vista activa debe quedar marcada visualmente.
- La vista debe consumir el workspace real del backend cuando exista.

### CA-02: Vista Resumen

- Debe mostrar el saldo operacional del periodo.
- Debe mostrar ventas, comisión, caja, gastos y saldo para socios.
- Debe mostrar el estado de salud del periodo con foco recomendado.
- Debe mostrar el flujo de caja 70% caja y 30% socios.
- Debe mostrar el mejor frente comercial, el historial de gastos y la distribución de socios.
- Debe mostrar accesos rapidos a Liquidaciones, Gastos y Retiros.
- Debe resumir el estado de pedidos por situación operativa.

### CA-03: Vista Pedidos

- Debe permitir buscar por ID, comprador, vendedor o producto.
- Debe permitir filtrar por rango de fechas.
- Debe mostrar paginacion y selector de cantidad por pagina.
- Debe permitir cambiar el estado de un pedido manualmente.
- Debe guardar historial de cambios de estado.
- Debe permitir registrar y consultar notas por pedido.
- Debe permitir importar pedidos desde CSV.
- La importacion Excel debe quedar preparada a nivel de interfaz, aunque el MVP local trabaje con CSV.
- Debe mostrar resumen de la importacion con procesados, importados, actualizados y errores.
- No debe mezclar acciones logisticas ajenas al backoffice financiero.

### CA-04: Importacion de pedidos

- Debe validar extension y estructura del archivo.
- Debe validar las columnas `order_id`, `date`, `buyer_name`, `seller_name`, `product_summary`, `total_amount`, `status` y `updated_at`.
- Debe registrar duplicados como actualizaciones solo cuando el archivo traiga datos mas recientes.
- Debe registrar errores por fila cuando falten campos obligatorios o el estado sea invalido.
- Debe registrar actividad reciente despues de cada importacion.

### CA-05: Vista Liquidaciones

- Debe generar liquidaciones a partir de pedidos completados.
- Debe calcular comision de RepuesTop, monto liquidado y disponible para retiro.
- Debe permitir buscar por ID, vendedor o referencia de pedido.
- Debe permitir seleccionar filas para calcular metricas sobre la seleccion.
- Debe permitir emitir documento asociado a la liquidacion.
- Debe mostrar estado editable de la liquidacion sin alterar el estado del pedido.

### CA-06: Vista Gastos

- Debe listar gastos con categoria, descripcion, monto y comprobante.
- Debe permitir registrar, editar y eliminar gastos.
- Debe validar comprobante PDF, JPG o PNG hasta 5 MB.
- Debe permitir filtrar y exportar el listado visible.
- Debe mostrar total de gastos del periodo seleccionado.
- Debe permitir abrir la previsualizacion del comprobante cuando exista archivo.

### CA-07: Vista Retiros

- Debe mostrar retiros solo de socios.
- Debe calcular saldo disponible para retiro por socio.
- Debe permitir registrar retiros con fecha, beneficiario, motivo y monto.
- Debe mostrar el detalle de un retiro con saldo anterior, saldo actual y saldo del periodo.
- El saldo de un socio puede quedar negativo si el retiro supera lo disponible.

### CA-08: Seleccion, métricas y seguridad

- La seleccion masiva debe existir en Liquidaciones y Gastos.
- Si hay filas seleccionadas, las metricas deben calcularse sobre la seleccion.
- Si no hay filas seleccionadas, las metricas deben calcularse sobre el filtro activo.
- Debe sanitizar textos ingresados por usuario antes de renderizar.
- Las acciones sensibles deben asumir control por permisos cuando exista autenticacion real.

## 6. Diseño

- Mantener una interfaz operativa y densa.
- Priorizar tablas, KPIs y reportes sobre piezas decorativas.
- Mostrar claramente el estado activo y los accesos rapidos del resumen.
- Mantener consistencia con el shell del backoffice.

## 7. Consideraciones técnicas

- El frontend actual vive en `frontend/src/modules/administration/AdminFinancePage.tsx`.
- La fuente de verdad inicial llega desde `GET /administration/bootstrap`.
- El workspace de cabecera llega desde `GET /administration/workspace`.
- La implementación actual mezcla estado local, tablas, filtros, importacion y reportes en un solo modulo React.
- Los pedidos usan historiales de estado y notas.
- Las liquidaciones se calculan desde pedidos completados y comisiones configuradas.
- Los gastos y retiros se manejan como registros manuales.
- Excel queda contemplado en la interfaz, pero la ruta local vigente procesa CSV.

## 8. Definición de terminado

- El workspace financiero está navegable en `/administracion`.
- Resumen, Pedidos, Liquidaciones, Gastos y Retiros reflejan la logica actual.
- Las importaciones registran resumen, errores y actividad.
- Los gastos y retiros pueden administrarse desde la interfaz.
- La documentacion `spec.md` y `plan.md` coincide con el comportamiento actual del modulo.
