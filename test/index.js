var fs = require('fs');
var Path = require('path');
var crypto = require('crypto');
var Rev = require('..');
var should = require('should');
var express = require('express');
require('mocha');

var app = express();
var server;
app.use(express.static(Path.join(__dirname, 'fixtures')));

process.chdir(__dirname);

before(function (done) {
    server = app.listen(10010, function () {
        var host = server.address().address;
        var port = server.address().port;
        console.log('Test server listening at http://%s:%s', host, port);

        done();
    })
});

after(function () {
    server.close();
});

describe('cssurl-rev', function() {
    describe('#Rev()', function () {
        it('should always return an instance of Rev', function () {
            Rev().should.be.instanceof(Rev);
            new Rev().should.be.instanceof(Rev);
        });
    });

    describe('#src()', function() {
        it('should set/get the `_src`', function () {
            var src = 'fixtures/app.css';
            var rev = new Rev();

            rev.src(src);
            rev._src.should.be.equal(src);
            rev.src().should.be.equal(src);
        });
    });

    describe('#dest()', function() {
        it ('should set/get the `_dest`', function () {
            var dest = 'build';
            var rev = new Rev();

            rev.dest(dest);
            rev._dest.should.be.equal(dest);
            rev.dest().should.be.equal(dest);
        });
    });

    describe('#run()', function () {
        var md5;

        before(function () {
            md5 = crypto.createHash('md5').update(fs.readFileSync('fixtures/images/test.png')).digest('hex');
        });

        it('should throw an error', function () {
            var rev = new Rev();
            (function () {
                rev.run();
            }).should.throw(Error);
        });

        it('should add the local file\'s md5 hash to the end of the url', function (done) {
            var expected = [
                'body {',
                '    background: url(images/test.png?v=' + md5.slice(0, 10) + ');',
                '}'
            ].join('\n');

            var rev = new Rev();
            rev.src('fixtures/test-local.css')
                .dest('tmp')
                .run(function (err, files) {
                    should(err).be.null();
                    files[0].contents.toString().should.be.equal(expected);
                    done();
                });
        });

        it('should work when no dest specified', function () {
            var expected = [
                'body {',
                '    background: url(images/test.png?v=' + md5.slice(0, 10) + ');',
                '}'
            ].join('\n');

            var rev = new Rev();
            rev.src('fixtures/test-local.css')
                .run(function (err, files) {
                    should(err).be.null();
                    files[0].contents.toString().should.be.equal(expected);
                });
        });

        it('should add the remote file\'s md5 hash to the end of the url', function (done) {
            var expected = [
                'body {',
                '    background: url(http://127.0.0.1:10010/images/test.png?v=' + md5.slice(0, 10) + ');',
                '}'
            ].join('\n');

            var rev = new Rev();
            rev.src('fixtures/test-remote.css')
                .dest('tmp')
                .run(function (err, files) {
                    should(err).be.null();
                    files[0].contents.toString().should.be.equal(expected);
                    done();
                });
        });

        it('should skip the data uri', function (done) {
            var expected = fs.readFileSync('fixtures/test-datauri.css', 'utf-8');
            var rev = new Rev();
            rev.src('fixtures/test-datauri.css')
                .dest('tmp')
                .run(function (err, files) {
                    should(err).be.null();
                    files[0].contents.toString().should.be.equal(expected);
                    done();
                });
        });

        it('should append the hash to the end of the url if other parameter already exists in the querystring', function (done) {
            var expected = [
                'body {',
                '    background: url(images/test.png?type=&v=' + md5.slice(0, 10) + ');',
                '    background: url(images/test.png?type=&v=' + md5.slice(0, 10) + ');',
                '    background: url(images/test.png?type=image&v=' + md5.slice(0, 10) + ');',
                '}'
            ].join('\n');

            var rev = new Rev();
            rev.src('fixtures/test-append-hash.css')
                .dest('tmp')
                .run(function (err, files) {
                    should(err).be.null();
                    files[0].contents.toString().should.be.equal(expected);
                    done();
                });
        });

        it('should replace the value of `v`, if `v` already exists in the query string', function (done) {
            var expected = [
                'body {',
                '    background: url(images/test.png?v=md5);',
                '    background: url(images/test.png?v=md5&type=image);',
                '    background: url(images/test.png?type=image&v=md5);',
                '}'
            ].join('\n').replace(/md5/g, md5.slice(0, 10));
            var rev = new Rev();
            rev.src('fixtures/test-replace-hash.css')
                .dest('tmp')
                .run(function (err, files) {
                    should(err).be.null();
                    files[0].contents.toString().should.be.equal(expected);
                    done();
                });
        });

        it('should add custom hash to the url when the `replacer` is specified', function (done) {
            var expected = [
                'body {',
                '    background: url(images/test.png?' + md5 + ');',
                '}'
            ].join('\n');

            var rev = new Rev();
            var replacer = function (url, hash) {
                return url + '?' + hash;
            };

            rev.src('fixtures/test-local.css')
                .dest('tmp')
                .run({ replacer: replacer }, function (err, files) {
                    should(err).be.null();
                    files[0].contents.toString().should.be.equal(expected);
                    done();
                });
        });

        it('should skip remote url when `skipRemote` is specified', function (done) {
            var expected = fs.readFileSync('fixtures/test-remote.css', 'utf-8');
            var rev = new Rev();
            rev.src('fixtures/test-remote.css')
                .dest('tmp')
                .run({ skipRemote: true }, function (err, files) {
                    should(err).be.null();
                    files[0].contents.toString().should.be.equal(expected);
                    done();
                });
        });

        it('should work even though the `options` and `callback` not specified', function () {
            (function () {
                new Rev().src('fixtures/test-local.css')
                    .dest('tmp')
                    .run();
            }).should.not.throw(Error);
        });
    });
});