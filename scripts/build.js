#!/usr/bin/env node
/**
 * 零依赖打包器：把 src 下的 CommonJS 模块打成一个 IIFE。
 * 同一份产物同时用于微信小游戏（minigame/game.js）与浏览器预览。
 */
var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..');
var SRC = path.join(ROOT, 'src');
var OUT = path.join(ROOT, 'minigame', 'game.js');
var ENTRY = 'main';

// 拼接前先用 esbuild 把 three 预打包成 src/vendor/three-wx.js（CJS）
require('./bundle-three')();

var modules = {};
var order = [];

function resolveId(baseId, spec) {
  if (spec.charAt(0) !== '.') return spec;
  var parts = baseId.split('/');
  parts.pop();
  var segs = spec.split('/');
  for (var i = 0; i < segs.length; i++) {
    var s = segs[i];
    if (!s || s === '.') continue;
    if (s === '..') parts.pop();
    else parts.push(s);
  }
  return parts.join('/').replace(/\.js$/, '');
}

function collect(id) {
  if (modules[id] !== undefined) return;
  var file = path.join(SRC, id + '.js');
  if (!fs.existsSync(file)) {
    throw new Error('找不到模块: ' + id + ' -> ' + file);
  }
  var code = fs.readFileSync(file, 'utf8');
  var deps = [];
  var re = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  var m;
  while ((m = re.exec(code))) {
    var raw = m[1];
    if (raw.charAt(0) !== '.') continue; // 外部依赖（如 three-platformize）留运行时解析，不收集
    var dep = resolveId(id, raw);
    if (deps.indexOf(dep) < 0) deps.push(dep);
  }
  modules[id] = code;
  order.push(id);
  for (var i = 0; i < deps.length; i++) collect(deps[i]);
}

collect(ENTRY);

var parts = [];
parts.push('/*! 土豆削削乐 · WeChat MiniGame bundle · built ' + new Date().toISOString() + ' */');
parts.push('(function(){');
parts.push('"use strict";');
parts.push('var __defs = {};');
parts.push('var __cache = {};');
parts.push('var __nativeRequire = typeof require !== "undefined" ? require : null;');
parts.push('function __resolve(from, spec){');
parts.push('  if (spec.charAt(0) !== ".") return spec;');
parts.push('  var parts = from.split("/"); parts.pop();');
parts.push('  var segs = spec.split("/");');
parts.push('  for (var i = 0; i < segs.length; i++) {');
parts.push('    var s = segs[i];');
parts.push('    if (!s || s === ".") continue;');
parts.push('    if (s === "..") parts.pop(); else parts.push(s);');
parts.push('  }');
parts.push('  return parts.join("/").replace(/\\.js$/, "");');
parts.push('}');
parts.push('function __load(id){');
parts.push('  if (__cache[id]) return __cache[id].exports;');
parts.push('  var def = __defs[id];');
parts.push('  if (!def) throw new Error("Missing module: " + id);');
parts.push('  var module = { exports: {} };');
parts.push('  __cache[id] = module;');
parts.push('  def(module, module.exports, function(spec){');
parts.push('    var rid = __resolve(id, spec);');
parts.push('    if (__defs[rid] !== undefined) return __load(rid);');
parts.push('    if (__nativeRequire) return __nativeRequire(spec);');
parts.push('    throw new Error("Missing module: " + spec);');
parts.push('  });');
parts.push('  return module.exports;');
parts.push('}');

order.forEach(function (id) {
  parts.push('__defs[' + JSON.stringify(id) + '] = function(module, exports, require){');
  parts.push(modules[id]);
  parts.push('};');
});

parts.push('__load(' + JSON.stringify(ENTRY) + ');');
parts.push('})();');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, parts.join('\n'), 'utf8');

var bytes = fs.statSync(OUT).size;
console.log('[build] ' + order.length + ' modules -> ' + path.relative(ROOT, OUT) + ' (' + (bytes / 1024).toFixed(1) + ' KB)');
