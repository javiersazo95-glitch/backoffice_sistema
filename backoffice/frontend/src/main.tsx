import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from '@/context/AuthContext';
import Toast, { showToast } from '@/components/layout/Toast';
import { estadoHttpDe } from '@/api/client';
import MobileTableLabeler from '@/components/mobile/MobileTableLabeler';
import App from '@/App';
import '@/styles/styles.css';
import '@/styles/mobile.css';

/**
 * Un fallo de carga se anuncia una vez, aunque fallen varias consultas a la vez (al abrir una
 * pantalla suelen ir tres o cuatro juntas). El 401 no se avisa aqui: lo cierra el interceptor.
 */
let ultimoAvisoDeCarga = { texto: '', en: 0 };
function avisarFalloDeCarga(error: unknown) {
  const status = estadoHttpDe(error);
  if (status === 401) return;
  const texto = status === 403
    ? 'No tienes permiso para ver parte de esta pantalla.'
    : status
      ? `Error ${status} al cargar datos del servidor.`
      : 'No se pudo conectar con el servidor.';
  const ahora = Date.now();
  if (ultimoAvisoDeCarga.texto === texto && ahora - ultimoAvisoDeCarga.en < 4000) return;
  ultimoAvisoDeCarga = { texto, en: ahora };
  showToast(texto);
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: avisarFalloDeCarga }),
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30000,
    },
  },
});

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={googleClientId}>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <App />
            <Toast />
            <MobileTableLabeler />
          </AuthProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  </React.StrictMode>,
);
