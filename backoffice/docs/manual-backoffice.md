# Manual del Backoffice de RepuesTop

Guía para el equipo: qué hay en cada pantalla, qué se hace en ella y cómo se resuelven los trámites
más comunes, paso a paso.

- **Vigente al:** 8 de octubre de 2026 (ambiente de pruebas `dev`). Si una pantalla cambia, se
  actualiza el capítulo que corresponde.
- **Cómo leerlo:** los textos en **negrita** son los que aparecen tal cual en pantalla. Los recuadros
  **Ojo** avisan de algo que hoy puede llevar a error.
- **El porqué tributario** de cada exigencia (factura, folio, notas de crédito, certificado del SII)
  está en [contabilidad-tributaria.md](contabilidad-tributaria.md). Este manual solo explica cómo se
  hace.

## Índice

**Parte I. Lo básico**

1. [Qué es el backoffice](#1-qué-es-el-backoffice)
2. [Entrar y moverse](#2-entrar-y-moverse)
3. [La campana de avisos](#3-la-campana-de-avisos)
4. [Cómo viaja el dinero de una venta](#4-cómo-viaja-el-dinero-de-una-venta)

**Parte II. Gestión de Confianza**

5. [Resumen de Confianza](#5-resumen-de-confianza)
6. [Validaciones](#6-validaciones)
7. [Vendedores](#7-vendedores)
8. [Mediaciones](#8-mediaciones)
9. [Captadores](#9-captadores)
10. [Alertas, Reportes, Feedback y Bitácora](#10-alertas-reportes-feedback-y-bitácora)

**Parte III. Administración Contable**

11. [Resumen contable](#11-resumen-contable)
12. [Pedidos](#12-pedidos)
13. [Liquidaciones](#13-liquidaciones)
14. [Caja y gastos](#14-caja-y-gastos)
15. [Pago a proveedores](#15-pago-a-proveedores)
16. [Pago a captadores](#16-pago-a-captadores)
17. [Cumplimiento SII](#17-cumplimiento-sii)
18. [Retiros de socios](#18-retiros-de-socios)

**Parte IV. Soporte**

19. [Soporte](#19-soporte)

**Parte V. Flujos paso a paso**

- [F1. Aprobar una tienda](#f1-aprobar-una-tienda)
- [F2. Pedir una corrección o rechazar una tienda](#f2-pedir-una-corrección-o-rechazar-una-tienda)
- [F3. Registrar la factura de comisión de un retiro](#f3-registrar-la-factura-de-comisión-de-un-retiro)
- [F4. Pagar los retiros del jueves](#f4-pagar-los-retiros-del-jueves)
- [F5. Documento de una recarga de Monedas](#f5-documento-de-una-recarga-de-monedas)
- [F6. Registrar una nota de crédito](#f6-registrar-una-nota-de-crédito)
- [F7. Verificación semestral de enero y julio](#f7-verificación-semestral-de-enero-y-julio)
- [F8. Resolver una mediación](#f8-resolver-una-mediación)
- [F9. Registrar y pagar el retiro de un socio](#f9-registrar-y-pagar-el-retiro-de-un-socio)
- [F10. Registrar un gasto](#f10-registrar-un-gasto)
- [F11. Atender un ticket de soporte](#f11-atender-un-ticket-de-soporte)

**Parte VI. Lo automático y el calendario**

20. [Alertas diarias](#20-alertas-diarias)
21. [Otras tareas automáticas](#21-otras-tareas-automáticas)
22. [Calendario del equipo](#22-calendario-del-equipo)

**Parte VII. Ayuda**

23. [Problemas frecuentes](#23-problemas-frecuentes)
24. [Glosario](#24-glosario)

---

# Parte I. Lo básico

## 1. Qué es el backoffice

Es la herramienta interna de RepuesTop. Compradores y tiendas usan la app y la web market; el equipo
usa el backoffice para controlar lo que pasa en ellas. Tiene tres áreas:

| Área | Para qué |
|---|---|
| **Administración Contable** | Dinero y documentos: pedidos, comisiones, pagos a tiendas, socios y captadores, gastos, y las obligaciones con el SII |
| **Confianza y Mediación** | Tiendas y personas: aprobar tiendas, resolver reclamos, suspender cuentas, revisar alertas y reportes |
| **Soporte** | Consultas y fallas: tickets de usuarios, chats de carga de inventario y defectos de QA |

Cada persona ve solo las áreas para las que tiene permiso. El **super administrador** ve todo.

## 2. Entrar y moverse

### 2.1 Iniciar sesión

1. Entrar a la dirección del backoffice y elegir la pestaña **Personal de la empresa**. La otra
   pestaña, **Captadores**, es para los captadores, que tienen su propio portal.
2. Escribir el **Correo electrónico** y la **Contraseña**, o usar el botón de Google con la cuenta de
   la empresa.
3. **Mantener sesión iniciada** evita volver a escribir la clave en ese computador.

Si los datos no calzan aparece **Credenciales inválidas. Intente nuevamente.** El mensaje no dice si
la cuenta existe: es a propósito. Para recuperar la clave está **¿Olvidaste tu contraseña?**.

### 2.2 El selector de áreas

Al entrar aparecen tres tarjetas: **Administración Contable**, **Soporte** y **Confianza y
Mediación**. Las que no corresponden a tu permiso dicen **Sin acceso**, con un candado. El super
administrador ve además el botón **Ir a Gestión de Permisos**.

### 2.3 Gestión de Permisos (solo super administrador)

Tiene cuatro pestañas.

**Permisos: invitar a una persona del equipo**

1. Escribir el nombre completo y el correo.
2. Activar al menos un permiso: Administración Contable → Operador; Soporte → Operador **o** QA (son
   excluyentes); Confianza y Mediación → Operador.
3. Pulsar **Enviar invitación**. La persona recibe un correo para activar su cuenta y crear su
   contraseña.

Un correo que ya pertenece a un captador no puede ser del equipo.

**Empleados**

- Lista del equipo con su estado (**Pendiente**, **Aceptado**, **Rechazado**) y sus permisos.
- **Reenviar** repite la invitación.
- La **X** de un permiso lo quita al instante. El lápiz permite editarlos todos.
- La papelera elimina a la persona, salvo que sea super administrador.

**Captadores**

- Activar o desactivar el acceso de un captador, o eliminar su cuenta.
- Eliminar no se puede deshacer. Desactivar conserva su historial.

**Fundador**

- La **Ranura general** está activa mientras queden cupos.
- Cada tienda que se aprueba en ese período recibe la tarifa Fundador (5 % + IVA) durante sus
  primeros meses, hasta llenar el cupo.
- Abajo se puede ver y cambiar la condición de cada tienda.

### 2.4 Moverse dentro de un área

- **En el computador:** el menú de la izquierda lista las pantallas del área.
- **En el celular:** la barra inferior muestra cuatro pantallas y el resto está en **Más**.
- El ícono de la casa vuelve al selector de áreas.
- En el menú de usuario están **Ayuda e Incidencias** (sirve para reportar una falla a Soporte),
  **Cerrar sesión** y, solo para el super administrador, **Retirar dinero** (retiros de socios).

> **Ojo:** en el computador, **Alertas** y **Bitácora** de Confianza no aparecen en el menú.
> - **Alertas** se abre desde las tarjetas del Resumen de Confianza.
> - **Bitácora** se abre en el celular desde **Más**, o escribiendo `/confianza/bitacora` al final de
>   la dirección.

## 3. La campana de avisos

La campana de la barra superior reúne los avisos para el equipo.

- **El número** cuenta los avisos sin leer y se actualiza cada 30 segundos.
- **Al pulsar un aviso** se marca como leído y se abre la pantalla donde se resuelve, ya en la
  pestaña correcta.
- **Marcar leídas** limpia el contador.
- **Ningún aviso llega por correo al equipo.** Hay que mirar la campana. Si usas la app móvil con la
  misma cuenta, también llegan como notificación al celular.
- Los avisos leídos se borran a los 30 días; los no leídos, a los 90.

Las alertas tributarias cuentan como importantes: suben el número de la campana aunque tu preferencia
de notificaciones sea "Solo importantes".

> **Ojo:** todos los avisos muestran el enlace **Ver detalle en Pedidos →**, aunque lleven a otra
> pantalla. Pulsar el aviso lleva al lugar correcto.

## 4. Cómo viaja el dinero de una venta

RepuesTop **no vende repuestos: intermedia**. El dinero que paga el comprador no es de RepuesTop;
lo es solo la comisión.

### 4.1 El recorrido

1. **El comprador paga** en la app o la web, a través de Flow. El dinero queda en custodia de
   RepuesTop.
2. **La tienda confirma el pedido.** Para pasarlo a "Preparando" tiene que subir su **boleta de
   venta**: sin boleta no avanza.
3. **La tienda envía o entrega, y el comprador recibe.** Si el comprador no confirma, el sistema da
   el pedido por recibido. Tres días después de recibido, el pedido se **finaliza**.
4. **El dinero de la tienda queda retenido 11 días desde la entrega** (los 10 días de derecho a
   retracto más uno de margen). Después la tienda puede **solicitar su retiro** en la app o la web.
5. **Administración Contable** emite en el SII la **factura por la comisión** y la registra en
   Liquidaciones (F3).
6. **El jueves** se paga: se descarga la nómina para el banco BCI, el banco transfiere y se confirma
   el pago (F4).

### 4.2 Cuánto es de cada uno

**La comisión de RepuesTop** es el 8 % de la venta más IVA. Las tiendas **Fundador** pagan 5 % más
IVA durante sus primeros meses. La venta incluye productos y despacho, menos el descuento de
cotización. **La comisión de Flow** (2,89 % más IVA) también se descuenta a la tienda.

Ejemplo, una venta de $100.000 en una tienda normal:

| Concepto | Monto |
|---|---|
| Venta (productos + despacho) | $100.000 |
| Comisión RepuesTop 8 % | − $8.000 |
| IVA de la comisión | − $1.520 |
| Comisión Flow (2,89 % + IVA) | − $3.439 |
| **La tienda recibe** | **$87.041** |
| **Ganancia neta de RepuesTop** | **$8.000** (el IVA va al Fisco; lo de Flow se le paga a Flow) |

De la ganancia neta, el **70 %** va a la caja de la empresa (sueldos y gastos) y el **30 %** a los
socios. En el ejemplo: $5.600 a caja y $2.400 a socios.

**Monedas del Mural (publicidad).** Esa venta sí es de RepuesTop. De una recarga de $5.000 quedan
$4.057 de ganancia, después de restar el IVA y la comisión de Flow.

### 4.3 Quién emite cada documento

| Qué | Quién lo emite | Qué documento |
|---|---|---|
| La venta del repuesto | La tienda | Boleta (o factura si el comprador es empresa) |
| La comisión de RepuesTop y el cargo por procesamiento de pago (Flow) | RepuesTop | **Factura** a la tienda, con las dos líneas |
| Las Monedas | RepuesTop | Factura si el comprador es empresa; si no, boleta |
| Anular una venta reembolsada | Quien emitió el documento original | Nota de crédito |
| El retiro de un socio | Nadie (no es una venta) | Comprobante interno |

RepuesTop emite sus documentos en el sistema del SII (Portal MIPYME o su facturador) y después los
**registra** en el backoffice con su folio, fecha y PDF. **El backoffice no emite documentos al
SII.**

### 4.4 El ciclo de pago: de jueves a miércoles

Los retiros que las tiendas piden entre un jueves y el miércoles siguiente se pagan el jueves que
sigue. Los captadores se pagan los martes.

### 4.5 Estados de un pedido

| Estado | Qué significa | Se considera atrasado a las |
|---|---|---|
| Pendiente | Pagado, la tienda no lo confirma | 48 h |
| Preparando | La tienda lo confirmó y subió su boleta | 72 h |
| Enviado | En camino | 120 h |
| Recibido | El comprador lo tiene | 72 h sin finalizar |
| Finalizado | Cerrado: pasa a Liquidaciones | — |
| En mediación | Hay un reclamo con mediador de RepuesTop | — |
| Cancelado / Cancelado parcialmente | Se anuló todo o parte | — |

---

# Parte II. Gestión de Confianza

## 5. Resumen de Confianza

La portada del área se titula **Mediación y Confianza: Qué atender hoy**.

- **Confianza X %:** el promedio del puntaje de confianza de las tiendas aprobadas. Es solo
  informativo.
- **Pendientes ahora:** cada tarjeta se puede pulsar y lleva a la pantalla donde se resuelve. El
  ícono **i** explica qué hacer.

| Tarjeta | Qué cuenta | Qué hacer |
|---|---|---|
| **Mediaciones con más de 5 días** | Reclamos abiertos hace 5 días o más (el comprador ya pagó y espera) | Resolver (F8) o suspender a la tienda si no responde |
| **Alertas críticas sin revisar** | Señales de riesgo graves que nadie revisó | Leer la evidencia, marcarla revisada y, si amerita, escalarla a mediación |
| **Validaciones pendientes** | Tiendas nuevas esperando revisión (y cuántas llevan más de 3 días) | Revisar y decidir (F1, F2). Mientras tanto no pueden vender |
| **Reportes de usuarios hoy** | Reportes de hoy sobre anuncios, productos, tiendas o chats | Si varios apuntan a la misma tienda, abrir una alerta o una mediación |
| **Tiendas suspendidas** | Tiendas que hoy no pueden vender | Revisar apelaciones y fechas de término en Mediaciones → Bloqueos |

- **Umbrales:** una mediación es "Alta" a los 2 días y "Crítica" a los 5; una validación está en
  espera larga a los 3 días.
- **Más abajo:** sugerencias del día, las mediaciones más antiguas, las alertas críticas y gráficos
  por antigüedad y severidad.

> **Ojo:** el botón **Ver tiendas** de la sugerencia sobre tiendas suspendidas abre Vendedores, que
> **no** muestra suspendidas. Las suspendidas están en **Mediaciones → Bloqueos**.

## 6. Validaciones

Aquí se aprueban las solicitudes de ingreso. Tiene cuatro pestañas.

### 6.1 Validación registros (tiendas)

- **A la izquierda:** la lista de solicitudes.
  - El filtro por defecto es **Pendiente y Por corregir**.
  - Se busca por tienda, responsable, RUT o ciudad.
  - Cada tarjeta muestra cuántos de los 5 documentos se cargaron.
  - Las tiendas ya aprobadas no aparecen aquí: están en Vendedores.
- **Al elegir una tienda se ven, en orden:**
  1. **Datos de la tienda** y del **Responsable de la solicitud**.
  2. **Redes sociales:** Instagram, Facebook o TikTok. **Abrir perfil** solo aparece si el enlace es
     de la red oficial; si no, dice que el enlace no es válido.
  3. **Documentos requeridos:** **Certificado de inicio de actividades**, **Patente comercial
     actualizada**, **Factura de venta o boleta electrónica** y **Declaración de representante
     legal** (la cédula del representante). Cada uno se puede previsualizar y descargar.
  4. **Situación tributaria (SII):** etiquetas de la declaración de IVA, el certificado y la
     verificación del semestre; el **Certificado de cumplimiento tributario** con su botón para
     verlo; y, si falta, el formulario para registrar la verificación del alta.
  5. **Historial de observaciones** (plegado): correcciones pedidas antes, apelaciones y reingresos.
  6. **Decisión:** el campo de motivo y los botones **Aprobar solicitud**, **Solicitar corrección**
     y **Rechazar y eliminar**.

El paso a paso está en [F1](#f1-aprobar-una-tienda) y [F2](#f2-pedir-una-corrección-o-rechazar-una-tienda).

### 6.2 Registros captadores

- Lista de postulantes a captador con su estado.
- **Aprobar** o **Rechazar**. Para rechazar hay que elegir un motivo de la lista y agregar un
  detalle.
- El super administrador ve además **Puntaje y comisiones del programa**, donde se configuran los
  puntos y las comisiones de los captadores.

### 6.3 Servicios automotrices

- Expedientes de talleres y servicios que piden acreditarse.
- **Aprobar acreditación**, **Solicitar corrección** o **Rechazar expediente**. Las dos últimas piden
  una nota.

### 6.4 Tablero de anuncios

- Avisos que se publicarán en el Mural.
- Se revisan en **Inspección de Anuncio en el Mural**.
- **Aprobar y publicar en Mural** o **Rechazar publicación** con motivo. El autor puede apelar.

## 7. Vendedores

Lista las tiendas **aprobadas**. Las suspendidas están en Mediaciones → Bloqueos, y aquí no se
aprueba ninguna.

- **Tarjetas:** **Vendedores activos**, **Con mediación activa**, **Reportes** y **Cancelan
  demasiado**. Esta última es solo para revisar: nadie se suspende por eso.
- **Columnas:**
  - tienda (con corona si es Fundador), RUT, ciudad y estado de cuenta;
  - reportes, mediaciones;
  - **Cancelaciones 90d**: al pulsarla muestra cada cancelación con su motivo.
- **Acciones de cada fila:**
  - ver el perfil;
  - ver la documentación;
  - ver la mediación en curso;
  - ver los reportes;
  - expandir la ficha (antigüedad, repuestos, ventas, cuenta bancaria).
- **Perfil:** resumen, documentos, historial de retiros (con los rechazos y su motivo), ventas y
  actividad reciente.

**Suspender una tienda:** en el perfil, **Historial de bloqueos** → **Bloquear tienda**.

1. Elegir el **Tipo de suspensión**:
   - **Temporal:** 3 días a 3 meses; se levanta sola al terminar.
   - **Definitiva:** sin plazo; la tienda puede apelar.
   - **Fraude:** solo el super administrador. Exige una evidencia interna de al menos 20 caracteres,
     que la tienda no ve.
2. Escribir el **Motivo de la suspensión** (entre 5 y 200 caracteres). La tienda lo recibe por correo.
3. Pulsar **Suspender tienda**.

Qué pasa después:

- Los productos se ocultan y la tienda no puede vender.
- **Si es temporal o definitiva:** los pedidos ya pagados deben despacharse en 2 días hábiles; si
  no, se cancelan y se reembolsan.
- **Si es por fraude:** los pedidos se reembolsan de inmediato y el dinero de la tienda queda
  retenido.

> **Ojo:** las columnas **Fecha de ingreso** y **Creado el** muestran en realidad la fecha de la
> última actividad de la tienda.

## 8. Mediaciones

La mediación es la intervención de RepuesTop cuando un comprador y una tienda no se ponen de acuerdo.
Las tarjetas muestran **En mediación**, **Casos resueltos** y **Cuentas bloqueadas**. Hay tres
pestañas.

**Mediaciones (casos abiertos)**

- Se filtra por fecha y se busca por caso, comprador o tienda.
- Al elegir un caso se abre un panel con su resumen y estas acciones:
  - **Revisar mediación** abre el caso completo;
  - **Notas** guarda notas internas: seguimiento, observación, advertencia, pendiente o contacto
    realizado;
  - **Ver tienda**.

**El caso completo**

- Motivo, evidencias del comprador y de la tienda.
- Un chat con cada parte.
- **Acciones del mediador:** **Resolver mediación** o **Suspender cuenta**. El paso a paso de
  resolver está en [F8](#f8-resolver-una-mediación).

**Casos resueltos**

- Muestra el veredicto, la medida aplicada y, si hubo, el reembolso (porcentaje y monto).
- **Ver historial del caso** muestra la línea de tiempo.

**Bloqueos**

- Lista las tiendas y compradores suspendidos.
- Si la tienda apeló, aparece **Ver apelación del vendedor**.
- Para levantar el bloqueo se usa **Reactivar cuenta**, con motivo y documento de respaldo.
  Reactivar devuelve la tienda a la venta y **restaura los productos que el bloqueo había ocultado**.

> **Ojo con las apelaciones:** cuando una tienda suspendida apela, aparece en dos lugares: aquí en
> **Bloqueos** y también en **Validaciones**, con la insignia "Reingreso por Apelación".
> - **Resuélvela siempre desde Mediaciones → Bloqueos → Reactivar cuenta.**
> - Si se aprueba desde Validaciones, la tienda se reabre, pero sus productos siguen ocultos y el
>   bloqueo queda abierto.

> **Ojo:** en el detalle del caso, el botón **Guardar borrador** no hace nada. El botón **Historial
> de reportes** del panel muestra los reportes de usuarios, no las notas del caso.

## 9. Captadores

Es una pantalla de consulta sobre los captadores aprobados. Tiene cinco pestañas:

- **Captadores:** desempeño de cada uno (captaciones, ranking, ganancia).
- **Captaciones por comuna**.
- **Compradores captados**.
- **Redes sociales:** el contenido que publican. Se puede **Ocultar** o **Restaurar** una
  publicación; el motivo lo ve el captador.
- **Repositorio videos:** los videos que suben.
  - **Vetar** saca un video del repositorio y deja de contar para su meta semanal.
  - **Sancionar captador** lo suspende del repositorio por 1 a 365 días. No afecta su cuenta ni sus
    comisiones.

Para desactivar a un captador se usa Gestión de Permisos (§2.3). Esta pantalla no tiene ese botón.

## 10. Alertas, Reportes, Feedback y Bitácora

| Pantalla | Para qué | Acciones |
|---|---|---|
| **Alertas** | Señales de riesgo detectadas por el sistema, por severidad (Crítica, Alta, Media) | **Marcar como Revisada**; **Escalar a Mediación** (solo si la alerta tiene pedido); en reembolsos fallidos, **Reintentar reembolso** o **Marcar como devuelto manualmente** |
| **Reportes** | Lo que compradores y tiendas reportan sobre anuncios, productos, tiendas y chats | Solo consulta: **Detalle** muestra quién reporta, a quién y por qué |
| **Feedback** | Comentarios y calificaciones de los usuarios | **Aprobar para home** / **Quitar del home**: solo un testimonio vigente por usuario |
| **Bitácora** | Registro de auditoría: quién hizo qué, cuándo y desde dónde | Solo consulta; filtros por módulo y período |

---

# Parte III. Administración Contable

En las pantallas de esta área (salvo los pagos y Cumplimiento SII) hay un botón **Rango activo**
arriba a la derecha:

- Elige el período: **Hoy**, **7 días**, **30 días**, **Mes actual**, **Todo** o fechas a mano.
- Abre en el mes actual.
- Si una cifra no pudo cargarse, aparece un aviso rojo con **Reintentar**: los totales de esa
  pantalla pueden estar incompletos hasta reintentar.

## 11. Resumen contable

**Pendientes ahora.** No dependen del rango. Cada tarjeta lleva a donde se resuelve:

| Tarjeta | Qué cuenta | Qué hacer |
|---|---|---|
| **Pedidos atrasados** | Pedidos que pasaron el tiempo máximo de su etapa (§4.5) | Contactar a la tienda |
| **Retiros por pagar** | Retiros pedidos por tiendas, con monto; cuántos no tienen factura y cuántos están retenidos por suspensión | Registrar las facturas que faltan (F3) y pagar el jueves (F4) |
| **Ventas por liquidar** | Ventas finalizadas que la tienda aún no retira | Nada: muestra cuánto dinero de terceros está en custodia |
| **Recargas sin documento** | Compras de Monedas sin boleta o factura | Emitirla y registrarla (F5) |
| **Gastos sin comprobante** | Gastos sin archivo adjunto | Subir el comprobante (F10) |

**Sugerencias de hoy:** hasta cuatro recomendaciones. Por ejemplo, los martes y miércoles recuerda
que el ciclo de pago cierra el miércoles.

**Resultado del periodo.** Depende del rango:

| Tarjeta | Qué es |
|---|---|
| **Ventas** | Lo pagado por los compradores en el período, despacho incluido |
| **Ganancia neta** | Comisiones de los pedidos finalizados más la venta de Monedas, sin IVA ni Flow |
| **Caja operativa** | 70 % de la ganancia neta menos los gastos. En rojo si los gastos la superan |
| **Socios** | 30 % de la ganancia neta menos los retiros de socios del período |

**Más abajo:** los pedidos más demorados, el flujo del período, los pedidos por estado y los últimos
gastos.

> **Ojo:** las ventas se cuentan en el mes en que se **compraron**, no en el que se finalizaron. Está
> pendiente confirmar ese criterio con el contador.

## 12. Pedidos

### 12.1 Pestaña Pedidos

Es un registro de seguimiento. El cumplimiento del pedido es responsabilidad de la tienda.

- Una fila por tienda dentro de cada pedido. Un pedido con dos tiendas aparece como "-1" y "-2".
- **Los finalizados no aparecen aquí:** pasan a Liquidaciones.
- **Filtros:** búsqueda, estado, mes y año.
- El reloj de **Última actualización** marca en amarillo o rojo los pedidos que se acercan a su
  límite o lo pasaron.
- **Ver detalle** y **Ver historial**.

> **Ojo:**
> - El filtro "Finalizado" siempre deja la tabla vacía.
> - El **Historial de Estados** muestra un solo registro: el sistema no guarda la historia completa.
> - Si llegaste desde la tarjeta "Pedidos atrasados", queda un filtro invisible hasta recargar la
>   página.

### 12.2 Pestaña Publicidad

Recargas de Monedas para publicar en el Mural. No generan pago a tiendas.

- **Tarjetas:** compras, monto acumulado, ganancia y comisión de la pasarela.
- **Botones:** **Sin documento (N)**, **Con documento** y **Todas**.
- **Columna Documento:** dice "Factura · folio", "Boleta · folio" o **Pendiente**.
- El ícono de documento abre el registro de la boleta o factura ([F5](#f5-documento-de-una-recarga-de-monedas)).

## 13. Liquidaciones

Las ventas finalizadas de cada tienda, ordenadas según en qué punto del pago están. Hay tres
pestañas:

| Pestaña | Qué hay |
|---|---|
| **Pendiente liquidación** | Ventas que la tienda todavía no pide retirar |
| **En liquidación** | Ventas con retiro pedido y aún no pagado. **Aquí se registra la factura de comisión** |
| **Liquidado** | Pagos ya hechos, con su código `PAG-…` |

En **Pendiente liquidación**, el ícono **i** de cada columna explica el cálculo de la venta, de los
descuentos a la tienda y de la ganancia de RepuesTop.

En **En liquidación**:

- La tabla agrupa por tienda: RUT, razón social, correo, cantidad de ventas e IVA acumulado.
- El ícono de documento cambia según el estado de la factura:
  - **Emitir boleta o factura**: no hay documento;
  - **Completar boleta o factura**: falta algún dato;
  - **Ver boleta o factura registrada**: está completo.
- La vista previa muestra la lista de ventas, con el **Monto a pagar vendedor** de cada una.
- El paso a paso está en [F3](#f3-registrar-la-factura-de-comisión-de-un-retiro).

En **Liquidado**:

- Cada pago se puede abrir para ver sus liquidaciones y las facturas adjuntas.

**Export "Documentos emitidos del mes"** (en las tres pestañas). Elegir el mes y pulsar **Descargar
CSV**. Trae, por fecha de emisión:

- las facturas y boletas de comisión;
- las de recargas de Monedas;
- las notas de crédito de RepuesTop, en negativo.

Al final aparecen los documentos del mes **sin folio o sin fecha**, que no suman al total. La
columna Observación avisa de cualquier diferencia de IVA. Es la planilla para cuadrar con el
Registro de Compras y Ventas del SII y para preparar el F29.

> **Ojo:**
> - La tabla **En liquidación** depende del rango activo. Si una tienda tiene ventas de meses
>   anteriores, pon el rango en **Todo** para verlas todas.
> - En **Liquidado**, el "Monto total pagado" incluye los retiros de socios.

## 14. Caja y gastos

**Pestaña Caja**

- Lista cada ingreso del período (pedidos finalizados y recargas) con su ganancia neta y el 70 % que
  va a caja.
- Se exporta a CSV.
- La tarjeta **Todas las ganancias** muestra el 70 %, no el total.

**Pestaña Gastos**

- **Tarjetas:** total de gastos, caja de RepuesTop, saldo (**Caja saludable** o **Déficit**) y
  comprobantes.
- **Botones:** **+ Registrar gasto**, **Generar informe** (un resumen imprimible) y exportar CSV.
- En cada gasto se puede ver el comprobante, editar o eliminar. Eliminar borra también el archivo y
  no se puede deshacer.
- El paso a paso está en [F10](#f10-registrar-un-gasto).

El comprobante es **obligatorio**: PDF, JPG o PNG de hasta 5 MB, a nombre de RepuesTop. Al editar un
gasto se puede reemplazar, pero no quitar.

> **Ojo:** el "Informe de gastos" calcula su caja de otra forma, así que su cifra no cuadra con la
> tarjeta de la pestaña.

## 15. Pago a proveedores

Aquí se pagan cada jueves los retiros de las tiendas **y** los de los socios. Tiene dos pestañas.

**Gestión de Pagos**

- **Tarjetas:** **Total a pagar en ciclo** y **Transferencias pendientes**.
- **Tabla Solicitudes del ciclo:**
  - **Proveedor** (azul): retiro de una tienda.
  - **Socio** (violeta): retiro de un socio.
  - **Retenido: tienda suspendida** (rojo): no se paga ni entra en la nómina. El motivo aparece al
    pasar el mouse.
- **Acciones de cada fila:**
  - el ojo muestra el detalle del retiro de una tienda;
  - en los socios, el documento verde indica que está cargado y el amarillo que falta.
- **Cuenta de cargo:** la cuenta de RepuesTop que aparece en la nómina. Se configura una sola vez.
- **Exportar Excel:** descarga la nómina para BCI. Si hay tiendas y socios, descarga **dos archivos**
  y hay que subir los dos al banco.
- **Procesar pago:** marca como pagados **solo los retiros de la última nómina exportada** de cada
  tipo. Lo que una tienda pida después de exportar queda para la nómina siguiente. La confirmación
  dice cuántos retiros y qué total se van a marcar, y cuántos quedan fuera.

**Historial de pagos**

- Los pagos hechos, con filtros por código y fechas.
- Dentro de un pago, el ícono de alerta de cada tienda sirve para **marcar un depósito que rebotó**.
  - Los pedidos vuelven a quedar disponibles para la tienda.
  - La tienda recibe el motivo para que corrija sus datos bancarios.

El paso a paso está en [F4](#f4-pagar-los-retiros-del-jueves).

La tabla muestra **todos** los retiros pendientes solicitados hasta el miércoles, también los de
ciclos anteriores que no se hayan pagado.

## 16. Pago a captadores

Los captadores piden sus retiros en su portal, adjuntando su boleta de honorarios. Se pagan **los
martes**, en una sola ronda. Hay tres pestañas: **Solicitudes de retiro**, **Historial por rondas** y
**Rechazados**.

- **Ver boleta** abre la boleta de honorarios del captador.
- **Rechazar** pide un motivo. Hoy el captador no recibe aviso del rechazo: hay que contárselo.
- **Exportar Excel** descarga la nómina BCI. Usa la cuenta de cargo configurada en Pago a
  proveedores.
- **Procesar pago** → **Confirmar y pagar** marca como pagadas las solicitudes de la **última nómina
  exportada**. Cada captador recibe un correo. Las pedidas después de exportar quedan para la ronda
  siguiente.

Para pagar: revisar cada boleta, rechazar las que tengan problemas, exportar el Excel, subirlo a BCI
y, cuando el banco transfiera, procesar el pago.

> **Ojo:** el pago a captadores a honorarios está en pausa (ver la guía contable, §6). Hoy se paga el
> monto completo, sin separar la retención de impuesto.

## 17. Cumplimiento SII

Reúne las obligaciones de RepuesTop ante el SII como plataforma. Tiene dos pestañas.

### 17.1 Situación tributaria

**Tarjetas**

| Tarjeta | Qué cuenta |
|---|---|
| **Por reverificar este semestre** | Tiendas vigentes que no están "Al día" en el semestre |
| **Sin declaración de IVA** | Tiendas que no declararon ser contribuyentes de IVA. **Sin esa declaración, el IVA de sus ventas lo paga RepuesTop** |
| **Sin certificado** | Tiendas sin certificado de cumplimiento |
| **No cumplen** | Tiendas que el SII marca como incumplidoras. Pueden vender |

- En enero y julio aparece el aviso **Mes de reverificación**.
- Debajo hay instrucciones para consultar un RUT en sii.cl, con el enlace a la página del SII.

**Certificados por revisar (N)**

- Los certificados que las tiendas subieron desde Mi tienda.
- Solo aparece si hay alguno.
- El paso a paso está en [F7](#f7-verificación-semestral-de-enero-y-julio).

**Tabla Situación tributaria de las tiendas**

- **Cuenta:** Aprobada, En revisión o Suspendida. Para las que están en revisión, indica cuántas
  cosas les faltan para aprobarse.
- **Este semestre:** **Al día**, **Por reverificar** (verificada en un semestre anterior) o **Sin
  verificar** (nunca).
- **Última verificación:** el resultado, la fecha y la vía (consulta en sii.cl, certificado de la
  tienda o API).
- **Declaración IVA** y **Certificado** (el ojo lo abre).
- **Verificar** registra una consulta hecha en sii.cl. El reloj abre el **Historial**.

**Nómina RUT;DV:** descarga el archivo que se sube al SII en junio y diciembre. **Solo se usa si
RepuesTop tiene la API del SII autorizada**, y hoy no la tiene.

**Registrar una verificación manual** (botón **Verificar**)

1. En sii.cl: **Servicios online → Situación tributaria → Consultar situación tributaria de terceros**,
   con el RUT de la tienda.
2. En el backoffice:
   - **Fecha de la consulta**.
   - **Vía:** **Consulta en sii.cl**.
   - **Resultado:** **Cumple sus obligaciones tributarias**, **No cumple**, **Sin inicio de
     actividades**, **Término de giro** o **Registro de Subsistencia**.
   - Opcional: fecha de inicio de actividades y observaciones.
3. Adjuntar como **evidencia** una captura o el PDF de la consulta. No es obligatorio, pero es la
   prueba ante el SII.
4. Pulsar **Registrar verificación**.

### 17.2 Notas de crédito

Cuando una venta se deshace (reembolso por mediación, cancelación o bloqueo de la tienda), el
documento que se emitió hay que anularlo con una **nota de crédito**. Solo así se recupera el IVA, y
**solo si se emite dentro de 6 meses desde la entrega**.

**Tarjetas:** **Notas pendientes**, **Críticas**, **Vencidas** y **Mediaciones al límite**.

**Tabla Notas de crédito pendientes**

| Columna | Qué indica |
|---|---|
| **Plazo** | **Al día** (menos de 7 días desde el reembolso), **Atrasada** (7 días o más sin nota), **Crítica** (a un mes o menos de los 6 meses) o **Vencida** (pasaron los 6 meses: ya no recupera el IVA, pero igual se registra) |
| **Vence el** | La fecha límite |
| **Origen** | Por qué se deshizo la venta |
| **Emite** | **Tienda** (anula su boleta de venta) o **RepuesTop** (anula su factura de comisión; pasa cuando el reembolso llegó después de pagar el retiro) |
| **Registrar** | Abre el registro de la nota |

- **Mediaciones abiertas cerca del límite:** casos todavía abiertos con más de 150 días desde la
  entrega. Si terminan en reembolso, el IVA ya no se recupera.
- **Notas de crédito registradas:** las ya ingresadas, con su PDF.

El paso a paso está en [F6](#f6-registrar-una-nota-de-crédito).

> **Ojo:** el botón **Actualizar** de esta pantalla no refresca la cola de certificados. Para verla al
> día, recarga la página.

## 18. Retiros de socios

Solo para el super administrador. Se abre desde el menú de usuario → **Retirar dinero**. Tiene dos
pestañas.

**Ingresos**

- Las ganancias del período con el 30 % que corresponde a los socios.

**Retiros**

- **Disponible retiro:** el 30 % del período.
- Una tarjeta por socio con su **Saldo real del socio** y sus datos bancarios.
- **Historial de socios:** los retiros con su estado (**Pendiente** o **Pagado**) y su documento.
- **Registrar retiro** crea un retiro nuevo ([F9](#f9-registrar-y-pagar-el-retiro-de-un-socio)).

**Los retiros de socios no se pagan aquí:** se pagan el jueves en **Pago a proveedores**, junto con
los de las tiendas.

> **Ojo:** la **naturaleza tributaria** que se elige al registrar (utilidades, devolución de capital,
> préstamo, remuneración, gasto rechazado) no se vuelve a mostrar después. Anótala también en el
> detalle del documento.

---

# Parte IV. Soporte

## 19. Soporte

El área se titula **Soporte Técnico** y tiene cuatro pestañas.

### 19.1 Resumen

- **Respondidos a tiempo:** el porcentaje de tickets de los últimos 30 días respondidos dentro de
  plazo.
- **Tarjetas de lo pendiente:**

| Tarjeta | Qué cuenta | Qué hacer |
|---|---|---|
| **Sin responder** | Tickets que nunca recibieron respuesta | Responder primero los más antiguos |
| **Fuera de plazo** | Sin respuesta y con el plazo vencido: 24 h falla técnica, 48 h ayuda, 72 h consulta | Responder aunque sea para avisar que se está revisando |
| **Urgentes activos** | Tickets de prioridad crítica o alta | Si es de pagos o acceso, avisar además al equipo técnico |
| **Chats de carga esperando** | Tiendas que pidieron ayuda para cargar inventario | Responder en el chat |
| **Defectos QA pendientes** | Fallas reportadas por QA sin resolver | Ver si afectan a usuarios reales y priorizar |
| **Resueltos por cerrar** | Tickets resueltos que se cerrarán solos a los 7 días | Nada, salvo que el usuario vuelva a escribir |

- **Más antiguos sin respuesta:** los cinco más viejos, con el botón **Atender**.

### 19.2 Tickets

- Bandeja de casos de compradores, tiendas, del equipo y de consultas desde la web.
- **Filtros:** por defecto muestra los **Sin cerrar**. Se filtra por estado, prioridad, categoría y
  plataforma.
- Se actualiza sola cada 15 segundos.
- Los plazos y prioridades se asignan solos:

| Categoría | Plazo | Prioridad por defecto |
|---|---|---|
| Falla técnica | 24 h | Alta |
| Ayuda | 48 h | Media |
| Consulta | 72 h | Baja |

**Crear ticket** registra un caso a mano.

> **Ojo:** un ticket creado aquí, o desde **Ayuda e Incidencias**, queda a nombre de quien lo crea,
> aunque se escriba otro nombre de reportante. Los avisos le llegan a esa persona.

El paso a paso de un ticket está en [F11](#f11-atender-un-ticket-de-soporte).

> **Ojo:**
> - **Asignado a** se guarda solo en tu navegador: los demás no ven la asignación.
> - Si un comentario no se envía, la pantalla no avisa. Revisa que aparezca en la conversación.

### 19.3 Reportes QA

Defectos que registra el equipo de QA.

1. El operador mueve cada defecto a **En revisión** y, cuando se corrige, a **Listo para revisión**.
2. QA lo valida y lo marca **Resuelto** o **Con observaciones**.

Quien tiene solo el permiso QA ve una pantalla propia, **Registro QA**. Desde ella:

- registra defectos con **Registrar Defecto** (nombre, área, criticidad, entorno y descripción);
- los valida con **Revisión QA**.

### 19.4 Soporte carga de inventario

Chat con las tiendas que piden ayuda para subir su inventario.

- **Estados:** **Esperando soporte**, **En atención**, **Esperando al vendedor**, y cerrado por el
  vendedor o por inactividad.
- La línea **Estaba en** dice en qué paso o archivo estaba la tienda cuando pidió ayuda.
- Se puede responder con texto e imágenes (JPG, PNG o WEBP de hasta 5 MB; 20 por chat).

Para atender un chat:

1. Filtrar por **Esperando soporte** y abrir la conversación.
2. Si la respuesta va a tomar tiempo, cambiar el estado a **En atención**. Así el chat no se cierra
   solo.
3. Responder y pulsar **Enviar**. El chat pasa a **Esperando al vendedor**.
4. **Solo la tienda puede cerrar el chat.** Si no contesta en 24 horas después de una respuesta de
   soporte, se cierra solo.

> **Ojo:** la tienda **no recibe aviso** cuando soporte le responde en este chat. Si es urgente,
> avísale por otro medio.

### 19.5 Ayuda e Incidencias

Desde cualquier pantalla, el botón **Ayuda** (o el enlace del menú de usuario) abre preguntas
frecuentes y **Reportar Falla o Incidencia**. El reporte llega a Soporte como un ticket interno.

---

# Parte V. Flujos paso a paso

## F1. Aprobar una tienda

**Quién:** Confianza (Validaciones). **Cuándo:** apenas llega la solicitud. La tienda no vende
hasta que se aprueba.

1. **Abrir la solicitud.** Ir a **Validaciones → Validación registros**, con el filtro **Pendiente y
   Por corregir**, y elegir la tienda.
2. **Revisar los datos:** razón social, RUT, giro y dirección en **Datos de la tienda**, y el
   responsable. Si declaró redes sociales, abrirlas con **Abrir perfil** y comprobar que la tienda
   existe y vende repuestos.
3. **Revisar los 5 documentos** en **Documentos requeridos**, con el ojo:
   - **Certificado de inicio de actividades:** el RUT coincide con el de la tienda.
   - **Patente comercial actualizada:** vigente y a nombre de la tienda.
   - **Factura de venta o boleta electrónica:** un documento real emitido por la tienda.
   - **Certificado de cumplimiento tributario (SII):** el RUT y el nombre coinciden y la fecha es de
     este semestre (enero a junio, o julio a diciembre).
   - **Declaración de representante legal:** la cédula del representante.
4. **Mirar Situación tributaria (SII).**
   - Si **Declaración de contribuyente de IVA** dice **Falta**, la tienda no marcó la declaración:
     pedir corrección (F2).
   - Si **Certificado de cumplimiento tributario** dice **Falta**, pedir corrección.
5. **Registrar la verificación del alta**, en la sección **Situación tributaria (SII)**, que está
   debajo de los documentos. Arriba muestra tres etiquetas (Declaración IVA, Certificado y
   Verificación) y, debajo, el certificado con su botón para verlo.
   - **¿Qué dice el certificado?** Abrirlo, revisar que el RUT y el nombre sean los de la tienda y
     marcar **Cumple** o **No cumple**.
   - **Fecha del certificado.** Si dice "Es de otro semestre", **no sigas**: pide uno nuevo con una
     corrección (F2). Uno de más de 30 días sirve, pero conviene uno reciente.
   - **Inicio de actividades en sii.cl.** Pulsar **Copiar** y **Abrir sii.cl**, que abre la consulta
     de situación tributaria de terceros del SII (sin clave). Pegar el RUT y elegir en la lista lo
     que muestra: **Vigente**, **Término de giro** o **Sin inicio de actividades**.
   - Leer el resumen de la barra de abajo, que dice si con eso se podrá aprobar la tienda. Si hace
     falta, **+ Observación**. Pulsar **Registrar verificación**.

   Aparece "Verificación registrada. Ya puedes aprobar la tienda", la pantalla baja a **Decisión** y
   **Aprobar solicitud** queda destacado. Registrar la verificación **no** aprueba la tienda.
6. **Aprobar.** Pulsar **Aprobar solicitud**. Sale **Solicitud aprobada**, la tienda pasa a
   Vendedores y recibe un correo. Si quedan cupos, queda como Fundador.

**Cuándo NO se puede aprobar:**

- El botón queda deshabilitado y la pantalla dice qué falta.
- **Término de giro**, **Sin inicio de actividades** y **Registro de Subsistencia** no se aprueban
  nunca.
- Una tienda que **No cumple** sí se puede aprobar: puede vender, y RepuesTop tendrá que anticipar
  parte del IVA cuando el SII lo reglamente.

> **Ojo:**
> - Si la solicitud está **Por corregir**, todos los botones aparecen deshabilitados **sin
>   explicación**: se está esperando que la tienda reenvíe sus documentos.
> - Si el botón **Aprobar** se habilita pero al pulsarlo sale "No se puede aprobar la tienda
>   todavía…", espera unos segundos a que cargue la situación tributaria y vuelve a revisar el
>   bloque.

## F2. Pedir una corrección o rechazar una tienda

**Pedir una corrección** (lo normal cuando falta algo)

1. Escribir en el campo de motivo qué debe corregir la tienda, en lenguaje claro. Por ejemplo: "El
   certificado de cumplimiento es de enero; descarga uno nuevo desde sii.cl".
2. Pulsar **Solicitar corrección**.
3. La tienda recibe un correo con el motivo y un enlace para volver a subir los documentos. La
   solicitud queda **Por corregir** hasta que la tienda reenvíe.

**Rechazar**

1. Escribir el motivo.
2. Pulsar **Rechazar y eliminar**.
3. Confirmar en el aviso que aparece.

> **Ojo:** el rechazo es **definitivo**.
> - Borra la postulación y la cuenta de la tienda, y le envía el motivo por correo.
> - El RUT y el correo quedan libres para que postule de nuevo desde cero.
> - Úsalo solo si la tienda no debe vender en RepuesTop. Para cualquier cosa que se pueda arreglar,
>   pide una corrección.

## F3. Registrar la factura de comisión de un retiro

**Quién:** Administración Contable. **Cuándo:** cuando una tienda pide su retiro, y siempre antes
del jueves. Sin factura completa, el retiro no se puede pagar.

1. **Ver qué facturar.** En **Liquidaciones → En liquidación**, poner el rango en **Todo**, buscar la
   tienda y pulsar **Emitir boleta o factura**. Arriba del formulario aparece **Datos para emitir en
   el SII**, con las dos líneas de la factura:

   | Línea | Qué es |
   |---|---|
   | **Comisión de servicio RepuesTop** | El 8 % (o 5 % Fundador) de las ventas del retiro |
   | **Cargo por procesamiento de pago** | Lo que se le descuenta a la tienda por Flow |

   Cada línea muestra su neto, y abajo están el neto total, el IVA y el total. El total es lo que
   RepuesTop le retiene a la tienda en ese retiro. **Copiar datos** los copia para pegarlos en el SII.
2. **Emitir la factura en el SII**, en el Portal MIPYME o el facturador de RepuesTop:
   - **Receptor:** el RUT y la razón social de la tienda.
   - **Las dos líneas** con su neto, tal como aparecen en el backoffice. Las dos van afectas a IVA.
   - Si la tienda no tiene RUT de empresa, corresponde boleta.

   ¿Por qué el cargo de Flow va en la factura? Según el SII (Oficios 2278 y 2316 de 2026), lo que
   RepuesTop le retiene a la tienda es su remuneración completa, y la comisión de Flow es un gasto de
   RepuesTop con su propia factura. A la tienda le conviene: paga lo mismo y recupera más IVA.
3. **Registrarla en el backoffice.** Vuelve al formulario y completa:
   - **Tipo de documento:** el sistema propone **Factura** si la tienda tiene RUT.
   - **RUT receptor**, **Razón social / Nombre**, **Correo de envío** y **Detalle**: vienen
     llenos; revisa que coincidan con lo emitido.
   - **Folio:** el número que asignó el SII, solo dígitos.
   - **Fecha de emisión:** la del documento. No puede ser futura.
   - **Cargar Boleta / Factura (PDF):** el PDF emitido.
4. Pulsar **Registrar envío**. El ícono pasa a **Ver boleta o factura registrada**.

**Avisos que pueden aparecer:**

| Aviso | Qué significa |
|---|---|
| "Se emite en un mes distinto al del retiro…" | Es una advertencia, no un error. Revisa con el contador en qué mes corresponde la factura |
| "El folio N ya está registrado…" | Ese número ya se usó en otra factura de RepuesTop, de otro retiro o de una recarga. Revisa el folio en el SII |
| "El RUT del receptor no es válido" | Corrige el RUT |

El IVA que guarda el sistema lo calcula el servidor. El correo con el PDF le llega a la tienda
**cuando se paga el retiro**, no al registrarlo.

Si un documento quedó incompleto, el ícono dice **Completar boleta o factura** y pide todos los datos
y el PDF antes de guardar.

## F4. Pagar los retiros del jueves

**Quién:** Administración Contable. **Cuándo:** los jueves.

1. **Antes del jueves:** registrar la factura de cada tienda (F3) y el documento de cada socio (F9).
   El **Resumen** contable y las sugerencias avisan cuántos faltan.
2. Entrar a **Pago a proveedores → Gestión de Pagos** y revisar la tabla.
   - Las filas rojas (**Retenido**) no se pagan.
   - En los socios, el documento debe estar verde.
3. Pulsar **Exportar Excel** y guardar el o los archivos: uno de proveedores y otro de socios. La
   primera vez hay que configurar **Cuenta de cargo** con el número de la cuenta de RepuesTop.
4. Subir los archivos a la banca en línea de **BCI** y autorizar las transferencias.
5. **Cuando el banco haya transferido,** volver al backoffice y pulsar **Procesar pago**.
6. La confirmación dice cuántos retiros de la **última nómina exportada** se marcarán como pagados y
   por qué total. **Compara con lo que subiste a BCI**: si coincide, pulsar **Sí, confirmar pago**.
7. Cada tienda recibe la notificación y un correo con su factura. El pago queda en **Historial de
   pagos** con un código `PAG-…`.

**Si un depósito rebota:**

1. En **Historial de pagos**, abrir el pago con el ojo.
2. Pulsar el ícono de alerta en la fila de la tienda.
3. Elegir el motivo (cuenta inexistente, RUT que no coincide, etc.) y pulsar **Marcar rechazado**.

La tienda recibe el motivo por correo, corrige sus datos y vuelve a pedir el retiro.

**Solo se paga lo que salió en la última nómina exportada.**

- Si una tienda pide un retiro después de exportar, la confirmación lo muestra aparte ("no están en la
  última nómina") y queda para el jueves siguiente.
- **No vuelvas a exportar** entre subir el archivo al banco y confirmar el pago. La última exportación
  es la que vale: si exportas otra vez, el pago se compara con ese archivo nuevo.

## F5. Documento de una recarga de Monedas

**Quién:** Administración Contable. **Cuándo:** dentro de 48 horas desde la compra. Si no, a la
mañana siguiente salta la alerta.

1. Ir a **Pedidos → Publicidad** y pulsar **Sin documento (N)**.
2. En la recarga, pulsar el ícono de documento. Se abre **Documento de la recarga PUB-…**:
   - un aviso dice si el comprador pidió factura o boleta;
   - el bloque **Datos para emitir en el SII** trae receptor, RUT, giro, dirección, detalle, neto,
     IVA y total;
   - **Copiar datos** los copia.
3. Emitir el documento en el **Portal MIPYME** del SII con esos datos.
4. Volver al backoffice y completar **Tipo de documento**, **Folio**, **Fecha de emisión**, **RUT
   receptor** (obligatorio en factura), **Razón social** y el **PDF**.
5. Pulsar **Guardar y enviar al comprador**. El comprador recibe el PDF por correo y un aviso en la
   app.

Para corregir un documento ya registrado, hay que volver a subir el PDF. El comprador recibe de nuevo
el correo, con el aviso "Corregimos…".

## F6. Registrar una nota de crédito

**Quién:** Administración Contable. **Cuándo:** apenas aparece. Una nota atrasada es aviso de la
alerta de la mañana (§20).

1. Ir a **Cumplimiento SII → Notas de crédito**. Las más urgentes están arriba.
2. Mirar la columna **Emite**.
   - **Tienda:** la tienda debe emitir la nota en el SII y enviar el PDF a contacto@repuestop.cl con
     el número de pedido. El sistema se lo pide automáticamente. Si no llega, escríbele.
   - **RepuesTop:** emitir en el SII una nota de crédito que anule la factura de comisión indicada en
     **Anula** (folio N).
3. Con el PDF en mano, pulsar **Registrar** y completar:
   - **Folio**: solo dígitos.
   - **Fecha de emisión**: no puede ser futura.
   - **Monto total de la nota (IVA incluido)**: viene con el monto del reembolso; ajústalo si la
     nota es por otro monto.
   - **PDF de la nota de crédito**.
4. Pulsar **Registrar nota**. Pasa a **Notas de crédito registradas**.

Si la fecha es posterior al vencimiento, el sistema avisa que la nota queda como respaldo pero ya no
rebaja el IVA.

## F7. Verificación semestral de enero y julio

**Quién:** Administración Contable. **Cuándo:** del 1 al 31 de enero y del 1 al 31 de julio. La meta
es que **Por reverificar este semestre** llegue a 0.

**Lo que hace el sistema solo:**

- El **2** del mes les pide a las tiendas que suban su certificado de cumplimiento.
- El **20** les recuerda a las que no lo subieron.
- Cada mañana avisa al equipo cuántas tiendas faltan.

**Lo que hace el equipo:**

1. Ir a **Cumplimiento SII → Situación tributaria**.
2. En **Certificados por revisar**, pulsar **Revisar uno tras otro**. Para cada certificado:
   1. pulsar **Abrir el certificado (PDF)**;
   2. comprobar que el RUT y el nombre son los de la tienda y que la fecha es de este semestre;
   3. escribir la **Fecha que muestra el certificado**;
   4. pulsar **Dice Cumple** o **Dice No cumple** según lo que diga el certificado. Si el documento
      no sirve (otro RUT, ilegible, de otro semestre), pulsar **No sirve: rechazar**, escribir el
      motivo y pulsar **Rechazar y pedir otro**.

   El siguiente se abre solo. La tienda recibe un aviso con el resultado y, si fue rechazado, con el
   motivo.
3. A fin de mes, para las tiendas que **no subieron** certificado:
   - buscarlas en la tabla con **Sin verificar** o **Por reverificar**;
   - pulsar **Verificar** y hacer la consulta en sii.cl (ver el apartado "Registrar una verificación
     manual" del §17.1).
4. Revisar que la tarjeta **Por reverificar este semestre** quede en 0.

La tienda **sigue vendiendo** mientras su certificado está en revisión.

## F8. Resolver una mediación

**Quién:** Confianza. **Cuándo:** lo antes posible. A los 5 días el caso pasa a crítico.

1. Ir a **Mediaciones**, elegir el caso y pulsar **Revisar mediación**.
2. Leer el motivo, revisar las evidencias de ambas partes y conversar por los chats.
3. En **Acciones del mediador**, elegir **Resolver mediación**:
   1. **Veredicto de la mediación:** **A favor del comprador** o **A favor de la tienda**.
   2. **Opción de resolución (Ley 19.496)**:
      - a favor del comprador: reembolso íntegro, rebaja proporcional (reembolso parcial),
        reposición o reparación;
      - a favor de la tienda: producto conforme, entrega acreditada o reclamo fuera de plazo.
   3. Si es reembolso parcial, el **Porcentaje de reembolso**, entre 1 y 100. El monto lo calcula el
      sistema.
4. Revisar la vista previa del mensaje que recibirán las partes y pulsar **Resolver caso**.
5. Confirmar. Si hay reembolso, el sistema lo pide a Flow (llega en 5 a 10 días hábiles) y la
   confirmación dice que **no se puede deshacer**.

**Si el reembolso falla:**

- En el panel del reembolso aparecen **Reintentar reembolso** o **Marcar como devuelto
  manualmente**.
- El segundo se usa si se devolvió por transferencia; pide el número de operación.

**Después de un reembolso:**

- Si la tienda ya había subido su boleta, debe emitir una **nota de crédito**.
- Aparece en Cumplimiento SII y el sistema se la pide a la tienda (F6).

**Para suspender una cuenta desde la mediación:**

1. En **Acciones del mediador**, elegir **Suspender cuenta**.
2. Elegir la parte, la duración y el motivo.
3. Confirmar.

No se puede suspender a una tienda que tiene otras mediaciones abiertas con otros compradores: hay
que resolverlas antes.

## F9. Registrar y pagar el retiro de un socio

**Quién:** super administrador. **Cuándo:** antes del jueves en que se quiere cobrar.

1. Menú de usuario → **Retirar dinero** → pestaña **Retiros**.
2. Revisar que el socio tenga datos bancarios en su tarjeta. Si no, pulsar **Registrar datos
   bancarios**.
3. Pulsar **Registrar retiro** y completar:
   - **Fecha** y **Socio**.
   - **Motivo**: retiro mensual, de saldo acumulado o parcial. El monto se precarga.
   - **Naturaleza tributaria**:

     | Opción | Cuándo se usa |
     |---|---|
     | **Retiro de utilidades** | Lo normal: el 30 % |
     | **Devolución de capital** | Devolver un aporte que consta en la escritura |
     | **Préstamo al socio** | Solo con contrato y plazo de devolución |
     | **Remuneración** | Sueldo empresarial |
     | **Gasto rechazado** | Un gasto personal que pagó la empresa |

     Si hay duda, preguntar al contador **antes** de registrar: la misma transferencia paga
     impuestos distintos según lo que sea.
   - **Monto**.
4. Pulsar **Guardar retiro**. Queda **Pendiente**.
5. Cargar el documento del retiro con el ícono de documento:
   - **Comprobante de retiro** para utilidades, devolución o préstamo;
   - **Liquidación de sueldo** para remuneración;
   - RUT, nombre y correo del socio, y el PDF.
6. El jueves se paga en **Pago a proveedores** (F4), en la nómina de socios.

Cada socio puede tener solo un retiro pendiente a la vez.

## F10. Registrar un gasto

1. Ir a **Caja y gastos → Gastos** y pulsar **+ Registrar gasto**.
2. Completar:
   - **Fecha**.
   - **Categoría:** Tecnología, Marketing, Legal / Contabilidad, Operación u Otros.
   - **Descripción**.
   - **Monto:** pesos, sin puntos.
3. Adjuntar el **comprobante**, que es obligatorio: PDF, JPG o PNG de hasta 5 MB.
   - El documento debe estar **a nombre de RepuesTop, con su RUT**.
   - Una boleta a nombre de un socio no es gasto de la empresa (ver la guía contable, §5).
4. Pulsar **Guardar gasto**.

## F11. Atender un ticket de soporte

1. En el Resumen de Soporte, pulsar **Atender** en un ticket antiguo, o abrir **Tickets** y la
   flecha de la fila.
2. Leer la descripción y los adjuntos.
3. Escribir la respuesta y pulsar **Comentar** (o Ctrl + Enter). El ticket pasa a **En proceso** y el
   usuario recibe aviso en la app y por correo.
4. Cuando el caso esté solucionado, pulsar **Marcar resuelto** y escribir la respuesta final, que es
   obligatoria y le llega al usuario por correo.
5. Después pasa una de tres cosas:
   - si el usuario responde, el ticket se reabre;
   - si no responde, se cierra solo a los 7 días;
   - el usuario puede cerrarlo él mismo.

Los tickets internos, sin usuario, se cierran con **Cerrar ticket** y un motivo.

---

# Parte VI. Lo automático y el calendario

## 20. Alertas diarias

Tres revisiones automáticas al día dejan avisos en la campana del equipo de Administración Contable
(y del super administrador). Solo avisan si hay algo pendiente, y una vez al día por persona.

Llegan a las **08:00, 08:05 y 08:10, hora de Chile**.

| Programada | Aviso | Qué revisa | Qué hacer |
|---|---|---|---|
| **08:00** | "Alerta Tributaria: N recargas sin boleta (+48h)" | Compras de Monedas con más de 48 horas sin documento | [F5](#f5-documento-de-una-recarga-de-monedas). El aviso abre Pedidos → Publicidad |
| **08:05** | "Notas de crédito pendientes: N", o "Alerta Tributaria: N notas de crédito al límite de 6 meses" si hay críticas o vencidas | Reembolsos sin nota de crédito y mediaciones abiertas con más de 150 días | [F6](#f6-registrar-una-nota-de-crédito). El aviso abre Cumplimiento SII → Notas de crédito |
| **08:10** | En enero y julio, "Reverificación semestral del SII: N tiendas pendientes"; el resto del año, "Alerta Tributaria: N tiendas sin verificar en el SII" o "…sin declaración de IVA" | Tiendas vigentes sin verificación del semestre o sin declaración de IVA | [F7](#f7-verificación-semestral-de-enero-y-julio). El aviso abre Cumplimiento SII → Situación tributaria |

**Lo que reciben las tiendas:**

| Cuándo | Aviso | Canal |
|---|---|---|
| Con la revisión de las 08:05 | "Emite la nota de crédito del pedido X", con la fecha límite y el correo contacto@repuestop.cl. Cuando la nota pasa a crítica, un "Recordatorio" | Notificación en la app y la web |
| Con la revisión de las 08:10, los días **2 y 20 de enero y julio** | "Sube tu certificado de cumplimiento tributario" (día 2) y "Recuerda subir tu certificado de cumplimiento" (día 20) | Notificación y correo |

## 21. Otras tareas automáticas

No dejan avisos al equipo, pero explican por qué algunas cosas cambian solas.

| Cada cuánto | Qué hace |
|---|---|
| Cada hora | Da por recibidos los pedidos entregados que el comprador no confirmó, finaliza los pedidos a los 3 días de recibidos (así se libera el saldo de la tienda) y le recuerda a la tienda confirmar sus pedidos pendientes |
| Cada 15 minutos | Levanta las suspensiones temporales que vencieron y cierra los chats de carga de inventario sin respuesta de la tienda en 24 h |
| Cada 5 minutos | Pide a Flow los reembolsos de tiendas suspendidas, vence los pedidos no pagados y concilia las recargas de Monedas |
| Cada hora | Cierra los tickets resueltos hace 7 días sin respuesta |
| Todas las noches | Borra los avisos antiguos de la campana |

**El pago a tiendas, socios y captadores nunca es automático:** siempre lo confirma una persona.

## 22. Calendario del equipo

| Cuándo | Qué | Dónde |
|---|---|---|
| Cada mañana | Revisar la campana y los Resúmenes de cada área | Campana, Resúmenes |
| Todos los días | Facturas de retiros nuevos (F3), documentos de recargas (F5) y notas de crédito (F6) | Liquidaciones, Pedidos → Publicidad, Cumplimiento SII |
| Lo antes posible | Validaciones pendientes (F1) y mediaciones (F8) | Validaciones, Mediaciones |
| Martes | Pago a captadores | Pago a captadores |
| Martes y miércoles | Completar las facturas que falten: el ciclo cierra el miércoles | Liquidaciones |
| Jueves | Pago de retiros a tiendas y socios (F4) | Pago a proveedores |
| Primeros días del mes | Descargar "Documentos emitidos del mes" del mes anterior y entregarlo al contador | Liquidaciones |
| Día 20 | Fecha límite del F29 (lo presenta el contador) | — |
| Enero y julio | Verificación semestral (F7) | Cumplimiento SII |
| Junio y diciembre | Nómina RUT;DV al SII, **solo si se aprueba la API del SII** | Cumplimiento SII |
| Marzo y abril | Declaraciones juradas y renta anual (contador) | — |

---

# Parte VII. Ayuda

## 23. Problemas frecuentes

**"Aprobar solicitud" está deshabilitado.**
- Lee el aviso bajo el botón: dice qué falta (documentos, declaración de IVA, certificado o
  verificación del SII).
- Si no hay aviso y la solicitud está "Por corregir", se está esperando a la tienda.
- Ver [F1](#f1-aprobar-una-tienda).

**El pago dice "Falta completar el formulario de registro de boleta/factura…".**
- Alguna tienda o socio no tiene su documento completo.
- En Liquidaciones → En liquidación, abre el de la tienda y revisa que tenga folio, fecha de emisión
  y PDF ([F3](#f3-registrar-la-factura-de-comisión-de-un-retiro)).

**"El folio N ya está registrado en otra factura emitida por RepuesTop".**
- Ese número de factura ya se usó, en otro retiro o en una recarga.
- Revisa en el SII el folio correcto del documento que estás registrando.

**"Configura la cuenta de cargo… antes de exportar la nómina".**
- En Pago a proveedores, pulsa **Cuenta de cargo** y escribe el número de la cuenta de RepuesTop,
  solo dígitos.

**Una tienda no aparece en Vendedores.**
- Vendedores solo muestra tiendas aprobadas.
- Si está en revisión, búscala en Validaciones; si está suspendida, en Mediaciones → Bloqueos.

**La tabla de En liquidación no muestra todas las ventas de un retiro.**
- Cambia el **Rango activo** a **Todo**.

**No llegó la alerta de la mañana.**
- Revisa la lista de la campana, no solo el número.
- Las alertas solo salen si hay algo pendiente, y llegan antes de la jornada (§20).

**Un certificado de cumplimiento "es de otro semestre".**
- El SII actualiza el estado en enero y julio, así que el certificado tiene que ser posterior a esa
  fecha.
- Pide a la tienda uno nuevo: con una corrección (alta) o con **No sirve: rechazar** (semestral).

**Registré algo mal en Validaciones y quiero deshacer un rechazo.**
- No se puede: **Rechazar y eliminar** borra la postulación.
- La tienda debe postular de nuevo.

## 24. Glosario

| Término | Qué es |
|---|---|
| **Certificado de cumplimiento tributario** | Documento que la tienda descarga de su sitio en sii.cl y que dice si "Cumple" o "No cumple" sus obligaciones tributarias. El SII lo actualiza en enero y julio |
| **Ciclo de pago** | De jueves a miércoles; se paga el jueves siguiente |
| **Comisión** | Lo que cobra RepuesTop por cada venta: 8 % + IVA (5 % + IVA para Fundador) |
| **Custodia** | El dinero de la tienda que RepuesTop guarda hasta que puede retirarlo |
| **Declaración de IVA** | La constancia de la tienda de que es contribuyente de IVA. Sin ella, el IVA de sus ventas lo paga RepuesTop |
| **DTE** | Documento tributario electrónico: factura (33), boleta (39), nota de crédito (61) |
| **F29** | Declaración mensual de IVA ante el SII |
| **Folio** | El número que el SII asigna a cada documento emitido |
| **Fundador** | Tienda de las primeras en entrar, con comisión rebajada al 5 % por un tiempo |
| **Inicio de actividades** | El trámite con que una tienda se registra en el SII para vender. Si hace término de giro, deja de estar vigente |
| **Liquidación** | El cálculo de lo que se le debe pagar a la tienda por una venta |
| **Mediación** | La intervención de RepuesTop en un reclamo entre comprador y tienda |
| **Monedas** | Lo que compran los usuarios para publicar avisos en el Mural |
| **Nómina BCI** | El archivo Excel con las transferencias que se sube al banco |
| **Nota de crédito** | Documento que anula, total o parcialmente, una boleta o factura. Debe emitirse dentro de 6 meses desde la entrega para recuperar el IVA |
| **Portal MIPYME** | El sistema gratuito del SII para emitir facturas y boletas |
| **Registro de Subsistencia** | Registro del SII para pequeños vendedores sin inicio de actividades. Hoy RepuesTop no los aprueba |
| **Retiro** | La solicitud de una tienda, socio o captador para que se le transfiera su dinero |
| **Semestre** | S1: enero a junio. S2: julio a diciembre |
| **SII** | Servicio de Impuestos Internos |
