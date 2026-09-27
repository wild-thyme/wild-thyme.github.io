/* Sealed letters: when they arrive, the wax seal, and the drawer that keeps them. */

import { SEALED } from './letters.sealed.js';
import { Store } from './store.js';
import { S, stats, saveMeta, onData } from './state.js';
import { esc, openModal, toast, today, fmtDate, debounce, daysBetween } from './util.js';

/* The letters are published sealed (AES-GCM, see build/seal-letters.mjs); the
   key comes from Firestore once she's signed in. Until then there are none. */
let LETTERS = [];
let SIGNATURE = '';
let unsealed = false;

const bytes = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

async function unseal() {
  if (unsealed || !SEALED.letters.length) return unsealed;
  const k = await Store.getSealKey().catch(() => null);
  if (!k) return false;
  try {
    const key = await crypto.subtle.importKey('raw', bytes(k), 'AES-GCM', false, ['decrypt']);
    const open = async s => JSON.parse(new TextDecoder().decode(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(s.iv) }, key, bytes(s.ct))));
    LETTERS = await Promise.all(SEALED.letters.map(async ({ iv, ct, ...l }) => ({ ...l, ...(await open({ iv, ct })) })));
    SIGNATURE = SEALED.signature ? (await open(SEALED.signature)).s : '';
    unsealed = true;
  } catch (err) {
    console.warn('the letters stay sealed', err);
  }
  return unsealed;
}

function met(trigger, s) {
  return [].concat(trigger).some(t => {
    if (t === 'first-open') return true;
    if (t === 'first-book') return s.addedHere >= 1;
    if (t === 'first-passage') return s.quotes >= 1;
    if (t === 'first-pin') return s.pins >= 1;
    if (t === 'five-stars') return s.fiveStars >= 1;
    const m = /^(days|finished|read|words)-(\d+)$/.exec(t);
    if (!m) return false;
    return ({ days: s.days, finished: s.finishedHere, read: s.read, words: s.words })[m[1]] >= Number(m[2]);
  });
}

const state = () => S.meta.letters || {};
const localDay = ts => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const isInvite = l => [].concat(l.trigger || []).includes('first-open');

export const hasLetters = () => LETTERS.length > 0;
export const unread = () => LETTERS.filter(l => state()[l.id]?.arrived && !state()[l.id]?.opened).length;

/** Mark any letter whose moment has come as arrived. Returns the new ones.
    Dated letters come on their day. The rest form a chain: only the next
    one in line can arrive, and never on the same day as the one before. */
export function checkArrivals() {
  if (!S.loaded || !unsealed) return [];
  const st = state();
  const s = stats();
  const now = today();
  const fresh = LETTERS.filter(l => l.date && !st[l.id]?.arrived && l.date <= now);
  let prev = null;
  for (const l of LETTERS.filter(x => !x.date)) {
    if (st[l.id]?.arrived) { prev = st[l.id].arrived; continue; }
    const waited = !prev || daysBetween(localDay(prev), now) >= (l.gap ?? 1);
    if (waited && met(l.trigger, s)) fresh.push(l);
    break;
  }
  if (!fresh.length) return [];
  const next = { ...st };
  for (const l of fresh) next[l.id] = { arrived: Date.now() };
  saveMeta({ letters: next });
  return fresh;
}

export function watchLetters(onChange) {
  let alive = true;
  const run = debounce(() => {
    const fresh = checkArrivals();
    const invite = fresh.find(isInvite);
    if (invite) setTimeout(() => openLetter(invite), 900);
    const others = fresh.filter(l => l !== invite);
    if (others.length) toast(others.length > 1 ? `${others.length} sealed letters have arrived.` : 'A sealed letter has arrived.', 4000);
    onChange?.();
  }, 600);
  unseal().then(ok => { if (!alive) return; onChange?.(); if (ok) run(); });
  const off = onData(k => { if (unsealed && (k === 'books' || k === 'meta')) run(); });
  return () => { alive = false; off(); run.cancel(); };
}

const SEAL = `<svg viewBox="0 0 120 120" class="seal-svg" aria-hidden="true">
  <defs>
    <radialGradient id="wax" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#a3332c"/><stop offset=".55" stop-color="#7a1c19"/><stop offset="1" stop-color="#4d0e0d"/></radialGradient>
  </defs>
  <path fill="url(#wax)" d="M60 6c9 0 12 6 20 8s15 1 20 8 1 13 4 20 10 11 9 19-8 10-10 18 2 15-4 21-14 3-21 7-11 10-19 10-12-6-20-8-15-1-20-8-1-13-4-20S5 68 6 60s8-10 10-18-2-15 4-21 14-3 21-7S52 6 60 6z"/>
  <circle cx="60" cy="60" r="33" fill="none" stroke="#3d0a09" stroke-opacity=".55" stroke-width="2.5"/>
  <circle cx="60" cy="60" r="33" fill="none" stroke="#e08a7a" stroke-opacity=".18" stroke-width="1" transform="translate(0 1.5)"/>
  <g transform="translate(38.5 27) scale(1.08)">
        <g color="#f3a795" opacity=".2" transform="translate(0 1.1)"><path d="M20 58 C20 46 19.2 32 21 12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
        <g fill="currentColor">
          <ellipse cx="14.2" cy="47" rx="4.6" ry="2" transform="rotate(28 14.2 47)"/>
          <ellipse cx="25.6" cy="44.5" rx="4.6" ry="2" transform="rotate(-30 25.6 44.5)"/>
          <ellipse cx="15" cy="37" rx="4.2" ry="1.8" transform="rotate(30 15 37)"/>
          <ellipse cx="25.8" cy="34.5" rx="4.2" ry="1.8" transform="rotate(-32 25.8 34.5)"/>
          <ellipse cx="16.2" cy="27.5" rx="3.6" ry="1.6" transform="rotate(34 16.2 27.5)"/>
          <ellipse cx="25.6" cy="25.5" rx="3.6" ry="1.6" transform="rotate(-34 25.6 25.5)"/>
          <circle cx="21" cy="9.5" r="2.6"/><circle cx="17.4" cy="12.4" r="2.1"/><circle cx="24.6" cy="12.2" r="2.1"/>
          <circle cx="18.6" cy="6.6" r="1.8"/><circle cx="23.6" cy="6.4" r="1.8"/><circle cx="21.2" cy="3.6" r="1.5"/>
          <circle cx="16.2" cy="16.6" r="1.6"/><circle cx="25.8" cy="16.2" r="1.6"/>
        </g></g>
        <g color="#360807" opacity=".88"><path d="M20 58 C20 46 19.2 32 21 12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
        <g fill="currentColor">
          <ellipse cx="14.2" cy="47" rx="4.6" ry="2" transform="rotate(28 14.2 47)"/>
          <ellipse cx="25.6" cy="44.5" rx="4.6" ry="2" transform="rotate(-30 25.6 44.5)"/>
          <ellipse cx="15" cy="37" rx="4.2" ry="1.8" transform="rotate(30 15 37)"/>
          <ellipse cx="25.8" cy="34.5" rx="4.2" ry="1.8" transform="rotate(-32 25.8 34.5)"/>
          <ellipse cx="16.2" cy="27.5" rx="3.6" ry="1.6" transform="rotate(34 16.2 27.5)"/>
          <ellipse cx="25.6" cy="25.5" rx="3.6" ry="1.6" transform="rotate(-34 25.6 25.5)"/>
          <circle cx="21" cy="9.5" r="2.6"/><circle cx="17.4" cy="12.4" r="2.1"/><circle cx="24.6" cy="12.2" r="2.1"/>
          <circle cx="18.6" cy="6.6" r="1.8"/><circle cx="23.6" cy="6.4" r="1.8"/><circle cx="21.2" cy="3.6" r="1.5"/>
          <circle cx="16.2" cy="16.6" r="1.6"/><circle cx="25.8" cy="16.2" r="1.6"/>
        </g></g>
      </g>
</svg>`;

export function openLetter(letter) {
  const st = state()[letter.id] || {};
  const sealed = !st.opened;
  const paras = letter.text.trim().split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  openModal(`
    <div class="letter ${sealed ? 'sealed' : 'open'}">
      <div class="envelope">
        <div class="env-flap"></div>
        <p class="env-to">${esc(letter.title)}</p>
        <button class="seal" aria-label="Break the seal">${SEAL}</button>
        <p class="env-hint">${sealed ? 'Break the seal' : ''}</p>
      </div>
      <article class="letter-page">
        <h2>${esc(letter.title)}</h2>
        ${paras}
        ${SIGNATURE ? `<p class="signature">${esc(SIGNATURE)}</p>` : ''}
        ${st.arrived ? `<p class="letter-date">Arrived ${fmtDate(localDay(st.arrived))}</p>` : ''}
        <div class="modal-actions"><button class="btn ghost" data-close>Fold it away</button></div>
      </article>
    </div>`, {
    cls: 'letter-modal',
    onMount(el) {
      const box = el.querySelector('.letter');
      const open = () => {
        if (box.classList.contains('open')) return;
        box.classList.add('breaking');
        setTimeout(() => { box.classList.remove('sealed', 'breaking'); box.classList.add('open'); }, 650);
        saveMeta({ letters: { ...state(), [letter.id]: { ...(state()[letter.id] || { arrived: Date.now() }), opened: Date.now() } } });
      };
      el.querySelector('.seal').onclick = open;
    },
  });
}

export function lettersView(root) {
  const draw = () => {
    const st = state();
    const all = LETTERS;
    const arrived = all.filter(l => st[l.id]?.arrived).sort((a, b) => st[b.id].arrived - st[a.id].arrived);
    const waiting = all.length - arrived.length;
    root.innerHTML = `
      <section class="page letters-page">
        <div class="page-head"><div>
          <h1 class="page-title">Correspondence</h1>
          <p class="page-sub">Letters sealed for you, kept here once opened.</p>
        </div></div>
        <div class="letter-list">${arrived.map(l => `
          <button class="letter-item ${st[l.id].opened ? 'opened' : 'unopened'}" data-id="${esc(l.id)}">
            <span class="li-seal">${st[l.id].opened ? '✉' : SEAL}</span>
            <span><b>${esc(l.title)}</b><i>${st[l.id].opened ? 'Opened' : 'Sealed'} · ${fmtDate(localDay(st[l.id].arrived), true)}</i></span>
          </button>`).join('') || '<p class="muted">No letters yet.</p>'}
        </div>
        ${waiting ? `<p class="muted waiting">${waiting === 1 ? 'One more letter is' : `${waiting} more letters are`} sealed and waiting for their moment.</p>` : ''}
      </section>`;
  };
  root.onclick = e => {
    const b = e.target.closest('[data-id]');
    if (b) openLetter(LETTERS.find(l => l.id === b.dataset.id));
  };
  draw();
  const off = onData(k => { if (k === 'meta') draw(); });
  return () => { off(); root.onclick = null; };
}
