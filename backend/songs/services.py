import re
import unicodedata
from dataclasses import dataclass
from typing import Iterable

from .models import Song

TOKEN_RE = re.compile(r"\[[^\]]+\]")
NON_ALNUM_RE = re.compile(r'[^a-z0-9\s]')
WS_RE = re.compile(r'\s+')
WS_ANY_RE = re.compile(r'\s+')
TUNE_ANNOTATION_SUFFIX_RE = re.compile(
    r'(?:\s*[\-=:]\s*(?:new|original)\s+tune\s*$)|(?:\s*\((?:new|original)\s+tune\)\s*$)',
    re.IGNORECASE,
)


@dataclass
class MatchCandidate:
    song_id: int
    title: str
    key: str
    score: float


def normalize_text(value: str) -> str:
    value = value.lower()
    value = TOKEN_RE.sub(' ', value)
    value = NON_ALNUM_RE.sub(' ', value)
    value = WS_RE.sub(' ', value)
    return value.strip()


def _normalize_quotes(value: str) -> str:
    return (
        value.replace('\u2018', "'")
        .replace('\u2019', "'")
        .replace('\u201c', '"')
        .replace('\u201d', '"')
    )


def _strip_for_sort(value: str, normalize: bool = True) -> str:
    result = value or ''
    result = _normalize_quotes(result)
    if normalize:
        result = unicodedata.normalize('NFD', result)
    result = re.sub(r'[_\-—–]', ' ', result)
    result = result.upper().replace('\n', ' ')
    result = re.sub(r'(\[.+?\])|[’\'",“!?()\[\]]|[\u0300-\u036f]', '', result)
    return result


def _songbase_wildcard_pattern(search_term: str) -> re.Pattern | None:
    prepared = unicodedata.normalize('NFD', _normalize_quotes(search_term or ''))
    prepared = TUNE_ANNOTATION_SUFFIX_RE.sub('', prepared).strip()
    prepared = WS_ANY_RE.sub('', prepared)
    if not prepared:
        return None

    # Songbase backend pattern:
    # search.gsub(/\s/, '').split('').join("(?:\\[[^\\]]*\\]|[[:punct:]]|[[:space:]])*")
    # Python equivalent for punctuation/whitespace + chord tokens in between chars.
    between = r'(?:\[[^\]]*\]|[^\w\s]|\s)*'
    pattern_text = between.join([re.escape(char) for char in prepared])
    return re.compile(pattern_text, re.IGNORECASE)


def split_queries(input_text: str, extra_queries: Iterable[str]) -> list[str]:
    lines = [line.strip() for line in input_text.splitlines() if line.strip()]
    extras = [line.strip() for line in extra_queries if line.strip()]
    seen = set()
    ordered = []
    for item in lines + extras:
        lowered = item.lower()
        if lowered not in seen:
            seen.add(lowered)
            ordered.append(item)
    return ordered


def find_song_candidates(query: str, limit: int = 10) -> list[MatchCandidate]:
    pattern = _songbase_wildcard_pattern(query)
    if pattern is None:
        return []
    sort_query = _strip_for_sort(query, normalize=True)

    scored: list[tuple[int, int, str, MatchCandidate]] = []
    for song in Song.objects.filter(language='english').only('id', 'title', 'key', 'lyrics_plain'):
        title_text = unicodedata.normalize('NFD', _normalize_quotes(song.title or ''))
        lyrics_text = unicodedata.normalize('NFD', _normalize_quotes(song.lyrics_plain or ''))

        title_match = bool(pattern.search(title_text))
        lyrics_match = bool(pattern.search(lyrics_text))
        if not (title_match or lyrics_match):
            continue

        title_sort = _strip_for_sort(song.title or '', normalize=False)
        lyrics_sort = _strip_for_sort(song.lyrics_plain or '', normalize=False)

        # Songbase-like priority ordering:
        # 2 = title starts with search, 1 = title contains search, 0 = lyrics match.
        if sort_query and title_sort.startswith(sort_query):
            priority = 2
        elif sort_query and sort_query in title_sort:
            priority = 1
        else:
            priority = 0

        lyric_position = lyrics_sort.find(sort_query) if sort_query else 10_000_000
        if lyric_position < 0:
            lyric_position = 10_000_000

        score_by_priority = {2: 0.95, 1: 0.82, 0: 0.68}
        score = score_by_priority[priority]

        scored.append(
            (
                -priority,
                lyric_position,
                title_sort,
                MatchCandidate(song_id=song.id, title=song.title, key=song.key, score=score),
            )
        )

    scored.sort(key=lambda item: (item[0], item[1], item[2]))
    return [item[3] for item in scored[:limit]]
