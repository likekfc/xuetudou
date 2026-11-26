/*! 土豆削削乐 · WeChat MiniGame bundle · built 2026-11-26T07:45:43.812Z */
(function(){
"use strict";
var __defs = {};
var __cache = {};
function __resolve(from, spec){
  if (spec.charAt(0) !== ".") return spec;
  var parts = from.split("/"); parts.pop();
  var segs = spec.split("/");
  for (var i = 0; i < segs.length; i++) {
    var s = segs[i];
    if (!s || s === ".") continue;
    if (s === "..") parts.pop(); else parts.push(s);
  }
  return parts.join("/").replace(/\.js$/, "");
}
function __load(id){
  if (__cache[id]) return __cache[id].exports;
  var def = __defs[id];
  if (!def) throw new Error("Missing module: " + id);
  var module = { exports: {} };
  __cache[id] = module;
  def(module, module.exports, function(spec){ return __load(__resolve(id, spec)); });
  return module.exports;
}
__defs["main"] = function(module, exports, require){
/**
 * 入口：画布、主循环、场景切换、提示、演示广告。
 */
var CONFIG = require('./config');
var Platform = require('./platform');
var Economy = require('./economy');
var Sound = require('./audio');
var Ads = require('./ads');
var UI = require('./ui');
var T = UI.T;
var MenuScene = require('./scenes/menu');
var PlayScene = require('./scenes/play');

var Main = {
  platform: Platform,
  ctx: null,
  W: 0,
  H: 0,
  dpr: 1,
  scene: null,
  lastTs: 0,
  fade: 0,
  fadeDir: 0,
  pendingScene: null,
  toast: { text: '', color: T.ink, life: 0, ttl: 1.8 },
  adOverlay: null,
  adBtn: null,
  adSkip: null,
  started: false,

  boot: function () {
    var self = this;
    Economy.init();
    Sound.setMuted(!Economy.s.settings.sound);

    Platform.init({
      start: function (p) { self.onDown(p); },
      move: function (p) { self.onMove(p); },
      end: function (p) { self.onUp(p); }
    });
    this.ctx = Platform.ctx;
    this.W = Platform.W;
    this.H = Platform.H;
    this.dpr = Platform.dpr;

    Platform.onResize = function () {
      self.W = Platform.W;
      self.H = Platform.H;
      self.dpr = Platform.dpr;
      if (self.scene && self.scene.layout) self.scene.layout();
    };

    Ads.init({
      simRewarded: function (seconds, onDone, onAbort) {
        self.startSimAd('rewarded', seconds, onDone, onAbort);
      },
      simInterstitial: function (seconds, onDone, onAbort) {
        self.startSimAd('interstitial', seconds, onDone, onAbort);
      }
    });

    Platform.onHide(function () {
      Economy.save();
      if (self.scene && self.scene.onHide) self.scene.onHide();
    });
    Platform.onShow(function () {
      Economy.updateIdle();
    });

    if (!Platform.isWx) {
      window.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && self.scene && self.scene.onEscape) self.scene.onEscape();
      });
    }

    this.scene = new MenuScene(this);
    if (this.scene.enter) this.scene.enter();

    this.started = true;
    this.lastTs = 0;
    Platform.raf(function (ts) { self.frame(ts); });
  },

  frame: function (ts) {
    var self = this;
    var now = ts || Platform.now();
    if (!this.lastTs) this.lastTs = now;
    var dt = Math.min(0.05, Math.max(0, (now - this.lastTs) / 1000));
    this.lastTs = now;
    this.update(dt);
    this.render();
    Platform.raf(function (t) { self.frame(t); });
  },

  update: function (dt) {
    if (this.toast.life > 0) this.toast.life -= dt;

    if (this.fadeDir === 1) {
      this.fade += dt * 5.5;
      if (this.fade >= 1) {
        this.fade = 1;
        if (this.pendingScene) {
          this.scene = this.pendingScene;
          this.pendingScene = null;
          if (this.scene.enter) this.scene.enter();
        }
        this.fadeDir = -1;
      }
    } else if (this.fadeDir === -1) {
      this.fade -= dt * 5.5;
      if (this.fade <= 0) {
        this.fade = 0;
        this.fadeDir = 0;
      }
    }

    if (this.adOverlay) {
      var ad = this.adOverlay;
      if (ad.state === 'playing') {
        ad.left -= dt;
        if (ad.left <= 0) {
          ad.left = 0;
          ad.state = 'done';
        }
      }
      ad.t += dt;
    }

    if (this.scene && this.scene.update) this.scene.update(dt);
  },

  render: function () {
    var ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    if (this.scene && this.scene.render) this.scene.render(ctx);
    if (this.adOverlay) this.renderSimAd(ctx);
    this.renderToast(ctx);
    if (this.fade > 0) {
      ctx.fillStyle = 'rgba(29,19,12,' + this.fade + ')';
      ctx.fillRect(0, 0, this.W, this.H);
    }
  },

  switchScene: function (scene, instant) {
    if (instant) {
      this.scene = scene;
      if (scene.enter) scene.enter();
      return;
    }
    this.pendingScene = scene;
    this.fadeDir = 1;
    this.fade = Math.max(this.fade, 0.01);
  },

  startOrder: function () {
    if (this.fadeDir !== 0) return;
    Ads.hideBanner();
    this.switchScene(new PlayScene(this));
  },

  toMenu: function () {
    if (this.fadeDir !== 0) return;
    this.switchScene(new MenuScene(this));
  },

  onDown: function (p) {
    if (!this.started) return;
    Sound.init();
    Sound.resume();
    if (this.adOverlay) { this.onAdDown(p); return; }
    if (this.fadeDir !== 0) return;
    if (this.scene && this.scene.onDown) this.scene.onDown(p);
  },

  onMove: function (p) {
    if (this.adOverlay || this.fadeDir !== 0) return;
    if (this.scene && this.scene.onMove) this.scene.onMove(p);
  },

  onUp: function (p) {
    if (this.adOverlay) { this.onAdUp(p); return; }
    if (this.fadeDir !== 0) return;
    if (this.scene && this.scene.onUp) this.scene.onUp(p);
  },

  notify: function (text, color) {
    this.toast.text = text;
    this.toast.color = color || T.ink;
    this.toast.life = this.toast.ttl;
  },

  renderToast: function (ctx) {
    if (this.toast.life <= 0) return;
    var k = Math.min(1, (this.toast.ttl - this.toast.life) * 5);
    var a = Math.min(1, this.toast.life * 2.5);
    var size = 15;
    var w = UI.measure(ctx, this.toast.text, size, 700) + 34;
    var x = (this.W - w) / 2;
    var y = Platform.safeTop + 84;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(0, (1 - k) * -10);
    UI.fillRR(ctx, x, y, w, 38, 19, 'rgba(58,34,16,0.92)');
    UI.text(ctx, this.toast.text, this.W / 2, y + 19, size, '#FFF4DC', 'center', 700);
    ctx.restore();
  },

  rewarded: function (placement, onReward) {
    var self = this;
    Ads.showRewarded(placement, function () {
      Sound.reward();
      onReward();
    }, function () {
      self.notify('广告未完成，奖励没有发放');
    });
  },

  maybeInterstitial: function (after) {
    var s = Economy.s;
    if (s.ordersDone < CONFIG.ads.firstOrdersWithoutInterstitial) { after(); return; }
    if (s.ordersDone % CONFIG.ads.interstitialEveryOrders !== 0) { after(); return; }
    if (Platform.now() - (s.ad.lastInterstitial || 0) < CONFIG.ads.interstitialCooldownMs) { after(); return; }
    var self = this;
    Ads.showInterstitial('result_next', function () {
      Economy.markInterstitial();
      after();
    });
  },

  shareGame: function () {
    var ok = Platform.share('土豆削削乐｜拇指削皮，越削越上头', '来比比谁削得薄，浪费得少！', 'from=share');
    if (!ok) this.notify('请点击右上角「···」分享给好友');
    Platform.reportEvent('share_click', { ok: ok ? 1 : 0 });
  },

  // ---------- 演示广告 ----------
  startSimAd: function (kind, seconds, onDone, onAbort) {
    this.adOverlay = {
      kind: kind,
      total: seconds,
      left: seconds,
      state: 'playing',
      t: 0,
      onDone: onDone,
      onAbort: onAbort
    };
    this.adBtn = null;
    this.adSkip = null;
    Platform.reportEvent('ad_show_demo', { kind: kind });
  },

  finishSimAd: function (completed) {
    if (!this.adOverlay) return;
    var ad = this.adOverlay;
    this.adOverlay = null;
    this.adBtn = null;
    this.adSkip = null;
    if (ad.kind === 'rewarded') {
      if (completed) { if (ad.onDone) ad.onDone(); }
      else { if (ad.onAbort) ad.onAbort('skip'); }
    } else {
      if (ad.onDone) ad.onDone();
    }
  },

  renderSimAd: function (ctx) {
    var ad = this.adOverlay;
    var W = this.W;
    var H = this.H;
    UI.dim(ctx, W, H, 0.78);
    var cw = Math.min(W - 48, 370);
    var ch = Math.min(430, H - 140);
    var cx = (W - cw) / 2;
    var cy = (H - ch) / 2;

    ctx.save();
    UI.shadow(ctx, 'rgba(0,0,0,0.45)', 30, 0, 12);
    UI.fillRR(ctx, cx, cy, cw, ch, 24, '#FFF7E6');
    UI.clearShadow(ctx);

    // 顶部广告标识
    UI.pill(ctx, cx + 14, cy + 14, 96, 26, 'rgba(74,46,25,0.1)');
    UI.drawIcon(ctx, 'video', cx + 28, cy + 27, 14, T.inkSoft);
    UI.text(ctx, '演示广告', cx + 40, cy + 27, 12, T.inkSoft, 'left', 700);
    if (ad.state !== 'playing') {
      UI.text(ctx, ad.kind === 'rewarded' ? '激励视频' : '插屏广告', cx + cw - 16, cy + 27, 12, T.inkSoft, 'right', 700);
    }

    // 广告画面
    var ax = cx + 16;
    var ay = cy + 50;
    var aw = cw - 32;
    var ah = ch - 172;
    var g = ctx.createLinearGradient(ax, ay, ax, ay + ah);
    g.addColorStop(0, '#F9E7C4');
    g.addColorStop(1, '#E9C98E');
    UI.fillRR(ctx, ax, ay, aw, ah, 18, g);

    // 装饰土豆
    var pcx = ax + aw / 2;
    var pcy = ay + ah * 0.44;
    var pr = Math.min(aw * 0.24, ah * 0.32);
    ctx.save();
    ctx.translate(pcx, pcy);
    ctx.scale(1.12, 0.94);
    ctx.beginPath();
    ctx.arc(0, 0, pr, 0, Math.PI * 2);
    ctx.fillStyle = '#B0743E';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-pr * 0.36, -pr * 0.34, pr * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,235,190,0.5)';
    ctx.fill();
    // 削开的一块
    ctx.beginPath();
    ctx.arc(pr * 0.18, pr * 0.2, pr * 0.52, 0, Math.PI * 2);
    ctx.fillStyle = '#F8E6B4';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-pr * 0.12, -pr * 0.16, pr * 0.07, 0, Math.PI * 2);
    ctx.arc(pr * 0.22, -pr * 0.16, pr * 0.07, 0, Math.PI * 2);
    ctx.fillStyle = '#4A2E19';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(pr * 0.05, pr * 0.02, pr * 0.12, 0.2, Math.PI - 0.2);
    ctx.strokeStyle = '#4A2E19';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    UI.text(ctx, ad.kind === 'rewarded' ? '军需处补给提醒' : '削土豆也要休息一下', ax + aw / 2, ay + 28, 15, '#7E5A38', 'center', 800);
    UI.text(ctx, '土豆削削乐 · 看广告得土豆币', ax + aw / 2, ay + ah - 24, 12, 'rgba(94,58,28,0.75)', 'center', 600);

    // 倒计时
    if (ad.state === 'playing') {
      var sec = Math.ceil(ad.left);
      ctx.beginPath();
      ctx.arc(cx + cw / 2, cy + ch - 84, 22, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(74,46,25,0.08)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + cw / 2, cy + ch - 84, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - ad.left / ad.total));
      ctx.strokeStyle = T.green;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.stroke();
      UI.text(ctx, String(sec), cx + cw / 2, cy + ch - 84, 18, T.ink, 'center', 800);
      UI.text(ctx, '广告播放中…', cx + cw / 2, cy + ch - 46, 13, T.inkSoft, 'center', 600);

      // 跳过
      var skx = cx + cw - 30;
      var sky = cy + 27;
      UI.text(ctx, '跳过', skx - 12, sky + 1, 12, T.inkSoft, 'right', 700);
      this.adSkip = { x: cx + cw - 74, y: cy + 10, w: 64, h: 34 };
    } else {
      var bw = Math.min(220, cw - 60);
      var bx = cx + (cw - bw) / 2;
      var by = cy + ch - 108;
      var btn = UI.makeButton({
        x: bx, y: by, w: bw, h: 50, radius: 16,
        label: ad.kind === 'rewarded' ? '领取奖励' : '关闭广告',
        kind: ad.kind === 'rewarded' ? 'primary' : 'secondary',
        size: 17
      });
      UI.button(ctx, btn);
      this.adBtn = btn;
      if (ad.kind === 'rewarded') {
        UI.text(ctx, '完整观看后奖励自动到账', cx + cw / 2, cy + ch - 38, 12, T.inkSoft, 'center', 600);
      }
    }

    ctx.restore();
  },

  onAdDown: function (p) {
    var ad = this.adOverlay;
    if (!ad) return;
    if (ad.state === 'done' && this.adBtn && UI.hit(this.adBtn, p.x, p.y)) {
      this.adBtn.pressed = true;
    } else if (ad.state === 'playing' && this.adSkip && UI.hit(this.adSkip, p.x, p.y)) {
      this.adSkip.pressed = true;
    }
  },

  onAdUp: function (p) {
    var ad = this.adOverlay;
    if (!ad) return;
    if (ad.state === 'done' && this.adBtn && UI.hit(this.adBtn, p.x, p.y)) {
      this.adBtn.pressed = false;
      this.finishSimAd(true);
      return;
    }
    if (ad.state === 'playing' && this.adSkip && UI.hit(this.adSkip, p.x, p.y)) {
      this.adSkip.pressed = false;
      this.finishSimAd(false);
      return;
    }
    if (this.adBtn) this.adBtn.pressed = false;
    if (this.adSkip) this.adSkip.pressed = false;
  }
};

Main.boot();

};
__defs["config"] = function(module, exports, require){
/**
 * 全局配置：数值、广告位、文案。
 * 上线前把 ads.enabled 改为 true，并填入微信流量主后台的真实广告位 ID。
 */
var CONFIG = {
  version: '1.0.0',
  title: '土豆削削乐',
  tagline: '拇指削皮 · 越削越上头',
  saveKey: 'potato_please_save_v1',

  ads: {
    enabled: false,
    rewardedAdUnitId: '',
    interstitialAdUnitId: '',
    bannerAdUnitId: '',
    // 演示模式：未配置广告位时用内置演示广告，保证变现流程可体验
    demoAds: true,
    demoRewardedSeconds: 5,
    demoInterstitialSeconds: 3,
    // 插屏：每完成 N 单触发一次，且距离上次至少 90 秒；首单不打扰
    interstitialEveryOrders: 3,
    interstitialCooldownMs: 90000,
    firstOrdersWithoutInterstitial: 2
  },

  play: {
    grid: 88,
    stampStep: 2.3,
    baseBrush: 16.5,
    brushPerKnife: 1.05,
    // 同一块果肉被反复刮到的“深度”，超过阈值才算浪费
    wasteDepthBase: 56,
    wasteDepthPerGlove: 2.0,
    targetBase: 0.86,
    targetPerOrder: 0.003,
    targetMax: 0.9,
    completeDelay: 0.18
  },

  order: {
    timeBase: 44,
    timePerPotato: 16,
    timePerHourglass: 6,
    baseCoins: 20,
    coinsPerOrder: 9,
    coinsPerPotato: 4,
    goldenEvery: 5,
    goldenPeel: 0.95,
    maxPotatoes: 7
  },

  grades: [
    { key: 'S', name: '完美', minWaste: 0, maxWaste: 0.02, mul: 1.7, color: '#F2B84B' },
    { key: 'A', name: '优秀', minWaste: 0.02, maxWaste: 0.045, mul: 1.35, color: '#7FB069' },
    { key: 'B', name: '合格', minWaste: 0.045, maxWaste: 0.08, mul: 1.12, color: '#8AA6C0' },
    { key: 'C', name: '勉强', minWaste: 0.08, maxWaste: 1, mul: 0.92, color: '#B08B6E' }
  ],

  upgrades: [
    {
      id: 'knife',
      name: '削皮刀',
      icon: 'knife',
      max: 10,
      start: 1,
      baseCost: 100,
      growth: 1.55,
      brief: '削皮更宽，一刀带走更多皮'
    },
    {
      id: 'gloves',
      name: '防割手套',
      icon: 'gloves',
      max: 8,
      start: 0,
      baseCost: 150,
      growth: 1.62,
      brief: '减少手滑，浪费判定更宽容'
    },
    {
      id: 'bucket',
      name: '军需木桶',
      icon: 'bucket',
      max: 10,
      start: 1,
      baseCost: 130,
      growth: 1.6,
      brief: '每单土豆币收益提升'
    },
    {
      id: 'machine',
      name: '自动削皮机',
      icon: 'machine',
      max: 10,
      start: 0,
      baseCost: 240,
      growth: 1.66,
      brief: '离线也在替你削土豆，持续产出'
    },
    {
      id: 'hourglass',
      name: '加时沙漏',
      icon: 'hourglass',
      max: 5,
      start: 0,
      baseCost: 180,
      growth: 1.72,
      brief: '每张军需订单额外增加时间'
    }
  ],

  dailyRewards: [30, 40, 55, 70, 90, 120, 180],

  quests: [
    { id: 'orders', text: '完成 2 张军需订单', target: 2, reward: 35 },
    { id: 'potatoes', text: '削完 10 个土豆', target: 10, reward: 40 },
    { id: 'sgrade', text: '获得 1 次 S 评级', target: 1, reward: 55 },
    { id: 'waste', text: '单颗浪费低于 1.5%', target: 1, reward: 45 }
  ],

  idle: {
    coinsPerMinutePerLevel: 3,
    maxOfflineHours: 8
  },

  chest: {
    cooldownMs: 3 * 60 * 60 * 1000,
    minCoins: 45,
    maxCoins: 90
  },

  theme: {
    bgTop: '#F9EBCB',
    bgBottom: '#E7CFA3',
    wall: '#F3E2C2',
    wallLine: '#E2CBA4',
    counter: '#C08A50',
    counterDark: '#9A6738',
    ink: '#4A2E19',
    inkSoft: '#7E5A38',
    cream: '#FFF8E8',
    skin: '#B87A42',
    skinDark: '#7E4A20',
    flesh: '#F8E6B4',
    fleshDark: '#E4C07C',
    green: '#6FA85E',
    greenDark: '#4C7E40',
    gold: '#F2B84B',
    goldDark: '#C98B24',
    red: '#D9694F',
    blue: '#6C9FC4',
    white: '#FFFFFF',
    shadow: 'rgba(70,40,15,0.18)'
  }
};

module.exports = CONFIG;

};
__defs["platform"] = function(module, exports, require){
/**
 * 平台适配层：同一套代码跑在微信小游戏与浏览器里。
 */
var isWx = typeof wx !== 'undefined' && typeof wx.createCanvas === 'function';

var Platform = {
  isWx: isWx,
  canvas: null,
  ctx: null,
  W: 0,
  H: 0,
  dpr: 1,
  safeTop: 0,
  safeBottom: 0,
  _touches: null,

  init: function (touchHandlers) {
    var info = this._windowInfo();
    this.dpr = Math.min(info.pixelRatio || 1, 2.5);
    this.W = info.windowWidth;
    this.H = info.windowHeight;
    this.safeTop = info.safeTop || 0;
    this.safeBottom = info.safeBottom || 0;

    if (isWx) {
      this.canvas = wx.createCanvas();
    } else {
      this.canvas = document.getElementById('game');
      if (!this.canvas) {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'game';
        document.body.appendChild(this.canvas);
      }
      this.W = Math.round(this.canvas.getBoundingClientRect().width) || info.windowWidth;
      this.H = Math.round(this.canvas.getBoundingClientRect().height) || info.windowHeight;
    }

    this.canvas.width = Math.floor(this.W * this.dpr);
    this.canvas.height = Math.floor(this.H * this.dpr);
    this.ctx = this.canvas.getContext('2d');

    this._bindTouch(touchHandlers || {});
    this._bindResize();

    if (isWx && wx.setKeepScreenOn) {
      try { wx.setKeepScreenOn({ keepScreenOn: true }); } catch (e) {}
    }
    return this;
  },

  _windowInfo: function () {
    if (isWx) {
      var info = null;
      try {
        info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      } catch (e) {
        info = { windowWidth: 375, windowHeight: 667, pixelRatio: 2 };
      }
      var safe = info.safeArea || null;
      return {
        windowWidth: info.windowWidth,
        windowHeight: info.windowHeight,
        pixelRatio: info.pixelRatio,
        safeTop: safe ? Math.max(0, safe.top) : 0,
        safeBottom: safe ? Math.max(0, info.windowHeight - safe.bottom) : 0
      };
    }
    var w = window.innerWidth;
    var h = window.innerHeight;
    var el = document.getElementById('game');
    if (el) {
      var r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) { w = r.width; h = r.height; }
    }
    return { windowWidth: w, windowHeight: h, pixelRatio: window.devicePixelRatio || 1, safeTop: 0, safeBottom: 0 };
  },

  resize: function () {
    var info = this._windowInfo();
    this.dpr = Math.min(info.pixelRatio || 1, 2.5);
    if (isWx) {
      this.W = info.windowWidth;
      this.H = info.windowHeight;
    } else {
      var r = this.canvas.getBoundingClientRect();
      this.W = Math.round(r.width) || info.windowWidth;
      this.H = Math.round(r.height) || info.windowHeight;
    }
    this.safeTop = info.safeTop;
    this.safeBottom = info.safeBottom;
    this.canvas.width = Math.floor(this.W * this.dpr);
    this.canvas.height = Math.floor(this.H * this.dpr);
  },

  _bindResize: function () {
    var self = this;
    if (isWx) {
      if (wx.onWindowResize) {
        wx.onWindowResize(function () { self.resize(); if (self.onResize) self.onResize(); });
      }
    } else {
      window.addEventListener('resize', function () { self.resize(); if (self.onResize) self.onResize(); });
      window.addEventListener('orientationchange', function () {
        setTimeout(function () { self.resize(); if (self.onResize) self.onResize(); }, 120);
      });
    }
  },

  _bindTouch: function (h) {
    var self = this;
    function point(t) {
      return { x: t.clientX != null ? t.clientX : t.x, y: t.clientY != null ? t.clientY : t.y };
    }
    if (isWx) {
      wx.onTouchStart(function (e) {
        var t = e.touches && e.touches[0];
        if (!t) return;
        self._touches = e.touches;
        if (h.start) h.start(point(t));
      });
      wx.onTouchMove(function (e) {
        var t = e.touches && e.touches[0];
        if (!t) return;
        if (h.move) h.move(point(t));
      });
      wx.onTouchEnd(function (e) {
        var t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
        if (t && h.end) h.end(point(t));
      });
      wx.onTouchCancel(function (e) {
        var t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
        if (t && h.end) h.end(point(t));
      });
    } else {
      var dragging = false;
      var toLocal = function (ev) {
        var r = self.canvas.getBoundingClientRect();
        return {
          x: (ev.clientX - r.left) * (self.W / r.width),
          y: (ev.clientY - r.top) * (self.H / r.height)
        };
      };
      this.canvas.addEventListener('pointerdown', function (ev) {
        ev.preventDefault();
        dragging = true;
        if (self.canvas.setPointerCapture) {
          try { self.canvas.setPointerCapture(ev.pointerId); } catch (e) {}
        }
        if (h.start) h.start(toLocal(ev));
      });
      this.canvas.addEventListener('pointermove', function (ev) {
        if (!dragging) return;
        ev.preventDefault();
        if (h.move) h.move(toLocal(ev));
      });
      var up = function (ev) {
        if (!dragging) return;
        dragging = false;
        if (h.end) h.end(toLocal(ev));
      };
      this.canvas.addEventListener('pointerup', up);
      this.canvas.addEventListener('pointercancel', up);
      this.canvas.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
    }
  },

  onHide: function (cb) {
    if (isWx && wx.onHide) { try { wx.onHide(cb); } catch (e) {} }
    else if (!isWx) {
      document.addEventListener('visibilitychange', function () { if (document.hidden) cb(); });
    }
  },

  onShow: function (cb) {
    if (isWx && wx.onShow) { try { wx.onShow(cb); } catch (e) {} }
    else if (!isWx) {
      document.addEventListener('visibilitychange', function () { if (!document.hidden) cb(); });
    }
  },

  createOffscreen: function (w, h) {
    var c;
    if (isWx) c = wx.createCanvas();
    else c = document.createElement('canvas');
    c.width = Math.max(1, Math.floor(w));
    c.height = Math.max(1, Math.floor(h));
    return c;
  },

  getStorage: function (key) {
    try {
      if (isWx) return wx.getStorageSync(key);
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : '';
    } catch (e) { return ''; }
  },

  setStorage: function (key, value) {
    try {
      if (isWx) { wx.setStorageSync(key, value); return true; }
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) { return false; }
  },

  haptic: function (type) {
    if (isWx) {
      try {
        if (wx.vibrateShort) wx.vibrateShort({ type: type || 'light' });
      } catch (e) {}
      return;
    }
    if (navigator.vibrate) {
      try { navigator.vibrate(type === 'heavy' ? 24 : 10); } catch (e) {}
    }
  },

  share: function (title, text, query) {
    if (isWx && wx.shareAppMessage) {
      try {
        wx.shareAppMessage({ title: title, query: query || '' });
        return true;
      } catch (e) {}
    }
    if (!isWx && navigator.share) {
      try {
        navigator.share({ title: title, text: text || title, url: location.href });
        return true;
      } catch (e) {}
    }
    return false;
  },

  reportEvent: function (name, data) {
    if (isWx && wx.reportEvent) {
      try { wx.reportEvent(name, data || {}); return; } catch (e) {}
    }
    if (!isWx && typeof console !== 'undefined') {
      console.log('[event]', name, data || {});
    }
  },

  now: function () {
    return Date.now();
  },

  raf: function (fn) {
    if (isWx) return requestAnimationFrame(fn);
    return window.requestAnimationFrame(fn);
  },

  openSetting: function () {
    if (isWx && wx.openSetting) { try { wx.openSetting({}); } catch (e) {} }
  }
};

module.exports = Platform;

};
__defs["economy"] = function(module, exports, require){
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

};
__defs["storage"] = function(module, exports, require){
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

};
__defs["audio"] = function(module, exports, require){
/**
 * 轻量合成音效：不依赖任何音频文件，减小包体。
 * 首次触摸时初始化，兼容浏览器与微信小游戏 WebAudio。
 */
var Platform = require('./platform');

var Sound = {
  ctx: null,
  master: null,
  noiseBuf: null,
  muted: false,
  lastPeel: 0,

  init: function () {
    if (this.ctx) return;
    try {
      if (Platform.isWx) {
        if (!wx.createWebAudioContext) return;
        this.ctx = wx.createWebAudioContext();
      } else {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);

      var rate = this.ctx.sampleRate || 44100;
      var len = Math.floor(rate * 0.5);
      this.noiseBuf = this.ctx.createBuffer(1, len, rate);
      var data = this.noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } catch (e) {
      this.ctx = null;
    }
  },

  resume: function () {
    if (this.ctx && this.ctx.resume) {
      try {
        if (this.ctx.state === 'suspended') this.ctx.resume();
      } catch (e) {}
    }
  },

  setMuted: function (m) {
    this.muted = !!m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  },

  _tone: function (freq, to, dur, type, gain, delay) {
    if (!this.ctx || this.muted) return;
    try {
      var t0 = this.ctx.currentTime + (delay || 0);
      var osc = this.ctx.createOscillator();
      var g = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (to && to !== freq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
      }
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain || 0.07), t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.03);
    } catch (e) {}
  },

  tap: function () {
    this._tone(620, 760, 0.06, 'sine', 0.055);
  },

  peel: function () {
    if (!this.ctx || this.muted || !this.noiseBuf) return;
    var now = Platform.now();
    if (now - this.lastPeel < 55) return;
    this.lastPeel = now;
    try {
      var t0 = this.ctx.currentTime;
      var src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.playbackRate.value = 0.85 + Math.random() * 0.6;
      var filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 900 + Math.random() * 1100;
      filter.Q.value = 0.9;
      var g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.025, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      src.start(t0);
      src.stop(t0 + 0.11);
    } catch (e) {}
  },

  complete: function () {
    this._tone(523, 523, 0.16, 'triangle', 0.06, 0);
    this._tone(659, 659, 0.16, 'triangle', 0.06, 0.07);
    this._tone(784, 784, 0.24, 'triangle', 0.06, 0.14);
  },

  coin: function () {
    this._tone(988, 988, 0.08, 'square', 0.035, 0);
    this._tone(1319, 1319, 0.12, 'square', 0.03, 0.06);
  },

  reward: function () {
    this._tone(523, 523, 0.12, 'sine', 0.06, 0);
    this._tone(659, 659, 0.12, 'sine', 0.06, 0.09);
    this._tone(784, 784, 0.12, 'sine', 0.06, 0.18);
    this._tone(1047, 1047, 0.3, 'sine', 0.07, 0.27);
  },

  upgrade: function () {
    this._tone(440, 880, 0.22, 'triangle', 0.06, 0);
    this._tone(660, 1320, 0.22, 'sine', 0.04, 0.06);
  },

  fail: function () {
    this._tone(240, 90, 0.45, 'sawtooth', 0.055, 0);
    this._tone(180, 70, 0.5, 'triangle', 0.045, 0.1);
  },

  star: function () {
    this._tone(880, 880, 0.1, 'sine', 0.05, 0);
    this._tone(1108, 1108, 0.12, 'sine', 0.045, 0.08);
    this._tone(1318, 1318, 0.2, 'sine', 0.05, 0.16);
  }
};

module.exports = Sound;

};
__defs["ads"] = function(module, exports, require){
/**
 * 微信广告封装：激励视频 / 插屏 / Banner。
 * 未配置广告位或运行在浏览器时，走“演示广告”，保证变现链路可完整体验。
 */
var CONFIG = require('./config');
var Platform = require('./platform');

var Ads = {
  simRewarded: null,
  simInterstitial: null,
  rewarded: null,
  interstitial: null,
  banner: null,
  bannerWanted: false,
  rewardPending: null,
  interPending: null,

  init: function (handlers) {
    handlers = handlers || {};
    this.simRewarded = handlers.simRewarded || null;
    this.simInterstitial = handlers.simInterstitial || null;
    if (Platform.isWx && wx.showShareMenu) {
      try { wx.showShareMenu({ withShareTicket: false, menus: ['shareAppMessage', 'shareTimeline'] }); } catch (e) {}
    }
  },

  isDemo: function () {
    return !(CONFIG.ads.enabled && Platform.isWx && CONFIG.ads.rewardedAdUnitId);
  },

  hasRealRewarded: function () {
    return CONFIG.ads.enabled && Platform.isWx && !!CONFIG.ads.rewardedAdUnitId && !!wx.createRewardedVideoAd;
  },

  showRewarded: function (placement, onReward, onFail) {
    var self = this;
    Platform.reportEvent('ad_request', { placement: placement, demo: this.hasRealRewarded() ? 0 : 1 });
    if (!this.hasRealRewarded()) {
      if (CONFIG.ads.demoAds && this.simRewarded) {
        this.simRewarded(CONFIG.ads.demoRewardedSeconds, function () {
          Platform.reportEvent('ad_reward', { placement: placement, demo: 1 });
          if (onReward) onReward();
        }, function (reason) {
          Platform.reportEvent('ad_fail', { placement: placement, reason: reason || 'abort' });
          if (onFail) onFail('abort');
        });
        return;
      }
      if (onFail) onFail('unavailable');
      return;
    }

    var ad = this._ensureRewarded();
    if (!ad) { if (onFail) onFail('unavailable'); return; }
    if (this.rewardPending) { if (onFail) onFail('busy'); return; }
    this.rewardPending = { onReward: onReward, onFail: onFail, placement: placement };

    function fail(reason) {
      var p = self.rewardPending;
      self.rewardPending = null;
      if (p && p.onFail) p.onFail(reason);
    }

    ad.show().catch(function () {
      ad.load().then(function () {
        return ad.show();
      }).catch(function () {
        fail('show_failed');
      });
    });
    // onClose / onError 在 _ensureRewarded 中统一处理
  },

  _ensureRewarded: function () {
    if (this.rewarded) return this.rewarded;
    var self = this;
    try {
      var ad = wx.createRewardedVideoAd({ adUnitId: CONFIG.ads.rewardedAdUnitId });
      ad.onClose(function (res) {
        var p = self.rewardPending;
        self.rewardPending = null;
        if (!p) return;
        var finished = !(res && res.isEnded === false);
        if (finished) {
          Platform.reportEvent('ad_complete', { placement: p.placement });
          if (p.onReward) p.onReward();
        } else {
          Platform.reportEvent('ad_fail', { placement: p.placement, reason: 'skip' });
          if (p.onFail) p.onFail('skip');
        }
      });
      ad.onError(function (err) {
        var p = self.rewardPending;
        self.rewardPending = null;
        Platform.reportEvent('ad_fail', { placement: p ? p.placement : '', reason: 'error', code: err && err.errCode });
        if (p && p.onFail) p.onFail('error');
      });
      this.rewarded = ad;
      return ad;
    } catch (e) {
      return null;
    }
  },

  showInterstitial: function (placement, onDone) {
    var self = this;
    var done = function () {
      if (onDone) onDone();
      onDone = null;
    };
    if (!(CONFIG.ads.enabled && Platform.isWx && CONFIG.ads.interstitialAdUnitId && wx.createInterstitialAd)) {
      if (CONFIG.ads.demoAds && this.simInterstitial) {
        this.simInterstitial(CONFIG.ads.demoInterstitialSeconds, done, done);
        return;
      }
      done();
      return;
    }
    var ad = this._ensureInterstitial();
    if (!ad) { done(); return; }
    this.interPending = { onDone: done, placement: placement };
    ad.show().catch(function () {
      ad.load().then(function () { return ad.show(); }).catch(function () {
        var p = self.interPending;
        self.interPending = null;
        if (p) p.onDone();
      });
    });
  },

  _ensureInterstitial: function () {
    if (this.interstitial) return this.interstitial;
    var self = this;
    try {
      var ad = wx.createInterstitialAd({ adUnitId: CONFIG.ads.interstitialAdUnitId });
      ad.onClose(function () {
        var p = self.interPending;
        self.interPending = null;
        if (p) p.onDone();
      });
      ad.onError(function () {
        var p = self.interPending;
        self.interPending = null;
        if (p) p.onDone();
      });
      this.interstitial = ad;
      return ad;
    } catch (e) {
      return null;
    }
  },

  showBanner: function () {
    this.bannerWanted = true;
    if (!(CONFIG.ads.enabled && Platform.isWx && CONFIG.ads.bannerAdUnitId && wx.createBannerAd)) return;
    var self = this;
    try {
      if (!this.banner) {
        var info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
        var safeBottom = info.safeArea ? Math.max(0, info.windowHeight - info.safeArea.bottom) : 0;
        this.banner = wx.createBannerAd({
          adUnitId: CONFIG.ads.bannerAdUnitId,
          adIntervals: 45,
          style: {
            left: 0,
            top: info.windowHeight - 100,
            width: Math.min(info.windowWidth, 400)
          }
        });
        this.banner.onResize(function (res) {
          var win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
          var sb = win.safeArea ? Math.max(0, win.windowHeight - win.safeArea.bottom) : 0;
          self.banner.style.top = win.windowHeight - res.height - sb;
          self.banner.style.left = Math.max(0, (win.windowWidth - res.width) / 2);
        });
        this.banner.onError(function () {});
      }
      if (this.bannerWanted) this.banner.show().catch(function () {});
    } catch (e) {}
  },

  hideBanner: function () {
    this.bannerWanted = false;
    if (this.banner) {
      try { this.banner.hide(); } catch (e) {}
    }
  }
};

module.exports = Ads;

};
__defs["ui"] = function(module, exports, require){
/**
 * 绘图工具与控件：圆角、按钮、图标、金币、进度条、文字。
 * 全部矢量绘制，不依赖图片资源。
 */
var CONFIG = require('./config');
var T = CONFIG.theme;

function font(size, weight) {
  return (weight || 700) + ' ' + size + 'px "PingFang SC","Microsoft YaHei","Helvetica Neue",Arial,sans-serif';
}

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r == null ? 12 : r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function fillRR(ctx, x, y, w, h, r, fill) {
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function strokeRR(ctx, x, y, w, h, r, color, width) {
  rr(ctx, x, y, w, h, r);
  ctx.strokeStyle = color;
  ctx.lineWidth = width || 1;
  ctx.stroke();
}

function text(ctx, str, x, y, size, color, align, weight, baseline) {
  ctx.font = font(size, weight);
  ctx.fillStyle = color || T.ink;
  ctx.textAlign = align || 'center';
  ctx.textBaseline = baseline || 'middle';
  ctx.fillText(str, x, y);
}

function measure(ctx, str, size, weight) {
  ctx.font = font(size, weight);
  return ctx.measureText(str).width;
}

function shadow(ctx, color, blur, ox, oy) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetX = ox || 0;
  ctx.shadowOffsetY = oy || 0;
}

function clearShadow(ctx) {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

function dim(ctx, W, H, alpha) {
  ctx.fillStyle = 'rgba(30,18,8,' + (alpha == null ? 0.55 : alpha) + ')';
  ctx.fillRect(0, 0, W, H);
}

function ellipse(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(rx, ry);
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.restore();
}

function starPath(ctx, x, y, r, inner, points) {
  points = points || 5;
  inner = inner || r * 0.45;
  ctx.beginPath();
  for (var i = 0; i < points * 2; i++) {
    var a = -Math.PI / 2 + i * Math.PI / points;
    var rad = i % 2 === 0 ? r : inner;
    var px = x + Math.cos(a) * rad;
    var py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawCoin(ctx, x, y, r, glow) {
  ctx.save();
  if (glow) {
    ctx.beginPath();
    ctx.arc(x, y, r * 1.9, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(242,184,75,0.18)';
    ctx.fill();
  }
  var g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
  g.addColorStop(0, '#FFDA7A');
  g.addColorStop(0.55, '#F2B84B');
  g.addColorStop(1, '#C98B24');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.strokeStyle = '#A66D15';
  ctx.stroke();

  // 内圈土豆浮雕
  ctx.save();
  ctx.translate(x, y + r * 0.03);
  ctx.scale(r * 0.56, r * 0.46);
  ctx.beginPath();
  ctx.moveTo(-1, 0);
  ctx.bezierCurveTo(-1, -0.82, -0.55, -1.02, 0, -1.0);
  ctx.bezierCurveTo(0.62, -0.98, 1.02, -0.62, 1.0, -0.05);
  ctx.bezierCurveTo(0.98, 0.56, 0.52, 1.0, -0.03, 0.98);
  ctx.bezierCurveTo(-0.58, 0.96, -1, 0.56, -1, 0);
  ctx.closePath();
  ctx.fillStyle = 'rgba(122,72,20,0.55)';
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(x - r * 0.32, y - r * 0.35, r * 0.18, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fill();
  ctx.restore();
}

function drawIcon(ctx, name, x, y, s, color) {
  var c = color || T.ink;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = c;
  ctx.fillStyle = c;
  ctx.lineWidth = Math.max(1.6, s * 0.09);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  var h = s / 2;

  if (name === 'coin') {
    drawCoin(ctx, 0, 0, s * 0.46);
  } else if (name === 'knife') {
    ctx.beginPath();
    ctx.moveTo(-h * 0.75, h * 0.42);
    ctx.quadraticCurveTo(-h * 0.1, -h * 0.9, h * 0.92, -h * 0.42);
    ctx.lineTo(h * 0.22, h * 0.25);
    ctx.closePath();
    ctx.fillStyle = '#DCE4EA';
    ctx.fill();
    ctx.strokeStyle = '#7B8794';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-h * 0.68, h * 0.35);
    ctx.lineTo(-h * 0.25, h * 0.72);
    ctx.strokeStyle = '#7A4A22';
    ctx.lineWidth = s * 0.16;
    ctx.stroke();
  } else if (name === 'gloves') {
    ctx.beginPath();
    ctx.moveTo(-h * 0.62, h * 0.15);
    ctx.lineTo(-h * 0.62, -h * 0.25);
    ctx.quadraticCurveTo(-h * 0.62, -h * 0.62, -h * 0.2, -h * 0.62);
    ctx.lineTo(h * 0.2, -h * 0.62);
    ctx.quadraticCurveTo(h * 0.65, -h * 0.62, h * 0.65, -h * 0.15);
    ctx.lineTo(h * 0.65, h * 0.32);
    ctx.quadraticCurveTo(h * 0.2, h * 0.7, -h * 0.15, h * 0.4);
    ctx.lineTo(-h * 0.25, -h * 0.25);
    ctx.lineTo(-h * 0.62, h * 0.15);
    ctx.closePath();
    ctx.fillStyle = '#8FB6C9';
    ctx.fill();
    ctx.strokeStyle = '#4F7285';
    ctx.stroke();
  } else if (name === 'bucket') {
    ctx.beginPath();
    ctx.moveTo(-h * 0.55, -h * 0.35);
    ctx.lineTo(h * 0.55, -h * 0.35);
    ctx.lineTo(h * 0.38, h * 0.62);
    ctx.lineTo(-h * 0.38, h * 0.62);
    ctx.closePath();
    ctx.fillStyle = '#C08A50';
    ctx.fill();
    ctx.strokeStyle = '#7E5528';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -h * 0.35, h * 0.58, Math.PI * 1.05, Math.PI * 1.95);
    ctx.strokeStyle = '#7E5528';
    ctx.stroke();
  } else if (name === 'machine') {
    fillRR(ctx, -h * 0.7, -h * 0.32, h * 1.4, h * 0.82, h * 0.14, '#9DB2C0');
    ctx.strokeStyle = '#5D7484';
    ctx.strokeRect(-h * 0.7, -h * 0.32, h * 1.4, h * 0.82);
    ctx.beginPath();
    ctx.arc(0, h * 0.08, h * 0.27, 0, Math.PI * 2);
    ctx.fillStyle = '#E9F0F4';
    ctx.fill();
    ctx.strokeStyle = '#5D7484';
    ctx.stroke();
    for (var i = 0; i < 4; i++) {
      var a = i * Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * h * 0.3, h * 0.08 + Math.sin(a) * h * 0.3);
      ctx.lineTo(Math.cos(a) * h * 0.4, h * 0.08 + Math.sin(a) * h * 0.4);
      ctx.stroke();
    }
  } else if (name === 'hourglass') {
    ctx.beginPath();
    ctx.moveTo(-h * 0.48, -h * 0.62);
    ctx.lineTo(h * 0.48, -h * 0.62);
    ctx.lineTo(-h * 0.48, h * 0.62);
    ctx.lineTo(h * 0.48, h * 0.62);
    ctx.closePath();
    ctx.fillStyle = 'rgba(242,184,75,0.45)';
    ctx.fill();
    ctx.strokeStyle = c;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-h * 0.62, -h * 0.62);
    ctx.lineTo(h * 0.62, -h * 0.62);
    ctx.moveTo(-h * 0.62, h * 0.62);
    ctx.lineTo(h * 0.62, h * 0.62);
    ctx.stroke();
  } else if (name === 'gear') {
    ctx.beginPath();
    ctx.arc(0, 0, h * 0.44, 0, Math.PI * 2);
    ctx.stroke();
    for (var j = 0; j < 8; j++) {
      var ang = j * Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * h * 0.44, Math.sin(ang) * h * 0.44);
      ctx.lineTo(Math.cos(ang) * h * 0.72, Math.sin(ang) * h * 0.72);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, h * 0.15, 0, Math.PI * 2);
    ctx.stroke();
  } else if (name === 'sound' || name === 'soundOff') {
    ctx.beginPath();
    ctx.moveTo(-h * 0.6, -h * 0.2);
    ctx.lineTo(-h * 0.25, -h * 0.2);
    ctx.lineTo(h * 0.08, -h * 0.55);
    ctx.lineTo(h * 0.08, h * 0.55);
    ctx.lineTo(-h * 0.25, h * 0.2);
    ctx.lineTo(-h * 0.6, h * 0.2);
    ctx.closePath();
    ctx.fill();
    if (name === 'sound') {
      ctx.beginPath();
      ctx.arc(h * 0.12, 0, h * 0.48, -Math.PI * 0.32, Math.PI * 0.32);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(h * 0.12, 0, h * 0.82, -Math.PI * 0.28, Math.PI * 0.28);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(h * 0.32, -h * 0.32);
      ctx.lineTo(h * 0.85, h * 0.32);
      ctx.moveTo(h * 0.85, -h * 0.32);
      ctx.lineTo(h * 0.32, h * 0.32);
      ctx.stroke();
    }
  } else if (name === 'share') {
    ctx.beginPath();
    ctx.arc(-h * 0.52, 0, h * 0.2, 0, Math.PI * 2);
    ctx.moveTo(h * 0.55, -h * 0.52);
    ctx.arc(h * 0.55, -h * 0.52, h * 0.2, 0, Math.PI * 2);
    ctx.moveTo(h * 0.55, h * 0.52);
    ctx.arc(h * 0.55, h * 0.52, h * 0.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-h * 0.34, -h * 0.08);
    ctx.lineTo(h * 0.37, -h * 0.42);
    ctx.moveTo(-h * 0.34, h * 0.08);
    ctx.lineTo(h * 0.37, h * 0.42);
    ctx.stroke();
  } else if (name === 'shop') {
    ctx.beginPath();
    ctx.moveTo(-h * 0.6, -h * 0.3);
    ctx.lineTo(h * 0.6, -h * 0.3);
    ctx.lineTo(h * 0.48, h * 0.62);
    ctx.lineTo(-h * 0.48, h * 0.62);
    ctx.closePath();
    ctx.fillStyle = '#E8B26B';
    ctx.fill();
    ctx.strokeStyle = '#8E5F27';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -h * 0.3, h * 0.34, Math.PI, Math.PI * 2);
    ctx.strokeStyle = '#8E5F27';
    ctx.stroke();
  } else if (name === 'calendar') {
    fillRR(ctx, -h * 0.62, -h * 0.5, h * 1.24, h * 1.14, h * 0.12, '#FFF3D9');
    ctx.strokeStyle = c;
    ctx.strokeRect(-h * 0.62, -h * 0.5, h * 1.24, h * 1.14);
    ctx.beginPath();
    ctx.moveTo(-h * 0.62, -h * 0.18);
    ctx.lineTo(h * 0.62, -h * 0.18);
    ctx.stroke();
    ctx.fillStyle = T.red;
    ctx.fillRect(-h * 0.62, -h * 0.5, h * 1.24, h * 0.2);
    ctx.fillStyle = T.ink;
    ctx.fillRect(-h * 0.36, -h * 0.72, h * 0.12, h * 0.3);
    ctx.fillRect(h * 0.24, -h * 0.72, h * 0.12, h * 0.3);
  } else if (name === 'play') {
    ctx.beginPath();
    ctx.moveTo(-h * 0.3, -h * 0.55);
    ctx.lineTo(h * 0.62, 0);
    ctx.lineTo(-h * 0.3, h * 0.55);
    ctx.closePath();
    ctx.fill();
  } else if (name === 'home') {
    ctx.beginPath();
    ctx.moveTo(-h * 0.78, -h * 0.08);
    ctx.lineTo(0, -h * 0.72);
    ctx.lineTo(h * 0.78, -h * 0.08);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-h * 0.55, -h * 0.18);
    ctx.lineTo(-h * 0.55, h * 0.62);
    ctx.lineTo(h * 0.55, h * 0.62);
    ctx.lineTo(h * 0.55, -h * 0.18);
    ctx.stroke();
  } else if (name === 'pause') {
    fillRR(ctx, -h * 0.46, -h * 0.55, h * 0.3, h * 1.1, h * 0.1, c);
    fillRR(ctx, h * 0.16, -h * 0.55, h * 0.3, h * 1.1, h * 0.1, c);
  } else if (name === 'clock') {
    ctx.beginPath();
    ctx.arc(0, 0, h * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -h * 0.38);
    ctx.moveTo(0, 0);
    ctx.lineTo(h * 0.3, h * 0.18);
    ctx.stroke();
  } else if (name === 'gift') {
    fillRR(ctx, -h * 0.65, -h * 0.16, h * 1.3, h * 0.86, h * 0.1, '#E8836B');
    ctx.strokeStyle = '#A44935';
    ctx.strokeRect(-h * 0.65, -h * 0.16, h * 1.3, h * 0.86);
    ctx.fillStyle = '#F6D06B';
    ctx.fillRect(-h * 0.1, -h * 0.16, h * 0.2, h * 0.86);
    ctx.fillRect(-h * 0.65, h * 0.06, h * 1.3, h * 0.16);
    ctx.beginPath();
    ctx.arc(-h * 0.25, -h * 0.26, h * 0.24, 0, Math.PI * 2);
    ctx.arc(h * 0.25, -h * 0.26, h * 0.24, 0, Math.PI * 2);
    ctx.strokeStyle = '#A44935';
    ctx.stroke();
  } else if (name === 'star') {
    starPath(ctx, 0, 0, h * 0.78, h * 0.36, 5);
    ctx.fillStyle = color || '#F2B84B';
    ctx.fill();
  } else if (name === 'check') {
    ctx.beginPath();
    ctx.moveTo(-h * 0.55, 0);
    ctx.lineTo(-h * 0.12, h * 0.42);
    ctx.lineTo(h * 0.6, -h * 0.44);
    ctx.stroke();
  } else if (name === 'close') {
    ctx.beginPath();
    ctx.moveTo(-h * 0.5, -h * 0.5);
    ctx.lineTo(h * 0.5, h * 0.5);
    ctx.moveTo(h * 0.5, -h * 0.5);
    ctx.lineTo(-h * 0.5, h * 0.5);
    ctx.stroke();
  } else if (name === 'arrow') {
    ctx.beginPath();
    ctx.moveTo(-h * 0.35, -h * 0.5);
    ctx.lineTo(h * 0.35, 0);
    ctx.lineTo(-h * 0.35, h * 0.5);
    ctx.stroke();
  } else if (name === 'video') {
    fillRR(ctx, -h * 0.85, -h * 0.6, h * 1.7, h * 1.2, h * 0.26, c);
    ctx.beginPath();
    ctx.moveTo(-h * 0.2, -h * 0.3);
    ctx.lineTo(h * 0.34, 0);
    ctx.lineTo(-h * 0.2, h * 0.3);
    ctx.closePath();
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
  } else if (name === 'hand') {
    ctx.beginPath();
    ctx.moveTo(-h * 0.15, h * 0.75);
    ctx.lineTo(-h * 0.15, -h * 0.1);
    ctx.quadraticCurveTo(-h * 0.15, -h * 0.35, h * 0.02, -h * 0.35);
    ctx.quadraticCurveTo(h * 0.2, -h * 0.35, h * 0.2, -h * 0.1);
    ctx.lineTo(h * 0.2, -h * 0.5);
    ctx.quadraticCurveTo(h * 0.2, -h * 0.72, h * 0.36, -h * 0.72);
    ctx.quadraticCurveTo(h * 0.52, -h * 0.72, h * 0.52, -h * 0.5);
    ctx.lineTo(h * 0.52, h * 0.15);
    ctx.quadraticCurveTo(h * 0.52, h * 0.75, h * 0.05, h * 0.75);
    ctx.closePath();
    ctx.fillStyle = '#F2C89A';
    ctx.fill();
    ctx.strokeStyle = '#B98556';
    ctx.stroke();
  }
  ctx.restore();
}

function makeButton(o) {
  return {
    x: o.x || 0,
    y: o.y || 0,
    w: o.w || 120,
    h: o.h || 48,
    label: o.label || '',
    sub: o.sub || '',
    icon: o.icon || '',
    kind: o.kind || 'primary',
    radius: o.radius == null ? 14 : o.radius,
    enabled: o.enabled !== false,
    action: o.action || null,
    pressed: false,
    size: o.size || 18,
    iconSize: o.iconSize || 0,
    align: o.align || 'center'
  };
}

function hit(b, x, y) {
  return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}

function button(ctx, b) {
  var x = b.x;
  var y = b.y + (b.pressed ? 3 : 0);
  var w = b.w;
  var h = b.h;
  var r = b.radius;
  var dis = !b.enabled;

  ctx.save();
  if (dis) {
    ctx.globalAlpha = 0.5;
  }

  if (b.kind === 'primary' || b.kind === 'gold' || b.kind === 'danger' || b.kind === 'green') {
    var c1 = b.kind === 'gold' ? '#FFD36B' : b.kind === 'danger' ? '#E8876C' : '#8CCB72';
    var c2 = b.kind === 'gold' ? '#E9A62E' : b.kind === 'danger' ? '#C7523A' : '#5E9E4C';
    var edge = b.kind === 'gold' ? '#B47A14' : b.kind === 'danger' ? '#94351F' : '#457A36';
    if (!b.pressed) {
      fillRR(ctx, x, y + 5, w, h, r, edge);
    }
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    fillRR(ctx, x, y, w, h, r, g);
    ctx.beginPath();
    ctx.moveTo(x + r, y + 2);
    ctx.lineTo(x + w - r, y + 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.42)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    text(ctx, b.label, x + w / 2, y + h / 2 + (b.sub ? -6 : 0), b.size, '#FFFDF4', 'center', 800);
    if (b.sub) text(ctx, b.sub, x + w / 2, y + h / 2 + 13, b.size * 0.62, 'rgba(255,253,244,0.8)', 'center', 600);
    if (b.icon) drawIcon(ctx, b.icon, x + 24, y + h / 2, b.iconSize || 22, '#FFFDF4');
    return;
  }

  if (b.kind === 'icon') {
    fillRR(ctx, x, y + 3, w, h, r, 'rgba(122,78,32,0.28)');
    fillRR(ctx, x, y, w, h, r, b.active ? '#F6D9A4' : '#FFF7E4');
    ctx.restore();
    drawIcon(ctx, b.icon, x + w / 2, y + h / 2, b.iconSize || 24, b.color || T.ink);
    return;
  }

  // secondary / ghost
  if (b.kind === 'ghost') {
    ctx.restore();
    if (b.icon) drawIcon(ctx, b.icon, x + 18, y + h / 2, b.iconSize || 18, b.color || T.inkSoft);
    text(ctx, b.label, x + (b.icon ? 34 : 0), y + h / 2, b.size, b.color || T.inkSoft, 'left', 700);
    return;
  }

  if (!b.pressed) fillRR(ctx, x, y + 4, w, h, r, 'rgba(132,86,40,0.2)');
  fillRR(ctx, x, y, w, h, r, b.active ? '#FCE8C0' : '#FFF7E6');
  strokeRR(ctx, x, y, w, h, r, 'rgba(150,103,52,0.36)', 1.5);
  ctx.restore();
  if (b.icon) drawIcon(ctx, b.icon, x + (b.label ? 26 : w / 2), y + h / 2, b.iconSize || 20, b.color || T.ink);
  if (b.label) {
    text(ctx, b.label, x + (b.icon ? 44 : w / 2), y + h / 2 + (b.sub ? -5 : 0), b.size, b.color || T.ink, b.icon ? 'left' : 'center', 800);
    if (b.sub) text(ctx, b.sub, x + (b.icon ? 44 : w / 2), y + h / 2 + 13, b.size * 0.6, T.inkSoft, b.icon ? 'left' : 'center', 600);
  }
}

function bar(ctx, x, y, w, h, pct, color, bg, radius) {
  pct = Math.max(0, Math.min(1, pct));
  fillRR(ctx, x, y, w, h, radius == null ? h / 2 : radius, bg || 'rgba(120,78,30,0.16)');
  if (pct > 0.001) {
    ctx.save();
    rr(ctx, x, y, w, h, radius == null ? h / 2 : radius);
    ctx.clip();
    var g = ctx.createLinearGradient(x, y, x + w, y);
    g.addColorStop(0, color || T.green);
    g.addColorStop(1, '#A9D98F');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w * pct, h);
    ctx.restore();
  }
}

function wrapText(ctx, str, x, y, maxW, lineH, size, color, align, weight) {
  ctx.font = font(size, weight || 600);
  ctx.fillStyle = color || T.ink;
  ctx.textAlign = align || 'left';
  ctx.textBaseline = 'top';
  var line = '';
  var lines = [];
  for (var i = 0; i < str.length; i++) {
    var test = line + str.charAt(i);
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = str.charAt(i);
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  for (var j = 0; j < lines.length; j++) {
    ctx.fillText(lines[j], x, y + j * lineH);
  }
  return lines.length * lineH;
}

function ellipsis(ctx, str, maxW, size, weight) {
  ctx.font = font(size, weight || 600);
  if (ctx.measureText(str).width <= maxW) return str;
  var s = str;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}

function pill(ctx, x, y, w, h, fill, strokeColor) {
  fillRR(ctx, x, y, w, h, h / 2, fill);
  if (strokeColor) strokeRR(ctx, x, y, w, h, h / 2, strokeColor, 1);
}

function coinPill(ctx, x, y, w, h, coins, size) {
  pill(ctx, x, y, w, h, 'rgba(255,248,232,0.92)', 'rgba(150,103,52,0.3)');
  drawCoin(ctx, x + h * 0.48, y + h / 2, h * 0.31);
  text(ctx, String(coins), x + w - 12, y + h / 2 + 0.5, size || h * 0.5, T.ink, 'right', 800);
}

module.exports = {
  T: T,
  font: font,
  rr: rr,
  fillRR: fillRR,
  strokeRR: strokeRR,
  text: text,
  measure: measure,
  shadow: shadow,
  clearShadow: clearShadow,
  dim: dim,
  ellipse: ellipse,
  starPath: starPath,
  drawCoin: drawCoin,
  drawIcon: drawIcon,
  makeButton: makeButton,
  hit: hit,
  button: button,
  bar: bar,
  wrapText: wrapText,
  ellipsis: ellipsis,
  pill: pill,
  coinPill: coinPill
};

};
__defs["scenes/menu"] = function(module, exports, require){
/**
 * 大厅：订单入口、军需商店、每日补给、任务、自动削皮机、广告位。
 */
var CONFIG = require('../config');
var Platform = require('../platform');
var Economy = require('../economy');
var Ads = require('../ads');
var Sound = require('../audio');
var UI = require('../ui');
var T = UI.T;
var ShopOverlay = require('./shop');
var DailyOverlay = require('./daily');
var SettingsOverlay = require('./settings');

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

var TIPS = [
  '削薄一点，别浪费。',
  '军需官说：今天也要削满一桶。',
  '刀越快，皮越薄。',
  '反复刮同一处，果肉会哭。',
  '机器会记得你削过的每一颗土豆。'
];

function MenuScene(main) {
  this.main = main;
  this.t = 0;
  this.overlay = null;
  this.active = null;
  this.tip = TIPS[0];
  this.tipT = 0;
  this.coinShown = 0;
  this.layout();
}

MenuScene.prototype.layout = function () {
  var main = this.main;
  var W = main.W;
  var H = main.H;
  var st = Platform.safeTop;
  var sb = Platform.safeBottom;
  this.W = W;
  this.H = H;
  this.safeTop = st;
  this.safeBottom = sb;

  this.titleY = st + clamp(H * 0.105, 60, 92);
  this.titleSize = clamp(W * 0.108, 30, 44);
  this.titleY = st + clamp(H * 0.105, 60, 92);
  var titleMin = st + 60 + this.titleSize * 0.55;
  if (this.titleY < titleMin) this.titleY = titleMin;
  this.mascotY = this.titleY + clamp(H * 0.125, 76, 132);
  this.mascotR = clamp(W * 0.125, 36, 52);

  this.cardX = 18;
  this.cardW = W - 36;
  this.cardH = H < 700 ? 150 : (H > 800 ? 176 : 160);
  this.cardY = this.mascotY + clamp(H * 0.10, 72, 112);
  this.rowY = this.cardY + this.cardH + 12;
  this.rowH = 60;
  this.tileGap = 9;
  this.tileW = (this.cardW - this.tileGap * 2) / 3;

  this.bannerY = H - sb - 56;
  this.idleH = 54;
  this.idleY = this.bannerY - this.idleH - 10;
  this.pileTop = this.rowY + this.rowH + 10;
  this.pileBottom = this.idleY - 8;

  this.refresh();
};

MenuScene.prototype.enter = function () {
  Economy.refresh();
  Economy.updateIdle();
  Ads.showBanner();
  this.coinShown = Economy.s.coins;
  this.refresh();
};

MenuScene.prototype.onHide = function () {
  Economy.save();
};

MenuScene.prototype.refresh = function () {
  var main = this.main;
  var W = this.W;
  var st = this.safeTop;
  var order = Economy.nextOrder();
  var daily = Economy.dailyInfo();
  var quests = Economy.questList();
  var claimable = 0;
  for (var i = 0; i < quests.length; i++) if (quests[i].canClaim) claimable++;
  this.order = order;
  this.daily = daily;
  this.questClaimable = claimable;
  this.idle = Economy.idleInfo();

  var areas = [];
  function add(o) { areas.push(o); return o; }

  add({ x: 16, y: st + 10, w: 42, h: 42, action: 'sound' });
  add({ x: 64, y: st + 10, w: 42, h: 42, action: 'settings' });
  add({ x: W - 16 - 118 - 46, y: st + 10, w: 42, h: 42, action: 'share' });
  add({ x: W - 16 - 118, y: st + 12, w: 118, h: 38, action: 'coins' });
  add({ x: this.cardX + 14, y: this.cardY + this.cardH - 56, w: this.cardW - 28, h: 46, action: 'play', pressed: false });

  for (var k = 0; k < 3; k++) {
    add({
      x: this.cardX + k * (this.tileW + this.tileGap),
      y: this.rowY,
      w: this.tileW,
      h: this.rowH,
      action: k === 0 ? 'shop' : k === 1 ? 'daily' : 'tasks',
      pressed: false
    });
  }

  if (this.idle.rate > 0 && this.idle.pending >= 1) {
    add({ x: W - 18 - 122, y: this.idleY + 10, w: 56, h: 34, action: 'idleCollect', pressed: false });
    add({ x: W - 18 - 62, y: this.idleY + 10, w: 62, h: 34, action: 'idleDouble', pressed: false });
  } else {
    add({ x: W - 18 - 86, y: this.idleY + 10, w: 86, h: 34, action: 'idleGo', pressed: false });
  }

  this.areas = areas;
};

MenuScene.prototype.update = function (dt) {
  this.t += dt;
  this.tipT += dt;
  if (this.tipT > 4.5) {
    this.tipT = 0;
    this.tip = TIPS[Math.floor(Math.random() * TIPS.length)];
  }
  var target = Economy.s.coins;
  this.coinShown += (target - this.coinShown) * Math.min(1, dt * 10);
  if (Math.abs(target - this.coinShown) < 0.6) this.coinShown = target;
  if (this.overlay && this.overlay.update) this.overlay.update(dt);
};

MenuScene.prototype.render = function (ctx) {
  var W = this.W;
  var H = this.H;
  var t = this.t;

  this.drawBackground(ctx, t);
  this.drawTopBar(ctx);
  this.drawTitle(ctx);
  this.drawMascot(ctx, t);
  this.drawOrderCard(ctx, t);
  this.drawTiles(ctx);
  this.drawPile(ctx, t);
  this.drawIdleBar(ctx);
  this.drawBanner(ctx);

  if (this.overlay) this.overlay.render(ctx);
};

MenuScene.prototype.drawBackground = function (ctx, t) {
  var W = this.W;
  var H = this.H;
  var wallH = H * 0.63;

  var bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#FBEDD0');
  bg.addColorStop(0.62, '#F2DFBA');
  bg.addColorStop(1, '#DDBE8B');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 瓷砖墙
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = '#E2C99F';
  ctx.lineWidth = 1;
  var tile = Math.max(38, W / 9);
  for (var x = 0; x < W; x += tile) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, wallH);
    ctx.stroke();
  }
  for (var y = 0; y < wallH; y += tile) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.restore();

  // 灯光
  var lg = ctx.createRadialGradient(W * 0.5, H * 0.2, 10, W * 0.5, H * 0.2, W * 0.75);
  lg.addColorStop(0, 'rgba(255,248,220,0.55)');
  lg.addColorStop(1, 'rgba(255,248,220,0)');
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, W, H);

  // 台面
  var cg = ctx.createLinearGradient(0, wallH, 0, H);
  cg.addColorStop(0, '#C99159');
  cg.addColorStop(0.12, '#B57C46');
  cg.addColorStop(1, '#8E5B2D');
  ctx.fillStyle = cg;
  ctx.fillRect(0, wallH, W, H - wallH);
  ctx.fillStyle = 'rgba(255,236,200,0.28)';
  ctx.fillRect(0, wallH, W, 2);

  // 木纹
  ctx.save();
  ctx.globalAlpha = 0.13;
  ctx.strokeStyle = '#5E3A18';
  ctx.lineWidth = 1.4;
  for (var i = 0; i < 7; i++) {
    var yy = wallH + 26 + i * 36;
    ctx.beginPath();
    ctx.moveTo(0, yy);
    ctx.bezierCurveTo(W * 0.3, yy - 4, W * 0.6, yy + 6, W, yy - 2);
    ctx.stroke();
  }
  ctx.restore();
};

MenuScene.prototype.drawTopBar = function (ctx) {
  var W = this.W;
  var st = this.safeTop;
  var sound = Economy.s.settings.sound;
  UI.button(ctx, UI.makeButton({
    x: 16, y: st + 10, w: 42, h: 42, kind: 'icon', radius: 13,
    icon: sound ? 'sound' : 'soundOff', iconSize: 22, active: false
  }));
  UI.button(ctx, UI.makeButton({
    x: 64, y: st + 10, w: 42, h: 42, kind: 'icon', radius: 13, icon: 'gear', iconSize: 22
  }));
  UI.button(ctx, UI.makeButton({
    x: W - 16 - 118 - 46, y: st + 10, w: 42, h: 42, kind: 'icon', radius: 13, icon: 'share', iconSize: 19
  }));

  var pillW = 118;
  var pillX = W - 16 - pillW;
  UI.pill(ctx, pillX, st + 12, pillW, 38, 'rgba(255,248,232,0.95)', 'rgba(150,103,52,0.32)');
  UI.drawCoin(ctx, pillX + 20, st + 31, 11);
  UI.text(ctx, String(Math.round(this.coinShown)), pillX + pillW - 12, st + 31, 16, T.ink, 'right', 800);
};

MenuScene.prototype.drawTitle = function (ctx) {
  var W = this.W;
  var y = this.titleY;
  var size = this.titleSize;
  ctx.save();
  ctx.translate(W / 2, y);
  ctx.rotate(-0.018);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = UI.font(size, 900);
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(255,248,230,0.9)';
  ctx.strokeText('土豆削削乐', 0, 0);
  var g = ctx.createLinearGradient(0, -size * 0.6, 0, size * 0.6);
  g.addColorStop(0, '#7A4A22');
  g.addColorStop(1, '#4A2E19');
  ctx.fillStyle = g;
  ctx.fillText('土豆削削乐', 0, 0);
  ctx.restore();

  if (this.mascotY - this.titleY > 112) {
    UI.text(ctx, this.tip, W / 2, y + size * 0.68 + 6, 11, 'rgba(126,90,56,0.95)', 'center', 600);
  }
};

MenuScene.prototype.drawMascot = function (ctx, t) {
  var W = this.W;
  var cx = W / 2;
  var cy = this.mascotY - 6 + Math.sin(t * 2.1) * 4;
  var r = this.mascotR;

  // 影子
  ctx.save();
  ctx.beginPath();
  ctx.ellipse ? ctx.ellipse(cx, cy + r * 1.05, r * 0.78, r * 0.16, 0, 0, Math.PI * 2) : ctx.arc(cx, cy + r, r * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(70,40,15,0.16)';
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(t * 1.4) * 0.03);

  // 土豆身体
  ctx.beginPath();
  ctx.moveTo(-r * 0.98, 0);
  ctx.bezierCurveTo(-r * 0.98, -r * 0.82, -r * 0.5, -r * 1.02, r * 0.04, -r * 0.98);
  ctx.bezierCurveTo(r * 0.68, -r * 0.94, r * 1.02, -r * 0.5, r * 0.98, r * 0.08);
  ctx.bezierCurveTo(r * 0.94, r * 0.66, r * 0.48, r * 1.02, -r * 0.08, r * 0.98);
  ctx.bezierCurveTo(-r * 0.64, r * 0.94, -r * 0.98, r * 0.58, -r * 0.98, 0);
  ctx.closePath();
  var bg = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r * 1.3);
  bg.addColorStop(0, '#D6A06C');
  bg.addColorStop(0.6, '#B87A42');
  bg.addColorStop(1, '#8A5326');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(80,45,18,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 削开的果肉（左下角小片，避免像大嘴）
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-r * 0.9, r * 0.3);
  ctx.quadraticCurveTo(-r * 0.66, r * 0.82, -r * 0.16, r * 0.74);
  ctx.quadraticCurveTo(-r * 0.42, r * 0.52, -r * 0.9, r * 0.3);
  ctx.closePath();
  var fg = ctx.createLinearGradient(0, r * 0.2, 0, r * 0.9);
  fg.addColorStop(0, '#FFF2CC');
  fg.addColorStop(1, '#EDCF90');
  ctx.fillStyle = fg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(150,104,45,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // 眼睛
  ctx.beginPath();
  ctx.arc(-r * 0.3, -r * 0.18, r * 0.075, 0, Math.PI * 2);
  ctx.arc(r * 0.26, -r * 0.2, r * 0.075, 0, Math.PI * 2);
  ctx.fillStyle = '#3F2715';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-r * 0.28, -r * 0.21, r * 0.026, 0, Math.PI * 2);
  ctx.arc(r * 0.28, -r * 0.23, r * 0.026, 0, Math.PI * 2);
  ctx.fillStyle = '#FFF9E8';
  ctx.fill();

  // 微笑
  ctx.beginPath();
  ctx.arc(0, -r * 0.02, r * 0.16, 0.25, Math.PI - 0.25);
  ctx.strokeStyle = '#4A2E19';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.stroke();

  // 腮红
  ctx.beginPath();
  ctx.ellipse ? ctx.ellipse(-r * 0.52, r * 0.02, r * 0.1, r * 0.06, 0, 0, Math.PI * 2) :
    ctx.arc(-r * 0.52, r * 0.02, r * 0.07, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(214,105,79,0.35)';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse ? ctx.ellipse(r * 0.46, r * 0.0, r * 0.1, r * 0.06, 0, 0, Math.PI * 2) :
    ctx.arc(r * 0.46, 0, r * 0.07, 0, Math.PI * 2);
  ctx.fill();

  // 小芽
  ctx.beginPath();
  ctx.moveTo(r * 0.02, -r * 0.97);
  ctx.quadraticCurveTo(r * 0.06, -r * 1.14, r * 0.2, -r * 1.18);
  ctx.strokeStyle = '#5E8B45';
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse ? ctx.ellipse(r * 0.25, -r * 1.19, r * 0.1, r * 0.055, -0.5, 0, Math.PI * 2) :
    ctx.arc(r * 0.23, -r * 1.18, r * 0.075, 0, Math.PI * 2);
  ctx.fillStyle = '#7FB069';
  ctx.fill();

  // 小刀
  ctx.save();
  ctx.translate(r * 1.12, r * 0.12);
  ctx.rotate(-0.45 + Math.sin(t * 2.2) * 0.04);
  ctx.beginPath();
  ctx.moveTo(-r * 0.1, r * 0.34);
  ctx.quadraticCurveTo(-r * 0.02, -r * 0.32, r * 0.36, -r * 0.12);
  ctx.lineTo(r * 0.12, r * 0.2);
  ctx.closePath();
  ctx.fillStyle = '#E4EBF0';
  ctx.fill();
  ctx.strokeStyle = '#7B8794';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.12, r * 0.32);
  ctx.lineTo(-r * 0.26, r * 0.46);
  ctx.strokeStyle = '#7A4A22';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();

  ctx.restore();

  // 飘着的皮
  var pt = (t * 0.6) % 1;
  ctx.save();
  ctx.globalAlpha = 0.55 * (1 - pt);
  ctx.strokeStyle = '#B0743E';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(cx - r * 0.95 - pt * 20, cy + r * 0.3 - pt * 26, 5, 0.4, 2.6);
  ctx.stroke();
  ctx.restore();
};

MenuScene.prototype.drawOrderCard = function (ctx, t) {
  var o = this.order;
  var x = this.cardX;
  var y = this.cardY;
  var w = this.cardW;
  var h = this.cardH;

  ctx.save();
  UI.shadow(ctx, 'rgba(90,55,22,0.22)', 18, 0, 8);
  UI.fillRR(ctx, x, y, w, h, 20, '#FFF8E8');
  UI.clearShadow(ctx);
  UI.strokeRR(ctx, x, y, w, h, 20, 'rgba(150,103,52,0.28)', 1.5);

  UI.fillRR(ctx, x + 16, y + 14, 78, 24, 12, 'rgba(111,168,94,0.16)');
  UI.text(ctx, '军需订单', x + 55, y + 26, 11.5, T.greenDark, 'center', 800);
  UI.text(ctx, '#' + o.index, x + w - 18, y + 26, 12, T.inkSoft, 'right', 800);

  UI.text(ctx, '土豆 × ' + o.count, x + 18, y + 56, 28, T.ink, 'left', 900);
  var targetLine = '目标削净 ' + Math.round(o.target * 100) + '% · 限时 ' + o.timeLimit + 's';
  if (o.goldenIndex >= 0 && h < 166) targetLine += ' · 金土豆★';
  UI.text(ctx, targetLine, x + 18, y + (h < 166 ? 82 : 84), 12, T.inkSoft, 'left', 600);

  // 收益
  var coinX = x + w - 66;
  UI.drawCoin(ctx, coinX, y + 58, 13, true);
  UI.text(ctx, '+' + o.baseCoins, x + w - 46, y + 58, 22, T.goldDark, 'left', 900);
  UI.text(ctx, '基础收益', x + w - 18, y + 80, 10, T.inkSoft, 'right', 600);

  if (o.goldenIndex >= 0 && h >= 166) {
    UI.pill(ctx, x + 18, y + 93, 82, 20, 'rgba(242,184,75,0.2)');
    UI.drawIcon(ctx, 'star', x + 30, y + 103, 12, T.gold);
    UI.text(ctx, '金土豆订单', x + 62, y + 103, 10, T.goldDark, 'center', 800);
  }

  var btn = UI.makeButton({
    x: x + 14, y: y + h - 56, w: w - 28, h: 46, radius: 15,
    label: '开 始 削 皮', kind: 'primary', size: 19
  });
  btn.pressed = this.isPressed('play');
  UI.button(ctx, btn);
  ctx.restore();
};

MenuScene.prototype.drawTiles = function (ctx) {
  var tiles = [
    { action: 'shop', icon: 'shop', label: '军需商店', sub: '升级装备' },
    { action: 'daily', icon: 'calendar', label: '每日补给', sub: this.daily.claimedToday ? '已领取' : '可领取' },
    { action: 'tasks', icon: 'star', label: '今日任务', sub: this.questClaimable > 0 ? this.questClaimable + ' 个可领' : '进行中' }
  ];
  for (var i = 0; i < tiles.length; i++) {
    var it = tiles[i];
    var x = this.cardX + i * (this.tileW + this.tileGap);
    var y = this.rowY + (this.isPressed(it.action) ? 2 : 0);
    var w = this.tileW;
    var h = this.rowH;

    UI.fillRR(ctx, x, y + 3, w, h, 16, 'rgba(122,78,32,0.18)');
    UI.fillRR(ctx, x, y, w, h, 16, '#FFF7E6');
    UI.strokeRR(ctx, x, y, w, h, 16, 'rgba(150,103,52,0.26)', 1);
    UI.drawIcon(ctx, it.icon, x + w / 2, y + 20, 20, T.ink);
    UI.text(ctx, it.label, x + w / 2, y + 40, 11.5, T.ink, 'center', 800);
    UI.text(ctx, it.sub, x + w / 2, y + 52, 9, T.inkSoft, 'center', 600);

    if (it.action === 'daily' && !this.daily.claimedToday) {
      ctx.beginPath();
      ctx.arc(x + w - 10, y + 10, 5, 0, Math.PI * 2);
      ctx.fillStyle = T.red;
      ctx.fill();
    }
    if (it.action === 'tasks' && this.questClaimable > 0) {
      ctx.beginPath();
      ctx.arc(x + w - 10, y + 10, 8, 0, Math.PI * 2);
      ctx.fillStyle = T.red;
      ctx.fill();
      UI.text(ctx, String(this.questClaimable), x + w - 10, y + 10, 9, '#FFF', 'center', 800);
    }
  }
};

MenuScene.prototype.drawPile = function (ctx, t) {
  var top = this.pileTop;
  var bottom = this.pileBottom;
  var avail = bottom - top;
  if (avail < 105) {
    if (avail < 34) return;
    var stats = '已削 ' + Economy.s.potatoesPeeled + ' 颗 · S 评级 ' + Economy.s.sGrades + ' · 最佳订单 #' + Economy.s.bestOrder;
    var sw = Math.min(this.W - 60, UI.measure(ctx, stats, 10, 700) + 40);
    var sy = (top + bottom) / 2 - 17;
    UI.pill(ctx, (this.W - sw) / 2, sy, sw, 34, 'rgba(255,248,232,0.6)', 'rgba(150,103,52,0.2)');
    UI.text(ctx, stats, this.W / 2, sy + 17, 10, 'rgba(94,58,28,0.65)', 'center', 700);
    return;
  }
  var W = this.W;
  var s = Math.max(0.62, Math.min(1, avail / 205));
  var cx = W * 0.5;
  var baseY = bottom - 8;
  var bw = 132 * s;
  var bh = 80 * s;

  ctx.save();
  // 背后的暖光
  var glow = ctx.createRadialGradient(cx, top + avail * 0.55, 6, cx, top + avail * 0.55, 120 * s);
  glow.addColorStop(0, 'rgba(255,244,210,0.5)');
  glow.addColorStop(1, 'rgba(255,244,210,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - 140 * s, top, 280 * s, avail);

  var headText = '累计削皮 ' + Economy.s.potatoesPeeled + ' 颗';
  var headW = Math.max(112, Math.min(158, UI.measure(ctx, headText, 9.5, 600) + 34));
  UI.pill(ctx, cx - headW / 2, top + 3, headW, 40, 'rgba(255,248,232,0.62)');
  UI.text(ctx, '土 豆 山', cx, top + 14, 13, 'rgba(94,58,28,0.66)', 'center', 900);
  UI.text(ctx, headText, cx, top + 31, 9.5, 'rgba(94,58,28,0.5)', 'center', 600);

  // 堆叠的土豆
  var rows = [
    { n: 5, y: -7, sp: 27 },
    { n: 4, y: -27, sp: 28 },
    { n: 3, y: -46, sp: 29 },
    { n: 2, y: -64, sp: 30 }
  ];
  for (var r = 0; r < rows.length; r++) {
    var row = rows[r];
    for (var i = 0; i < row.n; i++) {
      var off = (i - (row.n - 1) / 2) * row.sp * s;
      var px = cx + off;
      var py = baseY - bh + row.y * s;
      var rx = 20 * s * (0.94 + (i % 2) * 0.08);
      var ry = 15 * s;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate((i % 3 - 1) * 0.12);
      ctx.beginPath();
      ctx.ellipse ? ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2) : ctx.arc(0, 0, rx, 0, Math.PI * 2);
      var pg = ctx.createRadialGradient(-rx * 0.3, -ry * 0.35, 1, 0, 0, rx);
      pg.addColorStop(0, '#CE9A63');
      pg.addColorStop(0.65, '#B0743E');
      pg.addColorStop(1, '#84501F');
      ctx.fillStyle = pg;
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse ? ctx.ellipse(-rx * 0.34, -ry * 0.36, rx * 0.22, ry * 0.24, 0, 0, Math.PI * 2) :
        ctx.arc(-rx * 0.3, -ry * 0.3, rx * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,235,190,0.4)';
      ctx.fill();
      ctx.restore();
    }
  }

  // 木桶
  ctx.beginPath();
  ctx.moveTo(cx - bw / 2, baseY - bh);
  ctx.lineTo(cx + bw / 2, baseY - bh);
  ctx.lineTo(cx + bw * 0.38, baseY);
  ctx.lineTo(cx - bw * 0.38, baseY);
  ctx.closePath();
  var bg = ctx.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0);
  bg.addColorStop(0, '#8E5B2D');
  bg.addColorStop(0.35, '#C08A50');
  bg.addColorStop(0.7, '#A9743C');
  bg.addColorStop(1, '#7A4A22');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(70,40,15,0.35)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // 水
  ctx.beginPath();
  ctx.ellipse ? ctx.ellipse(cx, baseY - bh + 2, bw * 0.44, 8 * s, 0, 0, Math.PI * 2) :
    ctx.arc(cx, baseY - bh + 2, bw * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = '#7FA9B6';
  ctx.fill();
  ctx.strokeStyle = '#D8E8EA';
  ctx.lineWidth = 2 * s;
  ctx.stroke();

  // 桶沿
  ctx.beginPath();
  ctx.ellipse ? ctx.ellipse(cx, baseY - bh, bw * 0.5, 9 * s, 0, 0, Math.PI * 2) :
    ctx.arc(cx, baseY - bh, bw * 0.48, 0, Math.PI * 2);
  ctx.strokeStyle = '#6E4520';
  ctx.lineWidth = 5 * s;
  ctx.stroke();

  // 桶箍
  ctx.beginPath();
  ctx.moveTo(cx - bw * 0.47, baseY - bh * 0.62);
  ctx.lineTo(cx + bw * 0.47, baseY - bh * 0.62);
  ctx.strokeStyle = 'rgba(90,55,25,0.45)';
  ctx.lineWidth = 5 * s;
  ctx.stroke();

  // 削好的土豆
  for (var k = 0; k < 3; k++) {
    var px2 = cx + (k - 1) * 18 * s;
    var py2 = baseY - bh + 1 + (k % 2) * 3 * s;
    ctx.beginPath();
    ctx.ellipse ? ctx.ellipse(px2, py2, 11 * s, 7 * s, 0.2, 0, Math.PI * 2) :
      ctx.arc(px2, py2, 9 * s, 0, Math.PI * 2);
    ctx.fillStyle = '#F8E6B4';
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,104,45,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 热气
  for (var m = 0; m < 2; m++) {
    var rise = (t * 0.35 + m * 0.5) % 1;
    ctx.beginPath();
    ctx.globalAlpha = 0.18 * (1 - rise);
    ctx.strokeStyle = '#FFF8E0';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(cx + (m ? 18 : -14) * s, baseY - bh - 8 - rise * 28);
    ctx.quadraticCurveTo(cx + (m ? 30 : -26) * s, baseY - bh - 22 - rise * 32, cx + (m ? 16 : -12) * s, baseY - bh - 38 - rise * 36);
    ctx.stroke();
  }
  ctx.restore();
};

MenuScene.prototype.drawIdleBar = function (ctx) {
  var W = this.W;
  var x = 18;
  var y = this.idleY;
  var w = W - 36;
  var h = this.idleH;
  var info = this.idle;

  UI.fillRR(ctx, x, y, w, h, 16, 'rgba(255,248,232,0.94)');
  UI.strokeRR(ctx, x, y, w, h, 16, info.rate > 0 ? 'rgba(242,184,75,0.65)' : 'rgba(150,103,52,0.24)', 1.5);
  UI.drawIcon(ctx, 'machine', x + 28, y + h / 2, 22, info.rate > 0 ? T.goldDark : T.inkSoft);

  if (info.rate > 0) {
    UI.text(ctx, '自动削皮机', x + 50, y + 18, 11, T.inkSoft, 'left', 700);
    if (info.pending >= 1) {
      UI.text(ctx, '+' + info.pending + ' 待收取', x + 50, y + 36, 14, T.goldDark, 'left', 900);
    } else {
      UI.text(ctx, '运转中 · ' + info.rate + ' 币/分', x + 50, y + 36, 12, T.ink, 'left', 700);
    }
  } else {
    UI.text(ctx, '自动削皮机未解锁', x + 50, y + 19, 12, T.ink, 'left', 800);
    UI.text(ctx, '离线也能替你攒土豆币', x + 50, y + 35, 10, T.inkSoft, 'left', 600);
  }

  if (info.rate > 0 && info.pending >= 1) {
    var b1 = UI.makeButton({
      x: W - 18 - 122, y: y + 10, w: 56, h: 34, radius: 12,
      label: '领取', kind: 'secondary', size: 12
    });
    var b2 = UI.makeButton({
      x: W - 18 - 62, y: y + 10, w: 62, h: 34, radius: 12,
      label: '视频×2', kind: 'gold', size: 11
    });
    b1.pressed = this.isPressed('idleCollect');
    b2.pressed = this.isPressed('idleDouble');
    UI.button(ctx, b1);
    UI.button(ctx, b2);
  } else {
    var b3 = UI.makeButton({
      x: W - 18 - 86, y: y + 10, w: 86, h: 34, radius: 12,
      label: info.rate > 0 ? '运转中' : '去解锁', kind: info.rate > 0 ? 'secondary' : 'primary', size: 11.5
    });
    b3.pressed = this.isPressed('idleGo');
    b3.enabled = true;
    UI.button(ctx, b3);
  }
};

MenuScene.prototype.drawBanner = function (ctx) {
  if (!Ads.isDemo() || !CONFIG.ads.demoAds) return;
  var W = this.W;
  var y = this.bannerY;
  ctx.save();
  ctx.setLineDash ? ctx.setLineDash([5, 4]) : null;
  UI.strokeRR(ctx, 18, y, W - 36, 46, 10, 'rgba(126,90,56,0.28)', 1);
  if (ctx.setLineDash) ctx.setLineDash([]);
  UI.text(ctx, 'Banner 广告位 · 微信流量主接入后展示', W / 2, y + 23, 9.5, 'rgba(126,90,56,0.65)', 'center', 600);
  ctx.restore();
};

MenuScene.prototype.isPressed = function (action) {
  return this.active && this.active.action === action;
};

MenuScene.prototype.onDown = function (p) {
  if (this.overlay) {
    if (this.overlay.onDown) this.overlay.onDown(p);
    return;
  }
  var a = this.hitAt(p.x, p.y);
  if (a) {
    this.active = a;
    Sound.tap();
  }
};

MenuScene.prototype.onMove = function (p) {
  if (this.overlay && this.overlay.onMove) this.overlay.onMove(p);
};

MenuScene.prototype.onUp = function (p) {
  if (this.overlay) {
    if (this.overlay.onUp) this.overlay.onUp(p);
    if (this.overlay && this.overlay.closed) {
      this.overlay = null;
      Ads.showBanner();
      Economy.refresh();
      this.refresh();
    }
    return;
  }
  var a = this.active;
  this.active = null;
  if (!a) return;
  if (!UI.hit(a, p.x, p.y)) return;
  this.activate(a.action);
};

MenuScene.prototype.hitAt = function (x, y) {
  for (var i = this.areas.length - 1; i >= 0; i--) {
    if (UI.hit(this.areas[i], x, y)) return this.areas[i];
  }
  return null;
};

MenuScene.prototype.activate = function (action) {
  var self = this;
  if (action === 'play') {
    Platform.haptic('medium');
    this.main.startOrder();
  } else if (action === 'sound') {
    var on = !Economy.s.settings.sound;
    Economy.setSetting('sound', on);
    Sound.setMuted(!on);
    if (on) Sound.tap();
    this.main.notify(on ? '音效已开启' : '音效已关闭');
  } else if (action === 'settings') {
    this.openOverlay(new SettingsOverlay(this.main, function () { self.closeOverlay(); }));
  } else if (action === 'share') {
    this.main.shareGame();
  } else if (action === 'shop') {
    this.openOverlay(new ShopOverlay(this.main, function () { self.closeOverlay(); }));
  } else if (action === 'daily') {
    this.openOverlay(new DailyOverlay(this.main, 'daily', function () { self.closeOverlay(); }));
  } else if (action === 'tasks') {
    this.openOverlay(new DailyOverlay(this.main, 'tasks', function () { self.closeOverlay(); }));
  } else if (action === 'idleCollect') {
    var r = Economy.collectIdle(false);
    if (r.ok) {
      Sound.coin();
      this.main.notify('已收取 ' + r.coins + ' 土豆币');
      this.refresh();
    }
  } else if (action === 'idleDouble') {
    var rr = Economy.collectIdle(true);
    if (rr.ok) {
      Sound.reward();
      this.main.notify('双倍收取 ' + rr.coins + ' 土豆币');
      this.refresh();
    }
  } else if (action === 'idleGo') {
    if (this.idle.rate > 0) {
      this.main.notify('机器正在运转，稍后再来收');
    } else {
      this.openOverlay(new ShopOverlay(this.main, function () { self.closeOverlay(); }, 'machine'));
    }
  }
};

MenuScene.prototype.openOverlay = function (o) {
  this.overlay = o;
  Ads.hideBanner();
};

MenuScene.prototype.closeOverlay = function () {
  this.overlay = null;
  Ads.showBanner();
  Economy.refresh();
  this.refresh();
};

MenuScene.prototype.onEscape = function () {
  if (this.overlay) this.closeOverlay();
};

module.exports = MenuScene;

};
__defs["scenes/shop"] = function(module, exports, require){
/**
 * 军需商店：装备升级 + 免费补给箱（激励视频）。
 */
var CONFIG = require('../config');
var Platform = require('../platform');
var Economy = require('../economy');
var Ads = require('../ads');
var Sound = require('../audio');
var UI = require('../ui');
var T = UI.T;

function fmtMs(ms) {
  var s = Math.ceil(ms / 1000);
  var h = Math.floor(s / 3600);
  var m = Math.floor((s % 3600) / 60);
  var sec = s % 60;
  function p(n) { return n < 10 ? '0' + n : '' + n; }
  return h > 0 ? h + ':' + p(m) + ':' + p(sec) : p(m) + ':' + p(sec);
}

function ShopOverlay(main, onClose, focusId) {
  this.main = main;
  this.onClose = onClose;
  this.focusId = focusId || null;
  this.closed = false;
  this.active = null;
  this.t = 0;
  this.layout();
}

ShopOverlay.prototype.layout = function () {
  var W = this.main.W;
  var H = this.main.H;
  this.W = W;
  this.H = H;
  this.x = 12;
  this.w = W - 24;
  this.pad = 14;
  this.headerH = 52;
  this.chestH = 62;
  this.cardGap = 7;
  var n = CONFIG.upgrades.length;
  var hMax = H - Platform.safeTop - 78;
  var fixed = this.headerH + 8 + this.chestH + 10 + (n - 1) * this.cardGap + 30 + 16;
  this.cardH = Math.max(54, Math.min(72, (hMax - fixed) / n));
  var content = fixed + n * this.cardH;
  this.h = Math.min(hMax, content);
  this.y = H - Platform.safeBottom - 12 - this.h;
  this.chestY = this.y + this.headerH + 8;
  this.listY = this.chestY + this.chestH + 10;
  this.refresh();
};

ShopOverlay.prototype.refresh = function () {
  var self = this;
  var list = [];
  var defs = CONFIG.upgrades;
  var chest = Economy.chestInfo();
  this.chest = chest;

  this.closeBtn = { x: this.x + this.w - 46, y: this.y + 10, w: 36, h: 36, action: 'close' };
  this.chestBtn = {
    x: this.x + this.w - 14 - 88, y: this.chestY + 15, w: 88, h: 32,
    action: 'chest', pressed: false, enabled: chest.ready
  };
  list.push(this.chestBtn);

  for (var i = 0; i < defs.length; i++) {
    var d = defs[i];
    var cost = Economy.upgradeCost(d.id);
    var lv = Economy.level(d.id);
    var cy = this.listY + i * (this.cardH + this.cardGap);
    list.push({
      x: this.x + this.w - 14 - 92,
      y: cy + (this.cardH - 32) / 2,
      w: 92,
      h: 32,
      action: 'buy:' + d.id,
      id: d.id,
      cost: cost,
      level: lv,
      max: lv >= d.max,
      affordable: cost !== null && Economy.s.coins >= cost,
      pressed: false
    });
  }
  this.list = list;
};

ShopOverlay.prototype.render = function (ctx) {
  var W = this.W;
  var H = this.H;
  UI.dim(ctx, W, H, 0.58);

  ctx.save();
  UI.shadow(ctx, 'rgba(0,0,0,0.35)', 26, 0, 10);
  UI.fillRR(ctx, this.x, this.y, this.w, this.h, 24, '#FFF8E8');
  UI.clearShadow(ctx);

  // 顶部拖拽条
  UI.fillRR(ctx, W / 2 - 20, this.y + 7, 40, 4, 2, 'rgba(126,90,56,0.22)');

  // 标题
  UI.text(ctx, '军需商店', this.x + 20, this.y + 32, 22, T.ink, 'left', 900);
  var cw = 100;
  var cx = this.x + this.w - 14 - 36 - 8 - cw;
  UI.pill(ctx, cx, this.y + 16, cw, 32, 'rgba(255,248,232,0.95)', 'rgba(150,103,52,0.3)');
  UI.drawCoin(ctx, cx + 18, this.y + 32, 10);
  UI.text(ctx, String(Economy.s.coins), cx + cw - 10, this.y + 32, 15, T.ink, 'right', 800);

  // 关闭
  UI.fillRR(ctx, this.closeBtn.x, this.closeBtn.y, 36, 36, 12, 'rgba(126,90,56,0.09)');
  UI.drawIcon(ctx, 'close', this.closeBtn.x + 18, this.closeBtn.y + 18, 17, T.inkSoft);

  // 免费补给箱
  var gx = this.x + 14;
  var gy = this.chestY;
  var gw = this.w - 28;
  var gg = ctx.createLinearGradient(gx, gy, gx + gw, gy);
  gg.addColorStop(0, '#FBE3AE');
  gg.addColorStop(1, '#F3C97C');
  UI.fillRR(ctx, gx, gy, gw, this.chestH, 16, gg);
  UI.strokeRR(ctx, gx, gy, gw, this.chestH, 16, 'rgba(201,139,36,0.35)', 1);
  UI.drawIcon(ctx, 'gift', gx + 30, gy + this.chestH / 2, 26, '#B76A4A');
  UI.text(ctx, '免费补给箱', gx + 52, gy + 22, 14, '#7A4A22', 'left', 900);
  UI.text(ctx, this.chest.ready ? '看视频领 ' + CONFIG.chest.minCoins + '-' + CONFIG.chest.maxCoins + ' 土豆币' : fmtMs(this.chest.remainMs) + ' 后可再领',
    gx + 52, gy + 42, 10, 'rgba(122,74,34,0.8)', 'left', 600);

  var cb = UI.makeButton({
    x: this.chestBtn.x, y: this.chestBtn.y, w: this.chestBtn.w, h: this.chestBtn.h,
    radius: 11, label: this.chest.ready ? '看视频' : '冷却中',
    kind: 'gold', size: 11, enabled: this.chest.ready
  });
  cb.pressed = this.chestBtn.pressed;
  UI.button(ctx, cb);

  // 装备列表
  for (var i = 0; i < CONFIG.upgrades.length; i++) {
    var d = CONFIG.upgrades[i];
    var cy = this.listY + i * (this.cardH + this.cardGap);
    var focused = this.focusId === d.id;
    UI.fillRR(ctx, this.x + 14, cy, this.w - 28, this.cardH, 14, focused ? '#FEF0D3' : '#F8EBCE');
    UI.strokeRR(ctx, this.x + 14, cy, this.w - 28, this.cardH, 14, focused ? 'rgba(242,184,75,0.8)' : 'rgba(150,103,52,0.2)', 1.2);

    // icon
    var ir = Math.min(20, this.cardH * 0.32);
    ctx.beginPath();
    ctx.arc(this.x + 40, cy + this.cardH / 2, ir, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(184,122,66,0.14)';
    ctx.fill();
    UI.drawIcon(ctx, d.icon, this.x + 40, cy + this.cardH / 2, ir * 1.15, T.ink);

    var lv = Economy.level(d.id);
    var nameY = this.cardH >= 66 ? cy + 18 : cy + this.cardH / 2 - 8;
    var effectY = this.cardH >= 66 ? cy + 36 : cy + this.cardH / 2 + 9;
    UI.text(ctx, d.name, this.x + 66, nameY, 14, T.ink, 'left', 900);
    var nameW = UI.measure(ctx, d.name, 14, 900);
    UI.pill(ctx, this.x + 66 + nameW + 7, nameY - 8, 34, 17, 'rgba(111,168,94,0.16)');
    UI.text(ctx, 'Lv.' + lv, this.x + 66 + nameW + 24, nameY - 0, 9.5, T.greenDark, 'center', 800);

    UI.text(ctx, Economy.effectText(d.id), this.x + 66, effectY, 10, T.inkSoft, 'left', 600);
    if (this.cardH >= 66) UI.text(ctx, d.brief, this.x + 66, cy + 51, 9, 'rgba(126,90,56,0.7)', 'left', 600);

    var b = null;
    for (var k = 0; k < this.list.length; k++) {
      if (this.list[k].action === 'buy:' + d.id) { b = this.list[k]; break; }
    }
    if (b) {
      var label = b.max ? '已满级' : (b.cost != null ? '升级 ' + b.cost : '—');
      var kind = b.max ? 'secondary' : (b.affordable ? 'primary' : 'secondary');
      var btn = UI.makeButton({
        x: b.x, y: b.y, w: b.w, h: b.h, radius: 12,
        label: label, kind: kind, size: 11, enabled: !b.max && b.affordable
      });
      btn.pressed = b.pressed;
      UI.button(ctx, btn);
    }
  }

  UI.text(ctx, '装备永久生效 · 广告收入用于军需处运转', W / 2, this.y + this.h - 12, 9, 'rgba(126,90,56,0.55)', 'center', 600);
  ctx.restore();
};

ShopOverlay.prototype.update = function (dt) {
  this.t += dt;
};

ShopOverlay.prototype.onDown = function (p) {
  this.active = null;
  if (UI.hit(this.closeBtn, p.x, p.y)) { this.active = this.closeBtn; return; }
  for (var i = 0; i < this.list.length; i++) {
    var b = this.list[i];
    if (b.enabled !== false && UI.hit(b, p.x, p.y)) { this.active = b; b.pressed = true; Sound.tap(); return; }
  }
};

ShopOverlay.prototype.onUp = function (p) {
  var a = this.active;
  this.active = null;
  if (a) a.pressed = false;
  if (!a || !UI.hit(a, p.x, p.y)) return;

  if (a.action === 'close') {
    this.closed = true;
    if (this.onClose) this.onClose();
  } else if (a.action === 'chest') {
    this.claimChest();
  } else if (a.action.indexOf('buy:') === 0) {
    this.buy(a.action.slice(4));
  }
};

ShopOverlay.prototype.claimChest = function () {
  var self = this;
  var info = Economy.chestInfo();
  if (!info.ready) { this.main.notify('补给箱还在冷却中'); return; }
  this.main.rewarded('free_chest', function () {
    var r = Economy.claimChest();
    if (r.ok) {
      Sound.coin();
      self.main.notify('补给箱 +' + r.coins + ' 土豆币');
      self.refresh();
    }
  });
};

ShopOverlay.prototype.buy = function (id) {
  var r = Economy.buyUpgrade(id);
  if (r.ok) {
    Sound.upgrade();
    Platform.haptic('medium');
    this.main.notify('升级成功 · Lv.' + r.level);
    this.refresh();
  } else if (r.reason === 'coins') {
    this.main.notify('土豆币不够，还差 ' + (r.cost - Economy.s.coins));
	} else if (r.reason === 'max') {
    this.main.notify('已经满级了');
  }
};

module.exports = ShopOverlay;

};
__defs["scenes/daily"] = function(module, exports, require){
/**
 * 每日补给 + 今日任务。
 */
var CONFIG = require('../config');
var Platform = require('../platform');
var Economy = require('../economy');
var Sound = require('../audio');
var UI = require('../ui');
var T = UI.T;

function DailyOverlay(main, mode, onClose) {
  this.main = main;
  this.mode = mode === 'tasks' ? 'tasks' : 'daily';
  this.onClose = onClose;
  this.closed = false;
  this.active = null;
  this.t = 0;
  this.layout();
}

DailyOverlay.prototype.layout = function () {
  var W = this.main.W;
  var H = this.main.H;
  this.W = W;
  this.H = H;
  this.x = 12;
  this.w = W - 24;
  var avail = H - Platform.safeTop - 100;
  this.h = Math.min(avail, this.mode === 'daily' ? 302 : 386);
  this.y = H - Platform.safeBottom - 12 - this.h;
  this.closeBtn = { x: this.x + this.w - 46, y: this.y + 10, w: 36, h: 36 };
  this.tabY = this.y + 50;
  this.tabH = 36;
  this.contentY = this.tabY + this.tabH + 12;
  this.refresh();
};

DailyOverlay.prototype.refresh = function () {
  this.daily = Economy.dailyInfo();
  this.quests = Economy.questList();
  var W = this.W;
  var contentX = this.x + 14;
  var contentW = this.w - 28;

  var tabW = (contentW - 8) / 2;
  this.tabs = [
    { x: contentX, y: this.tabY, w: tabW, h: this.tabH, mode: 'daily', label: '每日补给' },
    { x: contentX + tabW + 8, y: this.tabY, w: tabW, h: this.tabH, mode: 'tasks', label: '今日任务' }
  ];

  var buttons = [];
  if (this.mode === 'daily') {
    this.tileGap = 4;
    this.tileW = (contentW - this.tileGap * 6) / 7;
    this.tileH = 72;
    this.gridY = this.contentY + 6;
    this.claimBtn = {
      x: contentX, y: this.gridY + this.tileH + 16, w: contentW, h: 46,
      action: 'dailyClaim', pressed: false
    };
    this.doubleBtn = {
      x: contentX, y: this.gridY + this.tileH + 16, w: contentW, h: 46,
      action: 'dailyDouble', pressed: false
    };
    buttons.push(this.daily.claimedToday && this.daily.doubleAvailable ? this.doubleBtn : this.claimBtn);
  } else {
    this.rowGap = 7;
    this.rowH = Math.max(52, Math.min(64, (this.h - (this.contentY - this.y) - 30 - this.rowGap * 3) / 4));
    this.questBtns = [];
    for (var i = 0; i < this.quests.length; i++) {
      var q = this.quests[i];
      buttons.push({
        x: contentX + contentW - 74,
        y: this.contentY + i * (this.rowH + this.rowGap) + (this.rowH - 30) / 2,
        w: 74, h: 30, action: 'quest:' + q.id, pressed: false, id: q.id, enabled: q.canClaim
      });
    }
  }
  this.buttons = buttons;
};

DailyOverlay.prototype.render = function (ctx) {
  var W = this.W;
  var H = this.H;
  UI.dim(ctx, W, H, 0.58);

  ctx.save();
  UI.shadow(ctx, 'rgba(0,0,0,0.35)', 26, 0, 10);
  UI.fillRR(ctx, this.x, this.y, this.w, this.h, 24, '#FFF8E8');
  UI.clearShadow(ctx);
  UI.fillRR(ctx, W / 2 - 20, this.y + 7, 40, 4, 2, 'rgba(126,90,56,0.22)');

  UI.text(ctx, this.mode === 'daily' ? '每日补给' : '今日任务', this.x + 20, this.y + 32, 22, T.ink, 'left', 900);
  var cw = 100;
  var cx = this.x + this.w - 14 - 36 - 8 - cw;
  UI.pill(ctx, cx, this.y + 16, cw, 32, 'rgba(255,248,232,0.95)', 'rgba(150,103,52,0.3)');
  UI.drawCoin(ctx, cx + 18, this.y + 32, 10);
  UI.text(ctx, String(Economy.s.coins), cx + cw - 10, this.y + 32, 15, T.ink, 'right', 800);
  UI.fillRR(ctx, this.closeBtn.x, this.closeBtn.y, 36, 36, 12, 'rgba(126,90,56,0.09)');
  UI.drawIcon(ctx, 'close', this.closeBtn.x + 18, this.closeBtn.y + 18, 17, T.inkSoft);

  // tabs
  for (var i = 0; i < this.tabs.length; i++) {
    var tab = this.tabs[i];
    var on = tab.mode === this.mode;
    UI.fillRR(ctx, tab.x, tab.y, tab.w, tab.h, 12, on ? '#6FA85E' : 'rgba(126,90,56,0.08)');
    UI.text(ctx, tab.label, tab.x + tab.w / 2, tab.y + tab.h / 2, 13, on ? '#FFFDF4' : T.inkSoft, 'center', 800);
  }

  if (this.mode === 'daily') {
    this.renderDaily(ctx);
  } else {
    this.renderTasks(ctx);
  }

  UI.text(ctx, '每日 0 点刷新 · 看广告可获得额外收益', W / 2, this.y + this.h - 12, 9, 'rgba(126,90,56,0.55)', 'center', 600);
  ctx.restore();
};

DailyOverlay.prototype.renderDaily = function (ctx) {
  var x = this.x + 14;
  var y = this.gridY;
  var info = this.daily;
  var streak = Economy.s.daily.streak || 0;
  var claimedCount = info.claimedToday ? ((Math.max(1, streak) - 1) % 7) + 1 : streak % 7;
  var todayIndex = info.day;

  for (var i = 0; i < 7; i++) {
    var tx = x + i * (this.tileW + this.tileGap);
    var claimed = (i + 1) <= claimedCount;
    var isToday = (i + 1) === todayIndex;
    var fill = claimed ? 'rgba(111,168,94,0.18)' : (isToday ? '#FCE3A9' : 'rgba(126,90,56,0.06)');
    UI.fillRR(ctx, tx, y, this.tileW, this.tileH, 10, fill);
    if (isToday) UI.strokeRR(ctx, tx, y, this.tileW, this.tileH, 10, 'rgba(242,184,75,0.9)', 1.6);
    UI.text(ctx, 'D' + (i + 1), tx + this.tileW / 2, y + 14, 9.5, claimed ? T.greenDark : T.inkSoft, 'center', 800);
    UI.drawCoin(ctx, tx + this.tileW / 2, y + 35, 8.5);
    UI.text(ctx, String(CONFIG.dailyRewards[i]), tx + this.tileW / 2, y + 54, 11, claimed ? T.greenDark : T.ink, 'center', 800);
    if (claimed) {
      ctx.beginPath();
      ctx.arc(tx + this.tileW - 8, y + 8, 7, 0, Math.PI * 2);
      ctx.fillStyle = T.green;
      ctx.fill();
      UI.drawIcon(ctx, 'check', tx + this.tileW - 8, y + 8, 8, '#FFF');
    }
  }

  UI.text(ctx, '连续登录第 ' + Math.max(1, info.claimedToday ? streak : info.nextStreak) + ' 天', x, y + this.tileH + 3, 10.5, T.inkSoft, 'left', 600);

  var showDouble = info.claimedToday && info.doubleAvailable;
  var b;
  if (showDouble) {
    b = UI.makeButton({
      x: this.doubleBtn.x, y: this.doubleBtn.y, w: this.doubleBtn.w, h: this.doubleBtn.h,
      radius: 15, label: '看视频再翻倍 +' + (info.lastReward || 0), kind: 'gold', size: 15
    });
    b.pressed = this.doubleBtn.pressed;
    UI.button(ctx, b);
  } else {
    var label = info.claimedToday ? '今日已领取' : '领取第 ' + info.day + ' 天 +' + info.reward;
    b = UI.makeButton({
      x: this.claimBtn.x, y: this.claimBtn.y, w: this.claimBtn.w, h: this.claimBtn.h,
      radius: 15, label: label, kind: info.claimedToday ? 'secondary' : 'primary', size: 15,
      enabled: !info.claimedToday
    });
    b.pressed = this.claimBtn.pressed;
    UI.button(ctx, b);
  }

  UI.text(ctx, '提示：补给箱与每日奖励都可以用激励视频翻倍', this.W / 2, this.claimBtn.y + 66, 9.5, 'rgba(126,90,56,0.6)', 'center', 600);
};

DailyOverlay.prototype.renderTasks = function (ctx) {
  var x = this.x + 14;
  var y = this.contentY;
  var contentW = this.w - 28;

  for (var i = 0; i < this.quests.length; i++) {
    var q = this.quests[i];
    var ry = y + i * (this.rowH + this.rowGap);
    UI.fillRR(ctx, x, ry, contentW, this.rowH, 13, 'rgba(126,90,56,0.06)');
    UI.text(ctx, q.text, x + 12, ry + 17, 12, T.ink, 'left', 800);
    UI.text(ctx, q.progress + '/' + q.target, x + contentW - 84, ry + 17, 10, T.inkSoft, 'right', 700);
    UI.bar(ctx, x + 12, ry + this.rowH - 16, contentW - 108, 5, q.progress / q.target, T.green, 'rgba(126,90,56,0.14)', 2.5);

    var b = null;
    for (var k = 0; k < this.buttons.length; k++) {
      if (this.buttons[k].action === 'quest:' + q.id) { b = this.buttons[k]; break; }
    }
    if (b) {
      var label = q.claimed ? '已领取' : (q.canClaim ? '+' + q.reward : '进行中');
      var btn = UI.makeButton({
        x: b.x, y: b.y, w: b.w, h: b.h, radius: 10, label: label,
        kind: q.canClaim ? 'gold' : 'secondary', size: 10, enabled: q.canClaim
      });
      btn.pressed = b.pressed;
      UI.button(ctx, btn);
    }
  }
};

DailyOverlay.prototype.update = function (dt) {
  this.t += dt;
};

DailyOverlay.prototype.onDown = function (p) {
  this.active = null;
  if (UI.hit(this.closeBtn, p.x, p.y)) { this.active = this.closeBtn; return; }
  for (var i = 0; i < this.tabs.length; i++) {
    if (UI.hit(this.tabs[i], p.x, p.y)) { this.active = this.tabs[i]; Sound.tap(); return; }
  }
  for (var j = 0; j < this.buttons.length; j++) {
    var b = this.buttons[j];
    if (UI.hit(b, p.x, p.y)) {
      if (b.enabled === false) return;
      this.active = b;
      b.pressed = true;
      Sound.tap();
      return;
    }
  }
};

DailyOverlay.prototype.onUp = function (p) {
  var a = this.active;
  this.active = null;
  if (a && a.pressed !== undefined) a.pressed = false;
  if (!a || !UI.hit(a, p.x, p.y)) return;

  if (a === this.closeBtn) {
    this.closed = true;
    if (this.onClose) this.onClose();
    return;
  }
  if (a.mode) {
    this.mode = a.mode;
    this.layout();
    return;
  }
  if (a.action === 'dailyClaim') {
    var r = Economy.claimDaily();
    if (r.ok) {
      Sound.coin();
      this.main.notify('第 ' + r.day + ' 天补给 +' + r.reward + ' 土豆币');
      this.refresh();
    }
  } else if (a.action === 'dailyDouble') {
    var self = this;
    this.main.rewarded('daily_double', function () {
      var rr = Economy.doubleDaily();
      if (rr.ok) {
        Sound.coin();
        self.main.notify('每日补给翻倍 +' + rr.reward);
        self.refresh();
      }
    });
  } else if (a.action && a.action.indexOf('quest:') === 0) {
    var res = Economy.claimQuest(a.action.slice(6));
    if (res.ok) {
      Sound.coin();
      this.main.notify('任务完成 +' + res.reward + ' 土豆币');
      this.refresh();
    }
  }
};

module.exports = DailyOverlay;

};
__defs["scenes/settings"] = function(module, exports, require){
/**
 * 设置与关于。
 */
var CONFIG = require('../config');
var Platform = require('../platform');
var Economy = require('../economy');
var Sound = require('../audio');
var UI = require('../ui');
var T = UI.T;

function SettingsOverlay(main, onClose) {
  this.main = main;
  this.onClose = onClose;
  this.closed = false;
  this.active = null;
  this.resetArmed = false;
  this.armT = 0;
  this.layout();
}

SettingsOverlay.prototype.layout = function () {
  var W = this.main.W;
  var H = this.main.H;
  this.W = W;
  this.H = H;
  this.w = Math.min(W - 36, 340);
  this.h = 400;
  this.x = (W - this.w) / 2;
  this.y = (H - this.h) / 2;
  this.build();
};

SettingsOverlay.prototype.build = function () {
  var x = this.x;
  var y = this.y;
  var w = this.w;
  this.rows = [
    { x: x + 16, y: y + 74, w: w - 32, h: 52, action: 'sound' },
    { x: x + 16, y: y + 132, w: w - 32, h: 52, action: 'haptic' }
  ];
  this.closeBtn = { x: x + w - 46, y: y + 12, w: 36, h: 36 };
  this.shareBtn = { x: x + 16, y: y + 218, w: w - 32, h: 46, action: 'share', pressed: false };
  this.resetBtn = { x: x + 16, y: y + 274, w: w - 32, h: 40, action: 'reset', pressed: false };
};

SettingsOverlay.prototype.render = function (ctx) {
  UI.dim(ctx, this.W, this.H, 0.6);
  var x = this.x;
  var y = this.y;
  var w = this.w;
  ctx.save();
  UI.shadow(ctx, 'rgba(0,0,0,0.35)', 26, 0, 10);
  UI.fillRR(ctx, x, y, w, this.h, 22, '#FFF8E8');
  UI.clearShadow(ctx);

  UI.text(ctx, '设置', x + 20, y + 30, 21, T.ink, 'left', 900);
  UI.fillRR(ctx, this.closeBtn.x, this.closeBtn.y, 36, 36, 12, 'rgba(126,90,56,0.09)');
  UI.drawIcon(ctx, 'close', this.closeBtn.x + 18, this.closeBtn.y + 18, 17, T.inkSoft);

  // 音效 / 震动
  this.drawToggleRow(ctx, this.rows[0], '音效', Economy.s.settings.sound, 'sound', true);
  this.drawToggleRow(ctx, this.rows[1], '震动反馈', Economy.s.settings.haptics, 'hand', false);

  var sb = UI.makeButton({
    x: this.shareBtn.x, y: this.shareBtn.y, w: this.shareBtn.w, h: this.shareBtn.h,
    radius: 14, label: '分享给工友', kind: 'primary', size: 14, icon: 'share'
  });
  sb.pressed = this.shareBtn.pressed;
  UI.button(ctx, sb);

  var rb = UI.makeButton({
    x: this.resetBtn.x, y: this.resetBtn.y, w: this.resetBtn.w, h: this.resetBtn.h,
    radius: 12, label: this.resetArmed ? '再次点击确认清空存档' : '清空存档',
    kind: 'secondary', size: 11.5
  });
  rb.pressed = this.resetBtn.pressed;
  UI.button(ctx, rb);

  UI.text(ctx, CONFIG.title + ' v' + CONFIG.version, x + w / 2, y + 336, 11, T.ink, 'center', 800);
  UI.text(ctx, '灵感来自 Steam《Potato Please》', x + w / 2, y + 354, 9.5, T.inkSoft, 'center', 600);
  UI.text(ctx, '广告由微信流量主提供 · 无内购', x + w / 2, y + 370, 9.5, T.inkSoft, 'center', 600);
  ctx.restore();
};

SettingsOverlay.prototype.drawToggleRow = function (ctx, r, label, on, icon, isSound) {
  UI.fillRR(ctx, r.x, r.y, r.w, r.h, 13, 'rgba(126,90,56,0.06)');
  UI.drawIcon(ctx, icon, r.x + 26, r.y + r.h / 2, 20, T.ink);
  UI.text(ctx, label, r.x + 48, r.y + r.h / 2, 13, T.ink, 'left', 800);
  var sw = 48;
  var sh = 28;
  var sx = r.x + r.w - 14 - sw;
  var sy = r.y + (r.h - sh) / 2;
  UI.fillRR(ctx, sx, sy, sw, sh, sh / 2, on ? T.green : 'rgba(126,90,56,0.22)');
  ctx.beginPath();
  ctx.arc(sx + (on ? sw - sh / 2 : sh / 2), sy + sh / 2, sh / 2 - 3, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFDF4';
  ctx.fill();
};

SettingsOverlay.prototype.update = function (dt) {
  if (this.resetArmed) {
    this.armT -= dt;
    if (this.armT <= 0) { this.resetArmed = false; }
  }
};

SettingsOverlay.prototype.onDown = function (p) {
  this.active = null;
  if (UI.hit(this.closeBtn, p.x, p.y)) { this.active = this.closeBtn; return; }
  for (var i = 0; i < this.rows.length; i++) {
    if (UI.hit(this.rows[i], p.x, p.y)) { this.active = this.rows[i]; Sound.tap(); return; }
  }
  if (UI.hit(this.shareBtn, p.x, p.y)) { this.active = this.shareBtn; this.shareBtn.pressed = true; Sound.tap(); return; }
  if (UI.hit(this.resetBtn, p.x, p.y)) { this.active = this.resetBtn; this.resetBtn.pressed = true; Sound.tap(); }
};

SettingsOverlay.prototype.onUp = function (p) {
  var a = this.active;
  this.active = null;
  if (this.shareBtn) this.shareBtn.pressed = false;
  if (this.resetBtn) this.resetBtn.pressed = false;
  if (!a || !UI.hit(a, p.x, p.y)) return;

  if (a === this.closeBtn) {
    this.closed = true;
    if (this.onClose) this.onClose();
  } else if (a.action === 'sound') {
    var on = !Economy.s.settings.sound;
    Economy.setSetting('sound', on);
    Sound.setMuted(!on);
    if (on) Sound.tap();
  } else if (a.action === 'haptic') {
    var h = !Economy.s.settings.haptics;
    Economy.setSetting('haptics', h);
    if (h) Platform.haptic('medium');
  } else if (a.action === 'share') {
    this.main.shareGame();
  } else if (a.action === 'reset') {
    if (!this.resetArmed) {
      this.resetArmed = true;
      this.armT = 3;
      this.main.notify('再次点击“清空存档”以确认');
    } else {
      Economy.resetAll();
      Sound.setMuted(!Economy.s.settings.sound);
      this.main.notify('存档已清空');
      this.closed = true;
      if (this.onClose) this.onClose();
    }
  }
};

module.exports = SettingsOverlay;

};
__defs["scenes/play"] = function(module, exports, require){
/**
 * 削皮玩法：滑动擦除土豆皮，控制浪费，限时交单。
 */
var CONFIG = require('../config');
var Platform = require('../platform');
var Economy = require('../economy');
var Ads = require('../ads');
var Sound = require('../audio');
var UI = require('../ui');
var T = UI.T;
var Potato = require('../potato');
var FX = require('../fx');

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  var m = Math.floor(s / 60);
  var ss = s % 60;
  return m + ':' + (ss < 10 ? '0' : '') + ss;
}
function easeOutBack(x) {
  var c1 = 1.70158;
  var c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function PlayScene(main) {
  this.main = main;
  this.order = Economy.nextOrder();
  this.effects = Economy.effects();
  this.results = [];
  this.index = 0;
  this.timeLeft = this.order.timeLimit;
  this.timerStarted = false;
  this.t = 0;
  this.fx = new FX();
  this.dragging = false;
  this.pressedAction = null;
  this.overlayT = 0;
  this.serveT = 0;
  this.leaving = false;
  this.revived = false;
  this.doubled = false;
  this.summary = null;
  this.targetCoins = 0;
  this.coinShown = 0;
  this.wasteFlash = 0;
  this.peelHapticT = 0;
  this.wasteTextT = 0;
  this.targetNotified = false;
  this.hintT = 0;
  this.lastPoint = null;
  this.tutorial = !Economy.s.tutorialDone;
  this.state = this.tutorial ? 'tutorial' : 'play';
  this.layout();
  this.spawnPotato(0);
  this.state = this.tutorial ? 'tutorial' : 'play';
}

PlayScene.prototype.enter = function () {
  Ads.hideBanner();
};

PlayScene.prototype.onHide = function () {
  if (this.state === 'play') this.openPause();
  Economy.save();
};

PlayScene.prototype.layout = function () {
  var W = this.main.W;
  var H = this.main.H;
  var st = Platform.safeTop;
  var sb = Platform.safeBottom;
  this.W = W;
  this.H = H;
  this.safeTop = st;
  this.safeBottom = sb;
  this.R = Math.min(W * 0.31, H * 0.16, 132);
  this.cx = W / 2;
  this.cy = st + H * 0.42;
  this.boardY = this.cy + this.R * 0.92;

  this.progressW = Math.min(W - 32, 322);
  this.progressH = 66;
  this.progressX = (W - this.progressW) / 2;
  this.progressY = this.boardY + this.R * 0.34 + 10;

  this.pauseBtn = { x: 16, y: st + 10, w: 42, h: 42 };
  this.completeBtn = { x: (W - 200) / 2, y: H - sb - 100, w: 200, h: 52 };

  // 结果卡
  var rw = Math.min(W - 36, 344);
  var rh = Math.min(480, H - 56);
  this.resultCard = { x: (W - rw) / 2, y: (H - rh) / 2, w: rw, h: rh };
  this.resultDoubleBtn = { x: this.resultCard.x + 20, y: this.resultCard.y + 318, w: rw - 40, h: 44, action: 'double', pressed: false };
  this.resultNextBtn = { x: this.resultCard.x + 20, y: this.resultCard.y + 370, w: rw - 40, h: 48, action: 'next', pressed: false };
  this.resultHomeBtn = { x: this.resultCard.x + 20, y: this.resultCard.y + 426, w: rw - 40, h: 38, action: 'home', pressed: false };

  // 暂停卡
  var pw = Math.min(W - 44, 320);
  var ph = 316;
  this.pauseCard = { x: (W - pw) / 2, y: (H - ph) / 2, w: pw, h: ph };
  this.pauseResumeBtn = { x: this.pauseCard.x + 24, y: this.pauseCard.y + 138, w: pw - 48, h: 48, action: 'resume', pressed: false };
  this.pauseRestartBtn = { x: this.pauseCard.x + 24, y: this.pauseCard.y + 196, w: pw - 48, h: 44, action: 'restart', pressed: false };
  this.pauseHomeBtn = { x: this.pauseCard.x + 24, y: this.pauseCard.y + 250, w: pw - 48, h: 40, action: 'home', pressed: false };

  // 失败卡
  var fw = Math.min(W - 44, 330);
  var fh = 336;
  this.failCard = { x: (W - fw) / 2, y: (H - fh) / 2, w: fw, h: fh };
  this.failReviveBtn = { x: this.failCard.x + 24, y: this.failCard.y + 164, w: fw - 48, h: 46, action: 'revive', pressed: false };
  this.failRestartBtn = { x: this.failCard.x + 24, y: this.failCard.y + 218, w: fw - 48, h: 44, action: 'restart', pressed: false };
  this.failHomeBtn = { x: this.failCard.x + 24, y: this.failCard.y + 272, w: fw - 48, h: 38, action: 'home', pressed: false };

  // 教学卡
  var tw = Math.min(W - 44, 330);
  var th = 336;
  this.tutorialCard = { x: (W - tw) / 2, y: (H - th) / 2, w: tw, h: th };
  this.tutorialBtn = { x: this.tutorialCard.x + 24, y: this.tutorialCard.y + th - 70, w: tw - 48, h: 46, action: 'tutorialStart', pressed: false };
};

PlayScene.prototype.spawnPotato = function (i) {
  if (this.potato) this.potato.dispose();
  var golden = this.order.goldenIndex === i;
  var target = golden ? CONFIG.order.goldenPeel : this.order.target;
  var seed = (Platform.now() + i * 7919 + this.order.index * 104729) >>> 0;
  this.potato = new Potato({
    cx: this.cx,
    cy: this.cy,
    R: this.R * (0.97 + (i % 3) * 0.015),
    dpr: this.main.dpr,
    golden: golden,
    target: target,
    brush: this.effects.brush,
    wasteDepth: this.effects.wasteDepth,
    seed: seed
  });
  this.currentGolden = golden;
  this.currentTarget = target;
  this.targetNotified = false;
  this.serveT = 0;
  this.dragging = false;
  this.lastPoint = null;
};

PlayScene.prototype.onDown = function (p) {
  if (this.leaving) return;
  var st = this.state;

  if (st === 'tutorial') {
    if (UI.hit(this.tutorialBtn, p.x, p.y)) this.pressedAction = 'tutorialStart';
    return;
  }
  if (st === 'paused') {
    if (UI.hit(this.pauseResumeBtn, p.x, p.y)) this.pressedAction = 'resume';
    else if (UI.hit(this.pauseRestartBtn, p.x, p.y)) this.pressedAction = 'restart';
    else if (UI.hit(this.pauseHomeBtn, p.x, p.y)) this.pressedAction = 'home';
    if (this.pressedAction) Sound.tap();
    return;
  }
  if (st === 'result') {
    if (UI.hit(this.resultDoubleBtn, p.x, p.y)) this.pressedAction = 'double';
    else if (UI.hit(this.resultNextBtn, p.x, p.y)) this.pressedAction = 'next';
    else if (UI.hit(this.resultHomeBtn, p.x, p.y)) this.pressedAction = 'home';
    if (this.pressedAction) Sound.tap();
    return;
  }
  if (st === 'fail') {
    if (UI.hit(this.failReviveBtn, p.x, p.y)) this.pressedAction = 'revive';
    else if (UI.hit(this.failRestartBtn, p.x, p.y)) this.pressedAction = 'restart';
    else if (UI.hit(this.failHomeBtn, p.x, p.y)) this.pressedAction = 'home';
    if (this.pressedAction) Sound.tap();
    return;
  }
  if (st !== 'play') return;

  if (UI.hit(this.pauseBtn, p.x, p.y)) { this.pressedAction = 'pause'; Sound.tap(); return; }
  if (this.canComplete() && UI.hit(this.completeBtn, p.x, p.y)) {
    this.pressedAction = 'complete';
    Sound.tap();
    return;
  }

  this.dragging = true;
  this.lastPoint = { x: p.x, y: p.y };
  this.potato.beginStroke(p.x, p.y);
  if (!this.timerStarted) {
    this.timerStarted = true;
    Platform.reportEvent('order_start_peel', { order: this.order.index });
  }
  this.hintT = 99;
};

PlayScene.prototype.onMove = function (p) {
  if (this.state !== 'play' || !this.dragging || !this.lastPoint) return;
  var dx = p.x - this.lastPoint.x;
  var dy = p.y - this.lastPoint.y;
  var res = this.potato.peelTo(p.x, p.y);
  if (res.removed > 0) {
    Sound.peel();
    if (this.peelHapticT <= 0) {
      Platform.haptic('light');
      this.peelHapticT = 0.11;
    }
    this.fx.peelBurst(p.x, p.y, dx, dy, this.currentGolden ? 2 : 2, this.currentGolden);
  }
  if (res.wasteAdded > 0) {
    this.wasteFlash = Math.min(0.5, this.wasteFlash + 0.16);
    if (this.wasteTextT <= 0) {
      this.fx.floatText(p.x, p.y - 26, '浪费!', T.red, 14);
      this.wasteTextT = 0.8;
    }
    Platform.haptic('medium');
  }
  this.lastPoint = { x: p.x, y: p.y };

  if (!this.targetNotified && this.potato.progress() >= this.potato.target) {
    this.targetNotified = true;
    Sound.star();
    Platform.haptic('medium');
    this.main.notify('削净达标，可以交差了');
  }
};

PlayScene.prototype.onUp = function (p) {
  if (this.leaving) return;
  var st = this.state;
  var a = this.pressedAction;
  this.pressedAction = null;

  if (st === 'tutorial') {
    if (a === 'tutorialStart' && UI.hit(this.tutorialBtn, p.x, p.y)) this.startTutorial();
    return;
  }
  if (st === 'paused') {
    if (a === 'resume' && UI.hit(this.pauseResumeBtn, p.x, p.y)) { this.state = 'play'; Sound.tap(); }
    else if (a === 'restart' && UI.hit(this.pauseRestartBtn, p.x, p.y)) this.restartOrder();
    else if (a === 'home' && UI.hit(this.pauseHomeBtn, p.x, p.y)) this.main.toMenu();
    return;
  }
  if (st === 'result') {
    if (a === 'double' && UI.hit(this.resultDoubleBtn, p.x, p.y)) this.doubleResult();
    else if (a === 'next' && UI.hit(this.resultNextBtn, p.x, p.y)) this.leaveTo('next');
    else if (a === 'home' && UI.hit(this.resultHomeBtn, p.x, p.y)) this.leaveTo('home');
    return;
  }
  if (st === 'fail') {
    if (a === 'revive' && UI.hit(this.failReviveBtn, p.x, p.y)) this.revive();
    else if (a === 'restart' && UI.hit(this.failRestartBtn, p.x, p.y)) this.restartOrder();
    else if (a === 'home' && UI.hit(this.failHomeBtn, p.x, p.y)) this.main.toMenu();
    return;
  }
  if (st !== 'play') return;

  if (a === 'pause' && UI.hit(this.pauseBtn, p.x, p.y)) { this.openPause(); return; }
  if (a === 'complete' && UI.hit(this.completeBtn, p.x, p.y)) { this.finishPotato(); return; }
  if (this.dragging) {
    this.potato.endStroke();
    this.dragging = false;
  }
};

PlayScene.prototype.startTutorial = function () {
  this.tutorial = false;
  this.state = 'play';
  Economy.markTutorialDone();
  Sound.tap();
};

PlayScene.prototype.openPause = function () {
  if (this.state !== 'play') return;
  this.state = 'paused';
  this.dragging = false;
  this.pressedAction = null;
  this.overlayT = 0;
};

PlayScene.prototype.restartOrder = function () {
  if (this.leaving) return;
  this.leaving = true;
  this.main.startOrder();
};

PlayScene.prototype.canComplete = function () {
  return this.state === 'play' && this.potato && this.potato.progress() >= this.potato.target;
};

PlayScene.prototype.finishPotato = function () {
  if (!this.canComplete()) return;
  var waste = this.potato.waste();
  var peel = this.potato.progress();
  var grade = Economy.gradeForWaste(waste);
  this.results.push({ waste: waste, peel: peel, grade: grade, golden: this.currentGolden });
  this.state = 'serving';
  this.serveT = 0;
  this.dragging = false;
  this.potato.endStroke();
  this.potato.completed = true;

  Sound.complete();
  Platform.haptic('heavy');
  this.fx.sparkle(this.cx, this.cy, 18, this.currentGolden ? '#FFE28A' : '#F2B84B', 60);
  this.fx.floatText(this.cx, this.cy - this.R * 0.4, grade.key + ' · ' + grade.name, grade.color, 24);
};

PlayScene.prototype.completeOrder = function () {
  this.summary = Economy.finishOrder(this.order, this.results);
  this.state = 'result';
  this.overlayT = 0;
  this.main.toast.life = 0;
  this.coinShown = 0;
  this.targetCoins = this.summary.coins;
  this.doubled = false;
  this.dragging = false;
  Sound.star();
  Platform.haptic('heavy');
  Platform.reportEvent('result_show', { order: this.order.index, grade: this.summary.grade.key });
};

PlayScene.prototype.doubleResult = function () {
  if (this.doubled || !this.summary) return;
  var self = this;
  this.main.rewarded('result_double', function () {
    Economy.addCoins(self.summary.coins);
    self.doubled = true;
    self.targetCoins = self.summary.coins * 2;
    Sound.coin();
    self.main.notify('结算金币翻倍 +' + self.summary.coins);
  });
};

PlayScene.prototype.leaveTo = function (where) {
  if (this.leaving) return;
  this.leaving = true;
  var main = this.main;
  if (this.potato) this.potato.dispose();
  main.maybeInterstitial(function () {
    if (where === 'next') main.startOrder();
    else main.toMenu();
  });
};

PlayScene.prototype.fail = function () {
  if (this.state !== 'play') return;
  this.state = 'fail';
  this.overlayT = 0;
  this.dragging = false;
  this.timerStarted = false;
  Sound.fail();
  Platform.haptic('heavy');
  Economy.failOrder(this.order);
};

PlayScene.prototype.revive = function () {
  if (this.revived) { this.main.notify('本单已经加过时了'); return; }
  var self = this;
  this.main.rewarded('fail_revive', function () {
    self.revived = true;
    self.timeLeft += 15;
    self.state = 'play';
    self.timerStarted = true;
    self.main.notify('加时 15 秒，继续削！');
  });
};

PlayScene.prototype.update = function (dt) {
  this.t += dt;
  if (this.potato) {
    if (this.potato.introT < 1) this.potato.introT = Math.min(1, this.potato.introT + dt * 3.4);
    if (this.state === 'serving') {
      this.potato.goneT = Math.min(1, this.potato.goneT + dt * 2.6);
    }
  }
  this.fx.update(dt);
  if (this.wasteFlash > 0) this.wasteFlash = Math.max(0, this.wasteFlash - dt * 1.6);
  if (this.peelHapticT > 0) this.peelHapticT -= dt;
  if (this.wasteTextT > 0) this.wasteTextT -= dt;
  if (this.hintT < 99) this.hintT += dt;

  if (this.state === 'play' && this.timerStarted) {
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.fail();
    }
  }

  if (this.state === 'serving') {
    this.serveT += dt;
    if (this.serveT >= 0.62) {
      if (this.index + 1 < this.order.count) {
        this.index += 1;
        this.spawnPotato(this.index);
        this.state = 'play';
      } else {
        this.completeOrder();
      }
    }
  }

  if (this.state === 'result') {
    this.overlayT = Math.min(1, this.overlayT + dt * 4);
    var target = this.targetCoins || 0;
    this.coinShown += (target - this.coinShown) * Math.min(1, dt * 6);
    if (Math.abs(target - this.coinShown) < 0.6) this.coinShown = target;
  } else if (this.state === 'fail' || this.state === 'paused' || this.state === 'tutorial') {
    this.overlayT = Math.min(1, this.overlayT + dt * 5);
  }
};

PlayScene.prototype.render = function (ctx) {
  this.drawBackground(ctx);
  this.drawBoard(ctx);
  if (this.potato) this.potato.render(ctx, this.t);
  this.fx.render(ctx);
  this.drawHUD(ctx);
  this.drawProgress(ctx);
  this.drawHint(ctx);
  this.drawCompleteButton(ctx);

  if (this.state === 'tutorial') this.drawTutorial(ctx);
  else if (this.state === 'paused') this.drawPause(ctx);
  else if (this.state === 'fail') this.drawFail(ctx);
  else if (this.state === 'result') this.drawResult(ctx);

  if (this.wasteFlash > 0) {
    ctx.fillStyle = 'rgba(217,105,79,' + (this.wasteFlash * 0.16) + ')';
    ctx.fillRect(0, 0, this.W, this.H);
  }
};

PlayScene.prototype.drawBackground = function (ctx) {
  var W = this.W;
  var H = this.H;
  var wallH = H * 0.66;

  var bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#F8E9C8');
  bg.addColorStop(0.6, '#EFDAB2');
  bg.addColorStop(1, '#D8B983');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.strokeStyle = '#E0C69A';
  ctx.lineWidth = 1;
  var tile = Math.max(40, W / 9);
  for (var x = 0; x < W; x += tile) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, wallH); ctx.stroke();
  }
  for (var y = 0; y < wallH; y += tile) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.restore();

  // 顶灯光锥
  var lg = ctx.createRadialGradient(this.cx, this.safeTop + 20, 8, this.cx, this.cy, this.R * 2.4);
  lg.addColorStop(0, 'rgba(255,248,220,0.6)');
  lg.addColorStop(1, 'rgba(255,248,220,0)');
  ctx.fillStyle = lg;
  ctx.fillRect(0, 0, W, H);

  // 台面
  var cg = ctx.createLinearGradient(0, wallH, 0, H);
  cg.addColorStop(0, '#C99159');
  cg.addColorStop(0.1, '#B57C46');
  cg.addColorStop(1, '#8A5629');
  ctx.fillStyle = cg;
  ctx.fillRect(0, wallH, W, H - wallH);
  ctx.fillStyle = 'rgba(255,236,200,0.28)';
  ctx.fillRect(0, wallH, W, 2);

  // 木纹
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = '#5E3A18';
  ctx.lineWidth = 1.2;
  for (var i = 0; i < 6; i++) {
    var yy = wallH + 30 + i * 40;
    ctx.beginPath();
    ctx.moveTo(0, yy);
    ctx.bezierCurveTo(W * 0.3, yy - 5, W * 0.65, yy + 6, W, yy - 2);
    ctx.stroke();
  }
  ctx.restore();

  // 墙上的配额牌
  var sx = W - 92;
  var sy = this.safeTop + 78;
  ctx.save();
  ctx.globalAlpha = 0.6;
  UI.fillRR(ctx, sx, sy, 74, 50, 8, '#F6E3BC');
  UI.strokeRR(ctx, sx, sy, 74, 50, 8, 'rgba(126,90,56,0.45)', 1.4);
  UI.text(ctx, '今日配额', sx + 37, sy + 15, 8, T.inkSoft, 'center', 700);
  UI.text(ctx, this.order.count + ' 颗', sx + 37, sy + 32, 14, T.ink, 'center', 900);
  ctx.restore();

  // 小桶
  var bx = W - 52;
  var by = this.boardY + this.R * 0.32;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(bx - 20, by - 20);
  ctx.lineTo(bx + 20, by - 20);
  ctx.lineTo(bx + 15, by + 22);
  ctx.lineTo(bx - 15, by + 22);
  ctx.closePath();
  ctx.fillStyle = 'rgba(120,78,34,0.75)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(70,40,15,0.4)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(bx, by - 20, 20, Math.PI, Math.PI * 2);
  ctx.strokeStyle = 'rgba(70,40,15,0.35)';
  ctx.stroke();
  for (var k = 0; k < this.results.length; k++) {
    ctx.beginPath();
    ctx.ellipse ? ctx.ellipse(bx - 8 + (k % 3) * 8, by - 18 + (k % 2) * 4, 7, 5, 0.2, 0, Math.PI * 2) :
      ctx.arc(bx - 8 + (k % 3) * 8, by - 18, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#F8E6B4';
    ctx.fill();
  }
  UI.text(ctx, '已入桶 ' + this.results.length, bx, by + 34, 8.5, 'rgba(255,244,214,0.85)', 'center', 700);
  ctx.restore();
};

PlayScene.prototype.drawBoard = function (ctx) {
  var cx = this.cx;
  var by = this.boardY;
  var rx = this.R * 1.48;
  var ry = this.R * 0.48;

  ctx.save();
  ctx.beginPath();
  ctx.ellipse ? ctx.ellipse(cx, by + 8, rx * 1.02, ry * 0.95, 0, 0, Math.PI * 2) :
    ctx.arc(cx, by + 8, rx * 0.7, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(60,34,12,0.22)';
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse ? ctx.ellipse(cx, by, rx, ry, 0, 0, Math.PI * 2) : ctx.arc(cx, by, rx * 0.7, 0, Math.PI * 2);
  var g = ctx.createLinearGradient(cx - rx, by - ry, cx + rx, by + ry);
  g.addColorStop(0, '#D6A067');
  g.addColorStop(0.5, '#C08A50');
  g.addColorStop(1, '#9A6738');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,52,20,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 年轮
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = '#6E4520';
  ctx.lineWidth = 1;
  for (var i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.ellipse ? ctx.ellipse(cx, by, rx * (0.25 + i * 0.18), ry * (0.25 + i * 0.18), 0, 0, Math.PI * 2) :
      ctx.arc(cx, by, rx * 0.4, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
};

PlayScene.prototype.drawHUD = function (ctx) {
  var W = this.W;
  var st = this.safeTop;

  // 暂停
  UI.button(ctx, UI.makeButton({
    x: this.pauseBtn.x, y: this.pauseBtn.y, w: 42, h: 42, kind: 'icon', radius: 13,
    icon: 'pause', iconSize: 17
  }));

  // 订单
  var ow = 136;
  var ox = (W - ow) / 2;
  UI.pill(ctx, ox, st + 12, ow, 38, 'rgba(255,248,232,0.94)', 'rgba(150,103,52,0.28)');
  UI.text(ctx, '第 ' + this.order.index + ' 单 · ' + (this.index + 1) + '/' + this.order.count, ox + ow / 2, st + 31, 13, T.ink, 'center', 800);

  // 计时
  var tw = 88;
  var tx = W - 16 - tw;
  var low = this.timeLeft <= 15;
  UI.pill(ctx, tx, st + 12, tw, 38, low ? 'rgba(217,105,79,0.16)' : 'rgba(255,248,232,0.94)', low ? 'rgba(217,105,79,0.55)' : 'rgba(150,103,52,0.28)');
  UI.drawIcon(ctx, 'clock', tx + 18, st + 31, 15, low ? T.red : T.inkSoft);
  UI.text(ctx, fmtTime(this.timeLeft), tx + tw - 12, st + 31, 15, low ? T.red : T.ink, 'right', 800);

  // 金土豆
  if (this.currentGolden) {
    var gw = 146;
    var gx = (W - gw) / 2;
    var gy = st + 58;
    UI.pill(ctx, gx, gy, gw, 24, 'rgba(242,184,75,0.9)');
    UI.text(ctx, '金土豆 · 需削净 95%', gx + gw / 2, gy + 12, 10, '#5E3A12', 'center', 800);
  }
};

PlayScene.prototype.drawProgress = function (ctx) {
  var x = this.progressX;
  var y = this.progressY;
  var w = this.progressW;
  var h = this.progressH;
  var p = this.potato ? this.potato.progress() : 0;
  var target = this.currentTarget || this.order.target;
  var waste = this.potato ? this.potato.waste() : 0;
  var done = p >= target;

  UI.fillRR(ctx, x, y, w, h, 16, 'rgba(255,248,232,0.95)');
  UI.strokeRR(ctx, x, y, w, h, 16, done ? 'rgba(242,184,75,0.85)' : 'rgba(150,103,52,0.24)', done ? 2 : 1.2);

  UI.text(ctx, '削净', x + 16, y + 15, 10, T.inkSoft, 'left', 700);
  UI.text(ctx, Math.round(p * 100) + '%', x + 16, y + 34, 19, done ? T.greenDark : T.ink, 'left', 900);
  UI.text(ctx, '目标 ' + Math.round(target * 100) + '%' + (done ? ' · 已达标' : ''), x + 82, y + 35, 9,
    done ? T.greenDark : T.inkSoft, 'left', done ? 800 : 600);

  UI.text(ctx, '浪费', x + w - 16, y + 15, 10, T.inkSoft, 'right', 700);
  UI.text(ctx, (waste * 100).toFixed(1) + '%', x + w - 16, y + 34, 16, waste > 0.04 ? T.red : T.ink, 'right', 900);

  UI.bar(ctx, x + 16, y + 51, w - 32, 6, p, done ? T.gold : T.green, 'rgba(126,90,56,0.14)', 3);
  var tx = x + 16 + (w - 32) * target;
  ctx.beginPath();
  ctx.moveTo(tx, y + 48);
  ctx.lineTo(tx, y + 60);
  ctx.strokeStyle = 'rgba(94,58,28,0.75)';
  ctx.lineWidth = 2;
  ctx.stroke();
};

PlayScene.prototype.drawHint = function (ctx) {
  var W = this.W;
  var y = this.progressY + this.progressH + 20;
  if (this.hintT > 4.2 && this.timerStarted) return;
  var text = this.timerStarted ? '别反复刮同一处，浪费会拉低评级' : '按住土豆，来回滑动开始削皮';
  var w = UI.measure(ctx, text, 11, 700) + 44;
  var x = (W - w) / 2;
  ctx.save();
  ctx.globalAlpha = this.timerStarted ? Math.max(0, 1 - (this.hintT - 2.4) / 1.8) : 0.9;
  UI.pill(ctx, x, y, w, 30, 'rgba(255,248,232,0.72)');
  UI.drawIcon(ctx, 'hand', x + 18, y + 15, 14, T.inkSoft);
  UI.text(ctx, text, x + 30, y + 15, 11, T.inkSoft, 'left', 700);
  ctx.restore();
};

PlayScene.prototype.drawCompleteButton = function (ctx) {
  if (!this.canComplete()) return;
  var b = UI.makeButton({
    x: this.completeBtn.x, y: this.completeBtn.y, w: this.completeBtn.w, h: this.completeBtn.h,
    radius: 16, label: '完成这颗', kind: 'primary', size: 18
  });
  b.pressed = this.pressedAction === 'complete';
  var pulse = 1 + Math.sin(this.t * 4) * 0.015;
  ctx.save();
  ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
  ctx.scale(pulse, pulse);
  ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
  UI.button(ctx, b);
  ctx.restore();
};

PlayScene.prototype.drawTutorial = function (ctx) {
  var c = this.tutorialCard;
  var k = easeOutBack(this.overlayT);
  UI.dim(ctx, this.W, this.H, 0.62);
  ctx.save();
  ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
  ctx.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k);
  ctx.translate(-(c.x + c.w / 2), -(c.y + c.h / 2));
  UI.shadow(ctx, 'rgba(0,0,0,0.35)', 24, 0, 10);
  UI.fillRR(ctx, c.x, c.y, c.w, c.h, 22, '#FFF8E8');
  UI.clearShadow(ctx);

  UI.text(ctx, '削土豆，先学三招', c.x + c.w / 2, c.y + 34, 20, T.ink, 'center', 900);

  // 手势图示
  var gx = c.x + c.w / 2;
  var gy = c.y + 90;
  ctx.beginPath();
  ctx.ellipse ? ctx.ellipse(gx, gy, 54, 34, 0, 0, Math.PI * 2) : ctx.arc(gx, gy, 42, 0, Math.PI * 2);
  ctx.fillStyle = '#B0743E';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse ? ctx.ellipse(gx - 12, gy + 6, 22, 14, 0, 0, Math.PI * 2) : ctx.arc(gx - 12, gy + 6, 18, 0, Math.PI * 2);
  ctx.fillStyle = '#F8E6B4';
  ctx.fill();
  var slide = Math.sin(this.t * 3) * 26;
  UI.drawIcon(ctx, 'hand', gx + slide, gy - 38, 28, '#B98556');
  ctx.beginPath();
  ctx.moveTo(gx - 38, gy - 32);
  ctx.lineTo(gx + 38, gy - 32);
  ctx.strokeStyle = 'rgba(126,90,56,0.3)';
  ctx.lineWidth = 2;
  ctx.setLineDash ? ctx.setLineDash([5, 5]) : null;
  ctx.stroke();
  if (ctx.setLineDash) ctx.setLineDash([]);

  var lines = [
    '按住土豆，来回滑动削皮',
    '别反复刮同一处，果肉会浪费',
    '削净达到目标，点「完成这颗」'
  ];
  for (var i = 0; i < lines.length; i++) {
    var ly = c.y + 150 + i * 32;
    ctx.beginPath();
    ctx.arc(c.x + 32, ly, 10, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(111,168,94,0.18)';
    ctx.fill();
    UI.text(ctx, String(i + 1), c.x + 32, ly, 10, T.greenDark, 'center', 800);
    UI.text(ctx, lines[i], c.x + 50, ly, 12, T.ink, 'left', 700);
  }

  var b = UI.makeButton({
    x: this.tutorialBtn.x, y: this.tutorialBtn.y, w: this.tutorialBtn.w, h: this.tutorialBtn.h,
    radius: 15, label: '开始削皮', kind: 'primary', size: 16
  });
  b.pressed = this.pressedAction === 'tutorialStart';
  UI.button(ctx, b);
  UI.text(ctx, '第一次上岗不计时', c.x + c.w / 2, c.y + c.h - 10, 9, T.inkSoft, 'center', 600);
  ctx.restore();
};

PlayScene.prototype.drawPause = function (ctx) {
  var c = this.pauseCard;
  var k = easeOutBack(this.overlayT);
  UI.dim(ctx, this.W, this.H, 0.6);
  ctx.save();
  ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
  ctx.scale(0.92 + 0.08 * k, 0.92 + 0.08 * k);
  ctx.translate(-(c.x + c.w / 2), -(c.y + c.h / 2));
  UI.shadow(ctx, 'rgba(0,0,0,0.35)', 24, 0, 10);
  UI.fillRR(ctx, c.x, c.y, c.w, c.h, 22, '#FFF8E8');
  UI.clearShadow(ctx);

  UI.text(ctx, '暂停', c.x + c.w / 2, c.y + 52, 24, T.ink, 'center', 900);
  UI.text(ctx, '军需处也需要喘口气', c.x + c.w / 2, c.y + 86, 11, T.inkSoft, 'center', 600);
  UI.text(ctx, '第 ' + this.order.index + ' 单 · ' + this.results.length + '/' + this.order.count + ' 颗已完成', c.x + c.w / 2, c.y + 110, 10, T.inkSoft, 'center', 600);

  var b1 = UI.makeButton({ x: this.pauseResumeBtn.x, y: this.pauseResumeBtn.y, w: this.pauseResumeBtn.w, h: this.pauseResumeBtn.h, radius: 15, label: '继续削', kind: 'primary', size: 16 });
  b1.pressed = this.pressedAction === 'resume';
  UI.button(ctx, b1);
  var b2 = UI.makeButton({ x: this.pauseRestartBtn.x, y: this.pauseRestartBtn.y, w: this.pauseRestartBtn.w, h: this.pauseRestartBtn.h, radius: 14, label: '重新开始本单', kind: 'secondary', size: 13 });
  b2.pressed = this.pressedAction === 'restart';
  UI.button(ctx, b2);
  var b3 = UI.makeButton({ x: this.pauseHomeBtn.x, y: this.pauseHomeBtn.y, w: this.pauseHomeBtn.w, h: this.pauseHomeBtn.h, radius: 12, label: '回大厅', kind: 'secondary', size: 12 });
  b3.pressed = this.pressedAction === 'home';
  UI.button(ctx, b3);
  ctx.restore();
};

PlayScene.prototype.drawFail = function (ctx) {
  var c = this.failCard;
  var k = easeOutBack(this.overlayT);
  UI.dim(ctx, this.W, this.H, 0.62);
  ctx.save();
  ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
  ctx.scale(0.92 + 0.08 * k, 0.92 + 0.08 * k);
  ctx.translate(-(c.x + c.w / 2), -(c.y + c.h / 2));
  UI.shadow(ctx, 'rgba(0,0,0,0.4)', 24, 0, 10);
  UI.fillRR(ctx, c.x, c.y, c.w, c.h, 22, '#FFF8E8');
  UI.clearShadow(ctx);

  ctx.beginPath();
  ctx.arc(c.x + c.w / 2, c.y + 56, 28, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(217,105,79,0.14)';
  ctx.fill();
  UI.drawIcon(ctx, 'clock', c.x + c.w / 2, c.y + 56, 26, T.red);

  UI.text(ctx, '时间到！', c.x + c.w / 2, c.y + 102, 22, T.ink, 'center', 900);
  UI.text(ctx, '军需官盯着空桶，眉头皱了起来。', c.x + c.w / 2, c.y + 126, 10.5, T.inkSoft, 'center', 600);
  UI.text(ctx, '已完成 ' + this.results.length + '/' + this.order.count + ' 颗', c.x + c.w / 2, c.y + 145, 12, T.ink, 'center', 800);

  var b1 = UI.makeButton({
    x: this.failReviveBtn.x, y: this.failReviveBtn.y, w: this.failReviveBtn.w, h: this.failReviveBtn.h,
    radius: 14, label: this.revived ? '本单已加时' : '看视频 · 加时 15 秒',
    kind: this.revived ? 'secondary' : 'gold', size: 14, enabled: !this.revived
  });
  b1.pressed = this.pressedAction === 'revive';
  UI.button(ctx, b1);
  var b2 = UI.makeButton({ x: this.failRestartBtn.x, y: this.failRestartBtn.y, w: this.failRestartBtn.w, h: this.failRestartBtn.h, radius: 14, label: '重新挑战', kind: 'primary', size: 14 });
  b2.pressed = this.pressedAction === 'restart';
  UI.button(ctx, b2);
  var b3 = UI.makeButton({ x: this.failHomeBtn.x, y: this.failHomeBtn.y, w: this.failHomeBtn.w, h: this.failHomeBtn.h, radius: 12, label: '回大厅', kind: 'secondary', size: 12 });
  b3.pressed = this.pressedAction === 'home';
  UI.button(ctx, b3);
  ctx.restore();
};

PlayScene.prototype.drawResult = function (ctx) {
  var c = this.resultCard;
  var k = easeOutBack(this.overlayT);
  var s = this.summary;
  if (!s) return;

  UI.dim(ctx, this.W, this.H, 0.66);
  ctx.save();
  ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
  ctx.scale(0.92 + 0.08 * k, 0.92 + 0.08 * k);
  ctx.translate(-(c.x + c.w / 2), -(c.y + c.h / 2));
  UI.shadow(ctx, 'rgba(0,0,0,0.45)', 30, 0, 12);
  UI.fillRR(ctx, c.x, c.y, c.w, c.h, 24, '#FFF8E8');
  UI.clearShadow(ctx);

  UI.text(ctx, '军需处验收', c.x + c.w / 2, c.y + 24, 10, T.inkSoft, 'center', 700);
  UI.text(ctx, '本单完成', c.x + c.w / 2, c.y + 48, 21, T.ink, 'center', 900);

  // 评级
  var gx = c.x + c.w / 2;
  var gy = c.y + 100;
  ctx.save();
  ctx.translate(gx, gy);
  ctx.rotate(-0.1);
  ctx.beginPath();
  ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.fillStyle = s.grade.color;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, 27, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  ctx.stroke();
  UI.text(ctx, s.grade.key, 0, 1, 34, '#FFFDF4', 'center', 900);
  ctx.restore();
  UI.text(ctx, s.grade.name + ' · 平均浪费 ' + (s.avgWaste * 100).toFixed(1) + '%', gx, gy + 52, 12, T.ink, 'center', 800);
  if (s.perfectRun) {
    UI.pill(ctx, gx - 62, gy + 64, 124, 22, 'rgba(242,184,75,0.2)');
    UI.text(ctx, '完美手感 · 收益 +12%', gx, gy + 75, 9.5, T.goldDark, 'center', 800);
  }

  // 统计
  var rowY = c.y + 208;
  var rows = [
    { label: '完成土豆', value: this.results.length + ' / ' + this.order.count + ' 颗' },
    { label: 'S 评级', value: s.sCount + ' 颗' },
    { label: '木桶加成', value: '+' + Math.round((s.coinMul - 1) * 100) + '%' }
  ];
  for (var i = 0; i < rows.length; i++) {
    UI.text(ctx, rows[i].label, c.x + 26, rowY + i * 24, 11, T.inkSoft, 'left', 600);
    UI.text(ctx, rows[i].value, c.x + c.w - 26, rowY + i * 24, 11, T.ink, 'right', 800);
  }

  // 金币
  UI.text(ctx, '土豆币', c.x + c.w / 2 - 34, c.y + 284, 10, T.inkSoft, 'center', 600);
  UI.drawCoin(ctx, c.x + c.w / 2 - 34, c.y + 304, 10);
  UI.text(ctx, '+' + Math.round(this.coinShown), c.x + c.w / 2 + 14, c.y + 304, 22, T.goldDark, 'center', 900);

  var bDouble = UI.makeButton({
    x: this.resultDoubleBtn.x, y: this.resultDoubleBtn.y, w: this.resultDoubleBtn.w, h: this.resultDoubleBtn.h,
    radius: 13, label: this.doubled ? '已领取双倍' : '看视频 · 金币翻倍 +' + s.coins,
    kind: this.doubled ? 'secondary' : 'gold', size: 12, enabled: !this.doubled
  });
  bDouble.pressed = this.pressedAction === 'double';
  UI.button(ctx, bDouble);

  var bNext = UI.makeButton({
    x: this.resultNextBtn.x, y: this.resultNextBtn.y, w: this.resultNextBtn.w, h: this.resultNextBtn.h,
    radius: 15, label: '下 一 单', kind: 'primary', size: 17
  });
  bNext.pressed = this.pressedAction === 'next';
  UI.button(ctx, bNext);

  var bHome = UI.makeButton({
    x: this.resultHomeBtn.x, y: this.resultHomeBtn.y, w: this.resultHomeBtn.w, h: this.resultHomeBtn.h,
    radius: 11, label: '回大厅', kind: 'secondary', size: 11.5
  });
  bHome.pressed = this.pressedAction === 'home';
  UI.button(ctx, bHome);
  ctx.restore();
};

PlayScene.prototype.onEscape = function () {
  if (this.state === 'play') this.openPause();
  else if (this.state === 'paused') this.state = 'play';
  else if (this.state === 'tutorial') this.startTutorial();
};

module.exports = PlayScene;

};
__defs["potato"] = function(module, exports, require){
/**
 * 土豆：不规则轮廓 + 皮肤图层擦除 + 果肉浪费深度。
 * 用低分辨率网格统计削净率，避免每帧读像素。
 */
var Platform = require('./platform');
var CONFIG = require('./config');

function rng(seed) {
  var s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function Potato(opts) {
  this.cx = opts.cx;
  this.cy = opts.cy;
  this.R = opts.R;
  this.dpr = opts.dpr || 1;
  this.golden = !!opts.golden;
  this.target = opts.target || 0.86;
  this.brush = opts.brush || 17;
  this.wasteThreshold = Math.max(8, Math.round(opts.wasteDepth || 26));
  this.seed = (opts.seed || Math.floor(Math.random() * 1e9)) >>> 0;
  this.rand = rng(this.seed);
  this.xScale = 1.06;
  this.yScale = 0.94;
  this.variant = Math.floor(this.rand() * 3);

  this.buildRadius();
  this.buildGrid();
  this.buildSkin();
  this.buildFleshBlobs();

  this.peeledCells = 0;
  this.wasteCells = 0;
  this.lastX = null;
  this.lastY = null;
  this.completed = false;
  this.introT = 0;
  this.goneT = 0;
  this.sparkT = 0;
}

Potato.prototype.buildRadius = function () {
  var N = 240;
  this.radTable = new Float32Array(N);
  this.radN = N;
  var p1 = this.rand() * 6.28;
  var p2 = this.rand() * 6.28;
  var p3 = this.rand() * 6.28;
  for (var i = 0; i < N; i++) {
    var th = i / N * Math.PI * 2;
    var r = 1 +
      0.052 * Math.sin(th * 3 + p1) +
      0.03 * Math.sin(th * 5 + p2) +
      0.017 * Math.sin(th * 7 + p3) +
      0.012 * Math.sin(th * 2 + p1 * 0.7);
    this.radTable[i] = r;
  }
};

Potato.prototype.radiusAt = function (theta) {
  var a = theta % (Math.PI * 2);
  if (a < 0) a += Math.PI * 2;
  var i = Math.floor(a / (Math.PI * 2) * this.radN) % this.radN;
  return this.radTable[i];
};

Potato.prototype.isInside = function (x, y) {
  var u = (x - this.cx) / (this.R * this.xScale);
  var v = (y - this.cy) / (this.R * this.yScale);
  var d2 = u * u + v * v;
  if (d2 > 1.25) return false;
  var d = Math.sqrt(d2);
  if (d < 0.00001) return true;
  return d <= this.radiusAt(Math.atan2(v, u));
};

Potato.prototype.buildGrid = function () {
  var N = CONFIG.play.grid;
  this.gw = N;
  this.gh = N;
  this.bw = this.R * 2 * this.xScale * 1.13;
  this.bh = this.R * 2 * this.yScale * 1.13;
  this.bx0 = this.cx - this.bw / 2;
  this.by0 = this.cy - this.bh / 2;
  this.cw = this.bw / N;
  this.ch = this.bh / N;
  this.inside = new Uint8Array(N * N);
  this.state = new Uint8Array(N * N);
  this.depth = new Uint8Array(N * N);
  this.insideTotal = 0;
  this.skinTotal = 0;
  for (var gy = 0; gy < N; gy++) {
    for (var gx = 0; gx < N; gx++) {
      var px = this.bx0 + (gx + 0.5) * this.cw;
      var py = this.by0 + (gy + 0.5) * this.ch;
      var idx = gy * N + gx;
      if (this.isInside(px, py)) {
        this.inside[idx] = 1;
        this.state[idx] = 1;
        this.insideTotal++;
        this.skinTotal++;
      }
    }
  }
};

Potato.prototype.shapePath = function (ctx, scale, ox, oy) {
  var N = 120;
  ox = ox || 0;
  oy = oy || 0;
  ctx.beginPath();
  for (var i = 0; i <= N; i++) {
    var th = i / N * Math.PI * 2;
    var r = this.radiusAt(th) * (scale || 1);
    var x = ox + Math.cos(th) * this.R * this.xScale * r;
    var y = oy + Math.sin(th) * this.R * this.yScale * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
};

Potato.prototype.skinColors = function () {
  if (this.golden) {
    return { top: '#F5D06B', mid: '#E2AC3F', bottom: '#B97C1F', edge: '#8A5A12' };
  }
  if (this.variant === 1) {
    return { top: '#C98A5D', mid: '#A85C3C', bottom: '#7E3E27', edge: '#5E2B17' };
  }
  if (this.variant === 2) {
    return { top: '#D5B073', mid: '#B98D4F', bottom: '#8E6532', edge: '#6A471E' };
  }
  return { top: '#C98F5B', mid: '#B0743E', bottom: '#82501F', edge: '#5F3714' };
};

Potato.prototype.buildSkin = function () {
  var SS = this.R * 2.5;
  this.SS = SS;
  this.skinSize = Math.ceil(SS * this.dpr);
  this.skin = Platform.createOffscreen(this.skinSize, this.skinSize);
  var ctx = this.skin.getContext('2d');
  var hasTransform = ctx.setTransform;
  if (hasTransform) ctx.setTransform(this.dpr, 0, 0, this.dpr, this.skinSize / 2, this.skinSize / 2);
  else { ctx.translate(this.skinSize / 2, this.skinSize / 2); ctx.scale(this.dpr, this.dpr); }

  var colors = this.skinColors();
  ctx.save();
  this.shapePath(ctx, 1);
  ctx.clip();

  var g = ctx.createLinearGradient(-this.R, -this.R, this.R * 0.9, this.R);
  g.addColorStop(0, colors.top);
  g.addColorStop(0.5, colors.mid);
  g.addColorStop(1, colors.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(-SS, -SS, SS * 2, SS * 2);

  // 皮面颗粒
  for (var i = 0; i < 210; i++) {
    var a = this.rand() * Math.PI * 2;
    var d = Math.sqrt(this.rand()) * 1.02;
    var x = Math.cos(a) * this.R * this.xScale * d;
    var y = Math.sin(a) * this.R * this.yScale * d;
    var sz = 0.5 + this.rand() * 1.9;
    ctx.beginPath();
    ctx.arc(x, y, sz, 0, Math.PI * 2);
    ctx.fillStyle = this.rand() > 0.5 ? 'rgba(255,235,190,0.18)' : 'rgba(70,38,12,0.18)';
    ctx.fill();
  }
  // 深色芽眼
  var eyes = 5 + Math.floor(this.rand() * 5);
  for (var e = 0; e < eyes; e++) {
    var ea = this.rand() * Math.PI * 2;
    var ed = Math.sqrt(this.rand()) * 0.92;
    var ex = Math.cos(ea) * this.R * this.xScale * ed;
    var ey = Math.sin(ea) * this.R * this.yScale * ed;
    var er = 1.5 + this.rand() * 3.2;
    ctx.beginPath();
    ctx.ellipse ? ctx.ellipse(ex, ey, er * 1.25, er, this.rand() * 3, 0, Math.PI * 2) : ctx.arc(ex, ey, er, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(70,38,12,0.55)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(ex - er * 0.25, ey - er * 0.25, er * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,230,180,0.35)';
    ctx.fill();
  }

  // 边缘暗部
  this.shapePath(ctx, 0.995);
  ctx.lineWidth = this.R * 0.12;
  ctx.strokeStyle = this.golden ? 'rgba(120,75,10,0.35)' : 'rgba(70,40,15,0.32)';
  ctx.stroke();

  // 左上高光
  var hg = ctx.createRadialGradient(-this.R * 0.32, -this.R * 0.38, this.R * 0.05, -this.R * 0.32, -this.R * 0.38, this.R * 0.95);
  hg.addColorStop(0, 'rgba(255,248,220,0.24)');
  hg.addColorStop(1, 'rgba(255,248,220,0)');
  ctx.fillStyle = hg;
  ctx.fillRect(-SS, -SS, SS * 2, SS * 2);

  ctx.restore();
};

Potato.prototype.buildFleshBlobs = function () {
  this.blobs = [];
  for (var i = 0; i < 26; i++) {
    var a = this.rand() * Math.PI * 2;
    var d = Math.sqrt(this.rand()) * 0.9;
    this.blobs.push({
      x: Math.cos(a) * this.R * this.xScale * d,
      y: Math.sin(a) * this.R * this.yScale * d,
      rx: this.R * (0.05 + this.rand() * 0.1),
      ry: this.R * (0.04 + this.rand() * 0.08),
      a: 0.04 + this.rand() * 0.08,
      rot: this.rand() * Math.PI
    });
  }
};

Potato.prototype.beginStroke = function (x, y) {
  this.lastX = x;
  this.lastY = y;
};

Potato.prototype.endStroke = function () {
  this.lastX = null;
  this.lastY = null;
};

Potato.prototype.peelTo = function (x, y) {
  if (this.lastX === null) {
    this.lastX = x;
    this.lastY = y;
    return { removed: 0, wasteAdded: 0 };
  }
  var x1 = this.lastX;
  var y1 = this.lastY;
  var dx = x - x1;
  var dy = y - y1;
  var dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.4) return { removed: 0, wasteAdded: 0 };

  this.eraseTrail(x1, y1, x, y);

  var step = CONFIG.play.stampStep;
  var steps = Math.max(1, Math.ceil(dist / step));
  var beforePeel = this.peeledCells;
  var beforeWaste = this.wasteCells;
  var moving = dist > 1.2;
  for (var i = 1; i <= steps; i++) {
    var t = i / steps;
    this.stamp(x1 + dx * t, y1 + dy * t, this.brush, moving);
  }
  this.lastX = x;
  this.lastY = y;

  if (this.peeledCells / this.skinTotal >= this.target) this.completed = true;

  return {
    removed: this.peeledCells - beforePeel,
    wasteAdded: this.wasteCells - beforeWaste
  };
};

Potato.prototype.stamp = function (x, y, r, moving) {
  var gw = this.gw;
  var cw = this.cw;
  var ch = this.ch;
  var gx0 = Math.max(0, Math.floor((x - r - this.bx0) / cw));
  var gx1 = Math.min(gw - 1, Math.floor((x + r - this.bx0) / cw));
  var gy0 = Math.max(0, Math.floor((y - r - this.by0) / ch));
  var gy1 = Math.min(this.gh - 1, Math.floor((y + r - this.by0) / ch));
  var r2 = r * r;
  for (var gy = gy0; gy <= gy1; gy++) {
    var py = this.by0 + (gy + 0.5) * ch;
    var row = gy * gw;
    for (var gx = gx0; gx <= gx1; gx++) {
      var idx = row + gx;
      if (!this.inside[idx]) continue;
      var px = this.bx0 + (gx + 0.5) * cw;
      var ddx = px - x;
      var ddy = py - y;
      if (ddx * ddx + ddy * ddy > r2) continue;
      if (this.state[idx] === 1) {
        this.state[idx] = 2;
        this.peeledCells++;
      } else if (moving && this.depth[idx] < this.wasteThreshold) {
        this.depth[idx]++;
        if (this.depth[idx] === this.wasteThreshold) this.wasteCells++;
      }
    }
  }
};

Potato.prototype.eraseTrail = function (x1, y1, x2, y2) {
  if (!this.skin) return;
  var ctx = this.skin.getContext('2d');
  ctx.save();
  if (ctx.setTransform) ctx.setTransform(this.dpr, 0, 0, this.dpr, this.skinSize / 2, this.skinSize / 2);
  else { ctx.translate(this.skinSize / 2, this.skinSize / 2); ctx.scale(this.dpr, this.dpr); }
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,1)';
  ctx.lineWidth = this.brush * 1.9;
  ctx.beginPath();
  ctx.moveTo(x1 - this.cx, y1 - this.cy);
  ctx.lineTo(x2 - this.cx, y2 - this.cy);
  ctx.stroke();

  // 轻微毛边，让削痕更像刀口
  ctx.lineWidth = this.brush * 0.38;
  for (var i = 0; i < 3; i++) {
    var ox = (this.rand() - 0.5) * this.brush * 1.5;
    var oy = (this.rand() - 0.5) * this.brush * 1.5;
    ctx.beginPath();
    ctx.moveTo(x1 - this.cx + ox, y1 - this.cy + oy);
    ctx.lineTo(x2 - this.cx + ox, y2 - this.cy + oy);
    ctx.stroke();
  }
  ctx.restore();
};

Potato.prototype.progress = function () {
  return Math.min(1, this.peeledCells / Math.max(1, this.skinTotal));
};

Potato.prototype.waste = function () {
  return Math.min(1, this.wasteCells / Math.max(1, this.insideTotal));
};

Potato.prototype.render = function (ctx, t) {
  var cx = this.cx;
  var cy = this.cy;
  var R = this.R;
  var intro = this.introT;
  var scale = intro < 1 ? 0.82 + 0.18 * intro : 1;
  var alpha = Math.min(1, intro * 1.6) * (1 - this.goneT);

  ctx.save();
  ctx.translate(cx, cy - (1 - intro) * 40);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  ctx.globalAlpha = alpha;

  // 接触阴影
  ctx.save();
  ctx.beginPath();
  ctx.ellipse ? ctx.ellipse(cx, cy + R * 0.92, R * 0.72, R * 0.14, 0, 0, Math.PI * 2) :
    ctx.arc(cx, cy + R * 0.92, R * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(70,40,15,0.2)';
  ctx.fill();
  ctx.restore();

  // 果肉外投影，避免削净后与奶油色背景糊在一起
  ctx.save();
  ctx.shadowColor = 'rgba(80,45,18,0.3)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 7;
  this.shapePath(ctx, 1, cx, cy);
  ctx.fillStyle = '#E6C58B';
  ctx.fill();
  ctx.restore();

  // 果肉
  ctx.save();
  this.shapePath(ctx, 1, cx, cy);
  ctx.clip();
  var g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R * 1.3);
  g.addColorStop(0, '#FFF5D6');
  g.addColorStop(0.55, '#F6E2AC');
  g.addColorStop(1, '#DFBC77');
  ctx.fillStyle = g;
  ctx.fillRect(cx - R * 1.4, cy - R * 1.4, R * 2.8, R * 2.8);

  for (var i = 0; i < this.blobs.length; i++) {
    var b = this.blobs[i];
    ctx.save();
    ctx.translate(cx + b.x, cy + b.y);
    ctx.rotate(b.rot);
    ctx.scale(b.rx, b.ry);
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(210,166,98,' + b.a + ')';
    ctx.fill();
    ctx.restore();
  }

  this.shapePath(ctx, 0.995, cx, cy);
  ctx.lineWidth = R * 0.2;
  ctx.strokeStyle = 'rgba(150,104,45,0.22)';
  ctx.stroke();
  ctx.restore();

  // 皮肤图层
  if (this.skin) {
    ctx.drawImage(this.skin, cx - this.SS / 2, cy - this.SS / 2, this.SS, this.SS);
  }

  // 轮廓
  this.shapePath(ctx, 1.012, cx, cy);
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = this.golden ? 'rgba(120,78,15,0.62)' : 'rgba(90,52,20,0.5)';
  ctx.stroke();

  // 小芽
  if (this.goneT < 0.5) {
    var sx = cx + R * 0.18;
    var sy = cy - R * 0.92;
    ctx.save();
    ctx.strokeStyle = '#5E8B45';
    ctx.lineWidth = Math.max(2, R * 0.025);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, sy + R * 0.12);
    ctx.quadraticCurveTo(sx + R * 0.02, sy - R * 0.04, sx + R * 0.12, sy - R * 0.12);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse ? ctx.ellipse(sx + R * 0.15, sy - R * 0.15, R * 0.1, R * 0.055, -0.5, 0, Math.PI * 2) :
      ctx.arc(sx + R * 0.12, sy - R * 0.12, R * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = '#7FB069';
    ctx.fill();
    ctx.restore();
  }

  // 金土豆闪光
  if (this.golden) {
    var tw = 0.6 + 0.4 * Math.sin(t * 3 + this.seed);
    for (var k = 0; k < 4; k++) {
      var a2 = t * 0.8 + k * Math.PI / 2 + this.seed;
      var px2 = cx + Math.cos(a2) * R * 0.62;
      var py2 = cy + Math.sin(a2) * R * 0.2 - R * 0.3;
      drawSpark(ctx, px2, py2, R * 0.045 * (0.6 + tw), 'rgba(255,245,180,' + (0.4 + tw * 0.4) + ')');
    }
  }

  // 完成光晕
  if (this.progress() >= this.target && this.goneT < 0.2) {
    var pulse = 0.5 + 0.5 * Math.sin(t * 5);
    ctx.save();
    this.shapePath(ctx, 1.035 + pulse * 0.02, cx, cy);
    ctx.lineWidth = 4 + pulse * 3;
    ctx.strokeStyle = 'rgba(255,214,110,' + (0.35 + pulse * 0.35) + ')';
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
};

function drawSpark(ctx, x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(r * 0.18, -r * 0.18, r, 0);
  ctx.quadraticCurveTo(r * 0.18, r * 0.18, 0, r);
  ctx.quadraticCurveTo(-r * 0.18, r * 0.18, -r, 0);
  ctx.quadraticCurveTo(-r * 0.18, -r * 0.18, 0, -r);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

Potato.prototype.dispose = function () {
  if (this.skin) {
    this.skin.width = 1;
    this.skin.height = 1;
    this.skin = null;
  }
};

module.exports = Potato;

};
__defs["fx"] = function(module, exports, require){
/**
 * 削皮碎屑、星光与飘字。
 */
function FX() {
  this.parts = [];
  this.texts = [];
}

FX.prototype.peelBurst = function (x, y, dx, dy, count, golden) {
  var len = Math.sqrt(dx * dx + dy * dy) || 1;
  var nx = -dy / len;
  var ny = dx / len;
  var palette = golden ? ['#F2C85B', '#E2AC3F', '#FFF0B8'] : ['#B0743E', '#C98F5B', '#8A5326'];
  for (var i = 0; i < count; i++) {
    var side = Math.random() > 0.5 ? 1 : -1;
    var sp = 40 + Math.random() * 110;
    this.parts.push({
      type: 'curl',
      x: x + (Math.random() - 0.5) * 18,
      y: y + (Math.random() - 0.5) * 18,
      vx: nx * sp * side + (Math.random() - 0.5) * 30,
      vy: ny * sp * side - 40 - Math.random() * 60,
      g: 520,
      rot: Math.random() * 6.28,
      vr: (Math.random() - 0.5) * 9,
      size: 4 + Math.random() * 6,
      color: palette[Math.floor(Math.random() * palette.length)],
      life: 0.5 + Math.random() * 0.5,
      ttl: 1
    });
  }
  if (this.parts.length > 180) this.parts.splice(0, this.parts.length - 180);
};

FX.prototype.sparkle = function (x, y, count, color, spread) {
  spread = spread || 40;
  for (var i = 0; i < count; i++) {
    var a = Math.random() * Math.PI * 2;
    var sp = 30 + Math.random() * 130;
    this.parts.push({
      type: 'spark',
      x: x,
      y: y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 40,
      g: 260,
      rot: Math.random() * 6.28,
      vr: (Math.random() - 0.5) * 6,
      size: 3 + Math.random() * 5,
      color: color || '#F2B84B',
      life: 0.45 + Math.random() * 0.6,
      ttl: 1
    });
  }
};

FX.prototype.floatText = function (x, y, str, color, size) {
  this.texts.push({
    x: x,
    y: y,
    str: str,
    color: color || '#4A2E19',
    size: size || 22,
    life: 1.0,
    ttl: 1.0
  });
};

FX.prototype.update = function (dt) {
  var i;
  for (i = this.parts.length - 1; i >= 0; i--) {
    var p = this.parts[i];
    p.life -= dt;
    if (p.life <= 0) { this.parts.splice(i, 1); continue; }
    p.vy += p.g * dt;
    p.vx *= 0.985;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
  }
  for (i = this.texts.length - 1; i >= 0; i--) {
    var t = this.texts[i];
    t.life -= dt;
    if (t.life <= 0) { this.texts.splice(i, 1); continue; }
    t.y -= 42 * dt;
  }
};

FX.prototype.render = function (ctx) {
  for (var i = 0; i < this.parts.length; i++) {
    var p = this.parts[i];
    var a = Math.max(0, Math.min(1, p.life / p.ttl));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    if (p.type === 'spark') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      var r = p.size;
      ctx.moveTo(0, -r);
      ctx.quadraticCurveTo(r * 0.2, -r * 0.2, r, 0);
      ctx.quadraticCurveTo(r * 0.2, r * 0.2, 0, r);
      ctx.quadraticCurveTo(-r * 0.2, r * 0.2, -r, 0);
      ctx.quadraticCurveTo(-r * 0.2, -r * 0.2, 0, -r);
      ctx.fill();
    } else {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(1.5, p.size * 0.34);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0.4, 2.5);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,245,215,0.45)';
      ctx.lineWidth = Math.max(1, p.size * 0.14);
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0.55, 2.2);
      ctx.stroke();
    }
    ctx.restore();
  }
  for (var j = 0; j < this.texts.length; j++) {
    var t = this.texts[j];
    var al = Math.max(0, Math.min(1, t.life / t.ttl));
    ctx.save();
    ctx.globalAlpha = al;
    ctx.font = '800 ' + t.size + 'px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,248,230,0.9)';
    ctx.strokeText(t.str, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.str, t.x, t.y);
    ctx.restore();
  }
};

FX.prototype.clear = function () {
  this.parts.length = 0;
  this.texts.length = 0;
};

module.exports = FX;

};
__load("main");
})();