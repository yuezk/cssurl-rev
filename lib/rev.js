var Path = require('path');
var Promise = require('bluebird');
var globule = require('globule');
var util = require('./util');

module.exports = function (src, options) {
    if (src === null || typeof src === 'undefined') {
        throw new Error('`src` is required!');
    }

    if (typeof src === 'object') {
        options = src;
    } else {
        options.src = src;
    }

    var replacer = options.replacer || util.replacer;

    return Promise.resolve(globule.findMapping(options))
        .then(util.getAllFiles(options))
        .then(util.hashFiles())
        .then(util.replaceHash(replacer))
        .then(util.writeFiles())
        .catch(util.handleError());
};