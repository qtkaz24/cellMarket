# Contributing to Agent Marketplace

## Adding a New Agent

1. **Copy the minimal template:**

   ```bash
   cp -r templates/examples/agent-minimal agents/coding/my-agent
   ```

2. **Edit `manifest.json`:**

   ```json
   {
     "id": "agent.my-agent",
     "type": "agent",
     "version": "1.0.0",
     "name": "My Agent",
     "description": "...",
     "category": "coding",
     "tags": ["my-tag"],
     "status": "active",
     "agent": {
       "role": "...",
       "instructions": "..."
     }
   }
   ```

3. **Add `icon.svg`** (or `media/icon.svg`).

4. **Optionally add media:**

   ```
   media/
     hero.webp
     conversations.webp
   ```

5. **Validate:**

   ```bash
   npm run validate
   ```

6. **Open a PR.**

## Adding an Agent with Media

Use the `agent-with-media` template:

```bash
cp -r templates/examples/agent-with-media agents/coding/my-rich-agent
```

Media rules:
- **icon**: SVG preferred, placed at `icon.svg` or `media/icon.{svg,png,webp}`
- **hero**: WebP/AVIF/PNG/JPG, placed in `media/` directory
- **images**: Same formats, in `media/` directory, each with `alt` text and `order`
- **Max file size**: 10MB per file
- **Max images**: 20
- **Paths**: Always relative, no `..`, no absolute URLs

## Updating an Agent

1. Edit `manifest.json`
2. **Bump the version** according to semver rules
3. Run validation
4. Open a PR

## Hiding an Agent

Set `"status": "hidden"` in the manifest. The agent won't appear in browse/search but remains accessible by direct ID.

## Deprecating an Agent

Set `"status": "deprecated"` in the manifest. The agent shows a deprecation warning but remains installable.

## Revoking an Agent

Set `"status": "revoked"` in the manifest. The agent should never be installed again.

## Adding a Team

1. Copy the team template:

   ```bash
   cp -r templates/examples/team-minimal teams/coding/my-team
   ```

2. Reference agents by their stable IDs:

   ```json
   {
     "team": {
       "members": [
         {
           "agentId": "agent.frontend-engineer",
           "version": "^1.0.0",
           "role": "Lead developer"
         }
       ]
     }
   }
   ```

3. The `version` field supports:
   - Exact: `1.0.0`
   - Caret (compatible): `^1.0.0`
   - Tilde (patch): `~1.0.0`
   - Comparison: `>=1.0.0`

## Adding a Workflow

1. Copy the workflow template:

   ```bash
   cp -r templates/examples/workflow-minimal workflows/development/my-workflow
   ```

2. Define triggers, actions, and agent references:

   ```json
   {
     "workflow": {
       "triggers": [{ "type": "manual" }],
       "actions": [
         { "type": "agent", "name": "step1", "agentId": "agent.my-agent", "next": "step2" },
         { "type": "notify", "name": "step2" }
       ]
     }
   }
   ```

## Validation Rules

The CI pipeline checks:

- All manifests pass JSON Schema validation
- IDs are unique across the entire catalog
- Versions are valid semver with no duplicates per ID
- Referenced media files exist and are within size limits
- Team/workflow agent references point to existing entries
- No path traversal, symlinks, or oversized files

**PRs that fail validation will not be merged.**

## ID Conventions

| Type | Prefix | Example |
|------|--------|---------|
| Agent | `agent.` | `agent.frontend-engineer` |
| Team | `team.` | `team.full-stack-team` |
| Workflow | `workflow.` | `workflow.code-review-pipeline` |

IDs use lowercase letters, digits, and hyphens. No underscores, no uppercase.

## Tag Conventions

- Lowercase only
- Hyphen-separated: `code-review`, not `codeReview`
- Max 50 characters per tag
- Max 20 tags per entry
