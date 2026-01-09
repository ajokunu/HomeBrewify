import { CoverPageData, InsideCoverData, PartCoverData } from '../types.js';

/**
 * Generate a cover page with Homebrewery formatting
 */
export function generateCover(data: CoverPageData): string {
  const lines: string[] = [];

  // Background image
  const bgImage = data.backgroundImage || 'placeholder.jpg';
  lines.push(`![Cover Image](${bgImage}){position:absolute,top:0,left:0,height:100%,width:100%}`);
  lines.push('');

  // Cover styling block (opened with {{, closed with }} later)
  lines.push('{{cover');
  lines.push('');

  // Title block with centering
  lines.push('{{title-block,wide');
  lines.push(`# ${data.title}`);

  if (data.subtitle) {
    lines.push(`## ${data.subtitle}`);
  }

  if (data.level) {
    lines.push(`### ${data.level}`);
  }

  lines.push('}}');
  lines.push('');

  // Campaign/setting info if provided
  if (data.campaign) {
    lines.push(`*${data.campaign}*`);
  }

  lines.push('}}');
  lines.push('');

  // Author credit at bottom
  if (data.author) {
    lines.push(`{{footnote Written by ${data.author}}}`);
  }

  lines.push('');
  lines.push('\\page');

  return lines.join('\n');
}

/**
 * Generate an inside cover page (credits/dedication)
 */
export function generateInsideCover(data: InsideCoverData): string {
  const lines: string[] = [];

  lines.push('{{insideCover');
  lines.push('');

  if (data.dedication) {
    lines.push('{{dedication');
    lines.push(`*${data.dedication}*`);
    lines.push('}}');
    lines.push('');
  }

  if (data.credits) {
    lines.push('### Credits');
    lines.push(data.credits);
    lines.push('');
  }

  if (data.copyright) {
    lines.push('___');
    lines.push(`*${data.copyright}*`);
    lines.push('');
  }

  if (data.version) {
    lines.push(`Version ${data.version}`);
  }

  lines.push('}}');
  lines.push('');
  lines.push('\\page');

  return lines.join('\n');
}

/**
 * Generate a part cover page (chapter divider)
 */
export function generatePartCover(data: PartCoverData): string {
  const lines: string[] = [];

  lines.push('\\page');
  lines.push('');

  // Background image for part cover
  const bgImage = data.backgroundImage || 'placeholder.jpg';
  lines.push(`![Part Cover](${bgImage}){position:absolute,top:0,left:0,height:100%,width:100%}`);
  lines.push('');

  lines.push('{{partCover');
  lines.push('');

  // Part number formatting
  const partWord = getPartWord(data.partNumber);
  lines.push(`# Part ${partWord}`);
  lines.push(`## ${data.title}`);

  if (data.subtitle) {
    lines.push(`*${data.subtitle}*`);
  }

  lines.push('');
  lines.push('}}');
  lines.push('');
  lines.push('\\page');

  return lines.join('\n');
}

/**
 * Convert part number to word (1 -> "One", 2 -> "Two", etc.)
 */
function getPartWord(num: number): string {
  const words = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
  return words[num] || num.toString();
}

/**
 * Extract cover data from document content
 */
export function extractCoverData(content: string): CoverPageData | null {
  const lines = content.split('\n');

  // Look for title in first # header
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (!titleMatch) return null;

  const data: CoverPageData = {
    title: titleMatch[1].trim(),
  };

  // Look for subtitle (## header after title)
  const subtitleMatch = content.match(/^##\s+(.+)$/m);
  if (subtitleMatch) {
    data.subtitle = subtitleMatch[1].trim();
  }

  // Look for level info (e.g., "A Level 7-9 Adventure")
  // Only add if subtitle doesn't already contain level info
  if (!data.subtitle || !data.subtitle.toLowerCase().includes('level')) {
    const levelMatch = content.match(/(?:Level|Levels?)\s+(\d+(?:-\d+)?)/i);
    if (levelMatch) {
      data.level = `A Level ${levelMatch[1]} Adventure`;
    }
  }

  // Look for setting (Eberron, Forgotten Realms, etc.)
  const settingPatterns = ['Eberron', 'Forgotten Realms', 'Ravenloft', 'Greyhawk', 'Dragonlance'];
  for (const setting of settingPatterns) {
    if (content.toLowerCase().includes(setting.toLowerCase())) {
      data.campaign = setting;
      break;
    }
  }

  return data;
}

/**
 * Detect part breaks in content
 */
export function detectPartBreaks(content: string): PartCoverData[] {
  const parts: PartCoverData[] = [];
  const partPattern = /^#\s+(?:Part|Chapter|Act)\s+(\d+|[IVX]+)(?::\s*|\s+)(.+)$/gim;

  let match;
  while ((match = partPattern.exec(content)) !== null) {
    const partNum = parsePartNumber(match[1]);
    parts.push({
      partNumber: partNum,
      title: match[2].trim(),
    });
  }

  return parts;
}

/**
 * Parse part number from string (handles "1", "I", "One", etc.)
 */
function parsePartNumber(str: string): number {
  // Try numeric
  const num = parseInt(str, 10);
  if (!isNaN(num)) return num;

  // Try roman numerals
  const romanMap: Record<string, number> = {
    'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
    'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10,
  };
  if (romanMap[str.toUpperCase()]) {
    return romanMap[str.toUpperCase()];
  }

  // Try words
  const wordMap: Record<string, number> = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  };
  if (wordMap[str.toLowerCase()]) {
    return wordMap[str.toLowerCase()];
  }

  return 1;
}
