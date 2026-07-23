const fs = require('fs');

function parseChordProBlocks(chordproText) {
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
    if (line.trim() === '') pushCurrentBlock();
    else currentLines.push(line.replace(/\r$/, ''));
  }
  pushCurrentBlock();
  return rawBlocks;
}

const data = JSON.parse(fs.readFileSync('/Users/david/Documents/projects/songpacketer/frontend/e2e/fixtures/song-packet-official.json', 'utf8'));
const matches = data.current_state.matches.filter(m => m.type !== 'section');
const song1 = matches[0];
const song18 = matches[17];

async function getLyricsFromApp() {
  // We can't access IndexedDB. We will just use regex to extract the lyrics if they exist, or simulate it.
}
