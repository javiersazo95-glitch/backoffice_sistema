import UiIcon from './UiIcon';
import { resolveDocumentUrl } from '@/utils/documentUrls';

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

  const renderPreview = () => {
    if (resolvedDocumentUrl && isImage) {
      return (
        <img
          className="document-preview-file"
          src={resolvedDocumentUrl}
          alt={documentName || 'Documento acreditador'}
        />
      );
    }
    if (resolvedDocumentUrl && isPdf) {
      return (
        <object
          className="document-preview-file"
          data={resolvedDocumentUrl}
          type="application/pdf"
        >
          <iframe src={resolvedDocumentUrl} title={documentName || 'Documento acreditador'} />
        </object>
      );
    }
    if (resolvedDocumentUrl) {
      return (
        <iframe
          className="document-preview-file"
          src={resolvedDocumentUrl}
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
        {resolvedDocumentUrl && (
          <a
            className="secondary-button compact-link-button"
            href={resolvedDocumentUrl}
            target="_blank"
            rel="noreferrer"
          >
            <UiIcon name="eye" /> Abrir documento
          </a>
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
