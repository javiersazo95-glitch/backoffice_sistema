import UiIcon from './UiIcon';

interface DocumentPreviewProps {
  documentName: string;
  documentUrl?: string;
  documentType?: string;
  kind: string;
  resolvedDate: string;
  resolutionReason: string;
}

export default function DocumentPreview({
  documentName,
  documentUrl,
  documentType,
  kind,
  resolvedDate,
  resolutionReason,
}: DocumentPreviewProps) {
  const isImage = documentType?.startsWith('image/');
  const isPdf = documentType === 'application/pdf' || /\.pdf$/i.test(documentName || '');

  const renderPreview = () => {
    if (documentUrl && isImage) {
      return (
        <img
          className="document-preview-file"
          src={documentUrl}
          alt={documentName || 'Documento acreditador'}
        />
      );
    }
    if (documentUrl && isPdf) {
      return (
        <object
          className="document-preview-file"
          data={documentUrl}
          type="application/pdf"
        >
          <iframe src={documentUrl} title={documentName || 'Documento acreditador'} />
        </object>
      );
    }
    if (documentUrl) {
      return (
        <iframe
          className="document-preview-file"
          src={documentUrl}
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
          <a
            className="secondary-button compact-link-button"
            href={documentUrl}
            target="_blank"
            rel="noreferrer"
          >
            <UiIcon name="eye" /> Abrir documento
          </a>
        )}
      </div>
      <div className="document-preview-canvas">{renderPreview()}</div>
      <p>{resolutionReason}</p>
    </div>
  );
}
