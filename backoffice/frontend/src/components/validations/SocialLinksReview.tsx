import type { ReactNode } from 'react';

type SocialKey = 'instagramUrl' | 'facebookUrl' | 'tiktokUrl';

export type StoreSocialLinks = Partial<Record<SocialKey, string | null>>;

type SocialNetwork = {
  key: SocialKey;
  label: string;
  color: string;
  domains: string[];
  icon: ReactNode;
};

/**
 * Misma regla que `RedesSocialesTienda` del backend, la app y el Market: solo https al dominio
 * de cada red y con un perfil en la ruta. El servidor ya lo exige al guardar; aquí se repite
 * para no ofrecer como enlace nada que no la cumpla (datos antiguos o alterados).
 */
const SOCIAL_NETWORKS: SocialNetwork[] = [
  {
    key: 'instagramUrl',
    label: 'Instagram',
    color: '#E4405F',
    domains: ['instagram.com', 'instagr.am'],
    icon: (
      <>
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <circle cx="12" cy="12" r="4" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </>
    ),
  },
  {
    key: 'facebookUrl',
    label: 'Facebook',
    color: '#1877F2',
    domains: ['facebook.com', 'fb.com', 'fb.me'],
    icon: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
  },
  {
    key: 'tiktokUrl',
    label: 'TikTok',
    color: '#111111',
    domains: ['tiktok.com'],
    icon: <path d="M9 12a4 4 0 1 0 4 4V2c0 2.8 2.2 5 5 5" />,
  },
];

function safeSocialUrl(value: string | null | undefined, network: SocialNetwork): string | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;
  const match = /^https:\/\/([^/?#@\s]+)(\/[^\s#]*)$/i.exec(raw);
  if (!match) return null;
  const host = (match[1] ?? '').toLowerCase();
  const path = match[2] ?? '';
  const ownDomain = network.domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  if (!ownDomain || path === '' || path === '/' || path.startsWith('/?')) return null;
  return raw;
}

/** Redes sociales que declaró la tienda, para revisarlas antes de aprobar la verificación. */
export default function SocialLinksReview({ links }: { links: StoreSocialLinks }) {
  const declared = SOCIAL_NETWORKS.filter((network) => (links[network.key] ?? '').trim());

  if (declared.length === 0) {
    return <p className="validation-social-empty">La tienda no registró redes sociales.</p>;
  }

  return (
    <div className="validation-social-list">
      {declared.map((network) => {
        const value = (links[network.key] ?? '').trim();
        const url = safeSocialUrl(value, network);
        return (
          <div className="validation-social-row" key={network.key}>
            <span className="validation-social-icon" style={{ color: network.color }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                {network.icon}
              </svg>
            </span>
            <div className="validation-social-copy">
              <strong>{network.label}</strong>
              {/* El enlace completo a la vista: el operador confirma el dominio antes de abrirlo. */}
              <span title={value}>{value}</span>
              {!url && <small className="validation-social-invalid">Enlace no válido para {network.label}: no se abre.</small>}
            </div>
            {url && (
              <a className="validation-social-open" href={url} target="_blank" rel="noopener noreferrer nofollow">
                Abrir perfil
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
