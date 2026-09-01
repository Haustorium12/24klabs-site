// STATUS — ticket #30. Our own doctrine pointed at ourselves.
//
// This is a Pages Function and not an Astro page on purpose. A built page would show
// whatever was true at the last deploy and quietly age, which is the failure this whole
// site keeps getting caught by. Every figure below comes from a request made when you
// loaded this page. Nothing here is remembered.
//
// THREE STATES, AND THE THIRD ONE IS THE POINT (state/assertions.yaml):
//   OK          answered with the code we expect
//   WRONG       answered, but not with the code we expect — up, and misbehaving
//   NO ANSWER   our probe got nothing back
// NO ANSWER IS NEVER COUNTED AS OK. A checker that reports green when it could not
// check is the 24K Vault failure, which is the one named anti-pattern in this company:
// a system that filed passing audits while checking nothing.
//
// NO SLA AND NO UPTIME PERCENTAGE, DELIBERATELY. An uptime figure needs history we do
// not keep for our own services, and a percentage invites a commitment we have not
// made. The support practice research says exactly this: do incident communication
// first, add metrics later. A single honest live reading beats a fabricated 99.9%.

import { listings } from '../src/lib/listings.js';

const TIMEOUT_MS = 8000;
const UA = '24klabs-status/1.0 (+https://24klabs.ai/status)';

// Each check names the code it EXPECTS, because on this site a 402 is health. The paid
// endpoints are supposed to refuse an unpaid caller; a 200 from the bulk export would
// mean the gate had fallen off, which is worse than it being down.
const CHECKS = [
  { group: 'The site', name: 'Front page', url: 'https://24klabs.ai/', method: 'GET', expect: 200,
    note: 'Static HTML on Cloudflare Pages.' },
  { group: 'The site', name: 'Directory search', url: 'https://24klabs.ai/api/directory/search?q=x402', method: 'GET', expect: 200,
    note: 'Free and unkeyed. Reading is never gated.' },
  { group: 'The site', name: 'Bulk export gate', url: 'https://24klabs.ai/api/v1/directory/bulk', method: 'GET', expect: 402,
    note: '402 is the healthy answer — it means the paywall is still on.' },
  { group: 'The site', name: 'Touchstone', url: 'https://24klabs.ai/.well-known/touchstone', method: 'GET', expect: 200,
    note: 'The rail every 24K mark is rendered from.' },

  { group: 'The API', name: 'Service manifest', url: 'https://api.24klabs.ai/.well-known/x402.json', method: 'GET', expect: 200,
    note: 'What an agent reads to find out what we sell.' },
  { group: 'The API', name: 'Paywall', url: 'https://api.24klabs.ai/api/v1/explain-code', method: 'POST', expect: 402,
    note: 'An unpaid POST must be refused. 402 is correct.' },

  { group: 'The Chronographer', name: 'Service manifest', url: 'https://time.24klabs.ai/.well-known/x402.json', method: 'GET', expect: 200,
    note: 'Time Lord’s advertised resources.' },
  { group: 'The Chronographer', name: 'Paywall', url: 'https://time.24klabs.ai/time', method: 'GET', expect: 402,
    note: 'An unpaid read must be refused. 402 is correct.' },
];

async function knock(c) {
  const started = Date.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(c.url, {
      method: c.method,
      signal: ctl.signal,
      redirect: 'follow',
      headers: c.method === 'POST'
        ? { 'user-agent': UA, 'content-type': 'application/json' }
        : { 'user-agent': UA },
      body: c.method === 'POST' ? '{}' : undefined,
    });
    return {
      ...c,
      state: res.status === c.expect ? 'ok' : 'wrong',
      code: res.status,
      ms: Date.now() - started,
    };
  } catch (err) {
    // Our probe got nothing. This is NOT reported as down-for-everyone and it is NOT
    // reported as fine: we say what happened to us and let the reader draw the line.
    return { ...c, state: 'noanswer', code: null, ms: Date.now() - started, err: String(err && err.name || err) };
  } finally {
    clearTimeout(timer);
  }
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}

const LABEL = { ok: 'OK', wrong: 'ANSWERED WRONG', noanswer: 'NO ANSWER' };

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const wantsJson =
    url.searchParams.get('format') === 'json' ||
    (request.headers.get('accept') || '').includes('application/json');

  const checked = await Promise.all(CHECKS.map(knock));
  const at = new Date().toISOString();

  const ok = checked.filter((c) => c.state === 'ok').length;
  const wrong = checked.filter((c) => c.state === 'wrong').length;
  const none = checked.filter((c) => c.state === 'noanswer').length;

  // The directory half is NOT a live knock and must not be dressed as one. These come
  // from the nightly shelf sweep baked into the last build, so they carry their own
  // date and say what they are.
  const all = listings;
  const shelf = {
    entries: all.length,
    graveyard: all.filter((e) => e.status === 'graveyard').length,
    with_receipt: all.filter((e) => e.last_checked).length,
    freshest: all.reduce((a, e) => (e.last_checked && e.last_checked > a ? e.last_checked : a), ''),
  };

  if (wantsJson) {
    return new Response(JSON.stringify({
      checked_at: at,
      summary: { ok, answered_wrong: wrong, no_answer: none, total: checked.length },
      note: 'no_answer is never counted as ok. An expected code of 402 means the paywall is working.',
      checks: checked.map(({ group, name, url, method, expect, state, code, ms }) => ({
        group, name, url, method, expected: expect, state, code, ms,
      })),
      directory: { ...shelf, source: 'nightly shelf sweep, as of the last site build — not a live knock' },
      sla: null,
      uptime_percent: null,
    }, null, 2), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-origin': '*',
        'cache-control': 'public, max-age=60',
      },
    });
  }

  const groups = [...new Set(CHECKS.map((c) => c.group))];

  const banner =
    none > 0
      ? `<p class="verdict verdict--none"><b>${none}</b> of ${checked.length} checks got no answer from our probe just now. That is not the same as being down for you, and it is not the same as being fine.</p>`
      : wrong > 0
        ? `<p class="verdict verdict--wrong"><b>${wrong}</b> of ${checked.length} checks answered with a code we did not expect. Details below.</p>`
        : `<p class="verdict verdict--ok">All <b>${checked.length}</b> checks answered exactly as expected when this page loaded.</p>`;

  const body = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Status — 24K Labs</title>
<meta name="description" content="Live status for 24K Labs services. Every reading on this page is taken when you load it. No SLA, no uptime percentage, no self-reporting.">
<meta name="robots" content="index,follow">
<style>
 :root{--bg:#0a0a0f;--surface:#12121a;--card:#101017;--border:#2a2a33;--text:#e8e6e1;--muted:#b8b5ae;--dim:#7c7a75;--gold:#d4af37;--gold-dim:#8f6a2f;--gold-light:#e8c86a;--ok:#4a8f5f;--ok-t:#6fbf85;--warn:#c9963f;--bad:#b5544a;--mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
 *{box-sizing:border-box}
 body{margin:0;background:var(--bg);color:var(--text);font:13px/1.45 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
 .w{max-width:1000px;margin:0 auto;padding:28px 18px 64px}
 a{color:var(--muted)}
 .mast{display:flex;align-items:baseline;justify-content:space-between;gap:16px;flex-wrap:wrap}
 .mark{font-family:var(--mono);font-weight:700;font-size:15px;letter-spacing:.16em;color:var(--gold);text-decoration:none}
 .sub{font-family:var(--mono);font-size:11px;letter-spacing:.3em;color:var(--dim)}
 .rule{height:1px;margin:10px 0 12px;background:linear-gradient(90deg,var(--gold) 0%,var(--gold-dim) 42%,var(--border) 100%)}
 .crumb{font-family:var(--mono);font-size:11.5px;color:var(--dim);margin-bottom:10px}
 .crumb a{text-decoration:none}
 h1{margin:0 0 8px;padding-bottom:6px;border-bottom:1px solid var(--gold-dim);font-size:15px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--gold)}
 .panel{border:1px solid var(--border);padding:15px 17px 16px;margin-bottom:22px;position:relative;background:linear-gradient(180deg,rgba(212,175,55,.04),transparent 70%)}
 .panel::before,.panel::after{content:'';position:absolute;width:7px;height:7px}
 .panel::before{top:-1px;left:-1px;border-top:1px solid var(--gold);border-left:1px solid var(--gold)}
 .panel::after{bottom:-1px;right:-1px;border-bottom:1px solid var(--gold);border-right:1px solid var(--gold)}
 .verdict{margin:11px 0 0;font-size:13px;color:var(--muted);border-left:2px solid var(--border);padding-left:11px}
 .verdict b{font-family:var(--mono);color:var(--text)}
 .verdict--ok{border-left-color:var(--ok)}
 .verdict--wrong{border-left-color:var(--warn)}
 .verdict--none{border-left-color:var(--bad)}
 .standing{margin:12px 0 0;max-width:78ch;color:var(--muted);font-size:12.5px;border-left:2px solid var(--gold);padding-left:11px}
 .standing em{color:var(--text);font-style:italic}
 .stamp{margin:10px 0 0;font-family:var(--mono);font-size:11px;color:var(--dim)}
 h2{display:flex;align-items:baseline;gap:9px;margin:26px 0 9px;padding-bottom:5px;border-bottom:1px solid var(--gold-dim);font-size:12px;font-weight:700;letter-spacing:.13em;text-transform:uppercase;color:var(--gold)}
 table{width:100%;border-collapse:collapse}
 td,th{text-align:left;padding:7px 8px;border-bottom:1px solid var(--border);vertical-align:top}
 th{font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);font-weight:400}
 .nm{color:var(--text);font-weight:600}
 .u{font-family:var(--mono);font-size:10.5px;color:var(--dim);overflow-wrap:anywhere}
 .nt{color:var(--muted);font-size:11.5px}
 .pill{display:inline-block;font-family:var(--mono);font-size:10px;letter-spacing:.08em;padding:2px 8px;border:1px solid var(--border);white-space:nowrap}
 .p-ok{color:var(--ok-t);border-left:3px solid var(--ok)}
 .p-wrong{color:var(--warn);border-left:3px solid var(--warn)}
 .p-none{color:#d98b80;border-left:3px solid var(--bad)}
 .num{font-family:var(--mono);font-variant-numeric:tabular-nums;color:var(--muted);white-space:nowrap}
 .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
 .chip{font-family:var(--mono);font-size:10.5px;color:var(--muted);border:1px solid var(--border);border-left:2px solid var(--gold-dim);padding:2px 8px}
 .chip b{color:var(--text);font-variant-numeric:tabular-nums}
 p.body{max-width:82ch;color:var(--muted);font-size:12.5px}
 footer{margin-top:34px;color:var(--dim);font-size:11.5px}
 @media(max-width:760px){.w{padding:20px 14px 48px}td,th{padding:6px 5px}.u{display:none}}
</style></head><body><div class="w">

<div class="mast">
  <a class="mark" href="/">&#9670; 24K LABS</a>
  <span class="sub">STATUS</span>
</div>
<div class="rule"></div>
<nav class="crumb"><a href="/">Top</a> : <strong>Status</strong></nav>

<div class="panel">
  <h1>Are we up right now</h1>
  ${banner}
  <p class="standing">
    Every reading on this page was taken when you loaded it. Nothing here is remembered,
    cached from a build, or self&#8209;reported. Where a check expects <em>402</em>, that is not a
    fault — it means the paywall answered an unpaid caller the way it is supposed to.
  </p>
  <p class="stamp">Checked ${esc(at)} · ${checked.length} checks · ${ok} ok · ${wrong} answered wrong · ${none} no answer</p>
</div>

${groups.map((g) => `
<h2><span>${esc(g)}</span></h2>
<table>
<thead><tr><th>Check</th><th>State</th><th>Code</th><th>Expected</th><th>Time</th></tr></thead>
<tbody>
${checked.filter((c) => c.group === g).map((c) => `
<tr>
  <td><span class="nm">${esc(c.name)}</span><div class="u">${esc(c.method)} ${esc(c.url)}</div><div class="nt">${esc(c.note)}</div></td>
  <td><span class="pill p-${c.state === 'ok' ? 'ok' : c.state === 'wrong' ? 'wrong' : 'none'}">${LABEL[c.state]}</span></td>
  <td class="num">${c.code === null ? '—' : c.code}</td>
  <td class="num">${c.expect}</td>
  <td class="num">${c.ms} ms</td>
</tr>`).join('')}
</tbody></table>`).join('')}

<h2><span>The directory</span></h2>
<p class="body">
  These four numbers are <strong>not</strong> a live knock and it would be dishonest to put them in
  the table above. They come from the nightly shelf sweep as of the last time this site was built,
  and they carry that date so you can tell how old they are.
</p>
<div class="chips">
  <span class="chip"><b>${shelf.entries}</b> listings</span>
  <span class="chip"><b>${shelf.with_receipt}</b> carry a dated knock</span>
  <span class="chip"><b>${shelf.graveyard}</b> currently answer nothing</span>
  <span class="chip">freshest receipt <b>${esc(shelf.freshest || 'none')}</b></span>
</div>
<p class="body" style="margin-top:12px">
  The ones that stopped answering are listed by name, with the date they stopped, on
  <a href="/graveyard">the graveyard</a>.
</p>

<h2><span>Incidents</span></h2>
<p class="body">
  Nothing to report. When something breaks that a reader would care about, it gets written here
  with a date and stays here afterwards — including the ones that were our fault.
</p>

<h2><span>What this page will not tell you</span></h2>
<p class="body">
  <strong>There is no uptime percentage and no SLA.</strong> We do not keep enough history on our own
  services to compute an honest one, and a number like 99.9% on a page like this is usually a
  commitment nobody made. When we have the history, the figure will show up with its method
  attached. Until then this page does the useful half: it tells you what happened when it knocked,
  a few seconds ago.
</p>
<p class="body">
  It also cannot tell you whether a service is any <em>good</em>. A 402 proves the door works, not
  that what is behind it is worth the money. That distinction is the whole product.
</p>

<footer>
  <div class="rule"></div>
  <p>
    <a href="/">home</a> · <a href="/support">support</a> · <a href="/graveyard">the graveyard</a> ·
    <a href="/wall/">the index</a> · <a href="/status?format=json">this page, as JSON</a>
  </p>
  <p>Reading is never gated — static, free, no key.</p>
</footer>

</div></body></html>`;

  return new Response(body, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Short cache so a reader is never handed a stale reading, and so a burst of
      // traffic cannot turn this page into a knock storm against our own services.
      'cache-control': 'public, max-age=60',
    },
  });
}

export async function onRequestHead(ctx) {
  const res = await onRequestGet(ctx);
  return new Response(null, { status: res.status, headers: res.headers });
}
