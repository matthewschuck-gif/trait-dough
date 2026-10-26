// Builds preview/*.html: the real pages with google.script.run wired to Code.gs running in
// this Node process, through a tiny local server. For clicking through before deploying.
//   node tests/build-preview.js   then open http://localhost:3031/
const http = require('http');
const { loadApp, renderTemplate } = require('./fake-google');

const t = loadApp({ url: 'http://localhost:3031/' });
t.ctx.setup();
// A little sample data so the dashboard has something to show.
const sample = [
  ['Emily McBride', '8021001', '7', 'M', 'Black', [['Resilience & Grit', 'Leister', 'Kept going on the mile run even when I wanted to stop.']]],
  ['LJ Johnson', '8016002', '8', 'O', 'Gray', [['Communication & Empathy', 'Martin', 'Helped a new student find their classes.'], ['Collaboration & Teamwork', 'Bradley', '']]],
  ['Lily Hershey', '8016003', '8', 'U', 'Purple', [['Creativity & Innovation', 'Reynolds', 'Designed our group poster.']]],
  ['Emma Bonneau', '8021004', '7', 'S', 'Gold', [['Honesty, Integrity, & Responsibility', 'Rios', 'Turned in a lost Chromebook.'], ['Critical Thinking & Problem Solving', 'Rios', 'Found a new way to solve the equation.'], ['Adaptability & Flexibility', 'Trout', 'Switched groups without complaining.']]],
];
sample.forEach(s => t.ctx.submitDough(JSON.stringify({ name: s[0], id: s[1], grade: s[2], team: s[3], squad: s[4],
  bills: s[5].map(b => ({ trait: b[0], givenBy: b[1], did: b[2] })) })));

const shim = `<script>
  window.google = { script: { run: (function make(ok, fail) {
    return new Proxy({}, { get(_, fn) {
      if (fn === 'withSuccessHandler') return h => make(h, fail);
      if (fn === 'withFailureHandler') return h => make(ok, h);
      return (...args) => fetch('/rpc/' + fn, { method: 'POST', body: JSON.stringify(args) })
        .then(r => r.json()).then(r => r.error ? fail && fail(new Error(r.error)) : ok && ok(r.result));
    } });
  })() } };
</script>`;

http.createServer((req, res) => {
  if (req.url.startsWith('/rpc/')) {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const fn = req.url.slice(5);
      let out;
      try { t.app.resetSettings(); out = { result: t.ctx[fn](...JSON.parse(body)) }; }
      catch (e) { out = { error: e.message }; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(out));
    });
    return;
  }
  const view = (new URL(req.url, 'http://x').searchParams.get('view') || '').toLowerCase();
  const file = view === 'admin' ? 'Admin' : view === 'info' ? 'Info' : 'Kiosk';
  t.app.resetSettings();
  const html = renderTemplate(t.ctx, file, { baseUrl: 'http://localhost:3031/' }).replace('<head>', '<head>' + shim);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}).listen(3031, () => console.log('Trait Dough preview on http://localhost:3031/'));
