const fs = require('fs');
const path = require('path');

let loaded = false;
const fileLoadedKeys = new Set();

function loadEnvFiles() {
  if (loaded) return;
  loaded = true;

  const rootDir = path.resolve(__dirname, '..');
  const files = [
    { path: path.join(rootDir, '.env'), allowFileOverride: false },
    { path: path.join(rootDir, '.env.local'), allowFileOverride: true }
  ];

  for (const file of files) {
    if (!fs.existsSync(file.path)) continue;
    parseEnvFile(fs.readFileSync(file.path, 'utf8'), file.allowFileOverride);
  }
}

function parseEnvFile(contents, allowFileOverride = false) {
  for (const rawLine of String(contents || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    const existingValue = process.env[key];
    const hasUsableExistingValue = existingValue !== undefined && String(existingValue).trim() !== '';
    const canOverrideEarlierFileValue = allowFileOverride && fileLoadedKeys.has(key);
    if (hasUsableExistingValue && !canOverrideEarlierFileValue) continue;

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
    fileLoadedKeys.add(key);
  }
}

loadEnvFiles();

module.exports = {
  loadEnvFiles
};
