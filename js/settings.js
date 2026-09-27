/* The society's back office: membership, importing, shelves, backups. */

import { esc, $, plural, download, confirmDialog, promptDialog, toast } from './util.js';
import { Store } from './store.js';
import { S, books, addShelf, onData } from './state.js';
import { openImporter } from './importer.js';

export function settingsView(root, sub) {
  const draw = () => {
    const cloud = Store.mode === 'cloud';
    root.innerHTML = `
      <section class="page settings">
        <div class="page-head"><div>
          <h1 class="page-title">The Society’s Ledger</h1>
          <p class="page-sub">Membership, imports, shelves and safekeeping.</p>
        </div></div>

        <div class="card">
          <h2 class="card-title">Membership</h2>
          ${cloud
            ? `<p>Signed in as <b>${esc(Store.user?.email || '')}</b>. Your library follows you to every device you sign in on.</p>
               <p class="muted small" data-sync></p>
               <button class="btn ghost small" data-signout>Leave for the night (sign out)</button>`
            : `<p>This library lives in this browser only.</p>
               <p class="muted small">Syncing between your phone and laptop switches on once the archive has a home in the cloud (see SETUP.md). Until then, download a backup now and then.</p>`}
        </div>

        <div class="card" id="import">
          <h2 class="card-title">Bring your books over</h2>
          <p>From a Goodreads or StoryGraph export: your ratings, dates, shelves and reviews.</p>
          <button class="btn gold" data-import>Import a .csv</button>
        </div>

        <div class="card" id="shelves">
          <h2 class="card-title">Your shelves</h2>
          <p class="muted small">Currently Reading, To Be Read and a shelf for each year are kept automatically. These are your own.</p>
          <ul class="shelf-admin">${S.shelves.map((s, i) => `
            <li data-id="${esc(s.id)}">
              <span class="sa-name">${esc(s.name)}</span>
              <span class="sa-count">${books().filter(b => (b.shelves || []).includes(s.id)).length}</span>
              <button class="icon-btn" data-up ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
              <button class="icon-btn" data-down ${i === S.shelves.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
              <button class="linkish small" data-rename>Rename</button>
              <button class="linkish small danger-text" data-del>Take down</button>
            </li>`).join('') || '<li class="muted">None yet.</li>'}</ul>
          <button class="btn ghost small" data-newshelf>+ New shelf</button>
        </div>

        <div class="card">
          <h2 class="card-title">Safekeeping</h2>
          <p>Download everything — books, notes, mood boards — as one file you can keep, or restore it later.</p>
          <div class="row wrap">
            <button class="btn ghost" data-export>Download a backup</button>
            <label class="btn ghost">Restore from a backup<input type="file" accept=".json,application/json" hidden data-restore></label>
          </div>
        </div>

        <p class="colophon">The Bank Where the Wild Thyme Blows · ${plural(books().length, 'volume')} in the archive</p>
      </section>`;
    if (sub) setTimeout(() => $(`#${sub}`, root)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    sub = null;
  };

  root.onclick = async e => {
    const t = e.target;
    if (t.closest('[data-import]')) openImporter();
    if (t.closest('[data-signout]')) { await Store.signOut(); location.hash = '#/'; }
    if (t.closest('[data-newshelf]')) {
      const name = await promptDialog('A new shelf', { placeholder: 'Favourites, Comfort reads, Books that ruined me…', ok: 'Make shelf' });
      if (name) addShelf(name);
    }
    if (t.closest('[data-export]')) {
      const data = await Store.exportAll();
      download(`wild-thyme-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data));
      toast('Backup downloaded.');
    }
    const li = t.closest('li[data-id]');
    if (!li) return;
    const s = S.shelves.find(x => x.id === li.dataset.id);
    if (!s) return;
    if (t.closest('[data-rename]')) {
      const name = await promptDialog('Rename shelf', { value: s.name });
      if (name) Store.patch('shelves', s.id, { name });
    }
    if (t.closest('[data-del]')) {
      if (!(await confirmDialog(`Take down “${s.name}”?`, 'The books stay in the archive; only this shelf goes.', { ok: 'Take it down', danger: true }))) return;
      const affected = books().filter(b => (b.shelves || []).includes(s.id));
      affected.forEach(b => Store.patch('books', b.id, { shelves: b.shelves.filter(x => x !== s.id) }));
      Store.remove('shelves', s.id);
    }
    const up = t.closest('[data-up]'), down = t.closest('[data-down]');
    if (up || down) {
      const list = [...S.shelves];
      const i = list.indexOf(s), j = up ? i - 1 : i + 1;
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      Store.putMany('shelves', list.map((x, k) => ({ ...x, order: k })));
    }
  };
  root.onchange = async e => {
    if (!e.target.matches('[data-restore]')) return;
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data.app !== 'wild-thyme') throw new Error('not ours');
      const n = data.books?.length || 0;
      if (!(await confirmDialog('Restore this backup?', `It holds ${plural(n, 'book')}. Anything here that came from this backup is replaced by the backup’s copy; nothing else is touched.`, { ok: 'Restore' }))) return;
      for (const c of ['shelves', 'books', 'notes', 'pins']) if (data[c]?.length) await Store.putMany(c, data[c]);
      toast('Restored.');
    } catch {
      toast('That file isn’t a backup from here.');
    }
    e.target.value = '';
  };

  draw();
  const offStatus = Store.onStatus(st => {
    const el = $('[data-sync]', root);
    if (el) el.textContent = !st.online ? 'Offline — changes are kept on this device and will sync when you’re back.'
      : st.pending ? 'Syncing…' : 'Everything is synced.';
  });
  const off = onData(k => { if (k === 'shelves' || k === 'books') draw(); });
  return () => { off(); offStatus(); root.onclick = null; root.onchange = null; };
}
