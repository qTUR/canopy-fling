'use strict';
/* محرك البكسل: مخزن معرّفات ألوان، سبرايتات نصية، تنقيط، ضجيج */
var PIX = (function () {
  var KEYS = ['J', 'L', 'M', 'H', 'T', 'C', 'F'];
  var LEG = { J: 'ogGjJ', L: 'alLiI', M: 'dmMqQ', H: 'rhHpP', T: 'stTuU', C: 'vcCwW', F: 'zxXbB' };
  var CH = {};
  KEYS.forEach(function (k, ri) {
    for (var l = 0; l < 5; l++) CH[LEG[k].charAt(l)] = ri * 5 + l;
  });
  var NONE = 255;
  var warned = {};

  function cid(k, l) { return KEYS.indexOf(k) * 5 + l; }
  function ramp(c) { return (c / 5) | 0; }
  function level(c) { return c % 5; }
  function lift(c, n) {
    if (c === NONE) return c;
    var l = (c % 5) + (n === undefined ? 1 : n);
    if (l > 4) l = 4;
    if (l < 0) l = 0;
    return ((c / 5) | 0) * 5 + l;
  }
  function hex(h) {
    return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)];
  }
  function palette(r) {
    var a = [];
    KEYS.forEach(function (k) { r[k].forEach(function (h) { a.push(hex(h)); }); });
    return a;
  }

  function Buf(w, h) { this.w = w; this.h = h; this.d = new Uint8Array(w * h); }
  Buf.prototype.fill = function (c) { this.d.fill(c); };
  Buf.prototype.set = function (x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.d[y * this.w + x] = c;
  };
  Buf.prototype.get = function (x, y) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return NONE;
    return this.d[y * this.w + x];
  };

  function sprite(rows, opt) {
    opt = opt || {};
    var h = rows.length, w = 0, i, j;
    for (j = 0; j < h; j++) if (rows[j].length > w) w = rows[j].length;
    var pad = opt.outline === false ? 0 : 1;
    var W = w + pad * 2, H = h + pad * 2;
    var d = new Uint8Array(W * H);
    d.fill(NONE);
    for (j = 0; j < h; j++) {
      for (i = 0; i < rows[j].length; i++) {
        var ch = rows[j].charAt(i);
        if (ch === '.' || ch === ' ') continue;
        if (CH[ch] === undefined) {
          if (!warned[ch]) { warned[ch] = 1; if (typeof console !== 'undefined') console.warn('sprite: unknown key ' + ch); }
          continue;
        }
        d[(j + pad) * W + i + pad] = CH[ch];
      }
    }
    if (pad) {
      var oc = opt.outlineId !== undefined ? opt.outlineId : CH.o;
      var out = d.slice();
      for (j = 0; j < H; j++) {
        for (i = 0; i < W; i++) {
          if (d[j * W + i] !== NONE) continue;
          if ((i > 0 && d[j * W + i - 1] !== NONE) || (i < W - 1 && d[j * W + i + 1] !== NONE) ||
              (j > 0 && d[(j - 1) * W + i] !== NONE) || (j < H - 1 && d[(j + 1) * W + i] !== NONE)) {
            out[j * W + i] = oc;
          }
        }
      }
      d = out;
    }
    return { w: W, h: H, d: d, pad: pad };
  }

  function mirrorV(rows) {
    var r = rows.slice();
    for (var i = rows.length - 2; i >= 0; i--) r.push(rows[i]);
    return r;
  }

  function stamp(buf, s, x, y, flip, fn) {
    x = Math.round(x); y = Math.round(y);
    for (var j = 0; j < s.h; j++) {
      var py = y + j;
      if (py < 0 || py >= buf.h) continue;
      for (var i = 0; i < s.w; i++) {
        var c = s.d[j * s.w + (flip ? s.w - 1 - i : i)];
        if (c === NONE) continue;
        var px = x + i;
        if (px < 0 || px >= buf.w) continue;
        buf.d[py * buf.w + px] = fn ? fn(c, px, py) : c;
      }
    }
  }

  function line(x0, y0, x1, y1, cb) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    var err = dx - dy, i = 0, n = Math.max(dx, dy) + 1;
    for (;;) {
      cb(x0, y0, i, n);
      i++;
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }

  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function dth(x, y, t) {
    x = Math.round(x); y = Math.round(y);
    return t > (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
  }
  function grad(stops, t, x, y) {
    var n = stops.length - 1;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    var p = t * n, i = Math.min(n - 1, Math.floor(p)), f = p - i;
    return dth(x, y, f) ? stops[i + 1] : stops[i];
  }

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
  function hash(n) {
    n = n | 0;
    n = (n ^ 61) ^ (n >>> 16);
    n = (n + (n << 3)) | 0;
    n = n ^ (n >>> 4);
    n = Math.imul(n, 0x27d4eb2d);
    n = n ^ (n >>> 15);
    return (n >>> 0) / 4294967296;
  }
  function vnoise(x, seed) {
    var xi = Math.floor(x), f = x - xi;
    f = f * f * (3 - 2 * f);
    var s = Math.imul(seed | 0, 668265263);
    var a = hash(Math.imul(xi, 374761393) + s);
    var b = hash(Math.imul(xi + 1, 374761393) + s);
    return a * (1 - f) + b * f;
  }

  function toImage(buf, pal, img) {
    var d = buf.d, o = img.data, n = d.length;
    for (var i = 0, k = 0; i < n; i++, k += 4) {
      var c = d[i];
      var p = c === NONE ? [255, 0, 255] : pal[c];
      o[k] = p[0]; o[k + 1] = p[1]; o[k + 2] = p[2]; o[k + 3] = 255;
    }
  }

  return {
    KEYS: KEYS, CH: CH, NONE: NONE, cid: cid, ramp: ramp, level: level, lift: lift,
    palette: palette, Buf: Buf, sprite: sprite, mirrorV: mirrorV, stamp: stamp, line: line,
    dth: dth, grad: grad, rng: rng, hash: hash, vnoise: vnoise, toImage: toImage
  };
})();
