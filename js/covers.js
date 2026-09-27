/* Covers: Open Library when it has one, otherwise a bound-leather cover drawn
   from the title so every book still looks like itself. */

import { esc, hash, loadImage } from './util.js';
import { Store } from './store.js';

const OL = 'https://openlibrary.org';
const COVERS = 'https://covers.openlibrary.org/b';

const LEATHER = [
  ['#5a1a1b', '#3a0f10'], // oxblood
  ['#1f3a2c', '#12241b'], // forest
  ['#1b2a44', '#0f1a2c'], // midnight
  ['#3d2140', '#261328'], // plum
  ['#4a3020', '#2e1d12'], // umber
  ['#1d3b3d', '#112526'], // verdigris
  ['#23201d', '#141210'], // jet
  ['#5b4418', '#3a2b0e'], // ochre
  ['#40263a', '#291623'], // mulberry
  ['#2d3a22', '#1b2414'], // moss
];

export function coverSrc(book, large = false) {
  let src = book.cover;
  if (!src && book.isbn && !book.isbnMiss) src = `${COVERS}/isbn/${book.isbn}-M.jpg?default=false`;
  if (src && large && src.startsWith(COVERS)) src = src.replace('-M.jpg', '-L.jpg');
  return src || null;
}

/** Markup for a cover. Broken or missing images fall back to the leather one. */
export function coverHTML(book, { large = false, cls = '' } = {}) {
  const src = coverSrc(book, large);
  const pc = proceduralCover(book);
  if (!src) {
    queueFind(book);
    return `<div class="cover ${cls}">${pc}</div>`;
  }
  return `<div class="cover ${cls}"><img class="cover-img" src="${esc(src)}" alt="" loading="lazy" decoding="async"
    ${src.startsWith('data:') ? '' : 'crossorigin="anonymous"'} data-book="${esc(book.id)}">${pc}</div>`;
}

function proceduralCover(book) {
  const h = hash(`${book.title}|${book.author}`);
  const [a, b] = LEATHER[h % LEATHER.length];
  const band = (h >> 5) % 3;
  const title = esc(book.title || 'Untitled');
  const len = (book.title || '').length;
  const size = len > 48 ? 'xs' : len > 28 ? 's' : len > 14 ? 'm' : 'l';
  return `<div class="pcover band${band}" style="--l1:${a};--l2:${b}" aria-hidden="true">
    <span class="pc-title ${size}">${title}</span>
    <span class="pc-orn">❦</span>
    <span class="pc-author">${esc(book.author || '')}</span>
  </div>`;
}

/* When an Open Library image 404s, remember that and go looking by title instead. */
document.addEventListener('error', e => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || !img.classList.contains('cover-img')) return;
  img.classList.add('dead');
  const id = img.dataset.book;
  if (!id || img.dataset.reported) return;
  img.dataset.reported = '1';
  const src = img.getAttribute('src') || '';
  if (src.includes('/isbn/')) Store.patch('books', id, { isbnMiss: true });
  else if (src.startsWith(COVERS)) Store.patch('books', id, { cover: null, coverSearched: false, isbnMiss: true });
}, true);

/* ---- background cover finder: one polite request a second ---- */

const queue = [];
const queued = new Set();
let running = false;

function queueFind(book) {
  if (book.coverSearched || book.coverManual || queued.has(book.id) || !book.title) return;
  queued.add(book.id);
  queue.push(book);
  if (!running) run();
}

async function run() {
  running = true;
  while (queue.length) {
    const b = queue.shift();
    try {
      const hit = (await searchBooks(`${b.title} ${b.author || ''}`, { limit: 5, title: b.title, author: b.author }))
        .find(r => r.cover);
      const patch = { coverSearched: true };
      if (hit) {
        patch.cover = hit.cover;
        if (!b.pages && hit.pages) patch.pages = hit.pages;
        if (!b.year && hit.year) patch.year = hit.year;
      }
      await Store.patch('books', b.id, patch);
    } catch (err) {
      // Offline or rate-limited: let it try again next visit.
      queued.delete(b.id);
      if (!navigator.onLine) break;
    }
    await new Promise(r => setTimeout(r, 1100));
  }
  running = false;
}

/* ---- Open Library search ---- */

export async function searchBooks(text, { limit = 12, title, author } = {}) {
  const fields = 'key,title,author_name,cover_i,first_publish_year,number_of_pages_median';
  const params = title
    ? `title=${encodeURIComponent(title.replace(/\s*\(.*\)\s*$/, ''))}${author ? `&author=${encodeURIComponent(author)}` : ''}`
    : `q=${encodeURIComponent(text)}`;
  const r = await fetch(`${OL}/search.json?${params}&limit=${limit}&fields=${fields}`);
  if (!r.ok) throw new Error(`Open Library ${r.status}`);
  const j = await r.json();
  return (j.docs || []).map(d => ({
    olKey: d.key,
    title: d.title,
    author: (d.author_name || [])[0] || '', // later names are often translators or illustrators
    year: d.first_publish_year || null,
    pages: d.number_of_pages_median || null,
    cover: d.cover_i ? `${COVERS}/id/${d.cover_i}-M.jpg` : null,
  }));
}

/* ---- a few colours lifted from a cover, for the mood board ---- */

export async function paletteFrom(src, n = 5) {
  const img = await loadImage(src, !src.startsWith('data:'));
  const c = document.createElement('canvas');
  c.width = 48; c.height = 72;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, c.width, c.height);
  const px = g.getImageData(0, 0, c.width, c.height).data;
  const buckets = new Map();
  for (let i = 0; i < px.length; i += 4) {
    const key = (px[i] >> 4) << 8 | (px[i + 1] >> 4) << 4 | (px[i + 2] >> 4);
    const e = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += px[i]; e.g += px[i + 1]; e.b += px[i + 2];
    buckets.set(key, e);
  }
  const ranked = [...buckets.values()].sort((a, b) => b.n - a.n)
    .map(e => [e.r / e.n, e.g / e.n, e.b / e.n]);
  const out = [];
  for (const c of ranked) {
    if (out.every(o => Math.hypot(o[0] - c[0], o[1] - c[1], o[2] - c[2]) > 56)) out.push(c);
    if (out.length === n) break;
  }
  return out.map(([r, g, b]) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join(''));
}
