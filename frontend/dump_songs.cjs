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

function dump(song, name) {
  const rawText = song.chordproOverride || (song.versions && song.versions[0] ? song.versions[0].chordpro_text : '');
  const blocks = parseChordProBlocks(rawText);
  let maxLen = 0;
  console.log(`\n--- ${name}: ${song.input} ---`);
  let lineCount = 0;
  for (const block of blocks) {
    for (const line of block.lines) {
      const text = line.lyric.replace(/\[[^\]]*\]/g, '');
      if (text.length > maxLen) maxLen = text.length;
      if (lineCount < 5) console.log(text);
      lineCount++;
    }
  }
  const calculated = maxLen * 0.55;
  const colW = Math.max(16, Math.min(32, calculated));
  console.log(`... (${lineCount} total lines)`);
  console.log(`maxLen: ${maxLen}, calculated: ${calculated.toFixed(2)}, colW: ${colW.toFixed(2)}em`);
}

dump(song1, "Song 1");
dump(song18, "Song 18");
