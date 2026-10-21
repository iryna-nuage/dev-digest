// Unit tests for the pure helpers. Run: node --test .claude/skills/pr-self-review/scripts/*.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bucketFiles,
  evaluateFindings,
  gateDecision,
  gatedAction,
  globToRegExp,
  isGrounded,
  loadSkillMap,
  parseHunks,
  parseNameStatus,
  unmappedSkills,
} from './lib.mjs';

const map = loadSkillMap();
const file = (p, extra = {}) => ({ path: p, status: 'M', binary: false, hunks: [[1, 5]], ...extra });

test('globToRegExp handles **, * and braces', () => {
  assert.ok(globToRegExp('client/src/**/*.{ts,tsx}').test('client/src/app/repos/[repoId]/page.tsx'));
  assert.ok(globToRegExp('client/src/**/*.{ts,tsx}').test('client/src/a.ts'));
  assert.ok(!globToRegExp('client/src/**/*.{ts,tsx}').test('client/src/a.css'));
  assert.ok(globToRegExp('server/src/modules/**/repository*.ts').test('server/src/modules/pulls/repository.ts'));
  assert.ok(!globToRegExp('server/src/*.ts').test('server/src/db/x.ts'));
});

test('client files go only to UI skills, server files only to backend skills', () => {
  const files = [
    file('client/src/app/repos/[repoId]/pulls/page.tsx'),
    file('client/src/app/repos/[repoId]/pulls/helpers.test.ts'),
    file('server/src/modules/pulls/routes.ts'),
    file('server/src/modules/pulls/repository.ts'),
    file('reviewer-core/src/grounding.ts'),
  ];
  const b = bucketFiles(files, map, () => '');
  assert.deepEqual(b['frontend-architecture'], ['client/src/app/repos/[repoId]/pulls/helpers.test.ts', 'client/src/app/repos/[repoId]/pulls/page.tsx']);
  assert.deepEqual(b['react-testing-library'], ['client/src/app/repos/[repoId]/pulls/helpers.test.ts']);
  assert.deepEqual(b['onion-architecture'], ['server/src/modules/pulls/repository.ts', 'server/src/modules/pulls/routes.ts']);
  assert.deepEqual(b['fastify-best-practices'], ['server/src/modules/pulls/routes.ts']);
  assert.deepEqual(b['drizzle-orm-patterns'], ['server/src/modules/pulls/repository.ts']);
  assert.ok(!b['onion-architecture'].some((p) => p.startsWith('client/')));
  assert.ok(!b['frontend-architecture'].some((p) => !p.startsWith('client/')));
  assert.ok(b['typescript-expert'].includes('reviewer-core/src/grounding.ts'));
  assert.ok(!b['zod'], 'zod only on content match');
});

test('contentMatch, deletions, vendor and docs are respected', () => {
  const files = [
    file('server/src/modules/pulls/service.ts'),
    file('server/src/vendor/shared/contracts/findings.ts'),
    file('client/src/lib/gone.ts', { status: 'D' }),
    file('client/INSIGHTS.md'),
  ];
  const b = bucketFiles(files, map, (p) => (p.endsWith('service.ts') ? "import { z } from 'zod';" : ''));
  assert.deepEqual(b['zod'], ['server/src/modules/pulls/service.ts']);
  assert.ok(!Object.values(b).flat().includes('client/src/lib/gone.ts'));
  assert.ok(!Object.values(b).flat().includes('client/INSIGHTS.md'));
  assert.ok(!b['onion-architecture'].includes('server/src/vendor/shared/contracts/findings.ts'));
});

test('unmappedSkills reports skills neither mapped nor ignored', () => {
  assert.deepEqual(unmappedSkills(['onion-architecture', 'mermaid-diagram', 'brand-new'], map), ['brand-new']);
});

test('parseNameStatus keeps the new path of renames', () => {
  const z = ['M', 'a.ts', 'R087', 'old.ts', 'new.ts', 'A', 'b c.ts', ''].join('\0');
  assert.deepEqual(parseNameStatus(z), [
    { path: 'a.ts', status: 'M' },
    { path: 'new.ts', status: 'R' },
    { path: 'b c.ts', status: 'A' },
  ]);
});

test('parseHunks reads new-side ranges and skips pure deletions', () => {
  const diff = [
    'diff --git a/x.ts b/x.ts',
    '--- a/x.ts',
    '+++ b/x.ts',
    '@@ -1,0 +2,3 @@',
    '@@ -10 +12 @@',
    '@@ -20,2 +23,0 @@',
    'diff --git a/gone.ts b/gone.ts',
    '--- a/gone.ts',
    '+++ /dev/null',
    '@@ -1,3 +0,0 @@',
  ].join('\n');
  assert.deepEqual(parseHunks(diff), { 'x.ts': [[2, 4], [12, 12]] });
});

test('isGrounded checks a single line against the hunks', () => {
  assert.ok(isGrounded([[2, 4]], 3));
  assert.ok(!isGrounded([[2, 4]], 5));
  assert.ok(!isGrounded([[2, 4]], undefined));
});

const base = { skill: 'onion-architecture', rule: '[O5]', file: 'server/src/a.ts', line: 3, title: 't', source: 'llm' };
const files = { 'server/src/a.ts': { path: 'server/src/a.ts', hunks: [[1, 5]] } };

test('CRITICAL without verification makes the verdict incomplete', () => {
  const r = evaluateFindings([{ ...base, severity: 'CRITICAL' }], files);
  assert.equal(r.verdict, 'incomplete');
  assert.equal(r.unverified.length, 1);
});

test('only confirmed CRITICALs block; rejected and downgraded do not', () => {
  const v = (status, extra = {}) => ({ status, reason: 'checked line 3', verifier: 'independent-subagent', ...extra });
  assert.equal(evaluateFindings([{ ...base, severity: 'CRITICAL', verification: v('confirmed') }], files).verdict, 'block');
  const rej = evaluateFindings([{ ...base, severity: 'CRITICAL', verification: v('rejected') }], files);
  assert.equal(rej.verdict, 'pass');
  assert.equal(rej.rejected.length, 1);
  const down = evaluateFindings([{ ...base, severity: 'CRITICAL', verification: v('downgraded', { severity: 'WARNING' }) }], files);
  assert.equal(down.verdict, 'pass');
  assert.equal(down.kept[0].severity, 'WARNING');
  assert.equal(evaluateFindings([{ ...base, severity: 'CRITICAL', verification: v('downgraded') }], files).verdict, 'invalid');
});

test('LLM findings off the changed lines are dropped; check findings need no line', () => {
  const r = evaluateFindings(
    [
      { ...base, severity: 'CRITICAL', line: 99 },
      { ...base, severity: 'WARNING', file: 'server/src/untouched.ts' },
      { skill: 'repo-gates', rule: 'typecheck', severity: 'WARNING', title: 'not run', source: 'check:typecheck' },
    ],
    files,
  );
  assert.equal(r.ungrounded.length, 2);
  assert.equal(r.kept.length, 1);
  assert.equal(r.verdict, 'pass');
});

test('duplicates on the same file+line+rule keep the highest severity', () => {
  const r = evaluateFindings(
    [
      { ...base, severity: 'WARNING', skill: 'typescript-expert' },
      { ...base, severity: 'SUGGESTION', skill: 'zod' },
    ],
    files,
  );
  assert.equal(r.kept.length, 1);
  assert.equal(r.kept[0].severity, 'WARNING');
});

test('invalid findings are rejected with reasons', () => {
  const r = evaluateFindings([{ ...base, severity: 'HIGH' }, { ...base, severity: 'WARNING', source: 'manual' }], files);
  assert.equal(r.verdict, 'invalid');
  assert.ok(r.errors.length >= 2);
});

test('gatedAction matches PR and push commands in Bash and PowerShell forms', () => {
  for (const c of [
    'gh pr create --fill',
    'gh pr merge 12 --squash',
    'git push',
    'git push -u origin hw/l01',
    'git -C D:/ProjectsDev/dev-digest push origin HEAD',
    'cd client && git push --force-with-lease',
    'pnpm test; git push',
    '& git push origin main',
    'git.exe push',
    'git commit -m "wip" && git push',
    "cat > x.txt <<'EOF'\nnotes\nEOF\ngit push",
  ]) {
    assert.ok(gatedAction(c), c);
  }
  for (const c of [
    'git status',
    'git push --dry-run',
    'git push origin --delete old',
    'git push origin :old',
    'git push --tags',
    'echo "git push"',
    "grep -rn 'gh pr create' .",
    'git log --grep=push',
    'gh pr view 12',
    'git pushx',
    "node -e \"run('cd client; git push')\"",
    "cat > x.mjs <<'EOF'\nconst c = 'a; git push';\ngit push\nEOF\nnode x.mjs",
    "$s = @'\ngit push\n'@",
    'git commit -m "fix; gh pr create later"',
    undefined,
  ]) {
    assert.equal(gatedAction(c), null, String(c));
  }
});

test('gateDecision', () => {
  assert.equal(gateDecision(null, 'h').allow, false);
  assert.equal(gateDecision({ diffHash: 'old', verdict: 'pass' }, 'h').allow, false);
  assert.equal(gateDecision({ diffHash: 'h', verdict: 'pass' }, 'h').allow, true);
  assert.equal(gateDecision({ diffHash: 'h', verdict: 'block', blocking: [] }, 'h').allow, false);
  assert.equal(gateDecision({ diffHash: 'h', verdict: 'incomplete' }, 'h').allow, false);
  const o = gateDecision({ diffHash: 'h', verdict: 'override', override: { by: 'me', reason: 'r', findings: ['a'] } }, 'h');
  assert.equal(o.allow, true);
  assert.match(o.notice, /OVERRIDDEN by me/);
});
