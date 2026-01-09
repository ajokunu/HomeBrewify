# Homebrewify - Campaign to Homebrewery Generator

**Design Document**

A CLI tool that converts D&D campaign markdown to Homebrewery-formatted content for professional book publishing.

---

## Problem Statement

Campaign content exists in various markdown formats (Capacities, Obsidian, raw files) but needs conversion to professional D&D book format using Homebrewery.

**Challenges:**
- Homebrewery uses special markdown syntax (`\page`, `\column`, `{{monster}}`)
- Manual conversion is tedious and error-prone
- D&D content has specific formatting needs (stat blocks, items, locations)
- Capacities API can't read content directly

---

## Solution: homebrewify CLI

A TypeScript CLI tool that:
1. Reads campaign markdown from any source
2. Detects content types automatically (monsters, NPCs, locations, items)
3. Applies appropriate Homebrewery templates
4. Outputs ready-to-paste formatted content

---

## Input Sources Supported

1. **Capacities Export** - Manual export from Capacities
2. **Obsidian Vault** - Markdown files with wikilinks and frontmatter
3. **Raw Markdown** - Any .md files
4. **Directory** - Batch process entire folders

---

## Homebrewery Syntax Reference

### Page Layout
- `\page` - Page break
- `\column` - Column break (PHB uses 2-column layout)

### Content Blocks
- `{{monster,frame}}` - Monster stat blocks
- `{{descriptive}}` - Read-aloud text boxes (tan background)
- `{{note}}` - DM note boxes (green background)
- `{{classTable,frame}}` - Class feature tables
- `{{wide}}` - Full-width content spanning both columns

### Styling
- `{{dropcap}}` - Decorative first letter
- `:::` - Custom div blocks
- `::` - Definition syntax for stat lines
- Image positioning classes

---

## Content Types to Transform

| Type | Detection Pattern | Homebrewery Template |
|------|-------------------|---------------------|
| Episodes/Chapters | "Episode X:", "Chapter X:" | Page header + dropcap |
| Locations | "Location:", "Town of", "City of" | Wide header + description |
| NPCs | "NPC:", stat patterns | Simple stat block |
| Monsters | HP, AC, ability scores | Full monster block |
| Magic Items | Rarity, attunement | Item description box |
| Read-Aloud | Blockquotes (>), "Read aloud:" | Descriptive box |
| DM Notes | "DM Note:", "Secret:" | Note box |
| Tables | Markdown tables | Styled PHB tables |

---

## Project Architecture

```
homebrewify/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── parser/
│   │   ├── index.ts          # Parser orchestration
│   │   ├── markdown.ts       # Base markdown parser
│   │   ├── obsidian.ts       # Obsidian format (wikilinks, frontmatter)
│   │   └── detector.ts       # Auto-detect input format
│   ├── transformers/
│   │   ├── index.ts          # Transformer orchestration
│   │   ├── chapter.ts        # Episode/chapter formatting
│   │   ├── location.ts       # Location descriptions
│   │   ├── monster.ts        # Monster stat blocks
│   │   ├── npc.ts            # NPC stat blocks
│   │   ├── item.ts           # Magic items
│   │   ├── spell.ts          # Spell blocks
│   │   ├── table.ts          # Table formatting
│   │   └── image.ts          # Image positioning
│   ├── templates/
│   │   ├── phb.ts            # Player's Handbook style
│   │   ├── dmg.ts            # Dungeon Master's Guide style
│   │   └── custom.ts         # Custom templates
│   ├── output/
│   │   ├── writer.ts         # Write output files
│   │   └── clipboard.ts      # Copy to clipboard
│   └── utils/
│       ├── frontmatter.ts    # Parse YAML frontmatter
│       └── formatting.ts     # Text formatting utilities
├── templates/
│   └── *.hb.md               # Homebrewery template snippets
├── package.json
├── tsconfig.json
└── homebrewify.config.yaml   # Default configuration
```

---

## CLI Interface

```bash
# Basic usage - convert directory
homebrewify convert ./campaign-notes -o ./output

# Single file conversion
homebrewify convert ./episode-1.md -o ./episode-1-hb.md

# Specify input format explicitly
homebrewify convert ./notes --format obsidian -o ./output

# Choose template style
homebrewify convert ./campaign --template phb -o ./output

# Generate table of contents
homebrewify toc ./output -o ./toc.md

# Generate individual elements
homebrewify monster "Shadow Duplicate" --cr 1 --type undead
homebrewify item "Fracture Shard" --rarity legendary --attunement
homebrewify spell "Frostbite" --level 2 --school evocation
homebrewify npc "Deputy Shafor" --role "Town Lawkeeper"

# Copy output to clipboard
homebrewify convert ./episode-1.md --clipboard

# Watch mode for live editing
homebrewify watch ./campaign-notes -o ./output
```

---

## Example Transformation

### Input (Raw Markdown):

```markdown
# Episode 1: The Duplicates

## Location: Bellfairen

A small mining town nestled in the foothills of the Blackcap Mountains.

### The Chateau de Le Brulure

> Read aloud: The ancient chateau looms before you, its weathered
> stones telling tales of centuries past. Ivy creeps up the walls
> like grasping fingers reaching for the moonlit sky.

**Key NPCs:**
- Deputy Shafor - Town lawkeeper, gruff but fair
- Sheriff Aurto - Missing for 3 days

### Monster: Shadow Duplicate
Medium undead, chaotic evil
AC: 13
HP: 22 (4d8+4)
Speed: 30 ft.

STR 10 (+0) | DEX 14 (+2) | CON 12 (+1) | INT 8 (-1) | WIS 10 (+0) | CHA 6 (-2)

**Shadow Step.** The duplicate can teleport up to 30 feet to an unoccupied
space it can see that is in dim light or darkness.

**Mimic Form.** The duplicate can perfectly replicate the appearance of
any humanoid it has seen.
```

### Output (Homebrewery Markdown):

```markdown
\page

# Episode 1: The Duplicates

{{wide
## Bellfairen
*A small mining town nestled in the foothills of the Blackcap Mountains.*
}}

\column

### The Chateau de Le Brulure

{{descriptive
The ancient chateau looms before you, its weathered stones telling tales
of centuries past. Ivy creeps up the walls like grasping fingers reaching
for the moonlit sky.
}}

#### Key NPCs
- **Deputy Shafor** - Town lawkeeper, gruff but fair
- **Sheriff Aurto** - Missing for 3 days

\column

{{monster,frame
## Shadow Duplicate
*Medium undead, chaotic evil*
___
**Armor Class** :: 13
**Hit Points** :: 22 (4d8+4)
**Speed** :: 30 ft.
___
|STR|DEX|CON|INT|WIS|CHA|
|:---:|:---:|:---:|:---:|:---:|:---:|
|10 (+0)|14 (+2)|12 (+1)|8 (-1)|10 (+0)|6 (-2)|
___
***Shadow Step.*** The duplicate can teleport up to 30 feet to an
unoccupied space it can see that is in dim light or darkness.
:
***Mimic Form.*** The duplicate can perfectly replicate the appearance
of any humanoid it has seen.
}}
```

---

## Smart Content Detection

The tool uses pattern matching to automatically detect content types:

### Monster Detection
- Contains "AC" and "HP" (or "Armor Class" and "Hit Points")
- Has ability score block (STR, DEX, CON, INT, WIS, CHA)
- Includes creature type keywords (humanoid, undead, fiend, beast, etc.)
- Has Challenge Rating (CR) indicator

### Magic Item Detection
- Contains rarity keywords (common, uncommon, rare, very rare, legendary)
- Has "requires attunement" text
- Item type indicators (weapon, armor, wondrous item, ring, etc.)

### Read-Aloud Detection
- Blockquotes (> prefix)
- "Read aloud:" prefix
- Italic descriptive paragraphs starting with sensory words

### Location Detection
- "Location:" header prefix
- "Town of", "City of", "The [Place]" patterns
- Geographic description keywords

### NPC Detection
- "NPC:" prefix
- Character name followed by role/description
- Stat patterns without full monster block

---

## Configuration File

```yaml
# homebrewify.config.yaml

# Template style
template: phb   # phb, dmg, or custom

# Page layout
columns: 2
pageSize: letter  # letter, a4

# Content type patterns (extend defaults)
contentTypes:
  episode:
    patterns:
      - "Episode *:"
      - "Chapter *:"
      - "Part *:"
    template: chapter-header

  npc:
    patterns:
      - "NPC:"
      - "Character:"
    template: npc-simple

  monster:
    patterns:
      - "Monster:"
      - "Creature:"
      - "Enemy:"
    template: monster-full

  location:
    patterns:
      - "Location:"
      - "Town of *"
      - "City of *"
    template: location-wide

  item:
    patterns:
      - "Magic Item:"
      - "Item:"
    template: magic-item

# Output options
output:
  splitPages: true      # Create separate files per \page
  tocDepth: 3           # Table of contents depth
  preserveComments: false

# Image handling
images:
  basePath: ./images
  positioning: auto     # auto, left, right, center
```

---

## Dependencies

```json
{
  "name": "homebrewify",
  "version": "1.0.0",
  "bin": {
    "homebrewify": "./dist/index.js"
  },
  "dependencies": {
    "commander": "^11.0.0",      // CLI framework
    "gray-matter": "^4.0.3",     // Frontmatter parsing
    "marked": "^11.0.0",         // Markdown parsing
    "glob": "^10.0.0",           // File globbing
    "chalk": "^5.0.0",           // CLI colors
    "clipboardy": "^4.0.0",      // Clipboard access
    "chokidar": "^3.5.0",        // File watching
    "yaml": "^2.3.0"             // Config parsing
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
```

---

## Development Phases

### Phase 1: Core Parser (Week 1)
- [ ] Project setup (TypeScript, ESLint, build)
- [ ] Markdown file reading
- [ ] Content type detection engine
- [ ] Basic transformation pipeline

### Phase 2: Templates (Week 2)
- [ ] Monster stat block transformer
- [ ] Magic item formatter
- [ ] Read-aloud/descriptive boxes
- [ ] Location headers
- [ ] NPC blocks

### Phase 3: CLI Interface (Week 3)
- [ ] File/directory input handling
- [ ] Output options (file, clipboard, stdout)
- [ ] Configuration file support
- [ ] Help documentation

### Phase 4: Advanced Features (Week 4)
- [ ] Image handling and positioning
- [ ] Cross-reference linking
- [ ] Table of contents generation
- [ ] Page count estimation
- [ ] Watch mode for live editing

### Phase 5: Polish (Week 5)
- [ ] Error handling and validation
- [ ] Progress indicators
- [ ] Test suite
- [ ] Documentation

---

## Optional: MCP Server Extension

Could expose as MCP tools for AI-assisted conversion:

```typescript
// Tools available:
{
  name: "homebrewify_convert",
  description: "Convert markdown content to Homebrewery format",
  inputSchema: {
    content: "string",      // Raw markdown
    format: "string",       // obsidian, capacities, raw
    template: "string"      // phb, dmg
  }
}

{
  name: "homebrewify_monster",
  description: "Generate a monster stat block",
  inputSchema: {
    name: "string",
    cr: "number",
    type: "string",
    size: "string",
    abilities: "object"
  }
}

{
  name: "homebrewify_item",
  description: "Generate a magic item block",
  inputSchema: {
    name: "string",
    rarity: "string",
    type: "string",
    attunement: "boolean",
    description: "string"
  }
}
```

---

## Shards of Risia Use Case

For the Shards of Risia campaign:

### Workflow
1. Export all Shards of Risia content from Capacities (manual)
2. Place exported markdown in a directory
3. Run homebrewify on the exported content
4. Copy output to Homebrewery
5. Generate PDF

### Expected Output Structure
```
output/
├── 00-toc.md                    # Table of contents
├── 01-episode-1-duplicates.md   # Episode 1
├── 02-episode-2-murderous-ride.md
├── 03-episode-3-towers.md
├── 04-episode-4-heading-north.md
├── appendix-a-npcs.md           # All NPCs
├── appendix-b-monsters.md       # All creatures
├── appendix-c-items.md          # Magic items
└── appendix-d-locations.md      # Location reference
```

### Content Mapping
- Episode chapters with proper headers and dropcaps
- Location descriptions with wide formatting
- Monster stat blocks for: Shadow Duplicates, Mournland creatures
- Magic item cards for: Fracture Shard, Transmutation Collider, Crystals of Risia
- NPC reference sheets organized by episode

---

## Next Steps

1. **Create project skeleton** - npm init, TypeScript setup
2. **Implement core parser** - Read markdown, detect sections
3. **Build monster transformer** - Most complex template
4. **Add CLI interface** - commander setup
5. **Test with Shards of Risia** - Real-world validation

---

## Notes

### Why TypeScript?
- Consistent with CapacitiesMCP codebase
- Strong typing for complex transformations
- Good CLI tooling support

### Why CLI First?
- Simpler architecture
- Works with any content source
- Can be integrated into workflows
- MCP extension is optional add-on

### Homebrewery Limitations
- Browser-based, no API
- Must paste content manually
- PDF generation through browser print

---

*Design Document - January 2026*
*For: Shards of Risia Campaign Book Project*
