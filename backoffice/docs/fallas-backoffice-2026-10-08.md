# Fallas del backoffice encontradas el 8 de octubre de 2026

Recorrido completo de las pantallas contra el backend, hecho para escribir
[manual-backoffice.md](manual-backoffice.md). El manual describe cómo funciona hoy cada pantalla y
advierte de estas fallas con recuadros "Ojo". Al corregir una falla, se quita el "Ojo" del manual.

Las fallas con efecto contable o tributario (K a W) están en
[contabilidad-tributaria.md](contabilidad-tributaria.md), §9.3. Aquí solo se repite la más grave.

Las rutas son relativas a `frontend/src` (FE) o a `backend/src/main/java/com/repuestop/backend`
(BE) del monorepo. Las líneas son las del 8 de octubre.

## Prioridad alta: pueden causar un daño real

| # | Área | Falla | Dónde |
|---|---|---|---|
| A1 | Pago a proveedores | **Corregido el 8-oct** (también en captadores). **"Procesar pago" marca como pagados todos los retiros pendientes del momento**, no los exportados al banco. Hallazgo K de la guía contable. Propuesta: que el pago reciba los ids del Excel exportado (o el id de la exportación `NominaService`) y solo marque esos | FE `modules/administration/PagoProveedoresPage.tsx:207-271`; BE `AdministracionContableService.payWithdrawals` |
| A2 | Validaciones | **Corregido el 8-oct:** el botón se llama "Rechazar y eliminar" y pide confirmación. **"Eliminar solicitud" (el rechazo) no pide confirmación** y es irreversible: borra la verificación y anonimiza al usuario. Además envía el id sintético del documento en vez del `verificationId` | FE `components/validations/ValidationsPage.tsx:515-521, 1063-1071`; BE `ValidacionBackofficeService.java:312-349, 488-498` |
| A3 | Campana | **Corregido el 8-oct.** Las alertas tributarias (`ALERTA_TRIBUTARIA_*`, `TRIBUTARIO`) no son "importantes" en el catálogo: con la preferencia "Importantes" no suben el contador ni mandan push | BE `NotificacionCatalogo.java:73-91` |
| A4 | Mediaciones / Validaciones | Una apelación de tienda suspendida aparece en Validaciones ("Reingreso por Apelación") y en Bloqueos. Aprobar desde Validaciones reabre la tienda pero no restaura sus productos ni cierra el bloqueo | BE `PerfilProveedorService.java:531-584` |
| A5 | Soporte | Los tickets creados desde el backoffice ("Crear ticket" y el widget de ayuda) quedan a nombre del operador conectado: los avisos le llegan a él, no al cliente | FE `api/client.ts:77`; BE `TicketSoporteController.java:86-92` |
| A6 | Soporte | Los chats de carga de inventario no avisan a la tienda cuando soporte responde | BE `ChatSoporteCargaService` |

## Prioridad media: confunden o esconden información

| # | Área | Falla | Dónde |
|---|---|---|---|
| M1 | Campana | Todas las notificaciones muestran "Ver detalle en Pedidos →", aunque lleven a Cumplimiento SII u otra pantalla | FE `components/layout/NotificationBell.tsx:131` |
| M2 | Validaciones | Una solicitud "Por corregir" deja los tres botones deshabilitados sin explicar por qué | FE `ValidationsPage.tsx:404, 1074-1084` |
| M3 | Validaciones | "Aprobar" no espera a la consulta tributaria; si aún carga o falla, se habilita y el backend rechaza. El mensaje del backend manda a Cumplimiento SII, aunque la verificación ya se registra en Validaciones. Registrar la verificación no muestra éxito | FE `ValidationsPage.tsx:412-415`; BE `SituacionTributariaService.java:441` |
| M4 | Validaciones | El filtro "Rechazado" siempre queda vacío, porque el rechazo borra la verificación | FE `ValidationsPage.tsx`; BE `ValidacionBackofficeService.java:334-342` |
| M5 | Confianza | La sugerencia "Ver tiendas" lleva a Vendedores con `?status=SUSPENDIDO`, pero esa pantalla no lee la URL y solo muestra aprobadas | FE `components/dashboard/trust.insights.ts:94`; `components/sellers/SellersPage.tsx:182-186` |
| M6 | Confianza | Alertas y Bitácora no están en el menú de escritorio | FE `components/layout/navConfig.ts:53-64` |
| M7 | Pago a proveedores | **Corregido en parte el 8-oct:** el aviso ya no habla de "este rango" y el modal no cuenta los retenidos. El aviso dice "Mostrando retiros solicitados dentro de este rango", pero el filtro no tiene fecha de inicio: aparecen todos los pendientes. El conteo del modal incluye los retenidos | FE `PagoProveedoresPage.tsx:193, 437, 1077` |
| M8 | Pago a proveedores | El frontend da por completo el documento de un socio con tipo, RUT y archivo; el backend exige además razón social, correo y detalle. El error sale como "Se procesó parcialmente", pero no se procesó nada (es transaccional) | FE `PagoProveedoresPage.tsx:224` |
| M9 | Pago a proveedores | El mensaje BCI del socio ("Anticipo de Dividendos " + nombre) pasa los 30 caracteres y no se recorta | BE `NominaBciExcelBuilder.java:133-137` |
| M10 | Liquidaciones | "Registrar envío" y "Documento registrado exitosamente / El envío fue registrado correctamente" dicen que se envió, pero el correo sale al pagar. La vista previa muestra esos textos también al solo consultar | FE `AdminFinancePage.tsx:4211-4237` |
| M11 | Liquidaciones | **Corregido el 8-oct.** "Completar boleta o factura" abre en modo edición sin exigir folio, fecha ni PDF: se puede guardar incompleto | FE `AdminFinancePage.tsx:1535, 1618` |
| M12 | Liquidaciones | Los grupos de "En liquidación" dependen del rango activo (por fecha de compra): un retiro con ventas de meses anteriores aparece parcial | FE `AdminFinancePage.tsx:1061-1105` |
| M13 | Pedidos | La opción "Finalizado" del filtro y la barra del Resumen llevan a una tabla siempre vacía, porque la vista excluye los finalizados | FE `AdminFinancePage.tsx:882` |
| M14 | Pedidos | `?criticidad=` deja un filtro invisible que no se puede quitar sin recargar | FE `AdminFinancePage.tsx:665, 680-681` |
| M15 | Pedidos | El "Historial de Estados" es ficticio: siempre una sola entrada "Registro Inicial" | BE `AdministracionContableService.java:248-259` |
| M16 | Pedidos | Si se entra a Liquidaciones → Liquidado y luego a Pedidos, probablemente se ve la tabla de pagos (estado compartido). Confirmar en el navegador | FE `AdminFinancePage.tsx:2705-2714` |
| M17 | Pago a captadores | Rechazar un retiro de captador no le envía correo ni notificación | BE `CaptadorService.java:449` |
| M18 | Soporte | "Asignado a" se guarda en `localStorage`: los demás operadores no lo ven | FE `modules/support/SupportTicketDetailModal.tsx:100, 146-167` |
| M19 | Soporte | Si falla "Comentar", no hay aviso | FE `SupportTicketDetailModal.tsx:385-386` |
| M20 | Soporte | La sugerencia dice que un chat sin respuesta de soporte se cierra a las 24 h; en realidad se cierra solo cuando soporte respondió y la tienda no contestó | FE `modules/support/support.insights.ts:66` |
| M21 | Soporte | "Fuera de plazo" lleva a todos los Abiertos; "Urgentes activos" cuenta Crítica + Alta (y defectos QA), pero filtra solo Crítica; el estado "SLA vencido" nunca se asigna | FE `SupportPage.tsx`; BE `TicketSoporteBackofficeService.java:161-162` |

## Prioridad baja: detalles

| # | Área | Falla | Dónde |
|---|---|---|---|
| B1 | Validaciones | Errata "POR CORREGUIR" en la píldora de estado | FE `ValidationsPage.tsx:109` |
| B2 | Validaciones | El botón "?" de ayuda no hace nada | FE `ValidationsPage.tsx:532` |
| B3 | Mediaciones | "Guardar borrador" no tiene acción; "Historial de reportes" del panel abre reportes de usuarios, no notas; el texto de ayuda del filtro de estado nunca cambia | FE `mediations/MediationDetail.tsx:1375-1405`; `MediationDetailPanel.tsx:158-160` |
| B4 | Fechas | Vendedores muestra "Fecha de ingreso" y "Creado el" con `lastActivityAt`; Casos resueltos muestra "Fecha resolución" con `createdAt`, y sus columnas "Resumen" y "Resolución" repiten el texto | FE `sellers/SellerTable.tsx:101`; `MediationResolvedTable.tsx:100` |
| B5 | Bitácora y Alertas | Las tarjetas y contadores cuentan solo la página visible; en escritorio no hay fecha "Hasta" | FE `components/audit/AuditPage.tsx`; `components/alerts/AlertsPage.tsx` |
| B6 | Permisos | "N/4 seleccionados" no puede llegar a 4 (las ranuras de Soporte son excluyentes); el aviso de correo no enviado muestra "Revisa RESEND_API_KEY en dev" | FE `pages/PermissionsConfigPage.tsx` |
| B7 | Feedback | Si aprobar para el home falla, no hay aviso | FE `components/feedback/FeedbackPage.tsx` |
| B8 | Administración | El subtítulo muestra "active" (estado en inglés) | BE `AdministracionContableService.java:202` |
| B9 | Administración | Textos engañosos: "Todas las ganancias" muestra el 70 %; "Ganancia: Monto pagado menos la pasarela" omite el IVA; "Total acumulado por solicitar" suma la venta total; "N liquidaciones pagadas" cuenta pagos; se mezclan "fichas" y "Monedas" | FE `AdminFinancePage.tsx` |
| B10 | Administración | El modal "Registrar pedido" y la importación CSV/Excel no tienen botón que los abra (código muerto) | FE `AdminFinancePage.tsx:1443-1479, 1941-2077, 3881-3901` |
| B11 | Retiros de socios | La columna "Saldo socio" repite el saldo actual en todas las filas | FE `AdminFinancePage.tsx` |
| B12 | Pago a proveedores | "Detalle de Pago" muestra "No se pudo cargar la información del retiro." mientras carga | FE `PagoProveedoresPage.tsx:978-981` |
| B13 | Pago a captadores | La ronda se agrupa por los 10 primeros caracteres de la fecha: un pago nocturno en UTC cae en el día siguiente | FE `PagoCaptadoresPage.tsx:25-27` |
| B14 | Cumplimiento SII | **Corregido el 9-oct:** la bandeja pasó a Confianza → Cumplimiento tributario y su "Actualizar" refresca también la cola. "Actualizar" no refrescaba la cola de certificados | FE `modules/administration/CumplimientoSiiPage.tsx:327` |
| B15 | Soporte | El detalle del ticket muestra prioridades y categorías en inglés ("Highest", "Bug", "Task de soporte"); el widget registra como "App Mobile RepuesTop" los reportes hechos desde /soporte y muestra errores técnicos; Reportes QA oculta los resueltos después de paginar | FE `SupportTicketDetailModal.tsx:30-43`; `components/shared/HelpSupportWidget.tsx:322-354`; `SupportPage.tsx:1017-1019` |
| B16 | Soporte | Panel QA antiguo sin mostrar, con botón "Corregido", y reglas de estado QA repetidas | FE `SupportPage.tsx:276-596` |
