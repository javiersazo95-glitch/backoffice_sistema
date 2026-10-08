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
2. **¿Se solicitó la API de situación tributaria de terceros** (Resolución Ex. SII N° 117 de 2025)?
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
