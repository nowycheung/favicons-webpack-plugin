'use strict';
var childCompiler = require('./lib/compiler.js');
var assert = require('assert');
var _ = require('lodash');
var fs = require('fs');
var path = require('path');

function ReFaviconsWebpackPlugin (options) {
  if (typeof options === 'string') {
    options = {logo: options};
  }
  assert(typeof options === 'object', 'ReFaviconsWebpackPlugin options are required');
  assert(options.logo, 'An input file is required');
  assert(fs.existsSync(options.logo), 'Input file path does not exist');

  this.options = _.extend({
    prefix: 'icons-[hash]/',
    emitStats: false,
    statsFilename: 'iconstats-[hash].json',
    persistentCache: true,
    inject: true,
  }, options);
}

ReFaviconsWebpackPlugin.prototype.apply = function (compiler) {
  var self = this;
  if (!self.options.appName) {
    self.options.appName = guessAppName(compiler.context);
  }

  // Generate the favicons (webpack 4 compliant + back compat)
  var compilationResult;
  (compiler.hooks
    ? compiler.hooks.make.tapAsync.bind(compiler.hooks.make, 'ReFaviconsWebpackPluginMake')
    : compiler.plugin.bind(compiler, 'make')
  )((compilation, callback) => {
    childCompiler.compileTemplate(self.options, compiler.context, compilation)
      .then(function (result) {
        compilationResult = result;
        callback();
      })
      .catch(callback);
  });

  // Hook into the html-webpack-plugin processing
  // and add the html
  if (self.options.inject) {
    var addFaviconsToHtml = function (htmlPluginData, callback) {
      if (htmlPluginData.plugin.options.favicons !== false) {
        htmlPluginData.html = htmlPluginData.html.replace(
          /(<\/head>)/i, compilationResult.stats.html.join('') + '$&');
      }
      callback(null, htmlPluginData);
    };

    // webpack 4
    if (compiler.hooks) {
      compiler.hooks.compilation.tap('ReFaviconsWebpackPlugin', function (cmpp) {
        cmpp.hooks.htmlWebpackPluginBeforeHtmlProcessing.tapAsync('favicons-webpack-plugin', addFaviconsToHtml);
      });
    } else {
      compiler.plugin('compilation', function (compilation) {
        compilation.plugin('html-webpack-plugin-before-html-processing', addFaviconsToHtml);
      });
    }
  }

  // Remove the stats from the output if they are not required (webpack 4 compliant + back compat)
  if (!self.options.emitStats) {
    (compiler.hooks
      ? compiler.hooks.emit.tapAsync.bind(compiler.hooks.emit, 'ReFaviconsWebpackPluginEmit')
      : compiler.plugin.bind(compiler, 'emit')
    )((compilation, callback) => {
      delete compilation.assets[compilationResult.outputName];
      callback();
    });
  }
};

/**
 * Tries to guess the name from the package.json
 */
function guessAppName (compilerWorkingDirectory) {
  var packageJson = path.resolve(compilerWorkingDirectory, 'package.json');
  if (!fs.existsSync(packageJson)) {
    packageJson = path.resolve(compilerWorkingDirectory, '../package.json');
    if (!fs.existsSync(packageJson)) {
      return 'Webpack App';
    }
  }
  return JSON.parse(fs.readFileSync(packageJson)).name;
}

module.exports = ReFaviconsWebpackPlugin;
