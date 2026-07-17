import { describe, it, expect } from 'vitest';
import { objectiveTuple, simulateOrderMetrics, optimizeSongOrder } from '../optimizer';

describe('objectiveTuple', () => {
  it('extracts metrics in priority order', () => {
    const metrics = {
      pages: 4,
      stanza_page_spill: 2,
      stanza_col_spill: 1,
      song_page_spill: 0,
      whitespace: 100
    };
    const priority = ['song_page_spill', 'pages', 'stanza_page_spill', 'stanza_col_spill'];
    expect(objectiveTuple(metrics, priority)).toEqual([0, 4, 2, 1]);
  });
});

describe('simulateOrderMetrics', () => {
  it('calculates metrics correctly for a single song fitting in one column', () => {
    const prepared = {
      0: {
        totalHeight: 100,
        blocks: [[{}]],
        blockHeights: [[100]],
        lineHeight: 14,
        forceNewPage: false
      }
    };
    
    // Top = 700, Bottom = 50 -> usable = 650
    const metrics = simulateOrderMetrics([0], prepared, 700, 50, 650);
    expect(metrics.pages).toBe(1);
    expect(metrics.song_page_spill).toBe(0);
    expect(metrics.stanza_page_spill).toBe(0);
    expect(metrics.stanza_col_spill).toBe(0);
  });

  it('detects stanza col spill', () => {
    // A block of 400. Usable is 300.
    // It will be placed. It exceeds usable, so cursor moves to next col mid-block.
    const prepared = {
      0: {
        totalHeight: 400,
        blocks: [[{}, {}]],
        blockHeights: [[200, 200]],
        lineHeight: 14,
        forceNewPage: false
      }
    };
    const metrics = simulateOrderMetrics([0], prepared, 700, 400, 300);
    expect(metrics.stanza_col_spill).toBe(1); // It spilled!
  });
});

describe('optimizeSongOrder', () => {
  it('maintains original order if requested', () => {
    const prepared = {
      0: { totalHeight: 100 },
      1: { totalHeight: 200 }
    };
    const order = optimizeSongOrder(prepared, true, 700, 50, 650);
    expect(order).toEqual(['0', '1']);
  });

  it('optimizes order to minimize spills', () => {
    // 0: total 600 (fits exactly in one col if started at top)
    // 1: total 100
    // If order is [1, 0], 1 takes 100. 0 takes 600, so it spills into col 2.
    // Optimizer should prefer [0, 1] to avoid spill!
    const prepared = {
      0: {
        totalHeight: 600,
        blocks: [[{}]],
        blockHeights: [[600]],
        lineHeight: 14,
        forceNewPage: false
      },
      1: {
        totalHeight: 100,
        blocks: [[{}]],
        blockHeights: [[100]],
        lineHeight: 14,
        forceNewPage: false
      }
    };
    
    // Usable is 650.
    const order = optimizeSongOrder(prepared, false, 700, 50, 650, 10);
    expect(order).toEqual(['0', '1']);
  });
});
