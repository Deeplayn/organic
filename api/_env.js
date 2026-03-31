const fs = require('fs');
const path = require('path');

let loaded = false;

function loadEnvFiles() {
  if (loaded) return;
  loaded = true;

  const rootDir = path.resolve(__dirname, '..');
  const files = [
    path.join(rootDir, '.env'),
    path.join(rootDir, '.env.local')
  ];

  for (const filePath of files) {
    if (!fs.existsSync(filePath)) continue;
    parseEnvFile(fs.readFileSync(filePath, 'utf8'));
  }
}

function parseEnvFile(contents) {
  for (const rawLine of String(contents || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (process.env[key] !== undefined) continue;

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFiles();

module.exports = {
  loadEnvFiles
};
