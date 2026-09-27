/* One book: its particulars up top, then the tabs — Book Notes and Mood Board. */

import { esc, fmtDate, daysBetween, openModal, confirmDialog, toast, shrinkImage, $ } from './util.js';
import { S, STATUS, homeShelf, statusPatch, addShelf, onData } from './state.js';
import { Store } from './store.js';
import { coverHTML, searchBooks } from './covers.js';
import { mountRater } from './stars.js';
import { notesTab } from './notes.js';
import { boardView } from './board.js';

const TABS = { notes: 'Book Notes', board: 'Mood Board' };

export function bookView(root, id, tab = 'notes', query = {}) {
  if (!TABS[tab]) tab = 'notes';
  let book = S.books.get(id);
  if (!book) {
    // It may simply not have arrived yet (just added, or synced from her other device).
    root.innerHTML = '<p class="loading">Finding the volume…</p>';
    let inner = null;
    const t = setTimeout(() => {
      if (!S.books.get(id)) root.innerHTML = `<section class="page"><p class="muted">This volume isn’t in the archive. <a href="#/">Back to the shelves</a></p></section>`;
    }, 3000);
    const off = onData(k => {
      if (k !== 'books' || inner || !S.books.get(id)) return;
      off(); clearTimeout(t);
      inner = bookView(root, id, tab, query);
    });
    return () => { off(); clearTimeout(t); inner?.(); };
  }

  root.innerHTML = `
    <section class="page book">
      <div class="book-head"></div>
      <nav class="tabs" role="tablist">
        ${Object.entries(TABS).map(([k, v]) =>
          `<a role="tab" href="#/book/${esc(id)}/${k}" aria-selected="${k === tab}" class="${k === tab ? 'on' : ''}">${v}</a>`).join('')}
      </nav>
      <div class="tab-body"></div>
    </section>`;

  const head = $('.book-head', root);
  let sig = '';
  const drawHead = () => {
    // Only redraw for changes she'd see here; saving notes touches the
    // book too, and redrawing mid-sentence would steal focus from the editor.
    const s = JSON.stringify([book.title, book.author, book.cover, book.isbnMiss, book.status, book.started, book.finished,
      book.rating, book.shelves, book.pages, book.year, book.moods, S.shelves.map(x => x.id + x.name)]);
    if (s === sig) return;
    sig = s;
    renderHead(head, book);
  };
  drawHead();

  const body = $('.tab-body', root);
  const cleanupTab = tab === 'notes' ? notesTab(body, book, query) : boardView(body, { bookId: id, book });

  let goneT;
  const off = onData(kind => {
    if (kind !== 'books' && kind !== 'shelves') return;
    const next = S.books.get(id);
    if (!next) {
      // Deleted — or a stale read raced a fresh write. Give it a moment before leaving.
      clearTimeout(goneT);
      goneT = setTimeout(() => { if (!S.books.get(id)) location.hash = '#/'; }, 1500);
      return;
    }
    book = next;
    drawHead();
  });

  return () => { off(); clearTimeout(goneT); cleanupTab?.(); };
}

function renderHead(el, b) {
  const home = homeShelf(b);
  const custom = S.shelves.filter(s => (b.shelves || []).includes(s.id));
  const took = b.status === 'read' ? daysBetween(b.started, b.finished) : null;
  const needStart = b.status !== 'tbr';
  const needEnd = b.status === 'read' || b.status === 'dnf';

  el.innerHTML = `
    <a class="back" href="#/shelf/${esc(home.id)}">← ${esc(home.name)}</a>
    <div class="book-grid">
      <div class="book-cover">
        ${coverHTML(b, { large: true, cls: 'big' })}
        <button class="linkish small" data-act="cover">Change cover</button>
      </div>
      <div class="book-info">
        <h1 class="book-title">${esc(b.title)}</h1>
        ${b.author ? `<p class="book-author">by ${esc(b.author)}</p>` : ''}
        ${needEnd ? `<div class="book-rating" data-rater></div>` : ''}
        <div class="seg status" role="radiogroup" aria-label="Status">${Object.entries(STATUS).map(([k, v]) =>
          `<button role="radio" aria-checked="${b.status === k}" data-status="${k}">${v}</button>`).join('')}</div>
        ${needStart ? `<div class="row dates">
          <label class="field"><span class="field-label">Started</span>
            <input class="input" type="date" data-date="started" value="${b.started || ''}"></label>
          ${needEnd ? `<label class="field"><span class="field-label">${b.status === 'dnf' ? 'Set aside' : 'Finished'}</span>
            <input class="input" type="date" data-date="finished" value="${b.finished || ''}"></label>` : ''}
          ${took != null && took >= 0 ? `<span class="took">${took === 0 ? 'in a single day' : `${took + 1} days`}</span>` : ''}
        </div>` : ''}
        <div class="chips">
          <a class="chip auto" href="#/shelf/${esc(home.id)}">${esc(home.name)}</a>
          ${custom.map(s => `<span class="chip">${esc(s.name)}<button aria-label="Remove from ${esc(s.name)}" data-unshelf="${esc(s.id)}">×</button></span>`).join('')}
          <button class="chip add" data-act="shelf">+ shelf</button>
        </div>
        <p class="book-facts">${[
          b.pages ? `${b.pages} pages` : '',
          b.year ? `first published ${b.year}` : '',
          b.added ? `added ${fmtDate(b.added, true)}` : '',
        ].filter(Boolean).join(' · ')}</p>
        ${b.moods?.length ? `<p class="moods">${b.moods.map(m => `<span>${esc(m)}</span>`).join('')}</p>` : ''}
      </div>
      <button class="icon-btn" data-act="menu" aria-label="More">⋯</button>
    </div>`;

  const r = el.querySelector('[data-rater]');
  if (r) mountRater(r, b.rating, v => Store.patch('books', b.id, { rating: v }));

  el.querySelectorAll('[data-status]').forEach(btn => {
    btn.onclick = () => { if (btn.dataset.status !== b.status) Store.patch('books', b.id, statusPatch(b, btn.dataset.status)); };
  });
  el.querySelectorAll('[data-date]').forEach(inp => {
    inp.onchange = () => Store.patch('books', b.id, { [inp.dataset.date]: inp.value || null });
  });
  el.querySelectorAll('[data-unshelf]').forEach(x => {
    x.onclick = () => Store.patch('books', b.id, { shelves: (b.shelves || []).filter(s => s !== x.dataset.unshelf) });
  });
  el.querySelector('[data-act=shelf]').onclick = () => shelfPicker(b);
  el.querySelector('[data-act=cover]').onclick = () => coverPicker(b);
  el.querySelector('[data-act=menu]').onclick = () => bookMenu(b);
}

function shelfPicker(b) {
  openModal(`
    <h2 class="modal-title">Put it on a shelf</h2>
    <div class="shelf-pick">${S.shelves.map(s => `
      <label class="chip-check"><input type="checkbox" value="${esc(s.id)}" ${(b.shelves || []).includes(s.id) ? 'checked' : ''}><span>${esc(s.name)}</span></label>`).join('')
      || '<p class="muted">No shelves of your own yet — make one. Favourites? Comfort reads? Books that ruined you?</p>'}
    </div>
    <form class="row new-shelf"><input class="input" placeholder="New shelf name" aria-label="New shelf name"><button class="btn ghost">Make shelf</button></form>
    <div class="modal-actions"><button class="btn gold" data-close>Done</button></div>`, {
    cls: 'narrow',
    onMount(el) {
      const sync = () => Store.patch('books', b.id, {
        shelves: [...el.querySelectorAll('.shelf-pick input:checked')].map(i => i.value),
      });
      el.querySelector('.shelf-pick').onchange = sync;
      el.querySelector('.new-shelf').onsubmit = async e => {
        e.preventDefault();
        const inp = e.target.querySelector('input');
        const name = inp.value.trim();
        if (!name) return;
        const s = await addShelf(name);
        el.querySelector('.shelf-pick').querySelector('p')?.remove();
        el.querySelector('.shelf-pick').insertAdjacentHTML('beforeend',
          `<label class="chip-check"><input type="checkbox" value="${esc(s.id)}" checked><span>${esc(s.name)}</span></label>`);
        inp.value = '';
        sync();
      };
    },
  });
}

function coverPicker(b) {
  openModal(`
    <h2 class="modal-title">Choose a cover</h2>
    <p class="muted small">Editions from Open Library, or a photo of your own copy.</p>
    <div class="cover-choices"><p class="muted pulse">Looking…</p></div>
    <div class="row wrap">
      <label class="btn ghost">Upload a photo<input type="file" accept="image/*" hidden></label>
      <button class="btn ghost" data-leather>Plain leather binding</button>
    </div>
    <div class="modal-actions"><button class="btn ghost" data-close>Cancel</button></div>`, {
    cls: 'wide',
    async onMount(el, close) {
      el.querySelector('[data-leather]').onclick = () => {
        Store.patch('books', b.id, { cover: null, coverSearched: true, coverManual: true, isbnMiss: true });
        close();
      };
      el.querySelector('input[type=file]').onchange = async e => {
        const f = e.target.files[0];
        if (!f) return;
        const { src } = await shrinkImage(f, 700, 300_000);
        Store.patch('books', b.id, { cover: src, coverManual: true });
        close();
      };
      const box = el.querySelector('.cover-choices');
      try {
        const res = (await searchBooks('', { limit: 24, title: b.title, author: b.author })).filter(r => r.cover);
        const seen = new Set();
        const uniq = res.filter(r => !seen.has(r.cover) && seen.add(r.cover));
        box.innerHTML = uniq.length
          ? uniq.map(r => `<button class="cover-choice" data-src="${esc(r.cover)}"><img src="${esc(r.cover)}" alt="" loading="lazy" crossorigin="anonymous"></button>`).join('')
          : '<p class="muted">Open Library has no covers for this one.</p>';
        box.onclick = e => {
          const c = e.target.closest('[data-src]');
          if (!c) return;
          Store.patch('books', b.id, { cover: c.dataset.src, coverManual: true, isbnMiss: false });
          close();
        };
      } catch {
        box.innerHTML = '<p class="muted">Couldn’t reach Open Library just now.</p>';
      }
    },
  });
}

function bookMenu(b) {
  openModal(`
    <h2 class="modal-title">${esc(b.title)}</h2>
    <div class="menu-list">
      <button data-m="edit">Edit title, author &amp; details</button>
      <button data-m="print">Print or save the notes as PDF</button>
      <button data-m="md">Download the notes as a text file</button>
      <button data-m="delete" class="danger">Remove from the archive…</button>
    </div>`, {
    cls: 'narrow',
    onMount(el, close) {
      el.querySelector('[data-m=edit]').onclick = () => { close(); editDetails(b); };
      el.querySelector('[data-m=print]').onclick = () => {
        close();
        if (!location.hash.includes('/notes') && location.hash.includes('/board')) location.hash = `#/book/${b.id}/notes`;
        setTimeout(() => window.print(), 400);
      };
      el.querySelector('[data-m=md]').onclick = async () => {
        close();
        const { notesMarkdown } = await import('./notes.js');
        notesMarkdown(b);
      };
      el.querySelector('[data-m=delete]').onclick = async () => {
        close();
        const ok = await confirmDialog('Remove this book?',
          `<i>${esc(b.title)}</i>, its notes and its mood board will be gone for good.`, { ok: 'Remove it', danger: true });
        if (!ok) return;
        const pins = await Store.list('pins', ['bookId', b.id]);
        await Promise.all([
          Store.remove('books', b.id),
          Store.remove('notes', b.id),
          pins.length ? Store.removeMany('pins', pins.map(p => p.id)) : null,
        ]);
        toast('Removed from the archive.');
        location.hash = '#/';
      };
    },
  });
}

async function editDetails(b) {
  openModal(`
    <form class="stack">
      <h2 class="modal-title">Details</h2>
      <label class="field"><span class="field-label">Title</span><input class="input" name="title" value="${esc(b.title)}" required></label>
      <label class="field"><span class="field-label">Author</span><input class="input" name="author" value="${esc(b.author || '')}"></label>
      <div class="row">
        <label class="field"><span class="field-label">Pages</span><input class="input" name="pages" type="number" min="0" value="${b.pages || ''}"></label>
        <label class="field"><span class="field-label">First published</span><input class="input" name="year" type="number" value="${b.year || ''}"></label>
      </div>
      <div class="modal-actions"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn gold">Save</button></div>
    </form>`, {
    cls: 'narrow',
    onMount(el, close) {
      el.querySelector('form').onsubmit = e => {
        e.preventDefault();
        const f = new FormData(e.target);
        Store.patch('books', b.id, {
          title: f.get('title').trim() || b.title,
          author: f.get('author').trim(),
          pages: Number(f.get('pages')) || null,
          year: Number(f.get('year')) || null,
        });
        close();
      };
    },
  });
}

