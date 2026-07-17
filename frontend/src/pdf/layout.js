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
  showSectionHeadersInBody = false
) {
  if (song.is_section) {
    if (!showSectionHeadersInBody) {
      return {
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
      rows: [titleRow],
      blocks: [[titleRow]],
      blockHeights: [[h]],
      lineHeight: baseLineHeight,
      totalHeight: h + baseLineHeight,
      fontSize: SONG_TITLE_FONT_SIZE,
      forceNewPage: song.force_new_page || false
    };
  }

  const baseRows = wrappedSongRows(ctx, song, columnWidth, baseFontSize);
  const needsWrap = baseRows.length > songRows(song).length;
  
  const fontSize = needsWrap ? Math.max(1.0, baseFontSize - 1.0) : baseFontSize;
  const rows = needsWrap ? wrappedSongRows(ctx, song, columnWidth, fontSize) : baseRows;
  
  const lineHeight = baseLineHeight - (baseFontSize - fontSize);
  const blocks = splitIntoStanzaBlocks(rows);
  const blockHeights = blocks.map(block => block.map(row => rowHeight(row, lineHeight)));
  
  const totalHeight = blockHeights.reduce((sum, block) => {
    return sum + block.reduce((s, h) => s + h, 0);
  }, 0) + lineHeight;

  return {
    rows,
    blocks,
    blockHeights,
    lineHeight,
    totalHeight,
    fontSize,
    forceNewPage: song.force_new_page || false
  };
}
