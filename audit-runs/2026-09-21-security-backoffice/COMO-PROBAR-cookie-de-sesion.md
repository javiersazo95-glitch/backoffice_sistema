# Cómo probar la rama `audit-fix/security/backoffice-cookie-session`

> **No fusionar sin ejecutar esto contra el backend real.** Es el cambio de mayor radio de toda
> la auditoría: si el contrato de la cookie no es exactamente el descrito, nadie entra al
> backoffice.

Cierra `SEC-BACKOFFICE-006`: el token deja de guardarse en `localStorage`/`sessionStorage` y la
sesión pasa a viajar en la cookie `rt_session` (HttpOnly, Secure, SameSite=Lax) que emite el
backend.

## Lo que ya está verificado sin backend

- Tras un acceso completo, `localStorage` y `sessionStorage` quedan **vacíos**.
- Ninguna petición lleva cabecera `Authorization`; todas van con `withCredentials: true`.
- `fetchOptionsFor` manda credenciales sólo a URLs del backend: `include` para relativas y para
  el origen propio, `omit` para hosts externos y para `blob:`.
- `getAuthToken` y `getAuthHeadersFor` ya no existen en el módulo.
- `npx tsc -b` sin errores y `npm run build` correcto.

## Lo que hay que probar con el backend levantado

1. **Acceso.** Entrar con una cuenta de backoffice. En DevTools → Application → Cookies debe
   aparecer `rt_session` marcada `HttpOnly`. En `localStorage` no debe haber nada.
2. **Recargar la página.** La sesión debe sobrevivir: `GET /auth/me` responde 200 por la cookie y
   la pantalla no vuelve al login. **Éste es el paso que más probablemente falle** si la cookie
   no llega.
3. **Cerrar sesión.** Tras `POST /auth/logout`, recargar debe llevar al login.
4. **Documentos.** Previsualizar y descargar un adjunto de ticket, un documento de vendedor y
   una evidencia de mediación. Van por `fetch` con `credentials: include`: si el backend no
   permite credenciales en esas rutas, fallan con error de CORS.
5. **Fotos de perfil.** Deben cargar en el listado de vendedores y de captadores (mismo
   mecanismo).
6. **Caducidad.** A las 8 horas, o invalidando la cookie a mano, la siguiente petición debe dar
   401 y la aplicación debe llevar al login con el aviso de sesión expirada.

## Dos riesgos conocidos

- **Desarrollo sobre http.** `Secure` es incondicional en el backend. Los navegadores aceptan
  cookies `Secure` sobre `http://localhost`, así que el flujo local habitual funciona. **Pero
  `docker-compose` levanta Vite con `--host 0.0.0.0`**: quien entre por IP de LAN
  (`http://192.168.x.x:5173`) verá la cookie rechazada y no podrá autenticar. Si eso es parte
  del flujo del equipo, hay que pedir al backend que `Secure` dependa del entorno.
- **"Mantener sesión iniciada" desapareció.** La cookie dura 8 horas fijas y no se puede
  extender desde el cliente. El checkbox se reemplazó por el texto "Tu sesión permanece activa
  8 horas". Si el negocio quiere sesiones largas, es una decisión del backend, no del frontend.

## Si hay que revertir

La rama está aislada a propósito. `audit-fix/security/backoffice` contiene todo lo demás ya
verificado y se puede fusionar sin arrastrar este cambio.
