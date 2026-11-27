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
var render3d = require('../render3d');

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
  this._3d = !!main._3dOk;
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
  this._tool = 'knife'; // 当前选中工具
  this.layout();
  this.spawnPotato(0);
  this.state = this.tutorial ? 'tutorial' : 'play';
}

PlayScene.prototype.enter = function () {
  Ads.hideBanner();
  if (this._3d) {
    render3d.setPotatoVisible(true);
    render3d.setClearColor(0x2a1a10, 1); // 深色背景，让 3D 土豆突出
    render3d.setTool(this._tool);
  }
};

PlayScene.prototype.onHide = function () {
  if (this.state === 'play') this.openPause();
  Economy.save();
  if (this._3d) render3d.setPotatoVisible(false);
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

  // 工具选择栏（3D 模式专用）
  var toolY = Math.min(H - sb - 16, this.boardY + this.R * 0.34 + 100);
  var btnSq = 52;
  var gap = 12;
  var totalW = btnSq * 3 + gap * 2;
  var startX = (W - totalW) / 2;
  this.toolBtns = [
    { id: 'knife',  label: '削皮刀', x: startX, y: toolY, w: btnSq, h: btnSq, pressed: false },
    { id: 'fork',   label: '叉子',  x: startX + btnSq + gap, y: toolY, w: btnSq, h: btnSq, pressed: false },
    { id: 'grater', label: '刨丝器', x: startX + (btnSq + gap) * 2, y: toolY, w: btnSq, h: btnSq, pressed: false }
  ];
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

  if (this._3d) {
    render3d.resetSkin(golden);
    render3d.positionPotato(this.cx, this.cy, this.potato.R);
  }
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

  // 3D 工具按钮
  if (this._3d) {
    for (var ti = 0; ti < this.toolBtns.length; ti++) {
      var tb = this.toolBtns[ti];
      if (UI.hit(tb, p.x, p.y)) {
        this._tool = tb.id;
        render3d.setTool(this._tool);
        Sound.tap();
        return;
      }
    }
  }

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
  if (this._3d) {
    render3d.peelTrail(this.lastPoint.x, this.lastPoint.y, p.x, p.y, this.effects.brush || 14);
  }
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
  // 3D 模式：跳过 drawBackground / drawBoard（让 3D 层背景透出来），
  // UI canvas 默认透明，只有 HUD/按钮/FX 是不透明的 → 直接看见 3D 土豆
  if (this._3d) {
    ctx.clearRect(0, 0, this.W, this.H);
    // 轻微的顶光装饰（不遮挡 3D 主体）
    var lg = ctx.createRadialGradient(this.cx, this.safeTop + 20, 4, this.cx, this.cy, this.R * 2);
    lg.addColorStop(0, 'rgba(255,248,220,0.18)');
    lg.addColorStop(1, 'rgba(255,248,220,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, this.W, this.H);
  } else {
    this.drawBackground(ctx);
    this.drawBoard(ctx);
    if (this.potato) this.potato.render(ctx, this.t);
  }

  this.fx.render(ctx);
  this.drawHUD(ctx);
  this.drawProgress(ctx);
  this.drawHint(ctx);
  this.drawCompleteButton(ctx);

  // 工具选择 UI（3D 模式才显示）
  if (this._3d) this.drawToolBar(ctx);

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

PlayScene.prototype.drawToolBar = function (ctx) {
  var tools = this.toolBtns;
  for (var i = 0; i < tools.length; i++) {
    var b = tools[i];
    var selected = this._tool === b.id;
    var cx = b.x + b.w / 2;
    var cy = b.y + b.h / 2;

    // 背景胶囊
    ctx.save();
    ctx.shadowColor = selected ? 'rgba(244,220,180,0.5)' : 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = selected ? 14 : 8;
    ctx.shadowOffsetY = 2;
    UI.fillRR(ctx, b.x, b.y, b.w, b.h, 14, selected ? '#FFE6B0' : '#3D2A1C');
    ctx.restore();

    // 选中描边
    if (selected) {
      ctx.strokeStyle = '#FF9A3C';
      ctx.lineWidth = 2.5;
      UI.strokeRR(ctx, b.x, b.y, b.w, b.h, 14);
    }

    // 图标
    ctx.fillStyle = selected ? '#8B4513' : '#FFE6B0';
    if (b.id === 'knife') {
      // 削皮刀：一把小刀（三角形+刀柄）
      ctx.save();
      ctx.translate(cx - 6, cy + 8);
      ctx.rotate(-0.5);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(20, -6); ctx.lineTo(20, 0); ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillRect(cx + 8, cy + 4, 10, 4);
    } else if (b.id === 'fork') {
      // 叉子
      ctx.save();
      ctx.translate(cx, cy - 8);
      ctx.strokeStyle = selected ? '#8B4513' : '#FFE6B0';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-10, 18); ctx.moveTo(-3, 0); ctx.lineTo(-3, 18); ctx.moveTo(4, 0); ctx.lineTo(4, 18); ctx.moveTo(11, 0); ctx.lineTo(11, 18); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-14, 18); ctx.lineTo(14, 18); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 18); ctx.lineTo(0, 30); ctx.stroke();
      ctx.restore();
    } else if (b.id === 'grater') {
      // 刨丝器（波浪 + 底部细丝）
      ctx.beginPath();
      ctx.moveTo(cx - 16, cy + 12);
      for (var g = 0; g < 6; g++) {
        ctx.lineTo(cx - 16 + g * 5.3, cy + 12 + Math.sin(g * 1.2) * -10);
      }
      ctx.lineTo(cx + 16, cy + 12);
      ctx.strokeStyle = selected ? '#8B4513' : '#FFE6B0';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      for (var f = 0; f < 5; f++) {
        var fx2 = cx - 14 + f * 7;
        ctx.moveTo(fx2, cy + 12);
        ctx.lineTo(fx2 + 1, cy + 20);
      }
      ctx.stroke();
    }

    // 标签
    ctx.fillStyle = selected ? '#5C2C0C' : '#DDBE8B';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.label, cx, b.y + b.h + 14);
  }
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
