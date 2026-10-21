// Shared, dependency-free helpers for the pr-self-review scripts: git access, the reviewed diff,
// skill mapping, grounding and the verdict file. Pure functions are exported for node --test.
// Windows: git runs through execFileSync (no shell), every path is POSIX-style as git prints it.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SEVERITIES = ['CRITICAL', 'WARNING', 'SUGGESTION'];
export const DEFAULT_BASES = ['origin/main', 'main'];
export const MIN_OVERRIDE_REASON = 20;

// ---------- git ----------

export function git(args, { cwd, allowFail = false } = {}) {
  try {
    return execFileSync('git', ['-c', 'core.quotepath=false', ...args], {
      cwd,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
  } catch (err) {
    if (allowFail) return null;
    throw new Error(`git ${args.join(' ')} failed: ${String(err.stderr || err.message).trim()}`);
  }
}

export function repoRoot(cwd = process.cwd()) {
  return git(['rev-parse', '--show-toplevel'], { cwd }).trim();
}

/** First base ref that exists, unless one is given explicitly. */
export function resolveBaseRef(root, explicit) {
  const candidates = explicit ? [explicit] : DEFAULT_BASES;
  for (const ref of candidates) {
    if (git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { cwd: root, allowFail: true })) return ref;
  }
  throw new Error(`no base ref found (tried ${candidates.join(', ')}); pass --base <ref>`);
}

export function mergeBase(root, baseRef) {
  return git(['merge-base', 'HEAD', baseRef], { cwd: root }).trim();
}

/** Absolute directory for local, uncommitted state (worktree-safe: .git/devdigest). */
export function stateDir(root) {
  const p = git(['rev-parse', '--git-path', 'devdigest'], { cwd: root }).trim();
  return path.resolve(root, p);
}

export function verdictPath(root) {
  return path.join(stateDir(root), 'pr-self-review.json');
}

export function overrideLogPath(root) {
  return path.join(stateDir(root), 'pr-self-review-overrides.jsonl');
}

// ---------- the reviewed diff ----------

const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|svg|pdf|zip|gz|woff2?|ttf|eot|mp4|webm)$/i;

/**
 * Parses `git diff --name-status -z` output into [{ path, status }]. Renames/copies keep the
 * new path. Status is one of A, M, D, R, C, T.
 */
export function parseNameStatus(z) {
  const parts = z.split('\0').filter((s) => s !== '');
  const out = [];
  for (let i = 0; i < parts.length; ) {
    const code = parts[i++];
    const status = code[0];
    if (status === 'R' || status === 'C') {
      i++; // old path
      out.push({ path: parts[i++], status });
    } else {
      out.push({ path: parts[i++], status });
    }
  }
  return out;
}

/** Parses `git diff -U0` output into { path: [[start, end], ...] } of new-side line ranges. */
export function parseHunks(diffText) {
  const hunks = {};
  let current = null;
  for (const line of diffText.split('\n')) {
    if (line.startsWith('+++ ')) {
      const target = line.slice(4).trim();
      current = target === '/dev/null' ? null : target.replace(/^"?b\//, '').replace(/"$/, '');
      if (current && !hunks[current]) hunks[current] = [];
      continue;
    }
    const m = current && /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (m) {
      const start = Number(m[1]);
      const count = m[2] === undefined ? 1 : Number(m[2]);
      if (count > 0) hunks[current].push([start, start + count - 1]);
    }
  }
  return hunks;
}

function countLines(buf) {
  if (buf.length === 0) return 0;
  let n = 0;
  for (const b of buf) if (b === 10) n++;
  return buf[buf.length - 1] === 10 ? n : n + 1;
}

/**
 * Everything not yet in the base: branch commits + staged + unstaged + untracked, ignoring
 * gitignored files. Renames are reported as delete + add, so the whole new file is reviewed.
 * The hash covers the base and the working-tree bytes of every changed path, so it changes with
 * any edit but not when the same content is staged or committed.
 */
export function collectDiff(root, baseRef) {
  const base = mergeBase(root, baseRef);
  const diffArgs = ['diff', '--no-color', '--no-ext-diff', '--no-textconv', '--no-renames'];
  const tracked = parseNameStatus(git([...diffArgs, '--name-status', '-z', base], { cwd: root }));
  const hunks = parseHunks(git([...diffArgs, '-U0', base], { cwd: root }));
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z'], { cwd: root })
    .split('\0')
    .filter(Boolean);

  const files = [];
  for (const f of tracked) {
    files.push({ ...f, binary: BINARY_EXT.test(f.path), hunks: hunks[f.path] ?? [] });
  }
  for (const p of untracked) {
    let n = 0;
    try {
      n = countLines(readFileSync(path.join(root, p)));
    } catch {
      // vanished between listing and reading
    }
    files.push({ path: p, status: 'A', untracked: true, binary: BINARY_EXT.test(p), hunks: n > 0 ? [[1, n]] : [] });
  }
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const hash = createHash('sha256').update(base);
  for (const f of files) {
    hash.update('\0').update(f.path).update('\0');
    if (f.status === 'D') {
      hash.update('<deleted>');
      continue;
    }
    try {
      hash.update(readFileSync(path.join(root, f.path)));
    } catch {
      hash.update('<unreadable>');
    }
  }
  return { baseRef, base, head: git(['rev-parse', 'HEAD'], { cwd: root }).trim(), diffHash: hash.digest('hex'), files };
}

// ---------- globs and skill mapping ----------

/** Minimal glob → RegExp: `**`, `*`, `?`, `{a,b}`. Paths are POSIX, matched in full. */
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        i++;
        if (glob[i + 1] === '/') {
          i++;
          re += '(?:.*/)?';
        } else {
          re += '.*';
        }
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if (c === '{') {
      const end = glob.indexOf('}', i);
      re += `(?:${glob.slice(i + 1, end).split(',').map(escapeRe).join('|')})`;
      i = end;
    } else {
      re += escapeRe(c);
    }
  }
  return new RegExp(`^${re}$`);
}

function escapeRe(s) {
  return s.replace(/[.+^$()|[\]\\]/g, '\\$&');
}

export function matchesAny(p, globs = []) {
  return globs.some((g) => globToRegExp(g).test(p));
}

export function loadSkillMap(file = path.join(SKILL_DIR, 'skill-map.json')) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

/**
 * Buckets reviewable files by skill. A file lands in every rule it matches. `readContent` is
 * only called for rules with `contentMatch`.
 */
export function bucketFiles(files, map, readContent) {
  const buckets = {};
  const reviewable = files.filter(
    (f) => f.status !== 'D' && !f.binary && !matchesAny(f.path, map.exclude),
  );
  for (const rule of map.rules) {
    const contentRe = rule.contentMatch ? new RegExp(rule.contentMatch, 'm') : null;
    for (const f of reviewable) {
      if (!matchesAny(f.path, rule.include) || matchesAny(f.path, rule.exclude)) continue;
      if (contentRe && !contentRe.test(readContent(f.path) ?? '')) continue;
      for (const skill of rule.skills) {
        (buckets[skill] ??= new Set()).add(f.path);
      }
    }
  }
  return Object.fromEntries(
    Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, [...v].sort()]),
  );
}

/** Project skills that the map neither reviews with nor explicitly ignores. */
export function unmappedSkills(skillNames, map) {
  const mapped = new Set(map.rules.flatMap((r) => r.skills));
  const ignored = new Set(Object.keys(map.ignore ?? {}));
  return skillNames.filter((s) => !mapped.has(s) && !ignored.has(s)).sort();
}

export function listProjectSkills(root) {
  const dir = path.join(root, '.claude', 'skills');
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(path.join(dir, d.name, 'SKILL.md')))
    .map((d) => d.name);
}

// ---------- findings, grounding, verdict ----------

export function findingId(f) {
  return createHash('sha1')
    .update([f.skill, f.rule, f.file ?? '', f.line ?? '', f.title].join('|'))
    .digest('hex')
    .slice(0, 8);
}

/** True when `line` falls inside one of the file's changed ranges. Iterates hunks, never lines. */
export function isGrounded(hunks, line) {
  if (!Number.isInteger(line)) return false;
  return (hunks ?? []).some(([s, e]) => line >= s && line <= e);
}

/**
 * Validates and classifies findings. Returns { verdict, blocking, unverified, rejected,
 * downgraded, ungrounded, kept, errors }. Rules:
 * - LLM findings (`source: "llm"`) must sit on a changed line, else they are dropped as ungrounded.
 * - Check findings (`source: "check:<name>"`) are facts from a command; they need no line.
 * - Every CRITICAL needs an independent `verification`; without one the verdict is `incomplete`.
 * - `rejected` drops the finding from blocking; `downgraded` takes the verifier's lower severity.
 */
export function evaluateFindings(findings, filesByPath) {
  const errors = [];
  const out = { blocking: [], unverified: [], rejected: [], downgraded: [], ungrounded: [], kept: [] };
  const seen = new Map();
  findings.forEach((raw, i) => {
    const where = `findings[${i}]`;
    for (const k of ['skill', 'rule', 'severity', 'title', 'source']) {
      if (typeof raw[k] !== 'string' || raw[k] === '') errors.push(`${where}.${k} is required`);
    }
    if (!SEVERITIES.includes(raw.severity)) errors.push(`${where}.severity must be one of ${SEVERITIES.join('|')}`);
    if (raw.source !== 'llm' && !/^check:[\w-]+$/.test(raw.source ?? '')) {
      errors.push(`${where}.source must be "llm" or "check:<name>"`);
    }
    if (errors.length) return;

    const f = { ...raw, id: raw.id ?? findingId(raw) };
    if (f.source === 'llm') {
      const file = filesByPath[f.file];
      if (!file || !isGrounded(file.hunks, f.line)) {
        out.ungrounded.push(f);
        return;
      }
    }
    // Same file+line+rule from several skills → keep the highest severity once.
    const key = `${f.file ?? ''}|${f.line ?? ''}|${f.rule}`;
    const prev = seen.get(key);
    if (prev && SEVERITIES.indexOf(prev.severity) <= SEVERITIES.indexOf(f.severity)) return;
    if (prev) out.kept.splice(out.kept.indexOf(prev), 1);
    seen.set(key, f);
    out.kept.push(f);
  });
  if (errors.length) return { ...out, verdict: 'invalid', errors };

  for (const f of [...out.kept]) {
    if (f.severity !== 'CRITICAL') continue;
    const v = f.verification;
    if (!v || !['confirmed', 'downgraded', 'rejected'].includes(v.status) || !v.reason) {
      out.unverified.push(f);
      continue;
    }
    if (v.status === 'confirmed') out.blocking.push(f);
    else if (v.status === 'rejected') {
      out.rejected.push(f);
      out.kept.splice(out.kept.indexOf(f), 1);
    } else {
      if (!['WARNING', 'SUGGESTION'].includes(v.severity)) {
        errors.push(`finding ${f.id}: downgraded verification needs severity WARNING|SUGGESTION`);
        continue;
      }
      f.originalSeverity = f.severity;
      f.severity = v.severity;
      out.downgraded.push(f);
    }
  }
  if (errors.length) return { ...out, verdict: 'invalid', errors };
  const verdict = out.unverified.length ? 'incomplete' : out.blocking.length ? 'block' : 'pass';
  return { ...out, verdict, errors };
}

export function readVerdict(root) {
  const p = verdictPath(root);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

export function writeVerdict(root, verdict) {
  mkdirSync(stateDir(root), { recursive: true });
  writeFileSync(verdictPath(root), `${JSON.stringify(verdict, null, 2)}\n`);
}

export function appendOverrideLog(root, entry) {
  mkdirSync(stateDir(root), { recursive: true });
  appendFileSync(overrideLogPath(root), `${JSON.stringify(entry)}\n`);
}

// ---------- the gate ----------

// A command boundary: start, a separator, a subshell or a PowerShell call operator.
const B = String.raw`(?:^|[;&|(\n{]|&&|\|\||\s&\s)\s*`;
const GIT_PUSH = new RegExp(String.raw`${B}git(?:\.exe)?(?:\s+-(?:C|c)\s+\S+|\s+--[\w-]+(?:=\S+)?)*\s+push\b([^;&|\n]*)`, 'gi');
const GH_PR = new RegExp(String.raw`${B}gh(?:\.exe)?\s+pr\s+(create|merge)\b`, 'i');

/**
 * Drops text that is data, not commands: heredoc bodies and quoted strings (bash and PowerShell
 * here-strings included), so `echo "x; git push"` or a script written via heredoc is not gated.
 */
export function stripQuoted(command) {
  return command
    .replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2\s*(?=\n|$)/g, ' ')
    .replace(/@(['"])\r?\n[\s\S]*?\r?\n\1@/g, ' ')
    .replace(/'[^']*'/g, "''")
    .replace(/"(?:[^"\\`]|\\.|`.)*"/g, '""');
}

/**
 * Which gated action a shell command performs, or null. `git push` that only deletes remote
 * refs or pushes tags is not gated; neither is `--dry-run`. Quoted text is ignored, so a push
 * wrapped in `bash -c "…"` is not seen: the gate guards routine agent actions, not evasion.
 */
export function gatedAction(rawCommand) {
  if (typeof rawCommand !== 'string') return null;
  const command = stripQuoted(rawCommand);
  const gh = GH_PR.exec(command);
  if (gh) return `gh pr ${gh[1].toLowerCase()}`;
  for (const m of command.matchAll(GIT_PUSH)) {
    const args = m[1] ?? '';
    if (/(^|\s)(--delete|-d|--dry-run|-n|--tags)(\s|$)/.test(args)) continue;
    if (/(^|\s):\S+/.test(args)) continue; // `git push origin :branch` deletes
    return 'git push';
  }
  return null;
}

/** Gate decision for a recomputed diff hash against the stored verdict. */
export function gateDecision(verdict, currentHash) {
  const run = 'Run /pr-self-review (the pr-self-review skill) first.';
  if (!verdict) return { allow: false, message: `No PR self-review verdict for this branch. ${run}` };
  if (verdict.diffHash !== currentHash) {
    return { allow: false, message: `Local changes differ from the last PR self-review (${verdict.at}). ${run}` };
  }
  if (verdict.verdict === 'pass') return { allow: true };
  if (verdict.verdict === 'override') {
    const o = verdict.override ?? {};
    return {
      allow: true,
      notice: `PR self-review was OVERRIDDEN by ${o.by ?? 'unknown'} (${(o.findings ?? []).join(', ')}): ${o.reason}. List this in the PR description.`,
    };
  }
  if (verdict.verdict === 'incomplete') {
    return {
      allow: false,
      message: `PR self-review is incomplete: ${verdict.counts?.unverified ?? '?'} CRITICAL finding(s) were not independently verified. Finish the verification pass in /pr-self-review.`,
    };
  }
  const list = (verdict.blocking ?? []).map((f) => `  - [${f.id}] ${f.file ?? ''}${f.line ? `:${f.line}` : ''} ${f.title}`).join('\n');
  return {
    allow: false,
    message: `PR self-review BLOCKED: ${verdict.blocking?.length ?? 0} verified CRITICAL finding(s):\n${list}\nFix them and re-run /pr-self-review. A false positive can be overridden only by the user, with a reason: see .claude/skills/pr-self-review/SKILL.md "Override".`,
  };
}
