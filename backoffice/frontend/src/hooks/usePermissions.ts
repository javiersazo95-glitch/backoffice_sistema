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

  if (Array.isArray(user.permissions)) {
    return user.permissions.some((permission) => (
      permission.area === area && (!slot || permission.slot === slot)
    ));
  }

  if (user.role === Role.ADMIN) return true;
  if (user.role === Role.OPERATOR) {
    return area === 'SOPORTE' && (!slot || slot === 'OPERADOR');
  }

  return false;
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
