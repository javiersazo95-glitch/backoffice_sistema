export const TODAY = new Date().toISOString().slice(0, 10);

export const COMMISSION_RATE = 0.05;
export const MIN_COMMISSION = 690;
export const MAX_COMMISSION = 9990;
export const GATEWAY_RATE = 0.0289;
export const GATEWAY_IVA = 0.19;
export const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;
export const RECEIPT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
export const EXPENSE_CATEGORIES = ['Tecnología', 'Marketing', 'Legal / Contabilidad', 'Operación', 'Otros'];
export const ORDER_STATUS_OPTIONS = ['Pendiente', 'Preparando', 'Enviado', 'Recibido', 'Finalizado', 'En mediación', 'Cancelado', 'Cancelado parcialmente'] as const;
export const SETTLEMENT_STATUS_OPTIONS = ['Completada', 'Enviado', 'En mediación', 'Cancelado'] as const;
export const PARTNERS = ['Javier', 'Elías'] as const;
// BO-SOCIOS-001: cada motivo precarga un monto distinto en el formulario de retiro
// (ver montoSugeridoPorMotivo en AdminFinancePage). "Ajuste de retiro socio" se elimino
// porque permitia registrar montos arbitrarios fuera del saldo disponible.
export const WITHDRAWAL_REASON_MONTHLY = 'Retiro mensual socio';
export const WITHDRAWAL_REASON_ACCUMULATED = 'Retiro de saldo acumulado';
export const WITHDRAWAL_REASON_PARTIAL = 'Retiro parcial socio';
export const WITHDRAWAL_REASON_OPTIONS = [
  WITHDRAWAL_REASON_MONTHLY,
  WITHDRAWAL_REASON_ACCUMULATED,
  WITHDRAWAL_REASON_PARTIAL,
] as const;

/** Bancos de la nomina BCI. El codigo es el que exige el archivo de pago masivo. */
export const BANCOS_BCI = [
  { nombre: 'Banco de Chile', code: 1 },
  { nombre: 'Banco Internacional', code: 9 },
  { nombre: 'Scotiabank Chile', code: 14 },
  { nombre: 'Banco de Credito e Inversiones', code: 16 },
  { nombre: 'Banco Bice', code: 28 },
  { nombre: 'HSBC Bank Chile', code: 31 },
  { nombre: 'Banco Santander', code: 37 },
  { nombre: 'Banco Itau', code: 39 },
  { nombre: 'Banco Security', code: 49 },
  { nombre: 'Banco Falabella', code: 51 },
  { nombre: 'Banco Ripley', code: 53 },
  { nombre: 'Banco Consorcio', code: 55 },
  { nombre: 'BancoEstado', code: 12 },
  { nombre: 'Coopeuch', code: 672 },
  { nombre: 'Tenpo', code: 730 },
  { nombre: 'Mercado Pago', code: 62 },
] as const;

export const TIPO_CUENTA_OPTIONS = ['Cuenta Corriente', 'Cuenta Vista', 'Cuenta de Ahorro'] as const;
