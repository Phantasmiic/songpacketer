const { chromium } = require('playwright');

(async () => {
  console.log("Launching browser...");
  // Use standard Chromium
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const page = await context.newPage();
  
  console.log("Navigating to app...");
  await page.goto('http://localhost:5173/?agent=true');
  await page.waitForSelector('text=Import');
  
  console.log("Importing file...");
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('text=Import').click()
  ]);
  
  await fileChooser.setFiles('/Users/david/Documents/projects/songpacketer/frontend/e2e/fixtures/song-packet-official.json');
  console.log("Waiting for import to finish...");
  await page.waitForSelector('text=Packet imported successfully', { timeout: 15000 }).catch(e => console.log("Import toast not found, proceeding anyway"));
  
  // Wait for the song title to appear in the table (means hydration is done)
  console.log("Waiting for hydration...");
  await page.waitForSelector('text="There’s a gospel of today"', { timeout: 20000 }).catch(e => console.log("Song title not found in table, proceeding anyway"));
  
  console.log("Clicking Present...");
  await page.locator('text=Present').click();
  
  // Wait for PresentationMode to load
  await page.waitForTimeout(1000);
  
  // Wait for Loading spinner to disappear
  console.log("Waiting for loading spinner to disappear...");
  await page.waitForSelector('text=Loading Songs...', { state: 'hidden', timeout: 15000 }).catch(e => console.log("No spinner seen"));
  
  console.log("Clicking Song 18...");
  const song18Item = page.locator('text="There’s a gospel of today"').first();
  await song18Item.click();
  await page.waitForTimeout(2000);

  console.log("Ensuring Full Song is ON...");
  await page.addStyleTag({ content: '.MuiAppBar-root { opacity: 1 !important; visibility: visible !important; }' });
  const fullSongBtn = page.locator('text=Full song');
  if (await fullSongBtn.isVisible()) {
    const btnClasses = await fullSongBtn.getAttribute('class');
    if (btnClasses && btnClasses.includes('outlined')) {
      await fullSongBtn.click();
      await page.waitForTimeout(2000); 
    }
  }

  console.log("Taking screenshot...");
  await page.screenshot({ path: '/Users/david/.gemini/antigravity-ide/brain/c1b854b1-f6fe-4c06-8f88-d423c10df7d6/song18_v7.png' });
  console.log("Screenshot saved to song18_v7.png");

  const layoutInfo = await page.evaluate(() => {
    const fullSongBox = document.querySelector('[style*="column-width"]');
    if (!fullSongBox) return null;
    return {
      fontSize: fullSongBox.style.fontSize,
      columnWidth: fullSongBox.style.columnWidth,
      columnCount: fullSongBox.style.columnCount,
      clientHeight: fullSongBox.clientHeight,
      clientWidth: fullSongBox.clientWidth,
      scrollHeight: fullSongBox.scrollHeight,
      scrollWidth: fullSongBox.scrollWidth,
    };
  });
  console.log("Layout Info:", JSON.stringify(layoutInfo, null, 2));

  await browser.close();
  console.log("Done.");
})();
