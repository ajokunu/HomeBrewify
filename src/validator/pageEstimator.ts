import { ValidationWarning } from '../types.js';

/**
 * Constants for page estimation
 */
const LINES_PER_COLUMN = 45;
const LINES_PER_PAGE = LINES_PER_COLUMN * 2; // 90 lines for 2-column layout
const MIN_FILL_PERCENT = 20;
const MAX_FILL_PERCENT = 100;

/**
 * Page content estimate
 */
export interface PageEstimate {
  pageNumber: number;
  lineCount: number;
  fillPercent: number;
  hasMonsterBlock: boolean;
  hasWideBlock: boolean;
  hasTable: boolean;
  startLine: number;
  endLine: number;
}

/**
 * Estimate content fill for all pages
 */
export function estimatePages(content: string): PageEstimate[] {
  const pages: PageEstimate[] = [];
  const pageContents = content.split(/\\page/);

  let currentLine = 1;

  for (let i = 0; i < pageContents.length; i++) {
    const pageContent = pageContents[i];
    const lines = pageContent.split('\n');
    const startLine = currentLine;

    // Calculate effective line count
    let effectiveLines = 0;

    for (const line of lines) {
      // Skip empty lines in calculation
      if (!line.trim()) {
        effectiveLines += 0.2; // Empty lines still take some space
        continue;
      }

      // Headers take more space
      if (line.match(/^#{1,6}/)) {
        effectiveLines += 2;
        continue;
      }

      // Tables have fixed height per row
      if (line.startsWith('|')) {
        effectiveLines += 1.5;
        continue;
      }

      // Block content
      if (line.includes('{{') || line.includes('}}')) {
        effectiveLines += 1;
        continue;
      }

      // Regular text line
      effectiveLines += 1;

      // Long lines wrap
      if (line.length > 80) {
        effectiveLines += Math.floor(line.length / 80) * 0.5;
      }
    }

    // Detect special blocks that affect layout
    const hasMonster = /\{\{monster/i.test(pageContent);
    const hasWide = /\{\{.*wide/i.test(pageContent) || /\{\{wide/.test(pageContent);
    const hasTable = /\{\{classTable/i.test(pageContent) || pageContent.includes('|---|');

    // Adjust for wide blocks (use single column)
    let pageLines = LINES_PER_PAGE;
    if (hasWide) {
      pageLines = LINES_PER_COLUMN; // Wide content is single-column
    }

    // Monster blocks take significant space
    if (hasMonster) {
      effectiveLines += countMonsterBlocks(pageContent) * 15;
    }

    const fillPercent = Math.min(100, Math.round((effectiveLines / pageLines) * 100));

    pages.push({
      pageNumber: i + 1,
      lineCount: lines.length,
      fillPercent,
      hasMonsterBlock: hasMonster,
      hasWideBlock: hasWide,
      hasTable: hasTable,
      startLine,
      endLine: currentLine + lines.length - 1,
    });

    currentLine += lines.length;
  }

  return pages;
}

/**
 * Count monster blocks in content
 */
function countMonsterBlocks(content: string): number {
  const matches = content.match(/\{\{monster/gi);
  return matches ? matches.length : 0;
}

/**
 * Validate page fills and generate warnings
 */
export function validatePageFills(content: string): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const pages = estimatePages(content);

  for (const page of pages) {
    // Check for underfilled pages
    if (page.fillPercent < MIN_FILL_PERCENT) {
      warnings.push({
        type: 'sparse_content',
        message: `Page ${page.pageNumber} is only ${page.fillPercent}% filled`,
        line: page.startLine,
        suggestion:
          page.fillPercent < 10
            ? 'Consider removing this page break or adding content'
            : 'Consider adding more content or moving elements from adjacent pages',
      });
    }

    // Check for overfilled pages
    if (page.fillPercent > MAX_FILL_PERCENT) {
      warnings.push({
        type: 'overflow',
        message: `Page ${page.pageNumber} may overflow (${page.fillPercent}% filled)`,
        line: page.startLine,
        suggestion: 'Consider adding a page break or moving content to next page',
      });
    }

    // Empty pages (except first which might be cover)
    if (page.lineCount <= 3 && page.pageNumber > 1) {
      warnings.push({
        type: 'empty_page',
        message: `Page ${page.pageNumber} appears to be empty`,
        line: page.startLine,
        suggestion: 'Remove unnecessary page break',
      });
    }
  }

  return warnings;
}

/**
 * Find optimal page break locations
 */
export function findOptimalBreakPoints(content: string): number[] {
  const breakPoints: number[] = [];
  const lines = content.split('\n');

  let currentFill = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Already a page break
    if (line.includes('\\page')) {
      currentFill = 0;
      continue;
    }

    // Calculate line contribution
    let lineWeight = 1;
    if (line.match(/^#{1,2}/)) lineWeight = 2.5;
    else if (line.match(/^#{3,4}/)) lineWeight = 2;
    else if (line.startsWith('|')) lineWeight = 1.5;
    else if (!line.trim()) lineWeight = 0.2;

    currentFill += lineWeight;

    // Check if we're approaching page limit
    if (currentFill >= LINES_PER_PAGE * 0.9) {
      // Look for good break points
      // Prefer: before headers, after blocks close, before stat blocks
      const goodBreakAhead = findNextGoodBreak(lines, i);
      if (goodBreakAhead > 0 && goodBreakAhead - i < 10) {
        breakPoints.push(goodBreakAhead);
        currentFill = 0;
      } else {
        breakPoints.push(i);
        currentFill = 0;
      }
    }
  }

  return breakPoints;
}

/**
 * Find next good break point after given line
 */
function findNextGoodBreak(lines: string[], startIdx: number): number {
  for (let i = startIdx; i < Math.min(startIdx + 15, lines.length); i++) {
    const line = lines[i];

    // Good break before major headers
    if (line.match(/^#{1,2}\s/)) {
      return i;
    }

    // Good break after block closes
    if (line.trim() === '}}' && i > startIdx) {
      return i + 1;
    }

    // Good break before monster/item blocks
    if (line.includes('{{monster') || line.includes('{{item')) {
      return i;
    }
  }

  return -1;
}

/**
 * Estimate how much space a specific content block will take
 */
export function estimateBlockSize(content: string): number {
  const lines = content.split('\n');
  let size = 0;

  // Base size
  size = lines.length;

  // Monster blocks add significant space
  if (/\{\{monster/i.test(content)) {
    size += 10;
    // Actions add more
    if (/### Actions/i.test(content)) size += 5;
    if (/### Legendary/i.test(content)) size += 8;
  }

  // Tables
  const tableRows = (content.match(/^\|/gm) || []).length;
  if (tableRows > 0) {
    size += tableRows * 0.5;
  }

  // Wide blocks take a full column width
  if (/\{\{.*wide/i.test(content)) {
    size *= 2;
  }

  return Math.ceil(size);
}

/**
 * Get page fill statistics
 */
export function getPageStats(
  content: string
): { total: number; avg: number; min: number; max: number; warnings: number } {
  const pages = estimatePages(content);

  if (pages.length === 0) {
    return { total: 0, avg: 0, min: 0, max: 0, warnings: 0 };
  }

  const fills = pages.map((p) => p.fillPercent);
  const avg = Math.round(fills.reduce((a, b) => a + b, 0) / fills.length);
  const min = Math.min(...fills);
  const max = Math.max(...fills);
  const warnings = fills.filter((f) => f < MIN_FILL_PERCENT || f > MAX_FILL_PERCENT).length;

  return {
    total: pages.length,
    avg,
    min,
    max,
    warnings,
  };
}
