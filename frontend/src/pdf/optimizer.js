class PRNG {
  constructor(seed) {
    this.seed = seed;
  }
  random() {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }
  uniform(min, max) {
    return min + this.random() * (max - min);
  }
  randrange(min, max) {
    return Math.floor(this.uniform(min, max));
  }
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.randrange(0, i + 1);
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
  sample(rangeMax, k) {
    const arr = Array.from({ length: rangeMax }, (_, i) => i);
    this.shuffle(arr);
    return arr.slice(0, k);
  }
}

export function objectiveTuple(
  metrics,
  priority = ['song_page_spill', 'pages', 'stanza_page_spill', 'stanza_col_spill']
) {
  return priority.map(name => metrics[name]);
}

function compareTuples(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return 0;
}

export function simulateOrderMetrics(order, prepared, top, bottom, usableHeight) {
  let page = 0;
  let col = 0;
  let y = top;
  
  let whitespace = 0.0;
  let stanzaPageSpill = 0;
  let stanzaColSpill = 0;
  let songPageSpill = 0;

  function moveNextColumn() {
    whitespace += Math.max(y - bottom, 0.0);
    if (col === 0) {
      col = 1;
      y = top;
    } else {
      page += 1;
      col = 0;
      y = top;
    }
  }

  function moveToNextPage() {
    whitespace += Math.max(y - bottom, 0.0);
    if (col === 0) {
      whitespace += usableHeight;
    }
    page += 1;
    col = 0;
    y = top;
  }

  for (const songIndex of order) {
    const songLayout = prepared[songIndex];

    if (songLayout.forceNewPage && (col !== 0 || y < top)) {
      moveToNextPage();
    }

    if (songLayout.totalHeight <= usableHeight && songLayout.totalHeight > (y - bottom)) {
      moveNextColumn();
    }

    const renderedPages = new Set();
    
    for (let blockIndex = 0; blockIndex < songLayout.blocks.length; blockIndex++) {
      const block = songLayout.blocks[blockIndex];
      const blockHeights = songLayout.blockHeights[blockIndex];
      const blockHeight = blockHeights.reduce((sum, h) => sum + h, 0);
      let free = y - bottom;

      if (blockHeight <= usableHeight && blockHeight > free) {
        moveNextColumn();
      }

      for (let rowIndex = 0; rowIndex < block.length; rowIndex++) {
        const h = blockHeights[rowIndex];
        if (h > (y - bottom)) {
          const previousPage = page;
          const previousCol = col;
          moveNextColumn();
          if (page !== previousPage) {
            stanzaPageSpill += 1;
          } else if (col !== previousCol) {
            stanzaColSpill += 1;
          }
        }
        renderedPages.add(page);
        y -= h;
      }
    }

    y -= songLayout.lineHeight;
    if (renderedPages.size > 1) {
      songPageSpill += 1;
    }
  }

  whitespace += Math.max(y - bottom, 0.0);
  return {
    pages: page + 1,
    stanza_page_spill: stanzaPageSpill,
    stanza_col_spill: stanzaColSpill,
    song_page_spill: songPageSpill,
    whitespace: whitespace
  };
}

function estimateFreeAfterSong(songLayout, top, bottom, usableHeight) {
  let page = 0;
  let col = 0;
  let y = top;

  function moveNextColumn() {
    if (col === 0) {
      col = 1;
    } else {
      page += 1;
      col = 0;
    }
    y = top;
  }

  for (let blockIndex = 0; blockIndex < songLayout.blocks.length; blockIndex++) {
    const block = songLayout.blocks[blockIndex];
    const blockHeights = songLayout.blockHeights[blockIndex];
    const blockHeight = blockHeights.reduce((sum, h) => sum + h, 0);
    let free = y - bottom;

    if (blockHeight <= usableHeight && blockHeight > free) {
      moveNextColumn();
    }

    for (let rowIndex = 0; rowIndex < block.length; rowIndex++) {
      const h = blockHeights[rowIndex];
      if (h > (y - bottom)) {
        moveNextColumn();
      }
      y -= h;
    }
  }
  y -= songLayout.lineHeight;
  return Math.max(y - bottom, 0.0);
}

function buildStructuredSeed(prepared, usableHeight, top, bottom, rng) {
  const indices = Object.keys(prepared);
  if (indices.length === 0) return [];

  const longLimit = usableHeight * 2.0;
  const longIds = indices.filter(idx => prepared[idx].totalHeight > longLimit);
  const otherIds = indices.filter(idx => !longIds.includes(idx));

  rng.shuffle(longIds);
  otherIds.sort((a, b) => prepared[b].totalHeight - prepared[a].totalHeight);

  const remaining = new Set(otherIds);
  const order = [];

  for (const longId of longIds) {
    order.push(longId);
    let free = estimateFreeAfterSong(prepared[longId], top, bottom, usableHeight);
    
    while (true) {
      let candidates = Array.from(remaining).filter(idx => prepared[idx].totalHeight <= free);
      if (candidates.length === 0) break;
      
      candidates.sort((a, b) => prepared[b].totalHeight - prepared[a].totalHeight);
      const chosen = rng.random() < 0.85 ? candidates[0] : candidates[candidates.length - 1];
      
      order.push(chosen);
      remaining.delete(chosen);
      free -= prepared[chosen].totalHeight;
    }
  }

  const leftovers = Array.from(remaining).sort((a, b) => prepared[b].totalHeight - prepared[a].totalHeight);
  order.push(...leftovers);
  return order;
}

export function optimizeSongOrder(
  prepared,
  maintainOriginalOrder,
  top,
  bottom,
  usableHeight,
  bucketAttempts = 40,
  objectivePriority = ['song_page_spill', 'pages', 'stanza_page_spill', 'stanza_col_spill']
) {
  const indices = Object.keys(prepared);
  if (maintainOriginalOrder || indices.length < 2) {
    return indices;
  }

  const wrappedDesc = [...indices].sort((a, b) => prepared[b].totalHeight - prepared[a].totalHeight);
  const rng = new PRNG(7);

  function refine(seedOrder, iterations) {
    let localBestOrder = [...seedOrder];
    let localBestMetrics = simulateOrderMetrics(localBestOrder, prepared, top, bottom, usableHeight);
    
    for (let iter = 0; iter < iterations; iter++) {
      const candidate = [...localBestOrder];
      let i, j;
      if (rng.random() < 0.7) {
        i = rng.randrange(0, candidate.length - 1);
        j = i + 1;
      } else {
        const sample = rng.sample(candidate.length, 2).sort((a, b) => a - b);
        i = sample[0];
        j = sample[1];
      }
      
      [candidate[i], candidate[j]] = [candidate[j], candidate[i]];

      const metrics = simulateOrderMetrics(candidate, prepared, top, bottom, usableHeight);
      
      if (compareTuples(objectiveTuple(metrics, objectivePriority), objectiveTuple(localBestMetrics, objectivePriority)) < 0) {
        localBestOrder = candidate;
        localBestMetrics = metrics;
      }
    }
    return [localBestOrder, localBestMetrics];
  }

  const seedOrders = [wrappedDesc, indices];
  for (let i = 0; i < 10; i++) {
    const shuffled = [...indices];
    rng.shuffle(shuffled);
    seedOrders.push(shuffled);
  }
  for (let i = 0; i < 25; i++) {
    seedOrders.push(buildStructuredSeed(prepared, usableHeight, top, bottom, rng));
  }

  const iterations = Math.min(2400, Math.max(600, indices.length * 50));
  let globalBestOrder = wrappedDesc;
  let globalBestMetrics = simulateOrderMetrics(globalBestOrder, prepared, top, bottom, usableHeight);

  const scoredSeeds = seedOrders.map(seed => {
    const metrics = simulateOrderMetrics(seed, prepared, top, bottom, usableHeight);
    return { obj: objectiveTuple(metrics, objectivePriority), seed, metrics };
  });

  scoredSeeds.sort((a, b) => compareTuples(a.obj, b.obj));

  for (let i = 0; i < Math.min(6, scoredSeeds.length); i++) {
    const seed = scoredSeeds[i].seed;
    const [candidateOrder, candidateMetrics] = refine(seed, iterations);
    
    if (compareTuples(objectiveTuple(candidateMetrics, objectivePriority), objectiveTuple(globalBestMetrics, objectivePriority)) < 0) {
      globalBestOrder = candidateOrder;
      globalBestMetrics = candidateMetrics;
    }
  }

  return globalBestOrder;
}
