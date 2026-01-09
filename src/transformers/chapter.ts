/**
 * Transform chapter/episode headers to Homebrewery format
 * Adds page breaks and proper styling
 */

/**
 * Extract chapter info
 */
export function extractChapter(content: string): { title: string; body: string } {
  const lines = content.split('\n');
  let title = '';
  let bodyLines: string[] = [];
  let foundHeader = false;

  for (const line of lines) {
    // Check for episode/chapter header
    const episodeMatch = line.match(/^#\s*(Episode\s+\d+\s*[:.-]?\s*(.*))/i);
    const chapterMatch = line.match(/^#\s*(Chapter\s+\d+\s*[:.-]?\s*(.*))/i);
    const partMatch = line.match(/^#\s*(Part\s+\d+\s*[:.-]?\s*(.*))/i);

    if ((episodeMatch || chapterMatch || partMatch) && !foundHeader) {
      const match = episodeMatch || chapterMatch || partMatch;
      title = match![1].trim();
      foundHeader = true;
      continue;
    }

    // Add to body after header found
    if (foundHeader) {
      bodyLines.push(line);
    }
  }

  return {
    title: title || 'Untitled Chapter',
    body: bodyLines.join('\n').trim(),
  };
}

/**
 * Transform chapter to Homebrewery format
 */
export function transformChapter(content: string): string {
  const { title, body } = extractChapter(content);

  const lines: string[] = [];

  // Page break before new chapter
  lines.push('\\page');
  lines.push('');

  // Chapter title
  lines.push(`# ${title}`);
  lines.push('');

  // Body content (if any immediately follows header)
  if (body) {
    lines.push(body);
  }

  return lines.join('\n');
}

/**
 * Add page breaks at appropriate locations in content
 */
export function insertPageBreaks(content: string): string {
  // Find chapter/episode headers and add page breaks before them
  return content.replace(/^(#\s*(?:Episode|Chapter|Part)\s+\d+)/gim, '\\page\n\n$1');
}
