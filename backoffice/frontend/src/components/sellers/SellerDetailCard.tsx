import { useState } from 'react';
import UiIcon from '@/components/shared/UiIcon';
import Badge from '@/components/shared/Badge';
import DetailRow from '@/components/shared/DetailRow';
import QuickActions from '@/components/shared/QuickActions';
import ActionRow from '@/components/shared/ActionRow';
import SellerBehavior from '@/components/shared/SellerBehavior';
import { type SellerResponse } from '@/types/seller';
import type { ImpactMediation } from '@/types/cases';
import { getSellerOperationalStatus, getSellerStatusLabel, getSellerStatusTone } from './status';

interface SellerDetailCardProps {
  seller: SellerResponse;
  activeMediationCount?: number;
  activeMediation?: ImpactMediation;
  waitingSellerCount?: number;
  blockedMediation?: ImpactMediation;
  onViewDocs?: (id: number) => void;
  onOpenMediation?: (id: number) => void;
  onSuspend?: (id: number) => void;
}

export default function SellerDetailCard({
  seller,
  activeMediationCount = seller.mediationCount,
  activeMediation,
  waitingSellerCount = 0,
  blockedMediation,
  onViewDocs,
  onOpenMediation,
  onSuspend,
}: SellerDetailCardProps) {
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const opStatus = getSellerOperationalStatus({
    status: seller.status,
    activeMediationCount,
  });

  const formatDate = (date: string) => new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));

  const getTrustBadge = (trustLevel: string) => {
    if (trustLevel === 'ALTO') return 'green';
    if (trustLevel === 'MEDIO') return 'amber';
    return 'red';
  };

  const getBankBadge = (status: string) => {
    if (status === 'VERIFICADA') return 'green';
    if (status === 'PENDIENTE') return 'amber';
    return 'red';
  };

  const isBlocked = seller.bankStatus === 'BLOQUEADA';
  const blockReason = blockedMediation?.escalationReason || blockedMediation?.reason || 'No hay motivo registrado para el bloqueo.';

  return (
    <section className="seller-detail-card">
      <div className="seller-card-header">
        <h2>Ficha del vendedor</h2>
        <Badge text={getSellerStatusLabel(opStatus)} variant={getSellerStatusTone(opStatus)} />
      </div>

      <div className="seller-profile">
        <div className={`seller-logo logo-${seller.id % 8}`}>
          {seller.storeName.substring(0, 2).toUpperCase()}
        </div>
        <div>
          <h2>{seller.storeName}</h2>
          <p className="row-sub">
            RUT {seller.rut} · {seller.city}
          </p>
        </div>
      </div>

      <div className="seller-info-stats">
        <div className="seller-info-stat">
          <span>Confianza</span>
          <strong>{seller.trustScore}%</strong>
        </div>
        <div className="seller-info-stat">
          <span>Esperando vendedor</span>
          <strong>{waitingSellerCount}</strong>
        </div>
        <div className="seller-info-stat">
          <span>Mediaciones activas</span>
          <strong>{activeMediationCount}</strong>
        </div>
        <div className="seller-info-stat">
          <span>Boletas pend.</span>
          <strong>{seller.pendingReceipts}</strong>
        </div>
      </div>

      <DetailRow label="ID externo" value={seller.externalId} />
      <DetailRow label="Nivel de confianza" value={<Badge text={seller.trustLevel} variant={getTrustBadge(seller.trustLevel)} />} />
      <DetailRow label="Documentos" value={<><UiIcon name="check" /> {seller.documentsSummary}</>} />
      <DetailRow label="Cuenta bancaria" value={<Badge text={seller.bankStatus} variant={getBankBadge(seller.bankStatus)} />} />
      <DetailRow label="Esperando al vendedor" value={waitingSellerCount} />
      <DetailRow label="Mediación activa" value={activeMediation ? `${activeMediation.id} · ${activeMediation.reason}` : 'Sin mediación en curso'} />
      <DetailRow label="Ultima actividad" value={formatDate(seller.lastActivityAt)} />

      {isBlocked && (
        <button
          className="block-review-card"
          type="button"
          onClick={() => setBlockModalOpen(true)}
        >
          <span>
            <UiIcon name="lock" />
          </span>
          <strong>Revisar bloqueo</strong>
          <small>{blockReason}</small>
        </button>
      )}

      <QuickActions>
        <ActionRow icon="document" onClick={() => onViewDocs?.(seller.id)}>
          Ver documentacion
        </ActionRow>
        {activeMediationCount > 0 && (
          <ActionRow icon="scale" variant="mediation-violet" onClick={() => onOpenMediation?.(seller.id)}>
            Ver mediación en curso
          </ActionRow>
        )}
      </QuickActions>

      <SellerBehavior
        rating={seller.rating}
        returns={seller.returnsCount}
        claims={seller.claimsCount}
        pendingReceipts={seller.pendingReceipts}
      />

      {!isBlocked && (
        <button
          className="discipline-action"
          type="button"
          onClick={() => onSuspend?.(seller.id)}
        >
          <UiIcon name="shieldX" /> Bloquear por fraude o falta grave
        </button>
      )}

      {blockModalOpen && (
        <div className="case-modal-backdrop seller-block-modal-backdrop" onClick={() => setBlockModalOpen(false)}>
          <div className="case-modal seller-block-modal" onClick={(event) => event.stopPropagation()}>
            <div className="case-modal-header">
              <div className="case-modal-icon red">
                <UiIcon name="lock" />
              </div>
              <div className="case-modal-title">
                <span className="case-modal-kicker">Cuenta bloqueada</span>
                <h2>{seller.storeName}</h2>
                <p>{seller.rut} · {seller.city}</p>
              </div>
              <button className="ghost-button" type="button" onClick={() => setBlockModalOpen(false)}>
                Cerrar
              </button>
            </div>
            <div className="case-modal-body">
              <div className="case-modal-highlight blocked-strip">
                <span>Motivo del bloqueo</span>
                <strong>{blockReason}</strong>
              </div>
              <div className="case-modal-grid">
                <div className="modal-field">
                  <span>Caso asociado</span>
                  <strong>{blockedMediation?.id ?? 'Sin caso asociado'}</strong>
                </div>
                <div className="modal-field">
                  <span>Pedido</span>
                  <strong>{blockedMediation?.orderId ?? 'No informado'}</strong>
                </div>
                <div className="modal-field">
                  <span>Etapa</span>
                  <strong>{blockedMediation?.stage ?? 'No informada'}</strong>
                </div>
                <div className="modal-field">
                  <span>Responsable</span>
                  <strong>{blockedMediation?.owner ?? 'No informado'}</strong>
                </div>
                <div className="modal-field wide">
                  <span>Siguiente acción</span>
                  <strong>{blockedMediation?.nextAction ?? 'No hay siguiente acción registrada.'}</strong>
                </div>
                <div className="modal-field wide">
                  <span>Compra asociada</span>
                  <strong>{blockedMediation?.purchase ?? blockedMediation?.reason ?? 'No informada'}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
