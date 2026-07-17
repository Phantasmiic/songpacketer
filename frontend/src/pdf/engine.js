import { PDFDocument, StandardFonts } from 'pdf-lib';
import { chordproToLines } from './chordpro';
import { prepareSongLayout } from './layout';
import { optimizeSongOrder } from './optimizer';

const LYRIC_FONT_NAME = StandardFonts.Helvetica;
const CHORD_FONT_NAME = StandardFonts.HelveticaBold;
const TEXT_FONT_SIZE = 11;
const SONG_TITLE_FONT_SIZE = 15;
const LEFT_MARGIN = 72;   // 1.0in
const RIGHT_MARGIN = 36;  // 0.5in
const PAGE_WIDTH = 612;   // LETTER width (8.5 * 72)
const PAGE_HEIGHT = 792;  // LETTER height (11 * 72)

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
  maintainOriginalOrder = false,
  showSectionHeadersInBody = false,
  showSectionHeadersInIndex = true
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
    is_section: song.type === 'section'
  }));

  const vMargin = 72;
  const lineHeight = 14;
  const centerX = PAGE_WIDTH / 2.0;
  const leftColumnWidth = centerX - LEFT_MARGIN;
  const rightColumnWidth = PAGE_WIDTH - RIGHT_MARGIN - centerX;
  const columnWidth = Math.min(leftColumnWidth, rightColumnWidth);
  const top = PAGE_HEIGHT - vMargin;
  const bottom = vMargin;
  const usableHeight = top - bottom;

  const preparedLayouts = {};
  songsList.forEach((song, songIndex) => {
    preparedLayouts[songIndex] = prepareSongLayout(
      ctx, song, columnWidth, TEXT_FONT_SIZE, lineHeight, showSectionHeadersInBody
    );
  });

  const drawOrder = optimizeSongOrder(
    preparedLayouts, maintainOriginalOrder, top, bottom, usableHeight
  );

  const songNumberMap = {};
  let currentNumber = 1;
  for (const idx of drawOrder) {
    songNumberMap[idx] = currentNumber;
    currentNumber++;
  }

  let currentPageObj = null;

  function ensurePage() {
    if (!currentPageObj) {
      currentPageObj = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    }
  }

  // --- DRAW INDEX PAGES ---
  const entries = [];
  for (const idx of drawOrder) {
    const song = songsList[idx];
    if (song.is_section && !showSectionHeadersInIndex) continue;
    entries.push({ title: song.title, number: songNumberMap[idx], is_section: song.is_section });
  }
  
  entries.sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()));
  
  const indexTop = PAGE_HEIGHT - vMargin;
  const indexBottom = vMargin;
  const indexRightMargin = 72;
  const indexColWidth = PAGE_WIDTH - LEFT_MARGIN - indexRightMargin;
  let xPosition = LEFT_MARGIN;
  let yPosition = indexTop;

  // Simplistic index font scaling
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

  if (entries.length > 0) {
    ensurePage();
    currentPageObj.drawText('Song Index', { x: LEFT_MARGIN, y: yPosition, font: chordFont, size: 14 });
    yPosition -= lineHeight * 2.0;

    for (const entry of entries) {
      if (entry.is_section) {
        yPosition -= lineHeight * 0.5;
        if (yPosition < indexBottom) {
          currentPageObj = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
          yPosition = indexTop;
        }
        currentPageObj.drawText(entry.title, { x: xPosition, y: yPosition, font: chordFont, size: chosenFont });
        yPosition -= lineHeight;
        continue;
      }

      const rightLabel = `Song ${entry.number}`;
      const rightWidth = ctx.measureText(rightLabel, 'lyric', chosenFont);
      const rightX = xPosition + indexColWidth - rightWidth;
      const minGap = 8.0;

      const titleMaxWidth = Math.max(rightX - xPosition - minGap * 2, 40.0);
      
      // Simple truncation
      let titleText = entry.title;
      while (ctx.measureText(titleText, 'lyric', chosenFont) > titleMaxWidth && titleText.length > 1) {
        titleText = titleText.substring(0, titleText.length - 1);
      }

      const titleWidth = ctx.measureText(titleText, 'lyric', chosenFont);
      const dotStartX = xPosition + titleWidth + minGap;
      const dotEndX = rightX - minGap;

      currentPageObj.drawText(titleText, { x: xPosition, y: yPosition, font: lyricFont, size: chosenFont });
      
      const dotWidth = Math.max(ctx.measureText('.', 'lyric', chosenFont), 0.001);
      const dotsWidth = Math.max(dotEndX - dotStartX, 0.0);
      const dotCount = Math.floor(dotsWidth / dotWidth);
      if (dotCount > 0) {
        currentPageObj.drawText('.'.repeat(dotCount), { x: dotStartX, y: yPosition, font: lyricFont, size: chosenFont });
      }
      
      currentPageObj.drawText(rightLabel, { x: rightX, y: yPosition, font: lyricFont, size: chosenFont });
      yPosition -= entryLineSpacing;
    }
  }

  // --- DRAW SONGS ---
  let cursor = { page: 0, col: 0, y: top };
  let currentLogicPage = -1; // -1 forces new page immediately for songs

  let songPageSpill = 0;

  function xForCol(col) {
    return col === 0 ? LEFT_MARGIN : centerX;
  }

  function drawSongPageMarker(pageIndex) {
    const text = `S${pageIndex + 1}`;
    const tw = ctx.measureText(text, 'chord', 10);
    currentPageObj.drawText(text, { x: PAGE_WIDTH / 2.0 - tw / 2.0, y: vMargin / 2, font: chordFont, size: 10 });
  }

  for (const songIndex of drawOrder) {
    const song = songsList[songIndex];
    const songNumber = songNumberMap[songIndex];
    const songLayout = preparedLayouts[songIndex];
    const { blocks, lineHeight: songLineHeight, fontSize: songFontSize, totalHeight: songHeight } = songLayout;

    if (song.is_section) {
      if (!showSectionHeadersInBody) continue;
      
      if (cursor.y - bottom < songHeight) {
        if (cursor.col === 0) {
          cursor.col = 1; cursor.y = top;
        } else {
          cursor.page += 1; cursor.col = 0; cursor.y = top;
        }
      }
      if (cursor.page !== currentLogicPage) {
        currentPageObj = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        currentLogicPage = cursor.page;
        drawSongPageMarker(currentLogicPage);
      }
      
      currentPageObj.drawText(`${songNumber}. ${song.title}`, { x: xForCol(cursor.col), y: cursor.y, font: chordFont, size: SONG_TITLE_FONT_SIZE });
      cursor.y -= lineHeight;
      continue;
    }

    if (song.force_new_page && (cursor.col !== 0 || cursor.y < top)) {
      cursor.page += 1;
      cursor.col = 0;
      cursor.y = top;
    }

    if (songHeight <= usableHeight && songHeight > (cursor.y - bottom)) {
      if (cursor.col === 0) {
        cursor.col = 1; cursor.y = top;
      } else {
        cursor.page += 1; cursor.col = 0; cursor.y = top;
      }
    }

    if (cursor.page !== currentLogicPage) {
      currentPageObj = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      currentLogicPage = cursor.page;
      drawSongPageMarker(currentLogicPage);
    }

    const renderedPages = new Set();

    for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
      const block = blocks[blockIndex];
      const blockHeights = songLayout.blockHeights[blockIndex];
      const blockHeight = blockHeights.reduce((s, h) => s + h, 0);
      const free = cursor.y - bottom;

      if (blockHeight <= usableHeight && blockHeight > free) {
        if (cursor.col === 0) {
          cursor.col = 1; cursor.y = top;
        } else {
          cursor.page += 1; cursor.col = 0; cursor.y = top;
        }
        if (cursor.page !== currentLogicPage) {
          currentPageObj = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
          currentLogicPage = cursor.page;
          drawSongPageMarker(currentLogicPage);
        }
      }

      for (let rowIndex = 0; rowIndex < block.length; rowIndex++) {
        const row = block[rowIndex];
        const h = blockHeights[rowIndex];

        if (h > (cursor.y - bottom)) {
          if (cursor.col === 0) {
            cursor.col = 1; cursor.y = top;
          } else {
            cursor.page += 1; cursor.col = 0; cursor.y = top;
          }
          if (cursor.page !== currentLogicPage) {
            currentPageObj = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
            currentLogicPage = cursor.page;
            drawSongPageMarker(currentLogicPage);
          }
        }

        const currentX = xForCol(cursor.col);
        const currentY = cursor.y;

        function drawBoldText(xPos, yPos, txt, size) {
          currentPageObj.drawText(txt, { x: xPos, y: yPos, font: chordFont, size });
          // Pseudo-bold stroke logic removed for pdf-lib since we have HelveticaBold
        }

        if (row.kind === 'song_number') {
          drawBoldText(currentX, currentY, `Song ${songNumber}`, SONG_TITLE_FONT_SIZE);
        } else if (row.kind === 'capo') {
          currentPageObj.drawText(`Capo ${song.capo}`, { x: currentX, y: currentY, font: lyricFont, size: TEXT_FONT_SIZE });
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
          currentPageObj.drawText(row.lyric, { x: currentX, y: currentY, font: lyricFont, size: songFontSize });
        }

        renderedPages.add(cursor.page);
        cursor.y -= h;
      }
    }

    cursor.y -= songLineHeight;
    if (renderedPages.size > 1) {
      songPageSpill += 1;
    }
  }

  const pdfBytes = await doc.save();
  return {
    blob: new Blob([pdfBytes], { type: 'application/pdf' }),
    stats: {
      pages: currentLogicPage + 1,
      songSpills: songPageSpill
    }
  };
}
