import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');

const index = JSON.parse(readFileSync(join(ROOT, 'index.json'), 'utf-8'));

function search({ q, category, type, tag, integration, status, limit = 25, offset = 0 }) {
  let results = [...index.entries];

  // Filter by query (name + description + tags)
  if (q) {
    const query = q.toLowerCase();
    results = results.filter(e =>
      e.name.toLowerCase().includes(query) ||
      e.description.toLowerCase().includes(query) ||
      e.tags?.some(t => t.toLowerCase().includes(query))
    );
  }

  // Filter by category
  if (category) {
    const cats = Array.isArray(category) ? category : [category];
    results = results.filter(e => cats.includes(e.category));
  }

  // Filter by type
  if (type) {
    const types = Array.isArray(type) ? type : [type];
    results = results.filter(e => types.includes(e.type));
  }

  // Filter by tag
  if (tag) {
    const tags = Array.isArray(tag) ? tag : [tag];
    results = results.filter(e => tags.some(t => e.tags?.includes(t)));
  }

  // Filter by integration (requires reading manifests)
  if (integration) {
    results = results.filter(e => {
      try {
        const manifest = JSON.parse(readFileSync(join(ROOT, e.path, 'manifest.json'), 'utf-8'));
        const integrations = manifest.integrations?.map(i => i.name.toLowerCase()) || [];
        return integrations.includes(integration.toLowerCase());
      } catch {
        return false;
      }
    });
  }

  // Filter by status
  if (status) {
    const statuses = Array.isArray(status) ? status : [status];
    results = results.filter(e => statuses.includes(e.status));
  }

  const total = results.length;
  const paged = results.slice(offset, offset + limit);

  return {
    total,
    limit,
    offset,
    results: paged,
  };
}

// CLI interface
function main() {
  const args = process.argv.slice(2);
  const flags = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const [key, val] = arg.slice(2).split('=');
      flags[key] = val || args[++i];
    } else if (!flags.q) {
      flags.q = arg;
    }
  }
  
  if (flags.help) {
    console.log(`
Usage: node search.js [query] [options]

Options:
  --q=<text>           Search by name/description/tags
  --category=<name>    Filter by category (coding, marketing, etc.)
  --type=<type>        Filter by type (agent, team, workflow)
  --tag=<tag>          Filter by tag
  --integration=<name> Filter by integration (gmail, github, etc.)
  --status=<status>    Filter by status (active, hidden, deprecated, revoked)
  --limit=<n>          Max results (default: 25)
  --offset=<n>         Offset for pagination (default: 0)
  --json               Output raw JSON
  --help               Show this help

Examples:
  node search.js "email"
  node search.js --category=marketing --type=agent
  node search.js --integration=Gmail --status=active
  node search.js "security" --type=agent --json
`);
    return;
  }
  
  const result = search(flags);
  
  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  
  console.log(`\nFound ${result.total} results (showing ${result.offset + 1}-${Math.min(result.offset + result.limit, result.total)})\n`);
  
  for (const entry of result.results) {
    const icon = entry.type === 'agent' ? '🤖' : entry.type === 'team' ? '👥' : '⚡';
    console.log(`${icon} ${entry.name}`);
    console.log(`   ${entry.id} · ${entry.type} · v${entry.version} · ${entry.category}`);
    console.log(`   ${entry.description.slice(0, 100)}${entry.description.length > 100 ? '...' : ''}`);
    if (entry.tags?.length) console.log(`   tags: ${entry.tags.join(', ')}`);
    console.log();
  }
}

// Export for programmatic use
export { search };

// Run CLI
main();
