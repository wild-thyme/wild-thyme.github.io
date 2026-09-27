/* The Bank Where the Wild Thyme Blows — boot, the door, and the router. */

import { Store, authMessage, readLocalArchive } from './store.js';
import { S, startWatching, stopWatching, saveMeta } from './state.js';
import { initFrame, turnPage } from './frame.js';
import { libraryView, shelfView } from './library.js';
import { bookView } from './book.js';
import { bowerView } from './board.js';
import { commonplaceView } from './commonplace.js';
import { settingsView } from './settings.js';
import { lettersView, watchLetters, hasLetters, unread } from './correspondence.js';
import { $, $$, esc, confirmDialog, plural, toast, today } from './util.js';

const view = $('#view');
let cleanup = null;
let lastBook = null;

function parse() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  return {
    parts: path.split('/').filter(Boolean).map(decodeURIComponent),
    query: Object.fromEntries(new URLSearchParams(qs || '')),
  };
}

function route() {
  if (!S.loaded) return;
  cleanup?.();
  cleanup = null;
  const { parts: [a, b, c], query } = parse();
  let nav = 'library';
  const sameBook = a === 'book' && b === lastBook;
  lastBook = a === 'book' ? b : null;

  if (!a) cleanup = libraryView(view);
  else if (a === 'shelf' && b) cleanup = shelfView(view, b);
  else if (a === 'book' && b) cleanup = bookView(view, b, c, query);
  else if (a === 'commonplace') { nav = 'commonplace'; cleanup = commonplaceView(view, query); }
  else if (a === 'bower') { nav = 'bower'; cleanup = bowerView(view); }
  else if (a === 'letters') { nav = 'letters'; cleanup = lettersView(view); }
  else if (a === 'settings') { nav = 'settings'; cleanup = settingsView(view, b); }
  else { location.replace('#/'); return; }

  $$('.nav [data-nav]').forEach(l => l.classList.toggle('on', l.dataset.nav === nav));
  if (!sameBook) {
    turnPage();
    scrollTo(0, 0);
  }
}

/* ---- the door (only when syncing through the cloud) ---- */
function showDoor() {
  cleanup?.();
  cleanup = null;
  let mode = 'in';
  const draw = (msg = '') => {
    view.innerHTML = `
      <section class="page door">
        <form class="door-card" novalidate>
          <p class="door-eyebrow">A society of readers · members only</p>
          <h1>Who’s there?</h1>
          <p class="door-cite">Hamlet, I.i</p>
          <label class="field"><span class="field-label">Email</span>
            <input class="input" name="email" type="email" autocomplete="email" required></label>
          ${mode === 'reset' ? '' : `<label class="field"><span class="field-label">Passphrase</span>
            <input class="input" name="pw" type="password" autocomplete="${mode === 'up' ? 'new-password' : 'current-password'}" required minlength="6"></label>`}
          ${msg ? `<p class="door-msg">${esc(msg)}</p>` : ''}
          <button class="btn gold big">${mode === 'up' ? 'Take the oath' : mode === 'reset' ? 'Send a new passphrase' : 'Enter'}</button>
          <p class="door-alt">
            ${mode === 'in' ? `<button type="button" class="linkish" data-mode="up">First time? Take the oath</button>
                               <button type="button" class="linkish" data-mode="reset">Forgotten the passphrase?</button>`
              : `<button type="button" class="linkish" data-mode="in">I’m already a member</button>`}
          </p>
        </form>
      </section>`;
    const form = $('form', view);
    form.onclick = e => { const m = e.target.closest('[data-mode]'); if (m) { mode = m.dataset.mode; draw(); } };
    form.onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(form);
      const email = String(f.get('email') || '').trim();
      const pw = String(f.get('pw') || '');
      const btn = $('button.gold', form);
      btn.disabled = true;
      try {
        if (mode === 'reset') { await Store.resetPassword(email); mode = 'in'; draw('A letter is on its way to that address.'); return; }
        await (mode === 'up' ? Store.signUp(email, pw) : Store.signIn(email, pw));
      } catch (err) {
        draw(authMessage(err));
      }
    };
  };
  draw();
}

/* ---- nav bits: letters badge, sync dot ---- */
function updateLetters() {
  const link = $('.nav-letters');
  link.hidden = !hasLetters();
  const n = unread();
  const badge = $('.badge', link);
  badge.hidden = !n;
  badge.textContent = n || '';
}

function updateSync(st) {
  const dot = $('.sync-dot');
  if (st.mode === 'local') { dot.dataset.state = 'local'; dot.title = 'Kept in this browser only'; return; }
  const s = !st.online ? 'offline' : st.pending ? 'syncing' : 'synced';
  dot.dataset.state = s;
  dot.title = { offline: 'Offline — saved on this device, will sync later', syncing: 'Syncing…', synced: 'Synced' }[s];
}

/* ---- carry books kept in this browser (before syncing) into her account ---- */
async function offerCarryOver() {
  if (Store.mode !== 'cloud' || S.meta.carriedOver) return;
  const local = await readLocalArchive().catch(() => null);
  if (!local) return;
  const fresh = local.books.filter(b => !S.books.has(b.id));
  if (!fresh.length) { saveMeta({ carriedOver: true }); return; }
  const ok = await confirmDialog('Bring your books along?',
    `This browser is still holding ${plural(fresh.length, 'book')} from before you had an account. Carry them — with their notes and mood boards — into your archive, so they’re on every device?`,
    { ok: 'Bring them', cancel: 'Not now' });
  if (!ok) return;
  for (const c of ['shelves', 'books', 'notes', 'pins']) if (local[c].length) await Store.putMany(c, local[c]).catch(() => {});
  saveMeta({ carriedOver: true });
  toast(`${plural(fresh.length, 'book')} carried into the archive.`);
}

/* ---- boot ---- */
let lettersOff = null;

async function boot() {
  initFrame();
  view.innerHTML = '<p class="loading">Lighting the candles…</p>';
  try {
    await Store.init();
  } catch (err) {
    console.error(err);
    view.innerHTML = `<section class="page"><p class="muted">The archive couldn’t be opened${navigator.onLine ? '' : ' (no connection)'}.
      <button class="linkish" onclick="location.reload()">Try again</button></p></section>`;
    return;
  }
  Store.onStatus(updateSync);
  Store.onAuth(user => {
    document.body.classList.toggle('locked', !user);
    if (!user) { stopWatching(); lettersOff?.(); lettersOff = null; showDoor(); return; }
    view.innerHTML = '<p class="loading">Lighting the candles…</p>';
    startWatching(() => {
      // One more day in the library (the letters pace themselves by this).
      if (S.meta.lastDay !== today()) saveMeta({ lastDay: today(), daysActive: (S.meta.daysActive || 0) + 1 });
      route();
      lettersOff ||= watchLetters(updateLetters);
      setTimeout(offerCarryOver, 1500);
    });
  });
  addEventListener('hashchange', route);
}

boot();

if ('serviceWorker' in navigator && !/[?&]nosw\b/.test(location.search)) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
