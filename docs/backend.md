# Backend Architecture & Storage Guide

## Overview

Song Packeter is **100% client-side**. The legacy Django backend and PostgreSQL database were completely replaced with browser-native processing (IndexedDB + `pdf-lib` + `fuzzysort`) and Vercel KV serverless cloud storage.

No local servers, Docker containers, or Python runtimes are required to run or develop Song Packeter.

---

## Storage Layers

### 1. Browser Local Storage (IndexedDB via `idb`)
All primary offline application data is stored locally in the user's browser using IndexedDB:

- **`songs` store**: English song catalog cached directly from the Songbase API.
- **`packets` store**: Active user song packets, selections, matching state, and custom ChordPro overrides.
- **`packet_versions` & `packet_history`**: Complete versioning snapshot history for every packet.

### 2. Vercel KV (Upstash Redis HTTP REST API)
Shared online packets are hosted using Vercel KV without requiring a custom backend server:

- **Direct Browser REST API**: React app communicates directly with Vercel KV via `fetch()`.
- **Lossless LZ-String Compression**: Packets are compressed with `lz-string` before saving (`LZString.compressToEncodedURIComponent`).
- **18-Month Auto-Expiration**: Saved packets use native Redis TTL (`EX 47304000`). If a packet is not accessed for 18 full months, Redis automatically deletes it.
- **Expiration Renewal on Access**: Opening a packet URL (`/#/p/:slug`) automatically fetches the packet and fires a background `EXPIRE packet:<slug> 47304000` request, renewing the 18-month timer from the date of the visit.

---

## Songbase Proxy

Songbase catalog sync requests are proxied seamlessly via Vercel Edge proxies (`vercel.json` rewrites) to bypass browser CORS restrictions while maintaining zero backend infrastructure.
