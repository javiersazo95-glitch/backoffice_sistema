import { useState, useCallback } from 'react';

type Role = 'ADMIN' | 'OPERATOR';
type AreaKey = 'administracion' | 'soporte' | 'confianza';

interface AreaPermissions {
  administracion: Role[];
  soporte: Role[];
  confianza: Role[];
}

const STORAGE_KEY = 'repuestop-permissions';

const DEFAULT_PERMISSIONS: AreaPermissions = {
  administracion: ['ADMIN'],
  soporte: ['ADMIN', 'OPERATOR'],
  confianza: ['ADMIN'],
};

function loadPermissions(): AreaPermissions {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {}
  return DEFAULT_PERMISSIONS;
}

function savePermissions(permissions: AreaPermissions): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(permissions));
}

export function usePermissions() {
  const [permissions, setPermissions] = useState<AreaPermissions>(loadPermissions);

  const toggleRole = useCallback((area: AreaKey, role: Role) => {
    setPermissions((prev) => {
      const currentRoles = prev[area];
      const hasRole = currentRoles.includes(role);
      const newRoles = hasRole
        ? currentRoles.filter((r) => r !== role)
        : [...currentRoles, role];
      return { ...prev, [area]: newRoles };
    });
  }, []);

  const save = useCallback(() => {
    savePermissions(permissions);
  }, [permissions]);

  const reset = useCallback(() => {
    setPermissions(loadPermissions());
  }, []);

  const isAreaEnabled = useCallback(
    (area: AreaKey, userRole?: string): boolean => {
      const allowedRoles = permissions[area];
      return userRole ? allowedRoles.includes(userRole as Role) : false;
    },
    [permissions]
  );

  return {
    permissions,
    toggleRole,
    save,
    reset,
    isAreaEnabled,
  };
}
