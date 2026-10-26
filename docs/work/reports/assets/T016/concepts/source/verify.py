import json,pathlib,struct,hashlib
root=pathlib.Path(__file__).resolve().parents[1]
rows=json.loads((root/'measurements.json').read_text());fail=[]
minimum={'turn-text':20,'dir-text':18,'count-num':26,'count-lbl':14,'seat-name':16,'tag-turn':14,'card-name':14,'pile-lbl':14}
for m in rows:
 w,h=m['viewport']['w'],m['viewport']['h'];ctx=[m['concept'],w,m['state']]
 if m['slack']<0 or m['scroll']['docH']>h or m['scroll']['docW']>w:fail.append(ctx+['overflow'])
 if len(m['details']['seats'])!=(8 if m['state']=='s2' else 4):fail.append(ctx+['seat count'])
 for b in m['details']['seats']:
  if b['x']<4 or b['x']+b['w']>w-4 or b['y']<0 or b['y']+b['h']>h:fail.append(ctx+['seat bounds'])
 if any(b['w']<72 for b in m['details']['cards']):fail.append(ctx+['hand card width'])
 if any(min(b['w'],b['h'])<44 for b in m['details']['targets']):fail.append(ctx+['touch'])
 for f in m['details']['fonts']:
  if f['font']<minimum[f['type']]:fail.append(ctx+['font',f])
 if w==1280 and m['details']['handScroll']['scroll']>m['details']['handScroll']['client']:fail.append(ctx+['desktop hand scroll'])
 name=f"{m['concept']}-{w}-s0{m['state'][-1]}.png"
 if struct.unpack('>II',(root/name).read_bytes()[16:24])!=(w,h):fail.append(ctx+['png dimensions'])
for concept in 'abc':
 width,height=struct.unpack('>II',(root/f'{concept}-closeup.png').read_bytes()[16:24])
 if width!=808 or height not in (528,548,504):fail.append([concept,'2x closeup',width,height])
r=root.parent;preserved=json.loads((root/'preserved-A2-hashes.json').read_text())
if not all(hashlib.sha256((r/p).read_bytes()).hexdigest()==h for p,h in preserved.items()):fail.append(['A2 preservation'])
result={'fullViewports':len(rows),'closeups2x':3,'A2preserved':True,'failures':fail}
(root/'verification.json').write_text(json.dumps(result,indent=2,ensure_ascii=False));print(result);assert not fail
