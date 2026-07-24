# API & Client Methods Documentation

## Overview

All API operations in Song Packeter are client-side JavaScript functions exported by `src/api/client.js`. The app operates offline using IndexedDB, with optional Vercel KV (Upstash Redis) HTTP endpoints for online packet sharing.

---

## 1. Local Database & Matching Methods (`src/api/client.js`)

### `matchSongs(inputText, queries)`
- Runs client-side fuzzy search (`fuzzysort`) against the local IndexedDB `songs` store.
- Parses input line by line and returns ranked song candidates.

### `fetchVersions(songId)`
- Retrieves tune versions and default capos for a given song ID from IndexedDB.

### `syncSongbase()`
- Syncs the English song catalog from Songbase directly into IndexedDB.

### `generatePacketPdf(selections, maintainOriginalOrder, showSectionHeadersInBody, showSectionHeadersInIndex)`
- Typesets the setlist and returns a PDF byte array via `pdf-lib`.

### `optimizePacketOrder(selections, maintainOriginalOrder)`
- Runs the simulated annealing layout optimizer to minimize song page splits.

---

## 2. Vercel KV Online Storage Methods (`src/api/client.js`)

### `checkSlugAvailability(slug)`
- Queries Vercel KV via `GET /exists/packet:<slug>`.
- Returns `{ available: boolean, error: string|null }`.

### `savePacketOnline(slug, packetData)`
- Compresses packet JSON using lossless `LZString.compressToEncodedURIComponent()`.
- Uploads to Vercel KV via `GET /set/packet:<slug>/<compressed>/ex/47304000` (547.5-day / 18-month expiration).
- Returns `{ slug: string, shareUrl: string }`.

### `fetchPacketOnline(slug)`
- Downloads packet payload from Vercel KV via `GET /get/packet:<slug>`.
- Decompresses data losslessly via `LZString.decompressFromEncodedURIComponent()`.
- Sends background renewal request `GET /expire/packet:<slug>/47304000` to reset the 18-month timer upon UI view.
- Returns restored JSON packet object.

---

## 3. Vercel KV REST Endpoints Summary

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/exists/packet:<slug>` | `GET` | Check if URL slug is already taken in Redis |
| `/set/packet:<slug>/<data>/ex/47304000` | `GET` | Save packet with 18-month auto-expiration |
| `/get/packet:<slug>` | `GET` | Download packet payload |
| `/expire/packet:<slug>/47304000` | `GET` | Reset 18-month expiration timer upon UI visit |
