'use strict';

let app = require('koa')();
let fs = require('fs');
let urlencode = require('urlencode');
let thunkify = require('thunkify');

let render = require('co-views')(
  __dirname + '/views',
  {map: { html: 'swig' }}
);

let stat = thunkify(fs.stat);
let readFile = thunkify(fs.readFile);
let readDir = thunkify(fs.readdir);

let config = require('./config');
let rootDir = config.rootDir;

function* processDir() {
  let url = this.url;
  let dir = yield readDir(rootDir + url);
  dir = dir.filter(d => {
    return !/^\..+/.test(d);
  });
  let isdir = yield dir.map(d => {
    let path = rootDir + url + d;
    return function* () {
      let s = yield stat(path);
      return s.isDirectory();
    }
  });
  let dirMeta = isdir.map((b, idx) => {
    const resultUrl = url + dir[idx] + (b ? '/' : '');
    return {
      name: dir[idx],
      url: resultUrl,
      target: b ? '' : '_blank',
      dir: b,
      isImg: /.+(\.JPG|\.jpg|\.PNG|\.png|\.JPEG|\.jpeg|\.GIF|\.gif|\.BMP|\.bmp)$/.test(resultUrl)
    }
  });

  let preDir = /(.+\/).+\/?$/.exec(url);
  if (preDir) {
    preDir = preDir[1];
  } else {
    preDir = '/';
  }
  dirMeta.unshift({
    name: '..',
    url: preDir,
    target: '',
    dir: true
  });
  this.body = yield render('dir', {
    title: url,
    dir: url,
    dirMeta: dirMeta
  });
}

function* processFile() {
  let url = this.url;
  this.type = 'text/plain';
  if (/.+(\.jpg|\.png|\.jpeg|\.gif|\.bmp)$/.test(url)) {
    this.type = 'image/png';
  }
  if (/.+(\.json)$/.test(url)) {
    this.type = 'application/json';
  }
  this.body = yield readFile(rootDir + url);
}

app.use(function*() {
  let req = this.req;
  let url = req.url || '/';
  url = url.split('?')[0];
  this.url = urlencode.decode(url, 'utf8');
  try {
    let s = yield stat(rootDir + this.url);
    if (s.isDirectory()) {
      yield processDir;
    } else {
      yield processFile;
    }
  } catch (e) {
    console.log(e);
    return this.body = '不是正常目录,无法访问';
  }
});

app.listen(3333);

