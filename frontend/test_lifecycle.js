// Mock React lifecycle to see if textSizeMultiplier changes
let activeSongId = 14;
let showChords = false;
let fullSongMode = false;
let textSizeMultiplier = 1.0;

function setTextSizeMultiplier(val) {
  console.log(`setTextSizeMultiplier called with: ${val}`);
  textSizeMultiplier = val;
}

function handleAutoSize() {
  console.log(`handleAutoSize running (fullSongMode: ${fullSongMode})`);
  // simulate calculation
  setTextSizeMultiplier(1.8);
}

// simulate mount / dependencies change
let prevDeps = [];
function render(newDeps) {
  if (prevDeps[0] !== newDeps[0] || prevDeps[1] !== newDeps[1]) {
    console.log(`useEffect triggering...`);
    if (newDeps[0]) handleAutoSize();
    prevDeps = newDeps;
  }
}

console.log("Step 1: Navigate to song");
render([activeSongId, showChords]);
console.log(`textSizeMultiplier: ${textSizeMultiplier}`);

console.log("Step 2: Do full song");
fullSongMode = true;
render([activeSongId, showChords]);
console.log(`textSizeMultiplier: ${textSizeMultiplier}`);

console.log("Step 3: Undo full song");
fullSongMode = false;
render([activeSongId, showChords]);
console.log(`textSizeMultiplier: ${textSizeMultiplier}`);
