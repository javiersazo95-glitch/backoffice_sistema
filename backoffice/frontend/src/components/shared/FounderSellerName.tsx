import UiIcon from '@/components/shared/UiIcon';

interface FounderSellerNameProps {
  name: string | null | undefined;
  founder?: boolean;
}

export default function FounderSellerName({ name, founder = false }: FounderSellerNameProps) {
  return (
    <span className="founder-seller-name" title={founder ? 'Vendedor fundador' : undefined}>
      {name || 'Vendedor'}
      {founder && (
        <UiIcon
          name="crown"
          className="founder-seller-crown"
        />
      )}
    </span>
  );
}
