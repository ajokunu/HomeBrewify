/**
 * Watercolor decoration generator for Homebrewery V3.
 * Generates {{watercolor1-12}} blocks with CSS positioning.
 */

export interface WatercolorOptions {
  variant?: number;     // 1-12 (which watercolor stain)
  position?: 'top' | 'bottom';
  opacity?: number;     // 0-100 percentage
}

/**
 * Generate a single watercolor decoration block.
 */
export function generateWatercolor(options: WatercolorOptions = {}): string {
  const variant = Math.max(1, Math.min(12, options.variant || ((Date.now() % 12) + 1)));
  const pos = options.position || 'bottom';
  const opacity = options.opacity ?? 80;

  const positionCss = pos === 'top'
    ? 'top:0px,left:0px'
    : 'bottom:0px,left:0px';

  return `{{watercolor${variant},${positionCss},width:816px,opacity:${opacity}%}}`;
}

/**
 * Insert watercolor decorations into document at page boundaries.
 * Skips cover pages and avoids adding decorations inside blocks.
 */
export function insertWatercolors(
  content: string,
  frequency: 'every-page' | 'every-other' | 'chapters-only' = 'every-other'
): string {
  const pages = content.split('\\page');
  const result: string[] = [];

  for (let i = 0; i < pages.length; i++) {
    let page = pages[i];

    // Skip cover pages
    const isCover =
      /\{\{frontCover/i.test(page) ||
      /\{\{backCover/i.test(page) ||
      /\{\{insideCover/i.test(page) ||
      /\{\{partCover/i.test(page);

    const shouldAdd =
      !isCover &&
      i > 0 && // Skip first page
      (
        frequency === 'every-page' ||
        (frequency === 'every-other' && i % 2 === 0) ||
        (frequency === 'chapters-only' && /^#\s+/m.test(page))
      );

    if (shouldAdd) {
      const variant = (i % 12) + 1;
      const position: 'top' | 'bottom' = i % 2 === 0 ? 'top' : 'bottom';
      const watercolor = generateWatercolor({ variant, position });
      page = page + '\n\n' + watercolor;
    }

    result.push(page);
  }

  return result.join('\\page');
}
