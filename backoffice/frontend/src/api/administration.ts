import apiClient from './client';
import type {
  AdvertisingOrdersResponse,
  AdministrationWorkspaceResponse,
  AdministrationBootstrapResponse,
  RetiroAdminResponse,
  RetiroDetalleResponse,
  PagoProveedorResponse,
  ConfiguracionPagos,
  Expense,
  Withdrawal,
  Socio,
  SocioRequest,
} from '@/modules/administration/types';

export async function getWorkspace(): Promise<AdministrationWorkspaceResponse> {
  const response = await apiClient.get<AdministrationWorkspaceResponse>('/administration/workspace');
  return response.data;
}

export async function getBootstrap(): Promise<AdministrationBootstrapResponse> {
  const response = await apiClient.get<AdministrationBootstrapResponse>('/administration/bootstrap');
  return response.data;
}

/** Compras de fichas para publicidad: alimentan el tab "Publicidad" de Pedidos. */
export async function getAdvertisingOrders(): Promise<AdvertisingOrdersResponse> {
  const response = await apiClient.get<AdvertisingOrdersResponse>('/administration/advertising-orders');
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

/**
 * El deposito de este retiro reboto en el banco. El backend lo marca RECHAZADO y libera sus
 * items, para que el vendedor pueda volver a solicitarlo una vez corregidos sus datos.
 */
export async function rejectWithdrawal(id: string | number, motivo: string): Promise<RetiroAdminResponse> {
  const response = await apiClient.patch<RetiroAdminResponse>(`/administration/withdrawals/${id}/reject`, { motivo });
  return response.data;
}

/** Datos sugeridos para emitir el documento de una recarga: factura si hay RUT, boleta si no. */
export async function getDocumentoRecargaSugerencia(compraId: number): Promise<{
  tipo: string; rut: string | null; razonSocial: string | null; email: string | null;
  giro: string | null; direccion: string | null; detalle: string | null;
  neto: number; iva: number; total: number;
}> {
  const response = await apiClient.get(`/administration/advertising-orders/${compraId}/documento/sugerencia`);
  return response.data;
}

/** Carga el documento emitido y lo despacha al comprador con el PDF adjunto. */
export async function registrarDocumentoRecarga(compraId: number, form: FormData): Promise<void> {
  await apiClient.post(`/administration/advertising-orders/${compraId}/documento`, form);
}

/** URL de descarga de un solo uso del documento ya cargado. */
export async function getDocumentoRecargaUrl(compraId: number): Promise<string> {
  const response = await apiClient.get<{ url: string }>(
    `/administration/advertising-orders/${compraId}/documento/url`);
  return response.data.url;
}

export async function getWithdrawalPayments(): Promise<PagoProveedorResponse[]> {
  const response = await apiClient.get<PagoProveedorResponse[]>('/administration/withdrawal-payments');
  return response.data;
}

export async function getWithdrawalPayment(id: string | number): Promise<PagoProveedorResponse> {
  const response = await apiClient.get<PagoProveedorResponse>(`/administration/withdrawal-payments/${id}`);
  return response.data;
}

export async function createWithdrawalPayment(retiroIds: number[], retiroSocioIds: number[] = []): Promise<PagoProveedorResponse> {
  const response = await apiClient.post<PagoProveedorResponse>('/administration/withdrawal-payments', { retiroIds, retiroSocioIds });
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

// BO-SOCIOS-001: datos bancarios de los socios y pago de sus retiros

export async function getSocios(): Promise<Socio[]> {
  const response = await apiClient.get<Socio[]>('/administration/socios');
  return response.data;
}

export async function saveSocio(nombre: string, payload: SocioRequest): Promise<Socio> {
  const response = await apiClient.put<Socio>(`/administration/socios/${encodeURIComponent(nombre)}`, payload);
  return response.data;
}

export async function payPartnerWithdrawal(id: string): Promise<Withdrawal> {
  const response = await apiClient.patch<Withdrawal>(`/administration/partner-withdrawals/${id}/pay`);
  return response.data;
}
