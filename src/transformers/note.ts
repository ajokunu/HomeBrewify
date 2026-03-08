/**
 * Transform DM notes to Homebrewery format
 * Converts note markers to {{note}} boxes
 */

/**
 * Check if content is a DM note
 */
export function isNote(content: string): boolean {
  return /\*{0,2}(DM Note|Note|Secret|Hidden|Tip|Warning|Important)\*{0,2}\s*[:=]/i.test(content);
}

/**
 * Extract note content
 */
export function extractNoteContent(content: string): { title: string; body: string } {
  // Match note header
  const headerMatch = content.match(/\*{0,2}(DM Note|Note|Secret|Hidden|Tip|Warning|Important)\*{0,2}\s*[:=]\s*\*{0,2}\s*(.*)/i);

  if (!headerMatch) {
    return { title: 'Note', body: content };
  }

  const title = headerMatch[1];
  const restOfLine = headerMatch[2];

  // Get everything after the header line
  const headerEnd = content.indexOf(headerMatch[0]) + headerMatch[0].length;
  const bodyAfterHeader = content.substring(headerEnd).trim();

  const body = restOfLine ? `${restOfLine}\n${bodyAfterHeader}` : bodyAfterHeader;

  return { title, body: body.trim() };
}

/**
 * Transform note content to Homebrewery format
 */
export function transformNote(content: string): string {
  const { title, body } = extractNoteContent(content);

  const lines: string[] = [];
  lines.push('{{note');
  lines.push(`##### ${title}`);
  lines.push('');
  lines.push(body);
  lines.push('}}');

  return lines.join('\n');
}
