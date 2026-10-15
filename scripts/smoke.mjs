#!/usr/bin/env node
// npm test: a fresh database in a temp folder, migrate twice, seed twice, then every
// command with assertions on what it returns. PASS or a failing assertion.
// Set TEST_DATABASE_URL to an empty Postgres database to run the same checks there.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv } from './lib/csv.mjs';

const dir = mkdtempSync(path.join(tmpdir(), 'cemetery-smoke-'));
process.env.DATA_DIR = path.join(dir, 'db');
process.env.OUTPUT_DIR = dir;
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const env = { ...process.env };
const covered = new Set();
let checks = 0;

function run(script, args = [], ok = true) {
  const r = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', script), ...args], { cwd: REPO_ROOT, env, encoding: 'utf8' });
  assert.equal(r.status, ok ? 0 : 1, `${script} ${args.join(' ')}\n${r.stdout}\n${r.stderr}`);
  checks++;
  return r;
}
function cli(cmd, args = [], ok = true) {
  covered.add(cmd);
  const r = run('cemetery.mjs', [cmd, ...args, ...(cmd === 'help' ? [] : ['--json'])], ok);
  return ok && cmd !== 'help' ? JSON.parse(r.stdout) : r;
}
async function query(sql, params = []) {
  const db = await getDb();
  try { return await db.query(sql, params); } finally { await db.close(); }
}
const actor = '--actor=Tester';
const iso = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const rules = () => cli('compliance');
const has = (rule, subject) => rules().some((c) => c.rule === rule && (!subject || c.subject === subject));

try {
  assert.equal((await query("select tablename from pg_tables where schemaname = 'public'")).length, 0, 'TEST_DATABASE_URL must point at an empty database');
  run('migrate.mjs'); run('migrate.mjs'); run('seed.mjs'); run('seed.mjs');
  assert.equal((await query('select count(*)::int as n from deceased'))[0].n, 10, 'seed runs once');

  // Reads on the demo.
  assert.match(cli('help').stdout, /import plotbox/);
  assert.equal(cli('cemeteries').length, 2);
  assert.equal(cli('sections').length, 4);
  assert.equal(cli('plots').length, 19);
  const schedule = cli('schedule');
  assert.deepEqual(schedule.map((s) => s.deceased), ['Lorna Bell', 'Hemi Tane', 'Arthur Penn']);
  assert.equal(schedule[1].consent, 'needed');
  assert.equal(cli('register').length, 7);
  assert.equal(cli('rights').length, 6);
  assert.deepEqual(cli('lapsing').map((r) => r.holder).sort(), ['Ana Lealaiauloto', 'Peter Grant', 'Ruth Simmons']);
  const cap = cli('capacity').find((c) => c.section === 'Lawn A');
  assert.deepEqual([cap.plots, cap.available, cap.reserved, cap.in_use], [8, 4, 1, 3]);
  assert.equal(cli('memorials').length, 4);
  assert.equal(cli('grounds').length, 2);
  const arrears = cli('arrears');
  assert.equal(arrears.length, 1);
  assert.deepEqual([arrears[0].name, Number(arrears[0].overdue_cents), arrears[0].days_overdue], ['Harbour Funeral Services', 145000, 70]);
  assert.equal(cli('accounts').length, 4);
  assert.equal(cli('directors').length, 3);
  assert.equal(cli('holders').find((h) => h.name === 'Ruth Simmons').plots, 'ELC Lawn A A-4, OTC Block 3 3-14');
  assert.equal(cli('settings').length, 8);
  assert.deepEqual(cli('activity'), []);
  const ruleSet = new Set(rules().map((c) => c.rule));
  for (const r of ['BURIAL_REGISTERED', 'HOLDER_CONSENT', 'RIGHT_LAPSE', 'RIGHT_TERM_ENDED', 'DISINTERMENT_LICENCE', 'PAPERWORK', 'MEMORIAL_UNSAFE', 'MEMORIAL_NO_PERMIT', 'MEMORIAL_PERMIT_WAITING', 'GROUNDS_OPEN']) {
    assert(ruleSet.has(r), `demo shows ${r}`);
  }
  const attention = cli('attention');
  assert.equal(attention['next 7 days'].length, 3);
  assert.equal(attention['rights lapsing'].length, 3);
  assert.equal(attention.arrears.length, 1);
  const weekly = cli('weekly-review');
  assert(weekly['compliance by rule'].length >= 10);
  assert.equal(weekly['memorial permits waiting'].length, 1);
  const plot = cli('plot', ['--plot=OTC Block 3 3-15']);
  assert.equal(plot.interments[0].deceased, 'Ellen Grant');
  assert.equal(plot.memorials[0].condition, 'unsafe');
  assert.equal(cli('plot', ['--plot=Lawn A A-1']).rights[0].holder, 'Margaret Hale');
  cli('plot', ['--plot=1'], false); // ambiguous: lists and fails
  const found = cli('search', ['--name=grant']);
  assert.deepEqual(found.map((f) => f.deceased), ['Ellen Grant']);
  assert.equal(cli('search', ['--name=a', '--died-from=2026-01-01', `--died-to=${iso(0)}`]).length >= 3, true);
  assert.equal(cli('search', ['--name=ward'])[0].note, 'removed');
  const avail = cli('available', ['--cemetery=ELC']);
  assert.equal(avail.length, 6);
  assert.equal(cli('available', ['--section=Ashes Garden', '--type=ashes']).length, 1);
  assert.equal(cli('available', ['--cemetery=Old Town Cemetery']).length, 0, 'a closed cemetery sells nothing');

  // Dry run changes nothing.
  cli('add-holder', ['--name=Preview Person', actor, '--dry-run']);
  assert.equal(cli('activity').length, 0);

  // Selling a right: the section fee is charged, a closed cemetery and a held plot refuse.
  cli('add-holder', ['--name=Joe Example', '--email=joe@example.com', '--address=1 Test Street', actor]);
  const sold = cli('sell-right', ['--plot=Lawn A A-3', '--holder=Joe Example', '--certificate=ELC-0501', actor]);
  assert.equal(Number(sold.price_cents), 380000);
  assert(cli('accounts').some((a) => a.name === 'Joe Example' && Number(a.charged_cents) === 380000));
  cli('sell-right', ['--plot=Lawn A A-3', '--holder=Joe Example', actor], false); // already held
  cli('sell-right', ['--plot=3-17', '--holder=Joe Example', actor], false); // closed cemetery
  cli('sell-right', ['--plot=Lawn A A-5', '--holder=Joe Example', actor], false); // has interments

  // Booking into a held plot needs the holder's consent (s 10(2)); completing needs paperwork.
  cli('add-director', ['--name=Test Funerals', '--email=test@example.com', actor]);
  const at = `${iso(3)}T10:00`;
  cli('book', ['--plot=Lawn A A-3', '--deceased=Mary Example', `--died=${iso(-2)}`, '--director=Test Funerals', `--at=${at}`, actor], false);
  const booked = cli('book', ['--plot=Lawn A A-3', '--deceased=Mary Example', `--died=${iso(-2)}`, `--born=${iso(-365 * 80)}`, '--age=79', '--director=Test Funerals', `--at=${at}`, `--consent=${iso(-1)}`, actor]);
  assert.equal(booked.plot, 'ELC Lawn A A-3');
  assert(cli('accounts').some((a) => a.name === 'Test Funerals' && Number(a.charged_cents) === 145000), 'interment fee raised');
  cli('book', ['--plot=R1-4', '--deceased=No Body', `--died=${iso(-1)}`, `--at=${at}`, '--kind=burial', actor], false); // burial in an ashes plot
  cli('book', ['--plot=N-1', '--deceased=No Body', `--died=${iso(-1)}`, `--at=${at}`, actor], false); // full
  cli('book', ['--plot=3-17', '--deceased=No Body', `--died=${iso(-1)}`, `--at=${at}`, actor], false); // unusable
  cli('book', ['--plot=N-3', '--deceased=No Body', `--died=${iso(-1)}`, '--at=tomorrow', actor], false);
  cli('complete', ['--booking=Mary Example', actor], false); // no paperwork
  cli('paperwork', ['--booking=Mary Example', actor]);
  cli('reschedule', ['--booking=Mary Example', `--at=${iso(4)}T11:30`, actor]);
  assert.equal(cli('schedule').find((s) => s.deceased === 'Mary Example').at, `${iso(4)} 11:30`);
  const conf = cli('draft-confirmation', ['--booking=Mary Example']);
  assert(existsSync(conf.file));
  assert.deepEqual(conf.missing, []);
  const done = cli('complete', ['--booking=Mary Example', actor]);
  assert.equal(done.register_no, 105, 'next number in this cemetery');
  cli('complete', ['--booking=Mary Example', actor], false); // no longer booked

  // The demo's open items, cleared one by one.
  const hemi = cli('draft-confirmation', ['--booking=Hemi']);
  assert.equal(hemi.missing.length, 1);
  cli('complete', ['--booking=Hemi', actor], false); // no consent
  cli('consent', ['--booking=Hemi', `--on=${iso(-1)}`, actor]);
  assert(!has('HOLDER_CONSENT'));
  cli('paperwork', ['--booking=Lorna', actor]);
  assert(!has('PAPERWORK'));
  cli('assign-number', ['--interment=Frank Doyle', actor]);
  assert(!has('BURIAL_REGISTERED'));
  cli('assign-number', ['--interment=Frank Doyle', actor], false);
  cli('record-licence', ['--interment=Sam Ward', '--licence=MOH-2026-0412', actor]);
  assert(!has('DISINTERMENT_LICENCE'));
  cli('disinter', ['--interment=George Hale', actor], false); // no licence
  const moved = cli('disinter', ['--interment=Thomas Reid', '--licence=MOH-2026-0500', '--destination=Example City Cemetery', actor]);
  assert.equal(moved.deceased, 'Thomas Reid');
  assert.equal(cli('search', ['--name=reid'])[0].note, 'removed');
  const cancelled = cli('cancel', ['--booking=Arthur Penn', '--reason=Family chose a different cemetery', actor]);
  assert.equal(cancelled.credited_cents, 35000);
  assert.equal(Number(cli('accounts').find((a) => a.name === 'Kowhai Funeral Home').charged_cents), 35000);

  // Rights: a lapse notice, ending a right only once it has ended, transfer keeps the clock.
  const notice = cli('draft-lapse-notice', ['--right=OTC-1966-031']);
  assert(readFileSync(notice.file, 'utf8').includes('section 10(4)'));
  cli('end-right', ['--right=OTC-1966-031', actor], false); // has not lapsed yet
  assert.equal(cli('end-right', ['--right=Peter Grant', actor]).status, 'lapsed');
  assert.equal(cli('end-right', ['--right=ELC-0450', actor]).status, 'expired');
  assert(!has('RIGHT_TERM_ENDED'));
  const moved2 = cli('transfer-right', ['--right=OTC-1966-031', '--to=Joe Example', actor]);
  assert.equal(moved2.purchased_on, (await query("select purchased_on::text as d from rights where certificate_no = 'OTC-1966-031'"))[0].d);
  assert(has('RIGHT_LAPSE', 'OTC Block 3 3-14'), 'a transfer does not restart s 10(4)');
  cli('transfer-right', ['--right=3-14', '--to=Joe Example', actor], false);
  const surrendered = cli('surrender-right', ['--right=ELC-0478', '--refund=1900', actor]);
  assert.equal(surrendered.status, 'surrendered');
  assert(cli('available', ['--section=Lawn A']).some((p) => p.plot === 'ELC Lawn A A-4'));

  // Memorials: install needs an approved permit; unsafe until made safe.
  const beam = cli('memorials').find((m) => m.plot === 'ELC Lawn A A-5');
  cli('install-memorial', [`--memorial=${beam.id}`, actor], false);
  cli('decide-memorial', [`--memorial=${beam.id}`, '--decision=approved', actor]);
  cli('decide-memorial', [`--memorial=${beam.id}`, '--decision=declined', actor], false);
  cli('install-memorial', ['--memorial=Lawn A A-5', actor]);
  assert(!has('MEMORIAL_PERMIT_WAITING'));
  cli('apply-memorial', ['--plot=Lawn A A-3', '--applicant=Southern Memorials', '--description=Grey granite desk plaque', actor]);
  cli('inspect-memorial', ['--memorial=Lawn A A-1', '--condition=leaning', actor]);
  cli('inspect-memorial', ['--memorial=Lawn A A-1', '--condition=wobbly', actor], false);
  cli('make-safe', ['--memorial=OTC Block 3 3-15', actor]);
  assert(!has('MEMORIAL_UNSAFE'));
  cli('make-safe', ['--memorial=OTC Block 3 3-15', actor], false);

  // Grounds, plots, sections, cemeteries, settings.
  const sunk = cli('grounds').find((g) => g.category === 'sunken grave');
  cli('resolve-grounds', [`--job=${sunk.id}`, actor]);
  cli('resolve-grounds', [`--job=${sunk.id}`, actor], false);
  assert(!has('GROUNDS_OPEN'));
  cli('report-grounds', ['--section=Natural', '--plot=N-3', '--category=tree', '--summary=Branch down over N-3', actor]);
  cli('report-grounds', ['--section=Natural', '--plot=A-7', '--category=tree', '--summary=x', actor], false);
  cli('add-cemetery', ['--name=Hilltop Cemetery', '--code=htc', actor]);
  cli('add-section', ['--cemetery=HTC', '--name=Lawn 1', '--kind=lawn', '--right-fee=2900', '--interment-fee=1300', actor]);
  cli('add-section', ['--cemetery=HTC', '--name=Lawn 2', '--kind=garden', actor], false);
  assert.equal(cli('add-plots', ['--section=HTC Lawn 1', '--row=A', '--from=1', '--to=20', '--capacity=2', actor]).added, 20);
  cli('add-plots', ['--section=HTC Lawn 1', '--row=A', '--from=20', '--to=21', actor], false);
  cli('set-section', ['--section=HTC Lawn 1', '--right-fee=3100', actor]);
  cli('set-plot', ['--plot=HTC Lawn 1 A-20', '--unusable=Drain line', actor]);
  cli('set-plot', ['--plot=HTC Lawn 1 A-20', '--usable', actor]);
  cli('set-plot', ['--plot=Lawn A A-1', '--unusable=x', actor], false); // in use
  cli('set-plot', ['--plot=Lawn A A-1', '--capacity=3', actor]);
  cli('set', ['--key=right_lapse_notice_days', '--value=730', actor]);
  cli('set', ['--key=right_lapse_notice_days', '--value=soon', actor], false);
  cli('set', ['--key=nope', '--value=1', actor], false);

  // Money: a payment clears the overdue account.
  cli('charge', ['--holder=Joe Example', '--description=Memorial permit fee', '--amount=120', actor]);
  cli('charge', ['--description=No account', '--amount=1', actor], false);
  cli('charge', ['--director=Harbour', '--holder=Joe', '--description=x', '--amount=1', actor], false);
  cli('pay', ['--director=Harbour', '--amount=1450', '--reference=HFS-881', actor]);
  assert(!cli('arrears').some((a) => a.name === 'Harbour Funeral Services'));
  cli('pay', ['--director=Harbour', '--amount=12.345', actor], false);

  // PlotBox import: preview, load, re-run unchanged, DD/MM/YYYY dates, a mapping file.
  const imp = ['plotbox', '--file=fixtures/plotbox/records.csv', actor];
  const preview = cli('import', [...imp, '--dry-run']);
  assert.equal(preview.interments_added, 3);
  assert.equal((await query("select count(*)::int as n from cemeteries where name = 'Hillside Cemetery'"))[0].n, 0);
  const loaded = cli('import', imp);
  assert.deepEqual([loaded.cemeteries_added, loaded.sections_added, loaded.plots_added, loaded.holders_added, loaded.rights_added, loaded.interments_added, loaded.without_register_no],
    [1, 2, 3, 2, 2, 3, 1]);
  assert.equal(cli('search', ['--name=Person One'])[0].date_of_death, '2019-05-02');
  assert.equal(cli('import', imp).unchanged, 3);
  const crlf = path.join(dir, 'windows.csv');
  writeFileSync(crlf, readFileSync(path.join(REPO_ROOT, 'fixtures/plotbox/records.csv'), 'utf8').replace(/\r?\n/g, '\r\n'));
  assert.equal(cli('import', ['plotbox', `--file=${crlf}`, actor]).unchanged, 3);
  const src = readFileSync(path.join(REPO_ROOT, 'fixtures/plotbox/records.csv'), 'utf8').replace(/\r\n/g, '\n');
  const bad = path.join(dir, 'bad.csv');
  writeFileSync(bad, src.replace('PB-1002', 'PB-1001'));
  cli('import', ['plotbox', `--file=${bad}`, actor], false); // duplicate record
  writeFileSync(bad, src.replace('PB-1001', 'PB-2001').replace('PB-1002', 'PB-2002').replace('PB-1003', 'PB-2003').replace('08/05/2019', '31/02/2019'));
  cli('import', ['plotbox', `--file=${bad}`, actor], false); // impossible date
  writeFileSync(bad, src.replace('PB-1001', 'PB-3001').replace('PB-1002', 'PB-3002'));
  cli('import', ['plotbox', `--file=${bad}`, actor], false); // a third interment in a double plot
  const renamed = path.join(dir, 'renamed.csv');
  writeFileSync(renamed, src.replace('Record ID', 'Interment Ref').replace(/PB-100/g, 'PB-400').replace(/Hillside Cemetery/g, 'Riverside Cemetery').replace(/HC-/g, 'RC-'));
  const map = path.join(dir, 'map.json');
  writeFileSync(map, JSON.stringify({ record: 'Interment Ref' }));
  cli('import', ['plotbox', `--file=${renamed}`, actor], false); // without the map
  writeFileSync(bad, src.replace(/PB-100/g, 'PB-500').replace(/Hillside Cemetery/g, 'Lakeside Cemetery'));
  cli('import', ['plotbox', `--file=${bad}`, actor], false); // certificate numbers already on file
  assert.equal(cli('import', ['plotbox', `--file=${renamed}`, `--map=${map}`, actor]).interments_added, 3);
  writeFileSync(map, JSON.stringify({ nonsense: 'x' }));
  cli('import', ['plotbox', `--file=${renamed}`, `--map=${map}`, actor], false);
  cli('import', ['--file=x.csv', actor], false);

  // Output: views, documents, export, and the audit trail cannot be edited.
  run('view.mjs');
  assert.equal(readdirSync(path.join(dir, 'views')).length, 3);
  const docs = run('docs.mjs');
  assert.match(docs.stdout, /document\(s\) rendered/);
  assert(readdirSync(path.join(dir, 'docs-out', 'burial-register')).length >= 4);
  assert(readFileSync(path.join(dir, 'docs-out', 'burial-register', readdirSync(path.join(dir, 'docs-out', 'burial-register')).find((f) => f.startsWith('example-lawn'))), 'utf8').includes('Mary Example'));
  const archive = path.join(dir, 'archive.json');
  const exported = cli('export', [`--out=${archive}`]);
  assert(exported.counts.interments >= 15);
  cli('export', [`--out=${archive}`], false); // never overwrites
  assert(cli('activity').length > 60);
  await assert.rejects(query("update events set actor = 'X'"), /audit trail cannot be changed/);
  cli('schedule', ['--surprise'], false);
  cli('add-holder', ['--name=No actor'], false);
  cli('not-a-command', [], false);
  assert.equal(parseCsv('A,B\r\n"two, words","line\nnext"')[0].B, 'line\nnext');

  const every = run('cemetery.mjs', ['help']).stdout.split('\n').filter((l) => l.startsWith('  ')).map((l) => l.trim().split(' ')[0]);
  const missed = every.filter((c) => !covered.has(c));
  assert.deepEqual(missed, [], `commands not exercised: ${missed.join(', ')}`);
  console.log(`PASS: ${checks} command runs, ${covered.size} CLI commands covered, burial register, rights of burial, consent, paperwork, memorial and import rules held (${env.DATABASE_URL ? 'PostgreSQL' : 'PGlite'}).`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
