/**
 * Espejo del catálogo backend `PreguntaGuiadaCatalogo` (12-oct, flujos guiados).
 *
 * Al pedir mediador, el sistema manda solo un cuestionario con opciones para tocar (como el asistente
 * de un canal de atención): la parte elige una y el sistema envía el siguiente paso a la otra parte.
 * Toda pregunta termina en "Ninguna de estas: hablar con un mediador" (key `AYUDA`), que detiene el
 * flujo y avisa al mediador. Acá viven las keys y títulos (para retomar el cuestionario a mano), el
 * historial de pasos que lee el mediador y las soluciones que salen de las respuestas; las opciones de
 * cada mensaje llegan desde el backend en el propio mensaje.
 */

import type { MediationMessageResponse } from '@/types/mediation';
import type { MediationFavor } from '@/utils/mediationResolution';

export type GuidedQuestionTarget = 'COMPRADOR' | 'VENDEDOR';

export const HELP_OPTION_KEY = 'AYUDA';

export interface GuidedQuestion {
  key: string;
  target: GuidedQuestionTarget;
  title: string;
  /** Cuándo conviene retomarla a mano (el flujo normal la lanza solo). */
  hint: string;
}

export const GUIDED_QUESTIONS: GuidedQuestion[] = [
  { key: 'P0_NECESIDAD', target: 'COMPRADOR', title: '¿Qué necesitas resolver?', hint: 'Triage inicial: falla, producto distinto, retracto o pedido no recibido.' },
  { key: 'P1_SOLUCION', target: 'COMPRADOR', title: '¿Cómo prefieres resolverlo? (dinero, cambio o reparación)', hint: 'Falla o producto equivocado: el comprador elige.' },
  { key: 'P2_DEVOLUCION', target: 'COMPRADOR', title: 'Devuelve el producto a la tienda', hint: 'Manda la dirección de la tienda y pide que avise el despacho.' },
  { key: 'P3_RECEPCION', target: 'VENDEDOR', title: '¿Recibiste la devolución?', hint: 'La tienda confirma u objeta en 5 días hábiles.' },
  { key: 'P5_CUMPLIR', target: 'VENDEDOR', title: '¿Puedes cumplir el cambio o la reparación?', hint: 'La tienda acepta o prefiere reembolsar.' },
  { key: 'P6_ENVIO', target: 'VENDEDOR', title: '¿Ya enviaste el reemplazo?', hint: 'Después de que la tienda recibió la devolución.' },
  { key: 'P4_REEMPLAZO', target: 'COMPRADOR', title: '¿Recibiste el reemplazo?', hint: 'El comprador confirma que el cambio o la reparación quedó bien.' },
  { key: 'P7_DESPACHO', target: 'VENDEDOR', title: '¿Despachaste o entregaste el pedido?', hint: 'Pedido no recibido: la tienda acredita el despacho.' },
  { key: 'P8_LLEGADA', target: 'COMPRADOR', title: '¿Ya recibiste tu pedido?', hint: 'Después de que la tienda informó el despacho.' },
  // 13-oct: cuestionario de la tienda, oferta de reembolso y seguimiento por plazo vencido.
  { key: 'S1_TIENDA', target: 'VENDEDOR', title: '¿Qué necesitas resolver? (tienda)', hint: 'Cuando es la tienda la que pide el mediador.' },
  { key: 'B2_REEMBOLSO', target: 'COMPRADOR', title: 'La tienda propone devolverte el dinero', hint: 'El comprador dice si tiene el producto para devolverlo.' },
  { key: 'F_TIENDA_NO_RESP', target: 'COMPRADOR', title: 'La tienda no respondió a tiempo', hint: 'La manda el sistema al vencer un plazo de la tienda.' },
  { key: 'F_COMPRADOR_NO_RESP', target: 'VENDEDOR', title: 'El comprador no respondió a tiempo', hint: 'La manda el sistema al vencer un plazo del comprador.' },
];

/** 13-oct: las de seguimiento las manda solo el sistema al vencer un plazo; no se retoman a mano. */
export function isFollowUpQuestion(key: string | null | undefined): boolean {
  return key === 'F_TIENDA_NO_RESP' || key === 'F_COMPRADOR_NO_RESP';
}

export function guidedQuestionsFor(target: GuidedQuestionTarget): GuidedQuestion[] {
  return GUIDED_QUESTIONS.filter((question) => question.target === target && !isFollowUpQuestion(question.key));
}

function guidedQuestion(key: string | null | undefined): GuidedQuestion | undefined {
  return GUIDED_QUESTIONS.find((question) => question.key === key);
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
      return { label: 'Pide un mediador', tone: 'warning' };
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

/** Un paso del cuestionario: la pregunta que recibió una parte y lo que eligió (si ya respondió). */
export interface QuestionnaireStep {
  id: number;
  key: string;
  target: GuidedQuestionTarget;
  title: string;
  askedAt: string;
  answerKey: string | null;
  answerLabel: string | null;
  answerText: string | null;
  answeredAt: string | null;
  /** La parte tocó "Ninguna de estas: hablar con un mediador". */
  askedForMediator: boolean;
  /** 13-oct: plazo para responder y si venció sin respuesta. */
  deadlineText: string | null;
  expiresAt: string | null;
  expired: boolean;
}

/**
 * Pasos del cuestionario en orden, a partir de los hilos del caso. Una pregunta puede aparecer en
 * varios hilos (general y por parte), así que se deduplica por id.
 */
export function buildQuestionnaireSteps(...threads: (MediationMessageResponse[] | null | undefined)[]): QuestionnaireStep[] {
  const byId = new Map<number, MediationMessageResponse>();
  threads.forEach((thread) => (thread ?? []).forEach((message) => {
    if (message.preguntaKey) byId.set(message.id, message);
  }));
  return [...byId.values()]
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime() || left.id - right.id)
    .map((message) => {
      const known = guidedQuestion(message.preguntaKey);
      const target = (message.targetRole === 'VENDEDOR' || message.targetRole === 'COMPRADOR'
        ? message.targetRole
        : known?.target ?? 'COMPRADOR') as GuidedQuestionTarget;
      return {
        id: message.id,
        key: message.preguntaKey ?? '',
        target,
        title: message.preguntaTitulo || known?.title || message.preguntaKey || '',
        askedAt: message.createdAt,
        answerKey: message.respuestaKey ?? null,
        answerLabel: message.respuestaLabel ?? message.respuestaKey ?? null,
        answerText: message.respuestaTexto ?? null,
        answeredAt: message.respondidoAt ?? null,
        askedForMediator: message.respuestaKey === HELP_OPTION_KEY,
        deadlineText: message.plazoTexto ?? null,
        expiresAt: message.venceAt ?? null,
        expired: Boolean(message.vencida),
      };
    });
}

/** La pregunta que sigue esperando respuesta (la última sin responder), o null. */
export function pendingStep(steps: QuestionnaireStep[]): QuestionnaireStep | null {
  return [...steps].reverse().find((step) => !step.answerKey) ?? null;
}

/** Lo que eligió el comprador: DINERO por defecto, CAMBIO o REPARACION en P1, DINERO si la tienda prefirió reembolsar. */
function eleccionDe(steps: QuestionnaireStep[]): 'DINERO' | 'CAMBIO' | 'REPARACION' {
  let eleccion: 'DINERO' | 'CAMBIO' | 'REPARACION' = 'DINERO';
  steps.forEach((step) => {
    if (step.key === 'P1_SOLUCION' && step.answerKey === 'CAMBIO') eleccion = 'CAMBIO';
    else if (step.key === 'P1_SOLUCION' && step.answerKey === 'REPARACION') eleccion = 'REPARACION';
    else if (step.key === 'P1_SOLUCION' && step.answerKey === 'DINERO') eleccion = 'DINERO';
    else if (step.key === 'P5_CUMPLIR' && step.answerKey === 'REEMBOLSAR') eleccion = 'DINERO';
    else if (step.key === 'B2_REEMBOLSO' || (step.key === 'F_TIENDA_NO_RESP' && step.answerKey === 'REEMBOLSO')) eleccion = 'DINERO';
  });
  return eleccion;
}

function esRetracto(steps: QuestionnaireStep[], claimKind: string | null | undefined): boolean {
  const necesidad = steps.find((step) => step.key === 'P0_NECESIDAD' && step.answerKey && step.answerKey !== HELP_OPTION_KEY);
  if (necesidad) return necesidad.answerKey === 'RETRACTO';
  return (claimKind ?? '').toUpperCase() === 'RETRACTO';
}

/** Una solución posible para el veredicto, con la figura legal de `mediationResolution`. */
export interface PossibleSolution {
  optionKey: string;
  favor: MediationFavor;
  /** Por qué sale de las respuestas del cuestionario. */
  why: string;
  recommended: boolean;
}

function solution(optionKey: string, favor: MediationFavor, why: string, recommended = false): PossibleSolution {
  return { optionKey, favor, why, recommended };
}

/**
 * Soluciones que se desprenden de lo que respondieron las partes, con la recomendada primero. Mira la
 * última respuesta (la que cerró o detuvo el flujo) y lo que eligió el comprador en el camino. Vacío
 * si el cuestionario sigue en curso sin nada que resolver todavía.
 */
export function possibleSolutions(steps: QuestionnaireStep[], claimKind?: string | null): PossibleSolution[] {
  const answered = steps.filter((step) => step.answerKey);
  const last = answered[answered.length - 1];
  if (!last) return [];
  const eleccion = eleccionDe(steps);
  const retracto = esRetracto(steps, claimKind);
  const detalle = last.answerText ? ` («${last.answerText}»)` : '';

  switch (`${last.key}:${last.answerKey}`) {
    case 'P3_RECEPCION:BUEN_ESTADO':
      return eleccion === 'DINERO'
        ? [solution('REEMBOLSO_TOTAL', 'COMPRADOR', 'La tienda confirmó que recibió la devolución en buen estado.', true)]
        : [];
    case 'P3_RECEPCION:CON_DANOS':
      return retracto
        ? [
            solution('RETRACTO_NO_PROCEDE', 'VENDEDOR', `La tienda informa que la devolución llegó dañada o incompleta${detalle}: revisa las fotos.`, true),
            solution('REEMBOLSO_PARCIAL', 'COMPRADOR', 'Si el daño es menor, una rebaja proporcional compensa a la tienda.'),
            solution('REEMBOLSO_TOTAL', 'COMPRADOR', 'Si las fotos no acreditan un daño imputable al comprador.'),
          ]
        : [
            solution('REEMBOLSO_PARCIAL', 'COMPRADOR', `La tienda objeta el estado de la devolución${detalle}: una rebaja proporcional reparte el daño.`, true),
            solution('REEMBOLSO_TOTAL', 'COMPRADOR', 'Si las fotos no acreditan un daño causado por el comprador.'),
            solution('RECLAMO_RECHAZADO_PRODUCTO_CONFORME', 'VENDEDOR', 'Si el daño de la devolución explica la falla reclamada.'),
          ];
    case 'P4_REEMPLAZO:OK':
      return eleccion === 'REPARACION'
        ? [solution('REPARACION_GRATUITA', 'COMPRADOR', 'El comprador confirmó que recibió el producto reparado conforme.', true)]
        : [solution('REPOSICION_PRODUCTO', 'COMPRADOR', 'El comprador confirmó que recibió el reemplazo conforme.', true)];
    case 'P4_REEMPLAZO:PROBLEMA':
      return [
        solution('REEMBOLSO_TOTAL', 'COMPRADOR', `El reemplazo sigue con problemas${detalle}: la garantía permite pedir la devolución de lo pagado.`, true),
        solution('REEMBOLSO_PARCIAL', 'COMPRADOR', 'Si el problema es menor y el comprador acepta quedarse con el producto.'),
      ];
    case 'P4_REEMPLAZO:NO_LLEGA':
    case 'P8_LLEGADA:NO_LLEGA':
      return [
        solution('REEMBOLSO_TOTAL', 'COMPRADOR', 'El producto no llega: pide el seguimiento a la tienda antes de resolver.', true),
        solution('ENTREGA_CONFORME_ACREDITADA', 'VENDEDOR', 'Solo si la tienda acredita la entrega con el seguimiento del courier.'),
      ];
    case 'P7_DESPACHO:NO_DESPACHADO':
      return [solution('REEMBOLSO_TOTAL', 'COMPRADOR', 'La tienda indicó que no despachó el pedido y prefiere devolver el dinero.', true)];
    case 'P8_LLEGADA:OK':
      return [solution('ENTREGA_CONFORME_ACREDITADA', 'VENDEDOR', 'El comprador confirmó que recibió el pedido conforme.', true)];
    default:
      break;
  }

  if (!last.askedForMediator) return [];
  // Alguien pidió un mediador: las salidas posibles según en qué paso se detuvo el flujo.
  const quien = last.target === 'COMPRADOR' ? 'El comprador' : 'La tienda';
  const motivo = `${quien} pidió un mediador en «${last.title}»${detalle}.`;
  if (last.target === 'VENDEDOR' && ['P5_CUMPLIR', 'P6_ENVIO'].includes(last.key)) {
    return [
      solution('REEMBOLSO_TOTAL', 'COMPRADOR', `${motivo} Si la tienda no puede cumplir, corresponde devolver lo pagado.`, true),
    ];
  }
  if (last.key === 'P7_DESPACHO' || (claimKind ?? '').toUpperCase() === 'NO_RECIBIDO') {
    return [
      solution('REEMBOLSO_TOTAL', 'COMPRADOR', `${motivo} Sin comprobante de despacho, corresponde devolver lo pagado.`, true),
      solution('ENTREGA_CONFORME_ACREDITADA', 'VENDEDOR', 'Si la tienda acredita la entrega.'),
    ];
  }
  if (retracto) {
    return [
      solution('REEMBOLSO_TOTAL', 'COMPRADOR', `${motivo} Cuando la tienda reciba la devolución en buen estado.`, true),
      solution('RETRACTO_NO_PROCEDE', 'VENDEDOR', 'Si el repuesto fue instalado, usado o dañado, o pasaron más de 10 días.'),
      solution('RECLAMO_FUERA_DE_PLAZO', 'VENDEDOR', 'Si el retracto se pidió fuera de plazo.'),
    ];
  }
  return [
    solution('REEMBOLSO_TOTAL', 'COMPRADOR', `${motivo} Si la falla o diferencia está acreditada.`, true),
    solution('REEMBOLSO_PARCIAL', 'COMPRADOR', 'Si la diferencia es parcial y el comprador se queda con el producto.'),
    solution('RECLAMO_RECHAZADO_PRODUCTO_CONFORME', 'VENDEDOR', 'Si las evidencias no acreditan una falla ni una diferencia.'),
  ];
}
