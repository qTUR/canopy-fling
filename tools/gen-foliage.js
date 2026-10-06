'use strict';
/* يرسم خرائط بكسل نصية للأوراق والحلقة، ويكتبها في src/foliage.js */
var fs = require('fs');
var path = require('path');

function rng(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

var CHARS = ['g', 'G', 'j', 'J'];

function clump(w, h, seed, nDiscs) {
  var R = rng(seed), i, x, y;
  var discs = [];
  for (i = 0; i < nDiscs; i++) {
    var r = h * (0.26 + R() * 0.24);
    var cx = r + R() * Math.max(0, w - 2 * r);
    var cy = r + R() * Math.max(0, h - 2 * r);
    discs.push({ cx: cx, cy: cy, r: r });
  }
  discs.sort(function (a, b) { return b.cy - a.cy; });
  var grid = [];
  for (y = 0; y < h; y++) { grid.push(new Array(w).fill(-1)); }
  discs.forEach(function (d) {
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        var dx = x + 0.5 - d.cx, dy = y + 0.5 - d.cy, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > d.r) continue;
        var lx = dx / d.r, ly = dy / d.r;
        var t = 0.52 - 0.34 * lx - 0.52 * ly + (R() - 0.5) * 0.16;
        if (dist > d.r - 1.15 && lx + ly > 0.2) t -= 0.3;
        var lv = t < 0.2 ? 0 : t < 0.45 ? 1 : t < 0.7 ? 2 : 3;
        grid[y][x] = lv;
      }
    }
  });
  for (y = 0; y < h; y++) {
    for (x = 0; x < w; x++) {
      var v = grid[y][x];
      if (v < 0) continue;
      var q = R();
      if (v >= 1 && v < 3 && q < 0.07) grid[y][x] = v + 1;
      else if (v >= 2 && q > 0.95) grid[y][x] = v - 1;
    }
  }
  return grid.map(function (row) {
    return row.map(function (v) { return v < 0 ? '.' : CHARS[v]; }).join('');
  });
}

/* حلقة كرمة ١٧×١٧: ربع علوي أيسر ثم تعكس */
function ring17() {
  var N = 17, c = 8, rows = [];
  for (var y = 0; y < N; y++) {
    var s = '';
    for (var x = 0; x < N; x++) {
      var dx = x - c, dy = y - c, d = Math.sqrt(dx * dx + dy * dy);
      if (d < 5.3 || d > 8.5) { s += '.'; continue; }
      var edge = d > 7.5 ? 'o' : (d < 6.1 ? 'l' : 'L');
      var lit = (-dx - dy) / (d + 0.001);
      var ch;
      if (d > 7.6) ch = 'g';
      else if (d < 6.0) ch = lit > 0.2 ? 'i' : 'L';
      else ch = lit > 0.45 ? 'i' : (lit < -0.35 ? 'l' : 'L');
      s += ch;
    }
    rows.push(s);
  }
  /* عقد صغيرة على الحلقة */
  return rows;
}

var out = {};
out.c14 = clump(14, 9, 101, 5);
out.c18 = clump(18, 11, 202, 6);
out.c24 = clump(24, 14, 303, 7);
out.c30 = clump(30, 17, 404, 8);
out.c40 = clump(40, 22, 505, 10);
out.c56 = clump(56, 30, 606, 12);
out.ring = ring17();

var src = "'use strict';\n/* خرائط بكسل للأوراق والحلقة */\nvar FOLIAGE_MAPS = " + JSON.stringify(out, null, 1).replace(/\n\s+/g, '\n ') + ';\n';
fs.writeFileSync(path.join(__dirname, '..', 'src', 'foliage.js'), src);
console.log('ok', Object.keys(out).join(','));
