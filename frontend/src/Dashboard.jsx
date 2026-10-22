import { useEffect, useState } from 'react';
import { api } from './api.js';
import { currentYearMonth, money, monthLabel, pct, shortMonth } from './format.js';

export default function Dashboard({ onOpenMonth }) {
  const [data, setData] = useState(null);
  const [detail, setDetail] = useState(null);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [dash, cats] = await Promise.all([api('/dashboard'), api('/categories')]);
        setData(dash);
        setCategories(cats);
        const now = currentYearMonth();
        const current =
          dash.months.find((m) => m.year === now.year && m.month === now.month) ?? dash.months.at(-1);
        if (current) setDetail(await api(`/months/${current.year}/${current.month}`));
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Cargando…</p>;
  if (!data.months.length) {
    return (
      <div className="card">
        <h2>Sin datos todavía</h2>
        <p className="muted">Crea el primer mes para empezar.</p>
        <button onClick={() => onOpenMonth(currentYearMonth())}>Ir al mes actual</button>
      </div>
    );
  }

  const catName = (id) => categories.find((c) => c.id === id)?.name ?? '—';
  const pending = detail
    ? detail.budget
        .map((b) => {
          const paid = detail.payments.filter((p) => p.category_id === b.category_id).reduce((s, p) => s + p.amount, 0);
          return { ...b, paid };
        })
        .filter((b) => b.paid === 0)
        .sort((a, b) => b.amount - a.amount)
    : [];
  const maxFund = Math.max(...data.months.map((m) => Math.max(m.fund, m.paid)));
  const closed = data.months.filter((m) => m.saved_amount !== null);

  return (
    <div className="stack">
      {detail && (
        <section className="stack">
          <div className="section-head">
            <h2>{monthLabel(detail)}</h2>
            <button className="link" onClick={() => onOpenMonth(detail)}>Ver mes →</button>
          </div>

          <div className="tiles">
            <Tile label="Fondo del mes" value={money(detail.fund)} />
            <Tile label="Pagado" value={money(detail.paid)} hint={detail.fund ? pct(detail.paid / detail.fund) : null} />
            <Tile
              label={detail.saved_amount === null ? 'Debería quedar' : 'Pasó a ahorro'}
              value={money(detail.saved_amount ?? detail.expected_left)}
              tone={(detail.saved_amount ?? detail.expected_left) < 0 ? 'bad' : null}
            />
            <Tile label="Ahorro acumulado" value={money(data.total_saved)} hint={`${closed.length} meses cerrados`} />
          </div>

          <div className="card">
            <h3>Aporte de cada uno</h3>
            <ul className="rows">
              {detail.people.map((p) => (
                <li key={p.person_id} className="row">
                  <span>
                    {p.name} <span className="muted">· {pct(p.share)}</span>
                  </span>
                  <strong>{money(p.contribution)}</strong>
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h3>Falta pagar</h3>
            {pending.length ? (
              <ul className="rows">
                {pending.map((b) => (
                  <li key={b.category_id} className="row">
                    <span>{catName(b.category_id)}</span>
                    <span>{money(b.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Todo pagado este mes.</p>
            )}
          </div>
        </section>
      )}

      <section className="card">
        <h3>Gastado vs. fondo por mes</h3>
        <div className="legend">
          <span><i className="swatch paid" /> Pagado</span>
          <span><i className="swatch fund" /> Fondo</span>
        </div>
        <ul className="bars">
          {data.months.map((m) => (
            <li key={m.id}>
              <button
                className="bar-row"
                onClick={() => onOpenMonth(m)}
                title={`${monthLabel(m)}: pagado ${money(m.paid)} de ${money(m.fund)}`}
              >
                <span className="bar-label">{shortMonth(m)}</span>
                <span className="bar-track" style={{ width: `${(m.fund / maxFund) * 100}%` }}>
                  <span
                    className={m.paid > m.fund ? 'bar-fill over' : 'bar-fill'}
                    style={{ width: `${Math.min(m.paid / (m.fund || 1), 1) * 100}%` }}
                  />
                </span>
                <span className="bar-value">{money(m.paid)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h3>Ahorro por mes</h3>
        <ul className="rows">
          {data.months.map((m) => (
            <li key={m.id} className="row">
              <span>{monthLabel(m)}</span>
              {m.saved_amount === null ? (
                <span className="muted">Sin confirmar · quedaría {money(m.expected_left)}</span>
              ) : (
                <strong>{money(m.saved_amount)}</strong>
              )}
            </li>
          ))}
          <li className="row total">
            <span>Total ahorrado</span>
            <strong>{money(data.total_saved)}</strong>
          </li>
        </ul>
      </section>
    </div>
  );
}

function Tile({ label, value, hint, tone }) {
  return (
    <div className="tile">
      <span className="tile-label">{label}</span>
      <span className={tone === 'bad' ? 'tile-value bad' : 'tile-value'}>{value}</span>
      {hint && <span className="tile-hint">{hint}</span>}
    </div>
  );
}
