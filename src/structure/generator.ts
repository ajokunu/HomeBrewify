import {
  DocumentStructure,
  CoverPageData,
  InsideCoverData,
  PartCoverData,
  ExtendedConfig,
} from '../types.js';
import { generateCover, generateInsideCover, generatePartCover } from '../transformers/cover.js';
import { generateTOC } from '../transformers/toc.js';
import { analyzeDocument, extractCoverData, detectNeededStructure } from './analyzer.js';

/**
 * Insert cover page if missing
 */
export function insertCoverPage(content: string, config?: ExtendedConfig): string {
  const structure = analyzeDocument(content);

  // Already has cover
  if (structure.hasCover) {
    return content;
  }

  // Extract cover data
  const coverData = extractCoverData(content);
  if (!coverData) {
    return content;
  }

  // Set background image
  if (config?.images?.coverImage) {
    coverData.backgroundImage = config.images.coverImage;
  } else if (config?.images?.placeholders) {
    coverData.backgroundImage = 'placeholder.jpg';
  }

  // Generate cover
  const cover = generateCover(coverData);

  return cover + '\n' + content;
}

/**
 * Insert table of contents if needed
 */
export function insertTOC(content: string, depth: number = 3): string {
  const structure = analyzeDocument(content);

  // Already has TOC
  if (structure.hasToc) {
    return content;
  }

  // Need at least 3 chapters for TOC
  if (structure.chapters.length < 3) {
    return content;
  }

  // Generate TOC
  const toc = generateTOC(structure, depth);

  // Insert after cover page (or at start)
  const pages = content.split('\\page');
  if (pages.length > 1) {
    // Insert after first page (cover)
    pages.splice(1, 0, '\n' + toc);
    return pages.join('\\page');
  }

  // Insert at start with page break
  return toc + '\n\\page\n' + content;
}

/**
 * Insert part cover pages
 */
export function insertPartCovers(content: string, config?: ExtendedConfig): string {
  const structure = analyzeDocument(content);

  // No parts to cover
  if (structure.parts.length === 0) {
    return content;
  }

  const lines = content.split('\n');
  const insertions: Array<{ line: number; content: string }> = [];

  for (const part of structure.parts) {
    const partData: PartCoverData = {
      partNumber: part.number,
      title: part.title,
    };

    // Set background image
    if (config?.images?.partCoverImages?.[part.number]) {
      partData.backgroundImage = config.images.partCoverImages[part.number];
    } else if (config?.images?.defaultBackground) {
      partData.backgroundImage = config.images.defaultBackground;
    } else if (config?.images?.placeholders) {
      partData.backgroundImage = 'placeholder.jpg';
    }

    const partCover = generatePartCover(partData);

    insertions.push({
      line: part.startLine,
      content: partCover,
    });
  }

  // Insert in reverse order to maintain line numbers
  insertions.sort((a, b) => b.line - a.line);

  for (const insertion of insertions) {
    // Replace the part header line with part cover + page break
    const originalLine = lines[insertion.line];
    lines[insertion.line] = insertion.content + '\n' + originalLine;
  }

  return lines.join('\n');
}

/**
 * Add drop caps to chapter starts
 */
export function insertDropCaps(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let blockDepth = 0;
  let justSawChapter = false;
  let afterPageBreak = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track block depth properly
    const opens = (line.match(/\{\{/g) || []).length;
    const closes = (line.match(/\}\}/g) || []).length;
    blockDepth += opens - closes;

    // Track page breaks
    if (line.includes('\\page')) {
      afterPageBreak = true;
      result.push(line);
      continue;
    }

    // Check for chapter headers (only after page break or at top level)
    if ((afterPageBreak || i < 20) && blockDepth === 0 && line.match(/^##?\s+[A-Z]/)) {
      justSawChapter = true;
      afterPageBreak = false;
      result.push(line);
      continue;
    }

    // Add drop cap to first paragraph after chapter
    // Must be: outside blocks, regular text starting with letter, not special syntax
    if (justSawChapter && blockDepth === 0 && line.trim()) {
      const trimmed = line.trim();
      // Skip if starts with special characters or is just braces
      if (trimmed.match(/^[A-Z]/) &&
          !trimmed.startsWith('#') &&
          !trimmed.startsWith('*') &&
          !trimmed.startsWith('>') &&
          !trimmed.startsWith('|') &&
          !trimmed.startsWith('{') &&
          !trimmed.startsWith('}') &&
          !trimmed.startsWith('!') &&
          !trimmed.startsWith('[') &&
          !line.startsWith('{{dropcap')) {
        const firstLetter = trimmed[0];
        const rest = trimmed.substring(1);
        result.push(`{{dropcap ${firstLetter}}}${rest}`);
        justSawChapter = false;
        continue;
      }
    }

    // Reset chapter flag on any non-empty non-header content
    if (line.trim() && !line.startsWith('#') && blockDepth === 0) {
      justSawChapter = false;
    }

    result.push(line);
  }

  return result.join('\n');
}

/**
 * Add page numbers
 */
export function addPageNumbers(content: string): string {
  // Check if already has page numbers
  if (content.includes('{{pageNumber')) {
    return content;
  }

  const pages = content.split('\\page');
  const result: string[] = [];

  for (let i = 0; i < pages.length; i++) {
    let page = pages[i];

    // Skip first page (cover)
    if (i === 0) {
      result.push(page);
      continue;
    }

    // Add page number at end of page
    const pageNum = `\n\n{{pageNumber,auto}}\n{{footnote PART ${getRomanNumeral(Math.ceil(i / 5))}}}`;
    page = page + pageNum;
    result.push(page);
  }

  return result.join('\\page');
}

/**
 * Simple page number (just number, no decoration)
 */
export function addSimplePageNumbers(content: string): string {
  if (content.includes('{{pageNumber')) {
    return content;
  }

  const pages = content.split('\\page');
  const result: string[] = [];

  for (let i = 0; i < pages.length; i++) {
    let page = pages[i];

    if (i > 0) {
      page = page + `\n\n{{pageNumber ${i + 1}}}`;
    }

    result.push(page);
  }

  return result.join('\\page');
}

/**
 * Convert to Roman numeral
 */
function getRomanNumeral(num: number): string {
  const numerals: Array<[number, string]> = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];

  let result = '';
  let remaining = num;

  for (const [value, symbol] of numerals) {
    while (remaining >= value) {
      result += symbol;
      remaining -= value;
    }
  }

  return result;
}

/**
 * Add watermark
 */
export function addWatermark(content: string, text: string): string {
  // Add to each page
  const pages = content.split('\\page');
  const result: string[] = [];

  for (const page of pages) {
    result.push(page + `\n\n{{watermark ${text}}}`);
  }

  return result.join('\\page');
}

/**
 * Full document structure generation
 */
export function generateDocumentStructure(content: string, config?: ExtendedConfig): string {
  let result = content;
  const needs = detectNeededStructure(content);

  // Add cover if needed and enabled
  if (needs.needsCover && config?.document?.generateCover !== false) {
    result = insertCoverPage(result, config);
  }

  // Add TOC if needed and enabled
  if (needs.needsToc && config?.document?.generateToc) {
    result = insertTOC(result, config?.output?.tocDepth || 3);
  }

  // Add part covers if needed and enabled
  if (needs.needsPartCovers && config?.document?.generatePartCovers !== false) {
    result = insertPartCovers(result, config);
  }

  // Add drop caps if enabled
  if (config?.document?.dropCaps) {
    result = insertDropCaps(result);
  }

  // Add page numbers if enabled
  if (config?.document?.pageNumbers) {
    result = addSimplePageNumbers(result);
  }

  return result;
}

/**
 * Clean up redundant structural elements
 */
export function cleanupStructure(content: string): string {
  let result = content;

  // Remove duplicate page breaks
  result = result.replace(/\\page\s*\\page/g, '\\page');

  // Remove empty pages (just whitespace between page breaks)
  result = result.replace(/\\page\s*\\page/g, '\\page');

  // Normalize block spacing
  result = result.replace(/\}\}\s*\n\s*\n\s*\n+/g, '}}\n\n');

  // Ensure blocks have proper spacing
  result = result.replace(/\}\}\s*\{\{/g, '}}\n\n{{');

  return result;
}
