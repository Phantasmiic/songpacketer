import { objectiveTuple } from './optimizer.js';

export const PAGE_WIDTH = 612;
export const PAGE_HEIGHT = 792;
export const DEFAULT_MARGIN_TOP = 72;
export const DEFAULT_MARGIN_BOTTOM = 72;

/**
 * Single source of truth for layout evaluation.
 * Given prepared song layouts and an ordered list of song indices (or keys),
 * computes exact page, column, and Y coordinates for every song and stanza block.
 */
export function evaluateLayout(
  preparedLayouts,
  order,
  settings = {}
) {
  const top = settings.top ?? (PAGE_HEIGHT - DEFAULT_MARGIN_TOP);
  const bottom = settings.bottom ?? DEFAULT_MARGIN_BOTTOM;
  const usableHeight = top - bottom;
  const requireOnePagePerSong = settings.requireOnePagePerSong ?? false;

  let cursor = { page: 0, col: 0, y: top };
  const placements = [];
  let songPageSpillCount = 0;
  let stanzaPageSpillCount = 0;
  let stanzaColSpillCount = 0;
  let totalWhitespace = 0;

  for (let i = 0; i < order.length; i++) {
    const songKey = order[i];
    const songLayout = preparedLayouts[songKey];

    if (!songLayout) continue;

    if (songLayout.isSection) {
      placements.push({
        songKey,
        isSection: true,
        pageIndex: cursor.page,
        colIndex: cursor.col,
        startY: cursor.y,
        endY: cursor.y,
        blockPlacements: []
      });
      continue;
    }

    const { blocks, blockHeights, totalHeight: songHeight, lineHeight, forceNewPage } = songLayout;

    // Handle force_new_page directive
    if (forceNewPage && (cursor.col !== 0 || cursor.y < top)) {
      cursor.page += 1;
      cursor.col = 0;
      cursor.y = top;
    }

    // Rule: Single-column song fits in 1 column, but current column doesn't have room
    if (songHeight <= usableHeight && songHeight > (cursor.y - bottom)) {
      if (cursor.col === 0) {
        cursor.col = 1;
        cursor.y = top;
      } else {
        cursor.page += 1;
        cursor.col = 0;
        cursor.y = top;
      }
    }

    // Rule: Multi-column song or requireOnePagePerSong handling
    if (requireOnePagePerSong && songHeight <= 2 * usableHeight) {
      const free = cursor.y - bottom;
      const b0H = blocks.length > 0 ? blockHeights[0].reduce((s, h) => s + h, 0) : 0;
      const b1H = blocks.length > 1 ? blockHeights[1].reduce((s, h) => s + h, 0) : 0;
      const minStartH = Math.min(b0H + b1H, usableHeight);

      let effectiveRemaining;
      if (cursor.col === 0) {
        effectiveRemaining = free >= minStartH ? free + usableHeight : usableHeight;
      } else {
        effectiveRemaining = free;
      }

      if (songHeight > effectiveRemaining) {
        if (cursor.col === 0 && free < minStartH && songHeight <= usableHeight) {
          cursor.col = 1;
          cursor.y = top;
        } else {
          cursor.page += 1;
          cursor.col = 0;
          cursor.y = top;
        }
      }
    }

    const songStartPage = cursor.page;
    const songStartCol = cursor.col;
    const songStartY = cursor.y;
    const blockPlacements = [];
    const pagesTouched = new Set();

    pagesTouched.add(cursor.page);

    for (let bIndex = 0; bIndex < blocks.length; bIndex++) {
      const block = blocks[bIndex];
      const heights = blockHeights[bIndex];
      const blockTotalHeight = heights.reduce((s, h) => s + h, 0);
      const free = cursor.y - bottom;

      let requiredFit = blockTotalHeight;
      if (bIndex === 0 && blocks.length > 1) {
        const nextH = blockHeights[1].reduce((s, h) => s + h, 0);
        requiredFit = Math.min(blockTotalHeight + nextH, usableHeight);
      }

      if (requiredFit > free && cursor.y < top) {
        const prevCol = cursor.col;
        const prevPage = cursor.page;

        if (cursor.col === 0) {
          cursor.col = 1;
          cursor.y = top;
          stanzaColSpillCount += 1;
        } else {
          cursor.page += 1;
          cursor.col = 0;
          cursor.y = top;
          stanzaPageSpillCount += 1;
        }
        pagesTouched.add(cursor.page);
      }

      const blockStartPage = cursor.page;
      const blockStartCol = cursor.col;
      const blockStartY = cursor.y;

      for (let rIndex = 0; rIndex < heights.length; rIndex++) {
        const h = heights[rIndex];
        if (h > (cursor.y - bottom)) {
          if (cursor.col === 0) {
            cursor.col = 1;
            cursor.y = top;
            stanzaColSpillCount += 1;
          } else {
            cursor.page += 1;
            cursor.col = 0;
            cursor.y = top;
            stanzaPageSpillCount += 1;
          }
          pagesTouched.add(cursor.page);
        }
        cursor.y -= h;
      }

      blockPlacements.push({
        blockIndex: bIndex,
        pageIndex: blockStartPage,
        colIndex: blockStartCol,
        startY: blockStartY,
        endY: cursor.y,
        rows: block,
        heights
      });
    }

    if (pagesTouched.size > 1) {
      songPageSpillCount += 1;
    }

    const songEndPage = cursor.page;
    const songEndCol = cursor.col;
    const songEndY = cursor.y;

    placements.push({
      songKey,
      isSection: false,
      startPage: songStartPage,
      startCol: songStartCol,
      startY: songStartY,
      endPage: songEndPage,
      endCol: songEndCol,
      endY: songEndY,
      blockPlacements
    });

    const interSongSpacing = lineHeight * 2.0;
    cursor.y -= interSongSpacing;
  }

  const totalPages = cursor.page + 1;

  // Calculate whitespace
  totalWhitespace = (totalPages * 2 * usableHeight) - placements.reduce((sum, p) => {
    if (p.isSection) return sum;
    const songLayout = preparedLayouts[p.songKey];
    return sum + (songLayout ? songLayout.totalHeight : 0);
  }, 0);

  return {
    placements,
    stats: {
      pages: totalPages,
      song_page_spill: songPageSpillCount,
      stanza_page_spill: stanzaPageSpillCount,
      stanza_col_spill: stanzaColSpillCount,
      whitespace: Math.max(0, totalWhitespace)
    }
  };
}

/**
 * 2D Bin Packing & Column Packing Solver for layout optimization.
 * Packs songs within sections (or globally) to eliminate awkward empty gaps.
 */
export function solveBinPackedOrder(
  preparedLayouts,
  orderingMode = 'within_sections',
  settings = {},
  maxPermutations = 5000
) {
  const keys = Object.keys(preparedLayouts);
  if (keys.length <= 1 || orderingMode === 'original') {
    return keys;
  }

  if (orderingMode === 'within_sections') {
    const resultOrder = [];
    let currentSubGroup = [];

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (preparedLayouts[key].isSection) {
        if (currentSubGroup.length > 0) {
          const optimizedSub = optimizeSubGroup(preparedLayouts, currentSubGroup, settings, maxPermutations);
          resultOrder.push(...optimizedSub);
          currentSubGroup = [];
        }
        resultOrder.push(key);
      } else {
        currentSubGroup.push(key);
      }
    }

    if (currentSubGroup.length > 0) {
      const optimizedSub = optimizeSubGroup(preparedLayouts, currentSubGroup, settings, maxPermutations);
      resultOrder.push(...optimizedSub);
    }

    return resultOrder;
  }

  // 'global' mode
  const nonSectionKeys = keys.filter(k => !preparedLayouts[k].isSection);
  return optimizeSubGroup(preparedLayouts, nonSectionKeys, settings, maxPermutations);
}

function optimizeSubGroup(preparedLayouts, songKeys, settings, maxPermutations) {
  if (songKeys.length <= 1) return songKeys;

  // For small subgroups (<= 7 songs), evaluate all permutations
  // For larger subgroups, evaluate greedy heuristic packing permutations
  let candidateOrders = [];

  if (songKeys.length <= 7) {
    candidateOrders = permute(songKeys);
  } else {
    // Generate intelligent heuristic permutations:
    // 1. Original order
    // 2. Descending height (fit big songs first)
    // 3. Ascending height (fit small songs first)
    // 4. Alternating long/short songs (bin-packing heuristic)
    // 5. Random shuffles up to maxPermutations
    candidateOrders.push([...songKeys]);

    const sortedByHeight = [...songKeys].sort(
      (a, b) => preparedLayouts[b].totalHeight - preparedLayouts[a].totalHeight
    );
    candidateOrders.push(sortedByHeight);
    candidateOrders.push([...sortedByHeight].reverse());

    // Alternate long and short
    const alternating = [];
    let l = 0;
    let r = sortedByHeight.length - 1;
    while (l <= r) {
      if (l === r) {
        alternating.push(sortedByHeight[l]);
      } else {
        alternating.push(sortedByHeight[l]);
        alternating.push(sortedByHeight[r]);
      }
      l++;
      r--;
    }
    candidateOrders.push(alternating);

    // Add random shuffles
    for (let p = 0; p < Math.min(200, maxPermutations); p++) {
      const copy = [...songKeys];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      candidateOrders.push(copy);
    }
  }

  const priority = ['song_page_spill', 'pages', 'stanza_page_spill', 'stanza_col_spill', 'whitespace'];
  let bestOrder = candidateOrders[0];
  let bestEvaluation = evaluateLayout(preparedLayouts, bestOrder, settings);
  let bestTuple = objectiveTuple(bestEvaluation.stats, priority);

  for (let i = 1; i < candidateOrders.length; i++) {
    const order = candidateOrders[i];
    const evaluation = evaluateLayout(preparedLayouts, order, settings);
    const tuple = objectiveTuple(evaluation.stats, priority);

    let isBetter = false;
    for (let k = 0; k < tuple.length; k++) {
      if (tuple[k] < bestTuple[k]) {
        isBetter = true;
        break;
      } else if (tuple[k] > bestTuple[k]) {
        break;
      }
    }

    if (isBetter) {
      bestTuple = tuple;
      bestOrder = order;
      bestEvaluation = evaluation;
    }
  }

  return bestOrder;
}

function permute(arr) {
  if (arr.length <= 1) return [arr];
  const res = [];
  for (let i = 0; i < arr.length; i++) {
    const current = arr[i];
    const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
    const subPerms = permute(remaining);
    for (const sub of subPerms) {
      res.push([current, ...sub]);
    }
  }
  return res;
}
