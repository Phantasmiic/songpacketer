# API Documentation

Base URL (dev): `http://localhost:8000/api`

## API Root

- `GET /api`
- Returns route URLs + docs metadata.

## Match Songs

- `POST /api/songs/match`
- Request:

```json
{
  "input_text": "Lord Jesus you are Lovel\nBe thou my vision"
}
```

- Response (shape):

```json
{
  "results": [
    {
      "input": "Lord Jesus you are Lovel",
      "selected": {
        "song_id": 123,
        "title": "Lord Jesus You're Lovely",
        "key": "C",
        "score": 0.82
      },
      "candidates": [
        {"song_id": 123, "title": "...", "key": "C", "score": 0.82}
      ]
    }
  ]
}
```

Notes:
- Candidate list currently returns up to 10.
- `selected` is only set when top score is at least `0.5`.

## Song Versions

- `GET /api/songs/{song_id}/versions`
- Returns tune/version rows including `id`, `tune_name`, `capo_default`, `lyrics_chordpro`.

## Sync Songbase English

- `POST /api/songs/sync`
- Pulls from Songbase endpoint and upserts local DB.

## Source Sample (Debug)

- `GET /api/songs/source-sample`
  - Returns raw sample payload from Songbase source.
- `GET /api/songs/source-sample/inspect`
  - Human-readable inspect page with expandable/scrollable lyrics body.

## Packet Preview

- `POST /api/packet/preview`
- Request:

```json
{
  "selections": [
    {
      "song_id": 123,
      "version_id": 456,
      "capo": 2,
      "chordpro_override": "",
      "title_override": "",
      "force_new_page": false
    }
  ],
  "maintain_original_order": false
}
```

- Returns estimated layout/placement JSON (non-PDF).

## Optimize Order

- `POST /api/packet/optimize-order`
- Same request shape as preview/generate.
- Returns order index array:

```json
{
  "order": [5, 0, 1, 2, 4, 3],
  "maintain_original_order": false,
  "count": 6
}
```

## Generate PDF

- `POST /api/packet/generate`
- Same request shape as preview/optimize.
- Returns `application/pdf` blob.
- Response headers include:
  - `X-Packet-Pages`
  - `X-Packet-Song-Spills`

## Validation Rules (Selections)

- `song_id`: required
- `version_id`: optional, nullable
- `capo`: optional, `0..12`
- `chordpro_override`: optional
- `title_override`: optional
- `force_new_page`: optional boolean
