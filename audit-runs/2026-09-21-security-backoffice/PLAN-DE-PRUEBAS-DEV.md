# Plan de pruebas en ambiente dev — backoffice

> Rama `dev`, commit `5b068db`. API: `https://api-dev.repuestop.cl`.
> Cubre sólo lo que la auditoría cambió: es ahí donde está el riesgo de regresión.
> Tiempo estimado: **45–60 min** con una cuenta de cada tipo.

## Antes de empezar

Necesitás tres cuentas en dev:

- **A** — SUPER_ADMIN
- **B** — con un área asignada y **sólo una** (por ejemplo SOPORTE/OPERADOR)
- **C** — CAPTADOR aprobado

Abrí DevTools con la pestaña **Network** y la consola visibles durante todo el recorrido.

---

## Bloque 1 — Bloqueantes (si algo falla acá, parar)

### 1.1 Los permisos no dejaron a nadie fuera

Es lo primero porque condiciona todo lo demás: se cerró el fallback que daba **todas** las áreas
a cualquier ADMIN, y ahora sin lista de permisos no hay acceso.

1. Entrar con **B**.
2. En Network, mirar la respuesta de `GET /auth/me`.

| Qué mirar | Debe pasar |
|---|---|
| La respuesta trae el campo `permissions` | **Sí**, aunque sea `[]` |
| B ve su área en el selector | Sí |
| B **no** ve las áreas que no tiene | Sí |
| A (SUPER_ADMIN) ve todas | Sí |

> **Si `permissions` no viene en la respuesta, parar acá.** Todos los ADMIN se quedan sin áreas.
> Es lo que más probablemente falle si dev no tiene el backend actualizado.
> Protege: `SEC-002`.

### 1.2 La nómina de pagos sale correcta

El cambio de mayor impacto: el archivo que mueve dinero ya no lo arma el navegador.

1. Con **A**, ir a `/administracion/pago-proveedores` con retiros pendientes en el ciclo.
2. Exportar.

| Qué mirar | Debe pasar |
|---|---|
| Sale `POST /administration/nominas/proveedores`, **sin cuerpo** | Sí |
| Si hay socios pendientes, sale **también** `.../socios` y bajan **dos archivos** | Sí |
| Abrir el `.xlsx`: 3 hojas, 13 columnas con colores, tabla de bancos | Sí |
| **Cuentas de destino y montos** coinciden con los retiros pendientes | Sí |
| El total del archivo cuadra con el total en pantalla | Sí |
| Repetir en `/administracion/pago-captadores` | Igual |

> Comparar contra una nómina exportada **antes** del cambio, si existe alguna.
> Protege: `SEC-013`.

### 1.3 Acceso y salida

1. Entrar con **A**, cerrar sesión, volver a entrar.
2. Con **C** en la pestaña "Captadores": debe entrar a `/captador`.
3. Con **C** en la pestaña "Personal de la empresa": el servidor decide. Si tiene permisos de
   backoffice, **debe entrar**; si no, ve el mensaje genérico.
4. Con **A** en la pestaña "Captadores": debe ver *"Esta cuenta pertenece al personal"*.

> Protege: `SEC-009`, `SEC-007`.

---

## Bloque 2 — Lo que puede romperse sin avisar

### 2.1 Documentos y fotos

Aquí está el riesgo silencioso: el token dejó de viajar a orígenes que no sean el backend, y los
documentos de origen externo ya no se enlazan. **Si dev sirve archivos desde otro host, dejan de
verse.**

Con **A**, previsualizar y descargar:

- [ ] Un adjunto de un ticket de soporte
- [ ] Un documento de un vendedor (`/confianza/validations`)
- [ ] Una evidencia dentro de una mediación
- [ ] Las fotos de perfil en el listado de vendedores y de captadores

| Qué mirar | Debe pasar |
|---|---|
| Los archivos se abren y se descargan | Sí |
| Si algo aparece como **"(origen externo)"** sin enlace | **Avisar**: el backend lo sirve desde otro host |
| En consola, ninguna violación de CSP | Sí |

> Protege: `SEC-010`, `SEC-011`.

### 2.2 La sesión no se cae sola

1. Con **A** dentro, navegar por varias áreas durante unos minutos.

| Qué mirar | Debe pasar |
|---|---|
| **No** aparece *"Tu sesión expiró"* sin motivo | Correcto |
| Un 403 (entrar a un área sin permiso) **no** cierra la sesión | Correcto |
| Un login fallido **no** cierra la sesión de otra pestaña | Correcto |

2. Forzar la caducidad (borrar el token o esperar): la siguiente petición debe llevar a `/login`
   **con el aviso**, y una sola vez.

> Protege: `SEC-008`.

### 2.3 Documento de liquidación

1. Con **A**, emitir el documento tributario de un retiro de **vendedor**.

| Qué mirar | Debe pasar |
|---|---|
| El campo IVA está **bloqueado** y dice *"calculado"* | Sí |
| La petición lleva `tipoRetiro: "PROVEEDOR"` | Sí |
| El PDF se guarda y se puede volver a abrir | Sí |

2. Repetir con un retiro de **socio** (desde `/retiros` o desde Pago a proveedores).

| Qué mirar | Debe pasar |
|---|---|
| El campo IVA está **editable** | Sí |
| La petición lleva `tipoRetiro: "SOCIO"` | Sí |
| El documento queda asociado al socio correcto, **no a un vendedor** | Sí |

> Protege: `SEC-014`, `SEC-027`. El punto 2 último es el que importa: era la colisión de ids.

### 2.4 Asignación de tickets

1. Con **B** (SOPORTE), abrir un ticket y desplegar el selector de asignado.

| Qué mirar | Debe pasar |
|---|---|
| Sale `GET /support/assignees` | Sí |
| **No** sale `/backoffice/permissions/users` | Correcto |
| La lista se puebla | Sí |
| Si dice *"Tu cuenta no puede consultar la lista"* | El endpoint nuevo no está en dev |

> Protege: `SEC-001`.

---

## Bloque 3 — Rápidas (5 min)

- [ ] **Login con correo inexistente** y **login con contraseña mala**: el mensaje debe ser
      **idéntico** en ambos casos (`SEC-018`).
- [ ] El marcador del campo de correo dice `correo@empresa.cl`, no una cuenta real (`SEC-020`).
- [ ] **Recuperar contraseña** y **activar empleado** desde el enlace de correo: ambos flujos
      completos de punta a punta. Los tocó el merge con `dev`.
- [ ] Navegación general: entrar a cada área, abrir dos o tres pantallas de cada una, sin errores
      de consola.
- [ ] En el listado de vendedores, los estados de mediación son los reales (se retiró un
      mecanismo que los sobrescribía desde `localStorage`, `SEC-017`).

---

## Lo que NO se prueba acá

- **La cookie de sesión** (`SEC-006`) va en la rama
  `audit-fix/security/backoffice-cookie-session`, **sin fusionar**. Tiene su propio
  `COMO-PROBAR-cookie-de-sesion.md`. Rebasar contra `dev` antes de probarla.
- **La CSP** (`SEC-015`) sólo aplica desplegada, porque son cabeceras de Vercel. Ya se verificó
  en ejecución sobre el build de producción; en dev basta con mirar que no haya violaciones en
  consola durante el recorrido.
- **La imagen de Docker** (`SEC-016`), sólo si el equipo la usa.

## Si algo falla

Cada prueba dice qué hallazgo protege. El detalle, la reproducción y el criterio de cierre están
en `findings.jsonl` de esta misma carpeta, buscando por ese ID.
