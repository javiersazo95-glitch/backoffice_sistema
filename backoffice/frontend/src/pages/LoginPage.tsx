import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/', { replace: true });
    } catch {
      setError('Credenciales inválidas. Intente nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc' }}>
      <div className="panel" style={{ width: 'min(420px, 90vw)', padding: 0 }}>
        <div className="panel-header">
          <h2>RepuesTop</h2>
          <span className="panel-hint">Backoffice</span>
        </div>
        <form className="panel-body" onSubmit={handleSubmit}>
          {error && (
            <div className="notice" style={{ marginBottom: 12 }}>
              <p>{error}</p>
            </div>
          )}
          <div style={{ display: 'grid', gap: 12 }}>
            <input
              type="email"
              className="input"
              placeholder="Correo"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="email"
            />
            <input
              type="password"
              className="input"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button
              type="submit"
              className="primary-button"
              disabled={loading}
              style={{ width: '100%' }}
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
