// Usage: npx -y @playwright/cli@latest -s=tadreej run-code --filename=scripts/fit-check.js
// Needs the dev server on http://localhost:5199. Desk viewports (980x600 up) must show a fixed 40px ayah,
// the same first-row offset for every ayah, no page scroll, and visible controls: FULL or INNER-SCROLL.
// Other viewports must be untouched (NATURAL). Prints a line per case, then a check summary.
async page => {
  const BASE = 'http://localhost:5199/';
  const sizes = [[1920,1080],[1920,945],[1728,990],[2560,1440],[1536,864],[1440,900],[1366,768],[1280,720],[1024,768],[768,1024],[430,932],[390,844],[375,667],[360,640],[390,664],[375,553],[360,560],[844,390],[1180,500]];
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
    ['2:6', '?page=3', 'Ayah 6'],
  ];
  const out = [];
  const problems = [];
  const firstTops = {}; // `${viewport} ${mode}` -> Set of first-row offsets
  const measure = () => page.evaluate(() => {
    const el = document.querySelector('.now__ayah');
    const b = el.getBoundingClientRect();
    const vis = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; };
    // The first row's top, relative to the content (so scrolling does not matter).
    const word = el.querySelector('.word');
    let top;
    if (word) top = word.getBoundingClientRect().top;
    else { const rg = document.createRange(); rg.selectNodeContents(el); top = rg.getClientRects()[0].top; }
    const tops = [...el.querySelectorAll('.word')].map((w) => Math.round(w.getBoundingClientRect().top - b.top + el.scrollTop));
    const rowTops = [...new Set(tops)];
    const rowH = rowTops.length > 1 ? rowTops[1] - rowTops[0] : 0;
    const full = rowTops.filter((t) => t + rowH <= el.clientHeight).length;
    return {
      label: document.querySelector('.now__surah-en').textContent,
      font: getComputedStyle(el).fontSize,
      firstTop: Math.round(top - b.top + el.scrollTop),
      boxH: Math.round(b.height),
      rows: rowTops.length,
      rowsFit: full,
      inner: el.scrollHeight > el.clientHeight + 1,
      inline: el.hasAttribute('style') || el.hasAttribute('data-fit'),
      docH: document.documentElement.scrollHeight,
      vh: innerHeight,
      hOver: document.documentElement.scrollWidth > innerWidth,
      ctl: vis('.play-btn') && vis('.mode') && vis('.settings'),
      boxIn: vis('.now__ayah'),
    };
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const words of [true, false]) {
    await page.goto(BASE + '?page=1');
    await page.waitForSelector('.now__ayah');
    // The word-by-word setting persists in localStorage; set it through the checkbox.
    await page.evaluate(() => { document.querySelector('.settings').open = true; });
    const box = page.locator('.settings input[type=checkbox]').nth(1);
    if ((await box.isChecked()) !== words) await box.click();
    await page.evaluate(() => { document.querySelector('.settings').open = false; });
    for (const [name, q, tail] of ayahs) {
      await page.goto(BASE + q);
      await page.waitForSelector('.now__ayah');
      let label = await page.locator('.now__surah-en').textContent();
      if (!label.endsWith(tail)) {
        // Loop mode plays the page in order; pause once the wanted ayah shows.
        await page.goto(BASE + q + '&mode=loop&autoplay=1');
        await page.waitForSelector('.now__ayah');
        await page.evaluate(() => document.querySelector('.gate')?.click());
        for (let i = 0; i < 400 && !label.endsWith(tail); i++) {
          await page.waitForTimeout(150);
          // Read the label, then jump the audio to its end so the walk skips real recitation.
          label = await page.evaluate((t) => {
            const l = document.querySelector('.now__surah-en').textContent;
            const a = document.querySelector('audio');
            // Seek once per ayah: repeated seeks keep restarting the buffering.
            if (!l.endsWith(t) && a.duration > 1 && a.dataset.skipped !== a.src) { a.dataset.skipped = a.src; a.currentTime = a.duration - 0.05; }
            return l;
          }, tail);
        }
        await page.evaluate(() => document.querySelector('.play-btn').click());
      }
      for (const [w, h] of sizes) {
        await page.setViewportSize({ width: w, height: h });
        await page.waitForTimeout(250);
        const m = await measure();
        const mode = words ? 'words' : 'plain';
        const desk = w >= 980 && h >= 600;
        const bad = [];
        if (!m.label.endsWith(tail)) bad.push(`LABEL_MISMATCH(${m.label})`);
        if (m.hOver) bad.push('H-OVERFLOW');
        let state;
        if (desk) {
          if (m.font !== '40px') bad.push(`FONT(${m.font})`);
          if (m.docH !== m.vh) bad.push(`PAGE-SCROLL(${m.docH}/${m.vh})`);
          if (!m.ctl) bad.push('CONTROLS-HIDDEN');
          if (!m.boxIn) bad.push('BOX-OUT-OF-VIEW');
          (firstTops[`${w}x${h} ${mode}`] ||= new Set()).add(m.firstTop);
          state = m.inner ? 'INNER-SCROLL' : 'FULL';
        } else {
          if (m.inline) bad.push('INLINE-STYLE');
          if (m.inner) bad.push('INNER-SCROLL');
          state = 'NATURAL';
        }
        if (bad.length) problems.push(`${mode} ${name} ${w}x${h}: ${bad.join(' ')}`);
        out.push(`${mode} ${name} ${w}x${h} font=${m.font} ${state} boxH=${m.boxH} rows=${m.rows} fit=${m.rowsFit} firstTop=${m.firstTop}${bad.length ? ' !' + bad.join(',') : ''}`);
      }
    }
  }
  for (const [k, v] of Object.entries(firstTops)) if (v.size > 1) problems.push(`first row offset differs at ${k}: ${[...v].join(',')}`);
  out.push(problems.length ? 'PROBLEMS\n' + problems.join('\n') : 'ALL CHECKS PASSED');
  return out.join('\n');
}
