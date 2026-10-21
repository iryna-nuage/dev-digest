#!/usr/bin/env node
// Step 3 of pr-self-review: deterministic repo gates from CLAUDE.md (rules/repo-gates.md). Each
// failure becomes a finding with `source: "check:<name>"`; a check that cannot run is reported
// as a WARNING, never skipped silently.
// Usage: node .claude/skills/pr-self-review/scripts/run-checks.mjs [--base <ref>] [--out <file>] [--skip-typecheck]
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { collectDiff, git, repoRoot, resolveBaseRef } from './lib.mjs';

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

const root = repoRoot();
const baseRef = resolveBaseRef(root, arg('--base'));
const diff = collectDiff(root, baseRef);
const changed = new Map(diff.files.map((f) => [f.path, f]));
const findings = [];
const ran = [];

const ONION = '../.claude/skills/onion-architecture/scripts';
const PACKAGES = {
  client: { lock: 'client/pnpm-lock.yaml', typecheck: 'pnpm typecheck' },
  server: { lock: 'server/pnpm-lock.yaml', typecheck: 'pnpm typecheck' },
  'reviewer-core': { lock: 'reviewer-core/package-lock.json', typecheck: 'npm run typecheck' },
  e2e: { lock: 'e2e/package-lock.json', typecheck: 'npm run typecheck' },
};

function add(check, severity, title, extra = {}) {
  findings.push({ skill: 'repo-gates', rule: `rules/repo-gates.md#${check}`, severity, title, source: `check:${check}`, ...extra });
}

/** Runs a fixed command string through the platform shell (needed for .cmd shims on Windows). */
function sh(command, cwd) {
  const r = spawnSync(command, { cwd, shell: true, encoding: 'utf8', windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status ?? 1, output: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim(), error: r.error };
}

function excerpt(text, lines = 40) {
  const all = text.split(/\r?\n/);
  return all.length > lines ? `${all.slice(0, lines).join('\n')}\n… (${all.length - lines} more lines)` : text;
}

function atBase(p) {
  return git(['show', `${diff.base}:${p}`], { cwd: root, allowFail: true });
}

function readNow(p) {
  try {
    return readFileSync(path.join(root, p), 'utf8');
  } catch {
    return null;
  }
}

const isCode = (p) => /\.(ts|tsx|mts|cts|js|mjs|cjs)$/.test(p) || /(^|\/)tsconfig[^/]*\.json$/.test(p) || /(^|\/)package\.json$/.test(p);

// 1. Onion layering (dependency-cruiser with the legacy baseline).
if ([...changed.keys()].some((p) => p.startsWith('server/src/') && isCode(p))) {
  const serverDir = path.join(root, 'server');
  if (!existsSync(path.join(serverDir, 'node_modules', '.bin'))) {
    ran.push({ check: 'onion-depcruise', status: 'not-run', detail: 'server/node_modules missing' });
    add('onion-depcruise', 'WARNING', 'Onion import check not run: run `pnpm install` in server/ and re-run /pr-self-review');
  } else {
    const cmd = `npx --no-install depcruise src --config ${ONION}/onion.depcruise.cjs --ignore-known ${ONION}/known-violations.json --output-type err-long`;
    const r = sh(cmd, serverDir);
    ran.push({ check: 'onion-depcruise', status: r.status === 0 ? 'passed' : 'failed', command: `(server/) ${cmd}` });
    if (r.status !== 0) {
      const violations = [...r.output.matchAll(/^\s*(?:error|warn)\s+([\w-]+):\s+(\S+)\s+→\s+(\S+)/gm)];
      if (violations.length === 0) {
        add('onion-depcruise', 'CRITICAL', 'dependency-cruiser onion check failed', { evidence: excerpt(r.output) });
      }
      for (const [, rule, from, to] of violations) {
        add('onion-depcruise', 'CRITICAL', `New onion violation ${rule}: ${from} → ${to}`, {
          file: `server/${from}`,
          evidence: `${cmd}\n${rule}: ${from} → ${to}`,
          fix: 'See .claude/skills/onion-architecture/rules/enforcement.md, table "Rules"',
        });
      }
    }
  }
}

// 2. The onion baseline only shrinks.
const BASELINE = '.claude/skills/onion-architecture/scripts/known-violations.json';
if (changed.has(BASELINE)) {
  const count = (t) => {
    try {
      return JSON.parse(t).length;
    } catch {
      return null;
    }
  };
  // A baseline created on this branch has nothing to grow from.
  const original = atBase(BASELINE);
  const before = original === null ? null : count(original);
  const after = count(readNow(BASELINE) ?? '[]');
  const grew = before !== null && after !== null && after > before;
  ran.push({ check: 'onion-baseline', status: grew ? 'failed' : 'passed', detail: original === null ? `new baseline, ${after} entries` : `${before} → ${after}` });
  if (grew) {
    add('onion-baseline', 'CRITICAL', `Onion baseline grew from ${before} to ${after} known violations`, {
      file: BASELINE,
      evidence: `known-violations.json entries: ${before} at ${diff.base.slice(0, 8)}, ${after} now`,
      fix: 'Fix the new violation instead of regenerating the baseline (enforcement.md "Baseline policy")',
    });
  }
}

// 3. @devdigest/shared exists twice; a change must land in both copies.
const SERVER_SHARED = 'server/src/vendor/shared/';
const CLIENT_SHARED = 'client/src/vendor/shared/';
let parityChecked = 0;
for (const p of changed.keys()) {
  const [mine, other] = p.startsWith(SERVER_SHARED)
    ? [SERVER_SHARED, CLIENT_SHARED]
    : p.startsWith(CLIENT_SHARED)
      ? [CLIENT_SHARED, SERVER_SHARED]
      : [null, null];
  if (!mine) continue;
  parityChecked++;
  const twin = other + p.slice(mine.length);
  if (changed.has(twin) || readNow(p) === readNow(twin)) continue;
  add('shared-contract-parity', 'CRITICAL', `${p} changed but its copy ${twin} did not`, {
    file: p,
    line: changed.get(p).hunks[0]?.[0],
    evidence: `${p} is in the diff, ${twin} is not, and their contents differ`,
    fix: `Apply the same change to ${twin} (root CLAUDE.md "Conventions")`,
  });
}
if (parityChecked) ran.push({ check: 'shared-contract-parity', status: findings.some((f) => f.source === 'check:shared-contract-parity') ? 'failed' : 'passed' });

// 4. Migrations are generated by `pnpm db:generate`, never hand-edited.
const MIGRATIONS = 'server/src/db/migrations/';
const migrationFiles = [...changed.values()].filter((f) => f.path.startsWith(MIGRATIONS));
if (migrationFiles.length) {
  const journalChanged = changed.has(`${MIGRATIONS}meta/_journal.json`);
  for (const f of migrationFiles) {
    if (!f.path.endsWith('.sql')) continue;
    if (f.status !== 'A') {
      add('migrations', 'CRITICAL', `Existing migration ${f.path} was ${f.status === 'D' ? 'deleted' : 'modified'}`, {
        file: f.path,
        line: f.hunks[0]?.[0],
        evidence: `git status ${f.status} for an applied migration`,
        fix: 'Revert it and add a new migration with `pnpm db:generate` (server/CLAUDE.md)',
      });
    } else if (!journalChanged) {
      add('migrations', 'CRITICAL', `New migration ${f.path} without a meta/_journal.json entry`, {
        file: f.path,
        evidence: 'migrations/meta/_journal.json is not in the diff',
        fix: 'Generate migrations with `pnpm db:generate`, never by hand',
      });
    }
  }
  ran.push({ check: 'migrations', status: findings.some((f) => f.source === 'check:migrations') ? 'failed' : 'passed' });
}

// 5. Lock files change only together with their package.json, through the package manager.
for (const [pkg, { lock }] of Object.entries(PACKAGES)) {
  const manifest = `${pkg}/package.json`;
  if (!changed.has(manifest) && !changed.has(lock)) continue;
  const deps = (t) => {
    try {
      const j = JSON.parse(t ?? '{}');
      return JSON.stringify(['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'pnpm', 'overrides'].map((k) => j[k] ?? null));
    } catch {
      return null;
    }
  };
  const depsChanged = changed.has(manifest) && deps(atBase(manifest)) !== deps(readNow(manifest));
  if (depsChanged && !changed.has(lock)) {
    add('lockfiles', 'CRITICAL', `${manifest} dependencies changed but ${lock} did not`, {
      file: manifest,
      evidence: `dependency fields differ from ${diff.base.slice(0, 8)}; ${lock} unchanged`,
      fix: `Change dependencies with the package manager in ${pkg}/ and commit the regenerated lock file`,
    });
  } else if (changed.has(lock) && !depsChanged) {
    add('lockfiles', 'WARNING', `${lock} changed without a dependency change in ${manifest}`, {
      file: lock,
      evidence: 'lock files are never hand-edited (root CLAUDE.md "Do-not-touch")',
      fix: 'Confirm the change came from the package manager; otherwise restore the lock file',
    });
  }
  ran.push({ check: `lockfiles:${pkg}`, status: 'passed' });
}

// 6. INSIGHTS.md files stay valid and append-only.
const insights = [...changed.values()].filter((f) => /^(client|server|reviewer-core|e2e)\/INSIGHTS\.md$/.test(f.path) && f.status !== 'D');
if (insights.length) {
  const files = insights.map((f) => f.path);
  const r = spawnSync(process.execPath, ['.claude/skills/engineering-insights/scripts/check-insights.mjs', ...files], { cwd: root, encoding: 'utf8', windowsHide: true });
  ran.push({ check: 'insights-validator', status: r.status === 0 ? 'passed' : 'failed' });
  if (r.status !== 0) {
    add('insights-validator', 'CRITICAL', `INSIGHTS.md validation failed: ${files.join(', ')}`, {
      file: files[0],
      evidence: excerpt(`${r.stdout}${r.stderr}`.trim()),
      fix: 'Follow .claude/skills/engineering-insights/SKILL.md "Entry format" and "Write — append-only"',
    });
  }
}

// 7. Typecheck every package with code changes.
if (!process.argv.includes('--skip-typecheck')) {
  for (const [pkg, { typecheck }] of Object.entries(PACKAGES)) {
    if (![...changed.keys()].some((p) => p.startsWith(`${pkg}/`) && isCode(p))) continue;
    const dir = path.join(root, pkg);
    if (!existsSync(path.join(dir, 'node_modules'))) {
      ran.push({ check: `typecheck:${pkg}`, status: 'not-run', detail: `${pkg}/node_modules missing` });
      add('typecheck', 'WARNING', `Typecheck of ${pkg} not run: install its dependencies and re-run /pr-self-review`);
      continue;
    }
    const r = sh(typecheck, dir);
    ran.push({ check: `typecheck:${pkg}`, status: r.status === 0 ? 'passed' : 'failed', command: `(${pkg}/) ${typecheck}` });
    if (r.status !== 0) {
      const first = /^(.+?)\((\d+),\d+\): error TS\d+/m.exec(r.output);
      add('typecheck', 'CRITICAL', `Typecheck fails in ${pkg}`, {
        ...(first ? { file: `${pkg}/${first[1].replace(/\\/g, '/')}`, line: Number(first[2]) } : {}),
        evidence: `(${pkg}/) ${typecheck}\n${excerpt(r.output)}`,
        fix: 'Fix the type errors; run the command above to reproduce',
      });
    }
  }
} else {
  ran.push({ check: 'typecheck', status: 'not-run', detail: '--skip-typecheck' });
}

const result = { base: diff.base, diffHash: diff.diffHash, ran, findings };
const json = `${JSON.stringify(result, null, 2)}\n`;
const out = arg('--out');
if (out) {
  writeFileSync(out, json);
  for (const r of ran) console.log(`${r.status.padEnd(7)} ${r.check}${r.detail ? ` (${r.detail})` : ''}`);
  console.log(`${findings.length} finding(s) → ${out}`);
} else {
  process.stdout.write(json);
}
