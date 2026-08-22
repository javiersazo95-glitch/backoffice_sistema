import { useEffect, useState } from 'react';
import type { ImgHTMLAttributes } from 'react';
import { useAuthedImage } from '@/hooks/useAuthedImage';

interface AuthedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  /** Ruta o URL tal como la entrega el backend (ej. /api/v1/uploads/r2/Publicidad/...). */
  src?: string | null;
  /** Imagen a mostrar si la foto no existe o no se pudo cargar. */
  fallbackSrc?: string;
}

/**
 * <img> para archivos servidos por el backend: resuelve la ruta y, cuando apunta al proxy
 * propio (que exige el token del backoffice), la descarga autenticada antes de pintarla.
 */
export default function AuthedImage({ src, fallbackSrc, alt, ...imgProps }: AuthedImageProps) {
  const resolvedSrc = useAuthedImage(src);
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    setHasFailed(false);
  }, [resolvedSrc]);

  const finalSrc = !resolvedSrc || hasFailed ? fallbackSrc : resolvedSrc;
  if (!finalSrc) return null;

  return <img {...imgProps} src={finalSrc} alt={alt} onError={() => setHasFailed(true)} />;
}
