// Table column probe: each metric column's inline width against the drawn
// header and first-row cell, in rem (1rem = viewport width / 1920), with the
// overflow of each — content past max(clientWidth, offsetWidth), see
// layout-probe.js. Run with the Table view open:
//   node scripts/cs2-cdp-eval.mjs <port> UI/scripts/table-widths-probe.js
// Header cells carry a metricHeader class; row cells do not. The header row
// is wider than a row by its trailing reserve (cm-7kr8).
(() => {
  const remPx = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  const rem = (v) => Math.round(v / remPx * 10) / 10;
  const overflow = (e) => e.scrollWidth - Math.max(e.clientWidth, e.offsetWidth);
  const all = [...document.querySelectorAll('[data-metric]')];
  const heads = all.filter((e) => /metricHeader/.test(e.className));
  const cells = all.filter((e) => !/metricHeader/.test(e.className));
  const first = {};
  for (const c of cells) if (!(c.dataset.metric in first)) first[c.dataset.metric] = c;
  const out = { vw: window.innerWidth, cols: [], cellsChecked: cells.length, worstCellOverflowPx: 0 };
  let headTotal = 0, cellTotal = 0;
  for (const h of heads) {
    const k = h.dataset.metric, c = first[k];
    const hw = h.getBoundingClientRect().width, cw = c ? c.getBoundingClientRect().width : 0;
    headTotal += hw; cellTotal += cw;
    out.cols.push({ k, inline: h.style.width, head: rem(hw), cell: rem(cw), headOverflowPx: overflow(h), cellOverflowPx: c ? overflow(c) : null,
      headLeft: rem(h.getBoundingClientRect().left), cellLeft: c ? rem(c.getBoundingClientRect().left) : null });
  }
  for (const c of cells) out.worstCellOverflowPx = Math.max(out.worstCellOverflowPx, overflow(c));
  out.headTotal = rem(headTotal); out.cellTotal = rem(cellTotal);
  const hdr = heads[0] && heads[0].parentElement, row = first.cost && first.cost.parentElement;
  if (hdr) { out.headerRow = rem(hdr.getBoundingClientRect().width); const ih = [...hdr.children].find((e) => /identityHeader/.test(e.className)); out.identityHeader = ih ? rem(ih.getBoundingClientRect().width) : null; }
  if (row) { out.row = rem(row.getBoundingClientRect().width); const ic = [...row.children].find((e) => /identityCell/.test(e.className)); out.identityCell = ic ? rem(ic.getBoundingClientRect().width) : null;
    const names = [...document.querySelectorAll('[class*="identityCell"] [class*="name_"]')]; out.namesChecked = names.length; out.namesOverflowing = names.filter((n) => overflow(n) > 1).length; }
  return JSON.stringify(out);
})()
