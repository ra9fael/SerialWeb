// Dev-only verification driver: launches headless Edge over CDP, loads a page,
// runs a list of in-page steps, prints the collected JSON and saves a screenshot.
//
//   node tools/cdp-check.mjs --url <url> --out <prefix> [--scenario i18n|term]
//
// Needs nothing but Node (global WebSocket/fetch) and a local HTTP server.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9333;
const PROFILE = path.resolve('tools/.cdp-profile');

function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const url = arg('url');
const out = arg('out', 'cdp');
const scenario = arg('scenario', 'i18n');
if (!url) {
  console.error('missing --url');
  process.exit(2);
}

fs.rmSync(PROFILE, { recursive: true, force: true });
const child = spawn(EDGE, [
  '--headless',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--remote-debugging-port=' + PORT,
  '--user-data-dir=' + PROFILE,
  '--window-size=1440,1000',
  '--accept-lang=en-US,en;q=0.9',
  'about:blank'
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDebugger() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return res.json();
    } catch (e) {
      // devtools not listening yet
    }
    await sleep(250);
  }
  throw new Error('devtools did not start');
}

let idCounter = 0;

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    const listeners = new Set();
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve: r, reject: j } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) j(new Error(JSON.stringify(msg.error)));
        else r(msg.result);
      } else if (msg.method) {
        listeners.forEach((fn) => fn(msg));
      }
    });
    ws.addEventListener('error', reject);
    ws.addEventListener('open', () => resolve({
      send(method, params = {}) {
        return new Promise((r, j) => {
          const id = ++idCounter;
          pending.set(id, { resolve: r, reject: j });
          ws.send(JSON.stringify({ id, method, params }));
        });
      },
      on(fn) { listeners.add(fn); },
      close() { ws.close(); }
    }));
  });
}

const AUDIT = `(() => {
  const CJK = /[\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff]/;
  const skipped = (node) => {
    const el = node.nodeType === 3 ? node.parentElement : node;
    return !el || el.closest('[data-i18n-off]') || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA'].includes(el.tagName);
  };
  const residual = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(n) { return skipped(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
  });
  let n = walker.currentNode;
  while (n) {
    if (n.nodeType === 3) {
      const v = n.nodeValue.replace(/\\s+/g, ' ').trim();
      if (v && CJK.test(v)) residual.push('text: ' + v.slice(0, 70));
    } else {
      for (const a of ['title', 'aria-label', 'placeholder', 'data-tip', 'data-short', 'data-hover']) {
        const v = n.getAttribute(a);
        if (v && CJK.test(v)) residual.push(n.tagName + '@' + a + ': ' + v.replace(/\\s+/g, ' ').slice(0, 60));
      }
    }
    n = walker.nextNode();
  }
  const prefs = JSON.parse(localStorage.getItem('serialweb:prefs') || '{}');
  return {
    lang: document.documentElement.lang,
    prefsLocale: prefs.locale,
    activeLangOption: [...document.querySelectorAll('.menu-lang-opt')].filter((o) => o.classList.contains('is-active')).map((o) => o.dataset.locale),
    connect: document.getElementById('connect-btn')?.textContent,
    timelineLabel: document.getElementById('timeline-label')?.textContent,
    monitorTab: document.querySelector('[data-monitor-view="manual"]')?.textContent,
    versionChip: document.querySelector('.runtime-mode-label')?.textContent,
    residual: [...new Set(residual)]
  };
})()`;

const CLICK_LOCALE = (code) => `(() => {
  const el = document.querySelector('.menu-lang-opt[data-locale="${code}"]');
  if (!el) return 'MISSING';
  el.click();
  return 'clicked';
})()`;

const MEASURE = `(() => {
  const host = document.getElementById('term-output');
  const el = document.querySelector('.xterm-char-measure-element');
  const rows = document.querySelector('.xterm-rows');
  const rect = el ? el.getBoundingClientRect() : null;
  const csEl = el ? getComputedStyle(el) : null;
  const csRows = rows ? getComputedStyle(rows) : null;
  return {
    visible: Boolean(host && host.offsetParent !== null),
    char: rect ? rect.width.toFixed(2) + 'x' + rect.height.toFixed(2) : 'no instance',
    rowsFont: csRows ? csRows.fontSize + ' ' + csRows.fontFamily.slice(0, 30) : 'none',
    measureFont: csEl ? csEl.fontSize + ' ' + csEl.fontFamily.slice(0, 30) : 'none',
    lines: rows ? rows.children.length : 0,
    sizeInput: document.getElementById('term-font-size')?.value ?? null,
    fontSelect: document.getElementById('term-font')?.value || '(default)'
  };
})()`;

const SET_SIZE = (value) => `(() => {
  const input = document.getElementById('term-font-size');
  if (!input) return 'MISSING';
  input.value = '${value}';
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return input.value;
})()`;

const SET_FONT = (value) => `(() => {
  const sel = document.getElementById('term-font');
  if (!sel) return 'MISSING';
  sel.value = '${value}';
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return sel.value;
})()`;

const CLICK_VIEW = (view) => `(() => {
  const btn = document.querySelector('[data-monitor-view="${view}"]');
  if (!btn) return 'MISSING';
  btn.click();
  return '${view}';
})()`;

const DISMISS_MODAL = `(() => { const b = document.getElementById('version-modal-close'); if (!b) return 'MISSING'; b.click(); return 'closed'; })()`;

const WHEEL_ZOOM = (deltaY) => `(() => {
  const host = document.getElementById('term-output');
  if (!host) return 'MISSING';
  host.dispatchEvent(new WheelEvent('wheel', { ctrlKey: true, deltaY: ${deltaY}, bubbles: true, cancelable: true }));
  return document.getElementById('term-font-size')?.value ?? null;
})()`;

const LATIN_LEFTOVERS = `(() => {
  const skip = (node) => {
    const el = node.nodeType === 3 ? node.parentElement : node;
    return !el || el.closest('[data-i18n-off]') || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA'].includes(el.tagName);
  };
  const found = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(n) { return skip(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
  });
  let n = walker.currentNode;
  while (n) {
    const value = n.nodeType === 3
      ? n.nodeValue.replace(/\\s+/g, ' ').trim()
      : ['title', 'aria-label', 'placeholder'].map((a) => n.getAttribute(a)).filter(Boolean).join(' | ');
    if (value.length > 1 && /[A-Za-z]{3,}(\\s+[A-Za-z]{3,})/.test(value) && !/[\\u3400-\\u4dbf\\u4e00-\\u9fff]/.test(value)) {
      found.push((n.nodeType === 3 ? 'text: ' : n.tagName + '@: ') + value.slice(0, 60));
    }
    n = walker.nextNode();
  }
  return [...new Set(found)];
})()`;

const scenarios = {
  i18n: [
    { name: 'dismissModal', expr: DISMISS_MODAL, wait: 500 },
    { name: 'auditInitial', expr: AUDIT, wait: 0 },
    { name: 'toEnglish', expr: CLICK_LOCALE('en'), wait: 1200 },
    { name: 'auditEnglish', expr: AUDIT, wait: 0 },
    { name: 'toChinese', expr: CLICK_LOCALE('zh'), wait: 1200 },
    { name: 'auditChinese', expr: AUDIT, wait: 0 },
    { name: 'toSystem', expr: CLICK_LOCALE('system'), wait: 1200 },
    { name: 'auditSystem', expr: AUDIT, wait: 0 }
  ],
  term: [
    { name: 'dismissModal', expr: DISMISS_MODAL, wait: 500 },
    {
      name: 'fontAvailability',
      expr: `(() => [...document.querySelectorAll('#term-font option')].map((o) => ({
        value: o.value || '(default)', disabled: o.disabled, title: (o.title || '').slice(0, 40)
      })))()`
    },
    { name: 'measureBootHidden', expr: MEASURE },
    { name: 'showTerminal', expr: CLICK_VIEW('terminal'), wait: 1200 },
    { name: 'measureTerminal', expr: MEASURE },
    { name: 'setSize24', expr: SET_SIZE(24), wait: 700 },
    { name: 'measureAfterSize', expr: MEASURE },
    { name: 'wheelUp', expr: WHEEL_ZOOM(-120), wait: 700 },
    { name: 'measureAfterWheel', expr: MEASURE },
    { name: 'setConsolas', expr: SET_FONT('Consolas, monospace'), wait: 700 },
    { name: 'measureAfterFont', expr: MEASURE },
    { name: 'hideTerminal', expr: CLICK_VIEW('manual'), wait: 700 },
    { name: 'setFontWhileHidden', expr: SET_FONT('"Cascadia Code", monospace'), wait: 700 },
    { name: 'measureHiddenChange', expr: MEASURE },
    { name: 'showTerminalAgain', expr: CLICK_VIEW('terminal'), wait: 1200 },
    { name: 'measureAfterHiddenChange', expr: MEASURE },
    { name: 'prefs', expr: `JSON.parse(localStorage.getItem('serialweb:prefs') || '{}').layout || {}` }
  ],
  roundtrip: [
    { name: 'toEnglish', expr: CLICK_LOCALE('en'), wait: 1200 },
    { name: 'englishOk', expr: AUDIT },
    { name: 'backToChinese', expr: CLICK_LOCALE('zh'), wait: 1400 },
    { name: 'latinLeftovers', expr: LATIN_LEFTOVERS, wait: 0 },
    { name: 'chineseAudit', expr: AUDIT }
  ],
  reset: [
    { name: 'dismissModal', expr: DISMISS_MODAL, wait: 400 },
    { name: 'toChinese', expr: CLICK_LOCALE('zh'), wait: 1200 },
    { name: 'setSize20', expr: SET_SIZE(20), wait: 500 },
    { name: 'setFont', expr: SET_FONT('Consolas, monospace'), wait: 500 },
    { name: 'beforeReset', expr: MEASURE },
    {
      name: 'reset',
      expr: `(() => {
        document.getElementById('reset-user-config-btn')?.click();
        document.getElementById('confirm-user-config-btn')?.click();
        return 'done';
      })()`,
      wait: 1500
    },
    { name: 'afterReset', expr: MEASURE },
    {
      name: 'state',
      expr: `(() => {
        const prefs = JSON.parse(localStorage.getItem('serialweb:prefs') || '{}');
        return { lang: document.documentElement.lang, locale: prefs.locale, layout: prefs.layout };
      })()`
    },
    { name: 'audit', expr: AUDIT }
  ]
};

const version = await waitForDebugger();
const created = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json());
const cdp = await connect(created.webSocketDebuggerUrl);

const consoleLines = [];
cdp.on((msg) => {
  if (msg.method === 'Runtime.consoleAPICalled') {
    const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ');
    if (msg.params.type !== 'debug') consoleLines.push(`${msg.params.type}: ${text}`);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    consoleLines.push(`exception: ${msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text}`);
  } else if (msg.method === 'Log.entryAdded') {
    const e = msg.params.entry;
    if (e.level === 'error') consoleLines.push(`log: ${e.text} ${e.url || ''}`);
  }
});

await cdp.send('Runtime.enable');
await cdp.send('Log.enable');
await cdp.send('Page.enable');
await cdp.send('Page.navigate', { url });
await sleep(5000);

const steps = scenarios[scenario] || [];
const results = {};
for (const step of steps) {
  const evaluated = await cdp.send('Runtime.evaluate', { expression: step.expr, returnByValue: true, awaitPromise: true });
  results[step.name] = evaluated.result?.value ?? evaluated.exceptionDetails;
  if (step.wait) await sleep(step.wait);
}

const finalExpr = arg('final');
if (finalExpr) {
  const evaluated = await cdp.send('Runtime.evaluate', { expression: finalExpr, returnByValue: true, awaitPromise: true });
  results.finalStep = evaluated.result?.value ?? evaluated.exceptionDetails;
  await sleep(900);
}

const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(`${out}.png`, Buffer.from(shot.data, 'base64'));

fs.writeFileSync(`${out}.json`, JSON.stringify({ url, scenario, results, console: consoleLines }, null, 2), 'utf8');
console.log(JSON.stringify({ scenario, steps: steps.length, consoleMessages: consoleLines.length, out }));

cdp.close();
child.kill();
process.exit(0);
