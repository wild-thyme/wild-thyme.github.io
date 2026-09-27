/* In-memory mirror of the library, kept current by Store.watch, plus the
   rules for which shelves exist and what sits on them. */

import { Store } from './store.js';
import { uid, today, yearOf, sortTitle, normKey } from './util.js';

export const S = {
  books: new Map(),
  shelves: [],       // custom shelves: { id, name, order }
  meta: {},          // users/{uid}/meta/settings
  loaded: false,
};

const subs = new Set();
export const onData = cb => (subs.add(cb), () => subs.delete(cb));
const emit = kind => subs.forEach(cb => cb(kind));

let unsubs = [];
export function startWatching(onFirst) {
  stopWatching();
  let pending = 3;
  const first = () => { if (--pending === 0) { S.loaded = true; onFirst?.(); } };
  let a = false, b = false, c = false;
  unsubs.push(Store.watch('books', docs => {
    S.books = new Map(docs.map(d => [d.id, d]));
    emit('books');
    if (!a) { a = true; first(); }
  }));
  unsubs.push(Store.watch('shelves', docs => {
    S.shelves = docs.sort((x, y) => (x.order ?? 0) - (y.order ?? 0) || x.name.localeCompare(y.name));
    emit('shelves');
    if (!b) { b = true; first(); }
  }));
  unsubs.push(Store.watchDoc('meta', 'settings', d => {
    S.meta = d || {};
    emit('meta');
    if (!c) { c = true; first(); }
  }));
}
export function stopWatching() { unsubs.forEach(u => u()); unsubs = []; S.loaded = false; }

export const STATUS = {
  tbr: 'Want to read',
  reading: 'Reading',
  read: 'Read',
  dnf: 'Did not finish',
};

export const books = () => [...S.books.values()];

/* ---- shelves ---- */

const byFinishedDesc = (a, b) => (b.finished || '').localeCompare(a.finished || '') || sortTitle(a.title).localeCompare(sortTitle(b.title));
const byStartedDesc = (a, b) => (b.started || b.added || '').localeCompare(a.started || a.added || '');
const byAddedDesc = (a, b) => (b.added || '').localeCompare(a.added || '') || (b.createdAt || 0) - (a.createdAt || 0);
const byTitle = (a, b) => sortTitle(a.title).localeCompare(sortTitle(b.title));

/** Every shelf, in the order they stand in the library. */
export function allShelves() {
  const all = books();
  const now = new Date().getFullYear();
  const out = [];
  const reading = all.filter(b => b.status === 'reading').sort(byStartedDesc);
  if (reading.length) out.push({ id: 'reading', name: 'Currently Reading', kind: 'auto', books: reading });

  const years = new Map();
  const undated = [];
  for (const b of all) {
    if (b.status !== 'read') continue;
    const y = yearOf(b.finished);
    if (!y) { undated.push(b); continue; }
    if (!years.has(y)) years.set(y, []);
    years.get(y).push(b);
  }
  const yearShelf = y => ({ id: `year-${y}`, name: `${y} Reads`, kind: 'year', year: y, books: (years.get(y) || []).sort(byFinishedDesc) });
  out.push(yearShelf(now)); // always, even empty: it's the one she fills this year

  out.push({ id: 'tbr', name: 'To Be Read', kind: 'auto', books: all.filter(b => b.status === 'tbr').sort(byAddedDesc) });

  for (const s of S.shelves) {
    out.push({ id: s.id, name: s.name, kind: 'custom', books: all.filter(b => (b.shelves || []).includes(s.id)).sort(byTitle) });
  }
  for (const y of [...years.keys()].filter(y => y !== now).sort((a, b) => b - a)) out.push(yearShelf(y));
  if (undated.length) out.push({ id: 'undated', name: 'Read, Undated', kind: 'auto', books: undated.sort(byTitle) });
  const dnf = all.filter(b => b.status === 'dnf').sort(byStartedDesc);
  if (dnf.length) out.push({ id: 'dnf', name: 'Did Not Finish', kind: 'auto', books: dnf });
  return out;
}

export const shelfById = id => allShelves().find(s => s.id === id)
  || (id.startsWith('year-') ? { id, name: `${id.slice(5)} Reads`, kind: 'year', books: [] } : null);

/** The automatic shelf a book lives on, for its page header. */
export function homeShelf(b) {
  if (b.status === 'reading') return { id: 'reading', name: 'Currently Reading' };
  if (b.status === 'tbr') return { id: 'tbr', name: 'To Be Read' };
  if (b.status === 'dnf') return { id: 'dnf', name: 'Did Not Finish' };
  const y = yearOf(b.finished);
  return y ? { id: `year-${y}`, name: `${y} Reads` } : { id: 'undated', name: 'Read, Undated' };
}

/* ---- writes ---- */

export function newBook(fields) {
  const b = {
    id: uid(),
    title: '', author: '', cover: null, year: null, pages: null, isbn: null,
    status: 'tbr', started: null, finished: null, rating: 0,
    shelves: [], added: today(), createdAt: Date.now(),
    ...fields,
  };
  Store.put('books', b);
  S.books.set(b.id, b); // so its page can open before the write comes back round
  return b;
}

/** Changing status fills in the obvious date so she doesn't have to. */
export function statusPatch(b, status) {
  const p = { status };
  if (status === 'reading' && !b.started) p.started = today();
  if (status === 'read' && !b.finished) p.finished = today();
  if (status === 'dnf' && !b.finished) p.finished = today();
  return p;
}

export function findDuplicate(title, author) {
  const k = normKey(title, author);
  return books().find(b => normKey(b.title, b.author) === k) || null;
}

export async function addShelf(name) {
  const s = { id: uid(), name: name.trim(), order: S.shelves.length, createdAt: Date.now() };
  Store.put('shelves', s);
  return s;
}

export function saveMeta(fields) {
  S.meta = { ...S.meta, ...fields };
  return Store.patch('meta', 'settings', fields);
}

/** Numbers used by the letters and a few headers. */
export function stats() {
  const all = books();
  const now = new Date().getFullYear();
  const read = all.filter(b => b.status === 'read');
  return {
    total: all.length,
    read: read.length,
    readThisYear: read.filter(b => yearOf(b.finished) === now).length,
    reading: all.filter(b => b.status === 'reading').length,
    fiveStars: read.filter(b => b.rating >= 5).length,
    words: all.reduce((n, b) => n + (b.noteStats?.words || 0), 0),
    quotes: all.reduce((n, b) => n + (b.noteStats?.quotes || 0), 0),
    pins: (S.meta.pinCount || 0),
    // what she's done here, which a Goodreads import can't inflate
    addedHere: all.filter(b => !b.importedFrom).length,
    finishedHere: read.filter(b => !b.importedFrom).length,
    days: S.meta.daysActive || 0,
  };
}
