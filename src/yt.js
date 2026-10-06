'use strict';
/* غلاف منصّة الألعاب: كل شي يشتغل حتى لو ما في SDK */
var YT = (function () {
  var g = null;
  try { g = (typeof ytgame !== 'undefined' && ytgame) ? ytgame : null; } catch (e) { g = null; }
  var t0 = Date.now(), lastAd = 0, audio = true;
  var INTER_GAP = 150000, INTER_FIRST = 3000;
  function safe(fn, dflt) { try { return fn(); } catch (e) { return dflt; } }
  function P(v) { return (v && typeof v.then === 'function') ? v : Promise.resolve(v); }

  /* حفظ: SDK أولًا ثم localStorage */
  function saveData(str) {
    try { localStorage.setItem('cf1', str); } catch (e) {}
    if (g && g.game && g.game.saveData) safe(function () { P(g.game.saveData(str)).catch(function () {}); });
  }
  function loadData() {
    var local = null;
    try { local = localStorage.getItem('cf1'); } catch (e) {}
    if (!(g && g.game && g.game.loadData)) return Promise.resolve(local);
    return safe(function () { return P(g.game.loadData()); }, Promise.resolve(local))
      .then(function (d) { return (typeof d === 'string' && d) ? d : local; }, function () { return local; });
  }
  function getLanguage() {
    if (!(g && g.system && g.system.getLanguage)) return Promise.resolve('');
    return safe(function () { return P(g.system.getLanguage()); }, Promise.resolve('')).then(function (l) { return typeof l === 'string' ? l : ''; }, function () { return ''; });
  }
  function firstFrame() { if (g && g.game && g.game.firstFrameReady) safe(function () { g.game.firstFrameReady(); }); }
  function ready() { if (g && g.game && g.game.gameReady) safe(function () { g.game.gameReady(); }); }
  function audioOn() { return audio; }
  function init(o) {
    if (!g || !g.system) return;
    if (g.system.isAudioEnabled) { audio = !!safe(function () { return g.system.isAudioEnabled(); }, true); }
    if (g.system.onAudioEnabledChange) safe(function () { g.system.onAudioEnabledChange(function (on) { audio = !!on; if (o.onAudio) o.onAudio(audio); }); });
    if (g.system.onPause) safe(function () { g.system.onPause(function () { if (o.onPause) o.onPause(); }); });
    if (g.system.onResume) safe(function () { g.system.onResume(function () { if (o.onResume) o.onResume(); }); });
  }
  function canRewarded() { return !!(g && g.ads && g.ads.requestRewardedAd); }
  /* إعلان مكافأة: يرجّع Promise<true> فقط إذا كمّله اللاعب */
  function rewarded(id) {
    if (!canRewarded()) return Promise.resolve(false);
    lastAd = Date.now();
    return Promise.resolve().then(function () { return g.ads.requestRewardedAd(id); }).then(function () { lastAd = Date.now(); return true; }, function () { lastAd = Date.now(); return false; });
  }
  /* إعلان بيني: بس بعد إنجاز كبير، مرة كل ٢٫٥ دقيقة، وأبدًا في أول ٣ ثواني */
  function interstitialAllowed() {
    var n = Date.now();
    return !!(g && g.ads && g.ads.requestInterstitialAd) && n - t0 >= INTER_FIRST && (lastAd === 0 || n - lastAd >= INTER_GAP);
  }
  function interstitial() {
    if (!interstitialAllowed()) return Promise.resolve(false);
    lastAd = Date.now();
    return safe(function () { return P(g.ads.requestInterstitialAd()); }, Promise.resolve()).then(function () { lastAd = Date.now(); return true; }, function () { lastAd = Date.now(); return false; });
  }
  return { present: !!g, init: init, saveData: saveData, loadData: loadData, getLanguage: getLanguage, firstFrame: firstFrame, ready: ready, audioOn: audioOn, canRewarded: canRewarded, rewarded: rewarded, interstitial: interstitial, interstitialAllowed: interstitialAllowed };
})();
