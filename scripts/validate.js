import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');

const SCHEMA_MAP = {
  agent: 'schemas/agent.schema.json',
  team: 'schemas/team.schema.json',
  workflow: 'schemas/workflow.schema.json',
};

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_MANIFEST_SIZE_BYTES = 100 * 1024;
const ALLOWED_MEDIA_EXTS = ['.svg', '.png', '.webp', '.avif', '.jpg'];
const ALLOWED_PERMISSIONS = new Set([
  'fs.read',
  'fs.write',
  'network.api',
  'network.mcp',
  'plugin.install',
  'skill.install',
  'terminal',
  'terminal.run',
]);
const INSTRUCTION_CAPABILITY_RULES = [
  {
    permission: 'terminal.run',
    pattern: /\b(?:npx|npm\s+(?:install|i)|pnpm\s+(?:add|install)|yarn\s+add|pip3?\s+install|brew\s+install)\b/i,
  },
  {
    permission: 'terminal.run',
    pattern: /(?:\b(?:curl|wget)\b[^\n|;&]*(?:\||&&|;)\s*(?:sh|bash|zsh)\b|\b(?:irm|iwr|Invoke-WebRequest)\b[^\n|]*\|\s*(?:iex|Invoke-Expression)\b)/i,
  },
  {
    permission: 'skill.install',
    pattern: /\b(?:npx\s+)?skills?\s+(?:add|install)\b/i,
  },
];
const UNSAFE_SVG_PATTERNS = [
  /<script\b/i,
  /<foreignObject\b/i,
  /<(?:iframe|object|embed)\b/i,
  /<!DOCTYPE\b|<!ENTITY\b/i,
  /\bon[a-z]+\s*=/i,
  /javascript\s*:|data\s*:\s*text\/html/i,
  /@import\b/i,
  /(?:xlink:)?href\s*=\s*["']\s*(?!#)/i,
  /url\(\s*["']?\s*(?:https?:|data:|file:|\/\/)/i,
];

const ajv = new Ajv({ allErrors: true, strict: false, removeAdditional: false });
addFormats(ajv);

const compiledValidators = {};
for (const [type, schemaPath] of Object.entries(SCHEMA_MAP)) {
  const schema = JSON.parse(readFileSync(join(ROOT, schemaPath), 'utf-8'));
  compiledValidators[type] = ajv.compile(schema);
}

let errors = 0;
let warnings = 0;
const seenIds = new Map();
const seenVersions = new Map();

function error(path, msg) {
  console.error(`  ERROR: ${path}: ${msg}`);
  errors++;
}

function warn(path, msg) {
  console.warn(`  WARN:  ${path}: ${msg}`);
  warnings++;
}

function loadJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (e) {
    error(filePath, `Invalid JSON: ${e.message}`);
    return null;
  }
}

function validateSvgContent(filePath, svgPath) {
  if (extname(svgPath).toLowerCase() !== '.svg') return true;

  const content = readFileSync(svgPath, 'utf-8');
  if (UNSAFE_SVG_PATTERNS.some(pattern => pattern.test(content))) {
    error(filePath, `Unsafe SVG content: ${relative(ROOT, svgPath)}`);
    return false;
  }

  return true;
}

function validateSchema(filePath, manifest, type) {
  const validate = compiledValidators[type];
  if (!validate) {
    error(filePath, `Unknown type: ${type}`);
    return false;
  }

  const valid = validate(manifest);

  if (!valid) {
    for (const err of validate.errors) {
      const path = err.instancePath || '';
      error(filePath, `${err.instancePath} ${err.message}`);
    }
    return false;
  }

  return true;
}

function validateId(filePath, manifest) {
  const id = manifest.id;
  if (seenIds.has(id)) {
    const prevPath = seenIds.get(id);
    error(filePath, `Duplicate ID "${id}" — first seen in ${prevPath}`);
    return false;
  }
  seenIds.set(id, filePath);
  return true;
}

function validateVersion(filePath, manifest) {
  const id = manifest.id;
  const version = manifest.version;

  if (seenVersions.has(id)) {
    const versions = seenVersions.get(id);
    if (versions.includes(version)) {
      error(filePath, `Duplicate version ${version} for ID "${id}"`);
      return false;
    }
    versions.push(version);
  } else {
    seenVersions.set(id, [version]);
  }

  const parts = version.split('.');
  if (parts.length !== 3 || parts.some(p => isNaN(Number(p)) || Number(p) < 0)) {
    error(filePath, `Invalid semver: ${version}`);
    return false;
  }

  return true;
}

function validateMediaFiles(filePath, manifest) {
  const dir = join(ROOT, dirname(filePath));
  const media = manifest.media;
  if (!media) return true;

  const filesToCheck = [];

  if (media.icon) {
    const iconPath = join(dir, media.icon.src);
    filesToCheck.push({ expected: iconPath, label: 'icon' });
  }

  if (media.hero) {
    const heroPath = join(dir, media.hero.src);
    filesToCheck.push({ expected: heroPath, label: 'hero' });
  }

  if (media.images) {
    const orders = media.images.map(i => i.order);
    const uniqueOrders = new Set(orders);
    if (uniqueOrders.size !== orders.length) {
      error(filePath, 'Duplicate order values in media.images');
    }

    for (const img of media.images) {
      const imgPath = join(dir, img.src);
      filesToCheck.push({ expected: imgPath, label: `image[${img.order}]` });

      if (!img.alt || img.alt.trim() === '') {
        error(filePath, `Missing alt text for image: ${img.src}`);
      }
    }
  }

  for (const { expected, label } of filesToCheck) {
    if (!existsSync(expected)) {
      error(filePath, `Missing media file for ${label}: ${relative(ROOT, expected)}`);
      continue;
    }

    const stat = statSync(expected);
    if (stat.size > MAX_FILE_SIZE_BYTES) {
      error(filePath, `Media file too large (${(stat.size / 1024 / 1024).toFixed(1)}MB > 10MB): ${label}`);
      continue;
    }

    validateSvgContent(filePath, expected);
  }

  // Check for unexpected files in media/
  if (existsSync(dir)) {
    const mediaDir = join(dir, 'media');
    if (existsSync(mediaDir)) {
      const allowed = new Set();
      if (media.images) {
        for (const img of media.images) allowed.add(img.src.replace('media/', ''));
      }
      if (media.hero) allowed.add(media.hero.src.replace('media/', ''));
      if (media.icon && media.icon.src.startsWith('media/')) {
        allowed.add(media.icon.src.replace('media/', ''));
      }

      const mediaFiles = readdirSync(mediaDir);
      for (const f of mediaFiles) {
        if (!allowed.has(f)) {
          warn(filePath, `Unexpected file in media/: ${f}`);
        }
        const ext = extname(f).toLowerCase();
        if (!ALLOWED_MEDIA_EXTS.includes(ext)) {
          error(filePath, `Disallowed media extension "${ext}" in media/${f}`);
        }
      }
    }
  }

  return true;
}

function validatePermissions(filePath, manifest) {
  const perms = manifest.agent?.permissions || manifest.team?.members?.flatMap(m => m.permissions || []) || manifest.workflow?.permissions || [];
  for (const p of perms) {
    if (typeof p !== 'string' || !/^[a-z][a-z0-9.]*$/.test(p)) {
      error(filePath, `Invalid permission format: "${p}"`);
    } else if (!ALLOWED_PERMISSIONS.has(p)) {
      error(filePath, `Unknown permission: "${p}"`);
    }
  }

  const instructions = [manifest.longDescription, manifest.agent?.instructions]
    .filter(value => typeof value === 'string')
    .join('\n');
  const declared = new Set(perms);
  for (const { permission, pattern } of INSTRUCTION_CAPABILITY_RULES) {
    if (pattern.test(instructions) && !declared.has(permission)) {
      error(filePath, `Instructions require permission "${permission}"`);
    }
  }

  return true;
}

function validateTeamReferences(filePath, manifest) {
  if (manifest.type !== 'team') return true;

  for (const member of manifest.team.members) {
    if (member.delegates) {
      for (const d of member.delegates) {
        if (!seenIds.has(d)) {
          warn(filePath, `Delegate agent "${d}" not found in catalog`);
        }
      }
    }
  }
  return true;
}

function validateWorkflowReferences(filePath, manifest) {
  if (manifest.type !== 'workflow') return true;

  if (manifest.workflow.agents) {
    for (const agent of manifest.workflow.agents) {
      if (!seenIds.has(agent.agentId)) {
        warn(filePath, `Referenced agent "${agent.agentId}" not found in catalog`);
      }
    }
  }

  if (manifest.workflow.actions) {
    const actionNames = new Set(manifest.workflow.actions.map(a => a.name));
    for (const action of manifest.workflow.actions) {
      if (action.next && !actionNames.has(action.next)) {
        error(filePath, `Action "${action.name}" references unknown next action "${action.next}"`);
      }
    }
  }

  return true;
}

function validateSecurity(filePath, manifest) {
  const content = JSON.stringify(manifest);
  if (content.length > MAX_MANIFEST_SIZE_BYTES) {
    error(filePath, `Manifest too large (${(content.length / 1024).toFixed(1)}KB > 100KB)`);
  }

  const dir = join(ROOT, dirname(filePath));
  if (!dir.startsWith(ROOT)) {
    error(filePath, 'Path traversal detected');
  }

  return true;
}

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

function main() {
  console.log('=== Agent Marketplace Validation ===\n');

  const manifests = findAllManifests();

  if (manifests.length === 0) {
    console.log('No manifests found.');
    process.exit(0);
  }

  console.log(`Found ${manifests.length} manifest(s)\n`);

  console.log('--- Pass 1: Schema, ID, Version ---');
  const parsedManifests = [];

  for (const manifestPath of manifests) {
    const relPath = relative(ROOT, manifestPath);
    const manifest = loadJson(manifestPath);
    if (!manifest) continue;

    console.log(`  Validating: ${relPath}`);

    if (!manifest.type) {
      error(relPath, 'Missing "type" field');
      continue;
    }

    validateSchema(relPath, manifest, manifest.type);
    validateId(relPath, manifest);
    validateVersion(relPath, manifest);
    validatePermissions(relPath, manifest);
    validateSecurity(relPath, manifest);
    validateMediaFiles(relPath, manifest);

    parsedManifests.push({ path: relPath, manifest });
  }

  console.log('\n--- Pass 2: Cross-references ---');
  for (const { path: p, manifest } of parsedManifests) {
    validateTeamReferences(p, manifest);
    validateWorkflowReferences(p, manifest);
  }

  console.log(`\n=== Results ===`);
  console.log(`  Manifests scanned: ${manifests.length}`);
  console.log(`  Unique IDs:        ${seenIds.size}`);
  console.log(`  Errors:            ${errors}`);
  console.log(`  Warnings:          ${warnings}`);

  if (errors > 0) {
    console.log('\nValidation FAILED');
    process.exit(1);
  }

  console.log('\nValidation PASSED');
}

main();
