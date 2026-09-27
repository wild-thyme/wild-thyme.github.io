/* Bring a reading history over from Goodreads or StoryGraph.

   Goodreads: My Books → Import and export → Export Library (a .csv).
   StoryGraph: Manage Account → Export StoryGraph Library (a .csv).

   Reviews and private notes become the first page of that book's notes, so
   nothing she already wrote is lost. Books already in the archive are skipped. */

import { esc, uid, plural, normKey, openModal, toast } from './util.js';
import { Store } from './store.js';
import { S, books } from './state.js';

/* RFC-4180-ish: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const head = (rows.shift() || []).map(h => h.trim());
  return rows.filter(r => r.some(x => x.trim())).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

const isoDate = s => {
  const m = String(s || '').match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : null;
};
const isbn = s => {
  const d = String(s || '').replace(/[^0-9Xx]/g, '');
  return d.length === 13 || d.length === 10 ? d : null;
};
const num = s => { const n = parseFloat(s); return Number.isFinite(n) && n > 0 ? n : null; };
const RESERVED = new Set(['read', 'to-read', 'currently-reading', 'did-not-finish', 'dnf']);
const prettyShelf = s => s.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export function detect(rows) {
  const k = Object.keys(rows[0] || {});
  if (k.includes('Exclusive Shelf')) return 'goodreads';
  if (k.includes('Read Status')) return 'storygraph';
  return null;
}

function fromGoodreads(r) {
  const shelf = r['Exclusive Shelf'];
  const status = shelf === 'read' ? 'read' : shelf === 'currently-reading' ? 'reading'
    : /dnf|did-not-finish|abandon/.test(shelf) ? 'dnf' : 'tbr';
  const extra = (r['Bookshelves'] || '').split(',').map(s => s.trim()).filter(s => s && !RESERVED.has(s) && s !== shelf);
  return {
    title: r['Title'], author: r['Author'],
    isbn: isbn(r['ISBN13']) || isbn(r['ISBN']),
    pages: num(r['Number of Pages']),
    year: num(r['Original Publication Year']) || num(r['Year Published']),
    rating: status === 'read' || status === 'dnf' ? (num(r['My Rating']) || 0) : 0,
    status,
    started: null,
    finished: status === 'read' ? isoDate(r['Date Read']) : null,
    added: isoDate(r['Date Added']),
    shelfNames: extra.map(prettyShelf),
    review: r['My Review'] || '',
    private: r['Private Notes'] || '',
    source: 'goodreads',
  };
}

function fromStoryGraph(r) {
  const st = r['Read Status'];
  const status = st === 'read' ? 'read' : st === 'currently-reading' ? 'reading' : st === 'did-not-finish' ? 'dnf' : 'tbr';
  // "2024/01/02-2024/01/20, 2021/05/01-2021/05/09" → the latest read
  const ranges = (r['Dates Read'] || '').split(',').map(s => s.trim()).filter(Boolean);
  const last = ranges[ranges.length - 1] || '';
  const [a, b] = last.split('-').map(isoDate);
  const tags = (r['Tags'] || '').split(',').map(s => s.trim()).filter(Boolean);
  return {
    title: r['Title'], author: (r['Authors'] || '').split(',')[0].trim(),
    isbn: isbn(r['ISBN/UID']),
    pages: null, year: null,
    rating: num(r['Star Rating']) || 0,
    status,
    started: status === 'tbr' ? null : a || null,
    finished: status === 'read' || status === 'dnf' ? (isoDate(r['Last Date Read']) || b || null) : null,
    added: isoDate(r['Date Added']),
    moods: (r['Moods'] || '').split(',').map(s => s.trim()).filter(Boolean),
    shelfNames: tags.map(prettyShelf),
    review: r['Review'] || '',
    private: '',
    source: 'storygraph',
  };
}

/** Notes seeded from an old review, as a Quill Delta. */
function reviewDelta(entry) {
  const ops = [];
  const add = (heading, body) => {
    const clean = body.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?(b|i|em|strong|spoiler)>/gi, '').replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
    if (!clean) return;
    ops.push({ insert: heading }, { insert: '\n', attributes: { header: 3 } });
    ops.push({ insert: clean.replace(/\n{3,}/g, '\n\n') + '\n' });
  };
  add(`My review, brought over from ${entry.source === 'goodreads' ? 'Goodreads' : 'StoryGraph'}`, entry.review);
  add('Private notes', entry.private);
  return ops;
}

export function openImporter() {
  openModal(`
    <h2 class="modal-title">Bring your books over</h2>
    <div class="import-how">
      <div><b>From Goodreads</b><p>On the website: <i>My Books → Import and export → Export Library</i>. It emails or downloads a <code>.csv</code>.</p></div>
      <div><b>From StoryGraph</b><p><i>Manage Account → Export StoryGraph Library</i>, then download the <code>.csv</code>.</p></div>
    </div>
    <label class="btn gold file-btn">Choose the .csv file<input type="file" accept=".csv,text/csv" hidden></label>
    <div class="import-preview"></div>`, {
    cls: 'wide',
    onMount(el, close) {
      el.querySelector('input').onchange = async e => {
        const f = e.target.files[0];
        if (!f) return;
        const rows = parseCSV(await f.text());
        const kind = detect(rows);
        const box = el.querySelector('.import-preview');
        if (!kind) { box.innerHTML = '<p class="error">That file doesn’t look like a Goodreads or StoryGraph export.</p>'; return; }
        const entries = rows.map(kind === 'goodreads' ? fromGoodreads : fromStoryGraph).filter(x => x.title);
        const have = new Set(books().map(b => normKey(b.title, b.author)));
        const fresh = [], dupes = [];
        const seen = new Set();
        for (const x of entries) {
          const k = normKey(x.title, x.author);
          if (have.has(k) || seen.has(k)) dupes.push(x); else { fresh.push(x); seen.add(k); }
        }
        const count = s => fresh.filter(x => x.status === s).length;
        const shelves = [...new Set(fresh.flatMap(x => x.shelfNames))];
        const reviews = fresh.filter(x => x.review || x.private).length;
        box.innerHTML = `
          <div class="import-sum">
            <p class="big">${plural(fresh.length, 'book')} from ${kind === 'goodreads' ? 'Goodreads' : 'StoryGraph'}</p>
            <ul>
              <li>${count('read')} read · ${count('reading')} reading · ${count('tbr')} want to read${count('dnf') ? ` · ${count('dnf')} did not finish` : ''}</li>
              ${reviews ? `<li>${plural(reviews, 'review')} will become the first page of that book’s notes</li>` : ''}
              ${shelves.length ? `<li>Your own shelves come too: ${shelves.slice(0, 8).map(esc).join(', ')}${shelves.length > 8 ? '…' : ''}</li>` : ''}
              ${dupes.length ? `<li class="muted">${plural(dupes.length, 'book')} already in the archive will be skipped</li>` : ''}
            </ul>
          </div>
          <div class="modal-actions"><button class="btn ghost" data-close>Cancel</button>
            <button class="btn gold" data-go ${fresh.length ? '' : 'disabled'}>Import ${plural(fresh.length, 'book')}</button></div>`;
        box.querySelector('[data-go]')?.addEventListener('click', async ev => {
          ev.target.disabled = true;
          ev.target.textContent = 'Shelving…';
          await runImport(fresh);
          close();
          toast(`${plural(fresh.length, 'book')} shelved. Covers will appear as they’re found.`, 4200);
          location.hash = '#/';
        });
      };
    },
  });
}

// In synced mode a write resolves only once the server has it; the local copy
// is already there, so don't keep her waiting on a slow connection.
const settle = p => Promise.race([p, new Promise(r => setTimeout(r, 4000))]);

async function runImport(entries) {
  // shelves first, matching existing names
  const byName = new Map(S.shelves.map(s => [s.name.toLowerCase(), s]));
  const newShelves = [];
  for (const name of new Set(entries.flatMap(x => x.shelfNames))) {
    if (!byName.has(name.toLowerCase())) {
      const s = { id: uid(), name, order: S.shelves.length + newShelves.length, createdAt: Date.now() };
      byName.set(name.toLowerCase(), s);
      newShelves.push(s);
    }
  }
  if (newShelves.length) await settle(Store.putMany('shelves', newShelves));

  const now = Date.now();
  const bookDocs = [], noteDocs = [];
  entries.forEach((x, i) => {
    const id = uid() + i.toString(36);
    const ops = reviewDelta(x);
    const words = ops.reduce((n, o) => n + (typeof o.insert === 'string' ? (o.insert.match(/\S+/g) || []).length : 0), 0);
    bookDocs.push({
      id, title: x.title.trim(), author: (x.author || '').trim(), isbn: x.isbn, pages: x.pages, year: x.year,
      cover: null, coverSearched: false,
      status: x.status, started: x.started, finished: x.finished, rating: x.rating,
      shelves: x.shelfNames.map(n => byName.get(n.toLowerCase()).id),
      moods: x.moods?.length ? x.moods : undefined,
      added: x.added || null, createdAt: now - i, importedFrom: x.source,
      noteStats: ops.length ? { words, quotes: 0 } : undefined,
    });
    if (ops.length) {
      noteDocs.push({ id, bookId: id, ops, text: ops.map(o => o.insert).join(''), quotes: [], tags: [], outline: [], words });
    }
  });
  await settle(Promise.all([
    Store.putMany('books', bookDocs),
    noteDocs.length ? Store.putMany('notes', noteDocs) : null,
  ]));
}
