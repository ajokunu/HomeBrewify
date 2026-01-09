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

interface RawBlock {
  header?: string;
  content: string;
  lineNumber: number;
}

/**
 * Split markdown by headers, keeping content with its header
 */
function splitByHeaders(markdown: string): RawBlock[] {
  const lines = markdown.split('\n');
  const blocks: RawBlock[] = [];
  let currentBlock: RawBlock | null = null;
  let lineNumber = 1;

  for (const line of lines) {
    // Check for major headers (# or ##)
    const headerMatch = line.match(/^(#{1,2})\s+(.+)$/);

    if (headerMatch) {
      // Save previous block if exists
      if (currentBlock && currentBlock.content.trim()) {
        blocks.push(currentBlock);
      }

      // Start new block
      currentBlock = {
        header: headerMatch[2],
        content: line + '\n',
        lineNumber,
      };
    } else {
      // Add to current block or start new one
      if (!currentBlock) {
        currentBlock = {
          content: line + '\n',
          lineNumber,
        };
      } else {
        currentBlock.content += line + '\n';
      }
    }

    lineNumber++;
  }

  // Don't forget the last block
  if (currentBlock && currentBlock.content.trim()) {
    blocks.push(currentBlock);
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
