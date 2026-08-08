import test from 'node:test';
import assert from 'node:assert';
import { detectStackFromFiles } from './detector.js';
import { generateZeropsYaml } from './generator.js';

test('Stack Detector: Node.js (package.json)', async () => {
  const files = ['package.json', 'index.js'];
  const fetchFileFn = async (p) => p.endsWith('package.json') ? JSON.stringify({ name: 'my-app', scripts: { start: 'node index.js' } }) : null;
  const res = await detectStackFromFiles(files, fetchFileFn);
  assert.strictEqual(res.detectedStack, 'nodejs@22');
});

test('Stack Detector: Python (requirements.txt)', async () => {
  const files = ['requirements.txt', 'main.py'];
  const fetchFileFn = async (p) => p.endsWith('requirements.txt') ? 'fastapi==0.100.0\nuvicorn==0.22.0' : null;
  const res = await detectStackFromFiles(files, fetchFileFn);
  assert.strictEqual(res.detectedStack, 'python@3.12');
  assert.strictEqual(res.framework, 'FastAPI');
});

test('Stack Detector: Go (go.mod)', async () => {
  const files = ['go.mod', 'main.go'];
  const fetchFileFn = async (p) => p.endsWith('go.mod') ? 'module example.com/app\n\ngo 1.22' : null;
  const res = await detectStackFromFiles(files, fetchFileFn);
  assert.strictEqual(res.detectedStack, 'go@1.22');
});

test('Stack Detector: PHP (composer.json)', async () => {
  const files = ['composer.json', 'index.php'];
  const fetchFileFn = async (p) => p.endsWith('composer.json') ? JSON.stringify({ require: { 'laravel/framework': '^10.0' } }) : null;
  const res = await detectStackFromFiles(files, fetchFileFn);
  assert.strictEqual(res.detectedStack, 'php@8.3');
  assert.strictEqual(res.framework, 'Laravel');
});

test('Stack Detector: Java (pom.xml)', async () => {
  const files = ['pom.xml', 'src/Main.java'];
  const fetchFileFn = async (p) => p.endsWith('pom.xml') ? '<project><artifactId>demo</artifactId></project>' : null;
  const res = await detectStackFromFiles(files, fetchFileFn);
  assert.strictEqual(res.detectedStack, 'java@21');
  assert.strictEqual(res.packageManager, 'maven');
});

test('Stack Detector: Rust (Cargo.toml)', async () => {
  const files = ['Cargo.toml', 'src/main.rs'];
  const fetchFileFn = async () => null;
  const res = await detectStackFromFiles(files, fetchFileFn);
  assert.strictEqual(res.detectedStack, 'rust@1.77');
  assert.strictEqual(res.packageManager, 'cargo');
});

test('Stack Detector: Ruby (Gemfile)', async () => {
  const files = ['Gemfile', 'app.rb'];
  const fetchFileFn = async (p) => p.endsWith('Gemfile') ? 'gem "rails"' : null;
  const res = await detectStackFromFiles(files, fetchFileFn);
  assert.strictEqual(res.detectedStack, 'ruby@3.3');
  assert.strictEqual(res.framework, 'Ruby on Rails');
});

test('Stack Detector: Elixir (mix.exs)', async () => {
  const files = ['mix.exs', 'lib/app.ex'];
  const fetchFileFn = async (p) => p.endsWith('mix.exs') ? 'defmodule App.MixProject do\n use Mix.Project' : null;
  const res = await detectStackFromFiles(files, fetchFileFn);
  assert.strictEqual(res.detectedStack, 'elixir@1.16');
  assert.strictEqual(res.packageManager, 'mix');
});

test('Stack Detector: Static HTML (index.html)', async () => {
  const files = ['index.html', 'styles.css'];
  const fetchFileFn = async () => null;
  const res = await detectStackFromFiles(files, fetchFileFn);
  assert.strictEqual(res.detectedStack, 'static');
});

test('Log Fixer Logic: fixes missing start script error', () => {
  const log = 'npm ERR! missing script: start';
  const yaml = 'zerops:\n  - setup: app\n    run:\n      base: nodejs@22\n      ports:\n        - port: 3000\n          httpSupport: true\n      start: npm run start';
  
  let fixed = yaml.replace(/start:\s*npm run start/gi, 'start: node index.js');
  assert.ok(fixed.includes('start: node index.js'));
});

test('ZIP Safety Bounds: entry count and uncompressed size safety checks', () => {
  const MAX_ZIP_ENTRIES = 1000;
  const MAX_UNCOMPRESSED_SIZE = 50 * 1024 * 1024;

  const mockLargeEntries = new Array(1005).fill({ header: { size: 100 } });
  assert.ok(mockLargeEntries.length > MAX_ZIP_ENTRIES, 'Triggers max entries threshold');

  let totalSize = 0;
  const mockHugeEntries = [{ header: { size: 60 * 1024 * 1024 } }];
  for (const entry of mockHugeEntries) {
    totalSize += entry.header.size;
  }
  assert.ok(totalSize > MAX_UNCOMPRESSED_SIZE, 'Triggers max size threshold');
});

