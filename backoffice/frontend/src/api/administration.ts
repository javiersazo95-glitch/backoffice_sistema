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
  /** Lo que el comprador pidio al recargar, o null si no eligio (recarga anterior a esa opcion). */
  solicitadoPorElComprador: string | null;
}> {
  const response = await apiClient.get(`/administration/advertising-orders/${compraId}/documento/sugerencia`);
  return response.data;
}

/**
 * Carga el documento emitido y lo despacha al comprador con el PDF adjunto.
 *
 * El `Content-Type` es obligatorio, no decorativo: `apiClient` trae
 * `application/json` por defecto y axios, al ver ese header con un FormData,
 * **serializa el formulario a JSON** en vez de mandar el multipart. El backend
 * respondia 500 con "Content-Type 'application/json' is not supported" y el PDF
 * nunca salia del navegador. Mismo cuidado que el resto de las subidas de aca.
 */
export async function registrarDocumentoRecarga(compraId: number, form: FormData): Promise<void> {
  await apiClient.post(`/administration/advertising-orders/${compraId}/documento`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

/** URL de descarga de un solo uso del documento ya cargado. */
export async function getDocumentoRecargaUrl(compraId: number): Promise<string> {
  const response = await apiClient.get<{ url: string }>(
    `/administration/advertising-orders/${compraId}/documento/url`);
  return response.data.url;
}

/** Tipos de beneficiario para los que el backend emite nomina BCI, uno por endpoint. */
export type TipoNominaBci = 'proveedores' | 'captadores' | 'socios';

export interface NominaBciDescargada {
  blob: Blob;
  fileName: string;
  /** Identificadores de la exportacion que el backend registra en bitacora. */
  nominaId: string | null;
  hash: string | null;
  total: number | null;
  retiros: number | null;
}

function leerCabeceraNumerica(valor: unknown): number | null {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

/** Extrae el nombre de archivo de un Content-Disposition, si el backend lo expone. */
function nombreDesdeContentDisposition(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const match = valor.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/**
 * Pide al backend la nomina de pagos BCI de un tipo de beneficiario.
 *
 * No lleva cuerpo a proposito: el servidor elige los retiros pagables y toma la cuenta de cargo
 * de su propia configuracion. El cliente ya no arma el archivo --antes escribia aqui mismo las
 * cuentas de destino y los importes de transferencias reales, sin que el servidor supiera que
 * fichero se genero-- y por tanto no puede influir en lo que se paga ni a quien.
 *
 * Las cabeceras X-Nomina-* identifican la exportacion en la bitacora del backend. Son opcionales
 * en la respuesta: al ir la API en otro origen, el navegador solo las deja leer si el servidor
 * las publica con Access-Control-Expose-Headers. Si no llegan, la descarga funciona igual y los
 * campos quedan en null.
 */
export async function generarNominaBci(tipo: TipoNominaBci): Promise<NominaBciDescargada> {
  const response = await apiClient.post(`/administration/nominas/${tipo}`, undefined, {
    responseType: 'blob',
  });

  const headers = response.headers as Record<string, unknown>;
  const fechaHoy = new Date().toISOString().slice(0, 10);

  return {
    blob: response.data as Blob,
    fileName: nombreDesdeContentDisposition(headers['content-disposition'])
      ?? `Nomina_Pago_en_Linea-${tipo}-${fechaHoy}.xlsx`,
    nominaId: typeof headers['x-nomina-id'] === 'string' ? headers['x-nomina-id'] : null,
    hash: typeof headers['x-nomina-hash'] === 'string' ? headers['x-nomina-hash'] : null,
    total: leerCabeceraNumerica(headers['x-nomina-total']),
    retiros: leerCabeceraNumerica(headers['x-nomina-retiros']),
  };
}

/**
 * Traduce el fallo de una descarga de nomina a un mensaje legible.
 *
 * Con responseType blob, el cuerpo de un error tambien llega como Blob, asi que el mensaje del
 * backend hay que leerlo del blob en vez de tomarlo de data.message.
 */
export async function mensajeDeErrorDeNomina(error: unknown): Promise<string> {
  const data = (error as { response?: { data?: unknown }, message?: string })?.response?.data;

  if (data instanceof Blob) {
    try {
      const texto = await data.text();
      const json = JSON.parse(texto) as { message?: string };
      if (json.message) return json.message;
    } catch {
      // El cuerpo no era JSON: se cae al mensaje generico.
    }
  }

  return error instanceof Error ? error.message : 'Error desconocido.';
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
