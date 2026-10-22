import { useState } from 'react';
import { api } from './api.js';

export default function Login({ onSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api('/auth/login', { method: 'POST', body: JSON.stringify({ password }) });
      onSuccess();
    } catch (err) {
      setError(err.message);
      setPassword('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="center">
      <form className="card login" onSubmit={handleSubmit}>
        <h1>Loft Finanzas</h1>
        <p className="muted">Ingresa la contraseña para continuar</p>
        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={loading || !password}>
          {loading ? 'Verificando…' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
