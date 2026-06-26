import { MediationResponse, MediationStatus } from '@/types/mediation';
import Badge from '@/components/shared/Badge';
import DetailRow from '@/components/shared/DetailRow';
import ActionRow from '@/components/shared/ActionRow';
import QuickActions from '@/components/shared/QuickActions';
import Timeline from '@/components/shared/Timeline';
import TimelineItem from '@/components/shared/TimelineItem';
import UiIcon from '@/components/shared/UiIcon';
import { mediationStatusDisplay } from '@/utils/formatters';

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

export default function MediationDetailPanel({
  item,
  onOpenReactivation,
  onOpenMediationCase,
  onOpenInitMediation,
  onOpenNote,
  onOpenNotesHistory,
  onBlockAccount,
  onOpenSellerInfo,
}: MediationDetailPanelProps) {
  const canInitialize = item.status === MediationStatus.ESPERANDO_VENDEDOR && !item.mediationStarted;
  const canReview = item.status === MediationStatus.EN_MEDIACION && item.mediationStarted && !item.accountBlocked;
  const canBlock = canReview && item.canBlockAccount !== false;
  const canReactivate = item.status === MediationStatus.EN_MEDIACION && item.accountBlocked;
  const blockingCode = item.blockingMediationExternalId || (item.blockingMediationId ? `MED-${item.blockingMediationId}` : '');

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

      <Timeline>
        <TimelineItem
          time="Hoy, 14:25"
          actor={item.owner}
          text={item.nextAction}
        />
        <TimelineItem
          time="24/06/2025, 11:02"
          actor="Lucia Martinez"
          text="Caso asignado al equipo de mediación."
        />
        <TimelineItem
          time="24/06/2025, 10:15"
          actor="Sistema"
          text="Caso creado por reclamo del comprador."
        />
      </Timeline>

      <div className="side-section">
        <DetailRow label="Vendedor" value={item.sellerName} />
        <DetailRow label="Comprador" value={item.title.replace('Comprador vs ', '')} />
        <DetailRow label="Pedido" value={item.orderId} />
        <DetailRow label="Compra asociada" value={item.reason} />
        <DetailRow label="Monto" value={item.amount} />
        <DetailRow label="Etapa" value={item.stage} />
        <DetailRow label="Tiempo transcurrido" value={item.elapsed} />
      </div>

      {item.accountBlocked && (
        <div className="mediation-block-notice">
          <span>
            <UiIcon name="lock" />
          </span>
          <p>
            La cuenta del vendedor está bloqueada. Considere reactivar o resolver el caso.
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
        {canInitialize && (
          <ActionRow icon="scale" variant="emphasis" onClick={() => onOpenInitMediation(item.id)}>
            Inicializar mediación
          </ActionRow>
        )}
        {item.status === MediationStatus.ESPERANDO_VENDEDOR && item.mediationStarted && (
          <ActionRow icon="check" disabled>
            Mediación inicializada
          </ActionRow>
        )}
        <ActionRow icon="note" onClick={() => onOpenNote(item.id)}>
          Dejar nota
        </ActionRow>
        <ActionRow icon="audit" onClick={() => onOpenNotesHistory(item.id)}>
          Historial de notas
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
          Ver vendedor
        </ActionRow>
      </QuickActions>
    </aside>
  );
}
