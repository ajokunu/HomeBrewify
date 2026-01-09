import { TOCEntry, DocumentStructure, ChapterInfo, AppendixInfo } from '../types.js';

/**
 * Generate a Table of Contents from document structure
 */
export function generateTOC(structure: DocumentStructure, depth: number = 3): string {
  const lines: string[] = [];

  // TOC Header
  lines.push('# Table of Contents');
  lines.push('');
  lines.push('{{toc,wide}}');
  lines.push('');

  // Add parts and chapters
  if (structure.parts.length > 0) {
    for (const part of structure.parts) {
      lines.push(`- ### Part ${romanNumeral(part.number)}: ${part.title}`);

      // Add chapters within this part
      const partChapters = structure.chapters.filter((c) => c.partNumber === part.number);
      for (const chapter of partChapters) {
        lines.push(`  - #### ${chapter.title}`);

        // Add sections if depth allows
        if (depth >= 3 && chapter.sections.length > 0) {
          for (const section of chapter.sections) {
            lines.push(`    - ${section}`);
          }
        }
      }
    }
  } else {
    // No parts, just chapters
    for (const chapter of structure.chapters) {
      lines.push(`- ### ${chapter.title}`);

      if (depth >= 2 && chapter.sections.length > 0) {
        for (const section of chapter.sections) {
          lines.push(`  - ${section}`);
        }
      }
    }
  }

  // Add appendices
  if (structure.appendices.length > 0) {
    lines.push('');
    lines.push('- ### Appendices');

    for (const appendix of structure.appendices) {
      lines.push(`  - #### Appendix ${appendix.letter}: ${appendix.title}`);
    }
  }

  lines.push('');
  lines.push('}}');
  lines.push('');
  lines.push('\\page');

  return lines.join('\n');
}

/**
 * Generate TOC from a flat list of entries
 */
export function generateTOCFromEntries(entries: TOCEntry[]): string {
  const lines: string[] = [];

  lines.push('# Table of Contents');
  lines.push('');
  lines.push('{{toc,wide}}');
  lines.push('');

  for (const entry of entries) {
    const indent = '  '.repeat(entry.level - 1);
    const header = getHeaderForLevel(entry.level);
    lines.push(`${indent}- ${header}${entry.title}`);

    if (entry.children) {
      for (const child of entry.children) {
        const childLines = renderTOCEntry(child, entry.level + 1);
        lines.push(...childLines);
      }
    }
  }

  lines.push('');
  lines.push('}}');
  lines.push('');
  lines.push('\\page');

  return lines.join('\n');
}

/**
 * Render a single TOC entry with its children
 */
function renderTOCEntry(entry: TOCEntry, level: number): string[] {
  const lines: string[] = [];
  const indent = '  '.repeat(level - 1);
  const header = getHeaderForLevel(level);

  lines.push(`${indent}- ${header}${entry.title}`);

  if (entry.children) {
    for (const child of entry.children) {
      lines.push(...renderTOCEntry(child, level + 1));
    }
  }

  return lines;
}

/**
 * Get markdown header prefix for TOC level
 */
function getHeaderForLevel(level: number): string {
  switch (level) {
    case 1:
      return '### ';
    case 2:
      return '#### ';
    case 3:
      return '##### ';
    default:
      return '';
  }
}

/**
 * Convert number to roman numeral
 */
function romanNumeral(num: number): string {
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
 * Extract TOC entries from markdown content
 */
export function extractTOCEntries(content: string): TOCEntry[] {
  const entries: TOCEntry[] = [];
  const lines = content.split('\n');

  // Stack to track parent entries for nesting
  const stack: Array<{ entry: TOCEntry; level: number }> = [];

  for (const line of lines) {
    // Match headers (# to ####)
    const headerMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (!headerMatch) continue;

    const level = headerMatch[1].length;
    const title = headerMatch[2].trim();

    // Skip certain headers
    if (
      title.toLowerCase() === 'table of contents' ||
      title.toLowerCase().startsWith('credits') ||
      /^page\s+\d+$/i.test(title)
    ) {
      continue;
    }

    const entry: TOCEntry = {
      level,
      title,
      children: [],
    };

    // Find parent
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    if (stack.length === 0) {
      entries.push(entry);
    } else {
      const parent = stack[stack.length - 1].entry;
      if (!parent.children) parent.children = [];
      parent.children.push(entry);
    }

    stack.push({ entry, level });
  }

  return entries;
}

/**
 * Build document structure from content
 */
export function buildDocumentStructure(content: string): DocumentStructure {
  const structure: DocumentStructure = {
    hasCover: false,
    hasInsideCover: false,
    hasToc: false,
    parts: [],
    chapters: [],
    appendices: [],
  };

  const lines = content.split('\n');

  // Extract title from first major header
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    structure.title = titleMatch[1].trim();
  }

  // Check for existing Homebrewery structures
  structure.hasCover = /\{\{cover\}\}/i.test(content);
  structure.hasInsideCover = /\{\{insideCover\}\}/i.test(content);
  structure.hasToc = /\{\{toc/i.test(content);

  let currentPart = 0;
  let chapterNumber = 0;
  let currentChapter: ChapterInfo | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect part headers
    const partMatch = line.match(/^#\s+(?:Part|Act)\s+(\d+|[IVX]+)(?::\s*|\s+)(.+)$/i);
    if (partMatch) {
      currentPart++;
      structure.parts.push({
        number: currentPart,
        title: partMatch[2].trim(),
        startLine: i,
        chapters: [],
      });
      continue;
    }

    // Detect chapter headers
    const chapterMatch = line.match(/^##\s+(?:Chapter\s+)?(\d+)?(?::\s*|\s+)?(.+)$/i);
    if (chapterMatch && !line.toLowerCase().includes('appendix')) {
      chapterNumber++;
      currentChapter = {
        number: chapterNumber,
        title: chapterMatch[2]?.trim() || chapterMatch[1]?.trim() || 'Untitled',
        startLine: i,
        sections: [],
        partNumber: currentPart > 0 ? currentPart : undefined,
      };
      structure.chapters.push(currentChapter);

      // Add to current part's chapter list
      if (currentPart > 0 && structure.parts.length > 0) {
        structure.parts[structure.parts.length - 1].chapters.push(chapterNumber);
      }
      continue;
    }

    // Detect appendix headers
    const appendixMatch = line.match(/^##\s+Appendix\s+([A-Z])(?::\s*|\s+)(.+)$/i);
    if (appendixMatch) {
      structure.appendices.push({
        letter: appendixMatch[1].toUpperCase(),
        title: appendixMatch[2].trim(),
        startLine: i,
      });
      currentChapter = null;
      continue;
    }

    // Detect section headers within chapters
    const sectionMatch = line.match(/^###\s+(.+)$/);
    if (sectionMatch && currentChapter) {
      currentChapter.sections.push(sectionMatch[1].trim());
    }
  }

  return structure;
}

/**
 * Check if content needs a TOC
 */
export function needsTOC(content: string): boolean {
  // Already has TOC
  if (/\{\{toc/i.test(content)) {
    return false;
  }

  // Count major headers
  const headers = content.match(/^##?\s+.+$/gm) || [];
  return headers.length >= 5;
}
