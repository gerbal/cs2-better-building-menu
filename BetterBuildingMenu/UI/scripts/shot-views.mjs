// Drive the menu over CDP and capture each view: node shot-views.mjs <port> <prefix>
// Writes <prefix>-cards.png, -grid.png, -table.png, -card.png, -picker.png.
import { writeFileSync } from "node:fs";
const [port, prefix] = process.argv.slice(2);
const list = await (await fetch(`http://localhost:${port}/json/list`)).json();
const ws = new WebSocket(list[0].webSocketDebuggerUrl);
let id = 0; const pending = new Map();
const call = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } };
await new Promise((r) => (ws.onopen = r));
await call("Page.enable");
const evalJs = async (expression) => { const r = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); return r.result && r.result.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => { const s = await call("Page.captureScreenshot", { format: "png" }); writeFileSync(`${prefix}-${name}.png`, Buffer.from(s.data, "base64")); console.log("wrote", `${prefix}-${name}.png`); };
const press = `(el) => { for (const t of ['pointerdown','mousedown','pointerup','mouseup','click']) el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window })); }`;
const btn = `(name) => Array.from(document.querySelectorAll('button')).find(x => (x.textContent||'').trim() === name)`;
for (const view of ["Cards", "Grid", "Table"]) {
  await evalJs(`(${press})((${btn})(${JSON.stringify(view)}))`);
  await sleep(1500);
  await shot(view.toLowerCase());
}
await evalJs(`(${press})((${btn})("Cards"))`);
await sleep(1200);
// Hover the bottom-right visible tile with the same events the MCP dispatches.
// Only a tile that hit-tests at its own centre is on screen; one scrolled under the panel's fold is inside the window but clipped.
await evalJs(`(() => { const tiles = Array.from(document.querySelectorAll('[data-catalog-entry]')); const rects = tiles.map((t, i) => { const b = t.getBoundingClientRect(); return { i, y: b.top, x: b.left, w: b.width, cx: b.left + b.width / 2, cy: b.top + b.height / 2 }; }).filter(x => x.w > 0 && x.cy >= 0 && x.cy <= window.innerHeight).filter(x => { const hit = document.elementFromPoint(x.cx, x.cy); return hit && (hit === tiles[x.i] || tiles[x.i].contains(hit)); }); const last = rects.sort((a, b) => (b.y - a.y) || (b.x - a.x))[0]; const el = tiles[last.i]; const r = el.getBoundingClientRect(); for (const t of ['pointerover','mouseover','pointerenter','mouseenter','mousemove']) el.dispatchEvent(new MouseEvent(t, { bubbles: t !== 'pointerenter' && t !== 'mouseenter', clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, view: window })); return last.i; })()`);
await sleep(1200);
await shot("card");
await evalJs(`(() => { const el = document.querySelector('[data-catalog-entry]'); for (const t of ['pointerout','mouseout','pointerleave','mouseleave']) el.dispatchEvent(new MouseEvent(t, { bubbles: true })); })()`);
// Group-by picker: the vanilla dropdown needs the real click path; try DOM events.
await evalJs(`(${press})(Array.from(document.querySelectorAll('button')).find(b => /^Category/.test((b.textContent||'').trim())))`);
await sleep(900);
await shot("picker");
await evalJs(`(${press})(Array.from(document.querySelectorAll('button')).find(b => /^Category/.test((b.textContent||'').trim())))`);
ws.close();
