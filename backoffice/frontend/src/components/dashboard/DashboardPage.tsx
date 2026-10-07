import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import * as mediationsApi from '@/api/mediations';
import * as reportsApi from '@/api/reports';
import * as validationsApi from '@/api/validations';
import * as alertsApi from '@/api/alerts';
import * as receiptsApi from '@/api/receipts';
import * as sellersApi from '@/api/sellers';
import { useDashboardSummary } from '@/hooks/useDashboard';
import Badge from '@/components/shared/Badge';
import AreaHomeShortcut from '@/components/shared/AreaHomeShortcut';
import UiIcon from '@/components/shared/UiIcon';
import QueryErrorNotice from '@/components/shared/QueryErrorNotice';
import { KpiTile, ActionQueue, InsightList, MiniBars } from '@/components/dashboard/kit';
import { fetchAllPages } from '@/utils/pagination';
import { daysSince, hoursSince, formatAge, hoyChile } from '@/utils/age';
import { formatCurrency, trustLevelToSpanish } from '@/utils/formatters';
import { AlertSeverity } from '@/types/alert';
import { ValidationStatus } from '@/types/validation';
import type { MediationResponse } from '@/types/mediation';
import { buildTrustInsights } from './trust.insights';

/** Umbrales de antiguedad de una mediacion, los mismos que usa la pagina de Mediaciones. */
const MEDIATION_WARN_DAYS = 2;
const MEDIATION_CRIT_DAYS = 5;
const VALIDATION_WARN_DAYS = 3;

function trustTone(score: number) {
  if (score >= 70) return 'green';
  if (score >= 40) return 'amber';
  return 'red';
}

function escalationLevel(days: number) {
  if (days >= MEDIATION_CRIT_DAYS) return 'Crítica';
  if (days >= MEDIATION_WARN_DAYS) return 'Alta';
  return 'Media';
}

function byCreatedAtAsc<T extends { createdAt?: string | null }>(a: T, b: T) {
  return (Date.parse(a.createdAt ?? '') || 0) - (Date.parse(b.createdAt ?? '') || 0);
}

/**
 * Resumen de Mediacion y Confianza para moderadores.
 *
 * Cada numero responde "que atiendo ahora", lleva a la pantalla donde se actua y explica en el
 * icono i que hacer con el. Las cifras salen de /dashboard/summary y, para la antiguedad de los
 * casos, de los listados completos (hasta que el backend entregue las claves de urgencia, que se
 * usan primero si llegan).
 */
export default function DashboardPage() {
  const navigate = useNavigate();
  const summary = useDashboardSummary();
  const data = summary.data;

  const mediations = useQuery({
    queryKey: ['dashboard', 'mediations-active'],
    queryFn: async () => {
      const page = await fetchAllPages((p, s) => mediationsApi.getMediations({ activeOnly: true, blocked: false, page: p, size: s }));
      return [...page.content].sort(byCreatedAtAsc);
    },
    staleTime: 60_000,
  });

  const alerts = useQuery({
    queryKey: ['dashboard', 'alerts-unreviewed'],
    queryFn: async () => {
      const page = await fetchAllPages((p, s) => alertsApi.getAlerts(undefined, undefined, p, s));
      return page.content.filter((alert) => !alert.reviewed).sort(byCreatedAtAsc);
    },
    staleTime: 60_000,
  });

  const receipts = useQuery({
    queryKey: ['dashboard', 'receipts-pending'],
    queryFn: () => receiptsApi.getReceipts(0, 50),
    staleTime: 60_000,
  });

  const validations = useQuery({
    queryKey: ['dashboard', 'validations-pending'],
    queryFn: async () => {
      const page = await fetchAllPages((p, s) => validationsApi.getValidations(p, s));
      // Una fila por documento: se cuenta una vez por tienda, con la fecha de subida mas antigua.
      const bySeller = new Map<number, string>();
      page.content
        .filter((row) => row.status === ValidationStatus.PENDIENTE)
        .forEach((row) => {
          const current = bySeller.get(row.sellerId);
          if (!current || (row.uploadedAt && row.uploadedAt < current)) bySeller.set(row.sellerId, row.uploadedAt ?? '');
        });
      return Array.from(bySeller.entries()).map(([sellerId, uploadedAt]) => ({ sellerId, uploadedAt }));
    },
    staleTime: 60_000,
  });

  const reportsToday = useQuery({
    queryKey: ['dashboard', 'reports-today', hoyChile()],
    queryFn: async () => (await reportsApi.getReports({ startDate: hoyChile(), endDate: hoyChile(), page: 0, size: 1 })).totalElements,
    staleTime: 60_000,
  });

  const suspended = useQuery({
    queryKey: ['dashboard', 'sellers-suspended'],
    queryFn: async () => (await sellersApi.getSellers({ status: 'SUSPENDIDO', page: 0, size: 1 })).totalElements,
    staleTime: 60_000,
  });

  // --- Cifras (backend primero, calculo local de respaldo) ---------------------------------
  const activeList = mediations.data ?? [];
  const over5Local = activeList.filter((m) => (daysSince(m.createdAt) ?? 0) >= MEDIATION_CRIT_DAYS).length;
  const between2And5Local = activeList.filter((m) => { const d = daysSince(m.createdAt) ?? 0; return d >= MEDIATION_WARN_DAYS && d < MEDIATION_CRIT_DAYS; }).length;
  const over5 = data?.mediationsOver5Days ?? (mediations.data ? over5Local : null);
  const between2And5 = data?.mediationsOver2Days !== undefined && data?.mediationsOver5Days !== undefined
    ? data.mediationsOver2Days - data.mediationsOver5Days
    : (mediations.data ? between2And5Local : null);
  const activeCount = mediations.data ? activeList.length : (data?.openMediations ?? null);

  const unreviewed = alerts.data ?? [];
  const countSeverity = (severity: AlertSeverity) => unreviewed.filter((a) => a.severity === severity).length;
  const critical = data?.criticalAlerts ?? data?.alertsUnreviewedCritica ?? (alerts.data ? countSeverity(AlertSeverity.CRITICA) : null);
  const alta = data?.alertsUnreviewedAlta ?? (alerts.data ? countSeverity(AlertSeverity.ALTA) : null);
  const media = data?.alertsUnreviewedMedia ?? (alerts.data ? countSeverity(AlertSeverity.MEDIA) : null);

  const validationsPending = data?.validationsPending ?? (validations.data ? validations.data.length : null);
  const validationsOver3 = data?.validationsPendingOver3Days
    ?? (validations.data ? validations.data.filter((v) => (daysSince(v.uploadedAt) ?? 0) >= VALIDATION_WARN_DAYS).length : null);

  const receiptRows = receipts.data?.content ?? [];
  const receiptsPending = data?.receiptFollowups ?? (receipts.data ? receipts.data.totalElements : null);
  const receiptsOverdue = data?.receiptsOverdue ?? (receipts.data ? receiptRows.filter((r) => r.dueAt && Date.parse(r.dueAt) < Date.now()).length : null);

  const reportsTodayCount = data?.reportsToday ?? reportsToday.data ?? null;
  const suspendedCount = data?.suspendedSellers ?? suspended.data ?? null;

  const trustScore = data?.trustScore ?? 0;
  const trustLevel = trustLevelToSpanish(data?.trustLevel ?? 'MEDIO');

  const insights = useMemo(() => buildTrustInsights({
    mediationsOver5: over5 ?? 0,
    mediationsBetween2And5: between2And5 ?? 0,
    criticalUnreviewed: critical ?? 0,
    altaUnreviewed: alta ?? 0,
    validationsOver3Days: validationsOver3 ?? 0,
    validationsPending: validationsPending ?? 0,
    receiptsOverdue: receiptsOverdue ?? 0,
    reportsToday: reportsTodayCount ?? 0,
    suspended: suspendedCount ?? 0,
  }), [over5, between2And5, critical, alta, validationsOver3, validationsPending, receiptsOverdue, reportsTodayCount, suspendedCount]);

  const loadingAny = summary.isLoading || mediations.isLoading || alerts.isLoading;

  const oldestMediations = activeList.slice(0, 5).map((m: MediationResponse) => {
    const days = daysSince(m.createdAt) ?? 0;
    return {
      id: m.id,
      title: `${m.externalId} · Pedido ${m.orderId}`,
      subtitle: `${m.sellerName} · ${m.reason || m.title}`,
      ageLabel: formatAge(m.createdAt),
      ageTone: (days >= MEDIATION_CRIT_DAYS ? 'red' : days >= MEDIATION_WARN_DAYS ? 'amber' : 'blue') as 'red' | 'amber' | 'blue',
      badge: <Badge text={escalationLevel(days)} variant={days >= MEDIATION_CRIT_DAYS ? 'red' : days >= MEDIATION_WARN_DAYS ? 'amber' : 'blue'} />,
      amount: formatCurrency(m.amount),
      onOpen: () => navigate(`/confianza/mediations/${m.id}`),
    };
  });

  const criticalAlerts = unreviewed.filter((a) => a.severity === AlertSeverity.CRITICA).slice(0, 5).map((a) => {
    const hours = hoursSince(a.createdAt) ?? 0;
    return {
      id: a.id,
      title: a.signalType,
      subtitle: `${a.sellerName}${a.impact ? ` · ${a.impact}` : ''}`,
      ageLabel: formatAge(a.createdAt),
      ageTone: (hours >= 48 ? 'red' : hours >= 24 ? 'amber' : 'blue') as 'red' | 'amber' | 'blue',
      badge: <Badge text="Crítica" variant="red" />,
      onOpen: () => navigate(`/confianza/alertas?severity=CRITICA&alerta=${a.id}`),
      openLabel: 'Revisar',
    };
  });

  return (
    <>
      {summary.isError && <QueryErrorNotice error={summary.error} what="los indicadores del panel" onRetry={summary.refetch} />}

      <section className={`trust-command-hero tone-${trustTone(trustScore)}`}>
        <div className="trust-command-copy">
          <span className="trust-hero-eyebrow"><UiIcon name="scale" /> Mediación y Confianza</span>
          <h1>Qué atender hoy</h1>
          <p>Los números de abajo son casos que esperan una decisión tuya. Haz clic en cualquiera para ir directo a la pantalla donde se resuelve; el icono <UiIcon name="info" /> explica qué hacer.</p>
        </div>
        <div className="trust-command-actions">
          <AreaHomeShortcut />
          <div className="trust-command-score" aria-label={`Nivel de confianza ${trustScore}%`}>
            <div className="trust-score-orbit" style={{ background: `conic-gradient(var(--tone) 0 ${trustScore}%, rgba(37,99,235,.08) ${trustScore}% 100%)` }}>
              <div className="trust-score-core"><strong>{summary.isLoading ? '…' : `${trustScore}%`}</strong></div>
            </div>
            <div className="trust-score-summary">
              <span className="trust-score-summary-icon"><UiIcon name="scale" /></span>
              <strong>Confianza {trustLevel}</strong>
              <span className="metric-info-tooltip" tabIndex={0}><UiIcon name="info" /><span className="metric-info-tooltip-content"><strong>Índice de confianza</strong><p>Promedio del puntaje de confianza de las tiendas aprobadas (0 a 100). Es informativo: sube cuando las tiendas acumulan ventas sin reclamos y baja con mediaciones perdidas y suspensiones.</p></span></span>
            </div>
          </div>
        </div>
      </section>

      <div className="dash-row-title"><h2>Pendientes ahora</h2><span>Ordenados por urgencia</span></div>
      <section className="dash-kpi-row" aria-label="Pendientes">
        <KpiTile
          label="Mediaciones con más de 5 días"
          value={over5}
          tone="red"
          urgent
          iconName="scale"
          to="/confianza/mediations"
          secondary={between2And5 !== null && activeCount !== null ? `${between2And5} entre 2 y 5 días · ${activeCount} activas` : undefined}
          loading={mediations.isLoading && data?.mediationsOver5Days === undefined}
          error={mediations.isError && data?.mediationsOver5Days === undefined ? mediations.error : undefined}
          onRetry={mediations.refetch}
          infoContent={<><strong>Qué hacer</strong><p>El comprador ya pagó y lleva más de 5 días esperando. Entra a la mediación, revisa las pruebas de ambos y resuelve a favor de uno, o bloquea la tienda si no responde.</p></>}
        />
        <KpiTile
          label="Alertas críticas sin revisar"
          value={critical}
          tone="red"
          urgent
          iconName="alert"
          to="/confianza/alertas?severity=CRITICA"
          secondary={alta !== null && media !== null ? `${alta} altas · ${media} medias sin revisar` : undefined}
          loading={summary.isLoading && alerts.isLoading}
          error={summary.isError && alerts.isError ? alerts.error : undefined}
          onRetry={() => { void summary.refetch(); void alerts.refetch(); }}
          infoContent={<><strong>Qué hacer</strong><p>Son señales de riesgo sobre una tienda (reembolsos fallidos, reclamos repetidos). Abre la alerta, lee la evidencia y márcala como revisada; si amerita, escálala a mediación desde ahí mismo.</p></>}
        />
        <KpiTile
          label="Validaciones pendientes"
          value={validationsPending}
          tone="amber"
          iconName="fileCheck"
          to="/confianza/validations"
          secondary={validationsOver3 !== null ? `${validationsOver3} con más de 3 días de espera` : undefined}
          loading={summary.isLoading && validations.isLoading}
          error={summary.isError && validations.isError ? validations.error : undefined}
          onRetry={() => { void summary.refetch(); void validations.refetch(); }}
          infoContent={<><strong>Qué hacer</strong><p>Tiendas nuevas que subieron sus documentos (RUT, cédula, inicio de actividades) y no pueden vender hasta que las apruebes. Revisa cada documento y aprueba, pide corrección o rechaza.</p></>}
        />
        <KpiTile
          label="Boletas de venta por vencer"
          value={receiptsPending}
          tone={receiptsOverdue ? 'red' : 'amber'}
          iconName="receipt"
          to="/confianza/alertas"
          secondary={receiptsOverdue !== null ? `${receiptsOverdue} ya vencidas` : undefined}
          loading={summary.isLoading && receipts.isLoading}
          error={summary.isError && receipts.isError ? receipts.error : undefined}
          onRetry={() => { void summary.refetch(); void receipts.refetch(); }}
          infoContent={<><strong>Qué hacer</strong><p>Ventas finalizadas cuya boleta el vendedor todavía no sube. Antes del vencimiento, pídesela por el canal de la tienda; cuando llegue, marca el seguimiento como resuelto en el panel de Alertas.</p></>}
        />
        <KpiTile
          label="Reportes de usuarios hoy"
          value={reportsTodayCount}
          tone="violet"
          iconName="flag"
          to="/confianza/reports"
          loading={reportsToday.isLoading && data?.reportsToday === undefined}
          error={reportsToday.isError && data?.reportsToday === undefined ? reportsToday.error : undefined}
          onRetry={reportsToday.refetch}
          infoContent={<><strong>Qué hacer</strong><p>Reportes que compradores y vendedores enviaron hoy sobre anuncios, productos, tiendas o chats. Si varios apuntan a la misma tienda, abre una alerta de riesgo o una mediación.</p></>}
        />
        <KpiTile
          label="Tiendas suspendidas"
          value={suspendedCount}
          tone="muted"
          iconName="shieldX"
          to="/confianza/mediations?tab=blocked"
          loading={summary.isLoading && suspended.isLoading}
          error={summary.isError && suspended.isError ? suspended.error : undefined}
          onRetry={() => { void summary.refetch(); void suspended.refetch(); }}
          infoContent={<><strong>Qué hacer</strong><p>Tiendas que hoy no pueden vender por una suspensión. En la pestaña Bloqueos de Mediaciones ves el motivo, el nivel (temporal, definitiva o fraude), si apelaron y cuándo termina.</p></>}
        />
      </section>

      <InsightList items={insights} loading={loadingAny} />

      <section className="dash-grid">
        <ActionQueue
          title="Mediaciones más antiguas"
          help={<><strong>Por dónde empezar</strong><p>Las cinco mediaciones activas que llevan más tiempo abiertas. Más de 2 días es "Alta" y más de 5 es "Crítica".</p></>}
          items={oldestMediations}
          loading={mediations.isLoading}
          error={mediations.isError ? mediations.error : undefined}
          onRetry={mediations.refetch}
          what="las mediaciones activas"
          emptyText="No hay mediaciones activas."
          seeAllTo="/confianza/mediations"
        />
        <ActionQueue
          title="Alertas críticas sin revisar"
          help={<><strong>Por dónde empezar</strong><p>Las alertas de severidad crítica más antiguas que nadie ha revisado todavía.</p></>}
          items={criticalAlerts}
          loading={alerts.isLoading}
          error={alerts.isError ? alerts.error : undefined}
          onRetry={alerts.refetch}
          what="las alertas"
          emptyText="No hay alertas críticas sin revisar."
          seeAllTo="/confianza/alertas?severity=CRITICA"
        />
      </section>

      <section className="dash-grid">
        <MiniBars
          title="Mediaciones activas por antigüedad"
          help={<p>Cuántas mediaciones activas hay en cada tramo de días desde que se abrieron.</p>}
          loading={mediations.isLoading}
          items={[
            { key: 'nuevas', label: 'Menos de 2 días', value: activeList.length - between2And5Local - over5Local, tone: 'blue', to: '/confianza/mediations' },
            { key: 'altas', label: 'Entre 2 y 5 días', value: between2And5Local, tone: 'amber', to: '/confianza/mediations' },
            { key: 'criticas', label: 'Más de 5 días', value: over5Local, tone: 'red', to: '/confianza/mediations' },
          ]}
          emptyText="No hay mediaciones activas."
        />
        <MiniBars
          title="Alertas sin revisar por severidad"
          loading={alerts.isLoading}
          items={[
            { key: 'critica', label: 'Críticas', value: critical ?? 0, tone: 'red', to: '/confianza/alertas?severity=CRITICA' },
            { key: 'alta', label: 'Altas', value: alta ?? 0, tone: 'amber', to: '/confianza/alertas?severity=ALTA' },
            { key: 'media', label: 'Medias', value: media ?? 0, tone: 'blue', to: '/confianza/alertas?severity=MEDIA' },
          ]}
          emptyText="No hay alertas pendientes de revisión."
        />
        <MiniBars
          title="Documentos de tiendas"
          help={<p>Estado de las solicitudes de registro: pendientes de revisar, devueltas para corregir y rechazadas.</p>}
          loading={summary.isLoading}
          items={[
            { key: 'pendientes', label: 'Pendientes', value: data?.validationsPending ?? 0, tone: 'amber', to: '/confianza/validations' },
            { key: 'corregir', label: 'Por corregir', value: data?.validationsCorrection ?? 0, tone: 'violet', to: '/confianza/validations' },
            { key: 'rechazadas', label: 'Rechazadas', value: data?.validationsRejected ?? 0, tone: 'red', to: '/confianza/validations' },
            { key: 'aprobadas', label: 'Aprobadas', value: data?.validationsApproved ?? 0, tone: 'green', to: '/confianza/sellers' },
          ]}
          emptyText="Sin solicitudes de registro."
        />
        <MiniBars
          title="Boletas en seguimiento"
          loading={receipts.isLoading}
          items={[
            { key: 'vencidas', label: 'Vencidas', value: receiptsOverdue ?? 0, tone: 'red', to: '/confianza/alertas' },
            { key: 'porvencer', label: 'Dentro de plazo', value: Math.max(0, (receiptsPending ?? 0) - (receiptsOverdue ?? 0)), tone: 'amber', to: '/confianza/alertas' },
          ]}
          emptyText="No hay boletas pendientes."
        />
      </section>
    </>
  );
}
