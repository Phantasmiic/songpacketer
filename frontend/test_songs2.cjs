const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/Users/david/Documents/projects/songpacketer/frontend/e2e/fixtures/song-packet-official.json', 'utf8'));
const matches = data.current_state.matches.filter(m => m.type !== 'section');
const song1 = matches[0];
const song18 = matches[17];

console.log("Song 1:", song1.input);
console.log("Song 18:", song18.input);

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

function dump(song, name) {
  const rawText = song.chordproOverride || (song.versions && song.versions[0] ? song.versions[0].chordpro_text : '');
  const blocks = parseChordProBlocks(rawText);
  let maxLen = 0;
  for (const block of blocks) {
    for (const line of block.lines) {
      const text = line.lyric.replace(/\[[^\]]*\]/g, '');
      if (text.length > maxLen) maxLen = text.length;
    }
  }
  const calc = maxLen * 0.55;
  const colW = Math.max(16, Math.min(32, calc));
  console.log(`${name} maxLen: ${maxLen}, colW: ${colW}`);
}

dump(song1, "Song 1");
dump(song18, "Song 18");

