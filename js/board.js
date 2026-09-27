/* Mood boards. Every book has one; the Bower is the big one.
   A pin is an image, a colour, or a few words. Any book's pin can also be
   hung in the Bower (onMain), where it shows which book it came from.

   Images are shrunk in the browser and stored inside the pin itself, so the
   board works offline and nothing depends on a link staying alive. */

import { esc, uid, openModal, confirmDialog, promptDialog, toast, shrinkImage, loadImage, $ } from './util.js';
import { Store } from './store.js';
import { S, saveMeta } from './state.js';
import { coverSrc, paletteFrom } from './covers.js';

const ROW = 6;   // grid-auto-rows, px
const GAP = 14;  // grid gap, px

export function boardView(root, { bookId = null, book = null } = {}) {
  const main = !bookId;
  const orderKey = main ? 'mainOrder' : 'order';
  let pins = [];
  let sortable = null;

  root.innerHTML = `
    <div class="board-wrap ${main ? 'main' : ''}">
      <div class="board-tools">
        <label class="btn ghost small">+ Images<input type="file" accept="image/*" multiple hidden data-files></label>
        <button class="btn ghost small" data-add="words">+ Words</button>
        <button class="btn ghost small" data-add="color">+ Colour</button>
        <button class="btn ghost small" data-add="url">+ Image link</button>
        ${!main && book && coverSrc(book) ? '<button class="btn ghost small" data-add="palette">Colours from the cover</button>' : ''}
        <span class="board-hint">or paste / drop pictures anywhere here</span>
      </div>
      <div class="board" aria-live="polite"></div>
      <div class="drop-veil" hidden><span>Let go to pin it</span></div>
    </div>`;

  const boardEl = $('.board', root);
  const wrap = $('.board-wrap', root);

  const draw = () => {
    const sorted = [...pins].sort((a, b) => (a[orderKey] ?? a.createdAt) - (b[orderKey] ?? b.createdAt));
    boardEl.classList.toggle('is-empty', !sorted.length);
    if (!sorted.length) {
      boardEl.innerHTML = `<div class="board-empty">
        <p>${main
          ? 'The Bower is bare. Pin pictures, colours and words here — anything with the right feeling — or hang pins here from any book’s own board.'
          : 'Nothing pinned yet. What does this book <i>feel</i> like? Pictures, colours, a line of music, a scrap of a place.'}</p></div>`;
      return;
    }
    boardEl.innerHTML = sorted.map(p => pinHTML(p, main)).join('');
    layout();
    boardEl.querySelectorAll('img').forEach(img => { if (!img.complete) img.onload = img.onerror = layoutSoon; });
  };

  function layout() {
    const gap = parseFloat(getComputedStyle(boardEl).rowGap) || GAP;
    for (const el of boardEl.children) {
      if (!el.classList.contains('pin')) continue;
      const h = el.firstElementChild ? el.scrollHeight : 120;
      el.style.gridRowEnd = `span ${Math.ceil((h + gap) / (ROW + gap))}`;
    }
  }
  let raf;
  const layoutSoon = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(layout); };
  const ro = new ResizeObserver(layoutSoon);
  ro.observe(boardEl);

  const unwatch = Store.watch('pins', docs => { pins = docs; draw(); initSort(); }, main ? ['onMain', true] : ['bookId', bookId]);

  function initSort() {
    if (sortable || !window.Sortable || !pins.length) return;
    sortable = window.Sortable.create(boardEl, {
      animation: 180,
      delay: 220,
      delayOnTouchOnly: true,
      draggable: '.pin',
      ghostClass: 'pin-ghost',
      filter: '.pin-actions',
      preventOnFilter: false,
      onEnd() {
        const ids = [...boardEl.querySelectorAll('.pin')].map(el => el.dataset.id);
        const changed = [];
        ids.forEach((id, i) => {
          const p = pins.find(x => x.id === id);
          if (p && p[orderKey] !== i * 10) { p[orderKey] = i * 10; changed.push(p); }
        });
        if (changed.length) Store.putMany('pins', changed);
      },
    });
  }

  /* ---- adding ---- */
  const nextOrder = () => (pins.reduce((m, p) => Math.max(m, p[orderKey] ?? 0), 0) + 10);
  const newPin = fields => {
    const p = {
      id: uid(), bookId: bookId || null, onMain: main, createdAt: Date.now(),
      order: nextOrder(), mainOrder: main ? nextOrder() : null, caption: '', ...fields,
    };
    saveMeta({ pinCount: (S.meta.pinCount || 0) + 1 });
    return Store.put('pins', p);
  };

  async function addFiles(files) {
    const imgs = [...files].filter(f => f.type.startsWith('image/'));
    if (!imgs.length) return;
    toast(imgs.length > 1 ? `Pinning ${imgs.length} pictures…` : 'Pinning…');
    for (const f of imgs) {
      try {
        const { src, w, h } = await shrinkImage(f);
        newPin({ kind: 'image', src, w, h });
      } catch { toast('One of those pictures couldn’t be read.'); }
    }
  }

  $('[data-files]', root).onchange = e => { addFiles(e.target.files); e.target.value = ''; };
  root.querySelector('.board-tools').onclick = async e => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    const kind = b.dataset.add;
    if (kind === 'words') wordsDialog(null, t => newPin({ kind: 'text', ...t }));
    if (kind === 'color') colorDialog(null, c => newPin({ kind: 'color', ...c }));
    if (kind === 'url') {
      const url = await promptDialog('Pin a picture from a link', { placeholder: 'https://…/picture.jpg', ok: 'Pin it', label: 'Image address' });
      if (!url) return;
      try {
        // Keep a copy if the site allows it, so the pin survives the link dying.
        const img = await loadImage(url, true);
        const c = document.createElement('canvas');
        const s = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
        c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        newPin({ kind: 'image', src: c.toDataURL('image/jpeg', 0.84), w: c.width, h: c.height, source: url });
      } catch {
        try {
          const img = await loadImage(url);
          newPin({ kind: 'image', src: url, w: img.naturalWidth, h: img.naturalHeight, remote: true });
        } catch { toast('That link isn’t a picture I can open.'); }
      }
    }
    if (kind === 'palette') {
      try {
        const cols = await paletteFrom(coverSrc(book, true));
        newPin({ kind: 'palette', colors: cols, caption: 'from the cover' });
      } catch { toast('The cover wouldn’t give up its colours. Try again online.'); }
    }
  };

  /* paste and drop */
  const onPaste = e => {
    if (document.body.classList.contains('modal-open')) return;
    if (e.target.closest?.('input, textarea, [contenteditable=true]')) return;
    const files = [...(e.clipboardData?.files || [])];
    if (files.length) { e.preventDefault(); addFiles(files); }
  };
  document.addEventListener('paste', onPaste);
  const veil = $('.drop-veil', root);
  let depth = 0;
  wrap.addEventListener('dragenter', e => { if (e.dataTransfer?.types.includes('Files')) { depth++; veil.hidden = false; } });
  wrap.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; veil.hidden = true; } });
  wrap.addEventListener('dragover', e => { if (e.dataTransfer?.types.includes('Files')) e.preventDefault(); });
  wrap.addEventListener('drop', e => {
    depth = 0; veil.hidden = true;
    if (!e.dataTransfer?.files.length) return;
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  });

  /* ---- a pin's actions ---- */
  boardEl.onclick = e => {
    const el = e.target.closest('.pin');
    if (!el) return;
    const p = pins.find(x => x.id === el.dataset.id);
    if (!p) return;
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'main') { Store.patch('pins', p.id, { onMain: !p.onMain, mainOrder: p.mainOrder ?? Date.now() }); toast(p.onMain ? 'Taken down from the Bower.' : 'Hung in the Bower.'); return; }
    if (act === 'delete') { removePin(p); return; }
    if (e.target.closest('a')) return;
    openPin(p, main);
  };

  return () => {
    unwatch();
    ro.disconnect();
    sortable?.destroy();
    document.removeEventListener('paste', onPaste);
  };
}

function pinHTML(p, onMainBoard) {
  const from = onMainBoard && p.bookId ? S.books.get(p.bookId) : null;
  const actions = `<span class="pin-actions">
      ${!onMainBoard ? `<button data-act="main" class="${p.onMain ? 'on' : ''}" title="${p.onMain ? 'Take down from the Bower' : 'Also hang in the Bower'}">✦</button>` : ''}
      <button data-act="delete" title="Unpin">×</button>
    </span>`;
  const foot = (p.caption || from) ? `<figcaption>${p.caption ? `<span>${esc(p.caption)}</span>` : ''}${from
    ? `<a class="pin-from" href="#/book/${esc(from.id)}/board">${esc(from.title)}</a>` : ''}</figcaption>` : '';
  let inner = '';
  if (p.kind === 'image') {
    const ratio = p.w && p.h ? `style="aspect-ratio:${p.w}/${p.h}"` : '';
    inner = `<img src="${esc(p.src)}" alt="${esc(p.caption || '')}" ${ratio} loading="lazy" decoding="async" draggable="false">`;
  } else if (p.kind === 'color') {
    inner = `<div class="swatch" style="background:${esc(p.color)}"><span>${esc(p.color)}</span></div>`;
  } else if (p.kind === 'palette') {
    inner = `<div class="palette">${(p.colors || []).map(c => `<span style="background:${esc(c)}" title="${esc(c)}"></span>`).join('')}</div>`;
  } else {
    inner = `<blockquote class="words ${p.style || ''}">${esc(p.text)}</blockquote>`;
  }
  return `<figure class="pin pin-${p.kind}" data-id="${esc(p.id)}" tabindex="0">${inner}${foot}${actions}</figure>`;
}

async function removePin(p) {
  if (!(await confirmDialog('Unpin this?', p.onMain && p.bookId ? 'It will come down from the book’s board and the Bower.' : '', { ok: 'Unpin', danger: true }))) return;
  Store.remove('pins', p.id);
}

function openPin(p, onMainBoard) {
  if (p.kind === 'text') return wordsDialog(p, t => Store.patch('pins', p.id, t));
  if (p.kind === 'color') return colorDialog(p, c => Store.patch('pins', p.id, c));
  const from = p.bookId ? S.books.get(p.bookId) : null;
  openModal(`
    <div class="pin-view">
      ${p.kind === 'image' ? `<img src="${esc(p.src)}" alt="">`
        : `<div class="palette big">${(p.colors || []).map(c => `<span style="background:${esc(c)}"><i>${esc(c)}</i></span>`).join('')}</div>`}
      <form class="row caption-row">
        <input class="input" name="caption" value="${esc(p.caption || '')}" placeholder="A caption, if it wants one" aria-label="Caption">
        <button class="btn ghost small">Save</button>
      </form>
      <div class="row wrap">
        ${from && onMainBoard ? `<a class="btn ghost small" href="#/book/${esc(from.id)}/board" data-close>From ${esc(from.title)}</a>` : ''}
        ${p.bookId ? `<button class="btn ghost small" data-main>${p.onMain ? 'Take down from the Bower' : '✦ Also hang in the Bower'}</button>` : ''}
        <button class="btn ghost small danger-text" data-del>Unpin</button>
      </div>
    </div>`, {
    cls: 'wide pin-modal',
    onMount(el, close) {
      el.querySelector('form').onsubmit = e => {
        e.preventDefault();
        Store.patch('pins', p.id, { caption: new FormData(e.target).get('caption').trim() });
        close();
      };
      el.querySelector('[data-main]')?.addEventListener('click', () => {
        Store.patch('pins', p.id, { onMain: !p.onMain, mainOrder: p.mainOrder ?? Date.now() });
        close();
      });
      el.querySelector('[data-del]').onclick = () => { close(); removePin(p); };
    },
  });
}

function wordsDialog(p, done) {
  const styles = [['', 'Printed'], ['script', 'Handwritten'], ['caps', 'Carved']];
  openModal(`
    <form class="stack">
      <h2 class="modal-title">${p ? 'Edit words' : 'Pin some words'}</h2>
      <textarea class="input" name="text" rows="4" placeholder="A line, a lyric, a feeling, a place…" autofocus required>${esc(p?.text || '')}</textarea>
      <input class="input" name="caption" value="${esc(p?.caption || '')}" placeholder="Where it’s from (optional)">
      <div class="seg" role="radiogroup">${styles.map(([k, v]) =>
        `<label><input type="radio" name="style" value="${k}" ${(p?.style || '') === k ? 'checked' : ''}><span>${v}</span></label>`).join('')}</div>
      <div class="modal-actions">
        ${p ? '<button type="button" class="btn ghost danger-text" data-del>Unpin</button>' : ''}
        <button type="button" class="btn ghost" data-close>Cancel</button><button class="btn gold">${p ? 'Save' : 'Pin it'}</button></div>
    </form>`, {
    cls: 'narrow',
    onMount(el, close) {
      el.querySelector('[data-del]')?.addEventListener('click', () => { close(); removePin(p); });
      el.querySelector('form').onsubmit = e => {
        e.preventDefault();
        const f = new FormData(e.target);
        const text = f.get('text').trim();
        if (!text) return;
        done({ text, caption: f.get('caption').trim(), style: f.get('style') || '' });
        close();
      };
    },
  });
}

function colorDialog(p, done) {
  openModal(`
    <form class="stack">
      <h2 class="modal-title">${p ? 'Edit colour' : 'Pin a colour'}</h2>
      <div class="row color-row">
        <input type="color" name="color" value="${esc(p?.color || '#6e1f1f')}" aria-label="Colour">
        <input class="input" name="caption" value="${esc(p?.caption || '')}" placeholder="Name it — ‘the moor at dusk’" autofocus>
      </div>
      <div class="modal-actions">
        ${p ? '<button type="button" class="btn ghost danger-text" data-del>Unpin</button>' : ''}
        <button type="button" class="btn ghost" data-close>Cancel</button><button class="btn gold">${p ? 'Save' : 'Pin it'}</button></div>
    </form>`, {
    cls: 'narrow',
    onMount(el, close) {
      el.querySelector('[data-del]')?.addEventListener('click', () => { close(); removePin(p); });
      el.querySelector('form').onsubmit = e => {
        e.preventDefault();
        const f = new FormData(e.target);
        done({ color: f.get('color'), caption: f.get('caption').trim() });
        close();
      };
    },
  });
}

/* The Bower: the main board as a page of its own. */
export function bowerView(root) {
  root.innerHTML = `
    <section class="page bower">
      <div class="page-head">
        <div>
          <h1 class="page-title">The Bower</h1>
          <p class="page-sub">Your mood board. Pins from any book’s board can be hung here too — look for the ✦.</p>
        </div>
      </div>
      <div class="bower-body"></div>
    </section>`;
  return boardView($('.bower-body', root), {});
}
