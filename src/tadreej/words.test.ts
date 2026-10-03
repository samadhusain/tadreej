import { describe, expect, it } from 'vitest';
import { activeWord, alignWords, parseWordsPage, splitWords, wordsUrl } from './words';

describe('splitWords', () => {
  it('splits an ayah on spaces', () => {
    expect(splitWords('ذَٰلِكَ ٱلْكِتَٰبُ لَا')).toEqual(['ذَٰلِكَ', 'ٱلْكِتَٰبُ', 'لَا']);
  });

  it('keeps a pause mark with the word before it', () => {
    expect(splitWords('لَا رَيْبَ ۛ فِيهِ ۛ هُدًى')).toEqual(['لَا', 'رَيْبَ ۛ', 'فِيهِ ۛ', 'هُدًى']);
  });

  it('keeps a leading hizb mark with the word after it', () => {
    expect(splitWords('۞ إِنَّ ٱللَّهَ')).toEqual(['۞ إِنَّ', 'ٱللَّهَ']);
  });
});

describe('alignWords', () => {
  it('pairs each word with its translation', () => {
    expect(alignWords('لَا رَيْبَ ۛ', ['no', 'doubt'], 2)).toEqual([
      { ar: 'لَا', tr: 'no', pos: 1 },
      { ar: 'رَيْبَ ۛ', tr: 'doubt', pos: 2 },
    ]);
  });

  it('translates the Bismillah that opens a surah, and numbers the ayah words after it', () => {
    const words = alignWords('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ الٓمٓ', ['Alif Laam Meem'], 1);
    expect(words?.map((w) => w.tr)).toEqual([
      'In (the) name', '(of) Allah', 'the Most Gracious', 'the Most Merciful', 'Alif Laam Meem',
    ]);
    // The recording starts after the Bismillah, so those four words never highlight.
    expect(words?.map((w) => w.pos)).toEqual([0, 0, 0, 0, 1]);
  });

  it('gives up when the counts differ, so no word shows the wrong translation', () => {
    expect(alignWords('سَلَٰمٌ عَلَىٰٓ إِلْ يَاسِينَ', ['Peace be', 'upon', 'Elijah'], 130)).toBeNull();
    expect(alignWords('لَا رَيْبَ', ['no', 'doubt', 'in it', 'a Guidance', 'for', 'them'], 2)).toBeNull();
    expect(alignWords('لَا رَيْبَ', [], 2)).toBeNull();
  });
});

describe('parseWordsPage', () => {
  const page = {
    verses: [{
      verse_key: '2:2',
      words: [
        { char_type_name: 'word', translation: { text: 'That' } },
        { char_type_name: 'word', translation: { text: '(is) the book' } },
        { char_type_name: 'end', translation: { text: '(2)' } },
      ],
      audio: { segments: [[0, 1, 150, 860], [2, 870, 1820], [3], [4, null, 2400]] },
    }],
  };

  it('keeps the translation of each word and drops the ayah-number marker', () => {
    expect(parseWordsPage(page)['2:2'].tr).toEqual(['That', '(is) the book']);
  });

  it('reads timings as [word, start ms, end ms] and drops malformed ones', () => {
    expect(parseWordsPage(page)['2:2'].segs).toEqual([[1, 150, 860], [2, 870, 1820]]);
  });

  it('reads a page without timings', () => {
    const noAudio = { verses: [{ verse_key: '1:1', words: page.verses[0].words }] };
    expect(parseWordsPage(noAudio)['1:1'].segs).toEqual([]);
  });

  it('reads nothing from a response of another shape', () => {
    expect(parseWordsPage({})).toEqual({});
    expect(parseWordsPage(null)).toEqual({});
  });
});

describe('activeWord', () => {
  const segs: [number, number, number][] = [[1, 150, 860], [2, 870, 1820], [3, 1830, 2130]];

  it('is 0 before the first word starts', () => {
    expect(activeWord(segs, 0)).toBe(0);
    expect(activeWord([], 500)).toBe(0);
  });

  it('is the word whose timing has started most recently', () => {
    expect(activeWord(segs, 150)).toBe(1);
    expect(activeWord(segs, 865)).toBe(1);
    expect(activeWord(segs, 900)).toBe(2);
    expect(activeWord(segs, 9000)).toBe(3);
  });
});

describe('wordsUrl', () => {
  it('asks for timings only for a reciter Quran.com has timed', () => {
    expect(wordsUrl(2, 'Alafasy_128kbps')).toBe('https://api.quran.com/api/v4/verses/by_page/2?words=true&per_page=50&audio=7');
    expect(wordsUrl(2, 'Hudhaify_128kbps')).toBe('https://api.quran.com/api/v4/verses/by_page/2?words=true&per_page=50');
  });
});
