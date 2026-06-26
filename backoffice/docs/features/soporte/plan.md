# Plan de Implementación: Módulo de Soporte MVP

Este documento describe la hoja de ruta y las tareas técnicas para implementar el módulo de Soporte Técnico MVP de acuerdo con las reglas de negocio de la startup (2 socios, MVP simple, sin tocar dinero ni disputas de pedidos).

## 1. Resumen Técnico

- **Ruta Frontend**: `/soporte` conectada a `frontend/src/modules/support/SupportPage.tsx`.
- **Backend API**: Endpoints bajo `/support/*` para la administración de tickets y carga del workspace.
- **Entidades de datos**: El modelo `Ticket` de soporte maneja prioridad, categoría (Falla Técnica, Ayuda, Consulta) y estado, sin acoplamiento a pedidos o devoluciones monetarias.

## 2. Estrategia del MVP

Para ajustarse al contexto de startup (operación simple realizada por los 2 socios):
1. **Evitar Sobrediseño**: No implementar flujos de chat en tiempo real ni integraciones complejas de correo externo.
2. **Formulario de Registro Simple**: Permitir la creación de tickets directamente desde el backoffice cuando el equipo interno detecta fallas.
3. **Bandeja Unificada**: Una sola tabla con filtros básicos por prioridad y categoría para responder y resolver incidencias rápidamente.
4. **Diferenciación Estricta**: Quitar del panel de soporte las métricas asociadas a "boletas pendientes" (eso corresponde a finanzas/confianza) y enfocarse en tickets de fallas de la aplicación.

## 3. Tareas de Desarrollo

### T-01: Actualización del Modelo y API en Backend
- Asegurar que la entidad `Ticket` en Java soporte la categorización: `FALLA_TECNICA`, `AYUDA`, `CONSULTA`.
- Modificar el endpoint de `/support/workspace` para devolver métricas enfocadas en incidencias (Nuevos, Abiertos, Urgentes, Resueltos) y no incluir boletas de liquidación.
- Proveer endpoints CRUD básicos para tickets de soporte.

### T-02: Rediseño del Frontend (Workspace y Dashboard)
- Limpiar el panel de métricas de `SupportPage.tsx` eliminando la referencia a "boletas pendientes" y reemplazándola por "Tickets Resueltos" o "SLA Vencidos" de soporte técnico.
- Mostrar la lista de tickets técnicos clasificados de forma visualmente atractiva (con etiquetas de prioridad y colores según categoría).

### T-03: Implementación del Formulario de Creación de Ticket
- Habilitar el botón "Crear ticket" en la cabecera.
- Crear un modal o formulario simple que permita ingresar Título, Descripción, Categoría, Prioridad y Reportante (Usuario / Interno).
- Integrar la llamada al API de creación e invalidar la query del listado para reflejarlo al instante.

### T-04: Gestión de Estado de Tickets
- Habilitar un flujo sencillo para resolver o cerrar tickets desde la interfaz.
- Permitir agregar notas o explicaciones internas de la solución antes de cerrar el caso.

### T-05: QA y Validación de Reglas de Negocio
- Comprobar que en ninguna sección de soporte se pueda iniciar reembolsos o transacciones financieras.
- Asegurar que el SLA se calcule como tiempo restante y no dependa del flujo de 3 días de mediación de pedidos.

## 4. Notas de Implementación

- El MVP de soporte debe completarse con código limpio y componentes reutilizables.
- Los estados de los tickets se limitarán a: `NUEVO`, `ABIERTO`, `RESUELTO`.
