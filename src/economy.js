/**
 * 存档、成长、订单、每日、任务、离线收益。
 */
var CONFIG = require('./config');
var Storage = require('./storage');
var Platform = require('./platform');

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function dateStr(d) {
  d = d || new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}
function yesterdayStr() {
  var d = new Date();
  d.setDate(d.getDate() - 1);
  return dateStr(d);
}

var State = {
  s: null,

  init: function () {
    this.s = Storage.load();
    this.refresh();
    this.updateIdle();
    this.save();
    return this.s;
  },

  save: function () {
    if (this.s) Storage.save(this.s);
  },

  refresh: function () {
    var s = this.s;
    var today = dateStr();
    if (!s.quests || s.quests.date !== today) {
      s.quests = { date: today, progress: { orders: 0, potatoes: 0, sgrade: 0, waste: 0 }, claimed: {} };
    }
  },

  today: dateStr,

  // ---------- 升级 ----------
  upgradeDef: function (id) {
    for (var i = 0; i < CONFIG.upgrades.length; i++) {
      if (CONFIG.upgrades[i].id === id) return CONFIG.upgrades[i];
    }
    return null;
  },

  level: function (id) {
    return this.s.upgrades[id] || 0;
  },

  upgradeCost: function (id) {
    var d = this.upgradeDef(id);
    if (!d) return null;
    var lv = this.level(id);
    if (lv >= d.max) return null;
    return Math.round(d.baseCost * Math.pow(d.growth, lv - d.start));
  },

  buyUpgrade: function (id) {
    var cost = this.upgradeCost(id);
    if (cost === null) return { ok: false, reason: 'max' };
    if (this.s.coins < cost) return { ok: false, reason: 'coins', cost: cost };
    this.s.coins -= cost;
    this.s.upgrades[id] = this.level(id) + 1;
    this.save();
    Platform.reportEvent('upgrade_buy', { id: id, level: this.s.upgrades[id], cost: cost });
    return { ok: true, cost: cost, level: this.s.upgrades[id] };
  },

  effects: function () {
    var u = this.s.upgrades;
    return {
      knife: u.knife,
      gloves: u.gloves,
      bucket: u.bucket,
      machine: u.machine,
      hourglass: u.hourglass,
      brush: CONFIG.play.baseBrush + u.knife * CONFIG.play.brushPerKnife,
      wasteDepth: CONFIG.play.wasteDepthBase + u.gloves * CONFIG.play.wasteDepthPerGlove,
      coinMul: 1 + u.bucket * 0.12,
      idleRate: u.machine * CONFIG.idle.coinsPerMinutePerLevel,
      extraTime: u.hourglass * CONFIG.order.timePerHourglass
    };
  },

  effectText: function (id) {
    var lv = this.level(id);
    var e = this.effects();
    if (id === 'knife') {
      return '皮宽 ' + (CONFIG.play.baseBrush + lv * CONFIG.play.brushPerKnife).toFixed(1) +
        ' → ' + (lv >= 10 ? '已满级' : (CONFIG.play.baseBrush + (lv + 1) * CONFIG.play.brushPerKnife).toFixed(1));
    }
    if (id === 'gloves') {
      return '容错 ' + e.wasteDepth.toFixed(0) + ' → ' + (lv >= 8 ? '已满级' : (e.wasteDepth + CONFIG.play.wasteDepthPerGlove).toFixed(0));
    }
    if (id === 'bucket') {
      return '金币 +' + Math.round((e.coinMul - 1) * 100) + '% → +' +
        (lv >= 10 ? '已满级' : Math.round((e.coinMul - 1 + 0.12) * 100) + '%');
    }
    if (id === 'machine') {
      return '产出 ' + e.idleRate + ' 币/分 → ' + (lv >= 10 ? '已满级' : (e.idleRate + CONFIG.idle.coinsPerMinutePerLevel) + ' 币/分');
    }
    if (id === 'hourglass') {
      return '每单 +' + e.extraTime + 's → ' + (lv >= 5 ? '已满级' : '+' + (e.extraTime + CONFIG.order.timePerHourglass) + 's');
    }
    return '';
  },

  // ---------- 订单 ----------
  nextOrder: function () {
    var s = this.s;
    var index = s.order;
    var count = Math.min(2 + Math.floor((index - 1) / 2), CONFIG.order.maxPotatoes);
    var target = Math.min(CONFIG.play.targetBase + (index - 1) * CONFIG.play.targetPerOrder, CONFIG.play.targetMax);
    var timeLimit = CONFIG.order.timeBase + count * CONFIG.order.timePerPotato + this.effects().extraTime;
    var goldenIndex = (index % CONFIG.order.goldenEvery === 0) ? count - 1 : -1;
    var baseCoins = CONFIG.order.baseCoins + index * CONFIG.order.coinsPerOrder + count * CONFIG.order.coinsPerPotato;
    return {
      index: index,
      count: count,
      target: target,
      timeLimit: timeLimit,
      goldenIndex: goldenIndex,
      baseCoins: baseCoins
    };
  },

  gradeForWaste: function (waste) {
    var list = CONFIG.grades;
    for (var i = 0; i < list.length; i++) {
      if (waste <= list[i].maxWaste) return list[i];
    }
    return list[list.length - 1];
  },

  finishOrder: function (order, potatoes) {
    var s = this.s;
    var totalWaste = 0;
    var sCount = 0;
    var goldenCount = 0;
    var allGood = true;
    var best = null;
    for (var i = 0; i < potatoes.length; i++) {
      var p = potatoes[i];
      totalWaste += p.waste;
      if (p.grade.key === 'S') sCount++;
      if (p.grade.key === 'C' || p.grade.key === 'B') allGood = false;
      if (p.golden) goldenCount++;
      if (!best || p.waste < best.waste) best = p;
    }
    var avgWaste = potatoes.length ? totalWaste / potatoes.length : 0;
    var grade = this.gradeForWaste(avgWaste);
    var perfectRun = allGood && potatoes.length > 0;
    var coins = Math.round(order.baseCoins * grade.mul * this.effects().coinMul * (perfectRun ? 1.12 : 1)) + goldenCount * 25;

    s.coins += coins;
    s.order += 1;
    s.ordersDone += 1;
    s.potatoesPeeled += potatoes.length;
    s.sGrades += sCount;
    if (s.ordersDone > s.bestOrder) s.bestOrder = s.ordersDone;
    s.stats.totalPotatoes += potatoes.length;
    s.stats.totalWaste += avgWaste * potatoes.length;
    if (best) s.stats.totalPeel += best.peel;

    this.questAdd('orders', 1);
    this.questAdd('potatoes', potatoes.length);
    if (sCount > 0) this.questAdd('sgrade', sCount);
    if (best && best.waste < 0.015) this.questAdd('waste', 1);

    this.save();
    Platform.reportEvent('order_complete', {
      order: order.index,
      count: potatoes.length,
      grade: grade.key,
      waste: Math.round(avgWaste * 1000) / 10,
      coins: coins,
      perfect: perfectRun
    });
    return {
      coins: coins,
      grade: grade,
      avgWaste: avgWaste,
      perfectRun: perfectRun,
      sCount: sCount,
      goldenCount: goldenCount,
      coinMul: this.effects().coinMul
    };
  },

  failOrder: function (order) {
    Platform.reportEvent('order_fail', { order: order.index });
  },

  // ---------- 每日 ----------
  dailyInfo: function () {
    var s = this.s;
    var today = dateStr();
    var claimedToday = s.daily.lastClaimDate === today;
    var nextStreak;
    if (claimedToday) nextStreak = s.daily.streak;
    else if (s.daily.lastClaimDate === yesterdayStr()) nextStreak = s.daily.streak + 1;
    else nextStreak = 1;
    var day = ((Math.max(1, nextStreak) - 1) % 7) + 1;
    return {
      claimedToday: claimedToday,
      nextStreak: nextStreak,
      day: claimedToday ? ((Math.max(1, s.daily.streak) - 1) % 7) + 1 : day,
      reward: CONFIG.dailyRewards[(claimedToday ? ((Math.max(1, s.daily.streak) - 1) % 7) : (day - 1))],
      doubleAvailable: !!s.daily.doubleAvailable,
      lastReward: s.daily.lastReward || 0
    };
  },

  claimDaily: function () {
    var info = this.dailyInfo();
    if (info.claimedToday) return { ok: false, reason: 'claimed' };
    var s = this.s;
    s.daily.lastClaimDate = dateStr();
    s.daily.streak = info.nextStreak;
    s.daily.doubleAvailable = true;
    s.daily.lastReward = info.reward;
    s.coins += info.reward;
    this.save();
    Platform.reportEvent('daily_claim', { day: info.day, reward: info.reward, streak: info.nextStreak });
    return { ok: true, day: info.day, reward: info.reward };
  },

  doubleDaily: function () {
    var s = this.s;
    if (!s.daily.doubleAvailable) return { ok: false };
    var reward = s.daily.lastReward || 0;
    s.coins += reward;
    s.daily.doubleAvailable = false;
    this.save();
    Platform.reportEvent('ad_reward', { placement: 'daily_double', coins: reward });
    return { ok: true, reward: reward };
  },

  // ---------- 任务 ----------
  questAdd: function (key, n) {
    this.refresh();
    var p = this.s.quests.progress;
    if (p[key] === undefined) p[key] = 0;
    p[key] += n;
  },

  questList: function () {
    this.refresh();
    var list = [];
    var prog = this.s.quests.progress;
    var claimed = this.s.quests.claimed;
    for (var i = 0; i < CONFIG.quests.length; i++) {
      var q = CONFIG.quests[i];
      var cur = Math.min(prog[q.id] || 0, q.target);
      list.push({
        id: q.id,
        text: q.text,
        target: q.target,
        progress: cur,
        reward: q.reward,
        claimed: !!claimed[q.id],
        canClaim: cur >= q.target && !claimed[q.id]
      });
    }
    return list;
  },

  claimQuest: function (id) {
    var list = this.questList();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id && list[i].canClaim) {
        this.s.quests.claimed[id] = true;
        this.s.coins += list[i].reward;
        this.save();
        Platform.reportEvent('quest_claim', { id: id, reward: list[i].reward });
        return { ok: true, reward: list[i].reward };
      }
    }
    return { ok: false };
  },

  // ---------- 离线 ----------
  updateIdle: function () {
    var s = this.s;
    var rate = this.effects().idleRate;
    var now = Platform.now();
    var elapsedMin = Math.max(0, now - (s.idle.ts || now)) / 60000;
    if (rate > 0 && elapsedMin > 0) {
      var cap = rate * 60 * CONFIG.idle.maxOfflineHours;
      s.idle.pending = Math.min(cap, (s.idle.pending || 0) + rate * elapsedMin);
    }
    s.idle.ts = now;
  },

  idleInfo: function () {
    this.updateIdle();
    return {
      pending: Math.floor(this.s.idle.pending || 0),
      rate: this.effects().idleRate,
      max: Math.floor(this.effects().idleRate * 60 * CONFIG.idle.maxOfflineHours)
    };
  },

  collectIdle: function (doubled) {
    this.updateIdle();
    var base = Math.floor(this.s.idle.pending || 0);
    if (base < 1) return { ok: false, coins: 0 };
    var coins = doubled ? base * 2 : base;
    this.s.idle.pending = 0;
    this.s.coins += coins;
    this.save();
    Platform.reportEvent('idle_collect', { coins: coins, doubled: !!doubled });
    return { ok: true, coins: coins };
  },

  // ---------- 宝箱 ----------
  chestInfo: function () {
    var last = this.s.chest.lastClaim || 0;
    var remain = Math.max(0, CONFIG.chest.cooldownMs - (Platform.now() - last));
    return { ready: remain <= 0, remainMs: remain };
  },

  claimChest: function () {
    var info = this.chestInfo();
    if (!info.ready) return { ok: false };
    var span = CONFIG.chest.maxCoins - CONFIG.chest.minCoins;
    var coins = CONFIG.chest.minCoins + Math.round(Math.random() * span / 5) * 5;
    this.s.chest.lastClaim = Platform.now();
    this.s.coins += coins;
    this.save();
    Platform.reportEvent('ad_reward', { placement: 'free_chest', coins: coins });
    return { ok: true, coins: coins };
  },

  // ---------- 通用 ----------
  addCoins: function (n) {
    this.s.coins += n;
    this.save();
  },

  spend: function (n) {
    if (this.s.coins < n) return false;
    this.s.coins -= n;
    this.save();
    return true;
  },

  setSetting: function (key, value) {
    this.s.settings[key] = value;
    this.save();
  },

  markTutorialDone: function () {
    this.s.tutorialDone = true;
    this.save();
  },

  markInterstitial: function () {
    this.s.ad.lastInterstitial = Platform.now();
    this.save();
  },

  resetAll: function () {
    Storage.clear();
    this.s = Storage.defaults();
    this.save();
    return this.s;
  }
};

module.exports = State;
