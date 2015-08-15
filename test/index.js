var cssrev = require('..');

cssrev
    .src('test/fixtures/**/*.css')
    .dest('expected')
    .run({ replacer: replacer }, function (err, files) {
        console.log(arguments);
    });

function replacer(url, hash) {
    return url + '?' + hash;
}
