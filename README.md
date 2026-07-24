# Song Packeter

Song Packeter is a fully client-side web application for building beautifully formatted, printable PDF song packets from Songbase data.

## Stack

- Frontend: React + Vite + Material UI
- Local Database: IndexedDB (`idb`)
- Search: `fuzzysort`
- PDF Rendering: `pdf-lib`

## What It Does

- **100% Offline Capable**: Runs completely in the browser with no backend required.
- **Library Syncing**: Caches English songs directly from the Songbase API into your browser's IndexedDB.
- **Lighting Fast Search**: Matches user input (titles or lyric fragments) to songs instantly using client-side fuzzy search.
- **Packet Management**: Saves your working song packets and edit history to IndexedDB so you never lose your progress.
- **Advanced PDF Layout**: Uses a custom, reverse-engineered typesetting engine (built natively on top of `pdf-lib`) to calculate perfect formatting and chord-lyric alignment.
- **Simulated Annealing Optimizer**: Automatically shuffles the order of your packet to minimize the number of times a song spills across multiple pages or columns.

## Quick Start

```bash
cd frontend
npm install
npm run dev
```

Visit: `http://localhost:5173`

*(Note: On your first visit, click "Sync Library" in the top bar to pull down the Songbase catalog into your browser cache)*

## Documentation

Comprehensive project documentation and developer reference guides are located in the [`docs/`](docs/README.md) directory:

- **[Architecture & Developer Guide for AI Agents](docs/ARCHITECTURE_FOR_AGENTS.md)**: Deep technical overview of the system architecture, state machines, PDF engine, presentation multi-column layout auto-sizer, Vercel KV online storage, and AI coding guidelines.
- **[Documentation Hub](docs/README.md)**: Index of all documentation guides (Frontend, API, Optimization, UI Workflow).

## Tests

The custom PDF typesetting algorithms (chord alignment, word wrapping, layout boundaries, presentation auto-sizing, and layout optimizer) are fully tested in JavaScript.

```bash
cd frontend
npm run test
```

