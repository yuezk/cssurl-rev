var Path = require('path');
var Url = require('url');
var crypto = require('crypto');
var http = require('http');
var https = require('https');

var Promise = require('bluebird');
var fs = Promise.promisifyAll(require('fs'));

var mkdirp = require('mkdirp');
var globule = require('globule');
var pathIsAbsolute = require('path-is-absolute');
var cssimports = require('cssimports');

exports.getAllFiles = function (options) {
    var self = this;

    return function (files) {
        var allFiles = [];

        return Promise.map(files, function (file) {
            var path = Path.resolve(
                options.srcBase || process.cwd(),
                options.srcBase ? Path.basename(file.src[0]) : file.src[0]
            );

            var dest;

            if (!options.srcBase) {
                console.log(Path.join(file.src[0]));
                console.log(Path.join(options.destBase));
                console.log(Path.relative(Path.join(file.src[0]), Path.join(options.destBase)));
                console.log(Path.resolve(path, Path.relative(Path.join(file.src[0]), Path.join(options.destBase))));
            }


            allFiles.push({
                src: file.src[0],
                absolutePath: path,
                dest: file.dest
            });

            if (!options.deep) {
                return allFiles;
            }

            return cssimports(path, { deep: true, flatten: true }).then(function (imports) {
                var ret = [];
                var src;
                var dest;
                var item;

                for (var i = 0; i < imports.length; i++) {
                    item = imports[i];
                    if (pathIsAbsolute(item.absolutePath)) {
                        src = Path.join(Path.dirname(file.src[0]), item.path);
                        dest = Path.join(Path.dirname(file.dest), item.path);
                        ret.push({ src: src, absolutePath: item.absolutePath, dest: dest });
                    }

                }

                return ret;
            });
        }).then(function (results) {
            results.forEach(function (imports) {
                imports.forEach(function (item) {
                    if (!exists(item)) {
                        allFiles.push(item);
                    }
                });
            });
            return allFiles;
        });

        function exists(newFile) {
            return allFiles.some(function (item) {
                return item.absolutePath === newFile.absolutePath;
            });
        }
    };
};

exports.hashFiles = function (options) {
    var self = this;

    return function (files) {
        return Promise.map(files, function (file) {
            return self.hashFile(file);
        });
    };
};

/**
 * 处理单个样式文件，找出里面所有的 url， 根据 url 定位到引用的资源，获取 hash 的值，
 * 并将 hash 值追加到 url 的后面
 *
 * @param  {object} file 文件对象
 * @return {Promise}
 */
exports.hashFile = function (file) {
    var self = this;

    return fs.readFileAsync(file.absolutePath, 'utf-8').then(function (contents) {
        // 解析出样式文件中所有的 url
        var urls = self.getUrls(contents);
        // 处理 url 路径，得到详细的路径信息
        file.urls = self.parseUrls(urls, Path.dirname(file.absolutePath));

        return self.getHashes(file.urls).then(function () {
            return file;
        });
    });
};

exports.parseUrls = function (urls, base) {
    return urls.map(function (url) {
        var urlObj = Url.parse(url.path, true);

        // http:// or https://
        if (this.isRemotePath(url.path)) {
            urlObj.absolutePath = url.path;
        } else {
            urlObj.absolutePath = Path.resolve(base, urlObj.pathname);
        }

        urlObj.match = url.match;
        return urlObj;
    }, this);
};

exports.getHashes = function (files) {
    var self = this;
    return Promise.map(files, function (file) {
        return self.getHash(file.absolutePath).then(function (hash) {
            file.hashstring = hash;
            return file;
        });
    });
};

exports.getHash = function (file) {
    if (this.isRemotePath(file)) {
        return this.getRemoteFileHash(file);
    }

    return this.getLocalFileHash(file);
};

exports.getRemoteFileHash = function (file) {
    var self = this;

    return new Promise(function (resolve, reject) {
        var client = self.isHttps(file) ? https : http;
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

exports.getLocalFileHash = function (file) {
    var self = this;
    return fs.readFileAsync(file, 'utf-8').then(function (contents) {
        return self.md5(contents);
    });
};

exports.replaceHash = function (replacer) {
    return function (files) {
        return Promise.map(files, function (file) {
            file.urls.forEach(function (url) {
                url.replaced = replacer(url.href, url.hashstring);
            });

            return file;
        });
    };
};

exports.writeFiles = function () {
    var self = this;
    return function (files) {
        return Promise.map(files, self.writeFile());
    };
};

exports.writeFile = function () {
    return function (file) {
        return fs.readFileAsync(file.absolutePath, 'utf-8').then(function (contents) {
            file.urls.forEach(function (url) {
                contents = contents.replace(url.match, 'url(' + url.replaced + ')');
            });
            mkdirp.sync(Path.dirname(file.dest));
            return fs.writeFileAsync(file.dest, contents);
        });
    }
};


exports.getUrls = function (contents) {
    var urlReg = /url\((['"]?)(.+?)\1\)/ig;
    var match;
    var urls = [];

    while((match = urlReg.exec(contents)) !== null) {
        if (!/^data:/.test(match[2])) { // 忽略 data uri
            urls.push({ match: match[0], path: match[2] });
        }
    }

    return urls;
};

exports.getAbsolutePath = function (path, base) {
    if (/^https?:\/\//.test(path)) {
        return path;
    }
    return Path.resolve(base, path);
};

exports.md5 = function (data) {
    return crypto.createHash('md5').update(data).digest('hex');
};

exports.isRemotePath = function (path) {
    return /^https?:\/\//.test(path);
};

exports.isHttps = function (path) {
    return /^https:\/\//.test(path);
};

exports.replacer = function (url, hash) {
    var urlObj = Url.parse(url, true);

    urlObj.query.v = hash.slice(0, 10);
    delete urlObj.search;

    return Url.format(urlObj);
};

exports.handleError = function () {
    return function (err) {
        console.log('Error: ', err.stack);
    };
};