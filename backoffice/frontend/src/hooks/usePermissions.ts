import { useCallback } from 'react';
import { Role, type BackofficeArea, type BackofficePermissionSlot, type UserSummaryResponse } from '@/types/auth';

type AreaKey = 'administracion' | 'soporte' | 'confianza' | 'permisos';

const AREA_TO_PERMISSION: Record<Exclude<AreaKey, 'permisos'>, BackofficeArea> = {
  administracion: 'ADMINISTRACION_CONTABLE',
  soporte: 'SOPORTE',
  confianza: 'MEDIACION_CONFIANZA',
};

export function hasBackofficePermission(
  user: UserSummaryResponse | null | undefined,
  area: BackofficeArea,
  slot?: BackofficePermissionSlot,
) {
  if (!user) return false;
  if (user.role === Role.SUPER_ADMIN) return true;

  // Sin lista de permisos no hay permiso (fail closed). Antes, cuando el campo no llegaba, se
  // caia a un fallback que devolvia true para CUALQUIER area si el rol era ADMIN, y esa era la
  // rama por defecto porque /auth/me no incluia permissions. El backend ya lo envia siempre
  // (array vacio si no tiene ninguno), asi que cerrar el fallback no deja a nadie sin areas.
  return (user.permissions ?? []).some((permission) => (
    permission.area === area && (!slot || permission.slot === slot)
  ));
}

export function usePermissions() {
  const isAreaEnabled = useCallback((area: AreaKey, user?: UserSummaryResponse | null): boolean => {
    if (!user) return false;
    if (user.role === Role.SUPER_ADMIN) return true;
    if (area === 'permisos') return false;
    return hasBackofficePermission(user, AREA_TO_PERMISSION[area]);
  }, []);

  const hasPermission = useCallback((
    user: UserSummaryResponse | null | undefined,
    area: BackofficeArea,
    slot?: BackofficePermissionSlot,
  ) => hasBackofficePermission(user, area, slot), []);

  return {
    isAreaEnabled,
    hasPermission,
  };
}
