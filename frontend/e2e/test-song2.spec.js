import { test, expect } from '@playwright/test';
import path from 'path';

const PACKET_PATH = '/Users/david/Downloads/song packet official.json';
const ARTIFACTS_DIR = '/Users/david/.gemini/antigravity-ide/brain/707651b9-81bc-4fa9-9e11-ad6bc5ff1263';

test('Examine Song 2 in full song mode', async ({ page }) => {
  test.setTimeout(60000);
  
  await page.setViewportSize({ width: 1470, height: 836 });
  
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
  await page.waitForTimeout(2000);

  // Take screenshot in Full Song mode
  await page.screenshot({ path: `${ARTIFACTS_DIR}/song2_full_song.png`, fullPage: true });

  const bodyText = await page.innerText('body');
  console.log("=== BODY TEXT IN FULL SONG MODE ===");
  console.log(bodyText);

  // Also check if Chords button is toggled or visible
  const chordsBtn = page.getByRole('button', { name: /chords/i });
  console.log("Chords button count:", await chordsBtn.count());
});
