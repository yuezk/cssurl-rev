var Url = require('url');
var Path = require('path');
var http = require('http');
var https = require('https');
var crypto = require('crypto');

var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));
var vfs = require('vinyl-fs');
var map = require('map-stream');
var concat = require('concat-stream');

var rev = exports;

rev.src = function (src) {
    if (!src) {
        return this._src;
    }
    this._src = src;
    return this;
};

rev.dest = function (dest) {
    if (!dest) {
        return this._dest;
    }
    this._dest = dest;
    return this;
};

rev.run = function (options, cb) {
    var replacer;

    if (typeof options === 'function') {
        cb = options;
    }

    options = options || {};
    cb = cb || function () {};
    replacer = options.replacer || defaultReplacer;

    vfs.src(this.src())
        .on('error', cb)
        .pipe(map(hashFile(replacer)))
        .pipe(vfs.dest(this.dest()))
        .pipe(concat(cb.bind(null, null)))
};

function hashFile(replacer) {
    return function (file, cb) {
        var contents = file.contents.toString();
        var urls = getUrls(contents, Path.dirname(file.path));

        Promise.map(urls, function (url) {
            return getHash(url.absolutePath).then(function (hashstring) {
                url.hashstring = hashstring;
                return url;
            });
        }).then(function (results) {
            results.forEach(function (result) {
                var replaced = replacer(result.href, result.hashstring);
                contents = contents.replace(new RegExp(escapeRegExp(result.match), 'g'), 'url(' + replaced + ')');
            });

            file.contents = new Buffer(contents);
            cb(null, file);
        }, cb);
    };
}

function getUrls(contents, base) {
    var urlReg = /url\((['"]?)(.+?)\1\)/ig;
    var match;
    var urls = [];

    while((match = urlReg.exec(contents)) !== null) {
        if (!/^data:/.test(match[2]) && !exists(match[0])) { // 忽略 data uri 和 重复的 url
            var url = Url.parse(match[2]);
            url.match = match[0];

            if (isRemotePath(url.href)) {
                url.absolutePath = url.href;
            } else {
                url.absolutePath = Path.join(base, url.pathname)
            }

            urls.push(url);
        }
    }

    function exists(match) {
        return urls.some(function (url) {
            return url.match === match;
        });
    }

    return urls;
}

function getHash(file) {
    if (isRemotePath(file)) {
        return getRemoteFileHash(file);
    }

    return getLocalFileHash(file);
}

function getRemoteFileHash(file) {
    return new Promise(function (resolve, reject) {
        var client = /^https/.test(file) ? https : http;
        client.get(file, function (res) {
            var md5 = crypto.createHash('md5');

            res.on('data', function (chunk) {
                md5.update(chunk);
            });

            res.on('end', function () {
                resolve(md5.digest('hex'));
            });
        }).on('error', reject);
    });
};

function getLocalFileHash(file) {
    return fs.readFileAsync(file).then(function (contents) {
        return crypto.createHash('md5').update(contents).digest('hex');
    });
};

function defaultReplacer(url, hash) {
    var urlObj = Url.parse(url, true);

    urlObj.query.v = hash.slice(0, 10);
    delete urlObj.search;

    return Url.format(urlObj);
}

function isRemotePath(path) {
    return /^https?:\/\//.test(path);
}
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
function escapeRegExp(string){
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
