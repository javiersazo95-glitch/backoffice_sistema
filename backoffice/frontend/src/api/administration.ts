import apiClient from './client';
import type {
  AdvertisingOrdersResponse,
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
  // O23: sin guiones bajos ni puntos extra (instructivo BCI); el backend ya manda el nombre real.
  const fechaHoy = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  return {
    blob: response.data as Blob,
    fileName: nombreDesdeContentDisposition(headers['content-disposition'])
      ?? `Nomina-${tipo}-${fechaHoy}.xlsx`,
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

/**
 * Y (revision contable 2026-10-08): lo que RepuesTop factura a la tienda por un retiro, linea por
 * linea. La comision de servicio y el cargo por procesamiento de pago (la comision de Flow que se le
 * descuenta), cada uno con su neto e IVA. Lo calcula el servidor, el mismo que guarda el IVA.
 */
export interface FacturaComision {
  retiroId: number;
  codigoRetiro: string;
  lineas: { concepto: string; neto: number; iva: number }[];
  neto: number;
  iva: number;
  total: number;
  detalleSugerido: string;
}

export async function getFacturaComision(retiroId: number): Promise<FacturaComision> {
  const response = await apiClient.get<FacturaComision>(`/administration/withdrawals/${retiroId}/factura-comision`);
  return response.data;
}

/** Ultima nomina exportada de un tipo, con los retiros que se enviaron al banco. */
export interface UltimaNomina {
  nominaId: number;
  tipo: string;
  generadaAt: string;
  retiroIds: number[];
  totalConciliado: number;
  cantidadRetiros: number;
}

export interface UltimasNominasPago {
  proveedores: UltimaNomina | null;
  socios: UltimaNomina | null;
  captadores: UltimaNomina | null;
}

/**
 * K (8-oct): "Procesar pago" solo marca pagado lo que salio en la ultima nomina exportada de su
 * tipo. El backend lo exige; la pantalla lo usa para mostrar que se va a pagar.
 */
export async function getUltimasNominas(): Promise<UltimasNominasPago> {
  const response = await apiClient.get<UltimasNominasPago>('/administration/nominas/ultimas');
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

export async function createWithdrawalPayment(retiroIds: number[], retiroSocioIds: number[] = []): Promise<PagoProveedorResponse> {
  const response = await apiClient.post<PagoProveedorResponse>('/administration/withdrawal-payments', { retiroIds, retiroSocioIds });
  return response.data;
}

/**
 * De que tabla viene un retiroId.
 *
 * RT_retiro (vendedores) y BO_retiro_socio (socios) numeran sus ids de forma independiente y
 * pueden coincidir, asi que el id por si solo es ambiguo: el mismo 7 puede ser un retiro de
 * vendedor o uno de socio. Sin este campo el backend rechaza la peticion cuando el id existe en
 * las dos tablas, en vez de elegir una. Es obligatorio aqui a proposito, para que TypeScript no
 * deje anadir un punto de llamada nuevo sin decidir a que tipo pertenece.
 */
export type TipoRetiro = 'PROVEEDOR' | 'SOCIO';

export interface LiquidationDocumentPayload {
  tipoRetiro: TipoRetiro;
  retiroId: number;
  tipoDocumento: string;
  rut: string;
  razonSocial: string;
  email: string;
  detalle: string;
  ivaLiquidado: number | null;
  eliminarDocumento: boolean;
  /** Folio y fecha de emision ("YYYY-MM-DD") del DTE. Obligatorios para retiros de PROVEEDOR. */
  folio?: string | null;
  fechaEmision?: string | null;
}

/**
 * Un DTE emitido por RepuesTop en el mes: factura o boleta por la comision de servicio, o por una
 * recarga de Monedas. Neto e IVA los calcula el servidor.
 */
export interface IssuedDocumentRow {
  fechaEmision: string | null;
  tipoDocumento: string | null;
  /** 33 factura, 39 boleta, 61 nota de credito electronica. */
  codigoSii: number | null;
  folio: string | null;
  rutReceptor: string | null;
  razonSocialReceptor: string | null;
  neto: number;
  iva: number;
  total: number;
  /** NOTA_CREDITO_COMISION: nota de RepuesTop que anula comision ya facturada; montos negativos. */
  origen: 'COMISION_SERVICIO' | 'RECARGA_MONEDAS' | 'NOTA_CREDITO_COMISION';
  referencia: string;
  /** Lo que hay que revisar antes de cuadrar; vacio si la fila esta completa. */
  observacion: string;
}

/** DTE emitidos en un mes ("YYYY-MM"), por fecha de emision, para cuadrar el F29. */
export async function getIssuedDocuments(mes: string): Promise<IssuedDocumentRow[]> {
  const response = await apiClient.get<IssuedDocumentRow[]>('/administration/issued-documents', { params: { mes } });
  return response.data;
}

export async function saveLiquidationDocument(payload: LiquidationDocumentPayload, documento?: File): Promise<void> {
  const formData = new FormData();
  formData.append('data', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
  if (documento) formData.append('documento', documento);
  await apiClient.post('/administration/liquidation-documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

/**
 * Descarga el PDF del documento de liquidacion ya registrado.
 *
 * Lleva tipoRetiro por el mismo motivo que el POST: el id solo no distingue entre un retiro de
 * vendedor y uno de socio. Esta ruta tenia la misma ambiguedad y se me habia pasado en el
 * reporte; la detecto el agente del backend.
 */
export async function getLiquidationDocumentFile(tipoRetiro: TipoRetiro, retiroId: number): Promise<string> {
  const response = await apiClient.get<Blob>(`/administration/withdrawals/${retiroId}/liquidation-document`, {
    params: { tipoRetiro },
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
  /** SEC-BACKEND-121: obligatoria en el backend (H17). */
  naturaleza: 'RETIRO_DE_UTILIDADES' | 'DEVOLUCION_DE_CAPITAL' | 'PRESTAMO' | 'REMUNERACION' | 'GASTO_RECHAZADO';
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

// Pendiente D (revision contable 2026-10-08): notas de credito y plazo de 6 meses.

/** Nivel del plazo de 6 meses (art. 21 N° 2 y art. 70 DL 825) de una venta deshecha sin nota. */
export type NivelNotaCredito = 'AL_DIA' | 'AVISO' | 'CRITICO' | 'VENCIDA';
/** TIENDA anula su boleta de venta; REPUESTOP anula su factura de comision de un item ya liquidado. */
export type EmisorNotaCredito = 'TIENDA' | 'REPUESTOP';

export interface CreditNotePending {
  pagoReembolsoId: number;
  emisor: EmisorNotaCredito;
  pedidoId: number;
  codigoPedido: string | null;
  proveedorId: number | null;
  nombreTienda: string | null;
  origen: string;
  montoReembolso: number | null;
  fechaReembolso: string | null;
  /** Desde donde corren los 6 meses. */
  fechaBase: string;
  tipoFechaBase: 'ENTREGA' | 'BOLETA' | 'FACTURA_COMISION';
  venceEl: string;
  diasRestantes: number;
  nivel: NivelNotaCredito;
  /** La devolucion misma ocurrio despues de los 6 meses: el IVA ya no se recupera. */
  devolucionFueraDePlazo: boolean;
  documentoAnulado: string;
  codigoRetiro: string | null;
  /** Lo que pago el comprador a esta tienda: productos mas su despacho (9-oct). */
  totalVenta: number | null;
  /** Lo reembolsado sobre el total de la venta, de 1 a 100. */
  porcentajeReembolsado: number | null;
  /** El caso, si el reembolso vino de una mediacion. */
  mediacionId: number | null;
  fechaEntrega: string | null;
  /** Con que monto se propone la nota: lo reembolsado (tienda) o la comision sobre eso (RepuesTop). */
  montoPropuesto: number | null;
  /** Tope: no se anula mas de lo reembolsado ni mas de la factura de comision. Null si no se conoce. */
  montoMaximo: number | null;
  /** RECHAZADA: la tienda la subio y el backoffice la rechazo; espera que la suba de nuevo. */
  estado: 'PENDIENTE' | 'RECHAZADA';
  motivoRechazo: string | null;
}

/** TIENDA: la subio la tienda desde el detalle de su venta. BACKOFFICE: registrada a mano. */
export type OrigenNotaCredito = 'TIENDA' | 'BACKOFFICE';

export interface CreditNoteRegistered {
  id: number;
  emisor: EmisorNotaCredito;
  pagoReembolsoId: number | null;
  pedidoId: number | null;
  codigoPedido: string | null;
  nombreTienda: string | null;
  folio: string;
  fechaEmision: string;
  monto: number | null;
  archivoNombre: string | null;
  tieneArchivo: boolean;
  registradaPor: string | null;
  registradaAt: string;
  /** Se emitio despues de los 6 meses: quedo como respaldo, pero no rebajo el IVA. */
  emitidaFueraDePlazo: boolean;
  origen: OrigenNotaCredito;
  montoReembolso: number | null;
}

export interface MediationNearDeadline {
  mediacionId: number;
  pedidoId: number;
  codigoPedido: string | null;
  nombreTienda: string | null;
  fechaEntrega: string;
  venceEl: string;
  diasRestantes: number;
}

export interface CreditNotesPanel {
  pendientes: CreditNotePending[];
  registradas: CreditNoteRegistered[];
  mediacionesPorVencer: MediationNearDeadline[];
}

export async function getCreditNotes(): Promise<CreditNotesPanel> {
  const response = await apiClient.get<CreditNotesPanel>('/administration/credit-notes');
  return response.data;
}

export interface RegisterCreditNotePayload {
  pagoReembolsoId: number;
  emisor: EmisorNotaCredito;
  folio: string;
  /** "YYYY-MM-DD". */
  fechaEmision: string;
  /** Sin monto, el servidor usa el del reembolso. */
  monto: number | null;
}

/** Registra la nota de credito con su PDF. Mismo cuidado con el Content-Type que el resto de las subidas. */
export async function registerCreditNote(payload: RegisterCreditNotePayload, archivo: File): Promise<CreditNoteRegistered> {
  const formData = new FormData();
  formData.append('data', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
  formData.append('archivo', archivo);
  const response = await apiClient.post<CreditNoteRegistered>('/administration/credit-notes', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/** 9-oct: rechaza una nota que subio la tienda. Vuelve a pendiente y la tienda ve el motivo. */
export async function rejectCreditNote(id: number, motivo: string): Promise<CreditNoteRegistered> {
  const response = await apiClient.post<CreditNoteRegistered>(`/administration/credit-notes/${id}/reject`, { motivo });
  return response.data;
}

/** URL de descarga de un solo uso del PDF de la nota. */
export async function getCreditNoteUrl(id: number): Promise<string> {
  const response = await apiClient.get<{ url: string }>(`/administration/credit-notes/${id}/url`);
  return response.data.url;
}

// Pendientes A y B (revision contable 2026-10-08): situacion tributaria de las tiendas.

export type ViaVerificacionSii = 'CONSULTA_WEB' | 'CERTIFICADO' | 'API';
export type ResultadoVerificacionSii = 'CUMPLE' | 'NO_CUMPLE' | 'SIN_INICIO_ACTIVIDADES' | 'TERMINO_GIRO' | 'SUBSISTENCIA';
export type EstadoSemestreSii = 'AL_DIA' | 'PENDIENTE' | 'SIN_VERIFICAR';

export interface VerificacionSii {
  id: number;
  verificadaEn: string;
  via: ViaVerificacionSii;
  resultado: ResultadoVerificacionSii;
  /** p. ej. "2026-S2". */
  semestre: string;
  /** Fin del semestre: la marca de incumplimiento dura hasta ahi (Res. 168, resolutivo 5°). */
  vigenteHasta: string;
  inicioActividadesFecha: string | null;
  observaciones: string | null;
  tieneEvidencia: boolean;
  evidenciaNombre: string | null;
  registradaPor: string | null;
  registradaAt: string;
}

export interface TiendaSituacionSii {
  proveedorId: number;
  nombreTienda: string | null;
  rut: string | null;
  estadoTienda: 'APROBADA' | 'PENDIENTE' | 'SUSPENDIDA' | 'OTRO';
  declaracionIvaAt: string | null;
  tieneCertificado: boolean;
  ultimaVerificacion: VerificacionSii | null;
  estadoSemestre: EstadoSemestreSii;
  /** Lo que le falta para que se pueda aprobar. Vacio si cumple todo. */
  faltantesParaAprobar: string[];
}

export interface PanelSituacionSii {
  semestreActual: string;
  finSemestre: string;
  /** Enero y julio: los meses en que la Res. 168 exige reverificar. */
  mesDeReverificacion: boolean;
  tiendas: TiendaSituacionSii[];
}

export async function getTaxStatus(): Promise<PanelSituacionSii> {
  const response = await apiClient.get<PanelSituacionSii>('/administration/tax-status');
  return response.data;
}

export async function getTaxStatusHistory(proveedorId: number): Promise<VerificacionSii[]> {
  const response = await apiClient.get<VerificacionSii[]>(`/administration/tax-status/${proveedorId}/history`);
  return response.data;
}

export interface RegisterTaxStatusPayload {
  /** "YYYY-MM-DD". */
  verificadaEn: string;
  via: ViaVerificacionSii;
  resultado: ResultadoVerificacionSii;
  inicioActividadesFecha: string | null;
  observaciones: string | null;
}

/** Registra una verificacion ante el SII, con evidencia opcional (PDF o imagen). */
export async function registerTaxStatus(proveedorId: number, payload: RegisterTaxStatusPayload, evidencia?: File | null): Promise<VerificacionSii> {
  const formData = new FormData();
  formData.append('data', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
  if (evidencia) formData.append('evidencia', evidencia);
  const response = await apiClient.post<VerificacionSii>(`/administration/tax-status/${proveedorId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function getTaxStatusEvidenceUrl(verificacionId: number): Promise<string> {
  const response = await apiClient.get<{ url: string }>(`/administration/tax-status/verifications/${verificacionId}/evidence-url`);
  return response.data.url;
}

/** Nomina RUT;DV de las tiendas vigentes (Res. 168, resolutivo 4°), como texto. */
export async function getTaxStatusNomina(): Promise<string> {
  const response = await apiClient.get<string>('/administration/tax-status/nomina', { responseType: 'text' });
  return response.data;
}

/** Enlace de un solo uso al certificado de cumplimiento que subio la tienda. */
export async function getTaxStatusCertificateUrl(proveedorId: number): Promise<string> {
  const response = await apiClient.get<{ url: string }>(`/administration/tax-status/${proveedorId}/certificate-url`);
  return response.data.url;
}

// Paso 2: certificados de cumplimiento que las tiendas suben desde Mi tienda (enero y julio).

export interface CertificadoPendiente {
  id: number;
  proveedorId: number;
  nombreTienda: string | null;
  rut: string | null;
  nombreArchivo: string | null;
  subidoAt: string;
  semestre: string;
}

export async function getPendingCertificates(): Promise<CertificadoPendiente[]> {
  const response = await apiClient.get<CertificadoPendiente[]>('/administration/tax-status/certificates');
  return response.data;
}

export async function getPendingCertificateUrl(id: number): Promise<string> {
  const response = await apiClient.get<{ url: string }>(`/administration/tax-status/certificates/${id}/url`);
  return response.data.url;
}

export interface ReviewCertificatePayload {
  /** Lo que dice el certificado, o RECHAZADO si no sirve (ilegible, de otra tienda o de otro semestre). */
  estado: 'CUMPLE' | 'NO_CUMPLE' | 'RECHAZADO';
  /** "YYYY-MM-DD": fecha de los datos del certificado. Obligatoria salvo al rechazar. */
  certificadoFecha: string | null;
  /** Obligatorio al rechazar: se le muestra a la tienda. */
  motivo: string | null;
}

export async function reviewCertificate(id: number, payload: ReviewCertificatePayload): Promise<void> {
  await apiClient.post(`/administration/tax-status/certificates/${id}/review`, payload);
}
