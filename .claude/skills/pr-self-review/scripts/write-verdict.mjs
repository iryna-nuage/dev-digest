#!/usr/bin/env node
// Final step of pr-self-review: validates the merged findings (grounding, independent verification
// of every CRITICAL), writes the verdict for the current diff and prints the report.
// Usage: node .claude/skills/pr-self-review/scripts/write-verdict.mjs --findings <file> [--findings <file> ...] [--base <ref>]
// Each file is a JSON array of findings or { "findings": [...] }. Exit 1 on invalid input.
import { readFileSync } from 'node:fs';
import { collectDiff, evaluateFindings, repoRoot, resolveBaseRef, verdictPath, writeVerdict } from './lib.mjs';

const files = process.argv.flatMap((a, i, all) => (all[i - 1] === '--findings' ? [a] : []));
const baseIdx = process.argv.indexOf('--base');
if (files.length === 0) {
  console.error('usage: write-verdict.mjs --findings <file> [--findings <file> ...] [--base <ref>]');
  process.exit(1);
}

const findings = files.flatMap((f) => {
  const j = JSON.parse(readFileSync(f, 'utf8'));
  return Array.isArray(j) ? j : j.findings ?? [];
});

const root = repoRoot();
const baseRef = resolveBaseRef(root, baseIdx > 0 ? process.argv[baseIdx + 1] : undefined);
const diff = collectDiff(root, baseRef);
const filesByPath = Object.fromEntries(diff.files.map((f) => [f.path, f]));
const r = evaluateFindings(findings, filesByPath);

if (r.verdict === 'invalid') {
  console.error(`Invalid findings:\n  ${r.errors.join('\n  ')}`);
  process.exit(1);
}

const bySeverity = (s) => r.kept.filter((f) => f.severity === s);
const verdict = {
  verdict: r.verdict,
  baseRef,
  base: diff.base,
  head: diff.head,
  diffHash: diff.diffHash,
  at: new Date().toISOString(),
  counts: {
    critical: r.blocking.length,
    warning: bySeverity('WARNING').length,
    suggestion: bySeverity('SUGGESTION').length,
    unverified: r.unverified.length,
    rejected: r.rejected.length,
    downgraded: r.downgraded.length,
    ungrounded: r.ungrounded.length,
  },
  blocking: r.blocking,
  unverified: r.unverified,
  findings: r.kept,
  rejected: r.rejected,
  ungrounded: r.ungrounded,
};
writeVerdict(root, verdict);

const loc = (f) => `${f.file ?? '(repo)'}${f.line ? `:${f.line}` : ''}`;
const row = (f) => `| ${f.id} | ${f.severity} | ${loc(f)} | ${f.skill} | ${f.rule} | ${f.title} |`;
const lines = ['| id | severity | where | skill | rule | finding |', '|---|---|---|---|---|---|'];
for (const s of ['CRITICAL', 'WARNING', 'SUGGESTION']) lines.push(...bySeverity(s).map(row));
console.log(lines.length > 2 ? lines.join('\n') : 'No findings.');
if (r.downgraded.length) console.log(`\nDowngraded by verifier: ${r.downgraded.map((f) => `${f.id} (${f.verification.reason})`).join('; ')}`);
if (r.rejected.length) console.log(`Rejected by verifier: ${r.rejected.map((f) => `${f.id} ${loc(f)} (${f.verification.reason})`).join('; ')}`);
if (r.ungrounded.length) console.log(`Dropped as ungrounded (not on a changed line): ${r.ungrounded.map((f) => `${loc(f)} ${f.title}`).join('; ')}`);

const summary = {
  pass: 'PASS — no verified CRITICAL findings.',
  block: `BLOCKED — ${r.blocking.length} verified CRITICAL finding(s). Opening a PR or pushing is blocked until they are fixed.`,
  incomplete: `INCOMPLETE — ${r.unverified.length} CRITICAL finding(s) lack an independent verification: ${r.unverified.map((f) => f.id).join(', ')}.`,
}[r.verdict];
console.log(`\n${summary}\nVerdict for diff ${diff.diffHash.slice(0, 12)} → ${verdictPath(root)}`);
