import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const INDEX_PATH = join(ROOT, 'index.json');

function main() {
  if (!existsSync(INDEX_PATH)) {
    console.error('index.json not found. Run `npm run build:index` first.');
    process.exit(1);
  }

  const index = JSON.parse(readFileSync(INDEX_PATH, 'utf-8'));

  try {
    execSync('node scripts/build-index.js', { cwd: ROOT, stdio: 'pipe' });

    const regenerated = JSON.parse(readFileSync(INDEX_PATH, 'utf-8'));

    // Compare entries (ignore generatedAt timestamp)
    const originalEntries = JSON.stringify(index.entries, null, 2);
    const regeneratedEntries = JSON.stringify(regenerated.entries, null, 2);

    if (originalEntries !== regeneratedEntries) {
      console.error('index.json entries are not deterministic! Regenerated entries differ.');
      console.error('Run `npm run build:index` and commit the updated index.json.');
      process.exit(1);
    }

    // Verify entry count matches
    if (index.totalEntries !== regenerated.totalEntries) {
      console.error(`Entry count mismatch: ${index.totalEntries} vs ${regenerated.totalEntries}`);
      process.exit(1);
    }

    console.log('index.json verification PASSED — deterministic and up-to-date.');
  } catch (e) {
    console.error('Failed to verify index determinism:', e.message);
    process.exit(1);
  }
}

main();
