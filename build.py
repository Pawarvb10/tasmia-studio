import os
ROOT=os.path.dirname(os.path.abspath(__file__))
src=os.path.join(ROOT,'src')
order=['core.js','meas.js','seed.js','logic.js','ui_shell.js','ui_orders.js','ui_garment.js','ui_ops.js','ui_crm.js','ui_admin.js','ui_studio.js','pdfdocs.js']
js='\n'.join(open(os.path.join(src,f)).read() for f in order)
css=open(os.path.join(src,'app.css')).read()
html=f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tasmia Designers · Studio</title>
<style>
{css}
</style>
<script>new MutationObserver(()=>{{for(const c of document.querySelectorAll('.stack td:not([data-l])')){{let i=0,p=c;while(p=p.previousElementSibling)i+=p.colSpan;const t=c.closest('table');const hr=t&&t.tHead&&t.tHead.rows[0];c.dataset.l=hr&&hr.cells[i]?hr.cells[i].textContent:''}}}}).observe(document,{{childList:true,subtree:true}})</script>
</head>
<body>
<div class="login"><div class="box"><h1>Tasmia Designers</h1><p class="muted" id="boot">Loading…</p></div></div>
<div id="toasts"></div>
<script>
{js}
boot().catch(e => {{ console.error(e); document.body.innerHTML = '<pre style="padding:20px;white-space:pre-wrap">Could not start: ' + (e && e.stack || e) + '</pre>'; }});
</script>
</body>
</html>
'''
open(os.path.join(ROOT,'index.html'),'w').write(html)
print(len(html), html.count('\n'))
