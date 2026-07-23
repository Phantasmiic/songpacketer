import fs from 'fs';
import { parseChordProBlocks } from './src/presentation/chordproParser.js';

// MOCK the missing pdf/chordpro module which is imported by chordproParser.js but not used for parseChordProBlocks
import { Module } from 'module';
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  if (id.includes('pdf/chordpro')) {
    return {};
  }
  return originalRequire.apply(this, arguments);
};

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
