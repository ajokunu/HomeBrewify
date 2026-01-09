import { ItemData } from '../types.js';

/**
 * Parse magic item from content
 */
export function parseItem(content: string): ItemData {
  const item: ItemData = {
    name: 'Unknown Item',
    description: '',
  };

  // Extract name from header
  const headerMatch = content.match(/^#{1,4}\s*(?:(?:Magic\s+)?Item:\s*)?(.+)$/im);
  if (headerMatch) {
    item.name = headerMatch[1].trim();
  }

  // Extract rarity
  const rarityMatch = content.match(/\b(common|uncommon|rare|very rare|legendary|artifact)\b/i);
  if (rarityMatch) {
    item.rarity = rarityMatch[1].toLowerCase();
  }

  // Extract type - expanded list
  const typePatterns = [
    'weapon',
    'armor',
    'wondrous item',
    'ring',
    'rod',
    'staff',
    'wand',
    'potion',
    'scroll',
    'amulet',
    'cloak',
    'boots',
    'gloves',
    'helm',
    'shield',
    'belt',
    'bracers',
    'circlet',
    'mask',
    'tome',
    'grimoire',
    'codex',
    'orb',
  ];

  for (const pattern of typePatterns) {
    const regex = new RegExp(`\\b${pattern}\\b`, 'i');
    if (regex.test(content)) {
      item.type = pattern;
      break;
    }
  }

  // Check for attunement and parse specific requirements
  const attunementMatch = content.match(/requires attunement(?: by (?:a |an )?([^)]+))?/i);
  if (attunementMatch) {
    item.attunement = true;
    if (attunementMatch[1]) {
      item.attunementBy = attunementMatch[1].trim();
    }
  } else {
    item.attunement = false;
  }

  // Extract description (everything after type/rarity line)
  const lines = content.split('\n');
  let inDescription = false;
  const descLines: string[] = [];

  for (const line of lines) {
    // Skip header
    if (line.match(/^#{1,4}/)) continue;

    // Skip type/rarity line (usually italic)
    if (line.match(/^\*[^*]+\*$/) && !inDescription) {
      inDescription = true;
      continue;
    }

    if (inDescription || !line.match(/\b(common|uncommon|rare|weapon|armor|requires attunement)/i)) {
      if (line.trim()) {
        descLines.push(line);
        inDescription = true;
      }
    }
  }

  item.description = descLines.join('\n').trim();

  return item;
}

/**
 * Extended item data for transformation
 */
interface ExtendedItemData extends ItemData {
  attunementBy?: string;
  charges?: { current: number; max: number; recharge?: string };
  properties?: string[];
}

/**
 * Parse extended item data
 */
export function parseItemExtended(content: string): ExtendedItemData {
  const item = parseItem(content) as ExtendedItemData;

  // Parse charges
  const chargeMatch = content.match(/(\d+)\s*charges?/i);
  if (chargeMatch) {
    const maxCharges = parseInt(chargeMatch[1]);
    item.charges = { current: maxCharges, max: maxCharges };

    // Check for recharge
    const rechargeMatch = content.match(/regains?\s*(?:(\d+d\d+)|(\d+))\s*(?:expended\s*)?charges?\s*(?:daily\s*)?(?:at\s*dawn)?/i);
    if (rechargeMatch) {
      item.charges.recharge = rechargeMatch[1] || rechargeMatch[2];
    }
  }

  // Parse weapon properties
  const propertyPatterns = [
    'finesse',
    'light',
    'heavy',
    'two-handed',
    'versatile',
    'thrown',
    'reach',
    'loading',
    'ammunition',
    'special',
  ];
  const foundProperties: string[] = [];
  for (const prop of propertyPatterns) {
    if (new RegExp(`\\b${prop}\\b`, 'i').test(content)) {
      foundProperties.push(prop);
    }
  }
  if (foundProperties.length > 0) {
    item.properties = foundProperties;
  }

  return item;
}

/**
 * Transform item to Homebrewery format using {{item}} block
 */
export function transformItem(data: ItemData): string {
  const lines: string[] = [];

  // Build type line for the block
  const typeStr = formatItemType(data);
  const rarityStr = data.rarity ? data.rarity : 'uncommon';

  // Open item block with proper styling
  lines.push(`{{item`);

  // Item name
  lines.push(`#### ${data.name}`);

  // Type line (italic)
  lines.push(`*${typeStr}*`);

  // Separator
  lines.push('___');

  // Description with proper formatting
  if (data.description) {
    // Process description to add proper formatting
    const formattedDesc = formatItemDescription(data.description);
    lines.push(formattedDesc);
  }

  // Close item block
  lines.push('}}');

  return lines.join('\n');
}

/**
 * Transform item as a simple note block (for less prominent items)
 */
export function transformItemAsNote(data: ItemData): string {
  const lines: string[] = [];

  lines.push('{{note');
  lines.push(`##### ${data.name}`);
  lines.push(`*${formatItemType(data)}*`);
  lines.push('');
  if (data.description) {
    lines.push(data.description);
  }
  lines.push('}}');

  return lines.join('\n');
}

/**
 * Transform item inline (for item lists or quick references)
 */
export function transformItemInline(data: ItemData): string {
  const lines: string[] = [];

  lines.push(`**${data.name}**`);
  lines.push(`*${formatItemType(data)}*`);
  lines.push('');
  if (data.description) {
    // Truncate for inline
    const shortDesc =
      data.description.length > 200 ? data.description.substring(0, 197) + '...' : data.description;
    lines.push(shortDesc);
  }

  return lines.join('\n');
}

/**
 * Format item type line
 */
function formatItemType(data: ItemData): string {
  const extendedData = data as ExtendedItemData;
  const parts: string[] = [];

  // Type
  if (data.type) {
    parts.push(capitalizeFirst(data.type));
  } else {
    parts.push('Wondrous item');
  }

  // Rarity
  if (data.rarity) {
    parts.push(data.rarity);
  }

  // Attunement
  if (data.attunement) {
    if (extendedData.attunementBy) {
      parts.push(`(requires attunement by ${extendedData.attunementBy})`);
    } else {
      parts.push('(requires attunement)');
    }
  }

  return parts.join(', ');
}

/**
 * Format item description with proper Homebrewery markdown
 */
function formatItemDescription(description: string): string {
  let formatted = description;

  // Convert bullet lists to proper format
  formatted = formatted.replace(/^[-*]\s+/gm, '- ');

  // Ensure bold text is properly formatted
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '**$1**');

  // Format charges text
  formatted = formatted.replace(
    /The (\w+) has (\d+) charges/gi,
    'The $1 has **$2 charges**'
  );

  // Format damage dice
  formatted = formatted.replace(
    /(\d+d\d+(?:\s*\+\s*\d+)?)\s*(damage|force|fire|cold|lightning|thunder|acid|poison|psychic|radiant|necrotic)/gi,
    '**$1** $2'
  );

  return formatted;
}

/**
 * Capitalize first letter
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert raw content to Homebrewery item format
 */
export function convertItem(content: string): string {
  const data = parseItemExtended(content);
  return transformItem(data);
}

/**
 * Check if content is a magic item
 */
export function isItem(content: string): boolean {
  // Explicit item header
  if (/^#{1,4}\s*(?:Magic\s+)?Item:/im.test(content)) {
    return true;
  }

  // Has rarity and type indicators
  const hasRarity = /\b(common|uncommon|rare|very rare|legendary|artifact)\b/i.test(content);
  const hasType = /\b(weapon|armor|wondrous item|ring|rod|staff|wand|potion|scroll)\b/i.test(content);

  // Has attunement requirement
  const hasAttunement = /requires attunement/i.test(content);

  // Likely an item if has rarity + type or rarity + attunement
  return (hasRarity && hasType) || (hasRarity && hasAttunement) || (hasType && hasAttunement);
}

/**
 * Determine item display style based on context
 */
export function getItemStyle(data: ItemData, context?: string): 'block' | 'note' | 'inline' {
  // Legendary/artifact items get full block
  if (data.rarity === 'legendary' || data.rarity === 'artifact') {
    return 'block';
  }

  // Items with long descriptions get block
  if (data.description && data.description.length > 300) {
    return 'block';
  }

  // Short items in lists get inline
  if (context === 'list' || (data.description && data.description.length < 100)) {
    return 'inline';
  }

  // Default to note for medium items
  return 'note';
}
