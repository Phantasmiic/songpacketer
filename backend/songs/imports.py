import logging
from typing import Any

import requests
from bs4 import BeautifulSoup
from django.conf import settings

from .markup import parse_songbase_lyrics
from .models import Song, SongVersion

logger = logging.getLogger(__name__)


def _extract_tune(raw_html: str) -> str:
    if not raw_html:
        return ''
    soup = BeautifulSoup(raw_html, 'html.parser')
    text = soup.get_text(' ', strip=True)
    marker = 'Tune:'
    if marker in text:
        return text.split(marker, 1)[1].split(' ', 5)[0].strip(':').strip()
    return ''


def _to_plain_text(raw_html: str) -> str:
    if not raw_html:
        return ''
    soup = BeautifulSoup(raw_html, 'html.parser')
    return soup.get_text('\n', strip=True)


def _extract_payload_items(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if isinstance(payload, dict):
        for key in ('results', 'songs', 'data', 'items'):
            value = payload.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]
    return []


def _safe_tune_name(tune_name: str, tune_index: int, seen: set[str]) -> str:
    base = (tune_name or '').strip()
    if not base:
        base = '' if tune_index == 0 else f'Tune {tune_index + 1}'
    name = base
    counter = 2
    while name in seen:
        name = f'{base} ({counter})'
        counter += 1
    seen.add(name)
    return name


def sync_songbase_english() -> dict[str, int]:
    base_url = settings.SONGBASE_API_URL.rstrip('/')
    headers = {}
    if settings.SONGBASE_API_TOKEN:
        headers['Authorization'] = f'Bearer {settings.SONGBASE_API_TOKEN}'

    created = 0
    updated = 0

    response = requests.get(
        base_url,
        params={'language': 'english', 'updated_at': 0},
        headers=headers,
        timeout=45,
    )
    response.raise_for_status()
    payload = response.json()
    items = _extract_payload_items(payload.get('songs', payload))

    for item in items:
        language = (item.get('lang') or item.get('language') or '').strip().lower()
        if language and language != 'english':
            continue

        song_id = str(item.get('id') or item.get('song_id') or '')
        if not song_id:
            continue

        title = item.get('title') or item.get('name') or 'Untitled'
        lyrics = item.get('lyrics') or item.get('lyrics_chordpro') or item.get('chordpro') or ''
        raw_html = item.get('html') or item.get('content_html') or ''
        key = item.get('key') or ''
        parsed = parse_songbase_lyrics(lyrics)
        tunes = parsed.get('tunes', [])
        primary = tunes[0] if tunes else {}
        primary_chordpro = primary.get('body_chordpro', '')
        combined_plain = '\n\n'.join(
            [tune.get('body_plain', '') for tune in tunes if tune.get('body_plain')]
        )
        lyrics_plain = _to_plain_text(raw_html) if raw_html else combined_plain

        song, was_created = Song.objects.update_or_create(
            source_id=song_id,
            defaults={
                'title': title,
                'key': key,
                'language': 'english',
                'lyrics_plain': lyrics_plain,
                'lyrics_chordpro': primary_chordpro,
                'raw_lyrics_source': lyrics,
                'parsed_lyrics_ast': parsed,
                'raw_html': raw_html,
            },
        )
        if was_created:
            created += 1
        else:
            updated += 1

        version_names = set()
        seen_names: set[str] = set()
        fallback_capo = int(item.get('suggested_capo') or item.get('capo') or 0)
        fallback_tune = item.get('tune') or _extract_tune(raw_html)

        if not tunes:
            tune_name = _safe_tune_name(fallback_tune, 0, seen_names)
            SongVersion.objects.update_or_create(
                song=song,
                tune_name=tune_name,
                defaults={
                    'capo_default': fallback_capo,
                    'lyrics_chordpro': lyrics,
                    'raw_html': raw_html,
                },
            )
            version_names.add(tune_name)
        else:
            for tune in tunes:
                tune_name = _safe_tune_name(tune.get('tune_name', ''), tune.get('index', 0), seen_names)
                SongVersion.objects.update_or_create(
                    song=song,
                    tune_name=tune_name,
                    defaults={
                        'capo_default': int(tune.get('capo_default', fallback_capo)),
                        'lyrics_chordpro': tune.get('body_chordpro', ''),
                        'raw_html': raw_html,
                    },
                )
                version_names.add(tune_name)

        SongVersion.objects.filter(song=song).exclude(tune_name__in=version_names).delete()

    logger.info('Songbase sync complete: created=%s updated=%s', created, updated)
    return {'created': created, 'updated': updated}
