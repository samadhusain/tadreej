// Usage: npx -y @playwright/cli@latest -s=tadreej run-code --filename=scripts/fit-check.js
// Needs the dev server on http://localhost:5199. Desk viewports (980x680 up) must show a fixed 40px ayah,
// no page scroll and visible controls. A fitting ayah (FULL) is centred in its box within 2px; an
// overflowing one (INNER-SCROLL) has its first row at the box's top padding at scrollTop 0.
// Other viewports must be untouched (NATURAL). Prints a line per case, then a check summary.
async page => {
  const BASE = 'http://localhost:5199/';
  const sizes = [[1920,1080],[1920,945],[1728,990],[2560,1440],[1536,864],[1440,900],[1366,768],[1280,720],[1024,768],[768,1024],[430,932],[390,844],[375,667],[360,640],[390,664],[375,553],[360,560],[844,390],[1180,500],[980,680],[1280,680],[980,600]];
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
  const measure = () => page.evaluate(() => {
    const el = document.querySelector('.now__ayah');
    const b = el.getBoundingClientRect();
    const vis = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; };
    // The ayah block's top and bottom: from the first to the last word, or the text's line rects.
    el.scrollTop = 0;
    const cs = getComputedStyle(el);
    const padT = parseFloat(cs.paddingTop), padB = parseFloat(cs.paddingBottom);
    const ws = [...el.querySelectorAll('.word')];
    let rects;
    if (ws.length) rects = ws.map((w) => w.getBoundingClientRect());
    else { const rg = document.createRange(); rg.selectNodeContents(el); rects = [...rg.getClientRects()]; }
    const blockTop = Math.min(...rects.map((r) => r.top));
    const blockBottom = Math.max(...rects.map((r) => r.bottom));
    const topGap = blockTop - (b.top + padT);
    const bottomGap = (b.bottom - padB) - blockBottom;
    const tops = ws.map((w) => Math.round(w.getBoundingClientRect().top - b.top + el.scrollTop));
    const rowTops = [...new Set(tops)];
    const rowH = rowTops.length > 1 ? rowTops[1] - rowTops[0] : 0;
    const full = rowTops.filter((t) => t + rowH <= el.clientHeight).length;
    return {
      label: document.querySelector('.now__surah-en').textContent,
      font: getComputedStyle(el).fontSize,
      topGap: Math.round(topGap * 10) / 10,
      bottomGap: Math.round(bottomGap * 10) / 10,
      boxH: Math.round(b.height),
      rows: rowTops.length,
      rowsFit: full,
      inner: el.scrollHeight > el.clientHeight + 1,
      styled: el.hasAttribute('style'), // nothing writes an inline style any more
      docH: document.documentElement.scrollHeight,
      vh: innerHeight,
      hOver: document.documentElement.scrollWidth > innerWidth,
      ctl: vis('.play-btn') && vis('.mode') && vis('.settings'),
      boxIn: vis('.now__ayah'),
      footOk: (() => { // at most two lines (the credits wrap below 1180px), with Feedback and the dua inside it
        const f = document.querySelector('.foot').getBoundingClientRect();
        const fb = document.querySelector('.foot__feedback').getBoundingClientRect();
        const d = document.querySelector('.foot__dua').getBoundingClientRect();
        const duaFits = d.width === 0 || (fb.right <= d.left + 0.5 && d.right <= f.right + 1); // the dua may be hidden at 980px
        return f.height <= 34 && fb.right <= f.right + 1 && duaFits;
      })(),
      barOk: (() => { // mode, transport and settings do not overlap
        const r = (s) => document.querySelector(s).getBoundingClientRect();
        const m = r('.mode'), t = r('.transport'), g = r('.settings');
        return m.right <= t.left + 0.5 && t.right <= g.left + 0.5;
      })(),
    };
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  for (const words of [true, false]) {
    await page.goto(BASE + '?page=1');
    await page.waitForSelector('.now__ayah');
    // The word-by-word setting persists in localStorage; set it through the checkbox.
    await page.evaluate(() => { document.querySelector('.settings').open = true; });
    const box = page.locator('.settings input[data-setting=wordByWord]');
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
        const desk = w >= 980 && h >= 680;
        const bad = [];
        if (!m.label.endsWith(tail)) bad.push(`LABEL_MISMATCH(${m.label})`);
        if (m.hOver) bad.push('H-OVERFLOW');
        let state;
        if (desk) {
          if (m.font !== '40px') bad.push(`FONT(${m.font})`);
          if (m.docH !== m.vh) bad.push(`PAGE-SCROLL(${m.docH}/${m.vh})`);
          if (!m.ctl) bad.push('CONTROLS-HIDDEN');
          if (!m.footOk) bad.push('FOOTER-WRAPS-OR-OVERLAPS');
          if (!m.barOk) bad.push('BAR-OVERLAP');
          if (!m.boxIn) bad.push('BOX-OUT-OF-VIEW');
          state = m.inner ? 'INNER-SCROLL' : 'FULL';
          if (m.inner && Math.abs(m.topGap) > 1) bad.push(`FIRST-ROW-NOT-AT-TOP(gap ${m.topGap})`);
          if (!m.inner && Math.abs(m.topGap - m.bottomGap) > 2) bad.push(`NOT-CENTRED(top ${m.topGap}, bottom ${m.bottomGap})`);
        } else {
          if (m.styled) bad.push('HAS-STYLE-ATTRIBUTE');
          if (m.inner) bad.push('INNER-SCROLL');
          state = 'NATURAL';
        }
        if (bad.length) problems.push(`${mode} ${name} ${w}x${h}: ${bad.join(' ')}`);
        out.push(`${mode} ${name} ${w}x${h} font=${m.font} ${state} boxH=${m.boxH} rows=${m.rows} fit=${m.rowsFit} gaps=${m.topGap}/${m.bottomGap}${bad.length ? ' !' + bad.join(',') : ''}`);
      }
    }
  }
  // Leave word-by-word and the highlight on, as a fresh browser has them.
  await page.goto(BASE + '?page=1');
  await page.waitForSelector('.now__ayah');
  await page.evaluate(() => {
    document.querySelector('.settings').open = true;
    for (const k of ['wordByWord', 'highlight']) {
      const b = document.querySelector(`.settings input[data-setting=${k}]`);
      if (!b.checked) b.click();
    }
    document.querySelector('.settings').open = false;
  });
  out.push(problems.length ? 'PROBLEMS\n' + problems.join('\n') : 'ALL CHECKS PASSED');
  return out.join('\n');
}
