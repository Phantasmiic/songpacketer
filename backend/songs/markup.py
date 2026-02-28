import re

CHORD_RE = re.compile(r"\[[^\]]*\]")
CAPO_RE = re.compile(r"^capo\s+(\d+)\b", re.IGNORECASE)
TUNE_SPLIT_RE = re.compile(r"(?=^###\s*)", re.MULTILINE)
STANZA_RE = re.compile(r"^\d+$")


def _normalize_linebreaks(raw_text: str) -> str:
    return (raw_text or '').replace('\r\n', '\n').replace('\r', '\n')


def _strip_chords(text: str) -> str:
    return CHORD_RE.sub('', text)


def parse_songbase_lyrics(raw_text: str) -> dict:
    normalized = _normalize_linebreaks(raw_text)
    blocks = [block for block in TUNE_SPLIT_RE.split(normalized) if block.strip()]
    if not blocks:
        blocks = ['']

    tunes = []
    for tune_index, block in enumerate(blocks):
        lines = block.split('\n')
        tune_name = ''
        capo_default = 0
        comments = []
        body_lines = []
        line_items = []

        for line_index, line in enumerate(lines):
            stripped = line.strip()

            if line_index == 0 and stripped.startswith('###'):
                tune_name = stripped[3:].strip()
                line_items.append(
                    {
                        'type': 'tune_header',
                        'line': line,
                        'tune_name': tune_name,
                    }
                )
                continue

            # Some payloads may include literal "new line" markers.
            if stripped.lower() in ('new line', 'new line.'):
                body_lines.append('')
                line_items.append({'type': 'blank', 'line': line})
                continue

            if stripped.startswith('#'):
                comment = stripped[1:].strip()
                capo_match = CAPO_RE.match(comment)
                if capo_match:
                    capo_default = int(capo_match.group(1))
                    line_items.append({'type': 'capo', 'line': line, 'capo': capo_default})
                else:
                    comments.append(comment)
                    line_items.append({'type': 'comment', 'line': line, 'comment': comment})
                continue

            if not stripped:
                body_lines.append('')
                line_items.append({'type': 'blank', 'line': line})
                continue

            if STANZA_RE.match(stripped):
                line_items.append({'type': 'stanza_number', 'line': line, 'number': int(stripped)})
            elif line.startswith('  '):
                line_items.append({'type': 'chorus_line', 'line': line})
            else:
                line_items.append({'type': 'lyric_line', 'line': line})

            body_lines.append(line)

        body_chordpro = '\n'.join(body_lines).strip('\n')
        body_plain = _strip_chords(body_chordpro)

        tunes.append(
            {
                'index': tune_index,
                'tune_name': tune_name,
                'capo_default': capo_default,
                'comments': comments,
                'body_chordpro': body_chordpro,
                'body_plain': body_plain,
                'line_items': line_items,
                'raw_block': block,
            }
        )

    return {
        'format': 'songbase_lyrics_v1',
        'raw_text': normalized,
        'tune_count': len(tunes),
        'tunes': tunes,
    }
