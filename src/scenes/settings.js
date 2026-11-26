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
