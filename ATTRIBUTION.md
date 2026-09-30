# Attribution

Tadreej's source code is MIT licensed; see [LICENSE](LICENSE). That license covers the source code only. The files in `src/tadreej/data/` and `scripts/timings/`, the Quran text and the recordings keep their own terms, listed below.

## Page and surah data

`src/tadreej/data/pages.json` and `src/tadreej/data/surahs.json`

Page boundaries and surah metadata: Tanzil Quran Metadata v1.0, Copyright (C) 2008-2009 Tanzil.info, CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/). Retrieved through the AlQuran Cloud API (https://alquran.cloud) and reformatted to JSON. Surah 40's English name ("Ghafir") and the Arabic surah names come from AlQuran Cloud.

## Quran text

Fetched when the app runs; not stored in this repo.

Quran text: Tanzil Project (https://tanzil.net), served by AlQuran Cloud (https://alquran.cloud), an Islamic Network project. The text is shown verbatim.

## Audio

Audio: EveryAyah.com (https://everyayah.com). Recitations remain the property of their reciters and publishers.

### Abdirashid Ali Sufi and Noreen Muhammad Siddique

Abdirashid Ali Sufi and Noreen Muhammad Siddique: recordings from QuranicAudio.com (https://quranicaudio.com). Noreen Muhammad Siddique's recordings come from Naqaa Studio. Tadreej cuts them into per-ayah files and hosts them for free, non-commercial use. If you hold rights to these recordings and want them removed, open an issue in this repo and we will take them down.

## Verse timings

`scripts/timings/abdurrashid_sufi.json`: Verse timings derived from Qur'anic Universal Audio v3.2.0 (abdur_rashid_sufi_qdc) by QUD Technologies and contributors, https://github.com/QUD-Technologies/quranic-universal-audio, CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Changes: kept each verse's canonical take, converted to [start_ms, end_ms].

`scripts/timings/noreen_siddiq.json`: Verse timings produced with the Quranic Universal Aligner (https://aligner.qud.dev) by QUD, CC BY 4.0. Changes: split at verse boundaries, first complete take kept, verses joined in one breath cut at word timings.

## Icons

Play, pause, skip and search glyphs adapted from Material Icons by Google, Apache License 2.0 (https://www.apache.org/licenses/LICENSE-2.0).

The app icons are original to Tadreej and covered by its MIT license.

## Fonts

Inter, Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter), SIL Open Font License 1.1.

Scheherazade New, Copyright (c) 1994-2026, SIL Global (https://www.sil.org/), with Reserved Font Names "Scheherazade" and "SIL". SIL Open Font License 1.1.

Both are bundled through Fontsource (https://fontsource.org).
