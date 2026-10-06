'use strict';
/* يجمّع المصدر في dist: artifact / youtube / pages */
var fs = require('fs');
var path = require('path');
var root = path.join(__dirname, '..');
var dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });

var FILES = ['pix.js', 'foliage.js', 'frames.js', 'art.js', 'sim.js', 'solver.js', 'levels.js', 'game.js'];
var code = FILES.map(function (f) { return fs.readFileSync(path.join(root, 'src', f), 'utf8'); }).join('\n');
var css = fs.readFileSync(path.join(root, 'src', 'style.css'), 'utf8');
var body = fs.readFileSync(path.join(root, 'src', 'body.html'), 'utf8');

function page(target) {
  if (target === 'artifact') return '<title>Canopy Fling</title><style>' + css + '</style>' + body + '<script>' + code + '\nGAME.start();</script>';
  var head = '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">';
  var title = 'Canopy Fling | أرجوحة الغيل';
  var extra = '';
  if (target === 'pages') {
    var base = 'https://qtur.github.io/canopy-fling/';
    extra = '<meta name="description" content="Swing from vine to vine through a golden rainforest canopy. أرجوحة بين الكروم في غابة مطيرة ذهبية.">' +
      '<meta property="og:title" content="' + title + '"><meta property="og:description" content="Swing &amp; fling through the rainforest canopy.">' +
      '<meta property="og:type" content="website"><meta property="og:url" content="' + base + '"><meta property="og:image" content="' + base + 'og.png">';
  }
  var sdk = (target === 'youtube' || target === 'pages') ? '<script src="https://www.youtube.com/game_api/v1"></script>' : '';
  return '<!doctype html><html lang="ar" dir="rtl"><head>' + head + '<title>' + title + '</title>' + extra + '<style>' + css + '</style>' + sdk + '</head><body>' + body +
    '<script>' + code + '\nGAME.start();</script></body></html>';
}

['artifact', 'youtube', 'pages'].forEach(function (t) {
  var out = path.join(dist, t === 'artifact' ? 'artifact.html' : (t === 'youtube' ? 'youtube-index.html' : 'index.html'));
  fs.writeFileSync(out, page(t));
  console.log(t, fs.statSync(out).size);
});
