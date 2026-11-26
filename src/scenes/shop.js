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
