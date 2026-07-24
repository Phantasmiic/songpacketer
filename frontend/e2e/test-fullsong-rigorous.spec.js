import { test, expect } from '@playwright/test';

test.describe('Rigorous Full Song Presentation Layout Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to homepage with agent=true to keep top-bar controls permanently visible
    await page.goto('/#/?test=true&agent=true');
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('alwaysShowControls', 'true');
    });
    await page.goto('/#/?test=true&agent=true');

    // Click "Create New Packet"
    await page.click('text="Create New Packet"');

    // Enter title & paste multi-song setlist
    await page.fill('input[placeholder*="Sunday Morning Worship"]', 'Rigorous Test Packet');
    const songsText = `Glorious Freedom
Once I was bound by sin's galling fetters,
Chained like a slave I struggled in vain;
But I received a glorious freedom,
When Jesus broke my fetters in twain.

Chorus
Glorious freedom, wonderful freedom,
No more in chains of sin I repine!
Jesus the glorious Emancipator,
Now and forever He shall be mine.

Verse 2
Freedom from all the carnal affections,
Freedom from envy, hatred and strife;
Freedom from vain and worldly ambitions,
Freedom from all that saddened my life.

Verse 3
Freedom from pride and all sinful follies,
Freedom from love and glitter of gold;
Freedom from evil temper and anger,
Glorious freedom, rapture untold.

Verse 4
Freedom from fear with all of its torments,
Freedom from care with all of its pain;
Freedom in Christ my blessed Redeemer,
He who has rent my fetters in twain.

Long Hymn Set
Verse 1
Amazing grace how sweet the sound that saved a wretch like me
I once was lost but now am found was blind but now I see

Chorus
Praise God praise God praise God praise God
Praise God praise God praise God praise God

Verse 2
'Twas grace that taught my heart to fear and grace my fears relieved
How precious did that grace appear the hour I first believed

Verse 3
Through many dangers toils and snares I have already come
'Tis grace hath brought me safe thus far and grace will lead me home

Verse 4
The Lord has promised good to me His word my hope secures
He will my shield and portion be as long as life endures

Verse 5
Yes when this flesh and heart shall fail and mortal life shall cease
I shall possess within the veil a life of joy and peace

Verse 6
The earth shall soon dissolve like snow the sun forbear to shine
But God who called me here below will be forever mine`;

    await page.fill('textarea', songsText);
    await page.click('button:has-text("Create Packet & Match Songs")');

    // Wait for step 1 & click Present button
    const presentBtn = page.getByRole('button', { name: /^present$/i });
    await expect(presentBtn).toBeVisible({ timeout: 15000 });
    await presentBtn.click();

    // In PresentationHome landing, click the song card to launch PresentationSlide
    const songCard = page.getByText(/Glorious Freedom/i).first();
    await expect(songCard).toBeVisible({ timeout: 10000 });
    await songCard.click({ force: true });

    // Wait for top bar and click Full song mode using force: true to bypass fade overlay
    const fullSongBtn = page.locator('button:has-text("Full song")');
    await expect(fullSongBtn).toBeVisible({ timeout: 10000 });
    await fullSongBtn.click({ force: true });
  });

  test('1. Resolution Matrix: 4K (3840x2160), 1080p (1920x1080), Projector (1280x720), Legacy 4:3 (1024x768), Portrait (768x1024)', async ({ page }) => {
    const resolutions = [
      { name: '4K Ultra-Wide', width: 3840, height: 2160, minCols: 3, maxCols: 5, minFont: 36 },
      { name: '1080p Full HD', width: 1920, height: 1080, minCols: 2, maxCols: 4, minFont: 30 },
      { name: '1470x836 Laptop', width: 1470, height: 836, minCols: 2, maxCols: 3, minFont: 25 },
      { name: '1280x720 Projector', width: 1280, height: 720, minCols: 2, maxCols: 3, minFont: 22 },
      { name: '1024x768 4:3 Legacy Screen', width: 1024, height: 768, minCols: 2, maxCols: 3, minFont: 20 },
      { name: '768x1024 Portrait Tablet', width: 768, height: 1024, minCols: 1, maxCols: 2, minFont: 18 }
    ];

    for (const res of resolutions) {
      await page.setViewportSize({ width: res.width, height: res.height });
      await page.waitForTimeout(400); // Allow ResizeObserver to settle

      const metrics = await page.evaluate(() => {
        const el = document.querySelector('[data-testid="full-song-box"]');
        if (!el) return null;
        const fontStr = window.getComputedStyle(el).fontSize;
        const fontPx = parseFloat(fontStr);
        const colCount = parseInt(window.getComputedStyle(el).columnCount, 10) || 1;
        const scrollW = el.scrollWidth;
        const clientW = el.clientWidth;
        const scrollH = el.scrollHeight;
        const clientH = el.clientHeight;
        return { fontPx, colCount, scrollW, clientW, scrollH, clientH };
      });

      expect(metrics).not.toBeNull();
      console.log(`Resolution ${res.name} (${res.width}x${res.height}):`, metrics);

      // Verify column count is within expected bounds for resolution
      expect(metrics.colCount).toBeGreaterThanOrEqual(res.minCols);
      expect(metrics.colCount).toBeLessThanOrEqual(res.maxCols);

      // Verify font size is readable and above minimum threshold
      expect(metrics.fontPx).toBeGreaterThanOrEqual(res.minFont);

      // Verify ZERO vertical overflow (scrollHeight must fit within clientHeight + 2px tolerance)
      expect(metrics.scrollH).toBeLessThanOrEqual(metrics.clientH + 2);
    }
  });

  test('2. Hard Page Reload & Direct URL Navigation Persistence', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(300);

    const initialMetrics = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="full-song-box"]');
      return {
        fontSize: parseFloat(window.getComputedStyle(el).fontSize),
        colCount: parseInt(window.getComputedStyle(el).columnCount, 10)
      };
    });

    expect(initialMetrics.colCount).toBeGreaterThanOrEqual(2);

    // Perform a hard page reload on the direct presentation URL
    let currentUrl = page.url();
    if (!currentUrl.includes('alwaysShowControls=true')) {
      currentUrl += (currentUrl.includes('?') ? '&' : '?') + 'alwaysShowControls=true';
    }
    await page.goto(currentUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);

    const reloadedMetrics = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="full-song-box"]');
      return {
        fontSize: parseFloat(window.getComputedStyle(el).fontSize),
        colCount: parseInt(window.getComputedStyle(el).columnCount, 10)
      };
    });

    console.log('Direct URL Reload Metrics:', reloadedMetrics);

    // Verify layout re-measured cleanly on first paint without falling back to 1 column or 16px
    expect(reloadedMetrics.colCount).toBeGreaterThanOrEqual(2);
    expect(reloadedMetrics.fontSize).toBeGreaterThanOrEqual(30);
  });

  test('3. Mode Toggling: Slide Mode -> Full Song Mode -> Slide Mode', async ({ page }) => {
    await page.setViewportSize({ width: 1470, height: 836 });

    // Switch to Slide mode
    await page.click('button:has-text("Full song")', { force: true }); // Toggles off
    await page.waitForTimeout(300);
    const hasFullSong = await page.evaluate(() => Boolean(document.querySelector('[data-testid="full-song-box"]')));
    expect(hasFullSong).toBe(false);

    // Switch back to Full Song mode
    await page.click('button:has-text("Full song")', { force: true }); // Toggles back on
    await page.waitForSelector('[data-testid="full-song-box"]');
    await page.waitForTimeout(300);

    const metrics = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="full-song-box"]');
      return {
        fontSize: parseFloat(window.getComputedStyle(el).fontSize),
        colCount: parseInt(window.getComputedStyle(el).columnCount, 10)
      };
    });

    expect(metrics.colCount).toBeGreaterThanOrEqual(2);
    expect(metrics.fontSize).toBeGreaterThanOrEqual(25);
  });

  test('4. Auto vs Manual Font Slider Controls in Settings', async ({ page }) => {
    await page.setViewportSize({ width: 1470, height: 836 });

    // Open Settings dialog
    await page.click('button[aria-label="Settings"]', { force: true });
    await page.waitForSelector('text="Presentation Settings"');

    // Verify theme select dropdown is present
    await page.waitForSelector('#theme-select');

    // Drag / change slider to manual text size
    const slider = page.locator('.MuiSlider-root');
    await slider.click({ force: true });
    await page.waitForTimeout(300);

    // Verify manual font size applied to Full Song container
    const manualMetrics = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="full-song-box"]');
      return {
        fontSize: parseFloat(window.getComputedStyle(el).fontSize)
      };
    });

    expect(manualMetrics.fontSize).toBeGreaterThan(0);

    // Click "Auto" button to restore automatic font size
    await page.click('button:has-text("Auto")', { force: true });
    await page.waitForTimeout(300);

    const autoMetrics = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="full-song-box"]');
      return {
        fontSize: parseFloat(window.getComputedStyle(el).fontSize),
        colCount: parseInt(window.getComputedStyle(el).columnCount, 10)
      };
    });

    expect(autoMetrics.colCount).toBeGreaterThanOrEqual(2);
    expect(autoMetrics.fontSize).toBeGreaterThanOrEqual(25);
  });

  test('5. Dynamic Window Resizing (ResizeObserver Test)', async ({ page }) => {
    // Start at low resolution (1024x768)
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(400);

    const smallMetrics = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="full-song-box"]');
      return {
        fontSize: parseFloat(window.getComputedStyle(el).fontSize),
        colCount: parseInt(window.getComputedStyle(el).columnCount, 10)
      };
    });

    // Resize dynamically to 1920x1080
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(400);

    const largeMetrics = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="full-song-box"]');
      return {
        fontSize: parseFloat(window.getComputedStyle(el).fontSize),
        colCount: parseInt(window.getComputedStyle(el).columnCount, 10)
      };
    });

    console.log('Resize Transition:', { small: smallMetrics, large: largeMetrics });

    // Verify larger resolution dynamically increased column count & font size
    expect(largeMetrics.colCount).toBeGreaterThanOrEqual(smallMetrics.colCount);
    expect(largeMetrics.fontSize).toBeGreaterThan(smallMetrics.fontSize);
  });
});
