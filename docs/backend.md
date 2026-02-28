# Backend Documentation

## Overview

Backend is Django + DRF with a `songs` app handling:

- Songbase sync/import
- Matching/search
- Song version retrieval
- Packet preview and final PDF generation
- Optimized order computation

## Key Modules

- `backend/songs/models.py`
  - `Song`: canonical song entry + metadata + raw source + parsed metadata AST.
  - `SongVersion`: tune/version rows with default capo + chordpro text.

- `backend/songs/imports.py`
  - Sync logic for pulling English Songbase data into Postgres.

- `backend/songs/services.py`
  - Query splitting and fuzzy candidate lookup.

- `backend/songs/views.py`
  - DRF endpoints for matching, sync, source sample, versions, preview, optimize-order, generate.

- `backend/songs/pdf.py`
  - ChordPro-to-render conversion, wrapping, layout simulation, order optimization, and PDF rendering.

- `backend/songs/serializers.py`
  - Request/response validation for match and packet selection payloads.

## Data Model Summary

`Song`
- `source_id`, `title`, `key`, `language`
- `lyrics_plain`, `lyrics_chordpro`, `raw_lyrics_source`, `parsed_lyrics_ast`
- `raw_html`, timestamps

`SongVersion`
- FK to `Song`
- `tune_name`, `capo_default`, `lyrics_chordpro`, `raw_html`

## Runtime Behavior

- All heavy processing is backend-side (matching, parsing, optimize, PDF drawing).
- Frontend receives lightweight JSON + PDF blobs.
- Generate endpoint returns stats in response headers:
  - `X-Packet-Pages`
  - `X-Packet-Song-Spills`

## Local Backend (without Docker)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```
