import { CoverPageData, InsideCoverData, PartCoverData, BackCoverData } from '../types.js';

/**
 * Generate a front cover page using Homebrewery V3 {{frontCover}} syntax.
 */
export function generateCover(data: CoverPageData): string {
  const lines: string[] = [];

  // Background image
  const bgImage = data.backgroundImage || 'placeholder.jpg';
  lines.push(`![Cover Image](${bgImage}){position:absolute,top:0,left:0,height:100%,width:100%}`);
  lines.push('');

  // V3 front cover block
  lines.push('{{frontCover');
  lines.push('');

  // Logo (standard V3 pattern)
  lines.push('{{logo}}');
  lines.push('');

  // Title
  lines.push(`# ${data.title}`);

  if (data.subtitle) {
    lines.push(`## ${data.subtitle}`);
  }

  if (data.level) {
    lines.push(`### ${data.level}`);
  }

  lines.push('___');

  // Banner decoration
  lines.push('{{banner HOMEBREW}}');
  lines.push('');

  // Footnote with author/campaign info
  const footnoteParts: string[] = [];
  if (data.author) footnoteParts.push(`Written by ${data.author}`);
  if (data.campaign) footnoteParts.push(data.campaign);
  if (footnoteParts.length > 0) {
    lines.push(`{{footnote ${footnoteParts.join(' | ')}}}`);
  }

  // Close front cover block
  lines.push('}}');
  lines.push('');
  lines.push('\\page');

  return lines.join('\n');
}

/**
 * Generate an inside cover page (credits/dedication) using V3 {{insideCover}} syntax.
 */
export function generateInsideCover(data: InsideCoverData): string {
  const lines: string[] = [];

  lines.push('{{insideCover');
  lines.push('');

  // Dedication as styled italic text (V3 has no {{dedication}} class)
  if (data.dedication) {
    lines.push(`*${data.dedication}*`);
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
 * Generate a part cover page (chapter divider) using V3 {{partCover}} + {{imageMaskEdge}} syntax.
 */
export function generatePartCover(data: PartCoverData): string {
  const lines: string[] = [];

  lines.push('\\page');
  lines.push('');

  // V3 part cover block
  lines.push('{{partCover');
  lines.push('');

  // Image mask for decorative background (V3 pattern)
  const bgImage = data.backgroundImage || 'placeholder.jpg';
  lines.push('{{imageMaskEdge2,--pointed:pointed}}');
  lines.push(`![Part Cover](${bgImage}){position:absolute,top:0,left:0,height:100%}`);
  lines.push('{{}}');
  lines.push('');

  // Part number and title
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
 * Generate a back cover page using V3 {{backCover}} syntax.
 */
export function generateBackCover(data: BackCoverData): string {
  const lines: string[] = [];

  lines.push('\\page');
  lines.push('');

  // Background image
  if (data.backgroundImage) {
    lines.push(`![Back Cover](${data.backgroundImage}){position:absolute,top:0,left:0,height:100%,width:100%}`);
    lines.push('');
  }

  // V3 back cover block
  lines.push('{{backCover');
  lines.push('');

  // Subtitle/tagline
  if (data.subtitle) {
    lines.push(`# ${data.subtitle}`);
    lines.push('');
  }

  // Description/blurb
  if (data.description) {
    lines.push(data.description);
    lines.push('');
    lines.push(':');
    lines.push('');
  }

  // Divider
  lines.push('___');
  lines.push('');

  // Footer info
  if (data.title || data.author) {
    const footParts = [data.title, data.author ? `Written by ${data.author}` : ''].filter(Boolean);
    lines.push(footParts.join(' | '));
    lines.push('');
  }

  // Logo
  if (data.logoUrl) {
    lines.push(`{{logo ![](${data.logoUrl})}}`);
  } else {
    lines.push('{{logo}}');
  }

  lines.push('');
  lines.push('}}');

  return lines.join('\n');
}

/**
 * Convert part number to word (1 -> "One", 2 -> "Two", etc.)
 */
function getPartWord(num: number): string {
  const words = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
  return words[num] || num.toString();
}

// Note: extractCoverData and detectPartBreaks are in structure/analyzer.ts
