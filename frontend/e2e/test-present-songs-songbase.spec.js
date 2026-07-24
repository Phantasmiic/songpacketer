import { test, expect } from '@playwright/test';

test.describe('Present Songs from Songbase Feature', () => {

  test('renders Present Songs option on homepage and launches Songbase presentation search', async ({ page }) => {
    // 1. Open homepage on fresh session (Step 0)
    await page.goto('/#/?test=true&agent=true');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('alwaysShowControls', 'true');
    });
    await page.goto('/#/?test=true&agent=true');

    // 2. Verify card on homepage
    const presentCard = page.locator('[data-testid="present-songs-card"]');
    await expect(presentCard).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Present Songs from Songbase')).toBeVisible();

    // 3. Click "Present Songs" card
    await presentCard.click();

    // 4. Verify Presentation Mode opens with Songbase Presentation title
    await expect(page.getByText('Songbase Presentation')).toBeVisible({ timeout: 10000 });
    
    // 5. Verify initial state shows central empty search prompt
    await expect(page.getByText('Type any title, lyric phrase, or key to search Songbase')).toBeVisible();

    // 6. Type search query in central search input
    const searchInput = page.getByPlaceholder('Search songs by title, lyrics, or key...');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('freedom');
    await page.waitForTimeout(400);

    // 7. Verify initial prompt is replaced by single-column search results
    await expect(page.getByText('Type any title, lyric phrase, or key to search Songbase')).not.toBeVisible();
  });
});
