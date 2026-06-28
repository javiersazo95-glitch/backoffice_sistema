interface SellerBehaviorProps {
  rating: number;
  claims: number;
  pendingReceipts: number;
}

export default function SellerBehavior({ rating, claims, pendingReceipts }: SellerBehaviorProps) {
  return (
    <div className="seller-behavior" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
      <span>
        <strong>{rating.toFixed(1)}</strong>
        Valoracion
      </span>
      <span>
        <strong>{claims}</strong>
        Reclamos
      </span>
      <span>
        <strong>{pendingReceipts}</strong>
        Reportes
      </span>
    </div>
  );
}
