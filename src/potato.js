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
