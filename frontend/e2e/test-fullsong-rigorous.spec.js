import { test, expect } from '@playwright/test';

test.describe('Presentation smoke tests', () => {
  test('loads the presentation shell and exposes the song card', async ({ page }) => {
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('alwaysShowControls', 'true');
      localStorage.setItem('presentationPacketCache', JSON.stringify([
        {
          song_id: 'demo-song-1',
          title: 'Glorious Freedom',
          chordpro_override: `Verse 1
Once I was bound by sin's galling fetters,
Chained like a slave I struggled in vain.

Chorus
Glorious freedom, wonderful freedom,
No more in chains of sin I repine!

Verse 2
Freedom from all the carnal affections,
Freedom from envy, hatred and strife;`
        }
      ]));
    });

    await page.goto('http://localhost:5173/present', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('presentation-song-card').first()).toBeVisible({ timeout: 5000 });
  });
});
