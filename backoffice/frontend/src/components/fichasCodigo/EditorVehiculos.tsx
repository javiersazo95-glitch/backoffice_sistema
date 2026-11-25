import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as fichasApi from '@/api/fichasCodigo';
import type { GrupoCorreccion } from '@/types/fichaCodigo';

/** Un vehiculo de la lista editable: lo que ya traia la ficha (con sus versiones) o lo que soporte agrega. */
export interface VehiculoEditable extends GrupoCorreccion {
  clave: string;
  resumenVersiones?: string;
}

interface Props {
  vehiculos: VehiculoEditable[];
  onChange: (vehiculos: VehiculoEditable[]) => void;
  disabled?: boolean;
}

const anios = (v: GrupoCorreccion) => {
  if (!v.anioDesde) return 'sin años';
  return v.anioHasta && v.anioHasta !== v.anioDesde ? `${v.anioDesde}-${v.anioHasta}` : String(v.anioDesde);
};

let secuencia = 0;
export const nuevaClave = () => `v${Date.now()}-${secuencia++}`;

/**
 * Los vehiculos de una ficha. Los que ya estaban se conservan con sus versiones exactas y solo se pueden quitar;
 * los que se agregan se resuelven en el servidor contra el catalogo chileno por marca, modelo y anios.
 */
export default function EditorVehiculos({ vehiculos, onChange, disabled }: Props) {
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [motor, setMotor] = useState('');
  const marcas = useQuery({ queryKey: ['fichas-codigo', 'marcas-vehiculo'], queryFn: fichasApi.getMarcasVehiculo, staleTime: 3_600_000 });

  const anioDesde = Number(desde);
  const anioHasta = hasta ? Number(hasta) : anioDesde;
  const valido = marca.trim() !== '' && modelo.trim() !== '' && anioDesde >= 1950 && anioDesde <= 2100 && anioHasta >= anioDesde && anioHasta <= 2100;

  const agregar = () => {
    if (!valido) return;
    onChange([...vehiculos, { clave: nuevaClave(), marca: marca.trim(), modelo: modelo.trim(), anioDesde, anioHasta, motor: motor.trim() || null }]);
    setModelo('');
    setDesde('');
    setHasta('');
    setMotor('');
  };

  return (
    <div className="fc-vehiculos">
      {vehiculos.length === 0 ? (
        <p className="panel-hint">La ficha no tiene vehículos. Agrega al menos uno.</p>
      ) : (
        <ul className="fc-vehiculo-lista">
          {vehiculos.map((v) => (
            <li key={v.clave}>
              <div>
                <strong>{v.marca} {v.modelo}</strong> <span className="fc-chip">{anios(v)}</span>
                {v.motor && <span className="fc-chip">{v.motor}</span>}
                <div className="panel-hint">
                  {v.resumenVersiones ?? 'Se buscarán las versiones del catálogo al guardar'}
                </div>
              </div>
              <button type="button" className="ghost-button" disabled={disabled}
                onClick={() => onChange(vehiculos.filter((x) => x.clave !== v.clave))} aria-label={`Quitar ${v.marca} ${v.modelo}`}>
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="fc-agregar">
        <input className="input" list="fc-marcas" placeholder="Marca" value={marca} disabled={disabled} onChange={(e) => setMarca(e.target.value)} />
        <datalist id="fc-marcas">{(marcas.data ?? []).map((m) => <option key={m.id} value={m.nombre} />)}</datalist>
        <input className="input" placeholder="Modelo" value={modelo} disabled={disabled} onChange={(e) => setModelo(e.target.value)} />
        <input className="input fc-anio" type="number" placeholder="Desde" value={desde} disabled={disabled} onChange={(e) => setDesde(e.target.value)} />
        <input className="input fc-anio" type="number" placeholder="Hasta" value={hasta} disabled={disabled} onChange={(e) => setHasta(e.target.value)} />
        <input className="input" placeholder="Motor (opcional, ej. 1.6)" value={motor} disabled={disabled} onChange={(e) => setMotor(e.target.value)} />
        <button type="button" className="secondary-button" disabled={disabled || !valido} onClick={agregar}>Agregar</button>
      </div>
    </div>
  );
}
