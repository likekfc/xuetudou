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

  // ---------- 隐私授权与异常上报 ----------
  // 查询是否需要隐私授权（后台配置了指引且用户未同意时 needAuthorization 为 true）
  getPrivacySetting: function (cb) {
    if (isWx && wx.getPrivacySetting) {
      try {
        wx.getPrivacySetting({
          success: function (res) { cb && cb(res); },
          fail: function () { cb && cb({ needAuthorization: false }); }
        });
        return;
      } catch (e) {}
    }
    if (cb) cb({ needAuthorization: false });
  },

  // 注册「需要隐私授权」回调，拿到 resolve；画布弹窗点同意时调用 resolve 即走官方授权
  onNeedPrivacyAuthorization: function (cb) {
    if (isWx && wx.onNeedPrivacyAuthorization) {
      try { wx.onNeedPrivacyAuthorization(cb); return true; } catch (e) {}
    }
    return false;
  },

  // 用户点同意：优先官方 resolve，否则降级触发系统授权弹窗
  agreePrivacy: function (resolve) {
    if (resolve) {
      try { resolve({ event: 'agree', buttonId: 'pp-agree-btn' }); return true; } catch (e) {}
    }
    if (isWx && wx.requirePrivacyAuthorize) {
      try { wx.requirePrivacyAuthorize({}); return true; } catch (e) {}
    }
    return false;
  },

  // 监听未捕获的 JS 异常，便于线上排查（需在 mp 后台配置自定义分析事件 js_error）
  onError: function (cb) {
    if (isWx && wx.onError) { try { wx.onError(cb); return true; } catch (e) {} }
    return false;
  },

  exitMiniProgram: function () {
    if (isWx && wx.exitMiniProgram) { try { wx.exitMiniProgram({}); } catch (e) {} }
  },

  openSetting: function () {
    if (isWx && wx.openSetting) { try { wx.openSetting({}); } catch (e) {} }
  }
};

module.exports = Platform;
