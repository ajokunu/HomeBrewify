/**
 * Artist credit block transformer for Homebrewery V3.
 * Generates {{artist}} blocks for artwork attribution.
 */

export interface ArtistCreditData {
  artistName: string;
  artTitle?: string;
  source?: string;
}

/**
 * Check if content is an artist credit line.
 */
export function isArtistCredit(content: string): boolean {
  return /\b(?:Art|Illustration|Image|Artwork)\s+(?:by|:)\s+.+/i.test(content) &&
    content.trim().split('\n').length <= 3;
}

/**
 * Transform detected artist credit text into a V3 {{artist}} block.
 */
export function transformArtistCredit(content: string): string {
  const match = content.match(/\b(?:Art|Illustration|Image|Artwork)\s+(?:by|:)\s+(.+)/i);
  if (!match) return content;

  const artistInfo = match[1].trim();
  return generateArtistCredit({ artistName: artistInfo });
}

/**
 * Generate a V3 {{artist}} credit block from structured data.
 */
export function generateArtistCredit(data: ArtistCreditData): string {
  const lines: string[] = [];
  lines.push('{{artist');

  if (data.artTitle) {
    lines.push(`##### ${data.artTitle}`);
  }

  if (data.source) {
    lines.push(`[${data.artistName}](${data.source})`);
  } else {
    lines.push(`##### ${data.artistName}`);
  }

  lines.push('}}');
  return lines.join('\n');
}
