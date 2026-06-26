# Plan Faseado Para Implementar Polling En Backoffice Y Respuestas PATCH Hacia RepuesTop

## Objetivo

Implementar en el Backoffice una integracion inicial por polling contra la App Principal RepuesTop.

El Backoffice consultara periodicamente proveedores y verificaciones documentales, guardara una copia local para revision operativa, y enviara decisiones de aprobacion, rechazo o suspension mediante APIs `PATCH` expuestas por RepuesTop.

La implementacion se divide en fases para poder validar cada bloque antes de avanzar al siguiente.

## Contrato Con RepuesTop

Base URL configurable:

```text
REPUESTOP_API_BASE_URL=http://localhost:8080
REPUESTOP_BACKOFFICE_API_KEY=backoffice-dev-key-2026
```

Header obligatorio en todas las llamadas:

```http
X-Backoffice-Api-Key: <REPUESTOP_BACKOFFICE_API_KEY>
```

Endpoints de polling:

```http
GET /api/v1/external/backoffice/proveedores?page=0&size=20&since=2026-06-11T12:00:00-04:00
GET /api/v1/external/backoffice/proveedores/{proveedorId}

GET /api/v1/external/backoffice/verificaciones?estado=PENDIENTE&page=0&size=20&since=2026-06-11T12:00:00-04:00
GET /api/v1/external/backoffice/verificaciones/{verificacionId}
```

Endpoints de decision:

```http
PATCH /api/v1/external/backoffice/proveedores/{proveedorId}/estado
PATCH /api/v1/external/backoffice/verificaciones/{verificacionId}/aprobar
PATCH /api/v1/external/backoffice/verificaciones/{verificacionId}/rechazar
```

Payload para actualizar estado de proveedor:

```json
{
  "estado": "APROBADO",
  "motivo": "Validacion manual completada"
}
```

Estados validos de proveedor:

```text
EN_REVISION
APROBADO
RECHAZADO
SUSPENDIDO
```

Payload para rechazar verificacion:

```json
{
  "motivo": "Documento ilegible o incompleto"
}
```

Estados validos de verificacion:

```text
PENDIENTE
APROBADA
RECHAZADA
```

Respuesta paginada esperada desde RepuesTop:

```json
{
  "content": [],
  "totalElements": 0,
  "totalPages": 0,
  "currentPage": 0,
  "size": 20,
  "first": true,
  "last": true
}
```

## Criterios Generales

- Usar DTOs externos separados para el contrato RepuesTop.
- No mezclar DTOs externos con DTOs de la UI del Backoffice.
- No registrar nunca `REPUESTOP_BACKOFFICE_API_KEY` en logs.
- Mantener compatibilidad con los datos locales/mock actuales del Backoffice.
- Si un registro no tiene ID externo de RepuesTop, las acciones existentes deben seguir funcionando de forma local.
- Para acciones operativas conectadas a RepuesTop, preferir llamar primero a RepuesTop y luego actualizar localmente con la respuesta recibida.
- El polling debe avanzar cursor solo cuando todas las paginas se procesen correctamente.

## Fase 0: Preparacion Y Decisiones Tecnicas

### Objetivo

Confirmar los puntos que pueden afectar la implementacion antes de tocar codigo.

### Tareas

- Confirmar el puerto local de RepuesTop y del Backoffice, porque ambos pueden estar usando `8080`.
- Confirmar JSON real de proveedores y verificaciones que devuelven las APIs externas.
- Definir si `RECHAZADO` se agregara a `SellerStatus` o si se mapeara a otro estado interno.
- Confirmar si los IDs internos numericos de RepuesTop se mantendran como enlace en esta primera version.
- Revisar la estrategia de Flyway, porque las migraciones base V2/V3 estan comentadas, mientras dev usa `ddl-auto: create`.

### Entregable

- Decisiones cerradas para iniciar implementacion.
- Lista final de campos externos disponibles.

### Riesgos

- Sin JSON real se pueden crear DTOs incompletos.
- Si ambos sistemas usan el mismo puerto local, el cliente apuntara al servicio equivocado.
- Si Flyway se activa en un ambiente sin tablas base, `ddl-auto: validate` puede fallar.

## Fase 1: Cliente HTTP Y Configuracion

### Objetivo

Crear el cliente interno responsable de consumir RepuesTop.

### Cambios Propuestos

Agregar configuracion:

```yaml
repuestop:
  api:
    base-url: ${REPUESTOP_API_BASE_URL:http://localhost:8080}
    connect-timeout-ms: ${REPUESTOP_API_CONNECT_TIMEOUT_MS:3000}
    read-timeout-ms: ${REPUESTOP_API_READ_TIMEOUT_MS:10000}
  backoffice:
    api-key: ${REPUESTOP_BACKOFFICE_API_KEY:}
```

Crear:

- `RepuestopExternalClient`
- `RepuestopClientProperties`
- DTOs externos para:
  - proveedor
  - verificacion
  - pagina externa
  - request de estado proveedor
  - request de rechazo

Metodos del cliente:

```text
listarProveedores(since, page, size)
obtenerProveedor(proveedorId)
listarVerificaciones(estado, since, page, size)
obtenerVerificacion(verificacionId)
aprobarVerificacion(verificacionId)
rechazarVerificacion(verificacionId, motivo)
actualizarEstadoProveedor(proveedorId, estado, motivo)
```

### Validaciones

- Header `X-Backoffice-Api-Key` presente en todas las llamadas.
- Query params `page`, `size`, `since`, `estado` correctamente construidos.
- Errores `401`, `404`, `5xx` y timeout traducidos a excepciones controladas.
- La API Key no aparece en logs ni excepciones.

### Riesgos

- Un error de contrato puede romper deserializacion.
- Timeouts muy altos pueden solapar jobs.

## Fase 2: Persistencia Local Y Enlace Con RepuesTop

### Objetivo

Extender el modelo local existente para guardar el espejo operacional sin duplicar el modulo de confianza.

### Cambios Propuestos

Extender `Seller`:

- `repuestopProveedorId`
- `repuestopUsuarioId`
- `repuestopTiendaId`
- `sourceUpdatedAt`
- `lastSyncedAt`

Extender `SellerDocument`:

- `repuestopVerificacionId`
- `submittedAt`
- `reviewedAt`
- `lastSyncedAt`

Crear `SyncCursor`:

- `id`
- `syncName`: `PROVEEDORES` o `VERIFICACIONES`
- `lastSuccessfulSince`
- `lastRunAt`
- `lastStatus`
- `lastError`
- `createdAt`
- `updatedAt`

Agregar indices unicos cuando el campo externo no sea nulo:

- `sellers.repuestop_proveedor_id`
- `seller_documents.repuestop_verificacion_id`
- `sync_cursor.sync_name`

### Validaciones

- Las entidades compilan con JPA.
- Los repositorios permiten buscar por ID externo.
- Las migraciones son compatibles con los ambientes esperados.

### Riesgos

- `Seller.externalId` actualmente es obligatorio y unico; para proveedores RepuesTop se debe definir un valor estable.
- `Seller.rut` actualmente es obligatorio y unico; si RepuesTop envia RUT nulo o repetido, el upsert fallara.
- `SellerDocument` exige `uploadedAt`, `dueAt` y `owner`; si RepuesTop no envia esos campos hay que usar defaults controlados.

## Fase 3: Mappers Y Upsert

### Objetivo

Transformar datos externos a entidades locales y permitir sincronizacion incremental sin duplicados.

### Cambios Propuestos

Crear servicio de sincronizacion:

- `RepuestopSyncService`
- `upsertSeller(dto)`
- `upsertValidation(dto)`

Reglas de upsert:

- Proveedor:
  - Buscar por `repuestopProveedorId`.
  - Si no existe, crear `Seller`.
  - Si existe, actualizar campos operativos recibidos.
  - No sobrescribir campos internos sensibles si RepuesTop no los envia.

- Verificacion:
  - Buscar por `repuestopVerificacionId`.
  - Vincular con `Seller` por `repuestopProveedorId`.
  - Si no existe el vendedor, crear o traer primero el proveedor.
  - Actualizar estado, URLs/documentos, notas y fechas.

### Validaciones

- Upsert no duplica vendedores ni documentos.
- Estados externos se convierten a enums internos.
- Fechas externas mantienen zona horaria correctamente.

### Riesgos

- El estado externo `RECHAZADO` no existe hoy en `SellerStatus`.
- Si llega una verificacion antes que el proveedor, se requiere estrategia de fallback.

## Fase 4: Polling De Verificaciones Pendientes

### Objetivo

Implementar primero el polling de verificaciones, porque es el flujo operativo principal para aprobacion/rechazo.

### Cambios Propuestos

Crear job:

```text
pollVerificacionesPendientesJob
```

Reglas:

- Leer cursor `VERIFICACIONES`.
- Llamar `GET /verificaciones?estado=PENDIENTE&page=0&size=50&since=...`.
- Procesar paginas hasta `last=true`.
- Hacer upsert local de cada verificacion.
- Actualizar cursor solo si todas las paginas fueron exitosas.
- Guardar nuevo cursor con mayor fecha entre `updatedAt`, `submittedAt` o `reviewedAt`.
- Registrar logs con `syncName`, `page`, `size`, `totalElements`, cantidad procesada y duracion.

### Validaciones

- Polling de una pagina.
- Polling multipagina.
- Error `401` no avanza cursor.
- Error `5xx` no avanza cursor.
- Error parcial no avanza cursor.

### Riesgos

- Si el job corre cada 2 minutos y una ejecucion demora mas, puede haber solapamiento.
- Si RepuesTop ordena datos de forma no deterministica, se pueden repetir registros; el upsert debe tolerarlo.

## Fase 5: Polling De Proveedores

### Objetivo

Sincronizar proveedores para mantener actualizado el espejo local de vendedores.

### Cambios Propuestos

Crear job:

```text
pollProveedoresJob
```

Reglas:

- Leer cursor `PROVEEDORES`.
- Llamar `GET /proveedores?page=0&size=50&since=...`.
- Procesar paginas hasta `last=true`.
- Hacer upsert local por `repuestopProveedorId`.
- Avanzar cursor solo si todo termina correctamente.

### Validaciones

- Polling de una pagina.
- Polling multipagina.
- Actualizacion de vendedor existente.
- Creacion de vendedor nuevo.
- Cursor estable ante errores.

### Riesgos

- Datos locales de confianza podrian ser sobrescritos por datos externos si el mapper no delimita campos.
- Proveedores suspendidos/rechazados deben mapearse con cuidado para no reactivar cuentas localmente por accidente.

## Fase 6: Acciones De Operador Hacia RepuesTop

### Objetivo

Conectar las decisiones tomadas en Backoffice con los endpoints `PATCH` de RepuesTop.

### Cambios Propuestos

Al aprobar una validacion:

1. Si tiene `repuestopVerificacionId`, llamar:
   ```http
   PATCH /api/v1/external/backoffice/verificaciones/{verificacionId}/aprobar
   ```
2. Actualizar `SellerDocument` con la respuesta.
3. Actualizar vendedor asociado si corresponde.

Al rechazar una validacion:

1. Exigir motivo si tiene `repuestopVerificacionId`.
2. Llamar:
   ```http
   PATCH /api/v1/external/backoffice/verificaciones/{verificacionId}/rechazar
   ```
3. Enviar:
   ```json
   { "motivo": "..." }
   ```
4. Actualizar estado local con la respuesta.

Al suspender o cambiar estado de proveedor:

1. Si tiene `repuestopProveedorId`, llamar:
   ```http
   PATCH /api/v1/external/backoffice/proveedores/{proveedorId}/estado
   ```
2. Enviar estado y motivo.
3. Persistir respuesta localmente.

### Validaciones

- Aprobar llama PATCH correcto.
- Rechazar envia motivo.
- Suspender proveedor llama PATCH correcto.
- Si RepuesTop falla, el estado local no debe quedar aprobado/rechazado falsamente.
- Si no hay ID externo, se conserva comportamiento local actual.

### Riesgos

- Cambiar el orden local/remoto puede afectar expectativas actuales de UI.
- Reintentos de decisiones duplicadas deben mostrar el estado actual devuelto por RepuesTop.

## Fase 7: Observabilidad Y Operacion

### Objetivo

Dejar la integracion observable y operable sin exponer informacion sensible.

### Cambios Propuestos

- Logs por job:
  - `syncName`
  - `page`
  - `size`
  - `totalElements`
  - cantidad procesada
  - duracion
  - estado final
- Logs por decision:
  - tipo de accion
  - ID local
  - ID RepuesTop
  - resultado
- No loguear API Key.
- No loguear documentos completos ni datos sensibles.
- Guardar ultimo error en `sync_cursor.lastError`.

### Validaciones

- Error operacional visible en logs.
- Cursor queda con ultimo estado.
- No aparece API Key en salida de logs.

### Riesgos

- Logs excesivos pueden exponer datos personales si se registran DTOs completos.

## Fase 8: Pruebas De Integracion Y Validacion Manual

### Objetivo

Validar la integracion completa contra mocks y luego contra RepuesTop local.

### Pruebas Unitarias

- Cliente HTTP agrega siempre `X-Backoffice-Api-Key`.
- Cliente arma query params correctamente.
- Mapper convierte DTOs externos a entidades locales.
- Cursor no avanza si falla una pagina.
- Cursor avanza si todas las paginas se procesan correctamente.
- Upsert no duplica registros.

### Pruebas De Servicio

- Polling de verificaciones con una pagina.
- Polling de verificaciones con multiples paginas.
- Polling de proveedores con una pagina.
- Polling de proveedores con multiples paginas.
- Aprobacion de verificacion llama PATCH correcto.
- Rechazo de verificacion envia motivo.
- Suspension de proveedor llama PATCH correcto.
- Error `401` no actualiza cursor.
- Error `5xx` no duplica registros locales.

### Validacion Manual

Con RepuesTop levantado localmente:

```bash
curl -H "X-Backoffice-Api-Key: backoffice-dev-key-2026" \
  "http://localhost:8080/api/v1/external/backoffice/verificaciones?estado=PENDIENTE&page=0&size=20"
```

Aprobar:

```bash
curl -X PATCH \
  -H "X-Backoffice-Api-Key: backoffice-dev-key-2026" \
  "http://localhost:8080/api/v1/external/backoffice/verificaciones/1/aprobar"
```

Rechazar:

```bash
curl -X PATCH \
  -H "Content-Type: application/json" \
  -H "X-Backoffice-Api-Key: backoffice-dev-key-2026" \
  -d "{\"motivo\":\"Documento ilegible\"}" \
  "http://localhost:8080/api/v1/external/backoffice/verificaciones/1/rechazar"
```

## Orden Recomendado De Implementacion

1. Fase 0: cerrar decisiones tecnicas.
2. Fase 1: cliente HTTP y configuracion.
3. Fase 2: persistencia y campos de enlace.
4. Fase 3: mappers y upsert.
5. Fase 4: polling de verificaciones pendientes.
6. Fase 6: acciones de operador para verificaciones.
7. Fase 5: polling de proveedores.
8. Fase 6: acciones de operador para proveedor.
9. Fase 7: observabilidad.
10. Fase 8: pruebas completas y validacion manual.

## Primera Implementacion Sugerida

Para comenzar con bajo riesgo:

1. Implementar Fase 1.
2. Implementar campos minimos de Fase 2 para verificaciones y cursor.
3. Implementar Fase 3 solo para verificaciones.
4. Implementar Fase 4.
5. Conectar approve/reject de Fase 6.

Despues de validar ese flujo, avanzar con proveedores.

## Supuestos

- La primera version usa IDs internos numericos de RepuesTop: `proveedorId` y `verificacionId`.
- La sincronizacion inicial cubre solo proveedores y verificaciones documentales.
- Tickets, alertas, pedidos y mediaciones quedan fuera de esta fase.
- Los estados visibles del Backoffice se manejan en espanol.
- El polling es incremental usando `since`, paginado con `page` y `size`.
- Mas adelante se podra evolucionar a integracion directa bidireccional con APIs expuestas por ambos sistemas.
