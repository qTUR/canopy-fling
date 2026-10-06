'use strict';
/* يدوّر على بذور تعطي مراحل متسلسلة محلولة بنوافذ ترك ضمن مجال الصعوبة */
var fs = require('fs'), vm = require('vm'), path = require('path');
var root = path.join(__dirname, '..', 'src');
var ctx = { console: console, Math: Math };
vm.createContext(ctx);
[['sim.js', 'SIM'], ['solver.js', 'SOLVER'], ['levels.js', 'LEVELS']].forEach(function (p) {
  vm.runInContext(fs.readFileSync(path.join(root, p[0]), 'utf8') + '\n;this.' + p[1] + '=' + p[1] + ';', ctx);
});
var LEVELS = ctx.LEVELS, SOLVER = ctx.SOLVER;

var targets = JSON.parse(process.argv[2]);   /* [{id, n, dx, dy, L, cpEvery, lo, hi}] */
targets.forEach(function (t) {
  var found = null, tried = 0;
  for (var seed = t.from || 1; seed < (t.from || 1) + 400 && !found; seed++) {
    var lv = LEVELS.chain({ id: t.id, name: 'x', seed: seed, n: t.n, dx: t.dx, dy: t.dy, L: t.L, cpEvery: t.cpEvery });
    var r = SOLVER.seqPath(lv, {});
    tried++;
    if (r.ok && r.minWidth >= t.lo && r.minWidth <= t.hi) found = { seed: seed, minW: Math.round(r.minWidth * 1000), widths: r.widths.map(function (w) { return Math.round(w * 1000); }) };
  }
  console.log('مرحلة', t.id, found ? JSON.stringify(found) : 'ما لقيت (' + tried + ')');
});
