import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

export default function Settings() {
  return (
    <div className="stack">
      <h2>Configuración</h2>
      <Categories />
    </div>
  );
}

function Categories() {
  const [categories, setCategories] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setCategories(await api('/categories'));
  }, []);

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [load]);

  async function run(action) {
    setError('');
    try {
      await action();
      await load();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }

  async function create(e) {
    e.preventDefault();
    const ok = await run(() => api('/categories', { method: 'POST', body: JSON.stringify({ name: newName }) }));
    if (ok) setNewName('');
  }

  async function rename(e) {
    e.preventDefault();
    const ok = await run(() => api(`/categories/${editing}`, { method: 'PATCH', body: JSON.stringify({ name: editName }) }));
    if (ok) setEditing(null);
  }

  function remove(c) {
    if (!confirm(`¿Eliminar la categoría ${c.name} para siempre?`)) return;
    run(() => api(`/categories/${c.id}`, { method: 'DELETE' }));
  }

  return (
    <section className="card">
      <h3>Categorías</h3>
      <p className="muted small">Solo se puede eliminar una categoría que ningún mes use.</p>
      {error && <p className="error">{error}</p>}
      {!categories ? (
        <p className="muted">Cargando…</p>
      ) : (
        <ul className="cat-list">
          {categories.map((c) => (
            <li key={c.id} className="cat-item">
              {editing === c.id ? (
                <form className="cat-edit" onSubmit={rename}>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus required />
                  <div className="cat-actions">
                    <button type="submit">Guardar</button>
                    <button type="button" className="secondary" onClick={() => setEditing(null)}>Cancelar</button>
                  </div>
                </form>
              ) : (
                <>
                  <span className="cat-name">{c.name}</span>
                  <div className="cat-actions">
                    <button
                      className="link"
                      onClick={() => {
                        setEditing(c.id);
                        setEditName(c.name);
                      }}
                    >
                      Editar
                    </button>
                    <button className="link danger" onClick={() => remove(c)}>Eliminar</button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <form className="add-category" onSubmit={create}>
        <input placeholder="Nueva categoría" value={newName} onChange={(e) => setNewName(e.target.value)} required />
        <button type="submit">Crear</button>
      </form>
    </section>
  );
}
