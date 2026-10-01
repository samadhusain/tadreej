import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { feedbackLinks } from './feedback';

const NEW_ISSUE = 'https://github.com/samadhusain/tadreej/issues/new';
const FORMS = '.github/ISSUE_TEMPLATE';

// '&' and '#' end a query value when they are not encoded.
const context = {
  where: 'Pages 563–564 · Al-Mulk · Ayah 13 · stepped mode · A & B #1',
  device: 'Installed app · 440×956 · Mozilla/5.0 (iPhone)',
};

describe('feedbackLinks', () => {
  it('opens the bug form with where and device filled in, whatever characters they hold', () => {
    const url = new URL(feedbackLinks(context).bug);
    expect(url.origin + url.pathname).toBe(NEW_ISSUE);
    expect(url.searchParams.get('template')).toBe('bug_report.yml');
    expect(url.searchParams.get('where')).toBe('Pages 563–564 · Al-Mulk · Ayah 13 · stepped mode · A & B #1');
    expect(url.searchParams.get('device')).toBe('Installed app · 440×956 · Mozilla/5.0 (iPhone)');
  });

  it('opens the feature form', () => {
    const url = new URL(feedbackLinks(context).feature);
    expect(url.origin + url.pathname).toBe(NEW_ISSUE);
    expect(url.searchParams.get('template')).toBe('feature_request.yml');
  });

  // GitHub ignores a form name or a field id it does not know: it shows an
  // empty form and no error. So the forms are checked against the links.
  it('links only to forms in this repo, and fills only fields those forms define', () => {
    for (const link of Object.values(feedbackLinks(context))) {
      const params = new URL(link).searchParams;
      const file = `${FORMS}/${params.get('template')}`;
      expect(existsSync(file), `${file} exists`).toBe(true);
      const ids = [...readFileSync(file, 'utf8').matchAll(/^\s*id:\s*(\S+)\s*$/gm)].map((m) => m[1]);
      const filled = [...params.keys()].filter((key) => key !== 'template');
      expect(ids, `field ids in ${file}`).toEqual(expect.arrayContaining(filled));
    }
  });
});
