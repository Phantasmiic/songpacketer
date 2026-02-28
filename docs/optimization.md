# PDF Optimization Algorithm

## Goals

Current objective priority (lexicographic):

1. `song_page_spill`
2. `pages`
3. `stanza_page_spill`
4. `stanza_col_spill`

## Metric Definitions

- `pages`: number of song pages (excluding index page).
- `song_page_spill`: count of songs rendered across more than one page.
- `stanza_page_spill`: count of stanza row-overflow transitions that cross a page boundary.
- `stanza_col_spill`: count of stanza row-overflow transitions that cross a column boundary on same page.

## Candidate Order Generation

From `backend/songs/pdf.py`:

- Build prepared song layouts (`_prepare_song_layout`) with wrapped rows and stanza blocks.
- Seed pool includes:
  - descending-height baseline
  - original input order baseline
  - 10 fully random seeds
  - 25 structured seeds where long songs (`> 2 columns`) are prioritized near fresh page starts and long-song order is randomized.

## Local Search Refinement

- For top-scoring seeds, run iterative swap search.
- Swap strategy mix:
  - ~70% adjacent swaps
  - ~30% long-range swaps
- Keep candidate only if objective tuple improves.

## Hard/Soft Behaviors During Layout

- Harder behavior: stanza blocks are kept together if they can fit in a fresh column.
- Soft behavior: songs may split if necessary.
- PDF must always generate.

## Maintain Original Order Toggle

- `maintain_original_order = true`
  - Bypasses optimizer and preserves incoming order.
- `maintain_original_order = false`
  - Uses optimizer output order.

## Manual Post-Optimization Overrides

After auto-optimization, user can:

- drag and reorder songs manually
- set per-song `force_new_page`
- regenerate PDF from the edited order

This provides deterministic human override on top of heuristic ordering.
