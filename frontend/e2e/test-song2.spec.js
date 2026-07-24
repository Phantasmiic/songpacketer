import { test, expect } from '@playwright/test';

const PACKET_PATH = '/Users/david/Downloads/song packet official.json';
const ARTIFACTS_DIR = '/Users/david/.gemini/antigravity-ide/brain/707651b9-81bc-4fa9-9e11-ad6bc5ff1263';

test.use({
  launchOptions: {
    args: ['--start-maximized']
  }
});

test('Examine Song 2 in full song mode maximized window', async ({ page }) => {
  test.setTimeout(60000);

  // Set viewport to fully expanded screen bounds
  await page.setViewportSize({ width: 1920, height: 1040 });

  await page.goto('http://localhost:5173/?agent=true');
  await page.evaluate(() => {
    localStorage.setItem('alwaysShowControls', 'true');
    localStorage.setItem('presentationFullSongMode', 'true');
  });
  
  await page.locator('#dashboard-json-uploader').setInputFiles(PACKET_PATH);
  await expect(page.getByText('Christ Is the Tree of Life').first()).toBeVisible({ timeout: 25000 });
  await page.waitForTimeout(1000);
  
  await page.getByRole('button', { name: 'Present' }).click();
  await page.waitForTimeout(2000);
  
  await page.getByRole('button', { name: /Christ Is the Tree of Life/ }).click();
  await page.waitForTimeout(7000); // Keep open on screen for user to watch

  const metrics = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="full-song-box"]');
    if (!el) return null;
    const style = getComputedStyle(el);
    const lineBoxes = Array.from(el.querySelectorAll('[data-line]'));
    const blockBoxes = Array.from(el.querySelectorAll('[data-block]'));
    
    let lineWraps = 0;
    lineBoxes.forEach(lineEl => {
      const h = lineEl.getBoundingClientRect().height;
      const approxLineH = parseFloat(style.fontSize) * 1.35;
      if (h > approxLineH * 1.4) lineWraps++;
    });

    let blockSplits = 0;
    blockBoxes.forEach(blockEl => {
      if (blockEl.getClientRects().length > 1) blockSplits++;
    });

    return {
      fontSize: style.fontSize,
      columnCount: style.columnCount,
      lineWraps,
      blockSplits,
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
      windowInnerWidth: window.innerWidth,
      windowInnerHeight: window.innerHeight
    };
  });

  console.log("MAXIMIZED METRICS:", JSON.stringify(metrics, null, 2));

  await page.screenshot({ path: `${ARTIFACTS_DIR}/song2_full_song_maximized.png` });
});
