'use strict';
/* يجمّع المصدر في dist: artifact / youtube / pages */
var fs = require('fs');
var path = require('path');
var root = path.join(__dirname, '..');
var dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });

/* مراحل الحملة الأساسية تُحسب وقت البناء */
var coreCtx = require('./lib')();
var coreData = [];
for (var ci = 0; ci < coreCtx.LEVELS.count(); ci++) { var cl = coreCtx.LEVELS.get(ci); if (!cl.ok) throw new Error('level ' + (ci + 1) + ' unsolved'); coreData.push(cl); }
var coreSrc = 'var CORE_DATA = ' + JSON.stringify(coreData) + ';\n';
var FILES = ['pix.js', 'foliage.js', 'frames.js', 'art.js', 'sim.js', 'solver.js', 'levels.js', 'yt.js', 'game.js'];
var code = coreSrc + FILES.map(function (f) { return fs.readFileSync(path.join(root, 'src', f), 'utf8'); }).join('\n');
var css = fs.readFileSync(path.join(root, 'src', 'style.css'), 'utf8');
var body = fs.readFileSync(path.join(root, 'src', 'body.html'), 'utf8');

var wsrc = ['sim.js', 'solver.js', 'levels.js'].map(function (f) { return fs.readFileSync(path.join(root, 'src', f), 'utf8'); }).join('\n') +
  '\nonmessage = function (e) { var d = e.data; var lv = null; try { lv = d.star ? LEVELS.starLevel(d.i, d.star, d.mods, 60) : LEVELS.endless(d.ek, d.mods, 60); } catch (x) {} postMessage({ k: d.k, lv: lv }); };\n';
var wtag = '<script type="text/plain" id="wsrc">' + wsrc + '</script>';
var fontDir = path.join(root, 'assets', 'fonts');
var FONTS = ['handjet-arabic-700.woff2', 'handjet-latin-700.woff2'];
function cssFor(target) {
  var c = css;
  if (target === 'artifact') {
    c = c.replace('%FONT_AR%', 'data:font/woff2;base64,' + fs.readFileSync(path.join(fontDir, FONTS[0])).toString('base64'))
         .replace('%FONT_LA%', 'data:font/woff2;base64,' + fs.readFileSync(path.join(fontDir, FONTS[1])).toString('base64'));
  } else {
    c = c.replace('%FONT_AR%', 'fonts/' + FONTS[0]).replace('%FONT_LA%', 'fonts/' + FONTS[1]);
  }
  return c;
}
function page(target) {
  if (target === 'artifact') return '<title>Canopy Fling</title><style>' + cssFor(target) + '</style>' + body + wtag + '<script>' + code + '\nGAME.start();</script>';
  var head = '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">';
  var title = 'Canopy Fling | \u0623\u0631\u062c\u0648\u062d\u0629 \u0627\u0644\u063a\u064a\u0644';
  var extra = '';
  if (target === 'pages') {
    var base = 'https://qtur.github.io/canopy-fling/';
    extra = '<meta name="description" content="Swing from vine to vine through a golden rainforest canopy. \u0623\u0631\u062c\u0648\u062d\u0629 \u0628\u064a\u0646 \u0627\u0644\u0643\u0631\u0648\u0645 \u0641\u064a \u063a\u0627\u0628\u0629 \u0645\u0637\u064a\u0631\u0629 \u0630\u0647\u0628\u064a\u0629.">' +
      '<meta property="og:title" content="' + title + '"><meta property="og:description" content="Swing &amp; fling through the rainforest canopy.">' +
      '<meta property="og:type" content="website"><meta property="og:url" content="' + base + '"><meta property="og:image" content="' + base + 'og.png">';
  }
  var sdk = '<script src="https://www.youtube.com/game_api/v1"></script>';
  return '<!doctype html><html lang="en" dir="ltr"><head>' + head + '<title>' + title + '</title>' + extra + sdk + '<style>' + cssFor(target) + '</style></head><body>' + body + wtag +
    '<script>' + code + '\nGAME.start();</script></body></html>';
}

function outDir(name) {
  var d = path.join(dist, name);
  fs.rmSync(d, { recursive: true, force: true });
  fs.mkdirSync(path.join(d, 'fonts'), { recursive: true });
  FONTS.concat(['OFL.txt']).forEach(function (f) { fs.copyFileSync(path.join(fontDir, f), path.join(d, 'fonts', f)); });
  return d;
}
fs.writeFileSync(path.join(dist, 'artifact.html'), page('artifact'));
console.log('artifact', fs.statSync(path.join(dist, 'artifact.html')).size);
var yd = outDir('youtube');
fs.writeFileSync(path.join(yd, 'index.html'), page('youtube'));
console.log('youtube', fs.statSync(path.join(yd, 'index.html')).size);
var pd = outDir('pages');
fs.writeFileSync(path.join(pd, 'index.html'), page('pages'));
fs.writeFileSync(path.join(pd, '.nojekyll'), '');
console.log('pages', fs.statSync(path.join(pd, 'index.html')).size);
