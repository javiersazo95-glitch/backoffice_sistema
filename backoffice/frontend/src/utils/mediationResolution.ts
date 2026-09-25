/**
 * Espejo del catálogo backend `ResolucionMediacionCatalogo`.
 * Las figuras de resolución están tipificadas según la Ley N° 19.496 sobre
 * Protección de los Derechos de los Consumidores (LPDC). Mantener las `key` y
 * `label` sincronizadas con el backend.
 */

export type MediationFavor = 'COMPRADOR' | 'VENDEDOR';

export interface MediationResolutionOption {
  key: string;
  favor: MediationFavor;
  label: string;
  fundamentoLegal: string;
  /** El mediador debe ingresar un porcentaje de reembolso (1–100). */
  requiresPercentage: boolean;
  /** La figura implica devolución de dinero al comprador. */
  appliesRefund: boolean;
}

export const MEDIATION_RESOLUTION_OPTIONS: MediationResolutionOption[] = [
  {
    key: 'REEMBOLSO_TOTAL',
    favor: 'COMPRADOR',
    label: 'Reembolso íntegro de lo pagado',
    fundamentoLegal:
      'Artículos 19 a 21 de la Ley N° 19.496 (garantía legal y derecho de opción del consumidor a la restitución de lo pagado)',
    requiresPercentage: false,
    appliesRefund: true,
  },
  {
    key: 'REEMBOLSO_PARCIAL',
    favor: 'COMPRADOR',
    label: 'Rebaja proporcional del precio (reembolso parcial)',
    fundamentoLegal:
      'Artículo 20 de la Ley N° 19.496 (derecho a la devolución de la parte proporcional del precio)',
    requiresPercentage: true,
    appliesRefund: true,
  },
  {
    key: 'REPOSICION_PRODUCTO',
    favor: 'COMPRADOR',
    label: 'Reposición o cambio del producto',
    fundamentoLegal: 'Artículo 20 de la Ley N° 19.496 (derecho del consumidor a la reposición del producto)',
    requiresPercentage: false,
    appliesRefund: false,
  },
  {
    key: 'REPARACION_GRATUITA',
    favor: 'COMPRADOR',
    label: 'Reparación gratuita del producto',
    fundamentoLegal: 'Artículos 20 y 41 de la Ley N° 19.496 (derecho a la reparación gratuita)',
    requiresPercentage: false,
    appliesRefund: false,
  },
  {
    key: 'RECLAMO_RECHAZADO_PRODUCTO_CONFORME',
    favor: 'VENDEDOR',
    label: 'Reclamo rechazado: producto conforme',
    fundamentoLegal:
      'Artículo 21 de la Ley N° 19.496 (no se acreditó la falta de conformidad del producto dentro del plazo legal)',
    requiresPercentage: false,
    appliesRefund: false,
  },
  {
    key: 'ENTREGA_CONFORME_ACREDITADA',
    favor: 'VENDEDOR',
    label: 'Entrega y recepción conforme acreditada',
    fundamentoLegal: 'Artículo 21 de la Ley N° 19.496 (consta la entrega del producto en las condiciones convenidas)',
    requiresPercentage: false,
    appliesRefund: false,
  },
  {
    key: 'RECLAMO_FUERA_DE_PLAZO',
    favor: 'VENDEDOR',
    label: 'Reclamo presentado fuera del plazo legal',
    fundamentoLegal:
      'Artículo 21 inciso 1 (plazo de 6 meses) y artículo 3 bis de la Ley N° 19.496 (plazo de retracto)',
    requiresPercentage: false,
    appliesRefund: false,
  },
];

export function resolutionOptionsFor(favor: MediationFavor): MediationResolutionOption[] {
  return MEDIATION_RESOLUTION_OPTIONS.filter((option) => option.favor === favor);
}

export function findResolutionOption(key: string | undefined | null): MediationResolutionOption | undefined {
  if (!key) return undefined;
  return MEDIATION_RESOLUTION_OPTIONS.find((option) => option.key === key);
}

export function resolutionOptionLabel(key: string | undefined | null): string {
  return findResolutionOption(key)?.label ?? (key ?? '');
}

export interface RefundStatusView {
  label: string;
  tone: 'info' | 'success' | 'warning';
}

/** Traduce el `estadoReembolso` del backend a una etiqueta legible para el panel de pasos. */
export function refundStatusView(estado: string | undefined | null): RefundStatusView {
  switch ((estado ?? '').toUpperCase()) {
    case 'REEMBOLSADO':
      return { label: 'Reembolso acreditado', tone: 'success' };
    case 'REEMBOLSO_SOLICITADO':
      return { label: 'Solicitado a la pasarela (Flow)', tone: 'info' };
    // O57: el comprador acepto el correo de Flow; falta que Flow ejecute la devolucion.
    case 'REEMBOLSO_ACEPTADO':
      return { label: 'Aceptado por el comprador en Flow · en curso', tone: 'info' };
    // O56 (pruebas de lanzamiento, 25-sep): RECHAZADO no es un fallo de la pasarela: el
    // comprador rechazo o dejo vencer el correo de Flow para aceptar la devolucion. Al pasar
    // a ese estado el backend crea una alerta de riesgo ALTA para soporte (O57).
    case 'REEMBOLSO_RECHAZADO':
      return { label: 'Rechazado o vencido por el comprador en Flow · contactarlo', tone: 'warning' };
    case 'REEMBOLSO_ERROR':
      return { label: 'Rechazado por la pasarela · gestión manual', tone: 'warning' };
    case 'SIN_PAGO_APROBADO':
    case 'SIN_PEDIDO':
    case 'SIN_ITEMS_DE_LA_TIENDA':
    case 'MONTO_CERO':
      return { label: 'Pendiente de gestión manual', tone: 'warning' };
    default:
      return { label: 'En proceso', tone: 'info' };
  }
}

/**
 * Pasos que ve el comprador para seguir su reembolso. `orderId` y `monto` son
 * textos ya formateados.
 */
export function buildRefundSteps(params: { percentage?: number | null; monto?: string; orderId?: string }): string[] {
  const { percentage, monto, orderId } = params;
  const pctTxt = percentage ? `${percentage}%` : '';
  const montoTxt = monto ? ` (${monto})` : '';
  return [
    'La resolución ya fue aplicada y notificada al comprador por chat, correo electrónico y app móvil.',
    `El reembolso ${pctTxt ? `del ${pctTxt} ` : ''}del subtotal de la compra en la tienda${montoTxt} fue solicitado a la pasarela de pagos (Flow).`,
    'Se acreditará en el mismo medio de pago usado en la compra, en un plazo estimado de 5 a 10 días hábiles.',
    `El comprador puede seguir el estado en RepuesTop → "Mis pedidos" → detalle del pedido${orderId ? ` ${orderId}` : ''}.`,
    'Al concretarse, el comprador recibe un comprobante por correo electrónico.',
  ];
}

export function favorLabel(favor: string | undefined | null): string {
  if (favor === 'COMPRADOR') return 'A favor del comprador';
  if (favor === 'VENDEDOR') return 'A favor de la tienda';
  return 'Sin veredicto';
}

/**
 * Vista previa cordial del veredicto que verá cada parte. Es orientativa: el
 * backend genera el texto definitivo (con fecha y monto exacto del reembolso).
 */
export function buildVeredictoPreview(params: {
  favor: MediationFavor;
  option: MediationResolutionOption | undefined;
  refundPercentage?: number;
  externalId?: string;
}): string {
  const { favor, option, refundPercentage, externalId } = params;
  if (!option) return 'Selecciona una opción de resolución para ver el fundamento que se comunicará a las partes.';

  const favorTexto = favor === 'COMPRADOR' ? 'a favor del comprador' : 'a favor de la tienda';
  let text =
    `Conforme a la Ley N° 19.496 sobre Protección de los Derechos de los Consumidores, y habiendo ` +
    `revisado los antecedentes del caso ${externalId ?? ''}, RepuesTop resuelve esta mediación ${favorTexto}. ` +
    `Fundamento legal: ${option.fundamentoLegal}. Medida aplicada: ${option.label}.`;

  if (option.appliesRefund) {
    const pct = option.requiresPercentage ? refundPercentage ?? 0 : 100;
    text +=
      ` Se aplicará un reembolso del ${pct}% sobre el subtotal de la compra en la tienda, que se ` +
      `solicitará a la pasarela de pagos (Flow) y se acreditará en el mismo medio de pago en un plazo ` +
      `estimado de 5 a 10 días hábiles; el comprador podrá seguir su estado en "Mis pedidos".`;
  } else if (favor === 'VENDEDOR') {
    text += ' En esta oportunidad no procede un reembolso al comprador.';
  }

  return text;
}

