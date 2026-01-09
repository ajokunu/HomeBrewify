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

/**
 * Parse a stat line (saving throws, skills, etc.)
 */
function parseStatLine(content: string, label: string): string | undefined {
  const pattern = new RegExp(`\\*{0,2}${label}\\*{0,2}\\s*[:=]?\\s*([^\\n]+)`, 'i');
  const match = content.match(pattern);
  return match ? match[1].trim() : undefined;
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
 * Parse traits (abilities before Actions section)
 */
function parseTraits(content: string): MonsterData['traits'] {
  const traits: MonsterData['traits'] = [];

  // Find content between ability scores and Actions header
  const actionsIndex = content.search(/#{1,3}\s*Actions/i);
  const searchContent = actionsIndex > 0 ? content.substring(0, actionsIndex) : content;

  // Match bold text followed by description
  const traitPattern = /\*{2,3}([^*]+)\.\*{2,3}\s*([^\n]+(?:\n(?!\*{2,3}|\#{1,3})[^\n]+)*)/g;
  let match;

  while ((match = traitPattern.exec(searchContent)) !== null) {
    const name = match[1].trim();
    const description = match[2].trim();

    // Skip if it looks like a stat line
    if (/^(Armor Class|Hit Points|Speed|Senses|Languages|Challenge|Proficiency|Saving|Skills|Damage|Condition)/i.test(name)) {
      continue;
    }

    // Skip spellcasting (handled separately)
    if (/^(Spellcasting|Innate Spellcasting)/i.test(name)) {
      continue;
    }

    traits.push({ name, description });
  }

  return traits;
}

/**
 * Parse spellcasting trait
 */
function parseSpellcasting(content: string): SpellcastingData | undefined {
  const spellcastingMatch = content.match(/\*{2,3}((?:Innate )?Spellcasting)\.\*{2,3}\s*([\s\S]*?)(?=\*{2,3}[^*]+\.\*{2,3}|#{1,3}\s*Actions|$)/i);
  if (!spellcastingMatch) return undefined;

  const spellText = spellcastingMatch[2];
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
 * Parse actions from Actions section
 */
function parseActions(content: string): MonsterData['actions'] {
  const actions: MonsterData['actions'] = [];

  const actionsMatch = content.match(/#{1,3}\s*Actions[\s\S]*?(?=#{1,3}\s*(?:Reactions|Legendary|Lair|Regional|Mythic|$)|$)/i);
  if (!actionsMatch) return actions;

  const actionsContent = actionsMatch[0];
  const actionPattern = /\*{2,3}([^*]+)\.\*{2,3}\s*([^\n]+(?:\n(?!\*{2,3}|\#{1,3})[^\n]+)*)/g;
  let match;

  while ((match = actionPattern.exec(actionsContent)) !== null) {
    actions.push({
      name: match[1].trim(),
      description: match[2].trim(),
    });
  }

  return actions;
}

/**
 * Parse reactions section
 */
function parseReactions(content: string): Array<{ name: string; description: string }> | undefined {
  const reactionsMatch = content.match(/#{1,3}\s*Reactions[\s\S]*?(?=#{1,3}\s*(?:Legendary|Lair|Regional|Mythic|$)|$)/i);
  if (!reactionsMatch) return undefined;

  const reactions: Array<{ name: string; description: string }> = [];
  const reactionPattern = /\*{2,3}([^*]+)\.\*{2,3}\s*([^\n]+(?:\n(?!\*{2,3}|\#{1,3})[^\n]+)*)/g;
  let match;

  while ((match = reactionPattern.exec(reactionsMatch[0])) !== null) {
    reactions.push({
      name: match[1].trim(),
      description: match[2].trim(),
    });
  }

  return reactions.length > 0 ? reactions : undefined;
}

/**
 * Parse legendary actions
 */
function parseLegendaryActions(content: string): { actions: Array<{ name: string; description: string }> | undefined; count: number } {
  const legendaryMatch = content.match(/#{1,3}\s*Legendary Actions[\s\S]*?(?=#{1,3}\s*(?:Lair|Regional|Mythic|$)|$)/i);
  if (!legendaryMatch) return { actions: undefined, count: 3 };

  const legendaryContent = legendaryMatch[0];
  const actions: Array<{ name: string; description: string }> = [];

  // Extract action count from intro text
  let count = 3;
  const countMatch = legendaryContent.match(/can take (\d+) legendary actions/i);
  if (countMatch) {
    count = parseInt(countMatch[1]);
  }

  // Parse legendary action entries
  const actionPattern = /\*{2,3}([^*]+)(?:\s*\(Costs (\d+) Actions?\))?\.\*{2,3}\s*([^\n]+(?:\n(?!\*{2,3}|\#{1,3})[^\n]+)*)/gi;
  let match;

  while ((match = actionPattern.exec(legendaryContent)) !== null) {
    const name = match[1].trim();
    const cost = match[2] ? ` (Costs ${match[2]} Actions)` : '';
    actions.push({
      name: name + cost,
      description: match[3].trim(),
    });
  }

  return { actions: actions.length > 0 ? actions : undefined, count };
}

/**
 * Parse mythic actions
 */
function parseMythicActions(content: string): Array<{ name: string; description: string; cost?: number }> | undefined {
  const mythicMatch = content.match(/#{1,3}\s*Mythic Actions[\s\S]*?(?=#{1,3}|$)/i);
  if (!mythicMatch) return undefined;

  const actions: Array<{ name: string; description: string; cost?: number }> = [];
  const actionPattern = /\*{2,3}([^*]+)(?:\s*\(Costs (\d+) Actions?\))?\.\*{2,3}\s*([^\n]+(?:\n(?!\*{2,3}|\#{1,3})[^\n]+)*)/gi;
  let match;

  while ((match = actionPattern.exec(mythicMatch[0])) !== null) {
    actions.push({
      name: match[1].trim(),
      description: match[3].trim(),
      cost: match[2] ? parseInt(match[2]) : undefined,
    });
  }

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
    lines.push('### Actions');
    for (const action of data.actions) {
      lines.push(`***${action.name}.*** ${action.description}`);
      lines.push(':');
    }
    lines.pop();
  }

  // Reactions
  if (data.reactions && data.reactions.length > 0) {
    lines.push('### Reactions');
    for (const reaction of data.reactions) {
      lines.push(`***${reaction.name}.*** ${reaction.description}`);
      lines.push(':');
    }
    lines.pop();
  }

  // Legendary Actions
  if (data.legendaryActions && data.legendaryActions.length > 0) {
    lines.push('### Legendary Actions');
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
    lines.push('### Mythic Actions');
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
    lines.push('##### Lair Actions');
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
    lines.push('##### Regional Effects');
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
