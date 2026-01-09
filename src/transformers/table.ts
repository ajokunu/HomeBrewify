import { TableData } from '../types.js';

/**
 * Parse table data from markdown content
 */
export function parseTable(content: string): TableData {
  const lines = content.split('\n').filter((line) => line.trim());

  const table: TableData = {
    headers: [],
    rows: [],
    style: 'default',
  };

  // Extract title if present (header before table)
  const titleMatch = content.match(/^#{1,4}\s+(.+)$/m);
  if (titleMatch) {
    table.title = titleMatch[1].trim();
  }

  // Find table rows
  const tableLines = lines.filter((line) => line.trim().startsWith('|'));
  if (tableLines.length < 2) return table;

  // First line is headers
  const headerLine = tableLines[0];
  table.headers = parseTableRow(headerLine);

  // Second line is alignment (|---|---|)
  const alignLine = tableLines[1];
  table.alignment = parseAlignment(alignLine);

  // Rest are data rows
  for (let i = 2; i < tableLines.length; i++) {
    const row = parseTableRow(tableLines[i]);
    if (row.length > 0) {
      table.rows.push(row);
    }
  }

  // Detect table style
  table.style = detectTableStyle(table.headers, table.rows);

  // Detect dice column for roll tables
  if (table.style === 'roll') {
    table.diceColumn = findDiceColumn(table.headers);
  }

  return table;
}

/**
 * Parse a single table row into cells
 */
function parseTableRow(line: string): string[] {
  // Remove leading and trailing pipes, then split
  const trimmed = line.replace(/^\||\|$/g, '');
  return trimmed.split('|').map((cell) => cell.trim());
}

/**
 * Parse alignment from separator row
 */
function parseAlignment(line: string): ('left' | 'center' | 'right')[] {
  const cells = parseTableRow(line);
  return cells.map((cell) => {
    const trimmed = cell.replace(/\s/g, '');
    if (trimmed.startsWith(':') && trimmed.endsWith(':')) {
      return 'center';
    } else if (trimmed.endsWith(':')) {
      return 'right';
    }
    return 'left';
  });
}

/**
 * Detect appropriate table style based on content
 */
export function detectTableStyle(headers: string[], rows: string[][]): 'default' | 'class' | 'roll' {
  const headerLower = headers.map((h) => h.toLowerCase());

  // Roll tables have dice notation in headers or first column
  if (headerLower.some((h) => /^d\d+$/.test(h)) ||
      headerLower.includes('roll') ||
      headerLower.includes('dice')) {
    return 'roll';
  }

  // Check if first column contains dice notation (d20, d6, etc.)
  if (rows.length > 0) {
    const firstCol = rows.map((row) => row[0] || '');
    if (firstCol.some((cell) => /^\d+(-\d+)?$/.test(cell) || /^d\d+/.test(cell))) {
      return 'roll';
    }
  }

  // Class tables have level, proficiency, or feature columns
  if (headerLower.includes('level') ||
      headerLower.includes('proficiency bonus') ||
      headerLower.includes('features') ||
      headerLower.includes('slots')) {
    return 'class';
  }

  return 'default';
}

/**
 * Find the column index containing dice rolls
 */
function findDiceColumn(headers: string[]): number {
  const headerLower = headers.map((h) => h.toLowerCase());

  // Look for explicit dice header
  const diceIndex = headerLower.findIndex((h) => /^d\d+$/.test(h) || h === 'roll' || h === 'dice');
  if (diceIndex >= 0) return diceIndex;

  // Default to first column for roll tables
  return 0;
}

/**
 * Transform table data to Homebrewery format
 */
export function transformTable(data: TableData): string {
  const lines: string[] = [];

  // Open table block based on style
  if (data.style === 'class') {
    lines.push('{{classTable,frame');
  } else if (data.style === 'roll') {
    lines.push('{{classTable,frame,wide');
  }

  // Add title if present
  if (data.title) {
    lines.push(`##### ${data.title}`);
  }

  // Build header row
  lines.push(`| ${data.headers.join(' | ')} |`);

  // Build alignment row
  const alignRow = (data.alignment || data.headers.map(() => 'left' as const)).map((align) => {
    switch (align) {
      case 'center':
        return ':---:';
      case 'right':
        return '---:';
      default:
        return ':---';
    }
  });
  lines.push(`|${alignRow.join('|')}|`);

  // Build data rows
  for (const row of data.rows) {
    // Pad row to match header length
    const paddedRow = [...row];
    while (paddedRow.length < data.headers.length) {
      paddedRow.push('');
    }
    lines.push(`| ${paddedRow.join(' | ')} |`);
  }

  // Close table block if styled
  if (data.style === 'class' || data.style === 'roll') {
    lines.push('}}');
  }

  return lines.join('\n');
}

/**
 * Convert raw table content to Homebrewery format
 */
export function convertTable(content: string): string {
  const data = parseTable(content);
  return transformTable(data);
}

/**
 * Check if content contains a table
 */
export function isTable(content: string): boolean {
  // Must have at least two table rows (header + separator)
  const tableLines = content.split('\n').filter((line) => line.trim().startsWith('|'));
  if (tableLines.length < 2) return false;

  // Check for separator row (|---|---|)
  const hasSeparator = tableLines.some((line) => /^\|[-:\s|]+\|$/.test(line));
  return hasSeparator;
}

/**
 * Extract title and clean table content
 */
export function extractTableWithTitle(content: string): { title?: string; table: string } {
  const lines = content.split('\n');
  let title: string | undefined;
  const tableLines: string[] = [];
  let inTable = false;

  for (const line of lines) {
    if (line.trim().startsWith('|')) {
      inTable = true;
      tableLines.push(line);
    } else if (inTable) {
      // End of table
      break;
    } else if (line.match(/^#{1,4}\s+/)) {
      // Potential title
      title = line.replace(/^#{1,4}\s+/, '').trim();
    }
  }

  return {
    title,
    table: tableLines.join('\n'),
  };
}
