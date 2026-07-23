const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Go to the dev server
  await page.goto('http://localhost:5173');
  
  // Wait for the app to load
  await page.waitForSelector('text=Import');
  
  // Set up the file chooser to import the file
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('text=Import').click()
  ]);
  
  await fileChooser.setFiles('/Users/david/Documents/projects/songpacketer/frontend/e2e/fixtures/song-packet-official.json');
  
  // Wait for the import to finish (toast message or loading false)
  await page.waitForSelector('text=Packet imported successfully', { timeout: 10000 }).catch(() => {});
  
  // Execute JS to get the optimal width directly from the app's IndexedDB data!
  const result = await page.evaluate(async () => {
    // Expose a helper to parse and compute optimal column width
    function getWidth(rawText) {
      const lines = rawText.split('\n');
      let maxLen = 0;
      for (const line of lines) {
        if (!line.trim()) continue;
        let text = line.replace(/\[[^\]]*\]/g, ''); // strip chords
        if (text.length > maxLen) maxLen = text.length;
      }
      const calculated = maxLen * 0.55;
      return {
        maxLen,
        calculated,
        optimal: Math.max(16, Math.min(32, calculated))
      };
    }

    const dbName = 'songpacketer-db';
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName);
      request.onsuccess = (event) => {
        const db = event.target.result;
        const tx = db.transaction('songs', 'readonly');
        const store = tx.objectStore('songs');
        const req = store.getAll();
        req.onsuccess = () => {
          const songs = req.result;
          // Find Song 1 and Song 18 based on title from the user's hints, or just get all lengths
          const song1 = songs.find(s => s.title && s.title.includes('Dearest Lord'));
          const song18 = songs.find(s => s.title && s.title.includes('There’s a gospel of today'));
          
          resolve({
            song1: song1 ? getWidth(song1.lyrics_plain) : null,
            song18: song18 ? getWidth(song18.lyrics_plain) : null,
            allSongs: songs.map(s => ({ title: s.title, ...getWidth(s.lyrics_plain) })).sort((a,b) => b.optimal - a.optimal).slice(0, 5)
          });
        };
        req.onerror = () => reject(req.error);
      };
      request.onerror = () => reject(request.error);
    });
  });
  
  console.log("Evaluation result:", result);
  
  await browser.close();
})();
