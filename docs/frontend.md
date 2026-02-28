# Frontend Documentation

## Overview

Frontend is a React (Vite) app using Material UI. It drives a 3-step workflow:

1. Input
2. Refine
3. Generate

Main app file: `frontend/src/App.jsx`.

## Key Files

- `frontend/src/App.jsx`: state machine for full workflow.
- `frontend/src/api/client.js`: API client wrappers.
- `frontend/src/components/InputStep.jsx`: multiline input editor.
- `frontend/src/components/ReviewStep.jsx`: matching refinement UI.
- `frontend/src/components/GenerateStep.jsx`: generate/manual ordering UI.

## Core State in App

- `inputText`: raw multiline song input.
- `matches`: normalized rows with candidates + selected version/capo/overrides.
- `step`: current UI stage.
- `maintainOriginalOrder`: PDF formatting toggle.
- `manualOrderCards`: optimizer output promoted to editable drag/drop list.
- `packetStats`: generation stats from response headers.

## Flow

- `handleMatch()`
  - Calls `POST /songs/match`.
  - Hydrates each selected row with versions via `GET /songs/{id}/versions`.
  - Auto-deduplicates duplicate resolved song IDs once all rows are matched.

- `handleSelectionChange()`
  - Updates selected song, version, capo, title, or body override.
  - Refreshes dependent version/chordpro defaults when song/version changes.

- `handleGeneratePdf()`
  - Sends current selections to `POST /packet/optimize-order`.
  - Builds manual order cards from returned order.
  - Sends ordered selections to `POST /packet/generate`.
  - Downloads returned blob and stores stats badge data.

- `handleRegenerateFromManualOrder()`
  - Uses user-edited drag/drop order + force-new-page flags.
  - Re-generates PDF from that explicit order.

## Manual Generation Controls

- Drag cards to reorder.
- `Force new page` toggle per card.
- Badge on each card shows generated baseline order number.
- `Re-generate PDF` uses current manual arrangement.

## Styling Notes

- Sticky top navigation in App.
- Refine step is split layout (`55% / 45%`) with right-side song navigation.
- Song editor defaults to 10 visible lines with expand/collapse toggle.
