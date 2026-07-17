export function findLargestFitEnd(ctx, text, fontName, fontSize, start, hardEnd, maxWidth) {
  let lo = start + 1;
  let hi = hardEnd;
  let best = lo;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const seg = text.substring(start, mid).trimEnd();
    if (ctx.measureText(seg, fontName, fontSize) <= maxWidth) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

export function wrapTextToChars(ctx, text, fontName, fontSize, maxWidth) {
  if (text === '') return [''];
  if (ctx.measureText(text, fontName, fontSize) <= maxWidth) return [text];

  const wrapped = [];
  let start = 0;
  const n = text.length;

  while (start < n) {
    let fitEnd = findLargestFitEnd(ctx, text, fontName, fontSize, start, n, maxWidth);
    if (fitEnd <= start) {
      fitEnd = Math.min(start + 1, n);
    }
    let split = fitEnd;
    if (fitEnd < n) {
      const wordBoundary = text.lastIndexOf(' ', fitEnd);
      if (wordBoundary > start) {
        split = wordBoundary;
      }
    }

    const segment = text.substring(start, split).trimEnd();
    wrapped.push(segment);
    start = split;
    while (start < n && text[start] === ' ') {
      start++;
    }
  }

  return wrapped.length > 0 ? wrapped : [''];
}

export function wrapChordLyricPair(ctx, chord, lyric, fontName, fontSize, maxWidth) {
  const total = Math.max(chord.length, lyric.length, 1);
  const chordPad = chord.padEnd(total, ' ');
  const lyricPad = lyric.padEnd(total, ' ');
  const result = [];

  let start = 0;
  while (start < total) {
    let lo = start + 1;
    let hi = total;
    let best = lo;

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const chordSeg = chordPad.substring(start, mid).trimEnd();
      const lyricSeg = lyricPad.substring(start, mid).trimEnd();
      const width = Math.max(
        ctx.measureText(chordSeg, fontName, fontSize),
        ctx.measureText(lyricSeg, fontName, fontSize)
      );

      if (width <= maxWidth) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    let fitEnd = best > start ? best : Math.min(start + 1, total);
    let split = fitEnd;

    if (fitEnd < total) {
      const wordBoundary = lyricPad.lastIndexOf(' ', fitEnd);
      if (wordBoundary > start) {
        split = wordBoundary;
      }
    }

    result.push({
      chord: chordPad.substring(start, split).trimEnd(),
      lyric: lyricPad.substring(start, split).trimEnd()
    });
    
    start = split;
    while (start < total && lyricPad[start] === ' ' && chordPad[start] === ' ') {
      start++;
    }
  }

  return result.length > 0 ? result : [{ chord: '', lyric: '' }];
}

export function wrappedSongRows(ctx, song, columnWidth, fontSize) {
  const rows = [{ kind: 'song_number' }];
  if (song.capo > 0) {
    rows.push({ kind: 'capo' });
  }

  const FONT_NAME = 'font'; // Placeholder for now

  for (const line of song.lines) {
    if (line.chord) {
      const pairs = wrapChordLyricPair(ctx, line.chord, line.lyric, FONT_NAME, fontSize, columnWidth);
      for (const p of pairs) {
        rows.push({ kind: 'chord', chord: p.chord, lyric: p.lyric });
        rows.push({ kind: 'lyric', lyric: p.lyric });
      }
    } else {
      const lines = wrapTextToChars(ctx, line.lyric, FONT_NAME, fontSize, columnWidth);
      for (const l of lines) {
        rows.push({ kind: 'lyric', lyric: l });
      }
    }
  }

  return rows;
}
