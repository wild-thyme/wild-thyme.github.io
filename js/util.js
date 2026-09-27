/* Small shared helpers: escaping, ids, dates, dialogs, toasts. */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Stable 32-bit hash of a string (FNV-1a), for seeding procedural looks. */
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function debounce(fn, ms) {
  let t;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  d.flush = (...a) => { clearTimeout(t); fn(...a); };
  d.cancel = () => clearTimeout(t);
  return d;
}

/* ---- dates: stored as 'YYYY-MM-DD' strings, shown in words ---- */

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function fmtDate(iso, short = false) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y) return '';
  const mon = MONTHS[(m || 1) - 1];
  if (!d) return `${short ? mon.slice(0, 3) : mon} ${y}`;
  return short ? `${mon.slice(0, 3)} ${d}, ${y}` : `${d} ${mon} ${y}`;
}
export const yearOf = iso => (iso ? Number(iso.slice(0, 4)) || null : null);
export function daysBetween(a, b) {
  if (!a || !b) return null;
  return Math.round((new Date(b) - new Date(a)) / 864e5);
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
export const plural = (n, one, many = one + 's') => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** Sort key that ignores leading articles, so "The Iliad" files under I. */
export const sortTitle = t => String(t || '').toLowerCase().replace(/^(the|a|an)\s+/, '');
export const normKey = (title, author) =>
  `${sortTitle(title).replace(/\s*[(:].*$/, '').replace(/[^a-z0-9]/g, '')}|${String(author || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 24)}`;

/* ---- toast ---- */

let toastT;
export function toast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('show'), ms);
}

/* ---- modal layer ----
   openModal(html, { cls, onMount(el, close), onClose }) → close()
   Escape and a click on the backdrop both close it. */

export function openModal(html, opts = {}) {
  const layer = document.getElementById('layer');
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal ${opts.cls || ''}" role="dialog" aria-modal="true">${html}</div>`;
  layer.appendChild(wrap);
  const prevFocus = document.activeElement;
  document.body.classList.add('modal-open');
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    wrap.classList.add('leaving');
    document.removeEventListener('keydown', onKey, true);
    setTimeout(() => {
      wrap.remove();
      if (!layer.children.length) document.body.classList.remove('modal-open');
    }, 180);
    opts.onClose?.();
    prevFocus?.focus?.({ preventScroll: true });
  };
  const onKey = e => { if (e.key === 'Escape' && !opts.sticky) { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  wrap.addEventListener('mousedown', e => { if (e.target === wrap && !opts.sticky) close(); });
  wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
  // ⌘/Ctrl+Enter submits from inside a textarea, where plain Enter is a new line.
  wrap.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return;
    const f = e.target.closest('form');
    if (f) { e.preventDefault(); f.requestSubmit(); }
  });
  const modal = wrap.firstElementChild;
  requestAnimationFrame(() => wrap.classList.add('in'));
  opts.onMount?.(modal, close);
  const auto = modal.querySelector('[autofocus]');
  if (auto && !matchMedia('(pointer:coarse)').matches) setTimeout(() => auto.focus(), 60);
  return close;
}

export function confirmDialog(title, body, { ok = 'Yes', cancel = 'Never mind', danger = false } = {}) {
  return new Promise(res => {
    let answered = false;
    openModal(`
      <h2 class="modal-title">${esc(title)}</h2>
      ${body ? `<p class="modal-body">${body}</p>` : ''}
      <div class="modal-actions">
        <button class="btn ghost" data-close>${esc(cancel)}</button>
        <button class="btn ${danger ? 'danger' : 'gold'}" data-ok autofocus>${esc(ok)}</button>
      </div>`, {
      cls: 'narrow',
      onMount(el, close) {
        el.querySelector('[data-ok]').onclick = () => { answered = true; res(true); close(); };
      },
      onClose() { if (!answered) res(false); },
    });
  });
}

export function promptDialog(title, { value = '', placeholder = '', ok = 'Save', label = '' } = {}) {
  return new Promise(res => {
    let answered = false;
    openModal(`
      <form class="stack">
        <h2 class="modal-title">${esc(title)}</h2>
        ${label ? `<label class="field-label">${esc(label)}</label>` : ''}
        <input class="input" name="v" value="${esc(value)}" placeholder="${esc(placeholder)}" autofocus autocomplete="off">
        <div class="modal-actions">
          <button type="button" class="btn ghost" data-close>Cancel</button>
          <button class="btn gold">${esc(ok)}</button>
        </div>
      </form>`, {
      cls: 'narrow',
      onMount(el, close) {
        el.querySelector('form').onsubmit = e => {
          e.preventDefault();
          answered = true;
          res(el.querySelector('input').value.trim());
          close();
        };
      },
      onClose() { if (!answered) res(null); },
    });
  });
}

/* ---- images: read a File, shrink it, return a JPEG data URL ----
   Mood-board images live inside the database, which caps a record at 1 MB,
   so everything is downscaled and re-encoded until it fits comfortably. */

export async function shrinkImage(file, maxDim = 1400, maxBytes = 700_000) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    let dim = maxDim, q = 0.84, out, w, h;
    for (let i = 0; i < 6; i++) {
      const s = Math.min(1, dim / Math.max(img.naturalWidth, img.naturalHeight));
      w = Math.max(1, Math.round(img.naturalWidth * s));
      h = Math.max(1, Math.round(img.naturalHeight * s));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.fillStyle = '#14110d';
      g.fillRect(0, 0, w, h);
      g.drawImage(img, 0, 0, w, h);
      out = c.toDataURL('image/jpeg', q);
      if (out.length <= maxBytes) break;
      dim = Math.round(dim * 0.8);
      q = Math.max(0.6, q - 0.06);
    }
    return { src: out, w, h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function loadImage(src, cors = false) {
  return new Promise((res, rej) => {
    const img = new Image();
    if (cors) img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

export function download(filename, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
