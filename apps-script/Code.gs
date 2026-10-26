/**
 * Trait Dough — Sheet-run Apps Script web app (Ephrata Middle School).
 *
 * One web app, three pages:
 *   <web app URL>              Turn-in page for the guidance office. Students enter their own
 *                              dough when they drop it off: name, 800#, grade, team, squad, and
 *                              one card per bill (trait, who gave it, what they did).
 *   <web app URL>?view=admin   Staff dashboard (password): recent submissions, weekly drawing,
 *                              award winners (optionally sends squad points to Clash of
 *                              Classes), winners list, data breakdown, CSV downloads.
 *   <web app URL>?view=info    How Trait Dough works, read from the Info tab.
 *
 * Everything is editable in the Sheet: Settings, Traits, Staff (names offered on the turn-in
 * page), Info (the info page), Submissions (one row per bill) and Winners.
 *
 * Deploy: Execute as Me, Who has access: Anyone within EASD. See README.md.
 */

const TABS_ = {
  SETTINGS: 'Settings', SUBS: 'Submissions', WINNERS: 'Winners',
  TRAITS: 'Traits', STAFF: 'Staff', INFO: 'Info',
};

const SUB_HEADERS_ = ['Bill ID', 'Turn-In ID', 'Timestamp', 'Week Of', 'Student Name', '800#', 'Grade', 'Team',
  'Squad', 'Trait', 'Pillar', 'Given By', 'What They Did', 'Status', 'Awarded At', 'Awarded By', 'Points', 'Clash'];
// First four columns match the old "Trait Dough Winners" log so rows can be pasted across.
const WIN_HEADERS_ = ['STUDENT', 'TEACHER', 'SQUAD', 'Grade', '800#', 'Team', 'Trait', 'Week Of', 'Awarded At',
  'Points', 'Clash', 'Awarded By', 'Bill ID'];

const STATUS_ = { ENTERED: 'Entered', WINNER: 'Winner' };
const TZ_ = 'America/New_York';
const DEFAULT_PASSWORD_ = 'togetherweclimb';
const SESSION_HOURS_ = 8;
const MAX_BILLS_ = 60;

const DEFAULT_SETTINGS_ = [
  ['APP_TITLE', 'Trait Dough', 'Shown at the top of every page.'],
  ['SCHOOL_NAME', 'Ephrata Middle School', ''],
  ['GRADES', '7,8', 'Comma list.'],
  ['TEAMS', 'M,O,U,N,T,S', 'Comma list. Shown as buttons on the turn-in page.'],
  ['SQUADS', 'Gray,Gold,Purple,Black', 'Comma list, in button order.'],
  ['SQUAD_COLORS', 'Gray=#7a7a72,Gold=#e0b100,Purple=#5b2a86,Black=#1f1f1f', 'Name=hex pairs.'],
  ['ID_DIGITS', '7', 'How many digits an 800# has. Blank = any length.'],
  ['ID_STARTS_WITH', '80', 'What every 800# starts with. Blank = no check.'],
  ['CONFIRM_MESSAGE', 'You\'re entered in this week\'s drawing. Winners are announced on the morning announcements.', 'Shown after a student submits.'],
  ['KIOSK_RESET_SECONDS', '20', 'The turn-in page clears itself this many seconds after a submission.'],
  ['DRAW_SKIP_PAST_WINNERS', 'ON', 'ON = the random draw skips students who already won that week.'],
  ['DEFAULT_WIN_POINTS', '', 'Points box starts with this when awarding. Blank = type the wheel result each time.'],
  ['CLASH_SHEET_ID', '1wF01Limr7uO36DRGC6qh3XfYA7dBdXEfGRWuasmEf0w', 'Clash of Classes Points spreadsheet. Blank = never send points.'],
  ['SEND_TO_CLASH', 'ON', 'ON = awarding a winner with points adds them to the Clash "events" tab.'],
  ['POINTS_PER_BILL', '0', 'Squad points sent to Clash for every bill turned in (0 = none; points come from the drawing).'],
  ['RECENT_LIMIT', '400', 'How many recent bills the dashboard loads.'],
  ['GUIDELINES_URL', 'https://docs.google.com/document/d/1t8eQgDTziGePVYx0xyZWiEc0yTdQAjXj3ZYe6GAwyrQ/edit', 'Linked on the info page.'],
  ['TEMPLATE_URL', 'https://docs.google.com/presentation/d/1whoE9nv_eduvemqJMoEqSP77mNHk8deQMLAIIDfNjuQ/edit', 'Printable Trait Dough (digital copy). Linked on the info page.'],
  ['PAST_WINNERS_URL', 'https://docs.google.com/spreadsheets/d/1W5o7D6OGY2saOMMqACsZoKUcf3SWhFWwY4Z7lij-0_Y/edit', 'Old winners log. Linked on the dashboard.'],
  ['LOGO_URL', '', 'Optional image URL. Blank = the built-in Clash of Classes shield.'],
];

const DEFAULT_TRAITS_ = [
  ['Resilience & Grit', 'Present'],
  ['Continual Learning & Growth Mindset', 'Present'],
  ['Healthy Living, Wellness, & Self-Awareness', 'Present'],
  ['Honesty, Integrity, & Responsibility', 'Personable'],
  ['Collaboration & Teamwork', 'Personable'],
  ['Communication & Empathy', 'Personable'],
  ['Adaptability & Flexibility', 'Productive'],
  ['Creativity & Innovation', 'Productive'],
  ['Critical Thinking & Problem Solving', 'Productive'],
];

// Last names from the 2025-26 and 2026-27 winners logs, so the "Who gave it" box has suggestions on day one.
const DEFAULT_STAFF_ = ['Apgar', 'Bradley', 'Brosig', 'Collett', 'DeTore', 'Edmiston', 'Erickson', 'Fassnacht',
  'Groome-Rex', 'Haupt', 'Hooper', 'Horner', 'Hungerford', 'Jean', 'Jones', 'Lebo', 'Leister', 'Lugar', 'Martin',
  'McCabe', 'Miller', 'Milligan', 'Myers', 'Reed', 'Reynolds', 'Rex', 'Rigg', 'Rios', 'Schlinkman', 'Shuman',
  'Sushinski', 'Tiesi', 'Troop', 'Trout', 'Young', 'Bus Driver'];

const DEFAULT_INFO_ = [
  ['What it is', 'A schoolwide token economy that highlights individual students whose actions show the Life Ready Graduate Traits in action.'],
  ['Ways to earn', '- In Action (individual)\n- Clash of Classes Competition (homeroom or squad)\n- Mountaineer Pride (homeroom or squad)'],
  ['How it works', '- Staff hand out physical Trait Dough to students who show any of the LRG traits, and share the reason (written or out loud).\n- Right away, circle the trait and write or sign your name on the back.\n- Students can collect, save, or turn in their dough at any point, but only at a set time: lunch, PASS, or the beginning or end of the day. Not whenever they please.\n- In the office, the student enters their dough on the turn-in page. One bill or a big stack; there is no limit.\n- Every bill is one entry in the weekly drawing. Winners spin the wheel to earn points for their squad and get a coin for the Mountaineer Trading Post.\n- Winners are announced on the morning announcements.'],
  ['Purposeful', 'Each adult may give as little or as much Trait Dough each day.'],
  ['Sustainable', 'Printed templates are in the faculty work room. The digital copy is linked below.'],
  ['Equitable', 'Logging which trait, who gives, and who receives keeps the distribution of traits, students, and teachers fair. The dashboard\'s Data view shows this.'],
  ['Manageable', 'Make it your own. Don\'t stress over how much or when you give Trait Dough. Look for authentic moments.'],
  ['Examples', '- A student proactively sends a Schoology message to get missed work.\n- A student invites a classmate to join them at the lunch table.\n- A student helps someone pick up their books in the hallway.\n- A group of students communicates well during a group activity.'],
];

// ── MENU + SETUP ─────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Trait Dough')
    .addItem('Open turn-in page', 'menuOpenKiosk')
    .addItem('Open staff dashboard', 'menuOpenAdmin')
    .addItem('Open info page', 'menuOpenInfo')
    .addSeparator()
    .addItem('Set up / repair tabs', 'setup')
    .addItem('Change dashboard password…', 'changePassword')
    .addItem('Check Clash of Classes connection', 'checkClash')
    .addToUi();
}

function setup() {
  const book = ss_();
  const subs = ensureTab_(TABS_.SUBS, SUB_HEADERS_);
  subs.getRange('C:C').setNumberFormat('yyyy-mm-dd h:mm am/pm');
  subs.getRange('O:O').setNumberFormat('yyyy-mm-dd h:mm am/pm');
  subs.getRange('D:D').setNumberFormat('yyyy-mm-dd');
  subs.getRange('F:F').setNumberFormat('@');
  const win = ensureTab_(TABS_.WINNERS, WIN_HEADERS_);
  win.getRange('E:E').setNumberFormat('@');
  win.getRange('H:H').setNumberFormat('yyyy-mm-dd');
  win.getRange('I:I').setNumberFormat('yyyy-mm-dd h:mm am/pm');

  const settings = ensureTab_(TABS_.SETTINGS, ['Key', 'Value', 'Notes']);
  const have = {};
  readRows_(TABS_.SETTINGS).forEach(function(r) { have[r['Key']] = true; });
  DEFAULT_SETTINGS_.forEach(function(s) { if (!have[s[0]]) settings.appendRow(s); });

  const traits = ensureTab_(TABS_.TRAITS, ['Trait', 'Pillar', 'Active']);
  if (traits.getLastRow() < 2) {
    traits.getRange(2, 1, DEFAULT_TRAITS_.length, 3).setValues(DEFAULT_TRAITS_.map(function(t) { return [t[0], t[1], true]; }));
    traits.getRange(2, 3, DEFAULT_TRAITS_.length, 1).insertCheckboxes();
  }
  const staff = ensureTab_(TABS_.STAFF, ['Name', 'Active']);
  if (staff.getLastRow() < 2) {
    staff.getRange(2, 1, DEFAULT_STAFF_.length, 2).setValues(DEFAULT_STAFF_.map(function(n) { return [n, true]; }));
    staff.getRange(2, 2, DEFAULT_STAFF_.length, 1).insertCheckboxes();
  }
  const info = ensureTab_(TABS_.INFO, ['Section', 'Content']);
  if (info.getLastRow() < 2) {
    info.getRange(2, 1, DEFAULT_INFO_.length, 2).setValues(DEFAULT_INFO_);
    info.getRange(2, 2, DEFAULT_INFO_.length, 1).setWrap(true);
    info.setColumnWidth(1, 160);
    info.setColumnWidth(2, 640);
  }

  // Tab order: what people look at most first.
  [TABS_.SUBS, TABS_.WINNERS, TABS_.INFO, TABS_.SETTINGS, TABS_.TRAITS, TABS_.STAFF].forEach(function(name, i) {
    const sh = book.getSheetByName(name);
    book.setActiveSheet(sh);
    book.moveActiveSheet(i + 1);
  });
  const blank = book.getSheetByName('Sheet1');
  if (blank && blank.getLastRow() === 0 && book.getSheets().length > 1) book.deleteSheet(blank);
  writeLinks_();
  try { SpreadsheetApp.getUi().alert('Trait Dough tabs are ready. Next: Deploy › New deployment (see README).'); } catch (e) { /* run from editor */ }
}

function ensureTab_(name, headers) {
  const book = ss_();
  let sh = book.getSheetByName(name);
  if (!sh) sh = book.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  } else {
    // Add any header that's missing (keeps hand-added columns).
    const cur = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getDisplayValues()[0];
    headers.forEach(function(h) {
      if (cur.indexOf(h) === -1) { sh.getRange(1, cur.length + 1).setValue(h).setFontWeight('bold'); cur.push(h); }
    });
  }
  return sh;
}

/** Puts clickable links to the three pages at the top of the Info tab's notes (once deployed). */
function writeLinks_() {
  const url = webAppUrl_();
  if (!url) return;
  const info = ss_().getSheetByName(TABS_.INFO);
  if (!info) return;
  info.getRange(1, 4, 4, 1).setValues([
    ['Pages'],
    ['=HYPERLINK("' + url + '","Turn-in page")'],
    ['=HYPERLINK("' + url + '?view=admin","Staff dashboard")'],
    ['=HYPERLINK("' + url + '?view=info","Info page")'],
  ]);
  info.getRange(1, 4).setFontWeight('bold');
}

function webAppUrl_() {
  try { return ScriptApp.getService().getUrl() || ''; } catch (e) { return ''; }
}

function openUrl_(suffix, label) {
  const url = webAppUrl_();
  const ui = SpreadsheetApp.getUi();
  if (!url) { ui.alert('Deploy the web app first (Deploy › New deployment), then try again.'); return; }
  writeLinks_();
  const html = HtmlService.createHtmlOutput('<p style="font-family:sans-serif"><a href="' + url + suffix +
    '" target="_blank" onclick="google.script.host.close()">Open the ' + label + '</a></p>').setWidth(320).setHeight(80);
  ui.showModalDialog(html, 'Trait Dough');
}
function menuOpenKiosk() { openUrl_('', 'turn-in page'); }
function menuOpenAdmin() { openUrl_('?view=admin', 'staff dashboard'); }
function menuOpenInfo() { openUrl_('?view=info', 'info page'); }

// ── WEB APP ──────────────────────────────────────────────────────────

function doGet(e) {
  const view = String((e && e.parameter && e.parameter.view) || '').toLowerCase();
  const file = view === 'admin' ? 'Admin' : view === 'info' ? 'Info' : 'Kiosk';
  const t = HtmlService.createTemplateFromFile(file);
  t.baseUrl = webAppUrl_();
  const title = getSetting_('APP_TITLE') || 'Trait Dough';
  return t.evaluate()
    .setTitle(file === 'Admin' ? title + ' · Staff' : file === 'Info' ? title + ' · How it works' : title)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/** getPublicConfig() made safe to drop inside a <script> tag by the page templates. */
function publicConfigJs_() {
  return getPublicConfig().replace(/</g, '\\u003c');
}

/** Everything the turn-in and info pages need. No student data. */
function getPublicConfig() {
  const s = getSettings_();
  return JSON.stringify({
    title: s.APP_TITLE || 'Trait Dough',
    school: s.SCHOOL_NAME || '',
    grades: list_(s.GRADES || '7,8'),
    teams: list_(s.TEAMS || 'M,O,U,N,T,S'),
    squads: list_(s.SQUADS || 'Gray,Gold,Purple,Black'),
    squadColors: parsePairs_(s.SQUAD_COLORS),
    traits: getTraits_(),
    staff: readRows_(TABS_.STAFF).filter(function(r) { return r['Name'] && !isFalse_(r['Active']); })
      .map(function(r) { return String(r['Name']).trim(); }),
    idDigits: Number(s.ID_DIGITS) || 0,
    idStartsWith: String(s.ID_STARTS_WITH || ''),
    confirmMessage: s.CONFIRM_MESSAGE || '',
    resetSeconds: Number(s.KIOSK_RESET_SECONDS) || 20,
    maxBills: MAX_BILLS_,
    logoUrl: s.LOGO_URL || '',
    guidelinesUrl: s.GUIDELINES_URL || '',
    templateUrl: s.TEMPLATE_URL || '',
    info: readRows_(TABS_.INFO).filter(function(r) { return r['Section'] || r['Content']; })
      .map(function(r) { return { section: String(r['Section'] || ''), content: String(r['Content'] || '') }; }),
  });
}

// ── TURN-IN (no password: the page lives on the guidance office computer) ──

/**
 * payload: { name, id, grade, team, squad, bills: [{ trait, givenBy, did }] }
 * Writes one Submissions row per bill. Returns { count, turnInId }.
 */
function submitDough(payloadJson) {
  const p = typeof payloadJson === 'string' ? JSON.parse(payloadJson) : payloadJson;
  const s = getSettings_();
  const name = clean_(p.name, 80);
  const id = String(p.id || '').replace(/\D/g, '');
  const grade = String(p.grade || '').trim();
  const team = String(p.team || '').trim().toUpperCase();
  const squad = matchFrom_(p.squad, list_(s.SQUADS || 'Gray,Gold,Purple,Black'));
  const traits = getTraits_();
  const bills = Array.isArray(p.bills) ? p.bills : [];

  if (name.length < 3 || name.indexOf(' ') === -1) throw new Error('Type your first and last name.');
  const idErr = idProblem_(id, s);
  if (idErr) throw new Error(idErr);
  if (list_(s.GRADES || '7,8').indexOf(grade) === -1) throw new Error('Pick your grade.');
  if (list_(s.TEAMS || 'M,O,U,N,T,S').map(function(t) { return t.toUpperCase(); }).indexOf(team) === -1) throw new Error('Pick your team.');
  if (!squad) throw new Error('Pick your squad.');
  if (!bills.length) throw new Error('Add at least one Trait Dough.');
  if (bills.length > MAX_BILLS_) throw new Error('That\'s a lot of dough! Turn in ' + MAX_BILLS_ + ' or fewer at a time.');

  const rows = [];
  const now = new Date();
  const turnInId = 'T' + Utilities.formatDate(now, TZ_, 'yyMMddHHmmss') + Math.floor(Math.random() * 90 + 10);
  const week = weekOf_(now);
  bills.forEach(function(b, i) {
    const t = traits.filter(function(x) { return x.trait === b.trait; })[0];
    if (!t) throw new Error('Pick the trait circled on Trait Dough #' + (i + 1) + '.');
    const givenBy = clean_(b.givenBy, 60);
    if (!givenBy) throw new Error('Type who gave you Trait Dough #' + (i + 1) + '.');
    const row = {};
    row['Bill ID'] = turnInId + '-' + (i + 1);
    row['Turn-In ID'] = turnInId;
    row['Timestamp'] = now;
    row['Week Of'] = week;
    row['Student Name'] = name;
    row['800#'] = id;
    row['Grade'] = grade;
    row['Team'] = team;
    row['Squad'] = squad;
    row['Trait'] = t.trait;
    row['Pillar'] = t.pillar;
    row['Given By'] = givenBy;
    row['What They Did'] = clean_(b.did, 600);
    row['Status'] = STATUS_.ENTERED;
    rows.push(row);
  });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = ss_().getSheetByName(TABS_.SUBS);
    if (!sh) throw new Error('The Trait Dough Sheet isn\'t set up yet. Ask the office.');
    const headers = headers_(sh);
    const values = rows.map(function(r) { return headers.map(function(h) { return r[h] === undefined ? '' : r[h]; }); });
    sh.getRange(sh.getLastRow() + 1, 1, values.length, headers.length).setValues(values);
  } finally {
    lock.releaseLock();
  }

  const perBill = Number(s.POINTS_PER_BILL) || 0;
  if (perBill > 0) {
    try { sendClashPoints_(squad, perBill * rows.length, 'Trait Dough turn-in: ' + name, rows.length + ' bill(s), team ' + team); }
    catch (e) { console.error('Per-bill Clash points failed: ' + e); }
  }
  return JSON.stringify({ count: rows.length, turnInId: turnInId });
}

function idProblem_(id, s) {
  const digits = Number(s.ID_DIGITS) || 0;
  const starts = String(s.ID_STARTS_WITH || '');
  const what = 'Type your 800 number' + (digits ? ' (' + digits + ' digits' + (starts ? ', starts with ' + starts : '') + ')' : '') + '.';
  if (!id) return what;
  if (digits && id.length !== digits) return what;
  if (starts && id.indexOf(starts) !== 0) return what;
  return '';
}

// ── STAFF DASHBOARD ──────────────────────────────────────────────────

function login(password) {
  const who = String(Session.getActiveUser().getEmail() || 'anon').toLowerCase();
  const cache = CacheService.getScriptCache();
  const tries = Number(cache.get('td_fail_' + who)) || 0;
  if (tries >= 6) throw new Error('Too many wrong tries. Wait 10 minutes and try again.');
  if (!passwordMatches_(password)) {
    cache.put('td_fail_' + who, String(tries + 1), 600);
    Utilities.sleep(800);
    return '';
  }
  const token = Utilities.getUuid();
  cache.put('td_session_' + token, who, SESSION_HOURS_ * 3600);
  return token;
}

function requireStaff_(token) {
  const who = token ? CacheService.getScriptCache().get('td_session_' + token) : null;
  if (!who) throw new Error('SESSION_EXPIRED');
  return who === 'anon' ? '' : who;
}

function passwordMatches_(pw) {
  const p = PropertiesService.getScriptProperties();
  const hash = p.getProperty('TD_PW_HASH'), salt = p.getProperty('TD_PW_SALT');
  if (!hash) return String(pw || '') === DEFAULT_PASSWORD_;
  return hashPw_(String(pw || ''), salt) === hash;
}

function hashPw_(pw, salt) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + pw, Utilities.Charset.UTF_8)
    .map(function(b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function changePassword() {
  const ui = SpreadsheetApp.getUi();
  const cur = ui.prompt('Change dashboard password', 'Current password' +
    (PropertiesService.getScriptProperties().getProperty('TD_PW_HASH') ? '' : ' (still the default)') + ':', ui.ButtonSet.OK_CANCEL);
  if (cur.getSelectedButton() !== ui.Button.OK) return;
  if (!passwordMatches_(cur.getResponseText())) { ui.alert('That password isn\'t right. Nothing changed.'); return; }
  const a = ui.prompt('Change dashboard password', 'New password (at least 6 characters):', ui.ButtonSet.OK_CANCEL);
  if (a.getSelectedButton() !== ui.Button.OK) return;
  const b = ui.prompt('Change dashboard password', 'Type it again:', ui.ButtonSet.OK_CANCEL);
  if (b.getSelectedButton() !== ui.Button.OK) return;
  if (a.getResponseText() !== b.getResponseText()) { ui.alert('Those didn\'t match. Nothing changed.'); return; }
  if (a.getResponseText().length < 6) { ui.alert('Use at least 6 characters. Nothing changed.'); return; }
  const salt = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperties({ TD_PW_SALT: salt, TD_PW_HASH: hashPw_(a.getResponseText(), salt) });
  ui.alert('Saved. Anyone already signed in stays signed in until their session ends (' + SESSION_HOURS_ + ' hours).');
}

/** Dashboard data: recent bills (newest first), winners, settings the page needs. */
function getDashboard(token) {
  requireStaff_(token);
  const s = getSettings_();
  const limit = Number(s.RECENT_LIMIT) || 400;
  const subs = readRows_(TABS_.SUBS);
  const recent = subs.slice(-limit).reverse().map(billOut_);
  const winners = readRows_(TABS_.WINNERS).reverse().map(function(r) {
    return { student: r['STUDENT'], teacher: r['TEACHER'], squad: r['SQUAD'], grade: r['Grade'], id: r['800#'],
      team: r['Team'], trait: r['Trait'], week: r['Week Of'], at: r['Awarded At'], points: r['Points'],
      clash: r['Clash'], by: r['Awarded By'], billId: r['Bill ID'] };
  });
  return JSON.stringify({
    config: JSON.parse(getPublicConfig()),
    recent: recent,
    totalBills: subs.length,
    winners: winners,
    thisWeek: weekOf_(new Date()),
    defaultPoints: s.DEFAULT_WIN_POINTS || '',
    clashOn: clashOn_(),
    skipPastWinners: !isFalse_(s.DRAW_SKIP_PAST_WINNERS),
    sheetUrl: ss_().getUrl(),
    pastWinnersUrl: s.PAST_WINNERS_URL || '',
  });
}

function billOut_(r) {
  return { billId: r['Bill ID'], turnInId: r['Turn-In ID'], at: r['Timestamp'], week: r['Week Of'],
    name: r['Student Name'], id: r['800#'], grade: r['Grade'], team: r['Team'], squad: r['Squad'],
    trait: r['Trait'], pillar: r['Pillar'], givenBy: r['Given By'], did: r['What They Did'],
    status: r['Status'] || STATUS_.ENTERED, points: r['Points'], clash: r['Clash'] };
}

/**
 * Random draw from one week's bills. Every bill is one entry, so more dough = more chances.
 * Skips bills already awarded and (when DRAW_SKIP_PAST_WINNERS is ON) students who already
 * won that week.
 */
function drawWinner(token, week) {
  requireStaff_(token);
  const skip = !isFalse_(getSetting_('DRAW_SKIP_PAST_WINNERS'));
  const subs = readRows_(TABS_.SUBS).filter(function(r) { return r['Week Of'] === week; });
  const wonIds = {};
  subs.forEach(function(r) { if (r['Status'] === STATUS_.WINNER) wonIds[r['800#'] || r['Student Name']] = true; });
  const pool = subs.filter(function(r) {
    return r['Status'] !== STATUS_.WINNER && !(skip && wonIds[r['800#'] || r['Student Name']]);
  });
  if (!pool.length) return JSON.stringify({ empty: true, entries: 0 });
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const students = {};
  pool.forEach(function(r) { students[r['800#'] || r['Student Name']] = true; });
  return JSON.stringify({ bill: billOut_(pick), entries: pool.length, students: Object.keys(students).length });
}

/** Marks a bill as a winner, logs it on Winners, and (if points > 0) sends squad points to Clash. */
function awardBill(token, billId, points, sendClash) {
  const who = requireStaff_(token);
  const pts = Number(points) || 0;
  if (pts < 0 || pts > 1000) throw new Error('Points should be between 0 and 1000.');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = ss_().getSheetByName(TABS_.SUBS);
    const r = readRows_(TABS_.SUBS).filter(function(x) { return x['Bill ID'] === billId; })[0];
    if (!r) throw new Error('Couldn\'t find that bill. Refresh and try again.');
    if (r['Status'] === STATUS_.WINNER) throw new Error(r['Student Name'] + ' was already awarded for this bill.');

    let clash = '';
    if (pts > 0 && sendClash && clashOn_()) {
      try {
        clash = sendClashPoints_(r['Squad'], pts, 'Trait Dough winner: ' + r['Student Name'],
          r['Trait'] + ' (from ' + r['Given By'] + '), team ' + r['Team'] + ', week of ' + r['Week Of']);
      } catch (e) {
        clash = 'NOT SENT: ' + e.message;
      }
    } else if (pts > 0) {
      clash = 'Not sent';
    }
    const now = new Date();
    updateRow_(sh, r._row, { 'Status': STATUS_.WINNER, 'Awarded At': now, 'Awarded By': who || 'staff', 'Points': pts || '', 'Clash': clash });

    const win = ss_().getSheetByName(TABS_.WINNERS);
    const out = { 'STUDENT': r['Student Name'], 'TEACHER': r['Given By'], 'SQUAD': r['Squad'], 'Grade': r['Grade'],
      '800#': r['800#'], 'Team': r['Team'], 'Trait': r['Trait'], 'Week Of': r['Week Of'], 'Awarded At': now,
      'Points': pts || '', 'Clash': clash, 'Awarded By': who || 'staff', 'Bill ID': billId };
    const wh = headers_(win);
    win.appendRow(wh.map(function(h) { return out[h] === undefined ? '' : out[h]; }));
    return JSON.stringify({ ok: true, clash: clash });
  } finally {
    lock.releaseLock();
  }
}

/** Undo an award made by mistake. Clash points already sent are NOT taken back (the note says so). */
function unawardBill(token, billId) {
  requireStaff_(token);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = ss_().getSheetByName(TABS_.SUBS);
    const r = readRows_(TABS_.SUBS).filter(function(x) { return x['Bill ID'] === billId; })[0];
    if (!r) throw new Error('Couldn\'t find that bill.');
    const sent = /^Sent/.test(String(r['Clash'] || ''));
    updateRow_(sh, r._row, { 'Status': STATUS_.ENTERED, 'Awarded At': '', 'Awarded By': '', 'Points': '', 'Clash': '' });
    const win = ss_().getSheetByName(TABS_.WINNERS);
    const w = readRows_(TABS_.WINNERS).filter(function(x) { return x['Bill ID'] === billId; });
    w.reverse().forEach(function(x) { win.deleteRow(x._row); });
    return JSON.stringify({ ok: true, clashWasSent: sent, clash: r['Clash'] });
  } finally {
    lock.releaseLock();
  }
}

/** CSV text for the Download buttons. which = 'submissions' | 'winners'. */
function exportCsv(token, which) {
  requireStaff_(token);
  const sh = ss_().getSheetByName(which === 'winners' ? TABS_.WINNERS : TABS_.SUBS);
  if (!sh || sh.getLastRow() < 1) return '';
  return toCsv_(sh.getDataRange().getDisplayValues());
}

function toCsv_(rows) {
  return rows.map(function(row) {
    return row.map(function(v) {
      v = String(v == null ? '' : v);
      if (/^[=+\-@]/.test(v)) v = '\'' + v; // stop spreadsheet apps running it as a formula
      return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }).join(',');
  }).join('\r\n');
}

// ── CLASH OF CLASSES ─────────────────────────────────────────────────

function clashOn_() {
  return !!getSetting_('CLASH_SHEET_ID') && !isFalse_(getSetting_('SEND_TO_CLASH'));
}

/** Appends one row to the Clash "events" tab (clashofclasses.org picks it up in ~10 s). */
function sendClashPoints_(squad, pts, name, note) {
  const key = clashSquad_(squad);
  if (!key) throw new Error('Unknown squad "' + squad + '"');
  const ev = SpreadsheetApp.openById(getSetting_('CLASH_SHEET_ID')).getSheetByName('events');
  if (!ev) throw new Error('No "events" tab on the Clash sheet');
  // Same columns as that sheet: id, name, type, date, note, multiplier, BLACK, GOLD, GREY, PURPLE.
  // id stays blank: that sheet's own automation fills it in.
  ev.appendRow(['', name, 'trait_dough', Utilities.formatDate(new Date(), TZ_, 'yyyy-MM-dd'), note, '',
    key === 'BLACK' ? pts : '', key === 'GOLD' ? pts : '', key === 'GREY' ? pts : '', key === 'PURPLE' ? pts : '']);
  return 'Sent +' + pts + ' ' + key + ' ' + Utilities.formatDate(new Date(), TZ_, 'M/d');
}

function clashSquad_(squad) {
  const s = String(squad || '').trim().toUpperCase();
  if (s === 'GRAY' || s === 'GREY') return 'GREY';
  return ['BLACK', 'GOLD', 'PURPLE'].indexOf(s) !== -1 ? s : '';
}

function checkClash() {
  const ui = SpreadsheetApp.getUi();
  if (!getSetting_('CLASH_SHEET_ID')) { ui.alert('CLASH_SHEET_ID is blank on Settings, so no points are ever sent.'); return; }
  try {
    const book = SpreadsheetApp.openById(getSetting_('CLASH_SHEET_ID'));
    const ev = book.getSheetByName('events');
    ui.alert(ev ? 'Connected to "' + book.getName() + '". Its events tab has ' + Math.max(ev.getLastRow() - 1, 0) +
      ' rows. SEND_TO_CLASH is ' + (clashOn_() ? 'ON' : 'OFF') + '.' : 'Opened "' + book.getName() + '" but it has no "events" tab.');
  } catch (e) {
    ui.alert('Couldn\'t open the Clash sheet: ' + e.message);
  }
}

// ── SHEET HELPERS ────────────────────────────────────────────────────

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function headers_(sh) {
  return sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getDisplayValues()[0].map(function(h) { return String(h).trim(); });
}

/** Rows as objects keyed by header (display values), each with _row (1-based sheet row). */
function readRows_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  const all = sh.getDataRange().getDisplayValues();
  const head = all[0].map(function(h) { return String(h).trim(); });
  const out = [];
  for (let i = 1; i < all.length; i++) {
    const o = { _row: i + 1 };
    head.forEach(function(h, j) { if (h) o[h] = all[i][j]; });
    out.push(o);
  }
  return out;
}

function updateRow_(sh, rowNum, changes) {
  const head = headers_(sh);
  Object.keys(changes).forEach(function(k) {
    const c = head.indexOf(k);
    if (c !== -1) sh.getRange(rowNum, c + 1).setValue(changes[k]);
  });
}

let settingsCache_ = null;
function getSettings_() {
  if (settingsCache_) return settingsCache_;
  const out = {};
  DEFAULT_SETTINGS_.forEach(function(s) { out[s[0]] = s[1]; });
  readRows_(TABS_.SETTINGS).forEach(function(r) { if (r['Key']) out[String(r['Key']).trim()] = String(r['Value'] || '').trim(); });
  settingsCache_ = out;
  return out;
}
function getSetting_(key) { return getSettings_()[key] || ''; }

function getTraits_() {
  const rows = readRows_(TABS_.TRAITS).filter(function(r) { return r['Trait'] && !isFalse_(r['Active']); });
  const src = rows.length ? rows.map(function(r) { return [String(r['Trait']).trim(), String(r['Pillar'] || '').trim()]; }) : DEFAULT_TRAITS_;
  return src.map(function(t) { return { trait: t[0], pillar: t[1] }; });
}

function list_(text) {
  return String(text || '').split(',').map(function(x) { return x.trim(); }).filter(String);
}

// "A=1, B=2" → { A: '1', B: '2' }
function parsePairs_(text) {
  const out = {};
  String(text || '').split(',').forEach(function(part) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  });
  return out;
}

function matchFrom_(value, options) {
  const v = String(value || '').trim().toLowerCase();
  return options.filter(function(o) { return o.toLowerCase() === v; })[0] || '';
}

function isFalse_(v) { return /^(false|off|no|0)$/i.test(String(v == null ? '' : v).trim()); }

/** Trims, caps length, and stops typed text from being run as a Sheet formula. */
function clean_(v, max) {
  let s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || 200);
  if (/^[=+\-@]/.test(s)) s = '\'' + s;
  return s;
}

/** Monday of that week, yyyy-MM-dd (school-week buckets for the drawing). */
function weekOf_(d) {
  const local = new Date(Utilities.formatDate(d, TZ_, 'yyyy-MM-dd') + 'T12:00:00');
  const back = (local.getDay() + 6) % 7;
  local.setDate(local.getDate() - back);
  return Utilities.formatDate(local, TZ_, 'yyyy-MM-dd');
}
