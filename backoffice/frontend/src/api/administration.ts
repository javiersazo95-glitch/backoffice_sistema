import apiClient from './client';
import type {
  AdministrationWorkspaceResponse,
  AdministrationBootstrapResponse,
  RetiroAdminResponse,
  RetiroDetalleResponse,
  PagoProveedorResponse,
  ConfiguracionPagos,
  Expense,
  Withdrawal,
} from '@/modules/administration/types';

export async function getWorkspace(): Promise<AdministrationWorkspaceResponse> {
  const response = await apiClient.get<AdministrationWorkspaceResponse>('/administration/workspace');
  return response.data;
}

export async function getBootstrap(): Promise<AdministrationBootstrapResponse> {
  const response = await apiClient.get<AdministrationBootstrapResponse>('/administration/bootstrap');
  return response.data;
}

export async function getWithdrawals(): Promise<RetiroAdminResponse[]> {
  const response = await apiClient.get<RetiroAdminResponse[]>('/administration/withdrawals');
  return response.data;
}

export async function getConfiguracionPagos(): Promise<ConfiguracionPagos> {
  const response = await apiClient.get<ConfiguracionPagos>('/administration/configuracion-pagos');
  return response.data;
}

export async function updateConfiguracionPagos(cuentaCargoBci: string): Promise<ConfiguracionPagos> {
  const response = await apiClient.put<ConfiguracionPagos>('/administration/configuracion-pagos', { cuentaCargoBci });
  return response.data;
}

export async function getWithdrawalDetails(id: string | number): Promise<RetiroDetalleResponse> {
  const response = await apiClient.get<RetiroDetalleResponse>(`/administration/withdrawals/${id}/details`);
  return response.data;
}

export async function payWithdrawal(id: string | number): Promise<RetiroAdminResponse> {
  const response = await apiClient.patch<RetiroAdminResponse>(`/administration/withdrawals/${id}/pay`);
  return response.data;
}

export async function getWithdrawalPayments(): Promise<PagoProveedorResponse[]> {
  const response = await apiClient.get<PagoProveedorResponse[]>('/administration/withdrawal-payments');
  return response.data;
}

export async function getWithdrawalPayment(id: string | number): Promise<PagoProveedorResponse> {
  const response = await apiClient.get<PagoProveedorResponse>(`/administration/withdrawal-payments/${id}`);
  return response.data;
}

export async function createWithdrawalPayment(retiroIds: number[]): Promise<PagoProveedorResponse> {
  const response = await apiClient.post<PagoProveedorResponse>('/administration/withdrawal-payments', { retiroIds });
  return response.data;
}

export interface LiquidationDocumentPayload {
  retiroId: number;
  tipoDocumento: string;
  rut: string;
  razonSocial: string;
  email: string;
  detalle: string;
  ivaLiquidado: number | null;
  eliminarDocumento: boolean;
}

export async function saveLiquidationDocument(payload: LiquidationDocumentPayload, documento?: File): Promise<void> {
  const formData = new FormData();
  formData.append('data', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
  if (documento) formData.append('documento', documento);
  await apiClient.post('/administration/liquidation-documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export async function getLiquidationDocumentFile(retiroId: number): Promise<string> {
  const response = await apiClient.get<Blob>(`/administration/withdrawals/${retiroId}/liquidation-document`, {
    responseType: 'blob',
  });
  return URL.createObjectURL(response.data);
}

// BO-GASTOS-001: Gastos

export interface ExpenseRequestPayload {
  date: string;
  category: string;
  description: string;
  amount: number;
  eliminarReceipt: boolean;
}

export async function getExpenses(): Promise<Expense[]> {
  const response = await apiClient.get<Expense[]>('/administration/expenses');
  return response.data;
}

export async function createExpense(payload: ExpenseRequestPayload, documento?: File): Promise<Expense> {
  const formData = new FormData();
  formData.append('data', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
  if (documento) formData.append('documento', documento);
  const response = await apiClient.post<Expense>('/administration/expenses', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function updateExpense(id: string, payload: ExpenseRequestPayload, documento?: File): Promise<Expense> {
  const formData = new FormData();
  formData.append('data', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
  if (documento) formData.append('documento', documento);
  const response = await apiClient.put<Expense>(`/administration/expenses/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function deleteExpense(id: string): Promise<void> {
  await apiClient.delete(`/administration/expenses/${id}`);
}

// BO-GASTOS-001: Historial de Retiros (socios)

export interface PartnerWithdrawalRequestPayload {
  period: string;
  date: string;
  beneficiary: string;
  reason: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
}

export async function getPartnerWithdrawals(): Promise<Withdrawal[]> {
  const response = await apiClient.get<Withdrawal[]>('/administration/partner-withdrawals');
  return response.data;
}

export async function createPartnerWithdrawal(payload: PartnerWithdrawalRequestPayload): Promise<Withdrawal> {
  const response = await apiClient.post<Withdrawal>('/administration/partner-withdrawals', payload);
  return response.data;
}
