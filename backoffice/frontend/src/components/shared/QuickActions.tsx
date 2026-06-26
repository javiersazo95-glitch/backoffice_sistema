interface QuickActionsProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export default function QuickActions({ title = 'Acciones requeridas', children, className = '' }: QuickActionsProps) {
  return (
    <div className={`quick-actions ${className}`}>
      {title && <h3>{title}</h3>}
      {children}
    </div>
  );
}
