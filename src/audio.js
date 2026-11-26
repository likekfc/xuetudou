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
