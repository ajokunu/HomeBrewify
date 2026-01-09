/**
 * Transform location descriptions to Homebrewery format
 * Creates wide headers with descriptive text
 */

/**
 * Extract location name and description
 */
export function extractLocation(content: string): { name: string; description: string } {
  const lines = content.split('\n');
  let name = '';
  let descriptionLines: string[] = [];
  let foundHeader = false;

  for (const line of lines) {
    // Check for location header
    const headerMatch = line.match(/^#{1,2}\s*(?:Location:\s*)?(.+)$/i);
    if (headerMatch && !foundHeader) {
      name = headerMatch[1].trim();
      foundHeader = true;
      continue;
    }

    // Also check for "Town of X" or "City of X" patterns
    const townMatch = line.match(/^#{1,2}\s*((?:Town|City|Village|The)\s+(?:of\s+)?[\w\s]+)$/i);
    if (townMatch && !foundHeader) {
      name = townMatch[1].trim();
      foundHeader = true;
      continue;
    }

    // Skip separator lines
    if (line.match(/^---+$/)) continue;

    // Add to description
    if (foundHeader || line.trim()) {
      descriptionLines.push(line);
    }
  }

  return {
    name: name || 'Unknown Location',
    description: descriptionLines.join('\n').trim(),
  };
}

/**
 * Transform location to Homebrewery format
 */
export function transformLocation(content: string): string {
  const { name, description } = extractLocation(content);

  const lines: string[] = [];

  // Use wide block for location header
  lines.push('{{wide');
  lines.push(`## ${name}`);

  // First paragraph as italic description
  const paragraphs = description.split('\n\n');
  if (paragraphs.length > 0 && paragraphs[0].trim()) {
    lines.push(`*${paragraphs[0].trim()}*`);
  }

  lines.push('}}');

  // Add remaining paragraphs outside the wide block
  if (paragraphs.length > 1) {
    lines.push('');
    lines.push(paragraphs.slice(1).join('\n\n'));
  }

  return lines.join('\n');
}
