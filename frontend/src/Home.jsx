export default function Home({ onLogout }) {
  return (
    <div className="layout">
      <header className="topbar">
        <span className="brand">Loft Finanzas</span>
        <button className="link" onClick={onLogout}>Salir</button>
      </header>
      <main className="content">
        <h2>Inicio</h2>
        <p className="muted">Todo listo. Aquí irá el contenido de la app.</p>
      </main>
    </div>
  );
}
