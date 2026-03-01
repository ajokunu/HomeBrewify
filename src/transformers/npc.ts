import { NPCData, MonsterData } from '../types.js';
import { convertMonster, transformMonster } from './monster.js';

/**
 * Parse NPC data from markdown content
 */
export function parseNPC(content: string): NPCData {
  const npc: NPCData = {
    name: 'Unknown NPC',
  };

  // Extract name from header
  const nameMatch = content.match(/^#{1,3}\s*(?:NPC:\s*)?(.+)$/m);
  if (nameMatch) {
    npc.name = nameMatch[1].trim();
  }

  // Extract title/occupation from italic line after name
  const titleMatch = content.match(/\*([^*]+)\*/);
  if (titleMatch) {
    const titleLine = titleMatch[1];
    // Common patterns: "The Accused Innocent", "Master Wizard", etc.
    npc.title = titleLine.trim();

    // Try to extract race and occupation
    const racePattern = /(human|elf|dwarf|halfling|gnome|half-elf|half-orc|tiefling|dragonborn|orc)/i;
    const raceMatch = titleLine.match(racePattern);
    if (raceMatch) {
      npc.race = raceMatch[1];
    }
  }

  // Extract description from descriptive blocks or first paragraph
  const descMatch = content.match(/\{\{descriptive\n([\s\S]*?)\}\}/);
  if (descMatch) {
    npc.description = descMatch[1].trim();
  } else {
    // Look for paragraph after header
    const paragraphMatch = content.match(/^(?!#|\*|\||>)[A-Z][^]*?(?=\n\n|\n#|\n\*\*|$)/m);
    if (paragraphMatch) {
      npc.description = paragraphMatch[0].trim();
    }
  }

  // Extract personality traits
  const personalityMatch = content.match(/\*\*Personality[:\.]?\*\*\s*([^\n]+)/i);
  if (personalityMatch) {
    npc.personality = personalityMatch[1].trim();
  }

  // Extract ideals
  const idealsMatch = content.match(/\*\*Ideals?[:\.]?\*\*\s*([^\n]+)/i);
  if (idealsMatch) {
    npc.ideals = idealsMatch[1].trim();
  }

  // Extract bonds
  const bondsMatch = content.match(/\*\*Bonds?[:\.]?\*\*\s*([^\n]+)/i);
  if (bondsMatch) {
    npc.bonds = bondsMatch[1].trim();
  }

  // Extract flaws
  const flawsMatch = content.match(/\*\*Flaws?[:\.]?\*\*\s*([^\n]+)/i);
  if (flawsMatch) {
    npc.flaws = flawsMatch[1].trim();
  }

  // Extract secrets
  const secretsMatch = content.match(/\*\*Secrets?[:\.]?\*\*\s*([^\n]+)/i);
  if (secretsMatch) {
    npc.secrets = secretsMatch[1].trim();
  }

  // Extract quote (blockquote after name/description)
  const quoteMatch = content.match(/^>\s*"([^"]+)"/m);
  if (quoteMatch) {
    npc.quote = quoteMatch[1].trim();
  }

  // Check if this NPC has stat block data (AC, HP, abilities)
  const hasStats = /\b(AC|Armor Class)\s*[:=]?\s*\d+/i.test(content) &&
                   /\b(HP|Hit Points)\s*[:=]?\s*\d+/i.test(content);
  npc.hasStatBlock = hasStats;

  return npc;
}

/**
 * Transform NPC data to Homebrewery format
 */
export function transformNPC(data: NPCData): string {
  const lines: string[] = [];

  // NPC name header
  lines.push(`### NPC: ${data.name}`);

  // Title/role in italics
  if (data.title) {
    lines.push(`*${data.title}*`);
  }

  lines.push('');

  // Description in descriptive block
  if (data.description) {
    lines.push('{{descriptive');
    lines.push(data.description);

    // Add quote if present
    if (data.quote) {
      lines.push('');
      lines.push(`*"${data.quote}"*`);
    }

    lines.push('}}');
    lines.push('');
  }

  // Personality traits in note block
  const hasTraits = data.personality || data.ideals || data.bonds || data.flaws;
  if (hasTraits) {
    lines.push('{{note');
    lines.push('##### Character Traits');
    lines.push('');

    if (data.personality) {
      lines.push(`**Personality.** ${data.personality}`);
      lines.push('');
    }
    if (data.ideals) {
      lines.push(`**Ideals.** ${data.ideals}`);
      lines.push('');
    }
    if (data.bonds) {
      lines.push(`**Bonds.** ${data.bonds}`);
      lines.push('');
    }
    if (data.flaws) {
      lines.push(`**Flaws.** ${data.flaws}`);
    }

    lines.push('}}');
    lines.push('');
  }

  // Secrets in separate note block (DM only)
  if (data.secrets) {
    lines.push('{{note');
    lines.push('##### DM Secret');
    lines.push('');
    lines.push(data.secrets);
    lines.push('}}');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Transform NPC as a simplified stat block (for combat-relevant NPCs)
 */
export function transformNPCAsStatBlock(data: NPCData): string {
  if (!data.stats) {
    return transformNPC(data);
  }

  // Build monster data from NPC stats
  const monsterData: MonsterData = {
    name: data.name,
    ...data.stats,
  };

  // If alignment isn't set, default to neutral
  if (!monsterData.alignment && data.title) {
    // Try to extract alignment from title if present
    const alignments = ['lawful good', 'neutral good', 'chaotic good',
                       'lawful neutral', 'neutral', 'chaotic neutral',
                       'lawful evil', 'neutral evil', 'chaotic evil'];
    for (const align of alignments) {
      if (data.title.toLowerCase().includes(align)) {
        monsterData.alignment = align;
        break;
      }
    }
  }

  return transformMonster(monsterData);
}

/**
 * Convert raw NPC content to Homebrewery format
 */
export function convertNPC(content: string): string {
  const data = parseNPC(content);

  // If NPC has stat block data, convert as monster stat block
  if (data.hasStatBlock) {
    return convertMonster(content);
  }

  return transformNPC(data);
}

/**
 * Check if content is an NPC description
 */
export function isNPC(content: string): boolean {
  // Explicit NPC header
  if (/^##?\s*NPC:\s*/im.test(content)) {
    return true;
  }

  // Has personality traits without being a full monster stat block
  const hasTraits = /\*\*(Personality|Ideals?|Bonds?|Flaws?)[:\.]?\*\*/i.test(content);
  const isMonster = /\b(AC|Armor Class)\s*[:=]?\s*\d+/i.test(content) &&
                    /\bSTR\s+\d+/i.test(content);

  return hasTraits && !isMonster;
}
