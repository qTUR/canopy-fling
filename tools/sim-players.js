'use strict';
/* محاكاة لاعبين (ضعيف / متوسط / قوي) بمنطق اللعبة نفسه: خطأ توقيت، وقت تفكير، إعادة محاولة */
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var ctx = require('./lib')();
var SIM = ctx.SIM, SOLVER = ctx.SOLVER, LEVELS = ctx.LEVELS;

var PROFILES = {
  weak:   { sigma: 0.11, think: 1.6, pressLag: 0.12, retryPause: 1.5 },
  medium: { sigma: 0.07, think: 0.8, pressLag: 0.07, retryPause: 1.0 },
  strong: { sigma: 0.035, think: 0.35, pressLag: 0.03, retryPause: 0.6 }
};
var DT = SIM.DT;
var ALLM = [];
[0, 3, 6, 9].forEach(function (dl) { [1, 1.12, 1.24, 1.36].forEach(function (pm) { ALLM.push({ dL: dl, pump: pm, rescue: (dl + (pm > 1.2 ? 1 : 0)) % 3 }); }); });
var OPT = { relStep: 2, maxHold: 3.2, gaps: [0], maxFlight: 2.4 };
var AB = { rope: [20, 50, 120], swing: [20, 60, 140], magnet: [15, 40, 100], rescue: [60, 160] };

function gauss(R) { var u = 1 - R(), v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2831853 * v); }

function playLevel(lv, prof, R, ab, pr) {
  var s = SIM.makeState(lv), n = lv.anchors.length, time = 0, deaths = 0, picked = {}, got = 0, decisions = 0, stuck = false;
  var mr = 14 + 9 * ab.magnet, gain = 1 + 0.25 * pr;
  function collect() {
    for (var p = 0; p < lv.pickups.length; p++) {
      if (picked[p]) continue;
      var pk = lv.pickups[p], dx = s.x - pk.x, dy = (s.y + 6) - pk.y;
      if (dx * dx + dy * dy < mr * mr) { picked[p] = 1; got += Math.round((pk.t ? 3 : 1) * gain); }
    }
  }
  while (decisions < 600) {
    decisions++;
    var target = (s.ix + 1 < n) ? s.ix + 1 : 'goal';
    var w = SOLVER.winRange(lv, s, target, OPT), rel;
    if (w.any) {
      var mid = (w.from + w.to) / 2, err = gauss(R) * prof.sigma / DT;
      rel = Math.max(0, Math.round(mid + err));
    } else rel = Math.round(R() * 2.5 / DT);
    time += prof.think * (0.6 + 0.8 * R());
    for (var q = 0; q < rel && s.mode === SIM.HANG; q++) { SIM.step(lv, s, true); collect(); }
    time += rel * DT;
    if (s.mode === SIM.HANG) SIM.step(lv, s, false);
    var lag = Math.round(Math.abs(gauss(R)) * prof.pressLag / DT), f = 0;
    while (f < 1500) {
      SIM.step(lv, s, f >= lag); collect(); f++;
      if (s.won || s.dead || s.mode === SIM.HANG) break;
    }
    time += f * DT;
    if (s.won) return { time: time + 10, deaths: deaths, drops: got, stuck: false };
    if (s.dead || f >= 1500) {
      deaths++; time += 0.55 + prof.retryPause; SIM.respawn(lv, s);
      if (deaths > 80) { stuck = true; break; }
    }
  }
  return { time: time, deaths: deaths, drops: got, stuck: true };
}

function modsOf(ab) { return { dL: 3 * ab.rope, pump: 1 + 0.12 * ab.swing, rescue: ab.rescue }; }
function shop(ab, drops) {
  var order = ['rope', 'swing', 'magnet', 'rescue'], bought = true;
  while (bought) {
    bought = false;
    for (var i = 0; i < order.length; i++) {
      var k = order[i], t = ab[k];
      if (t < AB[k].length && drops >= AB[k][t]) { drops -= AB[k][t]; ab[k]++; bought = true; break; }
    }
  }
  return drops;
}

var MEMO = {};
function run(profName, seed, endlessCount, stars) {
  stars = stars || 0;
  var prof = PROFILES[profName], R = LEVELS.rng(seed), ab = { rope: 0, swing: 0, magnet: 0, rescue: 0 }, drops = 0, areaT = {}, areaD = {}, flags = [];
  var total = 0, i, lv, pass;
  var plan = [];
  for (pass = 0; pass <= stars; pass++) for (i = 0; i < 24; i++) plan.push({ i: i, p: pass });
  for (i = 0; i < endlessCount; i++) plan.push({ i: 24 + i, p: stars });
  plan.forEach(function (st) {
    SIM.setMods({});
    var key = st.i + ':' + st.p;
    if (!MEMO[key]) MEMO[key] = st.i >= 24 ? LEVELS.endless(st.i - 24, ALLM, 60) : (st.p > 0 ? LEVELS.starLevel(st.i, st.p, ALLM, 60) : LEVELS.get(st.i));
    lv = MEMO[key];
    SIM.setMods(modsOf(ab));
    if (!lv || !lv.ok) { flags.push('level ' + (st.i + 1) + '/' + st.p + ' missing'); return; }
    var r = playLevel(lv, prof, R, ab, st.p);
    drops += r.drops + 5; total += r.time;
    drops = shop(ab, drops);
    var a = st.i >= 24 ? 'endless' : (st.p > 0 ? 'star' + st.p : 'a' + lv.area);
    areaT[a] = (areaT[a] || 0) + r.time; areaD[a] = (areaD[a] || 0) + r.deaths;
    if (r.stuck) flags.push('STUCK level ' + (st.i + 1) + '/' + st.p);
  });
  SIM.setMods({});
  return { total: total, areaT: areaT, areaD: areaD, flags: flags, ab: ab };
}

module.exports = { run: run, PROFILES: PROFILES };
if (require.main === module) {
  var endlessN = +(process.argv[2] || 0), runs = +(process.argv[3] || 3), STARS = +(process.argv[4] || 0);
  var hash = crypto.createHash('sha1');
  ['sim.js', 'solver.js', 'levels.js'].forEach(function (f) { hash.update(fs.readFileSync(path.join(__dirname, '..', 'src', f))); }); hash.update(fs.readFileSync(__filename));
  var h = hash.digest('hex').slice(0, 10);
  var cdir = process.env.SIM_CACHE || path.join(__dirname, '..', '..', 'sim-cache');
  fs.mkdirSync(cdir, { recursive: true });
  var cf = path.join(cdir, 'sim_' + h + '_' + endlessN + '_' + runs + '_' + STARS + '.json');
  var res;
  if (fs.existsSync(cf)) { res = JSON.parse(fs.readFileSync(cf, 'utf8')); console.log('(cache)'); }
  else {
    res = {};
    Object.keys(PROFILES).forEach(function (p) {
      var acc = null;
      for (var k = 0; k < runs; k++) {
        var r = run(p, 100 + k, endlessN, STARS);
        if (!acc) acc = { total: 0, areaT: {}, areaD: {}, flags: [] };
        acc.total += r.total / runs;
        Object.keys(r.areaT).forEach(function (a) { acc.areaT[a] = (acc.areaT[a] || 0) + r.areaT[a] / runs; acc.areaD[a] = (acc.areaD[a] || 0) + r.areaD[a] / runs; });
        r.flags.forEach(function (f) { if (acc.flags.indexOf(f) < 0) acc.flags.push(f); });
      }
      res[p] = acc;
    });
    fs.writeFileSync(cf, JSON.stringify(res));
  }
  Object.keys(res).forEach(function (p) {
    var r = res[p];
    console.log(p + ': total ' + (r.total / 60).toFixed(1) + ' min | ' + Object.keys(r.areaT).map(function (a) { return a + ' ' + (r.areaT[a] / 60).toFixed(1) + 'm/' + r.areaD[a].toFixed(0) + 'd'; }).join(', ') + (r.flags.length ? ' | FLAGS ' + r.flags.join(';') : ''));
  });
}
