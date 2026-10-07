# Qué significa cada número de los resúmenes (guía para moderadores)

Los tres resúmenes de área (Administración Contable, Soporte, Mediación y Confianza) muestran
primero **lo que hay que atender ahora**, luego **sugerencias del día** y después el detalle.
Reglas comunes:

- Cada tarjeta se puede hacer clic: lleva a la pantalla donde se resuelve, ya filtrada.
- El icono **i** de cada tarjeta explica qué hacer con ese número.
- Si una cifra no pudo cargarse se muestra **—** y un botón **Reintentar**. Nunca verás un "0"
  falso por un error de conexión.
- Las tarjetas en **rojo** son las que perjudican a alguien que ya pagó o que está esperando.

---

## Mediación y Confianza (`/confianza`)

| Tarjeta | Qué cuenta | Qué hacer |
|---|---|---|
| Mediaciones con más de 5 días | Casos en mediación (tienda no bloqueada) abiertos hace 5 días o más | Resolver a favor de uno o bloquear la tienda si no responde |
| Alertas críticas sin revisar | Señales de riesgo de severidad crítica que nadie marcó como revisadas | Leer la evidencia, marcar revisada y, si amerita, escalar a mediación |
| Validaciones pendientes | Tiendas nuevas con documentos sin revisar (se indica cuántas llevan más de 3 días) | Aprobar, pedir corrección o rechazar |
| Boletas de venta por vencer | Ventas finalizadas cuya boleta el vendedor no ha subido (se indica cuántas ya vencieron) | Pedirla a la tienda y marcar el seguimiento al recibirla |
| Reportes de usuarios hoy | Reportes enviados hoy (hora de Chile) sobre anuncios, productos, tiendas o chats | Si varios apuntan a la misma tienda, abrir alerta o mediación |
| Tiendas suspendidas | Tiendas que hoy no pueden vender | Revisar apelaciones y fecha de fin en Mediaciones, pestaña Bloqueos |

El anillo "Confianza X%" es el promedio del puntaje de confianza de las tiendas aprobadas. Es
informativo, no requiere acción.

Umbrales: una mediación es "Alta" a los 2 días y "Crítica" a los 5. Una validación se marca en
espera larga a los 3 días.

---

## Soporte (`/soporte`)

| Tarjeta | Qué cuenta | Qué hacer |
|---|---|---|
| Sin responder | Tickets que nunca recibieron respuesta de soporte (estado Abierto); se indica cuántos llevan más de 24 h | Responder primero los más antiguos (lista de abajo) |
| Fuera de plazo | Sin responder y con el plazo de su categoría vencido: 24 h falla técnica, 48 h solicitud de ayuda, 72 h consulta | Responder aunque sea para avisar que se está revisando |
| Urgentes activos | Tickets abiertos con prioridad crítica o alta | Si es de pago o acceso, avisar a infraestructura además de responder |
| Chats de carga esperando | Vendedores que pidieron ayuda con la carga de inventario y esperan a soporte | Responder en el chat; se cierra solo 24 h después de tu respuesta si el vendedor no contesta |
| Defectos QA pendientes | Fallas reportadas por QA que no están resueltas (se indica cuántas son críticas) | Confirmar si afectan a usuarios reales y priorizar |
| Resueltos por cerrar | Tickets marcados resueltos que se cierran solos a los 7 días | Nada, salvo que el usuario vuelva a escribir |

El anillo "Respondidos a tiempo" mide, de los tickets creados en los últimos 30 días que ya
tienen respuesta o vencieron, qué porcentaje recibió su primera respuesta dentro del plazo. No
cuenta los tickets de QA.

---

## Administración Contable (`/administracion`)

### Pendientes ahora (no dependen del rango de fechas)

| Tarjeta | Qué cuenta | Qué hacer |
|---|---|---|
| Pedidos atrasados | Pedidos pagados que superaron el tiempo máximo de su etapa: 48 h pendientes, 72 h preparando, 120 h enviados, 72 h recibidos sin finalizar (se indica cuántos están por llegar al límite) | Contactar al vendedor o registrar la incidencia |
| Retiros por pagar | Retiros solicitados por vendedores (monto total); cuántos no tienen boleta/factura de liquidación y cuántos están retenidos por tienda suspendida | Registrar el documento faltante y generar la nómina BCI el jueves |
| Ventas por liquidar | Ventas finalizadas cuyo pago al vendedor aún no se solicitó, con el monto acumulado | Sin acción inmediata; muestra cuánto dinero de terceros está en custodia |
| Recargas sin documento | Compras de Monedas pagadas sin boleta o factura emitida | Emitirla en el Portal MIPYME y subirla a la recarga |
| Gastos sin comprobante | Gastos registrados sin archivo adjunto | Subir el comprobante desde Caja y gastos |

### Resultado del periodo (rango elegido arriba a la derecha; abre en el mes actual)

| Tarjeta | Fórmula |
|---|---|
| Ventas | Suma de lo pagado por los compradores en los pedidos creados en el rango (incluye envío) |
| Ganancia neta | Comisión de los pedidos finalizados en el rango + venta de Monedas, descontados IVA y comisión de Flow. Es la misma cifra que la vista Caja |
| Caja operativa | 70% de la ganancia neta menos los gastos del rango. En rojo si los gastos superan la caja |
| Socios | 30% de la ganancia neta menos los retiros de socios del rango (pagados y pendientes) |

El ciclo de pago a proveedores y socios va de jueves a miércoles: los retiros solicitados en la
semana se pagan el jueves siguiente con la nómina BCI.
