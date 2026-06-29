import { MediationResponse } from '@/types/mediation';
import UiIcon from '@/components/shared/UiIcon';
import Badge from '@/components/shared/Badge';
import { mediationStatusDisplay } from '@/utils/formatters';

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

    if (item.status === 'EN_MEDIACION' && item.accountBlocked) {
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
      <td>{item.sellerName}</td>
      <td><strong className="blue-link">{item.orderId}</strong></td>
      <td>{item.reason}</td>
      <td style={{ textAlign: 'center' }}>
        <Badge text={mediationStatusDisplay(item.status, item.accountBlocked)} variant={item.accountBlocked ? 'cuenta-bloqueada' : item.status} />
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
