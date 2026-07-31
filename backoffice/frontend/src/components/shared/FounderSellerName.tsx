import UiIcon from '@/components/shared/UiIcon';

interface FounderSellerNameProps {
  name: string | null | undefined;
  founder?: boolean;
  isPartner?: boolean;
}

export default function FounderSellerName({ name, founder = false, isPartner = false }: FounderSellerNameProps) {
  if (isPartner) {
    return (
      <span className="founder-seller-name" title="Socio fundador">
        {name || 'Socio'}
        <UiIcon
          name="user"
          className="partner-seller-icon"
          style={{ display: 'inline-block', width: 14, height: 14, marginLeft: 5, color: '#7c3aed', verticalAlign: -2 }}
        />
      </span>
    );
  }

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
