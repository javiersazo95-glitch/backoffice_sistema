import { useMemo } from 'react';
import { MediationResponse, MediationStatus, ResolvedCaseResponse } from '@/types/mediation';
import Badge from '@/components/shared/Badge';
import DetailRow from '@/components/shared/DetailRow';
import ActionRow from '@/components/shared/ActionRow';
import QuickActions from '@/components/shared/QuickActions';
import UiIcon from '@/components/shared/UiIcon';
import FounderSellerName from '@/components/shared/FounderSellerName';
import { mediationStatusDisplay } from '@/utils/formatters';
import { formatDateTime } from '@/utils/formatters';

interface MediationDetailPanelProps {
  item: MediationResponse;
  onOpenReactivation: (id: number) => void;
  onOpenMediationCase: (id: number) => void;
  onOpenInitMediation: (id: number) => void;
  onOpenNote: (id: number) => void;
  onOpenNotesHistory: (id: number) => void;
  onBlockAccount: (id: number) => void;
  onOpenSellerInfo: (sellerId: number) => void;
}


function resolveBuyerName(item: MediationResponse) {
  if (item.buyer && item.buyer.trim()) return item.buyer.trim();
  const fromTitle = item.title.replace('Comprador vs ', '').trim();
  return fromTitle || 'Comprador';
}

export default function MediationDetailPanel({
  item,
  onOpenReactivation,
  onOpenMediationCase,
  onOpenNote,
  onOpenNotesHistory,
  onBlockAccount,
  onOpenSellerInfo,
}: Omit<MediationDetailPanelProps, 'onOpenInitMediation'> & { onOpenInitMediation?: (id: number) => void }) {
  const canReview = item.status === MediationStatus.EN_MEDIACION && item.mediationStarted && !item.accountBlocked;
  const canBlock = canReview && item.canBlockAccount !== false;
  const canReactivate = item.status === MediationStatus.EN_MEDIACION && item.accountBlocked;
  const blockingCode = item.blockingMediationExternalId || (item.blockingMediationId ? `MED-${item.blockingMediationId}` : '');
  const buyerName = resolveBuyerName(item);

  const daysElapsed = useMemo(() => {
    if (!item?.createdAt) return '0';
    const createdDate = new Date(item.createdAt);
    const currentDate = new Date();
    const diffTime = currentDate.getTime() - createdDate.getTime();
    const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    return `${diffDays}`;
  }, [item?.createdAt]);

  return (
    <aside className="side-panel">
      <div className="side-panel-head">
        <div>
          <strong className="blue-link">{item.externalId}</strong>
          <p className="row-sub">{item.reason}</p>
        </div>
        <Badge
          text={mediationStatusDisplay(item.status, item.accountBlocked)}
          variant={item.status}
        />
      </div>


      <div className="side-section">
        <DetailRow label="Tienda" value={<FounderSellerName name={item.sellerName} founder={item.sellerFounder} />} />
        <DetailRow label="Comprador" value={buyerName} />
        <DetailRow label="Pedido" value={item.orderId} />
        <DetailRow label="Motivo" value={item.reason} />
        <DetailRow label="Etapa del pedido" value={item.stage} />
        <DetailRow label="Responsable" value={item.owner} />
        <DetailRow label="Monto" value={item.amount} />
        <DetailRow label="Días transcurridos" value={daysElapsed} />
      </div>

      {item.accountBlocked && (
        <div className="mediation-block-notice">
          <span>
            <UiIcon name="lock" />
          </span>
          <p>
            La cuenta de la tienda está bloqueada. Considere reactivar o resolver el caso.
          </p>
        </div>
      )}

      {!item.accountBlocked && canReview && !canBlock && blockingCode && (
        <div className="mediation-block-notice">
          <span>
            <UiIcon name="lock" />
          </span>
          <p>
            La cuenta ya fue bloqueada por la mediación <strong>{blockingCode}</strong>. Este caso puede continuar, pero no permite un nuevo bloqueo.
          </p>
        </div>
      )}

      <QuickActions>
        {canReactivate && (
          <ActionRow icon="check" variant="success" onClick={() => onOpenReactivation(item.id)}>
            Reactivar cuenta
          </ActionRow>
        )}
        {canReview && (
          <ActionRow icon="scale" variant="mediation-violet" onClick={() => onOpenMediationCase(item.id)}>
            Revisar mediación
          </ActionRow>
        )}

        <ActionRow icon="note" onClick={() => onOpenNote(item.id)}>
          Notas
        </ActionRow>
        <ActionRow icon="audit" onClick={() => onOpenNotesHistory(item.id)}>
          Historial de reportes
        </ActionRow>
        {canBlock && (
          <ActionRow icon="shieldX" variant="danger" onClick={() => onBlockAccount(item.id)}>
            Bloquear cuenta
          </ActionRow>
        )}
        {!canBlock && canReview && blockingCode && (
          <ActionRow icon="lock" variant="danger" disabled>
            Bloqueo aplicado en {blockingCode}
          </ActionRow>
        )}
        <ActionRow icon="users" onClick={() => onOpenSellerInfo(item.sellerId)}>
          Ver tienda
        </ActionRow>
      </QuickActions>
    </aside>
  );
}

export function ResolvedMediationDetailPanel({
  item,
  onOpenTimeline,
  onOpenSellerInfo,
}: {
  item: ResolvedCaseResponse;
  onOpenTimeline: (item: ResolvedCaseResponse) => void;
  onOpenSellerInfo: (sellerId: number) => void;
}) {
  return (
    <aside className="side-panel">
      <div className="side-panel-head">
        <div>
          <strong className="blue-link">{item.externalId}</strong>
          <p className="row-sub">{item.reason}</p>
        </div>
        <Badge text="Resuelta" variant="green" />
      </div>
      <div className="side-section">
        <DetailRow label="Tienda" value={<FounderSellerName name={item.sellerName} founder={item.sellerFounder} />} />
        <DetailRow label="Comprador" value={item.buyer || 'No informado'} />
        <DetailRow label="Pedido" value={item.orderId} />
        <DetailRow label="Motivo" value={item.reason} />
        <DetailRow label="Resolución" value={item.resolutionReason || 'Sin resumen registrado'} />
        <DetailRow label="Resuelto por" value={item.resolvedBy || 'Mediador'} />
        <DetailRow label="Fecha de resolución" value={formatDateTime(item.createdAt)} />
        <DetailRow label="Monto" value={item.amount} />
      </div>
      <QuickActions>
        <ActionRow icon="clock" onClick={() => onOpenTimeline(item)}>Ver historial del caso</ActionRow>
        <ActionRow icon="users" onClick={() => onOpenSellerInfo(item.sellerId)}>Ver tienda</ActionRow>
      </QuickActions>
    </aside>
  );
}
