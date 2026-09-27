/* Book Notes — a commonplace journal for each book.

   A plain, roomy writing surface (Quill underneath) with the few things a
   commonplace book needs: passages set apart as quotes, page references,
   #tags, chapter headings, highlights. Quotes, tags and headings are gathered
   into the side panel as she writes, and every quote also lands in the
   Commonplace Book across all her books.

   Saved as a Quill Delta in notes/{bookId}, along with derived plain text,
   quotes, tags and an outline so other pages never have to parse it. */

import { esc, debounce, openModal, toast, plural, download, $ } from './util.js';
import { Store } from './store.js';
import { S } from './state.js';

const HL = ['gold', 'rose', 'violet', 'sage'];
let registered = false;

function register() {
  if (registered) return;
  registered = true;
  const Q = window.Quill;
  const P = Q.import('parchment');
  const Embed = Q.import('blots/embed');
  const BlockEmbed = Q.import('blots/block/embed');

  class PageRef extends Embed {
    static blotName = 'pageref';
    static tagName = 'SPAN';
    static className = 'ql-pageref';
    static create(value) {
      const node = super.create(value);
      node.dataset.page = value;
      node.textContent = `p. ${value}`;
      return node;
    }
    static value(node) { return node.dataset.page; }
  }
  class Divider extends BlockEmbed {
    static blotName = 'divider';
    static tagName = 'HR';
  }
  const Highlight = new P.ClassAttributor('hl', 'ql-hl', { scope: P.Scope.INLINE, whitelist: HL });
  const Tag = new P.ClassAttributor('tag', 'ql-tag', { scope: P.Scope.INLINE, whitelist: ['on'] });

  Q.register({ 'formats/pageref': PageRef, 'formats/divider': Divider, 'formats/hl': Highlight, 'formats/tag': Tag }, true);
}

const FORMATS = ['bold', 'italic', 'underline', 'strike', 'link', 'header', 'blockquote', 'list', 'indent', 'hl', 'tag', 'pageref', 'divider'];

const I = {
  bold: '<b>B</b>', italic: '<i>I</i>', underline: '<u>U</u>', strike: '<s>S</s>',
  bullet: '<svg viewBox="0 0 20 20"><circle cx="4" cy="5" r="1.6"/><circle cx="4" cy="10" r="1.6"/><circle cx="4" cy="15" r="1.6"/><path d="M8 5h9M8 10h9M8 15h9"/></svg>',
  ordered: '<svg viewBox="0 0 20 20"><text x="1" y="7" font-size="6">1</text><text x="1" y="12.5" font-size="6">2</text><text x="1" y="18" font-size="6">3</text><path d="M8 5h9M8 10h9M8 15h9"/></svg>',
  check: '<svg viewBox="0 0 20 20"><rect x="2" y="3" width="5" height="5" rx="1"/><path d="M3 13.5l1.5 1.5 3-3M10 5.5h8M10 14h8"/></svg>',
  quote: '<svg viewBox="0 0 20 20"><path class="fill" d="M3 11c0-3 1.5-5.5 4.5-6.5l.6 1.1C6.4 6.5 5.6 7.7 5.5 9H8v5H3zm8 0c0-3 1.5-5.5 4.5-6.5l.6 1.1c-1.7.9-2.5 2.1-2.6 3.4H16v5h-5z"/></svg>',
  hl: '<svg viewBox="0 0 20 20"><path d="M4 16l2-6 7-7 3 3-7 7z"/><path class="fill hlbar" d="M2 17.5h16v2H2z"/></svg>',
  link: '<svg viewBox="0 0 20 20"><path d="M8.5 11.5a3.5 3.5 0 005 0l2.5-2.5a3.5 3.5 0 00-5-5L10 5M11.5 8.5a3.5 3.5 0 00-5 0L4 11a3.5 3.5 0 005 5l1-1"/></svg>',
  undo: '<svg viewBox="0 0 20 20"><path d="M5 8h7a4 4 0 010 8H8M5 8l3-3M5 8l3 3"/></svg>',
  redo: '<svg viewBox="0 0 20 20"><path d="M15 8H8a4 4 0 000 8h4M15 8l-3-3M15 8l-3 3"/></svg>',
  moon: '<svg viewBox="0 0 20 20"><path d="M15.5 12.5A6.5 6.5 0 017.5 4.5a6.5 6.5 0 108 8z"/></svg>',
  panel: '<svg viewBox="0 0 20 20"><rect x="2.5" y="3.5" width="15" height="13" rx="1.5"/><path d="M12.5 3.5v13"/></svg>',
};

export function notesTab(root, book, query = {}) {
  if (!window.Quill) {
    root.innerHTML = '<p class="muted pulse">Opening the notebook…</p>';
    const t = setInterval(() => { if (window.Quill) { clearInterval(t); cleanup = notesTab(root, book, query); } }, 60);
    let cleanup = () => clearInterval(t);
    return () => cleanup();
  }
  register();
  const paper = localStorage.getItem('wt.paper') || 'night';
  // The margin opens beside the page on a wide screen; on a phone it's a drawer, closed to start.
  const sideOpen = localStorage.getItem('wt.side') !== 'closed' && matchMedia('(min-width: 1000px)').matches;

  root.innerHTML = `
    <div class="notes ${sideOpen ? 'side-open' : ''}">
      <div class="notes-main">
        <div class="toolbar" role="toolbar" aria-label="Formatting">
          <select class="tb-select" data-tb="header" aria-label="Text style">
            <option value="">Text</option><option value="1">Chapter</option><option value="2">Section</option><option value="3">Aside heading</option>
          </select>
          <span class="tb-sep"></span>
          <button data-tb="bold" title="Bold (⌘B)">${I.bold}</button>
          <button data-tb="italic" title="Italic (⌘I)">${I.italic}</button>
          <button data-tb="underline" title="Underline (⌘U)">${I.underline}</button>
          <button data-tb="strike" title="Strikethrough">${I.strike}</button>
          <span class="tb-pop">
            <button data-tb="hl" title="Highlight">${I.hl}</button>
            <span class="swatches" hidden>${HL.map(c => `<button class="sw ql-hl-${c}" data-hl="${c}" title="${c}"></button>`).join('')}<button class="sw none" data-hl="" title="No highlight">✕</button></span>
          </span>
          <span class="tb-sep"></span>
          <button data-tb="bullet" title="Bulleted list">${I.bullet}</button>
          <button data-tb="ordered" title="Numbered list">${I.ordered}</button>
          <button data-tb="check" title="Checklist">${I.check}</button>
          <span class="tb-sep"></span>
          <button data-tb="quote" class="wide" title="Keep a passage (select text to set it as a quote)">${I.quote}<span>Quote</span></button>
          <button data-tb="page" class="wide" title="Page reference"><span>p.</span></button>
          <button data-tb="divider" title="Divider">❦</button>
          <button data-tb="link" title="Link">${I.link}</button>
          <span class="tb-sep"></span>
          <button data-tb="undo" title="Undo (⌘Z)">${I.undo}</button>
          <button data-tb="redo" title="Redo (⇧⌘Z)">${I.redo}</button>
          <span class="tb-grow"></span>
          <button data-tb="paper" title="Parchment or night paper">${I.moon}</button>
          <button data-tb="side" title="Show the margin">${I.panel}</button>
        </div>
        <div class="paper ${paper}">
          <h1 class="print-only">${esc(book.title)}${book.author ? `<small>${esc(book.author)}</small>` : ''}</h1>
          <div class="editor"></div>
        </div>
        <div class="notes-status"><span data-status>Opening…</span><span data-count></span></div>
      </div>
      <aside class="margin" aria-label="In these pages"></aside>
      <button class="fab" data-fab aria-label="Keep a quote">${I.quote}</button>
    </div>`;

  const quill = new window.Quill($('.editor', root), {
    formats: FORMATS,
    placeholder: 'Empty your head here. Passages, arguments with the author, what it reminded you of, which line wrecked you…',
    modules: {
      history: { delay: 800, maxStack: 500, userOnly: true },
      keyboard: { bindings: shortcuts() },
    },
  });
  quill.disable();

  const statusEl = $('[data-status]', root);
  const countEl = $('[data-count]', root);
  const side = $('.margin', root);
  let dirty = false, lastSavedAt = 0, loaded = false, derived = { quotes: [], tags: [], outline: [], words: 0 };

  const setStatus = t => { statusEl.textContent = t; };

  /* ---- load, and follow edits made on her other device ---- */
  const unwatch = Store.watchDoc('notes', book.id, (doc, info) => {
    if (!loaded) {
      if (!doc && info.fromCache && (book.noteStats?.words || 0) > 0) {
        setStatus('Fetching your notes from the archive…');
        return; // wait for the server rather than show an empty page and save over it
      }
      loaded = true;
      if (doc?.ops) quill.setContents(doc.ops, 'silent');
      lastSavedAt = doc?.updatedAt || 0;
      quill.enable();
      quill.history.clear();
      refresh();
      setStatus(doc ? 'Saved' : 'A fresh page');
      if (query.line != null) jumpToLine(+query.line);
      else if (!matchMedia('(pointer:coarse)').matches) quill.focus();
      return;
    }
    if (!doc || info.pending || dirty) return;
    if ((doc.updatedAt || 0) > lastSavedAt) {
      const sel = quill.getSelection();
      quill.setContents(doc.ops || [], 'silent');
      lastSavedAt = doc.updatedAt;
      if (sel) quill.setSelection(Math.min(sel.index, quill.getLength() - 1), 0, 'silent');
      refresh();
      setStatus('Updated from your other device');
    }
  });

  /* ---- save ---- */
  const patchBook = debounce(() => {
    const cur = S.books.get(book.id)?.noteStats || {};
    const next = { words: derived.words, quotes: derived.quotes.length };
    if (cur.words !== next.words || cur.quotes !== next.quotes) Store.patch('books', book.id, { noteStats: next });
  }, 4000);

  const save = debounce(() => {
    if (!loaded) return;
    const ops = JSON.parse(JSON.stringify(quill.getContents().ops));
    const text = quill.getText();
    const doc = {
      id: book.id, bookId: book.id, ops,
      text: text.slice(0, 200_000),
      quotes: derived.quotes, tags: derived.tags, outline: derived.outline, words: derived.words,
    };
    const size = JSON.stringify(doc).length;
    if (size > 950_000) { setStatus('This notebook is full — start a new book entry for the rest'); return; }
    Store.put('notes', doc);
    lastSavedAt = doc.updatedAt;
    dirty = false;
    setStatus(Store.mode === 'cloud' && !navigator.onLine ? 'Saved on this device — will sync when online' : 'Saved');
    patchBook();
    if (size > 700_000) toast('This book’s notes are getting very long — nearly at the limit for one notebook.');
  }, 1200);

  quill.on('text-change', (delta, old, source) => {
    if (source === 'silent') return;
    // Tag on the next tick: mid-event, Quill's idea of the cursor can lag the
    // DOM (iOS autocomplete, paste), and formatting then drags the caret back.
    if (source === 'user') setTimeout(() => autoTag(quill, delta), 0);
    dirty = true;
    setStatus('Writing…');
    save();
    refreshSoon();
  });

  const flush = () => { if (dirty) { save.flush(); patchBook.flush(); } };
  const onVis = () => { if (document.visibilityState === 'hidden') flush(); };
  document.addEventListener('visibilitychange', onVis);
  addEventListener('pagehide', flush);

  /* ---- the margin: outline, quotes, tags ---- */
  function refresh() {
    derived = derive(quill);
    countEl.textContent = `${plural(derived.words, 'word')} · ${plural(derived.quotes.length, 'quote')}`;
    side.innerHTML = `
      <section><h3>Contents</h3>${derived.outline.length
        ? `<ol class="outline">${derived.outline.map(h => `<li class="h${h.level}"><button data-line="${h.line}">${esc(h.text)}</button></li>`).join('')}</ol>`
        : '<p class="hint">Use <b>Chapter</b> and <b>Section</b> headings and they’ll gather here.</p>'}</section>
      <section><h3>Passages kept <span>${derived.quotes.length || ''}</span></h3>${derived.quotes.length
        ? `<ul class="kept">${derived.quotes.map(q => `<li><button data-line="${q.line}">“${esc(q.text.length > 140 ? q.text.slice(0, 140) + '…' : q.text)}”${q.page ? `<em>p. ${esc(q.page)}</em>` : ''}</button></li>`).join('')}</ul>`
        : '<p class="hint">Press <b>Quote</b>, or start a line with <b>&gt;</b> and a space.</p>'}</section>
      <section><h3>Tags</h3>${derived.tags.length
        ? `<p class="tags">${derived.tags.map(t => `<a class="tag" href="#/commonplace?tag=${encodeURIComponent(t)}">#${esc(t)}</a>`).join('')}</p>`
        : '<p class="hint">Type <b>#grief</b> or <b>#motif</b> anywhere to tag a thought.</p>'}</section>
      <section class="shortcuts"><h3>Shortcuts</h3><p class="hint">
        <b>&gt;</b> quote · <b>#</b> chapter · <b>##</b> section · <b>-</b> list · <b>[]</b> checklist · Enter twice to leave a quote</p></section>`;
  }
  const refreshSoon = debounce(refresh, 400);

  function jumpToLine(n) {
    const line = quill.getLines()[n];
    if (!line) return;
    line.domNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
    line.domNode.classList.add('flash');
    setTimeout(() => line.domNode.classList.remove('flash'), 1800);
    quill.setSelection(quill.getIndex(line) + line.length() - 1, 0, 'silent');
  }
  side.onclick = e => {
    const b = e.target.closest('[data-line]');
    if (b) { jumpToLine(+b.dataset.line); if (matchMedia('(max-width: 999px)').matches) toggleSide(false); }
  };

  /* ---- toolbar ---- */
  const tb = $('.toolbar', root);
  const swatches = $('.swatches', root);
  tb.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); }); // keep the selection
  tb.onclick = e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.hl !== undefined) {
      quill.format('hl', b.dataset.hl || false, 'user');
      swatches.hidden = true;
      return;
    }
    const f = quill.getFormat();
    switch (b.dataset.tb) {
      case 'bold': case 'italic': case 'underline': case 'strike':
        quill.format(b.dataset.tb, !f[b.dataset.tb], 'user'); break;
      case 'hl': swatches.hidden = !swatches.hidden; break;
      case 'bullet': case 'ordered':
        quill.format('list', f.list === b.dataset.tb ? false : b.dataset.tb, 'user'); break;
      case 'check':
        quill.format('list', f.list === 'checked' || f.list === 'unchecked' ? false : 'unchecked', 'user'); break;
      case 'quote': {
        const r = quill.getSelection();
        if (r && r.length) quill.format('blockquote', !f.blockquote, 'user');
        else quoteDialog(quill);
        break;
      }
      case 'page': pageDialog(quill); break;
      case 'divider': {
        const r = quill.getSelection(true);
        quill.insertEmbed(r.index, 'divider', true, 'user');
        quill.setSelection(r.index + 1, 0, 'silent');
        break;
      }
      case 'link': linkDialog(quill); break;
      case 'undo': quill.history.undo(); break;
      case 'redo': quill.history.redo(); break;
      case 'paper': {
        const p = $('.paper', root);
        const next = p.classList.contains('night') ? 'parchment' : 'night';
        p.classList.remove('night', 'parchment');
        p.classList.add(next);
        localStorage.setItem('wt.paper', next);
        break;
      }
      case 'side': toggleSide(); break;
    }
    updateToolbar();
  };
  $('[data-tb=header]', root).onchange = e => {
    quill.format('header', e.target.value ? +e.target.value : false, 'user');
    quill.focus();
  };
  function toggleSide(force) {
    const n = $('.notes', root);
    const open = force ?? !n.classList.contains('side-open');
    n.classList.toggle('side-open', open);
    if (matchMedia('(min-width: 1000px)').matches) localStorage.setItem('wt.side', open ? 'open' : 'closed');
  }
  function updateToolbar() {
    const r = quill.getSelection();
    if (!r) return;
    const f = quill.getFormat(r);
    for (const k of ['bold', 'italic', 'underline', 'strike']) tb.querySelector(`[data-tb=${k}]`).classList.toggle('on', !!f[k]);
    tb.querySelector('[data-tb=bullet]').classList.toggle('on', f.list === 'bullet');
    tb.querySelector('[data-tb=ordered]').classList.toggle('on', f.list === 'ordered');
    tb.querySelector('[data-tb=check]').classList.toggle('on', f.list === 'checked' || f.list === 'unchecked');
    tb.querySelector('[data-tb=quote]').classList.toggle('on', !!f.blockquote);
    tb.querySelector('[data-tb=hl]').dataset.color = f.hl || '';
    tb.querySelector('[data-tb=header]').value = f.header || '';
  }
  quill.on('editor-change', () => updateToolbar());

  $('[data-fab]', root).onclick = () => quoteDialog(quill, true);

  return () => {
    flush();
    unwatch();
    document.removeEventListener('visibilitychange', onVis);
    removeEventListener('pagehide', flush);
  };
}

/* ---- keyboard: a little markdown, and a way out of quotes ---- */
function shortcuts() {
  return {
    blockAutofill: {
      key: ' ',
      collapsed: true,
      format: { blockquote: false, list: false, header: false },
      prefix: /^(#{1,3}|>)$/,
      handler(range, ctx) {
        const mark = ctx.prefix;
        const start = range.index - mark.length;
        this.quill.deleteText(start, mark.length, 'user');
        if (mark === '>') this.quill.formatLine(start, 1, 'blockquote', true, 'user');
        else this.quill.formatLine(start, 1, 'header', mark.length, 'user');
        this.quill.setSelection(start, 0, 'silent');
        return false;
      },
    },
    quoteExit: {
      key: 'Enter',
      collapsed: true,
      format: ['blockquote'],
      empty: true,
      handler(range) {
        this.quill.formatLine(range.index, 1, 'blockquote', false, 'user');
        return false;
      },
    },
  };
}

/* #tags: once a word after # is finished (space or punctuation), mark it.
   Looks across the whole insert, so pasted or dictated text is tagged too. */
function autoTag(quill, delta) {
  let idx = 0, ins = null;
  for (const op of delta.ops) {
    if (op.retain) idx += op.retain;
    else if (typeof op.insert === 'string') { ins = op.insert; break; }
    else break;
  }
  if (!ins || !/[\s.,;:!?)\]]/.test(ins)) return;
  const start = Math.max(0, idx - 42);
  const end = idx + ins.length;
  const text = quill.getText(start, end - start);
  const re = /(^|[\s(])(#[\p{L}\p{N}_-]{1,40})(?=[\s.,;:!?)\]])/gu;
  let m;
  while ((m = re.exec(text))) {
    const at = start + m.index + m[1].length;
    const len = m[2].length;
    if (!quill.getFormat(at, len).tag) quill.formatText(at, len, 'tag', 'on', 'api');
  }
}

/* ---- insert a kept passage as its own block, on its own line ---- */
function insertQuote(quill, { text, page, thought }, atEnd) {
  const Delta = window.Quill.import('delta');
  const range = (!atEnd && quill.getSelection()) || { index: quill.getLength() - 1 };
  const [line, offset] = quill.getLine(range.index);
  let at = range.index - offset;
  if (line && line.length() > 1) {
    // Open a clean, empty line after the current one.
    at = at + line.length() - 1;
    quill.insertText(at, '\n', 'user');
    at += 1;
    quill.removeFormat(at, 1, 'user');
  }
  const d = new Delta().retain(at);
  const paras = text.trim().split(/\n+/);
  paras.forEach((p, i) => {
    d.insert(p);
    if (i === paras.length - 1 && page) d.insert(' ').insert({ pageref: String(page).trim() });
    d.insert('\n', { blockquote: true });
  });
  let len = paras.reduce((n, p) => n + p.length + 1, 0) + (page ? 2 : 0);
  if (thought?.trim()) { d.insert(thought.trim() + '\n'); len += thought.trim().length + 1; }
  quill.updateContents(d, 'user');
  quill.setSelection(at + len, 0, 'user');
  const [ln] = quill.getLine(at);
  ln?.domNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function quoteDialog(quill, atEnd = false) {
  openModal(`
    <form class="stack">
      <h2 class="modal-title">Keep a passage</h2>
      <textarea class="input quote-in" name="text" rows="5" placeholder="The words exactly as they’re printed…" autofocus required></textarea>
      <label class="field page-field"><span class="field-label">Page</span><input class="input" name="page" inputmode="numeric" placeholder="e.g. 142" autocomplete="off"></label>
      <label class="field"><span class="field-label">Your thought (optional)</span>
        <textarea class="input" name="thought" rows="2" placeholder="Why it stopped you"></textarea></label>
      <div class="modal-actions"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn gold">Keep it</button></div>
    </form>`, {
    cls: 'narrow',
    onMount(el, close) {
      el.querySelector('form').onsubmit = e => {
        e.preventDefault();
        const f = new FormData(e.target);
        const text = String(f.get('text') || '').trim();
        if (!text) return;
        insertQuote(quill, { text, page: String(f.get('page') || '').trim(), thought: String(f.get('thought') || '') }, atEnd);
        close();
        toast('Kept.');
      };
    },
  });
}

function pageDialog(quill) {
  const range = quill.getSelection(true);
  openModal(`
    <form class="stack">
      <h2 class="modal-title">Page reference</h2>
      <input class="input" name="page" inputmode="numeric" placeholder="Page number" autofocus autocomplete="off">
      <div class="modal-actions"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn gold">Insert</button></div>
    </form>`, {
    cls: 'narrow',
    onMount(el, close) {
      el.querySelector('form').onsubmit = e => {
        e.preventDefault();
        const v = new FormData(e.target).get('page').trim();
        close();
        if (!v) return;
        const at = range.index;
        const prev = at > 0 ? quill.getText(at - 1, 1) : '\n';
        let i = at;
        if (!/\s/.test(prev)) { quill.insertText(i, ' ', 'user'); i++; }
        quill.insertEmbed(i, 'pageref', v, 'user');
        quill.insertText(i + 1, ' ', 'user');
        quill.setSelection(i + 2, 0, 'user');
      };
    },
  });
}

function linkDialog(quill) {
  const range = quill.getSelection(true);
  if (!range.length) { toast('Select some words first, then add the link.'); return; }
  const cur = quill.getFormat(range).link || '';
  openModal(`
    <form class="stack">
      <h2 class="modal-title">Link</h2>
      <input class="input" name="url" type="url" value="${esc(cur)}" placeholder="https://…" autofocus>
      <div class="modal-actions">${cur ? '<button type="button" class="btn ghost" data-unlink>Remove link</button>' : ''}
        <button type="button" class="btn ghost" data-close>Cancel</button><button class="btn gold">Link</button></div>
    </form>`, {
    cls: 'narrow',
    onMount(el, close) {
      el.querySelector('[data-unlink]')?.addEventListener('click', () => { quill.formatText(range, 'link', false, 'user'); close(); });
      el.querySelector('form').onsubmit = e => {
        e.preventDefault();
        const url = new FormData(e.target).get('url').trim();
        quill.formatText(range.index, range.length, 'link', url || false, 'user');
        close();
      };
    },
  });
}

/* ---- read the notebook: quotes, tags, headings, words ----
   One pass over the Delta. Line numbers match quill.getLines(): every '\n'
   closes a line, and a divider is a line of its own. */
export function derive(quill) {
  const ops = quill.getContents().ops;
  const quotes = [], outline = [], tags = new Set();
  let text = '', page = null, lineNo = 0, cur = null;

  const endLine = attrs => {
    let t = text.trim();
    if (attrs.blockquote) {
      if (!page) {
        const m = t.match(/\(?\bp{1,2}\.?\s?(\d+[-–]?\d*)\)?\s*$/i);
        if (m) { page = m[1]; t = t.slice(0, m.index).trim(); }
      }
      if (cur) { if (t) cur.text += '\n' + t; if (page) cur.page = page; }
      else if (t || page) { cur = { text: t, page, line: lineNo }; quotes.push(cur); }
    } else {
      cur = null;
      if (attrs.header && t) outline.push({ level: attrs.header, text: t.slice(0, 120), line: lineNo });
    }
    lineNo++;
    text = '';
    page = null;
  };

  for (const op of ops) {
    if (typeof op.insert === 'string') {
      const parts = op.insert.split('\n');
      parts.forEach((part, k) => {
        if (k > 0) endLine(op.attributes || {});
        text += part;
        if (op.attributes?.tag && part) tags.add(part.replace(/^#/, '').trim().toLowerCase());
      });
    } else if (op.insert?.pageref) {
      page = op.insert.pageref;
    } else if (op.insert?.divider) {
      cur = null;
      lineNo++;
    }
  }
  const words = (quill.getText().match(/[\p{L}\p{N}’'-]+/gu) || []).length;
  return { quotes: quotes.filter(q => q.text), tags: [...tags].filter(Boolean).sort(), outline, words };
}

/* ---- export a notebook as Markdown ---- */
export async function notesMarkdown(book) {
  const doc = await Store.get('notes', book.id);
  if (!doc?.ops?.length) { toast('No notes to download yet.'); return; }
  let md = `# ${book.title}\n${book.author ? `*${book.author}*\n` : ''}\n`;
  let line = '';
  const inline = (s, a = {}) => {
    if (!s) return s;
    if (a.bold) s = `**${s}**`;
    if (a.italic) s = `*${s}*`;
    if (a.strike) s = `~~${s}~~`;
    if (a.link) s = `[${s}](${a.link})`;
    return s;
  };
  let n = 0;
  for (const op of doc.ops) {
    if (op.insert?.pageref) { line += `(p. ${op.insert.pageref})`; continue; }
    if (op.insert?.divider) { md += '\n---\n\n'; continue; }
    if (typeof op.insert !== 'string') continue;
    const parts = op.insert.split('\n');
    parts.forEach((p, i) => {
      if (i > 0) {
        const a = op.attributes || {};
        const pre = a.header ? '#'.repeat(a.header + 1) + ' '
          : a.blockquote ? '> '
          : a.list === 'bullet' ? '- '
          : a.list === 'ordered' ? `${++n}. `
          : a.list === 'checked' ? '- [x] '
          : a.list === 'unchecked' ? '- [ ] ' : '';
        if (a.list !== 'ordered') n = 0;
        md += pre + line + '\n' + (a.list || a.blockquote ? '' : '\n');
        line = '';
      }
      line += inline(p, op.attributes);
    });
  }
  download(`${book.title.replace(/[^\w\s-]/g, '').trim() || 'notes'} — notes.md`, md.replace(/\n{3,}/g, '\n\n'), 'text/markdown');
}
