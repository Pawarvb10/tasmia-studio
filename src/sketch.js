/* =====================================================================
   sketch.js : designer sketch pad — draw a design on a front/back
               stencil (or over a photo) and attach it to an article
   ===================================================================== */
const STENCILS = [['blouse', 'Blouse / choli — front & back'], ['top', 'Kurti / top / dress — front & back'], ['lower', 'Bottom / lehenga / skirt — front & back'], ['men', 'Men — kurta / jacket — front & back'], ['blank', 'Blank page']];
function stencilSVG(kind){
  if(kind === 'blank') return '';
  const f = kind === 'men' ? 'm' : 'w', y0 = kind === 'lower' ? 112 : 0, y1 = kind === 'blouse' || kind === 'men' ? 205 : kind === 'top' ? 330 : 385, H = y1 - y0;
  const one = (dx, back) => `<g transform="translate(${dx},0)" fill="none" stroke="#9c9c9c" stroke-width="0.9" stroke-linejoin="round">
    <path d="${armPath(f, 1)} ${armPath(f, -1)}"/><path d="${bodyPath(f)}" fill="#fff"/><rect x="${100 - (f === 'm' ? 8 : 7)}" y="31" width="${f === 'm' ? 16 : 14}" height="19" rx="3" fill="#fff"/><ellipse cx="100" cy="19" rx="${f === 'm' ? 12 : 11}" ry="15" fill="#fff"/>
    ${back ? `<path d="M100,52 L100,${Math.min(y1, 190)}" stroke-dasharray="3 3" stroke="#c8c8c8"/>` : `<path d="M100,50 L100,58" stroke="#c8c8c8"/>${f === 'w' ? `<path d="M${MP(-22, 92)} Q${MP(-12, 103)} ${MP(-3, 95)} M${MP(3, 95)} Q${MP(12, 103)} ${MP(22, 92)}" stroke="#d2d2d2"/>` : ''}`}
    <path d="M${MP(-31, 132)} L${MP(31, 132)}" stroke="#e0e0e0" stroke-dasharray="2 3"/></g>
    <text x="${dx + 100}" y="${y0 + H - 4}" text-anchor="middle" font-family="sans-serif" font-size="8" fill="#b0b0b0">${back ? 'BACK' : 'FRONT'}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${y0} 400 ${H}" width="1400" height="${Math.round(1400 * H / 400)}"><rect x="0" y="${y0}" width="400" height="${H}" fill="#fff"/>${one(0, false)}${one(200, true)}</svg>`;
}
const SK = {};
const SK_COLORS = ['#1f3a93', '#111111', '#c0392b', '#7a2948', '#b8860b', '#2e7d4f', '#e17fa6'];
function loadImg(src){ return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; }); }
/* opts: {title, base (media id to draw over), stencil, onSave(mediaId, caption)} */
async function openSketchPad(opts){
  Object.assign(SK, {opts, color: SK_COLORS[0], size: 3, tool: 'pen', undo: [], stencil: opts.base ? 'photo' : (opts.stencil || 'blouse')});
  openModal(`<div class="mbar"><b>✏ ${h(opts.title || 'Design sketch')}</b><span class="sp"></span><button onclick="closeModal()">Cancel</button><button class="pri" id="skSave" onclick="saveSketch()">Save to article</button></div>
  <div class="sktools">
    <select id="skSt" onchange="skStencil(this.value)" style="width:auto">${STENCILS.map(([k, l]) => opt(k, l, SK.stencil)).join('')}${opts.base ? opt('photo', 'Current image', 'photo') : ''}</select>
    <label class="btn sm" style="margin:0;color:var(--ink)">📷 Draw over a photo<input type="file" accept="image/*" style="display:none" onchange="skPhoto(this)"></label>
    <span class="skgrp">${SK_COLORS.map((c, i) => `<button class="skc ${i ? '' : 'on'}" style="background:${c}" title="Colour" onclick="skSet('color','${c}',this)"></button>`).join('')}</span>
    <span class="skgrp">${[[2, 'Fine'], [3, 'Pen'], [6, 'Marker'], [14, 'Brush']].map(([s, l]) => `<button class="sm ${s === 3 ? 'on' : ''}" data-sz onclick="skSet('size',${s},this)">${l}</button>`).join('')}</span>
    <span class="skgrp"><button class="sm on" data-tl="pen" onclick="skTool('pen',this)">✏ Pen</button><button class="sm" data-tl="line" onclick="skTool('line',this)">／ Line</button><button class="sm" data-tl="text" onclick="skTool('text',this);document.getElementById('skTxt').focus()">T Text</button><input id="skTxt" placeholder="text, then tap the sketch" style="width:170px;padding:4px 8px"><button class="sm" data-tl="erase" onclick="skTool('erase',this)">⌫ Eraser</button></span>
    <span class="skgrp"><button class="sm" onclick="skUndo()">↶ Undo</button><button class="sm ghost danger" onclick="skClear()">Clear</button></span>
  </div>
  <div class="skwrap" id="skWrap"><canvas id="skBg"></canvas><canvas id="skInk"></canvas></div>
  <div class="row ac" style="margin-top:8px"><input id="skCap" placeholder="Caption, e.g. Riya – zardosi front, deep U back with latkans" style="flex:1"><span class="muted" style="font-size:12px">Draw with a finger, stylus or mouse.</span></div>`, true);
  await skStencil(SK.stencil, true);
  const ink = document.getElementById('skInk'); let drawing = false, last = null, start = null, snap = null;
  const pt = e => { const r = ink.getBoundingClientRect(); return [(e.clientX - r.left) * ink.width / r.width, (e.clientY - r.top) * ink.height / r.height]; };
  const ctx = ink.getContext('2d'), scale = () => ink.width / ink.getBoundingClientRect().width;
  const style = () => { ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalCompositeOperation = SK.tool === 'erase' ? 'destination-out' : 'source-over'; ctx.strokeStyle = SK.color; ctx.lineWidth = (SK.tool === 'erase' ? SK.size * 4 : SK.size) * scale(); };
  ink.onpointerdown = e => {
    e.preventDefault(); const p = pt(e); skPush();
    if(SK.tool === 'text'){ const tx = document.getElementById('skTxt').value.trim(); if(tx){ ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = SK.color; ctx.font = `${Math.round((14 + SK.size * 3) * scale())}px sans-serif`; ctx.fillText(tx, p[0], p[1]); } else { SK.undo.pop(); toast('Type the text in the box first, then tap where it goes', 'info'); } return; }
    drawing = true; last = p; start = p; ink.setPointerCapture(e.pointerId); style();
    if(SK.tool === 'line') snap = ctx.getImageData(0, 0, ink.width, ink.height); else { ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + 0.01, p[1]); ctx.stroke(); }
  };
  ink.onpointermove = e => {
    if(!drawing) return; e.preventDefault(); style();
    if(SK.tool === 'line'){ const p = pt(e); ctx.putImageData(snap, 0, 0); ctx.beginPath(); ctx.moveTo(start[0], start[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); return; }
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; (evs.length ? evs : [e]).forEach(ev => { const p = pt(ev); ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); last = p; });
  };
  ink.onpointerup = ink.onpointercancel = () => { drawing = false; snap = null; };
}
async function skStencil(kind, first){
  const bg = document.getElementById('skBg'), ink = document.getElementById('skInk'); if(!bg) return;
  let im = null;
  if(kind === 'photo' && SK.opts.base){ const u = await mediaUrl(SK.opts.base); if(u) im = await loadImg(u).catch(() => null); }
  else if(kind === 'photo' && SK.photo) im = SK.photo;
  else if(kind !== 'blank'){ const svg = stencilSVG(kind); im = await loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)); }
  const W = 1400, Hh = im ? Math.min(2000, Math.round(W * (im.naturalHeight || im.height) / (im.naturalWidth || im.width))) : 900;
  const keep = !first && ink.width ? ink.toDataURL() : null;
  [bg, ink].forEach(c => { c.width = W; c.height = Hh; });
  const b = bg.getContext('2d'); b.fillStyle = '#fff'; b.fillRect(0, 0, W, Hh); if(im) b.drawImage(im, 0, 0, W, Hh);
  if(keep){ const k = await loadImg(keep); ink.getContext('2d').drawImage(k, 0, 0, W, Hh); }
  SK.stencil = kind;
}
async function skPhoto(inp){ const f = inp.files[0]; inp.value = ''; if(!f) return; const u = URL.createObjectURL(f); SK.photo = await loadImg(u); const sel = document.getElementById('skSt'); if(![...sel.options].some(o => o.value === 'photo')) sel.add(new Option('Uploaded photo', 'photo')); sel.value = 'photo'; SK.opts.base = null; skStencil('photo'); }
function skSet(k, val, el){ SK[k] = val; el.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('on')); el.classList.add('on'); if(k === 'color' && SK.tool === 'erase') skTool('pen', document.querySelector('[data-tl="pen"]')); }
function skTool(t, el){ SK.tool = t; document.querySelectorAll('[data-tl]').forEach(b => b.classList.toggle('on', b === el)); }
function skPush(){ const ink = document.getElementById('skInk'); SK.undo.push(ink.getContext('2d').getImageData(0, 0, ink.width, ink.height)); if(SK.undo.length > 25) SK.undo.shift(); }
function skUndo(){ const ink = document.getElementById('skInk'), d = SK.undo.pop(); if(d) ink.getContext('2d').putImageData(d, 0, 0); }
function skClear(){ skPush(); const ink = document.getElementById('skInk'); ink.getContext('2d').clearRect(0, 0, ink.width, ink.height); }
async function saveSketch(){
  const bg = document.getElementById('skBg'), ink = document.getElementById('skInk'), btn = document.getElementById('skSave');
  const out = document.createElement('canvas'); out.width = bg.width; out.height = bg.height; const o = out.getContext('2d'); o.drawImage(bg, 0, 0); o.drawImage(ink, 0, 0);
  btn.disabled = true; btn.textContent = 'Saving…';
  const blob = await new Promise(r => out.toBlob(r, 'image/jpeg', 0.88)), id = await mediaPut(blob), cap = document.getElementById('skCap').value.trim();
  const cb = SK.opts.onSave; closeModal(); cb(id, cap); toast('Sketch saved to the article', 'ok');
}
/* attach points */
function sketchDraft(i, base){ const d = EDIT.garments[i]; openSketchPad({title: `Sketch · article ${i + 1} · ${d.title}`, base, stencil: stencilFor(d.tplId), onSave: (id, cap) => { d.files.push({id, kind: 'sketch', caption: cap}); softRender(); }}); }
function sketchGarment(gid, base){
  const g = gar(gid);
  openSketchPad({title: `Sketch · ${g.no} ${g.title}`, base, stencil: stencilFor(g.tplId), onSave: (id, cap) => {
    const D = g.design || (g.design = {versions: [], approvedV: 0}), before = clone(g); let z = D.versions[D.versions.length - 1];
    if(!z || z.approved){ D.versions.push({v: D.versions.length + 1, at: nowISO(), by: meName(), note: z ? 'Designer sketch (change after approval)' : 'Designer sketch', files: z ? clone(z.files) : [], fields: z ? clone(z.fields) : {pattern: '', placement: '', lining: '', trims: '', colours: '', notes: ''}, approved: false, approvedAt: '', approvedBy: ''}); z = D.versions[D.versions.length - 1]; }
    z.files.push({id, kind: 'sketch', caption: cap}); gLog(g, `Designer sketch added to design version ${z.v}`, before); save(); render();
  }});
}
function stencilFor(tplId){ const t = tpl(tplId) || {}; if(t.category === 'Men') return 'men'; const ch = t.charts || []; return ch.includes('blouse') ? 'blouse' : ch.includes('top') ? 'top' : ch.includes('bottom') ? 'lower' : 'blouse'; }
