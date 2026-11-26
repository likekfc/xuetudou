/**
 * 用 esbuild 把 three-platformize（含平台适配器）预打包成单个 CJS 文件：
 *   src/vendor/three-wx.js
 * 这样 three 直接并入游戏产物，微信开发者工具无需「构建 npm」，浏览器预览也共用同一份。
 * 由 scripts/build.js 在拼接前自动调用；也可单独运行 node scripts/bundle-three.js。
 */
var esbuild = require('esbuild');
var path = require('path');
var fs = require('fs');

var ROOT = path.resolve(__dirname, '..');
var OUT = path.join(ROOT, 'src', 'vendor', 'three-wx.js');

function run() {
  // write:false 让 esbuild 把产物放到内存，再由 Node fs 写盘——
  // 规避沙箱对 esbuild 原生进程直接写文件的权限限制。
  var result = esbuild.buildSync({
    entryPoints: [path.join(ROOT, 'src', 'vendor', '_three-entry.js')],
    bundle: true,
    format: 'cjs',
    platform: 'neutral',
    mainFields: ['module', 'main'], // neutral 平台需显式指定，否则忽略 package.json 的 main/module
    target: 'es2015',
    minify: false, // 调试期不压缩，便于看堆栈；上线前改 true 可再减 ~40%
    sourcemap: false,
    write: false,
    logLevel: 'info'
  });
  var code = Buffer.from(result.outputFiles[0].contents).toString('utf8');
  // 修复 three-platformize 的缺陷：WechatGamePlatform/XMLHttpRequest.js 在模块顶层裸用
  // wx.getSystemInfoSync()，导致浏览器/Node 加载该 bundle 时立即抛 ReferenceError。
  // 改成带守卫的写法；该 platform 变量仅在微信 XHR 实现内部使用，浏览器走 BrowserPlatform 不会用到。
  code = code.replace(
    'var { platform } = wx.getSystemInfoSync();',
    'var platform = (typeof wx !== "undefined" && typeof wx.getSystemInfoSync === "function") ? wx.getSystemInfoSync().platform : "";'
  );
  fs.writeFileSync(OUT, code, 'utf8');
  console.log('[bundle-three] -> src/vendor/three-wx.js (' + Math.round(Buffer.byteLength(code, 'utf8') / 1024) + ' KB)');
}

if (require.main === module) {
  run();
}

module.exports = run;
