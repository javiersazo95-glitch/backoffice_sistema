import { useState } from 'react';
import UiIcon from '@/components/shared/UiIcon';
import FounderSellerName from '@/components/shared/FounderSellerName';

interface SellerListTooltipProps {
  sellers: Array<{ name: string; founder?: boolean }>;
}

export default function SellerListTooltip({ sellers }: SellerListTooltipProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const unique = sellers.filter(
    (seller, index) => sellers.findIndex((candidate) => candidate.name === seller.name) === index,
  );

  const [first, ...rest] = unique;

  if (!first) return null;

  return (
    <>
      <span className="seller-list-tooltip-wrap">
        <FounderSellerName name={first.name} founder={first.founder} />
        {rest.length > 0 && (
          <button
            type="button"
            className="seller-info-trigger-button"
            onClick={(e) => {
              e.stopPropagation();
              setIsModalOpen(true);
            }}
            title="Ver listado de vendedores que participaron"
            aria-label="Ver vendedores participantes"
          >
            <UiIcon name="info" />
            <span className="seller-info-count">+{rest.length}</span>
          </button>
        )}
      </span>

      {isModalOpen && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '16px'
          }}
          onClick={(e) => {
            e.stopPropagation();
            setIsModalOpen(false);
          }}
        >
          <div
            className="modal-content"
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '460px',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
              border: '1px solid #e2e8f0'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <header
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                borderBottom: '1px solid #edf2f7',
                background: '#f8fafc'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: '#e0edff',
                    color: '#075ed7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <UiIcon name="info" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                    Vendedores participantes
                  </h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    {unique.length} tiendas registradas en este pago
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'transparent',
                  border: 0,
                  fontSize: '22px',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  lineHeight: 1,
                  borderRadius: '4px'
                }}
                title="Cerrar"
              >
                &times;
              </button>
            </header>

            <div
              style={{
                padding: '16px 20px',
                overflowY: 'auto',
                maxHeight: '360px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              {unique.map((seller, index) => (
                <div
                  key={seller.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#64748b',
                        background: '#e2e8f0',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {index + 1}
                    </span>
                    <FounderSellerName name={seller.name} founder={seller.founder} />
                  </div>
                </div>
              ))}
            </div>

            <footer
              style={{
                padding: '12px 20px',
                borderTop: '1px solid #edf2f7',
                background: '#f8fafc',
                display: 'flex',
                justifyContent: 'flex-end'
              }}
            >
              <button
                type="button"
                className="secondary-button"
                onClick={() => setIsModalOpen(false)}
                style={{ padding: '6px 16px', fontSize: '13px', borderRadius: '6px', cursor: 'pointer' }}
              >
                Cerrar
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
