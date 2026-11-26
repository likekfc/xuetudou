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
