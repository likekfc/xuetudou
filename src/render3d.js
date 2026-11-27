/**
 * render3d v2 — 3D 渲染管线 + OrbitControls + 削皮射线
 *
 * 核心架构：
 *   glCanvas  (上屏, dpr×dpr 物理像素) ← WebGL Three.js
 *   uiCanvas  (离屏, dpr×dpr 物理像素) ← 2D Canvas → 全屏纹理 Quad 叠加
 *
 * 土豆固定在世界原点 (0,0,0)，相机用 OrbitControls 绕转。
 * 交互手势：
 *   - 单指拖拽（PlayScene 中）→ 削皮
 *   - 两指手势（任意场景）→ 旋转 / 缩放视角
 */

var loader = require('./three-loader');
var loadTHREE = loader.loadTHREE;
var isWx = loader.isWx;

var _state = {
  THREE: null,
  initialized: false,

  glCanvas: null,   // WebGL 上屏（物理尺寸 W*dpr × H*dpr）
  uiCanvas: null,   // 离屏 2D（物理尺寸 W*dpr × H*dpr）
  uictx: null,

  renderer: null,
  scene: null,
  camera: null,
  uiScene: null,
  uiCam: null,
  uiQuad: null,
  uiTexture: null,

  potato: null,
  potatoSkin: null,
  skinCanvas: null,
  skinCtx: null,
  potatoInner: null,

  raycaster: null,
  pointer: null,

  W: 0, H: 0, dpr: 1,

  // OrbitControls 状态
  orbiter: {
    // 球坐标（绕土豆中心）
    radius: 6.2,        // 相机距离
    theta: 0,           // 水平角（绕 Y 轴），0 = 正对
    phi: Math.PI / 2.2, // 垂直角（俯视角），越小越俯视
    minRadius: 4.5,
    maxRadius: 10,
    minPhi: Math.PI / 6,
    maxPhi: Math.PI / 2 - 0.05,
    targetX: 0, targetY: 0, targetZ: 0,
    // 上一帧拖拽点（用于两指手势旋转计算）
    lastMidX: 0, lastMidY: 0,
    lastDist: 0,
    active: false,    // 是否正在两指控制
    pinchActive: false
  },

  potatoVisible: false,
  peelPaused: false,

  // 工具（削皮 / 叉子 / 刨丝）
  tool: 'knife',
  toolSize: 18
};

function makeCanvas(w, h) {
  var c = isWx ? wx.createCanvas() : document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function init() {
  if (_state.initialized) return;
  var info;
  if (isWx) {
    try { info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync(); } catch (e) { info = { windowWidth: 375, windowHeight: 667, pixelRatio: 2 }; }
  } else {
    info = { windowWidth: window.innerWidth, windowHeight: window.innerHeight, pixelRatio: window.devicePixelRatio || 1 };
  }

  _state.W = info.windowWidth;
  _state.H = info.windowHeight;
  _state.dpr = Math.min(info.pixelRatio || 1, 3);

  // glCanvas：WebGL 上屏（dpr 倍物理像素）
  if (isWx) {
    _state.glCanvas = wx.createCanvas();
    _state.uiCanvas = wx.createCanvas();
  } else {
    _state.glCanvas = document.createElement('canvas');
    _state.glCanvas.style.cssText = 'position:fixed;left:0;top:0;width:' + _state.W + 'px;height:' + _state.H + 'px;display:block;touch-action:none;z-index:0;';
    document.body.appendChild(_state.glCanvas);
    _state.uiCanvas = document.createElement('canvas');
  }
  _state.glCanvas.width = Math.floor(_state.W * _state.dpr);
  _state.glCanvas.height = Math.floor(_state.H * _state.dpr);
  _state.uiCanvas.width = Math.floor(_state.W * _state.dpr);
  _state.uiCanvas.height = Math.floor(_state.H * _state.dpr);
  _state.uictx = _state.uiCanvas.getContext('2d');

  try {
    var THREE = loadTHREE(_state.glCanvas);
    _state.THREE = THREE;

    var gl = _state.glCanvas.getContext('webgl') || _state.glCanvas.getContext('experimental-webgl');
    if (!gl) throw new Error('WebGL context unavailable');

    _state.renderer = new THREE.WebGLRenderer({ canvas: _state.glCanvas, context: gl, antialias: true });
    _state.renderer.setPixelRatio(1); // 已经手动设了 dpr 倍物理尺寸
    _state.renderer.setSize(_state.W * _state.dpr, _state.H * _state.dpr, false);
    _state.renderer.setClearColor(0x2a1a10, 1);

    _state.scene = new THREE.Scene();

    // PerspectiveCamera：土豆正前方，略俯
    _state.camera = new THREE.PerspectiveCamera(48, _state.W / _state.H, 0.1, 200);
    _updateOrbiterCamera();

    // 光照（更强，更立体）
    _state.scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    var key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(3, 5, 4);
    _state.scene.add(key);
    var rim = new THREE.DirectionalLight(0xffa060, 0.4);
    rim.position.set(-4, 3, -3);
    _state.scene.add(rim);
    var fill = new THREE.DirectionalLight(0xfff3d0, 0.25);
    fill.position.set(0, -3, 4);
    _state.scene.add(fill);

    // 地面阴影接收（一个透明圆盘，让土豆有"放在桌子上"的感觉）
    var shadowGeo = new THREE.CircleGeometry(3.5, 32);
    var shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 });
    var shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -1.6;
    _state.scene.add(shadow);

    // 土豆
    _buildPotato();

    // UI 层：全屏 quad（canvas 也是 dpr 倍，所以 Plane 也用 dpr 倍尺寸，OrthographicCamera 也设 dpr 倍范围）
    var canvasW = _state.uiCanvas.width;   // W * dpr
    var canvasH = _state.uiCanvas.height;  // H * dpr
    _state.uiTexture = new THREE.CanvasTexture(_state.uiCanvas);
    _state.uiScene = new THREE.Scene();
    _state.uiCam = new THREE.OrthographicCamera(-canvasW / 2, canvasW / 2, canvasH / 2, -canvasH / 2, 0, 10);
    _state.uiQuad = new THREE.Mesh(
      new THREE.PlaneGeometry(canvasW, canvasH),
      new THREE.MeshBasicMaterial({ map: _state.uiTexture, transparent: true, depthTest: false, depthWrite: false })
    );
    _state.uiQuad.renderOrder = 999;
    _state.uiScene.add(_state.uiQuad);

    _state.raycaster = new THREE.Raycaster();
    _state.pointer = new THREE.Vector2();

    // 绑定两指手势到 glCanvas（旋转/缩放视角）
    _bindOrbitControls();

    _state.initialized = true;
    console.log('[render3d v2] init ok, W=' + _state.W + ' H=' + _state.H + ' dpr=' + _state.dpr);
  } catch (e) {
    console.error('[render3d] init failed:', e && e.message ? e.message : e);
    throw e;
  }
}

function _updateOrbiterCamera() {
  var o = _state.orbiter;
  var THREE = _state.THREE;
  var x = o.radius * Math.sin(o.phi) * Math.sin(o.theta);
  var y = o.radius * Math.cos(o.phi);
  var z = o.radius * Math.sin(o.phi) * Math.cos(o.theta);
  _state.camera.position.set(o.targetX + x, o.targetY + y, o.targetZ + z);
  _state.camera.lookAt(o.targetX, o.targetY, o.targetZ);
}

function _bindOrbitControls() {
  var canvas = _state.glCanvas;
  var activePointers = {}; // { pointerId: {x, y} }
  var orbiter = _state.orbiter;

  if (isWx) {
    // 微信环境：touch 事件
    wx.onTouchStart(function (e) {
      for (var i = 0; i < e.touches.length; i++) {
        var t = e.touches[i];
        activePointers[t.identifier] = { x: t.clientX, y: t.clientY };
      }
      _onOrbitTouchStart(activePointers);
    });
    wx.onTouchMove(function (e) {
      for (var i = 0; i < e.touches.length; i++) {
        var t = e.touches[i];
        if (activePointers[t.identifier]) {
          activePointers[t.identifier].x = t.clientX;
          activePointers[t.identifier].y = t.clientY;
        }
      }
      _onOrbitTouchMove(activePointers);
    });
    wx.onTouchEnd(function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        delete activePointers[e.changedTouches[i].identifier];
      }
      _onOrbitTouchEnd(activePointers);
    });
    wx.onTouchCancel(function (e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        delete activePointers[e.changedTouches[i].identifier];
      }
      _onOrbitTouchEnd(activePointers);
    });
  } else {
    canvas.addEventListener('pointerdown', function (ev) {
      canvas.setPointerCapture && canvas.setPointerCapture(ev.pointerId);
      activePointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
      _onOrbitTouchStart(activePointers);
    });
    canvas.addEventListener('pointermove', function (ev) {
      if (!activePointers[ev.pointerId]) return;
      activePointers[ev.pointerId].x = ev.clientX;
      activePointers[ev.pointerId].y = ev.clientY;
      _onOrbitTouchMove(activePointers);
    });
    var end = function (ev) {
      delete activePointers[ev.pointerId];
      _onOrbitTouchEnd(activePointers);
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
  }
}

function _countKeys(obj) { var n = 0; for (var k in obj) if (obj.hasOwnProperty(k)) n++; return n; }

function _onOrbitTouchStart(pointers) {
  var n = _countKeys(pointers);
  if (n >= 2) {
    orbiter.active = true;
    orbiter.pinchActive = true;
    var ids = Object.keys(pointers);
    var p1 = pointers[ids[0]], p2 = pointers[ids[1]];
    orbiter.lastMidX = (p1.x + p2.x) / 2;
    orbiter.lastMidY = (p1.y + p2.y) / 2;
    orbiter.lastDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }
}

function _onOrbitTouchMove(pointers) {
  var n = _countKeys(pointers);
  if (n < 2) return;
  var ids = Object.keys(pointers);
  var p1 = pointers[ids[0]], p2 = pointers[ids[1]];
  var midX = (p1.x + p2.x) / 2;
  var midY = (p1.y + p2.y) / 2;
  var dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);

  var dx = midX - orbiter.lastMidX;
  var dy = midY - orbiter.lastMidY;
  orbiter.lastMidX = midX;
  orbiter.lastMidY = midY;

  // 旋转：水平拖 → theta, 垂直拖 → phi
  orbiter.theta -= dx * 0.006;
  orbiter.phi = clamp(orbiter.phi - dy * 0.005, orbiter.minPhi, orbiter.maxPhi);

  // 缩放：捏合
  var dscale = orbiter.lastDist / dist;
  if (dscale > 0 && dscale < 5) {
    orbiter.radius = clamp(orbiter.radius * dscale, orbiter.minRadius, orbiter.maxRadius);
  }
  orbiter.lastDist = dist;

  _updateOrbiterCamera();
}

function _onOrbitTouchEnd(pointers) {
  var n = _countKeys(pointers);
  if (n < 2) {
    orbiter.active = false;
    orbiter.pinchActive = false;
  }
}

// ============ 土豆 ============

function _buildPotato() {
  var THREE = _state.THREE;

  var geo = new THREE.SphereGeometry(1.1, 64, 64);
  var pos = geo.attributes.position;
  for (var i = 0; i < pos.count; i++) {
    var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    var n1 = Math.sin(x * 3.1 + 1.7) * 0.08;
    var n2 = Math.cos(y * 2.7 + 0.9) * 0.06;
    var n3 = Math.sin(z * 4.3 + 2.3) * 0.05;
    var len = Math.sqrt(x * x + y * y + z * z);
    var s = 1 + n1 + n2 + n3;
    pos.setXYZ(i, x / len * s, y / len * s * 0.92, z / len * s * 1.08);
  }
  geo.computeVertexNormals();

  // 表皮纹理 512×512（更清晰）
  _state.skinCanvas = makeCanvas(512, 512);
  var sctx = _state.skinCtx = _state.skinCanvas.getContext('2d');
  _drawSkin(sctx, 512, false);

  _state.potatoSkin = new THREE.CanvasTexture(_state.skinCanvas);
  _state.potatoSkin.colorSpace = THREE.SRGBColorSpace || THREE.SRGBEncoding;
  _state.potatoSkin.anisotropy = 8;

  var mat = new THREE.MeshStandardMaterial({
    map: _state.potatoSkin,
    roughness: 0.85,
    metalness: 0.0
  });

  _state.potato = new THREE.Mesh(geo, mat);
  _state.potato.scale.setScalar(1.0);
  _state.potato.visible = false;
  _state.scene.add(_state.potato);

  // 果肉
  var innerGeo = new THREE.SphereGeometry(1.05, 48, 48);
  _state.potatoInner = new THREE.Mesh(innerGeo, new THREE.MeshStandardMaterial({ color: 0xF6E2AC, roughness: 0.7 }));
  _state.potatoInner.scale.setScalar(1.0);
  _state.potatoInner.visible = false;
  _state.scene.add(_state.potatoInner);
}

function _drawSkin(sctx, SZ, golden) {
  sctx.globalCompositeOperation = 'source-over';
  sctx.clearRect(0, 0, SZ, SZ);

  var g = sctx.createRadialGradient(SZ * 0.3, SZ * 0.3, 10, SZ / 2, SZ / 2, SZ * 0.75);
  if (golden) {
    g.addColorStop(0, '#F5D06B'); g.addColorStop(0.6, '#E2AC3F'); g.addColorStop(1, '#B97C1F');
  } else {
    g.addColorStop(0, '#C98F5B'); g.addColorStop(0.55, '#B0743E'); g.addColorStop(1, '#82501F');
  }
  sctx.fillStyle = g;
  sctx.fillRect(0, 0, SZ, SZ);

  for (var i = 0; i < 600; i++) {
    var rx = Math.random() * SZ, ry = Math.random() * SZ, rs = 0.5 + Math.random() * 3;
    sctx.beginPath(); sctx.arc(rx, ry, rs, 0, Math.PI * 2);
    sctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,235,190,0.15)' : 'rgba(70,38,12,0.2)';
    sctx.fill();
  }
  var eyes = 8 + Math.floor(Math.random() * 6);
  for (var e = 0; e < eyes; e++) {
    var ex = Math.random() * SZ, ey = Math.random() * SZ, er = 2 + Math.random() * 5;
    sctx.beginPath();
    if (sctx.ellipse) sctx.ellipse(ex, ey, er * 1.3, er, Math.random() * 3, 0, Math.PI * 2);
    else sctx.arc(ex, ey, er, 0, Math.PI * 2);
    sctx.fillStyle = 'rgba(50,25,8,0.55)'; sctx.fill();
  }
  var hg = sctx.createRadialGradient(SZ * 0.2, SZ * 0.2, 4, SZ * 0.2, SZ * 0.2, SZ * 0.7);
  hg.addColorStop(0, 'rgba(255,248,220,0.35)'); hg.addColorStop(1, 'rgba(255,248,220,0)');
  sctx.fillStyle = hg; sctx.fillRect(0, 0, SZ, SZ);
}

// ============ 对外 API ============

function getUICtx() { return _state.uictx; }
function getUIWidth() { return _state.W; }
function getUIHeight() { return _state.H; }
function getUICanvas() { return _state.uiCanvas; }
function getGlCanvas() { return _state.glCanvas; }

function setPotatoVisible(v) {
  _state.potatoVisible = !!v;
  if (_state.potato) _state.potato.visible = v;
  if (_state.potatoInner) _state.potatoInner.visible = v;
  if (v) {
    _drawSkin(_state.skinCtx, _state.skinCanvas.width, false);
    _state.potatoSkin.needsUpdate = true;
  }
}

function resetSkin(golden) {
  _drawSkin(_state.skinCtx, _state.skinCanvas.width, !!golden);
  _state.potatoSkin.needsUpdate = true;
}

// 设置工具：'knife' (削皮刀, 18px), 'fork' (叉子, 8px, 刮痕), 'grater' (刨丝器, 28px)
function setTool(toolName) {
  _state.tool = toolName || 'knife';
  if (toolName === 'fork') _state.toolSize = 8;
  else if (toolName === 'grater') _state.toolSize = 28;
  else _state.toolSize = 18;
}
function getTool() { return _state.tool; }

// 削皮：单段或连续轨迹
// brushPx: UI 层绘制的笔刷屏幕像素
function peelTrail(x1, y1, x2, y2, brushPx) {
  if (!_state.potatoVisible || !_state.potato) return { peeled: false };

  var dx = x2 - x1, dy = y2 - y1;
  var dist = Math.sqrt(dx * dx + dy * dy);
  var step = 3;
  var steps = Math.max(1, Math.ceil(dist / step));
  var peeled = false;
  var hits = [];

  for (var i = 0; i <= steps; i++) {
    var t = i / steps;
    var h = _hitPotato(x1 + dx * t, y1 + dy * t);
    if (h) { peeled = true; hits.push(h); }
  }

  if (!peeled) return { peeled: false };

  var sctx = _state.skinCtx;
  var SZ = _state.skinCanvas.width;
  var tool = _state.tool;
  var baseBrush = brushPx || _state.toolSize;

  if (tool === 'fork') {
    // 叉子：细而深的刮痕（destination-in，在已削皮区域内再刮）
    sctx.globalCompositeOperation = 'destination-out';
    sctx.lineCap = 'round';
    sctx.lineJoin = 'round';
    for (var k = 0; k < 3; k++) { // 3 道叉齿
      var offset = (k - 1) * 4; // 纹素偏移
      if (hits.length >= 2) {
        sctx.beginPath();
        sctx.moveTo(hits[0].uvX * SZ, hits[0].uvY * SZ + offset);
        for (var i2 = 1; i2 < hits.length; i2++) {
          sctx.lineTo(hits[i2].uvX * SZ, hits[i2].uvY * SZ + offset);
        }
        sctx.lineWidth = 1.5;
        sctx.stroke();
      }
    }
  } else if (tool === 'grater') {
    // 刨丝器：大面积擦除
    sctx.globalCompositeOperation = 'destination-out';
    sctx.lineCap = 'round';
    sctx.lineJoin = 'round';
    // 主擦除
    if (hits.length >= 2) {
      sctx.beginPath();
      sctx.moveTo(hits[0].uvX * SZ, hits[0].uvY * SZ);
      for (var i3 = 1; i3 < hits.length; i3++) {
        sctx.lineTo(hits[i3].uvX * SZ, hits[i3].uvY * SZ);
      }
      sctx.lineWidth = baseBrush * 2.2;
      sctx.stroke();
    }
    // 刨出来的细碎纹理（destination-in 在已削皮区域内画细条纹）
    sctx.globalCompositeOperation = 'destination-out';
    for (var g = 0; g < hits.length; g += 2) {
      var hh = hits[g];
      sctx.beginPath();
      sctx.arc(hh.uvX * SZ + (Math.random() - 0.5) * 4, hh.uvY * SZ + (Math.random() - 0.5) * 4, 2 + Math.random() * 2, 0, Math.PI * 2);
      sctx.fill();
    }
  } else {
    // 削皮刀：圆润笔刷
    sctx.globalCompositeOperation = 'destination-out';
    sctx.lineCap = 'round';
    sctx.lineJoin = 'round';
    if (hits.length >= 2) {
      sctx.beginPath();
      sctx.moveTo(hits[0].uvX * SZ, hits[0].uvY * SZ);
      for (var i4 = 1; i4 < hits.length; i4++) {
        sctx.lineTo(hits[i4].uvX * SZ, hits[i4].uvY * SZ);
      }
      sctx.lineWidth = baseBrush * 1.8;
      sctx.stroke();
    }
    for (var j = 0; j < hits.length; j += 3) {
      sctx.beginPath();
      sctx.arc(hits[j].uvX * SZ, hits[j].uvY * SZ, baseBrush * 0.9, 0, Math.PI * 2);
      sctx.fill();
    }
  }

  _state.potatoSkin.needsUpdate = true;
  return { peeled: true };
}

function _hitPotato(xPx, yPx) {
  var THREE = _state.THREE;
  // UI 层是 dpr 倍物理像素，WebGL 也是 dpr 倍
  // 但 Raycaster 的 NDC 归一化是 -1~1，用逻辑坐标就行
  _state.pointer.x = (xPx / _state.W) * 2 - 1;
  _state.pointer.y = -(yPx / _state.H) * 2 + 1;
  _state.raycaster.setFromCamera(_state.pointer, _state.camera);
  var hits = _state.raycaster.intersectObject(_state.potato, false);
  if (!hits.length) return null;
  var hit = hits[0];
  if (!hit.uv) return null;
  return { uvX: hit.uv.x, uvY: 1 - hit.uv.y, point: hit.point };
}

// 旋转到指定角度（切场景动画用）
function orbitTo(theta, phi) {
  _state.orbiter.theta = theta;
  _state.orbiter.phi = clamp(phi, _state.orbiter.minPhi, _state.orbiter.maxPhi);
  _updateOrbiterCamera();
}

// 渲染循环
function render(t, dt) {
  if (!_state.initialized) return;

  // 3D 层
  _state.renderer.autoClear = true;
  _state.renderer.render(_state.scene, _state.camera);

  // UI 层（不清除深度，用 UI quad 全屏覆盖）
  _state.renderer.autoClear = false;
  _state.renderer.clearDepth();
  _state.uiTexture.needsUpdate = true;
  _state.renderer.render(_state.uiScene, _state.uiCam);
}

function setClearColor(hex, alpha) {
  if (!_state.renderer) return;
  _state.renderer.setClearColor(hex != null ? hex : 0x2a1a10, alpha != null ? alpha : 1);
}

function setPeelPaused(paused) { _state.peelPaused = !!paused; }

function dispose() {
  if (_state.potato) { _state.scene.remove(_state.potato); _state.potato.geometry.dispose(); _state.potato.material.dispose(); _state.potato = null; }
  if (_state.potatoInner) { _state.scene.remove(_state.potatoInner); _state.potatoInner.geometry.dispose(); _state.potatoInner.material.dispose(); _state.potatoInner = null; }
  if (_state.renderer) { _state.renderer.dispose(); _state.renderer = null; }
  _state.initialized = false;
}

module.exports = {
  init: init,
  getUICtx: getUICtx,
  getUIWidth: getUIWidth,
  getUIHeight: getUIHeight,
  getUICanvas: getUICanvas,
  getGlCanvas: getGlCanvas,
  setPotatoVisible: setPotatoVisible,
  resetSkin: resetSkin,
  setTool: setTool,
  getTool: getTool,
  peelTrail: peelTrail,
  orbitTo: orbitTo,
  setClearColor: setClearColor,
  setPeelPaused: setPeelPaused,
  render: render,
  dispose: dispose
};
