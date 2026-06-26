import { useState, useMemo, useEffect } from 'react';
import { ResolvedCaseResponse } from '@/types/mediation';
import Modal from '@/components/shared/Modal';
import ModalField from '@/components/shared/ModalField';
import DocumentPreview from '@/components/shared/DocumentPreview';
import UiIcon from '@/components/shared/UiIcon';
import { useMediation } from '@/hooks/useMediations';

interface ResolvedDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ResolvedCaseResponse | null;
}

export default function ResolvedDocumentModal({ isOpen, onClose, item }: ResolvedDocumentModalProps) {
  const { data: detail, isLoading } = useMediation(item?.mediationId || item?.id || 0);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const documents = useMemo(() => {
    if (!detail) return [];

    const list: any[] = [];

    // 1. Evidence uploaded by Buyer
    if (detail.buyerEvidence && detail.buyerEvidence.length > 0) {
      detail.buyerEvidence.forEach((ev: any, index: number) => {
        list.push({
          id: `buyer-ev-${ev.id || index}`,
          url: ev.url,
          fileName: ev.fileName || `Evidencia Comprador #${index + 1}`,
          uploadedBy: 'Comprador',
          stage: 'Creación de reclamo',
          date: ev.uploadedAt ? new Date(ev.uploadedAt).toLocaleString('es-ES') : '',
          mimeType: ev.mimeType || 'application/octet-stream',
          description: 'Documento subido por el comprador al iniciar el reclamo.'
        });
      });
    }

    // 2. Evidence uploaded by Seller
    if (detail.sellerEvidence && detail.sellerEvidence.length > 0) {
      detail.sellerEvidence.forEach((ev: any, index: number) => {
        list.push({
          id: `seller-ev-${ev.id || index}`,
          url: ev.url,
          fileName: ev.fileName || `Evidencia Vendedor #${index + 1}`,
          uploadedBy: 'Vendedor',
          stage: 'Respuesta de vendedor',
          date: ev.uploadedAt ? new Date(ev.uploadedAt).toLocaleString('es-ES') : '',
          mimeType: ev.mimeType || 'application/octet-stream',
          description: 'Documento subido por el vendedor como descargo.'
        });
      });
    }

    // 3. Resolution Document
    if (detail.documentUrl) {
      const isReactivation = item?.caseKind === 'REACTIVACION';
      const resolvedByUsers = item?.resolvedBy === 'Comprador/Vendedor' || detail.owner === 'Comprador/Vendedor';
      
      const resUrls = detail.documentUrl.split('|').map((u: string) => u.trim()).filter(Boolean);
      
      resUrls.forEach((url: string, idx: number) => {
        const isAlreadyIncluded = list.some(d => d.url === url);
        if (!isAlreadyIncluded && !resolvedByUsers) {
          list.push({
            id: `resolution-doc-${idx}`,
            url: url,
            fileName: detail.documentName || (isReactivation ? 'Comprobante de reactivación' : 'Documento de resolución'),
            uploadedBy: isReactivation ? 'Administrador' : 'Mediador',
            stage: isReactivation ? 'Reactivación de cuenta' : 'Resolución de mediación',
            date: item?.createdAt ? new Date(item.createdAt).toLocaleString('es-ES') : '',
            mimeType: detail.documentType || 'application/pdf',
            description: detail.resolutionReason || item?.resolutionReason || 'Documento adjunto al cerrar la mediación.'
          });
        }
      });
    }

    return list;
  }, [detail, item]);

  useEffect(() => {
    if (documents.length > 0) {
      const resolutionDoc = documents.find(d => d.id.startsWith('resolution-doc'));
      setSelectedDocId(resolutionDoc ? resolutionDoc.id : documents[0].id);
    } else {
      setSelectedDocId(null);
    }
  }, [documents]);

  if (!item) return null;

  const selectedDoc = documents.find(d => d.id === selectedDocId);

  // Helper to color the uploader badge
  const getBadgeStyle = (uploader: string) => {
    switch (uploader) {
      case 'Comprador':
        return { color: '#1e40af', background: '#dbeafe' }; // blue
      case 'Vendedor':
        return { color: '#854d0e', background: '#fef9c3' }; // amber
      case 'Mediador':
        return { color: '#166534', background: '#dcfce7' }; // green
      case 'Administrador':
        return { color: '#6b21a8', background: '#f3e8ff' }; // purple
      default:
        return { color: '#374151', background: '#f3f4f6' }; // gray
    }
  };

  const getDisplayResponsible = (resolvedBy?: string, owner?: string) => {
    const val = (resolvedBy || owner || '').trim();
    if (!val || val === 'Sistema' || val === 'No asignado') {
      return 'Mediador';
    }
    if (val === 'Comprador/Vendedor') {
      return 'Vendedor';
    }
    const lower = val.toLowerCase();
    if (lower.includes('comprador')) return 'Comprador';
    if (lower.includes('vendedor')) return 'Vendedor';
    if (lower.includes('mediador') || lower.includes('admin') || lower.includes('sistema')) return 'Mediador';
    return 'Mediador';
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Documentos adjuntos del caso" wide>
      <div className="case-modal-header">
        <span className="case-modal-icon blue">
          <UiIcon name="fileCheck" />
        </span>
        <div className="case-modal-title">
          <span className="case-modal-kicker">Documentos del caso</span>
          <h2>Seguimiento de Documentación</h2>
          <p>{item.externalId} · {item.sellerName}</p>
        </div>
      </div>

      <div className="case-modal-body">
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px', color: 'var(--muted)' }}>
            <strong>Cargando historial de documentos...</strong>
          </div>
        ) : documents.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', minHeight: '480px', alignItems: 'stretch' }}>
            {/* Left Column: List of documents */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderRight: '1px solid var(--soft-line)', paddingRight: '20px', maxHeight: '550px', overflowY: 'auto' }}>
              <span style={{ fontSize: '11px', fontWeight: '750', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '4px' }}>
                Archivos disponibles ({documents.length})
              </span>
              {documents.map((doc) => {
                const isActive = doc.id === selectedDocId;
                const badgeStyle = getBadgeStyle(doc.uploadedBy);
                const isPdf = doc.mimeType === 'application/pdf' || /\.pdf$/i.test(doc.fileName);
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setSelectedDocId(doc.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      padding: '12px',
                      borderRadius: '8px',
                      border: `1px solid ${isActive ? 'var(--blue)' : 'var(--soft-line)'}`,
                      background: isActive ? '#f0f6ff' : '#fff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 120ms ease',
                      width: '100%',
                      outline: 'none',
                      boxShadow: isActive ? '0 2px 8px rgba(37, 99, 235, 0.08)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', width: '100%' }}>
                      <span style={{ color: isActive ? 'var(--blue)' : 'var(--muted)', marginTop: '2px', display: 'flex', flexShrink: 0 }}>
                        <UiIcon name={isPdf ? 'fileCheck' : 'document'} style={{ width: '16px', height: '16px' }} />
                      </span>
                      <strong style={{ fontSize: '12.5px', fontWeight: '600', color: isActive ? '#1e3a8a' : 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                        {doc.fileName}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                      <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase', ...badgeStyle }}>
                        {doc.uploadedBy}
                      </span>
                      <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', background: '#f3f4f6', color: '#4b5563', textTransform: 'uppercase' }}>
                        {doc.stage}
                      </span>
                    </div>

                    {doc.date && (
                      <span style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                        {doc.date}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right Column: Active preview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {selectedDoc && selectedDoc.url ? (
                <DocumentPreview
                  documentName={selectedDoc.fileName}
                  documentUrl={selectedDoc.url}
                  documentType={selectedDoc.mimeType}
                  kind={selectedDoc.stage}
                  resolvedDate={selectedDoc.date}
                  resolutionReason={selectedDoc.description}
                />
              ) : (
                <div className="empty-insight" style={{ flex: 1, display: 'grid', placeContent: 'center', height: '100%' }}>
                  <strong>Selecciona un documento</strong>
                  <p>Haz clic en cualquiera de los archivos de la lista para ver su vista previa.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="empty-insight">
            <strong>No hay documentos registrados</strong>
            <p>Este caso resuelto no tiene documentos ni evidencias adjuntas disponibles.</p>
          </div>
        )}

        <div className="case-modal-grid" style={{ borderTop: '1px solid var(--soft-line)', paddingTop: '16px', marginTop: '8px' }}>
          <ModalField label="Caso" value={item.externalId} />
          <ModalField label="Fecha resolución" value={item.createdAt} />
          <ModalField label="Tipo" value={item.caseKind} />
          <ModalField label="Responsable" value={getDisplayResponsible(item.resolvedBy, (item as any).owner)} />
        </div>
      </div>
    </Modal>
  );
}
