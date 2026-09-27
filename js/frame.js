/* The frame around every page — Dante's ascent, read from the bottom up.

   bottom   Inferno: a dark stone slab, the line carved into it, embers beneath
   middle   Purgatorio: epigraphs printed into the page like any other text
   top      Paradiso: a gold plaque, the line inlaid, glinting

   Down both edges of a wide screen run inscribed rails whose material
   changes with height: carved stone at the foot, ink in the middle, gold
   leaf at the head. The left rail reads upward, the right rail downward. */

import { QUOTES, pick } from './quotes.js';
import { esc } from './util.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)');

export function epigraph(q) {
  return `<aside class="epigraph" aria-label="Epigraph">
    <span class="fleuron" aria-hidden="true">❧</span>
    <p>${esc(q.text)}</p>
    <cite>${esc(q.by)}, <i>${esc(q.work)}</i></cite>
  </aside>`;
}

/* ---- top: the plaque ---- */
export function setPlaqueQuote() {
  const q = pick('paradiso');
  const el = document.querySelector('.plaque-quote');
  if (!el) return;
  el.innerHTML = `<span class="pq-text">${esc(q.text)}</span><span class="pq-by">${esc(q.by)} · ${esc(q.work)}</span>`;
}

/* ---- bottom: the stone ---- */
export function setStoneQuote() {
  const q = pick('inferno');
  const el = document.querySelector('.stone');
  if (!el) return;
  el.querySelector('.carved').textContent = q.text;
  el.querySelector('.carved-cite').textContent = `${q.by} · ${q.work}`;
}

/* ---- the rails ---- */
let measureCtx;
function textLen(s, px) {
  measureCtx ||= document.createElement('canvas').getContext('2d');
  measureCtx.font = `600 ${px}px Cinzel, "Cormorant Garamond", serif`;
  return measureCtx.measureText(s.toUpperCase()).width + s.length * px * 0.22;
}

function fill(circle, len, px, used) {
  const sep = textLen(' ✦ ', px);
  const bank = QUOTES[circle].filter(q => !used.has(q.short)).sort(() => Math.random() - 0.5);
  const out = [];
  let left = len;
  for (const q of bank) {
    const w = textLen(q.short, px) + (out.length ? sep : 0);
    if (w <= left) { out.push(q); used.add(q.short); left -= w; }
    if (left < 60) break;
  }
  if (!out.length) { // nothing fits: take the shortest and let it spill a little
    const q = [...QUOTES[circle]].sort((a, b) => a.short.length - b.short.length)[0];
    out.push(q);
  }
  return out;
}

export function buildRails() {
  const host = document.querySelector('.rails');
  if (!host) return;
  const H = innerHeight;
  if (innerWidth < 1060 || H < 520) { host.hidden = true; return; }
  host.hidden = false;
  const px = H > 900 ? 11.5 : 10.5;
  const pad = 26;
  const zone = (H - pad * 2) / 3;
  const used = new Set();

  for (const side of ['l', 'r']) {
    const rail = host.querySelector(`.rail-${side}`);
    // top → bottom: paradiso, purgatorio, inferno
    const zones = ['paradiso', 'purgatorio', 'inferno'].map((c, i) => ({
      c, top: pad + i * zone, qs: fill(c, zone - 34, px, used),
    }));
    const zoneHTML = interactive => zones.map(z => `
      <div class="rz" style="top:${z.top}px;height:${zone}px"${interactive
        ? ` title="${esc(z.qs.map(q => `“${q.text}” — ${q.by}, ${q.work}`).join('\n\n'))}"` : ''}>
        <span>${z.qs.map(q => esc(q.short)).join('<b> ✦ </b>')}</span>
      </div>`).join('');
    rail.style.setProperty('--rail-font', `${px}px`);
    rail.innerHTML = `
      <div class="rl carved">${zoneHTML(false)}</div>
      <div class="rl ink">${zoneHTML(false)}</div>
      <div class="rl gold">${zoneHTML(true)}${sparkles(6, pad, zone)}</div>`;
  }
}

function sparkles(n, pad, zone) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const top = pad + Math.random() * zone * 0.95;
    s += `<i class="glint" style="top:${top.toFixed(0)}px;animation-delay:${(Math.random() * 6).toFixed(2)}s;animation-duration:${(3.5 + Math.random() * 3).toFixed(2)}s"></i>`;
  }
  return s;
}

/* ---- glints on the plaque ---- */
export function startPlaqueSparkles() {
  const canvas = document.querySelector('.plaque .sparkle');
  if (!canvas) return;
  const g = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, stars = [], running = false, last = 0, visible = true;

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const n = Math.round(W / 34);
    stars = Array.from({ length: n }, () => spawn(true));
    if (reduced.matches) drawStill();
  };
  const spawn = (initial) => ({
    x: Math.random() * W, y: Math.random() * H,
    r: 1.6 + Math.random() * 3.6,
    t: initial ? Math.random() * Math.PI * 2 : -Math.PI / 2,
    speed: 0.6 + Math.random() * 1.4,
  });
  const star = (x, y, r, a) => {
    g.save();
    g.globalAlpha = a;
    g.translate(x, y);
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, r * 2.2);
    grd.addColorStop(0, 'rgba(255,252,235,.9)');
    grd.addColorStop(1, 'rgba(255,230,160,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(0, 0, r * 2.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fffdf3';
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      const a1 = i * Math.PI / 2;
      g.lineTo(Math.cos(a1) * r * 3, Math.sin(a1) * r * 3);
      g.lineTo(Math.cos(a1 + Math.PI / 4) * r * 0.35, Math.sin(a1 + Math.PI / 4) * r * 0.35);
    }
    g.closePath(); g.fill();
    g.restore();
  };
  const drawStill = () => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    stars.slice(0, 5).forEach(s => star(s.x, s.y, s.r, 0.55));
  };
  const frame = now => {
    if (!running) return;
    requestAnimationFrame(frame);
    if (now - last < 33) return; // ~30fps is plenty for a twinkle
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      s.t += dt * s.speed;
      const a = Math.max(0, Math.sin(s.t));
      if (s.t > Math.PI) { stars[i] = spawn(false); continue; }
      if (a > 0.02) star(s.x, s.y, s.r * (0.5 + a * 0.5), a * a);
    }
  };
  const go = () => {
    if (running || reduced.matches || !visible || document.hidden) return;
    running = true; last = performance.now(); requestAnimationFrame(frame);
  };
  const stop = () => { running = false; };

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? go() : stop(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : go()));
  reduced.addEventListener?.('change', () => (reduced.matches ? (stop(), drawStill()) : go()));
  resize();
  go();
}

export function initFrame() {
  setPlaqueQuote();
  setStoneQuote();
  startPlaqueSparkles();
  let t;
  addEventListener('resize', () => { clearTimeout(t); t = setTimeout(buildRails, 200); });
  (document.fonts?.ready || Promise.resolve()).then(buildRails);
  buildRails();
}

/** Each page turn brings fresh inscriptions. */
export function turnPage() {
  setPlaqueQuote();
  setStoneQuote();
}
