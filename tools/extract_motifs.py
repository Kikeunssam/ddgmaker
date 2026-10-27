"""1편 단청·자개 영상에서 도장으로 쓸 문양 하나씩을 투명 PNG로 뽑는다.

    python3 tools/extract_motifs.py <1편 clips 폴더> [출력 폴더(기본 motifs)]

- 단청(dc*.mp4): 흰 바탕 위 그림 → 흰색을 투명으로 (흰 바탕에 덮인 정도를 거꾸로 계산)
- 자개(nj*.mp4): 검은 바탕 위 그림 → 검은색을 투명으로
- 문양이 가장 많이 드러난 장면에서, 따로 떨어진 무늬 덩어리 가운데 가장 큰 것 하나를 고른다.
  화면 전체가 한 무늬로 이어져 있으면 가운데를 둥글게 오려 '문양판'으로 쓴다.
긴 쪽이 MAX px를 넘지 않게 줄여 webp로 쓰고, 확인용 모아보기(sheet_*.jpg)도 만든다.
문양마다 뽑는 법은 아래 HOW에서 고른다 (도장으로 쓰기 어려운 영상은 뺀다).
"""
import pathlib
import sys

import cv2
import numpy as np

src = pathlib.Path(sys.argv[1])
out = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "motifs")
out.mkdir(parents=True, exist_ok=True)
MAX = 400
# 이름: (뽑는 법, 값) — one: 가장 큰 덩어리(값 = 덩어리를 이을 틈 px), plate: 둥근 문양판(값 = 지름 px), whole: 화면 전체
HOW = {
    "dc01_lotus_bloom": ("one", 15), "dc02_wave_sweep": ("plate", 640), "dc03_tile_medallions": ("one", 15),
    "dc04_meoricho_band": ("plate", 640), "dc05_hex_lattice": ("plate", 640), "dc06_cloud_scroll": ("one", 15),
    "dc07_aja_lattice": ("plate", 640), "dc08_jewel_spiral": ("whole", 0), "dc09_rainbow_ripple": ("plate", 1060),
    "dc10_twin_lotus": ("one", 15), "dc11_star_rosette": ("one", 15), "dc12_soran_grid": ("one", 15),
    "dc14_maehwa_scatter": ("one", 15), "dc17_clock_petals": ("one", 15), "dc18_octagon_ripple": ("plate", 640),
    "dc19_lotus_ring": ("one", 15), "dc20_diamond_chain": ("plate", 640), "dc22_falling_petals": ("one", 15),
    "dc23_sun_rays": ("plate", 640), "dc24_cloud_drift": ("one", 15), "dc25_hexa_cross": ("one", 15),
    "nj01_pine_fans": ("one", 5), "nj02_butterfly_flower": ("one", 5),
    "nj04_flower_vine": ("one", 15), "nj06_diamond_lattice": ("plate", 640), "nj07_pearl_dots": ("plate", 640),
    "nj09_spinning_rings": ("plate", 1060), "nj10_tortoise_hex": ("plate", 640), "nj12_chilbo_rings": ("plate", 640),
    "nj13_bamboo": ("one", 15), "nj14_sparkles": ("one", 15), "nj15_wave_scales": ("plate", 640),
    "nj16_cranes": ("one", 15), "nj17_chrysanthemums": ("one", 15), "nj18_plum_branch": ("whole", 0),
    "nj19_peony": ("one", 15), "nj20_cloud_scrolls": ("one", 5), "nj21_lotus_pond": ("one", 15),
    "nj22_circling_fish": ("one", 15), "nj23_kaleidoscope": ("plate", 640), "nj25_pine_branch": ("one", 15),
    "nj26_flower_frame": ("plate", 640),
}


def to_rgba(frame, white_bg):
    f = frame.astype(np.float32) / 255.0
    if white_bg:
        a = np.max(1.0 - f, axis=2)
        a3 = np.maximum(a, 1e-4)[..., None]
        rgb = (f - (1.0 - a3)) / a3
    else:
        a = np.max(f, axis=2)
        a3 = np.maximum(a, 1e-4)[..., None]
        rgb = f / a3
    a = np.clip((a - 0.03) / 0.97, 0, 1)   # 영상 잡티는 버린다
    rgba = np.dstack([np.clip(rgb, 0, 1), a])
    return (rgba * 255 + 0.5).astype(np.uint8)


def best_frame(path, white_bg):
    cap = cv2.VideoCapture(str(path))
    best, score = None, -1
    while True:
        ok, fr = cap.read()
        if not ok:
            break
        small = cv2.resize(fr, (192, 108)).astype(np.float32)
        s = (255 - small).sum() if white_bg else small.sum()
        if s > score:
            best, score = fr, s
    cap.release()
    return best


def pick_one(rgba, gap):
    """따로 떨어진 무늬 덩어리 가운데 가장 큰 것. 없으면(한 덩어리가 화면을 다 덮으면) None."""
    H, W = rgba.shape[:2]
    m = (rgba[..., 3] > 24).astype(np.uint8)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (gap, gap))
    n, lab, stats, _ = cv2.connectedComponentsWithStats(cv2.dilate(m, k), 8)
    if n <= 1:
        return None
    i = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    x, y, w, h = stats[i, :4]
    one = rgba.copy()
    one[..., 3] = np.where(lab == i, one[..., 3], 0)
    return one[y:y + h, x:x + w]


def plate(rgba, size):
    """가운데를 둥글게 오린 문양판 (가장자리는 부드럽게)."""
    H, W = rgba.shape[:2]
    cy, cx = H // 2, W // 2
    r = min(size // 2, cy, cx)
    crop = rgba[cy - r:cy + r, cx - r:cx + r].copy()
    yy, xx = np.mgrid[-r:r, -r:r] + 0.5
    d = np.sqrt(xx * xx + yy * yy) / r
    soft = np.clip((1.0 - d) / 0.06, 0, 1)
    crop[..., 3] = (crop[..., 3] * soft).astype(np.uint8)
    return crop


def trim(rgba, pad=4):
    ys, xs = np.where(rgba[..., 3] > 10)
    if not len(xs):
        return None
    y0, y1 = max(0, ys.min() - pad), min(rgba.shape[0], ys.max() + pad)
    x0, x1 = max(0, xs.min() - pad), min(rgba.shape[1], xs.max() + pad)
    return rgba[y0:y1, x0:x1]


sheets = {"dc": [], "nj": []}
for path in sorted(src.glob("*/*.mp4")):
    name = path.stem
    kind = name[:2]
    if kind not in sheets or "mix" in str(path.parent) or name not in HOW:
        continue
    white_bg = kind == "dc"
    rgba = to_rgba(best_frame(path, white_bg), white_bg)
    how, v = HOW[name]
    one = pick_one(rgba, v) if how == "one" else plate(rgba, v) if how == "plate" else rgba
    one = trim(one)
    if one is None:
        print("빈 영상:", name)
        continue
    k = min(1.0, MAX / max(one.shape[:2]))
    if k < 1:
        one = cv2.resize(one, (round(one.shape[1] * k), round(one.shape[0] * k)), interpolation=cv2.INTER_AREA)
    # OpenCV는 BGRA 순서로 쓴다 (영상에서 읽은 것도 BGR이라 그대로)
    cv2.imwrite(str(out / f"{name}.webp"), one, [cv2.IMWRITE_WEBP_QUALITY, 88])
    print(name, how, one.shape[1], "x", one.shape[0])
    sheets[kind].append((name, one))

for kind, items in sheets.items():
    if not items:
        continue
    cell = 220
    cols = 7
    rows = (len(items) + cols - 1) // cols
    bg = (240, 245, 248) if kind == "dc" else (20, 20, 22)
    sheet = np.full((rows * (cell + 24), cols * cell, 3), bg, np.uint8)
    for i, (name, im) in enumerate(items):
        k = (cell - 16) / max(im.shape[:2])
        im2 = cv2.resize(im, (max(1, round(im.shape[1] * k)), max(1, round(im.shape[0] * k))), interpolation=cv2.INTER_AREA)
        a = im2[..., 3:4].astype(np.float32) / 255
        r, c = divmod(i, cols)
        y, x = r * (cell + 24) + 8, c * cell + 8
        roi = sheet[y:y + im2.shape[0], x:x + im2.shape[1]].astype(np.float32)
        sheet[y:y + im2.shape[0], x:x + im2.shape[1]] = (im2[..., :3] * a + roi * (1 - a)).astype(np.uint8)
        cv2.putText(sheet, name[:14], (x, r * (cell + 24) + cell + 12), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (128, 128, 128), 1)
    cv2.imwrite(str(out / f"sheet_{kind}.jpg"), sheet, [cv2.IMWRITE_JPEG_QUALITY, 85])
