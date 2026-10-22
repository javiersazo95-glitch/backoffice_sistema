import { remoteConfig } from '@/utils/remoteConfigStore';
import {
  LISTA_BANCO,
  LISTA_TIPO_CUENTA_BANCARIA,
  PARAM_COMISION_FUNDADOR,
  PARAM_COMISION_TASA_ALTA,
  PARAM_PASARELA_IVA,
  PARAM_PASARELA_PORCENTAJE,
  type BootstrapDTO,
} from '@/types/remoteConfig';

// Fecha LOCAL: toISOString() es UTC y desde las 21:00 en Chile ya devolvia el dia siguiente.
export const TODAY = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();

// 18-oct: tarifa de servicio estándar 7% + IVA (sin tramos). Las fundadoras pagan 0% durante la
// marcha blanca de 2 meses. Referencia: la tasa real de cada venta la manda el servidor.
//
// 20-oct (Mantenedor común): estos números pasan a ser el FALLBACK de los parámetros públicos
// `comision.*` y `pasarela.*` del bootstrap. No se borran: sin backend nuevo, sin caché o con un
// valor mal formado, `getComisiones()` devuelve exactamente estos valores.
export const COMMISSION_RATE_FALLBACK = 0.07;
export const FOUNDER_COMMISSION_RATE_FALLBACK = 0;
export const MIN_COMMISSION_FALLBACK = 690;
export const MAX_COMMISSION_FALLBACK = 9990;
export const GATEWAY_RATE_FALLBACK = 0.0289;
export const GATEWAY_IVA_FALLBACK = 0.19;

/**
 * Claves de `rt_parametro` (contrato del mantenedor, sección 4). `comision.minimo` y
 * `comision.maximo` NO están en el contrato: se leen por si el backend las agrega con ese nombre y,
 * mientras tanto, devuelven el fallback. Si se crean con otra clave hay que ajustar aquí.
 */
const PARAM_MIN_COMMISSION = 'comision.minimo';
const PARAM_MAX_COMMISSION = 'comision.maximo';

export interface Comisiones {
  COMMISSION_RATE: number;
  FOUNDER_COMMISSION_RATE: number;
  MIN_COMMISSION: number;
  MAX_COMMISSION: number;
  GATEWAY_RATE: number;
  GATEWAY_IVA: number;
}

const COMISIONES_FALLBACK: Comisiones = Object.freeze({
  COMMISSION_RATE: COMMISSION_RATE_FALLBACK,
  FOUNDER_COMMISSION_RATE: FOUNDER_COMMISSION_RATE_FALLBACK,
  MIN_COMMISSION: MIN_COMMISSION_FALLBACK,
  MAX_COMMISSION: MAX_COMMISSION_FALLBACK,
  GATEWAY_RATE: GATEWAY_RATE_FALLBACK,
  GATEWAY_IVA: GATEWAY_IVA_FALLBACK,
});

/**
 * Memo por snapshot: el store entrega la misma referencia de `data` mientras no llegue un
 * bootstrap nuevo, así `getComisiones()`/`getBancosBci()` devuelven objetos estables y pueden ir
 * en dependencias de React sin recalcular en cada render.
 */
function memoPorSnapshot<T>(calcular: (data: BootstrapDTO | null) => T): () => T {
  let ultimaData: BootstrapDTO | null | undefined;
  let ultimoValor: T;
  return () => {
    const data = remoteConfig.get().data;
    if (ultimaData === undefined || data !== ultimaData) {
      ultimaData = data;
      ultimoValor = calcular(data);
    }
    return ultimoValor;
  };
}

/**
 * Tasas vigentes según el mantenedor, con los valores históricos como fallback. Para componentes
 * usar `useComisiones()` (hooks/useRemoteConfig), que se re-pinta al llegar config nueva.
 */
export const getComisiones: () => Comisiones = memoPorSnapshot((data) => {
  if (!data) return COMISIONES_FALLBACK;
  return {
    COMMISSION_RATE: remoteConfig.getParametro(PARAM_COMISION_TASA_ALTA, COMMISSION_RATE_FALLBACK),
    FOUNDER_COMMISSION_RATE: remoteConfig.getParametro(PARAM_COMISION_FUNDADOR, FOUNDER_COMMISSION_RATE_FALLBACK),
    MIN_COMMISSION: remoteConfig.getParametro(PARAM_MIN_COMMISSION, MIN_COMMISSION_FALLBACK),
    MAX_COMMISSION: remoteConfig.getParametro(PARAM_MAX_COMMISSION, MAX_COMMISSION_FALLBACK),
    GATEWAY_RATE: remoteConfig.getParametro(PARAM_PASARELA_PORCENTAJE, GATEWAY_RATE_FALLBACK),
    GATEWAY_IVA: remoteConfig.getParametro(PARAM_PASARELA_IVA, GATEWAY_IVA_FALLBACK),
  };
});

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

export interface BancoBci {
  /** Nombre que ve el operador. Es lo que se guarda en `banco` (texto), igual que siempre. */
  nombre: string;
  /** Código "Banco Destino" de la nómina "Pago en Línea" de BCI (`CodigoBanco.java`). */
  code: number;
}

/**
 * Bancos de la nomina BCI. El codigo es el que exige el archivo de pago masivo.
 *
 * 20-oct (Mantenedor común): fallback de la lista `BANCO` (33 bancos de `CodigoBanco.java`, con
 * `metadata.codigoBci`). Para componentes usar `useBancosBci()`; `getBancosBci()` para código sin
 * hooks. Se mantiene esta nómina corta porque es la que se ve sin backend nuevo.
 */
export const BANCOS_BCI_FALLBACK = [
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
] as const satisfies readonly BancoBci[];

/**
 * Lista `BANCO` del mantenedor convertida a la forma `{nombre, code}` que esperan los selectores.
 * Una opción sin `metadata.codigoBci` numérico se descarta: sin código no se puede armar la
 * nómina. Si la lista no viene, o viene sin ninguna opción usable, se usa la nómina local.
 */
export const getBancosBci: () => readonly BancoBci[] = memoPorSnapshot((data) => {
  if (!data) return BANCOS_BCI_FALLBACK;
  const lista = remoteConfig.getLista(LISTA_BANCO);
  if (lista.length === 0) return BANCOS_BCI_FALLBACK;
  const bancos: BancoBci[] = [];
  for (const opcion of lista) {
    const crudo = opcion.metadata?.codigoBci;
    const code = typeof crudo === 'number' ? crudo : typeof crudo === 'string' ? Number(crudo) : NaN;
    if (!Number.isInteger(code) || code <= 0) continue;
    bancos.push({ nombre: opcion.etiqueta, code });
  }
  return bancos.length > 0 ? bancos : BANCOS_BCI_FALLBACK;
});

/** 20-oct: fallback de la lista `TIPO_CUENTA_BANCARIA`. Ver `getTipoCuentaOptions()`. */
export const TIPO_CUENTA_OPTIONS_FALLBACK = ['Cuenta Corriente', 'Cuenta Vista', 'Cuenta de Ahorro'] as const;

/**
 * Tipos de cuenta para los selectores. Se usa la ETIQUETA de cada opción (no el `valor`) porque
 * el backoffice siempre guardó el texto visible en `tipoCuenta` y la nómina BCI espera ese texto;
 * así los registros existentes siguen calzando con el selector.
 */
export const getTipoCuentaOptions: () => readonly string[] = memoPorSnapshot((data) => {
  if (!data) return TIPO_CUENTA_OPTIONS_FALLBACK;
  const lista = remoteConfig.getLista(LISTA_TIPO_CUENTA_BANCARIA);
  const etiquetas = lista.map((opcion) => opcion.etiqueta.trim()).filter(Boolean);
  return etiquetas.length > 0 ? etiquetas : TIPO_CUENTA_OPTIONS_FALLBACK;
});

/**
 * Tipo MIME de la nomina "Pago en Linea" de BCI. Solo se usa como respaldo: el archivo lo emite
 * el backend con su propio Content-Type (ver api/administration.generarNominaBci).
 */
export const BCI_NOMINA_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
