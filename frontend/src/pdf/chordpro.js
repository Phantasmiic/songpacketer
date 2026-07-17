export function chordproToLines(chordproText) {
  if (!chordproText) return [];
  const rendered = [];
  const lines = chordproText.split('\n');

  for (let rawLine of lines) {
    // python rstrip('\n') equivalent
    // Note: split('\n') already removes the newline, but we'll trim carriage returns just in case
    const line = rawLine.replace(/\r$/, '');
    
    if (!line.trim()) {
      rendered.push({ chord: '', lyric: '' });
      continue;
    }

    const chordPositions = {};
    const lyricChars = [];
    let pos = 0;
    let i = 0;

    while (i < line.length) {
      if (line[i] === '[') {
        const end = line.indexOf(']', i);
        if (end > i) {
          const chord = line.substring(i + 1, end).trim();
          if (chord) {
            if (!chordPositions[pos]) chordPositions[pos] = [];
            chordPositions[pos].push(chord);
          }
          i = end + 1;
          continue;
        }
      }
      lyricChars.push(line[i]);
      pos += 1;
      i += 1;
    }

    const lyric = lyricChars.join('');
    
    // Calculate max_end to know how long the chord line needs to be
    let maxEnd = lyric.length;
    for (const p of Object.keys(chordPositions)) {
      const position = parseInt(p, 10);
      const text = chordPositions[p].join('/');
      if (position + text.length > maxEnd) {
        maxEnd = position + text.length;
      }
    }

    const chordLine = new Array(Math.max(1, maxEnd)).fill(' ');
    
    for (const p of Object.keys(chordPositions)) {
      const position = parseInt(p, 10);
      const text = chordPositions[p].join('/');
      const cursor = Math.max(position, 0);
      
      for (let offset = 0; offset < text.length; offset++) {
        const idx = cursor + offset;
        // Expand array if needed
        while (idx >= chordLine.length) {
          chordLine.push(' ');
        }
        chordLine[idx] = text[offset];
      }
    }

    const chord = chordLine.join('').replace(/\s+$/, ''); // equivalent to python rstrip()
    rendered.push({ chord, lyric });
  }

  return rendered;
}

export function songRows(song) {
  const rows = [{ kind: 'song_number' }];
  
  if (song.capo > 0) {
    rows.push({ kind: 'capo' });
  }

  for (const line of song.lines) {
    if (line.chord) {
      rows.push({ kind: 'chord', chord: line.chord, lyric: line.lyric });
    }
    rows.push({ kind: 'lyric', lyric: line.lyric });
  }

  return rows;
}
