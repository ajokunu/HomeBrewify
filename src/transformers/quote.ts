/**
 * Quote block transformer for Homebrewery V3.
 * Converts blockquotes with attribution to {{quote}} + {{attribution}} blocks.
 * Blockquotes without attribution remain as {{descriptive}} (handled by readAloud.ts).
 */

/**
 * Check if a blockquote contains an attribution line (— Author, *Source*)
 */
export function isQuote(content: string): boolean {
  const hasBlockquote = /^>/m.test(content);
  if (!hasBlockquote) return false;

  // Attribution patterns: — Author, -- Author, - Author (capitalized)
  return /^>\s*[-—–]{1,2}\s*[A-Z]/m.test(content);
}

/**
 * Transform a blockquote with attribution into a V3 {{quote}} block.
 */
export function transformQuote(content: string): string {
  const lines = content.split('\n');
  const quoteLines: string[] = [];
  let attribution = '';

  for (const line of lines) {
    // Skip non-blockquote lines
    if (!line.startsWith('>')) {
      // But include header lines that precede the quote
      if (line.match(/^#{1,4}\s+/) && quoteLines.length === 0) {
        continue;
      }
      continue;
    }

    const text = line.replace(/^>\s*/, '');

    // Check if this is the attribution line
    const attrMatch = text.match(/^[-—–]{1,2}\s*(.+)$/);
    if (attrMatch) {
      attribution = attrMatch[1].trim();
    } else if (text.trim()) {
      quoteLines.push(text);
    }
  }

  const result: string[] = [];
  result.push('{{quote');
  result.push(quoteLines.join('\n').trim());

  if (attribution) {
    // Parse "Author, *Book Title*" or "Author" pattern
    const commaIdx = attribution.indexOf(',');
    if (commaIdx > 0) {
      const author = attribution.substring(0, commaIdx).trim();
      const source = attribution.substring(commaIdx + 1).trim();
      result.push('');
      result.push(`{{attribution ${author}, ${source}}}`);
    } else {
      result.push('');
      result.push(`{{attribution ${attribution}}}`);
    }
  }

  result.push('}}');

  return result.join('\n');
}
