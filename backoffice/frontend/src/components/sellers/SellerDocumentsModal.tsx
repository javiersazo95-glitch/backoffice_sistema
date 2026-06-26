import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import type { SellerDocumentResponse, SellerResponse } from '@/types/seller';
import UiIcon from '@/components/shared/UiIcon';
import Badge from '@/components/shared/Badge';
import DocumentPreview from '@/components/shared/DocumentPreview';
import { ValidationStatus } from '@/types/validation';

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

function getDocumentTone(status: ValidationStatus) {
  if (status === ValidationStatus.APROBADA) return 'green';
  if (status === ValidationStatus.RECHAZADA) return 'red';
  return 'amber';
}

function getDocumentFileName(documentType: string) {
  const normalized = documentType
    .trim()
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]+/g, '')
    .replace(/\s+/g, '_');
  return `${normalized || 'documento'}.html`;
}

function getExtensionFromMimeType(mimeType?: string) {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'text/html') return 'html';
  return '';
}

function getDownloadName(document: SellerDocumentResponse, mimeType?: string) {
  const normalized = document.documentType
    .trim()
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]+/g, '')
    .replace(/\s+/g, '_');
  const path = document.documentUrl?.split('?')[0] ?? '';
  const extension = path.match(/\.([a-zA-Z0-9]+)$/)?.[1] || getExtensionFromMimeType(mimeType);
  return `${normalized || 'documento'}${extension ? `.${extension}` : ''}`;
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

function resolveDocumentUrl(documentUrl?: string) {
  if (!documentUrl) return undefined;

  try {
    const url = new URL(documentUrl, window.location.origin);
    const isLocalBackend = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);

    if (isLocalBackend && url.origin !== window.location.origin) {
      return `${url.pathname}${url.search}${url.hash}`;
    }

    return url.href;
  } catch {
    return documentUrl;
  }
}

function DocumentPreviewSheet({ document }: { document: SellerDocumentResponse }) {
  const typeLabel = formatDocumentLabel(document.documentType);

  return (
    <div className="seller-document-preview-sheet">
      <div className="seller-document-preview-sheet-head">
        <span className="seller-document-preview-logo">
          <UiIcon name="document" />
        </span>
        <div>
          <strong>{typeLabel.toUpperCase()}</strong>
          <span>Documento registrado en el backend</span>
        </div>
      </div>

      <div className="seller-document-preview-sheet-body">
        <p>Este es un bloque de vista previa de maqueta. El contenido real del documento no está almacenado como archivo en esta vista, pero los metadatos sí provienen del backend.</p>

        <div className="seller-document-preview-line">
          <span>Tipo</span>
          <strong>{typeLabel}</strong>
        </div>
        <div className="seller-document-preview-line">
          <span>Subido el</span>
          <strong>{formatDate(document.uploadedAt)}</strong>
        </div>
        <div className="seller-document-preview-line">
          <span>Responsable</span>
          <strong>{document.owner}</strong>
        </div>
        <div className="seller-document-preview-line">
          <span>Estado</span>
          <strong>{document.status}</strong>
        </div>

        <div className="seller-document-preview-paragraph">
          <span>Notas</span>
          <p>{document.notes || 'Sin notas registradas para este documento.'}</p>
        </div>
      </div>

      <div className="seller-document-preview-sheet-footer">
        <span>Vista referencial</span>
        <strong>{getDocumentFileName(document.documentType)}</strong>
      </div>
    </div>
  );
}

export default function SellerDocumentsModal({ isOpen, onClose, seller, documents }: SellerDocumentsModalProps) {
  const [search, setSearch] = useState('');
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);

  const visibleDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return documents.filter((document) => {
      if (!query) return true;
      return [
        document.documentType,
        document.owner,
        document.notes,
        document.status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [documents, search]);

  const selectedDocument = useMemo(() => {
    if (!selectedDocumentId) return null;
    return visibleDocuments.find((document) => document.id === selectedDocumentId) ?? null;
  }, [selectedDocumentId, visibleDocuments]);
  const selectedDocumentUrl = resolveDocumentUrl(selectedDocument?.documentUrl);

  const handleDownload = async (document: SellerDocumentResponse) => {
    const url = resolveDocumentUrl(document.documentUrl);
    if (!url) {
      window.alert(`El documento "${formatDocumentLabel(document.documentType)}" no tiene URL de descarga disponible.`);
      return;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('No se pudo descargar el documento.');

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = objectUrl;
      link.download = getDownloadName(document, blob.type);
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch {
      const link = window.document.createElement('a');
      link.href = url;
      link.download = getDownloadName(document, getDocumentMimeType(document));
      link.target = '_blank';
      link.rel = 'noreferrer';
      window.document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };

  const handlePreview = (document: SellerDocumentResponse) => {
    setSelectedDocumentId(document.id);
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
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleDocuments.length ? visibleDocuments.map((document) => {
                    const selected = document.id === selectedDocument?.id;
                    return (
                      <tr
                        key={document.id}
                        className={selected ? 'is-selected' : ''}
                      >
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
                              onClick={() => handlePreview(document)}
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
                        <p className="seller-documents-empty-table">No hay documentos que coincidan con la búsqueda.</p>
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
                    <strong>{getDocumentFileName(selectedDocument.documentType)}</strong>
                    <span>{formatDocumentLabel(selectedDocument.documentType)} · {selectedDocument.status}</span>
                  </div>
                </div>

                <div className="seller-documents-preview-frame">
                  {selectedDocumentUrl ? (
                    <DocumentPreview
                      documentName={getDocumentFileName(selectedDocument.documentType)}
                      documentUrl={selectedDocumentUrl}
                      documentType={getDocumentMimeType(selectedDocument)}
                      kind={seller.storeName}
                      resolvedDate={formatDate(selectedDocument.uploadedAt)}
                      resolutionReason={selectedDocument.notes || 'Sin notas registradas para este documento.'}
                    />
                  ) : (
                    <DocumentPreviewSheet document={selectedDocument} />
                  )}
                </div>

                <div className="seller-documents-details-card">
                  <h3>Detalles del documento</h3>
                  <div className="seller-documents-details-grid">
                    <div>
                      <small>Subido el</small>
                      <strong>{formatDate(selectedDocument.uploadedAt)}</strong>
                    </div>
                    <div>
                      <small>Responsable de la carga</small>
                      <strong>{selectedDocument.owner}</strong>
                    </div>
                    <div>
                      <small>Estado</small>
                      <Badge text={selectedDocument.status} variant={getDocumentTone(selectedDocument.status)} />
                    </div>
                    <div>
                      <small>Notas internas</small>
                      <strong>{selectedDocument.notes || 'Sin notas'}</strong>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="seller-documents-empty-preview">
                <UiIcon name="document" />
                <strong>Selecciona un documento</strong>
                <p>Haz clic en el ojo de la tabla para activar la previsualización lateral.</p>
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
