"""Crop, resize and encode the generated environmental prop sheet; no repainting."""
from pathlib import Path
from PIL import Image
import sys

source, destination = map(Path, sys.argv[1:3])
original = Image.open(source).convert('RGBA')
boxes = [(0,0,437,512),(437,0,769,510),(765,150,1178,507),(1180,0,1536,511),
         (0,514,427,1024),(438,510,707,1024),(750,513,1127,1024),(1125,513,1536,1024)]
sheet = Image.new('RGBA',(768,512))
for i, box in enumerate(boxes):
    cell = original.crop(box)
    bounds = cell.getchannel('A').point(lambda value:255 if value>12 else 0).getbbox()
    cell = cell.crop(bounds); cell.thumbnail((184,232),Image.Resampling.LANCZOS)
    sheet.alpha_composite(cell,((i%4)*192+(192-cell.width)//2,(i//4)*256+240-cell.height))
destination.parent.mkdir(parents=True,exist_ok=True)
sheet.save(destination,'WEBP',quality=80,method=6,exact=True)
print(f'{destination.name}: {destination.stat().st_size} bytes, 768x512 RGBA')
