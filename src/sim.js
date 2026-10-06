'use strict';
/* فيزياء اللعبة: خطوة ثابتة، تُستخدم في اللعب والحلّال والمحاكاة بنفس الأرقام بالضبط */
var SIM = (function () {
  var DT = 1 / 120;
  var TAU = Math.PI * 2;
  var C = {
    G: 420,          /* جاذبية (بكسل/ث²) */
    GRAB_R: 32,      /* مدى المسك حول الحلقة */
    PUMP: 4.0,       /* دفع زاوي لما تضغط (راد/ث²) */
    THMAX: 1.3,      /* أقصى زاوية تمرجح */
    OMMAX: 7,        /* أقصى سرعة زاوية */
    CD: 0.28,        /* بعد الترك ما تمسك نفس الحلقة */
    RSLACK_LO: 8,    /* الحبل يقصر لين كذا */
    RSLACK_HI: 10,   /* ويطول لين كذا */
    GOAL_R: 14,
    LEAF_MIN: 210,   /* أدنى سرعة ارتداد من الورقة */
    LEAF_MAX: 330,   /* وأقصاها */
    LEAF_USES: 2,    /* كم ارتداد تتحمل الورقة */
    DRAFT_A: 760     /* تسارع التيار الصاعد */
  };
  var READY = 0, HANG = 1, FREE = 2;
  /* تعديلات القدرات: pump مضاعِف الدفع، dL زيادة طول الحبل، rescue عدد النجدات */
  var M = { pump: 1, dL: 0, rescue: 0 };
  function setMods(m) { M.pump = m.pump || 1; M.dL = m.dL || 0; M.rescue = m.rescue || 0; }
  function getMods() { return { pump: M.pump, dL: M.dL, rescue: M.rescue }; }

  function eff(a) { return a.L + M.dL; }
  /* موضع نقطة التعليق الأفقي (الحلقات المتحركة تحملها الطيور) */
  function ax(lv, a, t) { return a.mv ? a.x + a.mv.A * Math.sin(TAU * t / lv.tper + a.mv.ph) : a.x; }
  function avx(lv, a, t) { return a.mv ? a.mv.A * (TAU / lv.tper) * Math.cos(TAU * t / lv.tper + a.mv.ph) : 0; }

  function cloneState(s) {
    return {
      mode: s.mode, x: s.x, y: s.y, vx: s.vx, vy: s.vy, ix: s.ix, th: s.th, om: s.om, L: s.L,
      idle: s.idle, hold: s.hold, t: s.t, cd: s.cd, last: s.last, cp: s.cp, dead: s.dead, won: s.won,
      cut: s.cut, lcut: s.lcut, grabbed: s.grabbed, resc: s.resc
    };
  }

  function anchorRest(lv, i, t) {
    var a = lv.anchors[i];
    return { x: ax(lv, a, t || 0), y: a.y + eff(a) };
  }

  /* حالة البداية: معلّق على حلقة ix جاهز */
  function spawnAt(lv, ix, s) {
    s = s || {};
    var a = lv.anchors[ix];
    s.t = s.t || 0;
    s.mode = HANG; s.ix = ix; s.th = 0; s.om = 0; s.L = eff(a);
    s.x = ax(lv, a, s.t); s.y = a.y + s.L; s.vx = 0; s.vy = 0;
    s.idle = true; s.hold = 0; s.cd = 0; s.last = -1; s.dead = false; s.won = false;
    s.cp = ix; s.cut = 0; s.lcut = 0; s.grabbed = 0; s.resc = s.resc || 0;
    return s;
  }
  function makeState(lv) { return spawnAt(lv, 0, { t: 0, resc: 0 }); }

  function respawn(lv, s) {
    var keepT = s.t, keepR = s.resc;
    spawnAt(lv, s.cp, s);
    s.t = keepT; s.resc = keepR;
    var a = lv.anchors[s.ix]; s.x = ax(lv, a, s.t);
    return s;
  }

  function releaseVel(lv, s) {
    var a = lv.anchors[s.ix];
    var c = Math.cos(s.th), sn = Math.sin(s.th);
    return [s.L * s.om * c + avx(lv, a, s.t), -s.L * s.om * sn];
  }

  function doRelease(lv, s, forced, ev) {
    var a = lv.anchors[s.ix];
    var v = releaseVel(lv, s);
    s.vx = v[0]; s.vy = v[1];
    s.x = ax(lv, a, s.t) + s.L * Math.sin(s.th); s.y = a.y + s.L * Math.cos(s.th);
    s.mode = FREE; s.last = s.ix; s.cd = C.CD; s.hold = 0;
    if (a.bit) s.cut |= a.bit;
    if (ev) ev.push({ t: 'release', vx: s.vx, vy: s.vy, ix: s.ix, forced: forced, cut: !!a.bit });
  }

  /* خطوة وحدة. held: هل الإصبع نازل؟  ev: مصفوفة أحداث اختيارية */
  function step(lv, s, held, ev) {
    var i, a, dx, dy, d, best, bd, th, r, c, sn, pxv;
    s.t += DT;
    if (s.mode === HANG) {
      a = lv.anchors[s.ix];
      if (s.idle) {
        if (held) s.idle = false;
        else { s.x = ax(lv, a, s.t) + s.L * Math.sin(s.th); return; }
      }
      if (!held) { doRelease(lv, s, false, ev); return; }
      s.hold += DT;
      if (a.fold && s.hold > a.fold) { doRelease(lv, s, true, ev); return; }
      var dir = s.om > 0 ? 1 : (s.om < 0 ? -1 : 1);
      /* الدفع يقل كلما قربت الطاقة من طاقة أقصى زاوية */
      var gl = C.G / s.L;
      var en = 0.5 * s.om * s.om + gl * (1 - Math.cos(s.th));
      var emax = gl * (1 - Math.cos(C.THMAX));
      var k = 1 - en / emax;
      if (k < 0) k = 0;
      var al = -gl * Math.sin(s.th) + C.PUMP * M.pump * dir * k;
      s.om += al * DT;
      if (s.om > C.OMMAX) s.om = C.OMMAX; else if (s.om < -C.OMMAX) s.om = -C.OMMAX;
      s.th += s.om * DT;
      s.x = ax(lv, a, s.t) + s.L * Math.sin(s.th); s.y = a.y + s.L * Math.cos(s.th);
      return;
    }
    /* طيران */
    var oy = s.y;
    s.vy += C.G * DT;
    if (lv.drafts) {
      for (i = 0; i < lv.drafts.length; i++) {
        d = lv.drafts[i];
        if (s.x >= d.x - d.w / 2 && s.x <= d.x + d.w / 2 && s.y >= d.y && s.y <= d.y + d.h) s.vy -= C.DRAFT_A * DT;
      }
    }
    s.x += s.vx * DT; s.y += s.vy * DT;
    if (s.cd > 0) s.cd -= DT;
    /* ورق يرتد */
    if (lv.leaves && s.vy > 0) {
      for (i = 0; i < lv.leaves.length; i++) {
        var lf = lv.leaves[i], used = (s.lcut >> (2 * i)) & 3;
        if (used >= C.LEAF_USES) continue;
        if (oy <= lf.y && s.y >= lf.y && Math.abs(s.x - lf.x) <= lf.w / 2) {
          s.y = lf.y;
          s.vy = -Math.min(Math.max(s.vy * 0.92, C.LEAF_MIN), C.LEAF_MAX);
          s.lcut += 1 << (2 * i);
          if (ev) ev.push({ t: 'bounce', i: i, x: s.x, y: s.y });
          break;
        }
      }
    }
    /* مسك */
    if (held) {
      best = -1; bd = C.GRAB_R * C.GRAB_R;
      for (i = 0; i < lv.anchors.length; i++) {
        a = lv.anchors[i];
        if (i === s.last && s.cd > 0) continue;
        if (a.bit && (s.cut & a.bit)) continue;
        dx = s.x - ax(lv, a, s.t); dy = s.y - (a.y + eff(a));
        d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = i; }
      }
      if (best >= 0) {
        a = lv.anchors[best];
        pxv = ax(lv, a, s.t);
        dx = s.x - pxv; dy = s.y - a.y;
        r = Math.sqrt(dx * dx + dy * dy);
        var lo = eff(a) - C.RSLACK_LO, hi = eff(a) + C.RSLACK_HI;
        if (r < lo) r = lo; else if (r > hi) r = hi;
        th = Math.atan2(dx, dy);
        if (th > 1.2) th = 1.2; else if (th < -1.2) th = -1.2;
        c = Math.cos(th); sn = Math.sin(th);
        s.mode = HANG; s.ix = best; s.L = r; s.th = th;
        s.om = ((s.vx - avx(lv, a, s.t)) * c - s.vy * sn) / r;
        if (s.om > C.OMMAX) s.om = C.OMMAX; else if (s.om < -C.OMMAX) s.om = -C.OMMAX;
        s.x = pxv + r * sn; s.y = a.y + r * c;
        s.idle = false; s.hold = 0;
        if (a.cp) s.cp = best;
        s.grabbed++;
        if (ev) ev.push({ t: 'grab', ix: best, speed: Math.sqrt(s.vx * s.vx + s.vy * s.vy) });
        return;
      }
    }
    /* هدف */
    dx = s.x - lv.goal.x; dy = s.y - lv.goal.y;
    if (dx * dx + dy * dy < C.GOAL_R * C.GOAL_R) {
      s.won = true;
      if (ev) ev.push({ t: 'win' });
      return;
    }
    /* سقوط */
    if (s.y > lv.killY && M.rescue > s.resc) {
      s.resc++; s.y = lv.killY - 40; s.vy = -300;
      if (ev) ev.push({ t: 'rescue', x: s.x, y: s.y });
      return;
    }
    if (s.y > lv.killY || s.x < lv.minX || s.x > lv.maxX) {
      s.dead = true;
      if (ev) ev.push({ t: 'dead' });
    }
  }

  return {
    DT: DT, C: C, READY: READY, HANG: HANG, FREE: FREE, TAU: TAU,
    makeState: makeState, cloneState: cloneState, spawnAt: spawnAt, respawn: respawn, step: step,
    anchorRest: anchorRest, releaseVel: releaseVel, eff: eff, ax: ax, avx: avx, setMods: setMods, getMods: getMods
  };
})();
