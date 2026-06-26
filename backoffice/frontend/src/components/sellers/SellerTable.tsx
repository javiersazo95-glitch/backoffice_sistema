import { Fragment } from 'react';
import { type SellerResponse } from '@/types/seller';
import type { ImpactMediation, RiskCase } from '@/types/cases';
import Badge from '@/components/shared/Badge';
import UiIcon from '@/components/shared/UiIcon';
import SellerExpandedRow from './SellerExpandedRow';
import { getSellerOperationalStatus, getSellerStatusLabel, getSellerStatusTone } from './status';
import { formatDate } from '@/utils/formatters';

interface SellerTableProps {
  sellers: SellerResponse[];
  onViewSeller?: (seller: SellerResponse) => void;
  onViewDocs?: (id: number) => void;
  onToggleSeller?: (id: number) => void;
  onReviewMediation?: (mediationId: number) => void;
  expandedId?: number | null;
  onToggleExpand?: (id: number) => void;
  risks?: Record<number, RiskCase[]>;
  mediations?: Record<number, ImpactMediation[]>;
  blockedMediations?: Record<number, ImpactMediation[]>;
  selectedSellerId?: number | null;
}

function getLogoClass(index: number): string {
  const classes = ['logo-blue', 'logo-dark', 'logo-black', 'logo-red', 'logo-bright-blue', 'logo-navy', 'logo-royal', 'logo-yellow'];
  return classes[index % classes.length] ?? '';
}

export default function SellerTable({
  sellers,
  onViewSeller,
  onViewDocs,
  onToggleSeller,
  onReviewMediation,
  expandedId,
  onToggleExpand,
  risks,
  mediations,
  blockedMediations,
  selectedSellerId,
}: SellerTableProps) {
  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tienda</th>
              <th>RUT</th>
              <th>Ciudad</th>
              <th>ESTADO DE CUENTA</th>
              <th>Esperando vendedor</th>
              <th>Fecha de ingreso</th>
              <th>Mediaciones</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {sellers.length ? (
              sellers.map((seller, index) => {
                const isExpanded = expandedId === seller.id;
                const isSelected = selectedSellerId === seller.id;
                const sellerRisks = risks?.[seller.id] || [];
                const sellerMediations = mediations?.[seller.id] || [];
                const sellerBlockedMediations = blockedMediations?.[seller.id] || [];
                
                return (
                  <Fragment key={seller.id}>
                    <tr className={isExpanded || isSelected ? 'is-active' : ''} data-seller-row={seller.id}>
                      <td>
                        <span className="seller-cell">
                          <span className={`seller-logo ${getLogoClass(index)}`}>
                            {seller.storeName.substring(0, 2).toUpperCase()}
                          </span>
                          <strong>{seller.storeName}</strong>
                        </span>
                      </td>
                      <td>{seller.rut}</td>
                      <td>{seller.city}</td>
                      <td>
                        <Badge
                          text={getSellerStatusLabel(getSellerOperationalStatus(seller))}
                          variant={getSellerStatusTone(getSellerOperationalStatus(seller))}
                        />
                      </td>
                      <td>{sellerRisks.length}</td>
                      <td>{seller.lastActivityAt ? formatDate(seller.lastActivityAt) : 'Sin fecha'}</td>
                      <td>{sellerMediations.length}</td>
                      <td>
                        <div className="seller-actions" aria-label={`Acciones de ${seller.storeName}`}>
                          <button
                            className="row-action"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewSeller?.(seller);
                            }}
                            aria-label="Ver perfil del vendedor"
                            title="Ver perfil del vendedor"
                          >
                            <UiIcon name="users" />
                          </button>
                          <button
                            className="row-action"
                            type="button"
                            onClick={() => onViewDocs?.(seller.id)}
                            aria-label="Ver documentacion"
                          >
                            <UiIcon name="document" />
                          </button>
                          {sellerMediations.length > 0 && (
                            <button
                              className="row-action mediation-state-violet"
                              type="button"
                              onClick={() => onToggleSeller?.(seller.id)}
                              aria-label="Ver mediación en curso"
                            >
                              <UiIcon name="scale" />
                            </button>
                          )}
                          {sellerRisks.length > 0 && (
                            <button
                              className="row-action account-lock-action"
                              type="button"
                              onClick={() => onToggleSeller?.(seller.id)}
                              aria-label="Ver casos esperando al vendedor"
                            >
                              <UiIcon name="clock" />
                            </button>
                          )}
                          <button
                            className={`row-action expand-toggle ${isExpanded ? 'open' : ''}`}
                            type="button"
                            onClick={() => onToggleExpand?.(seller.id)}
                            aria-expanded={isExpanded}
                            aria-label={isExpanded ? 'Cerrar detalle' : 'Abrir detalle'}
                          >
                            <UiIcon name="chevronDown" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <SellerExpandedRow
                        seller={seller}
                        risks={risks?.[seller.id]}
                        mediations={mediations?.[seller.id]}
                        blockedMediations={sellerBlockedMediations}
                        onViewDocs={onViewDocs}
                        onOpenMediation={onToggleSeller}
                        onReviewMediation={onReviewMediation}
                        onSuspend={onToggleSeller}
                      />
                    )}
                  </Fragment>
                );
              })
            ) : (
              <tr>
                <td colSpan={8}>
                  <span className="row-sub">No hay vendedores que coincidan con la busqueda.</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
