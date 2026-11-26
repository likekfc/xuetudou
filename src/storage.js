var Platform = require('./platform');
var CONFIG = require('./config');

function defaults() {
  return {
    v: 1,
    coins: 80,
    order: 1,
    ordersDone: 0,
    potatoesPeeled: 0,
    sGrades: 0,
    bestOrder: 0,
    upgrades: { knife: 1, gloves: 0, bucket: 1, machine: 0, hourglass: 0 },
    daily: { lastClaimDate: '', streak: 0 },
    quests: { date: '', progress: { orders: 0, potatoes: 0, sgrade: 0, waste: 0 }, claimed: {} },
    idle: { ts: Date.now(), pending: 0 },
    chest: { lastClaim: 0 },
    settings: { sound: true, haptics: true },
    tutorialDone: false,
    ad: { lastInterstitial: 0, lastResultAd: 0, lastFailAd: 0 },
    stats: { totalWaste: 0, totalPeel: 0, totalPotatoes: 0 }
  };
}

function isObj(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function merge(base, extra) {
  if (!isObj(extra)) return base;
  for (var k in extra) {
    if (!Object.prototype.hasOwnProperty.call(extra, k)) continue;
    if (isObj(base[k]) && isObj(extra[k])) merge(base[k], extra[k]);
    else if (typeof extra[k] === typeof base[k] && base[k] !== null) base[k] = extra[k];
    else if (base[k] === undefined) base[k] = extra[k];
  }
  return base;
}

function load() {
  var raw = Platform.getStorage(CONFIG.saveKey);
  var base = defaults();
  if (!raw) return base;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch (e) { raw = null; }
  }
  if (!isObj(raw)) return base;
  return merge(base, raw);
}

function save(state) {
  Platform.setStorage(CONFIG.saveKey, state);
}

function clear() {
  try {
    if (Platform.isWx) wx.removeStorageSync(CONFIG.saveKey);
    else window.localStorage.removeItem(CONFIG.saveKey);
  } catch (e) {}
}

module.exports = {
  defaults: defaults,
  load: load,
  save: save,
  clear: clear
};
