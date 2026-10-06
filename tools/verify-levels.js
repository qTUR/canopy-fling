'use strict';
/* يتحقق من المراحل بالحلّال: يحمّل ملفات المصدر نفسها ويفحص كل مرحلة */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var root = path.join(__dirname, '..', 'src');
var ctx = { console: console, Math: Math };
vm.createContext(ctx);
['sim.js', 'solver.js', 'levels.js'].forEach(function (f) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8') + '\n;this.' + ({ 'sim.js': 'SIM', 'solver.js': 'SOLVER', 'levels.js': 'LEVELS' })[f] + '=' + ({ 'sim.js': 'SIM', 'solver.js': 'SOLVER', 'levels.js': 'LEVELS' })[f] + ';', ctx);
});
var SIM = ctx.SIM, SOLVER = ctx.SOLVER, LEVELS = ctx.LEVELS;

var only = process.argv[2] ? +process.argv[2] : null;
var fails = 0;
for (var i = 0; i < LEVELS.count(); i++) {
  if (only !== null && only !== i) continue;
  var lv = LEVELS.get(i);
  var t0 = Date.now();
  var r = SOLVER.solve(lv, 0, {});
  var line = 'مرحلة ' + (i + 1) + ' (' + lv.anchors.length + ' حلقات): ' + (r.ok ? 'محلولة' : 'غير محلولة') + ' | عقد ' + r.expanded + '/' + r.seen + ' | ' + (Date.now() - t0) + 'ms';
  if (!r.ok) fails++;
  console.log(line);
  if (r.ok) {
    /* نافذة الترك لكل وصلة على مسار الحل */
    var s = SIM.makeState(lv), ws = [];
    for (var p = 0; p < r.path.length; p++) {
      var act = r.path[p];
      var hang = SIM.cloneState(s);
      var target = (p === r.path.length - 1) ? 'goal' : null;
      /* الهدف التالي: نحاكي لين نعرف الحلقة اللي نوصلها */
      var f = SOLVER.flight(lv, (function () { var c = SIM.cloneState(hang); for (var q = 0; q < act.rel; q++) SIM.step(lv, c, true); return c; })(), act.gap, { maxFlight: 2.4 });
      if (!target) target = f.s.ix;
      var w = SOLVER.window(lv, hang, target, { relStep: 1, maxHold: 3.2, gaps: [act.gap], maxFlight: 2.4 });
      ws.push(Math.round(w.width * 1000));
      /* ننقل الحالة لعند الوصول */
      s = f.s;
    }
    console.log('   نوافذ الترك (م.ث): ' + ws.join(', '));
  }
}
process.exit(fails ? 1 : 0);
