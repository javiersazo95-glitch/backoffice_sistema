import apiClient from './client';
import type { PageResponse } from '@/types/common';
import type { BackofficeArea, BackofficePermission, BackofficePermissionSlot } from '@/types/auth';

export interface PermissionUser {
  id: number;
  email: string;
  fullName: string;
  initials: string;
  role: string;
  active?: boolean;
  emailVerified?: boolean;
  invitationStatus?: 'PENDIENTE' | 'ACEPTADO' | 'RECHAZADO';
  invitationEmailSent?: boolean;
  permissions: BackofficePermission[];
  /** Campos opcionales devueltos por bajas lógicas en el backend. */
  deleted?: boolean;
  eliminado?: boolean;
  deletedAt?: string | null;
  eliminadoEn?: string | null;
}

export interface InviteEmployeeRequest {
  fullName: string;
  email: string;
  permissions: BackofficePermission[];
  appUrl?: string;
}

export interface ListPermissionUsersParams {
  search?: string;
  area?: BackofficeArea | 'All';
  slot?: BackofficePermissionSlot | 'All';
  page?: number;
  size?: number;
}

export async function searchUsers(email: string): Promise<PermissionUser[]> {
  const response = await apiClient.get<PermissionUser[]>('/backoffice/permissions/users/search', {
    params: { email, includeDeleted: false },
  });
  return response.data;
}

export async function getUserPermissions(userId: number): Promise<PermissionUser> {
  const response = await apiClient.get<PermissionUser>(`/backoffice/permissions/users/${userId}`);
  return response.data;
}

export async function updateUserPermissions(userId: number, permissions: BackofficePermission[]): Promise<PermissionUser> {
  const appUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
  const response = await apiClient.put<PermissionUser>(`/backoffice/permissions/users/${userId}`, { permissions, appUrl }, {
    params: appUrl ? { appUrl } : undefined,
    headers: appUrl ? { 'X-App-Url': appUrl } : undefined,
  });
  return response.data;
}

export async function inviteEmployee(data: InviteEmployeeRequest): Promise<PermissionUser> {
  const appUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
  const effectiveAppUrl = data.appUrl || appUrl;
  const payload: InviteEmployeeRequest = {
    ...data,
    appUrl: effectiveAppUrl,
  };
  const response = await apiClient.post<PermissionUser>('/backoffice/permissions/invitations', payload, {
    params: effectiveAppUrl ? { appUrl: effectiveAppUrl } : undefined,
    headers: effectiveAppUrl ? { 'X-App-Url': effectiveAppUrl } : undefined,
  });
  return response.data;
}

export async function resendEmployeeInvitation(userId: number): Promise<PermissionUser> {
  const appUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
  const response = await apiClient.post<PermissionUser>(`/backoffice/permissions/users/${userId}/resend-invitation`, { appUrl }, {
    params: appUrl ? { appUrl } : undefined,
    headers: appUrl ? { 'X-App-Url': appUrl } : undefined,
  });
  return response.data;
}

export async function listPermissionUsers(params: ListPermissionUsersParams): Promise<PageResponse<PermissionUser>> {
  const response = await apiClient.get<PageResponse<PermissionUser>>('/backoffice/permissions/users', {
    params: {
      ...params,
      includeDeleted: false,
      area: params.area === 'All' ? undefined : params.area,
      slot: params.slot === 'All' ? undefined : params.slot,
    },
  });
  return response.data;
}

export async function deleteUserPermission(userId: number, permissionId: number): Promise<PermissionUser> {
  const response = await apiClient.delete<PermissionUser>(`/backoffice/permissions/users/${userId}/permissions/${permissionId}`);
  return response.data;
}

export async function deleteUserAccount(userId: number, perfil: 'COMPRADOR' | 'PROVEEDOR' | 'CAPTADOR' = 'COMPRADOR'): Promise<void> {
  await apiClient.delete(`/auth/users/${userId}`, { params: { perfil } });
}

export async function deleteEmployee(userId: number): Promise<void> {
  await apiClient.delete(`/backoffice/permissions/users/${userId}`);
}

export interface EmailValidationResult {
  valid: boolean;
  isCaptador?: boolean;
  isEmployee?: boolean;
  message?: string;
}

export async function validateEmployeeEmail(email: string): Promise<EmailValidationResult> {
  const response = await apiClient.get<EmailValidationResult>('/backoffice/permissions/validate-email', {
    params: { email },
  });
  return response.data;
}


