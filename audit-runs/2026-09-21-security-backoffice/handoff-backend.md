# Encargo para el agente de seguridad del backend

> Generado por el agente `security` que audito la plataforma **`backoffice`** (frontend) el 2026-09-21.
> Corrida: `backoffice_sistema/audit-runs/2026-09-21-security-backoffice/`.
> Rama con las correcciones ya aplicadas en el frontend: `audit-fix/security/backoffice`.

## Por que existe este documento

El repositorio `backoffice_sistema` contiene **solo el frontend**. Audite sus 254 unidades de superficie, pero **139 controles quedaron `unverified`** porque el servicio que implementa `/api/v1/**` no esta ahi. De esos 139, **135 son la autorizacion de servidor de cada endpoint**: desde el frontend puedo demostrar que la guarda de ruta es solo cosmetica, pero no si el backend revalida.

Ese es el nucleo del riesgo y solo se puede cerrar desde tu lado. Este documento tiene lo que encontre, con evidencia concreta, y lo que te pido que verifiques o corrijas.

**Nada de lo que sigue fue verificado contra el backend.** Son hipotesis con evidencia del lado cliente. Si al mirar el codigo del servidor resulta que el control ya existe, marcalo `pass` y cierra el registro: eso tambien es un resultado valioso y es justo lo que falta para completar la cobertura.

## Lo primero, hoy

### 1. Rotar `REPUESTOP_BACKOFFICE_API_KEY` — `high`

Esta en claro en el historial de git de `backoffice_sistema`, en `PLAN_BACKOFFICE_POLLING.md` (commit `32bb1a0b`, 2026-06-26). El archivo fue borrado del arbol pero sigue siendo recuperable con `git show 32bb1a0b:PLAN_BACKOFFICE_POLLING.md`. gitleaks sobre el arbol de trabajo da vacio; sobre el historial de 76 commits marca 3 coincidencias, todas ahi.

El mismo documento describe la superficie que esa clave protege:

```
GET   /api/v1/external/backoffice/proveedores
GET   /api/v1/external/backoffice/proveedores/{proveedorId}
GET   /api/v1/external/backoffice/verificaciones
GET   /api/v1/external/backoffice/verificaciones/{verificacionId}
PATCH /api/v1/external/backoffice/proveedores/{proveedorId}/estado
PATCH /api/v1/external/backoffice/verificaciones/{verificacionId}/aprobar
PATCH /api/v1/external/backoffice/verificaciones/{verificacionId}/rechazar
```

**Lo que te pido:**

1. **Rotar la clave en todos los entornos**, sin reutilizar el patron de nombre: el valor filtrado sigue una forma de `<componente>-<entorno>-key-<anio>`, trivialmente extrapolable al de produccion.
2. **Revisar el valor por defecto vacio.** El documento muestra la configuracion como `api-key: ${REPUESTOP_BACKOFFICE_API_KEY:}`. Comprueba que, con la variable sin definir, el servicio **rechaza** toda peticion en vez de aceptar cualquiera con clave vacia. Si la comparacion es un `equals` contra una cadena vacia, hoy tienes esa superficie abierta.
3. **Sustituir la cabecera estatica compartida.** `X-Backoffice-Api-Key` es una credencial unica sin identidad ni rol: quien la tenga puede aprobar y rechazar verificaciones de proveedores y cambiar su estado. No hay forma de saber quien hizo que, ni de revocar a un solo consumidor. Necesita credenciales por cliente, con rotacion y registro de auditoria, y autorizacion por operacion.
4. **Coordinar la purga del historial.** Hay que sacar `PLAN_BACKOFFICE_POLLING.md` con `git filter-repo`. Aprovecha para sacar en la misma reescritura los 20 MB de `backoffice/tools/` (distribucion de Maven versionada, hallazgo `CF-010`): ya la untrackee, pero sigue en el historial. **Una sola reescritura coordinada, no dos.**

_No copio el valor de la clave aqui ni en la evidencia. Esta en el commit indicado._

## Lo que desbloquea correcciones del frontend ya escritas

Estas dos las deje a medias a proposito, porque completarlas sin tu lado tumbaria el backoffice.

### 2. Que `/auth/me` devuelva siempre `permissions` — `high`

`hasBackofficePermission()` solo consulta `user.permissions` si es un array. Si `/auth/me` responde sin ese campo, cae a un fallback que devuelve `true` para **cualquier area** si el rol es `ADMIN` (`src/hooks/usePermissions.ts:26`). Y la forma de respuesta `{id, nombre, email, rol}` --que el codigo trata como caso normal del login de backoffice-- no lo trae, asi que el fallback no es un borde: es la rama por defecto.

**Ya aplique** la mitad segura: `mapCurrentUser` deja de descartar `permissions` si llega. **No aplique** el cierre del fallback, porque si `/auth/me` no manda el array dejaria a todos los `ADMIN` con cero areas.

**Lo que te pido:** que `/auth/me` incluya siempre `permissions` (array vacio si no tiene ninguno), en las dos formas de respuesta. Avisame y aplico el cambio de una linea que ya esta identificado.

### 3. Revocar de verdad en `POST /auth/logout` — `high`

Hasta ahora el cierre de sesion era **solo local**: se borraba el token del navegador y nunca se avisaba al servidor, asi que cualquier copia extraida antes seguia sirviendo hasta la expiracion natural. **Ya aplique** la llamada a `POST /auth/logout` antes de limpiar el estado local, en modo best-effort.

**Lo que te pido:**

1. Que `/auth/logout` **revoque efectivamente** el token (lista de revocacion o sesion en servidor).
2. **Aclarar el contrato.** `src/api/auth.ts` lo declara como `POST /auth/logout {refreshToken}`, pero el login de backoffice **no devuelve ningun refreshToken**: la respuesta es `{token, usuario}`. Mi llamada va sin cuerpo, apoyandose solo en el token portador. Confirmame cual es el contrato correcto.
3. Comprobacion de cierre: tras cerrar sesion, el token anterior debe devolver **401** en `/auth/me`.

## Escalada de privilegios — lo mas grave que encontre

### La API de permisos se ejerce desde una pantalla que no exige SUPER_ADMIN — `critical` · SEC-BACKOFFICE-001

El modulo @/api/permissions expone la gestion completa de roles del backoffice (listar usuarios, buscar por correo, PUT de permisos, invitar empleado, borrar cuenta). En el enrutador solo /configuracion esta protegido por RequireSuperAdmin. Sin embargo SupportTicketDetailModal.tsx --montado bajo RequireArea area="SOPORTE"-- importa ese mismo modulo y llama listPermissionUsers() para poblar el desplegable de asignacion. Es decir: un operador de SOPORTE ya consume GET /backoffice/permissions/users con parametros que el cliente elige, y tiene en su bundle las funciones updateUserPermissions(), inviteEmployee() y deleteUserAccount() listas para invocar desde la consola del navegador. La unica barrera observable en este repositorio es la guarda de ruta del frontend, que no protege la API.

**Evidencia (frontend):**
- `src/modules/support/SupportTicketDetailModal.tsx:16`
- `src/modules/support/SupportTicketDetailModal.tsx:337`
- `src/App.tsx:137`
- `src/App.tsx:125`
- `src/api/permissions.ts:49`
- `src/api/permissions.ts:54`

**Como reproducirlo contra el backend:**
1. Iniciar sesion con una cuenta cuyo unico permiso sea area SOPORTE slot OPERADOR.
2. Navegar a /soporte y abrir el detalle de cualquier ticket; desplegar el selector de asignado.
3. Observar en la pestana Network la peticion GET /api/v1/backoffice/permissions/users?area=SOPORTE&slot=OPERADOR&page=0&size=100 con respuesta 2xx.
4. En la consola del navegador, sin cambiar de pantalla, invocar el mismo cliente axios contra PUT /api/v1/backoffice/permissions/users/<propio-id> con body {"permissions":[{"area":"ADMINISTRACION_CONTABLE","slot":"QA"}]}.
5. Si la respuesta es 2xx, el operador se auto-concedio un area que la UI nunca le ofrece: escalada vertical confirmada.

**Lo que te pido.** Exigir SUPER_ADMIN en el servidor para todo /api/v1/backoffice/permissions/** mediante una regla central (no por endpoint). En el frontend, separar el listado de operadores de soporte en un endpoint de solo lectura de minimo privilegio (por ejemplo GET /support/assignees) para que la pantalla de soporte no cargue la API de permisos.

**Criterio de cierre:**
- Negativa: con token de SOPORTE/OPERADOR, PUT /api/v1/backoffice/permissions/users/{id} responde 403.
- Negativa: con token de SOPORTE/OPERADOR, GET /api/v1/backoffice/permissions/users responde 403.
- Positiva: con token SUPER_ADMIN ambas responden 2xx y la pantalla /configuracion sigue operando.
- Positiva: el desplegable de asignado en /soporte sigue poblandose desde el endpoint de minimo privilegio.

### Activacion de empleado del backoffice con codigo numerico de 6 digitos y sin limite de intentos en cliente — `critical` · SEC-BACKOFFICE-004

POST /auth/backoffice/activate es la via por la que una persona invitada obtiene credenciales del backoffice. Se alcanza desde la ruta publica /activar-empleado, sin sesion previa, y acepta {email, code, newPassword}. El formulario restringe code a 6 caracteres numericos (maxLength=6, inputMode=numeric), es decir un espacio de 10^6. El cliente no implementa ningun retardo, contador de intentos ni captcha, y el correo del invitado se pre-rellena desde el parametro de URL, de modo que un atacante que conoce o adivina el correo corporativo solo debe recorrer el espacio de codigos. Responder si el codigo es correcto entrega directamente el control de una cuenta del backoffice con los permisos que llevaba la invitacion. Esta es la respuesta concreta a como se obtiene un rol privilegiado.

**Evidencia (frontend):**
- `src/pages/ActivateEmployeePage.tsx:22`
- `src/pages/ActivateEmployeePage.tsx:34`
- `src/pages/ActivateEmployeePage.tsx:8`
- `src/App.tsx:112`
- `src/api/permissions.ts:54`

**Como reproducirlo contra el backend:**
1. Desde /configuracion (SUPER_ADMIN) invitar a un empleado con permisos de ADMINISTRACION_CONTABLE; queda en estado PENDIENTE.
2. Sin sesion, abrir /activar-empleado?email=<correo-del-invitado>.
3. Automatizar POST /api/v1/auth/backoffice/activate con {email, code, newPassword} recorriendo code de 000000 a 999999.
4. Medir cuantos intentos acepta el servidor antes de bloquear; si no bloquea, el recorrido completo es viable.
5. Con el codigo acertado se fija la contrasena y se inicia sesion con los permisos de la invitacion.

**Lo que te pido.** Sustituir el codigo de 6 digitos por un token de un solo uso de alta entropia enviado por correo, con caducidad corta, invalidacion al primer uso e invalidacion de la invitacion tras N intentos fallidos. Aplicar limite de tasa por correo y por IP en el servidor. Mientras exista el codigo corto, no permitir que el correo se prerrellene desde la URL.

**Criterio de cierre:**
- Negativa: tras 5 codigos incorrectos para el mismo correo, la invitacion queda invalidada y responde 429/410.
- Negativa: un token ya usado responde 410 en un segundo intento.
- Positiva: el invitado legitimo activa su cuenta al primer intento con el enlace recibido.

### Recuperacion de contrasena con codigo de 6 digitos, realm elegido por el cliente y minimo de 6 caracteres — `high` · SEC-BACKOFFICE-005

El flujo de /recuperar-contrasena tiene tres defectos acumulados. Primero, el codigo de verificacion es numerico de 6 digitos sin ningun control de intentos en el cliente. Segundo, el campo rol ('BACKOFFICE' o 'CAPTADOR') lo decide el navegador a partir del parametro de URL ?type y se envia en el cuerpo de las tres peticiones: es el cliente quien declara sobre que dominio de identidades opera el restablecimiento. Tercero, la contrasena nueva solo exige 6 caracteres, mientras que la activacion de empleado exige 8; el minimo mas debil aplica a la consola administrativa.

**Evidencia (frontend):**
- `src/pages/RecoverPasswordPage.tsx:14`
- `src/pages/RecoverPasswordPage.tsx:24`
- `src/pages/RecoverPasswordPage.tsx:30`
- `src/pages/RecoverPasswordPage.tsx:35`
- `src/pages/RecoverPasswordPage.tsx:37`
- `src/pages/RecoverPasswordPage.tsx:50`

**Como reproducirlo contra el backend:**
1. Abrir /recuperar-contrasena (sin ?type) y solicitar codigo para un correo de backoffice: se envia rol='BACKOFFICE'.
2. Automatizar POST /api/v1/auth/recover-password/verify-code recorriendo los 10^6 codigos posibles para ese correo.
3. Comprobar si el servidor limita intentos; sin limite, el recorrido es viable.
4. Con el codigo valido, POST /api/v1/auth/recover-password/reset acepta newPassword de 6 caracteres.
5. Por separado, repetir el paso 1 alterando rol en el cuerpo para comprobar si el servidor lo toma del cliente o lo deriva de la identidad.

**Lo que te pido.** Token de un solo uso de alta entropia en el enlace de correo en lugar del codigo de 6 digitos; limite de tasa por correo e IP con invalidacion tras N fallos; derivar el dominio de identidad del propio token en el servidor y dejar de aceptar rol desde el cuerpo; unificar el minimo de contrasena en 12 caracteres para personal del backoffice.

**Criterio de cierre:**
- Negativa: tras 5 codigos incorrectos el codigo queda invalidado y responde 429/410.
- Negativa: enviar rol='BACKOFFICE' en un flujo iniciado como CAPTADOR no cambia el dominio afectado.
- Negativa: newPassword de 6 caracteres es rechazada para una cuenta de backoffice.
- Positiva: el flujo legitimo completo (enlace del correo, contrasena conforme) restablece el acceso.

## Dinero y datos

### La nomina de pagos BCI se construye entera en el navegador y el servidor nunca la valida — `high` · SEC-BACKOFFICE-013

buildBciNominaWorkbook() arma en el cliente el archivo Nomina_Pago_en_Linea.xlsx que el operador sube despues a la banca en linea: numero de cuenta de destino, codigo de banco, RUT del beneficiario, nombre y monto de transferencia se escriben celda por celda desde objetos que viven en memoria del navegador. La cuenta de cargo se toma de la configuracion y se inyecta en la columna 1 en el momento de exportar. El resultado se descarga con downloadFile() sin pasar por el servidor: no hay firma, ni hash, ni registro de que nomina se genero. Esta es la respuesta concreta a si hay validacion de importes que viva solo en el cliente: la pieza que mueve el dinero se produce integramente aqui.

**Lo que te pido.** Generar la nomina en el servidor a partir de los retiros aprobados en base de datos y entregarla como descarga firmada, con un identificador de nomina persistido. El cliente solo debe pedir la exportacion y recibir el archivo. Registrar en la bitacora quien exporto que nomina, con que importe total y que retiros incluyo, y conciliar el total contra la suma de los retiros aprobados.

**Criterio de cierre:**
- Negativa: alterar los datos en memoria del navegador no cambia el contenido del archivo recibido del servidor.
- Negativa: no existe ninguna ruta de codigo que escriba importes o cuentas de destino en el cliente.
- Positiva: la exportacion legitima produce el mismo archivo que hoy (columnas, colores y hojas de la plantilla BCI) y queda registrada en la bitacora.

### Endpoints de notificaciones y borrado de cuenta con el identificador de usuario en la ruta (forma IDOR) — `high` · SEC-BACKOFFICE-023

Cuatro endpoints de notificaciones reciben usuarioId en la ruta, tomado del user.id que el cliente tiene en memoria, y DELETE /auth/users/{userId} recibe ademas el perfil a borrar como parametro de consulta. Es la forma clasica de BOLA: si el servidor toma el identificador de la ruta en vez del sujeto del token, cualquier sesion autenticada lee las notificaciones de otra persona o borra su cuenta cambiando un numero. No puede determinarse desde este repositorio cual de las dos cosas hace el servidor.

**Lo que te pido.** Derivar el usuario del token en el servidor y no de la ruta: exponer /usuarios/me/notificaciones y DELETE /auth/users/me. Mientras exista el identificador en la ruta, comprobar en el servidor que coincide con el sujeto del token salvo para roles administrativos.

**Criterio de cierre:**
- Negativa: con el token de A, cualquier ruta que lleve el id de B devuelve 403.
- Positiva: A sigue viendo y marcando sus propias notificaciones.

### Importes fiscales del documento de liquidacion se envian desde el cliente — `medium` · SEC-BACKOFFICE-014

saveLiquidationDocument() envia ivaLiquidado, rut, razonSocial y tipoDocumento en el cuerpo, y updateConfiguracionPagos() envia la cuenta de cargo BCI. Son campos con efecto contable y bancario cuyo valor se origina en formularios del navegador. No puede comprobarse desde este repositorio si el backend los recalcula o los acepta tal cual.

**Lo que te pido.** Recalcular en el servidor todo importe derivable del retiro y tratar los valores del cuerpo como sugerencia a validar, no como fuente de verdad.

**Criterio de cierre:**
- Negativa: un ivaLiquidado alterado en la peticion no altera el documento emitido.
- Positiva: el flujo legitimo emite el documento con el importe correcto.

### Configuracion de CORS no verificable; el cliente envia credenciales y cabecera Authorization a la vez — `medium` · SEC-BACKOFFICE-024

apiClient se crea con withCredentials: true y ademas anade Authorization: Bearer en las cabeceras por defecto. Con el frontend en Vercel y la API en otro origen, el navegador exige que el servidor responda Access-Control-Allow-Credentials: true con un Access-Control-Allow-Origin concreto, nunca comodin. La configuracion de CORS vive en el backend y no puede inspeccionarse desde aqui. Se deja registrado porque la combinacion de cookie de sesion y cabecera de portador sobre origenes distintos es el escenario donde un CORS permisivo se vuelve critico.

**Lo que te pido.** Lista blanca explicita de origenes en el servidor, sin reflejar el Origin de la peticion y sin comodin cuando se permiten credenciales. Decidir ademas un unico mecanismo de sesion: cookie o cabecera de portador, no ambos.

**Criterio de cierre:**
- Negativa: una peticion con Origin no permitido no recibe Access-Control-Allow-Origin.
- Positiva: el origen del backoffice sigue operando con normalidad.

## El bloque grande: autorizacion de los 135 endpoints

Desde el frontend puedo demostrar esto: las guardas `RequireAuth`, `RequireSuperAdmin`, `RequireArea`, `RequireCapturer` y `RequireApprovedCapturer` deciden **en el navegador**, sobre un objeto que vive en memoria de React. El bundle publicado contiene **todos** los modulos de `@/api` --incluidos `administration`, `permissions`, `founders` y `mediations`--, asi que cualquier sesion autenticada puede invocarlos desde la consola sin tocar la guarda. Lo que no puedo saber es si el servidor revalida.

**Lo que te pido:** para cada grupo, confirmar que existe una regla de autorizacion en el servidor y cubrirla con una prueba negativa por rol. Los registros `SEC-BACKOFFICE-EP-001` a `-135` de `findings.jsonl` tienen uno por endpoint, cada uno con la guarda de cliente observada y los pasos de comprobacion.

| Grupo | Endpoints | Guarda observada en el cliente | Prioridad |
|---|---|---|---|
| `/administration` | 32 | `RequireArea ADMINISTRACION_CONTABLE` (y `RequireSuperAdmin` en `/retiros`) | ALTA — mueve dinero |
| `/validations` | 21 | `RequireArea MEDIACION_CONFIANZA` | MEDIA |
| `/auth` | 15 | publica o `RequireAuth` segun el endpoint | ALTA — credenciales |
| `/backoffice` | 12 | `RequireSuperAdmin`, pero tambien alcanzado desde `RequireArea SOPORTE` | ALTA — ver SEC-001 |
| `/mediations` | 9 | `RequireArea MEDIACION_CONFIANZA` | MEDIA |
| `/captadores` | 9 | `RequireCapturer` / `RequireApprovedCapturer` | MEDIA — datos propios |
| `/sellers` | 9 | `RequireArea MEDIACION_CONFIANZA` | MEDIA |
| `/support` | 7 | `RequireArea SOPORTE` | MEDIA |
| `/usuarios` | 4 | `RequireAuth` | ALTA — forma IDOR, ver SEC-023 |
| `/anuncios` | 3 | `RequireArea MEDIACION_CONFIANZA` | MEDIA |
| `/feedback` | 3 | `RequireArea MEDIACION_CONFIANZA` | BAJA |
| `/reports` | 2 | `RequireArea MEDIACION_CONFIANZA` | BAJA |
| `/alerts` | 2 | `RequireArea MEDIACION_CONFIANZA` | BAJA |
| `/users` | 2 | `RequireApprovedCapturer` | MEDIA |
| `/audits` | 1 | `RequireArea MEDIACION_CONFIANZA` | BAJA |
| `/dashboard` | 1 | `RequireArea MEDIACION_CONFIANZA` | BAJA |
| `/geografia` | 1 | publica | BAJA |
| `/receipts` | 1 | `RequireArea MEDIACION_CONFIANZA` | BAJA |
| `/uploads` | 1 | `RequireArea SOPORTE` | MEDIA — subida de ficheros |

Para cada endpoint, la comprobacion es siempre la misma y es mecanica:

```
1. Autenticarse con un rol que NO deberia alcanzarlo segun la guarda de cliente.
2. Invocarlo directamente (curl o consola del navegador con el token).
3. 403 -> el control existe: marcar el registro como pass.
   2xx -> control de funcion ausente: marcar fail y corregir.
4. Repetir cambiando el id del recurso por uno de otra cuenta (BOLA/IDOR).
```

## Lo que ya esta corregido en el frontend

Para que no lo busques ni lo dupliques. Todo en `audit-fix/security/backoffice`.

| ID | Estado | Que se hizo |
|---|---|---|
| `SEC-BACKOFFICE-010` | verified | El token del backoffice ya no viaja a un origen que no sea el backend. Puede que veas desaparecer peticiones con `Authorization` hacia hosts externos: es intencionado. |
| `SEC-BACKOFFICE-011` | verified | Los documentos con URL de otro host ya no se enlazan ni se abren desde el backoffice. |
| `SEC-BACKOFFICE-008` | verified | Un 401 inesperado cierra la sesion y lleva a `/login`. **Los 401 de `/auth/login`, `/auth/google`, `/auth/refresh` y `/auth/logout` estan excluidos** a proposito; si cambias los codigos de esos endpoints, avisame. |
| `SEC-BACKOFFICE-017` | verified | Retirado un mecanismo de overrides de estado de mediacion que vivia en localStorage. |
| `SEC-BACKOFFICE-018` | verified | Login, recuperacion y activacion ya **no muestran el mensaje del servidor**. Sigo leyendolo para decidir el desvio del captador sin verificar: **manten el texto que menciona verificar el correo** o ese flujo se rompe. |
| `SEC-BACKOFFICE-020` | verified | Marcador de correo neutro en el acceso del personal. |
| `SEC-BACKOFFICE-CF-009` | verified | docker-compose exige las contrasenas en vez de caer a valores por defecto. |
| `SEC-BACKOFFICE-CF-011` | verified | Los `.log` del servidor de desarrollo dejan de estar versionados. |

**Lo mas importante de esa lista para ti:** en `SEC-BACKOFFICE-018` el frontend todavia depende de que el mensaje de error de `/auth/backoffice/login` contenga algo como "verificar correo" cuando un captador no ha confirmado su cuenta. Es lo unico que dispara el desvio a `/registro-captador`. Si cambias ese texto o lo conviertes en un codigo, dimelo y ajusto el cliente.

## Un dato que necesito de vuelta

Para cerrar `SEC-BACKOFFICE-015` (Content-Security-Policy) necesito el **origen real de la API en produccion**. RESUELTO: el usuario confirmo `https://api.repuestop.cl` en produccion y `https://api-dev.repuestop.cl` en desarrollo. Ambos estan en `connect-src`, porque las cabeceras de `vercel.json` se aplican igual a produccion y a los preview deployments. La CSP quedo verificada en ejecucion sobre el build de produccion. **Nada pendiente de tu lado aqui.**

## Como devolver los resultados

Si usas el mismo Audit Kit, lo natural es que abras tu propia corrida para la plataforma del backend y que estos hallazgos entren ahi como registros tuyos, con tu evidencia. Para los que cierres contra mis registros `unverified`, basta con que me digas el id y el resultado (`pass` o `fail`) y yo actualizo `findings.jsonl` de la corrida del backoffice, que es donde hoy consta que la cobertura esta incompleta.

Recordatorio del protocolo, por si acaso: un control que no puedas ejecutar va `unverified` **con la causa**, nunca en silencio. La cobertura incompleta tiene que verse.