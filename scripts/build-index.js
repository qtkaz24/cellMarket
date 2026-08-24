import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';
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
    const content = readFileSync(filePath);
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
  } catch {
    return null;
  }
}

function collectMediaFiles(manifestPath, manifest) {
  const dir = manifestPath.replace(/\/manifest\.json$/, '');
  const media = [];
  const mediaDir = join(ROOT, dir, 'media');

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
    const relPath = relative(ROOT, manifestPath);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    const media = collectMediaFiles(relPath.replace(/\/manifest\.json$/, ''), manifest);

    const entry = {
      id: manifest.id,
      type: manifest.type,
      version: manifest.version,
      name: manifest.name,
      description: manifest.description,
      category: manifest.category,
      tags: manifest.tags || [],
      status: manifest.status,
      path: relPath.replace(/\/manifest\.json$/, ''),
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

  const index = {
    $schema: 'schemas/index.schema.json',
    generatedAt: new Date().toISOString(),
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
