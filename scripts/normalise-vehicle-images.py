"""
Normalise the icar studio cutouts into the frame the cards render.

    python scripts/normalise-vehicle-images.py <source-dir>

Source images are icar's background-removed studio shots, 620x413, one per
catalogue id. They arrive at a consistent angle but with inconsistent padding:
the car occupies anywhere from 85% to 100% of the frame width. Scaling the
*canvas* therefore produces cars of visibly different sizes on screen, so this
scales the *car* — crop to its bounding box, fit that inside a fixed box, and
centre it on a white frame. Because the source is already a cutout on white,
the padding is invisible and no car is ever cropped.

Two traps, both hit for real:

1. Do not write this in PowerShell. PowerShell variables are case-insensitive,
   so `$h = ...` silently overwrites the canvas height `$H`. The first version
   of this script did exactly that and shipped 43 images in 43 different sizes,
   shrinking by ~6% each pass down to 67x44. test/data/images.test.ts is the
   standing guard against a repeat.

2. Fetching from icar needs a browser User-Agent; the default urllib/curl agent
   gets a 403. Worse, a missing file returns HTTP 200 with `text/html` and zero
   bytes rather than a 404, so any downloader must check the body, not the
   status.
"""

import glob
import os
import sys

from PIL import Image
import numpy as np

DST = 'src/data/assets/vehicles'
FRAME_W, FRAME_H = 1000, 625        # 16:10, matching the card's aspect-ratio
BOX_W, BOX_H = 0.88, 0.80           # the car's share of the frame; rest is margin

# Anything below this is the car. Cutouts sit on pure white (255); the margin
# leaves room for JPEG ringing along the car's edge without eating the shadow.
WHITE = 238


def car_bbox(im: Image.Image) -> tuple[int, int, int, int]:
    a = np.asarray(im.convert('L'))
    mask = a < WHITE
    cols = np.where(mask.any(0))[0]
    rows = np.where(mask.any(1))[0]
    if len(cols) == 0 or len(rows) == 0:
        raise ValueError('no car found — is this a blank frame?')
    return int(cols[0]), int(rows[0]), int(cols[-1]) + 1, int(rows[-1]) + 1


def main(src: str) -> int:
    sources = sorted(glob.glob(f'{src}/*.jpg'))
    if not sources:
        print(f'no .jpg in {src}', file=sys.stderr)
        return 1

    for stale in glob.glob(f'{DST}/*.jpg'):
        os.remove(stale)

    scales = []
    for path in sources:
        name = os.path.basename(path)[:-4]
        im = Image.open(path).convert('RGB')
        car = im.crop(car_bbox(im))
        cw, ch = car.size

        scale = min(FRAME_W * BOX_W / cw, FRAME_H * BOX_H / ch)
        nw, nh = max(1, round(cw * scale)), max(1, round(ch * scale))

        out = Image.new('RGB', (FRAME_W, FRAME_H), 'white')
        out.paste(car.resize((nw, nh), Image.LANCZOS),
                  ((FRAME_W - nw) // 2, (FRAME_H - nh) // 2))
        out.save(f'{DST}/{name}.jpg', quality=90, optimize=True, progressive=True)
        scales.append(scale)

    total = sum(os.path.getsize(p) for p in glob.glob(f'{DST}/*.jpg'))
    print(f'{len(sources)} images -> {FRAME_W}x{FRAME_H}, {total // 1024} KB total')
    print(f'upscale x{min(scales):.2f}..x{max(scales):.2f}')
    print('now run: npx vitest run test/data/images.test.ts')
    return 0


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(__doc__)
        raise SystemExit(2)
    raise SystemExit(main(sys.argv[1]))
