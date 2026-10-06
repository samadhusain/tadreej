// Usage: npx -y @playwright/cli@latest -s=tadreej run-code --filename=scripts/settings-label-check.js
// Needs the dev server on http://localhost:5199. Checks the three Settings fields with a limited range
// (Reps per step, Pause between steps, Gap between ayahs): the label text, the range in an <em>,
// and that the range in the label matches the input's min and max.
async page => {
  const BASE = 'http://localhost:5199/';
  const FIELDS = [
    { name: 'Reps per step', text: 'Reps per step (1–9)', em: '(1–9)' },
    { name: 'Pause between steps', text: 'Pause between steps (0–15 sec)', em: '(0–15 sec)' },
    { name: 'Gap between ayahs', text: 'Gap between ayahs (0–5 sec)', em: '(0–5 sec)' },
  ];
  // The drive setup sheet opens on a first visit and covers the page. Mark it seen.
  await page.addInitScript(() => { try { localStorage.setItem('tadreej.driveSetupSeen', '1'); } catch { /* noop */ } });
  await page.goto(BASE);
  await page.waitForSelector('.settings');
  const results = await page.evaluate(names => {
    document.querySelector('.settings').open = true;
    return names.map(name => {
      const label = [...document.querySelectorAll('.settings label.field')]
        .find(l => l.textContent.trim().startsWith(name));
      const span = label && label.querySelector('span');
      const input = label && label.querySelector('input');
      return {
        text: span ? span.textContent.trim() : null,
        em: span && span.querySelector('em') ? span.querySelector('em').textContent.trim() : null,
        min: input && input.getAttribute('min'),
        max: input && input.getAttribute('max'),
      };
    });
  }, FIELDS.map(f => f.name));
  const lines = [];
  FIELDS.forEach((f, i) => {
    const got = results[i];
    const range = (got.text || '').match(/\((\d+)–(\d+)/);
    lines.push(
      got.text === f.text ? `PASS ${f.name}: label text` : `FAIL ${f.name}: label text (got ${JSON.stringify(got.text)})`,
      got.em === f.em ? `PASS ${f.name}: range in em` : `FAIL ${f.name}: range in em (got ${JSON.stringify(got.em)})`,
      range && range[1] === got.min && range[2] === got.max
        ? `PASS ${f.name}: label range matches input limits`
        : `FAIL ${f.name}: label range matches input limits (label range ${range ? range[1] + '–' + range[2] : 'none'}, input ${got.min}–${got.max})`,
    );
  });
  return lines.join('\n');
}
