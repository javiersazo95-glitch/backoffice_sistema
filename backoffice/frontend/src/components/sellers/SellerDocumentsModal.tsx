import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import type { SellerDocumentResponse, SellerResponse } from '@/types/seller';
import UiIcon from '@/components/shared/UiIcon';
import DocumentPreview from '@/components/shared/DocumentPreview';
import { buildDocumentDownloadName, downloadDocument, resolveDocumentUrl } from '@/utils/documentUrls';

interface SellerDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  seller: SellerResponse | null;
  documents: SellerDocumentResponse[];
}

function formatDate(value?: string | Date | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(date);
}

function formatDocumentLabel(documentType: string) {
  return documentType
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getDocumentMimeType(document: SellerDocumentResponse) {
  const url = document.documentUrl?.split('?')[0]?.toLowerCase() ?? '';

  if (url.endsWith('.pdf')) return 'application/pdf';
  if (url.endsWith('.png')) return 'image/png';
  if (url.endsWith('.jpg') || url.endsWith('.jpeg')) return 'image/jpeg';
  if (url.endsWith('.webp')) return 'image/webp';
  if (url.endsWith('.gif')) return 'image/gif';

  return undefined;
}

export default function SellerDocumentsModal({ isOpen, onClose, seller, documents }: SellerDocumentsModalProps) {
  const [search, setSearch] = useState('');
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);

  const visibleDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return documents.filter((document) => {
      if (!query) return true;
      return [document.documentType, document.owner, document.notes, document.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [documents, search]);

  const selectedDocument = useMemo(() => {
    if (!selectedDocumentId) return null;
    return visibleDocuments.find((document) => document.id === selectedDocumentId) ?? null;
  }, [selectedDocumentId, visibleDocuments]);

  const handleDownload = async (document: SellerDocumentResponse) => {
    const url = resolveDocumentUrl(document.documentUrl);
    if (!url) {
      window.alert(`El documento "${formatDocumentLabel(document.documentType)}" no tiene URL de descarga disponible.`);
      return;
    }

    await downloadDocument(
      url,
      buildDocumentDownloadName(document.documentType, url, getDocumentMimeType(document)),
    );
  };

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setSelectedDocumentId(null);
      return;
    }

    setSearch('');
    setSelectedDocumentId(documents[0]?.id ?? null);
  }, [isOpen, documents, seller?.id]);

  if (!isOpen || !seller) return null;

  return (
    <div className="case-modal-backdrop seller-documents-backdrop" onClick={onClose}>
      <div className="seller-documents-modal" onClick={(event) => event.stopPropagation()}>
        <header className="seller-documents-header">
          <div className="seller-documents-heading">
            <span className="seller-documents-icon">
              <UiIcon name="document" />
            </span>
            <div className="seller-documents-title">
              <h2>Documentos del vendedor</h2>
              <p>{seller.storeName} · {seller.externalId}</p>
            </div>
          </div>

          <button className="seller-documents-close" type="button" onClick={onClose} aria-label="Cerrar">
            <UiIcon name="close" />
            <span>Cerrar</span>
          </button>
        </header>

        <section className="seller-documents-content">
          <div className="seller-documents-list-panel">
            <div className="seller-documents-list-toolbar">
              <label className="seller-documents-search">
                <UiIcon name="search" />
                <input
                  type="search"
                  value={search}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
                  placeholder="Buscar documento"
                  aria-label="Buscar documento"
                />
              </label>
              <span className="seller-documents-count">{visibleDocuments.length} documentos</span>
            </div>

            <div className="seller-documents-table-shell">
              <table className="seller-documents-table">
                <colgroup>
                  <col className="seller-documents-col-type" />
                  <col className="seller-documents-col-uploaded" />
                  <col className="seller-documents-col-owner" />
                  <col className="seller-documents-col-actions" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Subido</th>
                    <th>Responsable</th>
                    <th>Accion</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleDocuments.length ? visibleDocuments.map((document) => {
                    const selected = document.id === selectedDocument?.id;
                    return (
                      <tr key={document.id} className={selected ? 'is-selected' : ''}>
                        <td>
                          <div className="seller-documents-type-cell">
                            <span className="seller-documents-type-icon">
                              <UiIcon name="fileCheck" />
                            </span>
                            <div>
                              <strong>{formatDocumentLabel(document.documentType)}</strong>
                              <span>{document.status}</span>
                            </div>
                          </div>
                        </td>
                        <td>{formatDate(document.uploadedAt)}</td>
                        <td>{document.owner}</td>
                        <td>
                          <div className="seller-documents-row-actions">
                            <button
                              className={`seller-documents-row-action${selected ? ' active' : ''}`}
                              type="button"
                              onClick={() => setSelectedDocumentId(document.id)}
                              aria-label={`Ver ${document.documentType}`}
                              title="Ver documento"
                            >
                              <UiIcon name="eye" />
                            </button>
                            <button
                              className="seller-documents-row-action secondary"
                              type="button"
                              onClick={() => handleDownload(document)}
                              aria-label={`Descargar ${document.documentType}`}
                            >
                              <UiIcon name="download" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={4}>
                        <p className="seller-documents-empty-table">No hay documentos que coincidan con la busqueda.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="seller-documents-footer-note">
              <UiIcon name="info" />
              <p>Mostrando {visibleDocuments.length} de {documents.length} documentos.</p>
            </div>
          </div>

          <aside className="seller-documents-preview-panel">
            {selectedDocument ? (
              <>
                <div className="seller-documents-selected-card">
                  <span className="seller-documents-selected-icon">
                    <UiIcon name="document" />
                  </span>
                  <div>
                    <strong>{buildDocumentDownloadName(selectedDocument.documentType, selectedDocument.documentUrl)}</strong>
                    <span>{formatDocumentLabel(selectedDocument.documentType)} · {selectedDocument.status}</span>
                  </div>
                </div>

                <div className="seller-documents-preview-frame">
                  <DocumentPreview
                    documentName={buildDocumentDownloadName(selectedDocument.documentType, selectedDocument.documentUrl)}
                    documentUrl={selectedDocument.documentUrl}
                    documentType={getDocumentMimeType(selectedDocument)}
                    kind={seller.storeName}
                    resolvedDate={formatDate(selectedDocument.uploadedAt)}
                    resolutionReason={selectedDocument.notes || 'Sin notas registradas para este documento.'}
                  />
                </div>
               </>
            ) : (
              <div className="seller-documents-empty-preview">
                <UiIcon name="document" />
                <strong>Selecciona un documento</strong>
                <p>Haz clic en el ojo de la tabla para activar la previsualizacion lateral.</p>
              </div>
            )}
          </aside>
        </section>

        <footer className="seller-documents-footer">
          <div className="seller-documents-footer-tip">
            <UiIcon name="info" />
            <p>Esta vista es solo para visualizar documentos del vendedor.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
