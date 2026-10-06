// Usage: npx -y @playwright/cli@latest -s=tadreej run-code --filename=scripts/reps-label-check.js
// Needs the dev server on http://localhost:5199. Checks the "Reps per step" field: the label text,
// the range in an <em>, and that the range in the label matches the input's min and max.
async page => {
  const BASE = 'http://localhost:5199/';
  // The drive setup sheet opens on a first visit and covers the page. Mark it seen.
  await page.addInitScript(() => { try { localStorage.setItem('tadreej.driveSetupSeen', '1'); } catch { /* noop */ } });
  await page.goto(BASE);
  await page.waitForSelector('.settings');
  const got = await page.evaluate(() => {
    document.querySelector('.settings').open = true;
    const label = [...document.querySelectorAll('.settings label.field')]
      .find(l => l.textContent.trim().startsWith('Reps per step'));
    const span = label && label.querySelector('span');
    const input = label && label.querySelector('input');
    return {
      text: span ? span.textContent.trim() : null,
      em: span && span.querySelector('em') ? span.querySelector('em').textContent.trim() : null,
      min: input && input.getAttribute('min'),
      max: input && input.getAttribute('max'),
    };
  });
  const range = (got.text || '').match(/\((\d+)–(\d+)\)/);
  return [
    got.text === 'Reps per step (1–9)' ? 'PASS label text' : `FAIL label text (got ${JSON.stringify(got.text)})`,
    got.em === '(1–9)' ? 'PASS range in em' : `FAIL range in em (got ${JSON.stringify(got.em)})`,
    range && range[1] === got.min && range[2] === got.max
      ? 'PASS label range matches input limits'
      : `FAIL label range matches input limits (label range ${range ? range[1] + '–' + range[2] : 'none'}, input ${got.min}–${got.max})`,
  ].join('\n');
}
