const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const page = await context.newPage();
  
  await page.goto('http://localhost:5173/?agent=true');
  await page.waitForSelector('text=Import');
  
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('text=Import').click()
  ]);
  
  await fileChooser.setFiles('/Users/david/Documents/projects/songpacketer/frontend/e2e/fixtures/song-packet-official.json');
  await page.waitForSelector('text=Packet imported successfully', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  
  await page.locator('text=Present').click();
  await page.waitForTimeout(2000); 

  // Force controls to be visible by injecting CSS
  await page.addStyleTag({ content: '.MuiAppBar-root { opacity: 1 !important; visibility: visible !important; }' });
  
  // We are now on Song 1.
  const fullSongBtn = page.locator('text=Full song');
  if (await fullSongBtn.isVisible()) {
    // If it's not currently full song mode (usually persisted to true, but let's be sure)
    const btnClasses = await fullSongBtn.getAttribute('class');
    if (btnClasses && btnClasses.includes('outlined')) {
      await fullSongBtn.click();
      await page.waitForTimeout(1000); 
    }
  }

  // Navigate to Song 18
  for (let i = 0; i < 17; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);
  }
  
  await page.waitForTimeout(2000);
  
  await page.screenshot({ path: '/Users/david/.gemini/antigravity-ide/brain/c1b854b1-f6fe-4c06-8f88-d423c10df7d6/song18_full_v3.png' });
  console.log("Screenshot saved to song18_full_v3.png");

  // Extract layout info from the DOM to see why it looks wrong!
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
  
  console.log("Layout Info for Song 18:", layoutInfo);
  
  await browser.close();
})();
