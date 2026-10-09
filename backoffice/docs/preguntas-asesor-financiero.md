# Preguntas para la reunión con el asesor financiero

Reunión 1 a 1 con Matías Donoso (gerencia financiera externa), en el evento del 15 de octubre de 2026.
Este documento resume el negocio en una página y ordena las preguntas por importancia. El detalle
de cada tema está en [contabilidad-tributaria.md](contabilidad-tributaria.md).

## El negocio en una página

- **Qué es RepuesTop.** Un marketplace de repuestos automotrices. Las tiendas, contribuyentes de
  IVA, venden a compradores finales a través de la app y la web. Está por lanzarse: todavía no hay
  ventas reales.
- **Cómo se cobra.** El comprador paga el total por Flow, a la cuenta de RepuesTop. RepuesTop guarda
  el dinero en custodia y se lo transfiere a la tienda cuando ella pide su retiro, descontando:
  - **comisión:** 8 % + IVA (5 % + IVA para las primeras 100 tiendas, durante 3 meses);
  - **comisión de Flow:** 2,89 % + IVA.
- **Qué documentos se emiten.**
  - **La tienda:** emite la boleta de la venta al comprador. Sin boleta no puede avanzar el pedido.
  - **RepuesTop:** emite una factura a la tienda por cada retiro, en el Portal MIPYME, y vende
    publicidad (Monedas del Mural) con boleta o factura.
- **Cómo se reparte la ganancia.** De la comisión neta, el 70 % va a la caja de la empresa y el 30 %
  a los socios, como retiros.
- **Ejemplo de una venta de $100.000:**

  | Concepto | Monto |
  |---|---|
  | Comisión | $8.000 |
  | IVA de la comisión | $1.520 |
  | Flow | $3.439 |
  | **La tienda recibe** | **$87.041** |
  | **RepuesTop retiene** | **$12.959** |

## Preguntas, en orden de importancia

1. **¿La factura a la tienda debe ir por todo lo retenido, incluida la comisión de Flow?**
   - El Oficio SII 2278 de 2026 dice que la remuneración del intermediario es el precio menos lo
     que se le rinde al mandante, "sin que corresponda deducir de dicho monto la comisión que le
     retenga el respectivo operador de medio de pago". El Oficio 2316 de 2026 dice lo mismo.
   - Ya lo implementamos así. La factura lleva dos líneas: comisión $8.000 y cargo por
     procesamiento de pago $2.890, con $2.069 de IVA en total. La factura de Flow a RepuesTop queda
     como crédito fiscal.
   - ¿Lo confirma? Se puede volver atrás sin cambiar código.
2. **¿Los pagos de los compradores por Flow quedan registrados como ventas de RepuesTop** en el
   Registro de Compras y Ventas? El Oficio 2278 explica que, si el comprobante de pago electrónico
   vale como boleta (Res. 176 de 2020), el monto total se registra solo y hay que regularizarlo.
   ¿Cómo lo evitamos desde el primer mes?
3. **¿En qué mes se factura la comisión?** Hoy se factura al pagar el retiro a la tienda, que puede
   ser semanas después de la venta (art. 9 letra a y art. 55 del DL 825). ¿Es correcto o hay que
   facturar en el mes de la venta o de la entrega?
4. **¿En qué mes contamos el ingreso** para el reparto 70/30: el de la compra (como hoy), el de la
   finalización del pedido o el de la factura?
5. **Régimen tributario.** ¿Pro Pyme General (14 D N° 3)? Si es así, la tasa de primera categoría
   es 12,5 % hasta el año tributario 2028 (Ley 21.755). ¿Cómo provisionamos el impuesto mes a mes?
6. **Aportes de los socios.** Pusimos plata para partir la empresa. ¿La registramos como aporte de
   capital o como préstamo? ¿Qué papeles hacen falta para recuperarla sin impuesto, y antes de
   cuándo?
7. **Retiros de los socios.** Hoy retiramos el 30 % como anticipo de utilidades. ¿Conviene pasar a
   un sueldo empresarial? ¿Cuánto es "razonablemente proporcionado" para una empresa que recién
   parte?
8. **Contador.** No tenemos. ¿Qué perfil necesitamos (F29 mensual, declaraciones juradas en
   marzo, renta en abril) y cuánto cuesta razonablemente? ¿Puede recomendarnos a alguien?

## Si queda tiempo

- **Certificado de cumplimiento.** ¿Sirve el certificado que sube la tienda para la reverificación
  de enero y julio (Res. 168), o hay que consultar cada RUT en sii.cl?
- **DJ 1966.** ¿Hay que presentarla aunque ninguna tienda haya declarado no necesitar inicio de
  actividades?
- **Términos y condiciones.** ¿Hay que cambiar la cláusula que dice que RepuesTop emite "la factura
  por la comisión y su IVA", ahora que la factura también lleva el cargo de Flow?
- **Fondos en custodia.** ¿Cómo se presentan en el balance? Hoy no se reparten: son de las tiendas.
