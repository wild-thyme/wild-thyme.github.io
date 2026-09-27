/* The Commonplace Book: every passage she has kept, from every book, in one
   place — searchable, sortable by book, filterable by #tag. Plus a search
   through the full text of all her notes. */

import { esc, $, plural } from './util.js';
import { Store } from './store.js';
import { S, onData } from './state.js';

export function commonplaceView(root, query = {}) {
  let notes = [];
  let term = query.q || '';
  let tag = query.tag || '';
  let bookF = '';
  let drawn = null;

  root.innerHTML = `
    <section class="page commonplace">
      <div class="page-head">
        <div>
          <h1 class="page-title">The Commonplace Book</h1>
          <p class="page-sub">Every passage you’ve kept, from every book.</p>
        </div>
        <div class="page-actions"><button class="btn gold" data-draw>Draw a passage at random</button></div>
      </div>
      <div class="cp-controls">
        <input class="input search" type="search" placeholder="Search passages and notes…" value="${esc(term)}" aria-label="Search">
        <select class="input" data-book aria-label="Book"><option value="">All books</option></select>
      </div>
      <p class="tags cp-tags"></p>
      <div class="drawn" hidden></div>
      <div class="cp-feed"></div>
    </section>`;

  const feed = $('.cp-feed', root);
  const input = $('.search', root);
  const sel = $('[data-book]', root);

  const draw = () => {
    const books = S.books;
    const withNotes = notes.filter(n => books.has(n.bookId || n.id));
    const allQuotes = withNotes.flatMap(n => (n.quotes || []).map(q => ({ ...q, book: books.get(n.bookId || n.id), tags: n.tags || [] })));
    const allTags = [...new Set(withNotes.flatMap(n => n.tags || []))].sort();

    // book filter options (keep selection)
    const opts = withNotes.map(n => books.get(n.bookId || n.id)).filter(b => b && (notes.find(x => x.id === b.id)?.quotes?.length || 0))
      .sort((a, b) => a.title.localeCompare(b.title));
    sel.innerHTML = `<option value="">All books</option>` + opts.map(b => `<option value="${esc(b.id)}" ${b.id === bookF ? 'selected' : ''}>${esc(b.title)}</option>`).join('');

    $('.cp-tags', root).innerHTML = allTags.map(t =>
      `<button class="tag ${t === tag ? 'on' : ''}" data-tag="${esc(t)}">#${esc(t)}</button>`).join('');

    const t = term.toLowerCase();
    let quotes = allQuotes;
    if (bookF) quotes = quotes.filter(q => q.book.id === bookF);
    if (tag) quotes = quotes.filter(q => q.tags.includes(tag));
    if (t) quotes = quotes.filter(q => `${q.text} ${q.book.title} ${q.book.author}`.toLowerCase().includes(t));
    quotes.sort((a, b) => (b.book.finished || b.book.started || '').localeCompare(a.book.finished || a.book.started || '') || a.line - b.line);

    let noteHits = [];
    if (t.length > 1) {
      noteHits = withNotes
        .filter(n => (!bookF || n.id === bookF) && (!tag || (n.tags || []).includes(tag)))
        .map(n => ({ n, book: books.get(n.bookId || n.id), snips: snippets(n.text || '', t) }))
        .filter(h => h.snips.length);
    }

    if (!allQuotes.length && !t) {
      feed.innerHTML = `<div class="empty-state">
        <p>No passages kept yet.</p>
        <p class="muted">Open any book, go to <b>Book Notes</b> and press <b>Quote</b> — or start a line with <b>&gt;</b> and a space. Every passage you keep gathers here.</p></div>`;
      return;
    }

    feed.innerHTML = `
      <p class="muted small">${plural(quotes.length, 'passage')}${tag ? ` tagged #${esc(tag)}` : ''}${bookF ? ` from ${esc(books.get(bookF)?.title || '')}` : ''}</p>
      <div class="quotes">${quotes.map(quoteCard).join('')}</div>
      ${noteHits.length ? `<h2 class="section-title">In your notes</h2>
        <div class="note-hits">${noteHits.map(h => `
          <a class="note-hit" href="#/book/${esc(h.book.id)}/notes">
            <b>${esc(h.book.title)}</b>
            ${h.snips.map(s => `<span>…${s}…</span>`).join('')}
          </a>`).join('')}</div>` : ''}`;
  };

  root.onclick = e => {
    const tg = e.target.closest('[data-tag]');
    if (tg) { tag = tag === tg.dataset.tag ? '' : tg.dataset.tag; draw(); return; }
    if (e.target.closest('[data-draw]')) {
      const pool = notes.flatMap(n => (n.quotes || []).map(q => ({ ...q, book: S.books.get(n.bookId || n.id) }))).filter(q => q.book);
      const box = $('.drawn', root);
      if (!pool.length) { box.hidden = false; box.innerHTML = '<p class="muted">Keep a passage first, then the well will give it back to you.</p>'; return; }
      let q;
      do q = pool[Math.floor(Math.random() * pool.length)]; while (pool.length > 1 && q.text === drawn);
      drawn = q.text;
      box.hidden = false;
      box.innerHTML = `<div class="drawn-card">${quoteCard(q)}</div>`;
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };
  input.oninput = () => { term = input.value.trim(); draw(); };
  sel.onchange = () => { bookF = sel.value; draw(); };

  const unwatch = Store.watch('notes', docs => { notes = docs; draw(); });
  const off = onData(k => { if (k === 'books') draw(); });
  return () => { unwatch(); off(); root.onclick = null; };
}

function quoteCard(q) {
  const b = q.book;
  return `<figure class="qcard">
    <blockquote>${esc(q.text).replace(/\n/g, '<br>')}</blockquote>
    <figcaption><a href="#/book/${esc(b.id)}/notes?line=${q.line}">
      <span>${esc(b.author || '')}</span><i>${esc(b.title)}</i>${q.page ? `<em>p. ${esc(q.page)}</em>` : ''}</a></figcaption>
  </figure>`;
}

function snippets(text, t, max = 3) {
  const out = [];
  const low = text.toLowerCase();
  let i = low.indexOf(t);
  while (i !== -1 && out.length < max) {
    const a = Math.max(0, i - 60), b = Math.min(text.length, i + t.length + 60);
    const flat = s => esc(s.replace(/\s+/g, ' '));
    out.push(flat(text.slice(a, i)) + `<mark>${flat(text.slice(i, i + t.length))}</mark>` + flat(text.slice(i + t.length, b)));
    i = low.indexOf(t, i + t.length + 60);
  }
  return out;
}
