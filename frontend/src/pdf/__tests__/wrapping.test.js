import { describe, it, expect } from 'vitest';
import { wrapTextToChars, wrapChordLyricPair, wrappedSongRows } from '../wrapping';

const mockCtx = {
  // Simple mock: 1 char = 10 units wide
  measureText: (text, fontName, fontSize) => text.length * 10
};

describe('wrapTextToChars', () => {
  it('returns single line if text fits', () => {
    // 5 chars = 50 width. Fits under 100.
    const result = wrapTextToChars(mockCtx, 'Hello', 'font', 10, 100);
    expect(result).toEqual(['Hello']);
  });

  it('wraps text at word boundaries', () => {
    // 19 chars = 190 width. Max 100.
    // "Hello world this is"
    // "Hello world" = 11 chars (110) - wait, "Hello " is 6, "world " is 6.
    // Let's use max width 110.
    const result = wrapTextToChars(mockCtx, 'Hello world this is', 'font', 10, 110);
    expect(result).toEqual([
      'Hello world', // 110
      'this is'      // 70
    ]);
  });

  it('forces split if word is longer than max width', () => {
    // "Supercalifragilistic" = 20 chars (200 width). Max 100 width.
    const result = wrapTextToChars(mockCtx, 'Supercalifragilistic', 'font', 10, 100);
    expect(result).toEqual([
      'Supercalif', // 100
      'ragilistic'  // 100
    ]);
  });
});

describe('wrapChordLyricPair', () => {
  it('wraps keeping chord and lyric aligned', () => {
    // max width 100 (10 chars)
    // chord: "G         C"
    // lyric: "Amazing grace"
    const chord = "G         C   ";
    const lyric = "Amazing grace ";
    
    const result = wrapChordLyricPair(mockCtx, chord, lyric, 'font', 10, 100);
    // 10 chars max.
    // "Amazing grace " is 14 chars. 
    // Word boundary before 10 chars: "Amazing " -> split at 7.
    expect(result).toEqual([
      { chord: 'G', lyric: 'Amazing' },
      { chord: '  C', lyric: 'grace' }
    ]);
  });

  it('forces split if no spaces available', () => {
    const chord = "123456789012345";
    const lyric = "abcdefghijklmno";
    const result = wrapChordLyricPair(mockCtx, chord, lyric, 'font', 10, 100);
    expect(result).toEqual([
      { chord: '1234567890', lyric: 'abcdefghij' },
      { chord: '12345', lyric: 'klmno' }
    ]);
  });

  it('skips aligned spaces at split', () => {
    const chord = "A    B    C";
    const lyric = "1    2    3";
    const result = wrapChordLyricPair(mockCtx, chord, lyric, 'font', 10, 10);
    // max 1 char. 
    expect(result).toEqual([
      { chord: 'A', lyric: '1' },
      { chord: 'B', lyric: '2' },
      { chord: 'C', lyric: '3' }
    ]);
  });
});

describe('wrappedSongRows', () => {
  it('wraps a song into rows', () => {
    const song = {
      capo: 3,
      lines: [
        { chord: 'G         C', lyric: 'Amazing grace' }
      ]
    };
    
    const rows = wrappedSongRows(mockCtx, song, 100, 10);
    // "Amazing" fits on first line, " grace" on second.
    expect(rows).toEqual([
      { kind: 'song_number' },
      { kind: 'capo' },
      { kind: 'chord', chord: 'G', lyric: 'Amazing' },
      { kind: 'lyric', lyric: 'Amazing' },
      { kind: 'chord', chord: '  C', lyric: 'grace' },
      { kind: 'lyric', lyric: 'grace' }
    ]);
  });
});
