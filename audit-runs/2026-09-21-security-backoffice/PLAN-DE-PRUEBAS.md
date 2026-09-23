# Plan de pruebas — backoffice

> Rama `dev`, commit `ca765ce`. Auditoría `2026-09-21-security-backoffice`.
> Cubre **sólo lo que la auditoría cambió**: ahí está el riesgo de regresión.

Tres fases, en orden. Cada una filtra problemas antes de gastar la siguiente.

| Fase | Dónde | Tiempo | Para qué |
|---|---|---|---|
| **1 · Local** | `localhost:3000` | 15 min | Que no se despliegue algo roto |
| **2 · Dev** | `api-dev.repuestop.cl` | 45–60 min | Los flujos reales con datos reales |
| **3 · Producción** | dominio real | 20 min | Lo que sólo existe al publicar |

Cada prueba indica qué hallazgo protege. El detalle está en `findings.jsonl`, buscando ese ID.

---

# FASE 1 · LOCAL

Barato y rápido. Si algo falla acá, no tiene sentido desplegar.

## 1.1 Compila y no arrastra vulnerabilidades

```bash
cd backoffice/frontend
npm ci
npx tsc -b
npm run build
npm audit
```

| Debe pasar |
|---|
| `tsc` sin errores |
| `build` correcto |
| `npm audit`: **0 high**, 0 critical (quedan 2 moderate de react-router, verificados inalcanzables) |

## 1.2 El código que armaba la nómina ya no existe

```bash
grep -rE "bciNominaExport|buildBciNomina|COD_BANCO|socioToNominaRow" dist/assets/*.js
grep -c exceljs package.json
```

Los dos deben dar **vacío / 0**. Si algo aparece, el cliente volvió a poder escribir cuentas de
destino e importes de transferencias. Protege `SEC-013`.

## 1.3 Arranca y no se rompe

```bash
npm run dev
```

Abrir `http://localhost:3000` en una **pestaña nueva** (no reutilizar una con HMR previo).

| Debe pasar |
|---|
| La pantalla de acceso renderiza completa |
| El marcador del campo de correo dice `correo@empresa.cl` |
| Entrar a `/confianza/sellers` sin sesión redirige a `/login` |
| **Cero errores** en consola |

> Si aparece `useAuth must be used within an AuthProvider`, es artefacto de HMR por haber
> cambiado de rama: reiniciar el servidor y abrir pestaña nueva antes de darlo por bug.

## 1.4 Opcional: con el backend levantado en local

Si corren el backend en `localhost:8080`, el proxy de Vite ya apunta ahí y **se puede adelantar
toda la Fase 2 en local**. Recomendado para la recuperación de contraseña (2.6), que es lo más
laborioso de coordinar en dev.

---

# FASE 2 · DEV

Necesitás tres cuentas: **A** SUPER_ADMIN · **B** con **una sola** área · **C** captador aprobado.
DevTools abierto en **Network** y consola durante todo el recorrido.

## Bloqueantes

### 2.1 Los permisos no dejaron a nadie fuera

Se cerró el fallback que daba **todas** las áreas a cualquier ADMIN: ahora sin lista no hay acceso.

1. Entrar con **B**. 2. Mirar la respuesta de `GET /auth/me`.

| Debe pasar |
|---|
| La respuesta trae `permissions`, aunque sea `[]` |
| B ve su área, y **sólo** la suya |
| A ve todas |

> **Si `permissions` no viene, parar acá**: todos los ADMIN se quedan sin áreas. Es lo que más
> probablemente falle si dev no tiene el backend actualizado. Protege `SEC-002`.

### 2.2 La nómina de pagos sale correcta

1. Con **A**, `/administracion/pago-proveedores` con retiros pendientes. 2. Exportar.

| Debe pasar |
|---|
| Sale `POST /administration/nominas/proveedores`, **sin cuerpo** |
| Con socios pendientes, sale **también** `.../socios` y bajan **dos** archivos |
| El `.xlsx`: 3 hojas, 13 columnas con colores, tabla de bancos |
| **Cuentas de destino y montos** coinciden con los retiros pendientes |
| El total cuadra con el de pantalla |
| Repetir en `/administracion/pago-captadores` |

> Comparar contra una nómina exportada **antes** del cambio, si existe. Protege `SEC-013`.

### 2.3 Acceso y salida

| Caso | Debe pasar |
|---|---|
| **A** entra, cierra sesión, vuelve a entrar | Sin problemas |
| **C** por la pestaña "Captadores" | Entra a `/captador` |
| **C** por "Personal de la empresa" | Decide el servidor: **si tiene permisos de backoffice, entra** |
| **A** por la pestaña "Captadores" | *"Esta cuenta pertenece al personal"* |

> Protege `SEC-009`, `SEC-007`.

## Lo que puede romperse sin avisar

### 2.4 Documentos y fotos

El riesgo silencioso: el token dejó de viajar a orígenes que no sean el backend, y los documentos
de origen externo ya no se enlazan. **Si dev sirve archivos desde otro host, dejan de verse.**

Con **A**, previsualizar y descargar: un adjunto de ticket · un documento de vendedor · una
evidencia de mediación · las fotos de perfil en los listados de vendedores y captadores.

| Debe pasar |
|---|
| Todo se abre y se descarga |
| Ninguna violación de CSP en consola |
| Si algo sale como **"(origen externo)"** sin enlace → **avisar**: el backend lo sirve desde otro host |

> Protege `SEC-010`, `SEC-011`.

### 2.5 La sesión no se cae sola

| Debe pasar |
|---|
| Navegando varios minutos, **no** aparece *"Tu sesión expiró"* sin motivo |
| Un 403 (área sin permiso) **no** cierra la sesión |
| Un login fallido **no** cierra la sesión de otra pestaña |
| Al caducar de verdad: lleva a `/login` con el aviso, **una sola vez** |

> Protege `SEC-008`.

### 2.6 Recuperación de contraseña — los dos roles

Migrado a `solicitudId` esta semana. **Mirar el cuerpo de cada petición en Network, no las
firmas.** Protege `SEC-030`, `SEC-005`, `SEC-031`, `SEC-018`.

**Rol BACKOFFICE** (cuenta **A** o **B**):

1. En `/login`, escribir el correo y pulsar *"¿Olvidaste tu contraseña?"*.

   | Debe pasar |
   |---|
   | La URL es `/recuperar-contrasena?type=staff` — **sin el correo** |
   | El campo llega pre-llenado |

2. Enviar código.

   | Debe pasar |
   |---|
   | `send-code` lleva `{ email, rol }` |
   | La respuesta trae **`solicitudId`** |
   | El correo llega |

3. Ingresar el código.

   | Debe pasar |
   |---|
   | `verify-code` lleva `{ code, rol, solicitudId }` |
   | **NO lleva `email`** |
   | El `solicitudId` enviado es **idéntico** al recibido, mayúsculas incluidas |

4. Paso 3, el bug que se arregló:

   | Caso | Debe pasar |
   |---|---|
   | La pantalla dice *"Usa al menos **12** caracteres"* antes de escribir | Sí |
   | Escribir **11** caracteres | Rechazado **en el cliente**, con el motivo, **sin enviar petición** |
   | Escribir **12** | `reset` lleva `{ code, newPassword, rol, solicitudId }`, **sin `email`** |
   | Entrar con la contraseña nueva | Funciona |

**Rol CAPTADOR** (cuenta **C**, desde `/login?type=capturer`): repetir 1–4.

| Debe pasar |
|---|
| La pantalla dice *"Usa al menos **8** caracteres"* |
| Todo lo demás, igual |

**Casos borde** (los tres importan):

| Caso | Debe pasar |
|---|---|
| Reutilizar el mismo código tras un `reset` correcto | Falla: es de un solo uso |
| Pulsar *"Empezar de nuevo y pedir otro código"* en el paso 2 o 3 | Llega un código nuevo y el anterior queda muerto |
| Paso 1 con un correo **inexistente** | **Mismo mensaje y mismo comportamiento** que con uno existente |

> El último es el que protege contra enumeración: si se comporta distinto, avisar.

**Si una cuenta de captador tiene además acceso al backoffice:** el cliente le pide 8 pero el
servidor exige 12. Debe verse **el mensaje real del servidor** explicando el motivo, y quedarse
en el paso 3 para corregir. Es el caso que el cliente no puede prever.

### 2.7 Documento de liquidación

**Vendedor:**

| Debe pasar |
|---|
| El campo IVA está **bloqueado** y dice *"calculado"* |
| La petición lleva `tipoRetiro: "PROVEEDOR"` |
| El PDF se guarda y se vuelve a abrir |

**Socio** (desde `/retiros` o desde Pago a proveedores):

| Debe pasar |
|---|
| El campo IVA está **editable** |
| La petición lleva `tipoRetiro: "SOCIO"` |
| El documento queda asociado **al socio, no a un vendedor** |

> El último es el que importa: era la colisión de ids. Protege `SEC-014`, `SEC-027`.

### 2.8 Asignación de tickets

Con **B** (SOPORTE), abrir un ticket y desplegar el selector de asignado.

| Debe pasar |
|---|
| Sale `GET /support/assignees` |
| **NO** sale `/backoffice/permissions/users` |
| La lista se puebla |

> Si dice *"Tu cuenta no puede consultar la lista"*, el endpoint nuevo no está en dev.
> Protege `SEC-001`.

## Rápidas (5 min)

- [ ] Login con correo inexistente y con contraseña mala: **mismo mensaje** (`SEC-018`)
- [ ] Activar empleado desde el enlace de correo, flujo completo — lo tocó el merge con `dev`
- [ ] Navegar por cada área, dos o tres pantallas de cada una, sin errores de consola
- [ ] En el listado de vendedores, los estados de mediación son los reales (`SEC-017`)

---

# FASE 3 · PRODUCCIÓN

Sólo lo que **no existe** hasta publicar. Antes, repasar `REQUISITOS-DE-LANZAMIENTO.md`.

## 3.1 Las cabeceras llegan

```bash
curl -I https://<dominio-real>/
```

| Debe aparecer |
|---|
| `Content-Security-Policy` con `connect-src` incluyendo el origen real de la API |
| `Strict-Transport-Security: max-age=31536000; includeSubDomains` |
| `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` |
| `X-XSS-Protection: 0` (no `1; mode=block`) |

> Protege `SEC-015`.

## 3.2 El dominio es el correcto

| Debe pasar |
|---|
| La consola se sirve desde el subdominio de `repuestop.cl`, **no** desde `*.vercel.app` |
| Las llamadas a la API **no** fallan por CORS |

> Si fallan por CORS, el dominio no está en la allowlist del backend. Protege `SEC-025`.

## 3.3 Recorrido con la CSP puesta

Repetir **2.4** (documentos y fotos) y **2.6** (recuperación) contra producción, con la consola
abierta.

| Debe pasar |
|---|
| **Cero violaciones de CSP** |
| El botón de Google carga **con sus estilos** |
| Los PDF se previsualizan (usan `blob:`) |

> Si aparece una violación de `connect-src`, hay un origen nuevo que no está en la política.

## 3.4 Variables nuevas

| Debe pasar |
|---|
| Ninguna variable de producción reutiliza un valor que pasó por el repositorio |
| `REPUESTOP_BACKOFFICE_API_KEY` no coincide con la del historial |
| Tampoco reutiliza el **patrón de nombre** (`<componente>-<entorno>-key-<año>`) |

> Protege `SEC-012`.

## 3.5 Humo del flujo que mueve dinero

| Debe pasar |
|---|
| Exportar una nómina y **cuadrar el total** contra los retiros pendientes |
| Cerrar sesión y volver a entrar |

---

# Fuera de este plan

- **La cookie de sesión** (`SEC-006`) va en `audit-fix/security/backoffice-cookie-session`,
  **sin fusionar** y con su propio `COMO-PROBAR-cookie-de-sesion.md`.
  **Rebasar contra `dev` antes de probarla**: se creó antes de los últimos merges.
- **La imagen de Docker** (`SEC-016`), sólo si el equipo la usa.

# Si algo falla

Cada prueba dice qué hallazgo protege. La reproducción y el criterio de cierre están en
`findings.jsonl`, buscando ese ID.
