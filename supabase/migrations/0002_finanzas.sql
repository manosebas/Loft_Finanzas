-- Finanzas del hogar: sueldos y gastos fijos por mes.
-- Ejecutar en Supabase > SQL Editor.

create table public.people (
  id smallint primary key,
  name text not null
);

insert into public.people (id, name) values (1, 'Manolo'), (2, 'Marti');

create table public.categories (
  id bigint generated always as identity primary key,
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.months (
  id bigint generated always as identity primary key,
  year int not null,
  month int not null check (month between 1 and 12),
  -- Lo que se confirmó que sobró en la cuenta y pasó a ahorro. Null = mes sin cerrar.
  saved_amount numeric(12, 2),
  saved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (year, month)
);

create table public.incomes (
  month_id bigint not null references public.months (id) on delete cascade,
  person_id smallint not null references public.people (id),
  amount numeric(12, 2) not null default 0,
  primary key (month_id, person_id)
);

-- Presupuesto (proyección) de cada gasto fijo en el mes.
create table public.budget_items (
  month_id bigint not null references public.months (id) on delete cascade,
  category_id bigint not null references public.categories (id),
  amount numeric(12, 2) not null,
  primary key (month_id, category_id)
);

-- Pagos reales hechos desde la cuenta común.
create table public.payments (
  id bigint generated always as identity primary key,
  month_id bigint not null references public.months (id) on delete cascade,
  category_id bigint not null references public.categories (id),
  amount numeric(12, 2) not null,
  note text,
  created_at timestamptz not null default now()
);

create index payments_month_idx on public.payments (month_id);

alter table public.people enable row level security;
alter table public.categories enable row level security;
alter table public.months enable row level security;
alter table public.incomes enable row level security;
alter table public.budget_items enable row level security;
alter table public.payments enable row level security;
