# Architecture & Developer Guide for AI Agents

Welcome! This document provides a comprehensive overview of the **Song Packeter** codebase, its data flow, component boundaries, PDF typesetting engine, presentation mode algorithms, and storage layers. Refer to this guide when making modifications or adding new features.

---

## 1. System Overview & Technology Stack

Song Packeter is a **100% client-side web application** built to create, edit, optimize, and present printable PDF song packets.

- **Frontend Framework**: React 19 + Vite + Material UI (MUI v7)
- **Local Storage**: IndexedDB (`idb` v8) for storing offline master song catalog, packets, and version history.
- **Client-Side Search**: `fuzzysort` (v3) for instant client-side matching of titles & lyrics.
- **PDF Engine**: Native JavaScript typesetting engine built on top of `pdf-lib` + `fontkit`.
- **Online Storage & Sharing**: Vercel KV (Upstash Redis) HTTP REST API + `lz-string` for lossless packet compression and 1-year auto-expiring share URLs.
- **Presentation Mode**: Responsive multi-column layout engine with DOM-measured auto-sizing, column balancing, and quality scoring.

---

## 2. Directory Structure & Key Components

```
frontend/
├── src/
│   ├── App.jsx                     # Top-level state machine, navigation & route sync
│   ├── main.jsx                    # Application entrypoint & MUI ThemeProvider
│   ├── api/
│   │   └── client.js               # Client API wrapper (IndexedDB, PDF engine & Vercel KV)
│   ├── db/
│   │   ├── store.js                # IndexedDB schema initialization & connection
│   │   ├── songs.js                # Songbase library sync & client-side fuzzy matching
│   │   └── packets.js              # Local packet CRUD, versioning & version history
│   ├── pdf/
│   │   ├── engine.js               # Main PDF generator coordinating pages, layout & header/footer
│   │   ├── layout.js               # Baseline layout boundaries & vertical positioning
│   │   ├── wrapping.js             # Word wrapping & chord-lyric column alignment
│   │   ├── chordpro.js             # ChordPro markup parser for PDF typesetting
│   │   └── optimizer.js            # Simulated annealing layout optimizer (minimizes page splits)
│   ├── presentation/
│   │   ├── PresentationMode.jsx    # Fullscreen presentation overlay, preset themes & controls
│   │   ├── PresentationSlide.jsx   # Slide renderer & Full Song multi-column auto-sizer
│   │   ├── PresentationHome.jsx    # Presentation song launcher & setlist list
│   │   └── chordproParser.js       # Presentation ChordPro parser & chorus repetition logic
│   └── components/
│       ├── InputStep.jsx           # Step 1: Multiline song input & packet creator
│       ├── ReviewStep.jsx          # Step 2: Song selection, capo, transposition & chordpro editor
│       ├── GenerateStep.jsx        # Step 3: Manual drag-and-drop reordering & page-break controls
│       ├── PdfPreviewSidebar.jsx   # Real-time PDF preview sidebar
│       └── SectionManagerDialog.jsx# Setlist section header & flow break manager
└── docs/                           # Project documentation folder
```

---

## 3. Core Data Flow & State Machine

### Step 1: Input & Matching (`InputStep.jsx`)
- User inputs raw song titles or lyric lines (one per line).
- `matchSongs(inputText)` runs `fuzzysort` against the local IndexedDB catalog (`songs` store).
- Resolves candidates for each input line, auto-deduplicating resolved song IDs.

### Step 2: Refine & Edit (`ReviewStep.jsx`)
- User selects specific song versions, sets capo/transposition, or edits custom ChordPro text overrides.
- Custom setlist sections ("Worship Flow Headers") can be inserted between songs.

### Step 3: Layout & Optimization (`GenerateStep.jsx`)
- `optimizePacketOrder(selections)` runs simulated annealing to arrange songs into the most space-efficient page layout.
- Users can manually drag-and-drop reorder songs, insert manual page breaks, or force section starts.

---

## 4. PDF Typesetting Engine (`src/pdf/`)

The PDF engine replaces server-side generation with pixel-perfect client-side rendering using `pdf-lib`:

1. **`wrapping.js`**: Calculates exact text metrics for monospace/proportional fonts. Aligns chord placements above lyrics without breaking word boundaries.
2. **`chordpro.js`**: Parses inline ChordPro bracket notation (`[C]Amazing [G]grace`).
3. **`optimizer.js`**: Evaluates layout cost functions (penalizing song page splits, unnecessary blank space, and index overflow) using simulated annealing.
4. **`engine.js`**: Renders headers, page numbers, dynamic index table of contents, and final byte array.

---

## 5. Presentation Mode & Full Song Auto-Sizing (`src/presentation/`)

### Full Song Multi-Column Algorithm (`PresentationSlide.jsx`)
When the user switches to **Full Song** mode:
1. **Candidate Evaluation**: Determines `maxCandidateCols` based on screen width (`(containerWidth + 40) / 200`, capped at 5 columns).
2. **Binary Font Search**: For each column count `c = 1..maxCandidateCols`, finds the maximum font size `bestForC` fitting `el.scrollWidth` and `el.scrollHeight`.
3. **Quality Scoring**: Evaluates candidate font sizes within 20% of `absoluteMaxFont` using the scoring formula:
   ```js
   qualityScore = fontSize + columnBonus - (lineWraps * 2.0) - (blockSplits * 1.0)
   ```
   - **`columnBonus`**: `(cols - 1) * 3.0` pt (rewards multi-column utilization of horizontal screen space).
   - **`lineWraps`**: Penalizes wrapped lyric lines.
   - **`blockSplits`**: Applies a light 1.0 pt penalty when verse/chorus blocks flow across column boundaries.
4. **DOM Resize Handling**: Uses `ResizeObserver` (guarded by `typeof ResizeObserver !== 'undefined'`) and `document.fonts.ready` to trigger automatic re-layout during window resize or display changes (e.g. connecting a projector).

---

## 6. Online Packet Storage & Expiration (`Vercel KV`)

Packets can be saved online without a custom backend server:

- **Storage Engine**: Vercel KV (Upstash Redis) HTTP REST API.
- **Compression**: `lz-string` (`LZString.compressToEncodedURIComponent`). Compression is **100% byte-for-byte lossless**, guaranteeing perfect restoration of chords, lyrics, and metadata.
- **18-Month Auto-Expiration**: Packets are saved with `EX 47304000` (18 months / 547.5 days in seconds).
- **Automatic Renewal on UI View**: Navigating to `/#/p/:slug` fetches the packet via `GET /get/packet:<slug>` and fires a background `EXPIRE packet:<slug> 47304000` request to automatically reset the 18-month timer from the date of the user's visit.
- **URL Slug Validation & Availability**: `checkSlugAvailability(slug)` calls Redis `EXISTS packet:<slug>` to provide real-time validation in the Save UI before committing.

---

## 7. AI Agent Guidelines & Rules

When modifying code in this project, AI agents must adhere to the following rules:

1. **Dev Server Check**: After completing code changes, verify that `npm run build` succeeds and check if `npm run dev` is running. Explicitly report dev server status in the final summary.
2. **Preserve Multi-Column Presentation Logic**: Do not increase `blockSplits` penalty in `PresentationSlide.jsx` above 1.5pt; doing so causes single-column layouts to artificially win over multi-column layouts on projector screens.
3. **Lossless Storage Contracts**: Always ensure packet serialization uses lossless transformations (`JSON.stringify` / `LZString`).
4. **Testing**: Run `npm test -- --run` before declaring work complete. All unit tests in `src/` must pass.
5. **No Automatic Pushing/Deploying**: Keep all changes local until explicitly instructed to push to GitHub or deploy to Vercel.
