# Deploy Doctor — Build Plan (for Antigravity)

> Paste this whole file into Antigravity as project context, or feed it section by section.
> Goal: a working `zerops.yaml` analyzer/generator, deployed on Zerops, for The Zerops
> Challenge (Aug 8–9, 2026). Solo build, 48 hours.

## 0. Prompt to give Antigravity first

```
Build "Deploy Doctor": a web app where a user pastes a public GitHub repo URL and gets
back a generated zerops.yaml, a plain-English risk report, and a shareable results page.

Follow the plan in this file exactly:
- 3 services: web (Next.js), api (Node/Express), db (Postgres) — see Section 3.
- Use the data model in Section 5, the API contract in Section 6, and the zerops.yaml
  in Section 7 as-is unless there's a good reason to deviate.
- Work phase by phase (Section 9). After each phase, run it and confirm it works before
  moving to the next — do not batch multiple phases before testing.
- Deploy to Zerops after Phase 1 (a "Hello World" on all three services) before writing
  any real feature logic, so the deploy pipeline is proven early.
- Ask me before making any architecture change that isn't in this plan.
```

---

## 1. What we're building

Paste a GitHub repo URL → detect the stack → generate a correct `zerops.yaml` → flag
misconfigurations in plain English → save the analysis → show a shareable results page.

**Non-goals for MVP:** no auth/login, no private repo support, no CI integration. Keep
scope tight — a small thing that works beats a big thing that's half-broken.

**One-line pitch (for the demo):**
> "Paste any GitHub repo, get a working zerops.yaml, a risk report, and a live shareable
> link — in under a minute."

---

## 2. Definition of done (MVP)

- [ ] User can paste a public GitHub repo URL on the homepage.
- [ ] Backend fetches the repo tree and detects the stack (Node, Python, Go, static).
- [ ] A valid `zerops.yaml` is generated for that stack.
- [ ] A plain-English risk report is produced (rules + one LLM pass).
- [ ] The analysis is saved to Postgres and viewable at a shareable URL (`/a/:id`).
- [ ] User can copy/download the generated `zerops.yaml`.
- [ ] All three services (web, api, db) are deployed and live on Zerops.
- [ ] The live app survives a fresh reload from a logged-out browser.

**Stretch (only after all of the above is solid):**
- [ ] One-click deploy of the analyzed repo via the Zerops API.
- [ ] "Fix my failing deploy" mode: paste existing `zerops.yaml` + error log → get a fix.
- [ ] Paste a raw Dockerfile instead of a GitHub URL.

---

## 3. Architecture

```
PUBLIC INTERNET
      |
      v
+--------------------+        Next.js 15 (App Router)
|  deploydoctor-web   |        Zerops: nodejs@22
+--------------------+
      | HTTPS (public)
      v
+--------------------+        Node.js + Express
|  deploydoctor-api   |------> GitHub REST API (fetch repo files)
|  Zerops: nodejs@22  |------> LLM API (Claude) for risk report
+--------------------+
      | private network (internal DNS)
      v
+--------------------+        Postgres
|  deploydoctor-db    |        Zerops: postgresql@16
+--------------------+
```

Three services because: it mirrors real production architecture (judges look for this,
not a single container), the api↔db link over Zerops's private network is the clearest
"meaningful use of Zerops" story, and it's still small enough to wire up in under two
hours with an agent doing the scaffolding.

---

## 4. Tech stack

| Layer      | Choice                                   | Why |
|------------|-------------------------------------------|-----|
| Frontend   | Next.js 15 (App Router) + Tailwind        | Fast to scaffold, SSR for shareable results page |
| API        | Node.js + Express                         | One job: fetch → detect → generate → call LLM → persist |
| Database   | PostgreSQL 16 (Zerops managed)            | Stores analyses, gives a real private-network story |
| LLM        | Claude API (swap for whatever you have credentials for) | Reasoning layer only, on top of deterministic rules |
| Repo access| GitHub REST API, unauthenticated          | No OAuth needed for public repos |
| Deploy (stretch) | Zerops REST API                     | Only for the one-click-deploy stretch goal |

**Detection engine — rules first, LLM second.** Don't let the LLM guess the whole
config; that's slow and unreliable under demo pressure. A deterministic rules engine
identifies the stack from marker files; the LLM only writes the human-readable risk
report and resolves genuinely ambiguous cases (monorepos, multiple lockfiles).

| Signal in repo                  | Detected config |
|----------------------------------|------------------|
| `package.json` with `"next"` dep | `nodejs@22`, build: `npm run build`, start: `npm start` |
| `requirements.txt` / `pyproject.toml` | `python@3.12`, `pip install -r requirements.txt` |
| `go.mod`                         | `go@1.22`, `go build -o app` |
| `Dockerfile` present              | Flag: "consider a native Zerops runtime instead of Docker for faster builds" |
| No `package.json`, has `index.html` | `static`, `deployFiles: ./` |

---

## 5. Data model (Postgres)

```sql
CREATE TABLE analyses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_url       TEXT NOT NULL,
  repo_owner     TEXT,
  repo_name      TEXT,
  detected_stack TEXT,            -- e.g. 'nodejs@22', 'python@3.12'
  zerops_yaml    TEXT NOT NULL,   -- generated config, stored verbatim
  risk_report    JSONB NOT NULL,  -- [{ severity, title, explanation }]
  status         TEXT DEFAULT 'completed', -- pending | completed | failed
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_analyses_repo ON analyses (repo_owner, repo_name);

-- Stretch only
CREATE TABLE deployments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id        UUID REFERENCES analyses(id),
  zerops_project_id  TEXT,
  live_url           TEXT,
  deploy_status      TEXT DEFAULT 'pending', -- pending | success | failed
  created_at         TIMESTAMPTZ DEFAULT now()
);
```

---

## 6. API contract

| Method | Route              | Body                | What it does |
|--------|--------------------|----------------------|--------------|
| POST   | `/api/analyze`      | `{ repoUrl }`        | Fetch repo tree, run detection + LLM report, save, return full analysis |
| GET    | `/api/analyses/:id` | —                     | Return a saved analysis (shareable results page) |
| GET    | `/api/analyses`     | —                     | Recent analyses — nice for a live "activity feed" on the homepage |
| POST   | `/api/deploy/:id`   | `{ zeropsToken }`     | Stretch only — calls Zerops API to create/deploy from the generated config |

**Response shape for `/api/analyze` and `/api/analyses/:id`:**
```json
{
  "id": "uuid",
  "repoUrl": "https://github.com/owner/repo",
  "detectedStack": "nodejs@22",
  "zeropsYaml": "zerops:\n  - setup: app\n    ...",
  "riskReport": {
    "risks": [
      { "severity": "high", "title": "No port exposed", "explanation": "..." }
    ],
    "notes": "plain-English paragraph"
  },
  "createdAt": "2026-08-08T12:00:00Z"
}
```

---

## 7. `zerops.yaml` for Deploy Doctor itself

Use this to deploy the project. Let Antigravity generate and refine it, but verify it
matches this shape — you'll need to explain it to judges.

```yaml
zerops:
  - setup: web
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
      envVariables:
        API_URL: ${api_apiUrl}
      start: npm run start

  - setup: api
    build:
      base: nodejs@22
      buildCommands:
        - npm install
        - npm run build
      deployFiles: ./
    run:
      base: nodejs@22
      ports:
        - port: 4000
          httpSupport: true
      envVariables:
        DATABASE_URL: ${db_connectionString}
        LLM_API_KEY: ${LLM_API_KEY}
        GITHUB_TOKEN: ${GITHUB_TOKEN}
      start: npm run start:api

  - setup: db
    run:
      base: postgresql@16
```

---

## 8. LLM prompt (risk-report reasoning layer)

Keep the LLM's job narrow — it only writes the report, it does not invent the config.

```
SYSTEM:
You are a Zerops deployment reviewer. You will be given:
1. A detected stack (already determined by rules, do not re-guess it)
2. A file tree of the repository
3. A draft zerops.yaml

Return ONLY JSON in this shape:
{
  "risks": [
    { "severity": "high|medium|low", "title": "...", "explanation": "..." }
  ],
  "notes": "one short paragraph, plain English, for a developer seeing this for the first time"
}

Be specific and concrete. Reference actual file names you were given.
Do not include markdown fences or any text outside the JSON object.
```

Wrap the call in a try/catch with a 3–4s timeout and a rules-only fallback report, so a
slow or failed LLM call never breaks the demo.

---

## 9. Phased build plan (work through in order, test after each phase)

### Phase 0 — Setup (before/at kickoff)
- [ ] Create Zerops account, create a new project for Deploy Doctor.
- [ ] Init a monorepo: `/web`, `/api`, root `zerops.yaml`.
- [ ] Enable ZCP-equivalent flow / authorize Antigravity against the Zerops project.

### Phase 1 — Skeleton deploy (prove the pipeline first)
- [ ] Scaffold Next.js in `/web`, Express in `/api`.
- [ ] `/api` exposes `GET /health` returning `{ ok: true }`.
- [ ] `/web` renders a static homepage.
- [ ] Deploy all three services (web, api, db) using Section 7's `zerops.yaml`.
- [ ] Confirm all three are live and `web` can reach `api` over the network.
- [ ] **Stop and verify before continuing** — this is your riskiest step, get it working now.

### Phase 2 — Detection engine
- [ ] Implement GitHub repo fetch (file tree + key file contents) in `/api`.
- [ ] Implement the rules engine per the table in Section 4.
- [ ] Implement `zerops.yaml` generation from the detected stack.
- [ ] Test against 5–10 real public repos (Node, Python, Go, static, monorepo).

### Phase 3 — Persistence
- [ ] Wire Postgres using the schema in Section 5.
- [ ] `POST /api/analyze` saves the analysis; `GET /api/analyses/:id` retrieves it.
- [ ] `/web` results page at `/a/:id` renders the saved analysis.

### Phase 4 — LLM risk report
- [ ] Add the LLM call using the prompt in Section 8.
- [ ] Merge LLM output with rules-based findings into `riskReport`.
- [ ] Add the timeout + fallback so a failed LLM call degrades gracefully.

### Phase 5 — UI polish
- [ ] Homepage: URL input, loading state, error state (invalid/private repo).
- [ ] Results page: severity badges, plain-English notes, copy/download `zerops.yaml` button.
- [ ] Optional: recent-analyses feed on homepage using `GET /api/analyses`.

### Phase 6 — Redeploy and stability check
- [ ] Redeploy full app to Zerops.
- [ ] Test from a fresh, logged-out browser — not just your dev session.
- [ ] Fix any deploy-log errors by feeding the exact error back to Antigravity and iterating.

### Phase 7 — Stretch (only if Phases 1–6 are solid with time left)
- [ ] One-click deploy via Zerops API (`POST /api/deploy/:id`).
- [ ] "Fix my failing deploy" mode (paste yaml + error log → get a fix).
- [ ] Dockerfile-paste input as an alternative to a GitHub URL.

### Phase 8 — Demo and submission
- [ ] Record a 30–60s demo video: state the problem (0–10s) → paste a repo, show generated
      config + risk report live (10–40s) → show Deploy Doctor's own live URL (40–60s).
- [ ] Write the build post: project name, one-line description, video, live URL,
      how Zerops is used, tag @WeMakeDevs and @zeropsio.
- [ ] Fill submission form: repo link, live URL, demo/post link, disclose every AI tool used
      (Antigravity + the LLM used inside the product).
- [ ] Be ready to explain the architecture and every decision to judges.

---

## 10. Cut list (if behind schedule)

Drop in this order: (1) one-click deploy, (2) "fix my failing deploy" mode, (3) recent
analyses feed. A static "here's your zerops.yaml + here's why" output is still a
complete, demoable product on its own.

## 11. Fast facts

| | |
|---|---|
| Prize target | Main track — best overall project |
| Category fit | "Zerops tools" |
| Judged on | Idea, execution, how meaningfully Zerops is used |
| Hard requirements | Live URL, public (or judge-shared) source, stays up through judging |
| Team size | Solo only |