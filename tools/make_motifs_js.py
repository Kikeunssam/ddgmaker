"""motifs-list.js에 적힌 문양 그림을 motifs.js 하나에 담는다.

index.html을 더블클릭해서(서버 없이) 열 때 브라우저는 그림 파일을 캔버스에 그린 뒤 미리보기로 저장하지 못하므로,
문양을 바꾸거나 추가했으면 앱 폴더에서 이 스크립트를 한 번 실행한다:  python3 tools/make_motifs_js.py
"""
import base64
import json
import pathlib
import re

root = pathlib.Path(__file__).resolve().parent.parent
ids = re.findall(r'\bid:\s*"([^"]+)"', (root / "motifs-list.js").read_text(encoding="utf-8"))
data = {i: "data:image/webp;base64," + base64.b64encode((root / "assets" / "motifs" / f"{i}.webp").read_bytes()).decode("ascii") for i in ids}
(root / "motifs.js").write_text("window.MOTIF_DATA = " + json.dumps(data, indent=0) + ";\n", encoding="utf-8")
print("motifs.js:", len(data), "개")
