import { API_BASE_URL } from '@/api/client';

const MIME_EXTENSION_MAP: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'text/html': 'html',
};

function getAbsoluteApiBaseUrl() {
  if (API_BASE_URL.startsWith('http://') || API_BASE_URL.startsWith('https://')) {
    return API_BASE_URL;
  }

  if (typeof window !== 'undefined') {
    return new URL(API_BASE_URL, window.location.origin).href;
  }

  return API_BASE_URL;
}

function sanitizeFileName(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]+/g, '')
    .replace(/\s+/g, '_');
}

function getUrlExtension(url?: string) {
  if (!url) return '';

  try {
    const pathname = new URL(resolveDocumentUrl(url) ?? url, getAbsoluteApiBaseUrl()).pathname;
    return pathname.match(/\.([a-zA-Z0-9]+)$/)?.[1] ?? '';
  } catch {
    return url.split('?')[0]?.match(/\.([a-zA-Z0-9]+)$/)?.[1] ?? '';
  }
}

function getMimeExtension(mimeType?: string) {
  return mimeType ? MIME_EXTENSION_MAP[mimeType.toLowerCase()] ?? '' : '';
}

export function resolveDocumentUrl(documentUrl?: string) {
  if (!documentUrl) return undefined;

  try {
    const url = new URL(documentUrl, getAbsoluteApiBaseUrl());
    const isLocalBackend = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);

    if (isLocalBackend && typeof window !== 'undefined' && url.origin !== window.location.origin) {
      return `${url.pathname}${url.search}${url.hash}`;
    }

    return url.href;
  } catch {
    return documentUrl;
  }
}

export function buildDocumentDownloadName(documentType: string, documentUrl?: string, mimeType?: string) {
  const normalized = sanitizeFileName(documentType);
  const extension = getUrlExtension(documentUrl) || getMimeExtension(mimeType);
  return `${normalized || 'documento'}${extension ? `.${extension}` : ''}`;
}

export async function downloadDocument(documentUrl?: string, fileName = 'documento') {
  const resolvedUrl = resolveDocumentUrl(documentUrl);
  if (!resolvedUrl) return false;

  try {
    const response = await fetch(resolvedUrl);
    if (!response.ok) throw new Error('No se pudo descargar el documento.');

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    return true;
  } catch {
    const link = window.document.createElement('a');
    link.href = resolvedUrl;
    link.download = fileName;
    link.target = '_blank';
    link.rel = 'noreferrer';
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    return false;
  }
}
