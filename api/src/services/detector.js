/**
 * Repository Analysis Engine for Deploy Doctor
 * Principal Software Architect Design:
 * Multi-pass, monorepo & subfolder service detection engine for Frameworks, Runtimes, 
 * Build Systems, Microservices, Databases, Storage, Queues, WebSockets, AI/ML, 
 * Image Processing, and Environment Variables.
 */

export function parseGitHubUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const cleanUrl = url.trim().replace(/\.git$/, '').replace(/\/$/, '');
  const match = cleanUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

export async function fetchGitHubRepoDetails(owner, repo, token = process.env.GITHUB_TOKEN) {
  const headers = {
    'User-Agent': 'DeployDoctor-App',
    'Accept': 'application/vnd.github.v3+json',
  };
  const cleanToken = token ? token.trim() : '';
  if (cleanToken && !cleanToken.includes('your_') && !cleanToken.startsWith('${')) {
    headers['Authorization'] = `token ${cleanToken}`;
  }

  // 1. Fetch repository metadata
  let repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (repoRes.status === 401 && headers['Authorization']) {
    delete headers['Authorization'];
    repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  }

  if (!repoRes.ok) {
    const err = new Error(
      repoRes.status === 404
        ? `Repository '${owner}/${repo}' not found or is private.`
        : repoRes.status === 403 || repoRes.status === 429
        ? `GitHub API rate limit exceeded (HTTP ${repoRes.status}). Please try again in a few minutes or provide a valid GITHUB_TOKEN.`
        : `GitHub API error: ${repoRes.status} ${repoRes.statusText}`
    );
    err.status = repoRes.status;
    throw err;
  }
  const repoData = await repoRes.json();
  const defaultBranch = repoData.default_branch || 'main';

  // 2. Fetch tree recursively with timeout & root contents fallback
  let files = [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    let treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, { 
      headers, 
      signal: controller.signal 
    });
    if (treeRes.status === 401 && headers['Authorization']) {
      delete headers['Authorization'];
      treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, { 
        headers, 
        signal: controller.signal 
      });
    }
    clearTimeout(timer);
    if (treeRes.ok) {
      const treeData = await treeRes.json();
      files = (treeData.tree || []).map(item => item.path);
    }
  } catch (e) {
    // Fallback to /contents/ for massive repositories
    try {
      let contentsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents`, { headers });
      if (contentsRes.status === 401 && headers['Authorization']) {
        delete headers['Authorization'];
        contentsRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents`, { headers });
      }
      if (contentsRes.ok) {
        const contentsData = await contentsRes.json();
        const rootItems = Array.isArray(contentsData) ? contentsData : [];
        files = rootItems.map(item => item.path);

        // Fetch contents of common subdirectories (src, cmd, app, api, pkg) to discover nested manifests/files
        const subdirsToFetch = rootItems.filter(item => item.type === 'dir' && ['src', 'cmd', 'app', 'api', 'pkg'].includes(item.name.toLowerCase()));
        for (const dir of subdirsToFetch) {
          try {
            const subRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${dir.path}`, { headers });
            if (subRes.ok) {
              const subData = await subRes.json();
              if (Array.isArray(subData)) {
                files.push(...subData.map(item => item.path));
              }
            }
          } catch (eSub) {}
        }
      }
    } catch (e2) {}
  }

  // Helper to fetch file content
  const fetchFile = async (path) => {
    try {
      const fileRes = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${path}`, { headers });
      if (fileRes.ok) return await fileRes.text();
    } catch (e) {
      // ignore
    }
    return null;
  };

  return { owner, repo, defaultBranch, files, fetchFile };
}

export function parseDockerfileContent(dockerfileContent) {
  if (!dockerfileContent || typeof dockerfileContent !== 'string') {
    return {
      detectedStack: 'nodejs@22',
      framework: 'Docker App',
      exposedPort: 3000,
      hasFileUploads: false,
      hasAiMl: false,
      hasImageProcessing: false,
      databases: [],
      hasStorageRequirements: false,
      hasQueue: false,
      hasWebSockets: false,
      extractedEnvVars: { publicVars: {}, secretVars: {} },
      risks: [{
        severity: 'high',
        title: 'Empty Dockerfile provided',
        explanation: 'Provided Dockerfile contains no content or instructions.'
      }]
    };
  }

  const lines = dockerfileContent.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  let detectedStack = 'nodejs@22';
  let framework = 'Docker Container';
  let exposedPort = 3000;
  const risks = [];

  risks.push({
    severity: 'medium',
    title: 'Dockerfile conversion to Zerops native runtime',
    explanation: 'Deploy Doctor automatically analyzed your Dockerfile and generated a lighter, faster native Zerops runtime configuration.'
  });

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper.startsWith('FROM')) {
      if (upper.includes('NODE')) {
        detectedStack = 'nodejs@22';
        framework = 'Node.js (from Dockerfile)';
      } else if (upper.includes('PYTHON') || upper.includes('CUDA') || upper.includes('UBUNTU')) {
        detectedStack = 'python@3.12';
        framework = 'Python (from Dockerfile)';
        exposedPort = 8000;
      } else if (upper.includes('GOLANG') || upper.includes('GO:')) {
        detectedStack = 'go@1.22';
        framework = 'Go (from Dockerfile)';
        exposedPort = 8080;
      } else if (upper.includes('NGINX') || upper.includes('ALPINE')) {
        detectedStack = 'static';
        framework = 'Static Site (from Dockerfile)';
        exposedPort = 80;
      }
    }
    if (upper.startsWith('EXPOSE')) {
      const match = line.match(/EXPOSE\s+(\d+)/i);
      if (match) exposedPort = parseInt(match[1], 10);
    }
  }

  return {
    detectedStack,
    framework,
    exposedPort,
    hasFileUploads: false,
    hasAiMl: false,
    hasImageProcessing: false,
    databases: [],
    hasStorageRequirements: false,
    hasQueue: false,
    hasWebSockets: false,
    extractedEnvVars: { publicVars: {}, secretVars: {} },
    risks,
    dockerfileContent
  };
}

export async function detectStack(repoDetails) {
  return await detectStackFromFiles(repoDetails.files, repoDetails.fetchFile);
}

export function isIgnoredPath(p) {
  if (!p || typeof p !== 'string') return true;
  const l = p.toLowerCase();
  return l.includes('/vendor/') || l.startsWith('vendor/') ||
         l.includes('/node_modules/') || l.startsWith('node_modules/') ||
         l.includes('/testdata/') || l.startsWith('testdata/') ||
         l.includes('/third_party/') || l.startsWith('third_party/') ||
         l.includes('/fixtures/') || l.startsWith('fixtures/') ||
         l.includes('/.git/') || l.startsWith('.git/');
}

export async function detectStackFromFiles(files, fetchFileFn) {
  files = files.filter(f => !isIgnoredPath(f));
  const fileSet = new Set(files.map(f => f.toLowerCase()));
  const risks = [];
  const services = [];

  // Master Flags Across Services
  let mainStack = 'static';
  let mainFramework = 'Static Website';
  let mainPackageManager = 'npm';
  let mainPort = 3000;

  let hasFileUploads = false;
  let hasAiMl = false;
  let hasImageProcessing = false;
  let databases = [];
  let hasStorageRequirements = false;
  let hasQueue = false;
  let queueSystem = null;
  let hasWebSockets = false;

  const publicEnvVars = {};
  const secretEnvVars = {};

  // Check Dockerfile presence
  const dockerfilePaths = files.filter(f => f.toLowerCase() === 'dockerfile' || f.toLowerCase().endsWith('/dockerfile'));
  if (dockerfilePaths.length > 0) {
    risks.push({
      severity: 'medium',
      title: 'Dockerfile detected in repository',
      explanation: 'Zerops native runtimes compile up to 3x faster and consume significantly less RAM than Docker containers.'
    });
  }

  // --- 1. SCAN NODE.JS MANIFESTS (package.json) ---
  const pkgPaths = files.filter(f => f.toLowerCase() === 'package.json' || f.toLowerCase().endsWith('/package.json'));
  for (const pkgPath of pkgPaths) {
    const content = await fetchFileFn(pkgPath);
    if (content) {
      try {
        const pkgData = JSON.parse(content);
        const deps = { ...(pkgData.dependencies || {}), ...(pkgData.devDependencies || {}) };
        
        let framework = 'Node.js';
        if (deps['next']) framework = 'Next.js';
        else if (deps['@remix-run/react'] || deps['remix']) framework = 'Remix';
        else if (deps['nuxt']) framework = 'Nuxt';
        else if (deps['@nestjs/core']) framework = 'NestJS';
        else if (deps['express']) framework = 'Express';
        else if (deps['fastify']) framework = 'Fastify';
        else if (deps['@sveltejs/kit']) framework = 'SvelteKit';
        else if (deps['astro']) framework = 'Astro';
        else if (deps['gatsby']) framework = 'Gatsby';
        else if (deps['react']) framework = 'React (SPA)';
        else if (deps['vue'] || deps['@vue/cli-service']) framework = 'Vue (SPA)';

        let version = 'nodejs@22';
        if (pkgData.engines && pkgData.engines.node) {
          const ne = pkgData.engines.node;
          if (ne.includes('20')) version = 'nodejs@20';
          else if (ne.includes('18')) version = 'nodejs@18';
        }

        let pkgManager = 'npm';
        if (fileSet.has('pnpm-lock.yaml')) pkgManager = 'pnpm';
        else if (fileSet.has('yarn.lock')) pkgManager = 'yarn';
        else if (fileSet.has('bun.lockb')) pkgManager = 'bun';

        const isSubfolder = pkgPath.includes('/');
        const serviceName = isSubfolder ? pkgPath.split('/')[0] : 'app';
        const port = framework === 'Next.js' || framework === 'Remix' || framework === 'SvelteKit' ? 3000 : 4000;

        if (deps['@imgly/background-removal'] || deps['sharp'] || deps['jimp'] || deps['canvas']) {
          hasImageProcessing = true;
          if (deps['@imgly/background-removal']) {
            hasAiMl = true;
          }
          risks.push({
            severity: 'low',
            title: 'Image Processing & Client/Server WASM Pipeline Detected',
            explanation: 'Applications processing images via `@imgly/background-removal` or `sharp` benefit from high-concurrency Node.js execution.'
          });
        }

        if (deps['pg'] || deps['pg-pool'] || deps['@prisma/client'] || deps['drizzle-orm']) databases.push('postgresql');
        if (deps['mysql2'] || deps['mysql'] || deps['typeorm'] || deps['sequelize']) databases.push('mysql');
        if (deps['mongoose'] || deps['mongodb']) databases.push('mongodb');
        if (deps['ioredis'] || deps['redis']) databases.push('redis');
        if (deps['sqlite3'] || deps['better-sqlite3'] || deps['sqlite']) {
          databases.push('sqlite');
          hasStorageRequirements = true;
        }

        if (deps['multer'] || deps['formidable'] || deps['busboy'] || deps['express-fileupload'] || deps['uploadthing']) {
          hasFileUploads = true;
          hasStorageRequirements = true;
        }

        if (deps['@google/genai'] || deps['@google/generative-ai'] || deps['openai'] || deps['@langchain/core'] || deps['langchain'] || deps['@anthropic-ai/sdk']) {
          hasAiMl = true;
          secretEnvVars['GEMINI_API_KEY'] = 'YOUR_GEMINI_API_KEY';
        }

        services.push({
          name: serviceName,
          type: 'nodejs',
          stack: version,
          framework,
          packageManager: pkgManager,
          port,
          path: isSubfolder ? pkgPath.replace('/package.json', '') : './',
          scripts: pkgData.scripts || {}
        });

        if (!isSubfolder || services.length === 1) {
          mainStack = version;
          mainFramework = framework;
          mainPackageManager = pkgManager;
          mainPort = port;
        }

      } catch (e) {
        // invalid JSON
      }
    }
  }

  // --- 2. SCAN PYTHON MANIFESTS (requirements.txt, pyproject.toml, Pipfile) ---
  const pyPaths = files.filter(f => 
    f.toLowerCase() === 'requirements.txt' || f.toLowerCase().endsWith('/requirements.txt') ||
    f.toLowerCase() === 'pyproject.toml' || f.toLowerCase().endsWith('/pyproject.toml')
  );

  for (const pyPath of pyPaths) {
    const reqContent = (await fetchFileFn(pyPath) || '').toLowerCase();
    if (reqContent) {
      let pyFramework = 'Python App';
      if (reqContent.includes('fastapi')) pyFramework = 'FastAPI';
      else if (reqContent.includes('django')) pyFramework = 'Django';
      else if (reqContent.includes('flask')) pyFramework = 'Flask';
      else if (reqContent.includes('streamlit')) pyFramework = 'Streamlit';

      const isSubfolder = pyPath.includes('/');
      const serviceName = isSubfolder ? pyPath.split('/')[0] : 'api';

      if (reqContent.includes('torch') || reqContent.includes('transformers') || reqContent.includes('huggingface') || reqContent.includes('google-generativeai') || reqContent.includes('openai') || reqContent.includes('langchain')) {
        hasAiMl = true;
        secretEnvVars['RMBG_MODEL_ID'] = 'briaai/RMBG-2.0';
        risks.push({
          severity: 'high',
          title: 'PyTorch / Hugging Face Deep Learning AI Microservice Detected',
          explanation: 'AI microservice requires high RAM/CPU resources or GPU acceleration in Zerops.'
        });
      }

      if (reqContent.includes('pillow') || reqContent.includes('pil') || reqContent.includes('opencv') || reqContent.includes('python-multipart')) {
        hasImageProcessing = true;
        hasFileUploads = true;
      }

      if (reqContent.includes('psycopg') || reqContent.includes('asyncpg')) databases.push('postgresql');
      if (reqContent.includes('pymysql') || reqContent.includes('aiomysql')) databases.push('mysql');
      if (reqContent.includes('redis')) databases.push('redis');

      if (reqContent.includes('celery') || reqContent.includes('rq')) {
        hasQueue = true;
        queueSystem = 'Celery';
        if (!databases.includes('redis')) databases.push('redis');
      }

      services.push({
        name: serviceName,
        type: 'python',
        stack: 'python@3.12',
        framework: pyFramework,
        packageManager: pyPath.includes('pyproject.toml') ? 'poetry' : 'pip',
        port: 8000,
        path: isSubfolder ? pyPath.replace('/requirements.txt', '').replace('/pyproject.toml', '') : './',
        isBackendApi: true
      });

      if (services.length === 1) {
        mainStack = 'python@3.12';
        mainFramework = pyFramework;
        mainPort = 8000;
      }
    }
  }

  // --- 3. SCAN GO MANIFESTS (go.mod) & GO SOURCE FILES (.go) ---
  const goPaths = files.filter(f => f.toLowerCase() === 'go.mod' || f.toLowerCase().endsWith('/go.mod'));
  for (const goPath of goPaths) {
    const goContent = await fetchFileFn(goPath);
    if (goContent) {
      let goFramework = 'Go';
      if (goContent.includes('github.com/gin-gonic/gin')) goFramework = 'Gin';
      else if (goContent.includes('github.com/gofiber/fiber')) goFramework = 'Fiber';
      else if (goContent.includes('github.com/labstack/echo')) goFramework = 'Echo';

      const isSubfolder = goPath.includes('/');
      const serviceName = isSubfolder ? goPath.split('/')[0] : 'api';

      services.push({
        name: serviceName,
        type: 'go',
        stack: 'go@1.22',
        framework: goFramework,
        packageManager: 'go',
        port: 8080,
        path: isSubfolder ? goPath.replace('/go.mod', '') : './'
      });

      if (services.length === 1) {
        mainStack = 'go@1.22';
        mainFramework = goFramework;
        mainPackageManager = 'go';
        mainPort = 8080;
      }
    }
  }

  // Fallback: If no go.mod found, check for .go source files or Go project structure
  if (services.filter(s => s.type === 'go').length === 0) {
    const goFiles = files.filter(f => f.toLowerCase().endsWith('.go'));
    if (goFiles.length > 0) {
      const mainGo = goFiles.find(f => f.toLowerCase() === 'main.go' || f.toLowerCase().endsWith('/main.go')) || goFiles[0];
      const isSubfolder = mainGo.includes('/');
      const serviceName = isSubfolder ? mainGo.split('/')[0] : 'app';

      services.push({
        name: serviceName,
        type: 'go',
        stack: 'go@1.22',
        framework: 'Go',
        packageManager: 'go',
        port: 8080,
        path: isSubfolder ? mainGo.substring(0, mainGo.lastIndexOf('/')) : './'
      });

      if (services.length === 1) {
        mainStack = 'go@1.22';
        mainFramework = 'Go';
        mainPackageManager = 'go';
        mainPort = 8080;
      }
    }
  }

  // --- 4. SCAN PHP MANIFESTS (composer.json) ---
  const phpPaths = files.filter(f => f.toLowerCase() === 'composer.json' || f.toLowerCase().endsWith('/composer.json'));
  for (const phpPath of phpPaths) {
    const composerContent = await fetchFileFn(phpPath);
    if (composerContent) {
      try {
        const composerJson = JSON.parse(composerContent);
        const reqs = composerJson.require || {};
        let phpFramework = 'PHP';
        if (reqs['laravel/framework']) phpFramework = 'Laravel';
        else if (reqs['symfony/framework-bundle']) phpFramework = 'Symfony';

        let version = 'php@8.3';
        if (reqs.php) {
          if (reqs.php.includes('8.2')) version = 'php@8.2';
          else if (reqs.php.includes('8.1')) version = 'php@8.1';
        }

        const isSubfolder = phpPath.includes('/');
        const serviceName = isSubfolder ? phpPath.split('/')[0] : 'app';

        services.push({
          name: serviceName,
          type: 'php',
          stack: version,
          framework: phpFramework,
          packageManager: 'composer',
          port: 8000,
          path: isSubfolder ? phpPath.replace('/composer.json', '') : './'
        });

        if (services.length === 1) {
          mainStack = version;
          mainFramework = phpFramework;
          mainPackageManager = 'composer';
          mainPort = 8000;
        }
      } catch (e) {}
    }
  }

  // --- 5. SCAN JAVA MANIFESTS (pom.xml, build.gradle) ---
  const javaPaths = files.filter(f => 
    f.toLowerCase() === 'pom.xml' || f.toLowerCase().endsWith('/pom.xml') ||
    f.toLowerCase() === 'build.gradle' || f.toLowerCase().endsWith('/build.gradle')
  );
  for (const javaPath of javaPaths) {
    const isSubfolder = javaPath.includes('/');
    const serviceName = isSubfolder ? javaPath.split('/')[0] : 'app';
    const isPom = javaPath.toLowerCase().endsWith('pom.xml');
    
    services.push({
      name: serviceName,
      type: 'java',
      stack: 'java@21',
      framework: 'Java Spring Boot',
      packageManager: isPom ? 'maven' : 'gradle',
      port: 8080,
      path: isSubfolder ? javaPath.replace('/pom.xml', '').replace('/build.gradle', '') : './'
    });

    if (services.length === 1) {
      mainStack = 'java@21';
      mainFramework = 'Java Spring Boot';
      mainPackageManager = isPom ? 'maven' : 'gradle';
      mainPort = 8080;
    }
  }

  // --- 6. SCAN RUST MANIFESTS (Cargo.toml) ---
  const rustPaths = files.filter(f => f.toLowerCase() === 'cargo.toml' || f.toLowerCase().endsWith('/cargo.toml'));
  for (const rustPath of rustPaths) {
    const isSubfolder = rustPath.includes('/');
    const serviceName = isSubfolder ? rustPath.split('/')[0] : 'app';

    services.push({
      name: serviceName,
      type: 'rust',
      stack: 'rust@1.77',
      framework: 'Rust App',
      packageManager: 'cargo',
      port: 8080,
      path: isSubfolder ? rustPath.replace('/cargo.toml', '') : './'
    });

    if (services.length === 1) {
      mainStack = 'rust@1.77';
      mainFramework = 'Rust App';
      mainPackageManager = 'cargo';
      mainPort = 8080;
    }
  }

  // --- 7. SCAN RUBY MANIFESTS (Gemfile) ---
  const rubyPaths = files.filter(f => f.toLowerCase() === 'gemfile' || f.toLowerCase().endsWith('/gemfile'));
  for (const rubyPath of rubyPaths) {
    const gemContent = (await fetchFileFn(rubyPath) || '').toLowerCase();
    let rubyFramework = 'Ruby App';
    if (gemContent.includes('rails')) rubyFramework = 'Ruby on Rails';

    const isSubfolder = rubyPath.includes('/');
    const serviceName = isSubfolder ? rubyPath.split('/')[0] : 'app';

    services.push({
      name: serviceName,
      type: 'ruby',
      stack: 'ruby@3.3',
      framework: rubyFramework,
      packageManager: 'bundler',
      port: 3000,
      path: isSubfolder ? rubyPath.replace('/gemfile', '') : './'
    });

    if (services.length === 1) {
      mainStack = 'ruby@3.3';
      mainFramework = rubyFramework;
      mainPackageManager = 'bundler';
      mainPort = 3000;
    }
  }

  // --- 8. SCAN ELIXIR MANIFESTS (mix.exs) ---
  const elixirPaths = files.filter(f => f.toLowerCase() === 'mix.exs' || f.toLowerCase().endsWith('/mix.exs'));
  for (const elixirPath of elixirPaths) {
    const mixContent = (await fetchFileFn(elixirPath) || '').toLowerCase();
    let elixirFramework = 'Elixir App';
    if (mixContent.includes('phoenix')) elixirFramework = 'Phoenix';

    const isSubfolder = elixirPath.includes('/');
    const serviceName = isSubfolder ? elixirPath.split('/')[0] : 'app';

    services.push({
      name: serviceName,
      type: 'elixir',
      stack: 'elixir@1.16',
      framework: elixirFramework,
      packageManager: 'mix',
      port: 4000,
      path: isSubfolder ? elixirPath.replace('/mix.exs', '') : './'
    });

    if (services.length === 1) {
      mainStack = 'elixir@1.16';
      mainFramework = elixirFramework;
      mainPackageManager = 'mix';
      mainPort = 4000;
    }
  }

  // --- 9. SCAN STATIC SITE FALLBACK ---
  if (services.length === 0 && (fileSet.has('index.html') || fileSet.has('public/index.html'))) {
    services.push({
      name: 'app',
      type: 'static',
      stack: 'static',
      framework: 'Static Site',
      port: 80,
      path: './'
    });
    mainStack = 'static';
    mainFramework = 'Static Site';
    mainPort = 80;
  }

  // --- 10. ENVIRONMENT VARIABLES SCANNER ---
  const envExamplePaths = files.filter(f => {
    const l = f.toLowerCase();
    return l.endsWith('.env.example') || l.endsWith('.env.template') || l.endsWith('.env.sample');
  });

  for (const envPath of envExamplePaths) {
    const envContent = await fetchFileFn(envPath);
    if (envContent) {
      const lines = envContent.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, val] = trimmed.split('=').map(s => s.trim());
          const upperKey = key.toUpperCase();
          if (
            upperKey.includes('SECRET') || 
            upperKey.includes('KEY') || 
            upperKey.includes('TOKEN') || 
            upperKey.includes('PASSWORD') || 
            upperKey.includes('URL') || 
            upperKey.includes('DATABASE')
          ) {
            secretEnvVars[key] = val || 'CHANGE_ME';
          } else {
            publicEnvVars[key] = val || 'DEFAULT_VALUE';
          }
        }
      }
    }
  }

  // Inter-service endpoint linking environment variables
  if (services.length > 1) {
    const apiService = services.find(s => s.type === 'python' || s.type === 'go' || s.name === 'server' || s.name === 'api');
    if (apiService) {
      publicEnvVars['NEXT_PUBLIC_AI_SERVICE_URL'] = `http://${apiService.name}:8000/remove-bg`;
      publicEnvVars['AI_SERVICE_URL'] = `http://${apiService.name}:8000/remove-bg`;
    }
  }

  // Ensure mainStack and metadata are updated from primary service if services exist
  if (services.length > 0) {
    mainStack = services[0].stack || mainStack;
    mainFramework = services[0].framework || mainFramework;
    mainPackageManager = services[0].packageManager || mainPackageManager;
    mainPort = services[0].port || mainPort;
  }

  // Deduplicate databases
  databases = Array.from(new Set(databases));

  return {
    detectedStack: mainStack,
    framework: mainFramework,
    packageManager: mainPackageManager,
    exposedPort: mainPort,
    services,
    hasFileUploads,
    hasAiMl,
    hasImageProcessing,
    databases,
    hasStorageRequirements,
    hasQueue,
    queueSystem,
    hasWebSockets,
    extractedEnvVars: {
      publicVars: publicEnvVars,
      secretVars: secretEnvVars
    },
    risks
  };
}
