// A pretend Google (Sheets, cache, properties, locks, HtmlService) so Code.gs runs in Node.
// Used by tests/trait-dough.test.js and tests/build-preview.js.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const DIR = path.join(__dirname, '../apps-script');

function pad(n) { return String(n).padStart(2, '0'); }
function fmt(d, pattern) {
  // Enough of Utilities.formatDate for this project (local time stands in for America/New_York).
  const h = d.getHours(), h12 = h % 12 || 12;
  return pattern
    .replace('h:mm am/pm', h12 + ':' + pad(d.getMinutes()) + ' ' + (h < 12 ? 'AM' : 'PM'))
    .replace('yyyy', d.getFullYear()).replace('yy', String(d.getFullYear()).slice(2))
    .replace('MM', pad(d.getMonth() + 1)).replace('dd', pad(d.getDate()))
    .replace('HH', pad(h)).replace('mm', pad(d.getMinutes())).replace('ss', pad(d.getSeconds()))
    .replace(/\bM\b/, d.getMonth() + 1).replace(/\bd\b/, d.getDate());
}

function display(v, format) {
  if (v === true) return 'TRUE';
  if (v === false) return 'FALSE';
  if (Object.prototype.toString.call(v) === '[object Date]') return fmt(v, format === 'yyyy-mm-dd' ? 'yyyy-MM-dd' : 'yyyy-MM-dd h:mm am/pm');
  return String(v == null ? '' : v);
}

function makeSheet(name) {
  const sheet = {
    rows: [], formats: {}, name,
    getName: () => sheet.name,
    getLastRow() { return sheet.rows.length; },
    getLastColumn() { return sheet.rows.reduce((m, r) => Math.max(m, r.length), 0); },
    getDataRange() { return sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), Math.max(sheet.getLastColumn(), 1)); },
    getRange(r, c, nr, nc) {
      if (typeof r === 'string') { // 'C:C' style
        const col = r.charCodeAt(0) - 64;
        return { setNumberFormat(f) { sheet.formats[col] = f; return this; } };
      }
      nr = nr || 1; nc = nc || 1;
      const get = disp => {
        const out = [];
        for (let i = 0; i < nr; i++) {
          const row = sheet.rows[r - 1 + i] || [];
          const line = [];
          for (let j = 0; j < nc; j++) {
            const v = row[c - 1 + j];
            line.push(disp ? display(v, sheet.formats[c + j]) : (v == null ? '' : v));
          }
          out.push(line);
        }
        return out;
      };
      const api = {
        getValues: () => get(false),
        getDisplayValues: () => get(true),
        setValues(vals) {
          vals.forEach((row, i) => {
            while (sheet.rows.length < r + i) sheet.rows.push([]);
            row.forEach((v, j) => {
              // Sheets turns "2026-10-26" into a date.
              if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && sheet.formats[c + j] !== '@') v = new Date(v + 'T00:00:00');
              sheet.rows[r - 1 + i][c - 1 + j] = v;
            });
          });
          return proxy;
        },
        setValue(v) { return api.setValues([[v]]); },
      };
      const proxy = new Proxy(api, { get: (t, p) => p in t ? t[p] : () => proxy });
      return proxy;
    },
    appendRow(row) { const n = sheet.rows.length + 1; sheet.getRange(n, 1, 1, row.length).setValues([row]); },
    deleteRow(n) { sheet.rows.splice(n - 1, 1); },
    setFrozenRows() {}, setColumnWidth() { return sheet; },
  };
  return sheet;
}

function makeBook(name) {
  const sheets = [];
  const book = {
    sheets,
    getName: () => name,
    getSheets: () => sheets,
    getSheetByName: n => sheets.find(s => s.getName() === n) || null,
    insertSheet(n) { const s = makeSheet(n); sheets.push(s); return s; },
    deleteSheet(s) { sheets.splice(sheets.indexOf(s), 1); },
    setActiveSheet(s) { book._active = s; },
    moveActiveSheet(i) { sheets.splice(sheets.indexOf(book._active), 1); sheets.splice(i - 1, 0, book._active); },
    getUrl: () => 'https://docs.google.com/spreadsheets/d/TRAITDOUGH',
  };
  return book;
}

function loadApp(opts) {
  opts = opts || {};
  const book = makeBook('Trait Dough');
  const clash = makeBook('Clash of Classes Points');
  const events = clash.insertSheet('events');
  events.appendRow(['id', 'name', 'type', 'date', 'note', 'multiplier', 'BLACK', 'GOLD', 'GREY', 'PURPLE']);
  const cache = new Map();
  const props = new Map();
  const alerts = [];
  const user = { email: opts.email || 'staff@easdpa.org' };

  const ctx = {
    console,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => book,
      openById: id => { if (id !== '1wF01Limr7uO36DRGC6qh3XfYA7dBdXEfGRWuasmEf0w' && id !== 'CLASH') throw new Error('No access'); return clash; },
      getUi: () => ({ alert: m => alerts.push(m), prompt: () => ({ getSelectedButton: () => 'CANCEL' }), Button: { OK: 'OK' }, ButtonSet: {} }),
    },
    Session: { getActiveUser: () => ({ getEmail: () => user.email }), getScriptTimeZone: () => 'America/New_York' },
    CacheService: { getScriptCache: () => ({ get: k => cache.has(k) ? cache.get(k) : null, put: (k, v) => cache.set(k, v), remove: k => cache.delete(k) }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props.has(k) ? props.get(k) : null, setProperties: o => Object.entries(o).forEach(([k, v]) => props.set(k, v)) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      formatDate: (d, tz, p) => fmt(d, p),
      getUuid: () => crypto.randomUUID(),
      sleep() {},
      computeDigest: (alg, s) => [...crypto.createHash('sha256').update(s).digest()].map(b => b > 127 ? b - 256 : b),
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
    },
    ScriptApp: { getService: () => ({ getUrl: () => opts.url || 'https://script.google.com/macros/s/TEST/exec' }) },
    HtmlService: {
      createHtmlOutputFromFile: n => ({ getContent: () => fs.readFileSync(path.join(DIR, n + '.html'), 'utf8') }),
    },
  };
  vm.createContext(ctx);
  // Top-level const/let stay script-scoped in a vm, so expose what tests poke at.
  const src = fs.readFileSync(path.join(DIR, 'Code.gs'), 'utf8') +
    '\n;globalThis.__app = { TABS_, SUB_HEADERS_, WIN_HEADERS_, resetSettings: () => { settingsCache_ = null; } };';
  vm.runInContext(src, ctx, { filename: 'Code.gs' });
  return { ctx, book, clash, events, cache, props, alerts, user, app: ctx.__app };
}

/** Renders a page template the way HtmlService would (scriptlets <?!= ?> only). */
function renderTemplate(ctx, file, vars) {
  let html = fs.readFileSync(path.join(DIR, file + '.html'), 'utf8');
  return html.replace(/<\?!=\s*([\s\S]*?)\s*\?>/g, (m, expr) => {
    const fn = new Function(...Object.keys(vars), 'ctx', 'with (ctx) { return (' + expr + '); }');
    return String(fn(...Object.values(vars), ctx));
  });
}

module.exports = { loadApp, renderTemplate, DIR };
