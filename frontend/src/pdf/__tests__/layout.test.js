import { describe, it, expect } from 'vitest';
import { splitIntoStanzaBlocks, rowHeight, prepareSongLayout } from '../layout';
import { wrappedSongRows } from '../wrapping';

const mockCtx = {
  measureText: (text) => text.length * 10
};

describe('splitIntoStanzaBlocks', () => {
  it('splits rows by blank lyric lines', () => {
    const rows = [
      { kind: 'song_number' },
      { kind: 'lyric', lyric: 'Line 1' },
      { kind: 'lyric', lyric: '' },
      { kind: 'lyric', lyric: 'Line 2' },
    ];
    const blocks = splitIntoStanzaBlocks(rows);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual([
      { kind: 'song_number' },
      { kind: 'lyric', lyric: 'Line 1' },
      { kind: 'lyric', lyric: '' }
    ]);
    expect(blocks[1]).toEqual([
      { kind: 'lyric', lyric: 'Line 2' }
    ]);
  });
});

describe('rowHeight', () => {
  it('returns correct height for different row kinds', () => {
    expect(rowHeight({ kind: 'song_number' }, 14)).toBeCloseTo(18.2); // max(14 * 1.3, 15 * 1.15) -> max(18.2, 17.25)
    expect(rowHeight({ kind: 'capo' }, 14)).toBeCloseTo(16.8); // 14 * 1.2
    expect(rowHeight({ kind: 'lyric', lyric: '' }, 14)).toBeCloseTo(19.6); // 14 * 1.4
    expect(rowHeight({ kind: 'lyric', lyric: 'hello' }, 14)).toBeCloseTo(14);
    expect(rowHeight({ kind: 'chord', chord: 'G', lyric: 'hello' }, 14)).toBeCloseTo(14);
  });
});

describe('prepareSongLayout', () => {
  it('calculates total height and block heights correctly', () => {
    const song = {
      title: 'Amazing Grace',
      capo: 0,
      lines: [
        { chord: 'G', lyric: 'Line 1' }
      ]
    };
    
    const layout = prepareSongLayout(mockCtx, song, 100, 11, 14, false);
    
    // Rows:
    // song_number -> 18.2
    // chord -> 14
    // lyric -> 14
    // total block height: 46.2
    // total height: 46.2 + 28 = 74.2
    
    expect(layout.blocks).toHaveLength(1);
    expect(layout.blockHeights).toEqual([[18.2, 14, 14]]);
    expect(layout.totalHeight).toBeCloseTo(74.2);
    expect(layout.fontSize).toBe(11);
    expect(layout.lineHeight).toBe(14);
  });

  it('handles sections appropriately', () => {
    const song = {
      is_section: true,
      title: 'Hymns',
    };
    
    const layout = prepareSongLayout(mockCtx, song, 100, 11, 14);
    expect(layout.totalHeight).toBe(0);
    expect(layout.blocks).toEqual([]);
  });
});
