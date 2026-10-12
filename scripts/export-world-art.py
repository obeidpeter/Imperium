"""Mechanical export only: retain original generated pixels, alpha and provenance."""
from pathlib import Path
from hashlib import sha256
import argparse
import json
from PIL import Image

parser=argparse.ArgumentParser()
parser.add_argument('--ground',type=Path,required=True)
parser.add_argument('--props',type=Path,required=True)
parser.add_argument('--camp',type=Path)
parser.add_argument('--output',type=Path,default=Path(__file__).resolve().parent.parent/'assets/world')
args=parser.parse_args()
args.output.mkdir(parents=True,exist_ok=True)
ground=Image.open(args.ground).convert('RGB')
assert ground.size==(1536,1024)
ground.resize((1152,768),Image.Resampling.LANCZOS).save(args.output/'ground-materials.webp','WEBP',quality=84,method=6)
props=Image.open(args.props).convert('RGBA')
assert props.size==(1254,1254)
# The generated master did not obey equal cells. These reviewed object crops
# normalize the four distinct illustrations; alpha is never replaced by a mask.
boxes=[(0,0,701,616),(701,0,1254,668),(0,620,627,1254),(627,681,1254,1254)]
sheet=Image.new('RGBA',(1024,1024))
for index,box in enumerate(boxes):
    cell=props.crop(box)
    bounds=cell.getchannel('A').getbbox()
    assert bounds
    cell=cell.crop(bounds)
    cell.thumbnail((472,460),Image.Resampling.LANCZOS)
    sheet.alpha_composite(cell,((index%2)*512+(512-cell.width)//2,(index//2)*512+480-cell.height))
sheet.save(args.output/'natural-props.webp','WEBP',quality=87,method=6)
if args.camp:
    camp=Image.open(args.camp).convert('RGBA')
    assert camp.size==(1536,1024)
    camp_sheet=Image.new('RGBA',(1024,512))
    for index in range(2):
        cell=camp.crop((index*768,0,(index+1)*768,1024))
        cell.thumbnail((472,460),Image.Resampling.LANCZOS)
        camp_sheet.alpha_composite(cell,(index*512+(512-cell.width)//2,480-cell.height))
    camp_sheet.save(args.output/'camp-props.webp','WEBP',quality=87,method=6)
data=[]
for name,source,layout in [('ground-materials.webp',args.ground,{'columns':3,'rows':2,'cells':['meadow','dry-earth','limestone','water','marsh','road']}),('natural-props.webp',args.props,{'columns':2,'rows':2,'cells':['rock','palm','oak','rampart'],'sourceCropBoxes':boxes,'normalizedCell':[512,512],'footBaseline':480})]:
    p=args.output/name;b=p.read_bytes();image=Image.open(p)
    data.append({'path':'assets/world/'+name,'bytes':len(b),'sha256':sha256(b).hexdigest(),'width':image.width,'height':image.height,'mode':image.mode,'quality':84 if name.startswith('ground') else 87,'sourceFile':source.name,'sourceSha256':sha256(source.read_bytes()).hexdigest(),'layout':layout})
if args.camp:
    p=args.output/'camp-props.webp';b=p.read_bytes()
    data.append({'path':'assets/world/camp-props.webp','bytes':len(b),'sha256':sha256(b).hexdigest(),'width':1024,'height':512,'mode':'RGBA','quality':87,'sourceFile':args.camp.name,'sourceSha256':sha256(args.camp.read_bytes()).hexdigest(),'layout':{'columns':2,'rows':1,'cells':['palisade','supplies'],'sourceCropBoxes':[[0,0,768,1024],[768,0,1536,1024]],'normalizedCell':[512,512],'footBaseline':480}})
print(json.dumps(data,indent=2))
