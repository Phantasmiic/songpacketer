import { test, expect } from '@playwright/test';
import path from 'path';

const PACKET_PATH = path.resolve('e2e/fixtures/song-packet-official.json');

test('Verify Song 4 does not render comment notes as lyrics', async ({ page }) => {
  test.setTimeout(60000);
  
  await page.setViewportSize({ width: 1470, height: 836 });
  
  await page.goto('http://localhost:5173/?agent=true');
  await page.evaluate(() => {
    localStorage.setItem('alwaysShowControls', 'true');
    localStorage.setItem('presentationFullSongMode', 'true');
  });
  
  await page.locator('#dashboard-json-uploader').setInputFiles(PACKET_PATH);
  await expect(page.getByText('Oh what a mystery!').first()).toBeVisible({ timeout: 25000 });
  await page.waitForTimeout(2000);
  
  await page.getByRole('button', { name: 'Present' }).click();
  await page.waitForTimeout(2000);
  
  await page.getByRole('button', { name: /Oh what a mystery!/ }).click();
  await page.waitForTimeout(3000);
  
  // Verify full song view does not contain comment lines
  const pageTextFull = await page.innerText('body');
  expect(pageTextFull).not.toContain('#Capo 3');
  expect(pageTextFull).not.toContain('#Romans 8:10');
  expect(pageTextFull).not.toContain('#Colossians 1:27');
  expect(pageTextFull).not.toContain('#2 Corinthians 13:5');
  expect(pageTextFull).not.toContain('#Galatians 2:20');
  
  await page.screenshot({ path: '/Users/david/.gemini/antigravity-ide/brain/c1b854b1-f6fe-4c06-8f88-d423c10df7d6/song4_full_song.png' });
  console.log("Full song screenshot saved.");
  
  // Switch to slide view (click Full song button to toggle off full song mode)
  await page.locator('button').filter({ hasText: 'Full song' }).click();
  await page.waitForTimeout(2000);
  
  const pageTextSlide = await page.innerText('body');
  expect(pageTextSlide).not.toContain('#Capo 3');
  expect(pageTextSlide).not.toContain('#Romans 8:10');
  expect(pageTextSlide).not.toContain('#Colossians 1:27');
  expect(pageTextSlide).not.toContain('#2 Corinthians 13:5');
  expect(pageTextSlide).not.toContain('#Galatians 2:20');
  
  await page.screenshot({ path: '/Users/david/.gemini/antigravity-ide/brain/c1b854b1-f6fe-4c06-8f88-d423c10df7d6/song4_slide_mode.png' });
  console.log("Slide mode screenshot saved.");
});
