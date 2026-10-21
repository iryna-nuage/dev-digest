#!/usr/bin/env node
// Claude Code PreToolUse hook (Bash | PowerShell). Blocks `gh pr create`, `gh pr merge` and
// `git push` issued by the agent unless the current diff has a passing or overridden
// pr-self-review verdict. It only sees Claude Code tool calls: git outside Claude Code is untouched.
// Fail-open for every other command (any error → allow); fail-closed for gated commands.
// Exit 2 + stderr = block (Claude Code shows the reason to the agent).
import { collectDiff, gateDecision, gatedAction, readVerdict, repoRoot } from './lib.mjs';

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
  });
}

let action = null;
let input = {};
try {
  input = JSON.parse((await readStdin()) || '{}');
  action = gatedAction(input?.tool_input?.command);
} catch {
  process.exit(0);
}
if (!action) process.exit(0);

try {
  const root = repoRoot(input.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd());
  const verdict = readVerdict(root);
  const currentHash = verdict ? collectDiff(root, verdict.baseRef).diffHash : null;
  const decision = gateDecision(verdict, currentHash);
  if (!decision.allow) {
    process.stderr.write(`[pr-self-review] ${action} blocked. ${decision.message}\n`);
    process.exit(2);
  }
  if (decision.notice) process.stdout.write(`${JSON.stringify({ systemMessage: `[pr-self-review] ${decision.notice}` })}\n`);
  process.exit(0);
} catch (err) {
  process.stderr.write(`[pr-self-review] ${action} blocked: the gate could not verify the self-review (${err.message}). Run /pr-self-review.\n`);
  process.exit(2);
}
