import {
  ContentBlock,
  ContentType,
  Config,
  TransformResult,
  defaultConfig,
  ExtendedConfig,
  defaultExtendedConfig,
} from '../types.js';
import { convertMonster, transformMonster as transformMonsterData, parseMonster } from './monster.js';
import { transformReadAloud, convertAllBlockquotes } from './readAloud.js';
import { transformNote } from './note.js';
import { transformLocation } from './location.js';
import { transformChapter } from './chapter.js';
import { convertItem, transformItem as transformItemData, parseItem, isItem } from './item.js';
import { convertSpell, transformSpell as transformSpellData, parseSpell } from './spell.js';
import { convertNPC, transformNPC, parseNPC, isNPC } from './npc.js';
import { convertTable, transformTable, parseTable, isTable } from './table.js';
import { generateCover, generatePartCover, generateInsideCover } from './cover.js';
import { generateTOC, buildDocumentStructure } from './toc.js';
import { validate, validateAndFix, optimize, getValidationReport } from '../validator/index.js';
import { generateDocumentStructure, insertDropCaps, addSimplePageNumbers } from '../structure/index.js';
import { analyzeDocument, extractCoverData, detectNeededStructure } from '../structure/analyzer.js';

/**
 * Transform a single content block to Homebrewery format
 */
export function transformBlock(block: ContentBlock): string {
  let result: string;

  switch (block.type) {
    case ContentType.Monster:
      result = convertMonster(block.rawContent);
      break;

    case ContentType.Spell:
      result = convertSpell(block.rawContent);
      break;

    case ContentType.Item:
      result = convertItem(block.rawContent);
      break;

    case ContentType.Location:
      result = transformLocation(block.rawContent);
      break;

    case ContentType.Chapter:
      result = transformChapter(block.rawContent);
      break;

    case ContentType.ReadAloud:
      result = transformReadAloud(block.rawContent);
      break;

    case ContentType.Note:
      result = transformNote(block.rawContent);
      break;

    case ContentType.NPC:
      result = convertNPC(block.rawContent);
      break;

    case ContentType.Table:
      result = convertTable(block.rawContent);
      break;

    case ContentType.Cover:
    case ContentType.PartCover:
      // Cover types pass through - generated separately
      result = block.rawContent;
      break;

    case ContentType.Unknown:
    default:
      result = block.rawContent;
      break;
  }

  // Always convert any remaining blockquotes to descriptive boxes
  if (!result.includes('{{monster') && !result.includes('{{descriptive')) {
    result = convertAllBlockquotes(result);
  }

  return result;
}

/**
 * Extended transformation options
 */
export interface TransformOptions {
  config?: ExtendedConfig;
  validate?: boolean;
  autoFix?: boolean;
  generateCover?: boolean;
  generateToc?: boolean;
  generatePartCovers?: boolean;
  dropCaps?: boolean;
  pageNumbers?: boolean;
}

/**
 * Extended transform result
 */
export interface ExtendedTransformResult extends TransformResult {
  validationReport?: string;
  pageCount?: number;
  avgFill?: number;
}

/**
 * Transform all content blocks to Homebrewery format
 */
export function transform(
  blocks: ContentBlock[],
  config: Config = defaultConfig
): TransformResult {
  const warnings: string[] = [];
  const transformedBlocks: string[] = [];

  for (const block of blocks) {
    try {
      const transformed = transformBlock(block);
      transformedBlocks.push(transformed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Failed to transform block at line ${block.lineNumber}: ${message}`);
      transformedBlocks.push(block.rawContent);
    }
  }

  let homebreweryMarkdown = transformedBlocks
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .join('\n\n');

  homebreweryMarkdown = postProcess(homebreweryMarkdown);

  return {
    homebreweryMarkdown,
    warnings,
  };
}

/**
 * Transform with extended options (new enhanced pipeline)
 */
export function transformExtended(
  blocks: ContentBlock[],
  options: TransformOptions = {}
): ExtendedTransformResult {
  const config = options.config || defaultExtendedConfig;
  const warnings: string[] = [];
  const transformedBlocks: string[] = [];

  // Transform all blocks
  for (const block of blocks) {
    try {
      const transformed = transformBlock(block);
      transformedBlocks.push(transformed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Failed to transform block at line ${block.lineNumber}: ${message}`);
      transformedBlocks.push(block.rawContent);
    }
  }

  let homebreweryMarkdown = transformedBlocks
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .join('\n\n');

  // Apply post-processing
  homebreweryMarkdown = postProcess(homebreweryMarkdown);

  // Generate document structure elements
  if (options.generateCover !== false || options.generatePartCovers || options.dropCaps || options.pageNumbers) {
    const structureConfig: ExtendedConfig = {
      ...config,
      document: {
        generateCover: options.generateCover !== false,
        generateToc: options.generateToc,
        generatePartCovers: options.generatePartCovers,
        dropCaps: options.dropCaps,
        pageNumbers: options.pageNumbers,
      },
    };
    homebreweryMarkdown = generateDocumentStructure(homebreweryMarkdown, structureConfig);
  }

  // Validate and optionally auto-fix
  let validationReport: string | undefined;
  let pageCount: number | undefined;
  let avgFill: number | undefined;

  if (options.validate || options.autoFix) {
    if (options.autoFix) {
      const fixResult = validateAndFix(homebreweryMarkdown);
      homebreweryMarkdown = fixResult.content;
      validationReport = getValidationReport(homebreweryMarkdown);
      pageCount = fixResult.result.pageCount;
      avgFill = fixResult.result.avgFill;

      // Add fix warnings
      for (const fix of fixResult.result.autoFixes) {
        warnings.push(`Auto-fixed: ${fix.type} at line ${fix.location}`);
      }
    } else {
      const validationResult = validate(homebreweryMarkdown);
      validationReport = getValidationReport(homebreweryMarkdown);
      pageCount = validationResult.pageCount;
      avgFill = validationResult.avgFill;

      // Add validation warnings
      for (const warn of validationResult.warnings) {
        warnings.push(`Validation: ${warn.message}`);
      }
      for (const err of validationResult.errors) {
        warnings.push(`Error: ${err.message}`);
      }
    }
  }

  return {
    homebreweryMarkdown,
    warnings,
    validationReport,
    pageCount,
    avgFill,
  };
}

/**
 * Post-process the final output to fix common issues
 */
function postProcess(content: string): string {
  let result = content;

  // Add page breaks before major sections (# headers for Acts/Chapters)
  result = result.replace(
    /(?<!\\page\n\n)\n\n(# (?:Act|Chapter|Episode|Part|Appendix|Running|Adventure|Conclusion)\s)/gi,
    '\n\n\\page\n\n$1'
  );

  // Add page breaks before ## headers that are significant
  result = result.replace(
    /(?<!\\page\n\n)\n\n(## (?:Location|NPC|Monster|The |Level \d|C\d+\.|A\d+\.|Timeline|Entry|Victory|Partial|Failure|Scaling))/gi,
    '\n\n\\page\n\n$1'
  );

  // Add page breaks before ### headers introducing major subsections
  result = result.replace(
    /(?<!\\page\n\n)\n\n(### (?:Monster:|Item:|C\d+|A\d+|The Final|Random|Entry|Secondary|Key Locations|Loop Rules))/gi,
    '\n\n\\page\n\n$1'
  );

  // Add page breaks before monster stat blocks (but not if already there)
  result = result.replace(/(?<!\\page\n\n)\n\n(\{\{monster,frame)/g, '\n\n\\page\n\n$1');

  // Fix nested note blocks
  result = result.replace(
    /\{\{note\n([\s\S]*?)\{\{note\n([\s\S]*?)\}\}\n([\s\S]*?)\}\}/g,
    '{{note\n$1}}\n\n{{note\n$2}}\n\n$3'
  );

  // Fix double closing braces without content
  result = result.replace(/\}\}\s*\n\s*\}\}/g, '}}');

  // Ensure proper spacing after }} blocks
  result = result.replace(/\}\}\n([^}\n])/g, '}}\n\n$1');

  // Fix monster blocks that got wrong names
  result = result.replace(
    /\{\{monster,frame\n## (?:Encounters?|The \w+ Encounter|Final Encounter)\n\*(\w+)/g,
    '{{monster,frame\n## $1\n*$1'
  );

  // Remove duplicate alignment text
  result = result.replace(/(\w+ \w+), \1\*/g, '$1*');

  // Clean up duplicate page breaks
  result = result.replace(/(\\page\n+)+\\page/g, '\\page');

  // Convert remaining blockquotes
  result = result.replace(/((?:^|\n)>.*(?:\n>.*)*)/g, (match) => {
    const text = match.replace(/\n?>/g, '').trim();
    return `\n{{descriptive\n${text}\n}}`;
  });

  // Clean up extra blank lines
  result = result.replace(/\n{4,}/g, '\n\n\n');

  // Ensure all monster blocks are closed
  const monsterOpens = (result.match(/\{\{monster,frame/g) || []).length;
  if (monsterOpens > 0) {
    result = result.replace(
      /(\{\{monster,frame[\s\S]*?)(?=\n\n\{\{|\n\\page|\n# |$)/g,
      (match) => {
        if (!match.trim().endsWith('}}')) {
          return match.trimEnd() + '\n}}';
        }
        return match;
      }
    );
  }

  // Remove empty lines before }}
  result = result.replace(/\n\n+\}\}/g, '\n}}');

  return result;
}

/**
 * Quick convert a single piece of content
 */
export function quickConvert(content: string, type: ContentType): string {
  const block: ContentBlock = {
    type,
    rawContent: content,
  };
  return transformBlock(block);
}

/**
 * Auto-detect and convert content
 */
export function autoConvert(content: string): string {
  // Detect content type
  if (isNPC(content)) {
    return convertNPC(content);
  }
  if (isItem(content)) {
    return convertItem(content);
  }
  if (isTable(content)) {
    return convertTable(content);
  }

  // Check for monster stats
  const hasStats =
    /\b(AC|Armor Class)\s*[:=]?\s*\d+/i.test(content) && /\bSTR\s+\d+/i.test(content);
  if (hasStats) {
    return convertMonster(content);
  }

  // Default to read-aloud if it's a blockquote
  if (content.trim().startsWith('>')) {
    return transformReadAloud(content);
  }

  return content;
}

/**
 * Generate a monster stat block from parameters
 */
export function generateMonster(
  name: string,
  options: {
    size?: string;
    type?: string;
    alignment?: string;
    ac?: string;
    hp?: string;
    speed?: string;
    str?: number;
    dex?: number;
    con?: number;
    int?: number;
    wis?: number;
    cha?: number;
    traits?: Array<{ name: string; description: string }>;
    actions?: Array<{ name: string; description: string }>;
  } = {}
): string {
  return transformMonsterData({
    name,
    size: options.size,
    type: options.type,
    alignment: options.alignment,
    ac: options.ac,
    hp: options.hp,
    speed: options.speed,
    abilities: {
      str: options.str,
      dex: options.dex,
      con: options.con,
      int: options.int,
      wis: options.wis,
      cha: options.cha,
    },
    traits: options.traits,
    actions: options.actions,
  });
}

/**
 * Generate a magic item block from parameters
 */
export function generateItem(
  name: string,
  options: {
    type?: string;
    rarity?: string;
    attunement?: boolean;
    description: string;
  }
): string {
  return transformItemData({
    name,
    type: options.type,
    rarity: options.rarity,
    attunement: options.attunement,
    description: options.description,
  });
}

/**
 * Generate a spell block from parameters
 */
export function generateSpell(
  name: string,
  options: {
    level?: number;
    school?: string;
    castingTime?: string;
    range?: string;
    components?: string;
    duration?: string;
    description: string;
  }
): string {
  return transformSpellData({
    name,
    level: options.level,
    school: options.school,
    castingTime: options.castingTime,
    range: options.range,
    components: options.components,
    duration: options.duration,
    description: options.description,
  });
}

// Re-export all transformers
export { convertMonster, parseMonster, transformMonster } from './monster.js';
export { transformReadAloud, convertAllBlockquotes } from './readAloud.js';
export { transformNote } from './note.js';
export { transformLocation } from './location.js';
export { transformChapter } from './chapter.js';
export { convertItem, parseItem, transformItem, isItem } from './item.js';
export { convertSpell, parseSpell, transformSpell } from './spell.js';
export { convertNPC, parseNPC, transformNPC, isNPC } from './npc.js';
export { convertTable, parseTable, transformTable, isTable } from './table.js';
export { generateCover, generatePartCover, generateInsideCover } from './cover.js';
export { generateTOC, buildDocumentStructure } from './toc.js';

// Re-export validator
export { validate, validateAndFix, optimize, getValidationReport } from '../validator/index.js';

// Re-export structure
export { analyzeDocument, extractCoverData, detectNeededStructure } from '../structure/analyzer.js';
export { generateDocumentStructure, insertDropCaps, addSimplePageNumbers } from '../structure/generator.js';
