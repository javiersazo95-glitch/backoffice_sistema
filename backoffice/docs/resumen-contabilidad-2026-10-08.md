# Revisión contable y tributaria del Backoffice (8 de octubre de 2026)

Sesión de asesoría contable chilena sobre Administración Contable, con RepuesTop entendido como
**operador de plataforma digital de intermediación** domiciliado en Chile. Este documento registra
qué se revisó, qué se cambió, qué quedó pendiente y con qué datos se retoma.

La guía de fondo —normativa, obligaciones y cómo deben retirar los socios— está en
[contabilidad-chile.md](contabilidad-chile.md). Este archivo es el estado del trabajo.

**Contexto:** la app todavía no se lanza; está terminando la fase de pruebas. Eso importa porque
casi todas las obligaciones del SII empiezan a contar cuando haya tiendas con relación comercial
vigente. Hacerlas antes del lanzamiento es mucho más barato que retrofitearlas con tiendas reales
operando.

---

## 1. Qué se revisó

- Todo el módulo `frontend/src/modules/administration` del backoffice.
- El backend en `C:\ProyectoRepuestop\repuestop\backend`: comisiones, verificación de tiendas,
  retiros de socios, documentos de liquidación, boleta de venta y el job de alertas tributarias.
- Normativa chilena vigente, leyendo los textos oficiales del SII y no resúmenes de terceros:
  Resoluciones Ex. 99, 117, 145, 168 y 193 de 2025, Circular 39 de 2025 (artículo 3° bis de la
  LIVS), Ley 21.713, Ley 21.398 y el Oficio 2069 de 2025 sobre sueldo empresarial.

## 2. Qué se cambió en el código

Un solo archivo: `frontend/src/modules/administration/AdminFinancePage.tsx`, tres bloques.
`tsc -b` pasa limpio. **No se probó en la interfaz**, porque requiere el backend levantado.

| Cambio | Antes | Ahora |
|---|---|---|
| Documento por la comisión de servicio | Proponía `Boleta` siempre | Propone `Factura` si el receptor tiene RUT; `Boleta` solo si no lo tiene |
| Documento de un retiro de socio | Proponía `Boleta de Honorarios` | Propone `Comprobante de retiro` |
| Opciones del selector para socio | `Boleta de Honorarios`, `Boleta`, `Factura`, `Documento Tributario` | `Comprobante de retiro`, `Liquidación de sueldo`, `Documento Tributario` |

**Por qué el primero:** si RepuesTop emite boleta afecta a una tienda con giro, la tienda no puede
usar el IVA como crédito fiscal y termina pagando un 19 % de más. Con factura lo recupera.

**Por qué el segundo y el tercero:** un retiro de utilidades no es una prestación de servicios.
Documentarlo con boleta de honorarios deduce un gasto que el SII rechaza (artículo 21 de la LIR,
impuesto único de 40 %) y le cobra al socio retención por algo que es utilidad. La naturaleza
tributaria del movimiento ya se declara al registrar el retiro, así que el documento adjunto es
solo respaldo interno.

El tipo ya registrado se agrega siempre a la lista del selector, así que ningún documento histórico
queda sin su opción aunque el tipo ya no se ofrezca para los nuevos. Es la misma precaución que
documenta el comentario O18.

## 3. Qué se verificó contra el backend

Cuatro cosas que el análisis inicial tenía mal o incompletas. Quedan corregidas en la guía.

**Los retiros de socios ya están bien clasificados.** `NaturalezaRetiroSocio` (SEC-BACKEND-121)
existe, es obligatoria al registrar y el frontend ya la envía: `RETIRO_DE_UTILIDADES`,
`DEVOLUCION_DE_CAPITAL`, `PRESTAMO`, `REMUNERACION`, `GASTO_RECHAZADO`. Es exactamente el dato que
el SII necesita. Lo único mal era el documento adjunto.

**La evidencia de las boletas de venta no se perdió.** El commit `62951d9` borró el panel del
backoffice, pero el backend está intacto: `CumplimientoBoletaBackofficeService`, su controller y
los endpoints `/api/v1/administration/sale-receipts` siguen vivos.

**La boleta de venta es un requisito bloqueante, y está bien resuelto.** El vendedor no puede
avanzar el pedido sin adjuntarla: el gate está en
`PedidoEstadoSupport.exigirRequisitosDeConfirmacion`, que impide pasar la subórden a
`EN_PREPARACION` sin `boletaVentaKey`. El archivo se guarda en el bucket privado de R2, se le
notifica al comprador y él la ve en la app y la web. Ninguna venta avanza sin documento, así que no
hay incumplimiento acumulable.

**Las tiendas ya entregan documentos al registrarse.** `VerificacionProveedor` guarda cédula del
representante, inicio de actividades, patente municipal, boleta o factura de ejemplo y contrato de
adhesión, con `reviewStatus`, `reviewedAt` y `reviewNotes`; `Proveedor.status` arranca en
`pending_verification` y la aprobación es manual.

Y una corrección de datos: las comisiones reales son **8 % parejo** para tiendas verificadas
(`repuestop.comision.tasa.alta/media/baja = 0.08`, los tres tramos en la misma tasa desde el
2026-09-24) y **5 %** para las primeras 100 tiendas fundadoras durante 3 meses. Cada ítem guarda su
`comision_tasa_aplicada` al comprarse, así que cambiar la tarifa no reescribe el pasado.

## 4. Qué quedó pendiente

En orden de riesgo. El detalle de cada uno está en la sección 7 de la guía.

### Antes del lanzamiento

**A. Situación tributaria de la tienda.** Los documentos que hoy se piden prueban que la tienda
*alguna vez* hizo su inicio de actividades, no que **hoy** esté vigente. Faltan cuatro datos:
resultado de la verificación ante el SII con fecha y vía, **declaración de la tienda de ser
contribuyente de IVA**, certificado de cumplimiento tributario con vencimiento semestral, y marca
de inscrito en el Registro de Subsistencia.

Donde va: tabla nueva `rt_situacion_tributaria_proveedor` en el backend —separada de
`VerificacionProveedor`, porque la verificación es un evento único de alta y la situación
tributaria es un estado que cambia cada semestre—, casilla de declaración de IVA en el registro de
tienda más cláusula en el contrato de adhesión, y columna "SII" en `SellerTable` con bloque en
`SellerProfileModal`.

La declaración de IVA es la que importa más: sin constancia de que la tienda la hizo, **el IVA de
sus ventas lo paga RepuesTop** (Circular 39 de 2025).

**B. Nómina semestral al SII y reverificación.** Export `RUT;DV` de las tiendas vigentes, del 5 al
15 de junio y de diciembre, más la carga de la respuesta del SII. Si lanzan antes de diciembre, el
plazo de este año ya les aplica.

Donde va: sub-vista nueva **"Cumplimiento SII"** como tab dentro de Administración Contable, junto
a Resumen, Pedidos, Liquidaciones, Gastos y Retiros. No como entrada de menú propia: se usa dos
veces al año.

### Acordado, requiere migración de esquema

> **C y D implementados el 9 de octubre de 2026.** Detalle en la sección 8.

**C. Folio y fecha de emisión del documento de liquidación.** `DocumentoLiquidacionRequestDTO` no
los tiene y en el frontend `sentAt` queda en `'Ahora'`. Sin folio y fecha no se concilia con el
Registro de Compras y Ventas del SII. El patrón ya existe: `CompraFichaAdminDTO.documentoFolio`.
Va como dos campos en el modal que ya se usa, más un export "Documentos emitidos del mes".

**D. Alerta del plazo de 6 meses de la nota de crédito.** A los 6 meses de la entrega se pierde el
derecho a recuperar el IVA de una venta deshecha (artículo 21 N° 2 y artículo 70 del DL 825, plazo
subido de 3 a 6 meses por la Ley 21.398). Va como job hermano de
`AlertaCumplimientoTributarioJob`, que ya corre diario a las 08:00 y notifica al área de
Administración Contable, con aviso a los 150 días y un campo para registrar la nota cuando se
emite.

### Después

**E. Restaurar la consulta de boletas de venta**, como parte de la vista "Cumplimiento SII". El
`BoletasVentaPage.tsx` borrado se recupera del commit `62951d9` casi tal cual y los endpoints están
vivos. Debe distinguir la tienda inscrita en el Registro de Subsistencia —que legalmente no emite
boleta— del incumplimiento real.

**F. Validar la boleta de venta por contenido real.** `PedidoBoletaVentaSupport.validarArchivo`
valida solo el `Content-Type` que declara el cliente, que es un dato que manda quien sube el
archivo. El helper correcto ya existe en el mismo backend:
`ArchivoSeguro.detectarTipoReal(contenido)`, que usa `CaptadorService.validarPdf`. Hoy el documento
que se le manda al comprador y se exhibe ante el SII se valida más débil que la boleta de
honorarios de un captador.

**G. Reporte del artículo 35 I.** Identificación de vendedores intermediados y montos pagados por
período, exportable cuando el SII lo requiera. Los datos ya existen en liquidaciones y retiros.
Va en la misma vista "Cumplimiento SII".

**H. Campo "quién pagó" en Gastos** (empresa o socio), para separar el gasto directo del
reembolsable al socio.

**I. Borrar las constantes muertas** de `modules/administration/constants.ts`:
`COMMISSION_RATE`, `MIN_COMMISSION`, `MAX_COMMISSION`, `GATEWAY_RATE`, `GATEWAY_IVA`. No se usan en
ningún archivo y contradicen las tasas reales del backend.

**J. Exponer la naturaleza del retiro** en la lista de retiros y en la vista de pago, para que el
respaldo que se pide dependa de ella.

## 5. Decisiones tomadas en esta sesión

- **Pago a captadores: descartado el modelo a honorarios.** No funcionó en las entrevistas; los
  candidatos exigen sueldo base. Queda documentado en la sección 4 de la guía por si se retoma para
  captadores ocasionales. Advertencia registrada: con sueldo base esto pasa a ser una relación
  laboral completa —contrato, Libro de Remuneraciones Electrónico, cotizaciones, impuesto único de
  segunda categoría, seguro de cesantía, mutual, provisiones y finiquitos— y en un modelo mixto la
  comisión también es remuneración, no honorario. El costo real es del orden de un 20–25 % sobre el
  sueldo.
- **La boleta de venta la sigue emitiendo la tienda**, con el gate bloqueante actual. Es lo
  correcto tributariamente y la mejor defensa operativa que tienen.
- **El orden de retiro de los socios**: primero recuperar aportes y préstamos, luego reembolso de
  gastos, luego sueldo empresarial, y las utilidades al final. Detalle en la sección 5 de la guía.

## 6. Preguntas abiertas

1. **Régimen tributario y tipo societario.** Se ve en la cartola tributaria de Mi SII. Define tasas
   y plazos, y cuál declaración jurada corresponde.
2. ~~¿Se solicitó la API de situación tributaria de terceros?~~ **No se ha solicitado** (9 de octubre). Qué es, cómo se pide y el riesgo de rechazo quedaron en la sección 3.1 de la guía. Los pendientes A y B **no dependen de ella**: parten con consulta web manual y la API se conecta después.
   Es el habilitador técnico de los pendientes A y B.
3. **¿Cómo quedaron registradas las transferencias que los socios le hicieron a la empresa**:
   aporte de capital o préstamo? De eso depende si recuperarlas es libre de impuesto, y conviene
   ordenarlo **antes** de acumular utilidades (artículo 17 N° 7 de la LIR).
4. **¿Está el capital social suscrito y pagado** en la escritura, y por cuánto?
5. **¿Se presentaron la nómina de stock de usuarios de febrero de 2026 y el informe de marzo de
   2026** de la Resolución 99?
6. **¿Dictó el SII la resolución del resolutivo 7° de la Resolución 168** (anticipo de IVA por
   operaciones con usuarios incumplidores)? Cuando salga, cambia el flujo de caja de las
   liquidaciones de tiendas marcadas.

## 7. Cómo retomar

El trabajo está sin commitear: `AdminFinancePage.tsx` modificado y estos dos documentos nuevos en
`backoffice/docs/`. La rama es `dev`, sincronizada con `origin/dev` en `313431a`.

El siguiente paso natural son los pendientes **C** y **D**, que están acordados y solo esperaban
luz verde para tocar el backend. Los pendientes **A** y **B** son los de mayor valor antes del
lanzamiento, y la pregunta 2 los desbloquea.

## 8. Sesión del 9 de octubre: pendientes C y D

Commits sin push, rama `dev` en los dos repos:

| Repo | Commit | Contenido |
|---|---|---|
| backoffice | `c7ad1e2` | Cambios de la sesión del 8 (factura por comisión, comprobante de retiro) y estos documentos |
| backend | `6adc2428` | C: folio y fecha de emisión, export del mes (migración `V2026100901`) |
| backoffice | `c20cd85` | C: modal, export CSV, recargas, y `PagoProveedoresPage` sin "Boleta de Honorarios" |
| backend y backoffice | siguiente commit | D: notas de crédito, job de alerta y vista **Cumplimiento SII** (migración `V2026100902`) |

### C. Folio y fecha de emisión

- `rt_retiro` guarda folio, fecha de emisión y fecha de registro; `rt_compra_ficha`, la fecha de
  emisión. El folio se valida como número y **no puede repetirse para el mismo tipo de DTE entre
  retiros y recargas**, porque comparten la numeración de RepuesTop.
- La puerta de pago (`documentoLiquidacionCompleto`) exige folio y fecha. Los retiros de prueba
  con documento quedan incompletos hasta agregárselos.
- Export **"Documentos emitidos del mes"** en Liquidaciones: CSV por fecha de emisión con
  comisiones, recargas y notas de crédito de RepuesTop (en negativo). Neto e IVA los calcula el
  servidor; si el IVA guardado difiere del recalculado, la fila lo advierte.
- El modal avisa si la factura se emite en un mes distinto al del retiro: por el art. 55 del DL 825
  la factura de un servicio va en el período en que se percibe la remuneración (Oficio SII 2147 de
  2016). **Cuál es ese mes para la comisión —el de la venta, el de la liberación de fondos o el del
  retiro— lo tiene que definir el contador.**

### D. Notas de crédito y plazo de 6 meses

Verificado en la [pregunta frecuente SII 001.130.1212](https://www.sii.cl/preguntas_frecuentes/impuestos_mensuales/001_130_1212.htm)
(actualizada al 10/06/2025): una nota de crédito emitida después de 6 meses no rebaja el débito.
Y en la [001.380.5352](https://www.sii.cl/preguntas_frecuentes/bol_electr_vtas_serv/001_380_5352.htm)
(14/07/2026): una boleta electrónica se anula con nota de crédito electrónica.

Lo que se encontró en el backend y cambió el diseño:

- **La fecha de entrega se perdía.** `cerrarSubordenesEnMediacion` sobrescribe `entregadoAt` con
  la resolución. Nueva columna `primera_entrega_at`, que fija el propio setter la primera vez y no
  cambia más. El respaldo histórico toma la fecha más temprana disponible.
- **Las cancelaciones también necesitan nota**: la tienda emite su boleta antes de `EN_PREPARACION`.
- **RepuesTop casi nunca emite nota propia**: la comisión se calcula sin lo reembolsado. Solo si el
  reembolso llega después de liquidar el retiro.
- La alerta de 150 días casi no se dispara porque la mediación se pide en 10 días; el riesgo real
  era el reembolso sin nota. Por eso hay tres niveles: **atrasada** (7 días sin nota),
  **crítica** (150 días desde la entrega) y **vencida**.

Dónde quedó cada cosa:

- Tabla `bo_nota_credito` (una nota por reembolso y emisor), `NotaCreditoBackofficeService` y
  endpoints `/administration/credit-notes`.
- `AlertaNotaCreditoJob`, diario a las 08:05, avisa a Administración Contable y, si está
  configurado `repuestop.contabilidad.email-documentos`, le pide la nota a la tienda.
- Vista **Administración Contable → Cumplimiento SII**: pendientes con su vencimiento, mediaciones
  abiertas al límite, notas registradas y el modal para registrar folio, fecha, monto y PDF.
- El PDF de la nota se valida por su contenido real, no por el `Content-Type`.

### Prueba en local (backend y backoffice levantados)

- Migraciones `V2026100901` y `V2026100902` aplicadas sin error; la app arranca.
- **Error encontrado y corregido:** `(:corte is null or fecha >= :corte)` hace fallar a Postgres
  ("no se pudo determinar el tipo del parámetro"). Rompía `GET /credit-notes` con 503 y, desde
  antes, el `AlertaCumplimientoTributarioJob` de las 08:00: la alerta de recargas sin documento
  **nunca había corrido** (log del 18/09). `contarSubordenesSinBoletaAntiguas` tiene el mismo
  patrón, pero no se usa.
- **Brecha encontrada y corregida:** el documento de liquidación aceptaba una factura con RUT
  inválido. Ahora la factura exige RUT válido, como las recargas.
- Probado en pantalla: export del mes, modal con folio y fecha, rechazo de folio repetido entre
  retiro y recarga, vista previa con fecha real de registro, Cumplimiento SII con un caso real
  (reembolso por mediación del pedido 2579737244), rechazos del registro de nota (PDF falso,
  fecha futura, folio no numérico, emisor sin factura, duplicado) y descarga del PDF.
- Datos de prueba que quedaron: nota de crédito folio 555 sobre el reembolso 13, factura folio
  2001 en el retiro `RTP-1-RET-000002`, y sus PDF de prueba en R2
  (`nota_credito/Pedido_4/` y `Boleta_Factura/Retiro_2/`).

### Pendiente de esta sesión

1. **Correo de Administración Contable** para recibir las notas de las tiendas. Sin él, el job no
   les pide nada (fase 1). La fase 2 es que la tienda la suba desde la app **y desde la web
   market**, con el mismo patrón de la boleta de venta.
2. **Probar en la interfaz.** El frontend apunta a la API de producción y los tests de integración
   del backend necesitan Postgres; la migración y las consultas JPQL nuevas no se ejecutaron contra
   una base. Hay que levantarlo local con `application-local.properties` antes del deploy.
3. `createMediation` y `abrirDesdeAlerta` no revisan el plazo de 10 días ni si el retiro ya se
   pagó: un reembolso sobre un ítem liquidado no tiene cómo recuperar la plata de la tienda. No es
   tributario, pero es caja.

## 9. Sesión del 9 de octubre (tarde): pendientes A y B

Verificado en el texto oficial de la [Resolución Ex. SII N° 168 de 2025](https://www.sii.cl/normativa_legislacion/resoluciones/2025/reso168.pdf):

- **Al contratar** (resolutivo 2°), la plataforma debe exigir el **certificado de cumplimiento
  tributario**, que la tienda descarga de su sitio personal en sii.cl.
- **En enero y julio** (resolutivo 1°), debe reverificar a todas las tiendas vigentes. Sin la API,
  por consulta individual del RUT (resolutivo 3° letra a).
- **Corrección importante:** la nómina `RUT;DV` de junio y diciembre (resolutivo 4°) la suben solo
  las entidades **autorizadas a la API** de la Res. 117. Sin la API, RepuesTop no tiene que subirla.
- La marca de incumplimiento dura hasta fin de semestre (5°). La sanción por no verificar es el
  art. 109 del Código Tributario (9°).

### Qué se construyó

| Dónde | Qué |
|---|---|
| Backend, migración `V2026100903` | Declaración de IVA en `rt_proveedor` (fecha, IP, navegador y versión del texto), certificado en `rt_verificacion_proveedor`, y la tabla `rt_situacion_tributaria_proveedor` (historial de verificaciones: fecha, vía, resultado, semestre, vigente hasta, evidencia) |
| Backend, `SituacionTributariaService` | Panel, historial, registro con evidencia validada por contenido, nómina `RUT;DV`, y la **exigencia al aprobar**: declaración de IVA + certificado + verificación del semestre con inicio de actividades vigente. Se aplica en las tres rutas que aprueban (Validaciones, Vendedores y la API externa). Un incumplidor (`NO_CUMPLE`) sí se puede aprobar; término de giro, sin inicio de actividades o Subsistencia, no |
| Backend, `ReverificacionSemestralJob` | Diario a las 08:10: avisa a Administración Contable mientras haya tiendas vigentes sin verificar este semestre o aprobadas sin declaración de IVA |
| Backend, contrato de adhesión | Cláusula 7 nueva: declaración de IVA, entrega del certificado y autorización para verificar en enero y julio (también en la copia de la app) |
| App y web market | El paso de documentos pide el **certificado** y la **casilla de declaración de IVA**. Las tiendas ya aprobadas sin declaración ven un aviso para hacerla (después del contrato) |
| Backoffice | **Cumplimiento SII** ahora tiene dos pestañas. "Situación tributaria": métricas, estado de cada tienda en el semestre, registrar verificación con evidencia, historial, ver certificado y descargar la nómina |

### Decisiones de diseño

- La declaración y el certificado **no son obligatorios al subir documentos** en el backend, sino
  **al aprobar**: así una app antigua no deja de funcionar, y la tienda que no los entregó recibe
  una petición de corrección.
- La exigencia se puede apagar con `REPUESTOP_EXIGIR_SITUACION_TRIBUTARIA=false`, **solo en
  pruebas**.
- La web market pedía la boleta de ejemplo como opcional, pero el backend la exige al crear la
  verificación: quedó obligatoria también en la web.

### Pendiente

- La resolución del resolutivo 7° de la Res. 168 (anticipo de IVA por tiendas incumplidoras): aún
  no dictada. Cuando salga, las tiendas marcadas `NO_CUMPLE` cambian su liquidación.
- Informe anual de la Res. 99 (usuarios que declararon no requerir inicio de actividades y
  usuarios registrados): no construido. Hoy no aplica porque el registro exige inicio de
  actividades a todas las tiendas.

## 10. Verificación en Validaciones y certificado semestral

**Paso 1, en `dev`.** La verificación del alta se hace en Confianza → Validaciones, donde se aprueba.
El revisor registra lo que dice el certificado de cumplimiento (Cumple o No cumple, y su fecha) y
el estado del inicio de actividades consultado en sii.cl. Base normativa verificada en los textos
oficiales:

- Al contratar, la Res. 168 (resolutivo 2°) exige el certificado. Su modelo oficial (anexo) trae
  RUT, razón social, fecha de los datos, "Cumple / No cumple" y los tres requisitos. **No dice si
  el inicio de actividades está vigente.**
- La Res. 99 (resolutivo 1°) obliga a verificar el inicio de actividades por consulta en sii.cl,
  por la API o por otro medio del SII. Un documento subido por la tienda no está entre esas
  opciones, y no muestra un término de giro posterior. Por eso se mantiene la consulta del RUT al
  alta.

**Paso 2: reverificación de enero y julio con el certificado de la tienda.**

- La tienda sube su certificado actualizado en **Mi tienda** (app y web). Queda en revisión del
  equipo **sin volver la tienda a revisión**: sigue vendiendo. Tabla `rt_certificado_cumplimiento`
  (migración `V2026100905`).
- El 2 y el 20 de enero y de julio, `ReverificacionSemestralJob` le pide el certificado, por la app y
  por correo, a cada tienda vigente que no esté al día.
- Administración Contable lo revisa en Cumplimiento SII → Situación tributaria → "Certificados por
  revisar", uno tras otro. Cumple o No cumple crean la verificación del semestre, con el PDF como
  evidencia. Rechazado le pide otro a la tienda, con el motivo. Un certificado de otro semestre no
  se acepta.
- **Para el contador:** para la reverificación semestral la Res. 168 menciona la consulta y la API
  (resolutivo 3°), no el certificado. El certificado dice que su estado se actualiza en enero y
  julio, así que uno reciente refleja el semestre, pero conviene que lo confirme.
- La solución de fondo sigue siendo la API de la Res. 117 (`solicitud-api-sii-inicio-actividades.md`).
