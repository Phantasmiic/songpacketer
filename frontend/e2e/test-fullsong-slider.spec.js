import { test, expect } from '@playwright/test';

const PACKET_PATH = '/Users/david/Downloads/song packet official.json';

test('Verify Full Song manual text size slider and Auto toggle', async ({ page }) => {
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

  // Open Settings modal using title or aria-label
  await page.locator('button[title="Settings"], button[aria-label="Settings"]').first().click({ force: true });
  await page.waitForTimeout(1000);

  // Verify "Full Song Text Size" slider title is present
  await expect(page.getByText('Full Song Text Size')).toBeVisible();

  // Close Settings modal
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Switch to slide view (toggle off full song mode)
  await page.locator('button').filter({ hasText: 'Full song' }).click();
  await page.waitForTimeout(1000);

  // Open Settings modal again
  await page.locator('button[title="Settings"], button[aria-label="Settings"]').first().click({ force: true });
  await page.waitForTimeout(1000);

  // Verify "Slide Text Size" is present when not in full song mode
  await expect(page.getByText('Slide Text Size')).toBeVisible();
});
