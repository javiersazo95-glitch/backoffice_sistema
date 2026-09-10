interface SellerBehaviorProps {
  rating: number;
  reports: number;
  mediations: number;
}

export default function SellerBehavior({ rating, reports, mediations }: SellerBehaviorProps) {
  return (
    <div className="seller-behavior" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
      <span>
        <strong>{rating.toFixed(1)}</strong>
        Valoracion
      </span>
      <span>
        <strong>{reports}</strong>
        Reportes
      </span>
      <span>
        <strong>{mediations}</strong>
        Mediaciones
      </span>
    </div>
  );
}
