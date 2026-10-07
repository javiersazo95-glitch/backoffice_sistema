export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR',
  CAPTADOR = 'CAPTADOR',
}

export type BackofficeArea = 'ADMINISTRACION_CONTABLE' | 'SOPORTE' | 'MEDIACION_CONFIANZA';
export type BackofficePermissionSlot = 'OPERADOR' | 'QA';

export interface BackofficePermission {
  id?: number;
  area: BackofficeArea;
  slot: BackofficePermissionSlot;
}

export interface UserSummaryResponse {
  id: number;
  username: string;
  fullName: string;
  initials: string;
  role: Role;
  permissions?: BackofficePermission[];
  /** Solo captadores: false cuando Permisos le desactivo el acceso al portal. */
  capturerAccessActive?: boolean | null;
}

