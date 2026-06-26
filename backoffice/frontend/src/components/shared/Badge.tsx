interface BadgeProps {
  text: string;
  variant?: string;
}

export default function Badge({ text, variant = '' }: BadgeProps) {
  const getVariantClass = (v: string): string => {
    const slug = v.toLowerCase().replace(/\s+/g, '-');
    if (['green', 'blue', 'violet', 'amber', 'orange', 'red'].includes(slug)) return slug;
    if (slug.includes('aprobado') || slug.includes('activa') || slug.includes('alto') || slug.includes('resuelta')) return 'green';
    if (slug.includes('pendiente') || slug.includes('medio') || slug.includes('esperando')) return 'amber';
    if (slug.includes('revision') || slug.includes('revisión') || slug.includes('en_revision') || slug.includes('corregir')) return 'orange';
    if (slug.includes('escalado')) return 'orange';
    if (slug.includes('suspendido') || slug.includes('suspendida') || slug.includes('bajo') || slug.includes('cuenta-bloqueada') || slug.includes('bloqueada') || slug.includes('rechazado') || slug.includes('rechazada')) return 'red';
    if (slug.includes('mediacion')) return 'violet';
    return '';
  };

  return <span className={`badge ${getVariantClass(variant)}`}>{text}</span>;
}
