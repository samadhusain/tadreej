// Usage: npx -y @playwright/cli@latest -s=tadreej run-code --filename=scripts/follow-check.js
// Needs the dev server on http://localhost:5199 and takes about two minutes. Checks the word follow:
// the page follows on phones, a hand scroll stops it until the word is back in view and the view is still,
// a new ayah or a loop restart returns to the top,
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
  // Move the audio by a few seconds (a word change) and wait.
  const seekBy = async (sec, wait = 600) => {
    await page.evaluate((d) => { document.querySelector('audio').currentTime += d; }, sec);
    await page.waitForTimeout(wait);
  };
  // Scroll by hand (wheel) so the sounding word sits `top` px below the top of the view, then let the view settle.
  const scrollWordIntoView = async (top) => {
    const delta = await page.evaluate((t) => document.querySelector('.word.is-active').getBoundingClientRect().top - t, top);
    await page.mouse.wheel(0, delta);
    await page.waitForTimeout(700);
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

  // (b) a hand scroll stops the follow; it resumes when the word is back in view and the view is still
  await seek(0.28); // the follow has moved the page to the word
  const followed = await state();
  // (b1) wheel far away: the word is out of view, and the page holds through word changes and a wait
  await page.mouse.move(100, 300);
  await page.mouse.wheel(0, 3000);
  await page.waitForTimeout(400);
  const far = await state();
  const heldYs = [];
  await seek(0.3); heldYs.push((await state()).y);
  await seek(0.33); heldYs.push((await state()).y);
  await page.waitForTimeout(5500);
  await seek(0.36); heldYs.push((await state()).y);
  check('(b1) word out of view after a hand scroll: the page holds', !far.inView && heldYs.every((y) => y === far.y), `held ${far.y}, then ${heldYs.join(',')}`);
  // (b2) scroll back by hand to the word, let the view settle: the follow takes over at the next row turn
  await scrollWordIntoView(300);
  const back = await state();
  await seekBy(0.3, 500); // a word change in view lets the stop go
  await seek(0.6, 1300);
  const resumed = await state();
  check('(b2) back in view by hand: the follow resumes', back.inView && Math.abs(resumed.y - back.y) > 20 && resumed.inView, `y ${back.y} -> ${resumed.y}, in view ${resumed.inView}`);
  // (b4) while a touch is down nothing follows; after it ends and the view is still, it does
  await user('touchstart');
  await page.evaluate(() => { // put the sounding row at the bottom of the view
    const r = document.querySelector('.word.is-active').getBoundingClientRect();
    window.scrollTo(0, scrollY + r.bottom - innerHeight + 2);
  });
  await page.waitForTimeout(200);
  const down0 = (await state()).y;
  const downYs = [];
  for (let i = 0; i < 3; i++) { await seekBy(0.2, 450); downYs.push((await state()).y); }
  check('(b4) touch in progress: no follow', downYs.every((y) => y === down0), `y ${down0}, then ${downYs.join(',')}`);
  await user('touchend');
  await page.waitForTimeout(500);
  let upY = down0, upView = null;
  for (let i = 0; i < 8 && upY === down0; i++) { await seekBy(0.2, 600); const s = await state(); upY = s.y; upView = s.inView; }
  check('(b4) after touchend and 400ms: follows again', upY !== down0 && upView, `y ${down0} -> ${upY}`);
  // (b3) a tap with the word in view does not end the follow
  await user('touchstart'); await user('touchend');
  await page.waitForTimeout(600);
  await seekBy(0.3, 500);
  const beforeTap = await state();
  await seek(0.9, 1300);
  const afterTap = await state();
  check('(b3) a tap with the word in view: the follow continues', Math.abs(afterTap.y - beforeTap.y) > 20 && afterTap.inView, `y ${beforeTap.y} -> ${afterTap.y}`);
  check('(b) first follow moved the page', followed.y > 0, `y ${followed.y}`);

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
  // a hand scroll of the box away from the word stops the box follow; scrolling back to it resumes
  await seek(0.5, 1300);
  await page.mouse.move(900, 450);
  await page.mouse.wheel(0, 3000);
  await page.waitForTimeout(500);
  const away = await state();
  await seek(0.55, 1300);
  const stillAway = await state();
  check('(e) desk: word out of the box after a hand scroll: the box holds', !away.inBox && stillAway.boxTop === away.boxTop, `held ${away.boxTop}, then ${stillAway.boxTop}`);
  const delta = await page.evaluate(() => {
    const box = document.querySelector('.now__ayah');
    return document.querySelector('.word.is-active').getBoundingClientRect().top - box.getBoundingClientRect().top - 100;
  });
  await page.mouse.wheel(0, delta);
  await page.waitForTimeout(700);
  const backBox = await state();
  await seekBy(0.3, 500);
  await seek(0.8, 1500);
  const resumedBox = await state();
  check('(e) desk: back in the box by hand: the box follow resumes', backBox.inBox && resumedBox.boxTop !== backBox.boxTop && resumedBox.inBox, `boxTop ${backBox.boxTop} -> ${resumedBox.boxTop}`);

  // (f) a one-ayah loop restart lands at 0 (header visible)
  await play([390, 844], '?page=48&mode=loop');
  await seek(0.9);
  const mid = (await state()).y;
  await toEnd(3500);
  const restart = (await state()).y;
  check('(f) single-ayah loop restart lands at 0', mid > 0 && restart === 0, `y ${mid} -> ${restart}`);

  // (g) single-ayah loop: a hand scroll away, then the restart returns to 0 and the follow works again
  await play([390, 844], '?page=48&mode=loop');
  await seek(0.5);
  await page.mouse.move(100, 300);
  await page.mouse.wheel(0, 3000);
  await page.waitForTimeout(400);
  const awayY = (await state()).y;
  await toEnd(3500);
  const gRestart = await state();
  await seek(0.5, 1500);
  const gAgain = await state();
  check('(g) loop restart after a hand scroll: back at 0, follow works', awayY > 0 && gRestart.y === 0 && gAgain.y > 0 && gAgain.inView, `y ${awayY} -> ${gRestart.y} -> ${gAgain.y}`);

  const failed = results.filter((r) => r.startsWith('FAIL'));
  return results.join('\n') + '\n' + (failed.length ? failed.length + ' FAILED' : 'ALL CHECKS PASSED');
}
