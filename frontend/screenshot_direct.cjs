const { chromium } = require('playwright');
const path = require('path');

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
  
  // Go directly to Song 1324!
  await page.goto('http://localhost:5173/present/1324?agent=true');
  await page.waitForTimeout(2000); 

  // Force controls to be visible by injecting CSS
  await page.addStyleTag({ content: '.MuiAppBar-root { opacity: 1 !important; visibility: visible !important; }' });
  
  const fullSongBtn = page.locator('text=Full song');
  if (await fullSongBtn.isVisible()) {
    const btnClasses = await fullSongBtn.getAttribute('class');
    if (btnClasses && btnClasses.includes('outlined')) {
      await fullSongBtn.click();
      await page.waitForTimeout(1000); 
    }
  }

  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/Users/david/.gemini/antigravity-ide/brain/c1b854b1-f6fe-4c06-8f88-d423c10df7d6/song18_direct.png' });
  console.log("Screenshot saved to song18_direct.png");
  
  // Extract DOM data
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
      html: fullSongBox.innerHTML.substring(0, 500)
    };
  });
  console.log("Layout Info:", JSON.stringify(layoutInfo, null, 2));

  await browser.close();
})();
