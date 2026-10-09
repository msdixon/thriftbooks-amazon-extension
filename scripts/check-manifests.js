#!/usr/bin/env node
// Guards against cross-browser background key mix-ups:
//  - manifest.json (Chrome/Arc/Edge MV3) must use service_worker and must NOT
//    have background.scripts ("requires manifest version of 2 or lower").
//  - manifest.firefox.json must use scripts and not service_worker.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const load = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const errors = [];

const chrome = load('manifest.json').background || {};
if (!chrome.service_worker) errors.push('manifest.json: background.service_worker is missing');
if ('scripts' in chrome) errors.push('manifest.json: background.scripts breaks Chrome/Arc MV3; use manifest.firefox.json');

const firefox = load('manifest.firefox.json').background || {};
if (!Array.isArray(firefox.scripts) || !firefox.scripts.length) errors.push('manifest.firefox.json: background.scripts is missing');
if ('service_worker' in firefox) errors.push('manifest.firefox.json: background.service_worker should not be set');

if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join('\n'));
  process.exit(1);
}
console.log('✓ manifests OK');
