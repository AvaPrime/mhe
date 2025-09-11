# Codessa Meta Layer — Upgrades Pack (Algolia + Diagrams + Automation)

This adds five production‑ready integrations to your toolkit. Copy these blocks into your repos as‑is.

- **Algolia DocSearch automation** (GitHub App route + issue template)
- **Nightly concept map** (Mermaid knowledge graph from headings/links)
- **Inline diagram preview** (PR builds that auto‑link to rendered SVGs)
- **Privacy‑first telemetry** (Plausible/Umami)
- **Slack/Discord hooks** (preview + diagrams notifications)

> These extend sections 15–18 from your main canvas. Use this as an add‑on, or merge into the original document.

---

## 19) DocSearch Crawler Automation (GitHub App)
Have the App open a **pre‑filled DocSearch application issue** and attach your `docsearch-config.json`.

**A) Issue template** — `.github/ISSUE_TEMPLATE/docsearch_application.yml`
```yaml
name: DocSearch Application
description: Request Algolia DocSearch indexing for this site
labels: [search, docsearch]
body:
  - type: input
    id: site_url
    attributes:
      label: Site URL
      placeholder: https://<org>.github.io/<repo>/
    validations: { required: true }
  - type: input
    id: sitemap
    attributes:
      label: Sitemap URL
      placeholder: https://<org>.github.io/<repo>/sitemap.xml
  - type: textarea
    id: config
    attributes:
      label: docsearch-config.json
      description: Paste or confirm the config stored in repo
      render: json
```

**B) Example config** — `docsearch-config.json`
```json
{
  "index_name": "codessa",
  "start_urls": ["https://<org>.github.io/<repo>/"],
  "sitemap_urls": ["https://<org>.github.io/<repo>/sitemap.xml"],
  "selectors": {
    "lvl0": { "selector": ".md-nav__title, h1", "default_value": "Documentation" },
    "lvl1": "article h1",
    "lvl2": "article h2",
    "lvl3": "article h3",
    "lvl4": "article h4",
    "content": "article p, article li"
  }
}
```

**C) GitHub App route** — `app/src/routes/index.ts` (add)
```ts
r.post('/algolia/apply', async (req, res) => {
  const { owner, repo, siteUrl, sitemapUrl } = req.body || {};
  if (!owner || !repo || !siteUrl) return res.status(400).json({ error: 'owner, repo, siteUrl required' });
  try {
    const token = process.env.GITHUB_TOKEN; // or installation token
    const client = token ? new Octokit({ auth: token }) : await ghApp.getInstallationOctokit((await new Octokit().request('GET /repos/{owner}/{repo}/installation', { owner, repo })).data.id as number);
    const cfgPath = 'docsearch-config.json';
    await client.request('POST /repos/{owner}/{repo}/issues', {
      owner, repo,
      title: 'Algolia DocSearch application',
      labels: ['search','docsearch'],
      body: `Site URL: ${siteUrl}\n\nSitemap: ${sitemapUrl || '(none)'}\n\nSee config in \`${cfgPath}\` or paste into Algolia form.`
    });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
```

Call: `POST /api/algolia/apply { owner, repo, siteUrl, sitemapUrl }` — the app opens the issue for teammates to submit to Algolia.

---

## 20) Nightly Concept‑Map Job (Knowledge Graph → Mermaid)
Build a lightweight graph of concepts by scanning headings and links in `docs/`, emit a Mermaid graph page, and publish nightly.

**A) Workflow** — `.github/workflows/concept-map.yml`
```yaml
name: Nightly Concept Map
on:
  schedule: [{ cron: '0 2 * * *' }]
  workflow_dispatch:
jobs:
  map:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - name: Build concept map
        run: |
          node scripts/concept-map.js
      - name: Commit graph page
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add docs/graphs/concept-map.md
          git commit -m "docs(graph): nightly concept map" || echo "No changes"
          git push
```

**B) Script** — `scripts/concept-map.js`
```js
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = 'docs';
const outDir = join(root, 'graphs');
mkdirSync(outDir, { recursive: true });

function walk(dir){
  const entries = readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const e of entries){
    const p = join(dir, e.name);
    if (e.isDirectory()) files = files.concat(walk(p));
    else if (e.isFile() && p.endsWith('.md')) files.push(p);
  }
  return files;
}

const files = walk(root);
const nodes = new Set();
const edges = new Set();

for (const f of files){
  const src = readFileSync(f, 'utf8');
  const title = (src.match(/^#\s+(.+)$/m)?.[1] || f.replace(/^docs\//,'')).replace(/\..+$/,'');
  const id = title.replace(/\W+/g,'_').slice(0,40);
  nodes.add(`${id}["${title}"]`);
  for (const m of src.matchAll(/\[[^\]]+\]\(([^)]+\.md)\)/g)){
    const target = m[1].replace(/^\.\//,'').replace(/^docs\//,'');
    const tTitle = target.replace(/\..+$/,'');
    const tId = tTitle.replace(/\W+/g,'_').slice(0,40);
    edges.add(`${id} --> ${tId}`);
  }
}

const mermaid = ['```mermaid','graph LR', ...nodes, ...edges, '```'].join('\n');
const page = `---\ntitle: Concept Map\nsummary: Auto-generated nightly from headings and links.\n---\n\n# Codessa Concept Map\n\n${mermaid}\n`;
writeFileSync(join(outDir, 'concept-map.md'), page, 'utf8');
console.log('Concept map updated');
```

---

## 21) Inline Diagram Preview (PR builds link to rendered SVGs)
Modify the PR Preview so Mermaid fences are converted to image links that point at the **published** SVGs under `diagrams/pr-<n>/`.

**A) Script** — `scripts/link-mermaid.js`
```js
import { readFileSync, writeFileSync } from 'node:fs';

const files = (process.env.CHANGED_MD || '').split('\n').filter(Boolean);
const base = process.env.DIAGRAM_BASE; // e.g., https://<org>.github.io/<repo>/diagrams/pr-123
if (!base || !files.length) process.exit(0);

for (const f of files){
  let src = readFileSync(f, 'utf8');
  let idx = 0;
  src = src.replace(/```mermaid\n([\s\S]*?)```/g, () => `![diagram](${base}/${f.replace(/\W+/g,'_')}-${idx++}.svg)`);
  writeFileSync(f, src, 'utf8');
}
```

**B) Update PR Preview workflow** — add before build step
```yaml
      - name: Compute changed Markdown
        id: changed
        run: |
          git fetch origin ${GITHUB_BASE_REF} --depth=1 || true
          git diff --name-only origin/${GITHUB_BASE_REF}...HEAD | grep -E '\\.(md|mdx)$' || true > changed.txt
          echo "changed=$(cat changed.txt)" >> $GITHUB_OUTPUT
      - name: Link diagrams
        if: steps.changed.outputs.changed != ''
        env:
          CHANGED_MD: ${{ steps.changed.outputs.changed }}
          DIAGRAM_BASE: https://${{ github.repository_owner }}.github.io/${{ github.event.repository.name }}/diagrams/pr-${{ github.event.number }}
        run: |
          node scripts/link-mermaid.js
```

---

## 22) Privacy‑First Search Telemetry (Plausible / Umami)
Aggregate anonymous insights (what pages & searches are used) without cookies.

**Plausible (MkDocs, Docusaurus, Hugo)**
```html
<script defer data-domain="<org>.github.io" src="https://plausible.io/js/script.js"></script>
```
- **MkDocs**: put the tag in a theme override template (or `extra.head`).
- **Docusaurus**: add to `docusaurus.config.ts` via `scripts` array.
- **Hugo**: add to `layouts/_default/baseof.html`.

**Umami (self-host)**: replace with your Umami script; keep cookie‑less + IP anonymization.

Document behavior in `PRIVACY.md`.

---

## 23) Slack / Discord Hooks
Send CI notifications with deep links to previews and diagrams.

**Slack (incoming webhook)**
```bash
curl -X POST -H 'Content-type: application/json' \
  --data '{"text": "Preview: https://<org>.github.io/<repo>/previews/pr-<n>/\nDiagrams: https://<org>.github.io/<repo>/diagrams/pr-<n>/"}' \
  "$SLACK_WEBHOOK_URL"
```

**Discord (webhook)**
```bash
curl -H "Content-Type: application/json" -X POST \
  -d '{"content": "**Preview**: https://<org>.github.io/<repo>/previews/pr-<n>/\n**Diagrams**: https://<org>.github.io/<repo>/diagrams/pr-<n>/"}' \
  "$DISCORD_WEBHOOK_URL"
```
Add these as final steps in your PR preview and diagram workflows.

---

### Final checklist
- Pick generator in `codessa.meta.yaml` (mkdocs/docusaurus/hugo)
- DocSearch: add config, call `/api/algolia/apply` to open the application issue
- Add PR Preview + Mermaid Diagram workflows
- Add `link-mermaid.js` and `concept-map.js`
- Enable Plausible/Umami, add `PRIVACY.md`
- Add Slack/Discord secrets and notify steps

Your stack is now **search‑fast, diagram‑rich, privacy‑respectful, and collaboration‑chatty**. Merge this pack into your main canvas whenever you’re ready.

