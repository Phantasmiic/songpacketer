import { describe, it } from 'vitest';
import fs from 'fs';
import { chordproToLines } from '../chordpro.js';
import { prepareSongLayout } from '../layout.js';
import { optimizeSongOrder } from '../optimizer.js';

describe('Investigate Song Packet Layout', () => {
  it('simulates pagination for song packet official.json', () => {
    const dummyCtx = {
      measureText: (text, fontType, fontSize) => text.length * fontSize * 0.55
    };

    const packetData = JSON.parse(fs.readFileSync('/Users/david/Downloads/song packet official.json', 'utf8'));
    const matches = packetData.current_state.matches;

    console.log(`Loaded ${matches.length} items from matches.`);

    const songsList = matches.map((song, idx) => ({
      idx,
      title: song.titleOverride || song.title || 'Untitled',
      chordpro: song.defaultChordpro || song.chordpro_override || '',
      lines: chordproToLines(song.defaultChordpro || song.chordpro_override || ''),
      force_new_page: song.force_new_page || false,
      is_section: song.type === 'section',
      is_unassigned: song.type === 'section' && (song.id === 'unassigned' || song.isUnassigned)
    }));

    const PAGE_WIDTH = 612;
    const PAGE_HEIGHT = 792;
    const vMargin = 72;
    const LEFT_MARGIN = 54;
    const RIGHT_MARGIN = 54;
    const centerX = PAGE_WIDTH / 2.0;
    const leftColumnWidth = centerX - LEFT_MARGIN;
    const rightColumnWidth = PAGE_WIDTH - RIGHT_MARGIN - centerX;
    const columnWidth = Math.min(leftColumnWidth, rightColumnWidth);
    const top = PAGE_HEIGHT - vMargin;
    const bottom = vMargin;
    const usableHeight = top - bottom;
    const pdfFontSize = 11;
    const userFontSize = Math.max(6, Math.min(24, pdfFontSize));
    const lineHeight = userFontSize * (14.0 / 11.0);
    const requireOnePagePerSong = true;
    const maintainOriginalOrder = true;

    console.log(`Settings: maintainOriginalOrder=${maintainOriginalOrder}, requireOnePagePerSong=${requireOnePagePerSong}`);

    const preparedLayouts = {};
    songsList.forEach((song, songIndex) => {
      let layout = prepareSongLayout(
        dummyCtx, song, columnWidth, userFontSize, lineHeight, requireOnePagePerSong, usableHeight
      );

      // If requireOnePagePerSong is enabled, try shrinking font size (down to 9pt) so the song fits in a single 1-column height (usableHeight) if close
      if (requireOnePagePerSong && !song.is_section && layout.totalHeight > usableHeight) {
        let fSize = userFontSize;
        while (fSize > 9.0) {
          fSize -= 0.5;
          const candidateLh = fSize * (14.0 / 11.0);
          const candidateLayout = prepareSongLayout(
            dummyCtx, song, columnWidth, fSize, candidateLh, requireOnePagePerSong, usableHeight
          );
          if (candidateLayout.totalHeight <= usableHeight) {
            layout = candidateLayout;
            break;
          }
        }
      }

      preparedLayouts[songIndex] = layout;
    });

    const drawOrder = optimizeSongOrder(
      preparedLayouts, maintainOriginalOrder, top, bottom, usableHeight
    );

    const songNumberMap = {};
    let currentNumber = 1;
    for (const idx of drawOrder) {
      const song = songsList[idx];
      if (song && song.is_section) continue;
      songNumberMap[idx] = currentNumber;
      currentNumber++;
    }

    console.log("Draw order items:", drawOrder.map(i => `${i}:${songsList[i].is_section ? 'SEC:'+songsList[i].title : songsList[i].title}`));

    let cursor = { page: 0, col: 0, y: top };

    console.log('\n--- DETAILED SONG MAPPING & PAGINATION (WITH PROPOSED FIX) ---');
    for (const songIndex of drawOrder) {
      const song = songsList[songIndex];
      const songNumber = songNumberMap[songIndex];
      const songLayout = preparedLayouts[songIndex];
      const { blocks, totalHeight: songHeight } = songLayout;

      if (song.is_section) {
        console.log(`[SECTION HEADER] "${song.title}" (idx ${songIndex})`);
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

      if (requireOnePagePerSong && songHeight <= 2 * usableHeight) {
        const free = cursor.y - bottom;
        const b0H = blocks.length > 0 ? songLayout.blockHeights[0].reduce((s, h) => s + h, 0) : 0;
        const b1H = blocks.length > 1 ? songLayout.blockHeights[1].reduce((s, h) => s + h, 0) : 0;
        const minStartH = Math.min(b0H + b1H, usableHeight);

        let effectiveRemaining;
        if (cursor.col === 0) {
          effectiveRemaining = free >= minStartH ? free + usableHeight : usableHeight;
        } else {
          effectiveRemaining = free;
        }

        if (songHeight > effectiveRemaining) {
          if (cursor.col === 0 && free < minStartH && songHeight <= usableHeight) {
            cursor.col = 1; cursor.y = top;
          } else {
            cursor.page += 1; cursor.col = 0; cursor.y = top;
          }
        }
      }

      const actualStartPage = cursor.page;
      const actualStartCol = cursor.col;
      const actualStartY = cursor.y;

      // Simulate rendering blocks
      for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
        const block = blocks[blockIndex];
        const blockHeights = songLayout.blockHeights[blockIndex];

        for (let rowIndex = 0; rowIndex < block.length; rowIndex++) {
          const h = blockHeights[rowIndex];
          if (h > (cursor.y - bottom)) {
            if (cursor.col === 0) {
              cursor.col = 1; cursor.y = top;
            } else {
              cursor.page += 1; cursor.col = 0; cursor.y = top;
            }
          }
          cursor.y -= h;
        }
      }
      cursor.y -= songLayout.lineHeight * 2.0;

      console.log(`Song #${String(songNumber).padStart(2)} (idx ${String(songIndex).padStart(2)}, font=${songLayout.fontSize}pt, h=${songHeight.toFixed(1).padStart(5)}pt): "${song.title}" -> start(P${actualStartPage+1}, C${actualStartCol}, Y${actualStartY.toFixed(1)}) | end(P${cursor.page+1}, C${cursor.col}, Y${cursor.y.toFixed(1)})`);
    }
  });
});
