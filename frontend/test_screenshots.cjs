const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log("Navigating to song 14...");
  await page.goto('http://localhost:5173/present/434?alwaysShowControls=true'); 
  // Wait, I don't know if 434 is song 14. 
  // If the user said "load /Users/david/Documents/projects/songpacketer/frontend/e2e/fixtures/song-packet-official.json", that means the app doesn't load it by default. 
  // The app loads from IndexedDB or state. 
  // Is the JSON file already loaded in the frontend? The user has to import it.
  // I will just use whatever song is ID 434, if it has 3 verses.
  
  // Actually, I can just inject the JSON into localStorage if that's how it's stored, or let's just go to '/' and upload it?
  // Let me check how the user loaded it. "load '/Users/david/Documents/projects/songpacketer/frontend/e2e/fixtures/song-packet-official.json'"
  // That means I should use playwright to click "Import/Export" and upload the file!
  
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(1000);
  
  // Click Import
  await page.getByText('Import / Export').click();
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByText('Import Data').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles('/Users/david/Documents/projects/songpacketer/frontend/e2e/fixtures/song-packet-official.json');
  
  await page.waitForTimeout(1000);
  console.log("Imported data.");
  
  // Go to song 14 (index 13 or literally "14" on screen? The title is "Down from His glory")
  await page.getByText('Down from His glory').click();
  await page.waitForTimeout(2000);
  
  console.log("Taking Step 1 screenshot");
  await page.screenshot({ path: 'step1.png' });
  
  console.log("Clicking Full Song...");
  await page.getByRole('button', { name: 'Full song' }).click();
  await page.waitForTimeout(1000);
  
  console.log("Taking Step 2 screenshot");
  await page.screenshot({ path: 'step2.png' });
  
  console.log("Unselecting Full Song...");
  await page.getByRole('button', { name: 'Full song' }).click();
  await page.waitForTimeout(1000);
  
  console.log("Taking Step 4 screenshot");
  await page.screenshot({ path: 'step4.png' });
  
  await browser.close();
})();
