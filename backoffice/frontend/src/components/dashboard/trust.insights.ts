import type { Insight } from '@/components/dashboard/kit';

export interface TrustInsightInput {
  mediationsOver5: number;
  mediationsBetween2And5: number;
  criticalUnreviewed: number;
  altaUnreviewed: number;
  validationsOver3Days: number;
  validationsPending: number;
  reportsToday: number;
  suspended: number;
}

const plural = (n: number, singular: string, pluralForm: string) => (n === 1 ? singular : pluralForm);

/**
 * Sugerencias del dia para Mediacion y Confianza. Son reglas fijas y explicitas, en el orden en
 * que conviene atenderlas: primero lo que perjudica a un comprador que ya pago, despues lo que
 * frena a una tienda, y al final lo informativo.
 */
export function buildTrustInsights(input: TrustInsightInput): Insight[] {
  const items: Insight[] = [];

  if (input.mediationsOver5 > 0) {
    items.push({
      id: 'mediaciones-5d',
      tone: 'alert',
      text: `${input.mediationsOver5} ${plural(input.mediationsOver5, 'mediación lleva', 'mediaciones llevan')} más de 5 días abiertas. El comprador ya pagó y sigue esperando: resuélvelas hoy o bloquea la tienda si no responde.`,
      actionLabel: 'Ver mediaciones',
      to: '/confianza/mediations',
    });
  } else if (input.mediationsBetween2And5 > 0) {
    items.push({
      id: 'mediaciones-2d',
      tone: 'warn',
      text: `${input.mediationsBetween2And5} ${plural(input.mediationsBetween2And5, 'mediación tiene', 'mediaciones tienen')} entre 2 y 5 días. Revisa si la tienda ya respondió para que no pasen a críticas.`,
      actionLabel: 'Ver mediaciones',
      to: '/confianza/mediations',
    });
  }

  if (input.criticalUnreviewed > 0) {
    items.push({
      id: 'alertas-criticas',
      tone: 'alert',
      text: `Hay ${input.criticalUnreviewed} ${plural(input.criticalUnreviewed, 'alerta crítica', 'alertas críticas')} sin revisar. Mira la evidencia y, si corresponde, escálala a mediación desde la misma alerta.`,
      actionLabel: 'Revisar alertas',
      to: '/confianza/alertas?severity=CRITICA',
    });
  } else if (input.altaUnreviewed > 0) {
    items.push({
      id: 'alertas-altas',
      tone: 'warn',
      text: `${input.altaUnreviewed} ${plural(input.altaUnreviewed, 'alerta de severidad alta espera', 'alertas de severidad alta esperan')} revisión.`,
      actionLabel: 'Revisar alertas',
      to: '/confianza/alertas?severity=ALTA',
    });
  }

  if (input.validationsOver3Days > 0) {
    items.push({
      id: 'validaciones-3d',
      tone: 'warn',
      text: `${input.validationsOver3Days} ${plural(input.validationsOver3Days, 'tienda lleva', 'tiendas llevan')} más de 3 días esperando que se revisen sus documentos. Mientras tanto no pueden vender.`,
      actionLabel: 'Validar documentos',
      to: '/confianza/validations',
    });
  } else if (input.validationsPending > 0) {
    items.push({
      id: 'validaciones',
      tone: 'ok',
      text: `${input.validationsPending} ${plural(input.validationsPending, 'solicitud de registro está', 'solicitudes de registro están')} dentro del plazo. Revísalas cuando termines lo urgente.`,
      actionLabel: 'Validar documentos',
      to: '/confianza/validations',
    });
  }

  if (input.reportsToday >= 3) {
    items.push({
      id: 'reportes-hoy',
      tone: 'warn',
      text: `Hoy entraron ${input.reportsToday} reportes de usuarios. Si varios apuntan a la misma tienda o anuncio, conviene abrir una alerta de riesgo.`,
      actionLabel: 'Ver reportes',
      to: '/confianza/reports',
    });
  }

  if (input.suspended > 0) {
    items.push({
      id: 'suspendidas',
      tone: 'ok',
      text: `${input.suspended} ${plural(input.suspended, 'tienda está suspendida', 'tiendas están suspendidas')}. Revisa si alguna apeló o si ya se cumplió la fecha de fin de la suspensión.`,
      actionLabel: 'Ver tiendas',
      to: '/confianza/sellers?status=SUSPENDIDO',
    });
  }

  if (items.length === 0) {
    items.push({ id: 'ok', tone: 'ok', text: 'No hay nada urgente: sin mediaciones viejas ni alertas críticas. Buen momento para revisar validaciones pendientes y reportes.' });
  }

  return items.slice(0, 4);
}
