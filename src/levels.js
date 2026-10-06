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

  /* مواصفات المراحل (بدون بذور): ٦ مناطق × ٤ مراحل، الطول والصعوبة يزيدان تدريجيًا */
  function makeSpecs() {
    var out = [], a, w;
    for (a = 1; a <= 6; a++) {
      for (w = 0; w < 4; w++) {
        var i = (a - 1) * 4 + w;
        var sp = {
          area: a, n: Math.round(8 + i * 1.15), dx: [60 + 3 * w, 78 + 4 * w + (a > 1 ? 4 : 0)], dy: [-16 - 2 * w, 16 + 2 * w], L: [36, 48],
          cpEvery: 4 + (a >= 3 ? 1 : 0) + (a >= 5 ? 1 : 0)
        };
        if (a === 2) { sp.leaf = [0.9, 0.85, 0.8, 0.8][w]; sp.leafDy = [40, 64]; }
        if (a === 3) { sp.brk = [0.45, 0.55, 0.6, 0.7][w]; if (w === 3) { sp.leaf = 0.25; sp.leafDy = [44, 66]; } }
        if (a === 4) { sp.draft = [0.45, 0.45, 0.5, 0.5][w]; sp.yr = [70, 165]; if (w === 3) sp.brk = 0.15; }
        if (a === 5) { sp.mv = [0.5, 0.4, 0.34, 0.3][w]; if (w === 3) sp.n = 20; if (w === 2) sp.n = 22; sp.mvA = w ? [10, 17] : [14, 22]; sp.tper = [3.2, 3.0, 2.8, 2.6][w]; if (w === 3) sp.brk = 0.1; }
        if (a === 6) { sp.fold = [0.45, 0.5, 0.55, 0.55][w]; sp.foldT = [[1.2, 1.6], [1.1, 1.5], [1.0, 1.4], [0.95, 1.3]][w]; if (w >= 2) sp.brk = 0.1; }
        out.push(sp);
      }
    }
    return out;
  }
  var SPECS = makeSpecs();
  /* بذور مثبّتة بعد التحقق (tools/find-seeds.js) */
  var SEEDS = [5,1,27,14,3,6,9,9,2,5,2,17,9,4,24,3,9,103,46,640,66,90,881,783];

  function specFor(i) {
    var sp = {};
    for (var k in SPECS[i]) sp[k] = SPECS[i][k];
    var g = i / (SPECS.length - 1), within = i % 4;
    sp.hi = Math.round((0.24 - 0.15 * g + (within === 0 ? 0.03 : 0)) * 100) / 100;
    sp.lo = Math.max(0.05, Math.round((sp.hi - 0.06) * 100) / 100);
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
    if (!cache[i]) {
      if (typeof CORE_DATA !== 'undefined' && CORE_DATA[i]) cache[i] = CORE_DATA[i];
      else { var sv = SIM.getMods(); SIM.setMods({}); cache[i] = build(specFor(i)); SIM.setMods(sv); }
    }
    return cache[i];
  }

  /* نسخة النجمة p من المرحلة i: أطول وأصعب، تتولد وتتحقق (بالخيط الخلفي) */
  function starLevel(i, p, modsList, maxAttempts) {
    var saved = SIM.getMods();
    maxAttempts = maxAttempts || 60;
    for (var at = 0; at < maxAttempts; at++) {
      var sp = specFor(i);
      sp.seed = 7000 + i * 131 + p * 977 + at * 31; sp.n += (at < 24 ? 3 : 1) * p;
      sp.hi = Math.max(0.08, sp.hi - 0.015 * p) + (at >= 24 ? 0.05 : 0); sp.lo = at >= 24 ? 0.05 : Math.max(0.05, sp.lo - 0.015 * p);
      sp.id = 3000 + p * 100 + i; sp.name = 's' + p + 'l' + i;
      SIM.setMods({});
      var lv = finish(gen(sp));
      if (!lv.ok || lv.minW < sp.lo || lv.minW > sp.hi) continue;
      var ok = true;
      for (var mi = 0; mi < (modsList || []).length && ok; mi++) {
        SIM.setMods(modsList[mi]);
        if (!SOLVER.seqPath(lv, {}).ok) ok = false;
      }
      SIM.setMods(saved);
      if (ok) { lv.attempt = at; return lv; }
    }
    SIM.setMods(saved);
    return null;
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
    count: function () { return SPECS.length; }, addPickups: addPickups, rng: rng, endless: endless, starLevel: starLevel, endlessSpec: endlessSpec
  };
})();
