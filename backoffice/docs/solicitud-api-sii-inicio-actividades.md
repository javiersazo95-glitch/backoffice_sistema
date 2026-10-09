# Solicitud de la API Inicio de Actividades del SII

Qué conlleva pedir al SII el acceso a la **API Inicio de Actividades** (Resolución Ex. SII N° 117
de 2025), para cuando RepuesTop decida hacerlo. Revisado el 9 de octubre de 2026 contra los textos
oficiales del SII y la documentación de Railway.

**Estado:** no solicitada. Por ahora la verificación de tiendas es **manual**, por consulta web en
sii.cl, que la Resolución 99 de 2025 acepta como vía válida. La API es una optimización, no un
requisito para cumplir.

---

## 1. Qué es y qué entrega

Un servicio del SII que permite consultar un RUT desde el backend, sin entrar a sii.cl. Según el
resolutivo 1° de la Res. 117 entrega:

- nombre o razón social y RUT;
- fecha de la consulta;
- si tiene inicio de actividades, y su fecha;
- si está en el régimen especial de Ferias Libres (art. 35 J LIVS);
- **si cumple o no sus obligaciones tributarias**;
- otros criterios que el SII agregue a futuro.

Con eso se automatiza la verificación al alta de cada tienda y la reverificación semestral (Res.
168 de 2025). **Ojo:** tener la API trae una obligación nueva. El resolutivo 4° de la Res. 168 exige
subir la nómina semestral `RUT;DV` (5 al 15 de junio y de diciembre) solo a las entidades
autorizadas a la API. Sin la API, RepuesTop no la sube.

## 2. Costo

La Resolución 117 **no establece ningún cobro** por el acceso. El costo real está en la
infraestructura (sección 4) y en el desarrollo de la integración.

## 3. Quién la pide y cómo

1. El **representante legal** entra a sii.cl con la **Clave Tributaria** de la empresa.
2. Va a la **Oficina de Partes Virtual** y completa el formulario de ingreso de documento.
3. Tipo de documento: **"Solicitud API Ley 21.713"**.
4. El SII analiza la solicitud y responde **por resolución**. Las aprobaciones se publican en
   sii.cl → Normativa → Resoluciones.
5. Si se aprueba, el SII entrega el acceso y la documentación técnica "de acuerdo con su
   procedimiento interno". **La especificación técnica no es pública**: se conoce después de la
   aprobación.

Requisito previo: RepuesTop debe estar inscrita en el SII con RUT e inicio de actividades
(Res. 77 de 2025).

## 4. Datos que pide el formulario

| Dato | Qué poner | Estado |
|---|---|---|
| RUT y nombre de la institución | RUT y razón social de RepuesTop | **Pendiente**: los tiene el representante legal |
| Contacto administrativo | Nombre, correo y teléfono. Correo sugerido: contacto@repuestop.cl | **Pendiente**: definir la persona |
| Contacto técnico | Nombre, correo y teléfono de quien mantiene el backend | **Pendiente** |
| Nombre de la aplicación | "Backend RepuesTop (marketplace de repuestos)" | Propuesto |
| Descripción de la aplicación | Ver el texto de la sección 5 | Propuesto |
| **IP pública desde donde se consultará** | Las IP de salida fijas del servicio de **producción** en Railway | **Requiere plan Pro** (ver abajo) |
| Transacciones por segundo, normal | Menos de 1 tps: una consulta por cada tienda que se registra | Estimado |
| Transacciones por segundo, peak | Menos de 1 tps: la reverificación semestral de todas las tiendas, en lotes | Estimado |
| Fechas de peak | Enero y julio (reverificación semestral, Res. 168) | Propuesto |

### La IP fija en Railway

El backend corre en Railway. El proxy personalizado de `api.repuestop.cl` solo cubre el tráfico
**entrante**; lo que el SII ve es la IP de **salida** del servicio, que por defecto no es fija.

Según la [documentación de Railway](https://docs.railway.com/reference/static-outbound-ips):

- Las **Static Outbound IPs** están disponibles **solo en el plan Pro**.
- Se activan **por servicio**: Settings → Networking → **Enable Static IPs**, y luego hay que
  redesplegar.
- Railway asigna **tres IPv4** por servicio (alta disponibilidad). Hay que informarlas todas al SII.
- Son permanentes, pero **cambian si el servicio se mueve de región**. Si eso pasa, hay que
  avisarle al SII.
- Pueden ser **compartidas** con otros clientes de Railway.
- La documentación no indica costo adicional; revisar la facturación del plan antes de activarlas.

Se activa en el servicio de **producción**, no en `dev`: la API se usa con tiendas reales.

## 5. Texto propuesto para la descripción

> RepuesTop es una plataforma digital de intermediación (marketplace) que permite a terceros
> vender repuestos automotrices a compradores finales. La plataforma recauda el pago de cada compra
> a través de su procesador de pagos y liquida a cada tienda el monto de su venta descontada la
> comisión de servicio. En cumplimiento del inciso duodécimo del artículo 68 del Código Tributario
> y de las Resoluciones Ex. SII N° 99 y 168 de 2025, la plataforma exige a cada tienda acreditar
> su inicio de actividades y su cumplimiento tributario antes de permitirle vender, y reverifica
> semestralmente a las tiendas vigentes. La API se invocará desde el backend de la plataforma al
> momento del registro de cada tienda y en la reverificación semestral, exclusivamente para ese fin.

### Por qué el texto insiste en que RepuesTop recauda los pagos

El SII **aprobó** a Transbank, Mercado Pago, Getnet, Welcu y Flycrew, entre otros
([Res. 133 de 2025](https://www.sii.cl/normativa_legislacion/resoluciones/2025/reso133.pdf)). Pero
**rechazó a Uber Rides Chile**
([Res. 204 de 2025](https://www.sii.cl/normativa_legislacion/resoluciones/2025/reso204.pdf)): la
consideró una plataforma que conecta usuarios con prestadores de transporte, "sin tener la calidad
de operador, administrador o proveedor de medios de pago electrónico". La interpretación del SII es
restrictiva. La solicitud de RepuesTop debe dejar claro que:

- se intermedia la **compraventa de bienes** entre terceros (art. 68 inciso 12°, letra c);
- RepuesTop **recauda el pago** y lo liquida a la tienda.

Si la rechazan, se sigue con la consulta manual, que es igual de válida.

## 6. Obligaciones si se aprueba

Según el resolutivo 2° de la Res. 117 y el considerando 2° de la Res. 133:

- Usar la API **solo** para cumplir el art. 68 inciso 12° del Código Tributario.
- Guardar reserva de la información y **no traspasarla a terceros**.
- Proteger los datos personales conforme a la Ley 19.628.
- El SII puede **revocar el acceso** si comprueba que la API no se usa para esos fines, y puede
  pedir revalidar la autorización.

## 7. Qué cambia en el sistema cuando se apruebe

La verificación manual ya registra la **vía** de cada consulta (`CONSULTA_WEB`, `CERTIFICADO`, y
`API` desactivada) y la nómina `RUT;DV` ya se descarga desde Cumplimiento SII
([contabilidad-tributaria.md](contabilidad-tributaria.md), §8.3). Al aprobarse la API:

1. Activar las IP fijas en el servicio de producción (si no se hizo antes de solicitarla).
2. Guardar las credenciales que entregue el SII como variables de entorno en Railway, nunca en el
   repositorio.
3. Implementar el cliente de la API en el backend según la documentación del SII.
4. Cambiar la verificación al alta y la reverificación semestral para que consulten la API y
   registren la vía `API`. La consulta manual queda como respaldo si la API no responde.

## Fuentes

- Resolución Ex. SII N° 117 de 2025 — https://www.sii.cl/normativa_legislacion/resoluciones/2025/reso117.pdf
- Resolución Ex. SII N° 133 de 2025 (aprobaciones) — https://www.sii.cl/normativa_legislacion/resoluciones/2025/reso133.pdf
- Resolución Ex. SII N° 204 de 2025 (rechazo de Uber) — https://www.sii.cl/normativa_legislacion/resoluciones/2025/reso204.pdf
- Railway, Static Outbound IPs — https://docs.railway.com/reference/static-outbound-ips
