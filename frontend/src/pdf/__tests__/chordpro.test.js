import { describe, it, expect } from 'vitest';
import { chordproToLines, songRows } from '../chordpro';

describe('chordproToLines', () => {
  it('handles empty string', () => {
    expect(chordproToLines('')).toEqual([]);
  });

  it('handles lyrics without chords', () => {
    const input = 'Amazing grace, how sweet the sound';
    expect(chordproToLines(input)).toEqual([
      { chord: '', lyric: 'Amazing grace, how sweet the sound' }
    ]);
  });

  it('extracts chords and aligns them correctly with spaces', () => {
    const input = '[G]Amazing grace, how [C]sweet the [G]sound';
    const lines = chordproToLines(input);
    expect(lines).toHaveLength(1);
    expect(lines[0].lyric).toEqual('Amazing grace, how sweet the sound');
    // 'Amazing grace, how ' is 19 chars long.
    // 'G' is at index 0. 'C' is at index 19.
    // 'sweet the ' is 10 chars long. 'G' is at 19+10 = 29.
    expect(lines[0].chord).toEqual('G                  C         G');
  });

  it('pads spaces when a chord is longer than the lyric it sits above', () => {
    const input = '[G#dim]Oh [C]boy';
    const lines = chordproToLines(input);
    expect(lines).toHaveLength(1);
    expect(lines[0].lyric).toEqual('Oh boy');
    // So the chord text will force the line to be padded but not shift the lyric.
    expect(lines[0].chord).toEqual('G#dCm'); 
  });

  it('handles multiple lines', () => {
    const input = '[G]Line one\n[C]Line two';
    const lines = chordproToLines(input);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({ chord: 'G', lyric: 'Line one' });
    expect(lines[1]).toEqual({ chord: 'C', lyric: 'Line two' });
  });

  it('preserves blank lines', () => {
    const input = '[G]Line one\n\n[C]Line two';
    const lines = chordproToLines(input);
    expect(lines).toHaveLength(3);
    expect(lines[0]).toEqual({ chord: 'G', lyric: 'Line one' });
    expect(lines[1]).toEqual({ chord: '', lyric: '' });
    expect(lines[2]).toEqual({ chord: 'C', lyric: 'Line two' });
  });
});

describe('songRows', () => {
  it('converts lines into row objects', () => {
    const lines = [
      { chord: 'G', lyric: 'Line one' },
      { chord: '', lyric: '' },
      { chord: '', lyric: 'Just lyric' }
    ];
    const song = {
      capo: 0,
      lines
    };
    
    const rows = songRows(song);
    expect(rows).toEqual([
      { kind: 'song_number' },
      { kind: 'chord', chord: 'G', lyric: 'Line one' },
      { kind: 'lyric', lyric: 'Line one' },
      { kind: 'lyric', lyric: '' },
      { kind: 'lyric', lyric: 'Just lyric' }
    ]);
  });

  it('inserts capo row if capo > 0', () => {
    const song = {
      capo: 3,
      lines: []
    };
    const rows = songRows(song);
    expect(rows).toEqual([
      { kind: 'song_number' },
      { kind: 'capo' }
    ]);
  });
});
