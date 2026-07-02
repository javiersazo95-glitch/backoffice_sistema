import apiClient from './client';
import type { PageResponse } from '@/types/common';
import type { BackofficeArea, BackofficePermission, BackofficePermissionSlot } from '@/types/auth';

export interface PermissionUser {
  id: number;
  email: string;
  fullName: string;
  initials: string;
  role: string;
  permissions: BackofficePermission[];
}

export interface ListPermissionUsersParams {
  search?: string;
  area?: BackofficeArea | 'All';
  slot?: BackofficePermissionSlot | 'All';
  page?: number;
  size?: number;
}

export async function searchUsers(email: string): Promise<PermissionUser[]> {
  const response = await apiClient.get<PermissionUser[]>('/backoffice/permissions/users/search', { params: { email } });
  return response.data;
}

export async function getUserPermissions(userId: number): Promise<PermissionUser> {
  const response = await apiClient.get<PermissionUser>(`/backoffice/permissions/users/${userId}`);
  return response.data;
}

export async function updateUserPermissions(userId: number, permissions: BackofficePermission[]): Promise<PermissionUser> {
  const response = await apiClient.put<PermissionUser>(`/backoffice/permissions/users/${userId}`, { permissions });
  return response.data;
}

export async function listPermissionUsers(params: ListPermissionUsersParams): Promise<PageResponse<PermissionUser>> {
  const response = await apiClient.get<PageResponse<PermissionUser>>('/backoffice/permissions/users', {
    params: {
      ...params,
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
