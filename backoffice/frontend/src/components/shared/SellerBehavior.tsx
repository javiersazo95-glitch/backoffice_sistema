interface SellerBehaviorProps {
  rating: number;
  returns: number;
  claims: number;
  pendingReceipts: number;
}

export default function SellerBehavior({ rating, returns, claims, pendingReceipts }: SellerBehaviorProps) {
  return (
    <div className="seller-behavior">
      <span>
        <strong>{rating.toFixed(1)}</strong>
        Valoracion
      </span>
      <span>
        <strong>{returns}</strong>
        Devoluciones
      </span>
      <span>
        <strong>{claims}</strong>
        Reclamos
      </span>
      <span>
        <strong>{pendingReceipts}</strong>
        Boletas pend.
      </span>
    </div>
  );
}
