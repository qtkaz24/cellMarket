# Agent Marketplace

Official catalog repository for the Agent Marketplace platform.

This repository is the **single source of truth** for all agents, teams, and workflows published on the marketplace. It is consumed automatically by the backend via a registry synchronizer.

## Quick Start

```bash
# Install dependencies
npm install

# Validate all manifests
npm run validate

# Build the index
npm run build:index

# Full CI pipeline
npm run ci
```

## Structure

```
agents/          # Agent manifests organized by human category
  coding/
  research/
  finance/
  productivity/
  design/
  devops/

teams/           # Team manifests
workflows/       # Workflow manifests

schemas/         # JSON Schema definitions
scripts/         # Validation and index generation
templates/       # Example templates for contributors
```

**Categories are for human organization only.** The canonical identity is the `id` field in each manifest.

## Manifest Format

Every entry has a `manifest.json` with at minimum:

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | Stable unique ID (e.g. `agent.frontend-engineer`) |
| `type` | Yes | `agent`, `team`, or `workflow` |
| `version` | Yes | Semantic version (`1.0.0`) |
| `name` | Yes | Display name |
| `description` | Yes | Short description |
| `category` | Yes | Human category |
| `status` | Yes | `active`, `hidden`, `deprecated`, or `revoked` |

Media is optional. A minimal agent needs only `manifest.json` and `icon.svg`.

## Statuses

| Status | Meaning |
|--------|---------|
| `active` | Visible and installable |
| `hidden` | Not shown in browse/search, still accessible by direct ID |
| `deprecated` | Shown with deprecation warning, still installable |
| `revoked` | Blocked — should never be installed again |

**Never delete an entry.** Use `deprecated`, `hidden`, or `revoked` instead.

## Versioning

All entries use Semantic Versioning (`MAJOR.MINOR.PATCH`):

- **MAJOR**: Breaking changes to role, instructions, or agent configuration
- **MINOR**: New capabilities, tools, or permissions added
- **PATCH**: Bug fixes, description updates, media changes

A published version must never be silently rewritten to represent different content.

## CI

GitHub Actions runs on every push and PR:

1. **Schema validation** — all manifests conform to their JSON Schema
2. **ID uniqueness** — no duplicate IDs across the catalog
3. **Version validation** — valid semver, no duplicate versions per ID
4. **Media validation** — referenced files exist, sizes within limits, valid formats
5. **Reference validation** — team/workflow agent references resolve to known IDs
6. **Security checks** — no path traversal, symlinks, or oversized files
7. **Index generation** — deterministic index is regenerated and verified

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

## License

Catalog content is licensed under MIT unless otherwise specified in individual manifests.
