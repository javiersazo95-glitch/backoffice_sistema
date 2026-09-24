# Captadores: compradores referidos + repositorio "Redes sociales"

## Resumen

1. **Compradores referidos.** Al crear su cuenta, el comprador (registro manual o con Google, en la
   app móvil y en la web Market) puede ingresar un **código de captador** opcional. El captador gana
   `comisionComprador` (1 % por defecto) de las compras de ese comprador.
2. **Redes sociales** (portal del captador, `/captador/redes-sociales`). Es un repositorio compartido de
   videos e imágenes que suben los captadores para publicarlos en sus redes. Tiene niveles o medallas,
   cupo semanal de descargas y un bloqueo de 14 días por pieza descargada.
3. **Métricas** en *Gestión de Confianza → Captadores*:
   - Pestañas "Compradores captados" y "Redes sociales" (con moderación).
   - Columnas "Compradores" y "Medalla redes" en la tabla.
   - Pestaña "Compradores captados" en el modal del captador.

## Reglas de negocio

| Regla | Valor |
| --- | --- |
| Comisión por compras de compradores | `comisionComprador`, por defecto `0.01`. Editable por SUPER_ADMIN en Validaciones → Registros captadores |
| Base de la comisión | Productos activos − descuento − reembolsos de mediación. **Sin envío** |
| Ciclo de la comisión | Se crea `PENDIENTE` al pagarse el pedido. Pasa a `DISPONIBLE` cuando el pedido queda `FINALIZADO`. Se anula si el pedido se cancela |
| Comprador captado | Comprador referido con **al menos una compra pagada** (`primera_compra_at`). Si su única compra se cancela, deja de contar |
| Puntos | `puntosCompradorConvertido` por comprador captado, por defecto 2 (50 compradores = 100 pts). También suman al ranking |
| Requisito de acceso | ≥ 3 **videos** publicados en los últimos 7 días (ventana móvil). El contenido oculto o eliminado no cuenta |
| Bloqueo por pieza | 14 días desde que el captador descargó una pieza ajena |
| Contenido propio | Siempre descargable. No consume cupo |
| Semana del cupo | De lunes 00:00 a domingo, hora de America/Santiago |
| Subidas | Máximo 10 por día. Una subida a la vez por captador, con tope global (se rechazan con 429) |
| Archivos | Video MP4/MOV/WebM de hasta 80 MB. Imagen JPG/PNG/WebP de hasta 8 MB. Portada de hasta 1 MB. El tipo se detecta por magic bytes |

Niveles de descarga (enum `NivelSocialCaptador`):

| Medalla | Puntos | Descargas por semana |
| --- | --- | --- |
| Bronce | 0 | 3 |
| Plata | 200 | 6 |
| Oro | 400 | 10 |
| Platino | 1000 | 30 |
| Diamante | 2500 | Ilimitadas |

## Almacenamiento

- Bucket **público** de R2. Carpeta `Redes_sociales/Captador_<id>_<alias>/`, con guion bajo porque un
  espacio rompe la URL pública.
- Los objetos se guardan con `Content-Disposition: attachment; filename="RepuesTop_@alias.ext"`.
- El bloqueo es "blando" (decisión de negocio). El backend registra y limita la descarga, pero la URL
  pública técnicamente se puede guardar.
- El video se sube como **cuerpo binario**, no como multipart, con los metadatos en el header
  `X-Contenido-Meta` (JSON url-encoded). Así el tope de 80 MB es propio de este endpoint y el límite
  global de multipart sigue en 10 MB.
- En producción, el proxy o hosting del backend debe aceptar requests de hasta ~80 MB en
  `POST /api/v1/captadores/me/social/contenidos`.

## Endpoints

### Registro de comprador (público)

`POST /api/v1/auth/register/buyer` acepta además:
- `referral`: opcional, máximo 40 caracteres.
- `referralChannel`: `WEB` o `MOBILE`.

Un código inválido responde **400 antes de crear la cuenta**. Para prevalidar, el cliente usa
`GET /api/v1/referrals/validate?value=`.

### Portal del captador (`ROLE_CAPTADOR`, aprobado y con acceso activo)

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/captadores/me/social/estado` | Nivel, medalla, puntos, cupo semanal, requisito de 3 videos y `accesoHasta` |
| GET | `/captadores/me/social/contenidos` | Feed paginado. Parámetros: `vista=PUBLICO\|MIOS\|DESCARGADOS`, `tipo`, `categoria`, `red`, `q`, `orden`, `soloNoDescargados`, `pagina`, `tamano` |
| POST | `/captadores/me/social/contenidos` | Subir (cuerpo binario + `X-Contenido-Meta`) |
| PUT | `/captadores/me/social/contenidos/{id}/poster` | Portada del video (multipart `poster`) |
| PATCH / DELETE | `/captadores/me/social/contenidos/{id}` | Editar o eliminar. Solo el dueño; para un id ajeno responde 404 |
| POST | `/captadores/me/social/contenidos/{id}/descargas` | Registra la descarga y devuelve `{url, nombreArchivo, bloqueadoHasta, estado}` |
| GET / PUT | `/captadores/me/social/contenidos/{id}/resena(s)` | Reseñas (1–5 estrellas, texto de hasta 280 caracteres). Para evaluar hay que haber descargado la pieza |

### Backoffice (`SUPER_ADMIN` o `PERM_MEDIACION_CONFIANZA_OPERADOR`)

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/validations/capturers/social/metrics?periodo=YYYY-MM` | KPIs, medallas, tops y comisión por compradores |
| GET | `/validations/capturers/social/contents` | Moderación (paginado) |
| PATCH | `/validations/capturers/social/contents/{id}/visibility` | `{accion: OCULTAR\|RESTAURAR, motivo}` (auditado) |
| GET | `/validations/capturers/{id}/captured-buyers` | Compradores de un captador, con email enmascarado |

`GET /validations/capturers` ahora incluye `compradoresCaptados`, `compradoresConvertidos`,
`puntosSociales` y `nivelSocial`, calculados en una sola consulta agregada.

## Migraciones (mono-repo)

- `V2026092401__captador_compradores_referidos.sql`:
  - Tipo de atribución `COMPRADOR` y `primera_compra_at`.
  - Movimiento `COMPRA_COMPRADOR`.
  - Columnas `comision_comprador` y `puntos_comprador_convertido`.
- `V2026092402__captador_redes_sociales.sql`:
  - `RT_captador_contenido_social`.
  - `RT_captador_descarga_social`.
  - `RT_captador_resena_social`.
- `V2026092403__captador_comprador_captado_al_pagar.sql`: completa `primera_compra_at` de los compradores
  que ya tienen una compra pagada vigente: cada comprador nuevo suma sus puntos con su primera compra.
