# Presentation Mode Guidelines for AI Agents

## Overview
This directory houses Presentation Mode (`PresentationMode.jsx`), Full Song Multi-Column Auto-Sizing (`PresentationSlide.jsx`), Setlist Launcher (`PresentationHome.jsx`), and ChordPro sequence parser (`chordproParser.js`).

## Key Rules & Constraints
1. **Multi-Column Auto-Sizing Quality Scoring (`PresentationSlide.jsx`)**:
   - `qualityScore = fontSize + columnBonus - (lineWraps * 2.0) - (blockSplits * 1.0)`.
   - **`columnBonus`**: `(cols - 1) * 3.0` pt.
   - Do NOT increase `blockSplits` penalty above 1.5pt; doing so causes single-column layouts to artificially win over multi-column layouts on projector screens (1024x768 / 1280x720).
2. **Column Width Calculation**:
   - `maxCandidateCols` is calculated as `Math.min(5, Math.max(1, Math.floor((containerWidth + 40) / 200)))`. Do not increase the 200px column threshold without testing projector aspect ratios.
3. **Resize Observer Safety**:
   - Always guard `ResizeObserver` with `typeof ResizeObserver !== 'undefined'` to avoid reference errors during jsdom/Vitest execution.
4. **Browser Subagent Controls**:
   - Top-bar controls fade out when mouse movement stops. For subagent testing, append `?alwaysShowControls=true` to the presentation URL.
5. **Verification**:
   - Run `npm test` after modifying presentation mode files. Ensure `PresentationSlide.test.jsx`, `FullscreenButton.test.jsx`, and `chordproParser.test.js` pass cleanly.
