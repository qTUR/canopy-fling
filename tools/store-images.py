# يولّد صور المتجر من رسم اللعبة نفسها
import json, os, sys
from playwright.sync_api import sync_playwright
from PIL import Image
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file://' + root + '/dist/pages/index.html'
OUT = sys.argv[1] if len(sys.argv) > 1 else root + '/store'
os.makedirs(OUT, exist_ok=True)
SIZES = {'landscape': (1920, 1080), 'square': (1280, 1280), 'portrait': (1080, 1920)}
SOLVE = """()=>{var lv=GAME.level,r=SOLVER.seqPath(lv,{}),DT=SIM.DT;
 for(var i=0;i<r.path.length;i++){var a=r.path[i];GAME.setHeld(true);for(var q=0;q<a.rel;q++)GAME.tick(DT);GAME.setHeld(false);GAME.tick(DT);
  if(i>=4){GAME.setHeld(false);var f=0;while(f<22&&GAME.state.mode===SIM.FREE){GAME.tick(DT);f++}return i}GAME.setHeld(true);
  var f2=0;while(GAME.state.mode===SIM.FREE&&GAME.phase==='play'&&f2<1200){GAME.tick(DT);f2++}}return -1}"""
def shot(b, w, h, lang, text, path):
    pg = b.new_page(viewport={'width': w, 'height': h})
    pg.add_init_script("localStorage.setItem('cf1',%s)" % json.dumps(json.dumps({'lang': lang, 'tip': 1, 'lvl': 9, 'pr': 1})))
    pg.goto(URL); pg.wait_for_function("GAME.screen()==='start'")
    pg.evaluate("GAME.begin()"); pg.wait_for_function("GAME.phase==='play'")
    pg.evaluate(SOLVE)
    for _ in range(40): pg.evaluate("GAME.tick(1/60)") if False else None
    pg.evaluate("GAME.pause()")
    pg.wait_for_timeout(900)
    pg.add_style_tag(content='#menu,.hud,#tip,#card,#toast{display:none!important}')
    if text:
        t = 'أرجوحة الغيل' if lang == 'ar' else 'Canopy Fling'
        fs = int(min(w, h * 1.4) * 0.11)
        pg.evaluate("([t,fs,ar])=>{var d=document.createElement('div');d.textContent=t;d.style.cssText='position:fixed;left:0;right:0;top:9%;text-align:center;color:#f3ecd2;font:700 '+fs+'px Pix,sans-serif;text-shadow:0 '+(fs/14)+'px 0 #0a2a26,0 0 '+(fs/3)+'px #0a2a26;z-index:99;direction:'+(ar?'rtl':'ltr');document.body.appendChild(d)}", [t, fs, lang == 'ar'])
    pg.wait_for_timeout(200)
    pg.screenshot(path=path); pg.close()
    im = Image.open(path).convert('RGB'); im.save(path, optimize=True)   # بدون أي ميتاداتا
with sync_playwright() as p:
    b = p.chromium.launch()
    for name, (w, h) in SIZES.items():
        shot(b, w, h, 'ar', True, '%s/%s_ar.png' % (OUT, name))
        shot(b, w, h, 'en', True, '%s/%s_en.png' % (OUT, name))
        shot(b, w, h, 'en', False, '%s/%s_notext.png' % (OUT, name))
    shot(b, 1200, 630, 'en', True, root + '/assets/og.png')
    b.close()
print('done')
