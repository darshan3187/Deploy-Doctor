/**
 * Zerops YAML Config Generator for Deploy Doctor
 * Repository-Aware Multi-Service & Production-Ready Specification Engine
 */

export function generateZeropsYaml(detectedStack, framework, options = {}) {
  const services = options.services && options.services.length > 0 ? options.services : null;

  // --- MULTI-SERVICE GENERATION ---
  if (services && services.length > 1) {
    let yamlBlocks = ['zerops:'];
    for (const service of services) {
      const setupName = service.name || 'app';
      const stackBase = service.stack || 'nodejs@22';
      const port = service.port || 3000;
      const subpath = service.path && service.path !== './' ? service.path : null;

      if (service.type === 'nodejs') {
        const isNext = service.framework === 'Next.js';
        const isReactVite = service.framework === 'React (SPA)' || service.framework === 'Vite' || service.framework === 'Vue (SPA)';
        
        if (isReactVite) {
          const installCmd = subpath ? `cd ${subpath} && npm ci` : 'npm ci';
          const buildCmd = subpath ? `cd ${subpath} && npm run build` : 'npm run build';
          const deployFiles = subpath ? `${subpath}/dist` : 'dist';

          yamlBlocks.push(`  - setup: ${setupName}
    build:
      base: ${stackBase}
      buildCommands:
        - ${installCmd}
        - ${buildCmd}
      deployFiles: ${deployFiles}
      cache: ${subpath ? `${subpath}/node_modules` : 'node_modules'}
    run:
      base: static
      ports:
        - port: 80
          httpSupport: true`);
        } else {
          const pkgMgr = service.packageManager || 'npm';
          const installCmd = subpath ? `cd ${subpath} && ${pkgMgr === 'pnpm' ? 'pnpm install --frozen-lockfile' : pkgMgr === 'yarn' ? 'yarn install --frozen-lockfile' : 'npm ci'}` : (pkgMgr === 'pnpm' ? 'pnpm install --frozen-lockfile' : pkgMgr === 'yarn' ? 'yarn install --frozen-lockfile' : 'npm ci');
          const buildCmd = subpath ? `cd ${subpath} && npm run build` : 'npm run build';
          const startCmd = subpath ? `cd ${subpath} && npm run start` : (isNext ? 'npm run start' : 'node index.js');
          const deployFiles = subpath ? `${subpath}/` : './';

          const envVars = {
            PORT: String(port),
            NODE_ENV: 'production',
            ...(options.extractedEnvVars?.publicVars || {})
          };

          const envLines = Object.keys(envVars).map(k => `        ${k}: "${envVars[k]}"`).join('\n');

          yamlBlocks.push(`  - setup: ${setupName}
    build:
      base: ${stackBase}
      buildCommands:
        - ${installCmd}
        - ${buildCmd}
      deployFiles: ${deployFiles}
      cache: ${subpath ? `${subpath}/node_modules` : 'node_modules'}
    run:
      base: ${stackBase}
      ports:
        - port: ${port}
          httpSupport: true
      envVariables:
${envLines}
      start: ${startCmd}`);
        }
      } else if (service.type === 'python') {
        const isFastApi = service.framework === 'FastAPI';
        const isDjango = service.framework === 'Django';
        const isFlask = service.framework === 'Flask';

        const installCmd = subpath ? `cd ${subpath} && pip install --no-cache-dir -r requirements.txt` : 'pip install --no-cache-dir -r requirements.txt';
        let buildCmds = [`- ${installCmd}`];
        if (isDjango) {
          const collectCmd = subpath ? `cd ${subpath} && python manage.py collectstatic --noinput` : 'python manage.py collectstatic --noinput';
          buildCmds.push(`- ${collectCmd}`);
        }

        let startCmd = 'python app.py';
        if (isFastApi) {
          startCmd = subpath ? `cd ${subpath} && uvicorn main:app --host 0.0.0.0 --port ${port} --workers 4` : `uvicorn main:app --host 0.0.0.0 --port ${port} --workers 4`;
        } else if (isDjango) {
          startCmd = subpath ? `cd ${subpath} && gunicorn app.wsgi:application --bind 0.0.0.0:${port} --workers 4 --threads 2` : `gunicorn app.wsgi:application --bind 0.0.0.0:${port} --workers 4 --threads 2`;
        } else if (isFlask) {
          startCmd = subpath ? `cd ${subpath} && gunicorn --bind 0.0.0.0:${port} --workers 4 --threads 2 app:app` : `gunicorn --bind 0.0.0.0:${port} --workers 4 --threads 2 app:app`;
        }

        const deployFiles = subpath ? `${subpath}/` : './';

        const envVars = {
          PORT: String(port),
          PYTHONUNBUFFERED: '1',
          PYTHONDONTWRITEBYTECODE: '1',
          ...(isFlask ? { FLASK_ENV: 'production' } : {}),
          ...(options.hasAiMl ? { RMBG_MODEL_ID: 'briaai/RMBG-2.0' } : {}),
          ...(options.extractedEnvVars?.secretVars || {})
        };

        const envLines = Object.keys(envVars).map(k => `        ${k}: "${envVars[k]}"`).join('\n');
        const mountsBlock = options.hasStorageRequirements ? '\n      mounts:\n        - path: /data\n        - path: /uploads' : '';

        yamlBlocks.push(`  - setup: ${setupName}
    build:
      base: ${stackBase}
      buildCommands:
${buildCmds.map(c => `        ${c}`).join('\n')}
      deployFiles: ${deployFiles}
      cache: ${subpath ? `${subpath}/.venv` : '.venv'}
    run:
      base: ${stackBase}
      ports:
        - port: ${port}
          httpSupport: true${mountsBlock}
      envVariables:
${envLines}
      start: ${startCmd}`);
      } else if (service.type === 'go') {
        const buildCmd = subpath ? `cd ${subpath} && go build -ldflags="-s -w" -o app .` : 'go build -ldflags="-s -w" -o app .';
        const startCmd = subpath ? `./${subpath}/app` : './app';
        yamlBlocks.push(`  - setup: ${setupName}
    build:
      base: ${stackBase}
      buildCommands:
        - ${buildCmd}
      deployFiles: ./
    run:
      base: ${stackBase}
      ports:
        - port: ${port}
          httpSupport: true
      envVariables:
        PORT: "${port}"
        GIN_MODE: "release"
      start: ${startCmd}`);
      }
    }
    return yamlBlocks.join('\n\n');
  }

  // --- SINGLE SERVICE GENERATION ---
  const service = options.services && options.services.length === 1 ? options.services[0] : null;
  const setupName = options.setupName || (service ? service.name : 'app');
  const stackBase = detectedStack || (service ? service.stack : null) || 'nodejs@22';
  const subpath = service && service.path && service.path !== './' ? service.path : null;
  const pkgManager = options.packageManager || (service ? service.packageManager : 'npm');
  const hasStorage = options.hasStorageRequirements || options.hasFileUploads || (options.databases && options.databases.includes('sqlite'));
  const hasQueue = options.hasQueue;
  const extractedEnv = options.extractedEnvVars || { publicVars: {}, secretVars: {} };

  // Determine framework
  const fw = framework || (service ? service.framework : '');
  const isReactVite = fw === 'React (SPA)' || fw === 'Vite' || fw === 'Vue (SPA)';
  const isNext = fw === 'Next.js';
  const isExpress = fw === 'Express';
  const isFlask = fw === 'Flask';
  const isDjango = fw === 'Django';
  const isFastApi = fw === 'FastAPI';
  const isGo = stackBase.startsWith('go') || fw === 'Go' || fw === 'Gin' || fw === 'Fiber' || fw === 'Echo';

  // Determine port
  const port = options.port || options.exposedPort || (service ? service.port : null) || (
    isReactVite ? 80 :
    isGo ? 8080 :
    (isFlask || isDjango || isFastApi || stackBase.startsWith('python') || stackBase.startsWith('php') || stackBase.startsWith('rust')) ? 8000 : 
    3000
  );

  const envVars = {
    PORT: String(port),
    ...(options.hasAiMl ? { AI_STREAMING_ENABLED: 'true' } : {}),
    ...(extractedEnv.publicVars || {})
  };

  const renderEnvBlock = (indent = '      ') => {
    const keys = Object.keys(envVars);
    if (keys.length === 0) return `${indent}envVariables:\n${indent}  PORT: "${port}"`;
    return `${indent}envVariables:\n` + keys.map(k => `${indent}  ${k}: "${envVars[k]}"`).join('\n');
  };

  const renderMountsBlock = (indent = '      ') => {
    if (!hasStorage) return '';
    return `\n${indent}mounts:\n${indent}  - path: /data\n${indent}  - path: /uploads`;
  };

  // --- 1. REACT / VITE (Static Base Optimization) ---
  if (isReactVite || stackBase === 'static') {
    const ciCmd = pkgManager === 'pnpm' ? 'pnpm install --frozen-lockfile' : pkgManager === 'yarn' ? 'yarn install --frozen-lockfile' : pkgManager === 'bun' ? 'bun install' : 'npm ci';
    const buildCmd = pkgManager === 'pnpm' ? 'pnpm run build' : pkgManager === 'yarn' ? 'yarn build' : pkgManager === 'bun' ? 'bun run build' : 'npm run build';
    const installStep = subpath ? `cd ${subpath} && ${ciCmd}` : ciCmd;
    const buildStep = subpath ? `cd ${subpath} && ${buildCmd}` : buildCmd;
    const deployFilesPath = subpath ? `${subpath}/dist` : 'dist';

    return `zerops:
  - setup: ${setupName}
    build:
      base: nodejs@22
      buildCommands:
        - ${installStep}
        - ${buildStep}
      deployFiles: ${deployFilesPath}
      cache: ${subpath ? `${subpath}/node_modules` : 'node_modules'}
    run:
      base: static
      ports:
        - port: 80
          httpSupport: true`;
  }

  // --- 2. GO TEMPLATE ---
  if (isGo || stackBase.startsWith('go')) {
    const buildCmd = subpath ? `cd ${subpath} && go build -ldflags="-s -w" -o app .` : 'go build -ldflags="-s -w" -o app .';
    const startCmd = subpath ? `./${subpath}/app` : './app';

    envVars['GIN_MODE'] = 'release';

    return `zerops:
  - setup: ${setupName}
    build:
      base: ${stackBase}
      buildCommands:
        - ${buildCmd}
      deployFiles: ./
    run:
      base: ${stackBase}
      ports:
        - port: ${port}
          httpSupport: true${renderMountsBlock()}
${renderEnvBlock()}
      start: ${startCmd}`;
  }

  // --- 3. NODE.JS (NEXT.JS, EXPRESS, NESTJS, REMIX) ---
  if (stackBase.startsWith('nodejs')) {
    const installCmd = pkgManager === 'pnpm' ? 'pnpm install --frozen-lockfile' : pkgManager === 'yarn' ? 'yarn install --frozen-lockfile' : pkgManager === 'bun' ? 'bun install' : 'npm ci';
    const buildCmd = pkgManager === 'pnpm' ? 'pnpm run build' : pkgManager === 'yarn' ? 'yarn build' : pkgManager === 'bun' ? 'bun run build' : 'npm run build';
    const installStep = subpath ? `cd ${subpath} && ${installCmd}` : installCmd;
    const buildStep = subpath ? `cd ${subpath} && ${buildCmd}` : buildCmd;

    let deployFilesPath = './';
    let startCmd = 'node index.js';

    if (isNext) {
      deployFilesPath = subpath ? `${subpath}/` : './';
      startCmd = subpath ? `cd ${subpath} && npm run start` : 'npm run start';
    } else if (isExpress) {
      deployFilesPath = subpath ? `${subpath}/` : './';
      startCmd = subpath ? `cd ${subpath} && node src/index.js` : 'node index.js';
    } else if (fw === 'NestJS') {
      startCmd = subpath ? `cd ${subpath} && node dist/main.js` : 'node dist/main.js';
    } else if (fw === 'Remix') {
      startCmd = subpath ? `cd ${subpath} && npm run start` : 'npm run start';
    }

    envVars['NODE_ENV'] = 'production';

    let yaml = `zerops:
  - setup: ${setupName}
    build:
      base: ${stackBase}
      buildCommands:
        - ${installStep}
        - ${buildStep}
      deployFiles: ${deployFilesPath}
      cache: ${subpath ? `${subpath}/node_modules` : 'node_modules'}
    run:
      base: ${stackBase}
      ports:
        - port: ${port}
          httpSupport: true${renderMountsBlock()}
${renderEnvBlock()}
      start: ${startCmd}`;

    if (hasQueue) {
      yaml += `\n
  - setup: ${setupName}-worker
    build:
      base: ${stackBase}
      buildCommands:
        - ${installStep}
      deployFiles: ${deployFilesPath}
      cache: ${subpath ? `${subpath}/node_modules` : 'node_modules'}
    run:
      base: ${stackBase}
${renderEnvBlock()}
      start: node worker.js`;
    }

    return yaml;
  }

  // --- 4. PYTHON (FLASK, DJANGO, FASTAPI) ---
  if (stackBase.startsWith('python')) {
    const isPoetry = pkgManager === 'poetry';
    const installCmd = isPoetry ? 'poetry install' : 'pip install --no-cache-dir -r requirements.txt';
    const installStep = subpath ? `cd ${subpath} && ${installCmd}` : installCmd;

    let buildCommands = [`- ${installStep}`];
    let startCmd = 'python app.py';

    envVars['PYTHONUNBUFFERED'] = '1';
    envVars['PYTHONDONTWRITEBYTECODE'] = '1';

    if (isFastApi) {
      startCmd = subpath ? `cd ${subpath} && uvicorn main:app --host 0.0.0.0 --port ${port} --workers 4` : `uvicorn app:app --host 0.0.0.0 --port ${port}`;
    } else if (isDjango) {
      const collectStep = subpath ? `cd ${subpath} && python manage.py collectstatic --noinput` : 'python manage.py collectstatic --noinput';
      buildCommands.push(`- ${collectStep}`);
      startCmd = subpath ? `cd ${subpath} && gunicorn myproject.wsgi:application --bind 0.0.0.0:${port} --workers 4 --threads 2` : `gunicorn myproject.wsgi:application --bind 0.0.0.0:${port}`;
      envVars['DJANGO_SETTINGS_MODULE'] = 'myproject.settings';
    } else if (isFlask) {
      startCmd = subpath ? `cd ${subpath} && gunicorn --bind 0.0.0.0:${port} --workers 4 --threads 2 app:app` : `gunicorn --bind 0.0.0.0:${port} --workers 4 --threads 2 app:app`;
      envVars['FLASK_ENV'] = 'production';
    }

    const deployFilesPath = subpath ? `${subpath}/` : './';

    let yaml = `zerops:
  - setup: ${setupName}
    build:
      base: ${stackBase}
      buildCommands:
${buildCommands.map(c => `        ${c}`).join('\n')}
      deployFiles: ${deployFilesPath}
      cache: ${subpath ? `${subpath}/.venv` : '.venv'}
    run:
      base: ${stackBase}
      ports:
        - port: ${port}
          httpSupport: true${renderMountsBlock()}
${renderEnvBlock()}
      start: ${startCmd}`;

    return yaml;
  }

  // Fallbacks for Java, Rust, PHP, Ruby, Elixir
  if (stackBase.startsWith('java')) {
    const isMaven = pkgManager === 'maven';
    const buildCmd = isMaven ? './mvnw clean package' : './gradlew build';
    const startCmd = 'java -jar target/app.jar';

    let yaml = `zerops:
  - setup: ${setupName}
    build:
      base: ${stackBase}
      buildCommands:
        - ${buildCmd}
      deployFiles: ./
    run:
      base: ${stackBase}
      ports:
        - port: ${port}
          httpSupport: true${renderMountsBlock()}
${renderEnvBlock()}
      start: ${startCmd}`;

    return yaml;
  }

  if (stackBase.startsWith('rust')) {
    let yaml = `zerops:
  - setup: ${setupName}
    build:
      base: ${stackBase}
      buildCommands:
        - cargo build --release
      deployFiles: ./
    run:
      base: ${stackBase}
      ports:
        - port: ${port}
          httpSupport: true${renderMountsBlock()}
${renderEnvBlock()}
      start: ./target/release/app`;

    return yaml;
  }

  if (stackBase.startsWith('php')) {
    let yaml = `zerops:
  - setup: ${setupName}
    build:
      base: ${stackBase}
      buildCommands:
        - composer install --no-dev --optimize-autoloader
      deployFiles: ./
    run:
      base: ${stackBase}
      ports:
        - port: ${port}
          httpSupport: true${renderMountsBlock()}
${renderEnvBlock()}
      start: php artisan serve --host 0.0.0.0 --port ${port}`;

    return yaml;
  }

  if (stackBase.startsWith('ruby')) {
    let yaml = `zerops:
  - setup: ${setupName}
    build:
      base: ${stackBase}
      buildCommands:
        - bundle install
      deployFiles: ./
    run:
      base: ${stackBase}
      ports:
        - port: ${port}
          httpSupport: true${renderMountsBlock()}
${renderEnvBlock()}
      start: bundle exec rails server -b 0.0.0.0 -p ${port}`;

    return yaml;
  }

  if (stackBase.startsWith('elixir')) {
    let yaml = `zerops:
  - setup: ${setupName}
    build:
      base: ${stackBase}
      buildCommands:
        - mix deps.get
        - mix compile
      deployFiles: ./
    run:
      base: ${stackBase}
      ports:
        - port: ${port}
          httpSupport: true${renderMountsBlock()}
${renderEnvBlock()}
      start: mix phx.server`;

    return yaml;
  }

  return `zerops:
  - setup: ${setupName}
    build:
      base: static
      deployFiles: ./
    run:
      base: static
      ports:
        - port: 80
          httpSupport: true`;
}
