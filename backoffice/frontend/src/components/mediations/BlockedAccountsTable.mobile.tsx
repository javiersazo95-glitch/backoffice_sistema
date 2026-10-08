import { useState } from 'react';
import { suspensionNivelLabel } from './BlockedAccountsTable';
import type { MediationResponse } from '@/types/mediation';
import UiIcon from '@/components/shared/UiIcon';
import FounderSellerName from '@/components/shared/FounderSellerName';
import Badge from '@/components/shared/Badge';
import { mediationStatusDisplay, getBlockedTargetInfo } from '@/utils/formatters';
import { RecordCard, RecordList, EmptyState } from '@/components/mobile';

interface BlockedAccountsCardListProps {
  accounts: MediationResponse[];
  totalItems?: number;
  isLoading?: boolean;
  selectedId?: number | null;
  onSelect?: (item: MediationResponse) => void;
  onOpenHistory: (id: number) => void;
  onOpenAppeal: (id: number) => void;
  onOpenSellerInfo: (sellerId: number) => void;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'CUENTA_BLOQUEADA', label: 'Cuenta bloqueada' },
  { value: 'SOLICITUD_REVISION', label: 'Solicitud de revisión' },
] as const;

function blockedStatusLabel(status?: string, isBuyer = false): string {
  const target = isBuyer ? 'Comprador' : 'Tienda';
  if (status === 'SOLICITUD_REVISION') return `Revisión (${target})`;
  return `${target} bloquead${isBuyer ? 'o' : 'a'}`;
}

/** Versión móvil de BlockedAccountsTable. */
export function BlockedAccountsCardList({
  accounts,
  totalItems,
  isLoading = false,
  selectedId,
  onSelect,
  onOpenHistory,
  onOpenAppeal,
  onOpenSellerInfo,
}: BlockedAccountsCardListProps) {
  const [statusFilter, setStatusFilter] = useState('');

  const rows = [...accounts]
    .filter((item) => item.accountBlocked)
    .filter((item) => {
      if (!statusFilter) return true;
      if (statusFilter === 'CUENTA_BLOQUEADA') {
        return !item.blockedAccountStatus || item.blockedAccountStatus === 'CUENTA_BLOQUEADA';
      }
      return item.blockedAccountStatus === statusFilter;
    })
    .sort((a, b) => (new Date(b.updatedAt).getTime() || 0) - (new Date(a.updatedAt).getTime() || 0));

  return (
    <section className="mediation-data-section resolved-table-section blocked-accounts-section mb-section">
      <div className="panel-header resolved-table-header">
        <div>
          <h2>Cuentas bloqueadas</h2>
          <span className="panel-hint">Bloqueos activos con motivo, responsable y revisión</span>
        </div>
        <span className="panel-count danger-count">{totalItems ?? rows.length}</span>
      </div>
      <div className="mb-filter-row">
        <select
          className="select"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Estado del bloqueo"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <RecordList
        loading={isLoading}
        ariaLabel="Cuentas bloqueadas"
        empty={<EmptyState icon="lock" title="Sin cuentas bloqueadas" description="No hay bloqueos activos con este filtro." />}
      >
        {rows.map((item) => {
          const hasAppeal = item.blockedAccountStatus === 'SOLICITUD_REVISION';
          const blockedTarget = getBlockedTargetInfo(item);
          return (
            <RecordCard
              key={item.id}
              title={item.externalId}
              subtitle={<><FounderSellerName name={item.sellerName} founder={item.sellerFounder} /> · {mediationStatusDisplay(item.status, item.accountBlocked)}</>}
              badge={<Badge text={blockedStatusLabel(item.blockedAccountStatus, blockedTarget.isBuyer)} variant={hasAppeal ? 'appeal' : 'cuenta-bloqueada'} />}
              tone={hasAppeal ? 'warning' : 'danger'}
              meta={[
                { label: 'Pedido', value: item.orderId },
                { label: 'Etapa', value: item.stage || item.status },
                ...(item.suspensionNivel ? [{ label: 'Nivel', value: suspensionNivelLabel(item.suspensionNivel) }] : []),
                { label: 'Responsable', value: blockedTarget.fullTargetLabel },
                { label: 'Mediador', value: item.owner || 'No informado' },
                { label: 'Motivo del bloqueo', value: item.escalationReason || item.reason || 'Motivo no informado', wide: true },
              ]}
              selected={selectedId === item.id}
              onPress={onSelect ? () => onSelect(item) : undefined}
              actions={(
                <>
                  <button type="button" className="mb-action" onClick={() => onOpenSellerInfo(item.sellerId)}>
                    <UiIcon name="users" />
                    Tienda
                  </button>
                  <button type="button" className="mb-action" onClick={() => onOpenHistory(item.id)}>
                    <UiIcon name="list" />
                    Historial
                  </button>
                  {hasAppeal && (
                    <button type="button" className="mb-action mb-action--violet" onClick={() => onOpenAppeal(item.id)}>
                      <UiIcon name="flag" />
                      Apelación
                    </button>
                  )}
                </>
              )}
            />
          );
        })}
      </RecordList>
    </section>
  );
}
