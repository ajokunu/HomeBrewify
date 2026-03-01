import { MonsterData, ExtendedMonsterData, SpellcastingData, getAbilityModifier } from '../types.js';

/**
 * Parse monster data from markdown content
 */
export function parseMonster(content: string): ExtendedMonsterData {
  const monster: ExtendedMonsterData = { name: 'Unknown Creature' };

  // Extract name from header - prioritize "Monster:" headers
  const monsterHeaderMatch = content.match(/^#{1,3}\s*Monster:\s*(.+)$/m);
  if (monsterHeaderMatch) {
    monster.name = monsterHeaderMatch[1].trim();
  } else {
    const subHeaderMatch = content.match(/^###\s+(?!Actions|Reactions|Legendary|Lair|Regional)(.+)$/m);
    if (subHeaderMatch) {
      monster.name = subHeaderMatch[1].trim();
    } else {
      const headerMatch = content.match(/^#{1,2}\s+(.+)$/m);
      if (headerMatch) {
        const header = headerMatch[1].trim();
        if (!/encounter|chapter|act|section/i.test(header)) {
          monster.name = header;
        }
      }
    }
  }

  // Extract size, type, alignment (usually first italic line)
  const typeMatch = content.match(/\*([^*]+)\*/);
  if (typeMatch) {
    const typeLine = typeMatch[1].toLowerCase();
    // Parse size
    const sizes = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];
    for (const size of sizes) {
      if (typeLine.includes(size)) {
        monster.size = size.charAt(0).toUpperCase() + size.slice(1);
        break;
      }
    }
    // Parse type
    const types = ['aberration', 'beast', 'celestial', 'construct', 'dragon', 'elemental',
                   'fey', 'fiend', 'giant', 'humanoid', 'monstrosity', 'ooze', 'plant', 'undead'];
    for (const type of types) {
      if (typeLine.includes(type)) {
        monster.type = type;
        break;
      }
    }
    // Parse alignment
    const alignments = ['lawful good', 'neutral good', 'chaotic good',
                       'lawful neutral', 'true neutral', 'neutral', 'chaotic neutral',
                       'lawful evil', 'neutral evil', 'chaotic evil', 'unaligned'];
    for (const align of alignments) {
      if (typeLine.includes(align)) {
        monster.alignment = align;
        break;
      }
    }
  }

  // Extract AC
  const acMatch = content.match(/(?:AC|Armor Class)\s*[:=]?\s*(\d+(?:\s*\([^)]+\))?)/i);
  if (acMatch) {
    monster.ac = acMatch[1];
  }

  // Extract HP
  const hpMatch = content.match(/(?:HP|Hit Points)\s*[:=]?\s*(\d+(?:\s*\([^)]+\))?)/i);
  if (hpMatch) {
    monster.hp = hpMatch[1];
  }

  // Extract Speed
  const speedMatch = content.match(/Speed\s*[:=]?\s*([^\n]+)/i);
  if (speedMatch) {
    monster.speed = speedMatch[1].trim();
  }

  // Extract ability scores
  monster.abilities = parseAbilityScores(content);

  // Extract secondary stats
  monster.savingThrows = parseStatLine(content, 'Saving Throws?');
  monster.skills = parseStatLine(content, 'Skills?');
  monster.damageVulnerabilities = parseStatLine(content, 'Damage Vulnerabilities');
  monster.damageResistances = parseStatLine(content, 'Damage Resistances?');
  monster.damageImmunities = parseStatLine(content, 'Damage Immunit(?:y|ies)');
  monster.conditionImmunities = parseStatLine(content, 'Condition Immunit(?:y|ies)');
  monster.senses = parseStatLine(content, 'Senses');
  monster.languages = parseStatLine(content, 'Languages?');

  // Extract Challenge Rating
  const crMatch = content.match(/(?:Challenge|CR)\s*[:=]?\s*([\d/]+)(?:\s*\(([^)]+)\))?/i);
  if (crMatch) {
    monster.challenge = crMatch[1];
    if (crMatch[2]) {
      monster.challenge += ` (${crMatch[2]})`;
    }
  }

  // Extract Proficiency Bonus
  const pbMatch = content.match(/Proficiency Bonus\s*[:=]?\s*(\+?\d+)/i);
  if (pbMatch) {
    monster.proficiencyBonus = pbMatch[1];
  }

  // Extract traits (abilities before Actions section)
  monster.traits = parseTraits(content);

  // Extract spellcasting
  monster.spellcasting = parseSpellcasting(content);

  // Extract actions
  monster.actions = parseActions(content);

  // Extract reactions
  monster.reactions = parseReactions(content);

  // Extract legendary actions
  const legendaryResult = parseLegendaryActions(content);
  monster.legendaryActions = legendaryResult.actions;
  monster.legendaryActionCount = legendaryResult.count;

  // Extract mythic actions
  monster.mythicActions = parseMythicActions(content);

  // Extract lair actions
  monster.lairActions = parseLairActions(content);

  // Extract regional effects
  monster.regionalEffects = parseRegionalEffects(content);

  return monster;
}

// Pre-compiled stat line regexes to avoid constructing RegExp in hot loops.
// Anchored to start of line (multiline) to avoid matching inside trait descriptions.
// Handles both `**Label:** value` and `**Label** value` formats.
const STAT_LINE_PATTERNS: Record<string, RegExp> = {
  'Saving Throws?': /^\*{0,2}Saving Throws?\*{0,2}\s*[:=]?\s*\*{0,2}\s*([^\n]+)/im,
  'Skills?': /^\*{0,2}Skills?\*{0,2}\s*[:=]?\s*\*{0,2}\s*([^\n]+)/im,
  'Damage Vulnerabilities': /^\*{0,2}Damage Vulnerabilities\*{0,2}\s*[:=]?\s*\*{0,2}\s*([^\n]+)/im,
  'Damage Resistances?': /^\*{0,2}Damage Resistances?\*{0,2}\s*[:=]?\s*\*{0,2}\s*([^\n]+)/im,
  'Damage Immunit(?:y|ies)': /^\*{0,2}Damage Immunit(?:y|ies)\*{0,2}\s*[:=]?\s*\*{0,2}\s*([^\n]+)/im,
  'Condition Immunit(?:y|ies)': /^\*{0,2}Condition Immunit(?:y|ies)\*{0,2}\s*[:=]?\s*\*{0,2}\s*([^\n]+)/im,
  'Senses': /^\*{0,2}Senses\*{0,2}\s*[:=]?\s*\*{0,2}\s*([^\n]+)/im,
  'Languages?': /^\*{0,2}Languages?\*{0,2}\s*[:=]?\s*\*{0,2}\s*([^\n]+)/im,
};

/**
 * Parse a stat line (saving throws, skills, etc.)
 * Uses pre-compiled patterns for performance.
 */
function parseStatLine(content: string, label: string): string | undefined {
  const pattern = STAT_LINE_PATTERNS[label] ||
    new RegExp(`\\*{0,2}${label}\\*{0,2}\\s*[:=]?\\s*\\*{0,2}\\s*([^\\n]+)`, 'i');
  const match = content.match(pattern);
  return match ? match[1].trim() : undefined;
}

/**
 * Extract a section of content between a start header pattern and end header pattern.
 * Returns the section text (excluding the start header line) or null if not found.
 */
function extractSection(content: string, startPattern: RegExp, endPattern: RegExp): string | null {
  const lines = content.split('\n');
  let inSection = false;
  let startIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (!inSection && startPattern.test(lines[i])) {
      inSection = true;
      startIdx = i + 1;
      continue;
    }
    if (inSection && i > startIdx && endPattern.test(lines[i])) {
      return lines.slice(startIdx, i).join('\n');
    }
  }

  return inSection ? lines.slice(startIdx).join('\n') : null;
}

/**
 * Parse bold-name entries (***Name.*** description) from section content.
 * Line-by-line parsing avoids ReDoS from nested quantifiers.
 */
function parseBoldEntries(sectionContent: string): Array<{ name: string; description: string }> {
  const entries: Array<{ name: string; description: string }> = [];
  const lines = sectionContent.split('\n');
  let current: { name: string; description: string } | null = null;

  for (const line of lines) {
    const boldMatch = line.match(/^\*{2,3}([^*]{1,200})\.\*{2,3}\s*(.*)$/);
    if (boldMatch) {
      if (current) entries.push(current);
      current = { name: boldMatch[1].trim(), description: boldMatch[2].trim() };
    } else if (current && line.trim() && !line.match(/^#{1,3}\s/)) {
      current.description += '\n' + line;
    }
  }
  if (current) entries.push(current);

  return entries;
}

/**
 * Parse ability scores from various formats
 */
function parseAbilityScores(content: string): MonsterData['abilities'] {
  const abilities: MonsterData['abilities'] = {};

  // Format 1: STR 10 DEX 14 CON 12 ...
  const inlineMatch = content.match(/STR\s+(\d+).*?DEX\s+(\d+).*?CON\s+(\d+).*?INT\s+(\d+).*?WIS\s+(\d+).*?CHA\s+(\d+)/i);
  if (inlineMatch) {
    abilities.str = parseInt(inlineMatch[1]);
    abilities.dex = parseInt(inlineMatch[2]);
    abilities.con = parseInt(inlineMatch[3]);
    abilities.int = parseInt(inlineMatch[4]);
    abilities.wis = parseInt(inlineMatch[5]);
    abilities.cha = parseInt(inlineMatch[6]);
    return abilities;
  }

  // Format 2: Table with |STR|DEX|CON|INT|WIS|CHA| header
  const tableMatch = content.match(/\|STR\|DEX\|CON\|INT\|WIS\|CHA\|[\s\S]*?\|[\s:|-]+\|[\s\S]*?\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|/i);
  if (tableMatch) {
    abilities.str = parseInt(tableMatch[1].match(/\d+/)?.[0] || '10');
    abilities.dex = parseInt(tableMatch[2].match(/\d+/)?.[0] || '10');
    abilities.con = parseInt(tableMatch[3].match(/\d+/)?.[0] || '10');
    abilities.int = parseInt(tableMatch[4].match(/\d+/)?.[0] || '10');
    abilities.wis = parseInt(tableMatch[5].match(/\d+/)?.[0] || '10');
    abilities.cha = parseInt(tableMatch[6].match(/\d+/)?.[0] || '10');
    return abilities;
  }

  // Format 3: Individual lines like "STR: 10 (+0)"
  const strMatch = content.match(/\bSTR\b[:\s]+(\d+)/i);
  const dexMatch = content.match(/\bDEX\b[:\s]+(\d+)/i);
  const conMatch = content.match(/\bCON\b[:\s]+(\d+)/i);
  const intMatch = content.match(/\bINT\b[:\s]+(\d+)/i);
  const wisMatch = content.match(/\bWIS\b[:\s]+(\d+)/i);
  const chaMatch = content.match(/\bCHA\b[:\s]+(\d+)/i);

  if (strMatch) abilities.str = parseInt(strMatch[1]);
  if (dexMatch) abilities.dex = parseInt(dexMatch[1]);
  if (conMatch) abilities.con = parseInt(conMatch[1]);
  if (intMatch) abilities.int = parseInt(intMatch[1]);
  if (wisMatch) abilities.wis = parseInt(wisMatch[1]);
  if (chaMatch) abilities.cha = parseInt(chaMatch[1]);

  return abilities;
}

/**
 * Parse traits (abilities before Actions section).
 * Uses line-by-line parsing to avoid ReDoS from nested quantifiers.
 */
function parseTraits(content: string): MonsterData['traits'] {
  const traits: MonsterData['traits'] = [];

  // Find content between ability scores and Actions header
  const actionsIndex = content.search(/#{1,3}\s*Actions/i);
  const searchContent = actionsIndex > 0 ? content.substring(0, actionsIndex) : content;

  // Parse line by line instead of using unbounded multi-line regex
  const lines = searchContent.split('\n');
  let currentTrait: { name: string; description: string } | null = null;

  for (const line of lines) {
    // Match bold trait header: **Name.** or ***Name.***
    const boldMatch = line.match(/^\*{2,3}([^*]{1,200})\.\*{2,3}\s*(.*)$/);
    if (boldMatch) {
      // Save previous trait
      if (currentTrait) traits.push(currentTrait);

      const name = boldMatch[1].trim();

      // Skip stat lines and spellcasting (handled separately)
      if (/^(Armor Class|Hit Points|Speed|Senses|Languages|Challenge|Proficiency|Saving|Skills|Damage|Condition)/i.test(name) ||
          /^(Spellcasting|Innate Spellcasting)/i.test(name)) {
        currentTrait = null;
        continue;
      }

      currentTrait = { name, description: boldMatch[2].trim() };
    } else if (currentTrait && line.trim() && !line.match(/^#{1,3}\s/)) {
      // Continuation line for current trait
      currentTrait.description += '\n' + line;
    } else if (line.match(/^#{1,3}\s/) || !line.trim()) {
      // Header or blank line ends current trait
      if (currentTrait) {
        traits.push(currentTrait);
        currentTrait = null;
      }
    }
  }

  // Don't forget the last trait
  if (currentTrait) traits.push(currentTrait);

  return traits;
}

/**
 * Parse spellcasting trait.
 * Uses bounded section parsing to avoid ReDoS from unbounded lazy quantifiers.
 */
function parseSpellcasting(content: string): SpellcastingData | undefined {
  // Find the spellcasting header
  const headerMatch = content.match(/\*{2,3}((?:Innate )?Spellcasting)\.\*{2,3}/i);
  if (!headerMatch || headerMatch.index === undefined) return undefined;

  // Extract bounded text: from after header to next bold trait or section header
  const startIdx = headerMatch.index + headerMatch[0].length;
  const remaining = content.substring(startIdx);
  const endMatch = remaining.match(/\n\*{2,3}[^*\n]{1,200}\.\*{2,3}|\n#{1,3}\s*Actions/i);
  const spellText = endMatch ? remaining.substring(0, endMatch.index) : remaining;
  const data: SpellcastingData = {
    ability: 'Intelligence',
    saveDC: 13,
    attackBonus: 5,
    spells: {},
  };

  // Extract ability
  const abilityMatch = spellText.match(/spellcasting ability is (\w+)/i);
  if (abilityMatch) {
    data.ability = abilityMatch[1];
  }

  // Extract save DC
  const dcMatch = spellText.match(/spell save DC (\d+)/i);
  if (dcMatch) {
    data.saveDC = parseInt(dcMatch[1]);
  }

  // Extract attack bonus
  const attackMatch = spellText.match(/([+-]\d+) to hit with spell/i);
  if (attackMatch) {
    data.attackBonus = parseInt(attackMatch[1]);
  }

  // Extract spellcaster level
  const levelMatch = spellText.match(/(\d+)(?:st|nd|rd|th)-level spellcaster/i);
  if (levelMatch) {
    data.level = parseInt(levelMatch[1]);
  }

  // Parse at-will spells
  const atWillMatch = spellText.match(/At will:\s*([^\n]+)/i);
  if (atWillMatch) {
    data.spells.atWill = atWillMatch[1].split(',').map((s) => s.trim().replace(/^\*|\*$/g, ''));
  }

  // Parse per-day spells
  const perDayPattern = /(\d+)\/day(?: each)?:\s*([^\n]+)/gi;
  let perDayMatch;
  while ((perDayMatch = perDayPattern.exec(spellText)) !== null) {
    if (!data.spells.perDay) data.spells.perDay = {};
    data.spells.perDay[perDayMatch[1]] = perDayMatch[2].split(',').map((s) => s.trim().replace(/^\*|\*$/g, ''));
  }

  // Parse slot-based spellcasting
  const slotPattern = /(\d+)(?:st|nd|rd|th) level \((\d+) slots?\):\s*([^\n]+)/gi;
  let slotMatch;
  while ((slotMatch = slotPattern.exec(spellText)) !== null) {
    if (!data.spells.slots) data.spells.slots = {};
    data.spells.slots[slotMatch[1]] = {
      slots: parseInt(slotMatch[2]),
      spells: slotMatch[3].split(',').map((s) => s.trim().replace(/^\*|\*$/g, '')),
    };
  }

  // Cantrips
  const cantripMatch = spellText.match(/Cantrips(?: \(at will\))?:\s*([^\n]+)/i);
  if (cantripMatch) {
    if (!data.spells.slots) data.spells.slots = {};
    data.spells.slots['0'] = {
      slots: 0,
      spells: cantripMatch[1].split(',').map((s) => s.trim().replace(/^\*|\*$/g, '')),
    };
  }

  return data;
}

/**
 * Parse actions from Actions section.
 * Uses bounded section extraction and line-by-line parsing.
 */
function parseActions(content: string): MonsterData['actions'] {
  const sectionContent = extractSection(content, /#{1,3}\s*Actions/i,
    /#{1,3}\s*(?:Reactions|Legendary|Lair|Regional|Mythic)/i);
  if (!sectionContent) return [];

  return parseBoldEntries(sectionContent);
}

/**
 * Parse reactions section
 */
function parseReactions(content: string): Array<{ name: string; description: string }> | undefined {
  const sectionContent = extractSection(content, /#{1,3}\s*Reactions/i,
    /#{1,3}\s*(?:Legendary|Lair|Regional|Mythic)/i);
  if (!sectionContent) return undefined;

  const reactions = parseBoldEntries(sectionContent);
  return reactions.length > 0 ? reactions : undefined;
}

/**
 * Parse legendary actions
 */
function parseLegendaryActions(content: string): { actions: Array<{ name: string; description: string }> | undefined; count: number } {
  const sectionContent = extractSection(content, /#{1,3}\s*Legendary Actions/i,
    /#{1,3}\s*(?:Lair|Regional|Mythic)/i);
  if (!sectionContent) return { actions: undefined, count: 3 };

  // Extract action count from intro text
  let count = 3;
  const countMatch = sectionContent.match(/can take (\d+) legendary actions/i);
  if (countMatch) {
    count = parseInt(countMatch[1]);
  }

  // Parse entries, handling cost annotations
  const actions: Array<{ name: string; description: string }> = [];
  const lines = sectionContent.split('\n');
  let currentEntry: { name: string; description: string } | null = null;

  for (const line of lines) {
    const boldMatch = line.match(/^\*{2,3}([^*]{1,200})(?:\s*\(Costs (\d+) Actions?\))?\.\*{2,3}\s*(.*)$/i);
    if (boldMatch) {
      if (currentEntry) actions.push(currentEntry);
      const name = boldMatch[1].trim();
      const cost = boldMatch[2] ? ` (Costs ${boldMatch[2]} Actions)` : '';
      currentEntry = { name: name + cost, description: boldMatch[3].trim() };
    } else if (currentEntry && line.trim() && !line.match(/^#{1,3}\s/)) {
      currentEntry.description += '\n' + line;
    } else if (!line.trim() || line.match(/^#{1,3}\s/)) {
      // Keep accumulating - blank lines within entry are ok for legendary actions
    }
  }
  if (currentEntry) actions.push(currentEntry);

  return { actions: actions.length > 0 ? actions : undefined, count };
}

/**
 * Parse mythic actions
 */
function parseMythicActions(content: string): Array<{ name: string; description: string; cost?: number }> | undefined {
  const sectionContent = extractSection(content, /#{1,3}\s*Mythic Actions/i, /#{1,3}/);
  if (!sectionContent) return undefined;

  const actions: Array<{ name: string; description: string; cost?: number }> = [];
  const lines = sectionContent.split('\n');
  let currentEntry: { name: string; description: string; cost?: number } | null = null;

  for (const line of lines) {
    const boldMatch = line.match(/^\*{2,3}([^*]{1,200})(?:\s*\(Costs (\d+) Actions?\))?\.\*{2,3}\s*(.*)$/i);
    if (boldMatch) {
      if (currentEntry) actions.push(currentEntry);
      currentEntry = {
        name: boldMatch[1].trim(),
        description: boldMatch[3].trim(),
        cost: boldMatch[2] ? parseInt(boldMatch[2]) : undefined,
      };
    } else if (currentEntry && line.trim() && !line.match(/^#{1,3}\s/)) {
      currentEntry.description += '\n' + line;
    }
  }
  if (currentEntry) actions.push(currentEntry);

  return actions.length > 0 ? actions : undefined;
}

/**
 * Parse lair actions
 */
function parseLairActions(content: string): Array<{ description: string }> | undefined {
  const lairMatch = content.match(/#{1,3}\s*Lair Actions[\s\S]*?(?=#{1,3}\s*(?:Regional|$)|$)/i);
  if (!lairMatch) return undefined;

  const actions: Array<{ description: string }> = [];

  // Lair actions are typically bullet points
  const bulletPattern = /^[\s]*[-*]\s+(.+)$/gm;
  let match;

  while ((match = bulletPattern.exec(lairMatch[0])) !== null) {
    actions.push({ description: match[1].trim() });
  }

  return actions.length > 0 ? actions : undefined;
}

/**
 * Parse regional effects
 */
function parseRegionalEffects(content: string): Array<{ description: string }> | undefined {
  const regionalMatch = content.match(/#{1,3}\s*Regional Effects[\s\S]*?(?=#{1,3}|$)/i);
  if (!regionalMatch) return undefined;

  const effects: Array<{ description: string }> = [];

  const bulletPattern = /^[\s]*[-*]\s+(.+)$/gm;
  let match;

  while ((match = bulletPattern.exec(regionalMatch[0])) !== null) {
    effects.push({ description: match[1].trim() });
  }

  return effects.length > 0 ? effects : undefined;
}

/**
 * Transform monster data to Homebrewery format
 */
export function transformMonster(data: ExtendedMonsterData): string {
  const lines: string[] = [];

  // Determine if this is a wide stat block (legendary/lair creatures)
  const isLegendary = data.legendaryActions || data.lairActions || data.mythicActions;
  const blockClass = isLegendary ? '{{monster,frame,wide' : '{{monster,frame';

  // Open monster block
  lines.push(blockClass);

  // Name
  lines.push(`## ${data.name}`);

  // Type line
  const typeParts: string[] = [];
  if (data.size) typeParts.push(data.size);
  if (data.type) typeParts.push(data.type);
  if (typeParts.length > 0) {
    const typeStr = typeParts.join(' ');
    const alignment = data.alignment || 'unaligned';
    lines.push(`*${typeStr}, ${alignment}*`);
  }

  // Separator
  lines.push('___');

  // Core stats
  if (data.ac) {
    lines.push(`**Armor Class** :: ${data.ac}`);
  }
  if (data.hp) {
    lines.push(`**Hit Points** :: ${data.hp}`);
  }
  if (data.speed) {
    lines.push(`**Speed** :: ${data.speed}`);
  }

  // Separator
  lines.push('___');

  // Ability scores table
  if (data.abilities) {
    lines.push('|STR|DEX|CON|INT|WIS|CHA|');
    lines.push('|:---:|:---:|:---:|:---:|:---:|:---:|');

    const str = data.abilities.str ?? 10;
    const dex = data.abilities.dex ?? 10;
    const con = data.abilities.con ?? 10;
    const int = data.abilities.int ?? 10;
    const wis = data.abilities.wis ?? 10;
    const cha = data.abilities.cha ?? 10;

    lines.push(`|${str} (${getAbilityModifier(str)})|${dex} (${getAbilityModifier(dex)})|${con} (${getAbilityModifier(con)})|${int} (${getAbilityModifier(int)})|${wis} (${getAbilityModifier(wis)})|${cha} (${getAbilityModifier(cha)})|`);
  }

  // Separator
  lines.push('___');

  // Secondary stats
  if (data.savingThrows) {
    lines.push(`**Saving Throws** :: ${data.savingThrows}`);
  }
  if (data.skills) {
    lines.push(`**Skills** :: ${data.skills}`);
  }
  if (data.damageVulnerabilities) {
    lines.push(`**Damage Vulnerabilities** :: ${data.damageVulnerabilities}`);
  }
  if (data.damageResistances) {
    lines.push(`**Damage Resistances** :: ${data.damageResistances}`);
  }
  if (data.damageImmunities) {
    lines.push(`**Damage Immunities** :: ${data.damageImmunities}`);
  }
  if (data.conditionImmunities) {
    lines.push(`**Condition Immunities** :: ${data.conditionImmunities}`);
  }
  if (data.senses) {
    lines.push(`**Senses** :: ${data.senses}`);
  }
  if (data.languages) {
    lines.push(`**Languages** :: ${data.languages}`);
  }
  if (data.challenge) {
    lines.push(`**Challenge** :: ${data.challenge}`);
  }
  if (data.proficiencyBonus) {
    lines.push(`**Proficiency Bonus** :: ${data.proficiencyBonus}`);
  }

  // Separator before traits
  lines.push('___');

  // Traits
  if (data.traits && data.traits.length > 0) {
    for (const trait of data.traits) {
      lines.push(`***${trait.name}.*** ${trait.description}`);
      lines.push(':');
    }
    lines.pop(); // Remove last colon
  }

  // Spellcasting
  if (data.spellcasting) {
    lines.push(formatSpellcasting(data.spellcasting, data.name));
    lines.push(':');
  }

  // Actions
  if (data.actions && data.actions.length > 0) {
    // Ensure separator before section header
    if (lines.length > 0 && lines[lines.length - 1] !== ':' && lines[lines.length - 1] !== '___') {
      lines.push(':');
    }
    lines.push('### Actions {--TOC:exclude}');
    for (const action of data.actions) {
      lines.push(`***${action.name}.*** ${action.description}`);
      lines.push(':');
    }
    lines.pop();
  }

  // Reactions
  if (data.reactions && data.reactions.length > 0) {
    if (lines.length > 0 && lines[lines.length - 1] !== ':') {
      lines.push(':');
    }
    lines.push('### Reactions {--TOC:exclude}');
    for (const reaction of data.reactions) {
      lines.push(`***${reaction.name}.*** ${reaction.description}`);
      lines.push(':');
    }
    lines.pop();
  }

  // Legendary Actions
  if (data.legendaryActions && data.legendaryActions.length > 0) {
    if (lines.length > 0 && lines[lines.length - 1] !== ':') {
      lines.push(':');
    }
    lines.push('### Legendary Actions {--TOC:exclude}');
    const count = data.legendaryActionCount || 3;
    lines.push(`The ${data.name.toLowerCase()} can take ${count} legendary actions, choosing from the options below. Only one legendary action option can be used at a time and only at the end of another creature's turn. The ${data.name.toLowerCase()} regains spent legendary actions at the start of its turn.`);
    lines.push(':');
    for (const action of data.legendaryActions) {
      lines.push(`***${action.name}.*** ${action.description}`);
      lines.push(':');
    }
    lines.pop();
  }

  // Mythic Actions
  if (data.mythicActions && data.mythicActions.length > 0) {
    if (lines.length > 0 && lines[lines.length - 1] !== ':') {
      lines.push(':');
    }
    lines.push('### Mythic Actions {--TOC:exclude}');
    lines.push(`If the ${data.name.toLowerCase()}'s mythic trait is active, it can use the options below as legendary actions.`);
    lines.push(':');
    for (const action of data.mythicActions) {
      const costStr = action.cost ? ` (Costs ${action.cost} Actions)` : '';
      lines.push(`***${action.name}${costStr}.*** ${action.description}`);
      lines.push(':');
    }
    lines.pop();
  }

  // Close monster block
  lines.push('}}');

  // Lair Actions (separate block)
  if (data.lairActions && data.lairActions.length > 0) {
    lines.push('');
    lines.push('{{note');
    lines.push('##### Lair Actions {--TOC:exclude}');
    lines.push('');
    lines.push('On initiative count 20 (losing initiative ties), the creature can take a lair action to cause one of the following effects:');
    lines.push('');
    for (const action of data.lairActions) {
      lines.push(`- ${action.description}`);
    }
    lines.push('}}');
  }

  // Regional Effects (separate block)
  if (data.regionalEffects && data.regionalEffects.length > 0) {
    lines.push('');
    lines.push('{{note');
    lines.push('##### Regional Effects {--TOC:exclude}');
    lines.push('');
    lines.push(`The region containing the ${data.name.toLowerCase()}'s lair is warped by its presence, creating the following effects:`);
    lines.push('');
    for (const effect of data.regionalEffects) {
      lines.push(`- ${effect.description}`);
    }
    lines.push('}}');
  }

  return lines.join('\n');
}

/**
 * Format spellcasting trait
 */
function formatSpellcasting(data: SpellcastingData, name: string): string {
  const lines: string[] = [];

  const intro = data.level
    ? `***Spellcasting.*** The ${name.toLowerCase()} is a ${data.level}${getOrdinalSuffix(data.level)}-level spellcaster. Its spellcasting ability is ${data.ability} (spell save DC ${data.saveDC}, +${data.attackBonus} to hit with spell attacks). The ${name.toLowerCase()} has the following spells prepared:`
    : `***Innate Spellcasting.*** The ${name.toLowerCase()}'s innate spellcasting ability is ${data.ability} (spell save DC ${data.saveDC}). It can innately cast the following spells, requiring no material components:`;

  lines.push(intro);
  lines.push(':');

  // At will spells
  if (data.spells.atWill && data.spells.atWill.length > 0) {
    lines.push(`At will: *${data.spells.atWill.join(', ')}*`);
    lines.push(':');
  }

  // Per day spells
  if (data.spells.perDay) {
    for (const [uses, spells] of Object.entries(data.spells.perDay)) {
      lines.push(`${uses}/day each: *${spells.join(', ')}*`);
      lines.push(':');
    }
  }

  // Slot-based spells
  if (data.spells.slots) {
    const sortedLevels = Object.keys(data.spells.slots).sort((a, b) => parseInt(a) - parseInt(b));
    for (const level of sortedLevels) {
      const slotData = data.spells.slots[level];
      if (level === '0') {
        lines.push(`Cantrips (at will): *${slotData.spells.join(', ')}*`);
      } else {
        const levelStr = `${level}${getOrdinalSuffix(parseInt(level))} level`;
        lines.push(`${levelStr} (${slotData.slots} slots): *${slotData.spells.join(', ')}*`);
      }
      lines.push(':');
    }
  }

  // Remove trailing colon
  if (lines[lines.length - 1] === ':') {
    lines.pop();
  }

  return lines.join('\n');
}

/**
 * Get ordinal suffix for number
 */
function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/**
 * Convert raw content to Homebrewery monster block
 */
export function convertMonster(content: string): string {
  const data = parseMonster(content);
  return transformMonster(data);
}
