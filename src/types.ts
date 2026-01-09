/**
 * Content types that can be detected and transformed
 */
export enum ContentType {
  Monster = 'monster',
  Item = 'item',
  Spell = 'spell',
  Location = 'location',
  Chapter = 'chapter',
  ReadAloud = 'readAloud',
  Note = 'note',
  NPC = 'npc',
  Table = 'table',
  Cover = 'cover',
  PartCover = 'partCover',
  Unknown = 'unknown',
}

/**
 * Document section types for structure analysis
 */
export enum DocumentSection {
  FrontMatter = 'frontMatter',
  Cover = 'cover',
  InsideCover = 'insideCover',
  TableOfContents = 'tableOfContents',
  PartCover = 'partCover',
  Chapter = 'chapter',
  Appendix = 'appendix',
  BackCover = 'backCover',
}

/**
 * A parsed content block from the input markdown
 */
export interface ContentBlock {
  type: ContentType;
  rawContent: string;
  header?: string;
  metadata?: Record<string, unknown>;
  lineNumber?: number;
}

/**
 * Result of transforming content to Homebrewery format
 */
export interface TransformResult {
  homebreweryMarkdown: string;
  warnings: string[];
}

/**
 * Monster stat block data
 */
export interface MonsterData {
  name: string;
  size?: string;
  type?: string;
  alignment?: string;
  ac?: string;
  hp?: string;
  speed?: string;
  abilities?: {
    str?: number;
    dex?: number;
    con?: number;
    int?: number;
    wis?: number;
    cha?: number;
  };
  traits?: Array<{ name: string; description: string }>;
  actions?: Array<{ name: string; description: string }>;
  reactions?: Array<{ name: string; description: string }>;
  legendaryActions?: Array<{ name: string; description: string }>;
}

/**
 * Magic item data
 */
export interface ItemData {
  name: string;
  type?: string;
  rarity?: string;
  attunement?: boolean;
  attunementBy?: string;
  description: string;
}

/**
 * Spell data
 */
export interface SpellData {
  name: string;
  level?: number;
  school?: string;
  castingTime?: string;
  range?: string;
  components?: string;
  duration?: string;
  description: string;
}

/**
 * Configuration for the converter
 */
export interface Config {
  template: 'phb' | 'dmg' | 'custom';
  columns: number;
  pageSize: 'letter' | 'a4';
  contentPatterns?: {
    [key in ContentType]?: string[];
  };
  output?: {
    splitPages?: boolean;
    tocDepth?: number;
  };
}

/**
 * Default configuration
 */
export const defaultConfig: Config = {
  template: 'phb',
  columns: 2,
  pageSize: 'letter',
  output: {
    splitPages: false,
    tocDepth: 3,
  },
};

/**
 * Ability score modifier calculation
 */
export function getAbilityModifier(score: number): string {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

// =============================================================================
// VALIDATION TYPES
// =============================================================================

/**
 * Result of validating a page or document
 */
export interface PageValidationResult {
  isValid: boolean;
  warnings: ValidationWarning[];
  errors: ValidationError[];
  estimatedFill: number; // 0-100 percentage
  autoFixes: AutoFix[];
}

/**
 * A validation warning (non-fatal issue)
 */
export interface ValidationWarning {
  type: 'empty_page' | 'overflow' | 'orphaned_break' | 'unclosed_block' | 'sparse_content';
  message: string;
  line?: number;
  suggestion?: string;
}

/**
 * A validation error (fatal issue)
 */
export interface ValidationError {
  type: 'syntax_error' | 'invalid_block' | 'mismatched_braces';
  message: string;
  line: number;
  column?: number;
}

/**
 * An automatic fix that can be applied
 */
export interface AutoFix {
  type: 'remove_page_break' | 'close_block' | 'add_column_break' | 'merge_pages';
  location: number;
  original: string;
  replacement: string;
}

// =============================================================================
// COVER AND STRUCTURE TYPES
// =============================================================================

/**
 * Data for generating a cover page
 */
export interface CoverPageData {
  title: string;
  subtitle?: string;
  author?: string;
  backgroundImage?: string;
  campaign?: string;
  level?: string;
}

/**
 * Data for generating an inside cover page
 */
export interface InsideCoverData {
  dedication?: string;
  credits?: string;
  copyright?: string;
  version?: string;
}

/**
 * Data for generating a part cover page
 */
export interface PartCoverData {
  partNumber: number;
  title: string;
  subtitle?: string;
  backgroundImage?: string;
}

// =============================================================================
// EXTENDED MONSTER DATA
// =============================================================================

/**
 * Extended monster data with full stat block support
 */
export interface ExtendedMonsterData extends MonsterData {
  savingThrows?: string;
  skills?: string;
  damageVulnerabilities?: string;
  damageResistances?: string;
  damageImmunities?: string;
  conditionImmunities?: string;
  senses?: string;
  languages?: string;
  challenge?: string;
  proficiencyBonus?: string;
  lairActions?: Array<{ description: string }>;
  regionalEffects?: Array<{ description: string }>;
  mythicActions?: Array<{ name: string; description: string; cost?: number }>;
  legendaryActionCount?: number;
  spellcasting?: SpellcastingData;
}

/**
 * Spellcasting data for monsters
 */
export interface SpellcastingData {
  ability: string;
  saveDC: number;
  attackBonus: number;
  level?: number;
  spells: {
    atWill?: string[];
    perDay?: { [uses: string]: string[] };
    slots?: { [level: string]: { slots: number; spells: string[] } };
  };
}

// =============================================================================
// NPC DATA
// =============================================================================

/**
 * NPC data for character descriptions
 */
export interface NPCData {
  name: string;
  title?: string;
  race?: string;
  occupation?: string;
  alignment?: string;
  description?: string;
  personality?: string;
  ideals?: string;
  bonds?: string;
  flaws?: string;
  secrets?: string;
  quote?: string;
  hasStatBlock?: boolean;
  stats?: Partial<MonsterData>;
}

// =============================================================================
// TABLE DATA
// =============================================================================

/**
 * Table data for styled tables
 */
export interface TableData {
  title?: string;
  headers: string[];
  rows: string[][];
  style: 'default' | 'class' | 'roll';
  diceColumn?: number;
  alignment?: ('left' | 'center' | 'right')[];
}

// =============================================================================
// DOCUMENT STRUCTURE
// =============================================================================

/**
 * Overall document structure analysis
 */
export interface DocumentStructure {
  title?: string;
  author?: string;
  hasCover: boolean;
  hasInsideCover: boolean;
  hasToc: boolean;
  parts: PartInfo[];
  chapters: ChapterInfo[];
  appendices: AppendixInfo[];
  totalPages?: number;
}

/**
 * Information about a part (major division)
 */
export interface PartInfo {
  number: number;
  title: string;
  startLine: number;
  chapters: number[];
}

/**
 * Information about a chapter
 */
export interface ChapterInfo {
  number: number;
  title: string;
  startLine: number;
  sections: string[];
  partNumber?: number;
}

/**
 * Information about an appendix
 */
export interface AppendixInfo {
  letter: string;
  title: string;
  startLine: number;
}

/**
 * Table of contents entry
 */
export interface TOCEntry {
  level: number;
  title: string;
  page?: number;
  children?: TOCEntry[];
}

// =============================================================================
// EXTENDED CONFIGURATION
// =============================================================================

/**
 * Extended configuration with all options
 */
export interface ExtendedConfig extends Config {
  document?: {
    generateCover?: boolean;
    generateToc?: boolean;
    generatePartCovers?: boolean;
    dropCaps?: boolean;
    pageNumbers?: boolean;
  };
  images?: {
    placeholders?: boolean;
    defaultBackground?: string;
    coverImage?: string;
    partCoverImages?: Record<number, string>;
  };
  validation?: {
    enabled?: boolean;
    autoFix?: boolean;
    minPageFill?: number;
    maxPageFill?: number;
  };
}

/**
 * Default extended configuration
 */
export const defaultExtendedConfig: ExtendedConfig = {
  ...defaultConfig,
  document: {
    generateCover: true,
    generateToc: false,
    generatePartCovers: true,
    dropCaps: true,
    pageNumbers: true,
  },
  images: {
    placeholders: true,
    defaultBackground: 'placeholder.jpg',
  },
  validation: {
    enabled: true,
    autoFix: true,
    minPageFill: 20,
    maxPageFill: 100,
  },
};
