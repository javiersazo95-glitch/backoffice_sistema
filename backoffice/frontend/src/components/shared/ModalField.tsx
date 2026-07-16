interface ModalFieldProps {
  label: string;
  value: React.ReactNode;
  wide?: boolean;
}

export default function ModalField({ label, value, wide = false }: ModalFieldProps) {
  return (
    <div className={`modal-field${wide ? ' wide' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
