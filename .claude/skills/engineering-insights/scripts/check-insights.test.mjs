// Self-test for check-insights.mjs — dependency-free (node:test, Node >= 22).
// Run: node --test .claude/skills/engineering-insights/scripts/check-insights.test.mjs
// Each case writes a minimal INSIGHTS.md to a temp dir and runs the validator on it
// (`--skip-append-check`: the fixtures are not in git).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VALIDATOR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'check-insights.mjs');
const SECTIONS = [
  'What Works',
  "What Doesn't Work",
  'Codebase Patterns',
  'Tool & Library Notes',
  'Recurring Errors & Fixes',
  'Session Notes',
  'Open Questions',
];

/** Build an INSIGHTS.md with `entry` (lines) placed in `section`, then validate it. */
function validate(section, entry) {
  const body = SECTIONS.map((s) => `## ${s}\n${s === section ? `\n${entry.join('\n')}\n` : ''}`).join('\n');
  const dir = mkdtempSync(path.join(tmpdir(), 'insights-check-'));
  const file = path.join(dir, 'INSIGHTS.md');
  writeFileSync(file, `# Insights — fixture\n\n${body}`);
  try {
    const r = spawnSync(process.execPath, [VALIDATOR, '--skip-append-check', file], { encoding: 'utf8' });
    return { code: r.status, out: r.stdout + r.stderr };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const insight = (where) => [
  '### 2026-10-16 · area · A rule',
  'What: a fact.',
  'Do: ALWAYS do the thing.',
  ...(where === undefined ? [] : [where]),
  'Status: open',
];

test('valid: single path:line', () => {
  const r = validate('Codebase Patterns', insight('Where: src/foo.ts:42'));
  assert.equal(r.code, 0, r.out);
});

test('valid: several path:line, ranges and bracketed route paths', () => {
  const r = validate(
    'Codebase Patterns',
    insight('Where: src/foo.ts:42 · test/foo.test.ts:88-90 · src/app/[repoId]/page.tsx:35'),
  );
  assert.equal(r.code, 0, r.out);
});

test('valid: one path:line is enough, also on a wrapped continuation line', () => {
  const r = validate('Codebase Patterns', [
    '### 2026-10-16 · area · A rule',
    'What: a fact.',
    'Do: ALWAYS do the thing.',
    'Where: src/a.ts ·',
    'src/b.ts:3',
    'Status: open',
  ]);
  assert.equal(r.code, 0, r.out);
});

test('invalid: Where with a path only', () => {
  const r = validate('Codebase Patterns', insight('Where: src/foo.ts'));
  assert.equal(r.code, 1);
  assert.match(r.out, /needs at least one path:line/);
});

test('invalid: Where with several paths, none with a line', () => {
  const r = validate('Codebase Patterns', insight('Where: src/foo.ts · test/foo.test.ts'));
  assert.equal(r.code, 1);
  assert.match(r.out, /needs at least one path:line/);
});

test('invalid: non-numeric line reference', () => {
  const r = validate('Codebase Patterns', insight('Where: src/foo.ts:abc'));
  assert.equal(r.code, 1);
  assert.match(r.out, /needs at least one path:line/);
});

test('invalid: empty Where', () => {
  const r = validate('Codebase Patterns', insight('Where:'));
  assert.equal(r.code, 1);
  assert.match(r.out, /needs at least one path:line/);
});

test('invalid: missing Where', () => {
  const r = validate('Codebase Patterns', insight(undefined));
  assert.equal(r.code, 1);
  assert.match(r.out, /entry missing "Where:"/);
});

test('invalid: Session Note without evidence', () => {
  const r = validate('Session Notes', ['### 2026-10-16 · Some task', 'Did X; added "A rule".']);
  assert.equal(r.code, 1);
  assert.match(r.out, /entry missing "Where:"/);
});

test('invalid: Session Note with a path-only Where', () => {
  const r = validate('Session Notes', ['### 2026-10-16 · Some task', 'Did X.', 'Where: src/foo.ts']);
  assert.equal(r.code, 1);
  assert.match(r.out, /needs at least one path:line/);
});

test('valid: Session Note with Where path:line', () => {
  const r = validate('Session Notes', ['### 2026-10-16 · Some task', 'Did X.', 'Where: src/foo.ts:42']);
  assert.equal(r.code, 0, r.out);
});

test('unchanged: entries dated before the skill still need no Do:', () => {
  const r = validate('Codebase Patterns', [
    '### 2026-09-25 · area · A migrated rule',
    'What: a fact.',
    'Where: src/foo.ts:1',
    'Status: open',
  ]);
  assert.equal(r.code, 0, r.out);
});
