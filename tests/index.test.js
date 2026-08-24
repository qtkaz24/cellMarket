import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const ROOT = new URL('..', import.meta.url);
const ROOT_PATH = decodeURIComponent(ROOT.pathname.replace(/^\/(.:)/, '$1'));
const INDEX_PATH = join(ROOT_PATH, 'index.json');

function buildIndex() {
  return spawnSync(process.execPath, ['scripts/build-index.js'], {
    cwd: ROOT_PATH,
    encoding: 'utf8',
  });
}

test('building an unchanged catalog twice produces identical index bytes', () => {
  const original = readFileSync(INDEX_PATH, 'utf8');
  try {
    const firstResult = buildIndex();
    assert.equal(firstResult.status, 0, `${firstResult.stdout}\n${firstResult.stderr}`);
    const first = readFileSync(INDEX_PATH, 'utf8');

    const secondResult = buildIndex();
    assert.equal(secondResult.status, 0, `${secondResult.stdout}\n${secondResult.stderr}`);
    const second = readFileSync(INDEX_PATH, 'utf8');

    assert.equal(second, first);
  } finally {
    writeFileSync(INDEX_PATH, original);
  }
});

test('manifest checksums are identical for CRLF and LF checkouts', () => {
  const original = readFileSync(INDEX_PATH, 'utf8');
  const fixtureRoot = join(ROOT_PATH, 'agents', '__index_test__', 'checksum');
  const manifest = '{\r\n  "id": "agent.9999996",\r\n  "type": "agent",\r\n  "version": "1.0.0",\r\n  "name": "Checksum fixture",\r\n  "description": "Line ending normalization.",\r\n  "category": "coding",\r\n  "status": "active"\r\n}\r\n';
  mkdirSync(fixtureRoot, { recursive: true });
  writeFileSync(join(fixtureRoot, 'manifest.json'), manifest);
  try {
    const result = buildIndex();
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
    const entry = index.entries.find(candidate => candidate.id === 'agent.9999996');

    assert.equal(entry.checksum, '92a397b38b2ee892');
  } finally {
    rmSync(join(ROOT_PATH, 'agents', '__index_test__'), { recursive: true, force: true });
    writeFileSync(INDEX_PATH, original);
  }
});
