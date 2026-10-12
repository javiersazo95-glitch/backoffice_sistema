/**
 * Espejo del catálogo backend `PreguntaGuiadaCatalogo` (12-oct, flujos guiados).
 *
 * El mediador manda una pregunta con opciones para tocar; la parte elige una y el sistema envía
 * solo el siguiente paso a la otra parte. Acá solo viven las keys y los títulos para el botón
 * "Enviar pregunta" y las etiquetas de `atencionMediador`; las opciones de cada mensaje llegan
 * desde el backend en el propio mensaje.
 */

export type GuidedQuestionTarget = 'COMPRADOR' | 'VENDEDOR';

export interface GuidedQuestion {
  key: string;
  target: GuidedQuestionTarget;
  title: string;
  /** Cuándo conviene mandarla a mano (el flujo normal la lanza solo). */
  hint: string;
}

export const GUIDED_QUESTIONS: GuidedQuestion[] = [
  { key: 'P1_SOLUCION', target: 'COMPRADOR', title: '¿Cómo prefieres resolverlo? (dinero, cambio o reparación)', hint: 'Falla o producto equivocado: el comprador elige.' },
  { key: 'P2_DEVOLUCION', target: 'COMPRADOR', title: 'Devuelve el producto a la tienda', hint: 'Manda la dirección de la tienda y pide que avise el despacho.' },
  { key: 'P3_RECEPCION', target: 'VENDEDOR', title: '¿Recibiste la devolución?', hint: 'La tienda confirma u objeta en 5 días hábiles.' },
  { key: 'P5_CUMPLIR', target: 'VENDEDOR', title: '¿Puedes cumplir el cambio o la reparación?', hint: 'La tienda acepta, prefiere reembolsar o pide ayuda.' },
  { key: 'P6_ENVIO', target: 'VENDEDOR', title: '¿Ya enviaste el reemplazo?', hint: 'Después de que la tienda recibió la devolución.' },
  { key: 'P4_REEMPLAZO', target: 'COMPRADOR', title: '¿Recibiste el reemplazo?', hint: 'El comprador confirma que el cambio o la reparación quedó bien.' },
];

export function guidedQuestionsFor(target: GuidedQuestionTarget): GuidedQuestion[] {
  return GUIDED_QUESTIONS.filter((question) => question.target === target);
}

export interface AttentionView {
  label: string;
  tone: 'info' | 'success' | 'warning';
}

/** Etiqueta del campo `atencionMediador` (qué espera el caso). Null si no hay flujo guiado en curso. */
export function attentionView(atencion: string | null | undefined): AttentionView | null {
  switch ((atencion ?? '').toUpperCase()) {
    case 'LISTO_PARA_RESOLVER':
      return { label: 'Listo para resolver', tone: 'success' };
    case 'NECESITA_AYUDA':
      return { label: 'Pide ayuda', tone: 'warning' };
    case 'ESPERANDO_COMPRADOR':
      return { label: 'Esperando al comprador', tone: 'info' };
    case 'ESPERANDO_TIENDA':
      return { label: 'Esperando a la tienda', tone: 'info' };
    default:
      return null;
  }
}

export type ClaimKind = 'RETRACTO' | 'FALLA' | 'NO_RECIBIDO' | 'OTRO';

/** Ayuda para el mediador según el motivo del reclamo: quién paga el flete y qué elige el comprador. */
export function claimKindHelp(kind: string | null | undefined): string | null {
  switch ((kind ?? '').toUpperCase()) {
    case 'RETRACTO':
      return 'Retracto (10 días): el comprador devuelve el producto con sus elementos originales y paga el flete. No procede si lo instaló, probó o dañó.';
    case 'FALLA':
      return 'Falla o producto equivocado (garantía legal): el comprador elige dinero, cambio o reparación; los fletes los paga la tienda.';
    case 'NO_RECIBIDO':
      return 'Producto no recibido: pide a la tienda el comprobante de despacho o el PIN de retiro antes de resolver.';
    default:
      return null;
  }
}
