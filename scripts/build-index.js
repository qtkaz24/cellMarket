import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT = join(ROOT, 'index.json');

function findAllManifests() {
  const manifests = [];

  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        walk(fullPath);
      } else if (entry.isFile() && entry.name === 'manifest.json') {
        manifests.push(fullPath);
      }
    }
  }

  walk(join(ROOT, 'agents'));
  walk(join(ROOT, 'teams'));
  walk(join(ROOT, 'workflows'));

  return manifests;
}

function computeChecksum(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8').replace(/\r\n?/g, '\n');
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
  } catch {
    return null;
  }
}

function toCatalogPath(path) {
  return path.replaceAll('\\', '/');
}

function collectMediaFiles(dir, manifest) {
  const media = [];

  if (manifest.media?.icon?.src) {
    media.push({ type: 'icon', path: `${dir}/${manifest.media.icon.src}` });
  }

  if (manifest.media?.hero?.src) {
    media.push({ type: 'hero', path: `${dir}/${manifest.media.hero.src}` });
  }

  if (manifest.media?.images) {
    for (const img of manifest.media.images) {
      media.push({
        type: 'image',
        path: `${dir}/${img.src}`,
        order: img.order,
        alt: img.alt,
      });
    }
  }

  return media;
}

function buildIndex() {
  const manifests = findAllManifests();
  const entries = [];

  for (const manifestPath of manifests) {
    const relPath = toCatalogPath(relative(ROOT, manifestPath));
    const entryPath = relPath.replace(/\/manifest\.json$/, '');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    const media = collectMediaFiles(entryPath, manifest);

    const entry = {
      id: manifest.id,
      type: manifest.type,
      version: manifest.version,
      name: manifest.name,
      description: manifest.description,
      category: manifest.category,
      tags: manifest.tags || [],
      status: manifest.status,
      path: entryPath,
      media: media.map(m => m.path),
      checksum: computeChecksum(manifestPath),
    };

    entries.push(entry);
  }

  // Deterministic sort: type, then id, then version
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    if (a.id !== b.id) return a.id.localeCompare(b.id);
    return a.version.localeCompare(b.version);
  });

  let generatedAt = new Date().toISOString();
  if (existsSync(OUTPUT)) {
    try {
      const previous = JSON.parse(readFileSync(OUTPUT, 'utf-8'));
      if (JSON.stringify(previous.entries) === JSON.stringify(entries) && previous.generatedAt) {
        generatedAt = previous.generatedAt;
      }
    } catch {
      // A malformed or missing prior index is replaced with a fresh timestamp.
    }
  }

  const index = {
    $schema: 'schemas/index.schema.json',
    generatedAt,
    totalEntries: entries.length,
    entries,
  };

  return index;
}

function main() {
  console.log('=== Building Index ===\n');

  const index = buildIndex();
  const output = JSON.stringify(index, null, 2) + '\n';

  writeFileSync(OUTPUT, output, 'utf-8');
  console.log(`  Generated: ${relative(ROOT, OUTPUT)}`);
  console.log(`  Entries:   ${index.totalEntries}`);
  console.log(`  Size:      ${(Buffer.byteLength(output) / 1024).toFixed(1)}KB`);
  console.log('\nIndex generation complete.');
}

main();
