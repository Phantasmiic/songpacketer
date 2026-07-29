import { describe, it, expect } from 'vitest';
import { evaluateLayout, solveBinPackedOrder } from '../layoutSolver.js';

describe('layoutSolver', () => {
  it('evaluates placement coordinates deterministically', () => {
    const preparedLayouts = {
      0: {
        totalHeight: 100,
        blocks: [[{ kind: 'lyric', lyric: 'hello' }]],
        blockHeights: [[100]],
        lineHeight: 14,
        fontSize: 11,
        forceNewPage: false
      },
      1: {
        totalHeight: 200,
        blocks: [[{ kind: 'lyric', lyric: 'world' }]],
        blockHeights: [[200]],
        lineHeight: 14,
        fontSize: 11,
        forceNewPage: false
      }
    };

    const evaluation = evaluateLayout(preparedLayouts, ['0', '1'], { top: 720, bottom: 72 });
    expect(evaluation.stats.pages).toBe(1);
    expect(evaluation.placements.length).toBe(2);

    const song0 = evaluation.placements[0];
    expect(song0.startPage).toBe(0);
    expect(song0.startCol).toBe(0);
    expect(song0.startY).toBe(720);
    expect(song0.endY).toBe(620); // 720 - 100

    const song1 = evaluation.placements[1];
    expect(song1.startPage).toBe(0);
    expect(song1.startCol).toBe(0);
    expect(song1.startY).toBe(592); // 620 - 28 (inter-song spacing)
    expect(song1.endY).toBe(392); // 592 - 200
  });

  it('packs short songs efficiently into 2 columns on a single page', () => {
    // Column usable height is 648pt (top=720, bottom=72)
    // Song 0: 400pt
    // Song 1: 400pt
    // Song 2: 200pt
    // Without bin packing: Song 0 (col 0, free 248), Song 1 doesn't fit in 248 -> goes to Col 1 (free 248).
    // Song 2 fits in Col 0 (200 <= 248)!
    const preparedLayouts = {
      0: { totalHeight: 400, blocks: [[{}]], blockHeights: [[400]], lineHeight: 14, fontSize: 11 },
      1: { totalHeight: 400, blocks: [[{}]], blockHeights: [[400]], lineHeight: 14, fontSize: 11 },
      2: { totalHeight: 200, blocks: [[{}]], blockHeights: [[200]], lineHeight: 14, fontSize: 11 }
    };

    const optimizedOrder = solveBinPackedOrder(preparedLayouts, 'global', { top: 720, bottom: 72 });
    const evaluation = evaluateLayout(preparedLayouts, optimizedOrder, { top: 720, bottom: 72 });

    // All 3 songs fit on 1 page!
    expect(evaluation.stats.pages).toBe(1);
  });

  it('preserves section boundaries in within_sections mode', () => {
    const preparedLayouts = {
      0: { isSection: true },
      1: { totalHeight: 300, blocks: [[{}]], blockHeights: [[300]], lineHeight: 14, fontSize: 11 },
      2: { isSection: true },
      3: { totalHeight: 300, blocks: [[{}]], blockHeights: [[300]], lineHeight: 14, fontSize: 11 }
    };

    const optimizedOrder = solveBinPackedOrder(preparedLayouts, 'within_sections', { top: 720, bottom: 72 });
    expect(optimizedOrder[0]).toBe('0');
    expect(optimizedOrder[1]).toBe('1');
    expect(optimizedOrder[2]).toBe('2');
    expect(optimizedOrder[3]).toBe('3');
  });
});
