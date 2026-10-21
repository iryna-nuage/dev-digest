#!/usr/bin/env node
// Documented escape hatch for false positives: the USER overrides blocking findings of the
// current verdict with a reason. Recorded in the verdict and in an append-only local log; any
// later change to the diff invalidates it. Never run by the agent on its own initiative.
// Usage: node .claude/skills/pr-self-review/scripts/override.mjs --reason "<why>" (--finding <id> ... | --all)
import { appendOverrideLog, collectDiff, git, MIN_OVERRIDE_REASON, overrideLogPath, readVerdict, repoRoot, writeVerdict } from './lib.mjs';

const argv = process.argv.slice(2);
const reasonIdx = argv.indexOf('--reason');
const reason = reasonIdx >= 0 ? (argv[reasonIdx + 1] ?? '').trim() : '';
const ids = argv.flatMap((a, i) => (argv[i - 1] === '--finding' ? [a] : []));
const all = argv.includes('--all');

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

if (reason.length < MIN_OVERRIDE_REASON) {
  fail(`--reason is required and must be at least ${MIN_OVERRIDE_REASON} characters: say why each finding is a false positive or acceptable.`);
}
if (!all && ids.length === 0) fail('Name the findings to override with --finding <id> (repeatable), or --all.');

const root = repoRoot();
const verdict = readVerdict(root);
if (!verdict) fail('No PR self-review verdict yet. Run /pr-self-review first.');
if (verdict.verdict !== 'block') {
  fail(`The current verdict is "${verdict.verdict}"; only a "block" verdict can be overridden${verdict.verdict === 'incomplete' ? ' (finish the verification pass first)' : ''}.`);
}
const current = collectDiff(root, verdict.baseRef);
if (current.diffHash !== verdict.diffHash) fail('Local changes differ from the reviewed diff. Re-run /pr-self-review before overriding.');

const blockingIds = verdict.blocking.map((f) => f.id);
const unknown = ids.filter((id) => !blockingIds.includes(id));
if (unknown.length) fail(`Not a blocking finding of the current verdict: ${unknown.join(', ')}. Blocking: ${blockingIds.join(', ')}`);
const chosen = all ? blockingIds : ids;
const remaining = blockingIds.filter((id) => !chosen.includes(id));
if (remaining.length) {
  fail(`Every blocking finding needs an override; still blocking: ${remaining.join(', ')}. Add --finding for each, or --all.`);
}

const by = (git(['config', 'user.name'], { cwd: root, allowFail: true }) ?? '').trim() || 'unknown';
const override = { by, at: new Date().toISOString(), reason, findings: chosen, diffHash: verdict.diffHash };
writeVerdict(root, { ...verdict, verdict: 'override', override });
appendOverrideLog(root, { ...override, head: verdict.head, titles: verdict.blocking.map((f) => `${f.id} ${f.title}`) });

console.log(`Override recorded for ${chosen.length} finding(s) by ${by}.`);
console.log(`Log: ${overrideLogPath(root)}`);
console.log('Add a "Self-review override" section with these findings and the reason to the PR description.');
