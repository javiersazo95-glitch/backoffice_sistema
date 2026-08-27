import { useState, useRef } from 'react';

export interface DocumentUploadItem {
  file: File | null;
  previewUrl: string | null;
  error?: string;
}

interface DocumentUploaderProps {
  id: string;
  stepNumber: string;
  badgeText: string;
  title: string;
  subtitle: string;
  recommendationText?: string;
  icon: 'certificate' | 'id-front' | 'id-back';
  value: DocumentUploadItem;
  onChange: (item: DocumentUploadItem) => void;
  required?: boolean;
  accentColor?: string;
  headerBg?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function DocumentUploader({
  id,
  stepNumber,
  badgeText,
  title,
  subtitle,
  recommendationText,
  icon,
  value,
  onChange,
  required = true,
  accentColor = '#2563eb',
  headerBg = '#f8fafc',
}: DocumentUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | null) => {
    if (!file) {
      onChange({ file: null, previewUrl: null });
      return;
    }

    // Validación de tamaño (máx 10 MB)
    if (file.size > 10 * 1024 * 1024) {
      onChange({
        file: null,
        previewUrl: null,
        error: 'El archivo excede el tamaño máximo permitido (10 MB).',
      });
      return;
    }

    // Validación de tipo
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      onChange({
        file: null,
        previewUrl: null,
        error: 'Formato no soportado. Sube una imagen (JPG, PNG) o PDF.',
      });
      return;
    }

    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      onChange({ file, previewUrl: url, error: undefined });
    } else {
      onChange({ file, previewUrl: null, error: undefined });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (value.previewUrl) {
      URL.revokeObjectURL(value.previewUrl);
    }
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onChange({ file: null, previewUrl: null, error: undefined });
  };

  const isPdf = value.file?.type === 'application/pdf';
  const isImage = value.file?.type.startsWith('image/');

  return (
    <div
      style={{
        background: '#ffffff',
        border: value.file ? '2px solid #10b981' : '1.5px solid #e2e8f0',
        borderRadius: 14,
        boxShadow: value.file
          ? '0 4px 16px rgba(16, 185, 129, 0.12)'
          : '0 2px 10px rgba(15, 23, 42, 0.04)',
        overflow: 'hidden',
        transition: 'all 0.25s ease',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header de la tarjeta del documento */}
      <div
        style={{
          background: headerBg,
          padding: '12px 16px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
          rowGap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: accentColor,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            {stepNumber}
          </span>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', lineHeight: 1.25 }}>
            {title}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: accentColor,
              background: 'rgba(255, 255, 255, 0.9)',
              border: `1px solid ${accentColor}40`,
              padding: '2px 8px',
              borderRadius: 99,
            }}
          >
            {badgeText}
          </span>
          {required && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#ef4444',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                padding: '2px 7px',
                borderRadius: 6,
              }}
            >
              Obligatorio
            </span>
          )}
        </div>
      </div>

      {/* Cuerpo del documento */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.45 }}>
          {subtitle}
        </p>

        {recommendationText && (
          <div
            style={{
              fontSize: 12,
              color: '#64748b',
              background: '#f8fafc',
              border: '1px dashed #cbd5e1',
              borderRadius: 8,
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ fontSize: 13 }}>💡</span>
            <span>{recommendationText}</span>
          </div>
        )}

        <input
          ref={inputRef}
          id={id}
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFile(e.target.files[0]);
            }
          }}
        />

        {/* Zona de Arrastrar y Soltar */}
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          style={{
            border: `2px dashed ${value.file ? '#10b981' : isDragging ? accentColor : '#94a3b8'}`,
            borderRadius: 12,
            padding: value.file ? '14px' : '20px 16px',
            background: value.file ? '#f0fdf4' : isDragging ? '#eff6ff' : '#f8fafc',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: value.file ? 'column' : 'row',
            alignItems: value.file ? 'stretch' : 'center',
            gap: value.file ? 12 : 16,
            position: 'relative',
            minWidth: 0,
          }}
        >
          {value.file ? (
            <>
              {/* Fila: miniatura + datos del archivo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                {/* Thumbnail / PDF icon */}
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 10,
                    background: isPdf ? '#fee2e2' : '#e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    overflow: 'hidden',
                    position: 'relative',
                    border: '1px solid rgba(0,0,0,0.08)',
                  }}
                >
                  {isImage && value.previewUrl ? (
                    <img
                      src={value.previewUrl}
                      alt="Vista previa"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : isPdf ? (
                    <div style={{ textAlign: 'center', color: '#dc2626' }}>
                      <PdfIcon />
                      <div style={{ fontSize: 9, fontWeight: 800 }}>PDF</div>
                    </div>
                  ) : (
                    <FileIcon />
                  )}
                </div>

                {/* Info del archivo */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    title={value.file.name}
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#0f172a',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {value.file.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11.5, color: '#64748b' }}>{formatBytes(value.file.size)}</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#059669',
                        background: '#d1fae5',
                        border: '1px solid #a7f3d0',
                        padding: '1px 7px',
                        borderRadius: 99,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        flexShrink: 0,
                      }}
                    >
                      <CheckSmallIcon /> Cargado
                    </span>
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    inputRef.current?.click();
                  }}
                  style={{
                    flex: 1,
                    background: '#ffffff',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: 8,
                    padding: '7px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#334151',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; }}
                >
                  Reemplazar archivo
                </button>
                <button
                  type="button"
                  onClick={clearFile}
                  aria-label="Eliminar archivo"
                  title="Eliminar archivo"
                  style={{
                    background: '#fee2e2',
                    border: '1px solid #fecaca',
                    borderRadius: 8,
                    width: 34,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#dc2626',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#fca5a5'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
                >
                  <TrashIcon />
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Estado vacío con icono grande */}
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: `${accentColor}15`,
                  color: accentColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {icon === 'certificate' ? (
                  <CertificateIcon />
                ) : icon === 'id-front' ? (
                  <IdFrontIcon />
                ) : (
                  <IdBackIcon />
                )}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>
                  <span style={{ color: accentColor }}>Haz clic aquí para seleccionar</span> o arrastra el archivo
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                  Formatos aceptados: <strong>PDF, JPG, PNG</strong> (hasta 10 MB)
                </div>
              </div>
            </>
          )}
        </div>

        {value.error && (
          <div
            style={{
              fontSize: 12.5,
              color: '#b91c1c',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 8,
              padding: '8px 12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>⚠️</span> {value.error}
          </div>
        )}
      </div>
    </div>
  );
}

function CertificateIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <path d="M12 18v-4"/>
      <path d="M8 14h8"/>
    </svg>
  );
}

function IdFrontIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2"/>
      <circle cx="9" cy="10" r="2"/>
      <line x1="15" y1="8" x2="17" y2="8"/>
      <line x1="15" y1="12" x2="17" y2="12"/>
      <line x1="7" y1="16" x2="17" y2="16"/>
    </svg>
  );
}

function IdBackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2"/>
      <line x1="3" y1="10" x2="21" y2="10" strokeWidth="2.5"/>
      <line x1="7" y1="15" x2="13" y2="15"/>
      <line x1="16" y1="15" x2="17" y2="15"/>
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
      <polyline points="13 2 13 9 20 9"/>
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  );
}

function CheckSmallIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}
