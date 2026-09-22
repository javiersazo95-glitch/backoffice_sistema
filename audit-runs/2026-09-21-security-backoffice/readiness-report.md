# Estado final — seguridad / plataforma `backoffice`

_Actualizado el 2026-09-22 tras el cierre con el agente de seguridad del backend._
_Informe original de la corrida: ver el historial de git de este archivo._

| | Inicio (2026-09-21) | Ahora |
|---|---|---|
| Puntaje | 26,2 / 100 | **85.5 / 100** |
| Controles `unverified` | 139 | **0** |
| `verified` | 0 | **203** |
| Abiertos | 218 | **20** |

## Como se cerro la brecha

La auditoria abrio con **139 controles `unverified`**, 135 de ellos la autorizacion de servidor de cada endpoint, porque este repositorio contiene solo el frontend. Esa cobertura incompleta se documento endpoint por endpoint con su causa, se traslado al agente que audito el backend en `handoff-backend.md`, y volvio con veredictos y evidencia en `respuesta-al-backend.md`.

**No queda ningun control `unverified`.** Lo que sigue abierto son problemas identificados con dueno asignado, no zonas ciegas.

## Resultados

| Resultado | Registros |
|---|---|
| `pass` | 234 |
| `partial` | 9 |
| `fail` | 36 |
| `unverified` | 0 |
| `na` | 1 |
| **Total** | **280** |

## Abierto

| ID | Estado | Sev | Titulo | Dueno |
|---|---|---|---|---|
| `SEC-BACKOFFICE-006` | open | high | El token de acceso del backoffice se guarda en localStorage/se | frontend + backend (cookie HttpOnly) |
| `SEC-BACKOFFICE-012` | fixing | high | La clave X-Backoffice-Api-Key y su superficie privilegiada que | backend / operaciones (rotacion + purga de historial) |
| `SEC-BACKOFFICE-014` | open | high | Importes fiscales del documento de liquidacion se envian desde | backend |
| `SEC-BACKOFFICE-DP-001` | fixing | high | Dependencia vulnerable: react-router-dom (6.0.0-alpha.0 - 6.30 | frontend (migracion a react-router 7, no alcanzable hoy) |
| `SEC-BACKOFFICE-DP-002` | fixing | high | Dependencia vulnerable: react-router (6.0.0 - 7.17.0) | frontend (migracion a react-router 7, no alcanzable hoy) |
| `SEC-BACKOFFICE-EP-120` | open | high | Autorizacion de servidor no verificable: POST /uploads/upload | backend |
| `SEC-BACKOFFICE-TK-001` | open | high | Punto de sesion: Clave de almacenamiento del token | frontend + backend (cookie HttpOnly) |
| `SEC-BACKOFFICE-TK-004` | open | high | Punto de sesion: getStoredToken: lee de sessionStorage y local | frontend + backend (cookie HttpOnly) |
| `SEC-BACKOFFICE-TK-005` | open | high | Punto de sesion: storeToken: 'mantener sesion' persiste en loc | frontend + backend (cookie HttpOnly) |
| `SEC-BACKOFFICE-TK-014` | open | high | Punto de sesion: getAuthToken: segunda lectura del token fuera | frontend + backend (cookie HttpOnly) |
| `SEC-BACKOFFICE-009` | open | medium | La separacion entre acceso de personal y de captador se aplica | backend (rechazar el rol antes de emitir token) |
| `SEC-BACKOFFICE-016` | fixing | medium | El Dockerfile arranca el servidor de desarrollo de Vite escuch | frontend (sin verificar: no hay Docker en el entorno) |
| `SEC-BACKOFFICE-025` | fixing | medium | El dominio de produccion del backoffice puede quedar fuera de  | operaciones (dominio en Vercel) |
| `SEC-BACKOFFICE-CF-002` | fixing | medium | Artefacto de configuracion: backoffice/frontend/Dockerfile | frontend (ver SEC-016) |
| `SEC-BACKOFFICE-CF-010` | fixing | medium | Distribucion completa de Maven (20 MB, 90 ficheros) versionada | operaciones (purga de historial, junto con SEC-012) |
| `SEC-BACKOFFICE-TK-002` | open | medium | Punto de sesion: setAuthHeader: token en headers.common de axi | frontend + backend (cookie HttpOnly) |
| `SEC-BACKOFFICE-TK-008` | open | medium | Punto de sesion: login: emision y almacenamiento del token | backend (rechazar el rol antes de emitir token) |
| `SEC-BACKOFFICE-TK-009` | open | medium | Punto de sesion: loginWithGoogle: emision y almacenamiento del | backend (rechazar el rol antes de emitir token) |
| `SEC-BACKOFFICE-026` | open | low | Las cabeceras de trazabilidad de la nomina no seran legibles s | backend (Access-Control-Expose-Headers) |
| `SEC-BACKOFFICE-CF-003` | fixing | low | Artefacto de configuracion: backoffice/frontend/.dockerignore | frontend (ver SEC-016) |

## Veto de produccion

**No queda ningun Blocker ni Critical abierto.** Los dos Critical de la corrida inicial (`SEC-BACKOFFICE-001`, escalada por la API de permisos, y `SEC-BACKOFFICE-004`, fuerza bruta del codigo de activacion) estan `verified`.

El puntaje sigue por debajo del umbral de 95 exigido por el protocolo, asi que la plataforma **no alcanza cobertura completa todavia**. Lo que separa 85,5 de 95 son los 20 hallazgos de la tabla de arriba, con dos que conviene atender antes del lanzamiento: `SEC-BACKOFFICE-006` (token en Web Storage) y `SEC-BACKOFFICE-025` (confirmar el dominio en Vercel).

## Artefactos

- `findings.jsonl` — 280 registros, uno por unidad enumerada
- `handoff-backend.md` — lo que se pidio al agente del backend
- `respuesta-al-backend.md` — pruebas de cierre, respuestas y lo que sigue pendiente de su lado
- `remediation-backlog.csv`, `surface.json`, `endpoints.json`, `toolscan.json`, `evidence/`