-- Cemetery records: cemeteries, sections, plots, rights of burial, the burial
-- register, bookings from funeral directors, disinterments, memorial permits,
-- grounds work, and money owed. Runs on Postgres and PGlite.

create function touch_updated() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create table settings (
  key text primary key,
  value text not null,
  note text not null
);
insert into settings (key, value, note) values
  ('right_lapse_years', '60', 'Years without a burial after which an exclusive right of burial lapses (Burial and Cremation Act 1964, s 10(4)).'),
  ('right_lapse_notice_days', '365', 'Days before a right lapses that it is flagged, so the holder can be written to first.'),
  ('paperwork_hours', '24', 'Hours before a burial by which the funeral director''s burial paperwork must be on file. A house standard.'),
  ('memorial_permit_days', '10', 'Working target in days to decide a memorial permit application. A house standard.'),
  ('make_safe_days', '7', 'Days an unsafe memorial may stay unsafe before it is flagged (duty to keep the grounds safe, HSWA 2015 s 37; the target is yours).'),
  ('grounds_days', '14', 'Days a grounds job (sunken grave, drainage, tree) may stay open before it is flagged. A house standard.'),
  ('invoice_due_days', '20', 'Days after a charge is raised that it falls due.'),
  ('currency', 'NZD', 'Currency for fees and payments.');

create table cemeteries (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  code text not null unique,
  address text,
  closed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sections (
  id uuid primary key default gen_random_uuid(),
  cemetery_id uuid not null references cemeteries(id),
  name text not null,
  kind text not null check (kind in ('lawn', 'monumental', 'ashes', 'natural', 'children', 'services', 'denominational')),
  right_fee_cents bigint not null default 0 check (right_fee_cents >= 0),
  interment_fee_cents bigint not null default 0 check (interment_fee_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cemetery_id, name)
);

create table plots (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references sections(id),
  row_label text not null default '',
  number text not null,
  plot_type text not null check (plot_type in ('burial', 'ashes')),
  capacity int not null default 1 check (capacity between 1 and 12),
  unusable_reason text,
  notes text,
  source_ref text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (section_id, row_label, number)
);

create table holders (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  email text,
  phone text,
  address text,
  source_ref text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table funeral_directors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The exclusive right of burial (s 10): sold in perpetuity or for a term.
create table rights (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references plots(id),
  holder_id uuid not null references holders(id),
  certificate_no text unique,
  purchased_on date not null,
  term_years int check (term_years is null or term_years between 1 and 200),
  price_cents bigint not null default 0 check (price_cents >= 0),
  status text not null default 'active' check (status in ('active', 'transferred', 'surrendered', 'lapsed', 'expired')),
  ended_on date,
  end_note text,
  source_ref text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index one_active_right_per_plot on rights (plot_id) where status = 'active';

create table deceased (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  date_of_birth date,
  date_of_death date,
  age_years int check (age_years is null or age_years between 0 and 130),
  last_address text,
  occupation text,
  source_ref text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A booking becomes a register entry (s 50) when it is completed.
create table interments (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references plots(id),
  deceased_id uuid not null references deceased(id),
  funeral_director_id uuid references funeral_directors(id),
  kind text not null check (kind in ('burial', 'ashes')),
  scheduled_at timestamp not null,
  status text not null default 'booked' check (status in ('booked', 'completed', 'cancelled', 'removed')),
  holder_consent_on date,
  paperwork_on date,
  completed_on date,
  register_no int,
  cancel_reason text,
  source_ref text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Removal of a body needs the Minister's licence (s 51).
create table disinterments (
  id uuid primary key default gen_random_uuid(),
  interment_id uuid not null references interments(id),
  licence_ref text,
  done_on date not null,
  destination text,
  created_at timestamptz not null default now()
);

create table memorials (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references plots(id),
  applicant text not null,
  description text not null,
  applied_on date,
  decision text check (decision in ('approved', 'declined')),
  decided_on date,
  installed_on date,
  condition text not null default 'not inspected' check (condition in ('not inspected', 'safe', 'leaning', 'unsafe')),
  inspected_on date,
  made_safe_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table grounds_jobs (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references sections(id),
  plot_id uuid references plots(id),
  category text not null check (category in ('sunken grave', 'drainage', 'tree', 'mowing', 'path', 'fence', 'water', 'other')),
  summary text not null,
  reported_on date not null default current_date,
  resolved_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Money is owed by a funeral director (interment fees) or a holder (rights, memorial fees).
create table charges (
  id uuid primary key default gen_random_uuid(),
  funeral_director_id uuid references funeral_directors(id),
  holder_id uuid references holders(id),
  interment_id uuid references interments(id),
  right_id uuid references rights(id),
  description text not null,
  amount_cents bigint not null check (amount_cents <> 0),
  raised_on date not null default current_date,
  due_on date not null,
  created_at timestamptz not null default now(),
  check ((funeral_director_id is null) <> (holder_id is null))
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  funeral_director_id uuid references funeral_directors(id),
  holder_id uuid references holders(id),
  amount_cents bigint not null check (amount_cents > 0),
  received_on date not null default current_date,
  reference text,
  created_at timestamptz not null default now(),
  check ((funeral_director_id is null) <> (holder_id is null))
);

create table events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor text not null,
  action text not null,
  record_id uuid,
  before_record jsonb,
  after_record jsonb
);
create function events_locked() returns trigger language plpgsql as $$
begin raise exception 'The audit trail cannot be changed'; end $$;
create trigger events_no_update before update or delete on events for each row execute function events_locked();

create trigger t_cemeteries before update on cemeteries for each row execute function touch_updated();
create trigger t_sections before update on sections for each row execute function touch_updated();
create trigger t_plots before update on plots for each row execute function touch_updated();
create trigger t_holders before update on holders for each row execute function touch_updated();
create trigger t_directors before update on funeral_directors for each row execute function touch_updated();
create trigger t_rights before update on rights for each row execute function touch_updated();
create trigger t_deceased before update on deceased for each row execute function touch_updated();
create trigger t_interments before update on interments for each row execute function touch_updated();
create trigger t_memorials before update on memorials for each row execute function touch_updated();
create trigger t_grounds before update on grounds_jobs for each row execute function touch_updated();

create function setting_int(k text) returns int language sql stable as $$
  select value::int from settings where key = k
$$;

-- ------------------------------------------------------------------ views

-- Every plot with where it is, who holds it and what is in it.
create view plot_status as
select p.id as plot_id, c.id as cemetery_id, c.name as cemetery, s.id as section_id, s.name as section, s.kind as section_kind,
  p.row_label, p.number,
  c.code || ' ' || s.name || ' ' || case when p.row_label = '' then '' else p.row_label || '-' end || p.number as label,
  p.plot_type, p.capacity,
  (select count(*) from interments i where i.plot_id = p.id and i.status = 'completed')::int as used,
  (select count(*) from interments i where i.plot_id = p.id and i.status = 'booked')::int as booked,
  r.id as right_id, h.name as holder, r.purchased_on, r.term_years,
  (select max(i.completed_on) from interments i where i.plot_id = p.id and i.status = 'completed') as last_burial_on,
  p.unusable_reason,
  case
    when p.unusable_reason is not null then 'unusable'
    when (select count(*) from interments i where i.plot_id = p.id and i.status in ('completed', 'booked')) >= p.capacity then 'full'
    when exists (select 1 from interments i where i.plot_id = p.id and i.status in ('completed', 'booked')) then 'in use'
    when r.id is not null then 'reserved'
    else 'available'
  end as status
from plots p
join sections s on s.id = p.section_id
join cemeteries c on c.id = s.cemetery_id
left join rights r on r.plot_id = p.id and r.status = 'active'
left join holders h on h.id = r.holder_id;

-- When each active right lapses under s 10(4), or ends on its own term.
create view right_lapses as
select r.id as right_id, ps.label as plot, h.name as holder, r.certificate_no, r.purchased_on, ps.last_burial_on,
  (greatest(r.purchased_on, coalesce(ps.last_burial_on, r.purchased_on)) + make_interval(years => setting_int('right_lapse_years')))::date as lapses_on,
  case when r.term_years is null then null else (r.purchased_on + make_interval(years => r.term_years))::date end as term_ends_on,
  ps.capacity - ps.used - ps.booked as space_left
from rights r
join plot_status ps on ps.plot_id = r.plot_id
join holders h on h.id = r.holder_id
where r.status = 'active';

create view schedule as
select i.id as interment_id, i.scheduled_at, d.name as deceased, i.kind, ps.label as plot, coalesce(f.name, '') as funeral_director,
  i.paperwork_on, i.holder_consent_on, ps.holder
from interments i
join deceased d on d.id = i.deceased_id
join plot_status ps on ps.plot_id = i.plot_id
left join funeral_directors f on f.id = i.funeral_director_id
where i.status = 'booked';

-- The burial register (s 50): every completed interment, where it is, indexed by name.
create view register as
select i.register_no, ps.cemetery, ps.section, ps.row_label, ps.number, ps.label as plot, d.name as deceased, d.date_of_birth, d.date_of_death,
  d.age_years, d.last_address, i.kind, i.completed_on, i.status, d.id as deceased_id, i.id as interment_id
from interments i
join deceased d on d.id = i.deceased_id
join plot_status ps on ps.plot_id = i.plot_id
where i.status in ('completed', 'removed');

create view capacity as
select ps.cemetery, ps.section, ps.section_kind,
  count(*)::int as plots,
  count(*) filter (where ps.status = 'available')::int as available,
  count(*) filter (where ps.status = 'reserved')::int as reserved,
  count(*) filter (where ps.status in ('in use', 'full'))::int as in_use,
  count(*) filter (where ps.status = 'unusable')::int as unusable,
  (select count(*) from interments i join plots p on p.id = i.plot_id where p.section_id = ps.section_id and i.status = 'completed' and i.completed_on > current_date - 365)::int as burials_last_year
from plot_status ps
group by ps.cemetery, ps.section, ps.section_kind, ps.section_id;

-- Each account (funeral director or holder): charges due, payments, balance, how overdue.
create view accounts as
with acct as (
  select 'director' as kind, f.id, f.name from funeral_directors f
  union all
  select 'holder', h.id, h.name from holders h
),
ch as (
  select coalesce(funeral_director_id, holder_id) as account_id, amount_cents, due_on,
    sum(amount_cents) over (partition by coalesce(funeral_director_id, holder_id) order by due_on, created_at, id) as running
  from charges
),
paid as (
  select coalesce(funeral_director_id, holder_id) as account_id, sum(amount_cents) as paid from payments group by 1
)
select a.kind, a.id as account_id, a.name,
  coalesce((select sum(amount_cents) from ch where ch.account_id = a.id), 0)::bigint as charged_cents,
  coalesce((select sum(amount_cents) from ch where ch.account_id = a.id and ch.due_on <= current_date), 0)::bigint as due_cents,
  coalesce(p.paid, 0)::bigint as paid_cents,
  (coalesce((select sum(amount_cents) from ch where ch.account_id = a.id and ch.due_on <= current_date), 0) - coalesce(p.paid, 0))::bigint as overdue_cents,
  (select current_date - min(ch.due_on) from ch where ch.account_id = a.id and ch.due_on <= current_date and ch.running > coalesce(p.paid, 0)) as days_overdue
from acct a left join paid p on p.account_id = a.id;

create view arrears as
select kind, account_id, name, overdue_cents, days_overdue from accounts where overdue_cents > 0;

create view compliance_issues as
-- s 50: every burial registered with its place and a register number.
select 'BURIAL_REGISTERED' as rule, d.name as subject,
  'Completed on ' || i.completed_on || ' with no register number' as issue
from interments i join deceased d on d.id = i.deceased_id
where i.status = 'completed' and i.register_no is null
union all
-- s 10(2): the holder's consent before a burial in a plot whose right has been sold.
select 'HOLDER_CONSENT', d.name,
  'Booked for ' || to_char(s.scheduled_at, 'YYYY-MM-DD HH24:MI') || ' in ' || s.plot || ', held by ' || s.holder || ', with no consent recorded'
from schedule s join interments i on i.id = s.interment_id join deceased d on d.id = i.deceased_id
where s.holder is not null and s.holder_consent_on is null
union all
-- s 10(4): a right with space left lapses after 60 years without a burial.
select 'RIGHT_LAPSE', rl.plot,
  case when rl.lapses_on <= current_date then 'Right held by ' || rl.holder || ' lapsed on ' || rl.lapses_on || ': confirm and mark it lapsed'
       else 'Right held by ' || rl.holder || ' lapses on ' || rl.lapses_on || ' unless there is a burial: write to the holder' end
from right_lapses rl
where rl.space_left > 0 and rl.lapses_on <= current_date + setting_int('right_lapse_notice_days')
union all
select 'RIGHT_TERM_ENDED', rl.plot, 'Right held by ' || rl.holder || ' was sold for a term that ended on ' || rl.term_ends_on
from right_lapses rl where rl.term_ends_on is not null and rl.term_ends_on <= current_date
union all
-- s 51: no removal of a body without the Minister's licence.
select 'DISINTERMENT_LICENCE', d.name, 'Removed on ' || x.done_on || ' with no licence reference on file'
from disinterments x join interments i on i.id = x.interment_id join deceased d on d.id = i.deceased_id
where x.licence_ref is null or trim(x.licence_ref) = ''
union all
select 'PAPERWORK', s.deceased,
  'Burial on ' || to_char(s.scheduled_at, 'YYYY-MM-DD HH24:MI') || ' and the funeral director''s paperwork is not on file'
from schedule s
where s.paperwork_on is null and s.scheduled_at <= now()::timestamp + make_interval(hours => setting_int('paperwork_hours'))
union all
select 'OVER_CAPACITY', ps.label, ps.used + ps.booked || ' interments booked or done in a plot for ' || ps.capacity
from plot_status ps where ps.used + ps.booked > ps.capacity
union all
select 'MEMORIAL_UNSAFE', ps.label, m.description || ' found ' || m.condition || ' on ' || m.inspected_on || ', not made safe'
from memorials m join plot_status ps on ps.plot_id = m.plot_id
where m.condition = 'unsafe' and m.made_safe_on is null and m.inspected_on <= current_date - setting_int('make_safe_days')
union all
select 'MEMORIAL_NO_PERMIT', ps.label, m.description || ' installed on ' || m.installed_on || ' without an approved permit'
from memorials m join plot_status ps on ps.plot_id = m.plot_id
where m.installed_on is not null and coalesce(m.decision, '') <> 'approved'
union all
select 'MEMORIAL_PERMIT_WAITING', ps.label, m.applicant || ' applied on ' || m.applied_on || ' and has no decision'
from memorials m join plot_status ps on ps.plot_id = m.plot_id
where m.decision is null and m.applied_on <= current_date - setting_int('memorial_permit_days')
union all
select 'GROUNDS_OPEN', s.name, g.category || ': ' || g.summary || ' (open ' || (current_date - g.reported_on) || ' days)'
from grounds_jobs g join sections s on s.id = g.section_id
where g.resolved_on is null and g.reported_on <= current_date - setting_int('grounds_days');

alter table settings enable row level security;
alter table cemeteries enable row level security;
alter table sections enable row level security;
alter table plots enable row level security;
alter table holders enable row level security;
alter table funeral_directors enable row level security;
alter table rights enable row level security;
alter table deceased enable row level security;
alter table interments enable row level security;
alter table disinterments enable row level security;
alter table memorials enable row level security;
alter table grounds_jobs enable row level security;
alter table charges enable row level security;
alter table payments enable row level security;
alter table events enable row level security;
