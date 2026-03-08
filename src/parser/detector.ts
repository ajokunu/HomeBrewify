import { ContentType } from '../types.js';

/**
 * Detection patterns for each content type
 */
const patterns = {
  monster: {
    // Must have AC and HP
    acPattern: /\b(AC|Armor Class)\s*[:=]?\s*\d+/i,
    hpPattern: /\b(HP|Hit Points)\s*[:=]?\s*\d+/i,
    // Ability scores indicate monster
    abilityPattern: /\bSTR\s+\d+.*\bDEX\s+\d+.*\bCON\s+\d+/i,
    // Alternative: table format
    abilityTablePattern: /\|STR\|DEX\|CON\|INT\|WIS\|CHA\|/i,
  },

  item: {
    // Rarity keywords
    rarityPattern: /\b(common|uncommon|rare|very rare|legendary|artifact)\b/i,
    // Attunement
    attunementPattern: /requires attunement/i,
    // Item types
    typePattern: /\b(weapon|armor|wondrous item|ring|rod|staff|wand|potion|scroll)\b/i,
  },

  spell: {
    // Spell components
    castingTimePattern: /\*?\*?Casting Time\*?\*?\s*[:=]/i,
    rangePattern: /\*?\*?Range\*?\*?\s*[:=]/i,
    componentsPattern: /\*?\*?Components?\*?\*?\s*[:=]/i,
    durationPattern: /\*?\*?Duration\*?\*?\s*[:=]/i,
    // Spell level line
    levelPattern: /\d+(st|nd|rd|th)-level\s+(abjuration|conjuration|divination|enchantment|evocation|illusion|necromancy|transmutation)/i,
    cantripPattern: /\b(cantrip)\b/i,
  },

  location: {
    // Explicit location marker
    headerPattern: /^##?\s*(Location|Town of|City of|Village of|The\s+\w+\s+(Inn|Tavern|Castle|Keep|Tower|Temple|Shrine|Dungeon|Cave|Forest|Mountain))/im,
    // Geographic descriptions
    geoPattern: /\b(nestled|situated|located|lies|stands)\b.*\b(in|near|by|along|atop)\b/i,
  },

  chapter: {
    // Episode or chapter headers
    episodePattern: /^#\s*Episode\s+\d+/im,
    chapterPattern: /^#\s*Chapter\s+\d+/im,
    partPattern: /^#\s*Part\s+\d+/im,
  },

  readAloud: {
    // Blockquotes (most common)
    blockquotePattern: /^>\s+/m,
    // Explicit marker
    readAloudPattern: /^>\s*Read aloud:/im,
  },

  note: {
    // DM notes
    dmNotePattern: /\*{0,2}(DM Note|Note|Secret|Hidden)\*{0,2}\s*[:=]/i,
    // Tip or warning boxes
    tipPattern: /\*{0,2}(Tip|Warning|Important)\*{0,2}\s*[:=]/i,
  },

  npc: {
    // NPC header
    npcPattern: /^##?\s*NPC\s*:/im,
    // Character header without full stat block
    characterPattern: /^##?\s*(Character|Person)\s*:/im,
  },

  table: {
    // Markdown table
    tablePattern: /^\|.*\|.*\|/m,
    headerRowPattern: /^\|[-:]+\|/m,
  },
};

/**
 * Detect the content type of a markdown block
 */
export function detectContentType(text: string): ContentType {
  // Check for monster (most specific - needs AC, HP, and abilities)
  if (isMonster(text)) {
    return ContentType.Monster;
  }

  // Check for spell list (must come before single spell check)
  if (isSpellList(text)) {
    return ContentType.SpellList;
  }

  // Check for spell (has casting time, range, components, duration)
  if (isSpell(text)) {
    return ContentType.Spell;
  }

  // Check for magic item
  if (isItem(text)) {
    return ContentType.Item;
  }

  // Check for chapter/episode headers
  if (isChapter(text)) {
    return ContentType.Chapter;
  }

  // Check for location descriptions
  if (isLocation(text)) {
    return ContentType.Location;
  }

  // Check for NPC
  if (isNPC(text)) {
    return ContentType.NPC;
  }

  // Check for DM notes
  if (isNote(text)) {
    return ContentType.Note;
  }

  // Check for artist credit (short blocks with "Art by" etc.)
  if (isArtistCredit(text)) {
    return ContentType.ArtistCredit;
  }

  // Check for attributed quotes (before generic read-aloud)
  if (isQuote(text)) {
    return ContentType.Quote;
  }

  // Check for read-aloud text (blockquotes without attribution)
  if (isReadAloud(text)) {
    return ContentType.ReadAloud;
  }

  // Check for tables
  if (isTable(text)) {
    return ContentType.Table;
  }

  return ContentType.Unknown;
}

/**
 * Check if content is a monster stat block
 */
function isMonster(text: string): boolean {
  const hasAC = patterns.monster.acPattern.test(text);
  const hasHP = patterns.monster.hpPattern.test(text);
  const hasAbilities =
    patterns.monster.abilityPattern.test(text) ||
    patterns.monster.abilityTablePattern.test(text);

  // Must have at least AC and HP, preferably abilities too
  return hasAC && hasHP && hasAbilities;
}

/**
 * Check if content is a spell
 */
function isSpell(text: string): boolean {
  // Must have at least 3 of the 4 spell components
  let matches = 0;
  if (patterns.spell.castingTimePattern.test(text)) matches++;
  if (patterns.spell.rangePattern.test(text)) matches++;
  if (patterns.spell.componentsPattern.test(text)) matches++;
  if (patterns.spell.durationPattern.test(text)) matches++;

  // Or has a spell level line
  const hasLevel =
    patterns.spell.levelPattern.test(text) ||
    patterns.spell.cantripPattern.test(text);

  return matches >= 3 || (matches >= 2 && hasLevel);
}

/**
 * Check if content is a magic item
 */
function isItem(text: string): boolean {
  const hasRarity = patterns.item.rarityPattern.test(text);
  const hasAttunement = patterns.item.attunementPattern.test(text);
  const hasType = patterns.item.typePattern.test(text);

  // Must have rarity and either attunement or type
  return hasRarity && (hasAttunement || hasType);
}

/**
 * Check if content is a chapter/episode header
 */
function isChapter(text: string): boolean {
  return (
    patterns.chapter.episodePattern.test(text) ||
    patterns.chapter.chapterPattern.test(text) ||
    patterns.chapter.partPattern.test(text)
  );
}

/**
 * Check if content is a location description
 */
function isLocation(text: string): boolean {
  return (
    patterns.location.headerPattern.test(text) ||
    patterns.location.geoPattern.test(text)
  );
}

/**
 * Check if content is an NPC
 */
function isNPC(text: string): boolean {
  return (
    patterns.npc.npcPattern.test(text) ||
    patterns.npc.characterPattern.test(text)
  );
}

/**
 * Check if content is a DM note
 */
function isNote(text: string): boolean {
  return (
    patterns.note.dmNotePattern.test(text) ||
    patterns.note.tipPattern.test(text)
  );
}

/**
 * Check if content is read-aloud text
 */
function isReadAloud(text: string): boolean {
  // Only consider it read-aloud if it starts with blockquote
  // and doesn't match other patterns
  return (
    patterns.readAloud.blockquotePattern.test(text) ||
    patterns.readAloud.readAloudPattern.test(text)
  );
}

/**
 * Check if content is a table
 */
function isTable(text: string): boolean {
  return (
    patterns.table.tablePattern.test(text) &&
    patterns.table.headerRowPattern.test(text)
  );
}

/**
 * Check if content is a spell list (multiple level headers + spell items)
 */
function isSpellList(text: string): boolean {
  const levelHeaders = text.match(/^#{1,5}\s*(Cantrips?(?:\s*\(0 Level\))?|\d+(?:st|nd|rd|th)\s+Level)/gim) || [];
  const spellItems = text.match(/^[-*]\s+\w+/gm) || [];
  return levelHeaders.length >= 2 && spellItems.length >= 3;
}

/**
 * Check if content is a blockquote with attribution (for {{quote}} blocks)
 */
function isQuote(text: string): boolean {
  const hasBlockquote = patterns.readAloud.blockquotePattern.test(text);
  if (!hasBlockquote) return false;
  // Attribution patterns: — Author, -- Author, - Author (capitalized)
  return /^>\s*[-—–]{1,2}\s*[A-Z]/m.test(text);
}

/**
 * Check if content is an artist credit
 */
function isArtistCredit(text: string): boolean {
  return /\b(?:Art|Illustration|Image|Artwork)\s+(?:by|:)\s+.+/i.test(text) &&
    text.trim().split('\n').length <= 3;
}

/**
 * Get confidence score for detection (0-100)
 */
export function getDetectionConfidence(text: string, type: ContentType): number {
  switch (type) {
    case ContentType.Monster: {
      let score = 0;
      if (patterns.monster.acPattern.test(text)) score += 30;
      if (patterns.monster.hpPattern.test(text)) score += 30;
      if (patterns.monster.abilityPattern.test(text)) score += 30;
      if (patterns.monster.abilityTablePattern.test(text)) score += 10;
      return Math.min(100, score);
    }

    case ContentType.Spell: {
      let score = 0;
      if (patterns.spell.castingTimePattern.test(text)) score += 25;
      if (patterns.spell.rangePattern.test(text)) score += 25;
      if (patterns.spell.componentsPattern.test(text)) score += 25;
      if (patterns.spell.durationPattern.test(text)) score += 25;
      if (patterns.spell.levelPattern.test(text)) score += 20;
      return Math.min(100, score);
    }

    case ContentType.Item: {
      let score = 0;
      if (patterns.item.rarityPattern.test(text)) score += 40;
      if (patterns.item.attunementPattern.test(text)) score += 30;
      if (patterns.item.typePattern.test(text)) score += 30;
      return Math.min(100, score);
    }

    case ContentType.ReadAloud:
      return patterns.readAloud.blockquotePattern.test(text) ? 80 : 0;

    case ContentType.Chapter:
      if (patterns.chapter.episodePattern.test(text)) return 100;
      if (patterns.chapter.chapterPattern.test(text)) return 100;
      if (patterns.chapter.partPattern.test(text)) return 100;
      return 0;

    default:
      return 50;
  }
}
