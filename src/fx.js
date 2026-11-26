/**
 * 削皮碎屑、星光与飘字。
 */
function FX() {
  this.parts = [];
  this.texts = [];
}

FX.prototype.peelBurst = function (x, y, dx, dy, count, golden) {
  var len = Math.sqrt(dx * dx + dy * dy) || 1;
  var nx = -dy / len;
  var ny = dx / len;
  var palette = golden ? ['#F2C85B', '#E2AC3F', '#FFF0B8'] : ['#B0743E', '#C98F5B', '#8A5326'];
  for (var i = 0; i < count; i++) {
    var side = Math.random() > 0.5 ? 1 : -1;
    var sp = 40 + Math.random() * 110;
    this.parts.push({
      type: 'curl',
      x: x + (Math.random() - 0.5) * 18,
      y: y + (Math.random() - 0.5) * 18,
      vx: nx * sp * side + (Math.random() - 0.5) * 30,
      vy: ny * sp * side - 40 - Math.random() * 60,
      g: 520,
      rot: Math.random() * 6.28,
      vr: (Math.random() - 0.5) * 9,
      size: 4 + Math.random() * 6,
      color: palette[Math.floor(Math.random() * palette.length)],
      life: 0.5 + Math.random() * 0.5,
      ttl: 1
    });
  }
  if (this.parts.length > 180) this.parts.splice(0, this.parts.length - 180);
};

FX.prototype.sparkle = function (x, y, count, color, spread) {
  spread = spread || 40;
  for (var i = 0; i < count; i++) {
    var a = Math.random() * Math.PI * 2;
    var sp = 30 + Math.random() * 130;
    this.parts.push({
      type: 'spark',
      x: x,
      y: y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 40,
      g: 260,
      rot: Math.random() * 6.28,
      vr: (Math.random() - 0.5) * 6,
      size: 3 + Math.random() * 5,
      color: color || '#F2B84B',
      life: 0.45 + Math.random() * 0.6,
      ttl: 1
    });
  }
};

FX.prototype.floatText = function (x, y, str, color, size) {
  this.texts.push({
    x: x,
    y: y,
    str: str,
    color: color || '#4A2E19',
    size: size || 22,
    life: 1.0,
    ttl: 1.0
  });
};

FX.prototype.update = function (dt) {
  var i;
  for (i = this.parts.length - 1; i >= 0; i--) {
    var p = this.parts[i];
    p.life -= dt;
    if (p.life <= 0) { this.parts.splice(i, 1); continue; }
    p.vy += p.g * dt;
    p.vx *= 0.985;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
  }
  for (i = this.texts.length - 1; i >= 0; i--) {
    var t = this.texts[i];
    t.life -= dt;
    if (t.life <= 0) { this.texts.splice(i, 1); continue; }
    t.y -= 42 * dt;
  }
};

FX.prototype.render = function (ctx) {
  for (var i = 0; i < this.parts.length; i++) {
    var p = this.parts[i];
    var a = Math.max(0, Math.min(1, p.life / p.ttl));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    if (p.type === 'spark') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      var r = p.size;
      ctx.moveTo(0, -r);
      ctx.quadraticCurveTo(r * 0.2, -r * 0.2, r, 0);
      ctx.quadraticCurveTo(r * 0.2, r * 0.2, 0, r);
      ctx.quadraticCurveTo(-r * 0.2, r * 0.2, -r, 0);
      ctx.quadraticCurveTo(-r * 0.2, -r * 0.2, 0, -r);
      ctx.fill();
    } else {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(1.5, p.size * 0.34);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0.4, 2.5);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,245,215,0.45)';
      ctx.lineWidth = Math.max(1, p.size * 0.14);
      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0.55, 2.2);
      ctx.stroke();
    }
    ctx.restore();
  }
  for (var j = 0; j < this.texts.length; j++) {
    var t = this.texts[j];
    var al = Math.max(0, Math.min(1, t.life / t.ttl));
    ctx.save();
    ctx.globalAlpha = al;
    ctx.font = '800 ' + t.size + 'px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,248,230,0.9)';
    ctx.strokeText(t.str, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.str, t.x, t.y);
    ctx.restore();
  }
};

FX.prototype.clear = function () {
  this.parts.length = 0;
  this.texts.length = 0;
};

module.exports = FX;
