# Config del programa de captadores — visible en el portal del captador

## Resumen

El puntaje y las comisiones del programa se administran en **Confianza y Mediación →
Validaciones → Registros captadores** (solo `SUPER_ADMIN`). El portal del captador
(`/captador`) muestra tarjetas informativas ("Cómo ganas comisiones" y los pies de las
métricas de ganancia) que reflejan esa misma configuración en vivo.

## Endpoints

| Método | Ruta | Rol | Uso |
| --- | --- | --- | --- |
| `GET` | `/api/v1/validations/capturers/config` | `SUPER_ADMIN` | Leer config (backoffice) |
| `PUT` | `/api/v1/validations/capturers/config` | `SUPER_ADMIN` | Guardar config |
| `GET` | `/api/v1/captadores/me/config` | `CAPTADOR` | Leer config (portal del captador) |

Los tres devuelven el mismo DTO (`CaptadorDTOs.Configuracion` en el backend,
`CapturerConfig` en el frontend):

```json
{
  "puntosCasaAprobada": 100,
  "puntosServicioPrimeraCompra": 50,
  "pesosPorPunto": 1000,
  "comisionCasa": 0.01,
  "comisionPublicidad": 0.33
}
```

`comisionCasa` / `comisionPublicidad` son fracciones (`0.01` = 1 %). Es un singleton
(`ConfiguracionCaptador` id = 1): una sola fuente de verdad, `GET /captadores/me/config`
solo agrega una lectura con autorización de captador.

## Backend (mono-repo `RespuesTop-mono-repo`)

`controller/CaptadorController.java` — reutiliza el servicio existente:

```java
@GetMapping("/captadores/me/config") public Object config(){return service.configuracion();}
```

Queda cubierto por la regla `/api/v1/captadores/**` → `hasRole("CAPTADOR")` de
`SecurityConfig`. No requiere cambios de seguridad.

## Frontend

- `getCapturerProgramConfig()` en `api/capturers.ts` → `GET /captadores/me/config`.
- `CapturerPortalPage` refresca la query `capturer-program-config` cada 60 s y al reenfocar
  la ventana; usa `DEFAULT_CAPTURER_CONFIG` (`types/capturer.ts`) solo como respaldo.
- Al guardar en el backoffice (`CapturerValidationTab`) se muestra un modal de confirmación
  con los valores y se invalidan las queries `capturer-config` y `capturer-program-config`.
