/** A Markdown ATX heading line (`# Title` … `###### Title`). */
export function isMarkdownHeading(line: string): boolean {
  return /^#{1,6}\s/.test(line);
}
