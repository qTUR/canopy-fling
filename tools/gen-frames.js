'use strict';
/* إطارات الجبّون: من الرسم الأساسي (معلّق بيدين) تُشتق الأوضاع الثانية ثم تُكتب كخرائط نصية في src/frames.js */
var fs = require('fs');
var path = require('path');

/* الرسم الأساسي: معلّق بيدين على حلقة (بدون حدود، الحدود تنضاف وقت التحويل) */
var BASE = [
  '...ccc.........ccc...',
  '...cwc.........cwc...',
  '...ccc.........ccc...',
  '...xXb.........bXx...',
  '...xXb.........bXx...',
  '...xXb..xXXXx..bXx...',
  '...xXb.xXbbbXx.bXx...',
  '...xXb.xcwwwcx.bXx...',
  '...xXb.xcowocx.bXx...',
  '...xXb.xcwwwcx.bXx...',
  '...xXb.xcwxwcx.bXx...',
  '....xXb.xXXXx.bXx....',
  '.....xXbXXXXXbXx.....',
  '.....xXXbbbbbXXx.....',
  '......xXbbbbbXx......',
  '.......xXbbbXx.......',
  '.......xXbbbXx.......',
  '.......xXbbbXx.......',
  '......xXx...xXx......',
  '......xXb...bXx......',
  '......xXb...bXx......',
  '......xXb...bXx......',
  '......xbb...bbx......',
  '.......cc...cc.......',
  '......ccc...ccc......'
];
var PIVOT = [10, 1];

function rep(rows, i, str) { var r = rows.slice(); r[i] = str; return r; }

/* ---- تنويعات مرسومة بيد ---- */
/* رجلين مطوية */
var TUCK = BASE.slice(0, 18).concat([
  '......xXx...xXx......',
  '.....xXb.....bXx.....',
  '.....xXb.....bXx.....',
  '.....xbbc...cbbx.....',
  '......ccc...ccc......'
]);
/* وجه فرحان: عيون مغمضة وفم مفتوح */
function face(rows, eyes, mouth) {
  var r = rows.slice();
  r[8] = '...xXb.x' + eyes + 'x.bXx...';
  r[10] = '...xXb.x' + mouth + 'x.bXx...';
  return r;
}
var HAPPY = face(BASE, 'cxwxc', 'cwowc');
var SCARED = face(rep(BASE, 7, '...xXb.xcowocx.bXx...'), 'cwwwc', 'cwoow'.slice(0, 5));
var BLINK = face(BASE, 'cxwxc', 'cwxwc');

/* مدّ اليدين (مسك) */
var REACH = (function () {
  var r = BASE.slice();
  r.splice(3, 0, '...xXb.........bXx...', '...xXb.........bXx...');
  r.pop(); r.pop();
  return r;
})();

/* ذراعين على شكل V ورجلين مفتوحة */
function splay(rows, armK, legK) {
  var pad = 12, W = rows[0].length + pad * 2;
  var out = rows.map(function (row, y) {
    var line = new Array(W).fill('.');
    for (var x = 0; x < row.length; x++) {
      var ch = row.charAt(x);
      if (ch === '.') continue;
      var nx = x + pad;
      if (y <= 11) {
        var sh = Math.round((11 - y) * armK);
        if (x <= 5) nx -= sh; else if (x >= 15) nx += sh;
      }
      if (y >= 18) {
        var sl = Math.round((y - 17) * legK);
        if (x <= 8) nx -= sl; else if (x >= 12) nx += sl;
      }
      line[nx] = ch;
    }
    return line.join('');
  });
  return { rows: out, pivotShift: pad };
}

/* ---- تدوير (RotSprite مبسّط) ---- */
function rotate(rows, pivot, deg, SS) {
  SS = SS || 6;
  var t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t);
  var h = rows.length, w = 0;
  rows.forEach(function (r) { if (r.length > w) w = r.length; });
  var R = Math.ceil(Math.sqrt(w * w + h * h)) + 2;
  var OW = R * 2, OH = R * 2, opx = R, opy = R;
  var grid = [];
  for (var oy = 0; oy < OH; oy++) {
    var line = '';
    for (var ox = 0; ox < OW; ox++) {
      var counts = {}, filled = 0, tot = SS * SS;
      for (var sy = 0; sy < SS; sy++) {
        for (var sx = 0; sx < SS; sx++) {
          var dx = ox + (sx + 0.5) / SS - opx, dy = oy + (sy + 0.5) / SS - opy;
          /* عكس التدوير */
          var ux = dx * c + dy * s, uy = -dx * s + dy * c;
          var px = Math.floor(ux + pivot[0] + 0.5), py = Math.floor(uy + pivot[1] + 0.5);
          if (py < 0 || py >= h || px < 0 || px >= rows[py].length) continue;
          var ch = rows[py].charAt(px);
          if (ch === '.') continue;
          counts[ch] = (counts[ch] || 0) + 1; filled++;
        }
      }
      if (filled * 2 < tot) { line += '.'; continue; }
      var best = '.', bc = -1;
      for (var k in counts) if (counts[k] > bc) { bc = counts[k]; best = k; }
      line += best;
    }
    grid.push(line);
  }
  return trim(grid, [opx, opy]);
}

function trim(grid, pivot) {
  var minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
  grid.forEach(function (row, y) {
    for (var x = 0; x < row.length; x++) if (row.charAt(x) !== '.') {
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  });
  var rows = [];
  for (var y = minY; y <= maxY; y++) rows.push(grid[y].substring(minX, maxX + 1));
  return { r: rows, p: [pivot[0] - minX, pivot[1] - minY] };
}
function plain(rows, pivot) { return trim(rows, pivot); }

var out = { idle: [], swing: [], fly: [], grab: null, joy: [], fall: [] };

/* تنفّس: ٤ إطارات */
var inhale = BASE.slice(0, 13).concat(['.....xXXbbbbbXXx.....'], BASE.slice(13));
inhale = inhale.slice(0, 14).concat(BASE.slice(13, 18)); /* نفس الطول تقريبًا */
var idle1 = BASE.slice(0, 13).concat(['.....xXXbbbbbXXx.....', '.....xXXbbbbbXXx.....'], BASE.slice(14));
out.idle.push(plain(BASE, PIVOT));
out.idle.push(plain(BASE.slice(0, 13).concat(['.....xXXbbbbbXXx.....'], BASE.slice(13)), PIVOT));
out.idle.push(plain(BASE, PIVOT));
out.idle.push(plain(BLINK, PIVOT));

/* تمرجح: ميلان ٨ درجات حول اليدين */
[-40, -28, -16, -6, 6, 16, 28, 40].forEach(function (lean) {
  out.swing.push(rotate(BASE, PIVOT, -lean, 6));
});

/* طيران: اليدين لقدام والجسم وراهم. ٤ زوايا */
[[30, BASE], [60, TUCK], [90, BASE], [115, TUCK]].forEach(function (p) {
  out.fly.push(rotate(p[1], PIVOT, p[0], 6));
});

out.grab = plain(REACH, PIVOT);

var sp = splay(HAPPY, 0.32, 0.4);
out.joy.push(plain(sp.rows, [PIVOT[0] + sp.pivotShift, PIVOT[1]]));
var sp2 = splay(HAPPY, 0.5, 0.2);
out.joy.push(plain(sp2.rows, [PIVOT[0] + sp2.pivotShift, PIVOT[1]]));

var f1 = splay(SCARED, 0.35, 0.5);
out.fall.push(plain(f1.rows, [PIVOT[0] + f1.pivotShift, PIVOT[1]]));
var f2 = splay(SCARED, 0.2, 0.3);
out.fall.push(plain(f2.rows, [PIVOT[0] + f2.pivotShift, PIVOT[1]]));

var src = "'use strict';\n/* إطارات الجبّون: خرائط بكسل نصية، p = نقطة اليدين */\nvar FRAME_MAPS = " + JSON.stringify(out) + ';\n';
fs.writeFileSync(path.join(__dirname, '..', 'src', 'frames.js'), src);
console.log('frames:', Object.keys(out).map(function (k) { var v = out[k]; return k + ':' + (Array.isArray(v) ? v.length : 1); }).join(' '));
