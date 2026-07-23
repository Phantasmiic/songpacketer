import { test, expect } from '@playwright/test';
import path from 'path';

const PACKET_PATH = path.resolve('e2e/fixtures/song-packet-official.json');

test('Check Song 10 Balanced Layout', async ({ page }) => {
  test.setTimeout(60000);
  
  await page.setViewportSize({ width: 1470, height: 836 });
  
  await page.goto('http://localhost:5173/?agent=true');
  await page.evaluate(() => {
    localStorage.setItem('alwaysShowControls', 'true');
    localStorage.setItem('presentationFullSongMode', 'true');
  });
  
  await page.locator('#dashboard-json-uploader').setInputFiles(PACKET_PATH);
  await expect(page.getByText('O the riches of my Savior').first()).toBeVisible({ timeout: 25000 });
  await page.waitForTimeout(2000);
  
  await page.getByRole('button', { name: 'Present' }).click();
  await page.waitForTimeout(2000);
  
  await page.getByRole('button', { name: /O the riches of my Savior/ }).click();
  await page.waitForTimeout(3000);
  
  const layout = await page.evaluate(() => {
    const allElements = Array.from(document.querySelectorAll('*'));
    const el = allElements.find(el => {
      const style = window.getComputedStyle(el);
      return style.columnCount && style.columnCount !== 'auto' && style.columnGap && style.columnGap !== 'normal';
    });
    if (!el) return null;
    const style = window.getComputedStyle(el);
    return {
      fontSize: style.fontSize,
      columnCount: style.columnCount,
      columnFill: style.columnFill,
      columnGap: style.columnGap,
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
      scrollWidth: el.scrollWidth,
      scrollHeight: el.scrollHeight
    };
  });
  console.log('LAYOUT:', layout);
  
  await page.screenshot({ path: '/Users/david/.gemini/antigravity-ide/brain/c1b854b1-f6fe-4c06-8f88-d423c10df7d6/song10_final_user.png' });
});
