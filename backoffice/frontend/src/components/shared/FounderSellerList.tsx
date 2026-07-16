import FounderSellerName from '@/components/shared/FounderSellerName';

interface FounderSellerListProps {
  sellers: Array<{ name: string; founder?: boolean }>;
}

export default function FounderSellerList({ sellers }: FounderSellerListProps) {
  const unique = sellers.filter(
    (seller, index) => sellers.findIndex((candidate) => candidate.name === seller.name) === index,
  );

  return (
    <>
      {unique.map((seller, index) => (
        <span key={seller.name}>
          {index > 0 && ', '}
          <FounderSellerName name={seller.name} founder={seller.founder} />
        </span>
      ))}
    </>
  );
}
