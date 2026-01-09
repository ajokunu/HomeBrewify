/**
 * Transform read-aloud/descriptive text to Homebrewery format
 * Converts blockquotes to {{descriptive}} boxes
 */

/**
 * Extract text from blockquotes
 */
export function extractReadAloudText(content: string): string {
  const lines = content.split('\n');
  const textLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('>')) {
      // Remove blockquote prefix and "Read aloud:" marker
      let text = line.replace(/^>\s*/, '');
      text = text.replace(/^Read aloud:\s*/i, '');
      textLines.push(text);
    }
  }

  return textLines.join('\n').trim();
}

/**
 * Transform blockquote content to descriptive box
 */
export function transformReadAloud(content: string): string {
  const text = extractReadAloudText(content);

  if (!text) {
    return content; // Return unchanged if no blockquote found
  }

  const lines: string[] = [];
  lines.push('{{descriptive');
  lines.push(text);
  lines.push('}}');

  return lines.join('\n');
}

/**
 * Convert all blockquotes in content to descriptive boxes
 */
export function convertAllBlockquotes(content: string): string {
  // Find all blockquote sections
  const blockquoteRegex = /((?:^>.*\n?)+)/gm;

  return content.replace(blockquoteRegex, (match) => {
    const text = extractReadAloudText(match);
    return `{{descriptive\n${text}\n}}\n`;
  });
}
