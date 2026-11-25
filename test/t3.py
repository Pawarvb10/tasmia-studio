import asyncio, json
from playwright.async_api import async_playwright
F='file://'+__import__('os').path.abspath(__import__('os').path.join(__import__('os').path.dirname(__file__),'..','index.html'))+''
MOCK=open('mock.js').read()
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=await b.new_context(viewport={'width':1300,'height':950}); errs=[]
    A=await ctx.new_page(); A.on('pageerror',lambda e:errs.append('A '+str(e)))
    await A.add_init_script("window.__MOCKUSER={id:'owner1',owner:true,admin:true,name:'Studio Owner'};"+MOCK)
    await A.goto(F); await A.wait_for_timeout(1500)
    print('A boot:', (await A.inner_text('body'))[:120].replace('\n',' '))
    await A.click('text=Load demo studio'); await A.wait_for_timeout(5000)
    print('A after init:', (await A.inner_text('nav')).replace('\n',' ')[:160])
    n=await A.evaluate("Object.keys(JSON.parse(localStorage.getItem('mockdb'))).length"); print('docs in central db:', n)
    B=await ctx.new_page(); B.on('pageerror',lambda e:errs.append('B '+str(e)))
    await B.add_init_script("window.__MOCKUSER={id:'staff2',owner:false,admin:false,name:'Ramesh'};"+MOCK)
    await B.goto(F); await B.wait_for_timeout(2500)
    print('B boot:', (await B.inner_text('body'))[:140].replace('\n',' '))
    await B.click('#reqb'); await B.wait_for_timeout(500)
    await A.evaluate("UI.stab='users'"); await A.goto(F+'#setup'); await A.wait_for_timeout(1200)
    print('A requests:', (await A.inner_text('#joinreqs')).replace('\n',' '))
    await A.select_option('select[id^=rq_]','master'); await A.click('#joinreqs >> text=Grant'); await A.wait_for_timeout(1200)
    await B.reload(); await B.wait_for_timeout(2500)
    nav=(await B.inner_text('nav')).replace('\n',' '); print('B nav:', nav[:400])
    print('B can billing?', 'Billing' in nav, '| B role', await B.evaluate('ME.role'))
    # live sync: B starts a step, A sees it
    gid=await B.evaluate("coll('garments').find(g=>g.no==='TD-1001/2').id"); sid=await B.evaluate(f"gar('{gid}').steps[0].id")
    await A.goto(F+'#garment-'+gid); await A.wait_for_timeout(800)
    before=await A.evaluate(f"gar('{gid}').steps[0].status")
    await B.evaluate(f"startStep('{gid}','{sid}',true)"); await B.wait_for_timeout(1500)
    after=await A.evaluate(f"gar('{gid}').steps[0].status"); print('sync step status A:', before,'->',after)
    print('A screen shows In progress:', 'In progress' in await A.inner_text('main'))
    # B cannot change settings (config is admin-only): change shop name on B, ensure central not changed
    await B.evaluate("ST().shop='Hacked'; save()"); await B.wait_for_timeout(800)
    cs=await A.evaluate("JSON.parse(JSON.parse(localStorage.getItem('mockdb'))['config/settings']).shop"); print('central shop name after staff edit:', cs)
    # order numbering via lease from both
    await A.evaluate("nextNo('order').then(n=>window.__n1=n)"); await B.evaluate("nextNo('order').then(n=>window.__n2=n)"); await A.wait_for_timeout(600)
    print('numbers', await A.evaluate('window.__n1'), await B.evaluate('window.__n2'))
    # backups: owner auto backup
    await A.evaluate("autoBackup(true)"); await A.wait_for_timeout(800); print('backups', await A.evaluate("DB.state.backups.length"), 'assets', await A.evaluate("window.__assets.length"))
    # downloads in central → uses capability
    await A.evaluate("exportData(false)"); await A.wait_for_timeout(500); print('saves', await A.evaluate('window.__saves'))
    print('ERRS', errs[:10])
    await b.close()
asyncio.run(main())
