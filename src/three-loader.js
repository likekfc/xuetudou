/**
 * 统一获取 Three.js 实例：
 * - 微信小游戏：用 WechatGamePlatform 适配 wx.createCanvas 的 WebGL 画布；
 * - 浏览器：用 BrowserPlatform（真实 window/document）。
 * three 已由 scripts/bundle-three.js 预打包成 src/vendor/three-wx.js（CJS），直接 require 即可，
 * 因此微信开发者工具无需「构建 npm」。
 */
var _bundle = require('./vendor/three-wx');

var isWx = (typeof wx !== 'undefined') && (typeof wx.createCanvas === 'function');

function loadTHREE(glCanvas) {
  var THREE = _bundle.THREE;
  if (isWx) {
    THREE.PLATFORM.set(new _bundle.WechatGamePlatform(glCanvas));
  } else {
    THREE.PLATFORM.set(new _bundle.BrowserPlatform());
  }
  return THREE;
}

module.exports = { loadTHREE: loadTHREE, isWx: isWx };
