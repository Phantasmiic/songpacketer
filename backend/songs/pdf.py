from dataclasses import dataclass
from io import BytesIO
import random
from typing import Iterable

from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas

LYRIC_FONT = 'Helvetica'
CHORD_FONT = 'Helvetica-Bold'
TEXT_FONT_SIZE = 11
SONG_TITLE_FONT_SIZE = 15


@dataclass
class RenderedSong:
    title: str
    key: str
    capo: int
    lines: list[tuple[str, str]]
    force_new_page: bool = False


def chordpro_to_lines(chordpro_text: str) -> list[tuple[str, str]]:
    rendered = []
    for raw_line in (chordpro_text or '').splitlines():
        line = raw_line.rstrip('\n')
        if not line.strip():
            rendered.append(('', ''))
            continue

        chord_positions: dict[int, list[str]] = {}
        lyric_chars: list[str] = []
        pos = 0
        i = 0
        while i < len(line):
            if line[i] == '[':
                end = line.find(']', i)
                if end > i:
                    chord = line[i + 1 : end].strip()
                    if chord:
                        chord_positions.setdefault(pos, []).append(chord)
                    i = end + 1
                    continue
            lyric_chars.append(line[i])
            pos += 1
            i += 1

        lyric = ''.join(lyric_chars)
        chord_texts = {p: '/'.join(chords) for p, chords in chord_positions.items()}
        max_end = max(
            [len(lyric)] + [position + len(text) for position, text in chord_texts.items()]
        )
        chord_line = [' '] * max(1, max_end)
        for p, chord_list in chord_positions.items():
            text = '/'.join(chord_list)
            cursor = max(p, 0)
            for offset, char in enumerate(text):
                idx = cursor + offset
                if idx >= len(chord_line):
                    chord_line.extend([' '] * (idx - len(chord_line) + 1))
                chord_line[idx] = char

        chord = ''.join(chord_line).rstrip()
        rendered.append((chord, lyric))

    return rendered


@dataclass
class _Row:
    kind: str
    chord: str = ''
    lyric: str = ''


def _song_rows(song: RenderedSong) -> list[_Row]:
    rows = [_Row(kind='song_number')]
    if song.capo > 0:
        rows.append(_Row(kind='capo'))
    for chord, lyric in song.lines:
        if chord:
            rows.append(_Row(kind='chord', chord=chord, lyric=lyric))
        rows.append(_Row(kind='lyric', lyric=lyric))
    return rows


def _find_largest_fit_end(
    pdf: canvas.Canvas,
    text: str,
    font_name: str,
    font_size: float,
    start: int,
    hard_end: int,
    max_width: float,
) -> int:
    lo = start + 1
    hi = hard_end
    best = lo
    while lo <= hi:
        mid = (lo + hi) // 2
        segment = text[start:mid].rstrip()
        if pdf.stringWidth(segment, font_name, font_size) <= max_width:
            best = mid
            lo = mid + 1
        else:
            hi = mid - 1
    return best


def _wrap_text_to_chars(
    pdf: canvas.Canvas, text: str, font_name: str, font_size: float, max_width: float
) -> list[str]:
    if text == '':
        return ['']
    if pdf.stringWidth(text, font_name, font_size) <= max_width:
        return [text]

    wrapped: list[str] = []
    start = 0
    n = len(text)
    while start < n:
        fit_end = _find_largest_fit_end(pdf, text, font_name, font_size, start, n, max_width)
        if fit_end <= start:
            fit_end = min(start + 1, n)
        split = fit_end
        if fit_end < n:
            word_boundary = text.rfind(' ', start + 1, fit_end + 1)
            if word_boundary > start:
                split = word_boundary

        segment = text[start:split].rstrip()
        wrapped.append(segment)
        start = split
        while start < n and text[start] == ' ':
            start += 1

    return wrapped or ['']


def _wrap_chord_lyric_pair(
    pdf: canvas.Canvas, chord: str, lyric: str, font_name: str, font_size: float, max_width: float
) -> list[tuple[str, str]]:
    total = max(len(chord), len(lyric), 1)
    chord_pad = chord.ljust(total)
    lyric_pad = lyric.ljust(total)
    result: list[tuple[str, str]] = []

    start = 0
    while start < total:
        lo = start + 1
        hi = total
        best = lo
        while lo <= hi:
            mid = (lo + hi) // 2
            chord_seg = chord_pad[start:mid].rstrip()
            lyric_seg = lyric_pad[start:mid].rstrip()
            width = max(
                pdf.stringWidth(chord_seg, font_name, font_size),
                pdf.stringWidth(lyric_seg, font_name, font_size),
            )
            if width <= max_width:
                best = mid
                lo = mid + 1
            else:
                hi = mid - 1

        fit_end = best if best > start else min(start + 1, total)
        split = fit_end
        if fit_end < total:
            word_boundary = lyric_pad.rfind(' ', start + 1, fit_end + 1)
            if word_boundary > start:
                split = word_boundary

        result.append((chord_pad[start:split].rstrip(), lyric_pad[start:split].rstrip()))
        start = split

        while (
            start < total
            and lyric_pad[start] == ' '
            and chord_pad[start] == ' '
        ):
            start += 1

    return result or [('', '')]


def _wrapped_song_rows(
    pdf: canvas.Canvas,
    song: RenderedSong,
    column_width: float,
    font_size: float,
) -> list[_Row]:
    rows: list[_Row] = [_Row(kind='song_number')]
    if song.capo > 0:
        rows.append(_Row(kind='capo'))

    for chord, lyric in song.lines:
        if not chord and not lyric:
            rows.append(_Row(kind='lyric', lyric=''))
            continue
        if chord:
            for wrapped_chord, wrapped_lyric in _wrap_chord_lyric_pair(
                pdf, chord, lyric, LYRIC_FONT, font_size, column_width
            ):
                rows.append(_Row(kind='chord', chord=wrapped_chord, lyric=wrapped_lyric))
                rows.append(_Row(kind='lyric', lyric=wrapped_lyric))
        else:
            for wrapped_lyric in _wrap_text_to_chars(
                pdf, lyric, LYRIC_FONT, font_size, column_width
            ):
                rows.append(_Row(kind='lyric', lyric=wrapped_lyric))
    return rows


def _extract_chord_runs(chord_line: str) -> list[tuple[int, str]]:
    runs: list[tuple[int, str]] = []
    i = 0
    n = len(chord_line)
    while i < n:
        if chord_line[i] == ' ':
            i += 1
            continue
        start = i
        while i < n and chord_line[i] != ' ':
            i += 1
        runs.append((start, chord_line[start:i]))
    return runs


def _split_into_stanza_blocks(rows: list[_Row]) -> list[list[_Row]]:
    blocks: list[list[_Row]] = []
    current: list[_Row] = []

    for row in rows:
        current.append(row)
        if row.kind == 'lyric' and row.lyric == '':
            blocks.append(current)
            current = []

    if current:
        blocks.append(current)

    return blocks


def _truncate_text_to_width(
    pdf: canvas.Canvas, text: str, font_name: str, font_size: float, max_width: float
) -> str:
    if pdf.stringWidth(text, font_name, font_size) <= max_width:
        return text
    ellipsis = '...'
    if pdf.stringWidth(ellipsis, font_name, font_size) >= max_width:
        return ''
    lo = 0
    hi = len(text)
    while lo < hi:
        mid = (lo + hi + 1) // 2
        candidate = text[:mid] + ellipsis
        if pdf.stringWidth(candidate, font_name, font_size) <= max_width:
            lo = mid
        else:
            hi = mid - 1
    return text[:lo] + ellipsis


def _row_height(row: _Row, line_height: float = 14.0) -> float:
    if row.kind == 'song_number':
        return max(line_height * 1.3, SONG_TITLE_FONT_SIZE * 1.15)
    if row.kind == 'capo':
        return line_height * 1.2
    if row.kind == 'lyric' and row.lyric == '':
        return line_height * 1.4
    return line_height


def estimate_song_height(song: RenderedSong, line_height: float = 14.0) -> float:
    return 10.0 + sum(_row_height(row, line_height) for row in _song_rows(song))


@dataclass
class _Cursor:
    page: int
    col: int
    y: float


@dataclass
class _PreparedSongLayout:
    rows: list[_Row]
    blocks: list[list[_Row]]
    block_heights: list[list[float]]
    line_height: float
    total_height: float
    font_size: float
    force_new_page: bool


def _next_column(cursor: _Cursor, top: float) -> _Cursor:
    if cursor.col == 0:
        return _Cursor(page=cursor.page, col=1, y=top)
    return _Cursor(page=cursor.page + 1, col=0, y=top)


def _select_best_fit_song_index(remaining_indices: list[int], heights: dict[int, float], free: float) -> int | None:
    fitting = [idx for idx in remaining_indices if heights[idx] <= free]
    if not fitting:
        return None
    fitting.sort(key=lambda idx: heights[idx], reverse=True)
    return fitting[0]


def _select_oversized_song_index(
    remaining_indices: list[int], heights: dict[int, float], usable_height: float
) -> int | None:
    oversized = [idx for idx in remaining_indices if heights[idx] > usable_height]
    if not oversized:
        return None
    oversized.sort(key=lambda idx: heights[idx], reverse=True)
    return oversized[0]


def estimate_packet_layout(
    songs: list[RenderedSong],
    maintain_original_order: bool,
    usable_height: float,
    top: float,
    bottom: float,
    line_height: float = 14.0,
) -> dict:
    heights = {idx: estimate_song_height(song, line_height=line_height) for idx, song in enumerate(songs)}

    if maintain_original_order:
        order = list(range(len(songs)))
    else:
        order = sorted(range(len(songs)), key=lambda idx: heights[idx], reverse=True)

    cursor = _Cursor(page=0, col=0, y=top)
    placements = []
    remaining = order.copy()

    while remaining:
        free = cursor.y - bottom

        if maintain_original_order:
            idx = remaining[0]
        else:
            idx = _select_best_fit_song_index(remaining, heights, free)
            if idx is None:
                # If there is an oversized song, force-select it so it can split.
                idx = _select_oversized_song_index(remaining, heights, usable_height)
                if idx is None:
                    # No full song fits current space; move forward to minimize empty lines.
                    cursor = _next_column(cursor, top)
                    continue

        song = songs[idx]
        song_height = heights[idx]

        # Keep whole song together where possible.
        if song_height <= usable_height and song_height > free:
            cursor = _next_column(cursor, top)
            free = cursor.y - bottom

        # Oversized song: split across columns/pages as needed.
        if song_height > usable_height:
            rows = _song_rows(song)
            segment = 1
            consumed = 0
            while consumed < len(rows):
                free = cursor.y - bottom
                if free <= line_height:
                    cursor = _next_column(cursor, top)
                    free = cursor.y - bottom

                start = consumed
                while consumed < len(rows):
                    h = _row_height(rows[consumed], line_height)
                    if h > free and consumed > start:
                        break
                    if h > free and consumed == start:
                        break
                    free -= h
                    consumed += 1

                if consumed == start:
                    cursor = _next_column(cursor, top)
                    continue

                placements.append(
                    {
                        'song_index': idx,
                        'title': song.title,
                        'page': cursor.page + 1,
                        'column': cursor.col + 1,
                        'segment': segment,
                        'split': True,
                    }
                )
                segment += 1
                cursor.y = top - (usable_height - free) - line_height

                if consumed < len(rows):
                    cursor = _next_column(cursor, top)

            remaining.remove(idx)
            continue

        placements.append(
            {
                'song_index': idx,
                'title': song.title,
                'page': cursor.page + 1,
                'column': cursor.col + 1,
                'segment': 1,
                'split': False,
            }
        )
        cursor.y -= song_height + line_height
        remaining.remove(idx)

    page_count = cursor.page + 1
    return {'page_count': page_count, 'placements': placements, 'order': order}


def _draw_row(
    pdf: canvas.Canvas,
    x: float,
    y: float,
    width: float,
    row: _Row,
    song: RenderedSong,
    song_number: int,
    font_size: float,
) -> None:
    def draw_bold_text(x_pos: float, y_pos: float, text: str) -> None:
        pdf.drawString(x_pos, y_pos, text)
        pdf.drawString(x_pos + 0.25, y_pos, text)

    if row.kind == 'song_number':
        font_name = CHORD_FONT
        pdf.setFont(font_name, SONG_TITLE_FONT_SIZE)
        label = f'Song {song_number}'
        draw_bold_text(x, y, label)
    elif row.kind == 'capo':
        pdf.setFont(LYRIC_FONT, TEXT_FONT_SIZE)
        pdf.drawString(x, y, f'Capo {song.capo}')
    elif row.kind == 'chord':
        pdf.setFont(CHORD_FONT, font_size)
        last_right_x = x
        for anchor_idx, chord_text in _extract_chord_runs(row.chord):
            lyric_prefix = row.lyric[: min(anchor_idx, len(row.lyric))]
            target_x = x + pdf.stringWidth(lyric_prefix, LYRIC_FONT, font_size)
            # Keep collisions readable while preserving anchor as closely as possible.
            target_x = max(target_x, last_right_x)
            draw_bold_text(target_x, y, chord_text)
            last_right_x = target_x + pdf.stringWidth(chord_text, CHORD_FONT, font_size) + 1.0
    else:
        pdf.setFont(LYRIC_FONT, font_size)
        pdf.drawString(x, y, row.lyric)


def _prepare_song_layout(
    pdf: canvas.Canvas,
    song: RenderedSong,
    column_width: float,
    base_font_size: float,
    base_line_height: float,
) -> _PreparedSongLayout:
    base_rows = _wrapped_song_rows(pdf, song, column_width, base_font_size)
    needs_wrap = len(base_rows) > len(_song_rows(song))
    font_size = max(1.0, base_font_size - 1.0) if needs_wrap else float(base_font_size)
    rows = (
        _wrapped_song_rows(pdf, song, column_width, font_size)
        if needs_wrap
        else base_rows
    )
    line_height = base_line_height - (base_font_size - font_size)
    blocks = _split_into_stanza_blocks(rows)
    block_heights = [[_row_height(row, line_height) for row in block] for block in blocks]
    total_height = sum(sum(row_heights) for row_heights in block_heights) + line_height
    return _PreparedSongLayout(
        rows=rows,
        blocks=blocks,
        block_heights=block_heights,
        line_height=line_height,
        total_height=total_height,
        font_size=font_size,
        force_new_page=song.force_new_page,
    )


def _objective_tuple(
    metrics: dict,
    priority: tuple[str, ...] = (
        'song_page_spill',
        'pages',
        'stanza_page_spill',
        'stanza_col_spill',
    ),
) -> tuple:
    # Optimization priority (in order):
    # 1) total pages
    # 2) songs spilling across pages
    # 3) stanzas spilling across pages
    # 4) stanzas spilling across columns
    return tuple(metrics[name] for name in priority)


def _simulate_order_metrics(
    order: list[int],
    prepared: dict[int, _PreparedSongLayout],
    top: float,
    bottom: float,
    usable_height: float,
) -> dict:
    cursor = _Cursor(page=0, col=0, y=top)
    whitespace = 0.0
    stanza_page_spill = 0
    stanza_col_spill = 0
    song_page_spill = 0

    def move_next_column(cur: _Cursor) -> _Cursor:
        nonlocal whitespace
        whitespace += max(cur.y - bottom, 0.0)
        return _next_column(cur, top)

    def move_to_next_page(cur: _Cursor) -> _Cursor:
        nonlocal whitespace
        whitespace += max(cur.y - bottom, 0.0)
        # If we are leaving the left column directly, account for unused right column.
        if cur.col == 0:
            whitespace += usable_height
        return _Cursor(page=cur.page + 1, col=0, y=top)

    for song_index in order:
        song_layout = prepared[song_index]

        if song_layout.force_new_page and (cursor.col != 0 or cursor.y < top):
            cursor = move_to_next_page(cursor)

        if (
            song_layout.total_height <= usable_height
            and song_layout.total_height > (cursor.y - bottom)
        ):
            cursor = move_next_column(cursor)

        rendered_pages: set[int] = set()
        for block_index, block in enumerate(song_layout.blocks):
            block_height = sum(song_layout.block_heights[block_index])
            free = cursor.y - bottom

            if block_height <= usable_height and block_height > free:
                cursor = move_next_column(cursor)

            for row_index, _ in enumerate(block):
                h = song_layout.block_heights[block_index][row_index]
                if h > (cursor.y - bottom):
                    previous_page = cursor.page
                    previous_col = cursor.col
                    cursor = move_next_column(cursor)
                    if cursor.page != previous_page:
                        stanza_page_spill += 1
                    elif cursor.col != previous_col:
                        stanza_col_spill += 1
                rendered_pages.add(cursor.page)
                cursor.y -= h

        cursor.y -= song_layout.line_height
        if len(rendered_pages) > 1:
            # Count each overflowing song once, not per-page transition.
            song_page_spill += 1

    whitespace += max(cursor.y - bottom, 0.0)
    return {
        'pages': cursor.page + 1,
        'stanza_page_spill': stanza_page_spill,
        'stanza_col_spill': stanza_col_spill,
        'song_page_spill': song_page_spill,
        'whitespace': whitespace,
    }


def _build_bucket_seed_order(
    prepared: dict[int, _PreparedSongLayout],
    top: float,
    bottom: float,
    usable_height: float,
    rng: random.Random,
    objective_priority: tuple[str, ...],
) -> list[int]:
    indices = list(prepared.keys())
    if not indices:
        return []

    long_ids = [idx for idx in indices if prepared[idx].total_height > usable_height]
    medium_ids = [
        idx
        for idx in indices
        if usable_height * 0.45 <= prepared[idx].total_height <= usable_height
    ]
    short_ids = [idx for idx in indices if idx not in long_ids and idx not in medium_ids]

    long_ids = sorted(
        long_ids,
        key=lambda idx: prepared[idx].total_height * (1.0 + rng.uniform(-0.15, 0.15)),
        reverse=True,
    )
    medium_ids = sorted(
        medium_ids,
        key=lambda idx: (
            abs(usable_height - prepared[idx].total_height) * (1.0 + rng.uniform(-0.15, 0.15))
        ),
    )
    rng.shuffle(short_ids)

    order = long_ids + medium_ids
    for short_id in short_ids:
        if not order:
            order = [short_id]
            continue
        best_order = None
        best_metrics = None
        for insert_at in range(len(order) + 1):
            candidate = order[:insert_at] + [short_id] + order[insert_at:]
            metrics = _simulate_order_metrics(candidate, prepared, top, bottom, usable_height)
            if best_metrics is None or _objective_tuple(
                metrics, objective_priority
            ) < _objective_tuple(best_metrics, objective_priority):
                best_order = candidate
                best_metrics = metrics
        order = best_order or order

    return order


def _estimate_free_after_song_from_fresh_start(
    song_layout: _PreparedSongLayout,
    top: float,
    bottom: float,
    usable_height: float,
) -> float:
    cursor = _Cursor(page=0, col=0, y=top)
    for block_index, block in enumerate(song_layout.blocks):
        block_height = sum(song_layout.block_heights[block_index])
        free = cursor.y - bottom
        if block_height <= usable_height and block_height > free:
            cursor = _next_column(cursor, top)
        for row_index, _ in enumerate(block):
            h = song_layout.block_heights[block_index][row_index]
            if h > (cursor.y - bottom):
                cursor = _next_column(cursor, top)
            cursor.y -= h
    cursor.y -= song_layout.line_height
    return max(cursor.y - bottom, 0.0)


def _build_structured_long_song_page_seed(
    prepared: dict[int, _PreparedSongLayout],
    usable_height: float,
    top: float,
    bottom: float,
    rng: random.Random,
    long_column_threshold: float = 2.0,
    randomize_long_order: bool = True,
) -> list[int]:
    indices = list(prepared.keys())
    if not indices:
        return []

    long_limit = usable_height * long_column_threshold
    long_ids = [idx for idx in indices if prepared[idx].total_height > long_limit]
    other_ids = [idx for idx in indices if idx not in long_ids]

    if randomize_long_order:
        rng.shuffle(long_ids)
    else:
        long_ids.sort(key=lambda idx: prepared[idx].total_height, reverse=True)
    other_ids.sort(key=lambda idx: prepared[idx].total_height, reverse=True)

    remaining = set(other_ids)
    order: list[int] = []
    for long_id in long_ids:
        order.append(long_id)
        free = _estimate_free_after_song_from_fresh_start(
            prepared[long_id], top, bottom, usable_height
        )
        # Fill residual space after a long song with short/medium songs to
        # encourage the next long song to begin near a fresh page.
        while True:
            candidates = [
                idx
                for idx in remaining
                if prepared[idx].total_height <= free
            ]
            if not candidates:
                break
            candidates.sort(key=lambda idx: prepared[idx].total_height, reverse=True)
            chosen = candidates[0] if rng.random() < 0.85 else candidates[-1]
            order.append(chosen)
            remaining.remove(chosen)
            free -= prepared[chosen].total_height

    leftovers = sorted(
        [idx for idx in remaining],
        key=lambda idx: prepared[idx].total_height,
        reverse=True,
    )
    order.extend(leftovers)
    return order


def _optimize_song_order(
    prepared: dict[int, _PreparedSongLayout],
    maintain_original_order: bool,
    top: float,
    bottom: float,
    usable_height: float,
    bucket_attempts: int = 40,
    objective_priority: tuple[str, ...] = (
        'song_page_spill',
        'pages',
        'stanza_page_spill',
        'stanza_col_spill',
    ),
) -> list[int]:
    indices = list(prepared.keys())
    if maintain_original_order or len(indices) < 2:
        return indices

    wrapped_desc = sorted(indices, key=lambda idx: prepared[idx].total_height, reverse=True)
    rng = random.Random(7)

    def refine(seed_order: list[int], iterations: int) -> tuple[list[int], dict]:
        local_best_order = seed_order[:]
        local_best_metrics = _simulate_order_metrics(
            local_best_order, prepared, top, bottom, usable_height
        )
        for _ in range(iterations):
            candidate = local_best_order[:]
            if rng.random() < 0.7:
                i = rng.randrange(0, len(candidate) - 1)
                j = i + 1
            else:
                i, j = sorted(rng.sample(range(len(candidate)), 2))
            candidate[i], candidate[j] = candidate[j], candidate[i]

            metrics = _simulate_order_metrics(candidate, prepared, top, bottom, usable_height)
            if _objective_tuple(metrics, objective_priority) < _objective_tuple(
                local_best_metrics, objective_priority
            ):
                local_best_order = candidate
                local_best_metrics = metrics
        return local_best_order, local_best_metrics

    seed_orders = [wrapped_desc, indices]
    for _ in range(10):
        shuffled = indices[:]
        rng.shuffle(shuffled)
        seed_orders.append(shuffled)
    for _ in range(25):
        seed_orders.append(
            _build_structured_long_song_page_seed(
                prepared=prepared,
                usable_height=usable_height,
                top=top,
                bottom=bottom,
                rng=rng,
                long_column_threshold=2.0,
                randomize_long_order=True,
            )
        )

    iterations = min(2400, max(600, len(indices) * 50))
    global_best_order = wrapped_desc
    global_best_metrics = _simulate_order_metrics(
        global_best_order, prepared, top, bottom, usable_height
    )
    scored_seeds: list[tuple[tuple, list[int], dict]] = []
    for seed in seed_orders:
        seed_metrics = _simulate_order_metrics(seed, prepared, top, bottom, usable_height)
        scored_seeds.append((_objective_tuple(seed_metrics, objective_priority), seed, seed_metrics))
        if _objective_tuple(seed_metrics, objective_priority) < _objective_tuple(
            global_best_metrics, objective_priority
        ):
            global_best_order = seed
            global_best_metrics = seed_metrics

    scored_seeds.sort(key=lambda item: item[0])
    for _, seed, _ in scored_seeds[:6]:
        candidate_order, candidate_metrics = refine(seed, iterations)
        if _objective_tuple(candidate_metrics, objective_priority) < _objective_tuple(
            global_best_metrics, objective_priority
        ):
            global_best_order = candidate_order
            global_best_metrics = candidate_metrics

    return global_best_order


def compute_packet_song_order(
    songs: Iterable[RenderedSong],
    maintain_original_order: bool = False,
    objective_priority: tuple[str, ...] = (
        'song_page_spill',
        'pages',
        'stanza_page_spill',
        'stanza_col_spill',
    ),
) -> list[int]:
    songs_list = list(songs)
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=LETTER)

    page_width, page_height = LETTER
    h_margin = 18
    v_margin = 72
    line_height = 14
    center_x = page_width / 2.0
    left_column_width = center_x - h_margin
    right_column_width = page_width - h_margin - center_x
    column_width = min(left_column_width, right_column_width)
    top = page_height - v_margin
    bottom = v_margin
    usable_height = top - bottom

    prepared_layouts = {
        song_index: _prepare_song_layout(
            pdf, song, column_width, TEXT_FONT_SIZE, line_height
        )
        for song_index, song in enumerate(songs_list)
    }

    return _optimize_song_order(
        prepared=prepared_layouts,
        maintain_original_order=maintain_original_order,
        top=top,
        bottom=bottom,
        usable_height=usable_height,
        objective_priority=objective_priority,
    )


def compute_packet_order_and_metrics(
    songs: Iterable[RenderedSong],
    maintain_original_order: bool = False,
    objective_priority: tuple[str, ...] = (
        'song_page_spill',
        'pages',
        'stanza_page_spill',
        'stanza_col_spill',
    ),
) -> tuple[list[int], dict]:
    songs_list = list(songs)
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=LETTER)

    page_width, page_height = LETTER
    h_margin = 18
    v_margin = 72
    line_height = 14
    center_x = page_width / 2.0
    left_column_width = center_x - h_margin
    right_column_width = page_width - h_margin - center_x
    column_width = min(left_column_width, right_column_width)
    top = page_height - v_margin
    bottom = v_margin
    usable_height = top - bottom

    prepared_layouts = {
        song_index: _prepare_song_layout(
            pdf, song, column_width, TEXT_FONT_SIZE, line_height
        )
        for song_index, song in enumerate(songs_list)
    }
    order = _optimize_song_order(
        prepared=prepared_layouts,
        maintain_original_order=maintain_original_order,
        top=top,
        bottom=bottom,
        usable_height=usable_height,
        objective_priority=objective_priority,
    )
    metrics = _simulate_order_metrics(order, prepared_layouts, top, bottom, usable_height)
    return order, metrics


def render_song_packet_pdf(
    songs: Iterable[RenderedSong],
    maintain_original_order: bool = False,
    draw_order: list[int] | None = None,
    include_metrics: bool = False,
) -> bytes | tuple[bytes, dict]:
    songs_list = list(songs)
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=LETTER)

    page_width, page_height = LETTER
    h_margin = 18
    v_margin = 72
    gutter = 0
    line_height = 14
    center_x = page_width / 2.0
    left_column_width = center_x - h_margin
    right_column_width = page_width - h_margin - center_x
    column_width = min(left_column_width, right_column_width)
    top = page_height - v_margin
    bottom = v_margin
    usable_height = top - bottom

    prepared_layouts = {
        song_index: _prepare_song_layout(
            pdf, song, column_width, TEXT_FONT_SIZE, line_height
        )
        for song_index, song in enumerate(songs_list)
    }

    if draw_order is None:
        draw_order = _optimize_song_order(
            prepared=prepared_layouts,
            maintain_original_order=maintain_original_order,
            top=top,
            bottom=bottom,
            usable_height=usable_height,
        )

    song_number_map = {song_index: number for number, song_index in enumerate(draw_order, start=1)}

    def draw_song_index_pages() -> None:
        entries = sorted(
            [(songs_list[idx].title, song_number_map[idx]) for idx in draw_order],
            key=lambda item: item[0].lower(),
        )
        index_top = page_height - v_margin
        index_bottom = v_margin
        col_width = page_width - h_margin * 2
        x_position = h_margin
        y = index_top

        # Keep index on exactly one page:
        # 1) reduce font size to 10pt
        # 2) then reduce spacing to 0
        # 3) only then go below 10pt if needed
        index_heading_font = (CHORD_FONT, 14)
        entry_font_name = LYRIC_FONT
        base_font = float(TEXT_FONT_SIZE)
        min_font_before_spacing = 10.0
        default_spacing = 6.0
        available_height = max((index_top - index_bottom) - (line_height * 2.0), 1.0)
        entry_count = max(len(entries), 1)

        chosen_font = base_font
        chosen_spacing = default_spacing

        fit_found = False
        font = base_font
        while font >= min_font_before_spacing:
            needed = entry_count * (font + default_spacing)
            if needed <= available_height:
                chosen_font = font
                chosen_spacing = default_spacing
                fit_found = True
                break
            font -= 0.25

        if not fit_found:
            font = min_font_before_spacing
            spacing = default_spacing
            while spacing >= 0:
                needed = entry_count * (font + spacing)
                if needed <= available_height:
                    chosen_font = font
                    chosen_spacing = spacing
                    fit_found = True
                    break
                spacing -= 0.25

        if not fit_found:
            # Spacing already zero: now allow font below 10pt only as required.
            font = min_font_before_spacing
            while font > 1.0:
                needed = entry_count * font
                if needed <= available_height:
                    chosen_font = font
                    chosen_spacing = 0.0
                    fit_found = True
                    break
                font -= 0.25

        entry_font = (entry_font_name, chosen_font)
        entry_line_spacing = chosen_font + chosen_spacing

        pdf.setFont(*index_heading_font)
        pdf.drawString(h_margin, y, 'Song Index')
        y -= line_height * 2.0
        pdf.setFont(*entry_font)

        def draw_index_line(title: str, number: int, x: float, y_pos: float) -> None:
            right_label = f'Song {number}'
            right_width = pdf.stringWidth(right_label, *entry_font)
            right_x = x + col_width - right_width
            min_gap = 8.0

            title_max_width = max(right_x - x - min_gap * 2, 40.0)
            title_text = _truncate_text_to_width(
                pdf, title, entry_font[0], entry_font[1], title_max_width
            )
            title_width = pdf.stringWidth(title_text, *entry_font)
            dot_start_x = x + title_width + min_gap
            dot_end_x = right_x - min_gap

            pdf.drawString(x, y_pos, title_text)

            dot_width = max(pdf.stringWidth('.', *entry_font), 1e-6)
            dots_width = max(dot_end_x - dot_start_x, 0.0)
            dot_count = int(dots_width // dot_width)
            if dot_count > 0:
                pdf.drawString(dot_start_x, y_pos, '.' * dot_count)

            pdf.drawString(right_x, y_pos, right_label)

        for title, number in entries:
            draw_index_line(title, number, x_position, y)
            y -= entry_line_spacing

        pdf.showPage()

    draw_song_index_pages()

    cursor = _Cursor(page=0, col=0, y=top)
    current_page = 0
    song_page_spill = 0
    stanza_page_spill = 0
    stanza_col_spill = 0

    def draw_song_page_marker(song_page_index: int) -> None:
        pdf.setFont(CHORD_FONT, 10)
        pdf.drawCentredString(page_width / 2.0, v_margin / 2, f'S{song_page_index + 1}')

    draw_song_page_marker(current_page)

    for song_index in draw_order:
        song = songs_list[song_index]
        song_number = song_number_map[song_index]
        song_layout = prepared_layouts[song_index]
        rows = song_layout.rows
        blocks = song_layout.blocks
        song_line_height = song_layout.line_height
        song_font_size = song_layout.font_size
        song_height = song_layout.total_height
        rendered_pages: set[int] = set()

        def x_for_col(col: int) -> float:
            return h_margin if col == 0 else center_x

        if song.force_new_page and (cursor.col != 0 or cursor.y < top):
            cursor = _Cursor(page=cursor.page + 1, col=0, y=top)
            if cursor.page != current_page:
                pdf.showPage()
                current_page = cursor.page
                draw_song_page_marker(current_page)

        if song_height <= usable_height and song_height > (cursor.y - bottom):
            cursor = _next_column(cursor, top)

        for block in blocks:
            block_height = sum(_row_height(row, song_line_height) for row in block)
            free = cursor.y - bottom
            # Hard rule: keep each stanza together when it can fit in a fresh column.
            if block_height <= usable_height and block_height > free:
                cursor = _next_column(cursor, top)
                if cursor.page != current_page:
                    pdf.showPage()
                    current_page = cursor.page
                    draw_song_page_marker(current_page)

            for row in block:
                h = _row_height(row, song_line_height)
                if h > (cursor.y - bottom):
                    previous_page = cursor.page
                    previous_col = cursor.col
                    cursor = _next_column(cursor, top)
                    if cursor.page != previous_page:
                        stanza_page_spill += 1
                    elif cursor.col != previous_col:
                        stanza_col_spill += 1
                    if cursor.page != current_page:
                        pdf.showPage()
                        current_page = cursor.page
                        draw_song_page_marker(current_page)

                if cursor.page != current_page:
                    pdf.showPage()
                    current_page = cursor.page
                    draw_song_page_marker(current_page)

                _draw_row(
                    pdf,
                    x_for_col(cursor.col),
                    cursor.y,
                    column_width,
                    row,
                    song,
                    song_number,
                    song_font_size,
                )
                rendered_pages.add(cursor.page)
                cursor.y -= h

        cursor.y -= song_line_height
        if len(rendered_pages) > 1:
            song_page_spill += 1

    pdf.save()
    buffer.seek(0)
    payload = buffer.read()
    if include_metrics:
        return payload, {
            'pages': current_page + 1,
            'song_page_spill': song_page_spill,
            'stanza_page_spill': stanza_page_spill,
            'stanza_col_spill': stanza_col_spill,
        }
    return payload
