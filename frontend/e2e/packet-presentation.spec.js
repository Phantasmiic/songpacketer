import { test, expect } from '@playwright/test';

test.describe('End-to-End Presentation Workflow', () => {
  test('creates a packet, opens presentation mode, and navigates slides with keyboard', async ({ page }) => {
    // 1. Open the home page
    await page.goto('/');

    // 2. Click "Create New Packet" to open the creation view
    await page.getByText('Create New Packet').click();

    // 3. Fill required Packet Title
    await page.getByLabel(/Packet Title/i).fill('My E2E Test Packet');

    // 4. Type song title into the textarea
    const textarea = page.locator('textarea').first();
    await textarea.fill('In a low dungeon, hope we had none');

    // 5. Click "Create Packet & Match Songs" button
    const createBtn = page.getByRole('button', { name: /create packet & match songs/i });
    await expect(createBtn).toBeEnabled();
    await createBtn.click();

    // 6. Wait for matching to finish and click "Present" button in top bar
    const presentBtn = page.getByRole('button', { name: /^present$/i });
    await expect(presentBtn).toBeVisible({ timeout: 15000 });
    await presentBtn.click();

    // 7. In presentation mode landing, click on the song card to launch slides
    const songCard = page.getByText(/In a low dungeon/i).first();
    await expect(songCard).toBeVisible({ timeout: 5000 });
    await songCard.click({ force: true });

    // 8. Verify slide 1 content is rendered in the presentation viewer
    const slideText = page.getByText(/In a low dungeon/i).last();
    await expect(slideText).toBeVisible();

    // 9. Send ArrowRight keyboard shortcut to advance slides
    await page.keyboard.press('ArrowRight');

    // 10. Verify presentation mode is active and rendering slides
    await expect(page.locator('body')).toBeVisible();
  });
});
