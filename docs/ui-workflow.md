# UI and User Workflow

## Workflow Stages

## 1. Input

- User pastes one song per line (title or lyric fragment).
- User clicks `Match Songs`.
- Backend returns top match + candidate list for each row.

## 2. Refine

Two-column refinement UI:

- Left side (`55%`): editable cards for each input.
- Right side (`45%`): song navigation list; clicking a row scrolls that card into centered view.

Per-song controls:

- Matched song dropdown (up to 10 candidates)
- Song title override field
- Tune/version dropdown (disabled if no alternates)
- Capo numeric spinner (min 0)
- Reset body override button
- Expand/collapse multiline chord/lyric editor

Feedback loops:

- If unmatched songs exist, warning banner shown and generation is blocked.
- When all rows are matched, duplicate songs are auto-removed (first occurrence kept) and info banner shown.

## 3. Generate

- Top-level toggle: `Maintain original order`.
- `Generate PDF` runs order optimization (unless toggle is on) and downloads PDF.
- Stats badges shown after each generation:
  - `Pages`
  - `Song spills`

Manual generation sub-step:

- Editable ordered card list from optimized output.
- Drag/drop to reorder songs.
- `Force new page` per song.
- `Re-generate PDF` uses manual order and flags.

## PDF Output Behavior

- First page: song index (single-column full width).
- Song pages: two-column layout.
- Song header: `Song N` title line.
- `Capo X` shown below title only when capo > 0.
- Chords rendered above lyrics.
- Bottom-centered song-page marker: `S1`, `S2`, ...
