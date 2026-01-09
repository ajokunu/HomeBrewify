#!/usr/bin/env node
/**
 * Homebrewify CLI
 * Convert D&D campaign markdown to Homebrewery format
 */

import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join, basename, extname } from 'path';
import chalk from 'chalk';
import { parseMarkdown } from './parser/markdown.js';
import {
  transform,
  transformExtended,
  generateMonster,
  generateItem,
  generateSpell,
  validate,
  validateAndFix,
  getValidationReport,
  analyzeDocument,
} from './transformers/index.js';
import { ContentType, ExtendedConfig, defaultExtendedConfig } from './types.js';

const program = new Command();

program
  .name('homebrewify')
  .description('Convert D&D campaign markdown to Homebrewery format')
  .version('1.0.0');

/**
 * Convert command - main conversion functionality
 */
program
  .command('convert')
  .description('Convert markdown files to Homebrewery format')
  .argument('<input>', 'Input file or directory')
  .option('-o, --output <path>', 'Output file or directory')
  .option('-c, --clipboard', 'Copy output to clipboard')
  .option('-f, --format <format>', 'Input format: auto, obsidian, raw', 'auto')
  .option('-t, --template <template>', 'Template style: phb, dmg', 'phb')
  .option('--validate', 'Run validation and show warnings')
  .option('--auto-fix', 'Automatically fix validation issues')
  .option('--cover', 'Generate cover page')
  .option('--no-cover', 'Skip cover page generation')
  .option('--toc', 'Generate table of contents')
  .option('--part-covers', 'Generate part/act divider pages')
  .option('--drop-caps', 'Add drop caps to chapter starts')
  .option('--page-numbers', 'Add page numbers')
  .option('-v, --verbose', 'Show detailed output')
  .action(async (input: string, options) => {
    try {
      const inputPath = input;

      if (!existsSync(inputPath)) {
        console.error(chalk.red(`Error: Input path does not exist: ${inputPath}`));
        process.exit(1);
      }

      const stats = statSync(inputPath);

      if (stats.isFile()) {
        // Single file conversion
        const result = convertFileExtended(inputPath, options);

        if (options.output) {
          writeFileSync(options.output, result.content);
          console.log(chalk.green(`Converted: ${inputPath} -> ${options.output}`));

          if (result.pageCount) {
            console.log(chalk.blue(`Pages: ${result.pageCount}, Average fill: ${result.avgFill}%`));
          }
        } else if (options.clipboard) {
          const { default: clipboardy } = await import('clipboardy');
          await clipboardy.write(result.content);
          console.log(chalk.green('Output copied to clipboard'));
        } else {
          console.log(result.content);
        }

        // Show validation report if verbose
        if (options.verbose && result.validationReport) {
          console.log(chalk.cyan('\n--- Validation Report ---'));
          console.log(result.validationReport);
        }
      } else if (stats.isDirectory()) {
        // Directory conversion
        const files = readdirSync(inputPath).filter(
          (f) => extname(f).toLowerCase() === '.md'
        );

        if (files.length === 0) {
          console.error(chalk.yellow('No markdown files found in directory'));
          return;
        }

        console.log(chalk.blue(`Found ${files.length} markdown files`));

        for (const file of files) {
          const filePath = join(inputPath, file);
          const result = convertFileExtended(filePath, options);

          if (options.output) {
            const outputPath = join(options.output, file.replace('.md', '-hb.md'));
            writeFileSync(outputPath, result.content);
            console.log(chalk.green(`Converted: ${file}`));
          } else {
            console.log(chalk.cyan(`\n=== ${file} ===\n`));
            console.log(result.content);
          }
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });

/**
 * Validate command - validate existing Homebrewery markdown
 */
program
  .command('validate')
  .description('Validate Homebrewery markdown file')
  .argument('<input>', 'Input file to validate')
  .option('--fix', 'Apply automatic fixes')
  .option('-o, --output <path>', 'Output fixed file (requires --fix)')
  .action(async (input: string, options) => {
    try {
      if (!existsSync(input)) {
        console.error(chalk.red(`Error: File does not exist: ${input}`));
        process.exit(1);
      }

      const content = readFileSync(input, 'utf-8');

      if (options.fix) {
        const { content: fixed, result } = validateAndFix(content);

        console.log(chalk.blue('=== Validation & Fix Report ==='));
        console.log(getValidationReport(fixed));

        if (options.output) {
          writeFileSync(options.output, fixed);
          console.log(chalk.green(`\nFixed file saved to: ${options.output}`));
        } else {
          console.log(chalk.yellow('\nUse -o <path> to save the fixed output'));
        }
      } else {
        const report = getValidationReport(content);
        console.log(chalk.blue('=== Validation Report ==='));
        console.log(report);

        const result = validate(content);
        if (!result.isValid) {
          console.log(chalk.yellow('\nUse --fix to automatically fix issues'));
          process.exit(1);
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });

/**
 * Structure command - analyze document structure
 */
program
  .command('structure')
  .description('Analyze document structure')
  .argument('<input>', 'Input file to analyze')
  .action(async (input: string) => {
    try {
      if (!existsSync(input)) {
        console.error(chalk.red(`Error: File does not exist: ${input}`));
        process.exit(1);
      }

      const content = readFileSync(input, 'utf-8');
      const structure = analyzeDocument(content);

      console.log(chalk.blue('=== Document Structure ===\n'));

      if (structure.title) {
        console.log(chalk.cyan(`Title: ${structure.title}`));
      }
      if (structure.author) {
        console.log(chalk.cyan(`Author: ${structure.author}`));
      }

      console.log(chalk.cyan(`\nExisting Elements:`));
      console.log(`  Cover: ${structure.hasCover ? chalk.green('Yes') : chalk.yellow('No')}`);
      console.log(
        `  Inside Cover: ${structure.hasInsideCover ? chalk.green('Yes') : chalk.yellow('No')}`
      );
      console.log(`  TOC: ${structure.hasToc ? chalk.green('Yes') : chalk.yellow('No')}`);

      if (structure.parts.length > 0) {
        console.log(chalk.cyan(`\nParts (${structure.parts.length}):`));
        for (const part of structure.parts) {
          console.log(`  Part ${part.number}: ${part.title} (${part.chapters.length} chapters)`);
        }
      }

      if (structure.chapters.length > 0) {
        console.log(chalk.cyan(`\nChapters (${structure.chapters.length}):`));
        for (const chapter of structure.chapters) {
          const partInfo = chapter.partNumber ? ` [Part ${chapter.partNumber}]` : '';
          console.log(`  Chapter ${chapter.number}: ${chapter.title}${partInfo}`);
          if (chapter.sections.length > 0) {
            for (const section of chapter.sections.slice(0, 3)) {
              console.log(`    - ${section}`);
            }
            if (chapter.sections.length > 3) {
              console.log(`    ... and ${chapter.sections.length - 3} more`);
            }
          }
        }
      }

      if (structure.appendices.length > 0) {
        console.log(chalk.cyan(`\nAppendices (${structure.appendices.length}):`));
        for (const appendix of structure.appendices) {
          console.log(`  Appendix ${appendix.letter}: ${appendix.title}`);
        }
      }

      console.log(chalk.cyan(`\nEstimated Pages: ${structure.totalPages || 'Unknown'}`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });

/**
 * Monster command - generate a monster stat block
 */
program
  .command('monster')
  .description('Generate a monster stat block')
  .argument('<name>', 'Monster name')
  .option('--cr <cr>', 'Challenge rating')
  .option('--type <type>', 'Creature type (humanoid, undead, fiend, etc.)')
  .option('--size <size>', 'Size (tiny, small, medium, large, huge, gargantuan)')
  .option('--ac <ac>', 'Armor class')
  .option('--hp <hp>', 'Hit points')
  .option('--speed <speed>', 'Speed')
  .option('--str <str>', 'Strength score', '10')
  .option('--dex <dex>', 'Dexterity score', '10')
  .option('--con <con>', 'Constitution score', '10')
  .option('--int <int>', 'Intelligence score', '10')
  .option('--wis <wis>', 'Wisdom score', '10')
  .option('--cha <cha>', 'Charisma score', '10')
  .option('-c, --clipboard', 'Copy output to clipboard')
  .action(async (name: string, options) => {
    const result = generateMonster(name, {
      size: options.size || 'Medium',
      type: options.type || 'humanoid',
      alignment: 'neutral',
      ac: options.ac || '10',
      hp: options.hp || '10 (2d8+1)',
      speed: options.speed || '30 ft.',
      str: parseInt(options.str),
      dex: parseInt(options.dex),
      con: parseInt(options.con),
      int: parseInt(options.int),
      wis: parseInt(options.wis),
      cha: parseInt(options.cha),
    });

    if (options.clipboard) {
      const { default: clipboardy } = await import('clipboardy');
      await clipboardy.write(result);
      console.log(chalk.green('Monster stat block copied to clipboard'));
    } else {
      console.log(result);
    }
  });

/**
 * Item command - generate a magic item
 */
program
  .command('item')
  .description('Generate a magic item block')
  .argument('<name>', 'Item name')
  .option('--type <type>', 'Item type (weapon, armor, wondrous item, etc.)')
  .option('--rarity <rarity>', 'Rarity (common, uncommon, rare, very rare, legendary)')
  .option('--attunement', 'Requires attunement')
  .option('-d, --description <desc>', 'Item description')
  .option('-c, --clipboard', 'Copy output to clipboard')
  .action(async (name: string, options) => {
    const result = generateItem(name, {
      type: options.type,
      rarity: options.rarity || 'uncommon',
      attunement: options.attunement || false,
      description: options.description || 'A magical item with mysterious properties.',
    });

    if (options.clipboard) {
      const { default: clipboardy } = await import('clipboardy');
      await clipboardy.write(result);
      console.log(chalk.green('Magic item block copied to clipboard'));
    } else {
      console.log(result);
    }
  });

/**
 * Spell command - generate a spell block
 */
program
  .command('spell')
  .description('Generate a spell block')
  .argument('<name>', 'Spell name')
  .option('--level <level>', 'Spell level (0 for cantrip)', '1')
  .option('--school <school>', 'School of magic')
  .option('--time <time>', 'Casting time', '1 action')
  .option('--range <range>', 'Range', '60 feet')
  .option('--components <components>', 'Components', 'V, S')
  .option('--duration <duration>', 'Duration', 'Instantaneous')
  .option('-d, --description <desc>', 'Spell description')
  .option('-c, --clipboard', 'Copy output to clipboard')
  .action(async (name: string, options) => {
    const result = generateSpell(name, {
      level: parseInt(options.level),
      school: options.school || 'evocation',
      castingTime: options.time,
      range: options.range,
      components: options.components,
      duration: options.duration,
      description: options.description || 'The spell takes effect.',
    });

    if (options.clipboard) {
      const { default: clipboardy } = await import('clipboardy');
      await clipboardy.write(result);
      console.log(chalk.green('Spell block copied to clipboard'));
    } else {
      console.log(result);
    }
  });

/**
 * Convert result interface
 */
interface ConvertResult {
  content: string;
  validationReport?: string;
  pageCount?: number;
  avgFill?: number;
}

/**
 * Convert a single file (basic)
 */
function convertFile(filePath: string): string {
  const content = readFileSync(filePath, 'utf-8');
  const blocks = parseMarkdown(content);
  const { homebreweryMarkdown, warnings } = transform(blocks);

  if (warnings.length > 0) {
    console.error(chalk.yellow('Warnings:'));
    for (const warning of warnings) {
      console.error(chalk.yellow(`  - ${warning}`));
    }
  }

  return homebreweryMarkdown;
}

/**
 * Convert a single file with extended options
 */
function convertFileExtended(
  filePath: string,
  options: {
    validate?: boolean;
    autoFix?: boolean;
    cover?: boolean;
    toc?: boolean;
    partCovers?: boolean;
    dropCaps?: boolean;
    pageNumbers?: boolean;
    verbose?: boolean;
  }
): ConvertResult {
  const content = readFileSync(filePath, 'utf-8');
  const blocks = parseMarkdown(content);

  const result = transformExtended(blocks, {
    validate: options.validate || options.autoFix,
    autoFix: options.autoFix,
    generateCover: options.cover !== false,
    generateToc: options.toc,
    generatePartCovers: options.partCovers,
    dropCaps: options.dropCaps,
    pageNumbers: options.pageNumbers,
  });

  if (result.warnings.length > 0 && options.verbose) {
    console.error(chalk.yellow('Warnings:'));
    for (const warning of result.warnings) {
      console.error(chalk.yellow(`  - ${warning}`));
    }
  }

  return {
    content: result.homebreweryMarkdown,
    validationReport: result.validationReport,
    pageCount: result.pageCount,
    avgFill: result.avgFill,
  };
}

// Parse arguments and run
program.parse();
