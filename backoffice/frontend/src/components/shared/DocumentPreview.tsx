import { useState, useEffect } from 'react';
import UiIcon from './UiIcon';
import { resolveDocumentUrl, previewDocument, getAuthHeadersFor, esTipoMostrable } from '@/utils/documentUrls';

interface DocumentPreviewProps {
  documentName: string;
  documentUrl?: string;
  documentType?: string;
  kind: string;
  resolvedDate: string;
  resolutionReason: string;
}

interface TimelineItem {
  type: string;
  tagLabel: string;
  timestamp: string;
  message: string;
}

function parseNotesToTimeline(notes: string | undefined): TimelineItem[] {
  if (!notes || !notes.trim()) return [];

  const lines = notes.split('\n').map((l) => l.trim()).filter(Boolean);
  const items: TimelineItem[] = [];

  const tagRegex = /^\[([^\]-]+)(?:\s*-\s*([^\]]+))?\](?:\s*\((?:Adjuntos|Documentos):\s*(.+?)\))?:\s*(.*)$/;
  const oldTagRegex = /^\[([^\]]+)\]:\s*(.*)$/;

  lines.forEach((line) => {
    const match = line.match(tagRegex);
    if (match) {
      const tag = match[1]?.trim() || '';
      const time = match[2]?.trim() || '';
      const msg = match[4]?.trim() || '';

      let type = 'nota_general';
      let tagLabel = tag;

      const cleanTag = tag.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (cleanTag.includes('rechazo')) {
        type = 'rechazo';
        tagLabel = 'Rechazo';
      } else if (cleanTag.includes('solicitada') || cleanTag.includes('solicitar')) {
        type = 'correccion_solicitada';
        tagLabel = 'Corrección Solicitada';
      } else if (cleanTag.includes('apelacion')) {
        type = 'apelacion_vendedor';
        tagLabel = 'Apelación de Vendedor';
      } else if (cleanTag.includes('correccion') || cleanTag.includes('vendedor')) {
        type = 'correccion_vendedor';
        tagLabel = 'Corrección de Vendedor';
      }

      items.push({
        type,
        tagLabel,
        timestamp: time || 'Histórico',
        message: msg,
      });
    } else {
      const oldMatch = line.match(oldTagRegex);
      if (oldMatch) {
        const tag = oldMatch[1]?.trim() || '';
        const msg = oldMatch[2]?.trim() || '';

        let type = 'nota_general';
        let tagLabel = tag;

        const cleanTag = tag.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (cleanTag.includes('rechazo')) {
          type = 'rechazo';
          tagLabel = 'Rechazo';
        } else if (cleanTag.includes('solicitada') || cleanTag.includes('solicitar')) {
          type = 'correccion_solicitada';
          tagLabel = 'Corrección Solicitada';
        } else if (cleanTag.includes('apelacion')) {
          type = 'apelacion_vendedor';
          tagLabel = 'Apelación de Vendedor';
        } else if (cleanTag.includes('correccion') || cleanTag.includes('vendedor')) {
          type = 'correccion_vendedor';
          tagLabel = 'Corrección de Vendedor';
        }

        items.push({
          type,
          tagLabel,
          timestamp: 'Histórico',
          message: msg,
        });
      } else {
        items.push({
          type: 'nota_general',
          tagLabel: 'Nota',
          timestamp: 'Histórico',
          message: line,
        });
      }
    }
  });

  return items;
}

export default function DocumentPreview({
  documentName,
  documentUrl,
  documentType,
  kind,
  resolvedDate,
  resolutionReason,
}: DocumentPreviewProps) {
  const resolvedDocumentUrl = resolveDocumentUrl(documentUrl);
  const isImage = documentType?.startsWith('image/');
  const isPdf = documentType === 'application/pdf' || /\.pdf$/i.test(documentName || '');

  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);
  // SEC-BACKEND-153: un archivo que no es PDF ni imagen no se muestra (el blob tendria el origen del backoffice).
  const [noMostrable, setNoMostrable] = useState<boolean>(false);

  useEffect(() => {
    if (!resolvedDocumentUrl) {
      setBlobUrl(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setHasError(false);
    setNoMostrable(false);

    fetch(resolvedDocumentUrl, { headers: getAuthHeadersFor(resolvedDocumentUrl) })
      .then((res) => {
        if (!res.ok) throw new Error('Error al cargar documento');
        return res.blob();
      })
      .then((blob) => {
        if (isMounted && !esTipoMostrable(blob.type)) {
          setNoMostrable(true);
          setLoading(false);
          return;
        }
        if (isMounted) {
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error al cargar vista previa:', err);
        if (isMounted) {
          setHasError(true);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [resolvedDocumentUrl]);

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="document-preview-empty">
          <p>Cargando vista previa segura del documento...</p>
        </div>
      );
    }

    if (hasError) {
      return (
        <div className="document-preview-empty">
          <span className="status-icon red">
            <UiIcon name="document" />
          </span>
          <strong>Error al cargar el documento</strong>
          <p>No se pudo obtener el archivo del servidor. Es posible que el recurso requiera autenticación o no exista.</p>
        </div>
      );
    }

    if (noMostrable) {
      return (
        <div className="document-preview-empty">
          <span className="status-icon blue">
            <UiIcon name="document" />
          </span>
          <strong>No hay vista previa disponible</strong>
          <p>El archivo no es una imagen ni un PDF. Descárgalo para revisarlo.</p>
        </div>
      );
    }

    const displayUrl = blobUrl || resolvedDocumentUrl;

    if (displayUrl && isImage) {
      return (
        <img
          className="document-preview-file"
          src={displayUrl}
          alt={documentName || 'Documento acreditador'}
        />
      );
    }
    if (displayUrl && isPdf) {
      return (
        <object
          className="document-preview-file"
          data={displayUrl}
          type="application/pdf"
        >
          <iframe src={displayUrl} title={documentName || 'Documento acreditador'} />
        </object>
      );
    }
    if (displayUrl) {
      return (
        <iframe
          className="document-preview-file"
          src={displayUrl}
          title={documentName || 'Documento acreditador'}
        />
      );
    }
    return (
      <div className="document-preview-empty">
        <span className="status-icon blue">
          <UiIcon name="document" />
        </span>
        <strong>No hay vista previa disponible</strong>
        <p>El documento cargado no es una imagen o PDF compatible con previsualización.</p>
      </div>
    );
  };

  return (
    <div className="document-preview">
      <div className="document-preview-toolbar">
        <div>
          <strong>{documentName || 'Documento acreditador'}</strong>
          <span>{kind} · {resolvedDate}</span>
        </div>
        {documentUrl && (
          <button
            type="button"
            className="secondary-button compact-link-button"
            onClick={() => void previewDocument(documentUrl)}
          >
            <UiIcon name="eye" /> Abrir documento
          </button>
        )}
      </div>
      <div className="document-preview-canvas">{renderPreview()}</div>
      {(() => {
        const timelineItems = parseNotesToTimeline(resolutionReason).reverse();
        const isHistoryTimeline = timelineItems.length > 1 || (timelineItems.length === 1 && timelineItems[0]?.type !== 'nota_general');
        
        if (isHistoryTimeline) {
          return (
            <div className="document-preview-notes-timeline" style={{ width: '100%', marginTop: '16px', padding: '0 16px 16px' }}>
              <small style={{ fontSize: '11px', fontWeight: 600, color: '#7b8aa1', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                Historial de observaciones
              </small>
              <div className="validation-timeline" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {timelineItems.map((item, idx) => (
                  <div key={idx} className={`validation-timeline-item ${item.type}`}>
                    <div className="validation-timeline-header">
                      <span className="validation-timeline-tag">{item.tagLabel}</span>
                      <span className="validation-timeline-time">{item.timestamp}</span>
                    </div>
                    <div className="validation-timeline-message">{item.message}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        
        return <p style={{ padding: '0 16px 16px', margin: 0, fontSize: '12.5px', color: '#475569' }}>{resolutionReason}</p>;
      })()}
    </div>
  );
}
