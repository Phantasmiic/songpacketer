import { wrappedSongRows } from './wrapping';
import { songRows } from './chordpro';

const SONG_TITLE_FONT_SIZE = 15;

export function splitIntoStanzaBlocks(rows) {
  const blocks = [];
  let current = [];

  for (const row of rows) {
    current.push(row);
    if (row.kind === 'lyric' && row.lyric === '') {
      blocks.push(current);
      current = [];
    }
  }

  if (current.length > 0) {
    blocks.push(current);
  }

  return blocks;
}

export function rowHeight(row, lineHeight = 14.0) {
  if (row.kind === 'song_number') {
    return Math.max(lineHeight * 1.3, SONG_TITLE_FONT_SIZE * 1.15);
  }
  if (row.kind === 'capo') {
    return lineHeight * 1.2;
  }
  if (row.kind === 'lyric' && row.lyric === '') {
    return lineHeight * 1.4;
  }
  return lineHeight;
}

// prepareSongLayout definition follows

export function prepareSongLayout(
  ctx,
  song,
  columnWidth,
  baseFontSize,
  baseLineHeight,
  showSectionHeadersInBody = false,
  requireOnePagePerSong = false,
  usableHeight = 648
) {
  if (song.is_section) {
    if (!showSectionHeadersInBody) {
      return {
        isSection: true,
        rows: [],
        blocks: [],
        blockHeights: [],
        lineHeight: baseLineHeight,
        totalHeight: 0.0,
        fontSize: baseFontSize,
        forceNewPage: song.force_new_page || false
      };
    }
    const titleRow = { kind: 'section_title', content: song.title };
    const h = rowHeight(titleRow, baseLineHeight); // We will treat it as default lineHeight
    return {
      isSection: true,
      rows: [titleRow],
      blocks: [[titleRow]],
      blockHeights: [[h]],
      lineHeight: baseLineHeight,
      totalHeight: h + baseLineHeight,
      fontSize: SONG_TITLE_FONT_SIZE,
      forceNewPage: song.force_new_page || false
    };
  }

  let currentFontSize = baseFontSize;
  let baseRows = wrappedSongRows(ctx, song, columnWidth, currentFontSize);
  let needsWrap = baseRows.length > songRows(song).length;

  if (needsWrap && currentFontSize > 10) {
    currentFontSize = Math.max(8.0, currentFontSize - 1.0);
    baseRows = wrappedSongRows(ctx, song, columnWidth, currentFontSize);
  }

  let rows = baseRows;
  let lineHeight = Math.max(9.5, baseLineHeight * (currentFontSize / Math.max(baseFontSize, 1)));
  let blocks = splitIntoStanzaBlocks(rows);
  let blockHeights = blocks.map(block => block.map(row => rowHeight(row, lineHeight)));
  let totalHeight = blockHeights.reduce((sum, block) => {
    return sum + block.reduce((s, h) => s + h, 0);
  }, 0) + lineHeight;

  return {
    rows,
    blocks,
    blockHeights,
    lineHeight,
    totalHeight,
    fontSize: currentFontSize,
    forceNewPage: song.force_new_page || false
  };
}
