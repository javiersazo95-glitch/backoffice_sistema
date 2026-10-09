# Contabilidad y tributación de RepuesTop

Qué obligaciones contables y tributarias tiene RepuesTop como **operador de plataforma digital de
intermediación** domiciliado en Chile, cómo las resuelve hoy el sistema y qué falta.

- **Para quién:** socios, contador y desarrolladores. La operación diaria, pantalla por pantalla,
  está en [manual-backoffice.md](manual-backoffice.md).
- **Estado:** al 8 de octubre de 2026, rama `dev` de los tres repos (backoffice, monorepo
  backend + app, web market). La app está en fase de pruebas; nada de esto ha operado con tiendas
  reales.
- **Fuentes:** cada afirmación normativa cita el texto oficial (sii.cl o bcn.cl). Lo que no se pudo
  verificar en primera fuente dice **por confirmar**.
- **No reemplaza al contador** para el cierre mensual ni anual: define qué datos tiene que producir y
  custodiar el sistema.
- **Cómo se mantiene:** se actualiza el tema que cambió (no se agregan secciones por sesión) y se
  anota el cambio en la sección 11.

Este documento reemplaza a `contabilidad-chile.md` y `resumen-contabilidad-2026-10-08.md`
(disponibles en el historial de git). Lo que implica pedir la API del SII está aparte, en
[solicitud-api-sii-inicio-actividades.md](solicitud-api-sii-inicio-actividades.md).

---

## 0. Estado de un vistazo

| Obligación o tema | Estado | Dónde |
|---|---|---|
| Separar dinero de terceros de ingreso propio | Hecho | §1 |
| Comisión documentada con **factura** a la tienda | Hecho | §2, §8.1 |
| Base del IVA de la comisión: incluir lo que se descuenta a la tienda por Flow | Hecho en código el 8-oct (falta probar y desplegar); confirmar con asesor | §1, §8.1, §9.3 Y |
| Folio y fecha de emisión de cada documento de RepuesTop | Hecho | §8.1 |
| Boleta de venta de la tienda antes de preparar el pedido | Hecho (bloqueante) | §2 |
| Nota de crédito dentro de 6 meses | Hecho (alerta diaria) | §4, §8.2 |
| Verificar inicio de actividades al alta (art. 68 CT, Res. 99) | Hecho, por consulta manual en sii.cl | §3.1, §8.3 |
| Certificado de cumplimiento al alta (Res. 168) | Hecho | §3.2, §8.3 |
| Declaración de la tienda de ser contribuyente de IVA (Circ. 39) | Hecho | §3.4, §8.3 |
| Reverificación de enero y julio (Res. 168) | Hecho, con el certificado de la tienda | §3.2, §8.3 |
| Nómina `RUT;DV` de junio y diciembre | Lista; **no aplica** sin la API | §3.2 |
| API Inicio de Actividades (Res. 117) | No solicitada | §9.1 |
| Retiros de socios clasificados por naturaleza tributaria | Hecho; falta mostrarla | §5, §9.2 J |
| Reporte del art. 35 I (vendedores y montos) | Pendiente | §9.2 G |
| Anticipo de IVA por tiendas incumplidoras (Res. 168, res. 7°) | Esperando la resolución del SII | §3.2 |
| Retención de honorarios de captadores | En pausa (modelo a sueldo) | §6 |

---

## 1. El modelo contable del negocio

RepuesTop **no vende repuestos: intermedia**. El error típico de un marketplace es declarar como
venta propia el total del pedido.

| Flujo | Naturaleza contable | ¿Ingreso de RepuesTop? | ¿Va al F29 de RepuesTop? |
|---|---|---|---|
| Total pagado por el comprador | Dinero de terceros en tránsito | No | No |
| Monto a pagar a la tienda | Pasivo (fondos por liquidar) | No | No |
| Comisión de servicio (8 %, o 5 % fundadoras) | Ingreso por servicios | **Sí** | **Sí**, IVA débito 19 % |
| IVA de la comisión | Impuesto por enterar | No | Sí, débito fiscal |
| Comisión de Flow sobre la venta | Gasto de RepuesTop (Flow le factura a RepuesTop). Lo que RepuesTop descuenta a la tienda por ese concepto es **parte de su remuneración** según el criterio del SII (ver abajo) | **Sí**, como parte de la remuneración | Débito: lo descontado a la tienda. Crédito: la factura de Flow. **Hoy el sistema no lo factura (hallazgo Y)** |
| Venta de Monedas del Mural (publicidad) | Ingreso por publicidad | **Sí** | **Sí**, IVA débito 19 % |
| Comisión de Flow sobre las Monedas | Gasto de RepuesTop | No | Crédito fiscal con la factura de Flow |
| Retiro de socio | Según su naturaleza (§5) | No | No |

**Tasas vigentes** (`application.properties` del backend):

- `repuestop.comision.tasa.alta/media/baja = 0.08`: los tres tramos en la misma tasa desde el
  24 de septiembre de 2026. Los pedidos anteriores conservan el esquema 10/7/5 %.
- `repuestop.comision.fundador.porcentaje = 0.05`: primeras 100 tiendas fundadoras, durante sus
  primeros 3 meses (`ConfiguracionFundador`).
- `repuestop.comision.iva = 0.19`.
- Flow: 2,89 % + IVA sobre productos + despacho, cobrado a la tienda.
- Cada ítem guarda su `comision_tasa_aplicada` al comprarse: un cambio de tarifa no reescribe el
  pasado.

**Cómo se calcula una venta** (`LiquidacionPedidoCalculator`):

| Concepto | Fórmula |
|---|---|
| Base | productos − descuento de cotización + despacho de esa tienda |
| Comisión | base × tasa guardada en el ítem |
| IVA de la comisión | comisión × 19 % |
| Flow | base × 2,89 % × 1,19 |
| Monto a pagar a la tienda | base − comisión con IVA − Flow − reembolsos de mediación |
| Ganancia neta de RepuesTop | la comisión sin IVA |

En las Monedas, la ganancia neta es la venta sin IVA menos la comisión de Flow sin IVA (ejemplo:
$5.000 → $4.202 − $145 = $4.057).

**La base del IVA de la comisión, según el SII.** El Oficio SII N° 2278, de 4 de septiembre de 2026,
dice que la remuneración del intermediario es "la diferencia entre el precio pagado por el cliente y
el monto rendido a su mandante, sin que corresponda deducir de dicho monto la comisión que le retenga
el respectivo operador de medio de pago". El Oficio N° 2316, de 8 de septiembre de 2026, agrega que
el cargo del procesador es un servicio distinto, prestado a la plataforma, que no reduce su base
imponible y cuya factura da crédito fiscal. Ninguno de los dos casos es idéntico al de RepuesTop: en
ambos, los mandantes no son contribuyentes de IVA. Pero el criterio sobre la base es general.

Aplicado al ejemplo de una venta de $100.000:

| | Hoy (sistema) | Según el criterio del SII |
|---|---|---|
| Retenido a la tienda (precio − monto rendido) | $12.959 | $12.959 |
| Neto facturado a la tienda | $8.000 | $10.890 |
| IVA débito | $1.520 | $2.069 |
| Factura de Flow a RepuesTop | $2.890 + $549 de IVA (crédito fiscal) | igual |

Si RepuesTop usa como crédito el IVA de la factura de Flow sin declarar el débito por lo que traspasa a
la tienda, paga $549 menos de IVA por cada $100.000 vendidos. La tienda, por su parte, pierde ese mismo
monto como crédito fiscal. Es el hallazgo Y (§9.3). **Desde el 8 de octubre el sistema factura según el
criterio del SII** (§8.1).

**Reparto interno 70/30** ([cash.ts](../frontend/src/modules/administration/cash.ts)): 70 % de la
ganancia neta a caja operativa y 30 % a los socios. Se calcula sobre cifras **netas de IVA y de
pasarela**, así que nunca se reparte dinero de las tiendas ni IVA recaudado. Reglas que hay que
mantener:

- El 30 % de socios es una política de asignación, **no un pasivo** hasta que se acuerda el retiro.
  En los estados financieros es patrimonio.
- Los fondos retenidos de una tienda suspendida siguen siendo **pasivo** de RepuesTop, no ingreso,
  aunque el pago esté bloqueado.
- **Criterio de fecha:** hoy Caja, Resumen y Socios ubican cada venta en el mes de la **compra**, no
  en el de su finalización. Se debe confirmar con el contador (§10).

---

## 2. Quién emite qué documento tributario

| Operación | Emisor | Documento | Receptor |
|---|---|---|---|
| Venta del repuesto | La tienda | Boleta electrónica (39), o factura (33) si el comprador tiene giro | Comprador |
| Comisión de servicio + IVA | **RepuesTop** | **Factura electrónica (33)** si la tienda es contribuyente de IVA; boleta solo si no tiene giro | Tienda |
| Venta de Monedas del Mural | **RepuesTop** | Factura (33) si el avisador tiene giro; boleta (39) si no | Avisador |
| Servicio de captación (si se retoma a honorarios) | El captador | Boleta de honorarios electrónica | RepuesTop |
| Retiro de utilidades del socio | Nadie | No existe documento tributario: es un registro societario | — |
| Devolución, cancelación o reembolso por mediación | Quien emitió el documento original | Nota de crédito electrónica (61) | Mismo receptor |

**La comisión se factura, no se "boletea".** Si RepuesTop emite boleta a una tienda con giro, la
tienda no puede usar el IVA como crédito fiscal y paga 19 % de más. El sistema propone factura
cuando la tienda tiene RUT y exige que ese RUT sea válido.

**La boleta de venta es un requisito bloqueante, y está bien resuelto.** La tienda no puede pasar el
pedido a `EN_PREPARACION` sin adjuntar su boleta (`PedidoEstadoSupport.exigirRequisitosDeConfirmacion`).
El archivo queda en el bucket privado de R2 (`boleta_venta/Pedido_{id}`), se le notifica al
comprador y él la ve en la app y en la web. Ninguna venta avanza sin documento, así que el
incumplimiento del art. 97 N° 10 del Código Tributario no puede acumularse sin que nadie lo note.
Dos debilidades pendientes: la boleta se valida por el `Content-Type` que declara quien la sube y no
por su contenido (§9.2 F), y el backoffice no tiene pantalla para consultarla (§9.2 E).

---

## 3. Obligaciones como operador de plataforma

Son obligaciones **de RepuesTop, con sanción propia**, no de las tiendas. No aparecen en las guías
contables genéricas.

### 3.1 Exigir inicio de actividades a cada tienda

El inciso duodécimo del art. 68 del Código Tributario (incorporado por la Ley 21.713) obliga a los
operadores de plataformas digitales de intermediación a exigir a quienes ofrecen productos que
acrediten su inicio de actividades.

La **Res. Ex. SII N° 99 de 2025** fija cómo verificarlo. Su vigencia efectiva es el **2 de enero de
2026**, porque la Res. Ex. SII N° 127 de 2025 la postergó; desde el 1 de octubre de 2025 hubo marcha
blanca. Su resolutivo 1° fija las vías:

- consulta individual del RUT en sii.cl → Servicios online → Situación tributaria → "Consultar
  situación tributaria de terceros";
- la API de consulta automatizada, previa solicitud según la Res. Ex. SII N° 117 de 2025
  (detalle en [solicitud-api-sii-inicio-actividades.md](solicitud-api-sii-inicio-actividades.md));
- otro medio que disponga el SII.

Un documento subido por la tienda **no está entre esas vías** y no muestra un término de giro
posterior. Por eso el sistema exige además la consulta del RUT en sii.cl al aprobar.

- Si la tienda registra término de giro, se exige un inicio de actividades posterior.
- Si el usuario declara estar liberado por el SII, la plataforma queda exenta de exigirlo, pero debe
  guardar esa declaración.
- **Sanciones:** a RepuesTop, art. 109 del Código Tributario. A la tienda que no emite documentos,
  art. 97 N° 10, incluida la clausura de su sitio dentro de la plataforma; si reitera, el Director
  puede pedir que se le suspenda el acceso al proveedor de pagos.

### 3.2 Certificado de cumplimiento y reverificación semestral

La **Res. Ex. SII N° 168**, de 27 de noviembre de 2025, vigente desde el 2 de marzo de 2026, agrega
una segunda capa:

| Qué | Cuándo | Resolutivo |
|---|---|---|
| Exigir el **certificado de cumplimiento tributario** al contratar (la tienda lo descarga de su sitio personal en sii.cl) | Al alta | 2° |
| Reverificar a todas las tiendas vigentes; sin la API, por consulta individual del RUT | **Enero y julio** | 1° y 3° letra a |
| Subir la nómina `RUT;DV` (txt o csv, cabeceras `RUT` y `DV`) | 5 al 15 de junio y de diciembre, **solo si RepuesTop está autorizada a la API** ("en la medida que hayan sido autorizadas") | 4° |
| El SII publica quiénes cumplen e incumplen | A más tardar el 17 de junio y el 17 de diciembre | 4° |
| La marca de incumplimiento dura hasta el fin del semestre | — | 5° |
| Anticipo de parte del IVA por operaciones con usuarios incumplidores | Cuando el SII lo reglamente | 7° |
| Sanción por no verificar | Art. 109 del Código Tributario | 9° |

**Quién es incumplidor:** quien no presentó al menos tres F29 en los 36 períodos previos al semestre
y una declaración de renta en los tres años tributarios previos; quien tiene denuncia o querella por
delito tributario en tramitación, o condena sin cumplir; o quien acumula seis meses de
antecedentes por justificar sin corregir tras aviso del SII. Si se detecta el 15 de marzo, la marca
rige hasta el 30 de junio.

**Qué dice el certificado y qué no.** El modelo oficial (anexo de la Res. 168) trae RUT, razón
social, fecha de los datos, "Cumple / No cumple" y los tres requisitos. **No dice si el inicio de
actividades sigue vigente**: por eso al alta se combina con la consulta del §3.1.

El primer ciclo fue excepcional: nómina del 2 al 16 de febrero de 2026 y publicación el 18 de febrero.

**Un incumplidor puede vender.** La resolución no lo prohíbe; lo que cambia es el anticipo de IVA
del resolutivo 7°. Esa resolución **aún no se dicta**: cuando salga, cambia la liquidación de las
tiendas marcadas "No cumple".

### 3.3 Tiendas sin inicio de actividades: el Registro de Subsistencia

La **Res. Ex. SII N° 193**, de 22 de diciembre de 2025 (vigente desde el 1 de enero de 2026), creó el
Registro de Pequeños Contribuyentes que desarrollan Actividades de Subsistencia. Un inscrito:

- es persona natural domiciliada en Chile, con una sola actividad, que vende **solo a consumidores
  finales** y tiene ingresos promedio mensuales de hasta **5 UTM** en los últimos seis meses;
- está exento de inicio de actividades, exonerado de IVA y liberado de emitir boletas, de llevar
  contabilidad y de declarar;
- recibe un certificado especial que le permite operar en plataformas "sin que sea necesario que
  estas entidades exijan la acreditación del inicio de actividades" (resolutivo 5° letra a).
- **Las plataformas deben exigir ese certificado desde el 1 de enero de 2027.** Así lo fijó la
  Res. Ex. SII N° 87, de 26 de junio de 2026, que reemplazó el resolutivo 9° (el texto original
  decía 1 de julio de 2026). Mientras tanto, la condición se puede validar en la Consulta Tributaria
  de Terceros.

La norma no obliga a la plataforma a admitir como vendedor a un inscrito. Solo dice que, si lo
admite, el certificado reemplaza la acreditación del inicio de actividades. Hoy el sistema exige
inicio de actividades a todas las tiendas y **no aprueba** a una tienda cuya verificación dé "Registro
de Subsistencia". Es una decisión comercial válida.

Si algún día se admiten tiendas inscritas, cambian tres cosas:

- habrá que exigirles el certificado;
- habrá que presentar la DJ 1966 (§3.6);
- una futura consulta de boletas (§9.2 E) no podrá marcarlas como incumplidoras, porque no emiten
  boleta.

### 3.4 El riesgo de quedar como responsable del IVA de la venta

El **art. 3° bis de la Ley sobre Impuesto a las Ventas y Servicios** hace contribuyente de IVA al
operador de la plataforma, como si fuera el vendedor habitual, cuando se cumplen tres requisitos a
la vez (Circular SII N° 39 de 30 de abril de 2025): que la plataforma facilite ventas de terceros,
que la operación esté gravada con IVA y que **ninguna de las partes sea contribuyente del impuesto**.
La Circular N° 60 de 15 de octubre de 2025 solo eliminó el apartado 3.6.5 de la N° 39, sobre bienes
importados con impuestos especiales. No cambia nada de lo que sigue.

Las tiendas de RepuesTop son contribuyentes de IVA, así que el régimen no se aplica. Pero la
circular agrega:

> "Corresponde al vendedor o prestador de servicio informar al respectivo operador su calidad de
> contribuyente de IVA (...). Si el vendedor o prestador de servicio no cumple dicha obligación, el
> operador de la plataforma será el responsable del pago del IVA por la operación subyacente."

Es decir: **sin constancia de que la tienda declaró ser contribuyente de IVA, el IVA de sus ventas
lo paga RepuesTop.** Por eso el sistema guarda esa declaración con fecha, IP, navegador y versión
del texto (§8.3).

Quedan fuera del art. 3° bis las plataformas que solo prestan publicidad o procesamiento de pagos.
Cuando intervienen varias plataformas, responde la que autoriza o procesa el pago.

### 3.5 Información del art. 35 I

Aunque no sea responsable del impuesto, el operador debe entregar la información que tenga sobre
**la identificación de los vendedores intermediados y las cantidades que se les paguen o pongan a
disposición** (inciso segundo del art. 35 I LIVS). Está reglamentado para vendedores sin domicilio
en Chile (Res. 93 de 2025 y Res. 20 de 2024); para los locales llega como requerimiento de
información del SII. Hay que poder responderlo con un reporte por RUT y período (§9.2 G).

### 3.6 Informe anual: DJ 1966

El art. 68 inciso 12° obliga a informar cada año a las personas que **declararon no requerir inicio
de actividades**, con la cantidad de operaciones mensuales y el monto total. Hasta 2026 se hacía con
el formato del Anexo 2 de la Res. 99, hasta el 1 de marzo de cada año. Desde el año tributario 2027
(información del año comercial 2026) se hace con la **Declaración Jurada N° 1966**, también hasta el
**1 de marzo** (Res. Ex. SII N° 115, de 31 de agosto de 2026).

La DJ informa solo a quienes hicieron esa declaración. RepuesTop exige inicio de actividades a todas
las tiendas, así que **en principio no tiene a quién informar**. Queda por confirmar con el contador
si igual debe presentarse sin datos (§10). Si algún día se admiten tiendas sin inicio de actividades,
el sistema tendrá que guardar su declaración y sus operaciones mensuales para esta DJ.

También queda abierta la pregunta de si se presentaron la nómina de febrero y el informe de marzo de
2026 de la Res. 99 (§10).

---

## 4. Notas de crédito y el plazo de 6 meses

El art. 21 N° 2 y el inciso segundo del art. 70 del DL 825 permiten rebajar el IVA del débito
fiscal por una devolución o una resciliación solo si ocurre dentro de **seis meses** desde la
entrega. El plazo era de tres meses y lo subió la Ley 21.398 (vigente desde el 24 de marzo de 2022).

- Una nota de crédito emitida después de 6 meses **no rebaja el débito** (pregunta frecuente SII
  [001.130.1212](https://www.sii.cl/preguntas_frecuentes/impuestos_mensuales/001_130_1212.htm),
  actualizada al 10/06/2025).
- Una boleta electrónica se anula con nota de crédito electrónica (pregunta frecuente SII
  [001.380.5352](https://www.sii.cl/preguntas_frecuentes/bol_electr_vtas_serv/001_380_5352.htm),
  14/07/2026).

**Qué casos generan nota en RepuesTop:**

| Caso | Quién emite | Qué anula |
|---|---|---|
| Reembolso por mediación, cancelación del comprador o del vendedor, o bloqueo de la tienda, después de que la tienda subió su boleta | La tienda | Su boleta de venta |
| Reembolso que llega **después** de liquidar el retiro de la tienda | RepuesTop | Su factura de comisión |

RepuesTop casi nunca emite nota propia: la comisión se calcula sin lo ya reembolsado. Solo la emite
cuando el reembolso llega después de facturar la comisión.

**El riesgo real no es el día 150.** Como la mediación se pide dentro de 10 días, casi ningún caso
llega a los 6 meses. El riesgo es el reembolso que nadie documenta. Por eso la alerta tiene tres
niveles (§8.2).

---

## 5. Cómo deben retirar los socios

El backend obliga a declarar qué es cada giro de dinero (`NaturalezaRetiroSocio`, SEC-BACKEND-121):
`RETIRO_DE_UTILIDADES`, `DEVOLUCION_DE_CAPITAL`, `PRESTAMO`, `REMUNERACION`, `GASTO_RECHAZADO`. Es
el dato que necesita el SII, porque **la misma transferencia tributa distinto según lo que sea**.
El documento de respaldo adjunto es interno: "Comprobante de retiro", "Liquidación de sueldo" o
"Documento Tributario". Ya no se ofrece "Boleta de Honorarios", que deducía un gasto que el SII
rechaza y le cobraba retención al socio por una utilidad.

El orden recomendado va de lo que no es renta a lo que sí lo es:

### Etapa 1. Recuperar lo que pusieron: `DEVOLUCION_DE_CAPITAL` o `PRESTAMO`

Recuperar lo aportado **no es renta**, pero solo si está documentado desde el origen.

- **Aporte de capital:** consta en la escritura o en un aumento de capital. Se devuelve como
  `DEVOLUCION_DE_CAPITAL`. El art. 17 N° 7 de la LIR se remite al orden de imputación del art. 14:
  primero las rentas afectas a impuesto, luego las demás utilidades acumuladas y recién al final el
  capital. Si ya hay utilidades, el SII trata la devolución como retiro de ellas. Por eso conviene
  hacerlo **antes** de acumularlas, que es donde están ahora. La disminución de capital debe además
  formalizarse en la escritura.
- **Préstamo del socio a la empresa:** es una cuenta por pagar. Se devuelve como `PRESTAMO` y no es
  renta. Requiere contrato o acta con fecha, monto y prestamista, más la transferencia que lo pruebe.
  Sin eso, el SII lo trata como aporte informal o como retiro.

**Hay que ordenarlo ya:** revisar cada transferencia de los socios a la empresa desde el inicio,
clasificarla y dejarla en un acta con su comprobante bancario.

### Etapa 2. Gastos que pagaron ellos: reembolso, no retiro

Si un socio pagó hosting, dominios, publicidad o notaría con su tarjeta, eso **se reembolsa**, no se
retira, siempre que el documento esté **a nombre de la empresa, con su RUT**.

- Con documento a nombre de la empresa: se registra en Caja y gastos con el comprobante y el
  reembolso es un pago normal. No pasa por Retiros ni tributa.
- Con documento a nombre personal: no es gasto de la empresa. Si ya se reembolsó, se registra como
  `GASTO_RECHAZADO` y se asume el impuesto, o como préstamo del socio si corresponde.

Ojo: hoy el comprobante de un gasto es **opcional** en el sistema, y no hay un campo que diga quién
pagó (§9.2 H y §9.3).

### Etapa 3. El sueldo: `REMUNERACION` por sueldo empresarial

Cuando se paguen mensualmente por trabajar en la empresa, la figura es el **sueldo empresarial**
(párrafo cuarto del N° 6 del inciso cuarto del art. 31 de la LIR):

- Es **gasto aceptado** (el retiro de utilidades no lo es).
- El límite es que sea "razonablemente proporcionado" a la importancia de la empresa, las rentas
  declaradas y los servicios prestados. La Ley 21.210 (2020) eliminó el tope anterior, que era el
  monto afecto a cotizaciones previsionales obligatorias (Circular SII N° 53 de 2020, apartado
  3.7.4).
- Exige **trabajo efectivo y permanente**. Conviene dejar en un acta la función de cada socio.
- Según el Oficio SII N° 2069, de 16 de octubre de 2025, "no existe un monto mínimo obligatorio" y
  cotizar no es requisito para que el gasto se acepte.
- Según el Oficio SII N° 147, de 21 de enero de 2026, la colación y la movilización que se le paguen
  al socio **no** son ingreso no renta: quedan afectas al impuesto único y se informan en la DJ 1887.
- Para el socio es renta del art. 42 N° 1: impuesto único de segunda categoría, retenido por la
  empresa, informado en el Libro de Remuneraciones Electrónico y en la DJ 1887.
- Es una ficción tributaria: no crea contrato de trabajo ni derechos laborales.

Se registra como retiro con naturaleza `REMUNERACION` y se respalda con una liquidación de sueldo.

### Etapa 4. Utilidades: `RETIRO_DE_UTILIDADES`

Es el 30 % actual. El socio residente no sufre retención: tributa en su Global Complementario con
crédito por el impuesto de primera categoría. En el régimen 14 D N° 3, la empresa lo informa en la
**DJ 1948**: para el año tributario 2027 vence el 29 de marzo de 2027 si el socio es persona natural
(Res. Ex. SII N° 135 de 2026). La antigua DJ 1886 ya no figura en los calendarios. No lleva documento
tributario ni IVA. El rótulo "Anticipo de Dividendos" de la nómina BCI es
correcto.

Advertencia: un anticipo mensual retira contra una utilidad que solo se conoce al cierre. Si el
ejercicio cierra con menos renta que lo retirado, el socio tributa igual y la empresa queda
descapitalizada. Hay que dejar colchón y revisar el monto cada trimestre.

### Lo que nunca conviene

- **Préstamo de la empresa al socio:** es la categoría de mayor riesgo. Sin contrato, plazo y
  devolución real, el SII lo recalifica como retiro encubierto.
- **Retirar dinero de las tiendas o IVA recaudado**, aunque esté en la cuenta. El 70/30 sobre la
  ganancia neta ya lo excluye.

---

## 6. Captadores: retención de honorarios (en pausa)

**En pausa desde octubre de 2026.** El modelo a honorarios no funcionó en las entrevistas: los
candidatos exigen sueldo base. Con sueldo base la relación es **laboral**: contrato, Libro de
Remuneraciones Electrónico, cotizaciones en Previred, impuesto único de segunda categoría, seguro de
cesantía, mutual, provisiones de vacaciones e indemnizaciones, DJ 1887 y finiquitos. En un modelo
mixto (sueldo más comisión), la comisión también es remuneración. El costo real es del orden de un
20 a 25 % sobre el sueldo.

Si se retoma el esquema a honorarios para captadores ocasionales:

- La retención la practica el pagador (RepuesTop): **15,25 % en 2026**, 16 % en 2027 y 17 % en 2028
  (Ley 21.133).
- Se paga el 84,75 % líquido y la retención se entera en el F29 del mes siguiente.
- Se informa en la DJ 1879 y se emite certificado al captador.
- Hoy Pago a captadores muestra un solo monto, sin separar bruto, retención y líquido. Habría que
  modelarlo antes de pagar a honorarios.

---

## 7. Calendario tributario

| Cuándo | Obligación | Dónde en el backoffice |
|---|---|---|
| Día 12 del mes siguiente | F29, regla general | Resumen, Caja, Pedidos → Publicidad |
| Día 20 del mes siguiente | F29 de facturadores electrónicos que declaran y pagan por internet | ídem; export "Documentos emitidos del mes" en Liquidaciones |
| Día 28 | F29 sin movimiento o sin pago, por internet | — |
| Todos los martes | Ronda de pago a captadores | Pago a captadores |
| Jueves | Pago del ciclo de retiros (jueves a miércoles) a tiendas y socios | Pago a proveedores |
| Todos los días | Alertas de recargas sin documento, notas de crédito y situación tributaria (§8.5) | Campana del backoffice |
| 2 y 20 de enero y julio | El sistema pide el certificado de cumplimiento a las tiendas | Automático |
| Enero y julio | Reverificación semestral de todas las tiendas vigentes | Confianza → Cumplimiento tributario |
| 5 al 15 de junio y de diciembre | Nómina `RUT;DV` al SII, **solo con la API autorizada** | Confianza → Cumplimiento tributario → "Nómina RUT;DV" |
| 1 de marzo | DJ 1966, solo si hay tiendas que declararon no requerir inicio de actividades (§3.6) | — |
| 29 de marzo de 2027 | DJ 1879 (honorarios), DJ 1887 (sueldos) y DJ 1948 (retiros de socios personas naturales), año tributario 2027 (Res. 135 de 2026) | Contador |
| Abril | F22, renta anual | Contador |

Detalle del F29 (preguntas frecuentes SII
[001.130.1060](https://www.sii.cl/preguntas_frecuentes/impuestos_mensuales/001_130_1060.htm) y
[001.130.0182](https://www.sii.cl/preguntas_frecuentes/impuestos_mensuales/001_130_0182.htm)):

- el día 20 exige ser facturador electrónico y declarar **y pagar** por internet;
- las declaraciones sin movimiento o sin pago por internet vencen el día 28.

**Régimen tributario: por confirmar cuál tiene la sociedad.** Si es Pro Pyme General (14 D N° 3), el
art. 25 de la Ley 21.755 (Diario Oficial del 11 de julio de 2025; Circular SII N° 53 de 2025) fija:

- **tasa de primera categoría:** 12,5 % para los años comerciales 2025, 2026 y 2027 (años
  tributarios 2026 a 2028), 15 % para el año comercial 2028 y 25 % después. La rebaja está
  condicionada a la cotización de la Ley 21.735;
- **PPM:** rebajados a la mitad hasta los ingresos de diciembre de 2027;
- **no aplica** al régimen 14 D N° 8.

---

## 8. Qué hace hoy el sistema

### 8.1 Documento de la comisión y de las recargas

**Qué se construyó:**

- **Factura por la comisión.** El modal de Liquidaciones propone `Factura` si la tienda tiene RUT y
  `Boleta` solo si no. Una factura exige RUT de receptor **válido**.
- **Folio y fecha de emisión obligatorios** en el documento de cada retiro de tienda y en el de cada
  recarga de Monedas (migración `V2026100901`). El folio:
  - es solo dígitos, sin ceros a la izquierda, hasta 10 dígitos;
  - **no puede repetirse para el mismo tipo de DTE entre retiros y recargas**, porque comparten la
    numeración de RepuesTop.
- **La fecha no puede ser futura.** El modal avisa si la factura se emite en un mes distinto al del
  retiro.
  - El art. 55 del DL 825 dice que la factura de un servicio se emite en el período en que se
    percibe la remuneración.
  - El IVA se devenga, según el art. 9 letra a), cuando la remuneración se percibe o se pone a
    disposición.
  - El Oficio SII 2147 de 2016 permite facturar antes del pago, adelantando el devengo.
  - Qué mes es ese para la comisión es pregunta al contador (§10).
- **La factura lleva dos líneas afectas** (hallazgo Y, Oficios SII 2278 y 2316 de 2026):
  "Comisión de servicio RepuesTop" y "Cargo por procesamiento de pago", que es lo que se le descuenta
  a la tienda por Flow. El servidor calcula el neto y el IVA de cada una por pedido
  (`GET /administration/withdrawals/{id}/factura-comision`), y el modal de Liquidaciones los muestra
  en "Datos para emitir en el SII". Se puede volver a facturar solo la comisión con
  `REPUESTOP_FACTURA_INCLUYE_PASARELA=false`.
- **IVA recalculado por el servidor** desde los productos del retiro, con las dos líneas; lo que envía
  la pantalla se descarta. El export del mes usa el mismo cálculo.
- **Puerta de pago:** un retiro de tienda no se paga si su documento no tiene tipo, RUT, razón
  social, correo, detalle, IVA, folio, fecha de emisión y PDF (`documentoLiquidacionCompleto`).
- **Export "Documentos emitidos del mes"** en Liquidaciones: CSV por fecha de emisión con:
  - comisiones (código SII 33 o 39), recargas y notas de crédito de RepuesTop (61, en negativo);
  - neto e IVA calculados por el servidor;
  - al final, los documentos del mes sin folio o sin fecha, que no suman al total;
  - la columna Observación advierte si el IVA guardado difiere del recalculado.
- **Documento de socio:** "Comprobante de retiro", "Liquidación de sueldo" o "Documento
  Tributario", sin folio (no es DTE). El tipo ya registrado se conserva en la lista aunque ya no se
  ofrezca, para no romper los históricos.

**Ojo:** el correo con el PDF de la factura le llega a la tienda **cuando se paga el retiro**, no al
registrar el documento.

**Pendiente de decisión:** la cláusula 9 de los términos ("Retiros y factura de comisión") dice que
RepuesTop emite "la factura por la comisión y su IVA". La plata de la tienda no cambia, pero la factura
ahora tiene una segunda línea. Ajustar el texto obliga a subir la versión legal y a que todos vuelvan
a aceptar.

### 8.2 Notas de crédito (migración `V2026100902`)

**Qué se encontró en el backend y cambió el diseño:**

- **La fecha de entrega se perdía.** `cerrarSubordenesEnMediacion` sobrescribía `entregadoAt` con la
  fecha de resolución. Ahora existe la columna `primera_entrega_at`, que se fija la primera vez y no
  cambia. Para los pedidos antiguos se toma la fecha más temprana disponible.
- **Las cancelaciones también necesitan nota**, porque la tienda emite su boleta antes de
  `EN_PREPARACION`.

**Qué se construyó:**

- Tabla `bo_nota_credito` (una nota por reembolso y emisor), `NotaCreditoBackofficeService` y
  endpoints `/administration/credit-notes`.
- Vista **Cumplimiento SII → Notas de crédito** con:
  - las pendientes y su vencimiento;
  - las mediaciones abiertas con más de 150 días desde la entrega;
  - las notas registradas;
  - el modal para registrar folio, fecha, monto y PDF.
- **Niveles de cada nota pendiente:**

  | Nivel | Regla |
  |---|---|
  | Al día | Menos de 7 días desde el reembolso |
  | Atrasada | 7 días o más sin nota |
  | Crítica | 150 días o más desde la entrega (o la boleta, o la factura) |
  | Vencida | Pasaron 6 meses: la nota ya no rebaja el IVA |

  Los 7 y 150 días se configuran con `repuestop.tributario.nota-credito.dias-aviso` y `dias-critico`.
- **El PDF se valida por su contenido real**, no por el `Content-Type`. Se rechazan:
  - el folio repetido entre notas de RepuesTop;
  - la fecha futura y el monto cero;
  - una segunda nota para el mismo reembolso;
  - una nota de un emisor que no tenía documento que anular.
- Solo cuentan los reembolsos posteriores a `repuestop.tributario.corte-produccion`
  (2026-09-10).
- **`AlertaNotaCreditoJob`:** avisa al equipo y le pide la nota a la tienda (§8.5). Las tiendas la
  envían a `repuestop.contabilidad.email-documentos`, hoy contacto@repuestop.cl.

### 8.3 Situación tributaria de las tiendas (migraciones `V2026100903` y `V2026100905`)

**Datos que guarda:**

| Dónde | Qué |
|---|---|
| `rt_proveedor` | Declaración de contribuyente de IVA: fecha, IP, navegador y versión del texto |
| `rt_verificacion_proveedor` | El certificado de cumplimiento subido al alta (5° documento) |
| `rt_situacion_tributaria_proveedor` | Historial de verificaciones: fecha, vía (`CONSULTA_WEB`, `CERTIFICADO`, `API`), resultado, semestre, vigente hasta, evidencia, quién la registró |
| `rt_certificado_cumplimiento` | Certificados semestrales subidos desde Mi tienda, con su revisión |

**Resultados posibles de una verificación:** Cumple, No cumple, Sin inicio de actividades, Término
de giro, Registro de Subsistencia.

**Al alta (app y web market):**

1. En el paso de documentos, la tienda sube el **certificado de cumplimiento** y marca la
   **declaración de contribuyente de IVA**. En la web, la boleta de ejemplo también quedó
   obligatoria, como ya exigía el backend.
2. El contrato de adhesión tiene una cláusula 7 nueva: declaración de IVA, entrega del certificado
   y autorización para verificar en enero y julio. También está en la copia de la app.
3. Las tiendas ya aprobadas sin declaración ven, después del contrato, un aviso para hacerla.

**Al aprobar (Confianza → Validaciones):**

- El revisor registra, en el bloque "Registrar verificación del alta":
  - lo que dice el certificado: Cumple o No cumple, y su fecha;
  - el estado del inicio de actividades consultado en sii.cl.
- La verificación queda con vía `CERTIFICADO` y el certificado como evidencia.
- **"Aprobar" exige tres cosas:** declaración de IVA + certificado + verificación del semestre con
  resultado Cumple o No cumple.
  - Término de giro, sin inicio de actividades y Registro de Subsistencia **no** se pueden aprobar.
  - Un incumplidor (No cumple) **sí** se puede aprobar.
- La exigencia se aplica en las tres rutas que aprueban:
  - Validaciones;
  - `PATCH /sellers/{id}`;
  - la API externa.
- Se puede apagar con `REPUESTOP_EXIGIR_SITUACION_TRIBUTARIA=false`, **solo en pruebas**.

**Decisión de diseño:** la declaración y el certificado son obligatorios **al aprobar**, no al subir
los documentos. Así una app antigua no deja de funcionar y la tienda que no los entregó recibe una
petición de corrección.

**Cada semestre (paso 2):**

1. El 2 y el 20 de enero y de julio, `ReverificacionSemestralJob` le pide el certificado, por la app
   y por correo, a cada tienda vigente que no esté al día ni tenga uno en revisión.
2. La tienda lo sube en **Mi tienda** (app y web). Queda en revisión **sin que la tienda vuelva a
   revisión**: sigue vendiendo.
3. Confianza lo revisa en **Confianza → Cumplimiento tributario → "Certificados por revisar"**:
   - Cumple o No cumple crean la verificación del semestre, con el PDF como evidencia;
   - Rechazar le pide otro a la tienda, con el motivo;
   - un certificado de otro semestre no se acepta.
4. Las tiendas que no suben certificado se verifican a mano: consulta del RUT en sii.cl y registro
   con evidencia, desde la misma pantalla o desde el perfil de la tienda (Confianza → Vendedores).

**Quién lo hace (9-oct):** la situación tributaria pasó de Administración Contable a Confianza, que
aprueba las tiendas. La bandeja semestral está en Confianza → Cumplimiento tributario, cada perfil de
tienda muestra su situación y permite verificarla, y la alerta de las 08:10 llega a Confianza. Las
notas de crédito siguen en Administración Contable → Cumplimiento SII.

**Para cuando exista la API:** la pestaña ya permite descargar la nómina `RUT;DV` y la vía `API` ya
existe en el modelo, desactivada.

### 8.4 Retiros de socios

- Naturaleza tributaria obligatoria al registrar (§5).
- Documento de respaldo obligatorio para pagar: tipo, RUT, razón social, correo, detalle y PDF.
- Se pagan junto con los retiros de tiendas en Pago a proveedores, en una nómina BCI separada con el
  mensaje "Anticipo de Dividendos".
- Pendiente: la naturaleza no se muestra después de registrarla (§9.2 J).

### 8.5 Alertas automáticas

**Destinatarios:** todos los super administradores y quienes tienen permiso del área que atiende
cada alerta: Administración Contable las de las 08:00 y 08:05, Confianza la de las 08:10. **Canal:** la campana del backoffice, y push solo si la persona usa la app móvil con la
misma cuenta. Ninguna llega por correo al equipo. Sale una por persona y por día.

| Job | Hora (Chile) | Qué revisa | Lleva a |
|---|---|---|---|
| `AlertaCumplimientoTributarioJob` | 08:00 | Recargas de Monedas con más de 48 h sin documento | Pedidos → Publicidad |
| `AlertaNotaCreditoJob` | 08:05 | Notas de crédito atrasadas, críticas o vencidas, y mediaciones al límite. A la tienda: "Emite la nota de crédito del pedido…" | Administración Contable → Cumplimiento SII |
| `ReverificacionSemestralJob` | 08:10 | Tiendas vigentes sin verificar este semestre o sin declaración de IVA. Los días 2 y 20 de enero y julio, además, pide el certificado a las tiendas | Confianza → Cumplimiento tributario |

**La zona horaria:** el servidor de Railway corre en UTC (confirmado con `date` en la consola: "Fri
Oct 9 01:50:46 UTC 2026"), y hasta el 8 de octubre los `@Scheduled` no fijaban zona, así que las
alertas salían a las 05:00 de Chile. Desde ese día los tres jobs llevan `zone = "America/Santiago"`
(hallazgo L). Las fechas internas (el día, el semestre, los días 2 y 20, los vencimientos) ya se
calculaban en hora de Chile.

**Correcciones a las alertas:**

- El job de las 08:00 **nunca había funcionado**: `(:corte is null or fecha >= :corte)` hacía fallar
  a Postgres ("no se pudo determinar el tipo del parámetro"). Se corrigió el 8 de octubre.
  `contarSubordenesSinBoletaAntiguas` tiene el mismo patrón, pero no se usa.
- Ya no cuenta ventas sin boleta por subórden, porque la boleta es bloqueante.

### 8.6 Configuración

| Propiedad | Variable de entorno | Valor por defecto |
|---|---|---|
| `repuestop.tributario.alerta.cron` | `REPUESTOP_TRIBUTARIO_CRON` | `0 0 8 * * *` |
| `repuestop.tributario.nota-credito.cron` | `REPUESTOP_NOTA_CREDITO_CRON` | `0 5 8 * * *` |
| `repuestop.tributario.reverificacion.cron` | `REPUESTOP_REVERIFICACION_CRON` | `0 10 8 * * *` |
| `repuestop.tributario.corte-produccion` | `REPUESTOP_TRIBUTARIO_CORTE` | `2026-09-10T00:00:00Z` |
| `repuestop.contabilidad.email-documentos` | `REPUESTOP_EMAIL_DOCUMENTOS` | `contacto@repuestop.cl` |
| `repuestop.tributario.exigir-situacion-para-aprobar` | `REPUESTOP_EXIGIR_SITUACION_TRIBUTARIA` | `true` (nunca `false` en producción) |
| `repuestop.tributario.factura-incluye-pasarela` | `REPUESTOP_FACTURA_INCLUYE_PASARELA` | `true`: la factura incluye el cargo por procesamiento de pago (hallazgo Y) |
| `repuestop.tributario.nota-credito.dias-aviso` | — | 7 |
| `repuestop.tributario.nota-credito.dias-critico` | — | 150 |

---

## 9. Pendientes

### 9.1 Siguientes pasos acordados

**Paso 3. Solicitar la API Inicio de Actividades (Res. 117 de 2025).**

- La presenta el **representante legal** en la Oficina de Partes Virtual de sii.cl.
- Requiere la **IP de salida fija** del servicio de producción. En Railway eso exige el **plan Pro**
  (tres IPv4 por servicio).
- El detalle y el texto propuesto están en
  [solicitud-api-sii-inicio-actividades.md](solicitud-api-sii-inicio-actividades.md).
- Hasta que se apruebe, la consulta manual es igual de válida.

**Paso 4. Leer el PDF del certificado al subirlo** y proponer RUT, fecha y estado (Cumple o No
cumple), para que la revisión sea confirmar en vez de transcribir.

### 9.2 Pendientes del análisis inicial

- **E. Consulta de boletas de venta en el backoffice.** Los endpoints
  `/api/v1/administration/sale-receipts` siguen vivos; el `BoletasVentaPage.tsx` borrado se recupera
  del commit `62951d9`. Va como pestaña de Cumplimiento SII y debe distinguir al inscrito en
  Subsistencia del incumplimiento real.
- **F. Validar la boleta de venta por contenido.** `PedidoBoletaVentaSupport.validarArchivo` valida
  solo el `Content-Type`. Hay que usar `ArchivoSeguro.detectarTipoReal`, como en la boleta de
  honorarios y en la nota de crédito.
- **G. Reporte del art. 35 I.** Vendedores intermediados y montos pagados por período. Los datos ya
  existen en liquidaciones y retiros.
- **H. "Quién pagó" en Gastos** (empresa o socio), para separar el gasto directo del reembolsable.
- **I. Borrar las constantes muertas** de `modules/administration/constants.ts`: `COMMISSION_RATE`,
  `MIN_COMMISSION`, `MAX_COMMISSION`, `GATEWAY_RATE`, `GATEWAY_IVA`, `SETTLEMENT_STATUS_OPTIONS`. No
  se usan y contradicen las tasas reales.
- **J. Mostrar la naturaleza del retiro de socio** en la lista y en la vista de pago, para que el
  respaldo dependa de ella.
- **Caja:** `createMediation` y `abrirDesdeAlerta` no revisan el plazo de 10 días ni si el retiro ya
  se pagó. Un reembolso sobre un ítem ya liquidado no tiene cómo recuperar la plata de la tienda.
- **Fase 2 de notas de crédito:** que la tienda suba su nota desde la app y la web, con el mismo
  patrón de la boleta de venta, en vez de enviarla por correo.

### 9.3 Hallazgos contables del recorrido del 8 de octubre

Encontrados al revisar el backoffice completo contra el backend para escribir el manual. Las fallas
de pantalla que no son contables están en
[fallas-backoffice-2026-10-08.md](fallas-backoffice-2026-10-08.md).

| Id | Hallazgo | Riesgo |
|---|---|---|
| K | **Corregido el 8-oct (sin desplegar): "Procesar pago" solo marca la última nómina exportada de cada tipo, también en captadores.** **"Procesar pago" marca como pagados todos los retiros pendientes del momento**, no los del Excel subido al banco. Si una tienda pide un retiro entre la descarga y la confirmación, queda pagado sin transferencia. El conteo del modal incluye además los retenidos | Alto: pasivo con la tienda que el sistema da por saldado |
| L | **Corregido el 8-oct (sin desplegar).** Los jobs corren en UTC: las alertas de "las 08:00" salen a las 05:00 o 04:00 de Chile (§8.5). Fijar `zone = "America/Santiago"` en los `@Scheduled` | Bajo |
| M | **Corregido el 8-oct (sin desplegar): obligatorio, validado por contenido, con categoría de la lista.** El comprobante de un gasto es **opcional** en la pantalla y en el backend, que tampoco valida su tipo, su tamaño ni la categoría | Medio: gasto sin respaldo |
| N | Caja, Resumen y Socios ubican cada venta en el mes de la **compra**, no en el de su finalización. El reparto 70/30 y los retiros dependen de ese criterio | Medio: definir con el contador |
| O | En Liquidaciones → Liquidado, "Monto total pagado" incluye los retiros de socios, y "Ganancia neta" e "IVA pagado" toman las ventas de la semana del pago, no las incluidas en ese pago | Medio: cifras que no cuadran |
| P | Export "Documentos emitidos del mes": un retiro rechazado aparece con neto e IVA en 0; un documento con fecha pero sin folio puede salir dos veces; uno sin fecha creado en otro mes no sale en ningún mes | Medio: conciliación con el RCV |
| Q | El "IVA liquidado del socio" se puede escribir, pero el backend guarda vacío | Bajo |
| R | `/partner-withdrawals` y `/socios` solo exigen el permiso contable, no super administrador, y el tope de saldo se valida con la cifra que envía la pantalla | Medio: control interno |
| S | `PUT /proveedores/{id}/verificacion/revision` aprueba una verificación **sin** exigir la situación tributaria. El backoffice no la usa, pero existe | Medio: ruta que salta la Res. 168 |
| T | **Corregido el 8-oct (sin desplegar).** Las alertas tributarias no son "importantes" en el catálogo de notificaciones: quien tenga su preferencia en "Importantes" no ve subir el contador de la campana | Medio: alerta que pasa inadvertida |
| U | En Validaciones se puede registrar un certificado de otro semestre (solo se advierte) y la aprobación sigue bloqueada sin decir por qué | Bajo |
| V | Una verificación con resultado "Sin inicio" o "Término de giro" deja a la tienda "Al día" en el semestre | Bajo: la métrica se ve mejor de lo que está |
| W | La métrica "Sin certificado" cuenta también las tiendas en revisión; las demás cuentan solo las vigentes | Bajo |
| X | La verificación del alta en Validaciones guarda el certificado como evidencia, pero **no la consulta del inicio de actividades en sii.cl**: queda solo lo que marcó el revisor, con su nombre y la fecha. La verificación manual de Cumplimiento SII sí permite adjuntar la captura. Conviene permitirla también al alta | Medio: prueba ante el art. 109 |
| Y | **Corregido el 8-oct (sin desplegar), con la propiedad `REPUESTOP_FACTURA_INCLUYE_PASARELA`.** **La factura de comisión no incluye lo que se descuenta a la tienda por Flow.** Según los Oficios SII 2278 y 2316 de 2026, la remuneración afecta es todo lo retenido (precio − monto rendido); la comisión de Flow es un gasto de RepuesTop con crédito fiscal, no una rebaja de la base. Hoy se factura solo el 8 % + IVA. Efecto: $549 menos de débito fiscal por cada $100.000 vendidos, si se usa el crédito de Flow (§1). Arreglo propuesto, a confirmar con el contador antes de tocar código: que el neto de la factura sea el total retenido a la tienda dividido por 1,19, y que el export y el IVA recalculado lo reflejen | **Alto**: diferencia de IVA en cada venta |
| Z | **Los pagos con Flow podrían estar quedando en el Registro de Compras y Ventas como ventas de RepuesTop.** El Oficio 2278 explica que, si el comprobante de pago electrónico (voucher) vale como boleta (Res. Ex. SII N° 176 de 2020), el monto total se registra automáticamente en el RCV, y que el intermediario debe regularizarlo o declarar en sii.cl que emite sus propias boletas por todas sus operaciones electrónicas. Revisar en el RCV de RepuesTop si aparecen esos montos | **Alto**: débito fiscal sobre dinero de las tiendas |

---

## 10. Preguntas abiertas

**Para los socios:**

1. **Régimen tributario y tipo societario.** Se ven en la cartola tributaria de Mi SII. Definen
   tasas, plazos y qué declaraciones juradas corresponden. El rótulo "Anticipo de Dividendos" sugiere
   una SpA.
2. **¿Cómo quedaron registradas las transferencias de los socios a la empresa?** Aporte de capital o
   préstamo. De eso depende que recuperarlas sea libre de impuesto, y conviene ordenarlo antes de
   acumular utilidades (art. 17 N° 7 LIR).
3. **¿Está el capital social suscrito y pagado** en la escritura, y por cuánto?
4. **¿Se presentaron la nómina de febrero y el informe de marzo de 2026** de la Res. 99?

**Para el contador:**

5. **Base del IVA de la comisión (hallazgo Y).** ¿Confirma que, según los Oficios 2278 y 2316 de 2026,
   la factura a la tienda debe ir por todo lo retenido (comisión + IVA + lo descontado por Flow) y
   que la factura de Flow queda como crédito fiscal de RepuesTop? Es la prioridad uno: cambia el
   cálculo de cada factura.
6. **Vouchers en el RCV (hallazgo Z).** ¿Aparecen en el Registro de Compras y Ventas de RepuesTop los
   pagos de los compradores por Flow? Si es así, ¿corresponde declarar en sii.cl que RepuesTop emite
   sus propias boletas por todas sus operaciones electrónicas, o regularizar (Res. 176 de 2020)?
7. **¿En qué mes se considera percibida la comisión?** El de la venta, el de la liberación de fondos
   o el del retiro (art. 9 letra a y art. 55 del DL 825). Define el mes de la factura y del débito
   fiscal.
8. **¿Qué fecha manda para los ingresos del mes:** la compra o la finalización del pedido (hallazgo
   N)?
9. **¿Sirve el certificado de cumplimiento para la reverificación semestral?** La Res. 168 menciona
   la consulta y la API (resolutivo 3°), no el certificado. El certificado dice que su estado se
   actualiza en enero y julio, así que uno reciente refleja el semestre.
10. **¿Hay que presentar la DJ 1966 sin datos** si ninguna tienda declaró no requerir inicio de
    actividades (§3.6)?
11. **Régimen efectivo y tasa de primera categoría** antes de provisionar (§7).

**Seguimiento normativo:**

12. **¿Dictó el SII la resolución del resolutivo 7° de la Res. 168** (anticipo de IVA por
    operaciones con incumplidores)? Al 8 de octubre de 2026, no: el índice de resoluciones de 2026
    llega a la N° 138, del 6 de octubre, sin ninguna sobre el tema. Cuando salga, cambia la
    liquidación de las tiendas marcadas "No cumple".
13. **Res. 193:** la Res. 87 de 2026 reescribió el resolutivo 9°, así que no queda claro si sigue
    vigente el plazo de inscripción hasta el 30 de junio de 2026. Solo importa si se admiten tiendas
    inscritas.

---

## 11. Registro de cambios

Todo ocurrió el **8 de octubre de 2026**. Las migraciones llevan fecha 9 de octubre en su nombre
(`V202610090x`), pero los commits son del 8. Los documentos anteriores fechaban parte de este
trabajo el 9 y el 10 de octubre por error.

| Hora | Repo | Commit | Cambio |
|---|---|---|---|
| 11:34 | backoffice | `62951d9` | Se quita la boleta por pedido y el panel de boletas de venta (el backend queda intacto) |
| 11:34 | backend | `8c44839c` | El aviso diario deja de contar ventas sin boleta por subórden |
| 13:27 | backoffice | `c7ad1e2` | Factura por la comisión; comprobante de retiro para socios |
| 13:39 | backend | `6adc2428` | Folio y fecha de emisión; export del mes (`V2026100901`) |
| 13:39 | backoffice | `c20cd85` | Modal con folio y fecha, export CSV, recargas; sin "Boleta de Honorarios" en Pago a proveedores |
| 13:51 | backend | `a8edcf9b` | Notas de crédito y alerta de 6 meses (`V2026100902`) |
| 13:51 | backoffice | `e266178` | Vista Cumplimiento SII con las notas pendientes |
| 14:30 | backend | `9cb1bb1a` | Consultas de alertas tributarias sin parámetro nulo (el job de las 08:00 vuelve a funcionar) |
| 14:37 | backend | `57122abf` | La factura de comisión exige RUT válido |
| 14:54 | backend | `317a7a64` | contacto@repuestop.cl recibe las notas de crédito de las tiendas |
| 15:32–15:33 | backend / backoffice / market | `460bd915` / `81f6dca` / `f69c1f5` | Situación tributaria y reverificación semestral (`V2026100903`); certificado y declaración de IVA en `/vender` |
| 17:31 | backend / backoffice / market | `75d19659` / `7da22fe` / `6625bea` | Redes sociales de la tienda para revisar antes de aprobar (`V2026100904`) |
| 17:44 | backend / backoffice | `efaa2546` / `e4c6004` | Estado tributario para aprobar; certificado como 5° documento en Validaciones |
| 22:19 | backend / backoffice | `edcefa30` / `89a472b` | Verificación del alta registrada desde Validaciones |
| 22:29–22:30 | backend / backoffice / market | `d815d264` / `d7a4961` / `5f34d3d` | Certificado semestral desde Mi tienda y cola "Certificados por revisar" (`V2026100905`) |

**Noche del 8 de octubre: documentación.** Se consolidaron los dos documentos anteriores en este y
se escribieron [manual-backoffice.md](manual-backoffice.md) y
[fallas-backoffice-2026-10-08.md](fallas-backoffice-2026-10-08.md). Al verificar la normativa en sii.cl
y bcn.cl cambiaron siete puntos:

- la base del IVA de la comisión (Oficios 2278 y 2316 de 2026, hallazgos Y y Z);
- la vigencia de la Res. 99 (Res. 127 de 2025);
- el plazo del certificado de Subsistencia (Res. 87 de 2026);
- la DJ 1966 (Res. 115 de 2026);
- la DJ 1948 en lugar de la 1886;
- la cita del sueldo empresarial y el Oficio 147 de 2026;
- la ley de la tasa Pro Pyme (Ley 21.755).

**Noche del 8 de octubre: correcciones antes del lanzamiento** (sin commit todavía):

| Hallazgo | Repo | Cambio |
|---|---|---|
| K | backend / backoffice | "Procesar pago" (tiendas, socios y captadores) solo marca pagado lo que salió en la última nómina exportada; `GET /administration/nominas/ultimas` |
| Y | backend / backoffice | La factura de la tienda lleva la comisión y el cargo por procesamiento de pago; `GET /administration/withdrawals/{id}/factura-comision`; propiedad `repuestop.tributario.factura-incluye-pasarela` |
| L | backend | Los tres jobs tributarios corren en hora de Chile |
| T | backend | Las alertas tributarias y el aviso del certificado son "importantes" |
| M | backend / backoffice | Comprobante obligatorio en los gastos, validado por contenido; categoría de la lista |
| M11 | backoffice | Completar el documento de una tienda exige todos los datos y el PDF |
| A2 | backoffice | "Rechazar y eliminar" pide confirmación |

**9 de octubre: ajustes tras la prueba en dev y traslado a Confianza** (subidos a `dev`):

- Validaciones: verificación del SII del alta en una sección propia, con formulario compacto; los
  documentos vuelven a la grilla de 4 y el historial va antes de la decisión.
- Liquidaciones: los datos de la factura van en una tabla; la tarjeta de IVA se llama "IVA de la
  comisión".
- Pagos: el aviso final dice qué se pagó y qué quedó pendiente. El correo de pago muestra el IVA en
  pesos, el folio y la fecha de emisión.
- La situación tributaria de las tiendas pasa a Confianza (bandeja "Cumplimiento tributario" y bloque
  en el perfil de la tienda), con acceso del permiso de Confianza a `/administration/tax-status/**`
  y la alerta de las 08:10 dirigida a Confianza.

**Pruebas:** C y D se probaron en local con backend y backoffice levantados. Hay que re-probar todo
en `dev` con el plan R1 a R16 (`repuestop/docs/planes/plan_prueba_completa_app_dev_oct.md`). Datos de
prueba que quedaron en local:

- la nota de crédito folio 555 sobre el reembolso 13;
- la factura folio 2001 del retiro `RTP-1-RET-000002`;
- sus PDF en R2 (`nota_credito/Pedido_4/` y `Boleta_Factura/Retiro_2/`).

---

## 12. Fuentes

Verificadas en sii.cl y bcn.cl el 8 de octubre de 2026. Los PDF se descargaron y se leyeron
completos; los oficios de 2026 y la Res. 115 se citan desde su texto.

| Norma | Para qué | Enlace |
|---|---|---|
| Código Tributario, arts. 68, 97 N° 10 y 109 | Inicio de actividades, clausura, sanción | https://www.bcn.cl/leychile/navegar?idNorma=6374 |
| Ley 21.713 | Art. 68 inciso 12° | https://www.bcn.cl/leychile/navegar?idNorma=1207746 |
| DL 825 (LIVS), arts. 3° bis, 9, 21, 35 I, 55, 70 | IVA | https://www.bcn.cl/leychile/navegar?idNorma=6369 |
| DL 824 (LIR), arts. 14, 17 N° 7, 31 N° 6 | Renta, socios | https://www.bcn.cl/leychile/navegar?idNorma=6368 |
| Res. Ex. SII N° 99 de 2025 | Verificación del inicio de actividades | https://www.sii.cl/normativa_legislacion/resoluciones/2025/reso99.pdf |
| Res. Ex. SII N° 117 de 2025 | API Inicio de Actividades | https://www.sii.cl/normativa_legislacion/resoluciones/2025/reso117.pdf |
| Res. Ex. SII N° 127 de 2025 | Vigencia de la Res. 99 desde el 2-ene-2026 | https://www.sii.cl/normativa_legislacion/resoluciones/2025/reso127.pdf |
| Res. Ex. SII N° 168 de 2025 | Certificado de cumplimiento, reverificación, nómina | https://www.sii.cl/normativa_legislacion/resoluciones/2025/reso168.pdf |
| Res. Ex. SII N° 193 de 2025 | Registro de Subsistencia | https://www.sii.cl/normativa_legislacion/resoluciones/2025/reso193.pdf |
| Res. Ex. SII N° 87 de 2026 | Certificado de Subsistencia exigible desde el 1-ene-2027 | https://www.sii.cl/normativa_legislacion/resoluciones/2026/reso87.pdf |
| Res. Ex. SII N° 115 de 2026 | DJ 1966 | https://www.sii.cl/normativa_legislacion/resoluciones/2026/reso115.pdf |
| Res. Ex. SII N° 123 de 2025 y N° 135 de 2026 | Calendario de declaraciones juradas AT 2026 y AT 2027 | https://www.sii.cl/normativa_legislacion/resoluciones/2026/reso135.pdf |
| Índice de resoluciones 2026 | Sin resolución del anticipo de IVA (res. 7° de la Res. 168) | https://www.sii.cl/normativa_legislacion/resoluciones/2026/res_ind2026.htm |
| Circular SII N° 39 de 2025 | Art. 3° bis LIVS | https://www.sii.cl/normativa_legislacion/circulares/2025/circu39.pdf |
| Circular SII N° 60 de 2025 | Solo elimina el ap. 3.6.5 de la N° 39 | https://www.sii.cl/normativa_legislacion/circulares/2025/circu60.pdf |
| Circular SII N° 19 de 2022 | Plazo de 6 meses de la Ley 21.398 | https://www.sii.cl/normativa_legislacion/circulares/2022/circu19.pdf |
| Circular SII N° 53 de 2020 | Sueldo empresarial tras la Ley 21.210 | https://www.sii.cl/normativa_legislacion/circulares/2020/circu53.pdf |
| Circular SII N° 53 de 2025 | Tasa Pro Pyme, Ley 21.755 | https://www.sii.cl/normativa_legislacion/circulares/2025/circu53.pdf |
| Oficios SII N° 2278 y 2316 de 2026 | Base del IVA del marketplace; comisión de la pasarela | https://www.sii.cl/normativa_legislacion/jurisprudencia_administrativa/ley_impuesto_ventas/2026/ley_impuesto_ventas_jadm2026.htm |
| Oficio SII N° 2147 de 2016 | Facturar antes del pago | https://www.sii.cl/normativa_legislacion/jurisprudencia_administrativa/ley_impuesto_ventas/2016/ja2147.htm |
| Oficios SII N° 2069 de 2025 y N° 147 de 2026 | Sueldo empresarial | https://www.sii.cl/normativa_legislacion/jurisprudencia_administrativa/ley_impuesto_renta/2025/ley_impuesto_renta_jadm2025.htm |
| Preguntas frecuentes 001.130.1212 y 001.380.5352 | Nota de crédito: plazo y anulación de boletas | https://www.sii.cl/preguntas_frecuentes/impuestos_mensuales/001_130_1212.htm |
| Preguntas frecuentes 001.130.1060 y 001.130.0182 | Plazos del F29 | https://www.sii.cl/preguntas_frecuentes/impuestos_mensuales/001_130_1060.htm |
| Noticia SII 26-12-2025 | Retención de honorarios 2026–2028 | https://www.sii.cl/noticias/2025/261225noti01smn.htm |
