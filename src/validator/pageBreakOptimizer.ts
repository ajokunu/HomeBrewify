import { ValidationWarning, AutoFix } from '../types.js';

/**
 * Result of page break optimization
 */
export interface PageBreakOptimizationResult {
  warnings: ValidationWarning[];
  fixes: AutoFix[];
  optimizedContent: string;
}

/**
 * Detect and fix problematic page break patterns
 */
export function optimizePageBreaks(content: string): PageBreakOptimizationResult {
  const result: PageBreakOptimizationResult = {
    warnings: [],
    fixes: [],
    optimizedContent: content,
  };

  let working = content;

  // Fix back-to-back page breaks
  working = fixBackToBackBreaks(working, result);

  // Fix orphaned page breaks (at start or end)
  working = fixOrphanedBreaks(working, result);

  // Fix page breaks inside blocks
  working = fixBreaksInsideBlocks(working, result);

  // Fix empty pages
  working = fixEmptyPages(working, result);

  result.optimizedContent = working;
  return result;
}

/**
 * Fix back-to-back page breaks (\\page\\page or \\page\n\\page)
 */
function fixBackToBackBreaks(content: string, result: PageBreakOptimizationResult): string {
  let fixed = content;
  let match;

  // Pattern: \page followed by another \page with only whitespace between
  const pattern = /\\page[\s\n]*\\page/g;

  while ((match = pattern.exec(content)) !== null) {
    const line = content.substring(0, match.index).split('\n').length;

    result.warnings.push({
      type: 'orphaned_break',
      message: `Back-to-back page breaks found near line ${line}`,
      line,
      suggestion: 'Removed duplicate page break',
    });

    result.fixes.push({
      type: 'remove_page_break',
      location: line,
      original: match[0],
      replacement: '\\page',
    });
  }

  // Apply fix
  fixed = fixed.replace(/\\page[\s\n]*\\page/g, '\\page');

  return fixed;
}

/**
 * Fix orphaned page breaks at document start or end
 */
function fixOrphanedBreaks(content: string, result: PageBreakOptimizationResult): string {
  let fixed = content;

  // Page break at very start
  if (/^\s*\\page/.test(fixed)) {
    result.warnings.push({
      type: 'orphaned_break',
      message: 'Page break at document start',
      line: 1,
      suggestion: 'Removed orphaned page break',
    });

    result.fixes.push({
      type: 'remove_page_break',
      location: 1,
      original: '\\page',
      replacement: '',
    });

    fixed = fixed.replace(/^\s*\\page\s*/, '');
  }

  // Page break at very end with nothing after
  if (/\\page\s*$/.test(fixed)) {
    const lines = fixed.split('\n');
    const line = lines.length;

    result.warnings.push({
      type: 'orphaned_break',
      message: 'Page break at document end with no content after',
      line,
      suggestion: 'Removed orphaned page break',
    });

    result.fixes.push({
      type: 'remove_page_break',
      location: line,
      original: '\\page',
      replacement: '',
    });

    fixed = fixed.replace(/\\page\s*$/, '');
  }

  return fixed;
}

/**
 * Fix page breaks that appear inside unclosed blocks
 */
function fixBreaksInsideBlocks(content: string, result: PageBreakOptimizationResult): string {
  const lines = content.split('\n');
  const fixedLines: string[] = [];
  let blockDepth = 0;
  let blockStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Track block depth
    const opens = (line.match(/\{\{/g) || []).length;
    const closes = (line.match(/\}\}/g) || []).length;

    if (opens > 0 && blockDepth === 0) {
      blockStartLine = lineNum;
    }

    blockDepth += opens - closes;

    // Check for page break inside block
    if (line.includes('\\page') && blockDepth > 0) {
      result.warnings.push({
        type: 'orphaned_break',
        message: `Page break inside unclosed block (opened at line ${blockStartLine})`,
        line: lineNum,
        suggestion: 'Moving page break after block closes',
      });

      // Remove the page break from this line
      const fixedLine = line.replace(/\\page/g, '');
      fixedLines.push(fixedLine);

      // We'll add the page break after the block closes
      // (handled in post-processing)
      result.fixes.push({
        type: 'remove_page_break',
        location: lineNum,
        original: '\\page',
        replacement: '', // Will be re-added after block
      });
    } else {
      fixedLines.push(line);
    }
  }

  return fixedLines.join('\n');
}

/**
 * Fix pages that are essentially empty
 */
function fixEmptyPages(content: string, result: PageBreakOptimizationResult): string {
  const pages = content.split(/\\page/);
  const validPages: string[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const trimmed = page.trim();

    // Check if page has meaningful content
    const hasContent =
      trimmed.length > 10 && // More than just whitespace/punctuation
      !/^[\s\n]*$/.test(trimmed) && // Not just whitespace
      !/^[\s\n]*\}\}[\s\n]*$/.test(trimmed); // Not just closing braces

    if (hasContent || i === 0) {
      validPages.push(page);
    } else {
      // Calculate approximate line number
      const prevContent = pages.slice(0, i).join('\\page');
      const lineNum = prevContent.split('\n').length;

      result.warnings.push({
        type: 'empty_page',
        message: `Empty page ${i + 1} removed`,
        line: lineNum,
        suggestion: 'Merged with previous page',
      });

      result.fixes.push({
        type: 'merge_pages',
        location: lineNum,
        original: '\\page' + page,
        replacement: page.trim() ? '\n' + page.trim() : '',
      });
    }
  }

  return validPages.join('\\page');
}

/**
 * Insert smart page breaks based on content analysis
 */
export function insertSmartBreaks(content: string, targetFill: number = 85): string {
  const lines = content.split('\n');
  const result: string[] = [];

  let currentPageLines = 0;
  let blockDepth = 0;
  const linesPerPage = 90; // Approximate lines per page

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track block depth
    const opens = (line.match(/\{\{/g) || []).length;
    const closes = (line.match(/\}\}/g) || []).length;
    blockDepth += opens - closes;

    // Skip if inside a block
    if (blockDepth > 0) {
      result.push(line);
      currentPageLines++;
      continue;
    }

    // Check if we need a page break
    const fillPercent = (currentPageLines / linesPerPage) * 100;

    if (fillPercent >= targetFill && !line.includes('\\page')) {
      // Good break point candidates
      const isGoodBreak =
        line.match(/^#{1,2}\s/) || // Before major header
        (lines[i - 1]?.trim() === '}}' && line.trim() !== '}}') || // After block closes
        line.match(/^\{\{monster/) || // Before monster block
        line.match(/^\{\{item/); // Before item block

      if (isGoodBreak) {
        result.push('\\page');
        result.push('');
        currentPageLines = 0;
      }
    }

    result.push(line);
    currentPageLines++;

    // Reset counter on existing page breaks
    if (line.includes('\\page')) {
      currentPageLines = 0;
    }
  }

  return result.join('\n');
}

/**
 * Remove all page breaks (useful for re-pagination)
 */
export function removeAllBreaks(content: string): string {
  return content.replace(/\\page\n?/g, '\n');
}

/**
 * Add column breaks for better layout
 */
export function addColumnBreaks(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];

  let linesSinceBreak = 0;
  let blockDepth = 0;
  const linesPerColumn = 45;

  for (const line of lines) {
    // Track blocks
    const opens = (line.match(/\{\{/g) || []).length;
    const closes = (line.match(/\}\}/g) || []).length;
    blockDepth += opens - closes;

    // Reset on page break
    if (line.includes('\\page')) {
      linesSinceBreak = 0;
      result.push(line);
      continue;
    }

    // Skip column breaks inside blocks
    if (blockDepth > 0) {
      result.push(line);
      linesSinceBreak++;
      continue;
    }

    // Add column break if needed
    if (linesSinceBreak >= linesPerColumn && !line.includes('\\column')) {
      // Check for good break point
      const isGoodBreak =
        line.match(/^#{3,4}\s/) || // Before subheader
        line.trim() === '' || // At blank line
        line.match(/^\*\*/); // Before bold text (often new topic)

      if (isGoodBreak) {
        result.push('\\columnbreak');
        result.push('');
        linesSinceBreak = 0;
      }
    }

    result.push(line);
    linesSinceBreak++;
  }

  return result.join('\n');
}

/**
 * Analyze page break distribution
 */
export function analyzeBreakDistribution(content: string): {
  totalBreaks: number;
  avgContentBetween: number;
  problematicBreaks: number;
} {
  const pages = content.split(/\\page/);

  const lengths = pages.map((p) => p.trim().length);
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;

  // Count problematic (very short or very long)
  const problematic = lengths.filter((l) => l < 100 || l > 5000).length;

  return {
    totalBreaks: pages.length - 1,
    avgContentBetween: Math.round(avgLength),
    problematicBreaks: problematic,
  };
}
