import asyncio, json
from playwright.async_api import async_playwright
F='file://'+__import__('os').path.abspath(__import__('os').path.join(__import__('os').path.dirname(__file__),'..','index.html'))+''
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=await b.new_context(viewport={'width':1440,'height':1000}); pg=await ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)))
    pg.on('console',lambda m:errs.append('CONSOLE '+m.text) if m.type=='error' else None)
    await pg.goto(F); await pg.wait_for_timeout(800)
    await pg.click('text=Load demo studio'); await pg.wait_for_timeout(600)
    await pg.click('.utile >> nth=0'); await pg.fill('#pin','1111'); await pg.click('text=Sign in'); await pg.wait_for_timeout(1200)
    views=['dashboard','mytasks','alerts','orders','customers','board','planner','embroidery','trials','qc','workers','vendors','inventory','billing','reports','config','comms','setup']
    for v in views:
      await pg.goto(F+'#'+v); await pg.wait_for_timeout(250)
      t=await pg.inner_text('main')
      if 'went wrong' in t or 'not found' in t.lower()[:200]: errs.append('RENDER '+v+': '+t[:600])
    await pg.goto(F+'#dashboard'); await pg.wait_for_timeout(300); await pg.screenshot(path='dash.png',full_page=True)
    # tabs within views
    for v,var,vals in [('orders','otab',['orders','garments']),('planner','ptab',['stitch','delivery','week','daily']),('inventory','itab',['stock','moves','cust','short']),('billing','btab',['outstanding','invoices','payments','toinvoice']),('config','ctab',['designs','types','stages']),('comms','mtab',['templates','log','test']),('setup','stab',['shop','calendar','qc','billing','users','data'])]:
      for x in vals:
        await pg.evaluate(f"UI.{var}='{x}'"); await pg.goto(F+'#'+v); await pg.evaluate('render()'); await pg.wait_for_timeout(150)
        t=await pg.inner_text('main')
        if 'went wrong' in t: errs.append(f'RENDER {v}/{x}: '+t[:600])
    # every garment, every tab
    gids=await pg.evaluate("coll('garments').map(g=>g.id)")
    tabs=['overview','meas','design','plan','materials','trials','qc','bill','history']
    for gid in gids:
      for tb in tabs:
        await pg.evaluate(f"UI.gtabNext='{tb}'"); await pg.goto(F+'#garment-'+gid); await pg.evaluate('render()'); await pg.wait_for_timeout(80)
        t=await pg.inner_text('main')
        if 'went wrong' in t: errs.append(f'RENDER garment {gid}/{tb}: '+t[:700])
    for oid in await pg.evaluate("coll('orders').map(o=>o.id)"):
      await pg.goto(F+'#order-'+oid); await pg.wait_for_timeout(80); t=await pg.inner_text('main')
      if 'went wrong' in t: errs.append('RENDER order '+t[:500])
    for cid in await pg.evaluate("coll('customers').map(o=>o.id)"):
      await pg.goto(F+'#customer-'+cid); await pg.wait_for_timeout(80); t=await pg.inner_text('main')
      if 'went wrong' in t: errs.append('RENDER cust '+t[:500])
    for wid in await pg.evaluate("coll('workers').map(o=>o.id)"):
      await pg.goto(F+'#worker-'+wid); await pg.wait_for_timeout(80); t=await pg.inner_text('main')
      if 'went wrong' in t: errs.append('RENDER worker '+t[:500])
    for vid in await pg.evaluate("coll('vendors').map(o=>o.id)"):
      await pg.goto(F+'#vendor-'+vid); await pg.wait_for_timeout(80); t=await pg.inner_text('main')
      if 'went wrong' in t: errs.append('RENDER vendor '+t[:500])
    for did in await pg.evaluate("coll('designs').map(o=>o.id)"):
      await pg.goto(F+'#design-'+did); await pg.wait_for_timeout(80); t=await pg.inner_text('main')
      if 'went wrong' in t: errs.append('RENDER design '+t[:500])
    info=await pg.evaluate("""(()=>{const sc=sched();return {alerts:allAlerts().map(a=>a.sev+' | '+a.title+' | '+a.detail.slice(0,110)), G:coll('garments').map(g=>[g.no,gStatus(g),gStageLabel(g),g.deliveryDate,sc.G[g.id]?.ready,progress(g).pct, garmentBill(g).total]), fin:finance(todayISO().slice(0,8)+'01',todayISO())}})()""")
    print(json.dumps(info['G'],indent=0)); print('\n'.join(info['alerts'])); f=info['fin']; print('fin', f['revenue'], f['expenses'], f['profit'], f['receivable'], f['payW'], f['payV'])
    print('ERRS', errs[:20])
    await b.close()
asyncio.run(main())
