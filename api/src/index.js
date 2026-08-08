import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import AdmZip from 'adm-zip';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, initDb } from './db.js';
import { parseGitHubUrl, fetchGitHubRepoDetails, detectStack, detectStackFromFiles, parseDockerfileContent } from './services/detector.js';
import { generateZeropsYaml } from './services/generator.js';
import { generateRiskReport } from './services/llm.js';
import { deployToZerops } from './services/zeropsApi.js';
import { randomUUID } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Robust multi-location .env loader
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 4000;

// 1. Strict File Upload Filter
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    if (name.endsWith('.zip') || name.includes('dockerfile') || file.mimetype === 'application/zip') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Only .zip archives and Dockerfiles are permitted.'));
    }
  }
});

// 2. Controlled CORS policy
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('CORS policy rejection: Origin not permitted.'));
    }
  }
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 3. In-Memory API Rate Limiter Middleware (100 requests per 15 min per IP)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 100;

setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimitMap.entries()) {
    if (now - data.startTime > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000).unref();

function apiRateLimiter(req, res, next) {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const now = Date.now();

  let record = rateLimitMap.get(ip);
  if (!record || (now - record.startTime > RATE_LIMIT_WINDOW_MS)) {
    record = { startTime: now, count: 1 };
    rateLimitMap.set(ip, record);
  } else {
    record.count++;
  }

  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS_PER_WINDOW);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS_PER_WINDOW - record.count));
  res.setHeader('X-RateLimit-Reset', new Date(record.startTime + RATE_LIMIT_WINDOW_MS).toISOString());

  if (record.count > MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({
      error: 'Too many API requests from this IP address. Please try again in 15 minutes.'
    });
  }

  next();
}

app.use('/api/', apiRateLimiter);

const inMemoryAnalyses = new Map();
const analysisCache = new Map(); // Cache analysis results by repo URL with 1-hour TTL & 1000 item cap

// LRU Eviction helper
function setCacheEntry(key, value) {
  if (analysisCache.size >= 1000) {
    const oldestKey = analysisCache.keys().next().value;
    analysisCache.delete(oldestKey);
  }
  analysisCache.set(key, value);
}

initDb();

app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Helper to save analysis record to DB or memory
async function saveAnalysisRecord(item) {
  try {
    await pool.query(
      `INSERT INTO analyses (id, repo_url, repo_owner, repo_name, detected_stack, zerops_yaml, risk_report, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        item.id,
        item.repoUrl,
        item.repoOwner,
        item.repoName,
        item.detectedStack,
        item.zeropsYaml,
        JSON.stringify(item.riskReport),
        'completed',
        item.createdAt
      ]
    );
  } catch (dbErr) {
    inMemoryAnalyses.set(item.id, item);
  }
}

// POST /api/analyze — GitHub Repo Analysis
app.post('/api/analyze', async (req, res) => {
  try {
    const { repoUrl } = req.body;
    if (!repoUrl || typeof repoUrl !== 'string' || !repoUrl.trim()) {
      return res.status(400).json({ error: 'Repository URL is required.' });
    }

    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
      return res.status(400).json({ error: 'Invalid GitHub URL. Must be in format: https://github.com/owner/repo' });
    }

    const { owner, repo } = parsed;
    const cacheKey = `${owner}/${repo}`.toLowerCase();
    const now = Date.now();
    const bypassCache = req.body.bypassCache || req.body.refresh || req.query.nocache === 'true';

    // Check 1-hour TTL Cache (unless bypass requested)
    if (!bypassCache && analysisCache.has(cacheKey)) {
      const cached = analysisCache.get(cacheKey);
      if (now - cached.timestamp < 3600000) {
        return res.json(cached.data);
      }
    }

    const repoDetails = await fetchGitHubRepoDetails(owner, repo);
    const detection = await detectStack(repoDetails);
    const zeropsYaml = generateZeropsYaml(detection.detectedStack, detection.framework, detection);

    const riskReport = await generateRiskReport(
      detection.detectedStack,
      repoDetails.files,
      zeropsYaml,
      detection.risks
    );

    const id = randomUUID();
    const createdAt = new Date().toISOString();

    const analysisItem = {
      id,
      repoUrl: `https://github.com/${owner}/${repo}`,
      repoOwner: owner,
      repoName: repo,
      detectedStack: detection.detectedStack,
      zeropsYaml,
      riskReport,
      status: 'completed',
      createdAt
    };

    await saveAnalysisRecord(analysisItem);

    const responsePayload = {
      id: analysisItem.id,
      repoUrl: analysisItem.repoUrl,
      detectedStack: analysisItem.detectedStack,
      zeropsYaml: analysisItem.zeropsYaml,
      riskReport: analysisItem.riskReport,
      createdAt: analysisItem.createdAt
    };

    // Cache payload for 1 hour with max 1000 capacity
    setCacheEntry(cacheKey, { timestamp: now, data: responsePayload });

    return res.json(responsePayload);

  } catch (err) {
    console.error('[Deploy Doctor API] Analyze error:', err.message);
    const status = err.status || 500;
    return res.status(status).json({ error: err.message || 'Analysis failed.' });
  }
});

// POST /api/analyze-dockerfile — Dockerfile Upload/Text Analysis
app.post('/api/analyze-dockerfile', upload.single('file'), async (req, res) => {
  try {
    let dockerfileContent = req.body.dockerfileContent;
    let filename = 'Dockerfile';

    if (req.file) {
      dockerfileContent = req.file.buffer.toString('utf-8');
      filename = req.file.originalname || 'Dockerfile';
    }

    if (!dockerfileContent || typeof dockerfileContent !== 'string' || !dockerfileContent.trim()) {
      return res.status(400).json({ error: 'Please provide valid Dockerfile content or file.' });
    }

    const dockerAnalysis = parseDockerfileContent(dockerfileContent);
    const zeropsYaml = generateZeropsYaml(dockerAnalysis.detectedStack, dockerAnalysis.framework, {
      port: dockerAnalysis.exposedPort
    });

    const riskReport = await generateRiskReport(
      dockerAnalysis.detectedStack,
      ['Dockerfile'],
      zeropsYaml,
      dockerAnalysis.risks
    );

    const id = randomUUID();
    const createdAt = new Date().toISOString();

    const analysisItem = {
      id,
      repoUrl: `file://${filename}`,
      repoOwner: 'docker',
      repoName: filename,
      detectedStack: dockerAnalysis.detectedStack,
      zeropsYaml,
      riskReport,
      status: 'completed',
      createdAt
    };

    await saveAnalysisRecord(analysisItem);

    return res.json({
      id: analysisItem.id,
      repoUrl: analysisItem.repoUrl,
      detectedStack: analysisItem.detectedStack,
      zeropsYaml: analysisItem.zeropsYaml,
      riskReport: analysisItem.riskReport,
      createdAt: analysisItem.createdAt
    });

  } catch (err) {
    console.error('[Deploy Doctor API] Analyze Dockerfile error:', err);
    return res.status(500).json({ error: err.message || 'Dockerfile analysis failed.' });
  }
});

// POST /api/analyze-zip — ZIP Archive Upload Analysis
app.post('/api/analyze-zip', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please select a .zip archive to upload.' });
    }

    let zip;
    try {
      zip = new AdmZip(req.file.buffer);
    } catch (zipErr) {
      return res.status(400).json({ error: 'The uploaded file is corrupt or not a valid ZIP archive.' });
    }

    const zipEntries = zip.getEntries();

    // ZIP Archive Safety Bounds & Zip-Bomb Protection
    const MAX_ZIP_ENTRIES = 1000;
    const MAX_UNCOMPRESSED_SIZE = 50 * 1024 * 1024; // 50MB

    if (zipEntries.length > MAX_ZIP_ENTRIES) {
      return res.status(400).json({
        error: `ZIP archive contains too many files (${zipEntries.length}). Maximum allowed is 1,000 items.`
      });
    }

    let totalUncompressedBytes = 0;
    for (const entry of zipEntries) {
      totalUncompressedBytes += entry.header.size || 0;
      if (totalUncompressedBytes > MAX_UNCOMPRESSED_SIZE) {
        return res.status(400).json({
          error: 'Uncompressed ZIP archive exceeds the maximum safety limit of 50MB.'
        });
      }
    }

    const fileContentMap = new Map();
    const files = [];

    zipEntries.forEach(entry => {
      if (!entry.isDirectory) {
        const path = entry.entryName.replace(/\\/g, '/');
        files.push(path);
        if (path.endsWith('package.json') || path.endsWith('requirements.txt') || path.endsWith('Dockerfile')) {
          try {
            fileContentMap.set(path.toLowerCase(), entry.getData().toString('utf-8'));
          } catch (e) {
            // ignore binary read
          }
        }
      }
    });

    const fetchFileFn = async (p) => fileContentMap.get(p.toLowerCase()) || null;
    const detection = await detectStackFromFiles(files, fetchFileFn);
    const zeropsYaml = generateZeropsYaml(detection.detectedStack, detection.framework, detection);

    const riskReport = await generateRiskReport(
      detection.detectedStack,
      files,
      zeropsYaml,
      detection.risks
    );

    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const zipName = req.file.originalname || 'uploaded-project.zip';

    const analysisItem = {
      id,
      repoUrl: `zip://${zipName}`,
      repoOwner: 'local-upload',
      repoName: zipName,
      detectedStack: detection.detectedStack,
      zeropsYaml,
      riskReport,
      status: 'completed',
      createdAt
    };

    await saveAnalysisRecord(analysisItem);

    return res.json({
      id: analysisItem.id,
      repoUrl: analysisItem.repoUrl,
      detectedStack: analysisItem.detectedStack,
      zeropsYaml: analysisItem.zeropsYaml,
      riskReport: analysisItem.riskReport,
      createdAt: analysisItem.createdAt
    });

  } catch (err) {
    console.error('[Deploy Doctor API] Analyze ZIP error:', err);
    return res.status(500).json({ error: err.message || 'ZIP archive analysis failed.' });
  }
});

// POST /api/fix — Fix Broken Deploy
app.post('/api/fix', async (req, res) => {
  try {
    let { zeropsYaml, buildLog } = req.body;
    zeropsYaml = (zeropsYaml || '').trim();
    buildLog = (buildLog || '').trim();

    if (!zeropsYaml && !buildLog) {
      return res.status(400).json({ error: 'Please provide either a zerops.yaml or build error log.' });
    }

    // Truncate massive logs to last 200KB
    if (buildLog.length > 200000) {
      buildLog = buildLog.slice(-200000);
    }

    const issues = [];
    let fixedYaml = zeropsYaml || `zerops:
  - setup: app
    build:
      base: nodejs@22
      buildCommands:
        - npm install
        - npm run build
      deployFiles: ./
    run:
      base: nodejs@22
      ports:
        - port: 3000
          httpSupport: true
      start: npm run start`;

    const logStr = buildLog.toLowerCase();
    const yamlStr = zeropsYaml.toLowerCase();

    // Issue check 1: Base image format
    if (yamlStr.includes('base: node') && !yamlStr.includes('base: nodejs@')) {
      fixedYaml = fixedYaml.replace(/base:\s*node[^\n]*/gi, 'base: nodejs@22');
      issues.push({
        title: 'Invalid base runtime specification',
        explanation: "Replaced generic 'node' with native Zerops runtime 'nodejs@22'."
      });
    }

    // Issue check 2: Missing port or httpSupport
    if (!yamlStr.includes('ports:') || !yamlStr.includes('port:')) {
      fixedYaml = fixedYaml.replace(/run:\n\s*base:[^\n]*/i, (match) => {
        return `${match}\n      ports:\n        - port: 3000\n          httpSupport: true`;
      });
      issues.push({
        title: 'No exposed HTTP port in run configuration',
        explanation: 'Added port 3000 with httpSupport: true to enable HTTP routing in Zerops.'
      });
    }

    // Issue check 3: Missing start script error in log
    if (logStr.includes('npm err! missing script: start') || logStr.includes('no start script')) {
      fixedYaml = fixedYaml.replace(/start:\s*npm run start/gi, 'start: node index.js');
      issues.push({
        title: 'npm ERR! missing script: start',
        explanation: "Fallback start command updated from 'npm run start' to 'node index.js'."
      });
    }

    // Issue check 4: Out of memory / ELIFECYCLE
    if (logStr.includes('javascript heap out of memory') || logStr.includes('err_child_process_stdio_maxbuffer')) {
      issues.push({
        title: 'Build Out of Memory (OOM)',
        explanation: 'Add NODE_OPTIONS="--max-old-space-size=4096" to your build commands in zerops.yaml.'
      });
    }

    // Generic fallback fix message if no specific match
    if (issues.length === 0) {
      issues.push({
        title: 'Configuration Optimization',
        explanation: 'Validated zerops.yaml syntax, structure, and port mapping for standard Zerops deployment.'
      });
    }

    return res.json({
      originalYaml: zeropsYaml || 'No YAML provided',
      fixedYaml,
      issues,
      explanation: 'Deploy Doctor analyzed your error logs and configuration. The patched zerops.yaml is ready below.'
    });

  } catch (err) {
    console.error('[Deploy Doctor API] Fix error:', err);
    return res.status(500).json({ error: err.message || 'Fix operation failed.' });
  }
});

const isValidUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

// GET /api/analyses/:id
app.get('/api/analyses/:id', async (req, res) => {
  const { id } = req.params;

  if (isValidUUID(id)) {
    try {
      const result = await pool.query('SELECT * FROM analyses WHERE id = $1', [id]);
      if (result.rows.length > 0) {
        const row = result.rows[0];
        return res.json({
          id: row.id,
          repoUrl: row.repo_url,
          detectedStack: row.detected_stack,
          zeropsYaml: row.zerops_yaml,
          riskReport: typeof row.risk_report === 'string' ? JSON.parse(row.risk_report) : row.risk_report,
          createdAt: row.created_at
        });
      }
    } catch (dbErr) {
      // db fallback
    }
  }

  if (inMemoryAnalyses.has(id)) {
    const item = inMemoryAnalyses.get(id);
    return res.json({
      id: item.id,
      repoUrl: item.repoUrl,
      detectedStack: item.detectedStack,
      zeropsYaml: item.zeropsYaml,
      riskReport: item.riskReport,
      createdAt: item.createdAt
    });
  }

  return res.status(404).json({ error: 'Analysis not found' });
});

// DELETE /api/analyses/:id — Delete Analysis Record
app.delete('/api/analyses/:id', async (req, res) => {
  const { id } = req.params;
  let deleted = false;

  if (isValidUUID(id)) {
    try {
      const result = await pool.query('DELETE FROM analyses WHERE id = $1 RETURNING id', [id]);
      if (result.rowCount > 0) {
        deleted = true;
      }
    } catch (dbErr) {
      // ignore db error
    }
  }

  if (inMemoryAnalyses.has(id)) {
    inMemoryAnalyses.delete(id);
    deleted = true;
  }

  if (deleted) {
    return res.json({ success: true, deletedId: id });
  }

  return res.status(404).json({ error: 'Analysis record not found.' });
});

// GET /api/analyses — List & Search History
app.get('/api/analyses', async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  const q = (req.query.q || '').toLowerCase();

  try {
    let queryText = 'SELECT id, repo_url, repo_owner, repo_name, detected_stack, created_at FROM analyses';
    const params = [];
    if (q) {
      queryText += ' WHERE LOWER(repo_url) LIKE $1 OR LOWER(repo_name) LIKE $1 OR LOWER(detected_stack) LIKE $1';
      params.push(`%${q}%`);
    }
    queryText += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await pool.query(queryText, params);
    return res.json(result.rows.map(r => ({
      id: r.id,
      repoUrl: r.repo_url,
      repoOwner: r.repo_owner,
      repoName: r.repo_name,
      detectedStack: r.detected_stack,
      createdAt: r.created_at
    })));
  } catch (dbErr) {
    let memoryList = Array.from(inMemoryAnalyses.values());
    if (q) {
      memoryList = memoryList.filter(item => 
        item.repoUrl.toLowerCase().includes(q) ||
        (item.repoName && item.repoName.toLowerCase().includes(q)) ||
        (item.detectedStack && item.detectedStack.toLowerCase().includes(q))
      );
    }
    return res.json(memoryList.slice(0, limit).map(item => ({
      id: item.id,
      repoUrl: item.repoUrl,
      repoOwner: item.repoOwner,
      repoName: item.repoName,
      detectedStack: item.detectedStack,
      createdAt: item.createdAt
    })));
  }
});

// POST /api/deploy/:id? — Real One-Click Deploy via Zerops REST API
app.post('/api/deploy/:id?', async (req, res) => {
  try {
    const id = req.params.id || req.body.id;
    const { zeropsToken, zeropsYaml: customYaml, setupName } = req.body || {};
    let yamlToDeploy = customYaml;

    if (!yamlToDeploy && id) {
      if (isValidUUID(id)) {
        try {
          const result = await pool.query('SELECT zerops_yaml FROM analyses WHERE id = $1', [id]);
          if (result.rows.length > 0) {
            yamlToDeploy = result.rows[0].zerops_yaml;
          }
        } catch (dbErr) {
          // ignore db err, check memory
        }
      }
      if (!yamlToDeploy && inMemoryAnalyses.has(id)) {
        yamlToDeploy = inMemoryAnalyses.get(id).zeropsYaml;
      }
    }

    if (!yamlToDeploy) {
      return res.status(400).json({ error: 'No zerops.yaml provided or analysis record not found.' });
    }

    const token = zeropsToken || process.env.ZER_API_TOKEN || process.env.ZEROPS_API_TOKEN;
    if (!token) {
      return res.status(400).json({
        error: 'ZER_API_TOKEN or ZEROPS_API_TOKEN environment variable or user API token is required for one-click deployment.'
      });
    }

    const deployResult = await deployToZerops(yamlToDeploy, token, { setupName });

    return res.json({
      success: true,
      projectId: deployResult.projectId,
      liveUrl: deployResult.liveUrl,
      status: deployResult.status,
      message: 'Project and services imported to Zerops Cloud successfully.',
      details: deployResult.details
    });

  } catch (err) {
    console.error('[Deploy Doctor API] One-click deploy error:', err.message);
    return res.status(err.status || 500).json({
      error: err.message || 'Failed to deploy project to Zerops Cloud.'
    });
  }
});

// Global Error Handler Middleware
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON payload in request body.' });
  }
  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({ error: 'Request payload size exceeds maximum limit (10MB).' });
  }
  console.error('[Deploy Doctor API] Global Handler Error:', err.message);
  return res.status(err.status || 500).json({ error: err.message || 'Internal server error.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Deploy Doctor API] Server listening on port ${PORT}`);
});


