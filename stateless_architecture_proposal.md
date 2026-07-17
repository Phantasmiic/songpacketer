# Proposal: Migrating to a Stateless Architecture

## Current Architecture
Currently, the Song Packeter uses a stateful architecture:
- **Frontend**: React application that continuously makes API calls to sync state.
- **Backend**: Django application backed by a PostgreSQL database (managed via Docker locally).
- **Database Role**: Stores the master song catalog, user packet sessions (`session_key`), individual packet versions, and an edit history audit log.

## Proposed Architecture
We propose shifting to a **Stateless Backend + Local-First Frontend** architecture.

### 1. The Frontend (Browser-First Storage)
- **Song Catalog Caching**: The frontend will fetch the raw song library from the upstream source (or a proxy) once and cache it heavily in the browser using `IndexedDB` (e.g., via Dexie.js).
- **Local Packet State**: The user's active packet, edit history, and packet versions will be saved directly into `localStorage` or `IndexedDB`.
- **Import / Export**: Because packets are stored locally, we will introduce an "Export Packet" and "Import Packet" feature allowing users to download their packet as a `.json` file to back it up or move it to another device.

### 2. The Backend (Stateless PDF Generator)
- **No Database**: We will completely remove PostgreSQL and all Django models.
- **Single API Endpoint**: The backend's sole responsibility will be a single stateless endpoint (e.g., `POST /api/generate-pdf`). The frontend will send the fully constructed JSON payload containing the layout and chordpro text. The Python backend will run `reportlab` (via `pdf.py`) to generate the PDF and return the raw PDF bytes.

## Benefits
- **Zero Docker Dependency**: Developers will no longer need Docker to spin up the local environment.
- **Cheaper & Simpler Hosting**: 
  - Frontend can be hosted for free on a CDN like **Netlify** or **Vercel**.
  - Backend can be hosted on a cheap PaaS (like **Render** or **Railway**) without needing an attached managed SQL database.
- **Lightning Fast UI**: All saving, versioning, and state updates happen instantaneously in local memory without waiting for network API requests.
- **Offline Capability**: Users can edit, reorder, and version their packets entirely offline (though generating the final PDF will still require an API call).

## Drawbacks & Considerations
- **Device Lock-in**: User packets are tied to the browser they were created in. If a user clears their site data, they lose their packets.
  - *Mitigation*: Emphasize the new JSON Import/Export feature.

## Implementation Roadmap
1. **Frontend**: Replace API sync calls in `App.jsx` with local storage handlers. Implement a local versioning system for packets.
2. **Frontend**: Implement an initial bulk fetch-and-cache of the master song list to `IndexedDB`.
3. **Backend**: Strip out `models.py`, `serializers.py`, and database configuration.
4. **Backend**: Refactor `views.py` into a single stateless `GeneratePDFView` endpoint.
5. **Infrastructure**: Delete `docker-compose.yml`, remove `psycopg` from `requirements.txt`, and update `README.md`.
