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
