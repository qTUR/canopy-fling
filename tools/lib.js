'use strict';
/* يحمّل ملفات المصدر نفسها داخل سياق معزول للتحقق */
var fs = require('fs');
var path = require('path');
var vm = require('vm');
module.exports = function () {
  var root = path.join(__dirname, '..', 'src');
  var ctx = { console: console, Math: Math };
  vm.createContext(ctx);
  var map = { 'sim.js': 'SIM', 'solver.js': 'SOLVER', 'levels.js': 'LEVELS' };
  Object.keys(map).forEach(function (f) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8') + '\n;this.' + map[f] + '=' + map[f] + ';', ctx);
  });
  return ctx;
};
