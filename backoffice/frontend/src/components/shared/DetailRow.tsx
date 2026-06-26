interface DetailRowProps {
  label: string;
  value: React.ReactNode;
}

export default function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}
