import { useEffect, useState } from 'react';
import type { SocialEstado, SocialNivelCodigo } from '@/types/capturerSocial';
import { tiempoRestante } from './media';

export const NIVEL_COLOR: Record<SocialNivelCodigo, string> = {
  BRONCE: '#c07a42', PLATA: '#98a6b9', ORO: '#e0b12e', PLATINO: '#4fa6c2', DIAMANTE: '#5a6ff5',
};

const MedalSvg = () => <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
  <path d="M12 2.6 19.4 6v5.6c0 4.6-3.1 8.1-7.4 9.8-4.3-1.7-7.4-5.2-7.4-9.8V6Z" fill="rgba(255,255,255,.22)" />
  <path d="m12 7.6 1.35 2.75 3.05.45-2.2 2.15.52 3.03L12 14.5l-2.72 1.48.52-3.03-2.2-2.15 3.05-.45Z" fill="#fff" stroke="none" />
</svg>;

const NIVEL_KEY = 'repuestop.capturer.social-level';

/** Avance real (0..1) hacia la siguiente medalla, sin el redondeo a entero de progresoPct. */
function avance(e: SocialEstado) {
  if (!e.siguienteNivel || e.puntosSiguienteNivel == null) return 1;
  const actual = e.niveles.find(n => n.codigo === e.nivel)?.puntosMinimos ?? 0;
  const rango = e.puntosSiguienteNivel - actual;
  return rango > 0 ? Math.min(1, Math.max(0, (e.puntos - actual) / rango)) : 1;
}

/** Recuerda el último nivel visto para celebrar cuando el captador sube de medalla. */
function useSubioDeNivel(numero: number) {
  const [subio, setSubio] = useState(false);
  useEffect(() => {
    try {
      const previo = Number(window.localStorage.getItem(NIVEL_KEY) || 0);
      window.localStorage.setItem(NIVEL_KEY, String(numero));
      if (previo && numero > previo) {
        setSubio(true);
        const t = window.setTimeout(() => setSubio(false), 5000);
        return () => window.clearTimeout(t);
      }
    } catch { /* sin storage no hay celebración; el panel funciona igual */ }
    return undefined;
  }, [numero]);
  return subio;
}

/** Medalla/nivel, cupo semanal y requisito de 3 videos del captador. */
export default function SocialLevelPanel({ e, now }: { e: SocialEstado; now: number }) {
  const t = avance(e);
  const siguiente = e.siguienteNivel;
  const cerca = !!siguiente && t >= 0.75;
  const subio = useSubioDeNivel(e.nivelNumero);
  const ilimitado = e.cupoSemanal < 0;
  const faltanPts = e.puntosSiguienteNivel != null ? Math.max(0, e.puntosSiguienteNivel - e.puntos) : 0;
  const faltanCompradores = e.puntosPorComprador > 0 ? Math.ceil(faltanPts / e.puntosPorComprador) : 0;
  const videosOk = e.accesoActivo;
  const cupoAgotado = !ilimitado && (e.descargasRestantes ?? 0) <= 0;

  return <section className="cap-soc-card">
    <div className="cap-soc-status">
      <div className={`cap-soc-medal cap-soc-medal-${e.nivel}${cerca ? ' cerca' : ''}${subio ? ' subio' : ''}`}
        style={siguiente ? ({ '--cap-soc-next': NIVEL_COLOR[siguiente] } as React.CSSProperties) : undefined}
        title={siguiente ? `${Math.round(t * 100)}% del camino a ${e.siguienteMedalla}` : undefined}>
        {/* La medalla va tomando el color de la siguiente a medida que suman compradores que ya compraron. */}
        {siguiente && <span className={`cap-soc-medal-next cap-soc-medal-${siguiente}`} style={{ opacity: t * 0.9 }} aria-hidden="true" />}
        <span className="cap-soc-medal-icon"
          style={siguiente ? { background: `conic-gradient(${NIVEL_COLOR[siguiente]} ${t * 360}deg, rgba(255,255,255,.2) 0deg)` } : undefined}>
          <span className="cap-soc-medal-icon-inner"><MedalSvg /></span>
        </span>
        <div className="cap-soc-medal-body">
          <small>Nivel {e.nivelNumero} · {e.puntos.toLocaleString('es-CL')} pts</small>
          <strong>{subio ? `¡Subiste a ${e.medalla}!` : `Medalla ${e.medalla}`}</strong>
          <span>{e.siguienteMedalla
            ? `Te faltan ${faltanPts.toLocaleString('es-CL')} pts (${faltanCompradores} comprador${faltanCompradores === 1 ? '' : 'es'}) para ${e.siguienteMedalla}`
            : '¡Nivel máximo! Descargas ilimitadas'}</span>
          <div className="cap-soc-bar"><div style={{
            width: `${Math.max(t * 100, e.puntos > 0 ? 2 : 0)}%`,
            background: siguiente ? `linear-gradient(90deg, #fff, ${NIVEL_COLOR[siguiente]})` : '#fff',
          }} /></div>
          <span className="cap-soc-medal-foot">
            {e.compradoresReferidos === 0
              ? 'Aún no tienes compradores referidos con tu código'
              : `${e.compradoresReferidos} referido${e.compradoresReferidos === 1 ? '' : 's'} · ${e.compradoresConvertidos} ya ${e.compradoresConvertidos === 1 ? 'compró' : 'compraron'}`}
            {siguiente && e.compradoresConvertidos > 0 && <b> · evolucionando a {e.siguienteMedalla} ({Math.round(t * 100)}%)</b>}
          </span>
        </div>
      </div>

      <div className={`cap-soc-stat ${cupoAgotado ? 'cap-soc-stat-warn' : ''}`}>
        <small>Descargas esta semana</small>
        <strong>{ilimitado ? `${e.descargasSemana} / ∞` : `${e.descargasSemana} / ${e.cupoSemanal}`}</strong>
        <span>{ilimitado ? 'Sin límite por tu medalla' : `${e.descargasRestantes ?? 0} disponibles · se reinicia en ${tiempoRestante(e.reinicioCupo, now)}`}</span>
      </div>

      <div className={`cap-soc-stat ${videosOk ? 'cap-soc-stat-ok' : 'cap-soc-stat-warn'}`}>
        <small>Requisito: videos en 7 días</small>
        <strong>{Math.min(e.videosUltimos7Dias, e.videosRequeridos)} / {e.videosRequeridos}</strong>
        <div className="cap-soc-dots">{Array.from({ length: e.videosRequeridos }).map((_, i) => <i key={i} className={i < e.videosUltimos7Dias ? 'on' : ''} />)}</div>
        <span>{videosOk ? `Acceso al repositorio activo` : `Sube ${e.videosRequeridos - e.videosUltimos7Dias} video(s) más para descargar`}</span>
      </div>

      <div className={`cap-soc-stat ${videosOk ? '' : 'cap-soc-stat-warn'}`}>
        <small>{videosOk ? 'Tu acceso vence en' : 'Acceso'}</small>
        <strong>{videosOk ? tiempoRestante(e.accesoHasta, now) : 'Bloqueado'}</strong>
        <span>{videosOk ? 'Sube videos nuevos para mantenerlo' : `Cada pieza descargada se bloquea ${e.bloqueoDias} días`}</span>
      </div>
    </div>

    <div className="cap-soc-levels" aria-label="Niveles del repositorio">
      {e.niveles.map(n => <span key={n.codigo} className={`cap-soc-level${n.codigo === e.nivel ? ' on' : ''}`}>
        <i style={{ background: NIVEL_COLOR[n.codigo] }} />
        <b>{n.medalla}</b> {n.puntosMinimos.toLocaleString('es-CL')} pts · {n.descargasSemana < 0 ? 'todo el repositorio' : `${n.descargasSemana}/semana`}
      </span>)}
      <span className="cap-soc-level">Cada comprador que hace al menos una compra suma <b>{e.puntosPorComprador} pts</b></span>
    </div>
  </section>;
}
