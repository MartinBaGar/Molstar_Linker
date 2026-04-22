const fs   = require('fs');
const path = require('path');

const browser = process.argv[2]; // "chrome" or "firefox"
if (!browser || !['chrome', 'firefox'].includes(browser)) {
  console.error('Usage: node assemble.js chrome|firefox');
  process.exit(1);
}

const OUT = path.join('dist', browser); // dist/chrome or dist/firefox

// 1. Clean and recreate the output folder
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// 2. Copy compiled JS from dist/ (tsc output)
const COMPILED = [
  'background.js',
  'content.js',
  'sandbox.js',
  'viewer.js',
  'popup.js',
  'options.js',
];

for (const file of COMPILED) {
  fs.copyFileSync(path.join('dist', file), path.join(OUT, file));
}

// 3. Copy the right manifest
fs.copyFileSync(path.join(`manifests/`, `${browser}.json`), path.join(OUT, 'manifest.json'));

// 4. Copy static assets
const STATIC = [
  'viewer.html', 'sandbox.html', 'popup.html', 'popup.css',
  'options.html', 'options.css'
];
for (const file of STATIC) {
  fs.copyFileSync(path.join('public/', file), path.join(OUT, file));
}

// 5. Copy folders (icons, lib)
for (const folder of ['icons', 'lib']) {
  fs.cpSync(path.join('public', folder), path.join(OUT, folder), { recursive: true });
}

console.log(`✅  Built for ${browser} → ${OUT}/`);
