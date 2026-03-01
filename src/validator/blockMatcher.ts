import { ValidationError, ValidationWarning, AutoFix } from '../types.js';

/**
 * Known Homebrewery V3 block types.
 * Multi-line blocks open with {{ and close with }}.
 * Inline blocks appear as {{type ...}} on a single line.
 */
const KNOWN_V3_BLOCKS = {
  // Multi-line content blocks
  multiLine: new Set([
    'frontCover', 'insideCover', 'partCover', 'backCover',
    'monster', 'classTable', 'spellList',
    'note', 'descriptive', 'quote', 'wide',
    'toc', 'index',
    'artist',
    'runeTable',
  ]),
  // Inline blocks (typically self-closing on one line)
  inline: new Set([
    'pageNumber', 'footnote', 'logo', 'banner', 'dropcap',
    'watermark', 'attribution', 'bonus',
  ]),
  // Prefixes for numbered variants (watercolor1-12, imageMaskCenter1-16, etc.)
  numberedPrefixes: [
    'watercolor',
    'imageMaskCenter',
    'imageMaskEdge',
    'imageMaskCorner',
  ],
};

/**
 * Check if a block type is a known V3 type.
 */
function isKnownBlockType(type: string): boolean {
  if (KNOWN_V3_BLOCKS.multiLine.has(type)) return true;
  if (KNOWN_V3_BLOCKS.inline.has(type)) return true;
  for (const prefix of KNOWN_V3_BLOCKS.numberedPrefixes) {
    if (type.startsWith(prefix)) return true;
  }
  // CSS property blocks like {{text-align:center ...}} are valid
  if (type.includes('-') || type.includes(':')) return true;
  return false;
}

/**
 * Result of block validation
 */
export interface BlockValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  fixes: AutoFix[];
}

/**
 * A matched block pair
 */
interface BlockPair {
  openLine: number;
  closeLine: number | null;
  type: string;
  content: string;
}

/**
 * Validate all Homebrewery blocks are properly opened and closed.
 * Also validates block types against the V3 registry.
 */
export function validateBlocks(content: string): BlockValidationResult {
  const result: BlockValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    fixes: [],
  };

  const lines = content.split('\n');
  const blockStack: Array<{ line: number; type: string; full: string }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Find block openers: {{blockType or {{blockType,modifier
    const openers = line.matchAll(/\{\{(\w+)/g);
    for (const match of openers) {
      const blockType = match[1];

      // Warn on unknown block types
      if (!isKnownBlockType(blockType)) {
        result.warnings.push({
          type: 'unknown_block',
          message: `Unknown block type '{{${blockType}' at line ${lineNum}. May not render in Homebrewery V3.`,
          line: lineNum,
          suggestion: 'Check Homebrewery V3 documentation for valid block types',
        });
      }

      blockStack.push({
        line: lineNum,
        type: blockType,
        full: match[0],
      });
    }

    // Find block closers: }}
    const closerCount = (line.match(/\}\}/g) || []).length;
    for (let j = 0; j < closerCount; j++) {
      if (blockStack.length > 0) {
        blockStack.pop();
      } else {
        result.errors.push({
          type: 'mismatched_braces',
          message: `Unmatched closing braces '}}' at line ${lineNum}`,
          line: lineNum,
        });
        result.isValid = false;
      }
    }
  }

  // Any remaining items in stack are unclosed blocks
  for (const unclosed of blockStack) {
    result.errors.push({
      type: 'mismatched_braces',
      message: `Unclosed block '${unclosed.full}' opened at line ${unclosed.line}`,
      line: unclosed.line,
    });
    result.isValid = false;

    result.fixes.push({
      type: 'close_block',
      location: lines.length,
      original: '',
      replacement: '}}',
    });
  }

  return result;
}

/**
 * Find all block pairs in content
 */
export function findBlockPairs(content: string): BlockPair[] {
  const pairs: BlockPair[] = [];
  const lines = content.split('\n');
  const stack: Array<{ line: number; type: string; startIdx: number }> = [];

  let charIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStart = charIndex;

    // Find openers
    const openers = [...line.matchAll(/\{\{(\w+)/g)];
    for (const match of openers) {
      stack.push({
        line: i + 1,
        type: match[1],
        startIdx: lineStart + (match.index || 0),
      });
    }

    // Find closers
    const closers = [...line.matchAll(/\}\}/g)];
    for (const closer of closers) {
      if (stack.length > 0) {
        const opener = stack.pop()!;
        const closeIdx = lineStart + (closer.index || 0) + 2;
        pairs.push({
          openLine: opener.line,
          closeLine: i + 1,
          type: opener.type,
          content: content.substring(opener.startIdx, closeIdx),
        });
      }
    }

    charIndex += line.length + 1;
  }

  // Add unclosed blocks
  for (const unclosed of stack) {
    pairs.push({
      openLine: unclosed.line,
      closeLine: null,
      type: unclosed.type,
      content: content.substring(unclosed.startIdx),
    });
  }

  return pairs;
}

/**
 * Auto-fix unclosed blocks by adding closing braces
 */
export function fixUnclosedBlocks(content: string): string {
  const validation = validateBlocks(content);

  if (validation.isValid) {
    return content;
  }

  let fixed = content;

  const sortedFixes = validation.fixes
    .filter((f) => f.type === 'close_block')
    .sort((a, b) => b.location - a.location);

  for (const fix of sortedFixes) {
    fixed = fixed + '\n' + fix.replacement;
  }

  return fixed;
}

/**
 * Check for commonly mismatched or suspicious block nesting
 */
export function checkBlockNesting(content: string): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const pairs = findBlockPairs(content);

  for (const pair of pairs) {
    // Monster blocks should not be nested inside note blocks
    if (pair.type === 'monster') {
      const innerContent = pair.content;
      if (/\{\{note/.test(innerContent) && !/\}\}[\s\S]*\{\{note/.test(innerContent)) {
        warnings.push({
          type: 'unclosed_block',
          message: `Monster block at line ${pair.openLine} may have nested note block - verify structure`,
          line: pair.openLine,
          suggestion: 'Ensure monster and note blocks do not overlap',
        });
      }
    }

    // Wide blocks should typically span full pages
    if (pair.type === 'wide' && pair.closeLine) {
      const lineSpan = pair.closeLine - pair.openLine;
      if (lineSpan < 3) {
        warnings.push({
          type: 'sparse_content',
          message: `Wide block at line ${pair.openLine} spans only ${lineSpan} lines`,
          line: pair.openLine,
          suggestion: 'Wide blocks are typically used for larger content sections',
        });
      }
    }

    // Image mask blocks should be inside cover blocks
    if (pair.type.startsWith('imageMask')) {
      const isInsideCover = pairs.some(p =>
        p.openLine < pair.openLine &&
        (p.closeLine === null || p.closeLine > pair.openLine) &&
        ['frontCover', 'insideCover', 'partCover', 'backCover'].includes(p.type)
      );
      if (!isInsideCover) {
        warnings.push({
          type: 'unclosed_block',
          message: `Image mask block at line ${pair.openLine} is not inside a cover block`,
          line: pair.openLine,
          suggestion: 'Image masks are typically used inside cover blocks',
        });
      }
    }
  }

  return warnings;
}

/**
 * Get list of all block types used in content
 */
export function getUsedBlockTypes(content: string): string[] {
  const types = new Set<string>();
  const matches = content.matchAll(/\{\{(\w+)/g);

  for (const match of matches) {
    types.add(match[1]);
  }

  return Array.from(types);
}
