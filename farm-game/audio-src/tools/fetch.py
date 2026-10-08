"""Download every source file listed in audio-src/*-sources.json into a raw folder outside the repo.

Usage: python -I fetch.py RAW_DIR [--lock]
Each entry lands at RAW_DIR/<id>.<ext>. An entry with a "member" names one file inside a zip archive:
the archive is downloaded once to RAW_DIR/_archives/ and only that member is extracted (by name, with
the bytes written to our own path, so archive paths can never escape the folder). Nothing downloaded is
ever executed. Files already present are not re-downloaded.
With --lock, sha1 and size of each source file are written to audio-src/sources.lock.json; without it,
existing lock entries are verified (a mismatch means the upstream file changed: stop and look).
"""
import hashlib
import json
import os
import sys
import urllib.parse
import urllib.request
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.dirname(HERE)


def catalogs() -> dict:
    out = {}
    for name in sorted(os.listdir(SRC)):
        if name.endswith("-sources.json"):
            with open(os.path.join(SRC, name), encoding="utf8") as f:
                out.update(json.load(f))
    return out


def download(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "tiny-acre-audio-fetch"})
    with urllib.request.urlopen(req) as r:
        return r.read()


def source_path(raw: str, sid: str, e: dict) -> str:
    name = e.get("member") or e.get("path") or urllib.parse.unquote(e["url"])
    ext = os.path.splitext(name)[1].split("?")[0].lower() or ".bin"
    return os.path.join(raw, sid + ext)


def main() -> None:
    raw = sys.argv[1]
    lock_mode = "--lock" in sys.argv
    lock_path = os.path.join(SRC, "sources.lock.json")
    lock = json.load(open(lock_path, encoding="utf8")) if os.path.exists(lock_path) else {}
    bad = 0
    cats = catalogs()
    for sid, e in cats.items():
        dest = source_path(raw, sid, e)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        if not os.path.exists(dest):
            try:
                if "member" in e:
                    arch = os.path.join(raw, "_archives", hashlib.sha1(e["url"].encode()).hexdigest()[:12] + ".zip")
                    os.makedirs(os.path.dirname(arch), exist_ok=True)
                    if not os.path.exists(arch):
                        with open(arch, "wb") as f:
                            f.write(download(e["url"]))
                    with zipfile.ZipFile(arch) as z:
                        body = z.read(e["member"])
                else:
                    body = download(e["url"])
            except (OSError, KeyError, zipfile.BadZipFile) as err:
                print(f"FAILED {sid}: {err}")
                bad += 1
                continue
            with open(dest, "wb") as f:
                f.write(body)
        data = open(dest, "rb").read()
        sha = hashlib.sha1(data).hexdigest()
        if lock_mode:
            lock[sid] = {"sha1": sha, "bytes": len(data)}
        elif sid in lock and lock[sid]["sha1"] != sha:
            print(f"MISMATCH {sid}: {sha} != {lock[sid]['sha1']}")
            bad += 1
    if lock_mode:
        lock = {k: v for k, v in lock.items() if k in cats}
        with open(lock_path, "w", encoding="utf8", newline="\n") as f:
            json.dump(dict(sorted(lock.items())), f, indent=1)
            f.write("\n")
    print(f"{len(cats)} sources, {bad} problems")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
