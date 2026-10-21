#!/usr/bin/env node
// Step 1 of pr-self-review: lists every local change not yet in the base (branch commits, staged,
// unstaged, untracked), buckets the reviewable files by skill and prints the review plan as JSON.
// Usage: node .claude/skills/pr-self-review/scripts/collect-diff.mjs [--base <ref>] [--out <file>]
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  bucketFiles,
  collectDiff,
  listProjectSkills,
  loadSkillMap,
  repoRoot,
  resolveBaseRef,
  unmappedSkills,
} from './lib.mjs';

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

const root = repoRoot();
const baseRef = resolveBaseRef(root, arg('--base'));
const diff = collectDiff(root, baseRef);
const map = loadSkillMap();

const readContent = (p) => {
  try {
    return readFileSync(path.join(root, p), 'utf8');
  } catch {
    return null;
  }
};

const packages = [...new Set(diff.files.map((f) => f.path.split('/')[0]))]
  .filter((p) => ['client', 'server', 'reviewer-core', 'e2e'].includes(p))
  .sort();

const plan = {
  ...diff,
  packages,
  buckets: bucketFiles(diff.files, map, readContent),
  unmappedSkills: unmappedSkills(listProjectSkills(root), map),
};

const json = `${JSON.stringify(plan, null, 2)}\n`;
const out = arg('--out');
if (out) {
  writeFileSync(out, json);
  const n = Object.values(plan.buckets).reduce((a, b) => a + b.length, 0);
  console.log(
    `${plan.files.length} changed file(s) vs ${baseRef} (${plan.base.slice(0, 8)}), ${Object.keys(plan.buckets).length} skill bucket(s), ${n} file-skill pair(s) → ${out}`,
  );
} else {
  process.stdout.write(json);
}
