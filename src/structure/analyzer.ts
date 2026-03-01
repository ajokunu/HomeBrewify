import {
  DocumentStructure,
  PartInfo,
  ChapterInfo,
  AppendixInfo,
  CoverPageData,
} from '../types.js';

/**
 * Analyze document structure from markdown content
 */
export function analyzeDocument(content: string): DocumentStructure {
  const structure: DocumentStructure = {
    hasCover: false,
    hasInsideCover: false,
    hasToc: false,
    parts: [],
    chapters: [],
    appendices: [],
  };

  const lines = content.split('\n');

  // Extract metadata from content
  structure.title = extractTitle(content);
  structure.author = extractAuthor(content);

  // Check for existing Homebrewery structures
  structure.hasCover = /\{\{(?:front)?[Cc]over/i.test(content);
  structure.hasInsideCover = /\{\{insideCover/i.test(content);
  structure.hasToc = /\{\{toc/i.test(content);

  // Parse structure
  let currentPart = 0;
  let chapterNumber = 0;
  let currentChapter: ChapterInfo | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect parts (Part 1, Act 1, etc.)
    const partMatch = line.match(/^#\s+(?:Part|Act)\s+(\d+|[IVX]+|One|Two|Three|Four|Five)(?::\s*|\s*[-–—]\s*|\s+)(.+)?$/i);
    if (partMatch) {
      currentPart++;
      structure.parts.push({
        number: currentPart,
        title: partMatch[2]?.trim() || `Part ${currentPart}`,
        startLine: i,
        chapters: [],
      });
      continue;
    }

    // Detect chapters
    const chapterMatch = line.match(/^##\s+(?:Chapter\s+(\d+)(?::\s*|\s*[-–—]\s*|\s+))?(.+)$/i);
    if (chapterMatch && !line.toLowerCase().includes('appendix')) {
      // Skip if this looks like a section, not a chapter
      if (line.match(/^##\s+(Introduction|Conclusion|Summary|Overview|Background)$/i)) {
        continue;
      }

      chapterNumber++;
      currentChapter = {
        number: chapterNumber,
        title: chapterMatch[2]?.trim() || chapterMatch[1]?.trim() || 'Untitled',
        startLine: i,
        sections: [],
        partNumber: currentPart > 0 ? currentPart : undefined,
      };
      structure.chapters.push(currentChapter);

      // Add to current part
      if (currentPart > 0 && structure.parts.length > 0) {
        structure.parts[structure.parts.length - 1].chapters.push(chapterNumber);
      }
      continue;
    }

    // Detect appendices
    const appendixMatch = line.match(/^##\s+Appendix\s+([A-Z])(?::\s*|\s*[-–—]\s*|\s+)(.+)$/i);
    if (appendixMatch) {
      structure.appendices.push({
        letter: appendixMatch[1].toUpperCase(),
        title: appendixMatch[2].trim(),
        startLine: i,
      });
      currentChapter = null;
      continue;
    }

    // Detect sections within chapters
    const sectionMatch = line.match(/^###\s+(.+)$/);
    if (sectionMatch && currentChapter) {
      const sectionTitle = sectionMatch[1].trim();
      // Skip certain technical headers
      if (!/^(Actions|Reactions|Legendary|Mythic|Lair|Regional|Traits)$/i.test(sectionTitle)) {
        currentChapter.sections.push(sectionTitle);
      }
    }
  }

  // Estimate total pages
  structure.totalPages = estimatePageCount(content);

  return structure;
}

/**
 * Extract document title
 */
function extractTitle(content: string): string | undefined {
  // Look for YAML frontmatter
  const frontmatterMatch = content.match(/^---\n[\s\S]*?title:\s*["']?([^"'\n]+)["']?[\s\S]*?---/m);
  if (frontmatterMatch) {
    return frontmatterMatch[1].trim();
  }

  // Look for first H1 header
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) {
    const title = h1Match[1].trim();
    // Skip if it's a structural header
    if (!/^(Part|Act|Chapter|Episode)\s+/i.test(title)) {
      return title;
    }
  }

  // Look in cover block (V3 uses {{frontCover}})
  const coverMatch = content.match(/\{\{(?:front)?[Cc]over[\s\S]{0,500}?#\s+(.+?)(?:\n|$)/);
  if (coverMatch) {
    return coverMatch[1].trim();
  }

  return undefined;
}

/**
 * Extract document author
 */
function extractAuthor(content: string): string | undefined {
  // YAML frontmatter
  const frontmatterMatch = content.match(/^---\n[\s\S]*?author:\s*["']?([^"'\n]+)["']?[\s\S]*?---/m);
  if (frontmatterMatch) {
    return frontmatterMatch[1].trim();
  }

  // Common patterns
  const authorPatterns = [
    /(?:Written|Created|Designed)\s+by\s+([^,\n]+)/i,
    /Author:\s*([^\n]+)/i,
    /By\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
  ];

  for (const pattern of authorPatterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return undefined;
}

/**
 * Estimate page count from content
 */
function estimatePageCount(content: string): number {
  const pages = content.split(/\\page/);
  return Math.max(1, pages.length);
}

/**
 * Extract cover data from content
 */
export function extractCoverData(content: string): CoverPageData | null {
  const structure = analyzeDocument(content);

  if (!structure.title) {
    return null;
  }

  const data: CoverPageData = {
    title: structure.title,
  };

  if (structure.author) {
    data.author = structure.author;
  }

  // Extract subtitle
  const subtitleMatch = content.match(/^##\s+(.+)$/m);
  if (subtitleMatch) {
    const subtitle = subtitleMatch[1].trim();
    if (!/^(Part|Act|Chapter|Appendix)/i.test(subtitle)) {
      data.subtitle = subtitle;
    }
  }

  // Extract level info (only if subtitle doesn't already contain it)
  if (!data.subtitle || !data.subtitle.toLowerCase().includes('level')) {
    const levelMatch = content.match(/(?:Level|Levels?)\s+(\d+(?:\s*[-–—]\s*\d+)?)/i);
    if (levelMatch) {
      data.level = `A Level ${levelMatch[1]} Adventure`;
    }
  }

  // Detect campaign setting
  const settings = ['Eberron', 'Forgotten Realms', 'Ravenloft', 'Greyhawk', 'Dragonlance', 'Exandria'];
  for (const setting of settings) {
    if (content.toLowerCase().includes(setting.toLowerCase())) {
      data.campaign = setting;
      break;
    }
  }

  return data;
}

/**
 * Detect if content needs structural elements
 */
export function detectNeededStructure(content: string): {
  needsCover: boolean;
  needsToc: boolean;
  needsPartCovers: boolean;
  needsPageNumbers: boolean;
} {
  const structure = analyzeDocument(content);

  return {
    needsCover: !structure.hasCover && !!structure.title,
    needsToc: !structure.hasToc && structure.chapters.length >= 3,
    needsPartCovers: structure.parts.length > 0,
    needsPageNumbers: !content.includes('{{pageNumber'),
  };
}

/**
 * Get document outline (for TOC generation)
 */
export function getDocumentOutline(
  content: string
): Array<{ level: number; title: string; line: number }> {
  const outline: Array<{ level: number; title: string; line: number }> = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match headers 1-4
    const headerMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const title = headerMatch[2].trim();

      // Skip technical headers
      if (/^(Actions|Reactions|Legendary|Mythic|Lair|Regional|Traits)$/i.test(title)) {
        continue;
      }

      // Skip if inside a block
      const beforeContent = lines.slice(0, i).join('\n');
      const opens = (beforeContent.match(/\{\{/g) || []).length;
      const closes = (beforeContent.match(/\}\}/g) || []).length;
      if (opens > closes) {
        continue;
      }

      outline.push({ level, title, line: i });
    }
  }

  return outline;
}

/**
 * Find content sections by type
 */
export function findContentSections(content: string): {
  monsters: Array<{ name: string; line: number }>;
  items: Array<{ name: string; line: number }>;
  npcs: Array<{ name: string; line: number }>;
  locations: Array<{ name: string; line: number }>;
} {
  const sections = {
    monsters: [] as Array<{ name: string; line: number }>,
    items: [] as Array<{ name: string; line: number }>,
    npcs: [] as Array<{ name: string; line: number }>,
    locations: [] as Array<{ name: string; line: number }>,
  };

  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextFewLines = lines.slice(i, i + 10).join('\n');

    // Monster detection
    if (
      line.match(/^###?\s*Monster:/i) ||
      (line.match(/^###\s+.+$/) &&
        /\b(AC|Armor Class)\s*[:=]?\s*\d+/i.test(nextFewLines) &&
        /\bSTR\s+\d+/i.test(nextFewLines))
    ) {
      const nameMatch = line.match(/^#{1,3}\s*(?:Monster:\s*)?(.+)$/);
      if (nameMatch) {
        sections.monsters.push({ name: nameMatch[1].trim(), line: i });
      }
    }

    // Item detection
    if (
      line.match(/^#{3,4}\s*(?:Magic\s+)?Item:/i) ||
      (line.match(/^#{3,4}\s+.+$/) &&
        /\b(common|uncommon|rare|very rare|legendary|artifact)\b/i.test(nextFewLines) &&
        /requires attunement|wondrous item|weapon|armor/i.test(nextFewLines))
    ) {
      const nameMatch = line.match(/^#{3,4}\s*(?:(?:Magic\s+)?Item:\s*)?(.+)$/);
      if (nameMatch) {
        sections.items.push({ name: nameMatch[1].trim(), line: i });
      }
    }

    // NPC detection
    if (
      line.match(/^#{2,3}\s*NPC:/i) ||
      (/\*\*(Personality|Ideals?|Bonds?|Flaws?)\*\*/i.test(nextFewLines) &&
        !/\b(AC|Armor Class)\s*[:=]?\s*\d+/i.test(nextFewLines))
    ) {
      const nameMatch = line.match(/^#{2,3}\s*(?:NPC:\s*)?(.+)$/);
      if (nameMatch && !sections.npcs.find((n) => n.line === i)) {
        sections.npcs.push({ name: nameMatch[1].trim(), line: i });
      }
    }

    // Location detection
    if (
      line.match(/^#{2,3}\s*Location:/i) ||
      (line.match(/^#{2,3}\s+(?:The\s+)?[A-Z]/) &&
        /\b(room|chamber|hall|cave|dungeon|tower|castle|inn|tavern|shop)\b/i.test(line.toLowerCase()))
    ) {
      const nameMatch = line.match(/^#{2,3}\s*(?:Location:\s*)?(.+)$/);
      if (nameMatch && !sections.locations.find((l) => l.line === i)) {
        sections.locations.push({ name: nameMatch[1].trim(), line: i });
      }
    }
  }

  return sections;
}
