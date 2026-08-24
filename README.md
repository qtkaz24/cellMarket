# Agent Marketplace — Technical Reference

Catalog repository consumed by the backend via a registry synchronizer.

**Source de vérité éditoriale.** Le backend ne stocke jamais ses propres copies des manifests — il synchronise depuis ce repository.

---

## Table of Contents

- [Architecture](#architecture)
- [Entry Types](#entry-types)
- [ID System](#id-system)
- [Manifest Schemas](#manifest-schemas)
- [Index Format](#index-format)
- [Search API](#search-api)
- [Bundles](#bundles)
- [Workflows](#workflows)
- [Media Rules](#media-rules)
- [Statuses & Lifecycle](#statuses--lifecycle)
- [Versioning Rules](#versioning-rules)
- [Synchronization Strategy](#synchronization-strategy)
- [Security Checklist](#security-checklist)
- [CLI Reference](#cli-reference)

---

## Architecture

```
┌─────────────────────┐
│  agent-marketplace   │  ← This repository (source of truth)
│  (GitHub)            │
└─────────┬───────────┘
          │ git pull / webhook / polling
          ▼
┌─────────────────────┐
│  Registry Sync       │  Reads index.json, diffs against local cache
│  (Backend service)   │
└─────────┬───────────┘
          │ writes
          ▼
┌─────────────────────┐
│  Local Registry      │  Cached copy of manifests + media
│  (Database/Cache)    │
└─────────┬───────────┘
          │ serves
          ▼
┌─────────────────────┐
│  Workspace Install   │  User installs agent/team/workflow
│  (Client app)        │
└─────────────────────┘
```

**Rules:**
- This repo is **declarative only** — no runtime logic, no secrets, no credentials
- The backend reads `index.json` for discovery, then fetches individual manifests
- A manifest **requests** permissions — it never **grants** them
- The backend decides what permissions to actually award at install time

---

## Entry Types

| Type | ID prefix | Count | Directory |
|------|-----------|-------|-----------|
| Agent | `agent.{7-digit}` | 54 | `agents/{category}/{slug}/` |
| Team | `team.{slug}` | 11 | `teams/{category}/{slug}/` |
| Workflow | `workflow.{id}` | 7 | `workflows/{category}/wf-{id}/` |

**Categories** (human organization, not identity):
`coding` · `research` · `finance` · `productivity` · `design` · `devops` · `development` · `marketing` · `personal` · `sales` · `success`

---

## ID System

### Agents: Stable Numeric IDs

```
agent.4459577
agent.7048139
agent.9014962
```

- 7-digit random numbers (like Discord snowflakes)
- **Never change** even if the agent is renamed
- Human-readable name lives in the `name` field only
- Schema enforces: `^agent\.[0-9]+$`

### Teams & Workflows: Slug IDs

```
team.growth-engine
workflow.3847291
```

- Teams use readable slugs
- Workflows use numeric IDs
- Referenced by agents using the **stable numeric ID**

**Key principle:** You can rename `name`, `description`, `tags` freely. The `id` is the only thing other entries reference.

---

## Manifest Schemas

All schemas are in `schemas/`. Draft-07, AJV-compatible.

### Agent Manifest

```json
{
  "id": "agent.7048139",
  "type": "agent",
  "version": "1.0.0",
  "name": "Content Strategist",
  "description": "Short description (max 2000 chars).",
  "longDescription": "Extended description (optional, max 10000 chars).",
  "category": "marketing",
  "tags": ["content", "strategy"],
  "author": { "name": "Agent Marketplace", "url": "https://..." },
  "license": "MIT",
  "status": "active",
  "media": {
    "icon": { "src": "icon.svg", "alt": "..." },
    "hero": { "src": "media/hero.webp", "alt": "..." },
    "images": [
      { "src": "media/screenshot.webp", "alt": "...", "order": 0 }
    ]
  },
  "agent": {
    "role": "What this agent does (one line)",
    "instructions": "Full system prompt / instructions.",
    "models": {
      "primary": "claude-sonnet-4",
      "fallback": ["gpt-4o"],
      "config": { "temperature": 0.3 }
    },
    "tools": [
      { "name": "web_search", "description": "...", "required": false }
    ],
    "permissions": ["fs.read", "fs.write", "network.api"],
    "memory": {
      "enabled": true,
      "scope": "session",
      "description": "What the agent remembers."
    },
    "automations": [
      { "name": "lint", "description": "...", "trigger": "file_write" }
    ]
  },
  "integrations": [
    { "name": "Gmail", "url": "https://mail.google.com" }
  ],
  "compatibility": {
    "minPlatformVersion": "1.0.0",
    "requiredFeatures": ["fs.read", "network.api"]
  }
}
```

**Required fields:** `id`, `type`, `version`, `name`, `description`, `category`, `status`, `agent`
**Agent required fields:** `role`, `instructions`

### Team Manifest

```json
{
  "id": "team.growth-engine",
  "type": "team",
  "version": "1.0.0",
  "name": "Growth Engine",
  "description": "...",
  "category": "marketing",
  "tags": ["growth", "revenue"],
  "status": "active",
  "team": {
    "description": "How the team works together.",
    "members": [
      {
        "agentId": "agent.7048139",
        "version": "^1.0.0",
        "role": "Strategic ideation",
        "config": {},
        "delegates": ["agent.9196757"],
        "permissions": ["network.api"]
      }
    ],
    "orchestration": {
      "strategy": "sequential",
      "maxConcurrent": 3,
      "timeout": 1800
    },
    "sharedContext": {
      "enabled": true,
      "scope": "task",
      "description": "What context is shared."
    }
  }
}
```

**Version ranges:** exact (`1.0.0`), caret (`^1.0.0`), tilde (`~1.0.0`), comparison (`>=1.0.0`)

### Workflow Manifest

```json
{
  "id": "workflow.3847291",
  "type": "workflow",
  "version": "1.0.0",
  "name": "Growth Pipeline",
  "description": "...",
  "category": "marketing",
  "status": "active",
  "workflow": {
    "description": "...",
    "triggers": [
      { "type": "schedule", "description": "...", "config": { "cron": "0 9 * * 1" } },
      { "type": "manual" },
      { "type": "event", "config": { "event": "pull_request.opened" } },
      { "type": "webhook" },
      { "type": "file-change" }
    ],
    "agents": [
      { "agentId": "agent.7048139", "version": "^1.0.0", "role": "..." }
    ],
    "actions": [
      {
        "type": "agent",
        "name": "step-1",
        "agentId": "agent.7048139",
        "input": { "source": "trigger.input" },
        "output": { "result": "data" },
        "next": "step-2"
      },
      {
        "type": "parallel",
        "name": "step-2",
        "children": [
          { "type": "agent", "name": "a", "agentId": "agent.5422127" },
          { "type": "agent", "name": "b", "agentId": "agent.6930001" }
        ],
        "next": "step-3"
      },
      { "type": "notify", "name": "step-3", "input": { "message": "step-2.*" } }
    ],
    "tools": [{ "name": "schedule", "required": true }],
    "permissions": ["network.api"]
  }
}
```

**Action types:** `agent`, `tool`, `transform`, `condition`, `parallel`, `notify`
**Trigger types:** `manual`, `schedule`, `event`, `webhook`, `file-change`

---

## Index Format

`index.json` is **auto-generated** — never edit manually.

```json
{
  "$schema": "schemas/index.schema.json",
  "generatedAt": "2026-08-24T14:43:14.829Z",
  "totalEntries": 70,
  "entries": [
    {
      "id": "agent.7048139",
      "type": "agent",
      "version": "1.0.0",
      "name": "Content Strategist",
      "description": "...",
      "category": "marketing",
      "tags": ["content", "strategy"],
      "status": "active",
      "path": "agents/marketing/content-strategist",
      "media": ["agents/marketing/content-strategist/icon.svg"],
      "checksum": "a30c506147e0f512"
    }
  ]
}
```

**Index fields:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Stable unique identifier |
| `type` | enum | `agent` · `team` · `workflow` |
| `version` | string | Semver |
| `name` | string | Display name |
| `description` | string | Short description |
| `category` | enum | Human category |
| `tags` | string[] | Searchable tags |
| `status` | enum | Lifecycle status |
| `path` | string | Relative directory path |
| `media` | string[] | Relative paths to media files |
| `checksum` | string | SHA-256 prefix (16 hex chars) of manifest.json |

**Checksum strategy:** 16-char SHA-256 prefix. Sufficient to detect changes without overhead. Backend should compare checksums to know when to re-fetch a manifest.

**Determinism:** Index is sorted by `type → id → version`. Regeneration produces identical output (except `generatedAt`).

---

## Search API

```bash
node scripts/search.js "query"
node scripts/search.js --category=marketing --type=agent
node scripts/search.js --integration=Gmail --json
```

**Programmatic:**
```js
import { search } from './scripts/search.js';

const results = search({
  q: 'email',           // query (name + description + tags)
  category: 'personal', // filter by category
  type: 'agent',        // agent | team | workflow
  tag: 'gmail',         // filter by tag
  integration: 'Gmail', // filter by integration
  status: 'active',     // active | hidden | deprecated | revoked
  limit: 25,            // max results
  offset: 0             // pagination offset
});

// Returns: { total, limit, offset, results: [...] }
```

---

## Bundles

`bundles.json` — curated groups of agents for one-click installation.

```json
{
  "bundles": [
    {
      "id": "bundle.growth-starter",
      "name": "Growth Starter",
      "description": "...",
      "category": "marketing",
      "tags": ["growth", "starter"],
      "agents": ["agent.7048139", "agent.5130243", "agent.2169231", "agent.5422127"],
      "workflows": ["workflow.8273645"]
    }
  ]
}
```

**Available bundles:**

| Bundle | Agents | Workflows | Category |
|--------|--------|-----------|----------|
| `bundle.growth-starter` | 4 | 1 | marketing |
| `bundle.revenue-machine` | 6 | 1 | sales |
| `bundle.executive-suite` | 6 | 1 | productivity |
| `bundle.security-first` | 5 | 1 | devops |
| `bundle.digital-detox` | 7 | 0 | personal |
| `bundle.content-engine` | 6 | 1 | marketing |

---

## Workflows

Automated pipelines combining multiple agents.

| ID | Name | Steps | Triggers |
|----|------|-------|----------|
| `workflow.3847291` | Growth Pipeline | 6 | schedule (weekly) + manual |
| `workflow.8273645` | Content Factory | 6 | schedule (friday) + manual |
| `workflow.5192834` | Sales Intelligence | 5 | schedule (daily) + manual |
| `workflow.6741928` | Security Audit | 4 | schedule (weekly) + event + manual |
| `workflow.9384756` | Executive Morning | 6 | schedule (daily) + manual |
| `workflow.2748391` | Competitive Sweep | 5 | schedule (weekly) + manual |
| `workflow.1938472` | Code Review Pipeline | 3 | manual + event |

**Orchestration strategies:** `sequential` · `parallel` · `hierarchical` · `collaborative`

---

## Media Rules

### Formats
| Type | Allowed | Max size |
|------|---------|----------|
| Icon | `.svg` | 100KB |
| Hero | `.webp` `.avif` `.png` `.jpg` | 10MB |
| Images | `.webp` `.avif` `.png` `.jpg` | 10MB |

### Limits
- Max 20 images per entry
- All paths relative (no `..`, no absolute URLs)
- No SVG for showcase images (icon only)
- Alt text required for all images

### Structure
```
agents/marketing/content-strategist/
  manifest.json
  icon.svg
  media/
    hero.webp
    screenshot.webp
```

---

## Statuses & Lifecycle

| Status | Browse | Search | Install | Direct Access |
|--------|--------|--------|---------|---------------|
| `active` | ✅ | ✅ | ✅ | ✅ |
| `hidden` | ❌ | ❌ | ✅ | ✅ |
| `deprecated` | ⚠️ warning | ⚠️ warning | ✅ | ✅ |
| `revoked` | ❌ | ❌ | ❌ | ✅ (shows revoked) |

**Rules:**
- Never delete an entry physically
- Use `deprecated` for agents being phased out
- Use `hidden` for WIP or temporarily removed
- Use `revoked` for security/quality issues (blocked from install)

---

## Versioning Rules

All entries use **Semantic Versioning** (`MAJOR.MINOR.PATCH`):

| Change | Bump | Example |
|--------|------|---------|
| New instructions, role change, tool removed | MAJOR | 1.0.0 → 2.0.0 |
| New tool, new permission, new capability | MINOR | 1.0.0 → 1.1.0 |
| Description fix, tag update, media change | PATCH | 1.0.0 → 1.0.1 |

**A published version must never be silently rewritten.** If the content changes, bump the version.

---

## Synchronization Strategy

### For the backend registry sync:

1. **Fetch `index.json`** from `main` branch
2. **Diff against local cache** using `checksum` field
3. **Re-fetch only changed manifests** (checksum mismatch)
4. **Respect `status`:**
   - `revoked` → block installation, remove from local cache
   - `deprecated` → show warning, keep in cache
   - `hidden` → remove from search results, keep accessible
5. **Cache media locally** — don't re-download unchanged media files
6. **Version ranges** — teams/workflows reference agents by range; resolve at install time

### Checksum comparison:
```
if (remote.checksum !== local.checksum) {
  // Re-fetch manifest.json
  // Re-download media if manifest changed
}
```

---

## Security Checklist

The CI validates:
- ✅ All manifests pass JSON Schema validation
- ✅ No duplicate IDs across the entire catalog
- ✅ Valid semver, no duplicate versions per ID
- ✅ Referenced media files exist and are within size limits
- ✅ Team/workflow agent references resolve to known IDs
- ✅ No path traversal patterns (`../`)
- ✅ No symlinks
- ✅ No files > 10MB
- ✅ No disallowed media extensions
- ✅ Manifest size < 100KB
- ✅ Deterministic index regeneration

**Backend should also verify:**
- No executable content in manifests
- No embedded URLs to untrusted domains
- Permission requests follow the expected format
- Integration URLs are valid HTTPS

---

## CLI Reference

```bash
# Validate all manifests
npm run validate

# Build deterministic index
npm run build:index

# Search the catalog
npm run search -- "query"
npm run search -- --category=marketing --type=agent --json

# Full CI pipeline
npm run ci
```

---

## Repository Stats

| Metric | Count |
|--------|-------|
| Agents | 54 |
| Teams | 11 |
| Workflows | 7 |
| Bundles | 6 |
| Categories | 11 |
| Total manifests | 70 |
| Index size | ~39KB |

---

## File Structure

```
agent-marketplace/
├── agents/
│   ├── coding/
│   │   └── frontend-engineer/manifest.json
│   ├── marketing/
│   │   ├── content-strategist/manifest.json
│   │   ├── social-media-manager/manifest.json
│   │   └── ... (12 agents)
│   ├── personal/
│   │   ├── digital-cleaner/manifest.json
│   │   └── ... (10 agents)
│   ├── productivity/
│   │   ├── inbox-zero/manifest.json
│   │   └── ... (13 agents)
│   ├── research/
│   │   └── research-analyst/manifest.json
│   ├── sales/
│   │   ├── deal-manager/manifest.json
│   │   └── ... (5 agents)
│   ├── devops/
│   │   ├── security-fixer/manifest.json
│   │   └── ... (3 agents)
│   └── success/
│       ├── support-resolver/manifest.json
│       └── ... (3 agents)
├── teams/
│   ├── marketing/growth-engine/manifest.json
│   ├── sales/revenue-ops/manifest.json
│   └── ... (11 teams)
├── workflows/
│   ├── marketing/wf-3847291/manifest.json
│   ├── sales/wf-5192834/manifest.json
│   └── ... (7 workflows)
├── schemas/
│   ├── agent.schema.json
│   ├── team.schema.json
│   ├── workflow.schema.json
│   └── index.schema.json
├── scripts/
│   ├── validate.js
│   ├── build-index.js
│   ├── verify-index.js
│   └── search.js
├── templates/examples/
├── bundles.json
├── CHANGELOG.json
├── index.json
├── package.json
├── README.md
└── CONTRIBUTING.md
```
