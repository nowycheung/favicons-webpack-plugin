'use strict';
var path = require('path');
var SingleEntryPlugin = require('webpack/lib/SingleEntryPlugin');

module.exports.compileTemplate = function compileTemplate (options, context, compilation) {
  // The entry file is just an empty helper as the dynamic template
  // require is added in "loader.js"
  var outputOptions = {
    filename: options.filename,
    publicPath: compilation.outputOptions.publicPath
  };
  // Create an additional child compiler which takes the template
  // and turns it into an Node.JS html factory.
  // This allows us to use loaders during the compilation
  var compilerName = getCompilerName(context, outputOptions.filename);
  var childCompiler = compilation.createChildCompiler(compilerName, outputOptions);
  childCompiler.context = context;
  childCompiler.apply(
    new SingleEntryPlugin(context, '!!' + require.resolve('./loader.js') + '?' +
      JSON.stringify({
        outputFilePrefix: options.prefix,
        icons: options.icons,
        background: options.background,
        appName: options.title
      }) + '!' + options.logo)
  );

  // Fix for "Uncaught TypeError: __webpack_require__(...) is not a function"
  // Hot module replacement requires that every child compiler has its own
  // cache. @see https://github.com/ampedandwired/html-webpack-plugin/pull/179
  childCompiler.plugin('compilation', function (compilation) {
    if (compilation.cache) {
      if (!compilation.cache[compilerName]) {
        compilation.cache[compilerName] = {};
      }
      compilation.cache = compilation.cache[compilerName];
    }
    compilation.plugin('optimize-chunk-assets', function (chunks, callback) {
      var resultFile = chunks[0].files[0];
      var resultJson = compilation.assets[resultFile].source();
      var start = '// LOADER START //';
      var end = '// LOADER END //';
      resultJson = resultJson.substr((resultJson.indexOf(start) + start.length));
      resultJson = resultJson.substr(0, resultJson.indexOf(end));
      compilation.assets[resultFile] = {
        source: function () {
          return resultJson;
        },
        size: function () {
          return resultJson.length;
        }
      };
      callback(null);
    });
  });

  // Compile and return a promise
  return new Promise(function (resolve, reject) {
    childCompiler.runAsChild(function (err, entries, childCompilation) {
      // Replace [hash] placeholders in filename
      var outputName = compilation.mainTemplate.applyPluginsWaterfall('asset-path', outputOptions.filename, {
        hash: childCompilation.hash,
        chunk: entries[0]
      });
      // Resolve / reject the promise
      if (childCompilation && childCompilation.errors && childCompilation.errors.length) {
        var errorDetails = childCompilation.errors.map(function (error) {
          return error.message + (error.error ? ':\n' + error.error : '');
        }).join('\n');
        reject(new Error('Child compilation failed:\n' + errorDetails));
      } else if (err) {
        reject(err);
      } else {
        resolve(JSON.parse(childCompilation.assets[outputName].source()));
      }
    });
  });
};

/**
 * Returns the child compiler name e.g. 'html-webpack-plugin for "index.html"'
 */
function getCompilerName (context, filename) {
  var absolutePath = path.resolve(context, filename);
  var relativePath = path.relative(context, absolutePath);
  return 'favicons-webpack-plugin for "' + (absolutePath.length < relativePath.length ? absolutePath : relativePath) + '"';
}