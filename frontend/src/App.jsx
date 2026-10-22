import { useEffect, useState } from 'react';
import { api } from './api.js';
import Login from './Login.jsx';
import Home from './Home.jsx';

export default function App() {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    api('/auth/me')
      .then((data) => setStatus(data.authenticated ? 'in' : 'out'))
      .catch(() => setStatus('out'));
  }, []);

  async function logout() {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setStatus('out');
  }

  if (status === 'loading') return <div className="center muted">Cargando…</div>;
  if (status === 'out') return <Login onSuccess={() => setStatus('in')} />;
  return <Home onLogout={logout} />;
}
