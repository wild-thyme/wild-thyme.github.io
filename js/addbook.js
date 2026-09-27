/* Adding a book: search Open Library, pick the right one, say where it goes. */

import { esc, openModal, debounce, today, toast, confirmDialog } from './util.js';
import { searchBooks, coverHTML } from './covers.js';
import { S, STATUS, newBook, findDuplicate } from './state.js';
import { mountRater } from './stars.js';

export function openAddBook({ status } = {}) {
  let results = [];
  openModal(`
    <div class="add-step" data-step="search">
      <h2 class="modal-title">Add a book</h2>
      <input class="input big" type="search" placeholder="Title, author, or both…" autofocus autocomplete="off" aria-label="Search for a book">
      <div class="results" aria-live="polite"></div>
      <button class="linkish" data-manual>Can’t find it? Enter it by hand</button>
    </div>
    <div class="add-step" data-step="details" hidden></div>`, {
    cls: 'wide add-book',
    onMount(el, close) {
      const input = el.querySelector('input');
      const list = el.querySelector('.results');
      let seq = 0;
      const run = debounce(async () => {
        const text = input.value.trim();
        if (text.length < 2) { list.innerHTML = ''; return; }
        const n = ++seq;
        list.innerHTML = '<p class="muted pulse">Searching the stacks…</p>';
        try {
          const r = await searchBooks(text);
          if (n !== seq) return;
          results = r;
          list.innerHTML = r.length ? r.map((b, i) => `
            <button class="result" data-i="${i}">
              ${coverHTML({ ...b, id: '', coverSearched: true }, { cls: 'thumb' })}
              <span><b>${esc(b.title)}</b><i>${esc(b.author || 'Unknown author')}${b.year ? ` · ${b.year}` : ''}</i></span>
            </button>`).join('') : '<p class="muted">Nothing found. Try fewer words, or enter it by hand.</p>';
        } catch {
          if (n === seq) list.innerHTML = '<p class="muted">Couldn’t reach Open Library. You can still enter it by hand.</p>';
        }
      }, 350);
      input.oninput = run;
      input.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); run.flush(); } };
      list.onclick = e => {
        const r = e.target.closest('.result');
        if (r) details(el, close, results[+r.dataset.i], status);
      };
      el.querySelector('[data-manual]').onclick = () => details(el, close, { title: input.value.trim(), author: '' }, status);
    },
  });
}

function details(el, close, pickd, status) {
  const step = el.querySelector('[data-step=details]');
  el.querySelector('[data-step=search]').hidden = true;
  step.hidden = false;
  const draft = {
    title: pickd.title || '', author: pickd.author || '', cover: pickd.cover || null,
    year: pickd.year || null, pages: pickd.pages || null, olKey: pickd.olKey || null,
    status: status || 'read', started: null, finished: status === 'read' || !status ? today() : null,
    rating: 0, shelves: [], coverSearched: !!pickd.cover,
  };

  const draw = () => {
    const needStart = draft.status !== 'tbr';
    const needEnd = draft.status === 'read' || draft.status === 'dnf';
    step.innerHTML = `
      <button class="back linkish" data-back>← Search again</button>
      <div class="add-detail">
        ${coverHTML({ ...draft, id: '' }, { cls: 'add-cover' })}
        <div class="stack">
          <label class="field"><span class="field-label">Title</span>
            <input class="input" name="title" value="${esc(draft.title)}" required></label>
          <label class="field"><span class="field-label">Author</span>
            <input class="input" name="author" value="${esc(draft.author)}"></label>
          <div class="field"><span class="field-label">Where does it go?</span>
            <div class="seg" role="radiogroup">${Object.entries(STATUS).map(([k, v]) =>
              `<button type="button" role="radio" aria-checked="${draft.status === k}" data-status="${k}">${v}</button>`).join('')}</div></div>
          <div class="row dates">
            ${needStart ? `<label class="field"><span class="field-label">Started</span>
              <input class="input" type="date" name="started" value="${draft.started || ''}"></label>` : ''}
            ${needEnd ? `<label class="field"><span class="field-label">${draft.status === 'dnf' ? 'Set aside' : 'Finished'}</span>
              <input class="input" type="date" name="finished" value="${draft.finished || ''}"></label>` : ''}
          </div>
          ${needEnd ? `<div class="field"><span class="field-label">Rating</span><div data-rater></div></div>` : ''}
          ${S.shelves.length ? `<div class="field"><span class="field-label">Also on</span><div class="chips">
            ${S.shelves.map(s => `<label class="chip-check"><input type="checkbox" value="${esc(s.id)}" ${draft.shelves.includes(s.id) ? 'checked' : ''}><span>${esc(s.name)}</span></label>`).join('')}
          </div></div>` : ''}
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn ghost" data-close>Cancel</button>
        <button class="btn gold" data-save>Shelve it</button>
      </div>`;

    const rater = step.querySelector('[data-rater]');
    if (rater) mountRater(rater, draft.rating, v => { draft.rating = v; });
    step.querySelector('[data-back]').onclick = () => { step.hidden = true; el.querySelector('[data-step=search]').hidden = false; };
    step.querySelectorAll('input').forEach(i => {
      i.oninput = () => {
        if (i.type === 'checkbox') {
          draft.shelves = [...step.querySelectorAll('.chip-check input:checked')].map(c => c.value);
        } else draft[i.name] = i.value || null;
      };
    });
    step.querySelectorAll('[data-status]').forEach(b => {
      b.onclick = () => {
        draft.status = b.dataset.status;
        if (draft.status === 'reading' && !draft.started) draft.started = today();
        if ((draft.status === 'read' || draft.status === 'dnf') && !draft.finished) draft.finished = today();
        draw();
      };
    });
    step.querySelector('[data-save]').onclick = save;
  };

  const save = async () => {
    if (!draft.title?.trim()) { toast('Every book needs a title.'); return; }
    const dup = findDuplicate(draft.title, draft.author);
    if (dup && !(await confirmDialog('Already in the archive',
      `<i>${esc(dup.title)}</i> is already on your shelves. Add another copy anyway?`, { ok: 'Add anyway' }))) return;
    if (draft.status === 'tbr') { draft.started = null; draft.finished = null; }
    if (draft.status === 'reading') draft.finished = null;
    const b = newBook({ ...draft, title: draft.title.trim(), author: (draft.author || '').trim() });
    close();
    if (b.status === 'tbr') toast(`${b.title} is on the To Be Read shelf.`);
    else location.hash = `#/book/${b.id}`;
  };

  draw();
}

