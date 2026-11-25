import asyncio
from playwright.async_api import async_playwright
F='file://'+__import__('os').path.abspath(__import__('os').path.join(__import__('os').path.dirname(__file__),'..','index.html'))+''
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, is_mobile=True, has_touch=True); pg=await ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto(F); await pg.wait_for_timeout(600); await pg.click('text=Load demo studio'); await pg.wait_for_timeout(500)
    await pg.click('.utile >> nth=0'); await pg.fill('#pin','1111'); await pg.click('text=Sign in'); await pg.wait_for_timeout(1000)
    await pg.screenshot(path='m_dash.png')
    sw=await pg.evaluate('document.documentElement.scrollWidth'); print('dash scrollWidth', sw)
    for v in ['board','planner','orders','billing','workers']:
      await pg.goto(F+'#'+v); await pg.wait_for_timeout(300); print(v,'scrollWidth', await pg.evaluate('document.documentElement.scrollWidth'))
    await pg.goto(F+'#board'); await pg.wait_for_timeout(300); await pg.screenshot(path='m_board.png')
    gid=await pg.evaluate("coll('garments').find(g=>g.no==='TD-1003/1').id")
    await pg.goto(F+'#garment-'+gid); await pg.wait_for_timeout(400); await pg.screenshot(path='m_garment.png', full_page=True)
    print('garment scrollWidth', await pg.evaluate('document.documentElement.scrollWidth'))
    await pg.click('.topbar button >> nth=0'); await pg.wait_for_timeout(300); await pg.screenshot(path='m_menu.png')
    # artisan login
    await pg.evaluate("logout()"); await pg.wait_for_timeout(300)
    await pg.click('.utile >> text=Farid'); await pg.fill('#pin','4444'); await pg.click('text=Sign in'); await pg.wait_for_timeout(900)
    await pg.screenshot(path='m_tasks.png', full_page=True)
    print('artisan nav:', (await pg.inner_text('nav')).replace('\n',' ')[:200])
    print('ERRS', errs)
    await b.close()
asyncio.run(main())
