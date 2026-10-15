#!/usr/bin/env node
// The one CLI for cemetery records. Human tables by default, --json for machines.
//   npm run cem -- help
//   npm run cem -- attention
//   npm run cem -- book --plot="Lawn A A-3" --deceased="Mary Jones" --died=2026-10-12 --director=Harbour --at=2026-10-20T11:00 --actor=Kate
// Every change takes --actor and can be previewed with --dry-run.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { getDb } from './lib/db.mjs';
import { parseCsv, pick } from './lib/csv.mjs';
import { table as textTable } from './lib/format.mjs';
import { page, table, writeOut, esc } from './lib/render.mjs';

// ---------------------------------------------------------------- reads

export const reads = {
  cemeteries: `select c.name, c.code, coalesce(c.address, '') as address, coalesce(c.closed_on::text, '') as closed_on,
                 (select count(*) from plot_status ps where ps.cemetery_id = c.id)::int as plots,
                 (select count(*) from plot_status ps where ps.cemetery_id = c.id and ps.status = 'available')::int as available
               from cemeteries c order by c.name`,
  sections: `select c.code as cemetery, s.name as section, s.kind, s.right_fee_cents, s.interment_fee_cents,
               (select count(*) from plots p where p.section_id = s.id)::int as plots
             from sections s join cemeteries c on c.id = s.cemetery_id order by c.code, s.name`,
  plots: `select label as plot, plot_type as type, capacity, used, booked, status, coalesce(holder, '') as holder, coalesce(unusable_reason, '') as note
          from plot_status order by cemetery, section, row_label, length(number), number`,
  schedule: `select substr(interment_id::text, 1, 8) as id, to_char(scheduled_at, 'YYYY-MM-DD HH24:MI') as at, deceased, kind, plot, funeral_director,
               case when paperwork_on is null then 'no' else 'yes' end as paperwork,
               case when holder is null then '' when holder_consent_on is null then 'needed' else 'yes' end as consent
             from schedule order by scheduled_at`,
  register: `select coalesce(register_no::text, '(none)') as no, deceased, date_of_death, age_years as age, plot, kind, completed_on,
               case when status = 'removed' then 'removed' else '' end as note
             from register order by completed_on desc, deceased`,
  rights: `select substr(right_id::text, 1, 8) as id, plot, holder, coalesce(certificate_no, '') as certificate, purchased_on,
             coalesce(last_burial_on::text, '') as last_burial, lapses_on, coalesce(term_ends_on::text, '') as term_ends, space_left
           from right_lapses order by plot`,
  lapsing: `select substr(right_id::text, 1, 8) as id, plot, holder, coalesce(certificate_no, '') as certificate, purchased_on,
              coalesce(last_burial_on::text, '') as last_burial, least(lapses_on, coalesce(term_ends_on, lapses_on)) as ends_on,
              case when coalesce(term_ends_on, lapses_on) < lapses_on then 'term' else 's 10(4)' end as why, space_left
            from right_lapses
            where space_left > 0 and least(lapses_on, coalesce(term_ends_on, lapses_on)) <= current_date + setting_int('right_lapse_notice_days')
            order by 7`,
  capacity: `select cemetery, section, section_kind as kind, plots, available, reserved, in_use, unusable, burials_last_year,
               case when burials_last_year = 0 then null else round(available::numeric / burials_last_year, 1) end as years_left
             from capacity order by cemetery, section`,
  memorials: `select substr(m.id::text, 1, 8) as id, ps.label as plot, m.description, m.applicant, coalesce(m.applied_on::text, '') as applied,
                coalesce(m.decision, 'waiting') as decision, coalesce(m.installed_on::text, '') as installed, m.condition,
                coalesce(m.inspected_on::text, '') as inspected
              from memorials m join plot_status ps on ps.plot_id = m.plot_id order by ps.label, m.applied_on nulls first`,
  grounds: `select substr(g.id::text, 1, 8) as id, s.name as section, coalesce(ps.label, '') as plot, g.category, g.reported_on,
              (current_date - g.reported_on)::int as days_open, g.summary
            from grounds_jobs g join sections s on s.id = g.section_id left join plot_status ps on ps.plot_id = g.plot_id
            where g.resolved_on is null order by g.reported_on`,
  arrears: `select kind, name, overdue_cents, days_overdue from arrears order by days_overdue desc nulls last, name`,
  accounts: `select kind, name, charged_cents, due_cents, paid_cents, overdue_cents, days_overdue from accounts
             where charged_cents <> 0 or paid_cents <> 0 order by kind, name`,
  directors: `select f.name, coalesce(f.email, '') as email, coalesce(f.phone, '') as phone,
                (select count(*) from interments i where i.funeral_director_id = f.id and i.status = 'booked')::int as booked,
                (select count(*) from interments i where i.funeral_director_id = f.id and i.status = 'completed' and i.completed_on > current_date - 365)::int as last_12_months,
                (select overdue_cents from accounts a where a.account_id = f.id) as overdue_cents
              from funeral_directors f order by f.name`,
  holders: `select h.name, coalesce(h.email, '') as email, coalesce(h.phone, '') as phone,
              coalesce((select string_agg(ps.label, ', ' order by ps.label) from rights r join plot_status ps on ps.plot_id = r.plot_id where r.holder_id = h.id and r.status = 'active'), '') as plots
            from holders h order by h.name`,
  compliance: `select rule, subject, issue from compliance_issues order by rule, subject`,
  settings: `select key, value, note from settings order by key`,
  activity: `select to_char(created_at, 'YYYY-MM-DD HH24:MI') as at, actor, action, substr(record_id::text, 1, 8) as record from events order by created_at, id`,
};

const MUTATIONS = {
  'add-cemetery': ['name', 'code', 'address'],
  'add-section': ['cemetery', 'name', 'kind', 'right-fee', 'interment-fee'],
  'set-section': ['section', 'right-fee', 'interment-fee'],
  'add-plots': ['section', 'row', 'from', 'to', 'type', 'capacity'],
  'set-plot': ['plot', 'unusable', 'usable', 'capacity'],
  'add-holder': ['name', 'email', 'phone', 'address'],
  'add-director': ['name', 'email', 'phone'],
  'sell-right': ['plot', 'holder', 'price', 'term', 'certificate', 'on'],
  'transfer-right': ['right', 'to', 'certificate', 'on', 'note'],
  'surrender-right': ['right', 'refund', 'on', 'note'],
  'end-right': ['right', 'on'],
  book: ['plot', 'deceased', 'born', 'died', 'age', 'address', 'occupation', 'director', 'kind', 'at', 'consent', 'paperwork'],
  consent: ['booking', 'on'],
  paperwork: ['booking', 'on'],
  reschedule: ['booking', 'at'],
  complete: ['booking', 'on'],
  'assign-number': ['interment'],
  cancel: ['booking', 'reason'],
  disinter: ['interment', 'licence', 'on', 'destination'],
  'record-licence': ['interment', 'licence'],
  'apply-memorial': ['plot', 'applicant', 'description', 'on'],
  'decide-memorial': ['memorial', 'decision', 'on'],
  'install-memorial': ['memorial', 'on'],
  'inspect-memorial': ['memorial', 'condition', 'on'],
  'make-safe': ['memorial', 'on'],
  'report-grounds': ['section', 'plot', 'category', 'summary', 'on'],
  'resolve-grounds': ['job', 'on'],
  charge: ['director', 'holder', 'description', 'amount', 'due'],
  pay: ['director', 'holder', 'amount', 'reference', 'on'],
  set: ['key', 'value'],
  import: ['file', 'map'],
};
const OTHER = {
  plot: ['plot'],
  search: ['name', 'died-from', 'died-to'],
  available: ['cemetery', 'section', 'type'],
  attention: [],
  'weekly-review': [],
  export: ['out'],
  'draft-confirmation': ['booking'],
  'draft-lapse-notice': ['right'],
  help: [],
};
const FLAGS = { ...Object.fromEntries(Object.keys(reads).map((k) => [k, []])), ...OTHER, ...MUTATIONS };
const BOOLEAN = new Set(['json', 'dry-run', 'usable']);

// ---------------------------------------------------------------- argument parsing

function parseArgs(argv) {
  const cmd = argv[0] || 'help';
  if (!FLAGS[cmd]) throw new Error(`Unknown command "${cmd}". Run: npm run cem -- help`);
  const opts = {};
  const positional = [];
  for (const arg of argv.slice(1)) {
    if (!arg.startsWith('--')) { positional.push(arg); continue; }
    const at = arg.indexOf('=');
    const key = arg.slice(2, at < 0 ? undefined : at);
    const value = at < 0 ? true : arg.slice(at + 1);
    const allowed = [...FLAGS[cmd], 'json', ...(MUTATIONS[cmd] ? ['actor', 'dry-run'] : [])];
    if (!allowed.includes(key)) throw new Error(`Unknown flag --${key} for ${cmd}`);
    if (Object.hasOwn(opts, key)) throw new Error(`Repeated flag --${key}`);
    if (BOOLEAN.has(key) ? value !== true : value === true || value === '') throw new Error(`Invalid value for --${key}`);
    opts[key] = value;
  }
  if (cmd === 'import' ? positional.join(' ') !== 'plotbox' : positional.length) {
    throw new Error(cmd === 'import' ? 'Usage: import plotbox --file=records.csv --actor=NAME' : `Unexpected argument: ${positional[0]}`);
  }
  return { cmd, opts };
}

function help() {
  const line = (c) => `  ${c}${c === 'import' ? ' plotbox' : ''} ${FLAGS[c].map((f) => (BOOLEAN.has(f) ? `[--${f}]` : `--${f}=…`)).join(' ')}${MUTATIONS[c] ? ' --actor=NAME [--dry-run]' : ''} [--json]`;
  return ['Reads:', ...Object.keys(reads).map(line), ...Object.keys(OTHER).map(line), '', 'Changes:', ...Object.keys(MUTATIONS).map(line)].join('\n');
}

// ---------------------------------------------------------------- value checks

// YYYY-MM-DD, or DD/MM/YYYY as New Zealand and Australian exports write it.
const isoDate = (v, what = 'date') => {
  let s = String(v).trim();
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) s = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`)) || new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) !== s) throw new Error(`Invalid ${what}: ${v} (use YYYY-MM-DD)`);
  return s;
};
const isoTime = (v, what = 'time') => {
  const s = String(v).replace(' ', 'T');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) || !Number.isFinite(Date.parse(`${s}:00Z`))) throw new Error(`Invalid ${what}: ${v} (use YYYY-MM-DDTHH:MM)`);
  return `${s.replace('T', ' ')}:00`;
};
const cents = (v) => {
  if (!/^\d+(\.\d{1,2})?$/.test(String(v))) throw new Error(`Invalid amount: ${v} (plain number, no symbols)`);
  const [whole, frac = ''] = String(v).split('.');
  const n = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  if (!Number.isSafeInteger(n) || n > 9_000_000_000_000) throw new Error('Amount too large');
  return n;
};
const posInt = (v, what) => {
  if (!/^\d+$/.test(String(v)) || Number(v) < 1) throw new Error(`Invalid ${what}: ${v}`);
  return Number(v);
};
const oneOf = (v, list, what) => {
  const s = String(v).toLowerCase();
  if (!list.includes(s)) throw new Error(`Invalid ${what}: ${v} (one of ${list.join(', ')})`);
  return s;
};
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// ---------------------------------------------------------------- main

async function main() {
  const { cmd, opts } = parseArgs(process.argv.slice(2));
  if (cmd === 'help') { console.log(help()); return; }

  const db = await getDb();
  const q = (sql, params = []) => db.query(sql, params);
  const one = async (sql, params = []) => (await q(sql, params))[0];
  const req = (k) => {
    if (typeof opts[k] !== 'string' || !opts[k].trim()) throw new Error(`Required: --${k}=…`);
    return opts[k].trim();
  };
  const opt = (k) => (typeof opts[k] === 'string' && opts[k].trim() ? opts[k].trim() : null);

  try {
    const today = (await one('select current_date::text as d')).d;
    const setting = async (k) => (await one('select value from settings where key = $1', [k]))?.value;
    const currency = (await setting('currency')) || 'NZD';
    const dueOn = async () => (await one('select (current_date + $1::int)::text as d', [Number(await setting('invoice_due_days'))])).d;

    // Partial id, exact name (case-insensitive) or, failing that, a name fragment. Ambiguous lists and fails.
    const resolve = async (tableName, s, label = tableName, extra = '') => {
      const sql = (where) => `select * from ${tableName} where (${where}) ${extra} order by name, id`;
      let rows = await q(sql(`id::text = lower($1) or lower(name) = lower($1) or starts_with(id::text, lower($1))${tableName === 'cemeteries' ? ' or lower(code) = lower($1)' : ''}`), [s]);
      if (!rows.length) rows = await q(sql("lower(name) like '%' || lower($1) || '%'"), [s]);
      if (rows.length !== 1) throw new Error(rows.length ? `More than one ${label} matches "${s}": ${rows.map((r) => `${r.name} (${r.id.slice(0, 8)})`).join('; ')}` : `No ${label} matches "${s}"`);
      return rows[0];
    };
    const resolveSection = async (s) => {
      const rows = await q(
        `select s.*, c.code, c.name as cemetery, c.closed_on from sections s join cemeteries c on c.id = s.cemetery_id
         where starts_with(s.id::text, lower($1)) or lower(s.name) = lower($1) or lower(c.code || ' ' || s.name) = lower($1) or lower(c.name || ' ' || s.name) = lower($1)
         order by c.code, s.name`, [s]);
      if (rows.length !== 1) throw new Error(rows.length ? `More than one section matches "${s}": ${rows.map((r) => `${r.code} ${r.name}`).join('; ')}` : `No section matches "${s}"`);
      return rows[0];
    };
    // A plot by id prefix, full label ("ELC Lawn A A-3"), section and plot ("Lawn A A-3") or plot alone ("A-3") when only one matches.
    const resolvePlot = async (s) => {
      const norm = s.replace(/\s+/g, ' ').trim();
      const rows = await q(
        `select ps.*, p.section_id as sid from plot_status ps join plots p on p.id = ps.plot_id
         where starts_with(ps.plot_id::text, lower($1)) or lower(ps.label) = lower($1)
            or lower(ps.section || ' ' || case when ps.row_label = '' then '' else ps.row_label || '-' end || ps.number) = lower($1)
            or lower(case when ps.row_label = '' then '' else ps.row_label || '-' end || ps.number) = lower($1)
         order by ps.label`, [norm]);
      if (rows.length !== 1) throw new Error(rows.length ? `More than one plot matches "${s}": ${rows.map((r) => r.label).join('; ')}` : `No plot matches "${s}"`);
      return rows[0];
    };
    const resolveInterment = async (s, status = null) => {
      const where = status ? 'and i.status = $2' : '';
      const params = status ? [s, status] : [s];
      let rows = await q(`select i.*, d.name as deceased from interments i join deceased d on d.id = i.deceased_id where starts_with(i.id::text, lower($1)) ${where}`, params);
      if (!rows.length) {
        rows = await q(`select i.*, d.name as deceased from interments i join deceased d on d.id = i.deceased_id
                        where (lower(d.name) = lower($1) or lower(d.name) like '%' || lower($1) || '%') ${where} order by i.scheduled_at`, params);
      }
      const label = status === 'booked' ? 'booking' : 'interment';
      if (rows.length !== 1) throw new Error(rows.length ? `More than one ${label} matches "${s}": ${rows.map((r) => `${r.deceased} (${r.id.slice(0, 8)})`).join('; ')}` : `No ${label} matches "${s}"`);
      return rows[0];
    };
    // An active right by id prefix, certificate number, plot or holder name.
    const resolveRight = async (s) => {
      let rows = await q(`select r.*, rl.plot, rl.holder, rl.lapses_on, rl.term_ends_on, rl.space_left from rights r join right_lapses rl on rl.right_id = r.id
                          where starts_with(r.id::text, lower($1)) or lower(r.certificate_no) = lower($1) or lower(rl.plot) = lower($1) or lower(rl.holder) = lower($1)`, [s]);
      if (!rows.length) {
        const p = await resolvePlot(s).catch(() => null);
        if (p) rows = await q(`select r.*, rl.plot, rl.holder, rl.lapses_on, rl.term_ends_on, rl.space_left from rights r join right_lapses rl on rl.right_id = r.id where r.plot_id = $1`, [p.plot_id]);
      }
      if (rows.length !== 1) throw new Error(rows.length ? `More than one right matches "${s}": ${rows.map((r) => `${r.plot} ${r.holder} (${r.id.slice(0, 8)})`).join('; ')}` : `No active right matches "${s}"`);
      return rows[0];
    };
    const resolveMemorial = async (s) => {
      let rows = await q('select * from memorials where starts_with(id::text, lower($1))', [s]);
      if (!rows.length) {
        const p = await resolvePlot(s).catch(() => null);
        if (p) rows = await q('select * from memorials where plot_id = $1', [p.plot_id]);
      }
      if (rows.length !== 1) throw new Error(rows.length ? `More than one memorial matches "${s}": ${rows.map((r) => `${r.description} (${r.id.slice(0, 8)})`).join('; ')}` : `No memorial matches "${s}"`);
      return rows[0];
    };
    const byPrefix = async (tableName, s, label) => {
      const rows = await q(`select * from ${tableName} where starts_with(id::text, lower($1))`, [s]);
      if (rows.length !== 1) throw new Error(rows.length ? `More than one ${label} starts with "${s}"` : `No ${label} with id "${s}"`);
      return rows[0];
    };
    const account = async () => {
      if (opt('director') && opt('holder')) throw new Error('Give --director or --holder, not both');
      if (opt('director')) return { funeral_director_id: (await resolve('funeral_directors', req('director'), 'funeral director')).id };
      if (opt('holder')) return { holder_id: (await resolve('holders', req('holder'), 'holder')).id };
      throw new Error('Required: --director=… or --holder=…');
    };
    const insert = async (t, obj) => {
      const keys = Object.keys(obj);
      return one(`insert into ${t} (${keys.join(', ')}) values (${keys.map((_, i) => `$${i + 1}`).join(', ')}) returning *`, Object.values(obj));
    };
    const update = async (t, row, obj) => {
      const keys = Object.keys(obj);
      return one(`update ${t} set ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} where id = $${keys.length + 1} returning *`, [...Object.values(obj), row.id]);
    };
    const log = (action, before, after) =>
      q('insert into events (actor, action, record_id, before_record, after_record) values ($1, $2, $3, $4::jsonb, $5::jsonb)',
        [req('actor'), action, after?.id || before?.id || null, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null]);
    const nextRegisterNo = async (plotId) => Number((await one(
      `select coalesce(max(i.register_no), 0) + 1 as n from interments i join plots p on p.id = i.plot_id join sections s on s.id = p.section_id
       where s.cemetery_id = (select s2.cemetery_id from plots p2 join sections s2 on s2.id = p2.section_id where p2.id = $1)`, [plotId])).n);

    let out;
    if (reads[cmd]) {
      out = await q(reads[cmd]);
    } else if (MUTATIONS[cmd]) {
      req('actor');
      await db.exec('BEGIN');
      try {
        out = await mutate(cmd);
        await db.exec(opts['dry-run'] ? 'ROLLBACK' : 'COMMIT');
      } catch (e) {
        await db.exec('ROLLBACK');
        throw e;
      }
    } else {
      out = await other(cmd);
    }
    if (opts['dry-run'] && out && !Array.isArray(out)) out = { ...out, preview: 'Preview only. Nothing was changed.' };
    print(out);

    // ---------------------------------------------------------------- read helpers

    async function other(c) {
      if (c === 'plot') {
        const p = await resolvePlot(req('plot'));
        return {
          plot: [{ plot: p.label, type: p.plot_type, capacity: p.capacity, used: p.used, booked: p.booked, status: p.status, note: p.unusable_reason || '' }],
          rights: await q(`select coalesce(r.certificate_no, '') as certificate, h.name as holder, r.purchased_on, coalesce(r.term_years::text, 'perpetual') as term, r.status, coalesce(r.ended_on::text, '') as ended
                           from rights r join holders h on h.id = r.holder_id where r.plot_id = $1 order by r.purchased_on`, [p.plot_id]),
          interments: await q(`select coalesce(i.register_no::text, '') as no, d.name as deceased, d.date_of_death, i.kind, i.status,
                                 coalesce(i.completed_on::text, to_char(i.scheduled_at, 'YYYY-MM-DD HH24:MI')) as on_date
                               from interments i join deceased d on d.id = i.deceased_id where i.plot_id = $1 and i.status <> 'cancelled' order by i.scheduled_at`, [p.plot_id]),
          memorials: await q(`select description, applicant, coalesce(decision, 'waiting') as decision, coalesce(installed_on::text, '') as installed, condition from memorials where plot_id = $1`, [p.plot_id]),
          grounds: await q(`select category, summary, reported_on, coalesce(resolved_on::text, 'open') as resolved from grounds_jobs where plot_id = $1 order by reported_on`, [p.plot_id]),
        };
      }
      if (c === 'search') {
        const name = req('name');
        const from = opt('died-from') ? isoDate(req('died-from'), 'died-from date') : '0001-01-01';
        const to = opt('died-to') ? isoDate(req('died-to'), 'died-to date') : '9999-12-31';
        return q(`select coalesce(register_no::text, '') as no, deceased, date_of_birth, date_of_death, age_years as age, cemetery, plot, kind, completed_on,
                    case when status = 'removed' then 'removed' else '' end as note
                  from register where lower(deceased) like '%' || lower($1) || '%' and coalesce(date_of_death, completed_on) between $2 and $3
                  order by deceased, completed_on`, [name, from, to]);
      }
      if (c === 'available') {
        const filters = [];
        const params = [];
        if (opt('cemetery')) { params.push((await resolve('cemeteries', req('cemetery'), 'cemetery')).id); filters.push(`ps.cemetery_id = $${params.length}`); }
        if (opt('section')) { params.push((await resolveSection(req('section'))).id); filters.push(`ps.section_id = $${params.length}`); }
        if (opt('type')) { params.push(oneOf(req('type'), ['burial', 'ashes'], 'type')); filters.push(`ps.plot_type = $${params.length}`); }
        return q(`select ps.label as plot, ps.plot_type as type, ps.capacity, s.right_fee_cents, s.interment_fee_cents
                  from plot_status ps join sections s on s.id = ps.section_id join cemeteries c on c.id = ps.cemetery_id
                  where ps.status = 'available' and c.closed_on is null ${filters.length ? 'and ' + filters.join(' and ') : ''}
                  order by ps.cemetery, ps.section, ps.row_label, length(ps.number), ps.number`, params);
      }
      if (c === 'attention') {
        return {
          compliance: await q(reads.compliance),
          'next 7 days': await q(`select at, deceased, plot, funeral_director, paperwork, consent from (${reads.schedule}) x where at <= to_char(now() + interval '7 days', 'YYYY-MM-DD HH24:MI')`),
          'rights lapsing': await q(`select plot, holder, ends_on, why from (${reads.lapsing}) x`),
          arrears: await q(`select kind, name, overdue_cents, days_overdue from arrears where days_overdue >= 14 order by days_overdue desc`),
          'grounds open': await q(`select section, plot, category, days_open from (${reads.grounds}) x`),
        };
      }
      if (c === 'weekly-review') {
        return {
          'this week': await q(`select at, deceased, kind, plot, funeral_director, paperwork, consent from (${reads.schedule}) x where at <= to_char(now() + interval '7 days', 'YYYY-MM-DD HH24:MI')`),
          'last week': await q(`select no, deceased, plot, completed_on from (${reads.register}) x where completed_on > current_date - 7 and note = ''`),
          capacity: await q(reads.capacity),
          'rights lapsing': await q(`select plot, holder, ends_on, why from (${reads.lapsing}) x`),
          'memorial permits waiting': await q(`select plot, applicant, applied from (${reads.memorials}) x where decision = 'waiting' and applied <> ''`),
          arrears: await q(reads.arrears),
          'compliance by rule': await q('select rule, count(*)::int as open from compliance_issues group by rule order by rule'),
        };
      }
      if (c === 'export') {
        const file = path.resolve(req('out'));
        const data = { format: 'cemetery-archive-v1', created: new Date().toISOString(), records: {} };
        await db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ');
        try {
          for (const t of ['settings', 'cemeteries', 'sections', 'plots', 'holders', 'funeral_directors', 'rights', 'deceased', 'interments', 'disinterments', 'memorials', 'grounds_jobs', 'charges', 'payments', 'events']) {
            data.records[t] = await q(`select * from ${t} order by 1`);
          }
          await db.exec('COMMIT');
        } catch (e) {
          await db.exec('ROLLBACK');
          throw e;
        }
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
        return { file, counts: Object.fromEntries(Object.entries(data.records).map(([k, v]) => [k, v.length])) };
      }
      if (c === 'draft-confirmation') {
        const b = await resolveInterment(req('booking'), 'booked');
        const s = await one('select * from schedule where interment_id = $1', [b.id]);
        const fee = await one('select amount_cents from charges where interment_id = $1 and amount_cents > 0 order by created_at limit 1', [b.id]);
        const missing = [];
        if (!s.paperwork_on) missing.push('the burial paperwork (medical certificate of cause of death or the coroner\'s authority)');
        if (s.holder && !s.holder_consent_on) missing.push(`written consent from ${s.holder}, who holds the right of burial`);
        const file = writeOut('drafts', `confirmation-${slug(b.deceased)}-${String(s.scheduled_at).slice(0, 10)}`, page({
          title: 'DRAFT: interment booking confirmation',
          subtitle: `${b.deceased}, ${s.plot}`,
          sections: [
            { title: 'Letter', html: `<p>Kia ora ${esc(s.funeral_director || 'team')},</p><p>We confirm the ${esc(b.kind === 'ashes' ? 'interment of ashes' : 'burial')} of ${esc(b.deceased)} at ${esc(String(s.scheduled_at).slice(0, 16))} in ${esc(s.plot)}.</p>${missing.length ? `<p>Before the day we still need: ${missing.map(esc).join('; ')}.</p>` : '<p>We hold everything we need. Our grounds team will have the site ready an hour before.</p>'}${fee ? `<p>The interment fee of ${esc(currency)} ${(Number(fee.amount_cents) / 100).toFixed(2)} will be invoiced to you.</p>` : ''}<p>Ngā mihi,<br>[Cemetery office]</p>` },
          ],
        }));
        return { file, booking: b.deceased, missing, note: 'Draft only. Nothing was sent.' };
      }
      if (c === 'draft-lapse-notice') {
        const r = await resolveRight(req('right'));
        const h = await one('select * from holders where id = $1', [r.holder_id]);
        const lapseYears = await setting('right_lapse_years');
        const file = writeOut('drafts', `lapse-notice-${slug(h.name)}-${today}`, page({
          title: 'DRAFT: your right of burial',
          subtitle: `${h.name}, ${r.plot}`,
          sections: [
            { title: 'Letter', html: `<p>Dear ${esc(h.name)},</p><p>Our records show you hold the right of burial for ${esc(r.plot)}${r.certificate_no ? ` (certificate ${esc(r.certificate_no)})` : ''}, bought on ${esc(r.purchased_on)}.</p><p>Under section 10(4) of the Burial and Cremation Act 1964 a right of burial lapses when ${esc(lapseYears)} years pass without a burial in the plot. For this plot that date is ${esc(r.lapses_on)}.</p><p>If you or your family still intend to use the plot, please contact us so we can talk through your options. If you no longer need it, we can discuss surrendering it.</p><p>Ngā mihi,<br>[Cemetery office]</p>` },
            { title: 'The record we hold', html: table([{ plot: r.plot, holder: h.name, certificate: r.certificate_no || '', purchased_on: r.purchased_on, last_burial: r.last_burial_on || 'none', lapses_on: r.lapses_on }]) },
          ],
        }));
        return { file, holder: h.name, lapses_on: r.lapses_on, address: h.address || '', note: 'Draft only. Nothing was sent. Check the address on file before posting.' };
      }
      throw new Error(`Unhandled command ${c}`);
    }

    // ---------------------------------------------------------------- changes

    async function mutate(c) {
      if (c === 'add-cemetery') {
        const row = await insert('cemeteries', { name: req('name'), code: req('code').toUpperCase(), address: opt('address') });
        await log(c, null, row);
        return row;
      }
      if (c === 'add-section') {
        const cem = await resolve('cemeteries', req('cemetery'), 'cemetery');
        const kind = oneOf(req('kind'), ['lawn', 'monumental', 'ashes', 'natural', 'children', 'services', 'denominational'], 'kind');
        const row = await insert('sections', { cemetery_id: cem.id, name: req('name'), kind, right_fee_cents: opt('right-fee') ? cents(req('right-fee')) : 0, interment_fee_cents: opt('interment-fee') ? cents(req('interment-fee')) : 0 });
        await log(c, null, row);
        return row;
      }
      if (c === 'set-section') {
        const s = await resolveSection(req('section'));
        const changes = {};
        if (opt('right-fee')) changes.right_fee_cents = cents(req('right-fee'));
        if (opt('interment-fee')) changes.interment_fee_cents = cents(req('interment-fee'));
        if (!Object.keys(changes).length) throw new Error('Nothing to change: give --right-fee or --interment-fee');
        const before = await one('select * from sections where id = $1', [s.id]);
        const row = await update('sections', before, changes);
        await log(c, before, row);
        return row;
      }
      if (c === 'add-plots') {
        const s = await resolveSection(req('section'));
        const from = posInt(req('from'), 'from');
        const to = opt('to') ? posInt(req('to'), 'to') : from;
        if (to < from || to - from > 499) throw new Error('--to must be at or after --from, and at most 500 plots at once');
        const type = oneOf(opt('type') || (s.kind === 'ashes' ? 'ashes' : 'burial'), ['burial', 'ashes'], 'type');
        const capacity = opt('capacity') ? posInt(req('capacity'), 'capacity') : 1;
        const rowLabel = opt('row') || '';
        let added = 0;
        for (let n = from; n <= to; n++) {
          if (await one('select id from plots where section_id = $1 and row_label = $2 and number = $3', [s.id, rowLabel, String(n)])) throw new Error(`${s.name} ${rowLabel ? rowLabel + '-' : ''}${n} already exists`);
          const row = await insert('plots', { section_id: s.id, row_label: rowLabel, number: String(n), plot_type: type, capacity });
          await log(c, null, row);
          added++;
        }
        return { section: `${s.code} ${s.name}`, row: rowLabel, from, to, type, capacity, added };
      }
      if (c === 'set-plot') {
        const p = await resolvePlot(req('plot'));
        const before = await one('select * from plots where id = $1', [p.plot_id]);
        const changes = {};
        if (opt('unusable') && opts.usable) throw new Error('Give --unusable=reason or --usable, not both');
        if (opt('unusable')) {
          if (p.used + p.booked > 0 || p.right_id) throw new Error(`${p.label} has a right or interments: it cannot be marked unusable`);
          changes.unusable_reason = req('unusable');
        }
        if (opts.usable) changes.unusable_reason = null;
        if (opt('capacity')) {
          const cap = posInt(req('capacity'), 'capacity');
          if (cap < p.used + p.booked) throw new Error(`${p.label} already has ${p.used + p.booked} interments booked or done`);
          changes.capacity = cap;
        }
        if (!Object.keys(changes).length) throw new Error('Nothing to change: give --unusable, --usable or --capacity');
        const row = await update('plots', before, changes);
        await log(c, before, row);
        return row;
      }
      if (c === 'add-holder') {
        const row = await insert('holders', { name: req('name'), email: opt('email'), phone: opt('phone'), address: opt('address') });
        await log(c, null, row);
        return row;
      }
      if (c === 'add-director') {
        const row = await insert('funeral_directors', { name: req('name'), email: opt('email'), phone: opt('phone') });
        await log(c, null, row);
        return row;
      }
      if (c === 'sell-right') {
        const p = await resolvePlot(req('plot'));
        const s = await resolveSection(p.section_id);
        if (s.closed_on) throw new Error(`${s.cemetery} closed on ${s.closed_on}: no new rights are sold there`);
        if (p.status === 'unusable') throw new Error(`${p.label} is unusable: ${p.unusable_reason}`);
        if (p.right_id) throw new Error(`${p.label} already has an active right held by ${p.holder}`);
        if (p.used + p.booked > 0) throw new Error(`${p.label} already has interments: sell the right to the family as a transfer of a new right only after checking the register`);
        const h = await resolve('holders', req('holder'), 'holder');
        const price = opt('price') ? cents(req('price')) : Number(s.right_fee_cents);
        const row = await insert('rights', {
          plot_id: p.plot_id, holder_id: h.id, certificate_no: opt('certificate'), purchased_on: opt('on') ? isoDate(req('on')) : today,
          term_years: opt('term') ? posInt(req('term'), 'term') : null, price_cents: price,
        });
        await log(c, null, row);
        if (price > 0) {
          const ch = await insert('charges', { holder_id: h.id, right_id: row.id, description: `Right of burial${row.certificate_no ? ' ' + row.certificate_no : ''}: ${p.label}`, amount_cents: price, due_on: await dueOn() });
          await log('charge', null, ch);
        }
        return { ...row, plot: p.label, holder: h.name };
      }
      if (c === 'transfer-right') {
        const r = await resolveRight(req('right'));
        const to = await resolve('holders', req('to'), 'holder');
        if (to.id === r.holder_id) throw new Error(`${to.name} already holds this right`);
        const on = opt('on') ? isoDate(req('on')) : today;
        const old = await one('select * from rights where id = $1', [r.id]);
        const ended = await update('rights', old, { status: 'transferred', ended_on: on, end_note: opt('note') || `Transferred to ${to.name}` });
        await log(c, old, ended);
        // The new holder takes the same right: same purchase date, so the s 10(4) clock does not restart.
        const row = await insert('rights', { plot_id: old.plot_id, holder_id: to.id, certificate_no: opt('certificate'), purchased_on: old.purchased_on, term_years: old.term_years, price_cents: 0 });
        await log(c, null, row);
        return { ...row, plot: r.plot, from: r.holder, to: to.name };
      }
      if (c === 'surrender-right') {
        const r = await resolveRight(req('right'));
        const old = await one('select * from rights where id = $1', [r.id]);
        const on = opt('on') ? isoDate(req('on')) : today;
        const row = await update('rights', old, { status: 'surrendered', ended_on: on, end_note: opt('note') || 'Rescinded by agreement (s 10(3))' });
        await log(c, old, row);
        if (opt('refund')) {
          const ch = await insert('charges', { holder_id: old.holder_id, right_id: old.id, description: `Refund on surrender: ${r.plot}`, amount_cents: -cents(req('refund')), due_on: on });
          await log('charge', null, ch);
        }
        return { ...row, plot: r.plot, holder: r.holder };
      }
      if (c === 'end-right') {
        const r = await resolveRight(req('right'));
        const on = opt('on') ? isoDate(req('on')) : today;
        let status;
        if (r.term_ends_on && r.term_ends_on <= on) status = 'expired';
        else if (r.lapses_on <= on) status = 'lapsed';
        else throw new Error(`The right held by ${r.holder} on ${r.plot} has not ended: it lapses on ${r.lapses_on}${r.term_ends_on ? ` and its term ends on ${r.term_ends_on}` : ''}`);
        const old = await one('select * from rights where id = $1', [r.id]);
        const row = await update('rights', old, { status, ended_on: on, end_note: status === 'lapsed' ? `Lapsed under s 10(4): no burial since ${r.last_burial_on || r.purchased_on}` : `Term of ${r.term_years} years ended ${r.term_ends_on}` });
        await log(c, old, row);
        return { ...row, plot: r.plot, holder: r.holder };
      }
      if (c === 'book') {
        const p = await resolvePlot(req('plot'));
        const kind = oneOf(opt('kind') || (p.plot_type === 'ashes' ? 'ashes' : 'burial'), ['burial', 'ashes'], 'kind');
        if (p.status === 'unusable') throw new Error(`${p.label} is unusable: ${p.unusable_reason}`);
        if (kind === 'burial' && p.plot_type === 'ashes') throw new Error(`${p.label} is an ashes plot: a burial cannot be booked there`);
        if (p.used + p.booked >= p.capacity) throw new Error(`${p.label} is full: ${p.used + p.booked} of ${p.capacity} interments booked or done`);
        const consent = opt('consent') ? isoDate(req('consent'), 'consent date') : null;
        if (p.right_id && !consent) throw new Error(`${p.label} is held by ${p.holder}. Record the date they consented with --consent=YYYY-MM-DD (Burial and Cremation Act 1964, s 10(2))`);
        const director = opt('director') ? await resolve('funeral_directors', req('director'), 'funeral director') : null;
        const at = isoTime(req('at'), 'interment time');
        const d = await insert('deceased', {
          name: req('deceased'), date_of_birth: opt('born') ? isoDate(req('born'), 'birth date') : null, date_of_death: isoDate(req('died'), 'date of death'),
          age_years: opt('age') ? Number(req('age')) : null, last_address: opt('address'), occupation: opt('occupation'),
        });
        await log(c, null, d);
        const row = await insert('interments', {
          plot_id: p.plot_id, deceased_id: d.id, funeral_director_id: director?.id || null, kind, scheduled_at: at,
          holder_consent_on: consent, paperwork_on: opt('paperwork') ? isoDate(req('paperwork'), 'paperwork date') : null,
        });
        await log(c, null, row);
        const s = await one('select interment_fee_cents from sections where id = $1', [p.section_id]);
        if (director && Number(s.interment_fee_cents) > 0) {
          const ch = await insert('charges', { funeral_director_id: director.id, interment_id: row.id, description: `Interment fee: ${d.name}, ${p.label}`, amount_cents: s.interment_fee_cents, due_on: await dueOn() });
          await log('charge', null, ch);
        }
        return { ...row, deceased: d.name, plot: p.label, funeral_director: director?.name || '' };
      }
      if (c === 'consent' || c === 'paperwork') {
        const b = await resolveInterment(req('booking'), 'booked');
        const col = c === 'consent' ? 'holder_consent_on' : 'paperwork_on';
        const before = await one('select * from interments where id = $1', [b.id]);
        const row = await update('interments', before, { [col]: opt('on') ? isoDate(req('on')) : today });
        await log(c, before, row);
        return { ...row, deceased: b.deceased };
      }
      if (c === 'reschedule') {
        const b = await resolveInterment(req('booking'), 'booked');
        const before = await one('select * from interments where id = $1', [b.id]);
        const row = await update('interments', before, { scheduled_at: isoTime(req('at'), 'interment time') });
        await log(c, before, row);
        return { ...row, deceased: b.deceased };
      }
      if (c === 'complete') {
        const b = await resolveInterment(req('booking'), 'booked');
        const s = await one('select * from schedule where interment_id = $1', [b.id]);
        if (!s.paperwork_on) throw new Error(`No burial paperwork on file for ${b.deceased}. Record it first: paperwork --booking=…`);
        if (s.holder && !s.holder_consent_on) throw new Error(`No consent from ${s.holder} on file (s 10(2)). Record it first: consent --booking=…`);
        const before = await one('select * from interments where id = $1', [b.id]);
        const row = await update('interments', before, { status: 'completed', completed_on: opt('on') ? isoDate(req('on')) : today, register_no: await nextRegisterNo(b.plot_id) });
        await log(c, before, row);
        return { ...row, deceased: b.deceased, plot: s.plot };
      }
      if (c === 'assign-number') {
        const i = await resolveInterment(req('interment'), 'completed');
        if (i.register_no) throw new Error(`${i.deceased} is already register number ${i.register_no}`);
        const before = await one('select * from interments where id = $1', [i.id]);
        const row = await update('interments', before, { register_no: await nextRegisterNo(i.plot_id) });
        await log(c, before, row);
        return { ...row, deceased: i.deceased };
      }
      if (c === 'cancel') {
        const b = await resolveInterment(req('booking'), 'booked');
        const before = await one('select * from interments where id = $1', [b.id]);
        const row = await update('interments', before, { status: 'cancelled', cancel_reason: req('reason') });
        await log(c, before, row);
        const fee = await one('select coalesce(sum(amount_cents), 0)::bigint as n, max(funeral_director_id::text) as fd from charges where interment_id = $1', [b.id]);
        if (Number(fee.n) > 0) {
          const ch = await insert('charges', { funeral_director_id: fee.fd, interment_id: b.id, description: `Credit: booking cancelled for ${b.deceased}`, amount_cents: -Number(fee.n), due_on: today });
          await log('charge', null, ch);
        }
        return { ...row, deceased: b.deceased, credited_cents: Number(fee.n) };
      }
      if (c === 'disinter') {
        const i = await resolveInterment(req('interment'), 'completed');
        const licence = req('licence');
        const x = await insert('disinterments', { interment_id: i.id, licence_ref: licence, done_on: opt('on') ? isoDate(req('on')) : today, destination: opt('destination') });
        await log(c, null, x);
        const before = await one('select * from interments where id = $1', [i.id]);
        const row = await update('interments', before, { status: 'removed' });
        await log(c, before, row);
        return { ...x, deceased: i.deceased };
      }
      if (c === 'record-licence') {
        const i = await resolveInterment(req('interment'), 'removed');
        const before = await one('select * from disinterments where interment_id = $1', [i.id]);
        if (!before) throw new Error(`No removal recorded for ${i.deceased}`);
        const row = await update('disinterments', before, { licence_ref: req('licence') });
        await log(c, before, row);
        return { ...row, deceased: i.deceased };
      }
      if (c === 'apply-memorial') {
        const p = await resolvePlot(req('plot'));
        const row = await insert('memorials', { plot_id: p.plot_id, applicant: req('applicant'), description: req('description'), applied_on: opt('on') ? isoDate(req('on')) : today });
        await log(c, null, row);
        return { ...row, plot: p.label };
      }
      if (c === 'decide-memorial') {
        const m = await resolveMemorial(req('memorial'));
        if (m.decision) throw new Error(`Already ${m.decision} on ${m.decided_on || 'an earlier date'}`);
        const row = await update('memorials', m, { decision: oneOf(req('decision'), ['approved', 'declined'], 'decision'), decided_on: opt('on') ? isoDate(req('on')) : today });
        await log(c, m, row);
        return row;
      }
      if (c === 'install-memorial') {
        const m = await resolveMemorial(req('memorial'));
        if (m.decision !== 'approved') throw new Error(`${m.description} has no approved permit. Decide the application first: decide-memorial`);
        if (m.installed_on) throw new Error(`Already installed on ${m.installed_on}`);
        const row = await update('memorials', m, { installed_on: opt('on') ? isoDate(req('on')) : today });
        await log(c, m, row);
        return row;
      }
      if (c === 'inspect-memorial') {
        const m = await resolveMemorial(req('memorial'));
        const condition = oneOf(req('condition'), ['safe', 'leaning', 'unsafe'], 'condition');
        const row = await update('memorials', m, { condition, inspected_on: opt('on') ? isoDate(req('on')) : today, made_safe_on: condition === 'safe' ? m.made_safe_on : null });
        await log(c, m, row);
        return condition === 'unsafe' ? { ...row, next: 'Cordon or lay the memorial down, write to the holder, then record make-safe.' } : row;
      }
      if (c === 'make-safe') {
        const m = await resolveMemorial(req('memorial'));
        if (m.condition !== 'unsafe' && m.condition !== 'leaning') throw new Error(`${m.description} is recorded as ${m.condition}`);
        const on = opt('on') ? isoDate(req('on')) : today;
        const row = await update('memorials', m, { made_safe_on: on, condition: 'safe', inspected_on: on });
        await log(c, m, row);
        return row;
      }
      if (c === 'report-grounds') {
        const s = await resolveSection(req('section'));
        const p = opt('plot') ? await resolvePlot(req('plot')) : null;
        if (p && p.section_id !== s.id) throw new Error(`${p.label} is not in ${s.name}`);
        const category = oneOf(req('category'), ['sunken grave', 'drainage', 'tree', 'mowing', 'path', 'fence', 'water', 'other'], 'category');
        const row = await insert('grounds_jobs', { section_id: s.id, plot_id: p?.plot_id || null, category, summary: req('summary'), reported_on: opt('on') ? isoDate(req('on')) : today });
        await log(c, null, row);
        return row;
      }
      if (c === 'resolve-grounds') {
        const g = await byPrefix('grounds_jobs', req('job'), 'grounds job');
        if (g.resolved_on) throw new Error('Already resolved');
        const row = await update('grounds_jobs', g, { resolved_on: opt('on') ? isoDate(req('on')) : today });
        await log(c, g, row);
        return row;
      }
      if (c === 'charge') {
        const acct = await account();
        const row = await insert('charges', { ...acct, description: req('description'), amount_cents: cents(req('amount')), due_on: opt('due') ? isoDate(req('due'), 'due date') : await dueOn() });
        await log(c, null, row);
        return row;
      }
      if (c === 'pay') {
        const acct = await account();
        const row = await insert('payments', { ...acct, amount_cents: cents(req('amount')), reference: opt('reference'), received_on: opt('on') ? isoDate(req('on')) : today });
        await log(c, null, row);
        return row;
      }
      if (c === 'set') {
        const s = await one('select * from settings where key = $1', [req('key')]);
        if (!s) throw new Error(`No setting "${req('key')}". Run: npm run cem -- settings`);
        if (s.key !== 'currency') posInt(req('value'), s.key);
        const row = await one('update settings set value = $1 where key = $2 returning *', [req('value'), s.key]);
        await log(c, s, row);
        return row;
      }
      if (c === 'import') return importPlotBox();
      throw new Error(`Unhandled command ${c}`);
    }

    // ---------------------------------------------------------------- PlotBox import

    // A PlotBox records report saved as CSV: one row per interment, or per sold plot with no
    // interment yet. Report columns depend on the report, so other headings come in with --map.
    async function importPlotBox() {
      const file = path.resolve(req('file'));
      const rows = parseCsv(readFileSync(file, 'utf8'));
      if (!rows.length) throw new Error('The file has no rows');
      const defaults = {
        record: 'Record ID', cemetery: 'Cemetery', section: 'Section', row: 'Row', plot: 'Plot', plot_type: 'Plot Type', capacity: 'Capacity',
        first: 'Deceased First Name', last: 'Deceased Last Name', born: 'Date of Birth', died: 'Date of Death', age: 'Age',
        interment_date: 'Interment Date', interment_type: 'Interment Type', register_no: 'Register Number',
        holder: 'Rights Holder', holder_email: 'Rights Holder Email', right_purchased: 'Right Purchased', certificate: 'Certificate Number',
      };
      const mapping = opts.map ? JSON.parse(readFileSync(path.resolve(req('map')), 'utf8')) : {};
      for (const [k, v] of Object.entries(mapping)) if (!Object.hasOwn(defaults, k) || typeof v !== 'string' || !v) throw new Error(`Invalid mapping entry: ${k}`);
      const cols = { ...defaults, ...mapping };
      const summary = { cemeteries_added: 0, sections_added: 0, plots_added: 0, holders_added: 0, rights_added: 0, interments_added: 0, bookings_added: 0, unchanged: 0, without_register_no: 0 };
      const seen = new Set();
      for (const [i, r] of rows.entries()) {
        const at = `Row ${i + 2}`;
        const val = (k, required = true) => {
          const v = pick(r, cols[k]).trim();
          if (required && !v) throw new Error(`${at}: missing ${cols[k]}`);
          return v;
        };
        const record = val('record');
        if (seen.has(record)) throw new Error(`${at}: record ${record} appears twice`);
        seen.add(record);

        let cem = await one('select * from cemeteries where lower(name) = lower($1)', [val('cemetery')]);
        if (!cem) {
          const code = val('cemetery').split(/\s+/).map((w) => w[0]).join('').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4) || 'CEM';
          const taken = await one('select count(*)::int as n from cemeteries where code like $1', [`${code}%`]);
          cem = await insert('cemeteries', { name: val('cemetery'), code: taken.n ? `${code}${taken.n + 1}` : code });
          summary.cemeteries_added++;
          await log('import-plotbox', null, cem);
        }
        const typeText = val('plot_type', false).toLowerCase();
        const plotType = /ash|cremat|niche/.test(typeText) ? 'ashes' : 'burial';
        let sec = await one('select * from sections where cemetery_id = $1 and lower(name) = lower($2)', [cem.id, val('section')]);
        if (!sec) {
          const name = val('section');
          const kind = plotType === 'ashes' ? 'ashes' : /lawn/i.test(name) ? 'lawn' : /natural/i.test(name) ? 'natural' : /child|baby|infant/i.test(name) ? 'children' : /rsa|services|veteran/i.test(name) ? 'services' : 'monumental';
          sec = await insert('sections', { cemetery_id: cem.id, name, kind });
          summary.sections_added++;
          await log('import-plotbox', null, sec);
        }
        const rowLabel = val('row', false);
        let plot = await one('select * from plots where section_id = $1 and row_label = $2 and lower(number) = lower($3)', [sec.id, rowLabel, val('plot')]);
        if (!plot) {
          const capText = val('capacity', false);
          plot = await insert('plots', { section_id: sec.id, row_label: rowLabel, number: val('plot'), plot_type: plotType, capacity: capText ? posInt(capText, `${at} capacity`) : 1, source_ref: `plotbox:plot:${cem.id}:${sec.name}:${rowLabel}:${val('plot')}` });
          summary.plots_added++;
          await log('import-plotbox', null, plot);
        }
        const holderName = val('holder', false);
        if (holderName && !(await one("select id from rights where plot_id = $1 and status = 'active'", [plot.id]))) {
          let h = await one('select * from holders where lower(name) = lower($1)', [holderName]);
          if (!h) {
            h = await insert('holders', { name: holderName, email: val('holder_email', false) || null });
            summary.holders_added++;
            await log('import-plotbox', null, h);
          }
          const cert = val('certificate', false);
          if (cert && (await one('select id from rights where lower(certificate_no) = lower($1)', [cert]))) throw new Error(`${at}: certificate ${cert} is already on file for another right`);
          const bought = val('right_purchased', false);
          const right = await insert('rights', {
            plot_id: plot.id, holder_id: h.id, certificate_no: cert || null,
            purchased_on: bought ? isoDate(bought, `${at} right purchased date`) : (val('interment_date', false) ? isoDate(val('interment_date'), `${at} interment date`) : today),
            source_ref: `plotbox:right:${record}`,
          });
          summary.rights_added++;
          await log('import-plotbox', null, right);
        }
        const first = val('first', false);
        const last = val('last', false);
        if (!first && !last) continue; // a sold or reserved plot with nobody in it yet
        const ref = `plotbox:${record}`;
        if (await one('select id from interments where source_ref = $1', [ref])) { summary.unchanged++; continue; }
        const when = isoDate(val('interment_date'), `${at} interment date`);
        const ageText = val('age', false);
        const d = await insert('deceased', {
          name: `${first} ${last}`.trim(), date_of_birth: val('born', false) ? isoDate(val('born'), `${at} date of birth`) : null,
          date_of_death: val('died', false) ? isoDate(val('died'), `${at} date of death`) : null,
          age_years: /^\d{1,3}$/.test(ageText) ? Number(ageText) : null, source_ref: ref,
        });
        await log('import-plotbox', null, d);
        const kind = /ash|cremat/i.test(val('interment_type', false)) || plotType === 'ashes' ? 'ashes' : 'burial';
        const regText = val('register_no', false);
        const past = when <= today;
        const used = Number((await one("select count(*)::int as n from interments where plot_id = $1 and status in ('completed', 'booked')", [plot.id])).n);
        if (used >= plot.capacity) throw new Error(`${at}: ${val('section')} ${rowLabel ? rowLabel + '-' : ''}${val('plot')} would hold more than its capacity of ${plot.capacity}. Set the capacity column or fix the plot.`);
        const row = await insert('interments', {
          plot_id: plot.id, deceased_id: d.id, kind, scheduled_at: `${when} 00:00:00`, status: past ? 'completed' : 'booked',
          completed_on: past ? when : null, register_no: past && /^\d+$/.test(regText) ? Number(regText) : null, source_ref: ref,
        });
        await log('import-plotbox', null, row);
        if (past) { summary.interments_added++; if (!row.register_no) summary.without_register_no++; } else summary.bookings_added++;
      }
      return {
        ...summary,
        notice: 'Rows with an interment date in the past are loaded as completed register entries; future dates load as bookings with no paperwork or consent on file. Memorials, documents, maps and money are not in a records report and are not imported.',
      };
    }
  } finally {
    await db.close();
  }

  // ---------------------------------------------------------------- output

  function print(value) {
    if (opts.json) { console.log(JSON.stringify(value, null, 2)); return; }
    const show = (rows) => {
      if (!rows.length) return '  (none)';
      return textTable(rows, Object.keys(rows[0]).map((k) => ({
        key: k, label: k.replace(/_cents$/, ''), width: 60,
        format: (v) => (v === null || v === undefined ? '' : k.endsWith('_cents') ? `${(Number(v) / 100).toFixed(2)}` : v instanceof Date ? v.toISOString().slice(0, 16).replace('T', ' ') : typeof v === 'object' ? JSON.stringify(v) : v),
      })));
    };
    if (Array.isArray(value)) console.log(show(value));
    else if (value && Object.values(value).every(Array.isArray)) for (const [k, v] of Object.entries(value)) console.log(`\n${k}\n${show(v)}`);
    else console.log(show([value]));
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
