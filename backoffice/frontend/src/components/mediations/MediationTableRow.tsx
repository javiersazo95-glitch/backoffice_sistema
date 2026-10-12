import { MediationResponse } from '@/types/mediation';
import UiIcon from '@/components/shared/UiIcon';
import FounderSellerName from '@/components/shared/FounderSellerName';
import Badge from '@/components/shared/Badge';
import { mediationStatusDisplay } from '@/utils/formatters';
import { attentionView } from '@/utils/mediationGuidedFlow';

interface MediationTableRowProps {
  item: MediationResponse;
  isSelected: boolean;
  onSelect: (id: number) => void;
  onOpenMediationCase: (id: number) => void;
  onOpenReactivation: (id: number) => void;
  onOpenSellerInfo: (sellerId: number) => void;
}

export default function MediationTableRow({
  item,
  isSelected,
  onSelect,
  onOpenMediationCase,
  onOpenReactivation,
  onOpenSellerInfo,
}: MediationTableRowProps) {
  const getMediationAction = () => {
    if (item.status === 'EN_MEDIACION' && !item.accountBlocked) {
      return (
        <button
          className="row-action mediation-state-violet"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenMediationCase(item.id);
          }}
          aria-label="Revisar mediacion"
          title="Revisar mediacion"
        >
          <UiIcon name="scale" />
        </button>
      );
    }

    // Igual que en MediationDetailPanel: `blockAccount` deja la mediacion bloqueante en
    // RESUELTA en cuanto el pedido es resoluble, aunque `accountBlocked` siga en true.
    if (item.accountBlocked) {
      return (
        <button
          className="row-action account-lock-action"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenReactivation(item.id);
          }}
          aria-label="Reactivar cuenta bloqueada"
          title="Reactivar cuenta bloqueada"
        >
          <UiIcon name="lock" />
        </button>
      );
    }

    return null;
  };

  return (
    <tr className={isSelected ? 'is-active' : ''} onClick={() => onSelect(item.id)} style={{ cursor: 'pointer' }}>
      <td><strong className="blue-link">{item.externalId}</strong></td>
      <td>{item.buyer?.trim() || item.title.replace('Comprador vs ', '').trim() || 'Comprador'}</td>
      <td><FounderSellerName name={item.sellerName} founder={item.sellerFounder} /></td>
      <td><strong className="blue-link">{item.orderId}</strong></td>
      <td>{item.reason}</td>
      <td style={{ textAlign: 'center' }}>
        <div className="mediation-status-cell">
          <Badge text={mediationStatusDisplay(item.status, item.accountBlocked)} variant={item.accountBlocked ? 'cuenta-bloqueada' : item.status} />
          {/* 12-oct: cuantos dias lleva abierto y que espera (flujo guiado), para no olvidar un caso. */}
          {item.status === 'EN_MEDIACION' && item.elapsed ? <small className="row-sub">Abierta hace {item.elapsed}</small> : null}
          {item.status === 'EN_MEDIACION' && attentionView(item.atencionMediador) ? (
            <Badge
              text={attentionView(item.atencionMediador)!.label}
              variant={attentionView(item.atencionMediador)!.tone === 'success' ? 'green' : attentionView(item.atencionMediador)!.tone === 'warning' ? 'amber' : 'blue'}
            />
          ) : null}
        </div>
      </td>
      <td className="mediation-actions-cell">
        <div className="seller-actions compact-actions centered-actions">
          <button
            className="row-action"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpenSellerInfo(item.sellerId);
            }}
            aria-label="Ver perfil del vendedor"
            title="Ver perfil del vendedor"
          >
            <UiIcon name="users" />
          </button>
          {getMediationAction()}
        </div>
      </td>
    </tr>
  );
}
