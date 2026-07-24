# PDF Engine & Typesetting Guidelines for AI Agents

## Overview
This directory contains the custom client-side PDF typesetting engine built on top of `pdf-lib` and `fontkit`.

## Key Rules & Constraints
1. **Chord-Lyric Alignment (`wrapping.js`)**:
   - Never break chord-lyric column alignment. Chords above words must maintain proportional spacing relative to the underlying lyric character offsets.
2. **Layout Boundaries (`layout.js`)**:
   - Page margins, header heights, index table positions, and footer boundaries must fit strictly within standard US Letter dimensions (612 x 792 points).
3. **Simulated Annealing Layout Optimizer (`optimizer.js`)**:
   - Cost function weights penalize song page breaks, blank overflow pages, and index overflow. Always verify optimizer cost calculations when modifying song page assignment logic.
4. **Verification**:
   - Run `npm test` after modifying any file in `src/pdf/`. Ensure all tests in `src/pdf/__tests__/` pass with 0 regressions.
5. **Documentation**:
   - If modifying layout heuristics or font metric options, update `docs/optimization.md` and `docs/ARCHITECTURE_FOR_AGENTS.md`.
