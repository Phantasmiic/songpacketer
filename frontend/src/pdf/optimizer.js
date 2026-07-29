import { evaluateLayout, solveBinPackedOrder } from './layoutSolver.js';

export function objectiveTuple(
  metrics,
  priority = ['song_page_spill', 'pages', 'stanza_page_spill', 'stanza_col_spill']
) {
  return priority.map(name => metrics[name]);
}

/**
 * Evaluates order metrics using the single-source-of-truth layout solver.
 */
export function simulateOrderMetrics(order, prepared, top, bottom, usableHeight) {
  const result = evaluateLayout(prepared, order, { top, bottom, usableHeight });
  return result.stats;
}

/**
 * Optimizes song order using the 2D Column Bin-Packing solver.
 */
export function optimizeSongOrder(
  prepared,
  orderingMode = 'within_sections',
  top,
  bottom,
  usableHeight,
  bucketAttempts = 40,
  objectivePriority = ['song_page_spill', 'pages', 'stanza_page_spill', 'stanza_col_spill']
) {
  const mode = (orderingMode === true || orderingMode === 'original') ? 'original' : (orderingMode || 'within_sections');
  return solveBinPackedOrder(prepared, mode, { top, bottom, usableHeight }, bucketAttempts);
}
