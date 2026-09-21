# Reporte de auditoria — seguridad / plataforma `backoffice`

- **Corrida:** `2026-09-21-security-backoffice`
- **Agente:** `security` (AppSec senior) · **Profundidad:** `advanced` · **Modo:** auditoria, sin modificar codigo
- **Repositorio:** `C:/ProyectoRepuestop/backoffice_sistema` · rama `dev` · 76 commits
- **Auditorias previas:** ninguna. Esta es la primera corrida del kit sobre este repositorio.

## Alcance y limite duro

El repositorio contiene **solo el frontend** (`backoffice/frontend`, Vite + React + TypeScript, 162 archivos, 36.070 LOC). El servicio que implementa `/api/v1/**` **no forma parte de este repositorio**. En consecuencia, la autorizacion efectiva del lado servidor de los 135 endpoints consumidos **no pudo ejecutarse** y queda registrada como `unverified` con su causa, endpoint por endpoint. Esa es la razon del puntaje: no es que los controles fallen, es que la mayor parte no son observables desde aqui — y en una consola administrativa esa ceguera es en si misma el hallazgo.

Dos correcciones al encargo original:

1. **`X-Backoffice-Api-Key` no existe en el arbol de trabajo.** Grep sobre todo el repositorio: cero coincidencias. Si aparece en el **historial de git**, junto con la clave en claro y el mapa de `/api/v1/external/backoffice/**`. Ver `SEC-BACKOFFICE-012`.
2. **No hay validacion de precio o cantidad de producto en este repositorio** (eso vive en `market`). Lo que si vive solo aqui, y mueve dinero real, es la **nomina de pagos BCI**. Ver `SEC-BACKOFFICE-013`.

## Motor de deteccion

| Herramienta | Resultado |
|---|---|
| `scan` | TypeScript 162 archivos / 36.070 LOC · npm · React · sin CI · sin IaC · area sugerida `backoffice` |
| `toolscan` | 61 `pre_findings` en `needs-triage` (47 pip-audit, 12 osv-scanner, 2 semgrep) |
| gitleaks (arbol de trabajo) | `[]` |
| gitleaks (historial, 76 commits) | **3 coincidencias**, todas en `PLAN_BACKOFFICE_POLLING.md` |
| `npm audit` (ejecutado aparte: el manifiesto esta anidado) | 7 paquetes vulnerables (5 high, 2 moderate) |

Triaje de los pre-hallazgos: los **47 de pip-audit se descartan** (`na`, `SEC-BACKOFFICE-022`) — el repositorio no tiene Python; provienen del entorno de la maquina. El **`dangerouslySetInnerHTML` de semgrep es falso positivo** verificado contra el codigo (`SEC-BACKOFFICE-021`). El **`missing-user` del Dockerfile se confirma y se amplia** (`SEC-BACKOFFICE-016`). Los 12 de osv-scanner se consolidan con npm audit.

## Cobertura del barrido

**250 unidades enumeradas antes de evaluar. 274 registros en `findings.jsonl`** (250 de inventario + 24 hallazgos evaluados a mano que los atraviesan).

| Categoria | Unidades |
|---|---|
| A. Endpoints unicos del backend | 135 |
| A2. Sinks `fetch` fuera de `apiClient` | 4 |
| B. Rutas de la SPA | 38 |
| C. Puntos de manejo de token / sesion | 16 |
| D. Sinks de render o navegacion con dato de terceros | 42 |
| E. Paquetes con vulnerabilidad conocida | 7 |
| F. Artefactos de configuracion | 8 |
| **Total** | **250** |

| Resultado | Registros |
|---|---|
| `pass` | 52 |
| `partial` | 39 |
| `fail` | 43 |
| `unverified` | 139 |
| `na` | 1 |
| **Total** | **274** |

**Puntaje seguridad / `backoffice` = 26.2 / 100** (umbral exigido: 95). `pass`=100, `partial`=50, `fail`/`unverified`=0, `na` excluido; 273 controles puntuables.

> **La cobertura NO es completa y no debe declararse como tal.** 139 controles quedaron `unverified`, los 139 con causa declarada en el campo `unverified_cause`. 135 de ellos son la autorizacion de servidor de cada endpoint. Ademas, **2 Critical y 80 High abiertos vetan produccion** mientras no esten `verified`.

## Hallazgos abiertos (evaluados a mano, con evidencia y reproduccion)

| ID | Sev | Confianza | Titulo |
|---|---|---|---|
| `SEC-BACKOFFICE-001` | critical | medium | La API de permisos se ejerce desde una pantalla que no exige SUPER_ADMIN |
| `SEC-BACKOFFICE-004` | critical | high | Activacion de empleado del backoffice con codigo numerico de 6 digitos y sin limite de intentos en cliente |
| `SEC-BACKOFFICE-002` | high | high | hasBackofficePermission concede todas las areas a ADMIN cuando /auth/me no devuelve permissions |
| `SEC-BACKOFFICE-003` | high | high | Las guardas de rol son exclusivamente de cliente: ocultan la UI, no protegen la API |
| `SEC-BACKOFFICE-005` | high | high | Recuperacion de contrasena con codigo de 6 digitos, realm elegido por el cliente y minimo de 6 caracteres |
| `SEC-BACKOFFICE-006` | high | high | El token de acceso del backoffice se guarda en localStorage/sessionStorage, legible por cualquier script |
| `SEC-BACKOFFICE-007` | high | high | El cierre de sesion es solo local: el token nunca se revoca en el servidor |
| `SEC-BACKOFFICE-010` | high | medium | El token del backoffice se envia a cualquier origen que venga en la URL de un documento |
| `SEC-BACKOFFICE-012` | high | high | La clave X-Backoffice-Api-Key y su superficie privilegiada quedaron en el historial de git |
| `SEC-BACKOFFICE-013` | high | high | La nomina de pagos BCI se construye entera en el navegador y el servidor nunca la valida |
| `SEC-BACKOFFICE-008` | medium | high | Sin interceptor de respuesta: un 401 no termina la sesion ni redirige al login |
| `SEC-BACKOFFICE-009` | medium | high | La separacion entre acceso de personal y de captador se aplica despues de emitir el token |
| `SEC-BACKOFFICE-011` | medium | medium | Redireccion abierta al fallar la vista previa de un documento |
| `SEC-BACKOFFICE-015` | medium | high | Sin Content-Security-Policy ni HSTS en las cabeceras publicadas por Vercel |
| `SEC-BACKOFFICE-016` | medium | high | El Dockerfile arranca el servidor de desarrollo de Vite escuchando en 0.0.0.0 y como root |
| `SEC-BACKOFFICE-017` | low | high | Estado privilegiado de la UI leido desde localStorage sin ninguna via de activacion en la interfaz |
| `SEC-BACKOFFICE-018` | low | high | Mensajes de error del servidor mostrados sin filtrar en los formularios de acceso |
| `SEC-BACKOFFICE-020` | info | high | El marcador de posicion del campo de acceso revela el patron de correo de las cuentas administrativas |

### SEC-BACKOFFICE-001 — La API de permisos se ejerce desde una pantalla que no exige SUPER_ADMIN

`fail` · severidad **critical** · confianza **medium** · control `OWASP-API-2023-API5-BFLA` · esfuerzo `M`

El modulo @/api/permissions expone la gestion completa de roles del backoffice (listar usuarios, buscar por correo, PUT de permisos, invitar empleado, borrar cuenta). En el enrutador solo /configuracion esta protegido por RequireSuperAdmin. Sin embargo SupportTicketDetailModal.tsx --montado bajo RequireArea area="SOPORTE"-- importa ese mismo modulo y llama listPermissionUsers() para poblar el desplegable de asignacion. Es decir: un operador de SOPORTE ya consume GET /backoffice/permissions/users con parametros que el cliente elige, y tiene en su bundle las funciones updateUserPermissions(), inviteEmployee() y deleteUserAccount() listas para invocar desde la consola del navegador. La unica barrera observable en este repositorio es la guarda de ruta del frontend, que no protege la API.

**Evidencia**
- `src/modules/support/SupportTicketDetailModal.tsx:16`
- `src/modules/support/SupportTicketDetailModal.tsx:337`
- `src/App.tsx:137`
- `src/App.tsx:125`
- `src/api/permissions.ts:49`
- `src/api/permissions.ts:54`
- `src/api/permissions.ts:81`

**Reproduccion**
1. Iniciar sesion con una cuenta cuyo unico permiso sea area SOPORTE slot OPERADOR.
2. Navegar a /soporte y abrir el detalle de cualquier ticket; desplegar el selector de asignado.
3. Observar en la pestana Network la peticion GET /api/v1/backoffice/permissions/users?area=SOPORTE&slot=OPERADOR&page=0&size=100 con respuesta 2xx.
4. En la consola del navegador, sin cambiar de pantalla, invocar el mismo cliente axios contra PUT /api/v1/backoffice/permissions/users/<propio-id> con body {"permissions":[{"area":"ADMINISTRACION_CONTABLE","slot":"QA"}]}.
5. Si la respuesta es 2xx, el operador se auto-concedio un area que la UI nunca le ofrece: escalada vertical confirmada.

**Impacto.** Un operador de soporte puede enumerar la plantilla completa del backoffice con sus areas y, si el backend no revalida el rol, concederse ADMINISTRACION_CONTABLE (retiros, pagos, gastos) o invitar una cuenta nueva con permisos arbitrarios.

**Recomendacion.** Exigir SUPER_ADMIN en el servidor para todo /api/v1/backoffice/permissions/** mediante una regla central (no por endpoint). En el frontend, separar el listado de operadores de soporte en un endpoint de solo lectura de minimo privilegio (por ejemplo GET /support/assignees) para que la pantalla de soporte no cargue la API de permisos.

**Verificacion**
- Negativa: con token de SOPORTE/OPERADOR, PUT /api/v1/backoffice/permissions/users/{id} responde 403.
- Negativa: con token de SOPORTE/OPERADOR, GET /api/v1/backoffice/permissions/users responde 403.
- Positiva: con token SUPER_ADMIN ambas responden 2xx y la pantalla /configuracion sigue operando.
- Positiva: el desplegable de asignado en /soporte sigue poblandose desde el endpoint de minimo privilegio.

### SEC-BACKOFFICE-004 — Activacion de empleado del backoffice con codigo numerico de 6 digitos y sin limite de intentos en cliente

`fail` · severidad **critical** · confianza **high** · control `ASVS-v5.0.0-2.1.1` · esfuerzo `M`

POST /auth/backoffice/activate es la via por la que una persona invitada obtiene credenciales del backoffice. Se alcanza desde la ruta publica /activar-empleado, sin sesion previa, y acepta {email, code, newPassword}. El formulario restringe code a 6 caracteres numericos (maxLength=6, inputMode=numeric), es decir un espacio de 10^6. El cliente no implementa ningun retardo, contador de intentos ni captcha, y el correo del invitado se pre-rellena desde el parametro de URL, de modo que un atacante que conoce o adivina el correo corporativo solo debe recorrer el espacio de codigos. Responder si el codigo es correcto entrega directamente el control de una cuenta del backoffice con los permisos que llevaba la invitacion. Esta es la respuesta concreta a como se obtiene un rol privilegiado.

**Evidencia**
- `src/pages/ActivateEmployeePage.tsx:22`
- `src/pages/ActivateEmployeePage.tsx:34`
- `src/pages/ActivateEmployeePage.tsx:8`
- `src/App.tsx:112`
- `src/api/permissions.ts:54`

**Reproduccion**
1. Desde /configuracion (SUPER_ADMIN) invitar a un empleado con permisos de ADMINISTRACION_CONTABLE; queda en estado PENDIENTE.
2. Sin sesion, abrir /activar-empleado?email=<correo-del-invitado>.
3. Automatizar POST /api/v1/auth/backoffice/activate con {email, code, newPassword} recorriendo code de 000000 a 999999.
4. Medir cuantos intentos acepta el servidor antes de bloquear; si no bloquea, el recorrido completo es viable.
5. Con el codigo acertado se fija la contrasena y se inicia sesion con los permisos de la invitacion.

**Impacto.** Toma de control de una cuenta del backoffice antes de que su titular la active, con los permisos de la invitacion.

**Recomendacion.** Sustituir el codigo de 6 digitos por un token de un solo uso de alta entropia enviado por correo, con caducidad corta, invalidacion al primer uso e invalidacion de la invitacion tras N intentos fallidos. Aplicar limite de tasa por correo y por IP en el servidor. Mientras exista el codigo corto, no permitir que el correo se prerrellene desde la URL.

**Verificacion**
- Negativa: tras 5 codigos incorrectos para el mismo correo, la invitacion queda invalidada y responde 429/410.
- Negativa: un token ya usado responde 410 en un segundo intento.
- Positiva: el invitado legitimo activa su cuenta al primer intento con el enlace recibido.

### SEC-BACKOFFICE-002 — hasBackofficePermission concede todas las areas a ADMIN cuando /auth/me no devuelve permissions

`fail` · severidad **high** · confianza **high** · control `OWASP-API-2023-API5-BFLA` · esfuerzo `S`

hasBackofficePermission() solo consulta la lista user.permissions si es un array. Si /auth/me responde sin ese campo --el mapeo mapCurrentUser() de AuthContext ni siquiera lo construye cuando la respuesta viene en la forma BackofficeUserResponse {id,nombre,email,rol}-- cae a la linea 26 y devuelve true para cualquier area si el rol es ADMIN. La forma sin permissions es la que el propio codigo trata como caso normal del login de backoffice, asi que el fallback no es un borde teorico: es la rama por defecto.

**Evidencia**
- `src/hooks/usePermissions.ts:20`
- `src/hooks/usePermissions.ts:26`
- `src/context/AuthContext.tsx:63`
- `src/context/AuthContext.tsx:71`
- `src/types/auth.ts:23`

**Reproduccion**
1. Autenticarse con una cuenta de rol ADMIN a la que /configuracion le asigno solo el area SOPORTE.
2. Comprobar la respuesta de GET /api/v1/auth/me: si es {id,nombre,email,rol} sin campo permissions, mapCurrentUser produce un usuario sin permissions.
3. Navegar a /administracion y a /confianza: RequireArea llama hasBackofficePermission, que cae a la linea 26 y devuelve true.
4. Ambas areas se renderizan y sus consultas salen hacia el backend pese a no estar asignadas.

**Impacto.** Un ADMIN limitado a un area accede a la UI de todas las areas, incluidas administracion contable (retiros, pagos a proveedores, gastos) y mediaciones. El alcance real del dano depende de si el backend revalida, lo que no puede comprobarse aqui.

**Recomendacion.** Tratar la ausencia de permissions como cero permisos (fail closed) y eliminar el fallback por rol. Hacer que /auth/me devuelva siempre el array permissions y que mapCurrentUser lo propague en ambas formas de respuesta. La decision de autorizacion debe ser siempre por permiso explicito, nunca por rol implicito.

**Verificacion**
- Negativa: usuario ADMIN sin permissions en /auth/me no puede montar /administracion ni /confianza.
- Positiva: usuario ADMIN con permissions=[{area:'SOPORTE',slot:'OPERADOR'}] monta /soporte y solo /soporte.
- Positiva: SUPER_ADMIN sigue accediendo a todo.

### SEC-BACKOFFICE-003 — Las guardas de rol son exclusivamente de cliente: ocultan la UI, no protegen la API

`partial` · severidad **high** · confianza **high** · control `ASVS-v5.0.0-1.2.5` · esfuerzo `L`

RequireAuth, RequireSuperAdmin, RequireArea, RequireCapturer y RequireApprovedCapturer deciden en el navegador a partir de un objeto de usuario que vive en memoria de React. Un atacante con una sesion valida de cualquier nivel no necesita vulnerar la guarda: el bundle ya contiene todos los modulos de @/api (incluidos administration, permissions, founders y mediations) y basta invocarlos desde la consola. Se marca partial y no fail porque las guardas cumplen correctamente su proposito de UI; lo que falta --el control equivalente del lado servidor-- no es observable en este repositorio.

**Evidencia**
- `src/App.tsx:37`
- `src/App.tsx:47`
- `src/App.tsx:61`
- `src/App.tsx:75`
- `src/App.tsx:84`

**Reproduccion**
1. Autenticarse con el rol de menor privilegio disponible (OPERATOR con area SOPORTE).
2. Abrir la consola del navegador en cualquier pantalla del backoffice.
3. Importar o alcanzar el cliente axios ya configurado con el header Authorization y lanzar GET /api/v1/administration/withdrawals.
4. Una respuesta 2xx demuestra que la unica barrera era la guarda de ruta.

**Impacto.** Sin control de funcion en el servidor, cualquier sesion autenticada alcanza cualquier operacion del backoffice.

**Recomendacion.** Replicar cada guarda como regla de autorizacion en el servidor y tratar el frontend unicamente como capa de presentacion. Anadir una prueba de integracion por area que compruebe 403 con un token de otra area.

**Verificacion**
- Negativa: token de area SOPORTE recibe 403 en /administration/**, /backoffice/permissions/** y /mediations/**.
- Positiva: token con el area correspondiente recibe 2xx en su propia area.

### SEC-BACKOFFICE-005 — Recuperacion de contrasena con codigo de 6 digitos, realm elegido por el cliente y minimo de 6 caracteres

`fail` · severidad **high** · confianza **high** · control `ASVS-v5.0.0-2.5.1` · esfuerzo `M`

El flujo de /recuperar-contrasena tiene tres defectos acumulados. Primero, el codigo de verificacion es numerico de 6 digitos sin ningun control de intentos en el cliente. Segundo, el campo rol ('BACKOFFICE' o 'CAPTADOR') lo decide el navegador a partir del parametro de URL ?type y se envia en el cuerpo de las tres peticiones: es el cliente quien declara sobre que dominio de identidades opera el restablecimiento. Tercero, la contrasena nueva solo exige 6 caracteres, mientras que la activacion de empleado exige 8; el minimo mas debil aplica a la consola administrativa.

**Evidencia**
- `src/pages/RecoverPasswordPage.tsx:14`
- `src/pages/RecoverPasswordPage.tsx:24`
- `src/pages/RecoverPasswordPage.tsx:30`
- `src/pages/RecoverPasswordPage.tsx:35`
- `src/pages/RecoverPasswordPage.tsx:37`
- `src/pages/RecoverPasswordPage.tsx:50`
- `src/pages/ActivateEmployeePage.tsx:18`

**Reproduccion**
1. Abrir /recuperar-contrasena (sin ?type) y solicitar codigo para un correo de backoffice: se envia rol='BACKOFFICE'.
2. Automatizar POST /api/v1/auth/recover-password/verify-code recorriendo los 10^6 codigos posibles para ese correo.
3. Comprobar si el servidor limita intentos; sin limite, el recorrido es viable.
4. Con el codigo valido, POST /api/v1/auth/recover-password/reset acepta newPassword de 6 caracteres.
5. Por separado, repetir el paso 1 alterando rol en el cuerpo para comprobar si el servidor lo toma del cliente o lo deriva de la identidad.

**Impacto.** Toma de control de cuentas del backoffice por fuerza bruta del codigo, y contrasenas administrativas de solo 6 caracteres. Si el servidor confia en el campo rol, ademas permite dirigir el restablecimiento al dominio de identidades equivocado.

**Recomendacion.** Token de un solo uso de alta entropia en el enlace de correo en lugar del codigo de 6 digitos; limite de tasa por correo e IP con invalidacion tras N fallos; derivar el dominio de identidad del propio token en el servidor y dejar de aceptar rol desde el cuerpo; unificar el minimo de contrasena en 12 caracteres para personal del backoffice.

**Verificacion**
- Negativa: tras 5 codigos incorrectos el codigo queda invalidado y responde 429/410.
- Negativa: enviar rol='BACKOFFICE' en un flujo iniciado como CAPTADOR no cambia el dominio afectado.
- Negativa: newPassword de 6 caracteres es rechazada para una cuenta de backoffice.
- Positiva: el flujo legitimo completo (enlace del correo, contrasena conforme) restablece el acceso.

### SEC-BACKOFFICE-006 — El token de acceso del backoffice se guarda en localStorage/sessionStorage, legible por cualquier script

`fail` · severidad **high** · confianza **high** · control `ASVS-v5.0.0-3.4.1` · esfuerzo `M`

El access token se persiste bajo la clave repuestop.backoffice.access-token en sessionStorage o, si el usuario marca 'mantener sesion', en localStorage --donde sobrevive al cierre del navegador sin caducidad propia--. Cualquier script que se ejecute en el origen lo lee con una sola linea. Para una consola administrativa este almacenamiento convierte cualquier ejecucion de script en la pagina (extension maliciosa, dependencia comprometida, XSS futuro) en robo directo de una sesion privilegiada. Ademas el token se lee desde dos sitios distintos (AuthContext y utils/documentUrls), lo que multiplica la superficie.

**Evidencia**
- `src/context/AuthContext.tsx:34`
- `src/context/AuthContext.tsx:88`
- `src/context/AuthContext.tsx:92`
- `src/utils/documentUrls.ts:15`

**Reproduccion**
1. Iniciar sesion en el backoffice marcando 'mantener sesion'.
2. En la consola del navegador ejecutar localStorage.getItem('repuestop.backoffice.access-token').
3. Se obtiene el JWT en claro, reutilizable desde cualquier cliente HTTP hasta su expiracion.

**Impacto.** Robo y reutilizacion de una sesion administrativa completa por cualquier script que corra en el origen.

**Recomendacion.** Emitir la sesion en una cookie HttpOnly, Secure, SameSite=Strict (el cliente ya envia withCredentials: true, asi que el cambio es menor del lado del navegador) y eliminar por completo la persistencia en Web Storage. Si por compatibilidad debe mantenerse un token en memoria, que viva solo en el contexto de React y nunca en localStorage.

**Verificacion**
- Negativa: tras iniciar sesion, localStorage y sessionStorage no contienen ningun token.
- Negativa: document.cookie no expone la cookie de sesion (HttpOnly).
- Positiva: recargar la pagina mantiene la sesion y las llamadas a /auth/me siguen respondiendo 2xx.

### SEC-BACKOFFICE-007 — El cierre de sesion es solo local: el token nunca se revoca en el servidor

`fail` · severidad **high** · confianza **high** · control `ASVS-v5.0.0-3.3.1` · esfuerzo `S`

logout() borra el token del almacenamiento y quita la cabecera del cliente axios, pero no invoca POST /auth/logout. La funcion login() de api/auth.ts que si lo haria esta definida y no se usa: AuthContext habla directamente con apiClient. El token sigue siendo valido en el servidor hasta su expiracion natural, asi que cualquier copia previamente extraida sobrevive al cierre de sesion. refresh() es ademas una funcion vacia, de modo que no existe rotacion ni revocacion en ningun punto del ciclo de vida de la sesion.

**Evidencia**
- `src/context/AuthContext.tsx:191`
- `src/context/AuthContext.tsx:201`
- `src/api/auth.ts:21`

**Reproduccion**
1. Iniciar sesion y copiar el valor de repuestop.backoffice.access-token.
2. Pulsar cerrar sesion en la aplicacion.
3. Desde curl, invocar GET /api/v1/auth/me con la cabecera Authorization: Bearer <token copiado>.
4. Una respuesta 2xx confirma que el cierre de sesion no revoco nada.

**Impacto.** Un token filtrado sigue sirviendo despues del cierre de sesion. Agrava el riesgo de los equipos compartidos y de cualquier fuga de token.

**Recomendacion.** Llamar a POST /auth/logout desde logout() y revocar el token en el servidor (lista de revocacion o sesion en servidor). Si se migra a cookie HttpOnly, el logout debe limpiarla desde el servidor.

**Verificacion**
- Negativa: tras cerrar sesion, el token anterior devuelve 401 en /auth/me.
- Positiva: el cierre de sesion redirige a /login y un nuevo inicio de sesion funciona con normalidad.

### SEC-BACKOFFICE-010 — El token del backoffice se envia a cualquier origen que venga en la URL de un documento

`fail` · severidad **high** · confianza **medium** · control `OWASP-API-2023-API7-SSRF` · esfuerzo `S`

downloadDocument(), previewDocument() y DocumentPreview hacen fetch(resolvedUrl, {headers: getAuthHeaders()}) sin comprobar que resolvedUrl apunte al backend. resolveDocumentUrl() devuelve la URL absoluta intacta cuando ya lo es (documentUrls.ts:75), de modo que un valor como https://atacante.tld/x pasa tal cual y la cabecera Authorization: Bearer <token de admin> viaja a ese host. El contraste es explicito dentro del propio repositorio: useAuthedImage si valida el origen contra API_ORIGIN antes de adjuntar el token (requiresBackofficeToken, useAuthedImage.ts:36-43); los tres sinks de documentos no. Las URLs llegan de registros que originan terceros: adjuntos de tickets de soporte (attachment.url), documentos de vendedores y evidencias de mediacion. Se marca confianza media porque no puede comprobarse desde este repositorio si el backend permite persistir una URL absoluta arbitraria en esos campos.

**Evidencia**
- `src/utils/documentUrls.ts:75`
- `src/utils/documentUrls.ts:108`
- `src/utils/documentUrls.ts:143`
- `src/components/shared/DocumentPreview.tsx:131`
- `src/hooks/useAuthedImage.ts:36`
- `src/modules/support/SupportTicketDetailModal.tsx:456`
- `src/modules/support/SupportTicketDetailModal.tsx:476`
- `src/components/validations/ValidationsPage.tsx:440`

**Reproduccion**
1. Conseguir que un registro de adjunto quede con url absoluta a un host controlado (por ejemplo creando un ticket de soporte cuyo adjunto persista una URL externa).
2. Iniciar sesion en el backoffice y abrir el detalle de ese ticket.
3. Pulsar la vista previa o la descarga del adjunto.
4. En el servidor controlado, observar la peticion entrante con la cabecera Authorization: Bearer <token del operador>.
5. Comparar con una foto de perfil externa, que pasa por useAuthedImage y llega sin cabecera de autorizacion.

**Impacto.** Exfiltracion del token de sesion de un operador del backoffice hacia un host de terceros con un solo clic.

**Recomendacion.** Reutilizar en documentUrls el mismo control que ya existe en useAuthedImage: adjuntar getAuthHeaders() solo cuando la URL sea relativa o su origen coincida con API_ORIGIN, y hacer la peticion anonima en cualquier otro caso. Mejor aun, centralizar la comprobacion en una unica funcion fetchConToken() usada por los cuatro sinks.

**Verificacion**
- Negativa: previewDocument('https://ejemplo-externo.tld/a.pdf') realiza la peticion sin cabecera Authorization.
- Negativa: lo mismo para downloadDocument y para DocumentPreview.
- Positiva: un documento servido por el backend configurado sigue descargandose y previsualizandose con token.

### SEC-BACKOFFICE-012 — La clave X-Backoffice-Api-Key y su superficie privilegiada quedaron en el historial de git

`fail` · severidad **high** · confianza **high** · control `ASVS-v5.0.0-14.3.2` · esfuerzo `L`

El documento PLAN_BACKOFFICE_POLLING.md, anadido en el commit 32bb1a0b (2026-06-26) y despues borrado del arbol de trabajo, sigue siendo recuperable del historial con git show. Contiene en claro el valor de REPUESTOP_BACKOFFICE_API_KEY (valor redactado en esta evidencia; se identifica por su ubicacion) y documenta la superficie externa privilegiada /api/v1/external/backoffice/**: listado y detalle de proveedores y verificaciones, y tres operaciones de escritura (aprobar verificacion, rechazar verificacion, cambiar estado de proveedor). Esa API se autentica con una unica cabecera estatica compartida, sin identidad de usuario ni rol: quien tenga la clave tiene todos los permisos de esa superficie. El nombre del valor sigue un patron de entorno y anio trivialmente extrapolable al de produccion. gitleaks sobre el arbol de trabajo devuelve vacio; sobre el historial (76 commits) marca tres coincidencias, todas en este archivo.

**Evidencia**
- `PLAN_BACKOFFICE_POLLING.md:17 (commit 32bb1a0b, archivo borrado; valor redactado)`
- `PLAN_BACKOFFICE_POLLING.md:464 (commit 32bb1a0b; cabecera en ejemplo curl)`
- `PLAN_BACKOFFICE_POLLING.md:39-41 (commit 32bb1a0b; operaciones de escritura)`
- `audit-runs/2026-09-21-security-backoffice/evidence/gitleaks.history.json`

**Reproduccion**
1. Clonar el repositorio.
2. Ejecutar: git show 32bb1a0b:PLAN_BACKOFFICE_POLLING.md
3. Localizar la linea 17 con la asignacion de REPUESTOP_BACKOFFICE_API_KEY y las lineas 464-483 con los ejemplos curl.
4. Contrastar con git log --all --oneline -- PLAN_BACKOFFICE_POLLING.md para confirmar que el borrado no elimino el contenido del historial.

**Impacto.** Quien acceda al repositorio obtiene una clave de integracion y el mapa completo de una API que aprueba y rechaza verificaciones de proveedores y cambia su estado, sin ningun control de autorizacion por actor.

**Recomendacion.** Rotar de inmediato REPUESTOP_BACKOFFICE_API_KEY en todos los entornos, sin reutilizar el patron de nombre. Purgar el archivo del historial (git filter-repo o equivalente) y forzar la reescritura coordinada. Sustituir la autenticacion por cabecera estatica compartida por credenciales por cliente con identidad, rotacion y registro de auditoria, y anadir autorizacion por operacion en /external/backoffice/**. Comprobar ademas el valor por defecto vacio de la configuracion (api-key: ${REPUESTOP_BACKOFFICE_API_KEY:}) para que un entorno sin la variable no acepte peticiones sin clave.

**Verificacion**
- Negativa: la clave anterior devuelve 401 contra /api/v1/external/backoffice/verificaciones.
- Negativa: gitleaks detect sobre el historial completo no devuelve coincidencias.
- Negativa: con la variable de entorno sin definir, el servicio rechaza toda peticion a /external/backoffice/** en vez de aceptarla con clave vacia.
- Positiva: la integracion legitima sigue operando con la credencial rotada.

### SEC-BACKOFFICE-013 — La nomina de pagos BCI se construye entera en el navegador y el servidor nunca la valida

`fail` · severidad **high** · confianza **high** · control `OWASP-API-2023-API6-BusinessFlows` · esfuerzo `L`

buildBciNominaWorkbook() arma en el cliente el archivo Nomina_Pago_en_Linea.xlsx que el operador sube despues a la banca en linea: numero de cuenta de destino, codigo de banco, RUT del beneficiario, nombre y monto de transferencia se escriben celda por celda desde objetos que viven en memoria del navegador. La cuenta de cargo se toma de la configuracion y se inyecta en la columna 1 en el momento de exportar. El resultado se descarga con downloadFile() sin pasar por el servidor: no hay firma, ni hash, ni registro de que nomina se genero. Esta es la respuesta concreta a si hay validacion de importes que viva solo en el cliente: la pieza que mueve el dinero se produce integramente aqui.

**Evidencia**
- `src/modules/administration/bciNominaExport.ts:133`
- `src/modules/administration/bciNominaExport.ts:161`
- `src/modules/administration/bciNominaExport.ts:167`
- `src/modules/administration/PagoProveedoresPage.tsx:276`
- `src/modules/administration/PagoCaptadoresPage.tsx:133`
- `src/modules/administration/utils.ts:262`

**Reproduccion**
1. Entrar a /administracion/pago-proveedores con un ciclo que tenga retiros pendientes.
2. En la consola del navegador, interceptar o modificar el arreglo pendingWithdrawals alterando numeroCuenta y monto de una fila.
3. Pulsar exportar a Excel.
4. Abrir el archivo descargado: las columnas 2 (cuenta destino) y 7 (monto) reflejan los valores alterados.
5. Comprobar que ninguna peticion sale hacia el backend durante la exportacion: el servidor no tiene constancia del archivo generado.

**Impacto.** Desvio de fondos: cualquier ejecucion de codigo en la pagina del operador (extension, dependencia comprometida, XSS futuro) altera destinatarios e importes de una nomina bancaria real sin dejar rastro en el servidor. Tampoco existe pista de auditoria para conciliar despues.

**Recomendacion.** Generar la nomina en el servidor a partir de los retiros aprobados en base de datos y entregarla como descarga firmada, con un identificador de nomina persistido. El cliente solo debe pedir la exportacion y recibir el archivo. Registrar en la bitacora quien exporto que nomina, con que importe total y que retiros incluyo, y conciliar el total contra la suma de los retiros aprobados.

**Verificacion**
- Negativa: alterar los datos en memoria del navegador no cambia el contenido del archivo recibido del servidor.
- Negativa: no existe ninguna ruta de codigo que escriba importes o cuentas de destino en el cliente.
- Positiva: la exportacion legitima produce el mismo archivo que hoy (columnas, colores y hojas de la plantilla BCI) y queda registrada en la bitacora.

### SEC-BACKOFFICE-008 — Sin interceptor de respuesta: un 401 no termina la sesion ni redirige al login

`fail` · severidad **medium** · confianza **high** · control `ASVS-v5.0.0-3.3.2` · esfuerzo `S`

El cliente axios no define ningun interceptor (grep de 'interceptors' sobre src/ no devuelve nada). Cuando el token caduca o es revocado, cada consulta falla de forma aislada y la aplicacion sigue mostrandose como autenticada con datos obsoletos en cache de react-query, sin limpiar el estado ni redirigir a /login. Unido a que refresh() esta vacio, no existe renovacion de sesion de ningun tipo.

**Evidencia**
- `src/api/client.ts:73`
- `src/context/AuthContext.tsx:201`

**Reproduccion**
1. Iniciar sesion en el backoffice.
2. Sustituir el valor de repuestop.backoffice.access-token por una cadena invalida sin recargar.
3. Navegar entre pantallas: las peticiones devuelven 401 pero la UI sigue en estado autenticado, con los datos ya cacheados visibles.

**Impacto.** Sesion aparentemente viva con datos obsoletos; el operador puede tomar decisiones sobre informacion que ya no puede refrescar.

**Recomendacion.** Anadir un interceptor de respuesta en apiClient que ante 401 limpie el estado de autenticacion, invalide la cache de react-query y redirija a /login.

**Verificacion**
- Negativa: con token invalido, la primera peticion 401 redirige a /login y vacia la cache.
- Positiva: un 401 puntual de un endpoint de negocio legitimo no expulsa al usuario si el token sigue siendo valido.

### SEC-BACKOFFICE-009 — La separacion entre acceso de personal y de captador se aplica despues de emitir el token

`fail` · severidad **medium** · confianza **high** · control `ASVS-v5.0.0-2.2.1` · esfuerzo `S`

LoginPage autentica primero y comprueba el rol despues: si el rol no corresponde a la pestana elegida, llama a logout() y lanza un error. Como logout() es puramente local (ver SEC-BACKOFFICE-007), el token ya fue emitido por el servidor y sigue siendo valido; lo unico que ocurre es que el navegador lo descarta. El contexto de acceso (loginContext) viaja ademas en el cuerpo de la peticion, elegido por el cliente.

**Evidencia**
- `src/pages/LoginPage.tsx:234`
- `src/pages/LoginPage.tsx:238`
- `src/pages/LoginPage.tsx:268`
- `src/pages/LoginPage.tsx:272`
- `src/context/AuthContext.tsx:143`
- `src/context/AuthContext.tsx:191`

**Reproduccion**
1. Abrir /login sin parametros (pestana 'Personal de la empresa').
2. Autenticarse con credenciales validas de un usuario CAPTADOR.
3. Observar en Network que POST /api/v1/auth/backoffice/login responde 2xx y entrega un token antes de que la UI muestre el mensaje de rechazo.
4. Capturar ese token de la respuesta y reutilizarlo contra /api/v1/auth/me.

**Impacto.** Un captador obtiene un token emitido por la ruta de login del backoffice; su alcance real depende de si el servidor diferencia los contextos.

**Recomendacion.** Que /auth/backoffice/login rechace en el servidor las identidades que no sean personal, devolviendo 403 sin emitir token. El cliente no debe decidir el contexto de acceso.

**Verificacion**
- Negativa: credenciales de CAPTADOR contra /auth/backoffice/login devuelven 403 y ningun token.
- Positiva: credenciales de personal contra la misma ruta devuelven token y usuario.

### SEC-BACKOFFICE-011 — Redireccion abierta al fallar la vista previa de un documento

`fail` · severidad **medium** · confianza **medium** · control `ASVS-v5.0.0-5.1.5` · esfuerzo `S`

Si la descarga autenticada falla, previewDocument() abre window.open(resolvedUrl, '_blank') con la URL sin validar. Un valor externo o un esquema inesperado se abre en una pestana nueva con la marca de la consola administrativa detras. Los tres modales de mediacion usan ademas resolveDocumentUrl(url) directamente como href de un enlace, sin restringir origen.

**Evidencia**
- `src/utils/documentUrls.ts:166`
- `src/components/mediations/modals/BlockedAccountHistoryModal.tsx:50`
- `src/components/mediations/modals/ResolvedCaseTimelineModal.tsx:50`
- `src/components/mediations/modals/ResolvedCaseSummaryModal.tsx:89`

**Reproduccion**
1. Provocar que un registro de documento tenga una URL absoluta externa que responda 404 o error de CORS.
2. Pulsar la vista previa del documento en el backoffice.
3. La rama catch abre esa URL externa en una pestana nueva sin ninguna advertencia.

**Impacto.** Phishing con la confianza de la consola administrativa detras; encadenable con la fuga de token de SEC-BACKOFFICE-010.

**Recomendacion.** Validar en resolveDocumentUrl que el origen resultante sea API_ORIGIN o una lista blanca explicita; ante cualquier otro origen, mostrar un error en vez de navegar. Mantener rel=noreferrer en los enlaces.

**Verificacion**
- Negativa: una URL de documento con origen no permitido no abre pestana y muestra error.
- Positiva: un documento del backend configurado sigue abriendose en pestana nueva.

### SEC-BACKOFFICE-015 — Sin Content-Security-Policy ni HSTS en las cabeceras publicadas por Vercel

`fail` · severidad **medium** · confianza **high** · control `ASVS-v5.0.0-14.4.3` · esfuerzo `M`

vercel.json define X-Frame-Options, X-Content-Type-Options, Referrer-Policy y Permissions-Policy, pero no define Content-Security-Policy ni Strict-Transport-Security. Sin CSP, la consola administrativa no tiene ninguna barrera de contencion frente a la ejecucion de script de terceros --precisamente el escenario que convierte el token de localStorage (SEC-BACKOFFICE-006) en robo de sesion--. Sin HSTS, la primera visita por HTTP queda expuesta a degradacion. Incluye ademas X-XSS-Protection, cabecera obsoleta cuyo filtro llego a introducir vulnerabilidades y que los navegadores actuales ignoran.

**Evidencia**
- `vercel.json:14`
- `vercel.json:34`

**Reproduccion**
1. Desplegar y ejecutar: curl -I https://<dominio-del-backoffice>/
2. Comprobar que no aparecen las cabeceras Content-Security-Policy ni Strict-Transport-Security.
3. Comprobar que si aparece X-XSS-Protection: 1; mode=block.

**Impacto.** Ninguna contencion frente a script inyectado en la consola de mayor privilegio; sin forzado de HTTPS.

**Recomendacion.** Anadir Strict-Transport-Security: max-age=31536000; includeSubDomains y una CSP restrictiva (default-src 'self'; connect-src 'self' <origen de la API>; img-src 'self' data: blob: <origen de la API>; frame-ancestors 'none'; object-src 'none'; base-uri 'none'). Sustituir X-XSS-Protection por el valor 0 o retirarla. Nota: la pagina de login inyecta estilos con una etiqueta <style> en linea (src/pages/LoginPage.tsx:287), asi que la CSP debe contemplar style-src o moverse ese bloque a la hoja de estilos.

**Verificacion**
- Negativa: un script de origen no permitido es bloqueado por la CSP y queda registrado en la consola.
- Positiva: la aplicacion carga completa (estilos, imagenes del backend, blobs de documentos) sin violaciones de CSP.
- Positiva: curl -I muestra Strict-Transport-Security.

### SEC-BACKOFFICE-016 — El Dockerfile arranca el servidor de desarrollo de Vite escuchando en 0.0.0.0 y como root

`fail` · severidad **medium** · confianza **high** · control `ASVS-v5.0.0-14.1.1` · esfuerzo `S`

La imagen ejecuta npm run dev -- --host 0.0.0.0 y expone el puerto 5173, sin instruccion USER, de modo que el proceso corre como root. Es el servidor de desarrollo de Vite: sin las protecciones de una build de produccion, con HMR abierto y sirviendo los fuentes. El .dockerignore excluye node_modules, dist, *.log y .DS_Store, pero no .env, asi que el COPY . . arrastra a la imagen cualquier fichero de entorno local. Corresponde al hallazgo pre-cargado de semgrep dockerfile.security.missing-user, verificado contra el codigo y ampliado.

**Evidencia**
- `backoffice/frontend/Dockerfile:1`
- `backoffice/frontend/Dockerfile:12`
- `backoffice/frontend/.dockerignore:1`

**Reproduccion**
1. Construir la imagen: docker build -t bo backoffice/frontend
2. Ejecutarla: docker run -p 5173:5173 bo
3. Ejecutar docker exec <id> id y comprobar uid=0(root).
4. Comprobar que el servicio publicado es el servidor de desarrollo de Vite y no una build estatica.

**Impacto.** Si la imagen llega a un entorno accesible, publica el servidor de desarrollo con privilegios de root y puede contener un .env local.

**Recomendacion.** Build multietapa: compilar con npm run build y servir dist con un servidor estatico minimo bajo un usuario sin privilegios (USER node o un uid dedicado). Anadir .env y .env.* al .dockerignore. Si la imagen es solo para desarrollo local, dejarlo explicito en el nombre del fichero (Dockerfile.dev) y en el README.

**Verificacion**
- Negativa: docker exec <id> id no devuelve uid=0.
- Negativa: la imagen no contiene ningun fichero .env (docker run --rm bo ls -a).
- Positiva: la aplicacion servida desde la imagen carga y opera igual que el despliegue de Vercel.

### SEC-BACKOFFICE-017 — Estado privilegiado de la UI leido desde localStorage sin ninguna via de activacion en la interfaz

`fail` · severidad **low** · confianza **high** · control `ASVS-v5.0.0-7.1.1` · esfuerzo `S`

useManualMediationAdminMode() lee la bandera repuestop.manual-mediation-admin-mode de localStorage y, cuando vale '1', aplica los overrides de estado de mediacion guardados en repuestop.manual-mediation-status-overrides. Ninguna de las dos funciones de escritura (setAdminMode, setOverride) tiene invocador en el codigo: el mecanismo solo se activa editando localStorage a mano. El efecto es exclusivamente de presentacion --no viaja a ninguna peticion-- pero altera el estado de mediacion que se muestra en el listado de vendedores y en su ficha, que es justo la informacion sobre la que se decide suspender a un vendedor.

**Evidencia**
- `src/utils/manualMediationAdminMode.ts:10`
- `src/utils/manualMediationStatus.ts:36`
- `src/components/sellers/SellersPage.tsx:259`
- `src/components/sellers/SellerProfileModal.tsx:559`
- `src/components/sellers/SellerActiveMediationsModal.tsx:44`

**Reproduccion**
1. Iniciar sesion y abrir /confianza/sellers.
2. En la consola: localStorage.setItem('repuestop.manual-mediation-admin-mode','1') y localStorage.setItem('repuestop.manual-mediation-status-overrides', JSON.stringify({<idMediacion>:'RESUELTA'})).
3. Recargar: la mediacion aparece con el estado forzado en el listado y en la ficha del vendedor.
4. Comprobar en Network que no sale ninguna peticion: el cambio es solo visual.

**Impacto.** Estado de mediacion falseado en pantalla; riesgo de decisiones sobre informacion incorrecta. Sin efecto en el servidor.

**Recomendacion.** Retirar el mecanismo: no tiene via de activacion en la UI y solo puede desincronizar la vista de la verdad del servidor. Si se necesita para depuracion, limitarlo a builds de desarrollo con import.meta.env.DEV.

**Verificacion**
- Negativa: con las claves de localStorage puestas, el estado mostrado sigue siendo el del servidor.
- Positiva: el listado de vendedores y la ficha muestran los estados de mediacion reales.

### SEC-BACKOFFICE-018 — Mensajes de error del servidor mostrados sin filtrar en los formularios de acceso

`fail` · severidad **low** · confianza **high** · control `ASVS-v5.0.0-8.3.4` · esfuerzo `S`

extractErrorMessage() en LoginPage y message() en RecoverPasswordPage devuelven error.response.data.message tal cual y lo pintan en pantalla, igual que ActivateEmployeePage y CapturerAccountPage. Cualquier detalle que el backend incluya en ese campo --distincion entre usuario inexistente y contrasena incorrecta, estado de la cuenta, detalle interno-- llega intacto a una pantalla sin autenticar. El cliente no puede garantizar que el servidor no filtre; lo que si es responsabilidad del cliente es no propagarlo a ciegas.

**Evidencia**
- `src/pages/LoginPage.tsx:8`
- `src/pages/LoginPage.tsx:245`
- `src/pages/RecoverPasswordPage.tsx:6`
- `src/pages/ActivateEmployeePage.tsx:25`
- `src/pages/CapturerAccountPage.tsx:64`

**Reproduccion**
1. Enviar el formulario de /login con un correo inexistente y anotar el mensaje mostrado.
2. Repetir con un correo existente y contrasena incorrecta.
3. Si los mensajes difieren, la pantalla permite enumerar cuentas validas del backoffice.

**Impacto.** Enumeracion de cuentas del backoffice y posible filtracion de detalle interno en pantallas publicas.

**Recomendacion.** Mostrar un mensaje generico y constante en los flujos de autenticacion y recuperacion, reservando el detalle del servidor para los errores de negocio ya autenticados. Alinearlo con una respuesta de tiempo constante en el servidor.

**Verificacion**
- Negativa: correo inexistente y contrasena incorrecta producen el mismo mensaje.
- Positiva: los errores de negocio dentro de la sesion siguen siendo especificos y utiles.

### SEC-BACKOFFICE-020 — El marcador de posicion del campo de acceso revela el patron de correo de las cuentas administrativas

`fail` · severidad **info** · confianza **high** · control `ASVS-v5.0.0-8.3.1` · esfuerzo `S`

El campo de correo de /login usa como marcador de posicion admin@repuestop.com cuando la pestana activa es 'Personal de la empresa'. No es una credencial ni un identificador interno, pero sugiere el formato de las cuentas administrativas a cualquier visitante sin sesion, lo que reduce el trabajo previo de un ataque de enumeracion o de fuerza bruta sobre los flujos de SEC-BACKOFFICE-004 y SEC-BACKOFFICE-005.

**Evidencia**
- `src/pages/LoginPage.tsx:497`

**Reproduccion**
1. Abrir /login sin sesion con la pestana 'Personal de la empresa' activa.
2. Leer el marcador de posicion del campo de correo.

**Impacto.** Pista gratuita sobre el formato de las cuentas del backoffice.

**Recomendacion.** Usar un marcador de posicion neutro, por ejemplo 'correo@empresa.cl', como ya hace PermissionsConfigPage.tsx:300.

**Verificacion**
- Negativa: el marcador de posicion ya no contiene un nombre de cuenta administrativa plausible.

## Controles que pasan (no todo esta mal)

- **`SEC-BACKOFFICE-019` — El bundle publicado no contiene secretos, claves ni source maps**  
  Barrido del bundle de produccion (dist/assets/index-B46oYQWt.js, 2,1 MB) buscando claves de API, JWT, tokens de proveedor y RUT embebidos: sin coincidencias. No hay source maps publicados ni comentario sourceMappingURL. Las unicas variables de entorno del cliente son VITE_API_URL y VITE_GOOGLE_CLIEN...
- **`SEC-BACKOFFICE-021` — Triaje del dangerouslySetInnerHTML de UiIcon: no alcanzable por datos de terceros**  
  semgrep marco react-dangerouslysetinnerhtml en UiIcon.tsx:86. Verificado contra el codigo: el valor inyectado es icons[name], una consulta a un mapa de literales declarado dentro del propio componente con fragmentos de <path> de iconos. El parametro name es solo la clave de consulta; ninguna cadena ...
- **`SEC-BACKOFFICE-022` — Los 47 hallazgos de pip-audit no corresponden a este proyecto**  
  toolscan devolvio 47 pre_findings de pip-audit (pillow, pip, setuptools). El repositorio no contiene ningun requirements.txt, pyproject.toml, Pipfile ni codigo Python: es un unico paquete npm con frontend TypeScript. Esos hallazgos provienen del entorno de Python de la maquina que ejecuto el escaner...

## Lo que no se pudo verificar, y por que

- **Autorizacion de servidor de los 135 endpoints** (`SEC-BACKOFFICE-EP-001` … `-135`): el backend no esta en este repositorio y no hubo entorno desplegado disponible. Cada registro lleva la guarda de cliente observada y los pasos exactos para cerrar la verificacion cuando se tenga acceso al servicio.
- **Configuracion de CORS** (`SEC-BACKOFFICE-024`): se define en el backend.
- **Importes fiscales del documento de liquidacion** (`SEC-BACKOFFICE-014`): no puede determinarse si el servidor recalcula `ivaLiquidado` o acepta el valor del cliente.
- **Forma IDOR de notificaciones y borrado de cuenta** (`SEC-BACKOFFICE-023`): la forma es inequivoca desde el cliente; que sea explotable depende de si el servidor usa el id de la ruta o el sujeto del token.

Para cerrar estos 139 controles hace falta **acceso al repositorio del backend o a un entorno de pruebas desplegado**. Con eso, la verificacion es mecanica: cada registro trae ya el rol de prueba, la llamada y el codigo de respuesta esperado.

## Artefactos

- `findings.jsonl` — 274 registros, uno por unidad enumerada mas los hallazgos transversales
- `remediation-backlog.csv` — 218 hallazgos abiertos ordenados por severidad
- `surface.json` — mapa de superficie y conteo de unidades
- `endpoints.json` — los 135 endpoints con sus sitios de llamada
- `toolscan.json` + `evidence/` — salidas crudas de gitleaks, semgrep, osv-scanner, pip-audit y npm audit

_Ningun secreto, token, contrasena ni dato personal fue copiado a este informe ni a la evidencia; los valores sensibles se referencian por ruta y linea, redactados._