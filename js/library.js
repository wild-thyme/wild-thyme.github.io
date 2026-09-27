/* The library: shelves of covers, one shelf per row; and a single shelf opened out. */

import { esc, plural, fmtDate, sortTitle, $ } from './util.js';
import { allShelves, shelfById, books, onData } from './state.js';
import { coverHTML } from './covers.js';
import { starsHTML } from './stars.js';
import { openAddBook } from './addbook.js';
import { pick } from './quotes.js';
import { epigraph } from './frame.js';

function tile(b) {
  return `<a class="tile" href="#/book/${esc(b.id)}" title="${esc(b.title)}${b.author ? ' — ' + esc(b.author) : ''}">
    ${coverHTML(b)}
    <span class="tile-meta">${b.rating ? starsHTML(b.rating, 'tiny') : ''}</span>
  </a>`;
}

function shelfRow(s) {
  const empty = !s.books.length;
  return `<section class="shelf" data-shelf="${esc(s.id)}">
    <header class="shelf-head">
      <a class="shelf-name" href="#/shelf/${esc(s.id)}"><h2>${esc(s.name)}</h2></a>
      <span class="shelf-count">${s.books.length || ''}</span>
      ${s.books.length > 4 ? `<a class="shelf-all" href="#/shelf/${esc(s.id)}">See all</a>` : ''}
    </header>
    <div class="shelf-row ${empty ? 'empty' : ''}">
      ${empty
        ? `<button class="slot" data-add="${s.id === 'tbr' ? 'tbr' : s.kind === 'year' ? 'read' : ''}">
             <span>${s.kind === 'year' ? 'The first volume of the year goes here' : 'Nothing here yet'}</span><b>+ add a book</b></button>`
        : s.books.map(tile).join('')}
    </div>
    <div class="plank" aria-hidden="true"></div>
  </section>`;
}

export function libraryView(root) {
  let filter = '';

  const draw = () => {
    const shelves = allShelves();
    const all = books();
    const now = new Date().getFullYear();
    const thisYear = shelves.find(s => s.id === `year-${now}`)?.books.length || 0;
    const firstTime = !all.length;

    let body;
    if (filter) {
      const f = filter.toLowerCase();
      const hits = all.filter(b => `${b.title} ${b.author}`.toLowerCase().includes(f))
        .sort((a, b) => sortTitle(a.title).localeCompare(sortTitle(b.title)));
      body = `<section class="shelf"><header class="shelf-head"><h2>Found ${plural(hits.length, 'volume')}</h2></header>
        <div class="grid">${hits.map(gridCard).join('') || '<p class="muted">Nothing in the archive by that name.</p>'}</div></section>`;
    } else {
      const rows = shelves.map(shelfRow);
      // Halfway down the page, a line printed into the page itself.
      rows.splice(Math.min(2, rows.length), 0, epigraph(pick('purgatorio')));
      body = rows.join('');
    }

    root.innerHTML = `
      <section class="page lib">
        <div class="page-head">
          <div>
            <h1 class="page-title">The Archive</h1>
            <p class="page-sub">${firstTime
              ? 'Every member keeps a shelf. Yours is waiting.'
              : `${plural(all.length, 'volume')} · ${thisYear} read in ${now}`}</p>
          </div>
          <div class="page-actions">
            ${all.length > 8 ? `<input class="input search" type="search" placeholder="Find a book…" value="${esc(filter)}" aria-label="Find a book">` : ''}
            <button class="btn gold" data-add="">+ Add a book</button>
          </div>
        </div>
        ${firstTime ? `<div class="welcome card">
            <p>Add books one at a time, or bring your whole history over from Goodreads or StoryGraph.</p>
            <div class="row"><button class="btn gold" data-add="">Add a book</button>
            <a class="btn ghost" href="#/settings/import">Import from Goodreads / StoryGraph</a></div></div>` : ''}
        ${body}
      </section>`;

    const input = $('.search', root);
    if (input) {
      input.oninput = () => {
        filter = input.value.trim();
        const pos = input.selectionStart;
        draw();
        const again = $('.search', root);
        again.focus();
        again.setSelectionRange(pos, pos);
      };
    }
  };

  root.onclick = e => {
    const add = e.target.closest('[data-add]');
    if (add) openAddBook({ status: add.dataset.add || undefined });
  };

  draw();
  const off = onData(k => { if (k === 'books' || k === 'shelves') draw(); });
  return () => { off(); root.onclick = null; };
}

function gridCard(b) {
  const dates = b.status === 'read' && b.finished ? `Finished ${fmtDate(b.finished, true)}`
    : b.status === 'reading' ? (b.started ? `Since ${fmtDate(b.started, true)}` : 'Reading now')
    : b.status === 'dnf' ? 'Set aside' : '';
  return `<a class="card-book" href="#/book/${esc(b.id)}">
    ${coverHTML(b)}
    <span class="cb-title">${esc(b.title)}</span>
    <span class="cb-author">${esc(b.author || '')}</span>
    ${b.rating ? starsHTML(b.rating, 'small') : ''}
    ${dates ? `<span class="cb-date">${dates}</span>` : ''}
  </a>`;
}

const SORTS = {
  finished: ['Date finished', (a, b) => (b.finished || '').localeCompare(a.finished || '')],
  rating: ['Rating', (a, b) => (b.rating || 0) - (a.rating || 0) || (b.finished || '').localeCompare(a.finished || '')],
  title: ['Title', (a, b) => sortTitle(a.title).localeCompare(sortTitle(b.title))],
  author: ['Author', (a, b) => (a.author || '').split(' ').pop().localeCompare((b.author || '').split(' ').pop())],
  added: ['Date added', (a, b) => (b.added || '').localeCompare(a.added || '')],
};

export function shelfView(root, id) {
  let sort = id.startsWith('year-') ? 'finished' : id === 'tbr' ? 'added' : 'title';
  const draw = () => {
    const s = shelfById(id);
    if (!s) { root.innerHTML = `<section class="page"><p class="muted">That shelf has been taken down. <a href="#/">Back to the archive</a></p></section>`; return; }
    const list = [...s.books].sort(SORTS[sort][1]);
    const rated = list.filter(b => b.rating);
    const avg = rated.length ? rated.reduce((n, b) => n + b.rating, 0) / rated.length : 0;
    const pages = list.reduce((n, b) => n + (b.pages || 0), 0);
    root.innerHTML = `
      <section class="page">
        <a class="back" href="#/">← The Archive</a>
        <div class="page-head">
          <div>
            <h1 class="page-title">${esc(s.name)}</h1>
            <p class="page-sub">${plural(list.length, 'volume')}${avg ? ` · averaging ${avg.toFixed(1)} stars` : ''}${pages && s.kind === 'year' ? ` · ${pages.toLocaleString()} pages` : ''}</p>
          </div>
          <div class="page-actions">
            <label class="sort">Sort by
              <select class="input small" data-sort>${Object.entries(SORTS).map(([k, [label]]) =>
                `<option value="${k}" ${k === sort ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
            ${s.kind === 'custom' ? `<a class="btn ghost small" href="#/settings/shelves">Edit shelf</a>` : ''}
          </div>
        </div>
        <div class="grid">${list.map(gridCard).join('') || '<p class="muted">No volumes on this shelf yet.</p>'}</div>
      </section>`;
    root.querySelector('[data-sort]').onchange = e => { sort = e.target.value; draw(); };
  };
  draw();
  const off = onData(k => { if (k === 'books' || k === 'shelves') draw(); });
  return off;
}
