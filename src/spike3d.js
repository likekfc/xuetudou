/**
 * Task 1 技术验证（Spike）：
 * 验证在微信小游戏中「主画布 WebGL(Three.js) + 离屏 2D 画布作 UI 纹理合成 + 射线取 UV」可行。
 * 同时兼容浏览器（index.html?spike=1），用同一套代码验证预打包的 three 能正常运行。
 * 验证通过后此文件会被正式的 render3d.js 替代。
 */
var loader = require('./three-loader');
var loadTHREE = loader.loadTHREE;
var isWx = loader.isWx;

function makeCanvas(w, h) {
  var c = isWx ? wx.createCanvas() : document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function run() {
  var info = isWx
    ? wx.getSystemInfoSync()
    : { windowWidth: window.innerWidth, windowHeight: window.innerHeight, pixelRatio: window.devicePixelRatio || 1 };
  var W = info.windowWidth;
  var H = info.windowHeight;
  var dpr = info.pixelRatio || 1;

  var glCanvas, uiCanvas, uictx;
  if (isWx) {
    glCanvas = wx.createCanvas();  // 第一个 = 上屏 WebGL 画布
    uiCanvas = wx.createCanvas();  // 第二个 = 离屏 2D 画布（UI 层）
  } else {
    glCanvas = document.createElement('canvas');
    glCanvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;display:block;touch-action:none;';
    document.body.appendChild(glCanvas);
    uiCanvas = document.createElement('canvas');
  }
  glCanvas.width = W;
  glCanvas.height = H;
  uiCanvas.width = W;
  uiCanvas.height = H;
  uictx = uiCanvas.getContext('2d');

  var THREE, renderer, scene, camera, cube, uiScene, uiCam, uiQuad, uiTexture, raycaster, pointer, lastUV;

  try {
    THREE = loadTHREE(glCanvas);

    var gl = glCanvas.getContext('webgl') || glCanvas.getContext('experimental-webgl');
    if (!gl) throw new Error('WebGL context unavailable');

    renderer = new THREE.WebGLRenderer({ canvas: glCanvas, context: gl, antialias: true });
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a1a10);
    camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
    camera.position.set(0, 0, 4);

    // 程序生成一张带网格的纹理，方便确认 UV 与旋转
    var tc = makeCanvas(256, 256);
    var tx = tc.getContext('2d');
    tx.fillStyle = '#c89b6b'; tx.fillRect(0, 0, 256, 256);
    tx.strokeStyle = '#5a3a1c'; tx.lineWidth = 2;
    for (var i = 0; i <= 256; i += 32) {
      tx.beginPath(); tx.moveTo(i, 0); tx.lineTo(i, 256); tx.stroke();
      tx.beginPath(); tx.moveTo(0, i); tx.lineTo(256, i); tx.stroke();
    }
    tx.fillStyle = '#fff'; tx.font = 'bold 40px sans-serif'; tx.textAlign = 'center';
    tx.fillText('UV', 128, 145);
    var cubeTex = new THREE.CanvasTexture(tc);

    cube = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshLambertMaterial({ map: cubeTex })
    );
    scene.add(cube);
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    var dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(3, 4, 5);
    scene.add(dir);

    // UI 层：离屏 2D 画布 → 全屏纹理 quad 叠加
    uiTexture = new THREE.CanvasTexture(uiCanvas);
    uiScene = new THREE.Scene();
    uiCam = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 0, 10);
    uiQuad = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H),
      new THREE.MeshBasicMaterial({ map: uiTexture, transparent: true, depthTest: false, depthWrite: false })
    );
    uiQuad.renderOrder = 999;
    uiScene.add(uiQuad);

    // 射线检测
    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();
    lastUV = null;
  } catch (e) {
    console.error('[spike3d] init failed:', e && e.message ? e.message : e);
    if (typeof wx !== 'undefined' && wx.showToast) {
      wx.showToast({ title: '3D spike 初始化失败', icon: 'none' });
    }
    return;
  }

  function onMove(x, y) {
    pointer.x = (x / W) * 2 - 1;
    pointer.y = -(y / H) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    var hits = raycaster.intersectObject(cube, false);
    if (hits.length && hits[0].uv) {
      var uv = hits[0].uv;
      lastUV = { x: uv.x, y: uv.y, px: x, py: y };
    } else {
      lastUV = null;
    }
  }

  if (isWx) {
    wx.onTouchStart(function (e) { if (e.touches && e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY); });
    wx.onTouchMove(function (e) { if (e.touches && e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY); });
  } else {
    glCanvas.addEventListener('mousemove', function (e) { onMove(e.clientX, e.clientY); });
    glCanvas.addEventListener('touchmove', function (e) { if (e.touches && e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  }

  function drawUI() {
    uictx.clearRect(0, 0, W, H);
    uictx.fillStyle = 'rgba(20,12,6,0.6)';
    uictx.fillRect(0, 0, W, 70);
    uictx.fillStyle = '#f7e3ae';
    uictx.font = 'bold 22px sans-serif';
    uictx.textAlign = 'left';
    uictx.fillText(isWx ? '3D SPIKE: WebGL立方体 + 离屏UI合成' : '3D SPIKE (browser): WebGL + UI composite', 16, 44);
    if (lastUV) {
      uictx.fillStyle = 'rgba(40,80,40,0.75)';
      uictx.fillRect(W - 250, H - 78, 240, 68);
      uictx.fillStyle = '#aef7b0';
      uictx.font = '14px monospace';
      uictx.textAlign = 'left';
      uictx.fillText('HIT UV = (' + lastUV.x.toFixed(3) + ', ' + lastUV.y.toFixed(3) + ')', W - 240, H - 50);
      uictx.fillText('pointer = (' + lastUV.px.toFixed(0) + ', ' + lastUV.py.toFixed(0) + ')', W - 240, H - 30);
    }
    uiTexture.needsUpdate = true;
  }

  var t0 = Date.now();
  var raf = (typeof requestAnimationFrame !== 'undefined') ? requestAnimationFrame : (isWx ? null : window.requestAnimationFrame);
  function loop() {
    var t = (Date.now() - t0) / 1000;
    cube.rotation.x = t * 0.5;
    cube.rotation.y = t * 0.7;
    drawUI();
    renderer.autoClear = true;
    renderer.render(scene, camera);
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(uiScene, uiCam);
    if (raf) raf(loop);
  }
  loop();

  console.log('[spike3d] running, env=' + (isWx ? 'wechat' : 'browser'));
}

module.exports = { run: run };
