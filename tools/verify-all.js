'use strict';
/* فحص شامل: قابلية الحل، القدرات، نقاط الحفظ، عدم العلوق (لاعب عشوائي)، ومسارات لا نهائية */
var ctx = require('./lib')();
var SIM = ctx.SIM, SOLVER = ctx.SOLVER, LEVELS = ctx.LEVELS;
var mode = process.argv[2] || 'core';
var fails = 0;
function fail(m) { fails++; console.log('FAIL ' + m); }

var MODS = [];
[0, 3, 6, 9].forEach(function (dl) { [1, 1.12, 1.24, 1.36].forEach(function (pm) { MODS.push({ dL: dl, pump: pm, rescue: (dl + (pm > 1.2 ? 1 : 0)) % 3 }); }); });

function rnd(seed) { return LEVELS.rng(seed); }
/* لاعب عشوائي: يتأكد إن الحالة ما تعلق للأبد */
function stuckTest(lv, seed, seconds) {
  var R = rnd(seed), s = SIM.makeState(lv), held = false, until = 0, lastEv = 0, wins = 0, deaths = 0, maxGap = 0;
  var total = Math.round(seconds / SIM.DT), ev = [];
  for (var i = 0; i < total; i++) {
    if (i >= until) { held = !held; until = i + Math.round((held ? 0.1 + R() * 1.6 : 0.03 + R() * 0.6) / SIM.DT); }
    ev.length = 0;
    SIM.step(lv, s, held, ev);
    if (ev.length) { lastEv = i; }
    if (i - lastEv > maxGap) maxGap = i - lastEv;
    if (s.won) { wins++; SIM.spawnAt(lv, 0, s); s.resc = 0; lastEv = i; }
    else if (s.dead) { deaths++; SIM.respawn(lv, s); lastEv = i; held = false; }
  }
  return { wins: wins, deaths: deaths, maxGap: maxGap * SIM.DT };
}

function coreLevel(i) {
  var lv = LEVELS.get(i), t0 = Date.now();
  var tag = 'L' + (i + 1) + ' a' + lv.area;
  if (!lv.ok) { fail(tag + ' unsolvable'); return; }
  var base = SOLVER.seqPath(lv, {});
  /* قدرات */
  for (var m = 0; m < MODS.length; m++) {
    SIM.setMods(MODS[m]);
    if (!SOLVER.seqPath(lv, {}).ok) fail(tag + ' mods ' + JSON.stringify(MODS[m]));
  }
  SIM.setMods({});
  /* نقاط الحفظ بأطوار مختلفة */
  var mv = lv.anchors.some(function (a) { return a.mv; });
  for (var k = 1; k < lv.anchors.length; k++) {
    if (!lv.anchors[k].cp) continue;
    (mv ? [0, 0.7, 1.4, 2.1, 2.8] : [0]).forEach(function (ph) { if (!SOLVER.seqPath(lv, {}, k, ph).ok) fail(tag + ' cp' + k + ' ph' + ph); });
  }
  /* لاعب عشوائي */
  var worst = 0;
  for (var sd = 1; sd <= 4; sd++) { var r = stuckTest(lv, sd * 17 + i, 240); if (r.maxGap > worst) worst = r.maxGap; }
  if (worst > 45) fail(tag + ' stuck gap ' + worst.toFixed(1) + 's');
  console.log(tag + ' ok minW ' + Math.round(base.minWidth * 1000) + 'ms anchors ' + lv.anchors.length + ' leaves ' + lv.leaves.length + ' drafts ' + lv.drafts.length + ' special ' + lv.anchors.filter(function (a) { return a.k >= 2; }).length + ' maxGap ' + worst.toFixed(1) + 's ' + (Date.now() - t0) + 'ms');
}

if (mode === 'core') {
  for (var i = 0; i < LEVELS.count(); i++) coreLevel(i);
} else if (mode === 'endless') {
  var from = +(process.argv[3] || 0), to = +(process.argv[4] || 299);
  var extremes = [{ dL: 0, pump: 1 }, { dL: 9, pump: 1.36 }, { dL: 9, pump: 1 }, { dL: 0, pump: 1.36 }];
  var maxAt = 0, t0 = Date.now(), cnt = 0, rules = {};
  for (var k = from; k <= to; k++) {
    var lv = LEVELS.endless(k, extremes, 60);
    if (!lv) { fail('endless ' + k + ' no verified path'); continue; }
    cnt++; if (lv.attempt > maxAt) maxAt = lv.attempt;
    var r = stuckTest(lv, k + 5, 120);
    if (r.maxGap > 45) fail('endless ' + k + ' stuck ' + r.maxGap.toFixed(1));
    if (k % 25 === 0) console.log('endless ' + k + ' ok attempts ' + (lv.attempt + 1) + ' minW ' + Math.round(lv.minW * 1000) + ' n ' + lv.anchors.length + ' ' + (Date.now() - t0) + 'ms');
  }
  console.log('endless verified ' + cnt + ' maxAttempt ' + (maxAt + 1));
}
console.log(fails ? 'FAILS ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
