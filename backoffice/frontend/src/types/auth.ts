export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR',
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
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserSummaryResponse;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}
