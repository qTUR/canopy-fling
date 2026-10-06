'use strict';
/* بناء المراحل: توليد حتمي من بذرة + معاملات */
var LEVELS = (function () {
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
  function rr(R, lo, hi) { return lo + (hi - lo) * R(); }

  /* سلسلة حلقات ثابتة (المنطقة ١) */
  function chain(p) {
    var R = rng(p.seed), anchors = [], i;
    var x = 40, ry = 120;
    for (i = 0; i < p.n; i++) {
      var L = Math.round(rr(R, p.L[0], p.L[1]));
      if (i > 0) {
        x += Math.round(rr(R, p.dx[0], p.dx[1]));
        ry += Math.round(rr(R, p.dy[0], p.dy[1]));
        if (ry < 100) ry = 100 + Math.round(R() * 6);
        if (ry > 150) ry = 150 - Math.round(R() * 6);
      }
      anchors.push({ x: x, y: ry - L, L: L, k: 0, cp: (i % p.cpEvery) === 0 });
    }
    var last = anchors[anchors.length - 1];
    var gx = last.x + Math.round(rr(R, p.dx[0], p.dx[1]));
    var gy = last.y + last.L + Math.round(rr(R, p.dy[0], p.dy[1]) * 0.5);
    var maxY = 0;
    anchors.forEach(function (a) { if (a.y + a.L > maxY) maxY = a.y + a.L; });
    return {
      id: p.id, name: p.name, area: p.area || 1, seed: p.seed,
      anchors: anchors, goal: { x: gx, y: gy },
      killY: maxY + 130, minX: -60, maxX: gx + 140, pickups: []
    };
  }

  /* يضع قطرات على مسار الحل الفعلي */
  function addPickups(lv, path) {
    var s = SIM.makeState(lv), pk = [];
    var ix = 0, k, pos;
    for (var i = 0; i < path.length; i++) {
      var act = path[i];
      /* نحرّك التمرجح لين لحظة الترك */
      for (var q = 0; q < act.rel; q++) SIM.step(lv, s, true);
      var gapSteps = Math.round(act.gap / SIM.DT);
      var flightPts = [];
      SIM.step(lv, s, false);
      var n = 0;
      for (var f = 0; f < 600; f++) {
        SIM.step(lv, s, f >= gapSteps);
        if (f % 4 === 0) flightPts.push([s.x, s.y]);
        if (s.mode === SIM.HANG || s.won || s.dead) break;
      }
      if (flightPts.length > 6) {
        var a = flightPts[Math.floor(flightPts.length * 0.38)], b = flightPts[Math.floor(flightPts.length * 0.68)];
        pk.push({ x: Math.round(a[0]), y: Math.round(a[1]) - 4, t: 0 });
        if (i % 2 === 1) pk.push({ x: Math.round(b[0]), y: Math.round(b[1]) - 4, t: 1 });
        else pk.push({ x: Math.round(b[0]), y: Math.round(b[1]) - 4, t: 0 });
      }
    }
    lv.pickups = pk;
  }

  /* تعريف مراحل المنطقة ١ (البذور مثبّتة بعد التحقق) */
  var DEFS = [
    { id: 1, name: 'first', seed: 1, n: 6, dx: [56, 64], dy: [-6, 8], L: [40, 44], cpEvery: 3 },
    { id: 2, name: 'rise', seed: 1, n: 8, dx: [58, 70], dy: [-14, 12], L: [38, 46], cpEvery: 4 },
    { id: 3, name: 'long', seed: 2, n: 9, dx: [62, 78], dy: [-18, 14], L: [38, 48], cpEvery: 4 },
    { id: 4, name: 'zigzag', seed: 1, n: 10, dx: [64, 84], dy: [-22, 18], L: [36, 50], cpEvery: 4 }
  ];

  var cache = {};
  function build(def) {
    var lv = chain(def);
    if (typeof SOLVER !== 'undefined') {
      var r = SOLVER.seqPath(lv, {});
      if (r.ok) addPickups(lv, r.path);
    }
    return lv;
  }
  function get(i) {
    if (!cache[i]) cache[i] = build(DEFS[i]);
    return cache[i];
  }
  return { DEFS: DEFS, chain: chain, build: build, get: get, count: function () { return DEFS.length; }, addPickups: addPickups, rng: rng };
})();
