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
