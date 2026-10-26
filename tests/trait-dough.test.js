// Runs Code.gs against a pretend Google.
//   node tests/trait-dough.test.js
const assert = require('assert');
const { loadApp, renderTemplate } = require('./fake-google');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('  FAIL ' + name + '\n       ' + (e.stack || e)); process.exitCode = 1; }
}

function fresh() {
  const t = loadApp();
  t.ctx.setup();
  t.app.resetSettings();
  return t;
}
const tab = (t, name) => t.book.getSheetByName(name);
const good = (over) => JSON.stringify(Object.assign({
  name: 'Zach Cahill', id: '8016540', grade: '7', team: 'M', squad: 'Black',
  bills: [{ trait: 'Resilience & Grit', givenBy: 'Leister', did: 'Kept trying on the hard problem set' }],
}, over || {}));
const errOf = fn => { try { fn(); } catch (e) { return e.message; } return ''; };
const login = t => t.ctx.login('togetherweclimb');

console.log('Trait Dough');

test('setup makes every tab with headers and seeds settings, traits, staff, info', () => {
  const t = fresh();
  ['Submissions', 'Winners', 'Info', 'Settings', 'Traits', 'Staff'].forEach(n => assert.ok(tab(t, n), n));
  assert.deepStrictEqual(tab(t, 'Submissions').rows[0], [...t.app.SUB_HEADERS_]);
  assert.deepStrictEqual(tab(t, 'Winners').rows[0].slice(0, 4), ['STUDENT', 'TEACHER', 'SQUAD', 'Grade']);
  assert.strictEqual(tab(t, 'Traits').rows.length, 10);
  assert.ok(tab(t, 'Staff').rows.length > 30);
  assert.ok(tab(t, 'Info').rows.some(r => r[0] === 'How it works'));
  assert.ok(String(tab(t, 'Info').rows[1][3]).includes('HYPERLINK'), 'page links written');
});

test('setup is safe to run twice (no duplicate settings or seed rows)', () => {
  const t = fresh();
  const n = tab(t, 'Settings').rows.length;
  t.ctx.setup();
  assert.strictEqual(tab(t, 'Settings').rows.length, n);
  assert.strictEqual(tab(t, 'Traits').rows.length, 10);
});

test('public config has teams M O U N T S, squads, 9 traits, no student data', () => {
  const t = fresh();
  const c = JSON.parse(t.ctx.getPublicConfig());
  assert.deepStrictEqual(c.teams, ['M', 'O', 'U', 'N', 'T', 'S']);
  assert.deepStrictEqual(c.squads, ['Gray', 'Gold', 'Purple', 'Black']);
  assert.strictEqual(c.traits.length, 9);
  assert.strictEqual(c.idDigits, 7);
  assert.ok(!('recent' in c));
  assert.ok(!t.ctx.publicConfigJs_().includes('<'), 'safe inside <script>');
});

test('a stack of bills writes one row per bill with the same turn-in ID', () => {
  const t = fresh();
  const res = JSON.parse(t.ctx.submitDough(good({ bills: [
    { trait: 'Resilience & Grit', givenBy: 'Leister', did: 'a' },
    { trait: 'Communication & Empathy', givenBy: 'Rios', did: '' },
    { trait: 'Creativity & Innovation', givenBy: 'Trout', did: 'c' },
  ] })));
  assert.strictEqual(res.count, 3);
  const rows = t.ctx.readRows_('Submissions');
  assert.strictEqual(rows.length, 3);
  assert.ok(rows.every(r => r['Turn-In ID'] === res.turnInId && r['Status'] === 'Entered' && r['800#'] === '8016540' && r['Team'] === 'M'));
  assert.deepStrictEqual([...rows.map(r => r['Pillar'])], ['Present', 'Personable', 'Productive']);
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(rows[0]['Week Of']), 'week of reads back as a date: ' + rows[0]['Week Of']);
  assert.strictEqual(rows[1]['What They Did'], '', 'notes are optional');
});

test('turn-in checks name, 800#, grade, team, squad, trait, giver', () => {
  const t = fresh();
  assert.match(errOf(() => t.ctx.submitDough(good({ name: 'Zach' }))), /first and last/);
  assert.match(errOf(() => t.ctx.submitDough(good({ id: '12345' }))), /800 number/);
  assert.match(errOf(() => t.ctx.submitDough(good({ id: '9016540' }))), /800 number/);
  assert.match(errOf(() => t.ctx.submitDough(good({ grade: '6' }))), /grade/);
  assert.match(errOf(() => t.ctx.submitDough(good({ team: 'X' }))), /team/);
  assert.match(errOf(() => t.ctx.submitDough(good({ squad: 'Red' }))), /squad/);
  assert.match(errOf(() => t.ctx.submitDough(good({ bills: [] }))), /at least one/);
  assert.match(errOf(() => t.ctx.submitDough(good({ bills: [{ trait: 'Nope', givenBy: 'X' }] }))), /trait/);
  assert.match(errOf(() => t.ctx.submitDough(good({ bills: [{ trait: 'Resilience & Grit', givenBy: ' ' }] }))), /who gave/);
  assert.strictEqual(t.ctx.readRows_('Submissions').length, 0, 'nothing half-written');
});

test('typed text cannot become a Sheet formula; lower-case team/squad accepted', () => {
  const t = fresh();
  t.ctx.submitDough(good({ name: '=Evil Kid', team: 'o', squad: 'gold', bills: [{ trait: 'Resilience & Grit', givenBy: '+Rios', did: '=IMPORTXML("x")' }] }));
  const r = t.ctx.readRows_('Submissions')[0];
  assert.strictEqual(r['Student Name'], "'=Evil Kid");
  assert.strictEqual(r['Given By'], "'+Rios");
  assert.ok(r['What They Did'].startsWith("'="));
  assert.strictEqual(r['Team'], 'O');
  assert.strictEqual(r['Squad'], 'Gold');
});

test('dashboard needs the password; default works, wrong does not', () => {
  const t = fresh();
  assert.match(errOf(() => t.ctx.getDashboard('')), /SESSION_EXPIRED/);
  assert.strictEqual(t.ctx.login('nope'), '');
  const tok = login(t);
  assert.ok(tok);
  const d = JSON.parse(t.ctx.getDashboard(tok));
  assert.deepStrictEqual(d.recent, []);
  assert.strictEqual(d.clashOn, true);
});

test('a changed password replaces the default', () => {
  const t = fresh();
  const salt = 'abc';
  t.props.set('TD_PW_SALT', salt);
  t.props.set('TD_PW_HASH', t.ctx.hashPw_('newpass1', salt));
  assert.strictEqual(t.ctx.login('togetherweclimb'), '');
  assert.ok(t.ctx.login('newpass1'));
});

test('six wrong tries locks that person out', () => {
  const t = fresh();
  for (let i = 0; i < 6; i++) t.ctx.login('bad');
  assert.match(errOf(() => t.ctx.login('togetherweclimb')), /Too many/);
});

test('recent submissions come back newest first', () => {
  const t = fresh();
  t.ctx.submitDough(good({ name: 'First Kid' }));
  t.ctx.submitDough(good({ name: 'Second Kid' }));
  const d = JSON.parse(t.ctx.getDashboard(login(t)));
  assert.deepStrictEqual(d.recent.map(r => r.name), ['Second Kid', 'First Kid']);
  assert.strictEqual(d.totalBills, 2);
});

test('award: marks winner, logs Winners row, sends Clash points (Gray → GREY)', () => {
  const t = fresh();
  t.ctx.submitDough(good({ squad: 'Gray' }));
  const tok = login(t);
  const bill = JSON.parse(t.ctx.getDashboard(tok)).recent[0];
  const res = JSON.parse(t.ctx.awardBill(tok, bill.billId, '5', true));
  assert.match(res.clash, /^Sent \+5 GREY/);
  const sub = t.ctx.readRows_('Submissions')[0];
  assert.strictEqual(sub['Status'], 'Winner');
  assert.strictEqual(sub['Awarded By'], 'staff@easdpa.org');
  const w = t.ctx.readRows_('Winners')[0];
  assert.strictEqual(w['STUDENT'], 'Zach Cahill');
  assert.strictEqual(w['TEACHER'], 'Leister');
  assert.strictEqual(w['SQUAD'], 'Gray');
  const ev = t.events.rows[1];
  assert.strictEqual(ev[2], 'trait_dough');
  assert.deepStrictEqual(ev.slice(6), ['', '', 5, '']);
  assert.match(errOf(() => t.ctx.awardBill(tok, bill.billId, 5, true)), /already awarded/);
});

test('award with no points, or Clash unticked, sends nothing to Clash', () => {
  const t = fresh();
  t.ctx.submitDough(good({ bills: [{ trait: 'Resilience & Grit', givenBy: 'A' }, { trait: 'Resilience & Grit', givenBy: 'B' }] }));
  const tok = login(t);
  const [b1, b2] = JSON.parse(t.ctx.getDashboard(tok)).recent;
  assert.strictEqual(JSON.parse(t.ctx.awardBill(tok, b1.billId, '', true)).clash, '');
  assert.strictEqual(JSON.parse(t.ctx.awardBill(tok, b2.billId, 3, false)).clash, 'Not sent');
  assert.strictEqual(t.events.rows.length, 1);
});

test('a broken Clash link still records the winner, with the reason', () => {
  const t = fresh();
  const s = tab(t, 'Settings');
  s.rows.find(r => r[0] === 'CLASH_SHEET_ID')[1] = 'MISSING';
  t.app.resetSettings();
  t.ctx.submitDough(good());
  const tok = login(t);
  const bill = JSON.parse(t.ctx.getDashboard(tok)).recent[0];
  const res = JSON.parse(t.ctx.awardBill(tok, bill.billId, 4, true));
  assert.match(res.clash, /^NOT SENT/);
  assert.strictEqual(t.ctx.readRows_('Winners').length, 1);
});

test('undo puts the bill back and removes the Winners row', () => {
  const t = fresh();
  t.ctx.submitDough(good());
  const tok = login(t);
  const bill = JSON.parse(t.ctx.getDashboard(tok)).recent[0];
  t.ctx.awardBill(tok, bill.billId, 2, true);
  const res = JSON.parse(t.ctx.unawardBill(tok, bill.billId));
  assert.strictEqual(res.clashWasSent, true);
  assert.strictEqual(t.ctx.readRows_('Submissions')[0]['Status'], 'Entered');
  assert.strictEqual(t.ctx.readRows_('Winners').length, 0);
});

test('draw: picks from that week, skips awarded bills and this week\'s winners', () => {
  const t = fresh();
  t.ctx.submitDough(good({ name: 'Won Already', id: '8011111', bills: [{ trait: 'Resilience & Grit', givenBy: 'A' }, { trait: 'Resilience & Grit', givenBy: 'B' }] }));
  t.ctx.submitDough(good({ name: 'Still In', id: '8022222' }));
  const tok = login(t);
  const d = JSON.parse(t.ctx.getDashboard(tok));
  const won = d.recent.find(r => r.name === 'Won Already');
  t.ctx.awardBill(tok, won.billId, 0, false);
  for (let i = 0; i < 20; i++) {
    const res = JSON.parse(t.ctx.drawWinner(tok, d.thisWeek));
    assert.strictEqual(res.bill.name, 'Still In');
    assert.strictEqual(res.entries, 1);
  }
  assert.strictEqual(JSON.parse(t.ctx.drawWinner(tok, '2001-01-01')).empty, true);
});

test('CSV export quotes commas/quotes and neutralizes formulas', () => {
  const t = fresh();
  t.ctx.submitDough(good({ bills: [{ trait: 'Honesty, Integrity, & Responsibility', givenBy: 'Rios', did: 'Said "thanks", then helped' }] }));
  const csv = t.ctx.exportCsv(login(t), 'submissions');
  assert.ok(csv.startsWith('Bill ID,Turn-In ID,Timestamp'));
  assert.ok(csv.includes('"Honesty, Integrity, & Responsibility"'));
  assert.ok(csv.includes('"Said ""thanks"", then helped"'));
  assert.strictEqual(t.ctx.toCsv_([['=1+1', '-5', 'ok']]), "'=1+1,'-5,ok");
  assert.match(errOf(() => t.ctx.exportCsv('', 'winners')), /SESSION_EXPIRED/);
});

test('per-bill points (off by default) send one Clash row per turn-in when set', () => {
  const t = fresh();
  t.ctx.submitDough(good());
  assert.strictEqual(t.events.rows.length, 1);
  tab(t, 'Settings').rows.find(r => r[0] === 'POINTS_PER_BILL')[1] = '1';
  t.app.resetSettings();
  t.ctx.submitDough(good({ bills: [{ trait: 'Resilience & Grit', givenBy: 'A' }, { trait: 'Resilience & Grit', givenBy: 'B' }] }));
  assert.strictEqual(t.events.rows.length, 2);
  assert.strictEqual(t.events.rows[1][6], 2, 'BLACK +2');
});

test('weekOf_ buckets every day to that Monday', () => {
  const t = fresh();
  assert.strictEqual(t.ctx.weekOf_(new Date('2026-10-26T09:00:00')), '2026-10-26');
  assert.strictEqual(t.ctx.weekOf_(new Date('2026-10-30T15:00:00')), '2026-10-26');
  assert.strictEqual(t.ctx.weekOf_(new Date('2026-11-01T10:00:00')), '2026-10-26');
});

test('doGet routes ?view=admin / ?view=info / default, and pages render', () => {
  const t = fresh();
  ['Kiosk', 'Admin', 'Info'].forEach(f => {
    const html = renderTemplate(t.ctx, f, { baseUrl: 'https://x/exec' });
    assert.ok(!/<\?/.test(html), f + ' has no leftover scriptlets');
    assert.ok(html.includes('window.TD_LOGO'), f + ' includes the logo');
  });
  const kiosk = renderTemplate(t.ctx, 'Kiosk', { baseUrl: '' });
  assert.ok(!/type="password"/i.test(kiosk), 'turn-in page has no password box');
  assert.ok(!/scan/i.test(kiosk), 'turn-in page has no scan');
  assert.ok(!/optional/i.test(kiosk), 'notes are not labelled optional');
  assert.ok(!/supabase/i.test(kiosk + renderTemplate(t.ctx, 'Admin', { baseUrl: '' })), 'no Supabase left');
});

console.log(passed + ' passed' + (process.exitCode ? ', some FAILED' : ''));
