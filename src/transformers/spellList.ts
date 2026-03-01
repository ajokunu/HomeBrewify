/**
 * Spell list transformer for Homebrewery V3.
 * Converts spell lists organized by level into {{spellList,wide}} blocks.
 */

/**
 * Check if content is a spell list (multiple level headers + spell bullet items)
 */
export function isSpellList(content: string): boolean {
  const levelHeaders = content.match(/^#{1,5}\s*(Cantrips?(?:\s*\(0 Level\))?|\d+(?:st|nd|rd|th)\s+Level)/gim) || [];
  const spellItems = content.match(/^[-*]\s+\w+/gm) || [];
  return levelHeaders.length >= 2 && spellItems.length >= 3;
}

/**
 * Transform spell list content into a V3 {{spellList,wide}} block.
 */
export function transformSpellList(content: string): string {
  const lines: string[] = [];
  lines.push('{{spellList,wide');

  const inputLines = content.split('\n');

  for (const line of inputLines) {
    // Skip the main header (e.g., "## Spell List" or "## Wizard Spells")
    if (line.match(/^#{1,3}\s+.*(?:Spell|Spells|Spell List|Spellcasting)/i) && !line.match(/cantrip|\d+(?:st|nd|rd|th)/i)) {
      continue;
    }

    // Convert level headers to ##### format (V3 standard for spell list levels)
    const levelMatch = line.match(/^#{1,5}\s+(Cantrips?(?:\s*\(0 Level\))?|\d+(?:st|nd|rd|th)\s+Level.*)/i);
    if (levelMatch) {
      lines.push(`##### ${levelMatch[1]}`);
      continue;
    }

    // Convert spell items to - spell format
    const spellMatch = line.match(/^[-*]\s+(.+)$/);
    if (spellMatch) {
      lines.push(`- ${spellMatch[1].trim()}`);
      continue;
    }

    // Skip empty lines but keep one for spacing
    if (!line.trim()) {
      // Only add blank line if the last line wasn't blank
      if (lines.length > 0 && lines[lines.length - 1].trim() !== '') {
        lines.push('');
      }
      continue;
    }
  }

  lines.push('}}');
  return lines.join('\n');
}
