import test from 'node:test';
import assert from 'node:assert';
import { parseGitHubUrl, detectStack } from './detector.js';
import { generateZeropsYaml } from './generator.js';

test('parseGitHubUrl should correctly extract owner and repo', () => {
  const result1 = parseGitHubUrl('https://github.com/expressjs/express');
  assert.deepStrictEqual(result1, { owner: 'expressjs', repo: 'express' });

  const result2 = parseGitHubUrl('https://github.com/vercel/next.js.git');
  assert.deepStrictEqual(result2, { owner: 'vercel', repo: 'next.js' });
});

test('detectStack should identify Node.js / Next.js', async () => {
  const mockRepo = {
    files: ['package.json', 'src/app/page.js'],
    fetchFile: async (path) => {
      if (path === 'package.json') {
        return JSON.stringify({
          dependencies: { next: '^15.0.0' },
          scripts: { build: 'next build', start: 'next start' }
        });
      }
      return null;
    }
  };

  const res = await detectStack(mockRepo);
  assert.strictEqual(res.detectedStack, 'nodejs@22');
  assert.strictEqual(res.framework, 'Next.js');
});

test('detectStack should identify Python', async () => {
  const mockRepo = {
    files: ['requirements.txt', 'app.py'],
    fetchFile: async (path) => {
      if (path === 'requirements.txt') {
        return 'flask==3.0.0\ngunicorn==21.2.0';
      }
      return null;
    }
  };

  const res = await detectStack(mockRepo);
  assert.strictEqual(res.detectedStack, 'python@3.12');
  assert.strictEqual(res.framework, 'Flask');
});

test('generateZeropsYaml should produce valid YAML structure for Next.js', () => {
  const yaml = generateZeropsYaml('nodejs@22', 'Next.js');
  assert.ok(yaml.includes('setup: app'));
  assert.ok(yaml.includes('base: nodejs@22'));
  assert.ok(yaml.includes('port: 3000'));
  assert.ok(yaml.includes('NODE_ENV: "production"'));
});

test('generateZeropsYaml should produce valid static YAML for React/Vite', () => {
  const yaml = generateZeropsYaml('nodejs@22', 'React (SPA)');
  assert.ok(yaml.includes('base: nodejs@22'));
  assert.ok(yaml.includes('base: static'));
  assert.ok(yaml.includes('port: 80'));
  assert.ok(yaml.includes('deployFiles: dist'));
});

test('generateZeropsYaml should produce valid YAML for Express', () => {
  const yaml = generateZeropsYaml('nodejs@22', 'Express');
  assert.ok(yaml.includes('base: nodejs@22'));
  assert.ok(yaml.includes('port: 3000'));
  assert.ok(yaml.includes('NODE_ENV: "production"'));
});

test('generateZeropsYaml should produce production YAML for Flask', () => {
  const yaml = generateZeropsYaml('python@3.12', 'Flask');
  assert.ok(yaml.includes('base: python@3.12'));
  assert.ok(yaml.includes('gunicorn'));
  assert.ok(yaml.includes('FLASK_ENV: "production"'));
});

test('generateZeropsYaml should produce production YAML for Django', () => {
  const yaml = generateZeropsYaml('python@3.12', 'Django');
  assert.ok(yaml.includes('base: python@3.12'));
  assert.ok(yaml.includes('collectstatic'));
  assert.ok(yaml.includes('gunicorn'));
});

test('generateZeropsYaml should produce production YAML for FastAPI', () => {
  const yaml = generateZeropsYaml('python@3.12', 'FastAPI');
  assert.ok(yaml.includes('base: python@3.12'));
  assert.ok(yaml.includes('uvicorn'));
});

test('detectStack should identify Go repositories (with go.mod or .go files)', async () => {
  const mockRepo1 = {
    files: ['src/go.mod', 'src/main.go'],
    fetchFile: async (path) => path === 'src/go.mod' ? 'module golang.org/x/go\n\ngo 1.22' : null
  };
  const res1 = await detectStack(mockRepo1);
  assert.strictEqual(res1.detectedStack, 'go@1.22');
  assert.strictEqual(res1.framework, 'Go');

  const yaml1 = generateZeropsYaml(res1.detectedStack, res1.framework, res1);
  assert.ok(yaml1.includes('base: go@1.22'));
  assert.ok(yaml1.includes('go build'));
  assert.ok(yaml1.includes('start: ./src/app'));

  const mockRepo2 = {
    files: ['src/main.go', 'src/go/ast/ast.go'],
    fetchFile: async () => null
  };
  const res2 = await detectStack(mockRepo2);
  assert.strictEqual(res2.detectedStack, 'go@1.22');
  assert.strictEqual(res2.framework, 'Go');
});

test('deployToZerops should throw error when ZEROPS_API_TOKEN is missing', async () => {
  const { deployToZerops } = await import('./zeropsApi.js');
  await assert.rejects(
    async () => {
      await deployToZerops('zerops:\n  - setup: app', null);
    },
    { message: /ZEROPS_API_TOKEN is missing/ }
  );
});
