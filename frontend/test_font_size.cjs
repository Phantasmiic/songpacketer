const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log("Navigating to song 14...");
  await page.goto('http://localhost:5173/present/434?alwaysShowControls=true'); // Replace with correct song ID if needed. Wait, song 14 is 434? No, I don't know its ID.
  
  // Wait for React to mount
  await page.waitForTimeout(2000);
  
  const getFontSize = async () => {
    return await page.evaluate(() => {
      const box = Array.from(document.querySelectorAll('div')).find(el => el.innerText.includes('Down from His glory'));
      return box ? window.getComputedStyle(box).fontSize : 'NOT FOUND';
    });
  };
  
  const size1 = await getFontSize();
  console.log("Step 1 Font Size:", size1);
  
  console.log("Clicking Full Song...");
  await page.getByRole('button', { name: 'Full song' }).click();
  await page.waitForTimeout(1000);
  
  console.log("Unselecting Full Song...");
  await page.getByRole('button', { name: 'Full song' }).click();
  await page.waitForTimeout(1000);
  
  const size4 = await getFontSize();
  console.log("Step 4 Font Size:", size4);
  
  await browser.close();
})();
