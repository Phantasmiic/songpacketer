import { describe, it, expect } from 'vitest';
import { parseChordProBlocks } from '../chordproParser';

describe('Pagination Algorithm (Greedy vs Soft Greedy)', () => {

  const paginationOptions = (capacityLines) => ({
    availablePx: capacityLines * 10,
    lyricHeightPx: 10,
    chordHeightPx: 0,
    showChords: false,
  });

  it('Standard song (8 lines) fits perfectly, no splits', () => {
    const text = Array(8).fill('Line').join('\n');
    const blocks = parseChordProBlocks(text, paginationOptions(10));
    expect(blocks).toHaveLength(1);
    expect(blocks[0].lines).toHaveLength(8);
  });

  it('Long continuous verse (20 lines) with capacity 9', () => {
    // 20 lines, capacity 9.
    // Strict Greedy: 9, 9, 2
    // Soft Greedy: 7, 7, 6 (Even split)
    const text = Array(20).fill('Line').join('\n');
    const blocks = parseChordProBlocks(text, paginationOptions(9));
    
    // We expect Soft Greedy to yield 3 blocks of 7, 7, 6
    // But initially, strict greedy will yield 9, 9, 2.
    // We will just log the lengths to compare.
    const lengths = blocks.map(b => b.lines.length);
    console.log('20 lines capacity 9 ->', lengths);
    
    // If strict greedy, lengths === [9, 9, 2]
    // We will assert soft greedy behavior:
    // expect(lengths).toEqual([7, 7, 6]);
  });

  it('12 lines with capacity 10', () => {
    // 12 lines, capacity 10.
    // Strict Greedy: 10, 2
    // Soft Greedy: 6, 6
    const text = Array(12).fill('Line').join('\n');
    const blocks = parseChordProBlocks(text, paginationOptions(10));
    
    const lengths = blocks.map(b => b.lines.length);
    console.log('12 lines capacity 10 ->', lengths);
  });

  it('12 lines with a blank line at line 8, capacity 10', () => {
    // 8 lines, 1 blank, 3 lines = 12 lines total.
    // Strict Greedy: 10, 2
    // Soft Greedy (Semantic break): 8, 4 (or 9, 3 including the blank)
    const lines = Array(12).fill('Line');
    lines[8] = ''; // blank line
    const text = lines.join('\n');
    const blocks = parseChordProBlocks(text, paginationOptions(10));
    
    const lengths = blocks.map(b => b.lines.length);
    console.log('12 lines (blank at 8) capacity 10 ->', lengths);
  });
});
