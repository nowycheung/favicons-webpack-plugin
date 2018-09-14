/* eslint-env es6 */
import test from 'ava';
import path from 'path';
import rimraf from 'rimraf';
import ReFaviconsWebpackPlugin from '..';
import denodeify from 'denodeify';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import dircompare from 'dir-compare';
import packageJson from '../package.json';

const webpack = denodeify(require('webpack'));
const readFile = denodeify(require('fs').readFile);
const writeFile = denodeify(require('fs').writeFile);
const mkdirp = denodeify(require('mkdirp'));

const compareOptions = {compareSize: true};
const LOGO_PATH = path.resolve(__dirname, 'fixtures/logo.png');

rimraf.sync(path.resolve(__dirname, '../dist'));

const baseWebpackConfig = (plugin, folderName) => {
  return {
    devtool: 'eval',
    entry: path.resolve(__dirname, 'fixtures/entry.js'),
    output: {
      path: path.resolve(__dirname, '../dist', folderName)
    },
    plugins: [].concat(plugin)
  };
};

test('should throw error when called without arguments', async t => {
  t.plan(2);
  let plugin;
  try {
    plugin = new ReFaviconsWebpackPlugin();
  } catch (err) {
    t.is(err.message, 'ReFaviconsWebpackPlugin options are required');
  }
  t.is(plugin, undefined);
});

test('should throw error if the file path does not exist', async t => {
  t.plan(2);
  let plugin;
  try {
    plugin = new ReFaviconsWebpackPlugin('fake/path');
  } catch (err) {
    t.is(err.message, 'Input file path does not exist');
  }
  t.is(plugin, undefined);
});

test('should take a string as argument', async t => {
  var plugin = new ReFaviconsWebpackPlugin(LOGO_PATH);
  t.is(plugin.options.logo, LOGO_PATH);
});

test('should take an object with just the logo as argument', async t => {
  var plugin = new ReFaviconsWebpackPlugin({ logo: LOGO_PATH });
  t.is(plugin.options.logo, LOGO_PATH);
});

test('should generate the expected default result', async t => {
  const folderName = 'default';
  const stats = await webpack(baseWebpackConfig(new ReFaviconsWebpackPlugin({
    logo: LOGO_PATH
  }), folderName));
  const outputPath = stats.compilation.compiler.outputPath;
  const expected = path.resolve(__dirname, `fixtures/expected/${folderName}`);
  const compareResult = await dircompare.compare(outputPath, expected, compareOptions);
  const diffFiles = compareResult.diffSet.filter((diff) => diff.state !== 'equal');
  t.is(diffFiles[0], undefined);
});

test('should generate a configured JSON file', async t => {
  const folderName = 'generate-json';
  const stats = await webpack(baseWebpackConfig(new ReFaviconsWebpackPlugin({
    logo: LOGO_PATH,
    emitStats: true,
    persistentCache: false,
    statsFilename: 'iconstats.json'
  }), folderName));
  const outputPath = stats.compilation.compiler.outputPath;
  const expected = path.resolve(__dirname, `fixtures/expected/${folderName}`);
  const compareResult = await dircompare.compare(outputPath, expected, compareOptions);
  const diffFiles = compareResult.diffSet.filter((diff) => diff.state !== 'equal');
  t.is(diffFiles[0], undefined);
});

test('should work together with the html-webpack-plugin', async t => {
  const folderName = 'generate-html';
  const stats = await webpack(baseWebpackConfig([
    new ReFaviconsWebpackPlugin({
      logo: LOGO_PATH,
      emitStats: true,
      statsFilename: 'iconstats.json',
      persistentCache: false
    }),
    new HtmlWebpackPlugin()
  ], folderName));
  const outputPath = stats.compilation.compiler.outputPath;
  const expected = path.resolve(__dirname, `fixtures/expected/${folderName}`);
  const compareResult = await dircompare.compare(outputPath, expected, compareOptions);
  const diffFiles = compareResult.diffSet.filter((diff) => diff.state !== 'equal');
  t.is(diffFiles[0], undefined);
});

test('should not recompile if there is a cache file', async t => {
  const folderName = 'from-cache';
  const options = baseWebpackConfig([
    new ReFaviconsWebpackPlugin({
      logo: LOGO_PATH,
      emitStats: false,
      persistentCache: true
    }),
    new HtmlWebpackPlugin()
  ], folderName);

  // Bring cache file in place
  const cacheFile = 'icons-366a3768de05f9e78c392fa62b8fbb80/.cache';
  const cacheFileExpected = path.resolve(__dirname, `fixtures/expected/${folderName}`, cacheFile);
  const cacheFileDist = path.resolve(__dirname, options.output.path, cacheFile);
  await mkdirp(path.dirname(cacheFileDist));
  const cache = JSON.parse(await readFile(cacheFileExpected));
  cache.version = packageJson.version;
  await writeFile(cacheFileDist, JSON.stringify(cache));

  const stats = await webpack(options);
  const outputPath = stats.compilation.compiler.outputPath;
  const expected = path.resolve(__dirname, `fixtures/expected/${folderName}`);
  const compareResult = await dircompare.compare(outputPath, expected, compareOptions);
  const diffFiles = compareResult.diffSet.filter((diff) => diff.state !== 'equal');
  t.is(diffFiles[0], undefined);
});

