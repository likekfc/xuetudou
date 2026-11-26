#!/usr/bin/env node
/**
 * 本地静态服务器，手机与电脑处于同一局域网时可扫码/输入地址试玩。
 */
var http = require('http');
var fs = require('fs');
var path = require('path');
var os = require('os');

var ROOT = path.resolve(__dirname, '..');
var PORT = Number(process.env.PORT || 5173);

var MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

var server = http.createServer(function (req, res) {
  var urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  var file = path.normalize(path.join(ROOT, urlPath));
  if (file.indexOf(ROOT) !== 0) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(file, function (err, buf) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + urlPath);
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(buf);
  });
});

function lanAddress() {
  var list = os.networkInterfaces();
  for (var key in list) {
    var items = list[key] || [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.family === 'IPv4' && !it.internal) return it.address;
    }
  }
  return '127.0.0.1';
}

server.listen(PORT, '0.0.0.0', function () {
  console.log('');
  console.log('  土豆削削乐 · 本地预览');
  console.log('  电脑: http://localhost:' + PORT);
  console.log('  手机: http://' + lanAddress() + ':' + PORT + '  (同一 Wi-Fi)');
  console.log('');
});
