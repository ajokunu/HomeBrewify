import { SpellData } from '../types.js';

/**
 * Parse spell from content
 */
export function parseSpell(content: string): SpellData {
  const spell: SpellData = {
    name: 'Unknown Spell',
    description: '',
  };

  // Extract name from header
  const headerMatch = content.match(/^#{1,4}\s*(?:Spell:\s*)?(.+)$/im);
  if (headerMatch) {
    spell.name = headerMatch[1].trim();
  }

  // Extract level and school (e.g., "3rd-level evocation")
  const levelMatch = content.match(/(\d+)(?:st|nd|rd|th)-level\s+(abjuration|conjuration|divination|enchantment|evocation|illusion|necromancy|transmutation)/i);
  if (levelMatch) {
    spell.level = parseInt(levelMatch[1]);
    spell.school = levelMatch[2].toLowerCase();
  }

  // Check for cantrip
  const cantripMatch = content.match(/(abjuration|conjuration|divination|enchantment|evocation|illusion|necromancy|transmutation)\s+cantrip/i);
  if (cantripMatch) {
    spell.level = 0;
    spell.school = cantripMatch[1].toLowerCase();
  }

  // Extract casting time (supports : = and :: separators, strips trailing bold markers)
  const castingMatch = content.match(/\*?\*?Casting Time\*?\*?\s*(?:::|\s*[:=])\s*\*{0,2}\s*(.+)/i);
  if (castingMatch) {
    spell.castingTime = castingMatch[1].trim();
  }

  // Extract range
  const rangeMatch = content.match(/\*?\*?Range\*?\*?\s*(?:::|\s*[:=])\s*\*{0,2}\s*(.+)/i);
  if (rangeMatch) {
    spell.range = rangeMatch[1].trim();
  }

  // Extract components
  const componentsMatch = content.match(/\*?\*?Components?\*?\*?\s*(?:::|\s*[:=])\s*\*{0,2}\s*(.+)/i);
  if (componentsMatch) {
    spell.components = componentsMatch[1].trim();
  }

  // Extract duration
  const durationMatch = content.match(/\*?\*?Duration\*?\*?\s*(?:::|\s*[:=])\s*\*{0,2}\s*(.+)/i);
  if (durationMatch) {
    spell.duration = durationMatch[1].trim();
  }

  // Extract description (everything after the stat block)
  const lines = content.split('\n');
  let inDescription = false;
  const descLines: string[] = [];

  for (const line of lines) {
    // Skip header and stat lines
    if (line.match(/^#{1,4}/) || line.match(/^\*?\*?(Casting Time|Range|Components?|Duration)\*?\*?\s*[:=]/i)) {
      continue;
    }

    // Skip level line
    if (line.match(/\d+(?:st|nd|rd|th)-level/i) || line.match(/cantrip/i)) {
      inDescription = true;
      continue;
    }

    // Skip separator
    if (line.match(/^[-_]{3,}$/)) {
      inDescription = true;
      continue;
    }

    if (inDescription && line.trim()) {
      descLines.push(line);
    } else if (!line.match(/\*?\*?(Casting|Range|Component|Duration)/i) && line.trim()) {
      descLines.push(line);
    }
  }

  spell.description = descLines.join('\n').trim();

  return spell;
}

/**
 * Transform spell to Homebrewery format
 */
export function transformSpell(data: SpellData): string {
  const lines: string[] = [];

  // Spell name as header
  lines.push(`#### ${data.name}`);

  // Level and school line
  if (data.level !== undefined && data.school) {
    if (data.level === 0) {
      lines.push(`*${data.school.charAt(0).toUpperCase() + data.school.slice(1)} cantrip*`);
    } else {
      const suffix = data.level === 1 ? 'st' : data.level === 2 ? 'nd' : data.level === 3 ? 'rd' : 'th';
      lines.push(`*${data.level}${suffix}-level ${data.school}*`);
    }
  }

  // Separator
  lines.push('___');

  // Spell stats using V3 definition list syntax
  if (data.castingTime) {
    lines.push(`**Casting Time** :: ${data.castingTime}`);
  }
  if (data.range) {
    lines.push(`**Range** :: ${data.range}`);
  }
  if (data.components) {
    lines.push(`**Components** :: ${data.components}`);
  }
  if (data.duration) {
    lines.push(`**Duration** :: ${data.duration}`);
  }

  lines.push('');

  // Description
  if (data.description) {
    lines.push(data.description);
  }

  return lines.join('\n');
}

/**
 * Convert raw content to Homebrewery spell format
 */
export function convertSpell(content: string): string {
  const data = parseSpell(content);
  return transformSpell(data);
}
