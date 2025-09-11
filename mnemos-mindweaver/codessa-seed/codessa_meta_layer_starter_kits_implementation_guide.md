# Codessa Meta Layer — Starter Kits & Implementation Guide

A practical, copy‑pasteable set of artifacts to stand up your **docs‑as‑code spine** and evolve into a **universal GitHub App** that scaffolds repos, drafts docs, opens PRs, enforces policy, and publishes with GitHub Pages. This canvas includes:

1) **Codessa Meta Starter (MkDocs + Pages)** — ready to commit.
2) **Codessa Meta App Starter (GitHub App, TypeScript)** — webhook server + scaffold API + OPA policy stub + Temporal worker placeholder.
3) **Step‑by‑step implementation instructions** for both.

---

## 1) Codessa Meta Starter (MkDocs + Pages)

**Repository layout**
```
codessa/
├─ docs/
│  └─ index.md
├─ .github/workflows/docs.yml
├─ mkdocs.yml
├─ requirements.txt
├─ CONTRIBUTING.md
├─ .pre-commit-config.yaml
├─ .gitignore
└─ README.md
```

**`README.md`**
```markdown
# Codessa Meta Layer — Starter Repo

This starter gives you a docs‑as‑code spine and CI to publish with MkDocs + GitHub Pages,
plus a `codessa.meta.yaml` (add later) that an agentic layer can read to automate repos, branches, CI, and docs.

## Quickstart
1. Install Python 3.11+ and `pip install -r requirements.txt`.
2. Local preview: `mkdocs serve`
3. Commit + push to `main` — GitHub Actions will build and publish to Pages.
```

**`requirements.txt`**
```txt
mkdocs
mkdocs-material
mkdocs-awesome-pages-plugin
mkdocs-mermaid2
mkdocs-glightbox
mkdocs-macros-plugin
mkdocs-git-revision-date-localized-plugin
mkdocs-static-i18n
mkdocs-redirects
```

**`mkdocs.yml`** (minimal, clean defaults)
```yaml
site_name: Codessa — Charter · Codex · Praxis
site_url: https://<your-org>.github.io/codessa
repo_url: https://github.com/<your-org>/codessa
theme:
  name: material
  features:
    - navigation.instant
    - navigation.sections
    - content.code.copy
    - search.suggest
    - search.highlight
    - toc.integrate
  palette:
    - scheme: slate
      primary: teal
      accent: pink
plugins:
  - search
  - awesome-pages
  - mermaid2
  - glightbox
  - macros
  - git-revision-date-localized:
      type: timeago
  - redirects
markdown_extensions:
  - admonition
  - footnotes
  - tables
  - toc:
      permalink: true
  - pymdownx.superfences
  - pymdownx.details
nav:
  - Home: index.md
```

**`docs/index.md`**
```markdown
---
title: Codessa Canon
summary: A living constitution of biosynthetic intelligence — Charter, Codex, Praxis, and City.
tags: [charter, codex, praxis, city]
---

# Codessa — Canon

Welcome to the living library of Codessa. This site is generated with MkDocs and published via GitHub Pages.
Edit Markdown in `docs/`, open a PR, and watch the canon evolve.
```

**`.github/workflows/docs.yml`**
```yaml
name: Build & Deploy Docs
on:
  push:
    branches: [main]
  workflow_dispatch:
jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install -r requirements.txt
      - run: mkdocs build --strict
      - uses: actions/upload-pages-artifact@v3
        with:
          path: 'site'
  deploy:
    needs: docs
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
    runs-on: ubuntu-latest
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

**`CONTRIBUTING.md`**
```markdown
# Contributing to Codessa

We treat philosophy like code: branch, propose, review, merge.

## Flow
- Create a feature branch (`draft/<topic>` or `vision/<idea>`)
- Write in `docs/` using Markdown
- Open a Pull Request and fill the checklist
- Two approvals encouraged: one human reviewer and one agent checker (CI)
- CI gates: links, spell/style, build

## PR Checklist
- [ ] Purpose & scope stated at top
- [ ] Navigation updated (mkdocs.yml or awesome-pages)
- [ ] Diagrams render (Mermaid/Glightbox if used)
- [ ] No broken links (CI will verify)
```

**`.pre-commit-config.yaml`**
```yaml
repos:
  - repo: https://github.com/codespell-project/codespell
    rev: v2.3.0
    hooks: [{ id: codespell }]
  - repo: https://github.com/igorshubovych/markdownlint-cli
    rev: v0.39.0
    hooks:
      - id: markdownlint
```

**`.gitignore`**
```gitignore
site/
.cache/
__pycache__/
*.log
node_modules/
```

---

## 2) Codessa Meta App Starter (GitHub App • TypeScript)

A lean, production‑friendly skeleton:

**Repository layout**
```
codessa-meta-app/
├─ app/
│  ├─ src/
│  │  ├─ server.ts
│  │  ├─ routes/index.ts
│  │  ├─ workflows/scaffold.ts
│  │  └─ policies/repo.rego
│  ├─ tsconfig.json
│  ├─ README.md
│  └─ .env.example
├─ package.json
├─ Dockerfile
└─ docker-compose.yml
```

**`package.json`**
```json
{
  "name": "codessa-meta-app",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx app/src/server.ts",
    "build": "tsc -p app/tsconfig.json",
    "start": "node dist/server.js",
    "format": "prettier --write .",
    "lint": "eslint ."
  },
  "dependencies": {
    "@octokit/app": "^14.0.0",
    "@octokit/webhooks": "^12.0.4",
    "@octokit/core": "^6.1.2",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "helmet": "^7.1.0",
    "pino": "^9.3.2",
    "pino-pretty": "^11.2.2",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.11.30",
    "eslint": "^9.10.0",
    "eslint-config-prettier": "^9.1.0",
    "prettier": "^3.3.3",
    "tsx": "^4.16.2",
    "typescript": "^5.5.4"
  }
}
```

**`app/.env.example`**
```env
# === GitHub App ===
APP_ID=
PRIVATE_KEY_BASE64=
WEBHOOK_SECRET=change-me

# === Server ===
PORT=3000
PUBLIC_URL=http://localhost:3000

# Optional: PAT for local testing (fallback)
GITHUB_TOKEN=
```

**`app/src/server.ts`**
```ts
import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import pino from 'pino';
import { Webhooks, EmitterWebhookEvent } from '@octokit/webhooks';
import { App as GitHubApp } from '@octokit/app';
import { routes } from './routes/index.js';

const log = pino({ transport: { target: 'pino-pretty' } });
const app = express();
app.use(helmet());
app.use(express.json({ limit: '2mb' }));

const APP_ID = process.env.APP_ID as string;
const PRIVATE_KEY_BASE64 = process.env.PRIVATE_KEY_BASE64 as string;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET as string;
if (!APP_ID || !PRIVATE_KEY_BASE64 || !WEBHOOK_SECRET) {
  log.error('Missing APP_ID/PRIVATE_KEY_BASE64/WEBHOOK_SECRET');
  process.exit(1);
}
const privateKey = Buffer.from(PRIVATE_KEY_BASE64, 'base64').toString('utf-8');
const ghApp = new GitHubApp({ appId: APP_ID, privateKey });

// Webhooks
const webhooks = new Webhooks({ secret: WEBHOOK_SECRET });
webhooks.onAny(async (event: EmitterWebhookEvent) => {
  log.info({ event: event.name, id: event.id }, 'webhook received');
  if (event.name === 'pull_request' && (event.payload as any).action === 'opened') {
    log.info('PR opened: (stub) run checks & policy');
  }
});
app.use('/webhooks', webhooks.middleware);

// Health & API
app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.use('/api', routes({ log, ghApp }));

const port = Number(process.env.PORT || 3000);
app.listen(port, () => log.info(`Codessa Meta App listening on http://localhost:${port}`));
```

**`app/src/routes/index.ts`**
```ts
import { Router } from 'express';
import type pino from 'pino';
import { App as GitHubApp } from '@octokit/app';
import { Octokit } from '@octokit/core';
import { scaffoldDocs } from '../workflows/scaffold.js';

export function routes({ log, ghApp }: { log: pino.Logger; ghApp: GitHubApp }) {
  const r = Router();

  r.post('/scaffold', async (req, res) => {
    const { owner, repo } = req.body || {};
    if (!owner || !repo) return res.status(400).json({ error: 'owner/repo required' });

    try {
      await scaffoldDocs({ log, ghApp, owner, repo });
      res.json({ ok: true });
    } catch (e: any) {
      log.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  return r;
}
```

**`app/src/workflows/scaffold.ts`**
```ts
import type pino from 'pino';
import { App as GitHubApp } from '@octokit/app';
import { Octokit } from '@octokit/core';

const files: Record<string, string> = {
  'README.md': '# Codessa — Docs-as-Code\n',
  'mkdocs.yml': 'site_name: Codessa\nplugins:\n  - search\n',
  'docs/index.md': '# Welcome to Codessa\\n',
  '.github/workflows/docs.yml': `name: Build & Deploy Docs
on:
  push:
    branches: [main]
  workflow_dispatch:
jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install mkdocs mkdocs-material
      - run: mkdocs build --strict
      - uses: actions/upload-pages-artifact@v3
        with: { path: 'site' }
  deploy:
    needs: docs
    permissions: { pages: write, id-token: write }
    environment: { name: github-pages }
    runs-on: ubuntu-latest
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
`
};

export async function scaffoldDocs({ log, ghApp, owner, repo }: { log: pino.Logger; ghApp: GitHubApp; owner: string; repo: string }) {
  // For local dev, you can set GITHUB_TOKEN to a PAT to bypass installation auth.
  const token = process.env.GITHUB_TOKEN;
  let client: any;

  if (token) {
    client = new Octokit({ auth: token });
  } else {
    // In production, resolve installation and use app auth
    const appOcto = new Octokit();
    const { data } = await appOcto.request('GET /repos/{owner}/{repo}/installation', { owner, repo });
    const installationId = (data as any).id as number;
    client = await ghApp.getInstallationOctokit(installationId);
  }

  for (const [path, content] of Object.entries(files)) {
    try {
      await client.request('PUT /repos/{owner}/{repo}/contents/{path}', {
        owner,
        repo,
        path,
        message: 'chore(scaffold): add initial docs structure',
        content: Buffer.from(content, 'utf-8').toString('base64')
      });
    } catch (e: any) {
      log.warn({ path, err: e.message }, 'skip if exists');
    }
  }
}
```

**`app/src/policies/repo.rego`** (OPA policy stub)
```rego
package codessa.policy

default allow = false

# Disallow edits to protected files unless PR has label "governance-approved"
deny[msg] {
  input.event == "pull_request"
  input.action == "opened"
  some i
  file := input.changed[i]
  re_match("^(mkdocs.yml|codessa.meta.yaml|.github/workflows/.*)$", file)
  not approved_label
  msg := sprintf("Protected file changed without governance approval: %s", [file])
}

approved_label {
  some l
  l := input.labels[_]
  l == "governance-approved"
}

allow {
  not deny[_]
}
```

**`app/tsconfig.json`**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Node",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

**`app/README.md`**
```markdown
# Codessa Meta App (Starter)

A minimal GitHub App skeleton that:
- Receives webhooks at `/webhooks`
- Exposes `/api/scaffold` to inject MkDocs + Pages CI into a repo
- Ships with an OPA policy stub for PR protection

## Quickstart
1) Create a GitHub App (Settings → Developer settings → GitHub Apps):
   - Webhook URL: `https://<your-ngrok-or-smee>/webhooks`
   - Permissions: Contents (Read & Write), Issues (Read & Write), Pull requests (Read & Write), Metadata (Read), Pages (Read & Write)
   - Generate a Private Key → base64 encode it and set `PRIVATE_KEY_BASE64`.
2) Copy `.env.example` → `.env` and fill `APP_ID`, `PRIVATE_KEY_BASE64`, `WEBHOOK_SECRET`, optional `GITHUB_TOKEN` for local.
3) Install dependencies: `npm i` (or `pnpm i`).
4) Run: `npm run dev`
5) Test scaffold:
```bash
curl -X POST http://localhost:3000/api/scaffold \
  -H 'Content-Type: application/json' \
  -d '{"owner":"YOUR_ORG","repo":"YOUR_REPO"}'
```
```

**`Dockerfile`**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN npm i -g pnpm && pnpm i || true
COPY app ./app
WORKDIR /app
RUN pnpm i || npm i
CMD ["pnpm","dev"]
```

**`docker-compose.yml`**
```yaml
version: '3.9'
services:
  app:
    build: .
    env_file: app/.env
    ports: ["3000:3000"]
  opa:
    image: openpolicyagent/opa:latest
    command: ["run", "--server", "/policies"]
    volumes:
      - ./app/src/policies:/policies:ro
    ports: ["8181:8181"]
```

---

## 3) Implementation Instructions (Step‑by‑Step)

### A) Stand up the Canon (MkDocs + Pages)
1. Create a new GitHub repo `codessa` under your org.
2. Copy the **Codessa Meta Starter** files above into the repo and commit to `main`.
3. In **Settings → Pages**, choose **Build and deployment → GitHub Actions**.
4. Push a change; your site publishes automatically. Local preview: `pip install -r requirements.txt && mkdocs serve`.

### B) Run the GitHub App Starter locally
1. Create a **GitHub App** (Developer settings → GitHub Apps):
   - Set Webhook URL to your tunnel (e.g., https://smee.io or ngrok) + `/webhooks`.
   - Permissions: Contents (RW), Pull requests (RW), Issues (RW), Pages (RW), Metadata (R).
   - Create a **Private Key**; base64‑encode it: `base64 -w0 your-app-private-key.pem`.
2. Clone `codessa-meta-app` and create `app/.env` from the example.
3. `npm i && npm run dev` (or `pnpm i && pnpm dev`).
4. **Install** your GitHub App into the org (select some repos or all).
5. Test the scaffold API:
```bash
curl -X POST http://localhost:3000/api/scaffold \
  -H 'Content-Type: application/json' \
  -d '{"owner":"YOUR_ORG","repo":"YOUR_REPO"}'
```
6. Open the target repo → verify `mkdocs.yml`, `docs/index.md`, and the Pages workflow were created. Push to `main` → site deploys.

> **Note:** For local dev, you can set `GITHUB_TOKEN` to a Personal Access Token to simplify testing. In production, the route already resolves installation auth and uses the App token.

### C) Next steps (turn skeleton → product)
- Add Actions for spell/style (codespell, vale), link check (lychee), and preview URLs in PR comments.
- Generate diagrams from text via a small diagram service (Mermaid) and attach to PRs.
- Implement policy evaluation: call OPA on PR events; block merges when `repo.rego` denies.
- Add **VS Code extension** with commands: *New Page*, *New Section*, *Open PR*, *Preview Site*, *Generate Diagram*.
- Wrap it all in a small web console for org settings and run history.

---

## 4) Optional: `codessa.meta.yaml` (org contract)
Add a single source of truth for your agents:
```yaml
version: 0.1
org:
  name: codessa
  default_branch: main
  protection:
    required_reviews: 2
    require_status_checks: true
    require_signed_commits: true
docs:
  generator: mkdocs
  theme: material
  nav_source: mkdocs.yml
automation:
  workflows:
    - name: docs-build
      path: .github/workflows/docs.yml
policy:
  protected_files:
    - mkdocs.yml
    - .github/workflows/.*
```

---

## 5) What this unlocks
- One issue command → **new repo**, scaffolded docs, CI, and published site.
- Consistent **policy guardrails** with readable rules.
- A path to **marketplace‑ready** GitHub App + IDE extension, while keeping an open core.

> When you’re ready, I can extend this with a VS Code extension skeleton and PR bot that posts previews, style checks, and concept maps. Copy these files straight from the canvas to your repos and you’re off to the races.



---

## 6) VS Code Extension Skeleton (TypeScript)

**Folder layout**
```
codessa-vscode/
├─ package.json
├─ tsconfig.json
├─ README.md
├─ src/
│  └─ extension.ts
├─ media/
│  └─ icon.png (optional)
├─ .vscodeignore
└─ .eslintrc.json (optional)
```

**`package.json`**
```json
{
  "name": "codessa-vscode",
  "displayName": "Codessa — Docs & Doctrine",
  "description": "Create pages, sections, diagrams, PRs, and previews for Codessa-style docs-as-code.",
  "version": "0.0.1",
  "publisher": "your-publisher",
  "engines": { "vscode": ">=1.90.0" },
  "categories": ["Other"],
  "activationEvents": [
    "onCommand:codessa.newPage",
    "onCommand:codessa.newSection",
    "onCommand:codessa.preview",
    "onCommand:codessa.diagramFromText",
    "onCommand:codessa.openPR"
  ],
  "contributes": {
    "commands": [
      { "command": "codessa.newPage", "title": "Codessa: New Page" },
      { "command": "codessa.newSection", "title": "Codessa: New Section" },
      { "command": "codessa.preview", "title": "Codessa: Preview (MkDocs)" },
      { "command": "codessa.diagramFromText", "title": "Codessa: Insert Mermaid Diagram" },
      { "command": "codessa.openPR", "title": "Codessa: Open Pull Request" }
    ]
  },
  "scripts": {
    "compile": "tsc -p .",
    "watch": "tsc -watch -p .",
    "package": "vsce package"
  },
  "devDependencies": {
    "@types/node": "^20.11.30",
    "@types/vscode": "^1.90.0",
    "typescript": "^5.5.4",
    "vsce": "^3.0.0"
  }
}
```

**`tsconfig.json`**
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "outDir": "out",
    "lib": ["ES2022"],
    "sourceMap": true,
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src"]
}
```

**`.vscodeignore`**
```
**/.git
**/.github
**/.vscode
**/node_modules/**
**/out/test/**
**/*.map
```

**`src/extension.ts`**
```ts
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
const sh = promisify(exec);

async function ensureDocsFolder(workspace: vscode.WorkspaceFolder) {
  const docsUri = vscode.Uri.joinPath(workspace.uri, 'docs');
  try { await vscode.workspace.fs.stat(docsUri); } catch { await vscode.workspace.fs.createDirectory(docsUri); }
  return docsUri;
}

export function activate(context: vscode.ExtensionContext) {
  const getWs = () => vscode.workspace.workspaceFolders?.[0];

  context.subscriptions.push(vscode.commands.registerCommand('codessa.newPage', async () => {
    const ws = getWs(); if (!ws) return vscode.window.showErrorMessage('Open a Codessa repo first.');
    const docs = await ensureDocsFolder(ws);
    const name = await vscode.window.showInputBox({ prompt: 'New page file name (e.g., city/vision.md)' });
    if (!name) return;
    const file = vscode.Uri.joinPath(docs, name);
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(file, '..'));
    const tpl = `---
title: ${name.replace(/\..+$/, '')}
---

# ${name.split('/').pop()?.replace(/\..+$/, '')}

Write your page here.
`;
    await vscode.workspace.fs.writeFile(file, Buffer.from(tpl));
    const doc = await vscode.workspace.openTextDocument(file);
    vscode.window.showTextDocument(doc);
  }));

  context.subscriptions.push(vscode.commands.registerCommand('codessa.newSection', async () => {
    const ws = getWs(); if (!ws) return vscode.window.showErrorMessage('Open a Codessa repo first.');
    const docs = await ensureDocsFolder(ws);
    const name = await vscode.window.showInputBox({ prompt: 'New section directory (e.g., praxis/institutions)' });
    if (!name) return;
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(docs, name));
    vscode.window.showInformationMessage(`Created docs/${name}`);
  }));

  context.subscriptions.push(vscode.commands.registerCommand('codessa.preview', async () => {
    const ws = getWs(); if (!ws) return vscode.window.showErrorMessage('Open a Codessa repo first.');
    const term = vscode.window.createTerminal({ name: 'Codessa Preview' });
    term.show(true);
    term.sendText('pip install -r requirements.txt || true');
    term.sendText('mkdocs serve');
  }));

  context.subscriptions.push(vscode.commands.registerCommand('codessa.diagramFromText', async () => {
    const editor = vscode.window.activeTextEditor; if (!editor) return;
    const input = await vscode.window.showInputBox({ prompt: 'Mermaid diagram body (e.g., flowchart TD; A-->B)' });
    if (!input) return;
    const snippet = new vscode.SnippetString(['```mermaid', input, '```', ''].join('
'));
    editor.insertSnippet(snippet);
  }));

  context.subscriptions.push(vscode.commands.registerCommand('codessa.openPR', async () => {
    const ws = getWs(); if (!ws) return vscode.window.showErrorMessage('Open a Git repo first.');
    const term = vscode.window.createTerminal({ name: 'Codessa PR' });
    term.show(true);
    term.sendText('git add -A');
    term.sendText('git commit -m "docs: update" || echo "No changes"');
    term.sendText('git push -u origin HEAD');
    // If GitHub CLI is available, open PR interactively
    term.sendText('gh pr create --fill || echo "Install GitHub CLI (gh) for PR creation"');
  }));
}

export function deactivate() {}
```

**Build & run**
```
# from codessa-vscode/
npm i
npm run compile
# Press F5 in VS Code to launch an Extension Development Host
```

> Optional polish: add a tree view for `docs/`, quick picks for common page templates, and a status bar item showing MkDocs preview status.

---

## 7) PR Preview Bot (GitHub Actions)
Deploys a **live preview** of MkDocs for every Pull Request at:
```
https://<org>.github.io/<repo>/previews/pr-<number>/
```

**`.github/workflows/pr-preview.yml`**
```yaml
name: PR Docs Preview
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  build-preview:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pages: write
      id-token: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - name: Install deps
        run: pip install -r requirements.txt || pip install mkdocs mkdocs-material
      - name: Build site
        run: mkdocs build --strict
      - name: Prepare preview dir
        run: |
          mkdir -p preview
          mv site preview
          echo "PR=${{ github.event.number }}" >> $GITHUB_ENV
      - name: Deploy to gh-pages (under previews/pr-<n>)
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./preview/site
          publish_branch: gh-pages
          destination_dir: previews/pr-${{ env.PR }}
          keep_files: true
      - name: Comment preview URL
        uses: actions/github-script@v7
        with:
          script: |
            const pr = context.payload.number;
            const owner = context.repo.owner;
            const repo = context.repo.repo;
            const url = `https://${owner}.github.io/${repo}/previews/pr-${pr}/`;
            const body = `✅ **Preview ready**: ${url}`;
            await github.rest.issues.createComment({ owner, repo, issue_number: pr, body });
```

**`.github/workflows/pr-preview-cleanup.yml`** (optional)
```yaml
name: Cleanup PR Preview
on:
  pull_request:
    types: [closed]

jobs:
  cleanup:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Checkout gh-pages
        uses: actions/checkout@v4
        with:
          ref: gh-pages
      - name: Remove preview dir
        run: |
          PR=${{ github.event.number }}
          rm -rf previews/pr-${PR}
      - name: Push changes
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add -A && git commit -m "chore: cleanup preview for PR #${{ github.event.number }}" || echo "No changes"
          git push
```

**Enable GitHub Pages** for the repo (Settings → Pages → Build from GitHub Actions). The `pr-preview.yml` job writes into the `gh-pages` branch inside `previews/pr-<n>/`, which GitHub Pages serves.

---

## 8) Optional niceties
- **Lychee link checker** and **codespell/vale** workflows to comment problems inline.
- **Giscus** for page comments (Docs → Discussions bridge).
- **Algolia DocSearch** for lightning-fast search.
- **mike** for editioned releases (e.g., `/v1/`, `/v2/`).

---

## 9) Quick test plan
1) Add the two workflows to your docs repo.
2) Open a PR that changes any Markdown file.
3) Wait for CI → the bot comments a live preview URL.
4) Merge → your main Pages site updates via your existing `docs.yml` workflow.

---

With these two pieces—the VS Code extension skeleton and the PR Preview bot—you’ve got a silky loop: **write → preview → discuss → merge → publish**. Copy the blocks into your repos and you’re rolling.



---

## 10) Docusaurus Adapter (Docs + GitHub Pages)

**Intent**: Allow `docs.generator: docusaurus` in `codessa.meta.yaml`. The GitHub App writes this scaffold and CI; your site builds from `/build`.

**Repo layout**
```
<repo>/
├─ docusaurus.config.ts
├─ sidebars.ts
├─ package.json
├─ tsconfig.json
├─ docs/
│  └─ intro.md
├─ static/
│  └─ favicon.ico (optional)
├─ .github/workflows/docs.yml
└─ README.md
```

**`package.json`**
```json
{
  "name": "codessa-docusaurus",
  "private": true,
  "scripts": {
    "start": "docusaurus start",
    "build": "docusaurus build",
    "serve": "docusaurus serve",
    "deploy": "docusaurus deploy"
  },
  "dependencies": {
    "@docusaurus/core": "^3.5.0",
    "@docusaurus/preset-classic": "^3.5.0",
    "@docusaurus/theme-common": "^3.5.0",
    "clsx": "^2.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "typescript": "^5.5.4"
  }
}
```

**`docusaurus.config.ts`** (minimal)
```ts
import type { Config } from '@docusaurus/types';
import { themes as prismThemes } from 'prism-react-renderer';

const config: Config = {
  title: 'Codessa',
  url: 'https://<your-org>.github.io',
  baseUrl: '/<repo>/',
  favicon: 'img/favicon.ico',
  organizationName: '<your-org>',
  projectName: '<repo>',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  i18n: { defaultLocale: 'en', locales: ['en'] },
  presets: [[
    'classic',
    ({ docs: { sidebarPath: './sidebars.ts' }, blog: false, theme: { customCss: [] } })
  ]],
  themeConfig: {
    navbar: { title: 'Codessa' },
    prism: { theme: prismThemes.github, darkTheme: prismThemes.dracula }
  }
};
export default config;
```

**`sidebars.ts`**
```ts
export default {
  docs: [{ type: 'autogenerated', dirName: '.' }]
};
```

**`docs/intro.md`**
```md
# Codessa — Canon (Docusaurus)
Welcome to the living library. Start adding docs in this folder.
```

**GitHub Actions** — build & Pages deploy
```yaml
# .github/workflows/docs.yml
name: Build & Deploy (Docusaurus)
on:
  push: { branches: [main] }
  workflow_dispatch:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci || npm i
      - run: npx docusaurus build
      - uses: actions/upload-pages-artifact@v3
        with: { path: 'build' }
  deploy:
    needs: build
    permissions: { pages: write, id-token: write }
    environment: { name: github-pages }
    runs-on: ubuntu-latest
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

**PR previews** (reuse earlier workflow): set `publish_dir: ./build` and `destination_dir: previews/pr-${{ env.PR }}`.

---

## 11) Hugo Adapter (Docs + GitHub Pages)

**Intent**: Allow `docs.generator: hugo`. Minimal, theme‑agnostic scaffold and CI; output in `/public`.

**Repo layout**
```
<repo>/
├─ config.toml
├─ content/_index.md
├─ layouts/_default/baseof.html
├─ layouts/_default/single.html
├─ static/ (optional assets)
└─ .github/workflows/docs.yml
```

**`config.toml`**
```toml
baseURL = 'https://<your-org>.github.io/<repo>/'
languageCode = 'en-us'
title = 'Codessa — Hugo'
theme = '' # (optional) add later; this scaffold uses custom layouts
```

**`content/_index.md`**
```md
---
title: Codessa — Canon (Hugo)
---
Welcome to the living library. Create more pages in `content/`.
```

**`layouts/_default/baseof.html`** (ultra‑minimal)
```html
<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{{ .Title }}</title>
<link rel="stylesheet" href="/styles.css" />
</head><body>
<header><h1><a href="/{{ .Site.BaseURL }}">Codessa</a></h1></header>
<main>{{ block "main" . }}{{ end }}</main>
<footer><p>© Codessa</p></footer>
</body></html>
```

**`layouts/_default/single.html`**
```html
{{ define "main" }}
<article>
  <h1>{{ .Title }}</h1>
  {{ .Content }}
</article>
{{ end }}
```

**GitHub Actions** — build & Pages deploy
```yaml
# .github/workflows/docs.yml
name: Build & Deploy (Hugo)
on:
  push: { branches: [main] }
  workflow_dispatch:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { submodules: true }
      - uses: peaceiris/actions-hugo@v2
        with: { hugo-version: '0.125.5', extended: true }
      - run: hugo --minify
      - uses: actions/upload-pages-artifact@v3
        with: { path: 'public' }
  deploy:
    needs: build
    permissions: { pages: write, id-token: write }
    environment: { name: github-pages }
    runs-on: ubuntu-latest
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

**PR previews**: same pattern; set `publish_dir: ./public`.

---

## 12) Giscus Comments (MkDocs, Docusaurus, Hugo)

### A) MkDocs (Material)
**Option 1 — plugin** (if you add `mkdocs-giscus` later):
```yaml
plugins:
  - giscus:
      repo: <owner>/<repo>
      repo_id: <repo_id>
      category: General
      category_id: <category_id>
      mapping: pathname
      reactions_enabled: true
      emit_metadata: false
      theme: preferred_color_scheme
```

**Option 2 — manual injection** (works today):
1. Create `overrides/partials/comments.html`:
```html
<div class="giscus"></div>
<script src="https://giscus.app/client.js"
  data-repo="<owner>/<repo>"
  data-repo-id="<repo_id>"
  data-category="General"
  data-category-id="<category_id>"
  data-mapping="pathname"
  data-strict="0"
  data-reactions-enabled="1"
  data-emit-metadata="0"
  data-theme="preferred_color_scheme"
  crossorigin="anonymous" async>
</script>
```
2. Enable theme overrides in `mkdocs.yml` and include the partial at the bottom via `theme.custom_dir: overrides` and `extra_templates` or insert into `main.html` (Material supports Jinja2 overrides). Add link in your page template where you want comments.

### B) Docusaurus
1. `npm i @giscus/react`
2. Create `src/components/Giscus.tsx`:
```tsx
import Giscus from '@giscus/react';
export default () => (
  <Giscus repo="<owner>/<repo>" repoId="<repo_id>"
    category="General" categoryId="<category_id>"
    mapping="pathname" reactionsEnabled="1" emitMetadata="0"
    theme="preferred_color_scheme" />
);
```
3. In any **MDX** page (rename `.md` → `.mdx` if needed):
```mdx
import Giscus from '@site/src/components/Giscus';

# Page Title

<Giscus />
```
*(Optional)* Swizzle the theme to render `<Giscus />` globally after docs content.

### C) Hugo
1. Add a partial at `layouts/partials/giscus.html`:
```html
<div class="giscus"></div>
<script src="https://giscus.app/client.js"
  data-repo="<owner>/<repo>" data-repo-id="<repo_id>"
  data-category="General" data-category-id="<category_id>"
  data-mapping="pathname" data-reactions-enabled="1"
  data-emit-metadata="0" data-theme="preferred_color_scheme"
  crossorigin="anonymous" async></script>
```
2. Include in layouts where desired (e.g., `single.html`):
```html
{{ partial "giscus.html" . }}
```

> Get `repo_id` and `category_id` from the Giscus installation flow (it reads from your GitHub Discussions settings).

---

## 13) Adapter Switching in the GitHub App

**`codessa.meta.yaml`** selector:
```yaml
docs:
  generator: mkdocs   # or: docusaurus | hugo
```

**Pseudocode (TypeScript) in `scaffold.ts`**
```ts
switch(meta.docs?.generator){
  case 'docusaurus':
    writeDocusaurusFiles();
    writeWorkflow({ buildDir: 'build' });
    break;
  case 'hugo':
    writeHugoFiles();
    writeWorkflow({ buildDir: 'public', hugo: true });
    break;
  default:
    writeMkDocsFiles();
    writeWorkflow({ buildDir: 'site', python: true });
}
```
Ensure PR Preview workflow uses the same `buildDir` and writes to `gh-pages/previews/pr-<n>/`.

---

## 14) Quick checks before go‑live
- Set **Pages** to deploy from GitHub Actions.
- For Docusaurus, confirm `baseUrl` matches `/<repo>/`.
- For Hugo, verify `baseURL` and that `public/` is artifact path.
- For Giscus, create **GitHub Discussions** in the repo and copy `repo_id`/`category_id`.

---

With these adapters + comments, Codessa becomes generator‑agnostic and conversational: pick MkDocs, Docusaurus, or Hugo, and ship with live previews and page‑level discussions. Ready for me to add an **Algolia DocSearch** integration and a **mermaid auto-diagram service** next?

