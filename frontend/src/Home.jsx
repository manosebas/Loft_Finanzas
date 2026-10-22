import { useState } from 'react';
import Dashboard from './Dashboard.jsx';
import Month from './Month.jsx';
import { currentYearMonth } from './format.js';

export default function Home({ onLogout }) {
  const [view, setView] = useState('dashboard');
  const [selected, setSelected] = useState(currentYearMonth);

  function openMonth(ym) {
    setSelected(ym);
    setView('month');
  }

  return (
    <div className="layout">
      <header className="topbar">
        <span className="brand">Loft Finanzas</span>
        <nav className="tabs">
          <button className={view === 'dashboard' ? 'tab active' : 'tab'} onClick={() => setView('dashboard')}>
            Resumen
          </button>
          <button className={view === 'month' ? 'tab active' : 'tab'} onClick={() => setView('month')}>
            Mes
          </button>
        </nav>
        <button className="link" onClick={onLogout}>Salir</button>
      </header>
      <main className="content">
        {view === 'dashboard' ? (
          <Dashboard onOpenMonth={openMonth} />
        ) : (
          <Month selected={selected} onChange={setSelected} />
        )}
      </main>
    </div>
  );
}
