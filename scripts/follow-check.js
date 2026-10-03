// Usage: npx -y @playwright/cli@latest -s=tadreej run-code --filename=scripts/follow-check.js
// Needs the dev server on http://localhost:5199 and takes about two minutes. Checks the word follow:
// the page follows on phones, a hand scroll stops it until the view is still and the controls are off screen (then it returns to the word),
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
      for (const k of ['wordByWord', 'highlight']) {
        const b = document.querySelector(`.settings input[data-setting=${k}]`); if (!b.checked) b.click();
      }
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

  // (b) a hand scroll stops the follow. Once the view is still and the controls are off screen,
  // the follow brings the view back to the word. With the controls on screen it holds.
  const wordState = () => page.evaluate(() => {
    // Between words nothing is active; keep the last one.
    const w = document.querySelector('.word.is-active') || window.__lastWord;
    window.__lastWord = w;
    const r = w.getBoundingClientRect();
    const t = document.querySelector('.transport').getBoundingClientRect();
    const au = document.querySelector('audio');
    return { audio: au.paused ? 'paused' : 'playing', top: Math.round(r.top), inView: r.top >= 0 && r.bottom <= innerHeight, controls: t.bottom > 0 && t.top < innerHeight, y: Math.round(scrollY) };
  });
  // Poll until the word is back in view; returns the milliseconds it took, or null.
  const returnTime = async (maxMs = 8000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
      await page.waitForTimeout(150);
      if ((await wordState()).inView) return Date.now() - t0;
    }
    return null;
  };
  await seek(0.28); // the follow has moved the page to the word
  const followed = await state();
  check('(b) first follow moved the page', followed.y > 0, `y ${followed.y}`);
  await page.mouse.move(100, 300);
  // (b1) wheel down about two rows: the word is above the view, controls are far below
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(300);
  const off1 = await wordState();
  const t1 = await returnTime();
  check('(b1) word above the view: the view returns to it in about 2s', !off1.inView && !off1.controls && t1 !== null && t1 <= 4500, `${t1}ms, y ${off1.y} -> ${(await wordState()).y}, audio ${off1.audio}`);
  // (b1') the word below the view
  await seek(0.4);
  await page.mouse.wheel(0, -5000);
  await page.waitForTimeout(300);
  const off2 = await wordState();
  const t2 = await returnTime();
  check("(b1') word below the view: the view returns to it", !off2.inView && !off2.controls && t2 !== null && t2 <= 4500, `${t2}ms, y ${off2.y} -> ${(await wordState()).y}`);
  // (b1'') far above the view, still short of the controls
  await seek(0.45); // far enough from the end that 900px down still leaves the controls off screen
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(300);
  const off3 = await wordState();
  const t3 = await returnTime();
  check("(b1'') word far above, controls still off screen: the view returns", !off3.inView && !off3.controls && t3 !== null && t3 <= 4500, `${t3}ms, y ${off3.y} -> ${(await wordState()).y}`);

  // (b2) wheel all the way to the controls: the page holds through a long wait and word changes
  await page.waitForTimeout(1500); // let the return scroll finish
  await page.mouse.wheel(0, 6000);
  await page.waitForTimeout(400);
  const atBar = await wordState();
  const barYs = [];
  await seekBy(0.3, 700); barYs.push((await wordState()).y);
  await page.waitForTimeout(6000);
  await seekBy(0.3, 700); barYs.push((await wordState()).y);
  await seekBy(2, 700); barYs.push((await wordState()).y);
  check('(b2) controls on screen: the page holds', atBar.controls && barYs.every((y) => y === atBar.y), `y ${atBar.y}, then ${barYs.join(',')}`);

  // (b5) the controls and the word are both on screen (end of the ayah): a hand scroll still holds
  await play([390, 844], '?page=48&mode=loop');
  await seek(0.95, 1500);
  await page.mouse.move(100, 300);
  await page.mouse.wheel(0, 260);
  await page.waitForTimeout(400);
  const both = await wordState();
  const bothYs = [];
  await seekBy(0.2, 700); bothYs.push((await wordState()).y);
  await page.waitForTimeout(2500);
  await seekBy(0.2, 700); bothYs.push((await wordState()).y);
  check('(b5) word and controls both on screen: the page holds', both.controls && both.inView && bothYs.every((y) => y === both.y), `y ${both.y}, then ${bothYs.join(',')}`);

  // (b2') scroll back by hand to the word: the follow takes over at the next row turn
  await play([390, 844], '?page=48&mode=loop');
  await seek(0.3);
  await page.mouse.move(100, 300);
  await page.mouse.wheel(0, 3000); // far from the word, controls near the bottom
  await page.waitForTimeout(300);
  await scrollWordIntoView(300);
  const back = await state();
  await seekBy(1.3, 600); // a word change in view lets the stop go
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
  await seekBy(1.3, 600);
  const beforeTap = await state();
  await seek(0.9, 1300);
  const afterTap = await state();
  check('(b3) a tap with the word in view: the follow continues', Math.abs(afterTap.y - beforeTap.y) > 20 && afterTap.inView, `y ${beforeTap.y} -> ${afterTap.y}`);

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
  // a hand scroll of the box away from the word: it holds, then the box returns to the word; the page stays at 0
  await seek(0.5, 1300);
  await page.mouse.move(900, 450);
  await page.mouse.wheel(0, 3000);
  await page.waitForTimeout(300);
  const away = await state();
  const t0 = Date.now();
  let backBox = away;
  while (Date.now() - t0 < 8000 && !backBox.inBox) { await page.waitForTimeout(150); backBox = await state(); }
  const boxMs = Date.now() - t0;
  check('(e) desk: the box returns to the word in about 2s, the page stays at 0', !away.inBox && backBox.inBox && backBox.y === 0 && boxMs >= 1200 && boxMs <= 4500, `${boxMs}ms, boxTop ${away.boxTop} -> ${backBox.boxTop}, scrollY ${backBox.y}`);

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

  // (h) highlight off: no word is active and the page never moves; on again, it resumes
  const setHighlight = (on) => page.evaluate((on) => {
    const d = document.querySelector('.settings'); d.open = true;
    const b = document.querySelector('.settings input[data-setting=highlight]'); if (b.checked !== on) b.click();
    d.open = false;
  }, on);
  await play([390, 844], '?page=48&mode=loop');
  await seek(0.3);
  await setHighlight(false);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  const offStates = [];
  for (const f of [0.2, 0.4, 0.6, 0.8]) {
    await seek(f, 900);
    offStates.push(await page.evaluate(() => ({ active: document.querySelectorAll('.word.is-active').length, y: Math.round(scrollY) })));
  }
  check('(h) highlight off: no active word, page stays at 0', offStates.every((s) => s.active === 0 && s.y === 0), JSON.stringify(offStates));
  await setHighlight(true);
  await seek(0.5, 1500);
  const onState = await state();
  check('(h) highlight on again: the word is active and the page follows', onState.inView === true && onState.y > 0, `y ${onState.y}`);
  // desk: off leaves no active word, the box stays at the top and still scrolls by hand
  await play([1920, 945], '?page=48&mode=loop');
  await setHighlight(false);
  await page.waitForTimeout(600);
  await seek(0.6, 1300);
  const deskOff = await page.evaluate(() => ({ active: document.querySelectorAll('.word.is-active').length, boxTop: document.querySelector('.now__ayah').scrollTop, y: scrollY }));
  await page.mouse.move(900, 450);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(500);
  const deskHand = await page.evaluate(() => ({ boxTop: document.querySelector('.now__ayah').scrollTop }));
  check('(h) desk highlight off: no active word, box not followed, hand scroll works', deskOff.active === 0 && deskOff.boxTop === 0 && deskHand.boxTop > 0, JSON.stringify([deskOff, deskHand]));
  await setHighlight(true);

  const failed = results.filter((r) => r.startsWith('FAIL'));
  return results.join('\n') + '\n' + (failed.length ? failed.length + ' FAILED' : 'ALL CHECKS PASSED');
}
