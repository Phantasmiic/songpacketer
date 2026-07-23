const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/Users/david/Documents/projects/songpacketer/frontend/e2e/fixtures/song-packet-official.json', 'utf8'));
const song1 = data.current_state.matches[0];
const song18 = data.current_state.matches[17];

console.log("Song 1:", song1.title || song1.input_text);
console.log("Song 18:", song18.title || song18.input_text);
