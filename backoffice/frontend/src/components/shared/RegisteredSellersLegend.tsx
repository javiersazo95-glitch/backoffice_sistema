import UiIcon from './UiIcon';

export default function RegisteredSellersLegend() {
  return (
    <div className="registered-sellers-legend">
      <UiIcon name="check" />
      <span>En esta vista solo se muestran vendedores registrados.</span>
    </div>
  );
}
