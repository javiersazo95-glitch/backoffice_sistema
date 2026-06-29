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

const getBankDetails = (seller: SellerResponse) => ({
  bank: seller.bankName || 'No registrado',
  accountType: seller.bankAccountType || 'No registrado',
  accountNumber: seller.bankAccountNumber || 'No registrado',
  rut: seller.bankAccountRut || seller.rut || 'No registrado',
  email: seller.email || 'No registrado',
  beneficiary: seller.bankAccountHolderName || seller.owner || seller.storeName,
});

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
  const [showBankModal, setShowBankModal] = useState(false);
  const opStatus = getSellerOperationalStatus({
    status: seller.status,
    activeMediationCount,
  });

  const formatDate = (date: string) => new Intl.DateTimeFormat('es-CL', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));


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
          {seller.userProfileUrl ? (
            <img src={seller.userProfileUrl} alt={seller.storeName} />
          ) : (
            seller.storeName.substring(0, 2).toUpperCase()
          )}
        </div>
        <div>
          <h2>{seller.storeName}</h2>
          <p className="row-sub">
            RUT {seller.rut} · {seller.city}{seller.email ? ` · ${seller.email}` : ''}
          </p>
          {(seller.owner || seller.phone) && (
            <p className="row-sub" style={{ marginTop: '4px' }}>
              Responsable: {seller.owner || 'No informado'}{seller.phone ? ` · Teléfono: ${seller.phone}` : ''}
            </p>
          )}
        </div>
      </div>

      <div className="seller-info-stats" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <div className="seller-info-stat">
          <span>Esperando vendedor</span>
          <strong>{waitingSellerCount}</strong>
        </div>
        <div className="seller-info-stat">
          <span>Mediaciones activas</span>
          <strong>{activeMediationCount}</strong>
        </div>
        <div className="seller-info-stat">
          <span>Reportes</span>
          <strong>{seller.pendingReceipts}</strong>
        </div>
      </div>

      <DetailRow label="ID externo" value={seller.externalId} />
      <DetailRow label="Giro comercial" value={<><UiIcon name="check" /> {seller.documentsSummary || 'No informado'}</>} />
      <DetailRow 
        label="Cuenta bancaria" 
        value={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {seller.bankStatus && seller.bankStatus.trim() ? (
              <Badge text={seller.bankStatus} variant={getBankBadge(seller.bankStatus)} />
            ) : null}
            <button 
              type="button" 
              onClick={() => setShowBankModal(true)} 
              className="ghost-button" 
              style={{ padding: '2px', display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}
              title="Ver datos bancarios"
            >
              <UiIcon name="eye" />
            </button>
          </div>
        } 
      />
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

      {showBankModal && (
        <div className="case-modal-backdrop seller-block-modal-backdrop" onClick={() => setShowBankModal(false)}>
          <div className="case-modal seller-block-modal" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="case-modal-header">
              <div className="case-modal-icon green" style={{ background: '#e6f4ea', color: '#137333' }}>
                <UiIcon name="check" />
              </div>
              <div className="case-modal-title">
                <span className="case-modal-kicker">Datos bancarios</span>
                <h2>{seller.storeName}</h2>
              </div>
              <button className="ghost-button" type="button" onClick={() => setShowBankModal(false)}>
                Cerrar
              </button>
            </div>
            <div className="case-modal-body" style={{ display: 'grid', gap: '12px', padding: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', borderBottom: '1px solid #f1f3f4', paddingBottom: '8px' }}>
                <span style={{ color: '#5f6368', fontSize: '12px' }}>Banco</span>
                <strong style={{ fontSize: '13px' }}>{getBankDetails(seller).bank}</strong>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', borderBottom: '1px solid #f1f3f4', paddingBottom: '8px' }}>
                <span style={{ color: '#5f6368', fontSize: '12px' }}>Tipo de cuenta</span>
                <strong style={{ fontSize: '13px' }}>{getBankDetails(seller).accountType}</strong>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', borderBottom: '1px solid #f1f3f4', paddingBottom: '8px' }}>
                <span style={{ color: '#5f6368', fontSize: '12px' }}>N° de cuenta</span>
                <strong style={{ fontSize: '13px' }}>{getBankDetails(seller).accountNumber}</strong>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', borderBottom: '1px solid #f1f3f4', paddingBottom: '8px' }}>
                <span style={{ color: '#5f6368', fontSize: '12px' }}>RUT</span>
                <strong style={{ fontSize: '13px' }}>{getBankDetails(seller).rut}</strong>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px', borderBottom: '1px solid #f1f3f4', paddingBottom: '8px' }}>
                <span style={{ color: '#5f6368', fontSize: '12px' }}>Email</span>
                <strong style={{ fontSize: '13px' }}>{getBankDetails(seller).email}</strong>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '8px' }}>
                <span style={{ color: '#5f6368', fontSize: '12px' }}>Beneficiario</span>
                <strong style={{ fontSize: '13px' }}>{getBankDetails(seller).beneficiary}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
