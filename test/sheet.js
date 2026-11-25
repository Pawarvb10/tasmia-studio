const fs=require('fs');const vm=require('vm');
const ctx={};vm.createContext(ctx);
vm.runInContext(`const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));const v=x=>h(x??'');`+fs.readFileSync('../src/meas.js','utf8')+`;this.CHARTS=CHARTS;this.measSVG=measSVG;`,ctx);
for(const ch of Object.keys(ctx.CHARTS)){let html='<html><body style="margin:0;font-family:sans-serif;display:flex;flex-wrap:wrap;width:1400px">';
for(const it of ctx.CHARTS[ch].items){html+=`<div style="width:170px;height:240px;border:1px solid #ccc;margin:2px"><div style="font-size:11px">${it[0]}. ${it[1]}</div><div style="height:220px">${ctx.measSVG(ch,it).replace('<svg ','<svg style="width:100%;height:100%" ')}</div></div>`}
fs.writeFileSync(`sheet/${ch}.html`,html+'</body></html>');}
