/* ============================================================
   Tadreej — footer credits.
   Tanzil's terms require naming the Tanzil Project and linking
   tanzil.net wherever its text is shown, so that credit never
   depends on the build. ATTRIBUTION.md sends rights holders to
   the repo's issues, so the footer always links the repo.
   ============================================================ */

export interface CreditLink { text: string; href: string }
export interface CreditLine { label: string; joiner: string; links: CreditLink[] }

export function footerCredits(hasExtraAudio: boolean): CreditLine[] {
  const audio: CreditLink[] = [{ text: 'EveryAyah.com', href: 'https://everyayah.com' }];
  if (hasExtraAudio) {
    audio.push(
      { text: 'QuranicAudio.com', href: 'https://quranicaudio.com' },
      { text: 'timed by QUD', href: 'https://github.com/QUD-Technologies/quranic-universal-audio' },
    );
  }
  return [
    { label: 'Audio:', joiner: ' · ', links: audio },
    {
      label: 'Text:',
      joiner: ' via ',
      links: [
        { text: 'Tanzil Project', href: 'https://tanzil.net' },
        { text: 'AlQuran Cloud', href: 'https://alquran.cloud' },
      ],
    },
    {
      label: 'Code:',
      joiner: ' · ',
      links: [{ text: 'open source on GitHub', href: 'https://github.com/samadhusain/tadreej' }],
    },
    {
      label: 'Built with love by',
      joiner: ' from ',
      links: [
        { text: 'Samad', href: 'https://github.com/samadhusain' },
        { text: 'Datstra Analytics', href: 'https://datstraanalytics.com' },
      ],
    },
  ];
}
