'use strict';
/* بناء المراحل: توليد حتمي من بذرة + معاملات، والتحقق بالحلّال */
var LEVELS = (function () {
  var TAU = Math.PI * 2;
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
  function r2(v) { return Math.round(v * 100) / 100; }

  /* مولّد عام: سلسلة حلقات + ميزات حسب المنطقة */
  function gen(p) {
    var R = rng(p.seed), anchors = [], leaves = [], drafts = [], i, bits = 0;
    var yr = p.yr || [100, 150];
    var x = 40, ry = 120, prevRy = 120;
    var mvAny = false;
    for (i = 0; i < p.n; i++) {
      var L = Math.round(rr(R, p.L[0], p.L[1]));
      var draft = false;
      if (i > 0) {
        var gx = Math.round(rr(R, p.dx[0], p.dx[1]));
        var gy = Math.round(rr(R, p.dy[0], p.dy[1]));
        if (p.draft && R() < p.draft && i < p.n - 1) { draft = true; gy -= Math.round(rr(R, 36, 56)); }
        x += gx; prevRy = ry; ry += gy;
        if (ry < yr[0]) ry = yr[0] + Math.round(R() * 6);
        if (ry > yr[1]) ry = yr[1] - Math.round(R() * 6);
      }
      var a = { x: x, y: ry - L, L: L, k: 0, cp: (i % p.cpEvery) === 0 };
      if (i > 0 && !a.cp) {
        var q = R();
        if (p.brk && q < p.brk && bits < 28) { a.brk = true; a.bit = 1 << bits++; a.k = 2; }
        else if (p.fold && q < (p.brk || 0) + p.fold && bits < 28) { a.fold = r2(rr(R, p.foldT[0], p.foldT[1])); a.bit = 1 << bits++; a.k = 4; }
        else if (p.mv && q < (p.brk || 0) + (p.fold || 0) + p.mv) { a.mv = { A: Math.round(rr(R, p.mvA[0], p.mvA[1])), ph: r2(R() * TAU) }; a.k = 3; mvAny = true; }
      }
      if (i > 0) {
        var pa = anchors[i - 1];
        if (p.leaf && R() < p.leaf && leaves.length < 14) {
          leaves.push({ x: Math.round((pa.x + x) / 2 + rr(R, -6, 6)), y: Math.round(Math.max(pa.y + pa.L, ry) + rr(R, p.leafDy[0], p.leafDy[1])), w: Math.round(rr(R, 34, 44)) });
        }
        if (draft) drafts.push({ x: Math.round((pa.x + x) / 2), y: Math.round(Math.min(pa.y + pa.L, ry) - 80), w: 28, h: 150 });
      }
      anchors.push(a);
    }
    var last = anchors[anchors.length - 1];
    var gx2 = last.x + Math.round(rr(R, p.dx[0], p.dx[1]));
    var gy2 = last.y + last.L + Math.round(rr(R, p.dy[0], p.dy[1]) * 0.5);
    var maxY = 0;
    anchors.forEach(function (a2) { if (a2.y + a2.L > maxY) maxY = a2.y + a2.L; });
    leaves.forEach(function (l) { if (l.y > maxY) maxY = l.y; });
    return {
      id: p.id, name: p.name, area: p.area || 1, seed: p.seed,
      anchors: anchors, goal: { x: gx2, y: gy2 }, leaves: leaves, drafts: drafts,
      tper: p.tper || 3.2,
      killY: maxY + 120, minX: -60, maxX: gx2 + 140, pickups: []
    };
  }

  /* يضع قطرات على مسار الحل الفعلي */
  function addPickups(lv, path) {
    var s = SIM.makeState(lv), pk = [], lowY = 0;
    for (var i = 0; i < path.length; i++) {
      var act = path[i];
      for (var q = 0; q < act.rel; q++) SIM.step(lv, s, true);
      var gapSteps = Math.round(act.gap / SIM.DT);
      var pts = [];
      SIM.step(lv, s, false);
      for (var f = 0; f < 700; f++) {
        SIM.step(lv, s, f >= gapSteps);
        if (f % 4 === 0) pts.push([s.x, s.y]);
        if (s.y > lowY) lowY = s.y;
        if (s.mode === SIM.HANG || s.won || s.dead) break;
      }
      if (pts.length > 6) {
        var a = pts[Math.floor(pts.length * 0.3)], b = pts[Math.floor(pts.length * 0.7)];
        pk.push({ x: Math.round(a[0]), y: Math.round(a[1]) - 4, t: 0 });
        pk.push({ x: Math.round(b[0]), y: Math.round(b[1]) - 4, t: (i % 2 === 1) ? 1 : 0 });
      }
    }
    lv.pickups = pk; lv.lowY = Math.round(lowY);
  }

  /* مواصفات المراحل (بدون بذور). lo = أدنى عرض نافذة ترك مقبول بالثواني */
  function A1(n, dx, dy, lo) { return { area: 1, n: n, dx: dx, dy: dy, L: [38, 46], cpEvery: 4, lo: lo }; }
  var SPECS = [
    { area: 1, n: 6, dx: [56, 64], dy: [-6, 8], L: [40, 44], cpEvery: 3, lo: 0.22 },
    { area: 1, n: 8, dx: [58, 70], dy: [-14, 12], L: [38, 46], cpEvery: 4, lo: 0.2 },
    { area: 1, n: 9, dx: [62, 78], dy: [-18, 14], L: [38, 48], cpEvery: 4, lo: 0.18 },
    { area: 1, n: 10, dx: [64, 84], dy: [-22, 18], L: [36, 50], cpEvery: 4, lo: 0.16 },
    /* منطقة ٢: أوراق نطّاطة */
    { area: 2, n: 6, dx: [62, 80], dy: [-12, 12], L: [38, 46], cpEvery: 3, leaf: 0.9, leafDy: [40, 62], lo: 0.2 },
    { area: 2, n: 8, dx: [66, 88], dy: [-14, 14], L: [38, 46], cpEvery: 4, leaf: 0.85, leafDy: [40, 64], lo: 0.17 },
    { area: 2, n: 9, dx: [70, 94], dy: [-16, 16], L: [36, 48], cpEvery: 4, leaf: 0.8, leafDy: [42, 66], lo: 0.15 },
    { area: 2, n: 11, dx: [72, 98], dy: [-18, 18], L: [36, 48], cpEvery: 4, leaf: 0.8, leafDy: [42, 66], lo: 0.14 },
    /* منطقة ٣: كروم تنقطع */
    { area: 3, n: 6, dx: [58, 72], dy: [-12, 12], L: [38, 46], cpEvery: 3, brk: 0.6, lo: 0.2 },
    { area: 3, n: 8, dx: [60, 78], dy: [-14, 14], L: [38, 46], cpEvery: 4, brk: 0.6, lo: 0.17 },
    { area: 3, n: 10, dx: [62, 82], dy: [-16, 16], L: [36, 48], cpEvery: 5, brk: 0.7, lo: 0.15 },
    { area: 3, n: 12, dx: [64, 86], dy: [-18, 18], L: [36, 48], cpEvery: 5, brk: 0.7, leaf: 0.3, leafDy: [44, 66], lo: 0.13 },
    /* منطقة ٤: تيارات ضباب الشلال */
    { area: 4, n: 6, dx: [60, 76], dy: [-10, 12], L: [38, 46], cpEvery: 3, draft: 0.5, yr: [70, 160], lo: 0.2 },
    { area: 4, n: 8, dx: [62, 80], dy: [-12, 14], L: [38, 46], cpEvery: 4, draft: 0.5, yr: [70, 160], lo: 0.17 },
    { area: 4, n: 10, dx: [62, 84], dy: [-14, 16], L: [36, 48], cpEvery: 4, draft: 0.5, yr: [70, 165], lo: 0.14 },
    { area: 4, n: 12, dx: [64, 86], dy: [-16, 16], L: [36, 48], cpEvery: 5, draft: 0.45, brk: 0.2, yr: [70, 165], lo: 0.12 },
    /* منطقة ٥: حلقات متحركة (طيور) */
    { area: 5, n: 6, dx: [58, 72], dy: [-12, 12], L: [38, 46], cpEvery: 3, mv: 0.5, mvA: [12, 20], tper: 3.2, lo: 0.2 },
    { area: 5, n: 8, dx: [60, 76], dy: [-14, 14], L: [38, 46], cpEvery: 4, mv: 0.55, mvA: [14, 22], tper: 3.0, lo: 0.16 },
    { area: 5, n: 10, dx: [62, 80], dy: [-16, 16], L: [36, 48], cpEvery: 4, mv: 0.6, mvA: [14, 24], tper: 2.8, lo: 0.13 },
    { area: 5, n: 12, dx: [62, 84], dy: [-16, 16], L: [36, 48], cpEvery: 5, mv: 0.5, brk: 0.15, mvA: [14, 24], tper: 2.8, lo: 0.11 },
    /* منطقة ٦: أغصان تنطوي */
    { area: 6, n: 6, dx: [58, 74], dy: [-12, 12], L: [38, 46], cpEvery: 3, fold: 0.5, foldT: [1.2, 1.6], lo: 0.18 },
    { area: 6, n: 8, dx: [60, 78], dy: [-14, 14], L: [38, 46], cpEvery: 4, fold: 0.55, foldT: [1.1, 1.5], lo: 0.15 },
    { area: 6, n: 10, dx: [62, 82], dy: [-16, 16], L: [36, 48], cpEvery: 4, fold: 0.55, foldT: [1.0, 1.4], lo: 0.12 },
    { area: 6, n: 12, dx: [62, 86], dy: [-16, 16], L: [36, 48], cpEvery: 5, fold: 0.4, brk: 0.15, leaf: 0.25, leafDy: [44, 66], foldT: [1.0, 1.4], lo: 0.1 }
  ];
  /* بذور مثبّتة بعد التحقق (tools/find-seeds.js) */
  var SEEDS = [1, 1, 1, 4, 5, 10, 8, 4, 1, 1, 3, 1, 1, 1, 1, 2, 1, 4, 19, 30, 3, 8, 3, 12];

  function specFor(i) {
    var sp = {};
    for (var k in SPECS[i]) sp[k] = SPECS[i][k];
    var g = i / (SPECS.length - 1), within = i % 4;
    sp.hi = Math.round((0.36 - 0.22 * g + (within === 0 ? 0.04 : 0)) * 100) / 100;
    sp.lo = Math.max(0.07, Math.round((sp.hi - 0.09) * 100) / 100);
    sp.id = i + 1; sp.name = 'a' + sp.area + 'l' + (i + 1); sp.seed = SEEDS[i] || 1;
    return sp;
  }

  /* مسار حل متسلسل (مع نتيجة التحقق) */
  function solveLevel(lv) {
    return SOLVER.seqPath(lv, {});
  }
  /* يبني ويحلّ؛ يرجّع المستوى مع lv.minW و lv.ok */
  function finish(lv) {
    var r = (typeof SOLVER !== 'undefined') ? solveLevel(lv) : null;
    lv.ok = !!(r && r.ok);
    lv.minW = r && r.ok ? r.minWidth : 0;
    if (r && r.ok) addPickups(lv, r.path);
    return lv;
  }
  function build(def) { return finish(gen(def)); }

  var cache = {};
  function get(i) {
    if (!cache[i]) cache[i] = build(specFor(i));
    return cache[i];
  }

  /* ---------- مسارات لا نهائية: تخلط كل القواعد، وتصعب تدريجيًا ---------- */
  function endlessSpec(k, attempt) {
    var h = rng(k * 7919 + 13 + attempt * 104729);
    var d = Math.min(1, k / 40);          /* صعوبة */
    var n = 8 + Math.floor(h() * 4) + Math.floor(d * 3);
    var p = {
      area: 7, n: n, dx: [60 + Math.round(d * 4), 80 + Math.round(d * 8)], dy: [-16, 16], L: [36, 48],
      cpEvery: d > 0.6 ? 5 : 4, yr: [70, 165], tper: 2.8 + h() * 0.6, mvA: [12, 24], foldT: [1.0, 1.5], leafDy: [42, 66],
      lo: 0.2 - 0.09 * d
    };
    /* نختار ٣-٤ قواعد من الخمس لكل مسار */
    var rules = ['leaf', 'brk', 'draft', 'mv', 'fold'];
    for (var i = rules.length - 1; i > 0; i--) { var j = Math.floor(h() * (i + 1)); var t = rules[i]; rules[i] = rules[j]; rules[j] = t; }
    var cnt = 2 + Math.floor(h() * 2) + (d > 0.5 ? 1 : 0);
    for (i = 0; i < cnt; i++) {
      var r = rules[i];
      p[r] = r === 'leaf' ? 0.6 : (r === 'draft' ? 0.4 : (r === 'brk' ? 0.35 : (r === 'mv' ? 0.35 : 0.3)));
    }
    var sum = (p.brk || 0) + (p.fold || 0) + (p.mv || 0);
    if (sum > 0.9) { var sc = 0.9 / sum; if (p.brk) p.brk *= sc; if (p.fold) p.fold *= sc; if (p.mv) p.mv *= sc; }
    p.id = 1000 + k; p.name = 'e' + k; p.seed = 1 + k * 977 + attempt * 31;
    return p;
  }
  /* يرجّع أول محاولة تنجح (مع القدرات المطلوبة) */
  function endless(k, modsList, maxAttempts) {
    var saved = SIM.getMods();
    maxAttempts = maxAttempts || 40;
    for (var at = 0; at < maxAttempts; at++) {
      var sp = endlessSpec(k, at);
      var lv, ok = true, mi;
      SIM.setMods({});
      lv = finish(gen(sp));
      if (!lv.ok || lv.minW < sp.lo) continue;
      for (mi = 0; mi < (modsList || []).length && ok; mi++) {
        SIM.setMods(modsList[mi]);
        var r2_ = SOLVER.seqPath(lv, {});
        if (!r2_.ok) ok = false;
      }
      SIM.setMods(saved);
      if (ok) { lv.attempt = at; return lv; }
    }
    SIM.setMods(saved);
    return null;
  }

  return {
    SPECS: SPECS, SEEDS: SEEDS, gen: gen, build: build, finish: finish, get: get, specFor: specFor,
    count: function () { return SPECS.length; }, addPickups: addPickups, rng: rng, endless: endless, endlessSpec: endlessSpec
  };
})();
