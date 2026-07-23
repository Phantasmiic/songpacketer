const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/present/434?alwaysShowControls=true');
  
  // Wait for the song to load and auto-size to finish
  await page.waitForTimeout(2000);
  
  // Step 1: Get the font size of the first line of lyrics in paginated mode
  let lyricsBox = await page.locator('div').filter({ hasText: 'Down from His glory' }).last();
  let computedStyle = await lyricsBox.evaluate((el) => window.getComputedStyle(el).fontSize);
  console.log('Step 1 Font Size:', computedStyle);
  
  // Step 2: Click Full Song
  await page.getByRole('button', { name: 'Full song' }).click();
  await page.waitForTimeout(1000);
  console.log('Clicked Full Song');
  
  // Step 3: Unselect Full Song
  await page.getByRole('button', { name: 'Full song' }).click();
  await page.waitForTimeout(1000);
  
  // Step 4: Get font size again
  lyricsBox = await page.locator('div').filter({ hasText: 'Down from His glory' }).last();
  computedStyle = await lyricsBox.evaluate((el) => window.getComputedStyle(el).fontSize);
  console.log('Step 4 Font Size:', computedStyle);
  
  await browser.close();
})();
