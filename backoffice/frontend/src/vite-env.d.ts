/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  /** URL del Mantenedor común; vacía o ausente → https://mantenedor.repuestop.cl */
  readonly VITE_MANTENEDOR_URL?: string;
  /** URL del panel del vendedor para el acceso asistido (ej. http://localhost:5173 en local). */
  readonly VITE_PANEL_URL?: string;
}

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.css' {
  const content: string;
  export default content;
}
