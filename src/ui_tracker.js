/* =====================================================================
   ui_tracker.js : delivery tracker — every order with its articles, job,
                   units, mobile, committed delivery date and status,
                   always in ascending order of committed delivery date
   ===================================================================== */
function jobSummary(gs){ const m = new Map(); gs.forEach(g => { const c = tpl(g.tplId)?.code || tpl(g.tplId)?.name || 'Item'; m.set(c, (m.get(c) || 0) + gq(g)); }); return [...m].map(([c, n]) => `${n} ${c}`).join(' + '); }
const TR_ST = {ready: ['Ready to deliver', 'c-ok'], partready: ['Partly ready', 'c-ok'], production: ['In production', 'c-acc'], planned: ['Not started', 'c-mut'], hold: ['On hold', 'c-warn'], delivered: ['Delivered', 'c-mut'], partdel: ['Part delivered', 'c-info'], cancelled: ['Cancelled', 'c-bad']};
function orderTrack(o){
  const gs = activeG(o), st = gs.map(gStatus), pend = gs.filter((g, k) => st[k] !== 'delivered');
  const commit = (pend.length ? pend : gs).map(g => g.deliveryDate || o.deliveryDate).filter(Boolean).sort()[0] || o.deliveryDate || '';
  let stage;
  if(o.status === 'cancelled') stage = 'cancelled';
  else if(!gs.length || !pend.length) stage = 'delivered';
  else if(pend.every(g => gStatus(g) === 'ready')) stage = 'ready';
  else if(pend.some(g => gStatus(g) === 'ready')) stage = 'partready';
  else if(pend.every(g => gStatus(g) === 'hold')) stage = 'hold';
  else if(pend.some(g => ['production', 'qc'].includes(gStatus(g)))) stage = 'production';
  else stage = st.includes('delivered') ? 'partdel' : 'planned';
  const open = !['delivered', 'cancelled'].includes(stage);
  return {o, gs, pend, commit, stage, open, units: sum(gs, gq), pendUnits: sum(pend, gq), job: jobSummary(gs), overdue: open && commit && commit < todayISO(), urgent: o.urgent || gs.some(g => g.urgent)};
}
function trackList(){
  const f = UI.trf || 'open', q = (UI.trq || '').toLowerCase().trim(), from = UI.trFrom || '', to = UI.trTo || '';
  const all = coll('orders').map(orderTrack);
  const match = x => { if(!q) return true; const c = cust(x.o.customerId) || {}; return `${x.o.no} ${c.name} ${c.phone} ${c.phone2} ${members(c).map(m => m.name).join(' ')} ${x.gs.map(g => g.no + ' ' + g.title).join(' ')}`.toLowerCase().includes(q) || (q.replace(/\D/g, '').length >= 4 && `${c.phone}${c.phone2}`.replace(/\D/g, '').includes(q.replace(/\D/g, ''))); };
  const inF = {open: x => x.open, ready: x => x.open && ['ready', 'partready'].includes(x.stage), wip: x => x.open && !['ready'].includes(x.stage), overdue: x => x.overdue, delivered: x => x.stage === 'delivered', all: () => true};
  const base = all.filter(match).filter(x => (!from || x.commit >= from) && (!to || x.commit <= to));
  const counts = {}; Object.keys(inF).forEach(k => counts[k] = base.filter(inF[k]).length);
  const L = base.filter(inF[f] || inF.open).sort((a, b) => (a.commit || '9999').localeCompare(b.commit || '9999') || (b.urgent - a.urgent) || a.o.no.localeCompare(b.o.no, undefined, {numeric: true}));
  return {L, counts};
}
const relDay = d => { if(!d) return ''; const n = Math.round((new Date(d) - new Date(todayISO())) / 864e5); return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n === -1 ? 'Yesterday' : n < 0 ? `${-n} days overdue` : `in ${n} days`; };
VIEWS.tracker = {perm: 'orders', title: 'Delivery tracker', fn: () => {
  const {L, counts} = trackList(), f = UI.trf || 'open';
  const tabs = [['open', 'To deliver'], ['ready', 'Ready to deliver'], ['wip', 'In progress'], ['overdue', 'Overdue'], ['delivered', 'Delivered'], ['all', 'All']];
  return `<div class="row ac"><div><h1>Delivery tracker</h1><div class="sub">All orders, earliest committed delivery first. Tap an order to see its articles. <span class="trlegend">Green</span> = ready to deliver.</div></div><span class="sp"></span><button onclick="trackerCSV()">⬇ CSV</button><button onclick="trackerPDF()">⬇ Print list</button></div>
  <div class="card trbar">
    <div class="row ac" style="gap:8px"><input id="trq" placeholder="Search order no., name, mobile, family member…" value="${v(UI.trq)}" oninput="UI.trq=this.value;clearTimeout(window._trt);window._trt=setTimeout(()=>{softRender();const i=document.getElementById('trq');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}},250)" style="flex:1;min-width:220px">
      <label class="inline">From <input type="date" value="${v(UI.trFrom)}" onchange="UI.trFrom=this.value;render()" style="width:auto;margin-left:4px"></label><label class="inline">To <input type="date" value="${v(UI.trTo)}" onchange="UI.trTo=this.value;render()" style="width:auto;margin-left:4px"></label>
      ${UI.trFrom || UI.trTo || UI.trq ? '<button class="sm ghost" onclick="UI.trFrom=UI.trTo=UI.trq=\'\';render()">Clear</button>' : ''}</div>
    <div class="tabs" style="margin:10px 0 0">${tabs.map(([k, l]) => `<button class="${f === k ? 'on' : ''}" onclick="UI.trf='${k}';UI.trSel='';render()">${l} <span class="tcount">${counts[k]}</span></button>`).join('')}</div></div>
  ${!L.length ? '<div class="card empty">No orders match.</div>' : `<div class="trlist"><div class="trhead"><span>Committed delivery ↑</span><span>Order</span><span>Customer · mobile</span><span>Articles</span><span class="n">Units</span><span>Status</span><span></span></div>
  ${L.map(x => trRow(x, UI.trSel === x.o.id)).join('')}</div>`}`;
}};
function trToggle(oid){ UI.trSel = UI.trSel === oid ? '' : oid; softRender(); if(UI.trSel) setTimeout(() => { const el = document.getElementById('tr-' + oid); if(el){ const r = el.getBoundingClientRect(); if(r.top < 60 || r.top > innerHeight - 120) el.scrollIntoView({behavior: 'smooth', block: 'start'}); } }, 30); }
function trRow(x, open){
  const o = x.o, c = cust(o.customerId) || {}, [sl, sc] = TR_ST[x.stage];
  return `<div class="tritem ${open ? 'open' : ''} ${x.stage === 'ready' ? 'trready' : x.stage === 'partready' ? 'trpart' : ''} ${x.overdue ? 'late' : ''}" id="tr-${o.id}">
    <div class="trsum" role="button" tabindex="0" aria-expanded="${open}" onclick="trToggle('${o.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();trToggle('${o.id}')}">
      <span class="trd"><b>${x.commit ? fmtDs(x.commit) : '—'}</b><small class="${x.overdue ? 'danger' : 'muted'}">${x.open ? relDay(x.commit) : 'done'}</small></span>
      <span class="tro"><b>${h(o.no)}</b>${x.urgent ? ' <span class="chip urgent">URGENT</span>' : ''}</span>
      <span class="trc"><b>${h(c.name || '')}</b><small class="muted">${h(c.phone || '')}</small></span>
      <span class="trj">${h(x.job)}</span>
      <span class="n tru">${x.units}<small class="muted"> pcs</small></span>
      <span class="trs"><span class="chip ${sc}">${sl}</span></span>
      <span class="trchev">${open ? '▴' : '▾'}</span></div>
    ${open ? trDetail(x) : ''}</div>`;
}
function trDetail(x){
  const o = x.o, c = cust(o.customerId) || {}, T = can('prices') ? orderTotals(o) : null;
  return `<div class="trbody">
    <div class="trmeta">${c.phone ? `<a class="btn sm" href="tel:${h(c.phone.replace(/\s/g, ''))}">📞 Call</a>` : ''}${can('comms') ? `<button class="sm" onclick="openCompose('${o.id}','${x.stage === 'ready' || x.stage === 'partready' ? 'ready' : ''}')">💬 Message</button>` : ''}${x.stage === 'ready' || x.stage === 'partready' ? `<button class="sm okb" onclick="go('qc')">Hand over</button>` : ''}<button class="sm pri" onclick="go('order-${o.id}')">Open order →</button>
      <span class="sp"></span><span class="muted" style="font-size:12.5px">Booked ${fmtD(o.created)}${T ? ` · Total ${inr(T.total)} · Paid ${inr(T.paid)} · <b class="${T.bal > 0.5 ? 'danger' : 'okc'}">Balance ${inr(Math.max(0, T.bal))}</b>` : ''}</span></div>
    ${o.instructions ? `<div class="flag" style="margin:8px 0 0"><b>Special instructions:</b> ${h(o.instructions)}</div>` : ''}
    <table class="trarts"><thead><tr><th></th><th>Article</th><th>For</th><th class="n">Qty</th><th>Job description</th><th>Now at</th><th>Due</th><th>Status</th></tr></thead><tbody>${x.gs.map(trArticle).join('')}</tbody></table></div>`;
}
function trArticle(g){
  const D = g.design || {}, V = (D.versions || []).find(z => z.v === D.approvedV) || (D.versions || []).slice(-1)[0], img = V?.files?.find(f => f.kind === 'sketch') || V?.files?.[0], jd = workDetail(g);
  return `<tr class="click" onclick="go('garment-${g.id}')"><td>${img ? `<div class="trimg" data-media="${h(img.id)}"></div>` : '<div class="trimg none">—</div>'}</td>
    <td><b>${h(g.no)}</b><div>${h(g.title)}</div></td><td>${h(memLabel(g.customerId, g.memberId, true) || '—')}</td><td class="n"><b>${gq(g)}</b></td>
    <td class="trjd">${h(jd.length > 140 ? jd.slice(0, 140) + '…' : jd || '—')}${g.instructions ? `<div class="danger" style="font-weight:600">${h(g.instructions)}</div>` : ''}</td>
    <td>${h(gStageLabel(g))}</td><td>${dateChip(g.deliveryDate, !gLive(g))}</td><td>${gChip(g)}</td></tr>`;
}
function trackerRows(){ return trackList().L.map(x => { const c = cust(x.o.customerId) || {}; return [x.commit, x.o.no, c.name, c.phone, x.job, x.units, TR_ST[x.stage][0], x.gs.map(g => `${g.no} ${g.title} x${gq(g)} [${TR_ST[gStatus(g) === 'ready' ? 'ready' : gStatus(g) === 'delivered' ? 'delivered' : 'production'][0]}]`).join('; ')]; }); }
function trackerCSV(){ saveCSV(`delivery-tracker-${todayISO()}.csv`, [['Committed delivery', 'Order', 'Customer', 'Mobile', 'Job', 'Units', 'Status', 'Articles'], ...trackerRows()]); }
async function trackerPDF(){
  const doc = new PDFDoc({landscape: true}), R = trackerRows(), f = UI.trf || 'open';
  await pdfHeader(doc, 'DELIVERY TRACKER', [{open: 'To deliver', ready: 'Ready to deliver', wip: 'In progress', overdue: 'Overdue', delivered: 'Delivered', all: 'All orders'}[f], `Printed ${fmtDT(nowISO())}`, `${R.length} orders`]);
  const rows = []; let last = null;
  R.forEach(r => { if(r[0] !== last){ last = r[0]; rows.push({_section: r[0] ? `${fmtD(r[0])} - ${new Date(r[0]).toLocaleDateString('en-IN', {weekday: 'long'})} (${relDay(r[0])})` : 'No date'}); } const ready = r[6] === 'Ready to deliver'; rows.push(Object.assign([r[1], r[2] || '', r[3] || '', r[4], String(r[5]), r[6], ready ? '' : '[  ]'], ready ? {_bold: true, _color: '#2e7d4f'} : {})); });
  doc.table([{t: 'Order', w: 0.9}, {t: 'Customer', w: 1.6}, {t: 'Mobile', w: 1.2}, {t: 'Articles / job', w: 2.6}, {t: 'Units', w: 0.5, align: 'right'}, {t: 'Status', w: 1.2}, {t: 'Done', w: 0.5}], rows, {size: 9});
  doc.para('Green bold rows are ready to deliver.', 8, '#666666');
  await openPDF(doc, `delivery-tracker-${todayISO()}.pdf`);
}
