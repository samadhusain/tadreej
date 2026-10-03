// Usage: npx -y @playwright/cli@latest -s=tadreej run-code --filename=scripts/fit-check.js
// Needs the dev server on http://localhost:5199. Prints font size and fit per viewport, ayah and word mode.
async page => {
  const BASE = 'http://localhost:5199/';
  const sizes = [[1920,1080],[1920,945],[2560,1440],[1536,864],[1440,900],[1366,768],[1280,720],[1024,768],[768,1024],[430,932],[390,844],[375,667],[360,640]];
  // [name, query that shows the ayah's page, tail of the on-screen "Surah · Ayah N" label]
  const ayahs = [
    ['2:282', '?page=48', 'Ayah 282'],
    ['4:12', '?page=79', 'Ayah 12'],
    ['2:102', '?page=16', 'Ayah 102'],
    ['24:31', '?page=353', 'Ayah 31'],
    ['33:53', '?page=425', 'Ayah 53'],
    ['73:20', '?page=575', 'Ayah 20'],
    ['5:3', '?page=107', 'Ayah 3'],
    ['1:1', '?page=1', 'Ayah 1'],
  ];
  const out = [];
  const measure = () => page.evaluate(() => {
    const el = document.querySelector('.now__ayah');
    const r = el.getBoundingClientRect();
    const t = document.querySelector('.play-btn').getBoundingClientRect();
    const tr = document.querySelector('.word__tr');
    return {
      label: document.querySelector('.now__surah-en').textContent,
      font: Math.round(parseFloat(getComputedStyle(el).fontSize) * 10) / 10,
      tr: tr ? Math.round(parseFloat(getComputedStyle(tr).fontSize) * 10) / 10 : 0,
      inside: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
      noInner: el.scrollHeight <= el.clientHeight,
      hOver: document.documentElement.scrollWidth > innerWidth,
      ctl: t.top >= 0 && t.bottom <= innerHeight,
    };
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const words of [true, false]) {
    await page.goto(BASE + '?page=1');
    await page.waitForSelector('.now__ayah');
    // The word-by-word setting persists in localStorage; set it through the checkbox.
    await page.locator('.settings summary').click();
    const box = page.locator('.settings input[type=checkbox]').nth(1);
    if ((await box.isChecked()) !== words) await box.click();
    await page.locator('.settings summary').click();
    for (const [name, q, tail] of ayahs) {
      await page.goto(BASE + q);
      await page.waitForSelector('.now__ayah');
      let label = await page.locator('.now__surah-en').textContent();
      if (!label.endsWith(tail)) {
        // Loop mode plays the page in order; pause once the wanted ayah shows.
        await page.goto(BASE + q + '&mode=loop&autoplay=1');
        await page.waitForSelector('.now__ayah');
        await page.evaluate(() => document.querySelector('.gate')?.click());
        for (let i = 0; i < 300 && !label.endsWith(tail); i++) {
          await page.waitForTimeout(150);
          // Read the label, then jump the audio to its end so the walk skips real recitation.
          label = await page.evaluate((t) => {
            const l = document.querySelector('.now__surah-en').textContent;
            const a = document.querySelector('audio');
            if (!l.endsWith(t) && a.duration > 1) a.currentTime = a.duration - 0.05;
            return l;
          }, tail);
        }
        await page.evaluate(() => document.querySelector('.play-btn').click());
      }
      for (const [w, h] of sizes) {
        await page.setViewportSize({ width: w, height: h });
        await page.waitForTimeout(200);
        const m = await measure();
        const bad = m.label.endsWith(tail) ? '' : ` LABEL_MISMATCH(${m.label})`;
        const state = m.inside && m.noInner ? 'FULL' : m.inside ? 'INNER-SCROLL' : 'OUT-OF-VIEW';
        out.push(`${words ? 'words' : 'plain'} ${name} ${w}x${h} font=${m.font} tr=${m.tr} ${state} hOver=${m.hOver} ctl=${m.ctl}${bad}`);
      }
    }
  }
  return out.join('\n');
}
