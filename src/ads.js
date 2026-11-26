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
    this.preload();
  },

  // 预加载激励视频/插屏，避免首次展示白屏等待；每次关闭后也会自动重新加载下一条。
  preload: function () {
    if (!Platform.isWx) return;
    if (this.hasRealRewarded()) {
      var r = this._ensureRewarded();
      if (r && r.load) { try { r.load().catch(function () {}); } catch (e) {} }
    }
    if (CONFIG.ads.enabled && CONFIG.ads.interstitialAdUnitId && wx.createInterstitialAd) {
      var i = this._ensureInterstitial();
      if (i && i.load) { try { i.load().catch(function () {}); } catch (e) {} }
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
        // 关闭后立即预载下一条，保证下次展示即点即播
        try { ad.load().catch(function () {}); } catch (e) {}
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
        try { ad.load().catch(function () {}); } catch (e) {}
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
