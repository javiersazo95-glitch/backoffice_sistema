export enum AuditModule {
  VENDEDORES = 'VENDEDORES',
  VALIDACIONES = 'VALIDACIONES',
  MEDIACIONES = 'MEDIACIONES',
  ALERTAS = 'ALERTAS',
}

export interface AuditLogResponse {
  id: number;
  userId: number;
  userFullName: string;
  userInitials: string;
  sellerId: number;
  sellerName: string;
  sellerRut: string;
  module: AuditModule;
  action: string;
  detail: string;
  result: string;
  previousState: Record<string, string>;
  nextState: Record<string, string>;
  ipAddress: string;
  createdAt: string;
}

export interface AuditFilterRequest {
  search?: string;
  module?: AuditModule;
  sellerId?: number;
  startDate?: string;
  endDate?: string;
  page?: number;
  size?: number;
}