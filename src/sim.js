'use strict';
/* فيزياء اللعبة: خطوة ثابتة، تُستخدم في اللعب والحلّال والمحاكاة بنفس الأرقام بالضبط */
var SIM = (function () {
  var DT = 1 / 120;
  var C = {
    G: 420,          /* جاذبية (بكسل/ث²) */
    GRAB_R: 32,      /* مدى المسك حول الحلقة */
    PUMP: 4.0,       /* دفع زاوي لما تضغط (راد/ث²) */
    THMAX: 1.3,     /* أقصى زاوية تمرجح */
    OMMAX: 7,        /* أقصى سرعة زاوية */
    CD: 0.28,        /* بعد الترك ما تمسك نفس الحلقة */
    RSLACK_LO: 8,    /* الحبل يقصر لين كذا */
    RSLACK_HI: 10,   /* ويطول لين كذا */
    KILL_BELOW: 150, /* السقوط تحت أوطى حلقة */
    GOAL_R: 14
  };
  var READY = 0, HANG = 1, FREE = 2;

  function cloneState(s) {
    return {
      mode: s.mode, x: s.x, y: s.y, vx: s.vx, vy: s.vy, ix: s.ix, th: s.th, om: s.om, L: s.L,
      idle: s.idle, hold: s.hold, t: s.t, cd: s.cd, last: s.last, cp: s.cp, dead: s.dead, won: s.won,
      cut: s.cut, grabbed: s.grabbed
    };
  }

  function anchorRest(lv, i) {
    var a = lv.anchors[i];
    return { x: a.x, y: a.y + a.L };
  }

  /* حالة البداية: معلّق على حلقة cp جاهز */
  function spawnAt(lv, ix, s) {
    s = s || {};
    var a = lv.anchors[ix];
    s.mode = HANG; s.ix = ix; s.th = 0; s.om = 0; s.L = a.L;
    s.x = a.x; s.y = a.y + a.L; s.vx = 0; s.vy = 0;
    s.idle = true; s.hold = 0; s.cd = 0; s.last = -1; s.dead = false; s.won = false;
    s.cp = ix; s.cut = 0; s.grabbed = 0; s.t = s.t || 0;
    return s;
  }
  function makeState(lv) { return spawnAt(lv, 0, { t: 0 }); }

  function respawn(lv, s) {
    var keepT = s.t;
    spawnAt(lv, s.cp, s);
    s.t = keepT;
    return s;
  }

  function releaseVel(s) {
    var c = Math.cos(s.th), sn = Math.sin(s.th);
    return [s.L * s.om * c, -s.L * s.om * sn];
  }

  /* خطوة وحدة. held: هل الإصبع نازل؟  ev: مصفوفة أحداث اختيارية */
  function step(lv, s, held, ev) {
    var i, a, dx, dy, d, best, bd, th, r, c, sn;
    s.t += DT;
    if (s.mode === HANG) {
      if (s.idle) {
        if (held) s.idle = false; else return;
      }
      if (!held) {
        /* ترك */
        var v = releaseVel(s);
        a = lv.anchors[s.ix];
        s.vx = v[0]; s.vy = v[1];
        s.x = a.x + s.L * Math.sin(s.th); s.y = a.y + s.L * Math.cos(s.th);
        s.mode = FREE; s.last = s.ix; s.cd = C.CD; s.hold = 0;
        if (ev) ev.push({ t: 'release', vx: s.vx, vy: s.vy, ix: s.ix });
        return;
      }
      s.hold += DT;
      var dir = s.om > 0 ? 1 : (s.om < 0 ? -1 : 1);
      /* الدفع يقل كلما قربت الطاقة من طاقة أقصى زاوية */
      var gl = C.G / s.L;
      var en = 0.5 * s.om * s.om + gl * (1 - Math.cos(s.th));
      var emax = gl * (1 - Math.cos(C.THMAX));
      var k = 1 - en / emax;
      if (k < 0) k = 0;
      var al = -gl * Math.sin(s.th) + C.PUMP * dir * k;
      s.om += al * DT;
      if (s.om > C.OMMAX) s.om = C.OMMAX; else if (s.om < -C.OMMAX) s.om = -C.OMMAX;
      s.th += s.om * DT;
      a = lv.anchors[s.ix];
      s.x = a.x + s.L * Math.sin(s.th); s.y = a.y + s.L * Math.cos(s.th);
      return;
    }
    /* طيران */
    s.vy += C.G * DT;
    s.x += s.vx * DT; s.y += s.vy * DT;
    if (s.cd > 0) s.cd -= DT;
    /* مسك */
    if (held) {
      best = -1; bd = C.GRAB_R * C.GRAB_R;
      for (i = 0; i < lv.anchors.length; i++) {
        a = lv.anchors[i];
        if (i === s.last && s.cd > 0) continue;
        if (a.cutMask && (s.cut & a.cutMask)) continue;
        dx = s.x - a.x; dy = s.y - (a.y + a.L);
        d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = i; }
      }
      if (best >= 0) {
        a = lv.anchors[best];
        dx = s.x - a.x; dy = s.y - a.y;
        r = Math.sqrt(dx * dx + dy * dy);
        var lo = a.L - C.RSLACK_LO, hi = a.L + C.RSLACK_HI;
        if (r < lo) r = lo; else if (r > hi) r = hi;
        th = Math.atan2(dx, dy);
        if (th > 1.2) th = 1.2; else if (th < -1.2) th = -1.2;
        c = Math.cos(th); sn = Math.sin(th);
        s.mode = HANG; s.ix = best; s.L = r; s.th = th;
        s.om = (s.vx * c - s.vy * sn) / r;
        if (s.om > C.OMMAX) s.om = C.OMMAX; else if (s.om < -C.OMMAX) s.om = -C.OMMAX;
        s.x = a.x + r * sn; s.y = a.y + r * c;
        s.idle = false; s.hold = 0;
        if (lv.anchors[best].cp) s.cp = best;
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
    if (s.y > lv.killY || s.x < lv.minX || s.x > lv.maxX) {
      s.dead = true;
      if (ev) ev.push({ t: 'dead' });
    }
  }

  return {
    DT: DT, C: C, READY: READY, HANG: HANG, FREE: FREE,
    makeState: makeState, cloneState: cloneState, spawnAt: spawnAt, respawn: respawn, step: step,
    anchorRest: anchorRest, releaseVel: releaseVel
  };
})();
