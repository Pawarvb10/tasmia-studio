import asyncio, json, base64
from playwright.async_api import async_playwright
F='file://'+__import__('os').path.abspath(__import__('os').path.join(__import__('os').path.dirname(__file__),'..','index.html'))+''; S=__import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)),'out','')
__import__('os').makedirs(S,exist_ok=True)
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=await b.new_context(viewport={'width':1440,'height':1000}); pg=await ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)))
    pg.on('console',lambda m:errs.append('CONSOLE '+m.text) if m.type=='error' else None)
    await pg.goto(F); await pg.wait_for_timeout(600)
    await pg.click('text=Load demo studio'); await pg.wait_for_timeout(500)
    await pg.click('.utile >> nth=0'); await pg.fill('#pin','1111'); await pg.click('text=Sign in'); await pg.wait_for_timeout(1000)
    await pg.evaluate("window.__pdfs=[]; openPDF=async(doc,name)=>{doc.footer('x'); const bl=doc.build(); const buf=new Uint8Array(await bl.arrayBuffer()); let s=''; for(const c of buf) s+=String.fromCharCode(c); window.__pdfs.push([name,btoa(s)]);}; void 0")
    print('heads', await pg.evaluate("ST().heads.map(x=>x.name).join(' | ')"))
    await pg.goto(F+'#order-o_1002'); await pg.wait_for_timeout(600)
    await pg.click('text=🧾 Generate invoice'); await pg.wait_for_timeout(400)
    await pg.screenshot(path=S+'inv_dialog.png')
    await pg.fill('#invDisc','200'); await pg.fill('#invRef','300'); await pg.fill('#invRefBy','Sadaf Pathan')
    await pg.fill('.invd >> nth=0','Deep U back with dori & 2 gold latkans; light aari on neckline & sleeve hem; padded, full lining')
    await pg.click('#mbox .mbar button.pri'); await pg.wait_for_timeout(1200)
    print('o1002 invs', await pg.evaluate("coll('invoices').filter(i=>i.orderId==='o_1002').map(i=>i.no)"))
    await pg.screenshot(path=S+'inv_view.png',full_page=False)
    r=await pg.evaluate("(()=>{const i=coll('invoices').filter(i=>i.orderId==='o_1002').slice(-1)[0];return {no:i.no,sub:i.sub,d1:i.disc1,ref:i.referral,tot:i.total,blocks:i.blocks.map(b=>[b.title,b.qty,b.unit,b.total,b.lines.map(l=>l.name+':'+l.unit).join(', ')]),heads:invHeads(i).map(x=>x.name),T:orderTotals(ord('o_1002'))}})()")
    print(json.dumps(r,ensure_ascii=False,indent=0)[:2500])
    await pg.evaluate("document.querySelector('#mbox').scrollTop=2000"); await pg.wait_for_timeout(200); await pg.screenshot(path=S+'inv_view2.png')
    iid=await pg.evaluate("coll('invoices').filter(i=>i.orderId==='o_1002').slice(-1)[0].id")
    await pg.evaluate(f"invoicePDF('{iid}')"); await pg.wait_for_timeout(1000)
    for n,b64 in await pg.evaluate("window.__pdfs"):
      open(S+'pdf6_'+n,'wb').write(base64.b64decode(b64)); print('PDF',n)
    print('ERRS',errs)
asyncio.run(main())
