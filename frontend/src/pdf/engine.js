import { PDFDocument, StandardFonts } from 'pdf-lib';
import { chordproToLines } from './chordpro';
import { prepareSongLayout } from './layout';
import { evaluateLayout, solveBinPackedOrder, PAGE_WIDTH, PAGE_HEIGHT, DEFAULT_MARGIN_TOP, DEFAULT_MARGIN_BOTTOM } from './layoutSolver';

const LYRIC_FONT_NAME = StandardFonts.Helvetica;
const CHORD_FONT_NAME = StandardFonts.HelveticaBold;
const TEXT_FONT_SIZE = 11;
const SONG_TITLE_FONT_SIZE = 15;
const LEFT_MARGIN = 72;   // 1.0in
const RIGHT_MARGIN = 36;  // 0.5in

class PdfLibContext {
  constructor(lyricFont, chordFont) {
    this.lyricFont = lyricFont;
    this.chordFont = chordFont;
  }

  measureText(text, fontName, fontSize) {
    if (!text) return 0;
    const font = fontName === 'chord' ? this.chordFont : this.lyricFont;
    return font.widthOfTextAtSize(text, fontSize);
  }
}

function extractChordRuns(chordLine) {
  const runs = [];
  let i = 0;
  const n = chordLine.length;
  while (i < n) {
    if (chordLine[i] === ' ') {
      i++;
      continue;
    }
    const start = i;
    while (i < n && chordLine[i] !== ' ') {
      i++;
    }
    runs.push([start, chordLine.substring(start, i)]);
  }
  return runs;
}

export async function renderSongPacketPdf(
  songsData,
  orderingMode = 'within_sections',
  showSectionHeadersInIndex = true,
  requireOnePagePerSong = false,
  showPageNumbers = true,
  startingPageNumber = 1,
  pageNumberPrefix = 'S',
  pdfFontSize = 11
) {
  const doc = await PDFDocument.create();
  const lyricFont = await doc.embedFont(LYRIC_FONT_NAME);
  const chordFont = await doc.embedFont(CHORD_FONT_NAME);

  const ctx = new PdfLibContext(lyricFont, chordFont);

  // Map input songs into RenderedSong models
  const songsList = songsData.map(song => ({
    title: song.title || song.title_override || song.song_title || 'Untitled',
    key: song.key || '',
    capo: song.capo || 0,
    lines: chordproToLines(song.chordpro_override || song.chordpro_text || ''),
    force_new_page: song.force_new_page || false,
    is_section: song.type === 'section',
    is_unassigned: song.type === 'section' && (song.id === 'unassigned' || song.isUnassigned)
  }));

  const vMargin = DEFAULT_MARGIN_BOTTOM;
  const userFontSize = Math.max(6, Math.min(24, pdfFontSize || TEXT_FONT_SIZE));
  const lineHeight = userFontSize * (14.0 / 11.0);
  const centerX = PAGE_WIDTH / 2.0;
  const leftColumnWidth = centerX - LEFT_MARGIN;
  const rightColumnWidth = PAGE_WIDTH - RIGHT_MARGIN - centerX;
  const columnWidth = Math.min(leftColumnWidth, rightColumnWidth);
  const top = PAGE_HEIGHT - DEFAULT_MARGIN_TOP;
  const bottom = vMargin;
  const usableHeight = top - bottom;

  const preparedLayouts = {};
  songsList.forEach((song, songIndex) => {
    preparedLayouts[songIndex] = prepareSongLayout(
      ctx, song, columnWidth, userFontSize, lineHeight, requireOnePagePerSong, usableHeight
    );
  });

  const solverMode = (orderingMode === true || orderingMode === 'original') ? 'original' : (orderingMode || 'within_sections');
  const drawOrder = solveBinPackedOrder(preparedLayouts, solverMode, { top, bottom, usableHeight, requireOnePagePerSong });
  const layoutEval = evaluateLayout(preparedLayouts, drawOrder, { top, bottom, usableHeight, requireOnePagePerSong });

  const songNumberMap = {};
  let currentNumber = 1;
  for (const idx of drawOrder) {
    const song = songsList[idx];
    if (song && song.is_section) continue;
    songNumberMap[idx] = currentNumber;
    currentNumber++;
  }

  const pagesMap = {};

  function getOrCreatePage(pageIndex) {
    if (!pagesMap[pageIndex]) {
      pagesMap[pageIndex] = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    }
    return pagesMap[pageIndex];
  }

  function xForCol(col) {
    return col === 0 ? LEFT_MARGIN : centerX;
  }

  function drawSongPageMarker(pageObj, songPageIndex) {
    if (!showPageNumbers) return;
    const pageNum = (startingPageNumber || 1) + songPageIndex;
    const prefix = pageNumberPrefix !== undefined ? pageNumberPrefix : 'S';
    const text = `${prefix}${pageNum}`;
    const tw = ctx.measureText(text, 'chord', 10);
    pageObj.drawText(text, { x: PAGE_WIDTH / 2.0 - tw / 2.0, y: vMargin / 2, font: chordFont, size: 10 });
  }

  // --- DRAW INDEX PAGES ---
  const isGlobalOptimization = orderingMode === 'global';
  const entries = [];
  for (const idx of drawOrder) {
    const song = songsList[idx];
    if (song.is_section && (!showSectionHeadersInIndex || isGlobalOptimization || song.is_unassigned)) continue;
    entries.push({ title: song.title, number: songNumberMap[idx], is_section: song.is_section });
  }

  const indexTop = PAGE_HEIGHT - vMargin;
  const indexBottom = vMargin;
  const indexRightMargin = 72;
  const indexColWidth = PAGE_WIDTH - LEFT_MARGIN - indexRightMargin;
  let xPosition = LEFT_MARGIN;
  let yPosition = indexTop;

  let chosenFont = TEXT_FONT_SIZE;
  let chosenSpacing = 6.0;
  const availableHeight = Math.max((indexTop - indexBottom) - (lineHeight * 2.0), 1.0);
  const entryCount = Math.max(entries.length, 1);

  let fitFound = false;
  let font = TEXT_FONT_SIZE;
  while (font >= 10.0) {
    if (entryCount * (font + 6.0) <= availableHeight) {
      chosenFont = font;
      chosenSpacing = 6.0;
      fitFound = true;
      break;
    }
    font -= 0.25;
  }
  if (!fitFound) {
    font = 10.0;
    let spacing = 6.0;
    while (spacing >= 0) {
      if (entryCount * (font + spacing) <= availableHeight) {
        chosenFont = font;
        chosenSpacing = spacing;
        fitFound = true;
        break;
      }
      spacing -= 0.25;
    }
  }
  if (!fitFound) {
    font = 10.0;
    while (font > 1.0) {
      if (entryCount * font <= availableHeight) {
        chosenFont = font;
        chosenSpacing = 0.0;
        fitFound = true;
        break;
      }
      font -= 0.25;
    }
  }

  const entryLineSpacing = chosenFont + chosenSpacing;

  let indexPageCount = 0;

  if (entries.length > 0) {
    let currentIndexPageIndex = 0;
    const indexPageObj = getOrCreatePage(currentIndexPageIndex);
    indexPageObj.drawText('Song Index', { x: LEFT_MARGIN, y: yPosition, font: chordFont, size: 14 });
    yPosition -= lineHeight * 2.0;

    for (const entry of entries) {
      if (entry.is_section) {
        yPosition -= lineHeight * 0.5;
        if (yPosition < indexBottom) {
          currentIndexPageIndex += 1;
          const pageObj = getOrCreatePage(currentIndexPageIndex);
          yPosition = indexTop;
          pageObj.drawText(entry.title, { x: xPosition, y: yPosition, font: chordFont, size: chosenFont });
        } else {
          const pageObj = getOrCreatePage(currentIndexPageIndex);
          pageObj.drawText(entry.title, { x: xPosition, y: yPosition, font: chordFont, size: chosenFont });
        }
        yPosition -= lineHeight;
        continue;
      }

      if (yPosition < indexBottom) {
        currentIndexPageIndex += 1;
        yPosition = indexTop;
      }

      const activeIndexPage = getOrCreatePage(currentIndexPageIndex);
      const rightLabel = `Song ${entry.number}`;
      const rightWidth = ctx.measureText(rightLabel, 'lyric', chosenFont);
      const rightX = xPosition + indexColWidth - rightWidth;
      const minGap = 8.0;

      const titleMaxWidth = Math.max(rightX - xPosition - minGap * 2, 40.0);

      let titleText = entry.title;
      while (ctx.measureText(titleText, 'lyric', chosenFont) > titleMaxWidth && titleText.length > 1) {
        titleText = titleText.substring(0, titleText.length - 1);
      }

      const titleWidth = ctx.measureText(titleText, 'lyric', chosenFont);
      const dotStartX = xPosition + titleWidth + minGap;
      const dotEndX = rightX - minGap;

      activeIndexPage.drawText(titleText, { x: xPosition, y: yPosition, font: lyricFont, size: chosenFont });

      const dotWidth = Math.max(ctx.measureText('.', 'lyric', chosenFont), 0.001);
      const dotsWidth = Math.max(dotEndX - dotStartX, 0.0);
      const dotCount = Math.floor(dotsWidth / dotWidth);
      if (dotCount > 0) {
        activeIndexPage.drawText('.'.repeat(dotCount), { x: dotStartX, y: yPosition, font: lyricFont, size: chosenFont });
      }

      activeIndexPage.drawText(rightLabel, { x: rightX, y: yPosition, font: lyricFont, size: chosenFont });
      yPosition -= entryLineSpacing;
    }

    indexPageCount = currentIndexPageIndex + 1;
  }

  // --- DRAW SONGS DIRECTLY FROM SOLVER PLACEMENTS ---
  const markedSongPages = new Set();

  for (const placement of layoutEval.placements) {
    if (placement.isSection) continue;

    const songIndex = placement.songKey;
    const song = songsList[songIndex];
    const songNumber = songNumberMap[songIndex];
    const songLayout = preparedLayouts[songIndex];
    const songFontSize = songLayout.fontSize;

    for (const bPlacement of placement.blockPlacements) {
      const songPdfPageIndex = bPlacement.pageIndex + indexPageCount;
      const pageObj = getOrCreatePage(songPdfPageIndex);

      if (!markedSongPages.has(songPdfPageIndex)) {
        markedSongPages.add(songPdfPageIndex);
        drawSongPageMarker(pageObj, bPlacement.pageIndex);
      }

      const currentX = xForCol(bPlacement.colIndex);
      let currentY = bPlacement.startY;

      function drawBoldText(xPos, yPos, txt, size) {
        pageObj.drawText(txt, { x: xPos, y: yPos, font: chordFont, size });
      }

      for (let rIndex = 0; rIndex < bPlacement.rows.length; rIndex++) {
        const row = bPlacement.rows[rIndex];
        const h = bPlacement.heights[rIndex];

        if (row.kind === 'song_number') {
          drawBoldText(currentX, currentY, `Song ${songNumber}`, SONG_TITLE_FONT_SIZE);
        } else if (row.kind === 'capo') {
          pageObj.drawText(`Capo ${song.capo}`, { x: currentX, y: currentY, font: lyricFont, size: TEXT_FONT_SIZE });
        } else if (row.kind === 'chord') {
          let lastRightX = currentX;
          for (const [anchorIdx, chordText] of extractChordRuns(row.chord)) {
            const lyricPrefix = row.lyric.substring(0, Math.min(anchorIdx, row.lyric.length));
            let targetX = currentX + ctx.measureText(lyricPrefix, 'lyric', songFontSize);
            targetX = Math.max(targetX, lastRightX);
            drawBoldText(targetX, currentY, chordText, songFontSize);
            lastRightX = targetX + ctx.measureText(chordText, 'chord', songFontSize) + 1.0;
          }
        } else {
          pageObj.drawText(row.lyric, { x: currentX, y: currentY, font: lyricFont, size: songFontSize });
        }

        currentY -= h;
      }
    }
  }

  const pdfBytes = await doc.save();
  const maxPageIdx = Math.max(0, ...Object.keys(pagesMap).map(Number));

  return {
    blob: new Blob([pdfBytes], { type: 'application/pdf' }),
    stats: {
      pages: maxPageIdx + 1,
      songSpills: layoutEval.stats.song_page_spill
    }
  };
}
