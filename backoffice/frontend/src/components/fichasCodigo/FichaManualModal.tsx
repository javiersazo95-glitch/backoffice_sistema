import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as fichasApi from '@/api/fichasCodigo';
import { mensajeDeError } from '@/api/client';
import Modal from '@/components/shared/Modal';
import EditorVehiculos, { type VehiculoEditable } from './EditorVehiculos';

interface Props {
  abierto: boolean;
  codigoInicial?: string;
  onClose: () => void;
  onCreada: (fichaId: number) => void;
}

/** Crea ya verificada la ficha de un codigo que el catalogo externo no conoce o conoce mal. */
export default function FichaManualModal({ abierto, codigoInicial = '', onClose, onCreada }: Props) {
  const queryClient = useQueryClient();
  const subcategorias = useQuery({ queryKey: ['fichas-codigo', 'subcategorias'], queryFn: fichasApi.getSubcategorias, staleTime: 3_600_000, enabled: abierto });
  const [codigo, setCodigo] = useState(codigoInicial);
  const [marca, setMarca] = useState('');
  const [nombre, setNombre] = useState('');
  const [subcategoriaId, setSubcategoriaId] = useState<number | null>(null);
  const [vehiculos, setVehiculos] = useState<VehiculoEditable[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (abierto) {
      setCodigo(codigoInicial);
      setMarca('');
      setNombre('');
      setSubcategoriaId(null);
      setVehiculos([]);
      setError('');
    }
  }, [abierto, codigoInicial]);

  const crear = useMutation({
    mutationFn: () => fichasApi.crearFichaManual({
      codigo: codigo.trim(), marca: marca.trim(), nombre: nombre.trim(), subcategoriaId,
      grupos: vehiculos.map((v) => ({ marca: v.marca, modelo: v.modelo, anioDesde: v.anioDesde, anioHasta: v.anioHasta, motor: v.motor })),
    }),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ['fichas-codigo'] });
      onCreada(r.detalle.resumen.id);
    },
    onError: (e) => setError(mensajeDeError(e, 'No se pudo crear la ficha.')),
  });

  const completo = codigo.trim().length >= 3 && marca.trim() !== '' && nombre.trim() !== '';

  return (
    <Modal isOpen={abierto} onClose={onClose} title="Crear ficha a mano" wide>
      <div className="fc-detalle">
        <p className="panel-hint">Para un código que el catálogo externo no conoce. Queda verificada, no vence y las tiendas la usan al publicar con ese código y marca.</p>
        {error && <div className="notice error" role="alert"><p>{error}</p></div>}
        <div className="fc-grid-2">
          <label className="fc-campo">Código del fabricante
            <input className="input" value={codigo} maxLength={80} onChange={(e) => setCodigo(e.target.value)} />
          </label>
          <label className="fc-campo">Marca del repuesto
            <input className="input" value={marca} maxLength={80} placeholder="Ej.: TRW" onChange={(e) => setMarca(e.target.value)} />
          </label>
        </div>
        <label className="fc-campo">Nombre del repuesto
          <input className="input" value={nombre} maxLength={200} placeholder="Ej.: Juego de pastillas de freno delanteras" onChange={(e) => setNombre(e.target.value)} />
        </label>
        <label className="fc-campo">Categoría
          <select className="select" value={subcategoriaId ?? ''} onChange={(e) => setSubcategoriaId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">Sin asignar</option>
            {(subcategorias.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.categoriaNombre} › {s.nombre}</option>)}
          </select>
        </label>
        <h3>Vehículos compatibles</h3>
        <EditorVehiculos vehiculos={vehiculos} onChange={setVehiculos} disabled={crear.isPending} />
        <div className="fc-botones">
          <button type="button" className="primary-button" disabled={!completo || crear.isPending} onClick={() => { setError(''); crear.mutate(); }}>
            {crear.isPending ? 'Creando…' : 'Crear ficha verificada'}
          </button>
          <button type="button" className="ghost-button" disabled={crear.isPending} onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </Modal>
  );
}
