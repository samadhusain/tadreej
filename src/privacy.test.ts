import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { env } from 'node:process';
import { describe, expect, it } from 'vitest';

/* This repo is public. Generic leaks, which anyone could make, are checked
   everywhere. The author's own private words stay out of the repo: they live
   in ~/.config/private-words and are checked wherever that file exists. */
const GENERIC: RegExp[] = [/192\.168\./, /\/Users\//, /gmail\.com/i];

/** One pattern per line. A plain word matches anywhere, ignoring case; a
 *  /regex/flags line is used as written. Blank lines and # comments are skipped. */
function parseWords(text: string): { line: number; re: RegExp }[] {
  return text.split('\n').flatMap((raw, i) => {
    const l = raw.trim();
    if (!l || l.startsWith('#')) return [];
    const m = l.match(/^\/(.+)\/([a-z]*)$/);
    const re = m ? new RegExp(m[1], m[2]) : new RegExp(l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    return [{ line: i + 1, re }];
  });
}

const WORDS_FILE = join(homedir(), '.config', 'private-words');
const PRIVATE = existsSync(WORDS_FILE) ? parseWords(readFileSync(WORDS_FILE, 'utf8')) : [];

// Binary files, the generated lockfile (its base64 hashes can mimic short words), and this file.
const SKIP: RegExp[] = [/\.png$/, /^package-lock\.json$/, /^src\/privacy\.test\.ts$/];

function committableFiles(): string[] {
  return execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' })
    .split('\n')
    .filter((f) => f && existsSync(f) && !SKIP.some((re) => re.test(f)));
}

// A download without git (GitHub's "Download ZIP") has no file list to scan,
// so the test skips there. CI always has a checkout and never skips.
const canScan = existsSync('.git') || Boolean(env.CI);

describe('parseWords', () => {
  it('reads plain words ignoring case and /regex/flags lines as written, with their line numbers', () => {
    const words = parseWords('# comment\n\nsecret.host\n/\\bX[12]\\b/\n');
    expect(words.map((w) => w.line)).toEqual([3, 4]);
    const [plain, regex] = words.map((w) => w.re);
    expect(plain.test('SECRET.HOST')).toBe(true);
    expect(plain.test('secretXhost')).toBe(false);
    expect(regex.test('on X1 today')).toBe(true);
    expect(regex.test('on x1 today')).toBe(false);
  });
});

describe('public repo hygiene', () => {
  it.skipIf(!canScan)('has no private strings in any file git would commit', () => {
    const hits: string[] = [];
    for (const file of committableFiles()) {
      const text = readFileSync(file, 'utf8');
      for (const re of GENERIC) if (re.test(text)) hits.push(`${file}: ${re}`);
      // A private word is named by its line in the file, so a failure never prints it.
      for (const { line, re } of PRIVATE) if (re.test(text)) hits.push(`${file}: line ${line} of ~/.config/private-words`);
    }
    expect(hits).toEqual([]);
  });
});
