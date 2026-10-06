'use strict';
/* اللعبة: عرض، إدخال، صوت، واجهة */
var GAME = (function () {
  var PAL = PIX.palette(WARM_RAMPS());
  function WARM_RAMPS() {
    return {
      J: ['#0a2a26', '#0f3b33', '#16513f', '#1f6b4d', '#2f8a55'],
      L: ['#3a7a2a', '#5a9a2a', '#7fb82e', '#a8d83f', '#d4ec7a'],
      M: ['#6b3016', '#c4561a', '#ff8a1e', '#ffb347', '#ffd98a'],
      H: ['#7a1f4a', '#a82c5c', '#e0457b', '#f272a0', '#ffa8c5'],
      T: ['#1d5f64', '#2f857f', '#4fb8b0', '#86d6cc', '#c4ece3'],
      C: ['#b89a72', '#d9b98a', '#f0d7a2', '#fff1d0', '#fffaea'],
      F: ['#2a160f', '#4a2616', '#7a4220', '#a8662e', '#d49858']
    };
  }
  var cv, ctx, VW = 144, VH = 256, SC = 1;
  var $ = function (id) { return document.getElementById(id); };
  var C = PIX.cid;
  function clampL(l) { return l < 0 ? 0 : (l > 4 ? 4 : l); }
  function tintFn(ramp, d) { var rk = PIX.KEYS.indexOf(ramp); return function (c) { return rk * 5 + clampL(PIX.level(c) + d); }; }

  /* ---------- لغة ---------- */
  var T = {
    ar: { t1: 'اضغط مطوّلًا على الشاشة', t2: 'اترك وإنت تتأرجح لقدّام', t3: 'اضغط قبل الحلقة اللي بعدها', level: 'المرحلة', win: 'ممتاز!', next: 'التالي', title: 'أرجوحة الغيل', again: 'من جديد' },
    en: { t1: 'Press and hold the screen', t2: 'Let go as you swing forward', t3: 'Press again before the next ring', level: 'Level', win: 'Great!', next: 'Next', title: 'Canopy Fling', again: 'Again' }
  };
  var lang = 'en';
  try { var nl = (navigator.language || 'en').toLowerCase(); lang = nl.indexOf('ar') === 0 ? 'ar' : 'en'; } catch (e) {}
  function tr(k) { return T[lang][k]; }
  function num(n) {
    if (lang !== 'ar') return String(n);
    return String(n).replace(/\d/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.charAt(+d); });
  }

  /* ---------- تخزين ---------- */
  var save = { lvl: 0, drops: 0, tip: 0 };
  try { var raw = localStorage.getItem('cf1'); if (raw) { var o = JSON.parse(raw); for (var k in o) save[k] = o[k]; } } catch (e) {}
  function persist() { try { localStorage.setItem('cf1', JSON.stringify(save)); } catch (e) {} }

  /* ---------- سبرايتات إلى كانفس ---------- */
  function toCanvas(spr, fn) {
    var c = document.createElement('canvas'); c.width = spr.w; c.height = spr.h;
    var x = c.getContext('2d'), img = x.createImageData(spr.w, spr.h);
    for (var i = 0; i < spr.d.length; i++) {
      var v = spr.d[i], k = i * 4;
      if (v === PIX.NONE) { img.data[k + 3] = 0; continue; }
      if (fn) v = fn(v);
      var p = PAL[v]; img.data[k] = p[0]; img.data[k + 1] = p[1]; img.data[k + 2] = p[2]; img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  }
  function bufCanvas(buf) {
    var c = document.createElement('canvas'); c.width = buf.w; c.height = buf.h;
    var x = c.getContext('2d'), img = x.createImageData(buf.w, buf.h);
    for (var i = 0; i < buf.d.length; i++) {
      var v = buf.d[i], k = i * 4;
      if (v === PIX.NONE) { img.data[k + 3] = 0; continue; }
      var p = PAL[v]; img.data[k] = p[0]; img.data[k + 1] = p[1]; img.data[k + 2] = p[2]; img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  }
  var SPR = {};
  function buildSprites() {
    SPR.ring = toCanvas(ART.RING);
    SPR.drop = toCanvas(ART.DROP); SPR.mango = toCanvas(ART.MANGO); SPR.pit = toCanvas(ART.PITAYA);
    SPR.nest = toCanvas(ART.NEST);
    SPR.birdf = ART.BIRDF.map(function (s) { return toCanvas(s); });
    SPR.fr = {};
    ['idle', 'swing', 'fly', 'joy', 'fall'].forEach(function (k) {
      SPR.fr[k] = FRAME_MAPS[k].map(function (fm) { return { c: toCanvas(PIX.sprite(fm.r)), p: [fm.p[0] + 1, fm.p[1] + 1] }; });
    });
    SPR.fr.grab = { c: toCanvas(PIX.sprite(FRAME_MAPS.grab.r)), p: [FRAME_MAPS.grab.p[0] + 1, FRAME_MAPS.grab.p[1] + 1] };
  }

  /* ---------- خلفيات مخبوزة ---------- */
  var LAY = {};
  function pnoise(x, per, seed) {
    x = ((x % per) + per) % per;
    return PIX.vnoise(x * 0.04, seed) * (1 - x / per) + PIX.vnoise((x - per) * 0.04, seed) * (x / per);
  }
  function bakeLayers() {
    var W = VW, H = VH, i, x, y;
    /* سما + شمس + أشعة */
    var b = new PIX.Buf(W, H);
    var sky = ['T2', 'T3', 'C3', 'M4', 'M3'].map(function (s) { return C(s.charAt(0), +s.charAt(1)); });
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) b.d[y * W + x] = PIX.grad(sky, y / (H * 0.8), x, y);
    var sx = W * 0.8, sy = H * 0.1;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      var dx = x - sx, dy = y - sy, d = Math.sqrt(dx * dx + dy * dy) + 0.001;
      if (d < 7) { b.d[y * W + x] = C('C', 4); continue; }
      var tt = 1 - (d - 7) / (W * 0.95);
      if (tt > 0) { tt *= tt; if (PIX.dth(x, y, tt * 0.95)) b.d[y * W + x] = tt > 0.4 ? C('C', 4) : C('M', 4); }
      var a = Math.atan2(dy, dx) * 8;
      var v = Math.pow((Math.sin(a + 1.3) * 0.5 + 0.5) * (Math.sin(a * 2.3 + 1.7) * 0.5 + 0.5), 1.3);
      var tr = v * Math.max(0, 1 - d / (Math.max(W, H) * 1.2));
      if (PIX.dth(x, y, tr)) { var c0 = b.d[y * W + x]; b.d[y * W + x] = tr > 0.4 ? PIX.cid(PIX.ramp(c0) === 4 ? 'C' : (PIX.ramp(c0) === 5 ? 'M' : PIX.KEYS[PIX.ramp(c0)]), clampL(PIX.level(c0) + 1)) : PIX.lift(c0, 1); }
    }
    LAY.sky = bufCanvas(b);
    var mb = new PIX.Buf(W, H); mb.fill(PIX.NONE);
    for (y = 0; y < H; y++) { var my = 1 - Math.abs(y / H - 0.52) / 0.3; if (my <= 0) continue; for (x = 0; x < W; x++) if (PIX.dth(x, y, my * 0.38)) mb.d[y * W + x] = (y + x) % 5 === 0 ? C('M', 4) : C('C', 3); }
    LAY.mist = bufCanvas(mb);

    var SW = 256;
    /* سلاسل + شلالات */
    function ridgeStrip(base, amp, col, rim, seed, falls) {
      var h = Math.round(H * 0.5), r = new PIX.Buf(SW, h); r.fill(PIX.NONE);
      for (x = 0; x < SW; x++) {
        var y0 = Math.round(h * 0.15 + (pnoise(x, SW, seed) - 0.5) * 2 * amp + (pnoise(x * 2.7, SW, seed + 9) - 0.5) * amp * 0.5);
        for (y = y0; y < h; y++) r.d[y * SW + x] = (y <= y0 + 1) ? rim : col;
      }
      (falls || []).forEach(function (fx) {
        for (var j = 0; j < 22; j++) for (var q = 0; q < 2; q++) r.set(fx + q, Math.round(h * 0.15 + amp + j), ((j + q * 3) % 7) === 0 ? C('T', 3) : C('C', 4));
      });
      return bufCanvas(r);
    }
    LAY.ridge1 = ridgeStrip(0, 9, C('T', 3), C('T', 4), 11, [60, 170]);
    LAY.ridge2 = ridgeStrip(0, 8, C('T', 2), C('T', 3), 21, []);
    /* بحر القمم */
    function crowns(rowH, n, keys, tint, seed, fogCol, fogStr) {
      var r = new PIX.Buf(SW, rowH), R = PIX.rng(seed); r.fill(PIX.NONE);
      var list = [];
      for (var q = 0; q < n; q++) list.push({ x: (q / n) * SW + (R() - 0.5) * 8, y: rowH * 0.55 + (R() - 0.5) * 6, s: ART.CL[keys[(R() * keys.length) | 0]], f: R() < 0.5 });
      list.sort(function (a, b2) { return a.y - b2.y; });
      list.forEach(function (p) {
        [-SW, 0, SW].forEach(function (o) { PIX.stamp(r, p.s, p.x + o - p.s.w / 2, p.y - p.s.h / 2, p.f, tint); });
      });
      if (fogCol !== undefined) for (y = 0; y < rowH; y++) for (var xx = 0; xx < SW; xx++) {
        var vv = r.d[y * SW + xx];
        if (vv !== PIX.NONE && PIX.dth(xx, y, fogStr * (1 - y / rowH))) r.d[y * SW + xx] = fogCol;
      }
      return bufCanvas(r);
    }
    LAY.crown1 = crowns(60, 9, ['c40', 'c56'], tintFn('T', -1), 5, C('T', 4), 0.8);
    LAY.crown2 = crowns(56, 10, ['c30', 'c40'], function (c) { return C('T', clampL(PIX.level(c) - 1)); }, 6, C('T', 3), 0.6);
    LAY.crown3 = crowns(60, 9, ['c40', 'c56'], function (c) { return C('J', clampL(PIX.level(c) - 1)); }, 7);
    /* إطار علوي: أوراق وكروم */
    var fh = 78, fb = new PIX.Buf(SW, fh), FR = PIX.rng(31); fb.fill(PIX.NONE);
    var fl = [];
    for (i = 0; i < 40; i++) fl.push({ x: FR() * SW, y: -4 + FR() * 56, s: ART.CL[['c18', 'c24', 'c30', 'c40'][(FR() * 4) | 0]], f: FR() < 0.5, lime: FR() < 0.45 });
    fl.sort(function (a, b2) { return a.y - b2.y; });
    fl.forEach(function (p) {
      var up = p.y < 24 ? 1 : 0;
      [-SW, 0, SW].forEach(function (o) { PIX.stamp(fb, p.s, p.x + o - p.s.w / 2, p.y - p.s.h / 2, p.f, p.lime ? tintFn('L', -1 + up) : tintFn('J', -1 + up)); });
    });
    LAY.frame = bufCanvas(fb);
    /* ورق قريب */
    var nb = new PIX.Buf(512, 70), NR = PIX.rng(77); nb.fill(PIX.NONE);
    for (i = 0; i < 6; i++) {
      var lx = i * 85 + NR() * 30, ly = (i % 2) ? 4 : 40;
      [-512, 0, 512].forEach(function (o) { PIX.stamp(nb, ART.LEAF_BIG, lx + o, ly, NR() < 0.5, function (c) { return c === 0 ? C('J', 0) : C('J', clampL(PIX.level(c) - 2)); }); });
    }
    LAY.near = bufCanvas(nb);
  }

  /* ---------- حالة اللعب ---------- */
  var lv, st, held = false, camX = 0, camY = 110, parts = [], flash = 0, shake = 0;
  var phase = 'play', phaseT = 0, grabAnim = 0, picked = {}, lvlDrops = 0, tipStep = 0, birds = [];
  var levelIdx = 0;

  function loadLevel(i) {
    levelIdx = i % LEVELS.count();
    lv = LEVELS.get(levelIdx);
    st = SIM.makeState(lv);
    picked = {}; lvlDrops = 0; parts = []; birds = []; phase = 'play'; phaseT = 0; flash = 0;
    camX = st.x - VW * 0.38; camY = 110;
    tipStep = (levelIdx === 0 && !save.tip) ? 1 : 0;
    $('win').style.display = 'none';
    hud();
  }
  function hud() {
    $('drops').textContent = num(save.drops + lvlDrops);
    $('lvl').textContent = tr('level') + ' ' + num(levelIdx + 1);
    var tip = $('tip');
    if (tipStep >= 1 && tipStep <= 3) { tip.textContent = tr('t' + tipStep); tip.style.display = 'block'; } else tip.style.display = 'none';
  }

  /* ---------- صوت ---------- */
  var AU = { ctx: null, master: null, on: true, started: false, nextNote: 0, step: 0 };
  function audioInit() {
    if (AU.ctx) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      AU.ctx = new AC();
      AU.master = AU.ctx.createGain(); AU.master.gain.value = AU.on ? 0.8 : 0; AU.master.connect(AU.ctx.destination);
      /* ضجيج للمطر/الحفيف */
      var len = AU.ctx.sampleRate * 2, buf = AU.ctx.createBuffer(1, len, AU.ctx.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      AU.noise = buf;
      AU.nextNote = AU.ctx.currentTime + 0.1;
      /* مطر خفيف دايم */
      var ns = AU.ctx.createBufferSource(); ns.buffer = buf; ns.loop = true;
      var f = AU.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.6;
      var g = AU.ctx.createGain(); g.gain.value = 0.035;
      ns.connect(f); f.connect(g); g.connect(AU.master); ns.start();
    } catch (e) { AU.ctx = null; }
  }
  function tone(freq, t, dur, type, vol, dest) {
    var o = AU.ctx.createOscillator(), g = AU.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || AU.master); o.start(t); o.stop(t + dur + 0.05);
  }
  function sfx(name, a) {
    if (!AU.ctx || !AU.on) return;
    var t = AU.ctx.currentTime;
    if (name === 'grab') { tone(392, t, 0.25, 'triangle', 0.22); tone(587, t + 0.04, 0.2, 'sine', 0.12); }
    else if (name === 'release') {
      var ns = AU.ctx.createBufferSource(); ns.buffer = AU.noise;
      var f = AU.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
      f.frequency.setValueAtTime(600, t); f.frequency.exponentialRampToValueAtTime(2600, t + 0.25);
      var g = AU.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.18, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      ns.connect(f); f.connect(g); g.connect(AU.master); ns.start(t); ns.stop(t + 0.35);
    }
    else if (name === 'pick') { var n = (a || 0) % 5; var sc = [784, 880, 1047, 1175, 1319]; tone(sc[n], t, 0.35, 'sine', 0.2); tone(sc[n] * 2, t, 0.2, 'sine', 0.06); }
    else if (name === 'dead') { tone(220, t, 0.35, 'triangle', 0.18); tone(147, t + 0.1, 0.4, 'triangle', 0.15); }
    else if (name === 'win') { [523, 659, 784, 1047, 1319].forEach(function (f2, i) { tone(f2, t + i * 0.09, 0.7, 'triangle', 0.2); }); }
  }
  /* موسيقى: كاليمبا بسلّم خماسي + نقر مارمبا */
  var MEL = [0, 2, 4, 7, 9, 12, 9, 7, 4, 2, 4, 7, 2, 0, -3, 0];
  function music() {
    if (!AU.ctx || !AU.on) return;
    var now = AU.ctx.currentTime;
    while (AU.nextNote < now + 0.4) {
      var s = AU.step, t = AU.nextNote;
      var semi = MEL[s % MEL.length];
      var f = 261.63 * Math.pow(2, semi / 12);
      if (s % 2 === 0) tone(f * 2, t, 0.5, 'sine', 0.07);
      if (s % 4 === 0) tone(f / 2, t, 0.45, 'triangle', 0.08);
      if (Math.random() < 0.08) { tone(1800 + Math.random() * 900, t, 0.12, 'sine', 0.025); tone(2400 + Math.random() * 600, t + 0.1, 0.1, 'sine', 0.02); }
      if (Math.random() < 0.05) { tone(150, t, 0.1, 'square', 0.02); tone(170, t + 0.12, 0.1, 'square', 0.02); }
      AU.nextNote += 0.3; AU.step++;
    }
  }
  function setMute(on) {
    AU.on = on; if (AU.master) AU.master.gain.value = on ? 0.8 : 0;
    $('bsound').textContent = on ? '♪' : '×';
  }

  /* ---------- إدخال ---------- */
  function press() {
    audioInit(); if (AU.ctx && AU.ctx.state === 'suspended') AU.ctx.resume();
    held = true;
  }
  function lift() { held = false; }
  function bindInput() {
    var tgt = $('stage');
    tgt.addEventListener('pointerdown', function (e) { e.preventDefault(); press(); }, { passive: false });
    window.addEventListener('pointerup', lift);
    window.addEventListener('pointercancel', lift);
    window.addEventListener('blur', lift);
    window.addEventListener('keydown', function (e) {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); if (!e.repeat) press(); }
      else if (e.code === 'KeyR') restart();
    });
    window.addEventListener('keyup', function (e) { if (e.code === 'Space' || e.code === 'ArrowUp') lift(); });
    function btn(id, fn) { var b = $(id); b.addEventListener('pointerdown', function (e) { e.stopPropagation(); }); b.addEventListener('click', function (e) { e.stopPropagation(); fn(); }); }
    btn('bsound', function () { audioInit(); setMute(!AU.on); });
    btn('blang', function () { lang = lang === 'ar' ? 'en' : 'ar'; applyLang(); });
    btn('brestart', restart);
    btn('bnext', function () { save.lvl = (levelIdx + 1) % LEVELS.count(); persist(); loadLevel(save.lvl); });
  }
  function applyLang() {
    document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    $('winmsg').textContent = tr('win'); $('bnext').textContent = tr('next');
    hud();
  }
  function restart() { loadLevel(levelIdx); }

  /* ---------- جسيمات ---------- */
  function burst(x, y, n, cols, sp) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.283, v = (0.4 + Math.random()) * sp;
      parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 0.4, life: 0.5 + Math.random() * 0.4, c: cols[(Math.random() * cols.length) | 0] });
    }
  }

  /* ---------- تحديث ---------- */
  var acc = 0, last = 0, tAll = 0;
  function stepWorld() {
    var ev = [];
    var wasMode = st.mode;
    SIM.step(lv, st, held, ev);
    for (var i = 0; i < ev.length; i++) {
      var e = ev[i];
      if (e.t === 'grab') {
        sfx('grab'); grabAnim = 0.14;
        burst(st.x, st.y - 6, 7, [C('T', 4), C('T', 3), C('C', 4)], 55);
        if (tipStep === 1) { tipStep = 2; hud(); }
        else if (tipStep === 3) { tipStep = 0; save.tip = 1; persist(); hud(); }
      } else if (e.t === 'release') {
        sfx('release'); shake = 0.6;
        if (tipStep === 2) { tipStep = 3; hud(); }
      } else if (e.t === 'dead') {
        sfx('dead'); phase = 'dead'; phaseT = 0;
      } else if (e.t === 'win') {
        sfx('win'); phase = 'win'; phaseT = 0; flash = 1;
        for (var b = 0; b < 16; b++) birds.push({ x: st.x - 40 + Math.random() * 80, y: st.y + Math.random() * 30, vx: 40 + Math.random() * 60, vy: -30 - Math.random() * 60, ph: Math.random() * 6 });
        burst(st.x, st.y, 30, [C('M', 3), C('M', 4), C('L', 3), C('C', 4), C('H', 3)], 90);
      }
    }
    /* قطرات */
    for (var p = 0; p < lv.pickups.length; p++) {
      if (picked[p]) continue;
      var pk = lv.pickups[p], dx = st.x - pk.x, dy = (st.y + 6) - pk.y;
      if (dx * dx + dy * dy < 14 * 14) {
        picked[p] = 1; lvlDrops++; sfx('pick', lvlDrops);
        burst(pk.x, pk.y, 9, [C('T', 4), C('C', 4), pk.t ? C('M', 3) : C('T', 3)], 50);
        hud();
      }
    }
  }
  function update(dt) {
    tAll += dt;
    if (phase === 'play') {
      acc += dt; var n = 0;
      while (acc >= SIM.DT && n < 12) { stepWorld(); acc -= SIM.DT; n++; if (phase !== 'play') break; }
      if (acc > 0.1) acc = 0;
    } else if (phase === 'dead') {
      phaseT += dt;
      if (phaseT > 0.55) { SIM.respawn(lv, st); st.idle = true; phase = 'play'; held = false; camX = st.x - VW * 0.38; }
    } else if (phase === 'win') {
      phaseT += dt;
      if (phaseT > 1.4 && $('win').style.display !== 'flex') {
        $('win').style.display = 'flex';
        save.drops += lvlDrops; lvlDrops = 0; save.lvl = (levelIdx + 1) % LEVELS.count(); persist(); hud();
      }
    }
    if (grabAnim > 0) grabAnim -= dt;
    if (shake > 0) shake -= dt * 3;
    if (flash > 0) flash -= dt * 0.9;
    for (var i = parts.length - 1; i >= 0; i--) {
      var q = parts[i]; q.life -= dt;
      if (q.life <= 0) { parts.splice(i, 1); continue; }
      q.vy += 160 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
    }
    for (i = 0; i < birds.length; i++) { var bd = birds[i]; bd.x += bd.vx * dt; bd.y += bd.vy * dt; bd.vy += 10 * dt; }
    /* كاميرا */
    var tx = st.x - VW * 0.36 + Math.max(-30, Math.min(40, st.vx * 0.22));
    camX += (tx - camX) * Math.min(1, dt * 4.5);
    var ty = (st.mode === SIM.HANG ? st.y : st.y * 0.6 + 110 * 0.4) - VH * 0.45 + 12;
    camY += (ty - camY) * Math.min(1, dt * 2.5);
    music();
  }

  /* ---------- رسم ---------- */
  function px(v) { return Math.round(v); }
  function tile(img, w, offX, y, par) {
    var o = -(((camX * par) % w) + w) % w;
    for (var x = o; x < VW; x += w) ctx.drawImage(img, px(x), px(y));
  }
  function drawVine(x0, y0, x1, y1, sway) {
    PIX.line(x0, y0, x1, y1, function (x, y, i) {
      ctx.fillStyle = hexOf(C('J', (i % 6 < 3) ? 1 : 2)); ctx.fillRect(x, y, 1, 1);
      if (i % 9 === 4) { ctx.fillStyle = hexOf(C('L', 1)); ctx.fillRect(x + 1, y, 1, 1); }
    });
  }
  var HEX = [];
  function hexOf(id) {
    if (!HEX[id]) { var p = PAL[id]; HEX[id] = 'rgb(' + p[0] + ',' + p[1] + ',' + p[2] + ')'; }
    return HEX[id];
  }
  function draw() {
    var sx = 0, sy = 0;
    if (shake > 0) { sx = Math.round((Math.random() - 0.5) * 2 * shake); sy = Math.round((Math.random() - 0.5) * 2 * shake); }
    ctx.save(); ctx.translate(sx, sy);
    ctx.drawImage(LAY.sky, 0, 0);
    var cy = camY - 110;
    tile(LAY.ridge1, 256, 0, VH * 0.36 - cy * 0.05, 0.08);
    tile(LAY.ridge2, 256, 0, VH * 0.46 - cy * 0.08, 0.16);
    ctx.drawImage(LAY.mist, 0, 0);
    tile(LAY.crown1, 256, 0, VH * 0.5 - cy * 0.12, 0.28);
    tile(LAY.crown2, 256, 0, VH * 0.62 - cy * 0.2, 0.42);
    tile(LAY.crown3, 256, 0, VH * 0.76 - cy * 0.3, 0.6);
    var fy = -14 - cy * 0.3;
    tile(LAY.frame, 256, 0, fy, 0.75);
    /* كروم العالم */
    var i, a, x, y;
    var topY = -20;
    for (i = 0; i < lv.anchors.length; i++) {
      a = lv.anchors[i];
      var ax = a.x - camX, ay = a.y - camY;
      if (ax < -30 || ax > VW + 30) continue;
      var hx = a.x, hy = a.y + a.L, held_ = (st.mode === SIM.HANG && st.ix === i);
      if (held_) { hx = st.x; hy = st.y; }
      else hx += Math.sin(tAll * 1.3 + i) * 1.2;
      /* حبل من فوق لين الحلقة */
      drawVine(px(a.x - camX), px(topY), px(a.x - camX), px(ay), 0);
      drawVine(px(a.x - camX), px(ay), px(hx - camX), px(hy - camY - 17), 0);
      ctx.drawImage(SPR.ring, px(hx - camX) - 9, px(hy - camY) - 17);
      if (lv.anchors[i].cp && i > 0) { /* علامة نقطة حفظ: غصين ليموني */
        ctx.fillStyle = hexOf(C('L', 3)); ctx.fillRect(px(a.x - camX) - 1, px(ay) + 2, 3, 3);
      }
    }
    /* العش */
    var gx = lv.goal.x - camX, gy = lv.goal.y - camY;
    drawVine(px(gx), px(topY), px(gx), px(gy - 14), 0);
    drawVine(px(gx) - 6, px(topY), px(gx) - 6, px(gy - 12), 0);
    var gl = 0.5 + 0.5 * Math.sin(tAll * 3);
    for (i = 0; i < 40; i++) {
      var ga = i / 40 * 6.283, gr = 14 + gl * 2;
      if (PIX.dth(i, i * 3, 0.5)) { ctx.fillStyle = hexOf(C('M', 4)); ctx.fillRect(px(gx + Math.cos(ga) * gr), px(gy + Math.sin(ga) * gr * 0.7), 1, 1); }
    }
    ctx.drawImage(SPR.nest, px(gx) - 9, px(gy) - 4);
    /* قطرات وفواكه */
    for (i = 0; i < lv.pickups.length; i++) {
      if (picked[i]) continue;
      var pk = lv.pickups[i], bob = Math.sin(tAll * 3 + i) * 1.5;
      var im = pk.t ? SPR.mango : SPR.drop;
      ctx.drawImage(im, px(pk.x - camX) - (im.width >> 1), px(pk.y - camY + bob) - (im.height >> 1));
    }
    /* الجبّون */
    drawGibbon();
    /* جسيمات */
    for (i = 0; i < parts.length; i++) { var q = parts[i]; ctx.fillStyle = hexOf(q.c); ctx.fillRect(px(q.x - camX), px(q.y - camY), 1, 1); }
    /* خطوط سرعة */
    if (st.mode === SIM.FREE && phase === 'play') {
      var spd = Math.sqrt(st.vx * st.vx + st.vy * st.vy);
      if (spd > 90) for (i = 1; i <= 4; i++) {
        var tx = st.x - st.vx * 0.018 * i * 1.4 + (i % 2) * 2, ty = st.y - st.vy * 0.018 * i * 1.4 + 4 + (i % 3) * 3;
        ctx.fillStyle = hexOf(C('C', 4)); ctx.fillRect(px(tx - camX), px(ty - camY), 2, 1);
      }
    }
    for (i = 0; i < birds.length; i++) {
      var bd = birds[i], fr = SPR.birdf[((tAll * 8 + bd.ph) | 0) & 1];
      ctx.drawImage(fr, px(bd.x - camX), px(bd.y - camY));
    }
    tile(LAY.near, 512, 0, VH - 54 - cy * 0.4, 1.5);
    if (flash > 0) { ctx.globalAlpha = Math.min(1, flash) * 0.55; ctx.fillStyle = hexOf(C('C', 4)); ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
    ctx.restore();
    /* تعتيم لحظة السقوط */
    if (phase === 'dead') { ctx.globalAlpha = Math.min(1, phaseT * 2.2); ctx.fillStyle = hexOf(C('J', 0)); ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
  }
  function drawGibbon() {
    var f, flip = false, X = st.x - camX, Y = st.y - camY;
    if (phase === 'dead') { f = SPR.fr.fall[((tAll * 10) | 0) & 1]; }
    else if (phase === 'win') { f = SPR.fr.joy[((tAll * 5) | 0) & 1]; }
    else if (st.mode === SIM.HANG) {
      if (st.idle) f = SPR.fr.idle[((tAll * 1.6) | 0) % 4];
      else if (grabAnim > 0) f = SPR.fr.grab;
      else {
        var lean = Math.max(-40, Math.min(40, st.th * 57.3 * 0.55));
        var bins = [-40, -28, -16, -6, 6, 16, 28, 40], bi = 0, bd = 1e9;
        for (var k = 0; k < 8; k++) { var dd = Math.abs(lean - bins[k]); if (dd < bd) { bd = dd; bi = k; } }
        f = SPR.fr.swing[bi];
      }
    } else {
      var al = Math.atan2(-st.vy, Math.abs(st.vx)) * 57.3;
      flip = st.vx < 0;
      if (al < -38) { f = SPR.fr.fall[((tAll * 10) | 0) & 1]; flip = false; }
      else if (al > 45) f = SPR.fr.fly[0];
      else if (al > 12) f = SPR.fr.fly[1];
      else if (al > -14) f = SPR.fr.fly[2];
      else f = SPR.fr.fly[3];
    }
    var w = f.c.width;
    if (flip) {
      ctx.save(); ctx.translate(px(X), 0); ctx.scale(-1, 1);
      ctx.drawImage(f.c, -f.p[0], px(Y) - f.p[1]); ctx.restore();
    } else ctx.drawImage(f.c, px(X) - f.p[0], px(Y) - f.p[1]);
  }

  /* ---------- حجم الشاشة ---------- */
  function resize() {
    var dpr = window.devicePixelRatio || 1;
    var W = window.innerWidth * dpr, H = window.innerHeight * dpr;
    var shortSide = Math.min(W, H);
    SC = Math.max(1, Math.floor(shortSide / 150));
    VW = Math.ceil(W / SC); VH = Math.ceil(H / SC);
    cv.width = VW; cv.height = VH;
    cv.style.width = (VW * SC / dpr) + 'px'; cv.style.height = (VH * SC / dpr) + 'px';
    ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    bakeLayers();
  }

  function frame(ts) {
    var dt = Math.min(0.05, (ts - last) / 1000); last = ts;
    update(dt); draw();
    requestAnimationFrame(frame);
  }

  function start() {
    cv = $('cv');
    buildSprites();
    resize();
    window.addEventListener('resize', function () { resize(); });
    bindInput();
    applyLang();
    loadLevel(save.lvl || 0);
    setMute(true);
    last = performance.now();
    requestAnimationFrame(frame);
  }
  return { start: start, get state() { return st; }, get level() { return lv; }, get phase() { return phase; }, setHeld: function (h) { held = h; }, loadLevel: loadLevel, view: function () { return [VW, VH, SC]; }, save: save, tip: function () { return tipStep; } };
})();
