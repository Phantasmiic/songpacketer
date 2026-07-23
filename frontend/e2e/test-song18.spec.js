import { test, expect } from '@playwright/test';
import path from 'path';

const PACKET_PATH = path.resolve('e2e/fixtures/song-packet-official.json');

test('Screenshot Song 18 Steps', async ({ page }) => {
  test.setTimeout(60000);
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  
  await page.goto('http://localhost:5173/?agent=true');
  
  await page.evaluate(() => {
    localStorage.setItem('alwaysShowControls', 'true');
    localStorage.setItem('presentationFullSongMode', 'true');
  });
  
  await page.locator('#dashboard-json-uploader').setInputFiles(PACKET_PATH);
  await expect(page.getByText('There’s a gospel of today').first()).toBeVisible({ timeout: 25000 });
  await page.waitForTimeout(2000);
  
  await page.getByRole('button', { name: 'Present' }).click();
  await page.waitForTimeout(2000);
  
  await page.getByRole('button', { name: /There’s a gospel of today/ }).click();
  await page.waitForTimeout(3000);
});
