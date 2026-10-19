"""Generate the story scenes' depth maps (offline development tool).

Not part of the build. It needs Pillow, NumPy, onnxruntime and the MiDaS v2.1
small ONNX model (MIT licence, https://github.com/isl-org/MiDaS/releases/tag/v2_1,
file model-small.onnx). Provenance, settings and the model checksum are
recorded in docs/asset-manifest.json and docs/art-generation.md.

    python3 -I scripts/scene-depth.py --model /path/to/model-small.onnx \
        [--pylib /path/to/site-packages] [--width 384] [--quality 88]

For each assets/scenes/*.webp it writes assets/scenes/depth/<name>.webp: a
greyscale map 384 pixels wide, near = light, far = dark. The model's relative
inverse depth is spread between its 2nd and 98th percentiles, eased by a
gentle gamma, and softened so the parallax drift never tears an edge.
"""
import argparse
import glob
import os
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--model', required=True)
    parser.add_argument('--pylib', default=None, help='extra site-packages holding onnxruntime')
    parser.add_argument('--scenes', default='assets/scenes')
    parser.add_argument('--width', type=int, default=384)
    parser.add_argument('--quality', type=int, default=88)
    args = parser.parse_args()
    if args.pylib:
        sys.path.insert(0, args.pylib)
    import numpy as np
    import onnxruntime as ort
    from PIL import Image, ImageFilter

    session = ort.InferenceSession(args.model, providers=['CPUExecutionProvider'])
    name = session.get_inputs()[0].name
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    out_dir = os.path.join(args.scenes, 'depth')
    os.makedirs(out_dir, exist_ok=True)
    for path in sorted(glob.glob(os.path.join(args.scenes, '*.webp'))):
        image = Image.open(path).convert('RGB')
        sample = np.asarray(image.resize((256, 256), Image.BICUBIC), dtype=np.float32) / 255.0
        tensor = ((sample - mean) / std).transpose(2, 0, 1)[None].astype(np.float32)
        inverse = session.run(None, {name: tensor})[0].reshape(256, 256)
        low, high = np.percentile(inverse, 2), np.percentile(inverse, 98)
        depth = np.clip((inverse - low) / max(1e-6, high - low), 0, 1) ** 0.85
        height = round(args.width * image.height / image.width)
        result = Image.fromarray((depth * 255).astype(np.uint8), 'L').resize((args.width, height), Image.BICUBIC)
        result = result.filter(ImageFilter.GaussianBlur(1.2))
        target = os.path.join(out_dir, os.path.basename(path))
        result.convert('RGB').save(target, 'WEBP', quality=args.quality, method=6)
        print(f'{target}: {args.width}x{height}, {os.path.getsize(target)} bytes')


if __name__ == '__main__':
    main()
