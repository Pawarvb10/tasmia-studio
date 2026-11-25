/* =====================================================================
   pdfdocs.js : invoice, receipt, measurement sheet, job card,
                artisan sheet, owner report — all as downloadable PDFs
   ===================================================================== */
async function invoicePDF(iid){
  const i = inv(iid), o = ord(i.orderId), c = cust(o.customerId) || {}, s = ST(), T = orderTotals(o), H = invHeads(i), doc = new PDFDoc({landscape: true}), legacy = i.disc1 === undefined;
  const n2 = x => num(x).toLocaleString('en-IN', {maximumFractionDigits: 2});
  await pdfHeader(doc, s.gstin && i.gstPct ? 'TAX INVOICE' : 'INVOICE', [`Invoice No: ${i.no}`, `Date: ${fmtD(i.date)}`, `Order: ${o.no}`]);
  // bill to (from the CRM)
  const y0 = doc.y; doc.text(doc.M, doc.y + 9, 'BILL TO', 7.5, true, '#7d7074'); doc.y += 12;
  doc.text(doc.M, doc.y + 11, c.name || '', 12, true); doc.y += 15;
  [`Phone: ${[c.phone, c.phone2].filter(Boolean).join(' / ')}`, c.email ? 'Email: ' + c.email : '', c.address ? 'Address: ' + c.address : ''].filter(Boolean).forEach(l => { doc.text(doc.M, doc.y + 9, l, 9, false, '#333333'); doc.y += 12; });
  doc.y += 6; doc.text(doc.M, doc.y + 10, 'Order Details', 11, true, '#7a2948'); doc.y += 16;
  // order details matrix: per-unit charge by category
  const cols = [{t: 'Sr', w: 0.45}, {t: 'Item description', w: H.length > 8 ? 3.2 : 4.2}, {t: 'Qty', w: 0.5, align: 'right'}, ...H.map(hd => ({t: hd.name, w: 1, align: 'right'})), {t: 'Unit price', w: 1.1, align: 'right'}, {t: 'Total', w: 1.2, align: 'right'}];
  const rows = i.blocks.map((b, k) => [`${k + 1}.`, [b.title, b.member ? 'For ' + b.member : '', b.detail || ''].filter(Boolean).join('\n'), String(b.qty || 1), ...H.map(hd => { const x = invCell(b, hd); return x ? n2(x) : '-'; }), n2(b.unit ?? b.total / (b.qty || 1)), n2(b.total)]);
  rows.push(Object.assign(['', 'Subtotal', String(sum(i.blocks, b => b.qty || 1)), ...H.map(() => ''), '', n2(i.sub)], {_bold: true}));
  doc.table(cols, rows, {size: 8.6});
  doc.para('Category columns show the charge for one unit; Total = unit price x quantity. Amounts in Rs.', 7.5, '#7d7074');
  // summary + payment details side by side
  doc.need(150); const top = doc.y + 6, xL = doc.M, wL = 300, xR = doc.M + 340, wR = doc.W - doc.M - xR;
  const box = (x, y, w, title, rows2, widths) => { doc.text(x, y + 10, title, 10.5, true, '#7a2948'); y += 16; const tot = sum(widths, z => z); rows2.forEach((r, k) => { const head = r._h, bold = r._b; if(head) doc.rect(x, y, w, 15, '#f4e6ec'); else if(bold) doc.rect(x, y, w, 15, '#faf6f1'); let xx = x; r.forEach((cell, j) => { const cw = widths[j] / tot * w, right = j === 1; doc.text(right ? xx + cw - 5 : xx + 5, y + 10.5, cell, 8.8, head || bold, r._c || (head ? '#5b1d36' : '#222222'), right ? 'right' : ''); xx += cw; }); doc.line(x, y + 15, x + w, y + 15, '#e7ded6', 0.5); y += 15; }); return y; };
  const S = [Object.assign(['Particulars', 'Amount (Rs.)'], {_h: true}), ['Subtotal', n2(i.sub)]];
  if(legacy){ if(i.discount) S.push(['Discount', '- ' + n2(i.discount)]); } else { if(i.disc1) S.push(['Discount', '- ' + n2(i.disc1)]); if(i.referral) S.push([`Referral discount${i.referredBy ? ' (ref. ' + i.referredBy + ')' : ''}`, '- ' + n2(i.referral)]); }
  if(i.tax){ if(i.taxMode === 'inter') S.push([`IGST @ ${i.gstPct}%`, n2(i.tax)]); else S.push([`CGST @ ${i.gstPct / 2}%`, n2(i.cgst)], [`SGST @ ${i.gstPct / 2}%`, n2(i.sgst)]); }
  S.push(Object.assign(['Total amount payable', n2(i.total)], {_b: true, _c: '#7a2948'}));
  let yA = box(xL, top, wL, 'Summary', S, [2.2, 1]);
  const wl = wrapText(amountWords(i.total), 8.5, wL, true); wl.forEach(l => { doc.text(xL, yA + 11, l, 8.5, true, '#444444'); yA += 11; });
  const pays = (o.payments || []).slice().sort(by(p => p.date));
  const P2 = [Object.assign(['Particulars', 'Amount (Rs.)', 'Mode of payment', 'Date'], {_h: true}), ...pays.map(p => [payLabel(p), n2(p.amount), p.mode || '', fmtD(p.date)]), Object.assign(['Total paid', n2(T.paid), '', ''], {_b: true}), Object.assign(['Balance due', n2(Math.max(0, T.bal)), '', ''], {_b: true, _c: T.bal > 0.5 ? '#b3261e' : '#2e7d4f'})];
  const yB = box(xR, top, wR, 'Payment Details' + (T.total - i.total > 1 ? ` (order ${o.no}, total Rs. ${n2(T.total)})` : ''), P2, [1.5, 1.1, 1.2, 1]);
  doc.y = Math.max(yA, yB) + 12;
  // notes + footer
  const N = invNotes(i); if(N.length){ doc.need(20 + N.length * 13); doc.text(doc.M, doc.y + 10, 'Notes', 10.5, true, '#7a2948'); doc.y += 16; N.forEach(([k, x]) => { const L = wrapText(`-  ${k}: ${x}`, 9, doc.W - 2 * doc.M); L.forEach(l => { doc.text(doc.M, doc.y + 9, l, 9, false, '#222222'); doc.y += 12; }); }); }
  if(s.upiId || s.bank) doc.para(`Payment: ${s.upiId ? 'UPI ' + s.upiId + '   ' : ''}${s.bank || ''}`, 8.5, '#444444');
  doc.need(60); doc.y += 6; doc.line(doc.M, doc.y, doc.W - doc.M, doc.y, '#bbbbbb', 1); doc.y += 6;
  doc.text(doc.M, doc.y + 12, s.invoiceFooter || ('Thank you for choosing ' + s.shop + '!'), 12, true, '#7a2948'); doc.text(doc.W - doc.M, doc.y + 12, 'For ' + s.shop, 9.5, true, '#222222', 'right'); doc.y += 20;
  if(s.terms) doc.para(s.terms, 7.5, '#666666');
  await openPDF(doc, `${i.no}-${slug(c.name || '')}.pdf`);
}
async function receiptPDF(oid, pid){
  const o = ord(oid), p = o.payments.find(x => x.id === pid), c = cust(o.customerId) || {}, T = orderTotals(o), doc = new PDFDoc();
  await pdfHeader(doc, 'PAYMENT RECEIPT', [`No. ${p.receiptNo || '-'}`, `Date ${fmtD(p.date)}`]);
  doc.kv([['Received from', `${c.name}\n${c.phone || ''}`], ['Order', `${o.no}\n${activeG(o).map(g => g.title).join(', ')}`], ['Payment', `${(p.type || 'payment').toUpperCase()} by ${p.mode}`]], 3);
  doc.need(60); doc.rect(doc.M, doc.y, doc.W - 2 * doc.M, 46, '#f4e6ec'); doc.text(doc.M + 14, doc.y + 20, 'Amount received', 9, false, '#7d7074'); doc.text(doc.M + 14, doc.y + 38, rs(p.amount), 18, true, '#7a2948'); doc.text(doc.W - doc.M - 14, doc.y + 30, amountWords(p.amount), 9, true, '#333333', 'right'); doc.y += 58;
  doc.table([{t: 'Order account', w: 4}, {t: 'Amount', w: 1.4, align: 'right'}], [['Order total (incl. GST)', rs(T.total)], ['Total received to date', rs(T.paid)], Object.assign(['Balance due', rs(Math.max(0, T.bal))], {_bold: true})]);
  if(p.note) doc.para('Note: ' + p.note, 9);
  doc.y += 30; doc.text(doc.W - doc.M, doc.y, 'For ' + ST().shop, 9.5, true, '#222222', 'right'); doc.y += 26; doc.text(doc.W - doc.M, doc.y, 'Received by ' + (p.by || ''), 8.5, false, '#555555', 'right');
  await openPDF(doc, `${p.receiptNo || 'receipt'}-${slug(c.name || '')}.pdf`);
}
function measTables(doc, t, meas, specs, unit){
  if((t.charts || []).length){
    const R = measRows(t, meas || {}), u = UNITS[unit || 'in'];
    let cur = null; const flush = () => { if(!cur) return; const L = cur.rows, half = Math.ceil(L.length / 2), rows = []; for(let i = 0; i < half; i++) rows.push([...L[i], ...(L[i + half] || ['', '', ''])]); doc.table([{t: 'No', w: 0.4}, {t: cur.sec + ' measurement', w: 2.4}, {t: u, w: 1.2}, {t: 'No', w: 0.4}, {t: 'Measurement', w: 2.4}, {t: u, w: 1.2}], rows, {size: 9.5}); };
    R.forEach(r => { if(r.sec){ flush(); cur = {sec: r.sec, rows: []}; } else cur.rows.push([r[0], r[1], r[2] || '____']); }); flush();
    if((t.specs || []).length) doc.kv(t.specs.map(sp => [sp.label, specs?.[sp.k] || '-']), 3);
    return;
  }
  const secs = [...new Set(t.fields.map(f => f.sec))];
  secs.forEach(sec => { const F2 = t.fields.filter(f => f.sec === sec), rows = []; for(let i = 0; i < F2.length; i += 3) rows.push(F2.slice(i, i + 3).flatMap(f => [f.label, String(meas[f.k] ?? '') || '____'])); while(rows.length && rows[rows.length - 1].length < 6) rows[rows.length - 1].push(''); doc.table([{t: sec, w: 2}, {t: ST().unit, w: 1}, {t: '', w: 2}, {t: '', w: 1}, {t: '', w: 2}, {t: '', w: 1}], rows, {size: 10}); });
  if((t.specs || []).length) doc.kv(t.specs.map(sp => [sp.label, specs?.[sp.k] || '-']), 3);
}
async function measSheetPDF(gid){
  const g = gar(gid), o = ord(g.orderId), c = cust(g.customerId) || {}, t = tpl(g.tplId), P = prof(g.profileId), doc = new PDFDoc();
  await pdfHeader(doc, 'MEASUREMENT SHEET', [`${g.no}`, `${t.name}`, `Delivery ${fmtD(g.deliveryDate)}`, `Stitching by ${fmtD(groupTarget(g, 'stitching'))}`]);
  doc.kv([['Customer', c.name], ['For', memLabel(g.customerId, g.memberId) || '-'], ['Garment', `${g.title}  x${g.qty}`], ['Measurement set', P ? `${P.label} (v${P.versions.length})` : '-'], ['Unit', UNITS[g.unit || 'in']], ['Fabric', g.fabricSource === 'customer' ? 'CUSTOMER SUPPLIED' : g.fabricSource === 'mixed' ? 'Mixed' : 'Studio'], ['Urgent', (g.urgent || o.urgent) ? 'YES - URGENT' : 'No'], ['Printed', fmtDT(nowISO())]], 3);
  if(o.instructions || g.instructions){ doc.need(30); doc.rect(doc.M, doc.y, doc.W - 2 * doc.M, 4, '#b3261e'); doc.y += 6; doc.para('SPECIAL INSTRUCTIONS: ' + [o.instructions, g.instructions].filter(Boolean).join(' | '), 10, '#b3261e', true); }
  doc.h2('Measurements');
  measTables(doc, t, g.meas, g.specs, g.unit);
  doc.h2('Style & fit'); doc.para('Customer liking: ' + (g.style || '-'), 10); if(g.fit) doc.para('Fit: ' + g.fit, 10); if(c.fitPrefs) doc.para('Customer preference: ' + c.fitPrefs, 9, '#555555');
  const alts = (g.trials || []).flatMap(tr => (tr.alterations || []).map(a => `Trial ${tr.round}: ${a.area} - ${a.instruction}`)); if(alts.length){ doc.h2('Alterations recorded'); alts.forEach(a => doc.para(a, 9.5)); }
  const av = g.design?.versions?.find(x => x.v === g.design.approvedV);
  if(av){ doc.h2(`Approved design (v${av.v})`); doc.kv([['Pattern', av.fields.pattern], ['Placement', av.fields.placement], ['Lining', av.fields.lining], ['Trims', av.fields.trims]], 2); const imgs = av.files.filter(f => ['sketch', 'fabric'].includes(f.kind)).slice(0, 3); if(imgs.length) await doc.images(imgs.map(f => f.id), 130, imgs.map(f => kindName(f.kind))); }
  doc.h2('Sign-off'); doc.table([{t: 'Cutting master', w: 1}, {t: 'Stitching master', w: 1}, {t: 'Checked by', w: 1}], [['\n\n', '\n\n', '\n\n']]);
  await openPDF(doc, `measurements-${g.no.replace(/\//g, '-')}.pdf`);
}
async function profilePDF(pid){
  const P = prof(pid), c = cust(P.customerId), t = tpl(P.tplId), doc = new PDFDoc();
  await pdfHeader(doc, 'MEASUREMENT SHEET', [t.name, P.label, `Updated ${fmtD(P.updated)}`]);
  doc.kv([['Customer', c?.name], ['For', memLabel(P.customerId, P.memberId) || P.person], ['Article', t.name], ['Unit', UNITS[P.unit || 'in']], ['Version', String(P.versions.length)], ['Printed', fmtDT(nowISO())]], 3);
  measTables(doc, t, P.values, P.specs, P.unit); if(P.fitNotes){ doc.h2('Fit notes'); doc.para(P.fitNotes, 9.5); }
  await openPDF(doc, `measurements-${slug(memName(member(P.customerId, P.memberId), c) || P.person)}-${slug(t.name.split(' (')[0])}.pdf`);
}
async function jobCardPDF(gid){
  const g = gar(gid), o = ord(g.orderId), c = cust(g.customerId) || {}, t = tpl(g.tplId), doc = new PDFDoc(), sc = sched();
  await pdfHeader(doc, 'JOB CARD', [g.no, t.name, `Delivery ${fmtD(g.deliveryDate)}`]);
  doc.kv([['Customer', c.name], ['For', memLabel(g.customerId, g.memberId) || '-'], ['Garment', `${g.title}  x${g.qty}`], ['Urgent', (g.urgent || o.urgent) ? 'YES - URGENT' : 'No'], ['Fabric', g.fabricSource === 'customer' ? 'CUSTOMER SUPPLIED' : 'Studio'], ['Stitching target', fmtD(groupTarget(g, 'stitching'))], ['Expected ready', fmtD(sc.G[g.id]?.ready)]], 3);
  if(o.instructions || g.instructions) doc.para('SPECIAL INSTRUCTIONS: ' + [o.instructions, g.instructions].filter(Boolean).join(' | '), 10, '#b3261e', true);
  doc.para('Customer liking: ' + (g.style || '-'), 10);
  doc.h2('Production stages');
  doc.table([{t: '#', w: 0.5}, {t: 'Stage', w: 1.6}, {t: 'Piece / section', w: 2.4}, {t: 'Worker / vendor', w: 1.7}, {t: 'Hrs / TAT', w: 0.9}, {t: 'Target', w: 1.1}, {t: 'Status', w: 1}, {t: 'Sign', w: 1.1}],
    orderedSteps(g).filter(s => s.status !== 'skipped').map(s => [String(s.seq), stg(s).name + (s.round > 1 ? ` (round ${s.round})` : ''), s.label + (s.rework ? ' - ' + s.rework : ''), isOut(s) ? (vendor(s.vendorId)?.name || 'vendor') : (worker(s.workerId || sc.T[s.id]?.wid)?.name || ''), isOut(s) ? s.tat + ' d' : taskHours(s, g) + ' h', fmtDs(stepTarget(s, g)), s.status === 'done' ? 'Done' : s.status === 'in_progress' ? 'In progress' : '', '']));
  doc.h2('Materials');
  doc.table([{t: 'Material', w: 3}, {t: 'Supplied by', w: 1.2}, {t: 'Qty', w: 1, align: 'right'}, {t: 'Issued', w: 1, align: 'right'}], g.components.map(m => [m.name, m.source === 'customer' ? 'Customer' : 'Studio', `${r2(num(m.qty) * gq(g))} ${m.unit}`, `${num(m.issued)} ${m.unit}`]));
  doc.h2('Measurements'); measTables(doc, t, g.meas, g.specs, g.unit);
  await openPDF(doc, `jobcard-${g.no.replace(/\//g, '-')}.pdf`);
}
async function artisanPDF(gid){
  const g = gar(gid), o = ord(g.orderId), t = tpl(g.tplId), av = g.design?.versions?.find(x => x.v === g.design.approvedV), latest = g.design?.versions?.[g.design.versions.length - 1], V = av || latest, doc = new PDFDoc(), sc = sched();
  await pdfHeader(doc, 'ARTISAN SHEET', [g.no, t.name, av ? `Approved design v${av.v}` : 'NOT YET APPROVED']);
  if(!av) doc.para('WARNING: no customer-approved design version. Confirm with the owner before starting.', 11, '#b3261e', true);
  doc.kv([['Garment', g.title], ['Embroidery target', fmtD(groupTarget(g, 'embroidery'))], ['Delivery', fmtD(g.deliveryDate)], ['Pattern', V?.fields.pattern], ['Placement', V?.fields.placement], ['Colours', V?.fields.colours], ['Lining', V?.fields.lining], ['Trims', V?.fields.trims], ['Notes', V?.fields.notes]], 3);
  if(o.instructions || g.instructions) doc.para('SPECIAL INSTRUCTIONS: ' + [o.instructions, g.instructions].filter(Boolean).join(' | '), 10, '#b3261e', true);
  const secs = liveSteps(g).filter(s => ['emb', 'hand'].includes(s.stageId));
  if(secs.length){ doc.h2('Embroidery & handwork sections'); doc.table([{t: 'Section', w: 3}, {t: 'Artisan', w: 1.6}, {t: 'Hours', w: 0.8, align: 'right'}, {t: 'Target', w: 1.1}, {t: 'Status', w: 1}], secs.map(s => [s.label, isOut(s) ? vendor(s.vendorId)?.name || 'vendor' : worker(s.workerId || sc.T[s.id]?.wid)?.name || '', String(taskHours(s, g)), fmtDs(stepTarget(s, g)), s.status === 'done' ? 'Done' : s.status === 'in_progress' ? 'In progress' : 'Pending'])); }
  const mats = g.components.filter(c => ['emb_material', 'accessories'].includes(c.category)); if(mats.length){ doc.h2('Materials'); doc.table([{t: 'Material', w: 3}, {t: 'Qty', w: 1, align: 'right'}, {t: 'Issued', w: 1, align: 'right'}], mats.map(m => [m.name, `${r2(num(m.qty) * gq(g))} ${m.unit}`, `${num(m.issued)} ${m.unit}`])); }
  if(V && V.files.length){ const order = ['khaka', 'placement', 'embroidery', 'sketch', 'fabric', 'reference', 'photo']; const F2 = V.files.slice().sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)); doc.h2('References'); await doc.images(F2.map(f => f.id), 190, F2.map(f => kindName(f.kind))); }
  await openPDF(doc, `artisan-${g.no.replace(/\//g, '-')}.pdf`);
}
async function reportPDF(){
  const {from, to} = UI._rep, f = finance(from, to), doc = new PDFDoc();
  await pdfHeader(doc, 'OWNER REPORT', [`${fmtD(from)} - ${fmtD(to)}`]);
  doc.kv([['Customisation revenue (ex GST)', rs(f.revenue)], ['GST collected', rs(f.gst)], ['Collections', rs(f.collected)], ['Cost of invoiced garments', rs(f.cogs)], ['Gross profit', rs(f.profit)], ['Margin', f.revenue ? Math.round(f.profit / f.revenue * 100) + '%' : '-'], ['Customers owe', rs(f.receivable)], ['Owed to workers', rs(f.payW)], ['Owed to vendors', rs(f.payV)]], 3);
  doc.h2('Revenue by charge head'); doc.table([{t: 'Head', w: 3}, {t: 'Amount', w: 1, align: 'right'}], Object.entries(f.byHead).sort((a, b) => b[1] - a[1]).map(([k, val]) => [headName(k), rs(val)]));
  doc.h2('Spending in period (incl. work in progress)'); doc.table([{t: 'Expense', w: 3}, {t: 'Amount', w: 1, align: 'right'}], [['Worker labour', rs(f.labour)], ...Object.entries(f.labourBy).map(([w, a]) => ['   ' + (worker(w)?.name || '-'), rs(a)]), ['Outside vendors', rs(f.vendor)], ['Materials issued', rs(f.material)], Object.assign(['Total', rs(f.expenses)], {_bold: true})]);
  doc.h2('Profitability by order'); doc.table([{t: 'Order', w: 1}, {t: 'Customer', w: 2}, {t: 'Price', w: 1.2, align: 'right'}, {t: 'Cost', w: 1.2, align: 'right'}, {t: 'Profit', w: 1.2, align: 'right'}, {t: 'Margin', w: 0.8, align: 'right'}, {t: 'Balance', w: 1.2, align: 'right'}], f.byOrder.filter(x => x.price > 0).sort(by(x => x.profit, -1)).map(x => [x.o.no, cust(x.o.customerId)?.name || '', rs(x.price), rs(x.cost), rs(x.profit), x.pct + '%', rs(x.bal)]));
  await openPDF(doc, `owner-report-${from}-to-${to}.pdf`);
}
