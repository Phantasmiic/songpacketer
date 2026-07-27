import { readFileSync } from 'fs';
import { chordproToLines } from './src/pdf/chordpro.js';
import { prepareSongLayout } from './src/pdf/layout.js';
import { optimizeSongOrder } from './src/pdf/optimizer.js';

const raw = JSON.parse(readFileSync('/Users/david/Downloads/song packet official.json', 'utf8'));
const matches = raw.current_state.matches;

const songsData = matches
  .filter((row) => row.type === 'section' || row.selectedSongId)
  .map((row) => {
    if (row.type === 'section') {
      return { type: 'section', title: row.title, force_new_page: false };
    }
    return {
      type: 'song',
      title: row.titleOverride || row.input || 'Untitled',
      key: '',
      capo: row.capo || 0,
      chordpro_text: row.defaultChordpro || '',
      force_new_page: false,
    };
  });

const songsList = songsData.map((song) => ({
  title: song.title || 'Untitled',
  key: song.key || '',
  capo: song.capo || 0,
  lines: chordproToLines(song.chordpro_text || ''),
  force_new_page: song.force_new_page || false,
  is_section: song.type === 'section',
  is_unassigned: false,
}));

const requireOnePagePerSong = true;
const maintainOriginalOrder = true;
const showSectionHeadersInBody = false;
const pdfFontSize = 11;
const SONG_TITLE_FONT_SIZE = 15;
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const LEFT_MARGIN = 36;
const RIGHT_MARGIN = 36;
const vMargin = 72;
const userFontSize = Math.max(6, Math.min(24, pdfFontSize));
const lineHeight = userFontSize * (14.0 / 11.0);
const centerX = PAGE_WIDTH / 2.0;
const leftColumnWidth = centerX - LEFT_MARGIN;
const rightColumnWidth = PAGE_WIDTH - RIGHT_MARGIN - centerX;
const columnWidth = Math.min(leftColumnWidth, rightColumnWidth);
const top = PAGE_HEIGHT - vMargin;
const bottom = vMargin;
const usableHeight = top - bottom;

class MockCtx {
  measureText(text, fontType, fontSize) {
    return text.length * fontSize * 0.5;
  }
}

const ctx = new MockCtx();
const preparedLayouts = {};
songsList.forEach((song, songIndex) => {
  preparedLayouts[songIndex] = prepareSongLayout(
    ctx,
    song,
    columnWidth,
    userFontSize,
    lineHeight,
    showSectionHeadersInBody,
    requireOnePagePerSong,
    usableHeight
  );
});

const drawOrder = optimizeSongOrder(
  preparedLayouts,
  maintainOriginalOrder,
  top,
  bottom,
  usableHeight,
  40,
  ['song_page_spill', 'pages', 'stanza_page_spill', 'stanza_col_spill'],
  requireOnePagePerSong
);

const songNumberMap = {};
let currentNumber = 1;
for (const idx of drawOrder) {
  const song = songsList[idx];
  if (song && song.is_section) continue;
  songNumberMap[idx] = currentNumber;
  currentNumber++;
}

let cursor = { page: 0, col: 0, y: top };
let currentLogicPage = -1;
const songPositions = {};

for (const songIndex of drawOrder) {
  const song = songsList[songIndex];
  const songNumber = songNumberMap[songIndex];
  const songLayout = preparedLayouts[songIndex];
  const { blocks, lineHeight: songLineHeight, totalHeight: songHeight } = songLayout;
  if (song.is_section) continue;

  const titleHeight = SONG_TITLE_FONT_SIZE + lineHeight;
  const firstBlockHeight = blocks.length > 0 ? songLayout.blockHeights[0].reduce((s, h) => s + h, 0) : 0;
  const requiredTitleSpace = titleHeight + firstBlockHeight;

  if (requireOnePagePerSong) {
    const remainingPageSpace = cursor.col === 0 ? (cursor.y - bottom) + usableHeight : (cursor.y - bottom);
    const isStartOfFreshPage = (cursor.col === 0 && cursor.y === top);
    if (songHeight > remainingPageSpace && !isStartOfFreshPage) {
      cursor.page += 1;
      cursor.col = 0;
      cursor.y = top;
    } else if (cursor.y < top && (cursor.y - bottom) < requiredTitleSpace) {
      if (cursor.col === 0) {
        cursor.col = 1;
        cursor.y = top;
      } else {
        cursor.page += 1;
        cursor.col = 0;
        cursor.y = top;
      }
    }
  }

  if (cursor.page !== currentLogicPage) currentLogicPage = cursor.page;

  let titlePos = null;
  let firstContentPos = null;

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const block = blocks[blockIndex];
    const blockHeights = songLayout.blockHeights[blockIndex];
    const blockHeight = blockHeights.reduce((s, h) => s + h, 0);
    const free = cursor.y - bottom;

    if (blockHeight <= usableHeight && blockHeight > free) {
      if (cursor.col === 0) {
        cursor.col = 1;
        cursor.y = top;
      } else {
        cursor.page += 1;
        cursor.col = 0;
        cursor.y = top;
      }
      if (cursor.page !== currentLogicPage) currentLogicPage = cursor.page;
    }

    for (let rowIndex = 0; rowIndex < block.length; rowIndex++) {
      const row = block[rowIndex];
      const h = blockHeights[rowIndex];
      if (row.kind === 'song_number') {
        titlePos = { page: cursor.page, col: cursor.col, y: cursor.y };
      }
      if (!firstContentPos && row.kind !== 'song_number' && row.kind !== 'capo') {
        firstContentPos = { page: cursor.page, col: cursor.col, y: cursor.y };
      }
      cursor.y -= h;
    }
  }

  cursor.y -= songLineHeight;
  songPositions[songNumber] = { title: song.title, titlePos, firstContentPos, totalHeight: songHeight };
}

const song5 = songPositions[5];
console.log(JSON.stringify(song5, null, 2));
