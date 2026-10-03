// Usage: npx -y @playwright/cli@latest -s=tadreej run-code --filename=scripts/follow-check.js
// Needs the dev server on http://localhost:5199 and takes about a minute. Checks the word follow:
// the page follows on phones, a hand scroll stops it until the next ayah, a new ayah returns to the top,
// Settings blocks it, desk mode scrolls the box and never the page, and a one-ayah loop restarts at 0.
async page => {
  const BASE = 'http://localhost:5199/';
  const results = [];
  const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' (' + detail + ')' : ''}`);
  const state = () => page.evaluate(() => {
    const box = document.querySelector('.now__ayah');
    const w = document.querySelector('.word.is-active');
    const r = w && w.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    return {
      y: Math.round(scrollY),
      boxTop: Math.round(box.scrollTop),
      label: document.querySelector('.now__surah-en').textContent,
      inView: r ? r.top >= 0 && r.bottom <= innerHeight : null,
      inBox: r ? r.top >= b.top - 1 && r.bottom <= b.bottom + 1 : null,
    };
  });
  const seek = async (f, wait = 1200) => {
    await page.evaluate((f) => { const a = document.querySelector('audio'); if (isFinite(a.duration)) a.currentTime = a.duration * f; }, f);
    await page.waitForTimeout(wait);
  };
  const toEnd = async (wait = 1500) => {
    await page.evaluate(() => { const a = document.querySelector('audio'); if (isFinite(a.duration)) a.currentTime = a.duration - 0.05; });
    await page.waitForTimeout(wait);
  };
  // Open a page in loop mode with words on, and start playing.
  const play = async (vp, q) => {
    await page.setViewportSize({ width: vp[0], height: vp[1] });
    await page.goto(BASE + q);
    await page.waitForSelector('.now__ayah');
    await page.evaluate(() => {
      const d = document.querySelector('.settings'); d.open = true;
      const b = document.querySelectorAll('.settings input[type=checkbox]')[1]; if (!b.checked) b.click();
      d.open = false;
    });
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => document.querySelector('.play-btn').click());
    await page.evaluate(() => document.querySelector('.gate')?.click());
    await page.waitForTimeout(1500);
  };
  const user = (type) => page.evaluate((t) => window.dispatchEvent(new Event(t)), type);

  // (a) the page follows on a phone, and the word stays in view
  await play([390, 844], '?page=48&mode=loop');
  const inView = [];
  let moved = false;
  for (const f of [0.28, 0.45, 0.7, 0.9]) {
    await seek(f);
    const s = await state();
    inView.push(s.inView);
    moved = moved || s.y > 0;
  }
  check('(a) page follows on 390x844', moved, 'scrollY moved');
  check('(a) active word stays in view', inView.every(Boolean), inView.join(','));

  // (b) a hand scroll stops the follow until the next ayah, even after a long wait
  await seek(0.05); // back near the top; the follow returns the page
  await page.mouse.move(100, 300);
  await page.mouse.wheel(0, 40);
  await page.waitForTimeout(200);
  const held = (await state()).y;
  const ys = [];
  await seek(0.5); ys.push((await state()).y);
  await page.waitForTimeout(5500);
  await seek(0.75); ys.push((await state()).y);
  await seek(0.95); ys.push((await state()).y);
  check('(b) wheel stops the follow until the next ayah', ys.every((y) => y === held), `held ${held}, then ${ys.join(',')}`);

  // (c) a new ayah returns to 0, also when a touch came just before the change
  await play([390, 664], '?page=16&mode=loop');
  await seek(0.9);
  const before = (await state());
  await user('touchstart');
  await toEnd(1800);
  const after = await state();
  check('(c) new ayah returns to 0 after a touch', before.y > 0 && after.y === 0, `${before.label} y=${before.y} -> ${after.label} y=${after.y}`);

  // (d) Settings open blocks the follow
  await play([390, 844], '?page=48&mode=loop');
  await page.evaluate(() => { document.querySelector('.settings').open = true; document.querySelector('.settings').scrollIntoView({ block: 'center' }); });
  await page.waitForTimeout(500);
  const y0 = (await state()).y;
  const sy = new Set();
  for (const f of [0.2, 0.4, 0.6, 0.8]) { await seek(f, 700); sy.add((await state()).y); }
  check('(d) Settings open: no movement', sy.size === 1 && sy.has(y0), `y ${y0} -> ${[...sy].join(',')}`);

  // (e) desk: the box follows, the page stays at 0
  await play([1920, 945], '?page=48&mode=loop');
  const desk = [];
  for (const f of [0.1, 0.3, 0.5, 0.7, 0.95]) { await seek(f, 1300); desk.push(await state()); }
  check('(e) desk: page scrollY stays 0', desk.every((s) => s.y === 0), desk.map((s) => s.y).join(','));
  check('(e) desk: the box scrolls and the word stays in it', desk.some((s) => s.boxTop > 0) && desk.every((s) => s.inBox), desk.map((s) => s.boxTop).join(','));
  // a hand scroll of the box stops the box follow until the next ayah
  await page.mouse.move(900, 450);
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(400);
  const handTop = (await state()).boxTop;
  await seek(0.85, 1500);
  check('(e) desk: wheel over the box stops the box follow', (await state()).boxTop === handTop, `held ${handTop}`);

  // (f) a one-ayah loop restart lands at 0 (header visible)
  await play([390, 844], '?page=48&mode=loop');
  await seek(0.9);
  const mid = (await state()).y;
  await toEnd(3500);
  const restart = (await state()).y;
  check('(f) single-ayah loop restart lands at 0', mid > 0 && restart === 0, `y ${mid} -> ${restart}`);

  const failed = results.filter((r) => r.startsWith('FAIL'));
  return results.join('\n') + '\n' + (failed.length ? failed.length + ' FAILED' : 'ALL CHECKS PASSED');
}
