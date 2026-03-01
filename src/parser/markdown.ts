import { readFileSync } from 'fs';
import matter from 'gray-matter';
import { ContentBlock, ContentType } from '../types.js';
import { detectContentType } from './detector.js';

/**
 * Parse a markdown file into content blocks
 */
export function parseFile(filePath: string): ContentBlock[] {
  const content = readFileSync(filePath, 'utf-8');
  return parseMarkdown(content);
}

/**
 * Parse markdown string into content blocks
 */
export function parseMarkdown(content: string): ContentBlock[] {
  // Extract frontmatter if present
  const { content: markdownContent, data: frontmatter } = matter(content);

  // Split by major headers (# and ##)
  const blocks = splitByHeaders(markdownContent);

  // Detect type for each block
  return blocks.map((block, index) => {
    const type = detectContentType(block.content);
    return {
      type,
      rawContent: block.content,
      header: block.header,
      metadata: index === 0 ? frontmatter : undefined,
      lineNumber: block.lineNumber,
    };
  });
}

// Pre-compiled header patterns
const HEADER_PATTERN = /^(#{1,2})\s+(.+)$/;
// Also split on ### headers for monsters, NPCs, items, and locations
const SUBSECTION_SPLIT_PATTERN = /^(###)\s+((?:Monster|NPC|Item|Magic Item|Location|Spell|Area)\s*:.+)$/i;

interface RawBlock {
  header?: string;
  content: string;
  lineNumber: number;
}

/**
 * Internal block builder that accumulates lines in an array
 * to avoid quadratic string concatenation.
 */
interface BlockBuilder {
  header?: string;
  lines: string[];
  lineNumber: number;
}

function finalizeBlock(builder: BlockBuilder): RawBlock {
  return {
    header: builder.header,
    content: builder.lines.join('\n') + '\n',
    lineNumber: builder.lineNumber,
  };
}

/**
 * Split markdown by headers, keeping content with its header
 */
function splitByHeaders(markdown: string): RawBlock[] {
  const lines = markdown.split('\n');
  const blocks: RawBlock[] = [];
  let currentBuilder: BlockBuilder | null = null;
  let lineNumber = 1;

  for (const line of lines) {
    // Check for major headers (# or ##) or subsection-split headers (### Monster:, etc.)
    const headerMatch = line.match(HEADER_PATTERN) || line.match(SUBSECTION_SPLIT_PATTERN);

    if (headerMatch) {
      // Save previous block if exists
      if (currentBuilder && currentBuilder.lines.some(l => l.trim())) {
        blocks.push(finalizeBlock(currentBuilder));
      }

      // Start new block
      currentBuilder = {
        header: headerMatch[2],
        lines: [line],
        lineNumber,
      };
    } else {
      // Add to current block or start new one
      if (!currentBuilder) {
        currentBuilder = {
          lines: [line],
          lineNumber,
        };
      } else {
        currentBuilder.lines.push(line);
      }
    }

    lineNumber++;
  }

  // Don't forget the last block
  if (currentBuilder && currentBuilder.lines.some(l => l.trim())) {
    blocks.push(finalizeBlock(currentBuilder));
  }

  // Post-process: merge small blocks that belong together
  return mergeRelatedBlocks(blocks);
}

/**
 * Merge blocks that should stay together
 * (e.g., monster stat blocks spread across multiple sections)
 */
function mergeRelatedBlocks(blocks: RawBlock[]): RawBlock[] {
  const merged: RawBlock[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const prevBlock = merged[merged.length - 1];

    // Check if this block is a continuation of a monster stat block
    if (prevBlock && shouldMergeWithPrevious(prevBlock, block)) {
      prevBlock.content += '\n' + block.content;
    } else {
      merged.push({ ...block });
    }
  }

  return merged;
}

/**
 * Determine if a block should be merged with the previous one
 */
function shouldMergeWithPrevious(prev: RawBlock, current: RawBlock): boolean {
  // If previous is a monster and current has "Actions" header, merge
  const prevType = detectContentType(prev.content);
  if (prevType === ContentType.Monster) {
    if (current.header?.toLowerCase().includes('action')) {
      return true;
    }
    if (current.header?.toLowerCase().includes('reaction')) {
      return true;
    }
    if (current.header?.toLowerCase().includes('legendary')) {
      return true;
    }
  }

  return false;
}

/**
 * Extract blockquotes from content
 */
export function extractBlockquotes(content: string): string[] {
  const lines = content.split('\n');
  const blockquotes: string[] = [];
  let currentQuote: string[] = [];

  for (const line of lines) {
    if (line.startsWith('>')) {
      // Remove the > prefix and add to current quote
      currentQuote.push(line.replace(/^>\s?/, ''));
    } else if (currentQuote.length > 0) {
      // End of blockquote
      blockquotes.push(currentQuote.join('\n'));
      currentQuote = [];
    }
  }

  // Don't forget the last quote
  if (currentQuote.length > 0) {
    blockquotes.push(currentQuote.join('\n'));
  }

  return blockquotes;
}

/**
 * Remove blockquotes from content (for processing separately)
 */
export function removeBlockquotes(content: string): string {
  return content
    .split('\n')
    .filter((line) => !line.startsWith('>'))
    .join('\n');
}
