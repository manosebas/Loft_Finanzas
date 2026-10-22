import { Router } from 'express';
import { supabase } from './supabase.js';

export const financeRouter = Router();

financeRouter.use((req, res, next) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase no configurado' });
  next();
});

const round = (n) => Math.round(n * 100) / 100;

function parseAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? round(n) : null;
}

async function q(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

// Arma el resumen de cada mes: ingresos, % por persona, fondo, pagado y sobrante esperado.
function summarize(months, people, incomes, budget, payments) {
  return months.map((m) => {
    const inc = people.map((p) => ({
      person_id: p.id,
      name: p.name,
      amount: Number(incomes.find((i) => i.month_id === m.id && i.person_id === p.id)?.amount ?? 0),
    }));
    const totalIncome = inc.reduce((s, i) => s + i.amount, 0);
    const fund = round(budget.filter((b) => b.month_id === m.id).reduce((s, b) => s + Number(b.amount), 0));
    const paid = round(payments.filter((p) => p.month_id === m.id).reduce((s, p) => s + Number(p.amount), 0));
    return {
      id: m.id,
      year: m.year,
      month: m.month,
      fund,
      paid,
      expected_left: round(fund - paid),
      saved_amount: m.saved_amount === null ? null : Number(m.saved_amount),
      saved_at: m.saved_at,
      people: inc.map((i) => {
        const share = totalIncome ? i.amount / totalIncome : 0;
        return { ...i, share, contribution: round(fund * share) };
      }),
    };
  });
}

async function loadAll(filter) {
  let monthsQuery = supabase.from('months').select('*').order('year').order('month');
  if (filter) monthsQuery = monthsQuery.eq('year', filter.year).eq('month', filter.month);
  const months = await q(monthsQuery);
  const ids = months.map((m) => m.id);
  if (!ids.length) return { months: [], people: await q(supabase.from('people').select('*').order('id')) };
  const [people, incomes, budget, payments] = await Promise.all([
    q(supabase.from('people').select('*').order('id')),
    q(supabase.from('incomes').select('*').in('month_id', ids)),
    q(supabase.from('budget_items').select('*').in('month_id', ids)),
    q(supabase.from('payments').select('*').in('month_id', ids).order('created_at')),
  ]);
  return { months, people, incomes, budget, payments };
}

financeRouter.get('/dashboard', async (req, res) => {
  const { months, people, incomes, budget, payments } = await loadAll();
  const summaries = months.length ? summarize(months, people, incomes, budget, payments) : [];
  const totalSaved = round(summaries.reduce((s, m) => s + (m.saved_amount ?? 0), 0));
  res.json({ months: summaries, total_saved: totalSaved });
});

financeRouter.get('/categories', async (req, res) => {
  res.json(await q(supabase.from('categories').select('*').order('sort_order').order('name')));
});

financeRouter.post('/categories', async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  const existing = await q(supabase.from('categories').select('sort_order').order('sort_order', { ascending: false }).limit(1));
  const sort = (existing[0]?.sort_order ?? 0) + 1;
  const { data, error } = await supabase.from('categories').insert({ name, sort_order: sort }).select().single();
  if (error?.code === '23505') return res.status(409).json({ error: 'Esa categoría ya existe' });
  if (error) throw error;
  res.status(201).json(data);
});

financeRouter.patch('/categories/:id', async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) return res.status(400).json({ error: 'Nombre requerido' });
  const { error } = await supabase.from('categories').update({ name }).eq('id', Number(req.params.id));
  if (error?.code === '23505') return res.status(409).json({ error: 'Esa categoría ya existe' });
  if (error) throw error;
  res.json({ ok: true });
});

// Solo se puede borrar si ningún mes la usa (ni en presupuesto ni en pagos).
financeRouter.delete('/categories/:id', async (req, res) => {
  const id = Number(req.params.id);
  const [budgetUses, paymentUses] = await Promise.all([
    q(supabase.from('budget_items').select('month_id').eq('category_id', id).limit(1)),
    q(supabase.from('payments').select('id').eq('category_id', id).limit(1)),
  ]);
  if (budgetUses.length || paymentUses.length) {
    return res.status(409).json({ error: 'La categoría se usa en algún mes. Quítala de esos meses primero.' });
  }
  await q(supabase.from('categories').delete().eq('id', id));
  res.json({ ok: true });
});

financeRouter.get('/months/:year/:month', async (req, res) => {
  const year = Number(req.params.year);
  const month = Number(req.params.month);
  const { months, people, incomes, budget, payments } = await loadAll({ year, month });
  if (!months.length) return res.status(404).json({ error: 'Mes no creado' });
  const [summary] = summarize(months, people, incomes, budget, payments);
  res.json({
    ...summary,
    budget: budget.map((b) => ({ category_id: b.category_id, amount: Number(b.amount) })),
    payments: payments.map((p) => ({ ...p, amount: Number(p.amount) })),
  });
});

// Crea el mes copiando sueldos y presupuesto del último mes anterior.
financeRouter.post('/months', async (req, res) => {
  const year = Number(req.body?.year);
  const month = Number(req.body?.month);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: 'Mes inválido' });
  }
  const { data: created, error } = await supabase.from('months').insert({ year, month }).select().single();
  if (error?.code === '23505') return res.status(409).json({ error: 'El mes ya existe' });
  if (error) throw error;

  const [prev] = await q(
    supabase
      .from('months')
      .select('id')
      .or(`year.lt.${year},and(year.eq.${year},month.lt.${month})`)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(1)
  );
  if (prev) {
    const [prevIncomes, prevBudget] = await Promise.all([
      q(supabase.from('incomes').select('person_id, amount').eq('month_id', prev.id)),
      q(supabase.from('budget_items').select('category_id, amount').eq('month_id', prev.id)),
    ]);
    if (prevIncomes.length) {
      await q(supabase.from('incomes').insert(prevIncomes.map((i) => ({ ...i, month_id: created.id }))));
    }
    if (prevBudget.length) {
      await q(supabase.from('budget_items').insert(prevBudget.map((b) => ({ ...b, month_id: created.id }))));
    }
  }
  res.status(201).json(created);
});

financeRouter.put('/months/:id/incomes/:personId', async (req, res) => {
  const amount = parseAmount(req.body?.amount);
  if (amount === null) return res.status(400).json({ error: 'Monto inválido' });
  await q(
    supabase
      .from('incomes')
      .upsert({ month_id: Number(req.params.id), person_id: Number(req.params.personId), amount })
  );
  res.json({ ok: true });
});

// Presupuesto de una categoría en el mes. Monto 0 la quita del mes.
financeRouter.put('/months/:id/budget/:categoryId', async (req, res) => {
  const amount = parseAmount(req.body?.amount);
  if (amount === null) return res.status(400).json({ error: 'Monto inválido' });
  const key = { month_id: Number(req.params.id), category_id: Number(req.params.categoryId) };
  if (amount === 0) {
    await q(supabase.from('budget_items').delete().match(key));
  } else {
    await q(supabase.from('budget_items').upsert({ ...key, amount }));
  }
  res.json({ ok: true });
});

// Quita la categoría del mes. Si tiene pagos registrados hay que borrarlos antes.
financeRouter.delete('/months/:id/categories/:categoryId', async (req, res) => {
  const key = { month_id: Number(req.params.id), category_id: Number(req.params.categoryId) };
  const payments = await q(supabase.from('payments').select('id').match(key).limit(1));
  if (payments.length) return res.status(409).json({ error: 'Este gasto tiene pagos en el mes. Bórralos primero.' });
  await q(supabase.from('budget_items').delete().match(key));
  res.json({ ok: true });
});

financeRouter.post('/months/:id/payments', async (req, res) => {
  const amount = parseAmount(req.body?.amount);
  const categoryId = Number(req.body?.category_id);
  if (!amount || !categoryId) return res.status(400).json({ error: 'Monto y categoría requeridos' });
  const note = String(req.body?.note ?? '').trim() || null;
  const data = await q(
    supabase
      .from('payments')
      .insert({ month_id: Number(req.params.id), category_id: categoryId, amount, note })
      .select()
      .single()
  );
  res.status(201).json(data);
});

financeRouter.delete('/payments/:id', async (req, res) => {
  await q(supabase.from('payments').delete().eq('id', Number(req.params.id)));
  res.json({ ok: true });
});

// Confirma lo que realmente sobró y lo pasa a ahorro. amount null reabre el mes.
financeRouter.put('/months/:id/saved', async (req, res) => {
  const raw = req.body?.amount;
  const amount = raw === null ? null : parseAmount(raw);
  if (raw !== null && amount === null) return res.status(400).json({ error: 'Monto inválido' });
  await q(
    supabase
      .from('months')
      .update({ saved_amount: amount, saved_at: amount === null ? null : new Date().toISOString() })
      .eq('id', Number(req.params.id))
  );
  res.json({ ok: true });
});
