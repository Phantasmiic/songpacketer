# Backend (Django)

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

## Key APIs

- `POST /api/songs/match`
  - Request: `{ "input_text": "song one\nsong two" }`
  - Returns selected top match + top 5 candidates for each line.
- `GET /api/songs/{song_id}/versions`
  - Returns tune/version list with default capo.
- `POST /api/songs/sync`
  - Pulls English songs from Songbase API and upserts into Postgres.
- `POST /api/packet/preview`
  - Returns layout placements and page count (feedback loop before final PDF).
- `POST /api/packet/generate`
  - Returns generated PDF in two-column layout.

## Tests

```bash
python manage.py test
```
