import fs from 'fs';
import { parseChordProBlocks } from './src/presentation/chordproParser.js';

const data = JSON.parse(fs.readFileSync('/Users/david/Documents/projects/songpacketer/frontend/e2e/fixtures/song-packet-official.json', 'utf8'));
const song14 = data.current_state.matches[13]; // 0-indexed, so 13 is song 14
console.log("Song Title:", song14.titleOverride || song14.input);

const rawText = song14.chordpro_override || song14.defaultChordpro || '';
const rawBlocks = parseChordProBlocks(rawText, null);

const wh = 836;
const ww = 1470;
const availableWidthPx = Math.max(300, ww - 48);
const availablePx = wh - 240;
const showChords = false;

let bestMultiplier = 1.0;
let minSplits = Infinity;
let minLineWraps = Infinity;

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
  
  let totalLineWraps = 0;
  for (const block of rawBlocks) {
    for (const line of block.lines) {
      const rawStr = typeof line === 'string' ? line : (line?.lyric || '');
      const pureText = rawStr.replace(/\[[^\]]*\]/g, '').replace(/^(verse\s*\d*[:\.\)]?\s*|v\s*\d+[:\.\)]?\s*|chorus\s*\d*[:\.\)]?\s*|bridge\s*\d*[:\.\)]?\s*|\d+[:\.\)]?\s+)/i, '');
      const estWidth = pureText.length * baseFontSizePx * 0.53;
      const wraps = Math.max(0, Math.ceil(estWidth / availableWidthPx) - 1);
      totalLineWraps += wraps;
    }
  }

  if (numSplits < minSplits) {
    minSplits = numSplits;
    minLineWraps = totalLineWraps;
    bestMultiplier = m;
  } else if (numSplits === minSplits) {
    if (totalLineWraps < minLineWraps) {
      minLineWraps = totalLineWraps;
      bestMultiplier = m;
    }
  }
}

console.log("bestMultiplier:", Math.round(bestMultiplier * 10) / 10);
