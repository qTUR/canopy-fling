'use strict';
/* يبحث لكل مرحلة عن أول بذرة تحقق: قابلة للحل، نافذة ترك مقبولة، تنجح مع كل القدرات، وتنجح من كل نقطة حفظ */
var ctx = require('./lib')();
var SIM = ctx.SIM, SOLVER = ctx.SOLVER, LEVELS = ctx.LEVELS;
var MODS = [];
[0, 3, 6, 9].forEach(function (dl) { [1, 1.12, 1.24, 1.36].forEach(function (pm) { MODS.push({ dL: dl, pump: pm, rescue: (dl + (pm > 1.2 ? 1 : 0)) % 3 }); }); });

function checkAll(lv) {
  var i, m;
  for (m = 0; m < MODS.length; m++) {
    SIM.setMods(MODS[m]);
    var r = SOLVER.seqPath(lv, {});
    if (!r.ok) { SIM.setMods({}); return 'mods' + m; }
  }
  SIM.setMods({});
  /* من كل نقطة حفظ، بأطوار مختلفة للحلقات المتحركة */
  for (i = 1; i < lv.anchors.length; i++) {
    if (!lv.anchors[i].cp) continue;
    var ph = lv.anchors.some(function (a) { return a.mv; }) ? [0, 0.4, 0.7, 1.1, 1.6, 2.0, 2.4, 2.8] : [0];
    for (var q = 0; q < ph.length; q++) {
      var r2 = SOLVER.seqPath(lv, {}, i, ph[q]);
      if (!r2.ok) return 'cp' + i + '@' + ph[q];
    }
  }
  return null;
}

var from = +(process.argv[2] || 0), to = +(process.argv[3] || LEVELS.count() - 1), maxSeed = +(process.argv[4] || 400);
var out = {};
for (var i = from; i <= to; i++) {
  var found = 0, why = {};
  for (var seed = +(process.argv[5] || 1); seed <= maxSeed && !found; seed++) {
    var sp = LEVELS.specFor(i); sp.seed = seed;
    var lv = LEVELS.gen(sp);
    var r = SOLVER.seqPath(lv, {});
    if (!r.ok) { why.base = (why.base || 0) + 1; continue; }
    if (r.minWidth < sp.lo || r.minWidth > sp.hi) { why.narrow = (why.narrow || 0) + 1; continue; }
    var bad = checkAll(lv);
    if (bad) { why[bad.replace(/\d+.*/, '')] = (why[bad.replace(/\d+.*/, '')] || 0) + 1; continue; }
    found = seed; out[i] = seed;
    console.log('level ' + (i + 1) + ' seed ' + seed + ' minW ' + Math.round(r.minWidth * 1000) + 'ms anchors ' + lv.anchors.length + ' leaves ' + lv.leaves.length);
  }
  if (!found) console.log('level ' + (i + 1) + ' NOT FOUND ' + JSON.stringify(why));
}
console.log('SEEDS_JSON ' + JSON.stringify(out));
