import type { Insight } from '@/components/dashboard/kit';
import { CATEGORY_LABELS } from './support.metrics';

export interface SupportInsightInput {
  unanswered: number;
  unansweredOver24h: number;
  slaBreached: number;
  slaBreachedByCategory: Record<string, number>;
  criticalUnanswered: number;
  cargaEsperando: number;
  cargaNoLeidos: number;
  qaPending: number;
  qaCritical: number;
}

const plural = (n: number, singular: string, pluralForm: string) => (n === 1 ? singular : pluralForm);

/** Sugerencias del dia para Soporte, de lo mas urgente a lo informativo. Maximo cuatro. */
export function buildSupportInsights(input: SupportInsightInput): Insight[] {
  const items: Insight[] = [];

  if (input.criticalUnanswered > 0) {
    items.push({
      id: 'criticos',
      tone: 'alert',
      text: `${input.criticalUnanswered} ${plural(input.criticalUnanswered, 'ticket crítico sigue', 'tickets críticos siguen')} sin respuesta. Si es un problema de pago o de acceso, responde primero y avisa a infraestructura.`,
      actionLabel: 'Ver críticos',
      to: '/soporte/tickets?status=ABIERTO&priority=CRITICA',
    });
  }

  if (input.slaBreached > 0) {
    const detalle = Object.entries(input.slaBreachedByCategory)
      .map(([category, count]) => `${count} de ${(CATEGORY_LABELS[category] ?? category).toLowerCase()}`)
      .join(', ');
    items.push({
      id: 'fuera-de-plazo',
      tone: 'alert',
      text: `${input.slaBreached} ${plural(input.slaBreached, 'ticket ya pasó', 'tickets ya pasaron')} su plazo de respuesta (${detalle}). El plazo es 24 h para fallas técnicas, 48 h para ayuda y 72 h para consultas.`,
      actionLabel: 'Responder ahora',
      to: '/soporte/tickets?status=ABIERTO',
    });
  } else if (input.unansweredOver24h > 0) {
    items.push({
      id: 'sin-responder-24h',
      tone: 'warn',
      text: `${input.unansweredOver24h} ${plural(input.unansweredOver24h, 'ticket lleva', 'tickets llevan')} más de 24 horas sin respuesta. Empieza por los más antiguos de la lista.`,
      actionLabel: 'Ver sin responder',
      to: '/soporte/tickets?status=ABIERTO',
    });
  } else if (input.unanswered > 0) {
    items.push({
      id: 'sin-responder',
      tone: 'ok',
      text: `${input.unanswered} ${plural(input.unanswered, 'ticket nuevo espera', 'tickets nuevos esperan')} una primera respuesta y todos están dentro del plazo.`,
      actionLabel: 'Ver sin responder',
      to: '/soporte/tickets?status=ABIERTO',
    });
  }

  if (input.cargaEsperando > 0 || input.cargaNoLeidos > 0) {
    items.push({
      id: 'carga',
      tone: input.cargaEsperando > 0 ? 'warn' : 'ok',
      text: input.cargaEsperando > 0
        ? `${input.cargaEsperando} ${plural(input.cargaEsperando, 'vendedor espera', 'vendedores esperan')} ayuda con la carga de inventario${input.cargaNoLeidos ? ` (${input.cargaNoLeidos} ${plural(input.cargaNoLeidos, 'mensaje sin leer', 'mensajes sin leer')})` : ''}. Un chat sin respuesta de soporte se cierra solo a las 24 h.`
        : `Tienes ${input.cargaNoLeidos} ${plural(input.cargaNoLeidos, 'mensaje sin leer', 'mensajes sin leer')} en los chats de carga de inventario.`,
      actionLabel: 'Abrir chats',
      to: '/soporte/carga-inventario',
    });
  }

  if (input.qaCritical > 0) {
    items.push({
      id: 'qa-criticos',
      tone: 'warn',
      text: `QA reportó ${input.qaCritical} ${plural(input.qaCritical, 'defecto crítico', 'defectos críticos')} sin resolver. Confirma si afectan a usuarios reales antes de priorizar el resto.`,
      actionLabel: 'Ver reportes QA',
      to: '/soporte/qa-reports',
    });
  } else if (input.qaPending > 0) {
    items.push({
      id: 'qa',
      tone: 'ok',
      text: `Hay ${input.qaPending} ${plural(input.qaPending, 'defecto de QA pendiente', 'defectos de QA pendientes')}, ninguno crítico.`,
      actionLabel: 'Ver reportes QA',
      to: '/soporte/qa-reports',
    });
  }

  if (items.length === 0) {
    items.push({ id: 'ok', tone: 'ok', text: 'Bandeja al día: no hay tickets sin responder ni chats de carga esperando. Aprovecha para cerrar los resueltos antiguos.' });
  }

  return items.slice(0, 4);
}
