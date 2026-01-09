import {
  PageValidationResult,
  ValidationWarning,
  ValidationError,
  AutoFix,
} from '../types.js';

import { validateBlocks, fixUnclosedBlocks, checkBlockNesting } from './blockMatcher.js';
import { validatePageFills, getPageStats, estimatePages } from './pageEstimator.js';
import { optimizePageBreaks, insertSmartBreaks, addColumnBreaks } from './pageBreakOptimizer.js';

export * from './blockMatcher.js';
export * from './pageEstimator.js';
export * from './pageBreakOptimizer.js';

/**
 * Full validation result
 */
export interface FullValidationResult extends PageValidationResult {
  pageCount: number;
  avgFill: number;
  blockTypes: string[];
}

/**
 * Validate Homebrewery markdown content
 */
export function validate(content: string): FullValidationResult {
  const result: FullValidationResult = {
    isValid: true,
    warnings: [],
    errors: [],
    autoFixes: [],
    estimatedFill: 0,
    pageCount: 0,
    avgFill: 0,
    blockTypes: [],
  };

  // Validate block matching
  const blockResult = validateBlocks(content);
  result.errors.push(...blockResult.errors);
  result.autoFixes.push(...blockResult.fixes);

  // Check block nesting
  const nestingWarnings = checkBlockNesting(content);
  result.warnings.push(...nestingWarnings);

  // Validate page fills
  const fillWarnings = validatePageFills(content);
  result.warnings.push(...fillWarnings);

  // Get page statistics
  const stats = getPageStats(content);
  result.pageCount = stats.total;
  result.avgFill = stats.avg;
  result.estimatedFill = stats.avg;

  // Check page break optimization
  const breakResult = optimizePageBreaks(content);
  result.warnings.push(...breakResult.warnings);
  result.autoFixes.push(...breakResult.fixes);

  // Determine overall validity
  result.isValid = result.errors.length === 0;

  // Get used block types
  const blockTypeMatches = content.matchAll(/\{\{(\w+)/g);
  const types = new Set<string>();
  for (const match of blockTypeMatches) {
    types.add(match[1]);
  }
  result.blockTypes = Array.from(types);

  return result;
}

/**
 * Validate and automatically fix issues
 */
export function validateAndFix(content: string): { content: string; result: FullValidationResult } {
  let working = content;

  // First pass: fix unclosed blocks
  working = fixUnclosedBlocks(working);

  // Second pass: optimize page breaks
  const breakResult = optimizePageBreaks(working);
  working = breakResult.optimizedContent;

  // Third pass: validate the fixed content
  const result = validate(working);

  return { content: working, result };
}

/**
 * Full optimization pass
 */
export function optimize(content: string, options: OptimizationOptions = {}): string {
  let working = content;

  // Fix blocks first
  working = fixUnclosedBlocks(working);

  // Optimize page breaks
  const breakResult = optimizePageBreaks(working);
  working = breakResult.optimizedContent;

  // Insert smart breaks if requested
  if (options.smartBreaks) {
    working = insertSmartBreaks(working, options.targetFill || 85);
  }

  // Add column breaks if requested
  if (options.columnBreaks) {
    working = addColumnBreaks(working);
  }

  return working;
}

/**
 * Optimization options
 */
export interface OptimizationOptions {
  smartBreaks?: boolean;
  columnBreaks?: boolean;
  targetFill?: number;
}

/**
 * Get a human-readable validation report
 */
export function getValidationReport(content: string): string {
  const result = validate(content);
  const lines: string[] = [];

  lines.push('=== Homebrewery Validation Report ===');
  lines.push('');

  // Summary
  lines.push(`Status: ${result.isValid ? 'VALID' : 'INVALID'}`);
  lines.push(`Pages: ${result.pageCount}`);
  lines.push(`Average Fill: ${result.avgFill}%`);
  lines.push(`Block Types: ${result.blockTypes.join(', ') || 'none'}`);
  lines.push('');

  // Errors
  if (result.errors.length > 0) {
    lines.push(`Errors (${result.errors.length}):`);
    for (const error of result.errors) {
      lines.push(`  Line ${error.line}: ${error.message}`);
    }
    lines.push('');
  }

  // Warnings
  if (result.warnings.length > 0) {
    lines.push(`Warnings (${result.warnings.length}):`);
    for (const warning of result.warnings) {
      lines.push(`  Line ${warning.line || '?'}: ${warning.message}`);
      if (warning.suggestion) {
        lines.push(`    Suggestion: ${warning.suggestion}`);
      }
    }
    lines.push('');
  }

  // Auto-fixes available
  if (result.autoFixes.length > 0) {
    lines.push(`Auto-fixes available (${result.autoFixes.length}):`);
    for (const fix of result.autoFixes) {
      lines.push(`  Line ${fix.location}: ${fix.type}`);
    }
    lines.push('');
  }

  // Page breakdown
  const pages = estimatePages(content);
  if (pages.length > 0) {
    lines.push('Page Breakdown:');
    for (const page of pages) {
      const status =
        page.fillPercent < 20 ? '[SPARSE]' : page.fillPercent > 100 ? '[OVERFLOW]' : '[OK]';
      const flags: string[] = [];
      if (page.hasMonsterBlock) flags.push('monster');
      if (page.hasWideBlock) flags.push('wide');
      if (page.hasTable) flags.push('table');

      lines.push(
        `  Page ${page.pageNumber}: ${page.fillPercent}% ${status} ${flags.length > 0 ? `(${flags.join(', ')})` : ''}`
      );
    }
  }

  return lines.join('\n');
}

/**
 * Quick validation - just check if content is valid
 */
export function isValid(content: string): boolean {
  const blockResult = validateBlocks(content);
  return blockResult.isValid;
}

/**
 * Get validation summary as object
 */
export function getValidationSummary(content: string): {
  valid: boolean;
  errorCount: number;
  warningCount: number;
  pageCount: number;
  avgFill: number;
} {
  const result = validate(content);

  return {
    valid: result.isValid,
    errorCount: result.errors.length,
    warningCount: result.warnings.length,
    pageCount: result.pageCount,
    avgFill: result.avgFill,
  };
}
