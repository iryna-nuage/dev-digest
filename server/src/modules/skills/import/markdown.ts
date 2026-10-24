/**
 * Minimal frontmatter reader for imported `SKILL.md` / `.md` files. Only flat
 * `key: value` scalars are understood (plus `>` / `|` block scalars and
 * indented continuation lines), which covers `name`, `description` and `type`
 * without a YAML dependency. Anything else is reported as ignored.
 */

/** Frontmatter keys the import maps onto skill fields. */
export const KNOWN_FRONTMATTER_KEYS = ['name', 'description', 'type'] as const;
type KnownKey = (typeof KNOWN_FRONTMATTER_KEYS)[number];

export interface ParsedSkillMarkdown {
  meta: Partial<Record<KnownKey, string>>;
  /** Top-level frontmatter keys that were present but not used. */
  ignoredKeys: string[];
  /** Markdown after the frontmatter, trimmed. */
  body: string;
}

const KEY_LINE = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/;

function isKnown(key: string): key is KnownKey {
  return (KNOWN_FRONTMATTER_KEYS as readonly string[]).includes(key);
}

function unquote(value: string): string {
  const v = value.trim();
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    return v.slice(1, -1);
  }
  return v;
}

/** Split `text` into frontmatter fields and body. Text without frontmatter is all body. */
export function parseSkillMarkdown(text: string): ParsedSkillMarkdown {
  const normalized = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  if (lines[0]?.trim() !== '---') return { meta: {}, ignoredKeys: [], body: normalized.trim() };

  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (end === -1) return { meta: {}, ignoredKeys: [], body: normalized.trim() };

  const meta: ParsedSkillMarkdown['meta'] = {};
  const ignoredKeys: string[] = [];
  let current: { key: string; style: 'plain' | 'folded' | 'literal'; parts: string[] } | undefined;

  const flush = () => {
    if (!current) return;
    if (isKnown(current.key)) {
      const joined = current.style === 'literal' ? current.parts.join('\n') : current.parts.join(' ');
      meta[current.key] = unquote(joined);
    }
    current = undefined;
  };

  for (const line of lines.slice(1, end)) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    const indented = /^\s/.test(line);
    const m = indented ? null : KEY_LINE.exec(line);
    if (m) {
      flush();
      const key = m[1]!;
      const rest = m[2]!.trim();
      if (!isKnown(key)) {
        ignoredKeys.push(key);
        current = { key, style: 'plain', parts: [] };
        continue;
      }
      if (rest === '>' || rest === '>-') current = { key, style: 'folded', parts: [] };
      else if (rest === '|' || rest === '|-') current = { key, style: 'literal', parts: [] };
      else current = { key, style: 'plain', parts: rest ? [rest] : [] };
    } else if (current) {
      current.parts.push(line.trim());
    }
  }
  flush();

  return { meta, ignoredKeys, body: lines.slice(end + 1).join('\n').trim() };
}

/** First `# Heading` of a markdown body, if any. */
export function firstHeading(body: string): string | undefined {
  const m = /^#\s+(.+)$/m.exec(body);
  return m?.[1]?.trim();
}
