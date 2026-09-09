// Layout probe for the building menu: run in the game page (game_eval, or
// node scripts/cs2-cdp-eval.mjs <port> UI/scripts/layout-probe.js). Overflow is content past
// max(clientWidth, offsetWidth): Cohtml's scrollWidth equals offsetWidth when
// nothing overflows and clientWidth excludes the border, so scroll − client
// reports every border as a clip (it did, at 1440p). Reports, for the visible menu:
//  - elements whose box leaves the 1280x720 viewport
//  - text elements that clip (scrollWidth > clientWidth with overflow hidden/ellipsis)
//  - overlapping catalog tiles (siblings whose boxes intersect)
//  - scroll containers whose content is wider than themselves (horizontal scroll)
(() => {
  const W = window.innerWidth, H = window.innerHeight;
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const label = (e) => (e.tagName + '.' + String(e.className || '').split(' ').slice(0, 2).join('.')).slice(0, 48) + ' "' + (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 28) + '"';
  const all = Array.from(document.querySelectorAll('body *')).filter(vis);
  const offscreen = all.filter((e) => { const r = e.getBoundingClientRect(); return r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1; })
    .filter((e) => !all.some((p) => p !== e && p.contains(e) && (() => { const r = p.getBoundingClientRect(); return r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1; })()))
    .map(label).slice(0, 8);
  const clipped = all.filter((e) => { const cs = getComputedStyle(e); return e.children.length === 0 && (cs.overflow === 'hidden' || cs.overflowX === 'hidden' || cs.textOverflow === 'ellipsis') && e.scrollWidth - Math.max(e.clientWidth, e.offsetWidth) > 1; }).map((e) => label(e) + ` (${e.scrollWidth}>${Math.max(e.clientWidth, e.offsetWidth)})`).slice(0, 12);
  const tiles = Array.from(document.querySelectorAll('[data-catalog-entry]')).filter(vis);
  const overlaps = [];
  for (let i = 0; i < tiles.length && overlaps.length < 6; i++) for (let j = i + 1; j < tiles.length; j++) {
    const a = tiles[i].getBoundingClientRect(), b = tiles[j].getBoundingClientRect();
    if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) { overlaps.push(label(tiles[i]) + ' × ' + label(tiles[j])); break; }
  }
  const hscroll = all.filter((e) => { const cs = getComputedStyle(e); return (cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflow === 'auto') && e.scrollWidth - Math.max(e.clientWidth, e.offsetWidth) > 1; }).map((e) => label(e) + ` (${e.scrollWidth}>${Math.max(e.clientWidth, e.offsetWidth)})`).slice(0, 6);
  const tileRects = tiles.slice(0, 3).map((t) => { const r = t.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; });
  return { viewport: [W, H], tiles: tiles.length, tileRects, offscreen, clipped, overlaps, hscroll };
})()
