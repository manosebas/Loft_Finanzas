import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { money, monthLabel, parseMoney, pct, shiftMonth } from './format.js';

export default function Month({ selected, onChange }) {
  const [data, setData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [cats, month] = await Promise.all([
        api('/categories'),
        api(`/months/${selected.year}/${selected.month}`).catch((err) => {
          if (err.status === 404) return null;
          throw err;
        }),
      ]);
      setCategories(cats);
      setData(month);
      setMissing(!month);
    } catch (err) {
      setError(err.message);
    }
  }, [selected.year, selected.month]);

  useEffect(() => {
    setData(null);
    setMissing(false);
    load();
  }, [load]);

  async function run(action) {
    setError('');
    try {
      await action();
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createMonth() {
    await run(() => api('/months', { method: 'POST', body: JSON.stringify(selected) }));
  }

  return (
    <div className="stack">
      <div className="month-nav">
        <button className="secondary" onClick={() => onChange(shiftMonth(selected, -1))} aria-label="Mes anterior">←</button>
        <h2>{monthLabel(selected)}</h2>
        <button className="secondary" onClick={() => onChange(shiftMonth(selected, 1))} aria-label="Mes siguiente">→</button>
      </div>

      {error && <p className="error">{error}</p>}

      {missing && (
        <div className="card">
          <p className="muted">Este mes no está creado. Se copian los sueldos y el presupuesto del mes anterior.</p>
          <button onClick={createMonth}>Crear {monthLabel(selected)}</button>
        </div>
      )}

      {!data && !missing && !error && <p className="muted">Cargando…</p>}

      {data && (
        <>
          <Incomes data={data} run={run} />
          <Expenses data={data} categories={categories} run={run} />
          <Close data={data} run={run} />
        </>
      )}
    </div>
  );
}

function MoneyInput({ value, onSave, ...props }) {
  const [text, setText] = useState(value ? String(value) : '');
  useEffect(() => setText(value ? String(value) : ''), [value]);

  function commit() {
    const n = parseMoney(text || '0');
    if (n === null) return setText(value ? String(value) : '');
    if (n !== value) onSave(n);
  }

  return (
    <input
      inputMode="decimal"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      {...props}
    />
  );
}

function Incomes({ data, run }) {
  const total = data.people.reduce((s, p) => s + p.amount, 0);
  return (
    <section className="card">
      <h3>Sueldos</h3>
      <div className="income-grid">
        {data.people.map((p) => (
          <label key={p.person_id} className="field">
            <span>{p.name}</span>
            <MoneyInput
              value={p.amount}
              placeholder="0"
              onSave={(amount) =>
                run(() => api(`/months/${data.id}/incomes/${p.person_id}`, { method: 'PUT', body: JSON.stringify({ amount }) }))
              }
            />
          </label>
        ))}
      </div>
      <ul className="rows">
        <li className="row">
          <span>Total</span>
          <span>{money(total)}</span>
        </li>
        {data.people.map((p) => (
          <li key={p.person_id} className="row">
            <span>
              {p.name} aporta <span className="muted">({pct(p.share)})</span>
            </span>
            <strong>{money(p.contribution)}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Expenses({ data, categories, run }) {
  const [open, setOpen] = useState(null);
  const [adding, setAdding] = useState('');
  const [newName, setNewName] = useState('');
  const [newBudget, setNewBudget] = useState('');

  const inMonth = new Set([...data.budget.map((b) => b.category_id), ...data.payments.map((p) => p.category_id)]);
  const rows = categories
    .filter((c) => inMonth.has(c.id))
    .map((c) => {
      const budget = data.budget.find((b) => b.category_id === c.id)?.amount ?? 0;
      const payments = data.payments.filter((p) => p.category_id === c.id);
      const paid = Math.round(payments.reduce((s, p) => s + p.amount, 0) * 100) / 100;
      return { ...c, budget, payments, paid };
    });
  const available = categories.filter((c) => !inMonth.has(c.id));

  async function addCategory(e) {
    e.preventDefault();
    const amount = parseMoney(newBudget);
    if (!amount) return;
    await run(async () => {
      let categoryId = Number(adding);
      if (adding === 'new') {
        const created = await api('/categories', { method: 'POST', body: JSON.stringify({ name: newName }) });
        categoryId = created.id;
      }
      await api(`/months/${data.id}/budget/${categoryId}`, { method: 'PUT', body: JSON.stringify({ amount }) });
      setOpen(categoryId);
    });
    setAdding('');
    setNewName('');
    setNewBudget('');
  }

  return (
    <section className="card">
      <div className="section-head">
        <h3>Gastos fijos</h3>
        <span className="muted small">
          {money(data.paid)} de {money(data.fund)}
        </span>
      </div>

      <ul className="expenses">
        {rows.map((r) => (
          <li key={r.id} className="expense">
            <button className="expense-head" onClick={() => setOpen(open === r.id ? null : r.id)}>
              <span className="expense-name">{r.name}</span>
              <span className={r.paid > r.budget ? 'expense-amount over' : 'expense-amount'}>
                {money(r.paid)} <span className="muted">/ {money(r.budget)}</span>
              </span>
              <span className="meter">
                <span
                  className={r.paid > r.budget ? 'meter-fill over' : 'meter-fill'}
                  style={{ width: `${Math.min(r.paid / (r.budget || 1), 1) * 100}%` }}
                />
              </span>
            </button>
            {open === r.id && <ExpenseDetail row={r} monthId={data.id} run={run} />}
          </li>
        ))}
      </ul>

      <form className="add-category" onSubmit={addCategory}>
        <select value={adding} onChange={(e) => setAdding(e.target.value)}>
          <option value="">Agregar gasto al mes…</option>
          {available.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
          <option value="new">+ Nueva categoría</option>
        </select>
        {adding === 'new' && (
          <input placeholder="Nombre" value={newName} onChange={(e) => setNewName(e.target.value)} required />
        )}
        {adding && (
          <>
            <input
              inputMode="decimal"
              placeholder="Presupuesto"
              value={newBudget}
              onChange={(e) => setNewBudget(e.target.value)}
              required
            />
            <button type="submit">Agregar</button>
          </>
        )}
      </form>
    </section>
  );
}

function ExpenseDetail({ row, monthId, run }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  async function addPayment(e) {
    e.preventDefault();
    const n = parseMoney(amount);
    if (!n) return;
    await run(() =>
      api(`/months/${monthId}/payments`, { method: 'POST', body: JSON.stringify({ category_id: row.id, amount: n, note }) })
    );
    setAmount('');
    setNote('');
  }

  return (
    <div className="expense-detail">
      <label className="field inline">
        <span>Presupuesto</span>
        <MoneyInput
          value={row.budget}
          onSave={(n) => run(() => api(`/months/${monthId}/budget/${row.id}`, { method: 'PUT', body: JSON.stringify({ amount: n }) }))}
        />
      </label>

      {row.payments.length > 0 && (
        <ul className="rows">
          {row.payments.map((p) => (
            <li key={p.id} className="row">
              <span>
                {money(p.amount)} {p.note && <span className="muted">· {p.note}</span>}
              </span>
              <button
                className="link danger"
                onClick={() => confirm(`¿Borrar pago de ${money(p.amount)}?`) && run(() => api(`/payments/${p.id}`, { method: 'DELETE' }))}
              >
                Borrar
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="pay-form" onSubmit={addPayment}>
        <input inputMode="decimal" placeholder="Monto pagado" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        <input placeholder="Nota (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button type="submit">Registrar pago</button>
      </form>

      <div className="remove-row">
        {row.payments.length ? (
          <span className="muted small">Para quitar este gasto del mes, borra primero sus pagos.</span>
        ) : (
          <button
            className="link danger"
            onClick={() =>
              confirm(`¿Quitar ${row.name} de este mes?`) &&
              run(() => api(`/months/${monthId}/categories/${row.id}`, { method: 'DELETE' }))
            }
          >
            Quitar del mes
          </button>
        )}
      </div>
    </div>
  );
}

function Close({ data, run }) {
  const [text, setText] = useState(String(data.expected_left));
  useEffect(() => setText(String(data.expected_left)), [data.expected_left]);
  const save = (amount) => run(() => api(`/months/${data.id}/saved`, { method: 'PUT', body: JSON.stringify({ amount }) }));

  if (data.saved_amount !== null) {
    return (
      <section className="card">
        <h3>Cierre del mes</h3>
        <ul className="rows">
          <li className="row">
            <span>Debería haber quedado</span>
            <span>{money(data.expected_left)}</span>
          </li>
          <li className="row total">
            <span>Pasó a ahorro</span>
            <strong>{money(data.saved_amount)}</strong>
          </li>
        </ul>
        <button className="secondary" onClick={() => save(null)}>Reabrir mes</button>
      </section>
    );
  }

  return (
    <section className="card">
      <h3>Cierre del mes</h3>
      <ul className="rows">
        <li className="row">
          <span>Debería quedar en la cuenta</span>
          <strong className={data.expected_left < 0 ? 'bad' : ''}>{money(data.expected_left)}</strong>
        </li>
      </ul>
      <form
        className="pay-form"
        onSubmit={(e) => {
          e.preventDefault();
          const n = parseMoney(text);
          if (n !== null) save(n);
        }}
      >
        <label className="field">
          <span>Lo que realmente sobró</span>
          <input inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} required />
        </label>
        <button type="submit">Confirmar y mover a ahorro</button>
      </form>
    </section>
  );
}
