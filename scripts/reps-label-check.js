// Usage: npx -y @playwright/cli@latest -s=tadreej run-code --filename=scripts/reps-label-check.js
// Needs the dev server on http://localhost:5187. Checks that the "Reps per step" label shows the
// range 1–9 and that its input has min 1 and max 9.
async page => {
  const BASE = 'http://localhost:5187/';
  // The drive setup sheet opens on a first visit and covers the page. Mark it seen.
  await page.addInitScript(() => { try { localStorage.setItem('tadreej.driveSetupSeen', '1'); } catch { /* noop */ } });
  await page.goto(BASE);
  await page.waitForSelector('.settings');
  const got = await page.evaluate(() => {
    document.querySelector('.settings').open = true;
    const label = [...document.querySelectorAll('.settings label.field')]
      .find(l => l.textContent.trim().startsWith('Reps per step'));
    const input = label && label.querySelector('input');
    return {
      text: label ? label.querySelector('span').textContent.trim() : null,
      min: input && input.getAttribute('min'),
      max: input && input.getAttribute('max'),
    };
  });
  return [
    got.text === 'Reps per step (1–9)' ? 'PASS label text' : `FAIL label text (got ${JSON.stringify(got.text)})`,
    got.min === '1' && got.max === '9' ? 'PASS input min/max' : `FAIL input min/max (got ${got.min}, ${got.max})`,
  ].join('\n');
}
