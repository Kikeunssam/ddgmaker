"""sounds-list.js에 적힌 음원을 sounds.js 하나에 담는다.

index.html을 더블클릭해서(서버 없이) 열 때 브라우저는 음원 파일을 직접 읽지 못하므로,
음원을 바꾸거나 추가했으면 앱 폴더에서 이 스크립트를 한 번 실행한다:  python3 tools/make_sounds_js.py
"""
import base64
import json
import pathlib
import re

root = pathlib.Path(__file__).resolve().parent.parent
ids = re.findall(r'\bid:\s*"([^"]+)"', (root / "sounds-list.js").read_text(encoding="utf-8"))
data = {f"sounds/{i}.m4a": base64.b64encode((root / "sounds" / f"{i}.m4a").read_bytes()).decode("ascii") for i in ids}
(root / "sounds.js").write_text("window.SOUND_DATA = " + json.dumps(data, indent=0) + ";\n", encoding="utf-8")
print("sounds.js:", len(data), "개")
