const fs = require('fs/promises');
const path = require('path');
const { minify: minifyHtml } = require('html-minifier-terser');
const { minify: minifyJs } = require('terser');
const CleanCSS = require('clean-css');

const rootDir = path.resolve(__dirname, '..');
const outputDir = path.join(rootDir, 'public');

const staticFiles = [
  'index.html',
  'auth.html',
  'app-shell.css',
  'app-shell.js',
  'curriculum-data.js',
  'quiz-journey.js',
  'organic-chemistry_1.css',
  'organic-chemistry_1.js',
  'organic-material-studio.css',
  'organic-material-studio.html',
  'organic-material-studio.js',
  'organobot.css',
  'organobot.html',
  'organobot.js',
  'organochem-ai.js'
];

async function build() {
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  for (const relativePath of staticFiles) {
    const sourcePath = path.join(rootDir, relativePath);
    const outputPath = path.join(outputDir, relativePath);
    const contents = await fs.readFile(sourcePath, 'utf8');
    const transformed = await transformFile(relativePath, contents);
    await fs.writeFile(outputPath, transformed, 'utf8');
  }
}

async function transformFile(relativePath, contents) {
  if (relativePath.endsWith('.js')) {
    const result = await minifyJs(contents, {
      compress: {
        passes: 2,
        keep_infinity: true
      },
      mangle: true,
      format: {
        comments: false
      }
    });

    if (result.error || !result.code) {
      throw result.error || new Error(`Failed to minify ${relativePath}`);
    }

    return result.code;
  }

  if (relativePath.endsWith('.css')) {
    const result = new CleanCSS({
      level: 2
    }).minify(contents);

    if (result.errors.length) {
      throw new Error(`Failed to minify ${relativePath}: ${result.errors.join('; ')}`);
    }

    return result.styles;
  }

  if (relativePath.endsWith('.html')) {
    return minifyHtml(contents, {
      collapseBooleanAttributes: true,
      collapseWhitespace: true,
      keepClosingSlash: true,
      minifyCSS: true,
      minifyJS: true,
      removeComments: true,
      removeRedundantAttributes: true,
      useShortDoctype: true
    });
  }

  return contents;
}

build().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
