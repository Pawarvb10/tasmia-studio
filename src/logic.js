/* =====================================================================
   logic.js : calendar, scheduler, target dates, progress, costing,
              billing, inventory, ledgers, alerts, finance
   ===================================================================== */

/* ---------------- calendar ----------------
   Day index 0 = today. Worker capacity per day = hours/day × efficiency %
   unless it is a shop holiday, the worker's weekly off, or the worker
   is on leave.                                                          */
const T0 = () => sod(new Date());
const dayDate = d => addDays(T0(), Math.floor(d));
const dayISO = d => iso(dayDate(d));
const dayIdx = s => s ? Math.round((sod(parseD(s)) - T0()) / 864e5) : 0;
function holidays(){ return HOL || (HOL = new Set(String(ST().holidays || '').split(',').map(x => x.trim()).filter(Boolean))); }
function shopOff(date){ const d = new Date(date); return (ST().weeklyOff || []).includes(d.getDay()) || holidays().has(iso(d)); }
function onLeave(w, isoDay){ return (w.leaves || []).find(l => l.from <= isoDay && isoDay <= (l.to || l.from)); }
function workerOffReason(w, d){
  const date = dayDate(d), s = iso(date);
  if(holidays().has(s)) return 'Shop holiday';
  const wo = Array.isArray(w.weeklyOff) ? w.weeklyOff : (ST().weeklyOff || []);
  if(wo.includes(date.getDay())) return 'Weekly off';
  const l = onLeave(w, s); if(l) return 'Leave' + (l.reason ? ': ' + l.reason : '');
  return '';
}
function workerCap(w, d){ if(!w || w.active === false) return 0; if(workerOffReason(w, d)) return 0; return num(w.hoursPerDay || 8) * (num(w.efficiency || 100) / 100); }
function addShopWorkdays(t, n){ let d = Math.floor(t), k = Math.ceil(num(n)), g = 0; while(k > 0 && g++ < 400){ d++; if(!shopOff(dayDate(d))) k--; } return d; }

/* ---------------- quantities ---------------- */
const gq = g => num(g.qty) || 1;
const stg = s => stage(s.stageId);
const isOut = s => !!s.out || stg(s).kind === 'external';
const kindOf = s => isOut(s) ? 'external' : stg(s).kind;
function taskHours(s, g){ const k = kindOf(s); if(k === 'external') return 0; if(k === 'trial') return num(s.hours) || 0.5; if(k === 'qc') return num(s.hours) || 0.5; return num(s.hours) * gq(g); }
function stepAmount(s, g){
  if(s.status === 'skipped') return 0;
  if(isOut(s)) return num(s.charge);
  if(s.pricing === 'hour') return num(s.hours) * num(s.rate) * (CPLX[s.cplx] || 1) * gq(g);
  if(s.pricing === 'fixed') return num(s.rate) * gq(g);
  return num(s.units) * num(s.rate) * gq(g);
}
function compUsed(c, g){ return Math.max(num(c.qty) * gq(g), num(c.issued)) + num(c.extra); }
function compAmount(c, g){ return c.source === 'customer' ? 0 : compUsed(c, g) * num(c.rate); }
const catHead = cat => ((ST().categories || []).find(c => c.id === cat) || {head: 'other'}).head;
function stepHead(s){ if(s.head) return s.head; if(s.stageId === 'alter') return 'alterations'; return stg(s).head || 'other'; }

/* ---------------- costing & billing ---------------- */
function garmentCost(g){
  const heads = {}; let mat = 0, lab = 0, ext = 0;
  g.components.forEach(c => { const a = compAmount(c, g); mat += a; const hd = catHead(c.category); heads[hd] = (heads[hd] || 0) + a; });
  g.steps.forEach(s => { const a = stepAmount(s, g); if(isOut(s)) ext += a; else lab += a; const hd = stepHead(s); heads[hd] = (heads[hd] || 0) + a; });
  return {heads, mat: r2(mat), lab: r2(lab), ext: r2(ext), total: r2(mat + lab + ext)};
}
function garmentBill(g, o){
  o = o || ord(g.orderId) || {markup: ST().markupPct};
  const c = garmentCost(g), mk = 1 + num(o.markup ?? ST().markupPct) / 100, lines = [];
  const hp = g.headPrice || {};
  ST().heads.forEach(hd => {
    const cost = c.heads[hd.id] || 0, ov = hp[hd.id];
    const price = ov !== undefined && ov !== '' && ov !== null ? num(ov) : Math.round(cost * mk);
    if(price > 0 || cost > 0 || (ov !== undefined && ov !== '')) lines.push({head: hd.id, name: hd.name, cost: r2(cost), price: r2(price), override: ov !== undefined && ov !== '' && ov !== null});
  });
  (g.extras || []).forEach(x => lines.push({head: x.head || 'other', name: headName(x.head) + ' – ' + x.desc, cost: 0, price: r2(x.amount), extra: x.id}));
  const total = r2(sum(lines, l => l.price));
  return {lines, total, cost: c.total, costParts: c};
}
const activeG = o => garmentsOf(o.id).filter(g => g.status !== 'cancelled');
function orderTotals(o){
  const gs = activeG(o); let sub = 0, cost = 0;
  gs.forEach(g => { const b = garmentBill(g, o); sub += b.total; cost += b.cost; });
  const disc1 = r2(o.discount), ref = r2(o.referral), disc = r2(disc1 + ref), taxable = Math.max(0, r2(sub - disc)), gst = r2(taxable * num(o.gstPct) / 100), total = r2(taxable + gst), paid = r2(sum(o.payments || [], p => p.amount));
  return {sub: r2(sub), disc, disc1, ref, taxable, gst, total, paid, bal: r2(total - paid), cost: r2(cost), margin: r2(taxable - cost)};
}
// work detail printed under each article on the invoice (editable per garment as g.invDetail)
function autoWorkDetail(g){
  const t = tpl(g.tplId) || {}, av = (g.design?.versions || []).find(x => x.v === g.design.approvedV) || (g.design?.versions || []).slice(-1)[0], dz = design(g.design?.catalogId);
  const specs = (t.specs || []).map(sp => g.specs?.[sp.k] ? `${sp.label}: ${g.specs[sp.k]}` : '').filter(Boolean).slice(0, 5);
  const work = liveSteps(g).filter(s => ['emb', 'hand', 'dye', 'hem'].includes(s.stageId) || s.stageId === 'press' || s.stageId === 'drywash').map(s => s.label);
  return [dz ? 'Design: ' + dz.name : '', av?.fields?.pattern ? av.fields.pattern + (av.fields.placement ? ' (' + av.fields.placement + ')' : '') : '', work.length ? 'Work: ' + work.join(', ') : '', specs.join(' · '), g.fabricSource === 'customer' ? 'Customer fabric' : ''].filter(Boolean).join('. ');
}
const workDetail = g => (g.invDetail ?? '') !== '' ? g.invDetail : autoWorkDetail(g);
function makeInvoice(o, gids, date, no, existing){
  const all = activeG(o), gs = all.filter(g => gids.includes(g.id)), T = orderTotals(o);
  const blocks = gs.map(g => { const b = garmentBill(g, o), q = gq(g); return {gid: g.id, no: g.no, title: g.title, qty: q, member: memLabel(g.customerId, g.memberId, true), detail: workDetail(g), type: tpl(g.tplId)?.name || '', design: design(g.design?.catalogId)?.name || '', fabric: g.fabricSource, lines: b.lines.filter(l => l.price).map(l => ({head: l.head, name: l.name, amount: l.price, unit: r2(l.price / q)})), unit: r2(b.total / q), total: b.total}; });
  const sub = r2(sum(blocks, b => b.total)), share = T.sub ? sub / T.sub : 1, d1 = r2(T.disc1 * share), ref = r2(T.ref * share), disc = r2(d1 + ref), taxable = Math.max(0, r2(sub - disc)), tax = r2(taxable * num(o.gstPct) / 100), cg = r2(tax / 2);
  const x = {id: existing?.id || uid('i'), no: existing?.no || no, orderId: o.id, customerId: o.customerId, date: date || todayISO(), garmentIds: gids.slice(), blocks, sub, discount: disc, disc1: d1, referral: ref, referredBy: o.referredBy || '', taxable, gstPct: num(o.gstPct), tax, cgst: cg, sgst: r2(tax - cg), total: r2(taxable + tax), taxMode: ST().taxMode, by: meName(), history: existing?.history || []};
  if(existing){ logChange(existing, 'Invoice regenerated', clone(existing), x); Object.assign(existing, x); return existing; }
  coll('invoices').push(x); gs.forEach(g => g.invoiceId = x.id);
  (o.history = o.history || []).push({at: nowISO(), by: meName(), action: `Invoice ${x.no} generated for ${gs.map(g => g.no).join(', ')}`, changes: []});
  return x;
}
// columns of the invoice matrix: the studio's charge heads that carry an amount on this invoice (in Setup order)
function invHeads(i){ const used = new Set(i.blocks.flatMap(b => b.lines.map(l => l.head))); return ST().heads.filter(hd => used.has(hd.id)).concat([...used].filter(id => !ST().heads.some(hd => hd.id === id)).map(id => ({id, name: headName(id)}))); }
const invCell = (b, hd) => r2(sum(b.lines.filter(l => l.head === hd.id), l => l.unit ?? l.amount / (b.qty || 1)));
function invNotes(i){
  const o = ord(i.orderId), gs = i.garmentIds.map(gar).filter(Boolean);
  const dd = [...new Set(gs.map(g => g.deliveryDate).filter(Boolean))].sort(), tr = gs.flatMap(g => (g.trials || []).map(t => t.date)).filter(Boolean).sort();
  const nextTrial = tr.length ? tr[tr.length - 1] : gs.map(g => liveSteps(g).some(s => kindOf(s) === 'trial') ? groupTarget(g, 'trial') : '').filter(Boolean).sort()[0];
  const instr = [o.instructions, ...gs.map(g => g.instructions ? `${g.no}: ${g.instructions}` : '')].filter(Boolean);
  return [['Delivery date', dd.map(fmtD).join(', ')], ['Trial date', nextTrial ? fmtD(nextTrial) : ''], ['Special instructions', instr.join(' · ')], ['Note', ST().invoiceNote || '']].filter(x => x[1]);
}
const payLabel = p => p.type === 'advance' ? 'Advance paid' : p.type === 'final' ? 'Final payment' : 'Part payment';

/* ---------------- production status & progress ---------------- */
const liveSteps = g => g.steps.filter(s => s.status !== 'skipped');
function stepGroups(g){
  const m = new Map(); liveSteps(g).slice().sort((a, b) => num(a.seq) - num(b.seq)).forEach(s => { const k = num(s.seq); if(!m.has(k)) m.set(k, []); m.get(k).push(s); });
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(x => x[1]);
}
const orderedSteps = g => g.steps.map((s, j) => ({s, j})).sort((a, b) => num(a.s.seq) - num(b.s.seq) || a.j - b.j).map(x => x.s);
function currentSteps(g){ const gr = stepGroups(g).find(x => x.some(s => s.status !== 'done')); return gr ? gr.filter(s => s.status !== 'done') : []; }
function lastQC(g){ return (g.qc || []).slice().sort(by(x => x.at)).pop(); }
function gStatus(g){
  if(g.status === 'cancelled') return 'cancelled';
  if(g.status === 'hold') return 'hold';
  if(g.delivery?.delivered) return 'delivered';
  const L = liveSteps(g);
  if(L.length && L.every(s => s.status === 'done')){ const q = lastQC(g); return !L.some(s => kindOf(s) === 'qc') || (q && q.result === 'pass') ? 'ready' : 'qc'; }
  if(L.some(s => s.status !== 'pending')) return 'production';
  return 'planned';
}
const G_STATUS = {planned: ['Planned', 'c-mut'], production: ['In production', 'c-acc'], qc: ['Awaiting QC', 'c-warn'], ready: ['Ready', 'c-ok'], delivered: ['Delivered', 'c-mut'], cancelled: ['Cancelled', 'c-bad'], hold: ['On hold', 'c-warn']};
const gChip = g => { const [l, c] = G_STATUS[gStatus(g)]; return `<span class="chip ${c}">${l}</span>`; };
const gLive = g => !['delivered', 'cancelled'].includes(gStatus(g));
function gStageLabel(g){
  const st = gStatus(g);
  if(st === 'ready'){ const d = g.delivery || {}; return d.packed ? 'Packed – awaiting pickup' : d.pressed ? 'Pressed – to pack' : 'Ready – press & pack'; }
  if(st !== 'production' && st !== 'planned') return G_STATUS[st][0];
  const cs = currentSteps(g); return cs.length ? [...new Set(cs.map(s => stg(s).name))].join(' + ') : 'QC';
}
function elapsedWorkHours(s, w){
  if(!s.startedAt) return 0;
  const start = new Date(s.startedAt), now = new Date();
  if(sod(start).getTime() === sod(now).getTime()) return Math.max(0, Math.min((now - start) / 36e5, workerCap(w, 0) || 8));
  let hrs = 0; const d0 = dayIdx(iso(start));
  for(let d = d0 + 1; d <= 0; d++) hrs += w ? workerCap(w, d) : 8;
  return hrs;
}
function stepWeight(s, g){ const k = kindOf(s); return k === 'external' ? Math.max(1, num(s.tat)) * 4 : k === 'trial' ? 1 : k === 'qc' ? 0.5 : Math.max(0.25, taskHours(s, g)); }
function stepFraction(s, g){
  if(s.status === 'done') return 1; if(s.status !== 'in_progress') return 0;
  const k = kindOf(s);
  if(k === 'external'){ const el = Math.max(0, -dayIdx(iso(new Date(s.startedAt)))); return Math.min(0.9, el / Math.max(1, num(s.tat))); }
  if(k !== 'work') return 0.5;
  return Math.min(0.9, elapsedWorkHours(s, worker(s.workerId)) / Math.max(0.25, taskHours(s, g)));
}
function progress(g){
  const st = gStatus(g); if(st === 'delivered' || st === 'ready') return {pct: 100, rows: [], tot: 0};
  const rows = liveSteps(g).map(s => ({s, w: stepWeight(s, g), f: stepFraction(s, g)}));
  const tot = sum(rows, r => r.w), got = sum(rows, r => r.w * r.f);
  return {pct: tot ? Math.round(got / tot * 100) : 0, rows, tot, got};
}

/* ---------------- target dates ---------------- */
const GROUPS = [['prep', 'Dyeing & cutting'], ['embroidery', 'Embroidery'], ['stitching', 'Stitching'], ['finishing', 'Finishing / hemming'], ['trial', 'Trial'], ['alteration', 'Alterations'], ['qc', 'Quality check'], ['delivery', 'Customer collection']];
function groupTarget(g, grp){
  if(grp === 'delivery') return g.deliveryDate;
  if(g.targets && g.targets[grp]) return g.targets[grp];
  if(!g.deliveryDate) return '';
  const lead = num((ST().lead || {})[grp] ?? 0);
  let t = addDaysISO(g.deliveryDate, -lead);
  const floor = iso(parseD(g.created || todayISO()));
  if(t < floor) t = floor;
  return t;
}
function stepTarget(s, g){ return s.target || groupTarget(g, stg(s).group || 'delivery'); }

/* ---------------- scheduler ---------------- */
function liveGarments(){
  return coll('garments').filter(g => { const o = ord(g.orderId); return o && o.status !== 'cancelled' && gLive(g) && g.status !== 'hold'; });
}
function schedule(){
  const sch = {T: {}, G: {}, load: {}, end: {}, cursor: {}};
  const capCache = new Map(); const cap = (w, d) => { const k = w.id + ':' + d; if(!capCache.has(k)) capCache.set(k, workerCap(w, d)); return capCache.get(k); };
  const cursor = sch.cursor;
  const book = (wid, d, hrs) => { const L = sch.load[wid] || (sch.load[wid] = {}); L[d] = (L[d] || 0) + hrs; };
  function alloc(wid, earliest, hours, commit){
    const w = worker(wid); if(!w) return null;
    let t = Math.max(cursor[wid] || 0, earliest, 0), left = hours, start = null, g = 0; const bk = [];
    while(g++ < 730){
      const d = Math.floor(t + 1e-9), f = t - d, c = cap(w, d);
      if(c <= 0){ t = d + 1; continue; }
      if(start === null) start = t;
      const avail = c * (1 - f);
      if(left <= avail + 1e-9){ bk.push([d, left]); t = d + f + left / c; left = 0; break; }
      bk.push([d, avail]); left -= avail; t = d + 1;
    }
    if(left > 0) return null;
    if(commit){ cursor[wid] = t; bk.forEach(([d, x]) => book(wid, d, x)); }
    return {s: start ?? t, e: t};
  }
  function pick(stageId, earliest, hours){
    let best = null;
    coll('workers').filter(w => w.active !== false && (w.skills || []).includes(stageId)).forEach(w => { const r = alloc(w.id, earliest, hours, false); if(r && (!best || r.e < best.r.e)) best = {wid: w.id, r}; });
    return best ? best.wid : null;
  }
  const P = g => (g.urgent || ord(g.orderId)?.urgent) ? 0 : 1;
  const gs = liveGarments().sort((a, b) => P(a) - P(b) || String(a.deliveryDate || '9').localeCompare(String(b.deliveryDate || '9')) || String(a.created).localeCompare(String(b.created)));
  // pass 1 — work already on the bench keeps its worker
  gs.forEach(g => g.steps.forEach(s => {
    if(s.status !== 'in_progress' || kindOf(s) !== 'work' || !s.workerId) return;
    const w = worker(s.workerId); if(!w) return;
    const H = taskHours(s, g), rem = Math.max(H - elapsedWorkHours(s, w), H * 0.15, 0.25);
    const r = alloc(s.workerId, 0, rem, true);
    sch.T[s.id] = r ? {s: dayIdx(iso(new Date(s.startedAt))), segS: r.s, e: r.e, wid: s.workerId, rem} : {none: true, s: 0, e: 0};
  }));
  // pass 2 — everything else, in flow order
  gs.forEach(g => {
    let prev = 0, end = 0; const grpEnd = {};
    stepGroups(g).forEach(gr => {
      let gEnd = prev;
      gr.forEach(s => {
        const k = kindOf(s), grp = stg(s).group;
        let x;
        if(s.status === 'done'){ const e = s.doneAt ? dayIdx(iso(new Date(s.doneAt))) + 0.5 : prev; x = {s: s.startedAt ? dayIdx(iso(new Date(s.startedAt))) : e - 0.5, e, done: true}; }
        else if(k === 'external'){
          if(s.status === 'in_progress'){ const st = dayIdx(iso(new Date(s.startedAt))); let e = s.expectedReturn ? dayIdx(s.expectedReturn) + 0.5 : addShopWorkdays(st, s.tat || 1) + 0.5; const overdue = e < 0.5; if(overdue) e = 0.5; x = {s: st, e, ext: true, overdue, due: s.expectedReturn || dayISO(addShopWorkdays(st, s.tat || 1))}; }
          else { const e = addShopWorkdays(prev, s.tat || 1) + 0.5; x = {s: prev, e, ext: true, due: dayISO(e)}; }
        }
        else if(k === 'trial'){
          const tr = (g.trials || []).find(t => t.stepId === s.id && t.status === 'scheduled');
          const st = tr ? Math.max(prev, dayIdx(tr.date)) : prev; x = {s: st, e: st + 0.3, trial: tr ? tr.date : '', suggest: !tr};
        }
        else if(sch.T[s.id]) x = sch.T[s.id];
        else {
          const H = Math.max(0.1, taskHours(s, g));
          if(k === 'qc' && !s.workerId){ x = {s: prev, e: prev + 0.15, milestone: true}; }
          else {
            const wid = s.workerId || pick(s.stageId, prev, H);
            if(!wid) x = {s: prev, e: prev, none: true};
            else { const r = alloc(wid, prev, H, true); x = r ? {s: r.s, segS: r.s, e: r.e, wid, auto: !s.workerId, wait: r.s - prev} : {s: prev, e: prev, none: true, wid}; }
          }
        }
        sch.T[s.id] = Object.assign(sch.T[s.id] || {}, x);
        if(!x.done || x.e > prev) gEnd = Math.max(gEnd, x.e);
        if(grp) grpEnd[grp] = Math.max(grpEnd[grp] ?? -1e9, x.e);
      });
      prev = Math.max(prev, gEnd); end = Math.max(end, prev);
    });
    const ready = dayISO(Math.max(0, end - 1e-6));
    const exp = {}; Object.entries(grpEnd).forEach(([k, e]) => exp[k] = dayISO(Math.max(-3650, e - 1e-6)));
    sch.G[g.id] = {end, ready, exp, late: !!(g.deliveryDate && ready > g.deliveryDate)};
  });
  coll('workers').forEach(w => sch.end[w.id] = cursor[w.id] || 0);
  return sch;
}
const sched = () => SC || (SC = schedule());
const startISO = x => dayISO(Math.max(-3650, Math.floor(x)));
const endISO = x => dayISO(Math.max(-3650, x - 1e-6));
function stepPlanned(s){ const x = sched().T[s.id]; if(!x) return null; return {start: startISO(x.segS ?? x.s), end: endISO(x.e), x}; }

/* ---------------- workload ---------------- */
function workerStats(){
  const sc = sched(), out = {};
  coll('workers').forEach(w => out[w.id] = {hrs: 0, tasks: [], end: sc.end[w.id] || 0, load: sc.load[w.id] || {}});
  liveGarments().forEach(g => g.steps.forEach(s => {
    if(s.status === 'done' || s.status === 'skipped' || kindOf(s) === 'external' || kindOf(s) === 'trial') return;
    const x = sc.T[s.id]; const wid = s.workerId || x?.wid; if(!wid || !out[wid]) return;
    const rem = x?.rem ?? taskHours(s, g); out[wid].hrs += rem; out[wid].tasks.push({g, s, x, rem});
  }));
  Object.values(out).forEach(o => o.tasks.sort(by(t => t.x?.segS ?? t.x?.s ?? 0)));
  return out;
}
function capPerDay(w){ return num(w.hoursPerDay || 8) * num(w.efficiency || 100) / 100; }
// workload in working days = remaining booked hours ÷ that worker's daily capacity
function queueDays(wid, st){ const w = worker(wid); return Math.round(st.hrs / Math.max(0.1, capPerDay(w)) * 10) / 10; }
function groupBacklog(){
  const out = {}; GROUPS.forEach(([k]) => out[k] = {n: 0, garments: new Set(), hrs: 0, overdue: 0});
  const today = todayISO();
  liveGarments().forEach(g => currentSteps(g).forEach(s => { const k = stg(s).group || 'other'; if(!out[k]) out[k] = {n: 0, garments: new Set(), hrs: 0, overdue: 0}; out[k].n++; out[k].garments.add(g.id); out[k].hrs += taskHours(s, g); if(stepTarget(s, g) < today) out[k].overdue++; }));
  return out;
}

/* ---------------- inventory ---------------- */
function stockOf(itemId){ return r2(sum(coll('movements').filter(m => m.itemId === itemId), m => m.type === 'in' ? m.qty : m.type === 'out' ? -m.qty : m.qty)); }
function requiredOf(itemId){ let n = 0; liveGarments().forEach(g => g.components.forEach(c => { if(c.itemId === itemId && c.source !== 'customer') n += Math.max(0, num(c.qty) * gq(g) + num(c.extra) - num(c.issued)); })); return r2(n); }
function issueMaterial(g, c, qty, note){
  qty = num(qty); if(qty <= 0) return;
  c.issued = r2(num(c.issued) + qty);
  if(c.itemId) coll('movements').push({id: uid('mv'), itemId: c.itemId, date: todayISO(), type: 'out', qty, rate: num(c.rate) || item(c.itemId)?.rate || 0, garmentId: g.id, orderId: g.orderId, note: note || 'Issued to ' + g.no, by: meName()});
}

/* ---------------- ledgers ---------------- */
function workerAccount(wid, from, to){
  const inR = d => (!from || d >= from) && (!to || d <= to);
  const jobs = []; coll('garments').forEach(g => g.steps.forEach(s => { if(s.workerId === wid && s.status === 'done' && !isOut(s) && s.doneAt && inR(iso(new Date(s.doneAt)))) jobs.push({g, s, amt: r2(stepAmount(s, g))}); }));
  const L = coll('ledger').filter(l => l.party === 'worker' && l.partyId === wid && inR(l.date));
  const earned = r2(sum(jobs, j => j.amt)), adv = r2(sum(L.filter(l => l.type === 'advance'), l => l.amount)), paid = r2(sum(L.filter(l => l.type === 'payment'), l => l.amount)), adj = r2(sum(L.filter(l => l.type === 'adjustment'), l => l.amount));
  return {jobs, L, earned, adv, paid, adj, bal: r2(earned + adj - adv - paid)};
}
function vendorAccount(vid, from, to){
  const inR = d => (!from || d >= from) && (!to || d <= to);
  const jobs = []; coll('garments').forEach(g => g.steps.forEach(s => { if(s.vendorId === vid && isOut(s) && s.status !== 'pending' && s.status !== 'skipped' && s.startedAt && inR(iso(new Date(s.startedAt)))) jobs.push({g, s, amt: r2(num(s.charge))}); }));
  const L = coll('ledger').filter(l => l.party === 'vendor' && l.partyId === vid && inR(l.date));
  const charges = r2(sum(jobs, j => j.amt)), adv = r2(sum(L.filter(l => l.type === 'advance'), l => l.amount)), paid = r2(sum(L.filter(l => l.type === 'payment'), l => l.amount));
  return {jobs, L, charges, adv, paid, bal: r2(charges - adv - paid)};
}
function vendorJobs(){
  const out = []; coll('garments').forEach(g => { const o = ord(g.orderId); if(!o || o.status === 'cancelled') return; g.steps.forEach(s => { if(isOut(s) && s.status !== 'skipped') out.push({g, s, o, due: s.status === 'in_progress' ? (s.expectedReturn || dayISO(addShopWorkdays(dayIdx(iso(new Date(s.startedAt))), s.tat || 1))) : ''}); }); });
  return out;
}

/* ---------------- alerts ----------------
   Every alert names the garment, the pending task and who is responsible. */
function allAlerts(){
  const sc = sched(), S = ST(), A = [], today = todayISO(), warn = iso(addDays(new Date(), num(S.warnDays) || 2));
  const add = (key, sev, cat, title, detail, ref) => A.push(Object.assign({key, sev, cat, title, detail}, ref || {}));
  const who = s => isOut(s) ? (vendor(s.vendorId)?.name || 'vendor not set') : (worker(s.workerId || sc.T[s.id]?.wid)?.name || 'unassigned');
  coll('garments').forEach(g => {
    const o = ord(g.orderId); if(!o || o.status === 'cancelled') return;
    const st = gStatus(g), c = cust(g.customerId) || {}, tag = `${g.no} ${g.title} (${c.name || '—'})`, ref = {gid: g.id, oid: g.orderId};
    if(st === 'ready' && g.deliveryDate && g.deliveryDate < today && !g.delivery?.delivered) add('uncollected:' + g.id, 'medium', 'delivery', 'Ready but not collected', `${tag} has been ready since before ${fmtD(g.deliveryDate)}. Notify the customer.`, ref);
    if(!gLive(g) || g.status === 'hold' || st === 'ready') return;
    const x = sc.G[g.id];
    if(g.deliveryDate && g.deliveryDate < today) add('late:' + g.id, 'critical', 'delivery', 'Delivery date passed', `${tag} was due on ${fmtD(g.deliveryDate)}. Now at: ${gStageLabel(g)} (${currentSteps(g).map(who).join(', ') || '—'}).`, ref);
    else if(x && x.late){ const cs = currentSteps(g)[0]; add('risk:' + g.id, 'high', 'delivery', 'Delivery at risk', `${tag}: expected ready ${fmtD(x.ready)}, delivery ${fmtD(g.deliveryDate)}.${cs ? ` Pending: ${stg(cs).name} – ${cs.label} (${who(cs)}).` : ''}`, ref); }
    else if(g.deliveryDate && g.deliveryDate <= warn && st !== 'ready') add('soon:' + g.id, 'medium', 'delivery', 'Delivery approaching', `${tag} is due ${fmtD(g.deliveryDate)} and is at ${gStageLabel(g)}.`, ref);
    const stT = groupTarget(g, 'stitching'), stDone = liveSteps(g).filter(s => stg(s).group === 'stitching').every(s => s.status === 'done');
    if(!stDone && stT && stT < today && liveSteps(g).some(s => stg(s).group === 'stitching')){
      const pend = liveSteps(g).filter(s => stg(s).group === 'stitching' && s.status !== 'done');
      add('stitchlate:' + g.id, 'high', 'step', 'Stitching target missed', `${tag}: stitching was due by ${fmtD(stT)} (${num(S.lead?.stitching)} days before delivery). Pending: ${pend.map(s => s.label + ' – ' + who(s)).join('; ')}.`, ref);
    }
    if(!g.design?.approvedV && (g.design?.versions || []).length && liveSteps(g).some(s => ['cut', 'emb'].includes(s.stageId) && s.status !== 'pending')) add('noappr:' + g.id, 'high', 'design', 'Production started without approved design', `${tag}: cutting/embroidery has started but no design version is marked customer-approved.`, ref);
    if(g.design?.approvedV && g.design.versions.length > g.design.approvedV) add('designmod:' + g.id + ':' + g.design.versions.length, 'high', 'design', 'Design changed after approval', `${tag}: version ${g.design.versions.length} is newer than the approved version ${g.design.approvedV}. Get the change approved before production continues.`, ref);
    const q = lastQC(g); if(q && q.result === 'fail' && st !== 'ready') add('qcfail:' + g.id + q.id, 'high', 'qc', 'QC failed – rework pending', `${tag}: QC on ${fmtD(q.at)} failed. ${q.notes || ''}`, ref);
    liveSteps(g).forEach(s => {
      if(s.status === 'done') return;
      const lbl = `${stg(s).name} – ${s.label}`, sref = Object.assign({stepId: s.id, wid: s.workerId || sc.T[s.id]?.wid, vid: s.vendorId}, ref), tgt = stepTarget(s, g), X = sc.T[s.id] || {};
      if(kindOf(s) === 'external'){
        if(!s.vendorId) add('novendor:' + s.id, 'medium', 'vendor', 'Outside work has no vendor', `${tag}: ${lbl} needs a vendor.`, sref);
        if(s.status === 'in_progress'){
          const due = s.expectedReturn || dayISO(addShopWorkdays(dayIdx(iso(new Date(s.startedAt))), s.tat || 1));
          if(due < today) add('vend:' + s.id, 'high', 'vendor', 'Vendor return overdue', `${tag}: ${lbl} at ${vendor(s.vendorId)?.name || 'vendor'} was due back ${fmtD(due)} (handed over ${fmtD(s.startedAt)}).`, sref);
          else if(due <= warn) add('vendsoon:' + s.id, 'medium', 'vendor', 'Vendor return due', `${tag}: ${lbl} due back from ${vendor(s.vendorId)?.name || 'vendor'} on ${fmtD(due)}.`, sref);
        }
        return;
      }
      if(kindOf(s) === 'trial'){
        const tr = (g.trials || []).find(t => t.stepId === s.id && t.status === 'scheduled');
        if(tr && tr.date < today) add('trialmiss:' + tr.id, 'high', 'trial', 'Trial missed / not recorded', `${tag}: trial was booked for ${fmtD(tr.date)} — record the outcome or reschedule.`, sref);
        else if(tr && tr.date === today) add('trialtoday:' + tr.id, 'medium', 'trial', 'Trial today', `${tag}: trial at ${tr.time || '—'} today.`, sref);
        else if(!tr && currentSteps(g).includes(s)) add('trialbook:' + s.id, 'medium', 'trial', 'Trial to be booked', `${tag}: ready for trial — book an appointment (target ${fmtD(tgt)}).`, sref);
        return;
      }
      if(X.none) add('noworker:' + s.id, 'critical', 'step', 'No worker can take this step', `${tag}: ${lbl} — no active worker has the "${stg(s).name}" skill (or all are on leave).`, sref);
      else if(!s.workerId && kindOf(s) === 'work') add('unassigned:' + s.id, 'low', 'step', 'Step not assigned', `${tag}: ${lbl} has no worker (planned on ${worker(X.wid)?.name || '—'}).`, sref);
      if(tgt && tgt < today) add('overdue:' + s.id, 'high', 'step', 'Step past target date', `${tag}: ${lbl} target was ${fmtD(tgt)} — ${who(s)}, status ${s.status === 'in_progress' ? 'in progress' : 'not started'}.`, sref);
      else if(tgt && tgt <= warn && currentSteps(g).includes(s)) add('due:' + s.id, 'low', 'step', 'Step due soon', `${tag}: ${lbl} due ${fmtD(tgt)} — ${who(s)}.`, sref);
      if(s.status === 'in_progress' && kindOf(s) === 'work'){
        const w = worker(s.workerId), el = elapsedWorkHours(s, w), H = taskHours(s, g);
        if(H && el > H * (1 + num(S.overrunPct) / 100)) add('overrun:' + s.id, 'medium', 'step', 'Step overrunning estimate', `${tag}: ${lbl} by ${w?.name || '—'} ~${el.toFixed(1)} h elapsed vs ${H} h estimated.`, sref);
      }
      if(s.status === 'pending' && s.workerId){ const w = worker(s.workerId); const d = dayIdx(stepPlanned(s)?.start || todayISO()); if(w && workerOffReason(w, Math.max(0, d)).startsWith('Leave')) add('leave:' + s.id, 'high', 'worker', 'Assigned worker on leave', `${tag}: ${lbl} is assigned to ${w.name}, who is on leave when it is planned. Reassign it.`, sref); }
    });
  });
  const ws = workerStats();
  coll('workers').filter(w => w.active !== false).forEach(w => { const qd = queueDays(w.id, ws[w.id]); if(qd > num(S.overloadDays)) add('overload:' + w.id, 'medium', 'worker', 'Worker overloaded', `${w.name} has ${ws[w.id].hrs.toFixed(1)} h of work queued = ${qd} working days at ${capPerDay(w).toFixed(1)} h/day (limit ${S.overloadDays} days).`, {wid: w.id}); });
  coll('inventory').filter(i => i.active !== false).forEach(i => { const s = stockOf(i.id), req = requiredOf(i.id); if(req > s) add('short:' + i.id, 'high', 'material', 'Material shortage', `${i.name}: ${req} ${i.unit} still to issue for open garments, only ${s} in stock.`); else if(s <= num(i.reorder)) add('low:' + i.id, 'low', 'material', 'Low stock', `${i.name}: ${s} ${i.unit} left (reorder level ${i.reorder}).`); });
  coll('orders').filter(o => o.status !== 'cancelled').forEach(o => { const gs = activeG(o); if(gs.length && gs.every(g => gStatus(g) === 'delivered')){ const t = orderTotals(o); if(t.bal > 1) add('due:' + o.id, 'medium', 'payment', 'Balance pending after delivery', `${o.no} (${cust(o.customerId)?.name}): ${inr(t.bal)} outstanding.`, {oid: o.id}); } });
  const rank = {critical: 0, high: 1, medium: 2, low: 3};
  return A.sort((a, b) => rank[a.sev] - rank[b.sev]);
}
const activeAlerts = () => allAlerts().filter(a => !(DB.state?.ack || {})[a.key]);

/* ---------------- finance ---------------- */
function finance(from, to){
  const inR = d => d && d >= from && d <= to;
  const invs = coll('invoices').filter(i => inR(i.date));
  const byHead = {}; invs.forEach(i => i.blocks.forEach(b => b.lines.forEach(l => byHead[l.head] = (byHead[l.head] || 0) + num(l.amount))));
  let labour = 0, vendorX = 0; const labourBy = {};
  coll('garments').forEach(g => g.steps.forEach(s => {
    if(s.status !== 'done' || !s.doneAt || !inR(iso(new Date(s.doneAt)))) return;
    const a = stepAmount(s, g); if(isOut(s)) vendorX += a; else { labour += a; labourBy[s.workerId] = (labourBy[s.workerId] || 0) + a; }
  }));
  const material = r2(sum(coll('movements').filter(m => m.type === 'out' && inR(m.date)), m => num(m.qty) * num(m.rate)));
  const collections = []; coll('orders').forEach(o => (o.payments || []).forEach(p => { if(inR(p.date)) collections.push({o, p}); }));
  const revenue = r2(sum(invs, i => i.taxable)), gst = r2(sum(invs, i => i.tax)), expenses = r2(labour + vendorX + material);
  // matched cost: what the invoiced garments actually cost (materials + labour + vendors)
  let cogs = 0; invs.forEach(i => i.garmentIds.forEach(id => { const g = gar(id); if(g) cogs += garmentCost(g).total; }));
  let receivable = 0; coll('orders').filter(o => o.status !== 'cancelled').forEach(o => { const t = orderTotals(o); if(t.bal > 0) receivable += t.bal; });
  let payW = 0, payV = 0; coll('workers').forEach(w => payW += Math.max(0, workerAccount(w.id).bal)); coll('vendors').forEach(v => payV += Math.max(0, vendorAccount(v.id).bal));
  const byOrder = coll('orders').filter(o => o.status !== 'cancelled').map(o => { const t = orderTotals(o); return {o, price: t.taxable, cost: t.cost, profit: r2(t.taxable - t.cost), pct: t.taxable ? Math.round((t.taxable - t.cost) / t.taxable * 100) : 0, bal: t.bal}; });
  const byType = {}; coll('garments').filter(g => g.status !== 'cancelled').forEach(g => { const b = garmentBill(g); const k = tpl(g.tplId)?.name || '—'; const x = byType[k] || (byType[k] = {n: 0, price: 0, cost: 0}); x.n++; x.price += b.total; x.cost += b.cost; });
  return {invs, byHead, revenue, gst, labour: r2(labour), labourBy, vendor: r2(vendorX), material, expenses, cogs: r2(cogs), profit: r2(revenue - cogs), collections, collected: r2(sum(collections, c => c.p.amount)), receivable: r2(receivable), payW: r2(payW), payV: r2(payV), byOrder, byType};
}
