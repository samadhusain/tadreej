#!/usr/bin/env python3
"""Cut per-ayah audio for the Tadreej reciters that everyayah.com lacks.

Tadreej plays one short MP3 per ayah, in everyayah.com's SSSAAA.mp3 layout.
Abdirashid Ali Sufi and Noreen Muhammad Siddique exist only as whole-surah
recordings. This script cuts those recordings at ayah boundaries that QUD has
timed. Serve the result from your own web server at
/tadreej-audio/<reciter>/SSSAAA.mp3, on the same origin as the app, or from any
address you set as VITE_EXTRA_AUDIO_BASE when you build the app.

Two steps:

  timings  Run once per reciter. Fetches each ayah's start and end, and writes
           scripts/timings/<reciter>.json, which is committed. Both reciters'
           timings are already in this repo, so you do not need this step.
  cut      Downloads each surah, cuts every ayah with ffmpeg into the
           git-ignored tadreej-audio/, then deletes the surah. Ayahs already
           cut are skipped, so a re-run fills gaps.

SOURCES. The audio is QuranicAudio's: Sufi's Hafs murattal, and Noreen's
ad-Duri murattal as mastered by Naqaa Studio. The timings are QUD's
(Qur'anic Universal Audio, github.com/QUD-Technologies/quranic-universal-audio).
Sufi's come from its reviewed release, pinned below. Noreen is catalogued there
but not timed, so those surahs go through QUD's Aligner against the Hafs text
and are split at every verse boundary.

NOREEN IS NOT HAFS. Every complete recording of Noreen Muhammad Siddique is
ad-Duri 'an Abi 'Amr. Way2Quran's 'Hafs' listing is a dead link. The words
differ from the Hafs text on screen in places, Al-Fatiha's "maliki" for one,
and the recitation pauses on Basri verse ends. Aligning against Hafs puts the
cuts on Kufi verse ends, which is what Tadreej's page map needs. Where two Kufi
verses are joined in one breath, the cut falls between two words.

ATTRIBUTION. QUD's timestamps are CC BY 4.0 (Qur'anic Universal Audio
contributors); see ATTRIBUTION.md. The recordings belong to their reciters and
publishers. QuranicAudio.com's terms permit personal, non-commercial use; check
them before you publish the cut files.

Usage:
  uv run --python 3.13 scripts/build_audio.py cut
  uv run --python 3.13 scripts/build_audio.py timings   # only to re-time a reciter
"""

from __future__ import annotations

import argparse
import gzip
import http.client
import io
import json
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TIMINGS_DIR = Path(__file__).resolve().parent / "timings"
AUDIO_DIR = ROOT / "tadreej-audio"
CACHE_DIR = Path("/tmp/tadreej-align-cache")

QUD_RELEASE = "https://github.com/QUD-Technologies/quranic-universal-audio/releases/download/v3.2.0"
ALIGNER = "https://aligner.qud.dev/api/v1"

SURAHS = json.loads((ROOT / "src/tadreej/data/surahs.json").read_text())
AYAH_COUNT = {int(n): meta["ayahs"] for n, meta in SURAHS.items()}

# The key is the folder the engine asks for, so it must match the reciter ids
# in src/tadreej/reciters.ts.
RECITERS = {
    "abdurrashid_sufi": {
        "name": "Abdirashid Ali Sufi",
        "riwayah": "Hafs 'an 'Asim",
        "audio": "https://download.quranicaudio.com/quran/abdurrashid_sufi/{surah:03d}.mp3",
        "timings": "QUD Quranic Universal Audio v3.2.0, abdur_rashid_sufi_qdc (reviewed)",
    },
    "noreen_siddiq": {
        "name": "Noreen Muhammad Siddique",
        "riwayah": "ad-Duri 'an Abi 'Amr",
        "audio": "https://download.quranicaudio.com/quran/noreen_siddiq/{surah:03d}.mp3",
        "timings": "QUD Aligner (Base model, Hafs reference), split per verse",
    },
}


def read_stream(url: str, r) -> bytes:
    """The body of an event stream's one `result` event. An `error` event is
    raised as the HTTPError the plain route would have returned."""
    event, data = None, []
    for raw in r:
        line = raw.decode().rstrip("\r\n")
        if line.startswith("event:"):
            event = line[6:].strip()
        elif line.startswith("data:"):
            data.append(line[5:].strip())
        elif not line:
            if event == "progress":  # {stage, step, steps}: shows where a slow surah is waiting
                print(f"    {json.loads(''.join(data)).get('stage')}", file=sys.stderr)
            if event == "result":
                return "\n".join(data).encode()
            if event == "error":
                err = json.loads("\n".join(data))
                raise urllib.error.HTTPError(url, err["status"], err.get("message", ""), None,
                                             io.BytesIO(json.dumps(err).encode()))
            event, data = None, []
    raise urllib.error.URLError("stream ended without a result")


def request(url: str, body: dict | None = None, timeout: int = 60, stream: bool = False) -> bytes:
    """GET, or POST `body` as JSON. Retries what the server says to retry."""
    data = json.dumps(body).encode() if body is not None else None
    headers = {"User-Agent": "tadreej-build-audio/1.0 (+https://github.com/samadhusain/tadreej)",
               "Content-Type": "application/json"}
    for attempt in range(1, 7):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data, headers), timeout=timeout) as r:
                return read_stream(url, r) if stream else r.read()
        except urllib.error.HTTPError as e:
            body = e.read()
            if e.code != 429 and e.code < 500:
                raise SystemExit(f"{url}: HTTP {e.code} {body[:500]!r}")
            # 429 means the GPU quota and the CPU fair-use limit are both spent,
            # and says how long to wait. A proxy's 5xx page is not JSON at all.
            try:
                detail = json.loads(body).get("detail") or {}
            except ValueError:
                detail = {}
            wait = detail.get("retry_after_s", 30 * attempt) if isinstance(detail, dict) else 30 * attempt
            print(f"  {url}: HTTP {e.code} {body[:200]!r}", file=sys.stderr)
        except (OSError, http.client.HTTPException) as e:
            wait = 30 * attempt
            print(f"  {url}: {e}", file=sys.stderr)
        print(f"  retry {attempt} in {wait}s", file=sys.stderr)
        time.sleep(wait)
    raise SystemExit(f"{url}: gave up")


def all_ayahs():
    for surah in range(1, 115):
        for ayah in range(1, AYAH_COUNT[surah] + 1):
            yield surah, ayah


# ---------- timings ----------

def released_timings() -> dict[str, list[int]]:
    """Sufi: QUD's reviewed verse tier, [ref, start_ms, end_ms, canonical, silence_after]."""
    with zipfile.ZipFile(io.BytesIO(request(f"{QUD_RELEASE}/abdur_rashid_sufi_qdc.zip"))) as z:
        name = next(n for n in z.namelist() if n.endswith("verse_timestamps.json.gz"))
        rows = json.loads(gzip.decompress(z.read(name)))["rows"]
    # A verse the reciter goes back over appears twice; `canonical` marks the take to keep.
    return {ref: [start, end] for ref, start, end, canonical, _ in rows if canonical}


def aligned_segments(reciter: str, surah: int) -> list[dict]:
    """Align one surah, split so no segment crosses a verse end. Cached, so an
    interrupted run resumes instead of spending the Aligner's quota again."""
    cached = CACHE_DIR / reciter / f"{surah:03d}.json"
    if cached.exists():
        return json.loads(cached.read_text())
    url = RECITERS[reciter]["audio"].format(surah=surah)
    # The streaming route, because Cloudflare cuts the plain one at 100 s, and a
    # long surah aligned on the CPU takes minutes. The stream sends a keepalive
    # after 15 s of silence, so 60 s without a byte is a dead connection: retry.
    aligned = json.loads(request(f"{ALIGNER}/align/url/stream", {"url": url, "riwayah": "hafs"},
                                 timeout=60, stream=True))
    if aligned.get("warning"):
        print(f"  {surah}: {aligned['warning']}", file=sys.stderr)
    session = f"{ALIGNER}/sessions/{aligned['audio_id']}"
    segments = json.loads(request(f"{session}/split", {"max_verses": 1}, timeout=600))["segments"]
    # Split still leaves some joined verses whole, and calling it again does not
    # help (Al-Ma'arij 70:6-7 and four more). Cut those at word timings instead.
    joined = [g for g in segments if g["ref_from"] and verse(g["ref_from"]) != verse(g["ref_to"])]
    if joined:
        timed = json.loads(request(f"{session}/timestamps", {"segments": joined}, timeout=600))["segments"]
        cuts = {g["segment"]: cut_at_verses(g, t["words"]) for g, t in zip(joined, timed, strict=True)}
        segments = [piece for g in segments for piece in cuts.get(g["segment"], [g])]
    cached.parent.mkdir(parents=True, exist_ok=True)
    cached.write_text(json.dumps(segments, ensure_ascii=False))
    return segments


def verse(ref: str) -> str:
    """'70:6:2', a word, -> '70:6', its verse."""
    return ref.rsplit(":", 1)[0]


def cut_at_verses(seg: dict, words: list) -> list[dict]:
    """Cut a segment that spans verses at the first word of each later verse,
    as split does. `words` are [ref, start, end], in seconds from the segment's
    start. The outer edges keep the segment's own padding."""
    if not words or verse(words[0][0]) != verse(seg["ref_from"]) or verse(words[-1][0]) != verse(seg["ref_to"]):
        raise SystemExit(f"word timings do not match segment {seg['ref_from']}-{seg['ref_to']}")
    groups: list[list] = []
    for w in words:
        if groups and verse(groups[-1][0][0]) == verse(w[0]):
            groups[-1].append(w)
        else:
            groups.append([w])
    return [
        {**seg, "ref_from": g[0][0], "ref_to": g[-1][0],
         "time_from": seg["time_from"] + (g[0][1] if i else 0),
         "time_to": seg["time_from"] + groups[i + 1][0][1] if i + 1 < len(groups) else seg["time_to"]}
        for i, g in enumerate(groups)
    ]


def first_complete_take(ref: str, segs: list[tuple[int, dict]]) -> list[int]:
    """[start_ms, end_ms] of the first take that recites the verse from its first
    word to its last. `segs` are (position in the surah, segment), in order.

    A take is a run of the verse's segments with no other verse between them.
    Inside one, the reciter may pause, or step back a few words and carry on:
    2:13 stops at its twelfth word and resumes from its eighth. Coming back from
    the next verse starts a new take: the recitation reads 36:26, starts 36:27,
    returns to the middle of 36:26, then reads 36:27 whole. Joining every
    segment instead would stretch each verse into its neighbour."""
    word = lambda r: int(r.rsplit(":", 1)[1])
    last = max(word(s["ref_to"]) for _, s in segs)
    for i, (pos, first) in enumerate(segs):
        if word(first["ref_from"]) != 1:
            continue
        end, reach = first, word(first["ref_to"])
        for npos, nxt in segs[i + 1:]:
            if reach == last or npos != pos + 1 or word(nxt["ref_from"]) > reach + 1:
                break
            pos, end, reach = npos, nxt, max(reach, word(nxt["ref_to"]))
        if reach == last:
            return [round(first["time_from"] * 1000), round(end["time_to"] * 1000)]
    raise SystemExit(f"{ref}: no take recites it from the first word to the last")


def aligner_timings(reciter: str) -> dict[str, list[int]]:
    spans: dict[str, list[int]] = {}
    for surah in range(1, 115):
        takes: dict[str, list[tuple[int, dict]]] = {}
        kept = 0  # position among the verse segments kept, so skipped noise does not split a take
        segments = aligned_segments(reciter, surah)
        for prev, seg in zip(segments, segments[1:]):
            # The aligner can fold a surah's opening letter into the basmala before
            # it: Sad's ص at 38:1. Start the verse at the basmala, so the letter
            # stays in its verse. The basmala comes with it; without word timings
            # for that segment there is nowhere better to cut.
            if prev["kind"] == "special" and seg["ref_from"] == f"{surah}:1:2":
                seg["ref_from"], seg["time_from"] = f"{surah}:1:1", prev["time_from"]
        for seg in segments:
            if seg["kind"] != "quran" or not seg["ref_from"]:
                continue  # isti'adha, basmala, or a sound the aligner could not place
            start_ref, end_ref = verse(seg["ref_from"]), verse(seg["ref_to"])
            if not start_ref.startswith(f"{surah}:"):
                # A surah's file holds only that surah. The aligner matched a sound
                # after Al-A'raf's last verse to a word of 8:1, which taken as 8:1
                # would stretch that verse across the whole of Al-Anfal.
                print(f"  {surah}: ignoring {seg['ref_from']} matched at {seg['time_from']}s", file=sys.stderr)
                continue
            if start_ref != end_ref:
                raise SystemExit(f"{reciter}: segment {seg['ref_from']}-{seg['ref_to']} crosses a verse end")
            if seg["confidence"] < 0.5:
                print(f"  {start_ref}: low confidence {seg['confidence']}", file=sys.stderr)
            takes.setdefault(start_ref, []).append((kept, seg))
            kept += 1
        for ref, segs in takes.items():
            spans[ref] = first_complete_take(ref, segs)
        print(f"{reciter} {surah:3d} aligned", file=sys.stderr)
    return spans


def write_timings(reciter: str, spans: dict[str, list[int]]) -> None:
    missing = [f"{s}:{a}" for s, a in all_ayahs() if f"{s}:{a}" not in spans]
    if missing:
        raise SystemExit(f"{reciter}: {len(missing)} ayahs untimed, starting {missing[:10]}")
    for s, a in all_ayahs():
        start, end = spans[f"{s}:{a}"]
        nxt = spans.get(f"{s}:{a + 1}")
        # Verse spans meet or leave a gap, never overlap: an overlap means a
        # segment was placed on the wrong verse, and the cut would be wrong.
        if end <= start or (nxt and nxt[0] < end):
            raise SystemExit(f"{reciter}: {s}:{a} {spans[f'{s}:{a}']} overlaps or precedes the next ayah {nxt}")
    # One ayah per line, so a diff points at the verse that moved.
    lines = [f"  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}," for k, v in RECITERS[reciter].items()]
    ayahs = ",\n".join(f'    "{s}:{a}": {json.dumps(spans[f"{s}:{a}"])}' for s, a in all_ayahs())
    TIMINGS_DIR.mkdir(exist_ok=True)
    (TIMINGS_DIR / f"{reciter}.json").write_text("{\n" + "\n".join(lines) + '\n  "ayahs": {\n' + ayahs + "\n  }\n}\n")
    print(f"{reciter}: {len(spans)} ayahs -> {TIMINGS_DIR / f'{reciter}.json'}", file=sys.stderr)


def timings(only: list[str]) -> None:
    for reciter in only:
        spans = released_timings() if reciter == "abdurrashid_sufi" else aligner_timings(reciter)
        write_timings(reciter, spans)


# ---------- cut ----------

def cut_ayah(src: Path, dest: Path, start_ms: int, end_ms: int) -> None:
    part = dest.with_name(dest.stem + ".part.mp3")
    # s16p, not the decoder's float planar: on some cuts ffmpeg (8.1 and 9.0.1
    # alike) hands the encoder an unpadded last frame, and libmp3lame's float
    # path rejects it with "inadequate AVFrame plane padding". 2:234 of Sufi's
    # recording is one. The 16-bit path has no such check.
    subprocess.run(
        ["ffmpeg", "-nostdin", "-loglevel", "error", "-y",
         "-ss", f"{start_ms / 1000:.3f}", "-t", f"{(end_ms - start_ms) / 1000:.3f}", "-i", str(src),
         "-map", "0:a", "-map_metadata", "-1",
         "-c:a", "libmp3lame", "-sample_fmt", "s16p", "-b:a", "128k", str(part)],
        check=True,
    )
    part.rename(dest)  # never leave a half-written file under the served name


def cut(only: list[str], workers: int) -> None:
    for reciter in only:
        spec = json.loads((TIMINGS_DIR / f"{reciter}.json").read_text())
        out = AUDIO_DIR / reciter
        out.mkdir(parents=True, exist_ok=True)
        for surah in range(1, 115):
            todo = [(a, *spec["ayahs"][f"{surah}:{a}"]) for a in range(1, AYAH_COUNT[surah] + 1)
                    if not (out / f"{surah:03d}{a:03d}.mp3").exists()]
            if not todo:
                continue
            with tempfile.TemporaryDirectory() as tmp:
                src = Path(tmp) / "surah.mp3"
                src.write_bytes(request(spec["audio"].format(surah=surah), timeout=600))
                with ThreadPoolExecutor(workers) as pool:
                    jobs = [pool.submit(cut_ayah, src, out / f"{surah:03d}{a:03d}.mp3", start, end)
                            for a, start, end in todo]
                    for job in jobs:
                        job.result()
            print(f"{reciter} {surah:3d}: cut {len(todo)}", file=sys.stderr)
        count = len(list(out.glob("[0-9][0-9][0-9][0-9][0-9][0-9].mp3")))  # not a failed run's .part files
        print(f"{reciter}: {count} of 6236 ayah files in {out}", file=sys.stderr)
        if count != 6236:
            raise SystemExit(f"{reciter}: expected 6236 files, found {count}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("step", choices=["timings", "cut"])
    parser.add_argument("--reciter", choices=list(RECITERS), action="append",
                        help="limit to one reciter (repeatable); default is all")
    parser.add_argument("--workers", type=int, default=4, help="parallel ffmpeg processes for `cut`")
    args = parser.parse_args()
    only = args.reciter or list(RECITERS)
    if args.step == "timings":
        timings(only)
    else:
        cut(only, args.workers)
    return 0


if __name__ == "__main__":
    sys.exit(main())
