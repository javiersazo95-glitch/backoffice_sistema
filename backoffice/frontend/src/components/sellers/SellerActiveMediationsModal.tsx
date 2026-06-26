import type { SellerDetailResponse } from '@/types/seller';
import { MediationStatus, type MediationSummaryResponse } from '@/types/mediation';
import Badge from '@/components/shared/Badge';
import UiIcon from '@/components/shared/UiIcon';
import { mediationStatusDisplay } from '@/utils/formatters';
import { applyManualMediationStatus, useManualMediationStatusOverrides } from '@/utils/manualMediationStatus';
import { useManualMediationAdminMode } from '@/utils/manualMediationAdminMode';

interface SellerActiveMediationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  seller: SellerDetailResponse | null;
}

const ACTIVE_STATUSES = new Set<MediationStatus>([
  MediationStatus.ESPERANDO_VENDEDOR,
  MediationStatus.EN_MEDIACION,
]);

function formatDate(value?: string | null) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function activeMediationVariant(status: MediationStatus) {
  if (status === MediationStatus.ESPERANDO_VENDEDOR) return 'amber';
  return 'violet';
}

export default function SellerActiveMediationsModal({
  isOpen,
  onClose,
  seller,
}: SellerActiveMediationsModalProps) {
  const [manualStatusOverrides] = useManualMediationStatusOverrides();
  const [adminMode] = useManualMediationAdminMode();
  const effectiveManualStatusOverrides = adminMode ? manualStatusOverrides : {};

  if (!isOpen || !seller) return null;

  const activeMediations = [...seller.mediations]
    .map((mediation) => applyManualMediationStatus(mediation, effectiveManualStatusOverrides))
    .filter((mediation) => ACTIVE_STATUSES.has(mediation.status))
    .sort((a, b) => (new Date(b.updatedAt).getTime() || 0) - (new Date(a.updatedAt).getTime() || 0));

  return (
    <div className="case-modal-backdrop seller-active-mediations-backdrop" onClick={onClose}>
      <div className="seller-active-mediations-modal" onClick={(event) => event.stopPropagation()}>
        <header className="seller-documents-header">
          <div className="seller-documents-heading">
            <span className="seller-documents-icon">
              <UiIcon name="scale" />
            </span>
            <div className="seller-documents-title">
              <h2>Mediaciones en curso</h2>
              <p>{seller.storeName} · {seller.externalId}</p>
            </div>
          </div>

          <button className="seller-documents-close" type="button" onClick={onClose} aria-label="Cerrar">
            <UiIcon name="close" />
            <span>Cerrar</span>
          </button>
        </header>

        <section className="seller-active-mediations-content">
          {activeMediations.length ? (
            <p className="seller-active-mediations-feedback">
              Este vendedor mantiene {activeMediations.length} mediación{activeMediations.length === 1 ? '' : 'es'} en curso.
            </p>
          ) : (
            <p className="seller-active-mediations-feedback empty">
              El vendedor no cuenta con mediación en curso.
            </p>
          )}

          <div className="seller-documents-table-shell">
            <table className="seller-documents-table seller-active-mediations-table">
              <thead>
                <tr>
                  <th>Caso</th>
                  <th>Pedido</th>
                  <th>Motivo</th>
                  <th>Estado</th>
                  <th>Última actualización</th>
                </tr>
              </thead>
              <tbody>
                {activeMediations.length ? activeMediations.map((mediation: MediationSummaryResponse) => (
                  <tr key={mediation.id}>
                    <td>
                      <div className="seller-documents-type-cell">
                        <span className="seller-documents-type-icon">
                          <UiIcon name="scale" />
                        </span>
                        <div>
                          <strong>{mediation.externalId}</strong>
                          <span>{mediation.title}</span>
                        </div>
                      </div>
                    </td>
                    <td>{mediation.orderId}</td>
                    <td>{mediation.reason}</td>
                    <td>
                      <Badge
                        text={mediationStatusDisplay(mediation.status, false)}
                        variant={activeMediationVariant(mediation.status)}
                      />
                    </td>
                    <td>{formatDate(mediation.updatedAt)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5}>
                      <p className="seller-documents-empty-table">El vendedor no cuenta con mediación en curso.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
