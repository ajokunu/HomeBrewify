# HomeBrewify V3 Compatibility Plan

## Overview

Comprehensive plan to align HomeBrewify output with Homebrewery V3 syntax, audit for security/quality, and generate test files that produce output indistinguishable from official WotC D&D 5e adventures.

---

## Phase 1: Fix Existing Transformers (High Priority)

### Fix 1: Spell Formatting — `::` definition list syntax
- **File:** `src/transformers/spell.ts` (lines 113-125)
- **Change:** `- **Casting Time:** value` → `**Casting Time** :: value`
- **Ripple effects:** None

### Fix 2: Magic Item Blocks — remove `{{item}}` wrapper
- **File:** `src/transformers/item.ts` (transformItem function)
- **Change:** Remove `{{item ... }}` wrapping. Use `#### Name` + `*metadata*` + `:` separator + description
- **Ripple effects:** `transformers/index.ts` postProcess, `pageBreakOptimizer.ts` dead code

### Fix 3: Cover Pages — `{{frontCover}}` + `{{logo}}` + `{{banner}}`
- **Files:** `src/transformers/cover.ts`, `src/structure/analyzer.ts`, `src/transformers/toc.ts`
- **Change:** `{{cover}}` → `{{frontCover}}`, remove `{{title-block,wide}}` and `{{dedication}}`, add `{{logo}}`, `{{banner}}`, `{{footnote}}`
- **Ripple effects:** Analyzer cover detection regex, TOC cover detection

### Fix 4: Monster Stat Blocks — `:` separators between sections
- **File:** `src/transformers/monster.ts`
- **Change:** Ensure `:` separator before `### Actions`, `### Reactions`, `### Legendary Actions`, `### Mythic Actions`
- **Ripple effects:** None (already mostly correct)

---

## Phase 2: Add New V3 Block Types (Medium Priority)

### Fix 5: Quote Blocks — `{{quote}}` + `{{attribution}}`
- **New file:** `src/transformers/quote.ts`
- **Modified:** `src/types.ts` (add Quote ContentType), `src/parser/detector.ts` (quote detection), `src/transformers/readAloud.ts` (distinguish quote vs descriptive), `src/transformers/index.ts`
- **Detection:** Blockquotes with `— Author` attribution lines become `{{quote}}`, others remain `{{descriptive}}`

### Fix 6: Spell List Block — `{{spellList,wide}}`
- **New file:** `src/transformers/spellList.ts`
- **Modified:** `src/types.ts`, `src/parser/detector.ts`, `src/transformers/index.ts`
- **Detection:** Content with 2+ level headers (Cantrips, 1st Level, etc.) and 3+ spell bullet items

### Fix 7: Back Cover — `{{backCover}}`
- **Modified:** `src/transformers/cover.ts` (add generateBackCover), `src/types.ts` (BackCoverData), `src/structure/generator.ts`, `src/transformers/index.ts`

### Fix 8: Watercolor Decorations — `{{watercolor1-12}}`
- **New file:** `src/transformers/watercolor.ts`
- **Modified:** `src/structure/generator.ts`, `src/types.ts` (watercolor config)
- **Behavior:** Inject at page boundaries based on frequency config

### Fix 9: Artist Credit Blocks — `{{artist}}`
- **New file:** `src/transformers/artist.ts`
- **Modified:** `src/types.ts`, `src/parser/detector.ts`, `src/transformers/index.ts`

---

## Phase 3: Fix Infrastructure (Medium Priority)

### Fix 10: Auto Page Numbers — `{{pageNumber,auto}}`
- **File:** `src/structure/generator.ts` (addSimplePageNumbers)
- **Change:** `{{pageNumber ${i + 1}}}` → `{{pageNumber,auto}}`, skip cover/part pages

### Fix 11: Image Masks for Covers
- **File:** `src/transformers/cover.ts`
- **Change:** Wrap cover images in `{{imageMaskCenter}}` (inside cover) and `{{imageMaskEdge}}` (part covers)

### Fix 12: TOC Filtering — `--TOC:exclude`
- **File:** `src/transformers/monster.ts`
- **Change:** Add `{--TOC:exclude}` to `### Actions`, `### Reactions`, `### Legendary Actions`, `### Mythic Actions`, `##### Lair Actions`, `##### Regional Effects`
- **Also:** `src/structure/analyzer.ts` — add `Mythic` to filter list

### Fix 13: Validator Updates — V3 block type registry
- **File:** `src/validator/blockMatcher.ts`
- **Change:** Add complete V3 block type registry, warn on unknown types, handle inline blocks, check imageMask nesting
- **Also:** `src/types.ts` — add `'unknown_block'` to ValidationWarning type union

---

## Phase 4: Security Audit

- Path traversal in file reading (index.ts readFileSync)
- Command injection in CLI argument handling
- Regex DoS (ReDoS) in pattern matching
- Prototype pollution in metadata parsing
- Unsafe clipboard access patterns

---

## Phase 5: Code Quality & Performance Audit

- Regex compilation (move regex to module-level constants)
- Unnecessary string allocations in transformation loops
- Type safety gaps (any types, missing null checks)
- Dead code removal (old {{item}} references)
- Consistent error handling

---

## Phase 6: Test File Generation

Generate complete test markdown files covering:
1. **Complete adventure** — cover, TOC, chapters, monsters, items, spells, NPCs, locations, read-aloud, DM notes, tables
2. **Monster compendium** — multiple stat blocks of varying complexity
3. **Magic item catalog** — items of all rarities with charges, attunement
4. **Spell reference** — individual spells and spell lists
5. **Edge cases** — nested blocks, long descriptions, tables inside notes

Verify each produces pixel-perfect WotC-style output when pasted into Homebrewery.

---

## Implementation Order

1. Fix 1 (Spell) → Fix 2 (Item) → Fix 4 (Monster) → Fix 10 (Page numbers)
2. Fix 12 (TOC filtering) → Fix 3 (Covers) → Fix 11 (Image masks) → Fix 7 (Back cover)
3. Fix 5 (Quotes) → Fix 6 (Spell lists) → Fix 9 (Artist) → Fix 8 (Watercolors)
4. Fix 13 (Validator) — must be last
5. Security audit → Code quality audit → Test files
