# Especificación Funcional (Spec): Sistema de Soporte MVP

Este documento define la especificación para el módulo de Soporte de RepuesTop, alineado con las reglas de negocio de la startup y diferenciándolo claramente del módulo de Confianza y Mediación.

## 1. Contexto y Diferenciación Operativa

RepuesTop divide sus operaciones críticas en dos flujos independientes:

| Característica | Confianza y Mediación | Soporte Técnico (MVP) |
| :--- | :--- | :--- |
| **Enfoque Principal** | Registro de tiendas, validaciones de documentos y mediaciones de pedidos. | Fallas técnicas, solicitud de ayuda y consultas sobre el funcionamiento de la app. |
| **Disparador del flujo** | Reclamo formal de un comprador sobre un pedido ya pagado. | Reportes de usuarios (formulario) o alertas del equipo interno (monitoreo). |
| **Regla de Escalado** | El vendedor tiene 3 días hábiles para responder, de lo contrario escala al mediador. | SLA básico por prioridad del ticket, sin implicación directa de disputas de compras. |
| **Política Financiera** | La startup **no emite reembolsos ni maneja dinero** (estipulado en términos y condiciones). | No toca pedidos, transacciones, liquidaciones ni dinero de compras. |
| **Alcance Técnico** | Transaccional (pedidos, RUT, comprobantes de pago, disputas). | Funcional y operativo de la plataforma RepuesTop. |

Como RepuesTop es una startup en etapa inicial con solo 2 socios fundadores, se prioriza un MVP simple y directo que permita centralizar y dar seguimiento a los tickets esenciales de funcionamiento sin complejidades innecesarias.

## 2. Problema

El equipo de fundadores y operarios necesita una bandeja centralizada de Soporte Técnico para atender incidencias operativas y fallas reportadas de la aplicación, sin mezclar esta cola de trabajo con las disputas de pagos o las validaciones de documentos legales de los vendedores.

## 3. Objetivo del MVP de Soporte

1. **Bandeja de Tickets Centralizada**: Permitir la visualización y gestión de tickets clasificados por tipo (Falla Técnica, Ayuda, Consulta).
2. **Creación de Tickets Internos/Externos**: Habilitar un formulario sencillo para registrar incidencias detectadas por el equipo o reportadas por usuarios.
3. **Métricas de Rendimiento Clave**: Visualizar de forma rápida la cantidad de tickets Nuevos, Abiertos, Urgentes y cerrados para que los 2 socios puedan gestionar la carga de soporte eficientemente.
4. **Separación de Datos**: Garantizar que las vistas de Soporte no muestren información financiera o de mediación de compras.

## 4. Flujo de Usuario (Soporte MVP)

1. **Acceso**: El operador/socio ingresa al módulo de Soporte desde la barra lateral.
2. **Dashboard de Resumen**: Visualiza métricas básicas de soporte técnico (Tickets Nuevos, Abiertos, Urgentes, Cerrados).
3. **Listado de Tickets**: Explora los reportes técnicos organizados por prioridad y fecha de creación.
4. **Gestión de Incidencias**: Selecciona un ticket, revisa el detalle del error/ayuda solicitado y registra respuestas o cambia el estado.
5. **Creación**: El operario registra un ticket si detecta una falla técnica durante su sesión de revisión.

## 5. Criterios de Aceptación (MVP)

### CA-01: Clasificación de Tickets
- Los tickets deben categorizarse estrictamente en:
  - **Falla Técnica**: Errores en la app, caídas de servicios, bugs visuales.
  - **Solicitud de Ayuda**: Usuarios que no logran completar un flujo.
  - **Consulta de Funcionamiento**: Dudas de uso general de RepuesTop.
- Ningún ticket de soporte debe asociarse a montos de dinero de pedidos ni a reembolsos.

### CA-02: Reporte del Ticket
- Se debe permitir ingresar:
  - Título/Asunto corto de la incidencia.
  - Descripción detallada de la falla o solicitud.
  - Prioridad (Baja, Media, Alta, Crítica).
  - Categoría (Falla Técnica, Ayuda, Consulta).
  - Reportado por (Usuario final o Equipo interno).

### CA-03: Visualización de Métricas del Workspace
- El panel de resumen de soporte debe consumir el endpoint `GET /support/workspace`.
- Debe renderizar las métricas correctas de incidencias técnicas (Nuevos, Abiertos, Urgentes) sin incluir métricas financieras o de boletas en esta sección.

### CA-04: Control de Acceso y Roles
- Solo los administradores u operarios del backoffice pueden gestionar el estado de los tickets de soporte.

## 6. Consideraciones Técnicas

- **Frontend**: El componente inicial reside en `frontend/src/modules/support/SupportPage.tsx` accesible vía la ruta `/soporte`.
- **Backend**: El backend expone endpoints bajo `/support` (como `/support/workspace`). El modelo de datos de soporte (`Ticket`) no debe vincularse a reembolsos financieros.
- **MVP**: La interfaz debe proveer controles sencillos e intuitivos adecuados para la operación directa de los 2 socios de la startup.
