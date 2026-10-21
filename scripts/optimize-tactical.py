"""Mechanical atlas normalization only. Original images are made with ImageGen.

Usage: python optimize-tactical.py ORIGINAL_DIRECTORY OUTPUT_DIRECTORY
The generated PNGs stay in the review workspace; runtime assets are WebP.
"""
from pathlib import Path
import json, sys
from PIL import Image

sources = {
    'roman': ('exec-27a90549-4cba-48f4-ac7b-2bdb4151b670.png', [0,340,685,1044,1536]),
    'frontier': ('exec-a1f6c55c-b78b-4efb-bc17-e5651f3779a3.png', [0,374,700,1070,1536]),
    'civic': ('exec-708d4793-2709-481b-8186-a8914427cf18.png', [0,371,744,1098,1536]),
}
source, dest = map(Path, sys.argv[1:3]); dest.mkdir(parents=True, exist_ok=True)
report = []
for kind, (filename, boundaries) in sources.items():
    original = Image.open(source / filename).convert('RGBA')
    sheet = Image.new('RGBA', (768,1024))
    for row in range(4):
        for col in range(4):
            top, bottom = boundaries[row:row+2]
            if kind == 'frontier' and row == 2:
                top = [697,712,705,688][col]
            cell = original.crop((col*256,top,(col+1)*256,bottom))
            box = cell.getchannel('A').point(lambda v: 255 if v>12 else 0).getbbox()
            if not box: raise ValueError('Empty sprite')
            cell = cell.crop(box)
            cell.thumbnail((176,232),Image.Resampling.LANCZOS)
            sheet.alpha_composite(cell,(col*192+(192-cell.width)//2,row*256+240-cell.height))
    path = dest / f'units-{kind}.webp'
    sheet.save(path,'WEBP',quality=76,method=6,exact=True)
    report.append({'file':path.name,'bytes':path.stat().st_size,'width':768,'height':1024,'cell':[192,256],'feetY':240,'alpha':True})
print(json.dumps(report,indent=2))

