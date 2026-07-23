const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const page = await context.newPage();
  
  // Go to the dev server
  await page.goto('http://localhost:5173/?agent=true');
  
  // Wait for the app to load
  await page.waitForSelector('text=Import');
  
  // Set up the file chooser to import the file
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('text=Import').click()
  ]);
  
  await fileChooser.setFiles('/Users/david/Documents/projects/songpacketer/frontend/e2e/fixtures/song-packet-official.json');
  
  // Wait for the import to finish (toast message or loading false)
  await page.waitForSelector('text=Packet imported successfully', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  
  // Click Present
  await page.locator('text=Present').click();
  await page.waitForTimeout(2000); // Wait for presentation mode to render
  
  // We are now on Song 1. Click "Full song" button
  const fullSongBtn = page.locator('text=Full song');
  if (await fullSongBtn.isVisible()) {
    await fullSongBtn.click();
    await page.waitForTimeout(1000); // wait for layout
    await page.screenshot({ path: 'song1_full.png' });
    console.log("Screenshot saved to song1_full.png");
  } else {
    console.log("Full song button not visible on Song 1");
  }

  // Navigate to Song 18
  for (let i = 0; i < 17; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
  }
  
  // Click "Full song" button again if it's untoggled, or just ensure it's on
  await page.waitForTimeout(2000);
  if (await fullSongBtn.isVisible()) {
    // If it's outlined (not contained), it's off. Let's just click it to toggle.
    // Actually, fullSongMode is persisted in localStorage, so it should be ON for song 18.
    // Let's just screenshot it.
    await page.screenshot({ path: 'song18_full.png' });
    console.log("Screenshot saved to song18_full.png");
  } else {
    console.log("Full song button not visible on Song 18");
  }
  
  await browser.close();
})();
