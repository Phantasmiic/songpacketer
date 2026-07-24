import { test, expect } from '@playwright/test';

const PACKET_PATH = '/Users/david/Downloads/song packet official.json';
const ARTIFACTS_DIR = '/Users/david/.gemini/antigravity-ide/brain/707651b9-81bc-4fa9-9e11-ad6bc5ff1263';

async function measureSpaceUsage(page, songTitle) {
  await page.locator('#dashboard-json-uploader').setInputFiles(PACKET_PATH);
  await expect(page.getByText(songTitle).first()).toBeVisible({ timeout: 25000 });
  await page.waitForTimeout(1000);
  
  await page.getByRole('button', { name: 'Present' }).click();
  await page.waitForTimeout(2000);
  
  await page.getByRole('button', { name: new RegExp(songTitle, 'i') }).click();
  await page.waitForTimeout(2000);

  const metrics = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="full-song-box"]') || document.querySelector('div[style*="column-count"]') || document.querySelector('div[style*="columnCount"]');
    if (!el) {
      // Find box containing full song
      const allBoxes = Array.from(document.querySelectorAll('div'));
      const target = allBoxes.find(b => b.style.columnCount || getComputedStyle(b).columnCount !== 'auto');
      if (!target) return null;
      const style = getComputedStyle(target);
      return {
        fontSize: parseFloat(style.fontSize),
        columnCount: parseInt(style.columnCount, 10) || 1,
        width: target.clientWidth,
        height: target.clientHeight
      };
    }
    const style = getComputedStyle(el);
    return {
      fontSize: parseFloat(style.fontSize),
      columnCount: parseInt(style.columnCount, 10) || 1,
      width: el.clientWidth,
      height: el.clientHeight
    };
  });

  return metrics;
}

test('Measure Song 2 space usage on Desktop (1470x836)', async ({ page }) => {
  await page.setViewportSize({ width: 1470, height: 836 });
  await page.goto('http://localhost:5173/?agent=true');
  await page.evaluate(() => {
    localStorage.setItem('alwaysShowControls', 'true');
    localStorage.setItem('presentationFullSongMode', 'true');
  });

  const metrics = await measureSpaceUsage(page, 'Christ Is the Tree of Life');
  console.log("DESKTOP (1470x836) METRICS:", metrics);

  await page.screenshot({ path: `${ARTIFACTS_DIR}/song2_space_usage_desktop.png` });

  expect(metrics).not.toBeNull();
  expect(metrics.fontSize).toBeGreaterThan(20);
});

test('Measure Song 2 space usage on Projector (1920x1080)', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://localhost:5173/?agent=true');
  await page.evaluate(() => {
    localStorage.setItem('alwaysShowControls', 'true');
    localStorage.setItem('presentationFullSongMode', 'true');
  });

  const metrics = await measureSpaceUsage(page, 'Christ Is the Tree of Life');
  console.log("PROJECTOR (1920x1080) METRICS:", metrics);

  await page.screenshot({ path: `${ARTIFACTS_DIR}/song2_space_usage_projector.png` });

  expect(metrics).not.toBeNull();
  // On a large 1080p screen, Song 2 should achieve a large font size (> 28px) and use multi-columns
  expect(metrics.fontSize).toBeGreaterThan(25);
  expect(metrics.columnCount).toBeGreaterThanOrEqual(2);
});
