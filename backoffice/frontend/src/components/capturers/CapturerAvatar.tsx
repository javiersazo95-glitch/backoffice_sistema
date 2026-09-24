import { useState } from 'react';
import type { CSSProperties } from 'react';
import { resolveProfileImageUrl } from '@/api/client';

type Props = {
  /** Nombre o alias: de aca salen las iniciales cuando no hay foto. */
  nombre?: string | null;
  fotoPerfil?: string | null;
  size?: number;
  /** Con clase, el tamaño y la forma los pone su CSS; sin clase, se dibuja un circulo de `size`. */
  className?: string;
  background?: string;
  title?: string;
};

export function inicialesCaptador(nombre?: string | null) {
  const limpio = (nombre ?? '').replace(/^@/, '').trim();
  if (!limpio) return '?';
  const partes = limpio.split(/\s+/).filter(Boolean);
  return (partes.length > 1 ? partes[0]![0]! + partes[1]![0]! : limpio.slice(0, 2)).toUpperCase();
}

/**
 * Foto de perfil del captador en cualquier vista (listas, ranking, detalle, pagos). Si no tiene
 * foto o la imagen no carga, muestra sus iniciales: antes el `onError` solo escondia la imagen
 * y el circulo quedaba vacio.
 */
export default function CapturerAvatar({ nombre, fotoPerfil, size = 34, className, background, title }: Props) {
  const url = resolveProfileImageUrl(fotoPerfil);
  const [fallida, setFallida] = useState<string | null>(null);
  const conFoto = Boolean(url) && fallida !== url;
  // Con clase, el fondo lo pone su CSS salvo que se pida uno (p. ej. el color por posicion).
  const base: CSSProperties = className
    ? (conFoto ? { background: '#fff' } : background ? { background } : {})
    : {
      width: size,
      height: size,
      borderRadius: '50%',
      flexShrink: 0,
      display: 'inline-grid',
      placeItems: 'center',
      overflow: 'hidden',
      background: conFoto ? '#fff' : (background ?? '#1e40af'),
      color: '#fff',
      fontSize: Math.round(size * 0.38),
      fontWeight: 800,
      lineHeight: 1,
    };
  return (
    <span className={className} style={base} title={title}>
      {conFoto ? (
        <img
          src={url!}
          alt=""
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          onError={() => setFallida(url)}
        />
      ) : inicialesCaptador(nombre)}
    </span>
  );
}
