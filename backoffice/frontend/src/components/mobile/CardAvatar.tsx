import { useState } from 'react';

interface CardAvatarProps {
  src?: string | null;
  name?: string | null;
}

/** Foto de 40px para tarjetas móviles; si la imagen falta o no carga, muestra iniciales. */
export default function CardAvatar({ src, name }: CardAvatarProps) {
  const [failed, setFailed] = useState(false);
  const initials = (name ?? '?').trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || '?';
  if (!src || failed) return <span className="mb-initials">{initials}</span>;
  return <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />;
}
