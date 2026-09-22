# Requisitos de lanzamiento — backoffice

> Auditoría de seguridad `2026-09-21-security-backoffice`. Última actualización: 2026-09-22.

Esto **no son hallazgos pendientes**. Son cosas que por su naturaleza sólo se pueden verificar al
publicar, y que si se saltan dejan la consola rota o expuesta el primer día.

Van en orden: primero lo que impide que funcione, después lo que impide que sea segura.

---

## 1. Variables de entorno nuevas · `SEC-BACKOFFICE-012`

**Todas las variables de producción tienen que ser nuevas**, sin reutilizar ningún valor que haya
pasado por el repositorio.

El caso concreto que lo originó: `REPUESTOP_BACKOFFICE_API_KEY` quedó en claro en el historial de
git, en `PLAN_BACKOFFICE_POLLING.md` (commit `32bb1a0b`). Sigue siendo recuperable con
`git show 32bb1a0b:PLAN_BACKOFFICE_POLLING.md`.

- [ ] Generar valores nuevos para **todas** las variables de producción.
- [ ] **No reutilizar el patrón de nombre** del valor filtrado: seguía una forma
      `<componente>-<entorno>-key-<año>`, trivialmente extrapolable.
- [ ] Confirmar que `REPUESTOP_BACKOFFICE_API_KEY` en producción no coincide con la del historial.

> El backend ya verificó que, con la variable sin definir, el servicio **rechaza** las peticiones
> en vez de aceptar cualquiera con clave vacía. Eso está cerrado.

## 2. Dominio personalizado en Vercel · `SEC-BACKOFFICE-025`

La allowlist de CORS del backend es `https://*.repuestop.cl`. Si la consola se publica bajo el
`*.vercel.app` por defecto, **el navegador bloquea todas las llamadas a la API** y el backoffice
no funciona en absoluto.

- [ ] Confirmar que el dominio personalizado (`backoffice.repuestop.cl` o equivalente) está
      configurado en el proyecto de Vercel.
- [ ] Comprobar que la consola **no** queda accesible sólo por el dominio del proveedor.
- [ ] Una llamada a la API desde el dominio real responde 2xx con las cabeceras de CORS correctas.

## 3. `VITE_API_URL` coherente con la CSP · `SEC-BACKOFFICE-015`

`connect-src` está escrito a mano en `vercel.json` con `https://api.repuestop.cl` y
`https://api-dev.repuestop.cl`, porque un fichero de cabeceras no puede leer variables.

- [ ] Verificar que el `VITE_API_URL` de cada entorno de Vercel es uno de esos dos.
- [ ] Si aparece un origen nuevo —dominio distinto, CDN delante, bucket de ficheros en otro host,
      websocket, URL firmada de S3/R2—, **añadirlo a la CSP antes de desplegar** o dejará de
      cargar.

---

## 4. Probar y fusionar la cookie de sesión · `SEC-BACKOFFICE-006`

La rama `audit-fix/security/backoffice-cookie-session` saca el token de `localStorage` y pasa la
sesión a la cookie `rt_session`. **Está sin fusionar a propósito**: es el cambio de mayor radio de
la auditoría y no pude probarlo sin backend.

- [ ] Ejecutar los seis pasos de `COMO-PROBAR-cookie-de-sesion.md`. El que más probablemente falle
      es el 2: recargar la página y que la sesión sobreviva.
- [ ] Decidir qué hacer con el acceso por IP de LAN en desarrollo: `Secure` es incondicional en el
      backend, y aunque `http://localhost` funciona, `docker-compose` levanta Vite con
      `--host 0.0.0.0`. Quien entre por `192.168.x.x` no podrá autenticar.
- [ ] Avisar al equipo de que **"Mantener sesión iniciada" desaparece**: la cookie dura 8 horas
      fijas.
- [ ] La rama se creó antes de los últimos cambios de `audit-fix/security/backoffice`:
      **rebasar antes de fusionar**.

> Mientras no se fusione, `SEC-BACKOFFICE-006` sigue abierto y es el único `high` real que queda.

## 5. Purga de historial · `SEC-BACKOFFICE-012` + `CF-010`

Dos cosas distintas que conviene sacar **en una sola reescritura coordinada**, no en dos:

- [ ] `PLAN_BACKOFFICE_POLLING.md`, que documenta la superficie de
      `/api/v1/external/backoffice/**` y contiene la clave de desarrollo.
- [ ] `backoffice/tools/`, 20 MB y 90 ficheros de una distribución de Maven. Ya está *untrackeada*
      y ya no se distribuye, pero sigue en el historial.

> Con las variables de producción nuevas (punto 1), esto baja de urgente a higiene. Sigue
> mereciendo la pena: el documento deja documentada una superficie privilegiada en el repositorio.

## 6. Imagen de Docker, si se usa · `SEC-BACKOFFICE-016`

`Dockerfile.dev` ya corre como usuario sin privilegios y `.dockerignore` excluye los ficheros de
entorno, pero **no pude construirla**: no hay Docker en el entorno de la auditoría.

- [ ] `docker build -f Dockerfile.dev .` completa sin error.
- [ ] `docker exec <id> id` no devuelve `uid=0`.
- [ ] **El HMR sigue funcionando con el bind mount.** Es el riesgo real del cambio de usuario.
- [ ] La imagen no contiene ningún `.env`.

---

## Lo que queda abierto y no es de lanzamiento

Para que el cuadro esté completo:

| ID | Sev | Qué es | Dueño |
|---|---|---|---|
| `DP-001` / `DP-002` | `high` | Dos avisos de react-router que **sólo se corrigen migrando a la v7**. Verifiqué que **no son alcanzables** aquí: no hay SSR, y ningún destino de navegación viene de datos no confiables. Es trabajo de `engineering`, no un parche de seguridad. | frontend |
| `SEC-028` | `low` | El documento tributario de socio sale con IVA 0 y no hay campo para fijarlo. No lo resolví porque el propio backend dice que la base imponible de un socio **no está definida**: primero hay que decidirlo con contabilidad. | negocio |

Y una pregunta de negocio sin cerrar: el banco admite varias nóminas por ciclo con tope de 1.000
registros cada una, así que los dos ficheros que genera la pantalla de proveedores son válidos.
**Falta confirmarlo con el ejecutivo de cuenta.** Nota para el backend: con ese tope, un ciclo con
más de 1.000 retiros de un mismo tipo necesita que el servidor parta la exportación.
