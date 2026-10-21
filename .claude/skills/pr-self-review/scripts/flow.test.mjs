// End-to-end flow in a throwaway git repo: plan → verdict → gate → override → stale diff.
// Run: node --test .claude/skills/pr-self-review/scripts/*.test.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPTS = path.dirname(fileURLToPath(import.meta.url));
let repo;

const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', windowsHide: true });
const node = (script, args = [], input) =>
  spawnSync(process.execPath, [path.join(SCRIPTS, script), ...args], { cwd: repo, input, encoding: 'utf8', windowsHide: true });
const gate = (command, tool = 'Bash') =>
  node('gate.mjs', [], JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: tool, tool_input: { command }, cwd: repo }));
const write = (p, s) => {
  mkdirSync(path.dirname(path.join(repo, p)), { recursive: true });
  writeFileSync(path.join(repo, p), s);
};

before(() => {
  repo = mkdtempSync(path.join(tmpdir(), 'pr-self-review-'));
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 'Test User');
  git('config', 'user.email', 'test@example.com');
  git('config', 'commit.gpgsign', 'false');
  write('server/src/modules/pulls/service.ts', 'export const a = 1;\n');
  git('add', '.');
  git('commit', '-q', '-m', 'init');
  git('checkout', '-q', '-b', 'feature');
  write('server/src/modules/pulls/service.ts', 'export const a = 1;\nexport const b = 2;\n');
  write('client/src/app/page.tsx', 'export default function Page() { return null; }\n');
});

after(() => rmSync(repo, { recursive: true, force: true }));

test('collect-diff buckets tracked and untracked changes', () => {
  const r = node('collect-diff.mjs');
  assert.equal(r.status, 0, r.stderr);
  const plan = JSON.parse(r.stdout);
  assert.equal(plan.baseRef, 'main');
  assert.deepEqual(plan.files.map((f) => f.path).sort(), ['client/src/app/page.tsx', 'server/src/modules/pulls/service.ts']);
  assert.deepEqual(plan.files.find((f) => f.path.startsWith('server')).hunks, [[2, 2]]);
  assert.deepEqual(plan.buckets['onion-architecture'], ['server/src/modules/pulls/service.ts']);
  assert.deepEqual(plan.buckets['frontend-architecture'], ['client/src/app/page.tsx']);
});

test('gate ignores unrelated commands and fails open on garbage input', () => {
  assert.equal(gate('git status').status, 0);
  assert.equal(gate('Get-ChildItem', 'PowerShell').status, 0);
  assert.equal(node('gate.mjs', [], 'not json').status, 0);
  assert.equal(node('gate.mjs', [], '').status, 0);
});

test('gate blocks a PR without a verdict', () => {
  const r = gate('gh pr create --fill');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /No PR self-review verdict/);
});

const critical = {
  skill: 'onion-architecture',
  rule: '[O5] rules/application-services.md',
  severity: 'CRITICAL',
  file: 'server/src/modules/pulls/service.ts',
  line: 2,
  title: 'Service imports drizzle-orm',
  evidence: 'line 2',
  source: 'llm',
};

function verdictWith(findings) {
  const f = path.join(repo, '.git', 'findings.json');
  writeFileSync(f, JSON.stringify({ findings }));
  return node('write-verdict.mjs', ['--findings', f]);
}

test('an unverified CRITICAL gives incomplete, which blocks', () => {
  const r = verdictWith([critical]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /INCOMPLETE/);
  assert.match(gate('git push -u origin feature', 'PowerShell').stderr, /incomplete/);
});

test('a verified CRITICAL blocks; override needs a reason and then lets it through', () => {
  const r = verdictWith([{ ...critical, verification: { status: 'confirmed', reason: 'line 2 imports drizzle', verifier: 'independent-subagent' } }]);
  assert.match(r.stdout, /BLOCKED/);
  const blocked = gate('git push');
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /BLOCKED: 1 verified CRITICAL/);

  assert.equal(node('override.mjs', ['--all']).status, 1, 'reason required');
  assert.equal(node('override.mjs', ['--reason', 'too short', '--all']).status, 1);
  assert.equal(node('override.mjs', ['--reason', 'false positive: it is a type import only', '--finding', 'deadbeef']).status, 1);

  const o = node('override.mjs', ['--reason', 'false positive: the import is a type-only re-export', '--all']);
  assert.equal(o.status, 0, o.stderr);
  const pass = gate('gh pr create --fill');
  assert.equal(pass.status, 0, pass.stderr);
  assert.match(JSON.parse(pass.stdout).systemMessage, /OVERRIDDEN by Test User/);
});

test('any later change invalidates the verdict and the override', () => {
  write('client/src/app/page.tsx', 'export default function Page() { return 1; }\n');
  const r = gate('git push');
  assert.equal(r.status, 2);
  assert.match(r.stderr, /differ from the last PR self-review/);
});

test('a clean review passes the gate, committing keeps it valid', () => {
  assert.match(verdictWith([]).stdout, /PASS/);
  assert.equal(gate('git push').status, 0);
  git('add', '.');
  git('commit', '-q', '-m', 'feature');
  assert.equal(gate('git push').status, 0, 'same diff vs base after committing');
});
