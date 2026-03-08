/**
 * Transform read-aloud/descriptive text to Homebrewery format.
 * Converts blockquotes to {{descriptive}} boxes.
 * Blockquotes with attribution go to {{quote}} blocks instead (see quote.ts).
 */

import { transformQuote, isQuote } from './quote.js';

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
 * Convert all blockquotes in content to appropriate V3 blocks.
 * Blockquotes with attribution (— Author) become {{quote}} blocks.
 * Others become {{descriptive}} boxes.
 */
export function convertAllBlockquotes(content: string): string {
  const blockquoteRegex = /((?:^>.*\n?)+)/gm;

  return content.replace(blockquoteRegex, (match) => {
    // Check for attribution pattern → use {{quote}} block
    if (isQuote(match)) {
      return transformQuote(match) + '\n';
    }

    // Default: {{descriptive}} block
    const text = extractReadAloudText(match);
    return `{{descriptive\n${text}\n}}\n`;
  });
}
