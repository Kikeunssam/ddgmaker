"""말모이체에서 화면 글에 쓰는 글자만 뽑아 assets/fonts/fonts.css에 data:로 넣는다.

화면 글(index.html, *.js)을 바꿨으면 앱 폴더에서 한 번 실행한다:  python3 tools/make_font_subset.py
(pyftsubset이 필요하다: pip install fonttools brotli)
나머지 글자는 온 글꼴 파일(malmoi-*.woff2)에서 필요할 때만 받는다.
"""
import base64
import pathlib
import subprocess
import tempfile

root = pathlib.Path(__file__).resolve().parent.parent
fonts = root / "assets" / "fonts"
chars = set(chr(c) for c in range(0x20, 0x7F)) | set(chr(c) for c in range(0x3131, 0x3164)) | set("·…‘’“”「」『』《》〈〉→←↑↓↗✕©—–°")
for f in ["index.html", "app.js", "motifs.js", "patterns.js", "sounds-list.js", "ink.js"]:
    chars |= set((root / f).read_text(encoding="utf-8"))
chars = sorted(c for c in chars if ord(c) >= 0x20)
cps = [ord(c) for c in chars]
ranges, a, b = [], cps[0], cps[0]
for c in cps[1:]:
    if c == b + 1:
        b = c
    else:
        ranges.append((a, b)); a = b = c
ranges.append((a, b))
fmt = lambda rs: ", ".join(f"U+{x:X}" if x == y else f"U+{x:X}-{y:X}" for x, y in rs)
ur = fmt(ranges)
# 온 글꼴은 작은 글꼴에 없는 글자에만 쓰이게 한다 (겹치면 브라우저가 처음부터 함께 받는다)
rest, start = [], 0
for x, y in ranges:
    if x > start:
        rest.append((start, x - 1))
    start = y + 1
rest.append((start, 0x10FFFF))
ur_rest = fmt(rest)
out = ["/* 말모이체 (사용자가 준 글꼴).",
       " * 화면에 쓰는 글자만 담은 작은 글꼴을 data:로 바로 넣어(파일로 열어도 읽힘) 첫 화면을 빨리 띄우고,",
       " * 그 밖의 글자(작품 이름 등)가 나올 때만 온 글꼴 파일을 받는다. 화면 글을 바꾸면 tools/make_font_subset.py를 다시 실행할 것. */"]
with tempfile.TemporaryDirectory() as tmp:
    txt = pathlib.Path(tmp) / "chars.txt"
    txt.write_text("".join(chars), encoding="utf-8")
    for weight, name in [("400 600", "medium"), ("700 900", "bold")]:
        sub = pathlib.Path(tmp) / f"{name}.woff2"
        subprocess.run(["pyftsubset", str(fonts / f"malmoi-{name}.woff2"), f"--text-file={txt}", "--flavor=woff2",
                        f"--output-file={sub}", "--layout-features=*"], check=True)
        b64 = base64.b64encode(sub.read_bytes()).decode("ascii")
        out.append(f'@font-face {{ font-family: "Malmoi"; font-weight: {weight}; font-display: swap; src: url(malmoi-{name}.woff2) format("woff2"); unicode-range: {ur_rest}; }}')
        out.append(f'@font-face {{ font-family: "Malmoi"; font-weight: {weight}; font-display: block; src: url(data:font/woff2;base64,{b64}) format("woff2"); unicode-range: {ur}; }}')
(fonts / "fonts.css").write_text("\n".join(out) + "\n", encoding="utf-8")
print("fonts.css:", len(chars), "글자")
