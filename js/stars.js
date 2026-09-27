/* Star ratings, in halves. Display handles any fraction (StoryGraph's 4.25s)
   by clipping a gold row over a dim one. */

const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.4l7.1-.6z"/></svg>';
const ROW = STAR.repeat(5);

export function starsHTML(rating, cls = '') {
  if (!rating) return '';
  const pct = Math.max(0, Math.min(5, rating)) / 5 * 100;
  return `<span class="stars ${cls}" role="img" aria-label="${rating} of 5 stars">
    <span class="stars-dim">${ROW}</span><span class="stars-gold" style="width:${pct}%">${ROW}</span></span>`;
}

/** An interactive rater. onChange(value) gets 0 when she clears it. */
export function mountRater(el, value, onChange) {
  el.classList.add('rater');
  el.setAttribute('role', 'slider');
  el.setAttribute('aria-label', 'Rating');
  el.setAttribute('aria-valuemin', '0');
  el.setAttribute('aria-valuemax', '5');
  el.tabIndex = 0;
  el.innerHTML = `<span class="stars big"><span class="stars-dim">${ROW}</span><span class="stars-gold">${ROW}</span></span>
    <span class="rater-num"></span>`;
  const gold = el.querySelector('.stars-gold');
  const num = el.querySelector('.rater-num');
  const row = el.querySelector('.stars');
  let current = value || 0;

  const show = v => {
    gold.style.width = `${(v / 5) * 100}%`;
    num.textContent = v ? (Number.isInteger(v) ? v : v.toFixed(v * 4 % 2 ? 2 : 1)) : 'unrated';
    el.setAttribute('aria-valuenow', v);
  };
  const at = x => {
    const r = row.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (x - r.left) / r.width));
    return Math.max(0.5, Math.ceil(f * 10) / 2);
  };
  show(current);

  row.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') show(at(e.clientX)); });
  row.addEventListener('pointerleave', () => show(current));
  row.addEventListener('click', e => {
    const v = at(e.clientX);
    current = v === current ? 0 : v;   // tap the same value again to clear
    show(current);
    onChange(current);
  });
  el.addEventListener('keydown', e => {
    const d = { ArrowRight: 0.5, ArrowUp: 0.5, ArrowLeft: -0.5, ArrowDown: -0.5 }[e.key];
    if (d === undefined) return;
    e.preventDefault();
    current = Math.max(0, Math.min(5, Math.round((current + d) * 2) / 2));
    show(current);
    onChange(current);
  });
  return { set(v) { current = v || 0; show(current); } };
}
