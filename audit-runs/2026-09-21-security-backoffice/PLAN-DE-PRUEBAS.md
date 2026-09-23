# Plan de pruebas — backoffice

> Rama `dev`, commit `9f1d46b`. Auditoría `2026-09-21-security-backoffice`.
> **Lanzamiento: viernes 25 de septiembre.** Quedan miércoles y jueves.

Cubre **sólo lo que la auditoría cambió**: ahí está el riesgo de regresión.

| Fase | Cuándo | Dónde | Tiempo | Alcance |
|---|---|---|---|---|
| **1 · Local** | **Hoy, miércoles** | `localhost` + backend local | ~2 h | **Exhaustiva.** Todo lo funcional |
| **2 · Dev** | Jueves | `api-dev.repuestop.cl` | ~30 min | Sólo lo que local **no puede** probar |
| **3 · Producción** | Viernes, tras desplegar | dominio real | ~15 min | Sólo lo crítico |

El peso está en local a propósito: es donde un fallo cuesta minutos en vez de un despliegue.

Cada prueba indica qué hallazgo protege. El detalle está en `findings.jsonl`, buscando ese ID.

---

# FASE 1 · LOCAL — exhaustiva

## Preparación

```bash
# 1. Backend en localhost:8080 (el proxy de Vite ya apunta ahí por defecto)

# 2. Frontend
cd backoffice_sistema/backoffice/frontend
git checkout dev && git pull
npm ci
npm run dev        # queda en http://localhost:3000
```

Abrir en **pestaña nueva** y dejar DevTools en **Network** + **Console** todo el recorrido.

> Si durante el recorrido aparece `useAuth must be used within an AuthProvider`, es artefacto de
> HMR por haber cambiado de rama: **reiniciar el servidor y abrir pestaña nueva** antes de
> reportarlo como bug. Me pasó varias veces durante la auditoría.

**Cuentas necesarias en la base local:**

| | Perfil |
|---|---|
| **A** | `SUPER_ADMIN` |
| **B** | Con **una sola** área (p. ej. `SOPORTE` / `OPERADOR`) |
| **C** | `CAPTADOR` aprobado |
| **D** | *(si es posible)* captador que **además** tenga un área de backoffice |

**Datos necesarios:** al menos un retiro de vendedor pendiente, uno de socio pendiente, un retiro
de captador pendiente, un ticket con adjunto, una mediación con evidencia y un vendedor con
documentos.

---

## 1 · Estático (5 min)

```bash
npx tsc -b
npm run build
npm audit
grep -rE "bciNominaExport|buildBciNomina|COD_BANCO|socioToNominaRow" dist/assets/*.js
grep -c exceljs package.json
```

| # | Debe pasar | Protege |
|---|---|---|
| 1.1 | `tsc` sin errores y `build` correcto | — |
| 1.2 | `npm audit`: **0 high**, 0 critical (2 moderate de react-router son esperados) | `DP-*` |
| 1.3 | Los dos `grep`: **vacío / 0** | `SEC-013` |

> 1.3 es el control de que el cliente ya no puede escribir cuentas de destino ni importes de
> transferencias bancarias.

## 2 · Acceso y sesión (20 min)

| # | Qué hacer | Debe pasar | Protege |
|---|---|---|---|
| 2.1 | Entrar con **A** | Entra a `/` | — |
| 2.2 | Mirar `GET /auth/me` en Network | La respuesta trae **`permissions`**, aunque sea `[]` | `SEC-002` |
| 2.3 | Entrar con **B** | Ve **su** área y **sólo** la suya; A ve todas | `SEC-002` |
| 2.4 | Entrar con **C** por la pestaña "Captadores" | Va a `/captador` | `SEC-009` |
| 2.5 | Entrar con **C** por "Personal de la empresa" | Decide el servidor: sin permisos de backoffice, mensaje genérico | `SEC-009` |
| 2.6 | **D** por "Personal de la empresa" | **Entra al backoffice.** Antes lo rechazaba por rol | `SEC-009` |
| 2.7 | Entrar con **A** por "Captadores" | *"Esta cuenta pertenece al personal"* | `SEC-009` |
| 2.8 | Mirar el cuerpo del login | **No** lleva `loginContext` | `SEC-009` |
| 2.9 | Cerrar sesión, y reusar el token anterior contra `/auth/me` | **401**: el servidor lo revocó | `SEC-007` |
| 2.10 | Entrar a un área sin permiso (403) | **No** cierra la sesión | `SEC-008` |
| 2.11 | Fallar un login en otra pestaña | **No** cierra la sesión de la primera | `SEC-008` |
| 2.12 | Invalidar la sesión a mano y navegar | Lleva a `/login` con el aviso, **una sola vez** | `SEC-008` |
| 2.13 | Navegar 10 min por varias áreas | **No** aparece *"Tu sesión expiró"* sin motivo | `SEC-008` |

> **2.2 es bloqueante.** Si `permissions` no viene, todos los ADMIN se quedan sin áreas: parar y
> avisar.

## 3 · Nómina de pagos BCI (20 min) — el que mueve dinero

| # | Qué hacer | Debe pasar | Protege |
|---|---|---|---|
| 3.1 | `/administracion/pago-proveedores` → Exportar | Sale `POST /administration/nominas/proveedores`, **sin cuerpo** | `SEC-013` |
| 3.2 | Con socios pendientes | Sale **también** `.../socios` y bajan **dos** archivos, con aviso | `SEC-013` |
| 3.3 | Abrir el `.xlsx` | 3 hojas, 13 columnas con colores, tabla de bancos | `SEC-013` |
| 3.4 | Comparar contra los retiros pendientes | **Cuentas de destino y montos coinciden**, uno por uno | `SEC-013` |
| 3.5 | Sumar la columna de montos | Cuadra con el total en pantalla | `SEC-013` |
| 3.6 | `/administracion/pago-captadores` → Exportar | Igual, con `.../captadores` | `SEC-013` |
| 3.7 | Mirar las cabeceras de respuesta | Llegan `X-Nomina-Id`, `-Hash`, `-Total`, `-Retiros` | `SEC-026` |

> 3.4 es el control real. Si existe una nómina exportada **antes** del cambio, compararla celda a
> celda contra una nueva con los mismos retiros.

## 4 · Documentos y fotos (20 min) — el riesgo silencioso

El token dejó de viajar a orígenes que no sean el backend, y los documentos de origen externo ya
no se enlazan. **Si el backend sirve archivos desde otro host, dejan de verse.**

| # | Qué hacer | Debe pasar | Protege |
|---|---|---|---|
| 4.1 | Previsualizar y descargar un adjunto de ticket | Se abre y se descarga | `SEC-010` |
| 4.2 | Ídem con un documento de vendedor | Igual | `SEC-010` |
| 4.3 | Ídem con una evidencia de mediación | Igual | `SEC-011` |
| 4.4 | Fotos de perfil en listados de vendedores y captadores | Cargan | `SEC-010` |
| 4.5 | Previsualizar un PDF | Se ve en el visor (usa `blob:`) | `SEC-015` |
| 4.6 | Buscar en la UI la marca **"(origen externo)"** | Si aparece → **reportar**: el backend lo sirve desde otro host | `SEC-011` |

## 5 · Documento de liquidación (15 min)

**Vendedor:**

| # | Debe pasar | Protege |
|---|---|---|
| 5.1 | El campo IVA está **bloqueado** y dice *"calculado"* | `SEC-014` |
| 5.2 | La petición lleva `tipoRetiro: "PROVEEDOR"` | `SEC-027` |
| 5.3 | El PDF se guarda y se vuelve a abrir | — |

**Socio** (desde `/retiros` y también desde Pago a proveedores — **son dos modales distintos**):

| # | Debe pasar | Protege |
|---|---|---|
| 5.4 | El campo IVA está **editable** | `SEC-014` |
| 5.5 | La petición lleva `tipoRetiro: "SOCIO"` | `SEC-027` |
| 5.6 | **El documento queda asociado al socio, no a un vendedor** | `SEC-027` |
| 5.7 | Si existe un id presente en las dos tablas, probarlo | El backend no confunde los registros | `SEC-027` |

> 5.6 y 5.7 son los que importan: era la colisión entre `RT_retiro` y `BO_retiro_socio`.

## 6 · Recuperación de contraseña (25 min) — migrada esta semana

**Mirar el cuerpo de cada petición en Network, no las firmas.**

**Rol BACKOFFICE** (cuenta **A** o **B**):

| # | Qué hacer | Debe pasar | Protege |
|---|---|---|---|
| 6.1 | Desde `/login`, escribir el correo y pulsar *"¿Olvidaste tu contraseña?"* | URL es `/recuperar-contrasena?type=staff` **sin el correo**, y el campo llega pre-llenado | `SEC-031` |
| 6.2 | Enviar código | `send-code` lleva `{ email, rol }` y la respuesta trae **`solicitudId`** | `SEC-030` |
| 6.3 | Comprobar el correo recibido | Llega con un código de 6 dígitos | — |
| 6.4 | Ingresar el código | `verify-code` lleva `{ code, rol, solicitudId }` y **NO lleva `email`** | `SEC-030` |
| 6.5 | Comparar el `solicitudId` enviado con el recibido | **Idénticos**, mayúsculas incluidas | `SEC-030` |
| 6.6 | Leer la pantalla del paso 3 | Dice *"Usa al menos **12** caracteres"* **antes** de escribir | `SEC-005` |
| 6.7 | Escribir **11** caracteres y enviar | Rechazado **en el cliente**, con el motivo, **sin enviar petición** | `SEC-005` |
| 6.8 | Escribir **12** y enviar | `reset` lleva `{ code, newPassword, rol, solicitudId }`, **sin `email`** | `SEC-030` |
| 6.9 | Entrar con la contraseña nueva | Funciona | — |

**Rol CAPTADOR** (cuenta **C**, desde `/login?type=capturer`): repetir 6.1–6.9.

| # | Debe pasar | Protege |
|---|---|---|
| 6.10 | La pantalla dice *"Usa al menos **8** caracteres"* | `SEC-005` |
| 6.11 | El resto igual | `SEC-030` |

**Cuenta D** (captador **con** acceso al backoffice), si existe:

| # | Debe pasar | Protege |
|---|---|---|
| 6.12 | Con 8 caracteres: el cliente la acepta, el servidor la rechaza, y se ve **el mensaje real del servidor** explicando que necesita 12 | `SEC-005` |
| 6.13 | Se queda en el paso 3 para corregir, no expulsa | `SEC-005` |

**Casos borde** — los tres importan:

| # | Qué hacer | Debe pasar | Protege |
|---|---|---|---|
| 6.14 | Reutilizar el mismo código tras un `reset` correcto | Falla: es de un solo uso | `SEC-030` |
| 6.15 | Pulsar *"Empezar de nuevo y pedir otro código"* | Llega un código nuevo; el anterior queda muerto | `SEC-030` |
| 6.16 | Paso 1 con un correo **inexistente** | **Mismo mensaje y mismo comportamiento** que con uno existente | `SEC-005` |
| 6.17 | Provocar un error en pasos 1 o 2 | Se muestra el texto fijo, **nunca** el del servidor | `SEC-018` |

> 6.16 es el que protege contra enumeración. Si se comporta distinto, reportar.

## 7 · Resto de pantallas (20 min)

| # | Qué hacer | Debe pasar | Protege |
|---|---|---|---|
| 7.1 | Con **B** (SOPORTE), abrir un ticket y desplegar el asignado | Sale `GET /support/assignees`, **no** `/backoffice/permissions/users`, y la lista se puebla | `SEC-001` |
| 7.2 | Login con correo inexistente vs. contraseña incorrecta | **Mismo mensaje** en ambos | `SEC-018` |
| 7.3 | Mirar el marcador del campo de correo | `correo@empresa.cl`, no una cuenta real | `SEC-020` |
| 7.4 | Activar un empleado desde el enlace del correo | Flujo completo; el error es genérico | `SEC-018` |
| 7.5 | Listado de vendedores | Los estados de mediación son los **reales** | `SEC-017` |
| 7.6 | Recorrer cada área, 2–3 pantallas de cada una | **Cero errores** de consola | — |

## Qué reportar al terminar la Fase 1

- Número de prueba que falló y qué se vio exactamente (captura de Network si aplica).
- Si todo pasa: decirlo explícitamente, para dar por buena la fase.

---

# FASE 2 · DEV — sólo lo que local no puede probar

**Local no cubre cuatro cosas**, porque el proxy de Vite sirve todo desde el mismo origen y no
hay infraestructura real:

| # | Qué probar | Por qué local no sirve |
|---|---|---|
| 2.1 | **CORS**: que las llamadas a `api-dev.repuestop.cl` no sean bloqueadas | En local el proxy elimina el cruce de orígenes |
| 2.2 | **Correo real**: que llegue el de recuperación y el de activación de empleado | Depende del proveedor de correo, no del código |
| 2.3 | **Permisos con datos reales**: repetir 2.2 y 2.3 de la Fase 1 con las cuentas de dev | La base local puede no reflejar la realidad |
| 2.4 | **Volumen**: exportar una nómina con los retiros reales del ciclo y cuadrar el total | En local hay pocos datos |

Y un repaso corto:

- [ ] Login y logout en los dos roles
- [ ] Previsualizar un documento y una foto de perfil (si el backend de dev los sirve desde otro
      host, aquí se ve y en local no)
- [ ] Cero errores de consola

> Si la Fase 1 pasó entera, esto son 30 minutos. **No hace falta repetir todo.**

---

# FASE 3 · PRODUCCIÓN — sólo lo crítico

Antes, repasar `REQUISITOS-DE-LANZAMIENTO.md`.

| # | Qué hacer | Debe pasar | Protege |
|---|---|---|---|
| 3.1 | `curl -I https://<dominio-real>/` | Llegan `Content-Security-Policy` y `Strict-Transport-Security`; `X-XSS-Protection: 0` | `SEC-015` |
| 3.2 | Mirar el dominio que sirve la consola | Subdominio de `repuestop.cl`, **no** `*.vercel.app` | `SEC-025` |
| 3.3 | Entrar y navegar | Las llamadas a la API **no** fallan por CORS | `SEC-025` |
| 3.4 | Recorrer login, un documento y una foto, con consola abierta | **Cero violaciones de CSP**; el botón de Google carga **con estilos** | `SEC-015` |
| 3.5 | Exportar una nómina | **El total cuadra** con los retiros pendientes | `SEC-013` |
| 3.6 | Confirmar con quien desplegó | Ninguna variable reutiliza un valor del repositorio | `SEC-012` |

> Si 3.3 falla, el dominio no está en la allowlist de CORS del backend. Si 3.4 muestra una
> violación de `connect-src`, hay un origen nuevo que no está en la política.

---

# Fuera de este plan

- **La cookie de sesión** (`SEC-006`) va en `audit-fix/security/backoffice-cookie-session`,
  **sin fusionar**, con su propio `COMO-PROBAR-cookie-de-sesion.md`.
  **Rebasar contra `dev` antes de probarla**: se creó antes de los últimos merges.
  No entra en el lanzamiento del viernes salvo que se pruebe y se decida incluirla.
- **La imagen de Docker** (`SEC-016`), sólo si el equipo la usa.

# Si algo falla

Cada prueba dice qué hallazgo protege. La reproducción y el criterio de cierre están en
`findings.jsonl`, buscando ese ID.
