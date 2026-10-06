'use strict';
/* الحلّال: يستخدم نفس فيزياء SIM بالضبط. يبحث عن توقيتات الترك اللي توصّل للهدف */
var SOLVER = (function () {
  var DT = SIM.DT;

  function qkey(s, tper) {
    return s.ix + ':' + Math.round(s.th * 8) + ':' + Math.round(s.om * 3) + ':' + s.cut + ':' + s.lcut + ':' + (tper ? Math.round((s.t % tper) * 6) : 0);
  }

  /* من حالة تعليق: يجرّب الترك كل relStep خطوة، وبعدها مسك متأخر بفجوات مختلفة */
  function releases(lv, hang, opt, cb) {
    var relStep = opt.relStep, maxHold = opt.maxHold, gaps = opt.gaps;
    var sw = SIM.cloneState(hang);
    var maxSteps = Math.round(maxHold / DT);
    for (var st = 0; st <= maxSteps; st++) {
      if (sw.mode !== SIM.HANG) break;
      if (st % relStep === 0) {
        for (var gi = 0; gi < gaps.length; gi++) {
          var res = flight(lv, sw, gaps[gi], opt);
          cb(st, gaps[gi], res);
        }
      }
      SIM.step(lv, sw, true);
    }
  }

  /* يترك ثم يطير. النتيجة: {k:'arrive'|'win'|'dead'|'timeout', s:state} */
  function flight(lv, hang, gap, opt) {
    var f = SIM.cloneState(hang);
    SIM.step(lv, f, false);              /* ترك */
    var gapSteps = Math.round(gap / DT);
    var maxFlight = Math.round(opt.maxFlight / DT);
    for (var i = 0; i < maxFlight; i++) {
      SIM.step(lv, f, i >= gapSteps);
      if (f.won) return { k: 'win', s: f };
      if (f.dead) return { k: 'dead', s: f };
      if (f.mode === SIM.HANG) return { k: 'arrive', s: f };
    }
    return { k: 'timeout', s: f };
  }

  var DEF = { relStep: 8, maxHold: 3.2, gaps: [0, 0.12], maxFlight: 2.4, maxNodes: 600 };
  function opts(o) {
    var r = {};
    for (var k in DEF) r[k] = (o && o[k] !== undefined) ? o[k] : DEF[k];
    return r;
  }

  /* بحث: هل في طريق من الحلقة start للهدف؟ يرجّع المسار */
  function solve(lv, startAi, o) {
    var opt = opts(o);
    var start = SIM.spawnAt(lv, startAi || 0, { t: 0 });
    var nodes = [{ s: start, par: -1, act: null }];
    var seen = {}; seen[qkey(start, lv.tper)] = 1;
    var open = [0], expanded = 0, winNode = -1, winAct = null;
    while (open.length && expanded < opt.maxNodes && winNode < 0) {
      /* نختار الأبعد تقدّمًا */
      var bi = 0, bs = -1;
      for (var q = 0; q < open.length; q++) {
        var sc = nodes[open[q]].s.ix * 1000 - nodes[open[q]].depth * 0 + nodes[open[q]].s.x;
        if (sc > bs) { bs = sc; bi = q; }
      }
      var ni = open.splice(bi, 1)[0];
      var node = nodes[ni];
      expanded++;
      var hang = node.s;
      releases(lv, hang, opt, function (st, gap, res) {
        if (winNode >= 0) return;
        if (res.k === 'win') { winNode = ni; winAct = { rel: st, gap: gap }; return; }
        if (res.k !== 'arrive') return;
        var key = qkey(res.s, lv.tper);
        if (seen[key]) return;
        seen[key] = 1;
        nodes.push({ s: res.s, par: ni, act: { rel: st, gap: gap, from: hang.ix }, depth: (node.depth || 0) + 1 });
        open.push(nodes.length - 1);
      });
    }
    if (winNode < 0) return { ok: false, expanded: expanded, seen: nodes.length };
    var path = [winAct], cur = winNode;
    while (nodes[cur].par >= 0) { path.unshift(nodes[cur].act); cur = nodes[cur].par; }
    return { ok: true, path: path, expanded: expanded, seen: nodes.length };
  }

  /* نافذة الترك: من حالة تعليق، كم خطوة ترك تنجح في الوصول للحلقة target (أو الهدف) */
  function winRange(lv, hang, target, o) {
    var opt = opts(o);
    opt.relStep = (o && o.relStep) || 1;
    var good = [], gapsOK = {};
    var sw = SIM.cloneState(hang);
    var maxSteps = Math.round(opt.maxHold / DT);
    for (var st = 0; st <= maxSteps; st += opt.relStep) {
      if (sw.mode !== SIM.HANG) break;
      var res = flight(lv, sw, opt.gaps[0], opt);
      var ok = (target === 'goal') ? res.k === 'win' : (res.k === 'arrive' && res.s.ix === target);
      if (ok) good.push(st);
      for (var q = 0; q < opt.relStep; q++) SIM.step(lv, sw, true);
    }
    /* أطول مقطع متصل */
    var best = [0, 0], run = null;
    for (var i = 0; i < good.length; i++) {
      if (run && good[i] - run[1] <= opt.relStep) run[1] = good[i];
      else { run = [good[i], good[i]]; }
      if (run[1] - run[0] > best[1] - best[0]) best = [run[0], run[1]];
    }
    return { count: good.length, from: best[0], to: best[1], width: (best[1] - best[0] + opt.relStep) * DT, any: good.length > 0 };
  }


  /* مسار متسلسل: من كل حلقة للي بعدها بنافذة ترك مركزية. يرجّع أضيق نافذة */
  function seqPath(lv, o, startIx, t0) {
    var opt = opts(o);
    opt.relStep = 2;
    var s = SIM.spawnAt(lv, startIx || 0, { t: t0 || 0 });
    var path = [], minW = 99, ws = [];
    var n = lv.anchors.length;
    for (var ti = (startIx || 0) + 1; ti <= n; ti++) {
      var target = ti < n ? ti : 'goal';
      var w = winRange(lv, s, target, opt);
      if (!w.any) return { ok: false, at: ti };
      var mid = Math.round((w.from + w.to) / 2);
      mid -= mid % 2;
      path.push({ rel: mid, gap: opt.gaps[0], target: target, width: w.width });
      ws.push(w.width);
      if (w.width < minW) minW = w.width;
      var c = SIM.cloneState(s);
      for (var q = 0; q < mid; q++) SIM.step(lv, c, true);
      var f = flight(lv, c, opt.gaps[0], opt);
      if (target === 'goal') break;
      if (f.k !== 'arrive' || f.s.ix !== ti) return { ok: false, at: ti, why: 'arrive' };
      s = f.s;
    }
    return { ok: true, path: path, minWidth: minW, widths: ws };
  }

  return { solve: solve, seqPath: seqPath, flight: flight, winRange: winRange, releases: releases, qkey: qkey };
})();
