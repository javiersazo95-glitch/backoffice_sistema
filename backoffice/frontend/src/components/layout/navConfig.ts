import type { UserSummaryResponse } from '@/types/auth';
import { Role } from '@/types/auth';
import { hasBackofficePermission, isSupportQaOnly } from '@/hooks/usePermissions';

export interface NavItem {
  path: string;
  label: string;
  badge: number;
  icon: string;
  exact?: boolean;
  /** Rutas adicionales que dejan el item activo (p. ej. el index del area). */
  aliases?: string[];
  /** Etiqueta corta para la barra inferior movil, donde la completa no cabe. */
  shortLabel?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/** Secciones de navegacion del backoffice. Compartidas por el sidebar de escritorio y la barra movil. */
export const navSections: NavSection[] = [
  {
    title: 'Backoffice',
    items: [
      { path: '/', label: 'Inicio', badge: 0, icon: 'dashboard', exact: true },
      { path: '/administracion', label: 'Administración Contable', badge: 0, icon: 'wallet' },
      { path: '/soporte', label: 'Soporte', badge: 0, icon: 'message' },
    ],
  },
  {
    title: 'Soporte Técnico',
    items: [
      { path: '/soporte', label: 'Resumen', badge: 0, icon: 'dashboard', exact: true },
      { path: '/soporte/tickets', label: 'Tickets', badge: 0, icon: 'message' },
      { path: '/soporte/qa-reports', label: 'Reportes QA', badge: 0, icon: 'alert' },
      { path: '/soporte/carga-inventario', label: 'Soporte carga de inventario', shortLabel: 'Carga inventario', badge: 0, icon: 'upload' },
    ],
  },
  {
    title: 'Administración Contable',
    items: [
      { path: '/administracion/resumen', label: 'Resumen', badge: 0, icon: 'dashboard', exact: true },
      { path: '/administracion/pedidos', label: 'Pedidos', badge: 0, icon: 'wallet' },
      { path: '/administracion/liquidaciones', label: 'Liquidaciones', badge: 0, icon: 'clipboard' },
      { path: '/administracion/gastos', label: 'Caja y gastos', badge: 0, icon: 'receipt' },
      { path: '/administracion/pago-proveedores', label: 'Pago a proveedores', badge: 0, icon: 'wallet' },
      { path: '/administracion/pago-captadores', label: 'Pago a captadores', badge: 0, icon: 'users' },
      { path: '/administracion/cumplimiento', label: 'Cumplimiento SII', badge: 0, icon: 'shieldCheck' },
    ],
  },
  {
    title: 'Gestión de Confianza',
    items: [
      { path: '/confianza', label: 'Resumen', badge: 0, icon: 'shield', exact: true },
      { path: '/confianza/validations', label: 'Validaciones', badge: 0, icon: 'fileCheck' },
      { path: '/confianza/mediations', label: 'Mediaciones', badge: 0, icon: 'scale' },
      { path: '/confianza/sellers', label: 'Vendedores', badge: 0, icon: 'store' },
      // 9-oct: situacion tributaria de las tiendas (reverificacion de enero y julio).
      { path: '/confianza/cumplimiento-tributario', label: 'Cumplimiento tributario', shortLabel: 'Tributario', badge: 0, icon: 'shieldCheck' },
      { path: '/confianza/captadores', label: 'Captadores', badge: 0, icon: 'users' },
      { path: '/confianza/reports', label: 'Reportes', badge: 0, icon: 'flag' },
      { path: '/confianza/feedback', label: 'Feedback', badge: 0, icon: 'message' },
    ],
  },
];

/**
 * Secciones visibles para el usuario en la ruta actual. Logica identica a la que usaba el
 * sidebar (se movio aqui para compartirla con la barra inferior movil).
 */
export function getVisibleSections(user: UserSummaryResponse | null, pathname: string): NavSection[] {
  const isConfianza = pathname.startsWith('/confianza');
  const isAdmin = pathname.startsWith('/administracion');
  const isSupport = pathname.startsWith('/soporte');

  // Solo SUPER_ADMIN ve todo. El rol ADMIN existe apenas en el seed de desarrollo y el backend
  // no le da ninguna autoridad: mostrarle las areas lo mandaba a pantallas que responden 403.
  const isAdminOrSuper = user?.role === Role.SUPER_ADMIN;
  const canAdmin = isAdminOrSuper || hasBackofficePermission(user, 'ADMINISTRACION_CONTABLE');
  const canConfianza = isAdminOrSuper || hasBackofficePermission(user, 'MEDIACION_CONFIANZA');
  const canSoporte = isAdminOrSuper || hasBackofficePermission(user, 'SOPORTE');

  let sections = navSections;

  if (!canAdmin) {
    sections = sections.filter((s) => s.title !== 'Administración Contable');
  }
  if (!canConfianza) {
    sections = sections.filter((s) => s.title !== 'Gestión de Confianza');
  }

  if (isConfianza) {
    return sections.filter((s) => s.title === 'Gestión de Confianza');
  } else if (isAdmin) {
    return sections.filter((s) => s.title === 'Administración Contable');
  } else if (isSupport) {
    return sections.filter((s) => s.title === 'Soporte Técnico');
  } else {
    if (!isAdminOrSuper) {
      return sections.map((s) => {
        if (s.title === 'Backoffice') {
          return {
            ...s,
            items: s.items.filter((item) => {
              if (item.path === '/') return true;
              if (item.path.startsWith('/soporte')) return canSoporte;
              if (item.path.startsWith('/administracion')) return canAdmin;
              if (item.path.startsWith('/confianza')) return canConfianza;
              return false;
            }),
          };
        }
        return s;
      });
    }
    return sections.filter((s) => s.title !== 'Soporte Técnico');
  }
}

/** ¿El item corresponde a la ubicacion actual? (misma regla que el sidebar, mas alias). */
export function isNavItemActive(item: Pick<NavItem, 'path' | 'exact' | 'aliases'>, pathname: string, search = ''): boolean {
  const queryIdx = item.path.indexOf('?');
  const basePath = queryIdx >= 0 ? item.path.slice(0, queryIdx) : item.path;
  const searchQuery = queryIdx >= 0 ? '?' + item.path.slice(queryIdx + 1) : '';
  if (item.aliases?.includes(pathname)) return true;
  return item.exact
    ? pathname === basePath && (!searchQuery || search === searchQuery)
    : pathname.startsWith(basePath) && (!searchQuery || search === searchQuery);
}

/* ------------------------------------------------------------------ */
/* Navegacion movil: barra inferior (4 destinos) + hoja "Mas"           */
/* ------------------------------------------------------------------ */

export type MobileAreaKey = 'confianza' | 'administracion' | 'soporte';

export interface MobileNav {
  area: MobileAreaKey;
  areaTitle: string;
  areaIcon: string;
  /** Destinos de la barra inferior (maximo 4). */
  primary: NavItem[];
  /** Resto de secciones del area, listadas en la hoja "Mas". */
  more: NavItem[];
}

const AREA_SECTION_TITLE: Record<MobileAreaKey, string> = {
  confianza: 'Gestión de Confianza',
  administracion: 'Administración Contable',
  soporte: 'Soporte Técnico',
};

const AREA_TITLE: Record<MobileAreaKey, string> = {
  confianza: 'Confianza',
  administracion: 'Administración',
  soporte: 'Soporte',
};

const AREA_ICON: Record<MobileAreaKey, string> = {
  confianza: 'shield',
  administracion: 'wallet',
  soporte: 'message',
};

const MOBILE_PRIMARY: Record<MobileAreaKey, string[]> = {
  confianza: ['/confianza', '/confianza/validations', '/confianza/mediations', '/confianza/sellers'],
  administracion: ['/administracion/resumen', '/administracion/pedidos', '/administracion/liquidaciones', '/administracion/gastos'],
  soporte: ['/soporte', '/soporte/tickets', '/soporte/qa-reports', '/soporte/carga-inventario'],
};

/** Rutas que existen pero no figuran en el sidebar; en movil se alcanzan desde "Mas". */
const MOBILE_EXTRA: Record<MobileAreaKey, NavItem[]> = {
  confianza: [
    { path: '/confianza/alertas', label: 'Alertas', badge: 0, icon: 'alert' },
    { path: '/confianza/bitacora', label: 'Bitácora', badge: 0, icon: 'audit' },
  ],
  administracion: [],
  soporte: [],
};

export function getAreaFromPath(pathname: string): MobileAreaKey | null {
  if (pathname.startsWith('/confianza')) return 'confianza';
  if (pathname.startsWith('/administracion') || pathname === '/retiros') return 'administracion';
  if (pathname.startsWith('/soporte')) return 'soporte';
  return null;
}

export function getMobileNav(user: UserSummaryResponse | null, pathname: string): MobileNav | null {
  const area = getAreaFromPath(pathname);
  if (!area) return null;

  if (area === 'soporte' && isSupportQaOnly(user)) {
    return {
      area,
      areaTitle: 'Soporte QA',
      areaIcon: 'alert',
      primary: [{ path: '/soporte', label: 'Bugs', badge: 0, icon: 'alert', exact: true }],
      more: [],
    };
  }

  const section = navSections.find((s) => s.title === AREA_SECTION_TITLE[area]);
  const items = (section?.items ?? []).map((item) => (
    item.path === '/administracion/resumen' ? { ...item, aliases: ['/administracion'] } : item
  ));
  const primaryPaths = MOBILE_PRIMARY[area];
  const primary = primaryPaths
    .map((path) => items.find((item) => item.path === path))
    .filter((item): item is NavItem => Boolean(item));
  const more: NavItem[] = [
    ...items.filter((item) => !primaryPaths.includes(item.path)),
    ...MOBILE_EXTRA[area],
  ];
  if (area === 'administracion' && user?.role === Role.SUPER_ADMIN) {
    more.push({ path: '/retiros', label: 'Retiros de socios', badge: 0, icon: 'bank', exact: true });
  }

  return { area, areaTitle: AREA_TITLE[area], areaIcon: AREA_ICON[area], primary, more };
}
