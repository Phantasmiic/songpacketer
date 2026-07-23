const fs = require('fs');

function parseChordProBlocks(chordproText, paginationOptions = null) {
  if (!chordproText) return [];
  const lines = chordproText.split('\n');
  const rawBlocks = [];
  let currentLines = [];
  
  function pushCurrentBlock() {
    if (currentLines.length > 0) {
      rawBlocks.push({ lines: currentLines.map(l => ({ lyric: l })), type: 'verse', label: '' });
      currentLines = [];
    }
  }

  for (const line of lines) {
    if (line.trim() === '') {
      pushCurrentBlock();
    } else {
      currentLines.push(line.replace(/\r$/, ''));
    }
  }
  pushCurrentBlock();

  const finalBlocks = [];
  for (const block of rawBlocks) {
    if (paginationOptions && paginationOptions.availablePx) {
      const { availablePx, lyricHeightPx, chordHeightPx, showChords, availableWidthPx, fontSizePx } = paginationOptions;
      
      const lineHeights = block.lines.map(line => {
        const rawStr = typeof line === 'string' ? line : (line?.lyric || '');
        const hasChord = showChords && (typeof line === 'string' ? line.includes('[') : Boolean(line?.chord));
        const baseHeight = hasChord ? lyricHeightPx + chordHeightPx : lyricHeightPx;

        if (availableWidthPx && fontSizePx) {
          const pureText = rawStr.replace(/\[[^\]]*\]/g, '').replace(/^(verse\s*\d*[:\.\)]?\s*|v\s*\d+[:\.\)]?\s*|chorus\s*\d*[:\.\)]?\s*|bridge\s*\d*[:\.\)]?\s*|\d+[:\.\)]?\s+)/i, '');
          const estWidth = pureText.length * fontSizePx * 0.53;
          const wrapFactor = Math.max(1, Math.ceil(estWidth / availableWidthPx));
          return baseHeight + (wrapFactor - 1) * lyricHeightPx;
        }
        return baseHeight;
      });

      const totalHeight = lineHeights.reduce((a, b) => a + b, 0);

      if (totalHeight <= availablePx) {
        finalBlocks.push(block);
      } else {
        let currentChunk = [];
        let currentChunkHeight = 0;
        let chunkIndex = 1;

        for (let i = 0; i < block.lines.length; i++) {
          const line = block.lines[i];
          const h = lineHeights[i];

          if (currentChunkHeight + h > availablePx && currentChunk.length > 0) {
            finalBlocks.push({ ...block, lines: currentChunk, label: `${block.label} (${chunkIndex}/...)` });
            currentChunk = [line];
            currentChunkHeight = h;
            chunkIndex++;
          } else {
            currentChunk.push(line);
            currentChunkHeight += h;
          }
        }
        if (currentChunk.length > 0) {
          finalBlocks.push({ ...block, lines: currentChunk, label: `${block.label} (${chunkIndex}/...)` });
        }
      }
    } else {
      finalBlocks.push(block);
    }
  }
  return finalBlocks;
}

const data = JSON.parse(fs.readFileSync('/Users/david/Documents/projects/songpacketer/frontend/e2e/fixtures/song-packet-official.json', 'utf8'));
const song14 = data.current_state.matches[13];
const rawText = song14.chordpro_override || song14.defaultChordpro || '';
const rawBlocks = parseChordProBlocks(rawText, null);

const wh = 800;
const ww = 1400;
const availableWidthPx = Math.max(300, ww - 48);
const availablePx = wh - 240;
const showChords = false;

let bestMultiplier = 1.0;
let minSplits = Infinity;

for (let m = 3.5; m >= 1.0; m -= 0.1) {
  const baseFontSizePx = (4.5 * wh / 100) * m;
  const lyricHeightPx = (baseFontSizePx * 1.5) + 8;
  const chordHeightPx = (baseFontSizePx * 0.8) + 8;
  
  const paginationOptions = { 
    availablePx, 
    lyricHeightPx, 
    chordHeightPx, 
    showChords,
    availableWidthPx,
    fontSizePx: baseFontSizePx
  };
  const paginatedBlocks = parseChordProBlocks(rawText, paginationOptions);
  const numSplits = paginatedBlocks.length;
  
  if (numSplits < minSplits) {
    minSplits = numSplits;
    bestMultiplier = m;
  }
}
console.log("bestMultiplier:", Math.round(bestMultiplier * 10) / 10);
