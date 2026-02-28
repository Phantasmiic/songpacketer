# Song Packeter

Song Packeter is a Dockerized web app for building printable PDF song packets from Songbase data.

## Stack

- Backend: Django + Django REST Framework
- Frontend: React + Vite + Material UI
- Database: Postgres
- Deployment/runtime: Docker Compose

## What It Does

- Syncs English songs from Songbase into a local Postgres cache.
- Matches user input (titles or lyric fragments) to songs with fuzzy search.
- Lets users refine matched songs (title, tune/version, capo, chord/lyric body).
- Generates a two-column PDF packet.
- Supports optimizer-based ordering plus manual drag/drop re-ordering and force-new-page controls.
- Returns generation stats (`pages`, `song spills`) for each generated PDF.

## Quick Start

```bash
docker compose up --build
```

- Frontend: `http://localhost:5173`
- Backend API root: `http://localhost:8000/api`

## API Quick Test

```bash
curl -s http://localhost:8000/api | jq
```

## Documentation

- Frontend: [docs/frontend.md](docs/frontend.md)
- Backend: [docs/backend.md](docs/backend.md)
- API: [docs/api.md](docs/api.md)
- Optimization algorithm: [docs/optimization.md](docs/optimization.md)
- UI + user workflow: [docs/ui-workflow.md](docs/ui-workflow.md)

## Tests

Run backend tests inside Docker:

```bash
docker compose exec -T backend python manage.py test -v 1
```

Targeted suites:

```bash
docker compose exec -T backend python manage.py test tests.test_matching -v 1
docker compose exec -T backend python manage.py test tests.test_pdf -v 1
docker compose exec -T backend python manage.py test tests.test_packet_44_metrics -v 1
```
