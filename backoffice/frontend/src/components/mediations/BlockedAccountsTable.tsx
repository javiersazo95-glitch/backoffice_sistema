import { useState } from 'react';
import type { MediationResponse } from '@/types/mediation';
import UiIcon from '@/components/shared/UiIcon';
import Badge from '@/components/shared/Badge';
import { mediationStatusDisplay } from '@/utils/formatters';

interface BlockedAccountsTableProps {
  accounts: MediationResponse[];
  totalItems?: number;
  isLoading?: boolean;
  onOpenReview: (id: number) => void;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'CUENTA_BLOQUEADA', label: 'Cuenta bloqueada' },
  { value: 'SOLICITUD_REVISION', label: 'Solicitud de revisión' },
] as const;

function getBlockedStatusLabel(status?: string): string {
  if (status === 'SOLICITUD_REVISION') return 'Solicitud de revisión';
  return 'Cuenta bloqueada';
}

function getBlockedStatusVariant(status?: string): string {
  if (status === 'SOLICITUD_REVISION') return 'appeal';
  return 'cuenta-bloqueada';
}

export default function BlockedAccountsTable({
  accounts,
  totalItems,
  isLoading = false,
  onOpenReview,
}: BlockedAccountsTableProps) {
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
    <section className="mediation-data-section resolved-table-section blocked-accounts-section">
      <div className="panel-header resolved-table-header">
        <div>
          <h2>Cuentas bloqueadas</h2>
          <span className="panel-hint">Registro activo de bloqueos con motivo, responsable y revisión del caso</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <label htmlFor="blocked-status-filter" style={{ fontSize: 13, color: 'var(--text-muted)' }}>Estado:</label>
          <select
            id="blocked-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', fontSize: 13 }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <span className="panel-count danger-count">{totalItems ?? rows.length}</span>
        </div>
      </div>

      <div className="table-wrap">
        <table className="wide-table blocked-accounts-table">
          <thead>
            <tr>
              <th>Registro</th>
              <th>Estado</th>
              <th>Vendedor</th>
              <th>Pedido</th>
              <th>Motivo del bloqueo</th>
              <th>Etapa</th>
              <th>Responsable</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8}>
                  <span className="row-sub">Cargando cuentas bloqueadas...</span>
                </td>
              </tr>
            ) : rows.length ? (
              rows.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong className="blue-link">{item.externalId}</strong>
                    <span className="row-sub">{mediationStatusDisplay(item.status, item.accountBlocked)}</span>
                  </td>
                  <td>
                    <Badge text={getBlockedStatusLabel(item.blockedAccountStatus)} variant={getBlockedStatusVariant(item.blockedAccountStatus)} />
                  </td>
                  <td>{item.sellerName}</td>
                  <td>{item.orderId}</td>
                  <td className="resolved-table-summary">
                    <strong>{item.escalationReason || item.reason || 'Motivo no informado'}</strong>
                    <span>{item.title}</span>
                  </td>
                  <td>
                    <Badge text={item.stage || item.status} variant={item.accountBlocked ? 'cuenta-bloqueada' : item.status} />
                  </td>
                  <td>{item.owner || 'No informado'}</td>
                  <td className="centered-action-cell">
                    <div className="seller-actions compact-actions centered-actions">
                      <button
                        className="row-action"
                        type="button"
                        onClick={() => onOpenReview(item.id)}
                        aria-label="Revisar caso bloqueado"
                        title="Revisar caso bloqueado"
                      >
                        <UiIcon name="eye" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8}>
                  <span className="row-sub">No hay cuentas bloqueadas activas.</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
