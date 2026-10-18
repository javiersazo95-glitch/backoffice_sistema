# Preguntas para la reunión con el asesor financiero

Reunión 1 a 1 con Matías Donoso (gerencia financiera externa), en el evento del 15 de octubre de 2026.
Este documento resume el negocio en una página y ordena las preguntas por importancia. El detalle
de cada tema está en [contabilidad-tributaria.md](contabilidad-tributaria.md).

## El negocio en una página

- **Qué es RepuesTop.** Un marketplace de repuestos automotrices. Las tiendas, contribuyentes de
  IVA, venden a compradores finales a través de la app y la web. Está por lanzarse: todavía no hay
  ventas reales, pero el 13 y 14 de octubre se probó el ciclo completo en producción con una venta de
  $1.000 (cobro por Flow, boleta de RepuesTop y transferencia a la tienda).
- **Cómo se cobra.** El comprador paga el total por Flow, a la cuenta de RepuesTop. RepuesTop guarda
  el dinero en custodia y se lo transfiere a la tienda cuando ella pide su retiro, descontando:
  - **tarifa de servicio:** 7 % + IVA. Las primeras 100 tiendas aprobadas (fundadoras) tienen una
    marcha blanca de 2 meses con 0 %: solo se les descuenta Flow (desde el 18 de octubre de 2026;
    antes era 8 % + IVA, y 5 % + IVA por 3 meses para las fundadoras);
  - **comisión de Flow:** 2,89 % + IVA, también durante la marcha blanca.
- **Qué documentos se emiten.**
  - **La tienda:** emite la boleta de la venta al comprador. Sin boleta no puede avanzar el pedido.
  - **RepuesTop:** emite una factura a la tienda por cada retiro, en el Portal MIPYME, y vende
    publicidad (Monedas del Mural) con boleta o factura.
- **Cómo se reparte la ganancia.** De la comisión neta, el 70 % va a la caja de la empresa y el 30 %
  a los socios, como retiros.
- **Ejemplo de una venta de $100.000:**

  | Concepto | Tarifa estándar (7 %) | Marcha blanca (0 %) |
  |---|---|---|
  | Tarifa de servicio | $7.000 | $0 |
  | IVA de la tarifa | $1.330 | $0 |
  | Flow | $3.439 | $3.439 |
  | **La tienda recibe** | **$88.231** | **$96.561** |
  | **RepuesTop retiene** | **$11.769** | **$3.439** |
  | Ganancia neta de RepuesTop | $7.000 | $0 |

## Preguntas, en orden de importancia

1. **¿La factura a la tienda debe ir por todo lo retenido, incluida la comisión de Flow?**
   - El Oficio SII 2278 de 2026 dice que la remuneración del intermediario es el precio menos lo
     que se le rinde al mandante, "sin que corresponda deducir de dicho monto la comisión que le
     retenga el respectivo operador de medio de pago". El Oficio 2316 de 2026 dice lo mismo.
   - Ya lo implementamos así. En una venta de $100.000 la factura lleva dos líneas: tarifa de
     servicio $7.000 y cargo por procesamiento de pago $2.890, con $1.879 de IVA en total. La factura
     de Flow a RepuesTop queda como crédito fiscal.
   - En la marcha blanca la factura lleva solo el cargo de Flow ($2.890 + $549 de IVA): el débito y
     el crédito se compensan y RepuesTop no gana ni paga IVA por esa venta. ¿Es correcto facturar
     ese monto, o se trata distinto por ser lo que RepuesTop le paga a Flow?
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
5. **¿Cobramos comisión cuando una venta se reembolsa?** Al comprador se le devuelve todo, sin
   descontar nada: la Ley 19.496 (art. 3° bis) obliga a devolver "las sumas abonadas, sin retención
   de gastos", y en la garantía no se le puede cobrar. La duda es con la tienda. Hoy RepuesTop no
   cobra comisión sobre lo reembolsado y la tienda asume el costo de Flow de la venta más $240 por el
   reembolso: en un reembolso total RepuesTop queda en $0, aunque trabajó (mediación, soporte). Flow
   sí cobra por su parte; Amazon devuelve la comisión al vendedor pero se queda un cargo
   administrativo (el menor entre el 20 % de la comisión y US$5). Proponemos cobrar según la causa:

   | Causa del reembolso | Comisión de RepuesTop | Por qué |
   |---|---|---|
   | **Culpa de la tienda**: falla, producto incompleto o distinto, no lo envió, cancelación de la tienda | **Se la queda** | El servicio se prestó y el problema lo causó la tienda. Incentiva la calidad |
   | **El comprador se arrepiente** (retracto) o cancela antes de preparar | **No la cobra** (como hoy), o solo un cargo administrativo pequeño | La tienda no tuvo culpa |

   - Si RepuesTop se queda la comisión, la factura de comisión sigue vigente y no hace falta su nota
     de crédito. ¿Es correcto tributariamente?
   - ¿Qué debe decir la cláusula en los términos con la tienda? ¿Le aplica la Ley 20.416 (Estatuto
     Pyme), que extiende protecciones contra cláusulas abusivas a las micro y pequeñas empresas?
   - Relacionado: si el reembolso llega cuando la venta ya se le pagó a la tienda, hoy se lo
     descontamos de sus próximos retiros (saldo en contra). ¿Qué cláusula necesitamos para eso?
6. **Régimen tributario.** ¿Pro Pyme General (14 D N° 3)? Si es así, la tasa de primera categoría
   es 12,5 % hasta el año tributario 2028 (Ley 21.755). ¿Cómo provisionamos el impuesto mes a mes?
7. **Aportes de los socios.** Pusimos plata para partir la empresa. ¿La registramos como aporte de
   capital o como préstamo? ¿Qué papeles hacen falta para recuperarla sin impuesto, y antes de
   cuándo?
8. **Retiros de los socios.** Hoy retiramos el 30 % como anticipo de utilidades. ¿Conviene pasar a
   un sueldo empresarial? ¿Cuánto es "razonablemente proporcionado" para una empresa que recién
   parte?
9. **Contador.** No tenemos. ¿Qué perfil necesitamos (F29 mensual, declaraciones juradas en
   marzo, renta en abril) y cuánto cuesta razonablemente? ¿Puede recomendarnos a alguien?

## Si queda tiempo

- **Certificado de cumplimiento.** ¿Sirve el certificado que sube la tienda para la reverificación
  de enero y julio (Res. 168), o hay que consultar cada RUT en sii.cl?
- **DJ 1966.** ¿Hay que presentarla aunque ninguna tienda haya declarado no necesitar inicio de
  actividades?
- **Términos y condiciones.** ¿Hay que cambiar la cláusula que dice que RepuesTop emite "la factura
  por la comisión y su IVA", ahora que la factura también lleva el cargo de Flow?
- **Fondos en custodia.** ¿Cómo se presentan en el balance? Hoy no se reparten: son de las tiendas.
