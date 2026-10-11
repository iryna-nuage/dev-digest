#!/usr/bin/env node
// Validates module INSIGHTS.md files: fixed sections, entry shape, append-only against git HEAD.
// Usage: node .claude/skills/engineering-insights/scripts/check-insights.mjs [--skip-append-check] [file ...]
// Exit code 1 on errors; warnings never fail.
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const SECTIONS = [
  'What Works',
  "What Doesn't Work",
  'Codebase Patterns',
  'Tool & Library Notes',
  'Recurring Errors & Fixes',
  'Session Notes',
  'Open Questions',
];
const DEFAULT_FILES = ['server/INSIGHTS.md', 'client/INSIGHTS.md', 'reviewer-core/INSIGHTS.md', 'e2e/INSIGHTS.md'];
// The skill was introduced on this date; older entries were migrated verbatim and have no `Do:` line.
const DO_REQUIRED_FROM = '2026-10-11';
// MindStudio reports signal dropping past ~200 entries; warn well before that. Pruning is a human call.
const MAX_PER_SECTION = 30;
const MAX_PER_FILE = 150;

const ENTRY = /^### (\d{4}-\d{2}-\d{2}) · [^·]+ · .+$/;
const SESSION_NOTE = /^### (\d{4}-\d{2}-\d{2}) · .+$/;

function git(args, cwd) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

function checkStructure(rel, lines, errors, warnings) {
  if (!lines.find((l) => l.trim())?.startsWith('# ')) errors.push(`${rel}:1 missing "# Insights — <module>" title`);

  const headings = lines.flatMap((l, i) => (l.startsWith('## ') ? [{ name: l.slice(3).trim(), line: i + 1 }] : []));
  const names = headings.map((h) => h.name);
  if (names.join('|') !== SECTIONS.join('|')) {
    errors.push(`${rel} sections must be exactly, in order: ${SECTIONS.join(' · ')} (found: ${names.join(' · ') || 'none'})`);
  }

  let section = null;
  let entry = null;
  const counts = new Map();
  const titles = new Map();
  const finish = () => {
    if (!entry || entry.section === 'Session Notes') return;
    const need = ['What:', 'Where:', 'Status:'];
    if (entry.date >= DO_REQUIRED_FROM) need.splice(1, 0, 'Do:');
    for (const key of need) {
      if (!entry.body.some((l) => l.startsWith(key))) errors.push(`${rel}:${entry.line} entry missing "${key}"`);
    }
  };

  lines.forEach((l, i) => {
    if (l.startsWith('## ')) {
      finish();
      entry = null;
      section = l.slice(3).trim();
    } else if (l.startsWith('### ')) {
      finish();
      entry = null;
      if (!section) return errors.push(`${rel}:${i + 1} entry outside any section`);
      const m = (section === 'Session Notes' ? SESSION_NOTE : ENTRY).exec(l.trimEnd());
      if (!m) {
        const shape = section === 'Session Notes' ? '### YYYY-MM-DD · <task>' : '### YYYY-MM-DD · <area> · <title>';
        return errors.push(`${rel}:${i + 1} heading must look like "${shape}"`);
      }
      entry = { section, date: m[1], line: i + 1, body: [] };
      counts.set(section, (counts.get(section) ?? 0) + 1);
      const title = l.split(' · ').slice(2).join(' · ').trim();
      if (title && titles.has(title)) warnings.push(`${rel}:${i + 1} duplicate title, also at line ${titles.get(title)}`);
      if (title) titles.set(title, i + 1);
    } else if (entry) {
      entry.body.push(l.trim());
    }
  });
  finish();

  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  for (const [name, n] of counts) {
    if (n > MAX_PER_SECTION) warnings.push(`${rel} "${name}" has ${n} entries (> ${MAX_PER_SECTION}): needs consolidation`);
  }
  if (total > MAX_PER_FILE) warnings.push(`${rel} has ${total} entries (> ${MAX_PER_FILE}): needs consolidation`);
  return total;
}

// Append-only, compared with HEAD, per diff hunk: a removed line is allowed only if it is a
// `Status:` line that reappears with text appended; other added lines must belong to a new entry
// (the hunk adds a `### ` heading), so nothing is slipped into an existing entry.
function checkAppendOnly(rel, root, errors) {
  if (git(['ls-files', '--error-unmatch', rel], root) === null) return; // new, untracked file
  const diff = git(['diff', '-U0', '--no-color', 'HEAD', '--', rel], root);
  if (!diff) return;
  const hunks = [];
  for (const raw of diff.split(/\r?\n/)) {
    const l = raw.replace(/\r$/, '');
    if (l.startsWith('@@')) hunks.push({ removed: [], added: [] });
    else if (!hunks.length || l.startsWith('---') || l.startsWith('+++')) continue;
    else if (l.startsWith('-')) hunks.at(-1).removed.push(l.slice(1).trimEnd());
    else if (l.startsWith('+')) hunks.at(-1).added.push(l.slice(1).trimEnd());
  }
  for (const { removed, added } of hunks) {
    const extensions = new Set();
    for (const r of removed) {
      const ext = r.startsWith('Status:') && added.find((a) => a.startsWith(r) && a.length > r.length);
      if (ext) extensions.add(ext);
      else errors.push(`${rel} append-only violated, removed or edited: "${r.trim().slice(0, 80)}"`);
    }
    const rest = added.filter((a) => a.trim() && !extensions.has(a));
    if (rest.length && !added.some((a) => a.startsWith('### '))) {
      errors.push(`${rel} append-only violated, lines inserted into an existing entry: "${rest[0].trim().slice(0, 80)}"`);
    }
  }
}

const args = process.argv.slice(2);
const skipAppend = args.includes('--skip-append-check');
const root = git(['rev-parse', '--show-toplevel'], process.cwd())?.trim() ?? process.cwd();
const files = args.filter((a) => !a.startsWith('--'));
let failed = false;

for (const file of files.length ? files : DEFAULT_FILES) {
  const abs = path.resolve(files.length ? process.cwd() : root, file);
  const rel = path.relative(root, abs).split(path.sep).join('/');
  if (!existsSync(abs)) {
    console.log(`✗ ${rel} not found`);
    failed = true;
    continue;
  }
  const errors = [];
  const warnings = [];
  const total = checkStructure(rel, readFileSync(abs, 'utf8').split(/\r?\n/), errors, warnings);
  if (!skipAppend) checkAppendOnly(rel, root, errors);
  for (const e of errors) console.log(`✗ ${e}`);
  for (const w of warnings) console.log(`! ${w}`);
  if (errors.length) failed = true;
  else console.log(`✓ ${rel} (${total} entries)`);
}
process.exit(failed ? 1 : 0);
