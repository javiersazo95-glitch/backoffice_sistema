# Contabilidad y tributación chilena del backoffice

Guía de cómo debe operar Administración Contable para que RepuesTop cumpla con el SII siendo un **operador de plataforma digital de intermediación** domiciliado en Chile.

Revisada contra normativa vigente al 8 de octubre de 2026, con citas de primera fuente (textos del SII). No reemplaza al contador para el cierre mensual ni anual: lo que define es **qué datos tiene que producir y custodiar el sistema**.

Código base de la revisión: `dev` en `313431a`, que incluye la eliminación del panel de Boletas de venta (`62951d9`).

---

## 1. El modelo contable del negocio

El error número uno de un marketplace es declarar como venta propia el total del pedido. RepuesTop no vende repuestos: intermedia. La separación correcta es:

| Flujo | Naturaleza contable | ¿Ingreso de RepuesTop? | ¿Va al F29 de RepuesTop? |
|---|---|---|---|
| Total pagado por el comprador | Dinero de terceros en tránsito | No | No |
| Monto a pagar a la tienda | Pasivo (fondos por liquidar) | No | No |
| Comisión de servicio (8 % verificadas, 5 % fundadoras) | Ingreso por servicios | **Sí** | **Sí**, IVA débito 19 % |
| IVA de la comisión | Impuesto por enterar al Fisco | No | Sí, débito fiscal |
| Comisión Flow que soporta RepuesTop | Gasto | No | Sí, crédito fiscal (con factura de Flow) |
| Venta de fichas / Monedas del Mural | Ingreso por publicidad | **Sí** | **Sí**, IVA débito 19 % |
| Retiro de socio | Distribución de utilidades | No | No |

Las tasas vigentes están en `application.properties` del backend: `repuestop.comision.tasa.alta/media/baja = 0.08` (los tres tramos quedaron en la misma tasa, decisión del 2026-09-24), `repuestop.comision.fundador.porcentaje = 0.05` para las primeras 100 tiendas fundadoras durante 3 meses (`ConfiguracionFundador`), e `repuestop.comision.iva = 0.19`. Cada ítem guarda su `comision_tasa_aplicada` al comprarse, así que los pedidos antiguos conservan su tasa y un cambio de tarifa no reescribe el pasado.

Lo que el sistema ya respeta y hay que mantener:

- `buildCashEntries` reparte 70/30 sobre `netSettlement` y `montoNeto`, cifras **netas de IVA y de pasarela** ([cash.ts](frontend/src/modules/administration/cash.ts)). Es lo correcto: nunca se reparte dinero de las tiendas ni IVA recaudado.
- El 30 % "de socios" es una política interna de asignación, **no un pasivo** hasta que se acuerda el retiro. En los estados financieros es patrimonio.
- Los `fondosRetenidos` de una tienda suspendida siguen siendo pasivo de RepuesTop, no ingreso, aunque el pago esté bloqueado.

---

## 2. Quién emite qué documento tributario

| Operación | Emisor | Documento | Receptor |
|---|---|---|---|
| Venta del repuesto | La tienda | Boleta electrónica (39), o factura (33) si el comprador tiene giro | Comprador |
| Comisión de servicio + IVA | **RepuesTop** | **Factura electrónica (33)** si la tienda es contribuyente de IVA; boleta solo si el receptor no tiene giro | La tienda |
| Venta de fichas del Mural | **RepuesTop** | Factura (33) si el avisador tiene giro; boleta (39) si no | Avisador |
| Servicio de captación | El captador | Boleta de honorarios electrónica (BHE) | RepuesTop |
| Retiro de utilidades del socio | **Nadie** | No existe documento tributario; es un acta/registro societario | — |
| Devolución, cancelación parcial o mediación con reembolso | Quien emitió el documento | Nota de crédito electrónica (61) | Mismo receptor |

### La boleta de venta ya es un requisito bloqueante

Esto está bien resuelto y conviene no tocarlo. El vendedor **no puede avanzar el pedido sin adjuntar su boleta**: el gate está en `PedidoEstadoSupport.exigirRequisitosDeConfirmacion`, que impide pasar la subórden a `EN_PREPARACION` sin `boletaVentaKey`, junto con el checklist de stock y compatibilidad. El archivo se guarda en el bucket privado de R2 (`boleta_venta/Pedido_{id}`), se notifica al comprador y queda visible para él en la app y la web, además del vendedor que la subió.

Tributariamente es correcto: la venta del repuesto es de la tienda, el documento lo emite la tienda, y la plataforma no documenta una venta que no hizo. Y operativamente es la mejor defensa que tienen: ninguna venta avanza sin documento, así que el incumplimiento del artículo 97 N° 10 no se puede acumular sin que nadie lo note.

Un detalle a corregir: `PedidoBoletaVentaSupport.validarArchivo` valida solo el `Content-Type` que declara el cliente y el tamaño máximo de 10 MB. El `Content-Type` lo manda quien sube el archivo, así que cualquier archivo enviado como `application/pdf` pasa. El propio backend ya tiene la forma correcta de hacerlo en `CaptadorService.validarPdf`, que usa `ArchivoSeguro.detectarTipoReal(contenido)` sobre los bytes reales. Resulta que el documento más sensible —el que se le manda al comprador y el que se exhibe ante el SII o SERNAC— se valida más débil que la boleta de honorarios de un captador. Es un cambio de dos líneas para usar el mismo helper.

### Dos reglas que se saltan con frecuencia

**La comisión se factura, no se "boletea".** Si RepuesTop emite boleta afecta a una tienda con giro, la tienda **no puede usar el IVA como crédito fiscal** y paga 19 % extra de su bolsillo. Corregido el 8 de octubre de 2026: el modal propone `Factura` cuando el receptor tiene RUT.

**La nota de crédito tiene plazo de 6 meses.** El artículo 21 N° 2 y el inciso segundo del artículo 70 del DL 825 permiten rebajar el IVA del débito fiscal solo si la devolución del bien o la resciliación del servicio ocurre dentro de **seis meses** desde la entrega (plazo subido de tres a seis meses por la Ley 21.398, vigente desde el 24 de marzo de 2022). Una mediación que se resuelve en el mes 7 deja a la tienda sin recuperar el IVA. El sistema debería alertar antes del día 150.

---

## 3. Obligaciones específicas como operador de plataforma

Esta es la parte que no aparece en ninguna guía contable genérica y es la que hoy el backoffice no cubre. Son obligaciones **de RepuesTop, con sanción propia**, no de las tiendas.

### 3.1 Exigir inicio de actividades a cada tienda

El inciso decimosegundo del artículo 68 del Código Tributario (incorporado por la Ley 21.713) obliga a "los operadores de plataformas digitales de intermediación que permitan operaciones entre terceros para la adquisición de bienes o servicios, respecto de las entidades que ofrezcan sus productos" a exigir acreditación del trámite de inicio de actividades.

La Resolución Ex. SII N° 99 de 2025 (vigente desde el 1 de octubre de 2025) fija cómo verificarlo:

- Consulta individual del RUT en sii.cl → Servicios online → Situación tributaria → "Consultar situación tributaria de terceros".
- **API de consulta automatizada**, previa solicitud según la Resolución Ex. SII N° 117 de 2025. Es la vía que corresponde a un marketplace con volumen.
- Si la tienda registra término de giro, se exige un nuevo inicio de actividades posterior a esa fecha.
- Si el usuario declara estar expresamente liberado por el SII, la plataforma queda exenta de exigirlo, pero debe guardar esa declaración.

Sanciones: a RepuesTop, artículo 109 del Código Tributario. A la tienda que no emita documentos, artículo 97 N° 10, **incluyendo la clausura de su sitio dentro de la plataforma**, y en caso de reiteración el Director puede pedir suspender el acceso al proveedor de pago.

### 3.2 Exigir el certificado de cumplimiento tributario

La Resolución Ex. SII N° 168, de 27 de noviembre de 2025, vigente **desde el 2 de marzo de 2026**, agrega una segunda capa sobre la anterior:

| Qué | Cuándo |
|---|---|
| Exigir el certificado de cumplimiento al contratar (la tienda lo descarga de su sitio personal) | Al alta de cada tienda |
| Reverificar todo el stock de tiendas vigentes | Semestral: **enero y julio** |
| Subir al SII la nómina `RUT;DV` (txt o csv, con cabeceras `RUT` y `DV`) | **5 al 15 de junio** y **5 al 15 de diciembre** |
| El SII publica quiénes cumplen e incumplen | A más tardar el 17 de junio y el 17 de diciembre |
| Informar los usuarios que declararon no requerir inicio de actividades, con cantidad de operaciones y monto acumulado | Anual (formato Anexo 2 de la Res. 99; el primer envío fue en marzo de 2026) |
| Comunicar los usuarios registrados | Anual |

Se considera **incumplidor** a quien: no presentó al menos tres F29 en los 36 períodos previos al semestre y una declaración anual de renta en los 3 años tributarios previos; tiene denuncia, acta de denuncia o querella por delito tributario en tramitación, o condena sin cumplir; o acumula seis meses de antecedentes o documentos por justificar sin corregir tras aviso del SII. La marca dura **hasta el término del semestre**: si se detecta el 15 de marzo, rige hasta el 30 de junio.

El resolutivo 7° es el de mayor impacto financiero: si la plataforma presta servicios a un usuario que no acredita cumplimiento, **debe anticipar una parte del IVA asociado a cada operación**, en la forma y plazos que el SII instruirá por resolución. Hay que seguir esa resolución: cuando salga, cambia el flujo de caja de las liquidaciones de las tiendas marcadas.

### 3.3 Tiendas sin inicio de actividades: el carril de subsistencia

La Resolución Ex. SII N° 193, de 22 de diciembre de 2025 (vigente desde el 1 de enero de 2026), creó el Registro de Pequeños Contribuyentes que desarrollan Actividades de Subsistencia. Un inscrito:

- Es persona natural domiciliada en Chile, desarrolla una sola actividad como pequeño comerciante o prestador, vende **solo a consumidores finales no contribuyentes de IVA** y tiene ingresos promedio mensuales de hasta **5 UTM** (últimos 6 meses).
- Está **exento de inicio de actividades, exonerado de IVA y liberado de emitir boletas**, de llevar contabilidad y de presentar declaraciones.
- Recibe un **certificado especial del SII** que le permite operar en plataformas de intermediación sin acreditar inicio de actividades. Su situación se verifica en la Consulta Tributaria de Terceros.
- **Las plataformas deben aceptar ese certificado desde el 1 de julio de 2026.** Quienes ya operaban tenían plazo para inscribirse hasta el 30 de junio de 2026.

Para el backoffice esto significa que "tienda sin boleta" no siempre es incumplimiento: hay un caso legítimo. Cuando vuelva a existir una vista de cumplimiento documental, tiene que distinguir los dos casos en vez de marcar todo como falta.

### 3.4 El riesgo de quedar como responsable del IVA de la venta

El artículo 3° bis de la Ley sobre Impuesto a las Ventas y Servicios considera contribuyente de IVA al operador de la plataforma **como si fuera el vendedor habitual** del bien que se transa a través de ella. La Circular SII N° 39 del 30 de abril de 2025 (modificada por la Circular N° 60 del 15 de octubre de 2025) fija tres requisitos copulativos: que explote una plataforma que facilite ventas de terceros, que la operación subyacente esté gravada con IVA, y que **ninguna de las partes de esa operación sea contribuyente del impuesto**.

Como las tiendas de RepuesTop están domiciliadas en Chile y son contribuyentes de IVA, el régimen **no** se aplica y la obligación se radica en la tienda. Pero la circular agrega el punto crítico:

> "Corresponde al vendedor o prestador de servicio informar al respectivo operador su calidad de contribuyente de IVA (...). Si el vendedor o prestador de servicio no cumple dicha obligación, el operador de la plataforma será el responsable del pago del IVA por la operación subyacente."

Es decir: **si no existe constancia de que la tienda declaró su calidad de contribuyente de IVA, el IVA de esas ventas lo paga RepuesTop.** Esa declaración, con fecha y evidencia, es un dato que el sistema tiene que capturar en el onboarding y conservar.

Además, aunque no sea responsable del impuesto, el operador debe cumplir el inciso segundo del artículo 35 I de la LIVS: entregar la información disponible sobre **identificación de los vendedores intermediados y las cantidades que se les paguen o pongan a disposición**. Hoy está reglamentado para vendedores sin domicilio en Chile (Res. 93 de 2025, Res. 20 de 2024); para los locales llega como requerimiento de información del SII, y hay que poder responderlo con un reporte por RUT y período.

Quedan fuera del artículo 3° bis las plataformas que solo prestan publicidad o procesamiento de pagos, y cuando intervienen varias plataformas responde la que autoriza o procesa el pago.

---

## 4. Pagos a captadores: retención de honorarios

> **En pausa (octubre 2026).** El modelo a honorarios no funcionó en las entrevistas: los candidatos exigen sueldo base. Si se avanza a sueldo base, esto **deja de ser honorarios y pasa a ser una relación laboral**, con un set de obligaciones distinto y más pesado: contrato de trabajo, Libro de Remuneraciones Electrónico, cotizaciones previsionales y de salud en Previred, impuesto único de segunda categoría retenido por la empresa, seguro de cesantía, mutual, provisión de vacaciones e indemnizaciones, DJ 1887 y finiquitos. Un modelo mixto (sueldo base más comisión variable) es laboral completo: la comisión es remuneración variable, no honorario. Esta sección queda como referencia si se retoma el esquema a honorarios para captadores ocasionales.

El captador persona natural emite BHE a RepuesTop. Cuando el receptor es una empresa de primera categoría, **la retención la practica el pagador**, no el emisor:

- Tasa **15,25 % en 2026** (sube a 16 % en 2027 y 17 % en 2028, Ley 21.133).
- RepuesTop paga el **84,75 % líquido** y entera la retención en el F29 del mes siguiente.
- Se informa anualmente en la **DJ 1879** y se emite certificado al captador.

El backoffice muestra un único `monto` por solicitud ([PagoCaptadoresPage.tsx](frontend/src/modules/administration/PagoCaptadoresPage.tsx)), sin separar bruto, retención y líquido, y sin total retenido del mes. Si la nómina BCI se genera con el monto bruto de la boleta, se paga de más y queda corta la retención declarada.

---

## 5. Cómo deben retirar los socios

El backend ya resolvió lo más difícil: `NaturalezaRetiroSocio` (SEC-BACKEND-121) obliga a declarar qué es cada giro de dinero —`RETIRO_DE_UTILIDADES`, `DEVOLUCION_DE_CAPITAL`, `PRESTAMO`, `REMUNERACION`, `GASTO_RECHAZADO`— y el frontend ya lo envía con un selector. Ese es exactamente el campo que el SII necesita, porque **la misma transferencia bancaria tributa distinto según lo que sea**.

Lo que falta es saber qué naturaleza usar en cada etapa. El orden de abajo es el que minimiza impuestos y riesgo, y no es casual: va de lo que no es renta a lo que sí lo es.

### Etapa 1 — Recuperar lo que ustedes pusieron: `DEVOLUCION_DE_CAPITAL` o `PRESTAMO`

Si pusieron plata de su bolsillo para levantar la empresa, recuperarla **no es renta** y no paga impuestos. Pero solo si está documentada desde el origen. Dos formas:

- **Aporte de capital.** Quedó en la escritura o en un aumento de capital posterior. Se devuelve como `DEVOLUCION_DE_CAPITAL`. Ojo: el artículo 17 N° 7 de la LIR exige imputar primero a utilidades retenidas, así que si la empresa ya acumuló utilidades el SII trata la devolución como retiro de esas utilidades aunque ustedes la llamen capital. Por eso conviene hacerlo **antes** de acumularlas, que es justo donde están ahora.
- **Préstamo del socio a la empresa.** Es una cuenta por pagar: la empresa les debe. Se devuelve como `PRESTAMO` y no es renta. Requiere respaldo: contrato o acta simple con fecha, monto, quién prestó, y la transferencia bancaria que lo pruebe. Sin eso, el SII lo trata como aporte informal o directamente como retiro.

**Esto hay que ordenarlo ya, no después.** Revisen cada transferencia que hicieron a la empresa desde el inicio y clasifíquenla: aporte de capital o préstamo. Un acta de socios que las reconozca, con el detalle de cada movimiento y su comprobante bancario, vale mucho más que intentar reconstruirlo en una fiscalización dos años después.

### Etapa 2 — Gastos que pagaron ustedes: reembolso, no retiro

Si pagaron hosting, dominios, publicidad o notaría con su tarjeta personal, eso **no se retira**: se reembolsa. La condición es que el documento esté **a nombre de la empresa, con su RUT**. Una boleta a nombre personal de un socio no es gasto de la empresa: es consumo personal, y si se reembolsa igual, es gasto rechazado.

- Con documento a nombre de la empresa: se registra como gasto en Gastos, con el comprobante adjunto, y el reembolso es un pago normal. No pasa por Retiros ni tributa.
- Con documento a nombre personal: no se puede reembolsar sin costo. Si ya ocurrió, se registra como `GASTO_RECHAZADO` y se asume el impuesto, o se trata como préstamo del socio si corresponde.

El flujo de Gastos ya exige comprobante PDF/JPG/PNG. Lo que falta es un campo que diga **quién pagó** (la empresa o un socio) para distinguir el gasto directo del reembolsable.

### Etapa 3 — El sueldo: `REMUNERACION` por sueldo empresarial

Cuando pasen a pagarse mensualmente por trabajar en la empresa, la figura es el **sueldo empresarial** del artículo 31 N° 6 de la LIR. Lo relevante:

- Es **gasto aceptado**, así que baja la base del impuesto de primera categoría. A diferencia del retiro de utilidades, que no es gasto.
- Desde la Ley 21.210 (2020) **ya no existe el tope de las 73,2 UF**. El único límite es que el monto sea *razonablemente proporcionado* a la importancia de la empresa, las rentas declaradas y los servicios prestados. El SII lo evalúa caso a caso, así que un sueldo desproporcionado para los ingresos actuales es la observación más probable.
- Exige **trabajo efectivo y permanente** en el negocio. Ser socio o representante legal no basta. En su caso se cumple de sobra, pero conviene que quede escrito en un acta qué función cumple cada uno.
- Según el Oficio SII N° 2069 del 16 de octubre de 2025, **no hay monto mínimo y no es requisito cotizar** para que el gasto se acepte. Si cotizan, esas cotizaciones se deducen de la base de su impuesto único.
- Para el socio es renta del artículo 42 N° 1: queda afecto al **impuesto único de segunda categoría**, que la empresa retiene y declara. Se informa en el Libro de Remuneraciones Electrónico con el código 2161, que alimenta la **DJ 1887**.
- Es una ficción tributaria: no genera derechos laborales ni contrato de trabajo.

En el sistema se registra como retiro con naturaleza `REMUNERACION`, y su respaldo es una liquidación de sueldo, no una boleta de honorarios.

### Etapa 4 — Utilidades: `RETIRO_DE_UTILIDADES`

Es el caso del 70/30 actual. El socio residente **no sufre retención** al recibirlo: tributa en su Global Complementario anual con el crédito por el impuesto de primera categoría que ya pagó la empresa, y la empresa lo informa en la **DJ 1886**. No lleva documento tributario ni IVA, porque no es venta ni servicio. El rótulo "Anticipo de Dividendos" que ya usa la nómina BCI es el correcto.

La advertencia de siempre: un anticipo mensual del 30 % retira contra una utilidad que solo se conoce al cierre. Si el ejercicio termina con pérdida o con menos renta líquida que lo retirado, el socio tributa igual y la empresa queda descapitalizada. Dejen colchón y revisen el monto cada trimestre.

### Lo que nunca conviene

`PRESTAMO` **de la empresa al socio** es la categoría de mayor riesgo, y por eso el enum la separa. Si no se documenta y no se devuelve, el SII lo recalifica como retiro encubierto, con el impuesto correspondiente y sin el crédito. Úsenla solo con contrato, plazo y devolución real.

Y la regla que ordena todo: **el dinero de las tiendas y el IVA recaudado no son retirables**, aunque estén en la cuenta. El 70/30 sobre `netSettlement` ya los excluye; mantenerlo así es lo que evita el problema.


## 6. Calendario operativo

| Fecha | Obligación | Fuente de datos en el backoffice |
|---|---|---|
| Día 12 del mes siguiente | F29 (regla general) | Resumen, Caja, Publicidad |
| **Día 20** del mes siguiente | F29 si se es facturador electrónico y se declara y paga por internet | ídem |
| Día 28 | F29 sin movimiento o sin pago, por internet | — |
| Día 20 | Retención de honorarios de captadores del mes anterior | Pago a captadores |
| Todos los martes | Ronda de pago a captadores | Pago a captadores |
| Jueves a miércoles | Ciclo de liquidación a tiendas y socios (`getCurrentCycleRange`) | Pago a proveedores |
| 5 al 15 de junio y de diciembre | Nómina `RUT;DV` de tiendas vigentes al SII (Res. 168) | **falta** |
| Enero y julio | Reverificación semestral del cumplimiento tributario de tiendas | **falta** |
| Marzo | DJ 1879, declaraciones juradas del régimen, informe de usuarios sin inicio de actividades | parcial |
| Abril | F22, renta anual | Contador |

Régimen tributario: para una pyme en **14 D N° 3 (Pro Pyme General)** la tasa de primera categoría tiene una rebaja transitoria a **12,5 %** para los años tributarios 2025 a 2027 (permanente 25 %), y los PPM están rebajados a la mitad. Confirmar con el contador el régimen efectivo de la sociedad y la tasa aplicable antes de provisionar: las fuentes secundarias difieren en el número de la ley que concedió la rebaja.

---

## 7. Brechas del sistema, en orden de riesgo

Contrastadas contra el backend (`C:\ProyectoRepuestop\repuestop\backend`), no solo contra el frontend.

1. **La situación tributaria de la tienda se verifica una vez y a ojo.** El backend ya tiene `VerificacionProveedor`: exige cédula del representante, inicio de actividades, patente municipal, boleta o factura de ejemplo y contrato de adhesión, con `reviewStatus`, `reviewedAt` y `reviewNotes`, y `Proveedor.status` arranca en `pending_verification`. Eso cubre la evidencia documental, pero no la obligación legal, que es distinta: el PDF del inicio de actividades prueba que *alguna vez* lo hizo, no que **hoy** esté vigente ni que no haya término de giro. Faltan: resultado de la verificación ante el SII con fecha y vía (consulta web, API o certificado), **declaración de la tienda de ser contribuyente de IVA** (§3.4), certificado de cumplimiento tributario con vencimiento semestral, y marca de inscrito en el Registro de Subsistencia. Sin esto hay exposición al artículo 109 del Código Tributario y, peor, al IVA de las ventas ajenas.
2. **No existe la nómina semestral al SII** ni el ciclo de reverificación de enero y julio. Es un export `RUT;DV` sobre las tiendas con relación comercial vigente: trabajo chico, plazo fijo, sanción si no se hace.
3. ~~El default de documento por la comisión es boleta.~~ **Corregido:** `openGroupDocument` propone `Factura` cuando el receptor tiene RUT, y `Boleta` solo cuando no lo tiene.
4. ~~El documento de liquidación no registra folio ni fecha real de emisión.~~ **Resuelto el 9 de octubre de 2026** (migración `V2026100901`): folio y fecha obligatorios para pagar, y export "Documentos emitidos del mes". Lo que sigue es el diagnóstico original. `DocumentoLiquidacionRequestDTO` lleva `tipoDocumento`, `rut`, `razonSocial`, `email`, `detalle` e `ivaLiquidado`, pero no folio ni fecha; en el frontend `sentAt` queda en `'Ahora'`. `CompraFichaAdminDTO` sí tiene `documentoFolio`, así que el patrón ya existe en Publicidad. Sin folio y fecha no se concilia con el Registro de Compras y Ventas del SII.
5. ~~Boleta de honorarios como documento de un retiro de socio.~~ **Corregido en parte.** La clasificación tributaria ya estaba bien resuelta: `NaturalezaRetiroSocio` en el backend, obligatoria, y el selector en el frontend. Lo que quedaba era el documento adjunto, que proponía "Boleta de Honorarios"; ahora propone "Comprobante de retiro" y ese tipo ya no se ofrece para nuevos registros. Pendiente: exponer la naturaleza en la lista de retiros y en la vista de pago, para que el respaldo que se pide dependa de ella.
6. **La retención de honorarios de captadores no se modela** (§4). En pausa por el cambio a sueldo base.
7. ~~Nada vigila el plazo de 6 meses de la nota de crédito~~ **Resuelto el 9 de octubre de 2026** (migración `V2026100902`): `AlertaNotaCreditoJob` y la vista Cumplimiento SII. Ojo con lo que apareció: la fecha de entrega se sobrescribía al resolver una mediación, y las cancelaciones posteriores a la boleta también requieren nota.
8. **La boleta de venta existe y es obligatoria; lo que falta es poder consultarla.** Confirmado en el backend: el gate de `exigirRequisitosDeConfirmacion` no deja avanzar el pedido sin boleta, el archivo se guarda en R2, se le notifica al comprador y él la ve en la app y la web. `CumplimientoBoletaBackofficeService`, su controller y los endpoints `GET /api/v1/administration/sale-receipts` y `/{subordenId}/url` siguen vivos; `SeguimientoComprobanteBackofficeService` también los usa. Solo se borró el frontend en `62951d9`. No hay riesgo de incumplimiento acumulado —ninguna venta avanza sin documento— pero sí falta la pantalla para responder un requerimiento del SII o un reclamo SERNAC sin entrar a la base de datos.
9. **La boleta de venta se valida por `Content-Type` y no por contenido real** (§2). El helper correcto ya existe en el mismo backend. Es el documento que se le manda al comprador y el que se exhibe ante el SII: debería ser el mejor validado, no el peor.
10. **Constantes muertas y desactualizadas.** `COMMISSION_RATE = 0.05`, `MIN_COMMISSION = 690`, `MAX_COMMISSION = 9990`, `GATEWAY_RATE = 0.0289`, `GATEWAY_IVA = 0.19` en [constants.ts](frontend/src/modules/administration/constants.ts) no se usan en ningún archivo, y además contradicen al backend: la comisión estándar es 8 % parejo sin tope ni tramos, y la fundadora 5 %. Un día alguien las va a usar para "arreglar" un cálculo y va a facturar mal.
11. **Falta el reporte del artículo 35 I**: identificación de vendedores intermediados y montos pagados por período, exportable cuando el SII lo requiera.


---

## 8. Supuestos a confirmar

- Tipo societario (el rótulo "Anticipo de Dividendos" sugiere SpA) y régimen tributario efectivo: 14 D N° 3, 14 D N° 8 transparente, o 14 A.
- Si RepuesTop ya solicitó acceso a la API de situación tributaria de terceros (Res. 117 de 2025). Es el habilitador técnico de los puntos 1 y 2.
- Si ya se presentaron la nómina de stock de usuarios de febrero de 2026 y el informe de marzo de 2026 de la Res. 99.
- Cómo quedaron registradas las transferencias que los socios hicieron a la empresa: aporte de capital o préstamo (§5, etapa 1). Es lo que define si recuperarlas es libre de impuesto.
- Si el capital social está suscrito y pagado en la escritura, y por cuánto.
- Si el SII ya dictó la resolución del resolutivo 7° de la Res. 168 (anticipo de IVA por operaciones con usuarios incumplidores).

## Fuentes

- Resolución Ex. SII N° 99 de 2025 — https://www.sii.cl/normativa_legislacion/resoluciones/2025/reso99.pdf
- Resolución Ex. SII N° 168 de 2025 — https://www.sii.cl/normativa_legislacion/resoluciones/2025/reso168.pdf
- Resolución Ex. SII N° 193 de 2025 — https://www.sii.cl/normativa_legislacion/resoluciones/2025/reso193.pdf
- Circular SII N° 39 de 2025 (artículo 3° bis LIVS) — https://www.sii.cl/normativa_legislacion/circulares/2025/circu39.pdf
- Resolución Ex. SII N° 145 de 2025 — https://www.sii.cl/normativa_legislacion/resoluciones/2025/reso145.pdf
- Ley 21.713 — https://www.bcn.cl/leychile/navegar?idNorma=1207746
- Retención de honorarios 2026 (SII) — https://www.sii.cl/noticias/2025/261225noti01smn.htm
